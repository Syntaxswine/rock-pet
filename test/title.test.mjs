// The title screen (the owner, 2026-10-08): with no rock yet, every page is the title, which says
// what the rock is, what its three verbs do and how to send them. Whoever names a rock there
// starts the game, the rock born then with that name. It shows only until then, never again for
// that rock, whether the server keeps running or starts again, and --new-rock, which clears a
// grave for the next, never ends a life.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRockServer, readLog, main, begunOf } from '../server.mjs';
import { title, start, look, creditOutage } from '../src/rock.mjs';
import { renderTitle } from '../src/screen.mjs';
import { birthLine, visitLine, outageLine } from '../src/log.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 9, 12, 0);
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];

// What the title says under its rock, spelled out here so that any change to it shows.
const SAYS = host => [
  'one rock, shared by all; it dies for good',
  'after 48h in a row at hunger 10 or happy -10',
  'feed: hunger -3 (it rises 10 a day)',
  'clean: clears every mess @ (one each 12h)',
  'pet: happy +2 (it falls over time)',
  `new rock: POST ${host}/name  body: a one-word name, for life`,
  `act: POST ${host}/act  body e.g. feed clean pet x3`,
];

test('the title screen: the rock with no face, what it is, what its three verbs do and how to start and send them, in a few lines', () => {
  // Its rock is its front with no eyes, for every drawing: not its back, which for some differs.
  for (const [which, drawing] of Object.entries(DRAWINGS)) {
    const rows = renderTitle({ host: 'h', drawing }).split('\n').slice(1, 1 + drawing.front.length);
    const eyeRow = drawing.front.findIndex(row => row.includes('E'));
    assert.deepEqual(rows.filter((_, r) => r !== eyeRow), drawing.front.map(row => row.trimEnd()).filter((_, r) => r !== eyeRow), which);
    assert.equal(rows[eyeRow], drawing.front[eyeRow].replaceAll('E', ' ').trimEnd(), `${which}: no face, its eyes blank`);
  }
  const text = title({ host: 'rockpet.example' }).text, D = DRAWINGS[DRAWING];
  assert.equal(text, ['rock pet', ...D.front.map(row => row.replaceAll('E', ' ').trimEnd()), '', ...SAYS('rockpet.example')].join('\n') + '\n');
  assert.equal(title({ host: 'rockpet.example' }).status, 200);
  for (const host of ['rockpet.example', 'x'.repeat(20)]) {
    const n = Buffer.byteLength(title({ host }).text);
    assert.ok(n <= 390, `${n} bytes with a ${host.length}-character host: a screen's bound`);
  }
  // DESIGN-NOTES gives its size, and it is right.
  const notes = fs.readFileSync(new URL('../DESIGN-NOTES.md', import.meta.url), 'utf8');
  assert.ok(notes.includes(`in ${Buffer.byteLength(text)} bytes`), `DESIGN-NOTES ("Birth") should say "in ${Buffer.byteLength(text)} bytes"`);
});

test('a name starts the rock, born then and named then; a refused name, or one a rock before it had, starts nothing', () => {
  const host = 'rockpet.example';
  const r = start(' basalt ', { now: T, host, taken: ['Pebble'] });
  assert.equal(r.status, 200);
  assert.deepEqual([r.born, r.named], [T, { name: 'Basalt', t: T }]);
  assert.match(r.text, /^Basalt {2}age 0m {2}now 12:00Z {2}last care never$/m);
  const face = DRAWINGS[DRAWING].front.find(row => row.includes('E')).replaceAll('E', '^').trimEnd();
  assert.ok(r.text.split('\n').includes(face), `with its face: ${face}`);
  assert.ok(!r.text.includes('unnamed:'), 'named from birth, so no line asks for a name');
  assert.ok(r.text.endsWith(`quirk: it has a name now.\nhistory: ${host}/history\n`), r.text);
  for (const [body, status, why] of [['x', 400, /^error: a name is one word of 2 to 12 letters/], ['PEBBLE', 409, /^error: a rock before it had that name/], ['feed', 400, /^error: that word means something else here/], ['dies', 400, /^error: that word means something else here/]]) {
    let asked = 0;
    const no = start(body, { now: T, host, taken: () => (asked++, ['Pebble']) });
    assert.deepEqual([no.status, no.born, no.named], [status, undefined, undefined], body);
    assert.match(no.text, why);
    assert.ok(no.text.endsWith(title({ host }).text), 'and the title screen again');
    assert.equal(asked, status === 409 ? 1 : 0, `${body}: the names of rocks before are asked for only when a name needs them`);
  }
});

