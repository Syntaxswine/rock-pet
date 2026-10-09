// The rock's model sheet: every face, mark, pose, meal, hunger and ground, drawn by the game's own
// renderer (src/screen.mjs) from states the engine could reach, side by side; then every drawing
// it could have, for the owner to choose from (src/drawings.mjs), and the ground, a meal and
// hunger on each. CHARACTER.md shows this output, and test/character.test.mjs fails if the two
// ever differ.
//
//   node tools/model-sheet.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { born, replay, HOUR } from '../src/engine.mjs';
import { RULES } from '../src/rules.mjs';
import { render, W } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { iceTimes } from '../src/character.mjs';
import { CARE_AXES, DAILY_CARE } from '../src/personality.mjs';
import { groundOf } from '../src/ground.mjs';
import { mealAt } from '../src/meal.mjs';
import { whereAt, movesOf, furrowShows } from '../src/wander.mjs';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 10, 16, 14, 5); // a Monday afternoon in November
const rock = o => ({ ...born(T - 41 * DAY), t: T, lastCare: T - 2 * HOUR, visits: 90, hunger: 2, happy: 6, ...o });
const floor = { happy: -10, sorrowSince: T - 5 * HOUR };
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
// A rock as it really is after `hours` alone: cared for in full every 8h for 20 days, the last
// time `hours` before T, then left. (Too short a life for polish or crystals.)
function alone(hours) {
  const visits = [];
  for (let t = T - hours * HOUR; t > T - 20 * DAY; t -= 8 * HOUR) visits.unshift({ t, acts: FULL });
  return replay({ born: T - 20 * DAY, rules: RULES.version, visits }, T);
}
// A real lonely grave: cared for every 8h, left once for 50h and brought back (its close call),
// cared for again, then left for good. Its messes and moss are what that life leaves.
const LONELY = (() => {
  const b = T - 41 * DAY, visits = [];
  for (let t = b + HOUR; t < b + 10 * DAY; t += 8 * HOUR) visits.push({ t, acts: FULL });
  for (let t = visits.at(-1).t + 50 * HOUR; t < b + 20 * DAY; t += 8 * HOUR) visits.push({ t, acts: FULL });
  return replay({ born: b, rules: RULES.version, visits }, Infinity);
})();
const graveAt = since => [LONELY, { now: LONELY.dead.t + since }];

// A rock cared for in full every 8h from its birth, 41 days before T, up to `until`; and where it
// is at t (wander.mjs), as rock.mjs would draw it then, with the state it is in.
const keptLog = until => {
  const log = { born: T - 41 * DAY, rules: RULES.version, visits: [] };
  for (let t = log.born + HOUR; t <= until; t += 8 * HOUR) log.visits.push({ t, acts: FULL });
  return log;
};
const seenAt = (log, t, drawing = DRAWINGS[DRAWING]) => {
  const p = whereAt(log, t, drawing);
  return [replay(log, t), { now: t, drawing, place: { dx: p.dx, from: p.from, furrow: furrowShows(log, p, t) }, meal: mealAt(log, t) }];
};
// Its first moves of a day, each seen five minutes after it was made, so its furrow shows: the
// first day after T on which they include a walk to its food, so the sheet shows both kinds.
function aDayOfMoves(n) {
  const first = Math.ceil(T / DAY) * DAY;
  // A broken movement rule may never send it to food. Search a bounded set of days, using
  // the moves themselves rather than replaying the whole life at every minute of each day.
  for (let day = first; day < first + 14 * DAY; day += DAY) {
    const log = keptLog(day + DAY);
    const out = movesOf(log, day + DAY - 1, DRAWINGS[DRAWING])
      .filter(p => p.at >= day).slice(0, n)
      .map(p => [`${new Date(p.at).toISOString().slice(11, 16)} ${p.why === 'food' ? 'to food' : p.why}`, ...seenAt(log, p.at + 5 * 60_000)]);
    if (out.some(([label]) => label.endsWith('to food'))) return out;
  }
  throw new Error('the model sheet found no walk to food within fourteen days');
}
// Its first morning on the ice after T, seen that evening.
function onTheIce() {
  const t = iceTimes(T - 41 * DAY, T + 120 * DAY, []).find(at => at > T) + 9 * HOUR;
  return seenAt(keptLog(t), t);
}

