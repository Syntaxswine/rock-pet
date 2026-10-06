// Mutation pass over the test suite: break the game on purpose, one way at a time, and check
// that the suite notices. A green suite is evidence only for the breaks it is known to catch.
//
//   node tools/mutate.mjs        every mutant, one after another; exits 1 if any survives
//
// It works on a copy in the OS temp directory and never touches the working tree.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// [what breaks, file, exact text, replacement]. Each text must occur exactly once.
const MUTANTS = [
  ['a pet is +1', 'src/rules.mjs', 'pet: 2,', 'pet: 1,'],
  ['a mess lowers the ceiling by 2', 'src/rules.mjs', 'messCeil: 3,', 'messCeil: 2,'],
  ['death after 47h', 'src/rules.mjs', 'graceH: 48,', 'graceH: 47,'],
  ['messes fall due at 01:00 and 13:00', 'src/engine.mjs', '(Math.floor(t / MESS_MS) + 1) * MESS_MS;', '(Math.floor(t / MESS_MS) + 1) * MESS_MS + HOUR;'],
  ['the first mess does not lower the ceiling', 'src/engine.mjs', '10 - R.messCeil * messes)', '10 - R.messCeil * Math.max(0, messes - 1))'],
  ['growing hunger pain counted twice', 'src/engine.mjs', 'pain = e0 * u + (r * u * u) / 2;', 'pain = e0 * u + r * u * u;'],
  ['no hunger pain at hunger 10', 'src/engine.mjs', 'if (tau > tFull) pain += PAIN_MAX * (tau - tFull);', ''],
  ['the floor time ignores growing pain', 'src/engine.mjs', 'return tPain + (2 * rest) / (b + Math.sqrt(b * b + 4 * a * rest));', 'return tPain + rest / b;'],
  ['the drain reads the hunger at the END of a stretch', 'src/engine.mjs', 's.happy = Math.max(-10, s.happy - drain(s.hunger, s.messes, dt));', 's.happy = Math.max(-10, s.happy - drain(Math.min(10, s.hunger + R.hungerPerHour * dt), s.messes, dt));'],
  ['any visit resets the sorrow clock', 'src/engine.mjs', 'if (s.happy > -10) s.sorrowSince = null;', 's.sorrowSince = null;'],
  ['feeding never resets the starving clock', 'src/engine.mjs', 'if (s.hunger < 10) s.starvingSince = null;', ''],
  ['pets ignore the ceiling', 'src/engine.mjs', 's.happy = Math.min(ceilingOf(s.messes), s.happy + R.pet * n);', 's.happy = Math.min(10, s.happy + R.pet * n);'],
  ['clean removes one mess', 'src/engine.mjs', "else if (verb === 'clean') s.messes = 0;", "else if (verb === 'clean') s.messes = Math.max(0, s.messes - 1);"],
  ['a new mess does not pull happiness under the ceiling', 'src/engine.mjs', 's.happy = Math.min(s.happy, ceilingOf(s.messes));', ''],
  ['never filthy', 'src/engine.mjs', "cause: ceilingOf(s.messes) <= -10 ? 'filthy' : 'lonely'", "cause: 'lonely'"],
  ['a visit after death is applied', 'src/engine.mjs', '    if (s.dead) break;\n    applyVisit(s, v.acts);', '    applyVisit(s, v.acts);'],
  ['a visit exactly at the 48th hour saves it', 'src/engine.mjs', 'const end = Math.min(te, starve, sorrow);', 'const end = Math.min(te, starve, sorrow);\n  if (end === te && te < Infinity && (te === starve || te === sorrow)) { s.t = te; return; }'],
  ['trailing spaces kept', 'src/screen.mjs', "row.join('').trimEnd()", "row.join('')"],
  ['(max N) shown with no mess', 'src/screen.mjs', 'const max = s.messes > 0 ?', 'const max = s.messes >= 0 ?'],
  ['no sorrow danger line', 'src/screen.mjs', 'if (s.sorrowSince !== null) lines.push(', 'if (false) lines.push('],
  ['hunger shows 10 before it is there', 'src/screen.mjs', 'Math.min(9, Math.round(s.hunger))', 'Math.round(s.hunger)'],
  ['sad eyes from -6', 'src/screen.mjs', "if (s.happy < -5) return ';  ;';", "if (s.happy < -6) return ';  ;';"],
  ['the suggestion counts feeds from the rounded hunger', 'src/screen.mjs', 'Math.floor((s.hunger - 0.5) / R.feed) + 1', 'Math.ceil(Math.min(9, Math.round(s.hunger)) / R.feed)'],
  ['the first mess one column right', 'src/screen.mjs', '[7, 8], [7, 2]', '[7, 9], [7, 2]'],
  ['counts not clamped', 'src/parse.mjs', 'acts.push([w, Math.min(n, RULES.maxCount)]);', 'acts.push([w, n]);'],
  ['x0 accepted', 'src/parse.mjs', 'if (n < 1) return', 'if (false) return'],
  ['unknown words accepted', 'src/parse.mjs', 'if (!VERBS.includes(w)) return', 'if (false) return'],
  ['a dead rock accepts visits', 'src/rock.mjs', "if (s.dead) return { status: 410", "if (false) return { status: 410"],
  ['a clock that steps back is trusted', 'src/rock.mjs', 'return Math.max(now, log.visits.at(-1)?.t ?? log.born);', 'return now;'],
  ['a refused body is still logged', 'server.mjs', 'if (r.visit) fs.appendFileSync(file, JSON.stringify(r.visit)', 'fs.appendFileSync(file, JSON.stringify(r.visit ?? { t: t, acts: [] })'],
  ['no cache-control', 'server.mjs', "'cache-control': 'no-store'", "'x-cache-control': 'no-store'"],
  ['no body limit', 'server.mjs', 'if (size > MAX_BODY) return send(', 'if (false) return send('],
  ['the screen prints the Host header', 'server.mjs', "return guard(() => { const t = now(); return look(rockIn(file, t), { now: t, host }); });", "return guard(() => { const t = now(); return look(rockIn(file, t), { now: t, host: req.headers.host }); });"],
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-mutate-'));
for (const p of ['src', 'test', 'tools/rocksim.mjs', 'server.mjs', 'package.json']) fs.cpSync(path.join(root, p), path.join(work, p), { recursive: true });

// The suite's verdict: the names of the top-level tests that failed (TAP, one process).
function suite() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { cwd: work, encoding: 'utf8', timeout: 180_000 });
  if (r.error?.code === 'ETIMEDOUT') return { failed: ['(timed out)'] };
  const failed = [...r.stdout.matchAll(/^not ok [0-9]+ - (.*)$/gm)].map(m => m[1]);
  if (r.status !== 0 && failed.length === 0) failed.push(`(exit ${r.status}) ${r.stderr.split('\n')[0]}`);
  return { failed };
}

