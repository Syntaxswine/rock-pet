// The title screen (the owner, 2026-10-08): with no rock yet, every page is the title, which says
// what the rock is, what its three verbs do and how to send them. Whoever names a rock there
// starts the game, the rock born then with that name. It shows only until then, never again for
// that rock, and --new-rock, which clears a grave for the next, never ends a life.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRockServer, readLog, main } from '../server.mjs';
import { title, start, look } from '../src/rock.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { RULES } from '../src/rules.mjs';

const HOUR = 3_600_000;
const T = Date.UTC(2026, 9, 9, 12, 0);
const birth = t => JSON.stringify({ born: t, rules: RULES.version });

// What the title says under its rock, spelled out here so that any change to it shows.
const SAYS = host => [
  'one rock, shared by everyone; it dies for good',
  'after 48h at hunger 10 or at happy -10',
  'feed: hunger -3 (it rises 10 a day)',
  'clean: clears every mess @ (one each 12h)',
  'pet: happy +2 (it falls over time)',
  `new rock: POST ${host}/name  body: a one-word name`,
  `act: POST ${host}/act  body e.g. feed clean pet x3`,
];

test('the title screen: the rock with no face, what it is, what its three verbs do and how to start and send them, in a few lines', () => {
  const faceless = DRAWINGS[DRAWING].front.map(row => row.replaceAll('E', ' ').trimEnd());
  assert.equal(title({ host: 'rockpet.example' }).text, ['rock pet', ...faceless, '', ...SAYS('rockpet.example')].join('\n') + '\n');
  assert.equal(title({ host: 'rockpet.example' }).status, 200);
  for (const host of ['rockpet.example', 'x'.repeat(20)]) {
    const n = Buffer.byteLength(title({ host }).text);
    assert.ok(n <= 390, `${n} bytes with a ${host.length}-character host: a screen's bound`);
  }
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
  for (const [body, status, why] of [['x', 400, /^error: a name is one word of 2 to 12 letters/], ['PEBBLE', 409, /^error: a rock before it had that name/], ['feed', 400, /^error: that word means something else here/]]) {
    const no = start(body, { now: T, host, taken: ['Pebble'] });
    assert.deepEqual([no.status, no.born, no.named], [status, undefined, undefined], body);
    assert.match(no.text, why);
    assert.ok(no.text.endsWith(title({ host }).text), 'and the title screen again');
  }
});