// Lifetime care totals for a rock `days` old, given each care at its daily need (personality.mjs)
// times `x` (1 if not given): every need met, and more of the cares it is given more of.
const given = (x = {}, days = 41) => Object.fromEntries(CARE_AXES.map(k => [k, Math.round(days * DAILY_CARE[k] * (x[k] ?? 1))]));
// A rock of `days` old, cared for in full and always in the same proportions, drawn with the
// ground that care gives it.
const kept = (x, days = 41) => [rock({ born: T - days * DAY }), { ground: groundOf(given(x, days), days * DAY) }];

// A rock fed down to hunger 0 `ms` ago, as it is at T (its hunger is what has come back since):
// the rock, and the meal that feed gives it.
const MIN = 60_000;
const eating = (ms, o = {}) => [rock({ hunger: ms / (2.4 * HOUR), lastCare: T - ms, ...o }), { meal: mealAt({ born: T - 41 * DAY, rules: RULES.version, visits: [{ t: T - ms, acts: [['feed', 2]] }] }, T) }];

function grid(s, { now = T, pose, drawing, ground, meal, place } = {}) {
  return render(s, { now, host: 'rock', pose, name: 'Pebble', drawing, ground, meal, place }).split('\n').slice(0, W).map(row => row.padEnd(W));
}
function row(frames) {
  const out = [frames.map(([label]) => label.padEnd(W + 2)).join('  ').trimEnd()];
  for (let r = 0; r < W; r++) out.push(frames.map(([, g]) => `|${g[r]}|`).join('  ').trimEnd());
  return out.join('\n');
}
// The drawings' frames show only the rock's rows, not the ground.
const short = frames => row(frames).split('\n').slice(0, 7).join('\n');
// Frames of the rock and the ground in front of it: screen rows 1-10.
const standing = frames => row(frames).split('\n').filter((_, i) => i === 0 || (i >= 2 && i <= 11)).join('\n');
// Two grounds that between them show every trace: the levels at the middle of two sides.
const FEED_PET = { feed: 2, clean: 0, pet: 2 }, CLEAN_PET = { feed: 0, clean: 2, pet: 2 };

