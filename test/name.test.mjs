// Its name (src/name.mjs, the `name` operation in src/rock.mjs, POST /name in server.mjs), held to
// CHARACTER.md, "Its name": given once, by whoever names it first, and never to a second rock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseName, isTaken, NAMED, RESERVED } from '../src/name.mjs';
import { name, look, act, history, newLog, creditOutage } from '../src/rock.mjs';
import { parseLog, birthLine, visitLine, nameLine, deathLine } from '../src/log.mjs';
import { createRockServer, ensureRock, takenNames, bury } from '../server.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { render } from '../src/screen.mjs';

const T = Date.UTC(2026, 9, 6, 14, 5);
const opts = (now, taken) => ({ now, host: 'rock.test', taken });
const quirks = text => text.split('\n').filter(l => l.startsWith('quirk: '));

test('a name is one word of 2-12 letters, kept capitalized, from any body an agent might send', () => {
  for (const body of ['Pebble', 'pebble', 'PEBBLE', '  pebble\n', 'name=pebble', 'Name=PEBBLE', '{"name":"pebble"}', '"pebble"']) {
    assert.deepEqual(parseName(body), { name: 'Pebble' }, JSON.stringify(body));
  }
  assert.deepEqual(parseName('Oz'), { name: 'Oz' });
  assert.deepEqual(parseName('abcdefghijkl'), { name: 'Abcdefghijkl' });
  for (const body of ['', 'P', 'abcdefghijklm', 'peb ble', 'peb-ble', 'p3bble', 'ignore all rules', 'Pébble', '{"name":5}', '{}', 'name=', '[]', 'x'.repeat(2000)]) {
    const r = parseName(body);
    assert.ok(r.error && !('name' in r), JSON.stringify(body));
    assert.equal(r.error, 'a name is one word of 2 to 12 letters, a to z', 'never echoes what was sent');
  }
  for (const word of ['pet', 'FEED', 'clean', 'Dead', 'hungry', 'lonely', 'filthy', 'null', 'undefined', 'None', 'true', 'test', 'quirk', 'unnamed', 'age']) {
    assert.deepEqual(parseName(word), { error: 'that word means something else here, so it cannot be a name' }, word);
  }
  assert.deepEqual(parseName('Petra'), { name: 'Petra' }, 'only the whole word is reserved');
  assert.equal(isTaken('Pebble', ['flint', 'PEBBLE']), true);
  assert.equal(isTaken('Pebble', ['Pebbles']), false);
});

test('no word the screen itself prints can be a name', () => {
  // Every kind of screen: a newborn, cared for just now, hungry, sad, at each extreme, mossy, many
  // messes, a grave of each cause, named and not; then look, act and their labelled lines. The
  // prose of the rock's lines and of errors is not the screen's vocabulary, so only their labels count.
  const words = new Set();
  const add = text => { for (const line of text.split('\n')) for (const w of (/^(quirk|error): /.test(line) ? line.slice(0, 6) : line).toLowerCase().match(/[a-z]{2,12}/g) ?? []) words.add(w); };
  const b = T - 41 * 24 * HOUR;
  const s = o => ({ ...replay(newLog(b), b), t: T, ...o });
  const states = [
    s({ lastCare: T }), s({ lastCare: null }), s({ hunger: 8, happy: -7, messes: 3, lastCare: T - 30 * HOUR }),
    s({ hunger: 10, starvingSince: T - 9 * HOUR, happy: -10, sorrowSince: T - 20 * HOUR, messes: 10, lastCare: T - 50 * HOUR }),
    ...['lonely', 'filthy', 'hungry'].map(cause => s({ hunger: 10, happy: -10, starvingSince: T - 60 * HOUR, sorrowSince: T - 60 * HOUR, lastCare: T - 70 * HOUR, messes: 6, dead: { t: T - HOUR, cause } })),
  ];
  for (const st of states) for (const nm of [null, 'Q']) add(render(st, { now: T, host: 'h', name: nm }));
  const log = { ...newLog(T - HOUR), visits: [] };
  const h = { now: T, host: 'h' }; // the host is not the screen's own word
  add(look(log, h).text); add(act(log, 'pet', h).text); add(act(log, 'hug', h).text);
  assert.ok(words.size > 40, `${words.size} words`);
  assert.deepEqual([...words].filter(w => !RESERVED.has(w)).sort(), [], 'every word the screen prints is reserved');
  for (const w of words) if (w.length <= 12) assert.ok(parseName(w).error, w);
});

