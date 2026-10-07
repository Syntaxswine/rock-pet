// Rock Pet sandbox: the real engine on a pretend clock, to feel the rules without waiting days.
// It never writes to any log.
//
//   node tools/sandbox.mjs                          type commands; each prints the screen
//   node tools/sandbox.mjs "pet x3; wait 30h"       run commands (split on ;) and exit
//   node tools/sandbox.mjs --from data/rock.jsonl "until dead"
//                                                   the real rock's fate if nobody else comes
//   --at 2026-10-06T08:00Z                          when the pretend rock is born (default: now)
//
// Commands: any action body (feed clean pet x3), wait 6h | 90m | 2d | 1d 6h, look,
// name Pebble, until dead, log, help, quit.

import readline from 'node:readline';
import { look, act, name, newLog } from '../src/rock.mjs';
import { replay } from '../src/engine.mjs';
import { readLog } from '../server.mjs';

const HOST = '127.0.0.1:7625';
const HELP = `commands: feed | clean | pet (with counts, e.g. "feed clean pet x3"), wait 6h | 90m | 2d,
look, name Pebble (once), until dead (nobody comes: jump to the moment it dies), log, help, quit`;

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const from = opt('--from'), at = opt('--at');
const bornAt = at === undefined ? Date.now() : Date.parse(at);
if (!Number.isFinite(bornAt)) { console.error(`sandbox: --at ${at} is not a time (try 2026-10-06T08:00Z)`); process.exit(1); }
let log;
try {
  log = from ? readLog(from) : newLog(bornAt);
  look(log, { now: Date.now(), host: HOST }); // refuse a log this build cannot replay now, not mid-game
} catch (e) {
  console.error(`sandbox: ${from}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`);
  process.exit(1);
}
let clock = from ? Math.max(Date.now(), log.visits.at(-1)?.t ?? log.born, log.died?.t ?? -Infinity) : log.born;

// "1d 6h", "90m", "1.5h" -> ms, or null.
function span(text) {
  const parts = text.split(' ').filter(Boolean);
  if (!parts.length) return null;
  let ms = 0;
  for (const p of parts) {
    const m = /^([0-9]*[.]?[0-9]+)(m|h|d)$/.exec(p);
    if (!m) return null;
    ms += Number(m[1]) * { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  }
  return ms;
}

function run(line) {
  const cmd = line.trim();
  if (!cmd) return;
  const [word, ...rest] = cmd.toLowerCase().split(' ').filter(Boolean);
  if (word === 'quit' || word === 'exit') process.exit(0);
  if (word === 'help') return console.log(HELP);
  console.log(`> ${cmd}`);
  if (word === 'wait') {
    const ms = span(rest.join(' '));
    if (ms === null) return console.log('wait how long? e.g. wait 6h, wait 90m, wait 2d');
    clock += ms;
  } else if (word === 'until') {
    const fate = replay(log, Infinity);
    clock = Math.max(clock, Math.ceil(fate.dead.t));
  } else if (word === 'log') {
    for (const v of log.visits) console.log(`${new Date(v.t).toISOString().slice(0, 16)}Z  ${v.acts.map(([w, n]) => (n > 1 ? `${w} x${n}` : w)).join(' ')}`);
    return console.log(`${log.visits.length} visit(s) since birth at ${new Date(log.born).toISOString().slice(0, 16)}Z`);
  } else if (word === 'name') {
    const r = name(log, rest.join(' '), { now: clock, host: HOST });
    if (r.named) log = { ...log, name: r.named };
    return process.stdout.write(r.text);
  } else if (word !== 'look') {
    const r = act(log, cmd, { now: clock, host: HOST });
    if (r.visit) log = { ...log, visits: [...log.visits, r.visit] };
    return process.stdout.write(r.text);
  }
  process.stdout.write(look(log, { now: clock, host: HOST }).text);
}

if (args.length) {
  for (const line of args.join(' ').split(';')) run(line);
} else {
  console.log(`Rock Pet sandbox: a pretend rock${from ? ` from ${from}` : ''}, a pretend clock. ${HELP}\n`);
  run('look');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'rock> ' });
  rl.prompt();
  rl.on('line', line => { run(line); rl.prompt(); });
}
