import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRockServer, main, takeLock, releaseLock } from '../server.mjs';
import { parseLog, birthLine, visitLine, outageLine } from '../src/log.mjs';
import { look, act, newLog, creditOutage, history } from '../src/rock.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { recordOutage } from '../tools/credit-outage.mjs';
import { reaction } from '../src/story.mjs';
import { occasion } from '../src/character.mjs';
import * as sim from '../tools/rocksim.mjs';

const T = Date.UTC(2026, 9, 6);
const h = n => T + n * HOUR;
const options = now => ({ now, host: 'rock.test' });
const window = (start, end) => ({ start: h(start), end: h(end), evidence: 'incident-42' });
const paused = (...outages) => ({ ...newLog(T), outages });
const close = async s => { s.closeAllConnections(); await new Promise(r => s.close(r)); };
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-continuity-')); }
function remove(dir) {
  const resolved = path.resolve(dir);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('rockpet-continuity-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}

test('stale-lock takeover cannot unlink a competing starter\'s lock', async () => {
  const dir = temp(), file = path.join(dir, 'rock.jsonl'), lock = file + '.lock';
  fs.writeFileSync(lock, '0');
  const original = fs.rmSync;
  let competitor, attempted = false, server;
  // Pause the first starter after its stale PID check. A competing start at exactly
  // this point used to replace the lock, then have that replacement unlinked.
  fs.rmSync = function(p, ...args) {
    if (p === lock && !attempted) {
      attempted = true;
      competitor = main(['--port', '0', '--dir', dir], { say: () => {} }).then(
        s => ({ server: s }), error => ({ error }));
    }
    return original.call(fs, p, ...args);
  };
  try {
    server = await main(['--port', '0', '--dir', dir], { say: () => {} });
    const other = await competitor;
    if (other.server) await close(other.server);
    assert.match(other.error?.message ?? '', /another server is starting/);
    assert.equal(fs.readFileSync(lock, 'utf8'), String(process.pid));
    assert.equal(fs.existsSync(lock + '.starting'), false);
  } finally {
    fs.rmSync = original;
    if (server) await close(server);
    remove(dir);
  }
});

test('an interrupted acquisition gate fails closed and does not touch the rock', () => {
  const dir = temp(), file = path.join(dir, 'rock.jsonl');
  fs.writeFileSync(file, birthLine(T));
  fs.writeFileSync(file + '.lock.starting', '0');
  try {
    assert.throws(() => takeLock(file), /startup was interrupted/);
    assert.equal(fs.readFileSync(file, 'utf8'), birthLine(T));
    assert.equal(fs.readFileSync(file + '.lock.starting', 'utf8'), '0');
  } finally { remove(dir); }
});

test('corrupt visits after computed death return 500 and leave every byte unchanged', async () => {
  const dir = temp(), file = path.join(dir, 'rock.jsonl');
  const logs = [
    birthLine(T) + visitLine({ t: h(100), acts: [['pet', 1]] }),
    birthLine(T) + visitLine({ t: h(100), acts: [['pet', 1]] }) + visitLine({ t: h(99), acts: [['feed', 1]] }),
  ];
  const server = createRockServer({ file, host: 'rock.test', now: () => h(101), onError: () => {} });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    for (const seed of logs) {
      fs.writeFileSync(file, seed);
      for (const route of ['/', '/history', '/act']) {
        const r = await fetch(`http://127.0.0.1:${server.address().port}${route}`, route === '/act' ? { method: 'POST', body: 'pet' } : {});
        assert.equal(r.status, 500);
        await r.text();
        assert.equal(fs.readFileSync(file, 'utf8'), seed);
      }
    }
  } finally { await close(server); remove(dir); }
});

test('a host outage freezes both stats and skips messes, then resumes the UTC schedule', () => {
  const log = paused(window(10, 25));
  const before = replay(newLog(T), h(10));
  for (const at of [10, 12, 20, 24, 25]) {
    const s = replay(log, h(at));
    assert.equal(s.hunger, before.hunger, `hunger at ${at}`);
    assert.equal(s.happy, before.happy, `happiness at ${at}`);
    assert.equal(s.messes, 0, `messes at ${at}`);
    assert.equal(s.dead, null);
  }
  const after = replay(log, h(26));
  assert.ok(Math.abs(after.hunger - 11 * 10 / 24) < 1e-10);
  assert.ok(Math.abs(after.happy - 5.6) < 1e-10);
  assert.equal(replay(log, h(36)).messes, 1);
});

test('outage boundary messes are skipped at start and applied at recovery, once', () => {
  const log = paused(window(12, 24));
  assert.equal(replay(log, h(12)).messes, 0);
  assert.equal(replay(log, h(24)).messes, 1);
  const visit = act(log, 'pet', options(h(24))).visit;
  assert.equal(replay({ ...log, visits: [visit] }, h(25)).messes, 1);
  const adjacent = paused(window(12, 24), window(24, 36));
  assert.equal(replay(adjacent, h(24)).messes, 0);
  assert.equal(replay(adjacent, h(36)).messes, 1);
});

test('downtime pauses both extreme clocks without resetting them or reviving prior death', () => {
  const plain = newLog(T), fate = replay(plain, Infinity).dead;
  const log = paused(window(30, 130));
  const before = replay(plain, h(30)), after = replay(log, h(130));
  assert.equal(after.hunger, 10);
  assert.equal(after.happy, -10);
  assert.equal(after.starvingSince - before.starvingSince, 100 * HOUR);
  assert.equal(after.sorrowSince - before.sorrowSince, 100 * HOUR);
  assert.equal(replay(log, Infinity).dead.t, fate.t + 100 * HOUR);
  assert.deepEqual(replay(paused({ start: fate.t, end: fate.t + HOUR, evidence: 'boundary' }), Infinity).dead, fate);
  assert.match(look(log, options(h(130))).text, /hunger: at 10 for 6h of 48/);
});

test('outage credit rejects future, unverified, overlapping and retroactive windows', () => {
  const log = newLog(T);
  for (const o of [
    window(10, 9), window(10, 10), window(-1, 10), window(10, 31),
    { ...window(10, 20), start: NaN }, { ...window(10, 20), end: Infinity },
    { ...window(10, 20), evidence: '' }, { ...window(10, 20), evidence: 'untrusted\ntext' },
  ]) assert.throws(() => creditOutage(log, o, { now: h(30) }));
  assert.deepEqual(creditOutage(log, window(10, 20), { now: h(30) }), window(10, 20));
  assert.throws(() => creditOutage(paused(window(10, 20)), window(15, 25), { now: h(30) }));
  const visited = { ...log, visits: [{ t: h(15), acts: [['pet', 1]] }] };
  for (const start of [10, 15]) assert.throws(() => creditOutage(visited, window(start, 20), { now: h(30) }));
  assert.throws(() => creditOutage(log, window(80, 90), { now: h(100) }), /died before/);
  assert.throws(() => creditOutage({ ...log, died: replay(log, Infinity).dead }, window(10, 20), { now: h(100) }), /permanent/);
  assert.throws(() => parseLog(birthLine(T) + outageLine(window(10, 20)) + visitLine({ t: h(15), acts: [['pet', 1]] })));
  assert.throws(() => look(paused(window(80, 90)), options(h(100))), /at or after death/);
});

test('credited logs round trip, clamp a rolled-back clock, and never infer missing credit', () => {
  const text = birthLine(T) + outageLine(window(30, 130));
  const log = parseLog(text);
  assert.deepEqual(log, paused(window(30, 130)));
  assert.equal(act(log, 'feed clean pet x10', options(h(5))).visit.t, h(130));
  assert.equal(look(newLog(T), options(h(100))).text.startsWith('died:'), true);
  assert.equal(look(log, options(h(130))).text.startsWith('died:'), false);
});

test('the offline credit tool appends once, refuses a live owner, and preserves refused logs', () => {
  const dir = temp(), file = path.join(dir, 'rock.jsonl');
  fs.writeFileSync(file, birthLine(T));
  try {
    takeLock(file);
    try { assert.throws(() => recordOutage(file, window(10, 20), h(30)), /already serving/); }
    finally { releaseLock(file); }
    recordOutage(file, window(10, 20), h(30));
    const saved = fs.readFileSync(file, 'utf8');
    assert.equal(saved, birthLine(T) + outageLine(window(10, 20)));
    assert.throws(() => recordOutage(file, window(10, 20), h(30)));
    assert.equal(fs.readFileSync(file, 'utf8'), saved);
    assert.equal(fs.existsSync(file + '.lock'), false);
    assert.equal(fs.existsSync(file + '.lock.starting'), false);
  } finally { remove(dir); }
});

test('the independent simulator agrees across multiple verified outages', () => {
  const outages = [window(5, 18), window(33, 70)];
  const log = paused(...outages);
  const rock = sim.newRock();
  const windows = outages.map(o => ({ start: (o.start - T) / HOUR, end: (o.end - T) / HOUR }));
  const R = { ...sim.RULESETS.rock, grace: 48, graceMode: 'continuous' };
  while (!rock.dead && rock.t < 250) sim.tick(R, rock, windows);
  const actual = replay(log, Infinity);
  assert.ok(rock.dead);
  assert.equal(actual.dead.cause, rock.dead.cause);
  assert.ok(Math.abs((actual.dead.t - T) / HOUR - rock.dead.t) < 0.15);
});

test('the outage CLI records exact UTC intervals and refuses invalid calendar dates without writes', () => {
  const dir = temp(), file = path.join(dir, 'rock.jsonl');
  const end = Math.floor(Date.now() / 1000) * 1000 - HOUR;
  const start = end - HOUR;
  fs.writeFileSync(file, birthLine(start - HOUR));
  const cli = fileURLToPath(new URL('../tools/credit-outage.mjs', import.meta.url));
  const run = (from, until) => spawnSync(process.execPath, [cli, '--dir', dir, '--start', from, '--end', until, '--evidence', 'cli-test'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  try {
    const original = fs.readFileSync(file, 'utf8');
    const bad = run('2026-02-30T12:00:00Z', '2026-03-03T12:00:00Z');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not a valid calendar date/);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    const good = run(new Date(start).toISOString(), new Date(end).toISOString());
    assert.equal(good.status, 0, good.stderr);
    assert.deepEqual(parseLog(fs.readFileSync(file, 'utf8')).outages, [{ start, end, evidence: 'cli-test' }]);
  } finally { remove(dir); }
});

test('a stable short reaction follows effective care only and cannot change the engine', () => {
  const log = newLog(T), before = JSON.stringify(log);
  const r = act(log, 'feed x4 clean pet x10', options(h(20)));
  assert.match(r.text, /quirk: it /);
  for (let i = 0; i < 6; i++) assert.equal(r.text, act(log, 'feed x4 clean pet x10', options(h(20))).text);
  assert.equal(JSON.stringify(log), before);
  // Ordinary reads stay quiet. Not every day is ordinary: this rock faces the wall on Tuesdays,
  // and a look then says so (test/character.test.mjs), so this look is the next morning.
  const cared = { ...log, visits: [r.visit] };
  assert.equal(occasion(replay(cared, h(30)), h(30)), null);
  assert.equal(look(cared, options(h(30))).text.includes('quirk:'), false);
  assert.equal(act(log, 'feed clean pet x10', options(T)).text.includes('quirk:'), false);
  assert.equal(act(log, 'hug', options(h(20))).text.includes('quirk:'), false);
  assert.equal(act(log, 'pet', options(h(100))).text.includes('quirk:'), false);
  const after = replay({ ...log, visits: [r.visit] }, h(20));
  assert.deepEqual([after.hunger, after.happy, after.messes], [0, 10, 0]);
  assert.ok(Buffer.byteLength(r.text) < 440);
  const state = replay(log, h(20));
  assert.equal(reaction(T, state, state), '');
});

test('the shared biography derives meals and quiet stretches, with a public outage receipt', async () => {
  const log = { ...paused(window(10, 20)), visits: [{ t: h(25), acts: [['feed', 4], ['clean', 1], ['pet', 10]] }] };
  const result = history(log, options(h(30)));
  assert.match(result.text, /first meal: 2026-10-07/);
  assert.match(result.text, /visits: 1/);
  assert.match(result.text, /longest quiet stretch: 15h 0m/);
  assert.match(result.text, /host downtime credited: 10h 0m/);
  assert.match(result.text, /credit 36000000ms; evidence incident-42/);
  assert.match(history(newLog(T), options(T)).text, /first meal: not yet/);
  const dir = temp(), file = path.join(dir, 'rock.jsonl');
  const seed = birthLine(T) + outageLine(window(10, 20)) + visitLine(log.visits[0]);
  fs.writeFileSync(file, seed);
  const server = createRockServer({ file, host: 'rock.test', now: () => h(30) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const url = `http://127.0.0.1:${server.address().port}/history`;
    const r = await fetch(url);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(await r.text(), result.text);
    assert.equal((await fetch(url, { method: 'HEAD' })).status, 200);
    const bad = await fetch(url, { method: 'POST', body: 'pet' });
    assert.equal(bad.status, 405);
    await bad.text();
    assert.equal(fs.readFileSync(file, 'utf8'), seed);
  } finally { await close(server); remove(dir); }
});
