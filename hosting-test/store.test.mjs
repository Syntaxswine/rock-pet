import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { operate, MAX_OUTAGE_MS } from '../hosting/store.mjs';
import { serve } from '../hosting/http.mjs';
import { parseLog } from '../src/log.mjs';
import { look, history } from '../src/rock.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { careTotals } from '../src/personality.mjs';

// Execute the actual migrations and SQL against SQLite, including rollback and
// affected-row counts. Awaited reads interleave to exercise revision conflicts.
function database(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    sql.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  const db = {
    sql,
    withSession(bookmark) { assert.equal(bookmark, 'first-primary'); return this; },
    prepare(query) {
      return {
        values: [], bind(...values) { this.values = values; return this; },
        async first() { return sql.prepare(query).get(...this.values) ?? null; },
        run() { return { meta: sql.prepare(query).run(...this.values) }; },
      };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const results = statements.map(s => s.run()); sql.exec('COMMIT'); return results; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return db;
}
const BORN = Date.UTC(2026, 9, 9, 10);
const FULL = 'feed x4 clean pet x10';
const state = db => JSON.parse(db.sql.prepare('SELECT state FROM rock').get().state);
const ledger = db => parseLog(db.sql.prepare('SELECT payload FROM rock_events ORDER BY seq').all().map(r => r.payload).join(''));
const send = (db, path = '/', body, extra = {}) => serve(new Request('https://hostile-host.example' + path, {
  method: body === undefined ? 'GET' : 'POST', body,
}), { DB: db, ...extra });

test('the public title creates nothing; exactly one competing name starts one shared rock', async t => {
  const db = database(t);
  assert.equal((await operate(db, '/', '', { now: BORN })).phase, 'title');
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM rock').get().n, 0);
  assert.equal((await operate(db, '/act', FULL, { now: BORN })).status, 409);
  const results = await Promise.all(['Pebble', 'Granite'].map(body => operate(db, '/name', body, { now: BORN })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM rock_names').get().n, 1);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM rock_events').get().n, 1);
  assert.equal(state(db).name.name, ledger(db).name.name);
  assert.equal((await operate(db, '/name', 'Quartz', { now: BORN + 1 })).status, 409);
});

test('simultaneous care lands once each; checkpoints and ledger survive new request instances', async t => {
  const db = database(t);
  await operate(db, '/name', 'Pebble', { now: BORN });
  for (let day = 0; day < 3; day++) {
    const now = BORN + day * 24 * HOUR;
    const results = await Promise.all(Array.from({ length: 16 }, () => operate(db, '/act', FULL, { now })));
    assert.ok(results.every(r => r.status === 200));
  }
  const full = ledger(db), saved = state(db), now = BORN + 50 * HOUR;
  assert.equal(full.visits.length, 48);
  assert.equal(saved.visits.length, 16);
  assert.equal(saved.checkpoint.engine.visits, 32);
  assert.deepEqual(careTotals(saved), careTotals(full));
  assert.deepEqual(look(saved, { now, host: '' }), look(full, { now, host: '' }));
  assert.deepEqual(history(saved, { now }), history(full, { now }));
  assert.ok(Buffer.byteLength(look(saved, { now, host: '' }).text) < 450);
});

test('unattended time continues; a grave survives reads, clock rollback, care, names and reset URLs', async t => {
  const db = database(t);
  await operate(db, '/name', 'Pebble', { now: BORN });
  const expected = replay(state(db), BORN + 4 * 24 * HOUR).dead;
  const dead = await operate(db, '/', '', { now: BORN + 4 * 24 * HOUR });
  assert.equal(dead.phase, 'dead');
  assert.deepEqual(state(db).died, expected);
  assert.equal((await operate(db, '/act', FULL, { now: BORN })).status, 410);
  assert.equal((await operate(db, '/name', 'Quartz', { now: BORN })).status, 410);
  for (const path of ['/new-rock', '/reset', '/ops/reset']) assert.equal((await send(db, path, '')).status, 404);
  assert.deepEqual(state(db).died, expected);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM rock_events WHERE kind = 'death'").get().n, 1);
});

test('observations cannot move backwards; a failed transaction acknowledges no care', async t => {
  const db = database(t);
  await operate(db, '/name', 'Pebble', { now: BORN });
  const before = await operate(db, '/', '', { now: BORN + 20 * HOUR });
  const after = await operate(db, '/', '', { now: BORN });
  assert.equal(after.text, before.text);
  db.sql.exec("CREATE TRIGGER refuse_care BEFORE INSERT ON rock_events WHEN NEW.kind = 'care' BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
  const original = state(db);
  await assert.rejects(operate(db, '/act', FULL, { now: BORN + 21 * HOUR }), /disk failure/);
  assert.deepEqual(state(db), original);
  assert.equal(ledger(db).visits.length, 0);
});

test('missing, corrupt or inaccessible state never becomes a new title or birth', async t => {
  const db = database(t);
  await operate(db, '/name', 'Pebble', { now: BORN });
  db.sql.exec("UPDATE rock SET state = '{}'");
  await assert.rejects(operate(db, '/', '', { now: BORN }), /invalid stored rock/);
  db.sql.exec('DELETE FROM rock');
  await assert.rejects(operate(db, '/name', 'Quartz', { now: BORN }), /existing birth ledger/);
  db.sql.exec('DELETE FROM rock_names');
  await assert.rejects(operate(db, '/', '', { now: BORN }), /existing birth ledger/);
  db.sql.exec('DROP TABLE rock');
  await assert.rejects(operate(db, '/', '', { now: BORN }));
});

test('verified credit is bounded, atomic, publicly recorded and cannot change care or revive a grave', async t => {
  const db = database(t);
  await operate(db, '/name', 'Pebble', { now: BORN });
  const outage = { start: BORN + HOUR, end: BORN + 5 * 24 * HOUR, evidence: 'provider-incident-42' };
  const recovered = await operate(db, '/', '', { now: outage.end, outage });
  assert.equal(recovered.phase, 'alive');
  assert.equal(replay(state(db), outage.end).hunger, 10 / 24);
  const story = await operate(db, '/history', '', { now: outage.end, outage: { evidence: outage.evidence, end: outage.end, start: outage.start } });
  assert.match(story.text, /provider-incident-42/);
  assert.equal(ledger(db).outages.length, 1);
  await assert.rejects(operate(db, '/', '', { now: outage.end, outage: { ...outage, start: outage.start + 1 } }), /reused/);
  await operate(db, '/act', FULL, { now: outage.end + HOUR });
  await assert.rejects(operate(db, '/', '', { now: outage.end + 2 * HOUR, outage: { ...outage, evidence: 'overlap' } }));
  await assert.rejects(operate(db, '/', '', { now: outage.end + MAX_OUTAGE_MS + 1,
    outage: { start: outage.end, end: outage.end + MAX_OUTAGE_MS + 1, evidence: 'too-long' } }), /seven-day/);
  await operate(db, '/', '', { now: outage.end + 4 * 24 * HOUR });
  await assert.rejects(operate(db, '/', '', { now: outage.end + 4 * 24 * HOUR,
    outage: { start: outage.end + 2 * HOUR, end: outage.end + 4 * 24 * HOUR, evidence: 'too-late' } }), /permanent/);
});

test('HTTP limits bodies, methods and rate; never reflects Host, exposes reset, or accepts public credit', async t => {
  const db = database(t);
  const title = await send(db);
  assert.equal(title.headers.get('cache-control'), 'no-store');
  assert.equal(title.headers.get('refresh'), '15');
  assert.equal(title.headers.get('x-rock-phase'), 'title');
  assert.doesNotMatch(await title.text(), /hostile-host/);
  assert.equal((await send(db, '/act')).headers.get('allow'), 'POST');
  assert.equal((await send(db, '/history', '')).status, 405);
  assert.equal((await send(db, '/name', 'a'.repeat(1025))).status, 413);
  const named = await send(db, '/name', 'Pebble');
  assert.equal(named.status, 200);
  assert.equal(named.headers.get('refresh'), null);
  assert.equal((await send(db, '/act', 'credit-outage')).status, 400);
  assert.equal((await send(db, '/act', FULL, { ROCK_MAINTENANCE: '1' })).status, 503);
  assert.equal(ledger(db).visits.length, 0);
  db.sql.exec('UPDATE rock_limits SET count = 600');
  assert.equal((await send(db, '/act', FULL)).status, 429);
  assert.equal((await send(db)).headers.get('refresh'), '60');
  assert.equal(ledger(db).visits.length, 0);
  const head = await serve(new Request('https://test/play', { method: 'HEAD' }), { DB: db });
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('refresh'), null);
  assert.match(head.headers.get('content-security-policy'), /script-src 'self'/);
});
