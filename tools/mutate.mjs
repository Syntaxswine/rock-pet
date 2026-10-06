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
  ['a tie dies of sorrow', 'src/engine.mjs', "if (end === starve) s.dead = { t: end, cause: 'hungry' };", "if (end === starve && end !== sorrow) s.dead = { t: end, cause: 'hungry' };"],
  ['a starving clock due after the death survives it', 'src/engine.mjs', 'if (s.starvingSince !== null && s.starvingSince > end) s.starvingSince = null;', ''],
  ['a sorrow clock due after the death survives it', 'src/engine.mjs', 'if (s.sorrowSince !== null && s.sorrowSince > end) s.sorrowSince = null;', ''],
  ['the suggestion counts feeds from the rounded hunger', 'src/screen.mjs', 'while (Math.max(0, s.hunger - R.feed * feeds) >= 0.5) feeds++;', 'feeds = Math.ceil(Math.min(9, Math.round(s.hunger)) / R.feed);'],
  ['one pet too many when sad', 'src/screen.mjs', 'while (Math.min(10, s.happy + R.pet * pets) < 9.5) pets++;', 'while (Math.min(10, s.happy + R.pet * pets) < 9.5) pets++;\n  if (s.happy < -5) pets++;'],
  ['the first mess one column right', 'src/screen.mjs', '[7, 8], [7, 2]', '[7, 9], [7, 2]'],
  ['danger hours rounded', 'src/screen.mjs', 'const hours = ms => Math.max(0, Math.floor(ms / HOUR));', 'const hours = ms => Math.max(0, Math.round(ms / HOUR));'],
  ['days rounded', 'src/screen.mjs', 'return `${Math.floor(m / 1440)}d`;', 'return `${Math.round(m / 1440)}d`;'],
  ['hours rounded', 'src/screen.mjs', 'return `${Math.floor(m / 60)}h`;', 'return `${Math.round(m / 60)}h`;'],
  ['(max N) stops at -9', 'src/screen.mjs', '` (max ${ceilingOf(s.messes)})`', '` (max ${Math.max(-9, ceilingOf(s.messes))})`'],
  ['counts not clamped', 'src/parse.mjs', 'acts.push([w, Math.min(n, RULES.maxCount)]);', 'acts.push([w, n]);'],
  ['x0 accepted', 'src/parse.mjs', 'if (n < 1) return', 'if (false) return'],
  ['unknown words accepted', 'src/parse.mjs', 'if (!VERBS.includes(w)) return', 'if (false) return'],
  ['percent-encoding not decoded', 'src/parse.mjs', '  else text = text.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));', ''],
  ['log lines not trimmed (a byte-order mark breaks the log)', 'src/log.mjs', ".map(l => l.trim())", ''],
  ['the log takes any act', 'src/log.mjs', 'row.acts.every(isAct)', 'row.acts.every(Array.isArray)'],
  ['the log takes a line after the death', 'src/log.mjs', 'if (log.died) throw new Error(`${where} comes after the death`);', ''],
  ['the engine replays visits out of order', 'src/engine.mjs', "if (!(v.t >= last)) throw new Error(`visits out of time order at ${v.t}`);", ''],
  ['a dead rock accepts visits', 'src/rock.mjs', 'if (s.dead) return { status: 410', 'if (false) return { status: 410'],
  ['a clock that steps back is trusted', 'src/rock.mjs', 'log.visits.at(-1)?.t ?? -Infinity, ', ''],
  ['a recorded death does not hold the clock', 'src/rock.mjs', ', log.died?.t ?? -Infinity)', ')'],
  ['a death is never recorded', 'src/rock.mjs', 'const firstSight = (log, s) => (s.dead && !log.died ? { died: s.dead } : {});', 'const firstSight = () => ({});'],
  ['a recorded death is not checked', 'src/rock.mjs', 'if (log.died && !(s.dead', 'if (false && !(s.dead'],
  ['a refused body is still logged', 'server.mjs', "(r.visit ? visitLine(r.visit) : '')", "visitLine(r.visit ?? { t: Date.now() + 1e7, acts: [['pet', 1]] })"],
  ['the append waits a moment (a race)', 'server.mjs', "if (lines) fs.appendFileSync(file, (text.endsWith('\\n') ? '' : '\\n') + lines);", "if (lines) setTimeout(() => fs.appendFileSync(file, (text.endsWith('\\n') ? '' : '\\n') + lines), Math.random() * 20);"],
  ['no newline before an append', 'server.mjs', "(text.endsWith('\\n') ? '' : '\\n') + lines", 'lines'],
  ['a missing log gives birth', 'server.mjs', "    const text = fs.readFileSync(file, 'utf8');\n    const r = decide", "    ensureRock(file, now());\n    const text = fs.readFileSync(file, 'utf8');\n    const r = decide"],
  ['the 500 says what went wrong', 'server.mjs', 'r = { status: 500, text: BROKEN };', 'r = { status: 500, text: `error: ${e.message}. nothing was changed.` };'],
  ['no cache-control', 'server.mjs', "'cache-control': 'no-store'", "'x-cache-control': 'no-store'"],
  ['405 without Allow', 'server.mjs', "{ allow: 'GET, HEAD' }", '{}'],
  ['no body limit', 'server.mjs', 'if (size <= MAX_BODY) return void chunks.push(c);', 'return void chunks.push(c);'],
  ['the 413 waits for the end of the body', 'server.mjs', '        req.resume();', "        return void req.on('end', () => send(413, 'too big', { connection: 'close' }));"],
  ['the request path is parsed as a URL', 'server.mjs', "const route = (req.url ?? '/').split('?')[0];", "const route = new URL(req.url, 'http://localhost').pathname;"],
  ['the screen prints the Host header', 'server.mjs', "return answer((log, t) => look(log, { now: t, host }));", "return answer((log, t) => look(log, { now: t, host: req.headers.host }));"],
  ['listens on every interface', 'server.mjs', "opt('--listen') ?? '127.0.0.1'", "opt('--listen') ?? '::'"],
  // Round 2: behaviours from round 1 that no test could fail.
  ['a restart replaces the rock', 'server.mjs', "{ flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }\n}", "{ flag: 'w' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }\n}"],
  ['a clock behind the birth is trusted', 'src/rock.mjs', 'Math.max(now, log.born, ', 'Math.max(now, '],
  ['a refused act never records the death', 'src/rock.mjs', "{ status: 410, text: render(s, { now: t, host }), ...firstSight(log, s) }", "{ status: 410, text: render(s, { now: t, host }) }"],
  ['a recorded death at the wrong moment passes', 'src/rock.mjs', 's.dead.t === log.died.t && ', ''],
  ['the 413 still acts on the part it read', 'server.mjs', "        req.removeAllListeners('end');\n", ''],
  ['the log takes a count of 1.5', 'src/log.mjs', 'Number.isInteger(a[1])', 'Number.isFinite(a[1])'],
  ['the log takes a count of 0', 'src/log.mjs', 'a[1] >= 1 &&', 'a[1] >= 0 &&'],
  ['the log takes an act of three parts', 'src/log.mjs', 'a.length === 2 &&', ''],
  ['the log takes a birth that is not a time', 'src/log.mjs', 'Number.isFinite(head?.born)', "head?.born !== undefined"],
  ['the log takes a death at no time', 'src/log.mjs', '!Number.isFinite(row.died) || ', ''],
  ['the log takes a death of any cause', 'src/log.mjs', ' || !CAUSES.includes(row.cause)', ''],
  // Round 2: the fixes.
  ['the screen prints localhost', 'server.mjs', '`127.0.0.1:${port}`', '`localhost:${port}`'],
  ['no lock', 'server.mjs', "    try { return void fs.writeFileSync(lockOf(file), String(process.pid), { flag: 'wx' }); }", "    try { return void fs.writeFileSync(lockOf(file), String(process.pid), { flag: 'w' }); }"],
  ['a stale lock is never taken over', 'server.mjs', 'if (pid > 0 && alive(pid)) throw', 'if (pid > 0) throw'],
  ['closing keeps the lock', 'server.mjs', "server.on('close', () => { release(); process.off('exit', release); });", "server.on('close', () => { process.off('exit', release); });"],
  ['a refused start keeps the lock', 'server.mjs', '  } catch (e) {\n    release();\n    throw e;', '  } catch (e) {\n    throw e;'],
  ['a torn log cannot be buried', 'server.mjs', "catch { stem = `rock-unreadable-${new Date(now).toISOString()}`; }", 'catch (e) { throw e; }'],
  ['a log that cannot be replayed is served', 'server.mjs', "    look(readLog(file), { now: Date.now(), host }); // refuse to serve a log that cannot be replayed\n", ''],
  ['JSON bodies read as words', 'src/parse.mjs', "  try { json = /^[{\"]/.test(text) ? JSON.parse(text) : undefined; } catch { /* not JSON after all: words */ }\n", ''],
  ['the sandbox meets a bad log mid-game', 'tools/sandbox.mjs', '  look(log, { now: Date.now(), host: HOST }); // refuse a log this build cannot replay now, not mid-game\n', ''],
  ['a form key that is a verb is dropped', 'src/parse.mjs', "(VERBS.includes(String(k).toLowerCase()) ? `${k} ${v}` : String(v))", 'String(v)'],
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rockpet-mutate-'));
for (const p of ['src', 'test', 'tools/rocksim.mjs', 'tools/sandbox.mjs', 'server.mjs', 'package.json']) fs.cpSync(path.join(root, p), path.join(work, p), { recursive: true });

// The suite's verdict: the names of the top-level tests that failed (TAP, one process).
function suite() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap'], { cwd: work, encoding: 'utf8', timeout: 120_000 });
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