// A server over a directory with no log yet. `graveyard` holds the logs of rocks before it.
async function withTitle(fn, { graveyard = [], seed, before = () => {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-title-'));
  const file = path.join(dir, 'rock.jsonl');
  let server, clock = T;
  try {
    if (graveyard.length) fs.mkdirSync(path.join(dir, 'graveyard'));
    graveyard.forEach((text, i) => fs.writeFileSync(path.join(dir, 'graveyard', `rock-${i}.jsonl`), text));
    if (seed !== undefined) fs.writeFileSync(file, seed);
    before(file);
    const errors = [];
    server = createRockServer({ file, host: 'rock.test', now: () => clock, onError: e => errors.push(e) });
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
    await fn({ req, file, dir, errors, server, port, tick: ms => (clock += ms) });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const logLines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
// fs.statSync, answering `answer(realStatSync)` for `file` until put back.
function stubStat(file, answer) {
  const real = fs.statSync;
  fs.statSync = function (p, ...rest) { return path.resolve(String(p)) === path.resolve(file) ? answer(() => real.call(fs, p, ...rest)) : real.call(fs, p, ...rest); };
  return () => { fs.statSync = real; };
}

test('with no rock every page is the title screen, nothing is written until a name starts the game, and after that it is the rock', async () => {
  await withTitle(async ({ req, file, errors, tick }) => {
    const TITLE = title({ host: 'rock.test' }).text;
    for (const url of ['/', '/history']) {
      const r = await req('GET', url);
      assert.deepEqual([r.status, r.text, r.headers['cache-control']], [200, TITLE, 'no-store'], url);
      assert.equal((await req('HEAD', url)).status, 200, `HEAD ${url}`);
    }
    const act = await req('POST', '/act', 'feed clean pet');
    assert.deepEqual([act.status, act.text], [409, `error: there is no rock yet: name one to start it. nothing was done.\n${TITLE}`]);
    const get = await req('GET', '/act');
    assert.deepEqual([get.status, get.headers.allow, get.text], [405, 'POST', `error: /act takes POST, with a body like "feed clean pet x3".\n${TITLE}`]);
    assert.equal((await req('POST', '/', 'x')).text, 'error: GET / for the title screen; POST /name to start the game.\n');
    assert.equal((await req('GET', '/nowhere')).text, 'not here. GET / for the title screen; POST /name to start the game.\n');
    assert.equal((await req('POST', '/name', 'x')).status, 400);
    assert.equal((await req('POST', '/name', 'pebble')).status, 409, "a buried rock's name is taken");
    assert.equal(fs.existsSync(file), false, 'none of that starts a rock');
    assert.deepEqual(errors, []);

    const named = await req('POST', '/name', 'basalt');
    assert.equal(named.status, 200, named.text);
    assert.match(named.text, /^Basalt {2}age 0m {2}now 12:00Z {2}last care never$/m);
    assert.deepEqual(logLines(file), [birthLine(T).trim(), JSON.stringify({ named: 'Basalt', t: T })], 'born then, named then');
    assert.equal(fs.readFileSync(begunOf(file), 'utf8'), `${T}\n`, 'and the mark that a rock began here');

    tick(HOUR);
    assert.equal((await req('GET', '/')).text, look(readLog(file), { now: T + HOUR, host: 'rock.test' }).text, 'then it is the rock');
    assert.equal((await req('POST', '/', 'x')).text, 'error: GET / to see the rock; POST /act to care for it.\n');
    assert.equal((await req('POST', '/name', 'flint')).status, 409, 'named once, for life');
    assert.equal((await req('POST', '/act', 'pet')).status, 200);
    assert.equal(logLines(file).length, 3);
  }, { graveyard: ['{"born":1,"rules":1}\n{"named":"Pebble","t":2}\n'] });
});

test('a start counts at once: a log lost right after it, before anyone asks again, is an error and never the title', async () => {
  await withTitle(async ({ req, file }) => {
    assert.equal((await req('POST', '/name', 'basalt')).status, 200);
    fs.rmSync(file);
    for (const [method, url, body] of [['GET', '/'], ['GET', '/history'], ['POST', '/name', 'flint'], ['POST', '/act', 'pet']]) {
      assert.equal((await req(method, url, body)).status, 500, `${method} ${url}: a lost log is an error, not the title screen`);
    }
    assert.equal(fs.existsSync(file), false, 'and no second rock');
  });
});

test('names sent at once start one rock', async () => {
  await withTitle(async ({ req, file }) => {
    const replies = await Promise.all(['basalt', 'flint', 'granite'].map(name => req('POST', '/name', name)));
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 409, 409]);
    assert.equal(logLines(file).length, 2, 'one birth, one name');
    assert.ok(['Basalt', 'Flint', 'Granite'].includes(readLog(file).name.name));
  });
});

test('whether it has started is asked when a body is in: a visit and a name begun before a start find the rock', async () => {
  await withTitle(async ({ req, file, server, port }) => {
    // A request, its headers sent and its body held back until `send`.
    const open = route => {
      let send;
      const done = new Promise((resolve, reject) => {
        const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: route }, res => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', c => (text += c));
          res.on('end', () => resolve({ status: res.statusCode, text }));
        });
        r.on('error', reject);
        r.flushHeaders();
        send = body => r.end(body);
      });
      return { done, send: body => send(body) };
    };
    const arrived = new Promise(resolve => { let n = 0; server.on('request', () => { if (++n === 2) resolve(); }); });
    const visit = open('/act'), naming = open('/name');
    await arrived; // both routed while there is no rock
    assert.equal((await req('POST', '/name', 'basalt')).status, 200, 'the start, in between');
    visit.send('pet');
    naming.send('flint');
    assert.equal((await visit.done).status, 200, 'the visit lands on the rock');
    assert.equal((await naming.done).status, 409, 'and the name finds it named');
    assert.equal(readLog(file).visits.length, 1);
  });
});

