// The rock's model sheet: every face, mark and pose, drawn by the game's own renderer
// (src/screen.mjs) from states the engine could reach, side by side. CHARACTER.md shows this
// output, and test/character.test.mjs fails if the two ever differ.
//
//   node tools/model-sheet.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { born, HOUR } from '../src/engine.mjs';
import { render, W } from '../src/screen.mjs';
import { placeAt } from '../src/character.mjs';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 10, 16, 14, 5); // a Monday afternoon in November
const rock = o => ({ ...born(T - 41 * DAY), t: T, lastCare: T - 2 * HOUR, visits: 90, hunger: 2, happy: 6, ...o });
const floor = { happy: -10, sorrowSince: T - 5 * HOUR };
const grave = (since, o) => ({ ...rock({ hunger: 10, happy: -10, starvingSince: T - since - 20 * HOUR, sorrowSince: T - since - 48 * HOUR, lastCare: T - since - 70 * HOUR, messes: 3, ...o }), t: T - since, dead: { t: T - since, cause: 'lonely' } });

// The first winter day after T on which this rock moves, for the sailing frame.
function sailingDay(b) {
  for (let t = T; ; t += DAY) { const p = placeAt(b, t); if (p.from !== null) return { t, p }; }
}

function grid(s, { now = T, pose } = {}) {
  return render(s, { now, host: 'rock', pose }).split('\n').slice(0, W).map(row => row.padEnd(W));
}
function row(frames) {
  const out = [frames.map(([label]) => label.padEnd(W + 2)).join('  ').trimEnd()];
  for (let r = 0; r < W; r++) out.push(frames.map(([, g]) => `|${g[r]}|`).join('  ').trimEnd());
  return out.join('\n');
}

/** The sheet, as text. */
export function sheet() {
  const sail = sailingDay(T - 41 * DAY);
  const sailNow = sail.t + 9 * HOUR;
  return [
    'faces, by happiness',
    row([
      ['5 and up', grid(rock({ happy: 9 }))], ['0 to 5', grid(rock({ happy: 2 }))], ['-5 to 0', grid(rock({ happy: -2 }))],
      ['below -5', grid(rock({ happy: -7 }))], ['at -10', grid(rock(floor))],
    ]),
    'grit: hours since anyone came',
    row([
      ['under 12', grid(rock())], ['12', grid(rock({ lastCare: T - 12 * HOUR, happy: 1 }))],
      ['24', grid(rock({ lastCare: T - 24 * HOUR, happy: -6 }))], ['48', grid(rock({ lastCare: T - 48 * HOUR, ...floor }))],
    ]),
    'veins: close calls',
    row([
      ['one', grid(rock({ closeCalls: 1 }))], ['two', grid(rock({ closeCalls: 2 }))], ['three or more', grid(rock({ closeCalls: 5 }))],
    ]),
    'its days: the wall, a morning it moved',
    row([
      ['facing the wall', grid(rock({ closeCalls: 1 }), { pose: 'away' })],
      [`moved ${sail.p.col > sail.p.from ? 'right' : 'left'}`, grid(rock({ born: T - 41 * DAY, t: sailNow, lastCare: sailNow - 2 * HOUR }), { now: sailNow })],
    ]),
    'the grave: at death, then moss',
    row([
      ['died', grid(grave(0, { closeCalls: 1 }))], ['a week', grid(grave(7 * DAY))], ['a month', grid(grave(30 * DAY))],
      ['a season', grid(grave(90 * DAY))],
    ]),
  ].join('\n\n') + '\n';
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) process.stdout.write(sheet());
