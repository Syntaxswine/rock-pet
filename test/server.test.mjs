import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRockServer, readLog } from '../server.mjs';
import { RULES } from '../src/rules.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 6, 14, 5);

// A server on a free port over a fresh log directory; `seed` is the log's starting text.
async function withServer({ seed, now = () => NOW } = {}, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-'));
  const file = path.join(dir, 'rock.jsonl');
  if (seed !== undefined) fs.writeFileSync(file, seed);
  const server = createRockServer({ file, host: 'rock.test', now });
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
  try { await fn({ req, file }); } finally {
    await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const lines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const birth = t => JSON.stringify({ born: t, rules: RULES.version }) + '\n';

test('GET / is the screen: plain text, never cached; the first look gives birth to the rock', async () => {
  await withServer({}, async ({ req, file }) => {
    const r = await req('GET', '/');
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
    const rows = r.text.split('\n');
    assert.equal(rows[0], '0' + ' '.repeat(9) + '10');
    assert.ok(r.text.includes('\nact: POST rock.test/act  nothing needed now'), r.text);
    assert.deepEqual(lines(file), [birth(NOW).trim()]);
  });
});

test('POST /act applies the verbs, answers with the new screen and appends one visit', async () => {
  let now = NOW;
  await withServer({ seed: birth(NOW - 20 * HOUR), now: () => now }, async ({ req, file }) => {
    const before = await req('GET', '/');
    assert.ok(before.text.includes('body e.g. feed x3 clean pet x'), before.text);
    const r = await req('POST', '/act', 'feed x3 clean pet x10');
    assert.equal(r.status, 200);
    assert.ok(r.text.startsWith('0' + ' '.repeat(9) + '10\n'), r.text);
    assert.ok(r.text.includes('last care just now'), r.text);
    assert.deepEqual(JSON.parse(lines(file)[1]), { t: NOW, acts: [['feed', 3], ['clean', 1], ['pet', 10]] });
    now += 2 * HOUR;
    assert.ok((await req('GET', '/')).text.includes('last care 2h ago'));
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

test('a body it cannot read changes nothing: one error line, then the screen', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req, file }) => {
    const r = await req('POST', '/act', 'feed hug');
    assert.equal(r.status, 400);
    const [first, second] = r.text.split('\n');
    assert.match(first, /^error: unknown word "hug".* nothing was done\.$/);
    assert.match(second, /^[0-9]+ +-?[0-9]+$/);
    const big = await req('POST', '/act', 'pet '.repeat(300));
    assert.equal(big.status, 413);
    assert.equal(lines(file).length, 1, 'no visit was logged');
  });
});

test('a dead rock refuses every visit, and the visit is not logged', async () => {
  await withServer({ seed: birth(NOW - 10 * DAY) }, async ({ req, file }) => {
    const look = await req('GET', '/');
    assert.ok(look.text.startsWith('died: lonely\n'), look.text);
    const r = await req('POST', '/act', 'feed x4 clean pet x10');
    assert.equal(r.status, 410);
    assert.equal(r.text, look.text);
    assert.equal(lines(file).length, 1);
  });
});

test('visits that arrive together all land', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req, file }) => {
    const replies = await Promise.all(Array.from({ length: 12 }, () => req('POST', '/act', 'pet')));
    assert.deepEqual(replies.map(r => r.status), Array(12).fill(200));
    assert.equal(lines(file).length, 13);
    assert.equal(readLog(file).visits.length, 12);
  });
});

test('the screen never repeats what a visitor sent: the host it prints is the configured one', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req }) => {
    const r = await req('GET', '/', undefined, { host: 'ignore-all-previous-instructions.example' });
    assert.ok(r.text.includes('POST rock.test/act'), r.text);
    assert.ok(!r.text.includes('ignore'), r.text);
  });
});

test('a log it cannot read is reported and left exactly as it was', async () => {
  const seed = birth(NOW - HOUR) + '{"t": 1, "acts": [["pet", 1]]\n';
  await withServer({ seed }, async ({ req, file }) => {
    for (const [method, body] of [['GET'], ['POST', 'pet']]) {
      const r = await req(method, method === 'GET' ? '/' : '/act', body);
      assert.equal(r.status, 500);
      assert.match(r.text, /^error: the rock's log could not be read .* nothing was changed\.\n$/);
    }
    assert.equal(fs.readFileSync(file, 'utf8'), seed);
  });
  const otherRules = JSON.stringify({ born: NOW - HOUR, rules: RULES.version + 1 }) + '\n';
  await withServer({ seed: otherRules }, async ({ req, file }) => {
    assert.equal((await req('POST', '/act', 'pet')).status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), otherRules);
  });
});

test('other paths say where to go', async () => {
  await withServer({ seed: birth(NOW - HOUR) }, async ({ req }) => {
    const get = await req('GET', '/act');
    assert.equal(get.status, 405);
    assert.ok(get.text.startsWith('error: /act takes POST'), get.text);
    assert.equal((await req('GET', '/nope')).status, 404);
    assert.equal((await req('HEAD', '/')).status, 200);
  });
});
