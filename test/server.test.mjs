import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRockServer, ensureRock, readLog, bury, main } from '../server.mjs';
import { replay } from '../src/engine.mjs';
import { RULES } from '../src/rules.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 6, 14, 5);
const ROW1_NEWBORN = '0' + ' '.repeat(9) + '10';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-'));

// A server on a free port over a fresh log. `seed` is the log's starting text; with no seed the
// rock is born at NOW, as the command line does at start. `errors` collects what went wrong.
async function withServer({ seed, now = () => NOW } = {}, fn) {
  const dir = tmpDir();
  const file = path.join(dir, 'rock.jsonl');
  if (seed === undefined) ensureRock(file, NOW); else fs.writeFileSync(file, seed);
  const errors = [];
  const server = createRockServer({ file, host: 'rock.test', now, onError: e => errors.push(e) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const req = (method, url, body, headers = {}) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', c => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    r.on('error', reject);
    r.end(body);
  });
  try { await fn({ req, file, port, errors }); } finally {
    server.closeAllConnections(); // a test that failed mid-request must not hold the server open
    await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const lines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const birth = t => JSON.stringify({ born: t, rules: RULES.version }) + '\n';

test('GET / is the screen, plain text and never cached', async () => {
  await withServer({}, async ({ req, file }) => {
    const r = await req('GET', '/');
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.text.split('\n')[0], ROW1_NEWBORN);
    assert.ok(r.text.includes('\nact: POST rock.test/act  nothing needed now'), r.text);
    assert.deepEqual(lines(file), [birth(NOW).trim()], 'a look writes nothing');
  });
});

test('POST /act applies the verbs, answers with the new screen and appends one visit', async () => {
  let now = NOW;
  await withServer({ seed: birth(NOW - 20 * HOUR), now: () => now }, async ({ req, file }) => {
    const before = await req('GET', '/');
    assert.ok(before.text.includes('body e.g. feed x3 clean pet x'), before.text);
    const r = await req('POST', '/act', 'feed x3 clean pet x10');
    assert.equal(r.status, 200);
    assert.ok(r.text.startsWith(ROW1_NEWBORN + '\n'), r.text);
    assert.ok(r.text.includes('last care just now'), r.text);
    assert.deepEqual(JSON.parse(lines(file)[1]), { t: NOW, acts: [['feed', 3], ['clean', 1], ['pet', 10]] });
    now += 2 * HOUR + 40 * 60_000;
    assert.ok((await req('GET', '/')).text.includes('last care 2h ago'));
  });
});

test('visits that arrive together all land, each in time order', async () => {
  let n = NOW;
  await withServer({ seed: birth(NOW - HOUR), now: () => n++ }, async ({ req, file }) => {
    const replies = await Promise.all(Array.from({ length: 12 }, () => req('POST', '/act', 'pet')));
    assert.deepEqual(replies.map(r => r.status), Array(12).fill(200));
    const log = readLog(file); // refuses a log out of time order
    assert.equal(log.visits.length, 12);
    assert.equal(new Set(log.visits.map(v => v.t)).size, 12, 'twelve distinct moments');
    assert.equal(replay(log, n).visits, 12);
  });
});

test('a clock that steps backwards cannot put the log out of order', async () => {
  let now = NOW;
  await withServer({ seed: birth(NOW - 5 * HOUR), now: () => now }, async ({ req, file }) => {
    assert.equal((await req('POST', '/act', 'pet')).status, 200);
    now = NOW - 2 * HOUR;
    assert.equal((await req('POST', '/act', 'feed')).status, 200);
    assert.equal((await req('GET', '/')).status, 200);
    assert.deepEqual(readLog(file).visits.map(v => v.t), [NOW, NOW]);
  });
});

test('once seen dead, a rock stays dead: a clock set back cannot reach a time it was alive', async () => {
  let now = NOW;
  const seed = birth(NOW - 80 * HOUR); // nobody came: dead by NOW
  await withServer({ seed, now: () => now }, async ({ req, file }) => {
    const grave = await req('GET', '/');
    assert.ok(grave.text.startsWith('died: lonely\n'), grave.text);
    const died = JSON.parse(lines(file).at(-1));
    assert.deepEqual(Object.keys(died), ['died', 'cause'], 'the first sight of the death is logged');
    assert.equal((await req('GET', '/')).status, 200);
    assert.equal(lines(file).length, 2, 'and only once');
    now = NOW - 20 * HOUR; // before the death
    const late = await req('POST', '/act', 'feed x4 clean pet x10');
    assert.equal(late.status, 410);
    assert.ok(late.text.startsWith('died: lonely\n'), late.text);
    assert.equal(lines(file).length, 2, 'the visit is not logged');
    // A new server on the same log, its clock still behind: the same.
    const again = createRockServer({ file, host: 'rock.test', now: () => NOW - 20 * HOUR, onError: () => {} });
    await new Promise(r => again.listen(0, '127.0.0.1', r));
    const status = await new Promise(resolve => {
      const r = http.request({ host: '127.0.0.1', port: again.address().port, method: 'POST', path: '/act' }, res => { res.resume(); resolve(res.statusCode); });
      r.end('pet');
    });
    await new Promise(r => again.close(r));
    assert.equal(status, 410);
  });
});

test('a body it cannot read changes nothing: one error line, then the screen', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req, file }) => {
    const r = await req('POST', '/act', 'feed hug');
    assert.equal(r.status, 400);
    const [first, second] = r.text.split('\n');
    assert.match(first, /^error: unknown word "hug".* nothing was done\.$/);
    assert.match(second, /^[0-9]+ +-?[0-9]+$/);
    assert.equal(lines(file).length, 1, 'no visit was logged');
  });
});