/** The sheet, as text. */
export function sheet() {
  return [
    `the rock, as drawn now (${DRAWING}): faces, by happiness`,
    row([
      ['5 and up', grid(rock({ happy: 9 }))], ['0 to 5', grid(rock({ happy: 2 }))], ['-5 to 0', grid(rock({ happy: -2 }))],
      ['below -5', grid(rock({ happy: -7 }))], ['at -10', grid(rock(floor))],
    ]),
    'moss: hours since anyone came (cared for every 8h until then). By a day it is hungry too, and\n' +
      'drawn faint',
    row([['6', grid(alone(6))], ['12', grid(alone(12))], ['24', grid(alone(24))], ['48', grid(alone(48))]]),
    'marks of a long life: veins (close calls)',
    row([
      ['one', grid(rock({ closeCalls: 1 }))], ['two', grid(rock({ closeCalls: 2 }))], ['three or more', grid(rock({ closeCalls: 5 }))],
    ]),
    'marks of a long life: polish (petting) and crystals (meals)',
    row([
      ['polished', grid(rock({ petted: 500 }))], ['worn smooth', grid(rock({ petted: 3000 }))],
      ['a crystal', grid(rock({ fed: 300 }))], ['two', grid(rock({ fed: 1500 }))],
    ]),
    'its meals: the hour after a feed, the food going and its mouth opening and shutting',
    row([
      ['the feed reply', grid(...eating(0))], ['a minute on', grid(...eating(MIN))], ['half an hour', grid(...eating(30 * MIN))],
      ['31 minutes', grid(...eating(31 * MIN))], ['an hour on', grid(...eating(HOUR))],
    ]),
    'when it is hungry: from 7 on the screen it is drawn faint, whatever its mood, until a feed\n' +
      'brings it below 7',
    row([
      ['hunger 6', grid(rock({ hunger: 6.4 }))], ['hunger 7', grid(rock({ hunger: 6.6 }))],
      ['starving', grid(rock({ hunger: 10, starvingSince: T - 5 * HOUR }))], ['fed once, at 7', grid(...eating(0, { hunger: 7 }))],
    ]),
    'its ground: the care it has been given more of (its personality). Every need met, and six\n' +
      'times the need of one care, or five times the need of two',
    row([
      ['even-tempered', grid(...kept())], ['comfort-loving', grid(...kept({ feed: 6 }))],
      ['orderly', grid(...kept({ clean: 6 }))], ['affectionate', grid(...kept({ pet: 6 }))],
    ]),
    row([
      ['settled', grid(...kept({ feed: 5, clean: 5 }))], ['sociable', grid(...kept({ feed: 5, pet: 5 }))],
      ['gentle', grid(...kept({ clean: 5, pet: 5 }))],
    ]),
    'its ground, the shades between: petted at 2, 3, 4 and 8 times its need',
    row([2, 3, 4, 8].map(x => [`${x} times`, grid(...kept({ pet: x }))])),
    'its ground forms over two weeks: petted at 8 times its need, at 2, 7, 10 and 14 days old',
    row([2, 7, 10, 14].map(d => [`${d} days`, grid(...kept({ pet: 8 }, d))])),
    'where it is: about once in four hours it moves along its ground, to its food if it has just\n' +
      'been fed. A day of its moves, each five minutes after it made it, with the furrow it left',
    row(aDayOfMoves(4).map(([label, s, o]) => [label, grid(s, o)])),
    'its days: the wall, and an evening after it slid on the ice',
    row([
      ['facing the wall', grid(rock({ closeCalls: 1 }), { pose: 'away' })],
      ['slid on the ice', grid(...onTheIce())],
    ]),
    'the grave of a rock once saved, then left: at death, then more moss',
    row([
      ['died', grid(...graveAt(0))], ['a week', grid(...graveAt(7 * DAY))], ['a month', grid(...graveAt(30 * DAY))],
      ['a season', grid(...graveAt(90 * DAY))],
    ]),
    'the drawings to choose from (src/drawings.mjs)',
    ...Object.entries(DRAWINGS).map(([name, drawing]) => `${name}: ${drawing.about}${name === DRAWING ? ' (drawn now)' : ''}\n` + short([
      ['happy', grid(rock({ happy: 9 }), { drawing })],
      ['48h alone', grid(alone(48), { drawing })],
      ['a long life', grid(rock({ closeCalls: 1, petted: 500, fed: 300 }), { drawing })],
      ['the wall', grid(rock(), { pose: 'away', drawing })],
      ['dead a month', grid(LONELY, { now: LONELY.dead.t + 30 * DAY, drawing })],
    ])),
    'its ground on each drawing, at a side\'s middle: feed and pet (sand over its corners, a path),\n' +
      'then clean and pet (two raked lines, stepping stones, a path)',
    ...[0, 2, 4, 6].map(i => standing(Object.entries(DRAWINGS).slice(i, i + 2).flatMap(([name, drawing]) => [
      [name, grid(rock(), { drawing, ground: FEED_PET })], ['', grid(rock(), { drawing, ground: CLEAN_PET })],
    ]))),
    'a meal and hunger on each drawing: just fed, then hungry',
    ...[0, 2, 4, 6].map(i => short(Object.entries(DRAWINGS).slice(i, i + 2).flatMap(([name, drawing]) => {
      const [fed, meal] = eating(0);
      return [[name, grid(fed, { drawing, ...meal })], ['', grid(rock({ hunger: 6.6 }), { drawing })]];
    }))),
  ].join('\n\n') + '\n';
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) process.stdout.write(sheet());
