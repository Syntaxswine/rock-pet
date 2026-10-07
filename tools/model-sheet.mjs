// The rock's model sheet: every face, mark and pose, drawn by the game's own renderer
// (src/screen.mjs) from states the engine could reach, side by side; then every drawing it could
// have, for the owner to choose from (src/drawings.mjs). CHARACTER.md shows this output, and
// test/character.test.mjs fails if the two ever differ.
//
//   node tools/model-sheet.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { born, replay, HOUR } from '../src/engine.mjs';
import { RULES } from '../src/rules.mjs';
import { render, W } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { placeAt } from '../src/character.mjs';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 10, 16, 14, 5); // a Monday afternoon in November
const rock = o => ({ ...born(T - 41 * DAY), t: T, lastCare: T - 2 * HOUR, visits: 90, hunger: 2, happy: 6, ...o });
const floor = { happy: -10, sorrowSince: T - 5 * HOUR };
const grave = (since, o) => ({ ...rock({ hunger: 10, happy: -10, starvingSince: T - since - 20 * HOUR, sorrowSince: T - since - 48 * HOUR, lastCare: T - since - 70 * HOUR, messes: 3, closeCalls: 1, ...o }), t: T - since, dead: { t: T - since, cause: 'lonely' } });
// A rock as it really is after `hours` alone: cared for in full every 8h for 20 days, the last
// time `hours` before T, then left. (Too short a life for polish or crystals.)
function alone(hours) {
  const visits = [];
  for (let t = T - hours * HOUR; t > T - 20 * DAY; t -= 8 * HOUR) visits.unshift({ t, acts: [['feed', 4], ['clean', 1], ['pet', 10]] });
  return replay({ born: T - 20 * DAY, rules: RULES.version, visits }, T);
}

// The first winter day after T on which this rock moves, for the sailing frame.
function sailingDay(b) {
  for (let t = T; ; t += DAY) { const p = placeAt(b, t); if (p.from !== null) return { t, p }; }
}

function grid(s, { now = T, pose, drawing } = {}) {
  return render(s, { now, host: 'rock', pose, name: 'Pebble', drawing }).split('\n').slice(0, W).map(row => row.padEnd(W));
}
function row(frames) {
  const out = [frames.map(([label]) => label.padEnd(W + 2)).join('  ').trimEnd()];
  for (let r = 0; r < W; r++) out.push(frames.map(([, g]) => `|${g[r]}|`).join('  ').trimEnd());
  return out.join('\n');
}
// The drawings' frames show only the rock's rows, not the ground.
const short = frames => row(frames).split('\n').slice(0, 7).join('\n');

/** The sheet, as text. */
export function sheet() {
  const sail = sailingDay(T - 41 * DAY);
  const sailNow = sail.t + 9 * HOUR;
  return [
    `the rock, as drawn now (${DRAWING}): faces, by happiness`,
    row([
      ['5 and up', grid(rock({ happy: 9 }))], ['0 to 5', grid(rock({ happy: 2 }))], ['-5 to 0', grid(rock({ happy: -2 }))],
      ['below -5', grid(rock({ happy: -7 }))], ['at -10', grid(rock(floor))],
    ]),
    'moss: hours since anyone came (cared for every 8h until then)',
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
    'its days: the wall, a morning it moved',
    row([
      ['facing the wall', grid(rock({ closeCalls: 1 }), { pose: 'away' })],
      [`moved ${sail.p.col > sail.p.from ? 'right' : 'left'}`, grid(rock({ born: T - 41 * DAY, t: sailNow, lastCare: sailNow - 2 * HOUR }), { now: sailNow })],
    ]),
    'the grave: at death, then more moss',
    row([
      ['died', grid(grave(0))], ['a week', grid(grave(7 * DAY))], ['a month', grid(grave(30 * DAY))],
      ['a season', grid(grave(90 * DAY))],
    ]),
    'the drawings to choose from (src/drawings.mjs)',
    ...Object.entries(DRAWINGS).map(([name, drawing]) => `${name}: ${drawing.about}${name === DRAWING ? ' (drawn now)' : ''}\n` + short([
      ['happy', grid(rock({ happy: 9 }), { drawing })],
      ['at -10, mossy', grid(rock({ ...floor, lastCare: T - 48 * HOUR }), { drawing })],
      ['a long life', grid(rock({ closeCalls: 1, petted: 500, fed: 300 }), { drawing })],
      ['the wall', grid(rock(), { pose: 'away', drawing })],
      ['dead a month', grid(grave(30 * DAY), { drawing })],
    ])),
  ].join('\n\n') + '\n';
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) process.stdout.write(sheet());