test('a start never writes over a log, even when the check for one wrongly says there is none', async () => {
  const seed = birthLine(T - HOUR);
  let restore = () => {};
  try {
    await withTitle(async ({ req, file }) => {
      const r = await req('POST', '/name', 'flint');
      restore();
      assert.equal(r.status, 500, r.text);
      assert.equal(fs.readFileSync(file, 'utf8'), seed, 'the log as it was');
      assert.equal((await req('GET', '/')).status, 200, 'and it is the rock');
    }, { seed, before: file => { restore = stubStat(file, () => undefined); } }); // as if the log weren't there
  } finally { restore(); }
});

test('a check for the log that fails is an error, never the title screen', async () => {
  let restore = () => {};
  try {
    await withTitle(async ({ req, file }) => {
      restore = stubStat(file, () => { throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' }); });
      for (const [method, url, body] of [['GET', '/'], ['GET', '/history'], ['POST', '/name', 'basalt'], ['POST', '/act', 'pet'], ['GET', '/nowhere']]) {
        assert.equal((await req(method, url, body)).status, 500, `${method} ${url}`);
      }
      restore();
      assert.equal(fs.existsSync(file), false, 'nothing written');
    });
  } finally { restore(); }
});

test('a log that turns up while the title shows is served', async () => {
  await withTitle(async ({ req, file }) => {
    assert.ok((await req('GET', '/')).text.startsWith('rock pet\n'));
    fs.writeFileSync(file, birthLine(T - HOUR));
    assert.equal((await req('GET', '/')).text, look(readLog(file), { now: T, host: 'rock.test' }).text);
  });
});

// A request to a server the command line started, on a connection closed after it: a kept-alive
// one still closing when the mutation harness forces an exit trips libuv on Windows.
const page = (server, route = '/', { method = 'GET', body } = {}) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: server.address().port, method, path: route, agent: false, headers: { connection: 'close' } }, res => {
    let text = '';
    res.setEncoding('utf8');
    res.on('data', c => (text += c));
    res.on('end', () => resolve({ status: res.statusCode, text }));
  });
  r.on('error', reject);
  r.end(body);
});
const shut = async server => { server.closeAllConnections(); await new Promise(r => server.close(r)); };
// A start that must be refused. Should it start after all, the server is closed before the test
// fails, so a failure can never leave the test process running.
async function refusedStart(argv, reason) {
  let server;
  try { server = await main(argv, { say: () => {} }); } catch (e) { return assert.match(e.message, reason); }
  await shut(server);
  assert.fail(`it started; it should have refused (${reason})`);
}
const HOST = process.env.ROCK_HOST ?? '127.0.0.1:0';