let bad = 0;
const control = suite();
if (control.failed.length) {
  console.error(`the unmutated suite fails, so nothing can be learned: ${control.failed.join('; ')}`);
  process.exit(1);
}
console.log(`control: the unmutated suite passes. ${MUTANTS.length} mutants:\n`);
for (const [name, rel, find, replace] of MUTANTS) {
  const file = path.join(work, rel);
  const original = fs.readFileSync(file, 'utf8');
  const hits = original.split(find).length - 1;
  if (hits !== 1) { console.log(`  BROKEN    ${name}: its text occurs ${hits} times in ${rel}`); bad++; continue; }
  let failed;
  try {
    fs.writeFileSync(file, original.split(find).join(replace));
    ({ failed } = suite());
  } finally {
    fs.writeFileSync(file, original);
  }
  if (failed.length === 0) bad++;
  console.log(`  ${failed.length ? 'caught' : 'SURVIVED'}  ${name}${failed.length ? ` (${failed.length}: ${failed.slice(0, 2).join('; ')}${failed.length > 2 ? '; ...' : ''})` : ''}`);
}
fs.rmSync(work, { recursive: true, force: true });
console.log(`\n${MUTANTS.length - bad} of ${MUTANTS.length} caught`);
process.exit(bad ? 1 : 0);