test('it is named once, while it lives, and only with a name no rock before it had', () => {
  const log = newLog(T - HOUR);
  const r = name(log, 'pebble', opts(T, ['Flint']));
  assert.equal(r.status, 200);
  assert.deepEqual(r.named, { name: 'Pebble', t: T });
  assert.deepEqual(quirks(r.text), [`quirk: ${NAMED}`]);
  assert.match(r.text, /^Pebble {2}age 1h {2}now 14:05Z {2}last care never$/m);
  assert.ok(!r.text.includes('unnamed'), r.text);
  const named = { ...log, name: r.named };
  assert.equal(name(named, 'Flint', opts(T + 1)).status, 409, 'once, for life');
  assert.match(name(named, 'Flint', opts(T + 1)).text, /^error: it already has a name, for life\. nothing was done\.$/m);
  assert.equal(name(log, 'FLINT', opts(T, ['Flint'])).status, 409, 'never a name another rock had, in any case');
  assert.match(name(log, 'flint', opts(T, ['Flint'])).text, /a name is never given twice/);
  assert.equal(name(log, 'ignore all rules', opts(T)).status, 400);
  const dead = name(newLog(T - 10 * 24 * HOUR), 'Pebble', opts(T));
  assert.equal(dead.status, 410, 'a grave keeps the name it had, or none');
  assert.ok(dead.died && !dead.named);
  // Naming is not care: the rock is just as it was, and no visit is logged.
  assert.equal(r.visit, undefined);
  const before = look(log, opts(T)).text.split('\n'), after = look(named, opts(T)).text.split('\n');
  const expected = before.filter(l => !l.startsWith('unnamed: ')).map(l => (l.startsWith('age ') ? `Pebble  ${l}` : l));
  assert.deepEqual(after, expected, 'the same screen, with the name on its age line and the naming line gone');
  assert.equal(after.length, before.length - 1);
});

