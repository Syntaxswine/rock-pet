// Run after the Sites build. Tests the bundled Worker in workerd with actual D1.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const directory = mkdtempSync(join(tmpdir(), 'rockpet-worker-'));
const options = convertV4MiniflareOptions({ modules: true, scriptPath: resolve('dist/server/index.js'),
  compatibilityDate: '2026-10-09', compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'rock-pet-test' }, resourcePersistencePath: directory });
let runtime;
try {
  runtime = new Miniflare(options);
  const db = await runtime.getD1Database('DB');
  for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) {
    for (const sql of readFileSync(join('drizzle', file), 'utf8').split('--> statement-breakpoint')) {
      await db.prepare(sql.trim()).run();
    }
  }
  const send = (path, body) => runtime.dispatchFetch('https://test' + path, { method: body === undefined ? 'GET' : 'POST', body });
  assert.equal((await send('/')).headers.get('x-rock-phase'), 'title');
  const names = await Promise.all(['Pebble', 'Quartz'].map(n => send('/name', n)));
  assert.deepEqual(names.map(r => r.status).sort(), [200, 409]);
  const care = await Promise.all(Array.from({ length: 12 }, () => send('/act', 'feed clean pet')));
  assert.ok(care.every(r => r.status === 200));
  assert.equal((await db.prepare("SELECT count(*) AS n FROM rock_events WHERE kind = 'care'").first()).n, 12);
  const before = (await db.prepare('SELECT state FROM rock').first()).state;
  await runtime.dispose();
  runtime = new Miniflare(options);
  assert.equal((await send('/')).headers.get('x-rock-phase'), 'alive');
  const reopened = await runtime.getD1Database('DB');
  assert.equal((await reopened.prepare('SELECT state FROM rock').first()).state, before);
  assert.equal((await send('/name', 'Granite')).status, 409);
  assert.equal((await send('/reset', '')).status, 404);
  assert.equal((await send('/act', 'x'.repeat(1025))).status, 413);
  assert.match(await (await send('/play')).text(), /aria-label="Command"/);
  console.log('Worker + D1: concurrent birth, twelve concurrent visits, restart persistence, no reset, body limit and human page passed.');
} finally {
  await runtime?.dispose();
  // This exact, freshly allocated test directory is the only recursive target.
  if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error('unexpected test directory');
  rmSync(directory, { recursive: true, force: true });
}