// A server over a directory with no log yet. `graveyard` holds the logs of rocks before it.
async function withTitle(fn, { graveyard = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-title-'));
  const file = path.join(dir, 'rock.jsonl');
  let server, clock = T;
  try {
    if (graveyard.length) fs.mkdirSync(path.join(dir, 'graveyard'));
    graveyard.forEach((text, i) => fs.writeFileSync(path.join(dir, 'graveyard', `rock-${i}.jsonl`), text));
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
    await fn({ req, file, errors, tick: ms => (clock += ms) });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const logLines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);

test('with no rock every page is the title screen, nothing is written until a name starts the game, and after that it is the rock', async () => {
  await withTitle(async ({ req, file, errors, tick }) => {
    const TITLE = title({ host: 'rock.test' }).text;
    for (const url of ['/', '/history']) {
      const r = await req('GET', url);
      assert.deepEqual([r.status, r.text, r.headers['cache-control']], [200, TITLE, 'no-store'], url);
    }
    assert.equal((await req('HEAD', '/')).status, 200);
    const act = await req('POST', '/act', 'feed clean pet');
    assert.deepEqual([act.status, act.text], [409, `error: there is no rock yet: name one to start it. nothing was done.\n${TITLE}`]);
    const get = await req('GET', '/act');
    assert.deepEqual([get.status, get.headers.allow, get.text], [405, 'POST', `error: /act takes POST, with a body like "feed clean pet x3".\n${TITLE}`]);
    assert.equal((await req('POST', '/name', 'x')).status, 400);
    assert.equal((await req('POST', '/name', 'pebble')).status, 409, "a buried rock's name is taken");
    assert.equal(fs.existsSync(file), false, 'none of that starts a rock');
    assert.deepEqual(errors, []);

    const named = await req('POST', '/name', 'basalt');
    assert.equal(named.status, 200, named.text);
    assert.match(named.text, /^Basalt {2}age 0m {2}now 12:00Z {2}last care never$/m);
    assert.deepEqual(logLines(file), [birth(T), JSON.stringify({ named: 'Basalt', t: T })], 'born then, named then');

    tick(HOUR);
    assert.equal((await req('GET', '/')).text, look(readLog(file), { now: T + HOUR, host: 'rock.test' }).text, 'then it is the rock');
    assert.equal((await req('POST', '/name', 'flint')).status, 409, 'named once, for life');
    assert.equal((await req('POST', '/act', 'pet')).status, 200);
    assert.equal(logLines(file).length, 3);

    // Never the title again: a log lost now is an error, and nothing starts a new game.
    fs.rmSync(file);
    for (const [method, url, body] of [['GET', '/'], ['GET', '/history'], ['POST', '/name', 'flint'], ['POST', '/act', 'pet']]) {
      assert.equal((await req(method, url, body)).status, 500, `${method} ${url}: a lost log is an error, not the title screen`);
    }
    assert.equal(fs.existsSync(file), false);
  }, { graveyard: ['{"born":1,"rules":1}\n{"named":"Pebble","t":2}\n'] });
});

test('two names sent at once start one rock', async () => {
  await withTitle(async ({ req, file }) => {
    const replies = await Promise.all(['basalt', 'flint', 'granite'].map(name => req('POST', '/name', name)));
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 409, 409]);
    const lines = logLines(file);
    assert.equal(lines.length, 2, 'one birth, one name');
    assert.ok(['Basalt', 'Flint', 'Granite'].includes(readLog(file).name.name));
  });
});

test('a log that turns up while the title shows is served', async () => {
  await withTitle(async ({ req, file }) => {
    assert.ok((await req('GET', '/')).text.startsWith('rock pet\n'));
    fs.writeFileSync(file, birth(T - HOUR) + '\n');
    assert.equal((await req('GET', '/')).text, look(readLog(file), { now: T, host: 'rock.test' }).text);
  });
});

// A start that must be refused. Should it start after all, the server is closed before the test
// fails, so a failure can never leave the test process running.
async function refusedStart(argv, reason) {
  let server;
  try { server = await main(argv, { say: () => {} }); } catch (e) { return assert.match(e.message, reason); }
  await new Promise(r => server.close(r));
  assert.fail(`it started; it should have refused (${reason})`);
}

test('--new-rock clears only a grave: a living rock is refused and left be; after a dead one, the title screen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-title-'));
  const file = path.join(dir, 'rock.jsonl');
  let server;
  try {
    const living = `${birth(Date.now() - HOUR)}\n${JSON.stringify({ t: Date.now() - 1000, acts: [['pet', 1]] })}\n`;
    fs.writeFileSync(file, living);
    await refusedStart(['--new-rock', '--port', '0', '--dir', dir], /is alive; --new-rock only clears a grave/);
    assert.equal(fs.readFileSync(file, 'utf8'), living, 'the living rock is left be');
    assert.equal(fs.existsSync(path.join(dir, 'graveyard')), false);
    assert.equal(fs.existsSync(file + '.lock'), false, 'and the lock let go');
    const dead = `${birth(Date.UTC(2026, 0, 1))}\n`; // never cared for, so long dead
    fs.writeFileSync(file, dead);
    server = await main(['--new-rock', '--port', '0', '--dir', dir], { say: () => {} });
    assert.equal(fs.existsSync(file), false, 'its grave cleared');
    assert.deepEqual(fs.readdirSync(path.join(dir, 'graveyard')).map(g => fs.readFileSync(path.join(dir, 'graveyard', g), 'utf8')), [dead]);
    const page = await fetch(`http://127.0.0.1:${server.address().port}/`).then(r => r.text());
    assert.equal(page, title({ host: process.env.ROCK_HOST ?? '127.0.0.1:0' }).text, 'the title screen, for the next');
  } finally {
    if (server) await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