test('--new-rock clears only a grave it can tell is one, and then the title screen shows', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-title-'));
  const file = path.join(dir, 'rock.jsonl'), grave = path.join(dir, 'graveyard');
  const now = Date.now(), b = now - 10 * DAY;
  const kept = { born: b, rules: 1, visits: [{ t: b + HOUR, acts: FULL }], died: null };
  const down = creditOutage(kept, { start: b + 2 * HOUR, end: now - HOUR, evidence: 'host-1' }, { now: now - HOUR });
  let server;
  try {
    // Refused, the log left as it was and the lock let go:
    for (const [what, text, reason] of [
      ['a living rock', birthLine(now - HOUR) + visitLine({ t: now - 1000, acts: [['pet', 1]] }), /is alive; --new-rock only clears a grave/],
      ['a living rock whose last line a crash tore', `${birthLine(now - HOUR)}{"t":${now - 1000},"acts":[["pe`, /is alive/],
      ['a rock alive only because the host was down', birthLine(b) + visitLine(kept.visits[0]) + outageLine(down), /is alive/],
      ['a log broken before its last line', `${birthLine(now - HOUR)}{"t":179\n${visitLine({ t: now - 1000, acts: [['pet', 1]] })}`, /can't be read, so its rock can't be told dead/],
      ['a log written under other rules', JSON.stringify({ born: now - HOUR, rules: 2 }) + '\n', /can't be told dead/],
    ]) {
      fs.writeFileSync(file, text);
      await refusedStart(['--new-rock', '--port', '0', '--dir', dir], reason);
      assert.equal(fs.readFileSync(file, 'utf8'), text, `${what}: left be`);
      assert.equal(fs.existsSync(grave), false, `${what}: nothing buried`);
      assert.equal(fs.existsSync(file + '.lock'), false, `${what}: the lock let go`);
    }
    // Buried, whole, and then the title: a rock long dead, with its last line torn or not.
    for (const dead of [birthLine(Date.UTC(2026, 0, 1)), `${birthLine(Date.UTC(2026, 0, 2))}{"t":17`]) {
      fs.writeFileSync(file, dead);
      fs.writeFileSync(begunOf(file), '1\n');
      const said = [];
      server = await main(['--new-rock', '--port', '0', '--dir', dir], { say: s => said.push(s) });
      assert.equal(fs.existsSync(file), false, 'its grave cleared');
      assert.equal(fs.existsSync(begunOf(file)), false, 'and the mark with it');
      assert.ok(fs.readdirSync(grave).some(g => fs.readFileSync(path.join(grave, g), 'utf8') === dead), 'its log kept whole');
      assert.match(said[0], /^the old rock's log is now .*; the title screen shows until someone names the next$/);
      assert.equal((await page(server)).text, title({ host: HOST }).text, 'the title screen, for the next');
      await shut(server);
      server = null;
    }
    // With no log at all it buries nothing, and says so.
    const said = [];
    server = await main(['--new-rock', '--port', '0', '--dir', dir], { say: s => said.push(s) });
    assert.equal(said[0], 'there was no rock to bury; the title screen shows until someone names the next');
  } finally {
    if (server) await shut(server);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a rock that began here is never forgotten: started again without its log, the server refuses, until --new-rock', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-title-'));
  const file = path.join(dir, 'rock.jsonl');
  let server;
  const stop = async () => { await shut(server); server = null; };
  try {
    // A game started from the title screen, then its log lost while the server was down.
    server = await main(['--port', '0', '--dir', dir], { say: () => {} });
    assert.equal((await page(server, '/name', { method: 'POST', body: 'basalt' })).status, 200);
    await stop();
    fs.rmSync(file);
    await refusedStart(['--port', '0', '--dir', dir], /a rock began here, but its log .* is missing: put it back, or run --new-rock/);
    // A rock from before the mark gets it when a server first starts over its log.
    fs.writeFileSync(file, birthLine(Date.now() - HOUR));
    fs.rmSync(begunOf(file));
    server = await main(['--port', '0', '--dir', dir], { say: () => {} });
    await stop();
    assert.ok(fs.existsSync(begunOf(file)), 'the mark, for a rock from before it');
    fs.rmSync(file);
    await refusedStart(['--port', '0', '--dir', dir], /a rock began here, but its log .* is missing/);
    // --new-rock clears the mark: the title screen, for the next.
    server = await main(['--new-rock', '--port', '0', '--dir', dir], { say: () => {} });
    await stop();
    server = await main(['--port', '0', '--dir', dir], { say: () => {} });
    assert.equal((await page(server)).text, title({ host: HOST }).text, 'and it stays the title after a restart');
  } finally {
    if (server) await shut(server);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