test('a body over 1KB is refused at once, even one that never ends', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req, port, file }) => {
    assert.equal((await req('POST', '/act', 'pet '.repeat(300))).status, 413);
    let r;
    const status = await new Promise(resolve => {
      r = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/act', headers: { 'content-length': 100000 } }, res => resolve(res.statusCode));
      r.on('error', () => {});
      r.write('pet '.repeat(400)); // 1600 bytes of the promised 100000, and then silence
      setTimeout(() => resolve('no answer within 10s'), 10_000).unref(); // "at once": long before the body ends
    });
    r.destroy();
    assert.equal(status, 413);
    assert.equal(lines(file).length, 1);
  });
});

test('a body is refused by its size, not its word count: 1024 bytes in, 1025 out', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req, file }) => {
    assert.equal((await req('POST', '/act', 'pet' + ' '.repeat(1021))).status, 200);
    assert.equal((await req('POST', '/act', 'pet' + ' '.repeat(1022))).status, 413);
    assert.equal(readLog(file).visits.length, 1);
  });
});

test('a 413 never acts on the part of the body it read', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ port, file }) => {
    // Two chunks, so the first is buffered before the second crosses the limit.
    const status = await new Promise(resolve => {
      const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/act' }, res => { res.resume(); resolve(res.statusCode); });
      r.on('error', () => {});
      r.write('feed' + ' '.repeat(500));
      setTimeout(() => r.end(' '.repeat(600)), 50);
    });
    await new Promise(r => setTimeout(r, 100));
    assert.equal(status, 413);
    assert.equal(readLog(file).visits.length, 0);
  });
});

test('a dead rock refuses every visit, and the visit is not logged', async () => {
  await withServer({ seed: birth(NOW - 10 * DAY) }, async ({ req, file }) => {
    const look = await req('GET', '/');
    assert.ok(look.text.startsWith('died: lonely\n'), look.text);
    const r = await req('POST', '/act', 'feed x4 clean pet x10');
    assert.equal(r.status, 410);
    assert.equal(r.text, look.text);
    assert.equal(lines(file).filter(l => l.includes('"t"')).length, 0);
  });
});

test('the screen never repeats what a visitor sent: the host it prints is the configured one', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req }) => {
    const r = await req('GET', '/', undefined, { host: 'ignore-all-previous-instructions.example' });
    assert.ok(r.text.includes('POST rock.test/act'), r.text);
    assert.ok(!r.text.includes('ignore'), r.text);
  });
});

