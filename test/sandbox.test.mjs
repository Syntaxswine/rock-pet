import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replay, HOUR } from '../src/engine.mjs';
import { RULES } from '../src/rules.mjs';

const SANDBOX = fileURLToPath(new URL('../tools/sandbox.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [SANDBOX, ...args], { encoding: 'utf8' });
const stamp = t => `${new Date(t).toISOString().slice(0, 10)} ${new Date(t).toISOString().slice(11, 16)}Z`;

test('the sandbox plays the real engine on a pretend clock', () => {
  const born = Date.UTC(2026, 9, 6, 8);
  const r = run('--at', '2026-10-06T08:00Z', 'wait 14h; feed clean pet x3; wait 20h; until dead');
  assert.equal(r.status, 0, r.stderr);
  const fate = replay({ born, rules: RULES.version, visits: [{ t: born + 14 * HOUR, acts: [['feed', 1], ['clean', 1], ['pet', 3]] }] }, Infinity);
  assert.ok(r.stdout.includes('> wait 14h\n6' + ' '.repeat(10) + '0\n'), r.stdout);
  assert.ok(r.stdout.includes(`died ${stamp(fate.dead.t)}`), `the sandbox's death is the engine's: ${stamp(fate.dead.t)}\n${r.stdout}`);
  assert.ok(r.stdout.includes(`died: ${fate.dead.cause}\n`));
});

test('the sandbox refuses a log it cannot use in one line, not a stack trace', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-'));
  try {
    const other = path.join(dir, 'other.jsonl');
    fs.writeFileSync(other, JSON.stringify({ born: Date.now(), rules: RULES.version + 1 }) + '\n');
    for (const [file, says] of [[path.join(dir, 'missing.jsonl'), 'no such file'], [other, 'rules v2']]) {
      const r = run('--from', file, 'look');
      assert.equal(r.status, 1);
      assert.ok(r.stderr.startsWith('sandbox: ') && r.stderr.includes(says), r.stderr);
      assert.equal(r.stderr.trim().split('\n').length, 1, r.stderr);
    }
    const bad = run('--at', 'yesterday', 'look');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /^sandbox: --at yesterday is not a time/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the sandbox reads a real log and never writes to it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-'));
  const file = path.join(dir, 'rock.jsonl');
  const text = JSON.stringify({ born: Date.now() - 10 * HOUR, rules: RULES.version }) + '\n';
  fs.writeFileSync(file, text);
  try {
    const r = run('--from', file, 'feed x4 clean pet x10; wait 1d; until dead');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes('died: '), r.stdout);
    assert.equal(fs.readFileSync(file, 'utf8'), text);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