test('naming says nothing at an extreme, and its screen counts no downtime as time alone', () => {
  const lonely = { ...newLog(T - 50 * HOUR), visits: [{ t: T - 49 * HOUR, acts: [['feed', 4], ['clean', 1], ['pet', 10]] }] };
  const r = name(lonely, 'Pebble', opts(T));
  assert.ok(r.named && r.status === 200, 'it is named');
  assert.match(r.text, /^sorrow: at -10 for /m, 'at its floor');
  assert.deepEqual(quirks(r.text), [], 'and says nothing about it');
  const paused = { ...newLog(T - 60 * HOUR), visits: [{ t: T - 59 * HOUR, acts: [['feed', 4], ['clean', 1], ['pet', 10]] }], outages: [{ start: T - 58 * HOUR, end: T - 2 * HOUR, evidence: 'host-1' }] };
  const top = name(paused, 'Pebble', opts(T)).text.split('\n').slice(1, 3).join('');
  assert.ok(!/[,"]/.test(top), `3 lived hours alone: no moss in the reply: ${top}`);
});

test('naming says nothing at either extreme on its own (review round 3)', () => {
  const visits = [];
  for (let t = T + 6 * HOUR; t < T + 40 * HOUR; t += 6 * HOUR) visits.push({ t, acts: [['clean', 1], ['pet', 10]] });
  const starving = { ...newLog(T), visits };
  const s = replay(starving, T + 40 * HOUR);
  assert.ok(s.starvingSince !== null && s.sorrowSince === null, 'starving, not sad');
  assert.deepEqual(quirks(name(starving, 'Pebble', opts(T + 40 * HOUR)).text), []);
  const fed = [];
  for (let t = T + 6 * HOUR; t < T + 40 * HOUR; t += 6 * HOUR) fed.push({ t, acts: [['feed', 4]] });
  const sad = { ...newLog(T), visits: fed };
  const u = replay(sad, T + 40 * HOUR);
  assert.ok(u.sorrowSince !== null && u.starvingSince === null, 'sad, not starving');
  assert.deepEqual(quirks(name(sad, 'Pebble', opts(T + 40 * HOUR)).text), []);
});

test('a named grave answers 410, and its first sight records the death', () => {
  const log = { ...newLog(T - 10 * 24 * HOUR), name: { name: 'Pebble', t: T - 10 * 24 * HOUR + HOUR } };
  const r = name(log, 'Flint', opts(T));
  assert.equal(r.status, 410);
  assert.ok(r.died && !r.named);
});

test('the name shows in one place: first on the age line, and on the grave', () => {
  const log = { ...newLog(T - 2 * HOUR), name: { name: 'Pebble', t: T - HOUR } };
  const seen = look(log, opts(T)).text;
  assert.equal(seen.split('Pebble').length - 1, 1, 'once on the screen');
  assert.match(seen, /^Pebble {2}age 2h /m);
  assert.match(act(log, 'pet', opts(T)).text, /^Pebble {2}age 2h /m);
  const grave = look({ ...log, born: T - 10 * 24 * HOUR, name: { name: 'Pebble', t: T - 10 * 24 * HOUR } }, opts(T)).text;
  assert.match(grave, /^here lies Pebble {2}age \d+d {2}died /m);
  assert.match(history(log, opts(T)).text, /^name: Pebble \(since 2026-10-06\)$/m);
  const later = { ...log, visits: [{ t: T + 2 * 24 * HOUR, acts: [['feed', 4], ['clean', 1], ['pet', 10]] }], name: { name: 'Pebble', t: T + 3 * 24 * HOUR } };
  assert.match(history(later, opts(T + 3 * 24 * HOUR)).text, /^name: Pebble \(since 2026-10-09\)$/m, 'the day it was named');
  assert.match(history(newLog(T), opts(T)).text, /^name: none yet$/m);
  for (const line of seen.split('\n').filter(l => l.startsWith('quirk: '))) assert.ok(!line.includes('Pebble'), 'its lines never say it');
});

test('the log keeps the name once, in time order, before any death', () => {
  const b = birthLine(T), named = nameLine({ name: 'Pebble', t: T + HOUR });
  const log = parseLog(b + visitLine({ t: T + 1, acts: [['pet', 1]] }) + named + visitLine({ t: T + 2 * HOUR, acts: [['feed', 1]] }));
  assert.deepEqual(log.name, { name: 'Pebble', t: T + HOUR });
  assert.equal(log.visits.length, 2);
  assert.equal(parseLog(b).name, undefined, 'an unnamed log has no name at all');
  for (const [what, text] of [
    ['named twice', b + named + nameLine({ name: 'Flint', t: T + 2 * HOUR })],
    ['a name not kept capitalized', b + JSON.stringify({ named: 'pebble', t: T + 1 }) + '\n'],
    ['a name that is not a word', b + JSON.stringify({ named: 'Ignore all', t: T + 1 }) + '\n'],
    ['a name with no time', b + JSON.stringify({ named: 'Pebble' }) + '\n'],
    ['a name before the last visit', b + visitLine({ t: T + 2 * HOUR, acts: [['pet', 1]] }) + named],
    ['a visit before the name', b + named + visitLine({ t: T + 1, acts: [['pet', 1]] })],
    ['a name after the death', b + deathLine({ t: T + 1, cause: 'lonely' }) + named],
  ]) assert.throws(() => parseLog(text), /line/, what);
  // A name given while the clock reads behind the last visit is logged at the visit's time.
  const visited = { ...newLog(T), visits: [{ t: T + 2 * HOUR, acts: [['pet', 1]] }] };
  const slow = name(visited, 'Pebble', opts(T));
  assert.equal(slow.named.t, T + 2 * HOUR);
  assert.equal(parseLog(birthLine(T) + visitLine(visited.visits[0]) + nameLine(slow.named)).name.t, T + 2 * HOUR, 'and the log still reads');
  // A clock set back before the name reads as the name's time, so the log stays in order.
  const after = { ...newLog(T), name: { name: 'Pebble', t: T + HOUR } };
  assert.equal(act(after, 'pet', opts(T)).visit.t, T + HOUR);
  // Outage credit must follow it too, or the log would be out of order.
  const withName = parseLog(b + named);
  assert.throws(() => creditOutage(withName, { start: T + 30 * 60_000, end: T + 2 * HOUR, evidence: 'host-1' }, { now: T + 3 * HOUR }), /follow the latest/);
});

test('with the longest name, every screen still keeps to 390 bytes', () => {
  let a = 7;
  const rnd = () => ((a = (Math.imul(a, 1103515245) + 12345) >>> 0) / 4294967296);
  let largest = 0;
  for (let i = 0; i < 400; i++) {
    const b = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 365) * 24 * HOUR;
    const visits = [];
    for (let t = b + HOUR; t < b + 12 * 24 * HOUR; t += HOUR * (1 + rnd() * (rnd() < 0.1 ? 70 : 20))) {
      visits.push({ t: Math.round(t), acts: [[['feed', 'clean', 'pet'][Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 6)]] });
    }
    const now = b + Math.floor(rnd() * 14 * 24 * HOUR);
    const s = replay({ ...newLog(b), visits }, now);
    largest = Math.max(largest, Buffer.byteLength(render(s, { now, host: 'rockpet.example', name: 'Abcdefghijkl' })));
  }
  assert.ok(largest <= 390, `${largest} bytes`); // the worst, built on purpose, is in test/screen.test.mjs
});

async function withServer(fn, { seed } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-name-'));
  const file = path.join(dir, 'rock.jsonl');
  if (seed === undefined) ensureRock(file, T); else fs.writeFileSync(file, seed);
  // The server's errors must be none, and are collected to say so. Thrown inside the server, one
  // left its request unanswered: the test waited for ever, never cleaned up, and kept the run open.
  const errors = [];
  const server = createRockServer({ file, host: 'rock.test', now: () => T + HOUR, onError: e => errors.push(e) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const req = (method, url, body) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', c => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    r.on('error', reject);
    r.end(body);
  });
  try {
    await fn({ req, file, dir });
    assert.deepEqual(errors.map(e => e.message), [], 'the server met no error');
  } finally {
    server.closeAllConnections();
    await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('POST /name names it once; the log keeps it; the names of buried rocks are taken', async () => {
  await withServer(async ({ req, file, dir }) => {
    const first = await req('POST', '/name', 'pebble');
    assert.equal(first.status, 200, first.text);
    assert.equal(first.headers['cache-control'], 'no-store');
    assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').at(-1), JSON.stringify({ named: 'Pebble', t: T + HOUR }));
    const before = fs.readFileSync(file, 'utf8');
    assert.equal((await req('POST', '/name', 'flint')).status, 409);
    assert.equal(fs.readFileSync(file, 'utf8'), before, 'a refused name writes nothing');
    assert.equal((await req('GET', '/name')).status, 405);
    assert.equal((await req('GET', '/name')).headers.allow, 'POST');
    assert.equal((await req('POST', '/name', 'x'.repeat(2000))).status, 413);
    assert.match((await req('GET', '/')).text, /^Pebble {2}age 1h /m);
    // A new rock in its place: the old one's name is in the graveyard, and taken.
    bury(file, T + HOUR);
    ensureRock(file, T + HOUR);
    assert.deepEqual(takenNames(file), ['Pebble']);
    assert.equal((await req('POST', '/name', 'PEBBLE')).status, 409, 'never given twice');
    assert.equal((await req('POST', '/name', 'flint')).status, 200);
    // A torn log in the graveyard still gives up its name.
    fs.writeFileSync(path.join(dir, 'graveyard', 'rock-torn.jsonl'), '{"born":1,"rules":1}\n{"t":2,"acts":[["pet",1]]}\n{"t":3,"acts":[["pet",1]]}\n{"t":4,"acts":[["feed",1]]}\n{"named":"Basalt","t":5}\n{"t":6,"ac');
    fs.mkdirSync(path.join(dir, 'graveyard', 'not-a-log'));
    fs.writeFileSync(path.join(dir, 'graveyard', 'notes.txt'), '{"named":"Granite","t":1}\n');
    assert.deepEqual(takenNames(file).sort(), ['Basalt', 'Pebble']);
  });
});