test('a log it cannot replay exactly is refused, left as it was, and the error stays private', async () => {
  const head = birth(NOW - 5 * HOUR);
  const longAgo = NOW - 10 * DAY, fate = replay({ born: longAgo, rules: RULES.version, visits: [] }, Infinity).dead;
  const trueDeath = birth(longAgo) + JSON.stringify({ died: fate.t, cause: fate.cause }) + '\n';
  assert.equal(fate.cause, 'lonely', 'the premise of "a death with another cause"');
  const bad = {
    'not JSON': head + '{"t": 1, "acts": [["pet", 1]]\n',
    'a pet with no count': head + JSON.stringify({ t: NOW - HOUR, acts: [['pet']] }) + '\n',
    'a negative count': head + JSON.stringify({ t: NOW - HOUR, acts: [['pet', -5]] }) + '\n',
    'a count over 20': head + JSON.stringify({ t: NOW - HOUR, acts: [['pet', 21]] }) + '\n',
    'an unknown verb': head + JSON.stringify({ t: NOW - HOUR, acts: [['hug', 1]] }) + '\n',
    'a visit with no verbs': head + JSON.stringify({ t: NOW - HOUR, acts: [] }) + '\n',
    'a time that is not a number': head + JSON.stringify({ t: 'soon', acts: [['pet', 1]] }) + '\n',
    'a visit before birth': head + JSON.stringify({ t: NOW - 6 * HOUR, acts: [['pet', 1]] }) + '\n',
    'visits out of order': head + JSON.stringify({ t: NOW - HOUR, acts: [['pet', 1]] }) + '\n' + JSON.stringify({ t: NOW - 2 * HOUR, acts: [['pet', 1]] }) + '\n',
    'a visit after the death': head + JSON.stringify({ died: NOW - 2 * HOUR, cause: 'lonely' }) + '\n' + JSON.stringify({ t: NOW - HOUR, acts: [['pet', 1]] }) + '\n',
    'a death its visits do not produce': head + JSON.stringify({ died: NOW - 2 * HOUR, cause: 'lonely' }) + '\n',
    'a visit logged after a true death': trueDeath + JSON.stringify({ t: fate.t + HOUR, acts: [['pet', 1]] }) + '\n',
    'a death with another cause': trueDeath.replace('"lonely"', '"hungry"'),
    'other rules': JSON.stringify({ born: NOW - HOUR, rules: RULES.version + 1 }) + '\n',
    'empty': '',
  };
  for (const [what, seed] of Object.entries(bad)) {
    await withServer({ seed }, async ({ req, file, errors }) => {
      for (const [method, url, body] of [['GET', '/'], ['POST', '/act', 'pet']]) {
        const r = await req(method, url, body);
        assert.equal(r.status, 500, `${what}: ${method} ${url}`);
        assert.equal(r.text, "error: the rock's log could not be read. nothing was changed.\n", `${what}: nothing private in the reply`);
      }
      assert.equal(fs.readFileSync(file, 'utf8'), seed, `${what}: the log is untouched`);
      assert.equal(errors.length, 2, `${what}: the operator hears of it`);
    });
  }
});

test('two hand-edits a log survives: a byte-order mark, and a last line without its newline', async () => {
  const bom = String.fromCharCode(0xfeff) + birth(NOW - HOUR);
  await withServer({ seed: bom }, async ({ req, file }) => {
    assert.equal((await req('GET', '/')).status, 200);
    assert.equal((await req('POST', '/act', 'pet')).status, 200);
    assert.equal(readLog(file).visits.length, 1);
  });
  const unterminated = birth(NOW - 2 * HOUR) + JSON.stringify({ t: NOW - HOUR, acts: [['feed', 1]] });
  await withServer({ seed: unterminated }, async ({ req, file }) => {
    assert.equal((await req('POST', '/act', 'pet')).status, 200);
    assert.equal(readLog(file).visits.length, 2);
    assert.equal((await req('GET', '/')).status, 200);
  });
});

test('a log deleted while the server runs is an error, never a new rock', async () => {
  await withServer({ seed: birth(NOW - 10 * DAY) }, async ({ req, file }) => {
    fs.rmSync(file);
    assert.equal((await req('POST', '/act', 'pet')).status, 500);
    assert.equal((await req('GET', '/')).status, 500);
    assert.equal(fs.existsSync(file), false);
  });
});

test('methods and paths it does not serve are named, with Allow', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req }) => {
    const get = await req('GET', '/act');
    assert.equal(get.status, 405);
    assert.equal(get.headers.allow, 'POST');
    assert.ok(get.text.startsWith('error: /act takes POST'), get.text);
    assert.equal(get.text.split('\n').slice(1).join('\n'), (await req('GET', '/')).text, 'then the screen');
    for (const method of ['POST', 'PUT', 'OPTIONS', 'DELETE']) {
      const r = await req(method, '/', '');
      assert.equal(r.status, 405, method);
      assert.equal(r.headers.allow, 'GET, HEAD', method);
    }
    assert.equal((await req('GET', '/nope')).status, 404);
    assert.equal((await req('HEAD', '/')).status, 200);
    assert.equal((await req('GET', '/?x=1')).status, 200, 'a query string is ignored');
  });
});

