// How large a look and an accepted visit's reply can get (CHARACTER.md, "Size, and staying the
// same"). The screen's worst is built on purpose in test/screen.test.mjs. A look or a reply adds
// lines that depend on the rock's life (a reaction, a day's remark, the naming line), so this
// searches real lives for them: long and short ones, cared for in full and then neglected, with
// every drawing, all 64 mixes of ground levels and every spot its room allows (with no furrow, or
// the longest) forced onto each rock, as the tests do.
// Error replies add their one error line and go to the sender alone; they are not counted here.
// It samples, so it can miss the worst. The largest known are built from real lives and held in
// test/character.test.mjs: a reply of 427 bytes and a look of 427 (433 after downtime) with a
// 15-character host.
//
//   node tools/sizes.mjs [host length, 15] [lives, 100] [seed, 1]

import { replay, HOUR } from '../src/engine.mjs';
import { render } from '../src/screen.mjs';
import { DRAWINGS } from '../src/drawings.mjs';
import { occasion } from '../src/character.mjs';
import { mealAt } from '../src/meal.mjs';
import { reaction, remark } from '../src/story.mjs';
import { parseActions } from '../src/parse.mjs';
import { newLog } from '../src/rock.mjs';
import { roomOf } from '../src/wander.mjs';

const DAY = 24 * HOUR;
const [hostLength = 15, lives = 100, seed = 1] = process.argv.slice(2).map(Number);
const host = 'x'.repeat(hostLength);
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const BODIES = ['pet', 'pet x2', 'feed', 'feed pet', 'clean', 'feed clean', 'pet clean', 'feed x4 clean pet x10'];
const grounds = [];
for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) for (let p = 0; p < 4; p++) {
  // The 28 mixes care can reach (test/ground.test.mjs): the least-given care never shows, and two
  // traces can't reach levels 3 and 3, or 3 and 2.
  const [b, a] = [f, c, p].sort((x, y) => x - y).slice(1);
  grounds.push({ ground: { feed: f, clean: c, pet: p }, reachable: [f, c, p].includes(0) && !(a === 3 && b >= 2) });
}

function mulberry(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(seed);
// Every spot a drawing can wander to, with no furrow and with the longest (from the far end).
function placesOf(drawing) {
  const { min, max } = roomOf(drawing), out = [];
  for (let dx = min; dx <= max; dx++) out.push({ dx, from: null, furrow: false }, { dx, from: dx - min > max - dx ? min : max, furrow: true });
  return out;
}

// A life: full care every 8h for about a thousand days (most lives) or twenty, then a week of
// scant, irregular care, to pile up messes and hunger. Half are named.
function life() {
  const b = Date.UTC(2023, 0, 1) + Math.floor(rnd() * 365 * DAY), log = newLog(b);
  const age = (rnd() < 0.7 ? 1000 : 20) * DAY;
  for (let t = b + HOUR; t < b + age; t += 8 * HOUR) log.visits.push({ t, acts: FULL });
  let t = log.visits.at(-1).t;
  const end = t + 7 * DAY;
  for (;;) {
    t = Math.round(t + HOUR * (1 + rnd() * (rnd() < 0.3 ? 30 : 12)));
    if (t > end) break;
    const acts = [];
    if (rnd() < 0.35) acts.push(['feed', 1 + Math.floor(rnd() * 2)]);
    if (rnd() < 0.15) acts.push(['clean', 1]);
    if (rnd() < 0.8 || !acts.length) acts.push(['pet', 1 + Math.floor(rnd() * 6)]);
    if (replay({ ...log, visits: [...log.visits, { t, acts }] }, t).dead) break;
    log.visits.push({ t, acts });
  }
  if (rnd() < 0.5) log.name = { name: 'Abcdefghijkl', t: b + DAY };
  return log;
}

const best = { look: { n: 0 }, reply: { n: 0 }, lookReached: { n: 0 }, replyReached: { n: 0 } };
const keep = (key, n, text, what) => { if (n > best[key].n) best[key] = { n, text, what }; };
for (let i = 0; i < lives; i++) {
  const log = life(), name = log.name?.name ?? null, outages = [];
  for (let k = 0; k < 6; k++) {
    const now = log.visits.at(-1).t + Math.floor(rnd() * 40 * HOUR);
    const s = replay(log, now);
    if (s.dead) continue;
    const o = occasion(s, now, log.outages ?? []), pose = o?.what === 'wall' ? 'away' : 'front';
    const views = [{ s, meal: mealAt(log, now), pose, tail: remark(o), what: 'a look' }];
    for (const body of BODIES) {
      const afterLog = { ...log, visits: [...log.visits, { t: now, acts: parseActions(body).acts }] }, after = replay(afterLog, now);
      views.push({ s: after, meal: mealAt(afterLog, now), pose: 'front', tail: reaction(afterLog, s, after), what: `a reply to "${body}"` });
    }
    for (const view of views) for (const [drawing, d] of Object.entries(DRAWINGS)) for (const place of placesOf(d)) for (const { ground, reachable } of grounds) {
      const text = render(view.s, { now, host, pose: view.pose, name, drawing: d, outages, ground, meal: view.meal, place }) + view.tail + `history: ${host}/history\n`;
      const n = Buffer.byteLength(text), what = `${view.what}, ${drawing} at ${place.dx}, ground ${ground.feed}${ground.clean}${ground.pet}`;
      const kind = view.what === 'a look' ? 'look' : 'reply';
      keep(kind, n, text, what);
      if (reachable) keep(`${kind}Reached`, n, text, what);
    }
  }
}
console.log(`host of ${hostLength} characters, ${lives} lives (seed ${seed}), every drawing:`);
console.log(`  all 64 grounds: largest look ${best.look.n} (${best.look.what}), largest reply ${best.reply.n} (${best.reply.what})`);
console.log(`  the 28 grounds care can reach: largest look ${best.lookReached.n}, largest reply ${best.replyReached.n}`);
if (process.env.SHOW) console.log(`\n${best.reply.text}\n${best.look.text}`);