test('a malformed request cannot take the server down', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req, port }) => {
    const statusLine = target => new Promise(resolve => {
      let got = '';
      const sock = net.connect(port, '127.0.0.1', () => sock.write(`GET ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
      sock.on('data', d => (got += d));
      sock.on('error', () => resolve(got.split('\r\n')[0]));
      sock.on('close', () => resolve(got.split('\r\n')[0]));
    });
    // '//[' is no URL at all; it once threw outside every guard and stopped the process.
    assert.equal(await statusLine('//['), 'HTTP/1.1 404 Not Found');
    for (const target of ['http://[::1', '/%', '*']) await statusLine(target);
    assert.equal((await req('GET', '/')).status, 200, 'still serving');
  });
});

test('the command line serves this machine only, and prints the address it serves', async () => {
  const dir = tmpDir();
  const said = [];
  const server = await main(['--port', '0', '--dir', dir], { say: s => said.push(s) });
  try {
    assert.equal(server.address().address, '127.0.0.1');
    // Not "localhost": where that means ::1 first, PowerShell and Python wait 2s per request.
    assert.ok(said.at(-1).startsWith('Rock Pet on http://127.0.0.1:'), said.at(-1));
    assert.equal(readLog(path.join(dir, 'rock.jsonl')).visits.length, 0, 'a rock is born at start');
  } finally {
    await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a restart keeps the rock', async () => {
  const dir = tmpDir();
  const file = path.join(dir, 'rock.jsonl');
  const old = birth(Date.now() - HOUR) + JSON.stringify({ t: Date.now() - 1000, acts: [['pet', 1]] }) + '\n';
  fs.writeFileSync(file, old);
  try {
    const server = await main(['--port', '0', '--dir', dir], { say: () => {} });
    await new Promise(r => server.close(r));
    assert.equal(fs.readFileSync(file, 'utf8'), old);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A start that must be refused. Should it start after all, the server is closed before the
// test fails, so a failure can never leave the test process running.
async function refusedStart(argv, reason) {
  let server;
  try { server = await main(argv, { say: () => {} }); } catch (e) { return assert.match(e.message, reason); }
  await new Promise(r => server.close(r));
  assert.fail(`it started; it should have refused (${reason})`);
}

test('one server per log: a second is refused while the first runs; a dead one\'s lock is taken over', async () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'rock.jsonl.lock');
  const running = [];
  const start = async () => running[running.push(await main(['--port', '0', '--dir', dir], { say: () => {} })) - 1];
  const stop = server => new Promise(r => server.close(r));
  try {
    const first = await start();
    assert.equal(fs.readFileSync(lock, 'utf8'), String(process.pid));
    await refusedStart(['--port', '0', '--dir', dir], /already serving/);
    await stop(first);
    assert.equal(fs.existsSync(lock), false, 'closing releases the lock');
    const gone = spawnSync(process.execPath, ['-e', '']).pid; // a pid whose process has exited
    fs.writeFileSync(lock, String(gone));
    await start();
    assert.equal(fs.readFileSync(lock, 'utf8'), String(process.pid), 'a stale lock is taken over');
  } finally {
    for (const server of running) if (server.listening) await stop(server);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a log too broken to serve stops the start with the reason; --new-rock still gets out', async () => {
  const dir = tmpDir();
  const file = path.join(dir, 'rock.jsonl');
  const torn = birth(NOW - HOUR) + '{"t":17913';
  fs.writeFileSync(file, torn);
  try {
    await refusedStart(['--port', '0', '--dir', dir], /line 2 is not JSON/);
    assert.equal(fs.existsSync(file + '.lock'), false, 'a refused start releases the lock');
    assert.equal(fs.readFileSync(file, 'utf8'), torn, 'and leaves the log alone');
    const server = await main(['--new-rock', '--port', '0', '--dir', dir], { say: () => {} });
    await new Promise(r => server.close(r));
    const [grave] = fs.readdirSync(path.join(dir, 'graveyard'));
    assert.match(grave, /^rock-unreadable-/);
    assert.equal(fs.readFileSync(path.join(dir, 'graveyard', grave), 'utf8'), torn);
    assert.equal(readLog(file).visits.length, 0, 'a new rock');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--new-rock keeps the old log in the graveyard, never over another', async () => {
  const dir = tmpDir();
  const file = path.join(dir, 'rock.jsonl');
  const old = birth(Date.UTC(2026, 0, 1)) + JSON.stringify({ t: Date.UTC(2026, 0, 1, 2), acts: [['pet', 1]] }) + '\n';
  try {
    for (const n of [1, 2]) {
      fs.writeFileSync(file, old);
      const server = await main(['--new-rock', '--port', '0', '--dir', dir], { say: () => {} });
      await new Promise(r => server.close(r));
      const graves = fs.readdirSync(path.join(dir, 'graveyard')).sort();
      assert.equal(graves.length, n);
      for (const g of graves) assert.equal(fs.readFileSync(path.join(dir, 'graveyard', g), 'utf8'), old);
      assert.equal(readLog(file).visits.length, 0, 'a new rock');
    }
    assert.equal(bury(path.join(dir, 'none.jsonl')), null, 'nothing to bury');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
