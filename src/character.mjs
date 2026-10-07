// The rock's character: what it is, what it is doing today, and the marks time leaves on it.
// Everything here follows from the log and the clock, so anyone can work out why the rock looks
// and behaves as it does, and nothing here feeds back into the engine: no hunger, happiness, mess
// or death depends on it. The words are in story.mjs, the drawing in screen.mjs, and the design
// (with the real things it is built on) in CHARACTER.md.

import { HOUR } from './engine.mjs';

const DAY = 24 * HOUR;
const dayOf = t => Math.floor(t / DAY); // whole UTC days since 1970

// A 32-bit hash of numbers, timestamps included: a rock's nature is a pure function of its birth.
const mix = h => {
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
};
export function hash(...ns) {
  let h = 0x9e3779b9;
  for (const n of ns) h = mix(mix(h ^ (n >>> 0)) ^ (Math.floor(n / 2 ** 32) >>> 0));
  return h;
}

/** The kinds of stone it can be born as: common pebbles, each with something to show when washed. */
export const KINDS = ['granite', 'basalt', 'sandstone', 'limestone', 'quartzite', 'obsidian', 'schist', 'flint'];
/** The three voices its reactions come in. */
export const VOICES = ['curious', 'stoic', 'warm'];

/** Its nature, fixed at birth. */
export function nature(born) {
  return {
    // The formula of the first reactions (a6ef9c8), so a rock born before this build keeps its voice.
    voice: VOICES[Math.abs(Math.trunc(born / 1000)) % 3],
    likes: ['feed', 'clean', 'pet'][hash(born, 1) % 3], // the care it reacts to first
    kind: KINDS[hash(born, 2) % KINDS.length],
    wallDay: hash(born, 3) % 7,                         // the UTC weekday it faces the wall (0 = Sunday)
  };
}

/** At an extreme: hunger 10 or happiness -10, with its 48h running. Then it does nothing odd. */
export const inDanger = s => s.starvingSince !== null || s.sorrowSince !== null;

// Sailing stones. On Racetrack Playa in Death Valley, rocks slide across the dry lake bed in
// winter, pushed by wind on panels of ice 3-6 mm thick that break up in the late-morning sun
// (Norris et al. 2014, PLoS ONE 9: e105948, the first time anyone saw it happen). This one may
// move on a winter morning, December to February, about one day in twenty, at 10:00 UTC: from the
// middle of the screen one column to either side, or back. It does not move after it dies.
const SAILS_PER_MILLE = 50;
const SAILS_AT = 10 * HOUR;
function sails(born, day) {
  const month = new Date(day * DAY).getUTCMonth();
  return (month === 11 || month <= 1) && hash(born, 4, day) % 1000 < SAILS_PER_MILLE;
}

/**
 * Where it sits at t: `col`, its offset from the middle (-1, 0 or 1); `from`, the offset it moved
 * from if it moved earlier that UTC day (else null); and `moves`, how often it has moved.
 */
export function placeAt(born, t) {
  let col = 0, from = null, moves = 0;
  const today = dayOf(t);
  for (let d = dayOf(born) + 1; d <= today; d++) {
    if (!sails(born, d) || (d === today && t - d * DAY < SAILS_AT)) continue;
    if (d === today) from = col;
    col = col !== 0 ? 0 : hash(born, 5, d) % 2 ? 1 : -1;
    moves++;
  }
  return { col, from, moves };
}

/**
 * The marks of time on it. While it lives, grit settles when nobody tends it: a fleck after 12h
 * without care, another after a day, a leaf after two (it cannot live a third). Any care brushes
 * it off. Once it is dead, moss creeps over it: after a week, a month, a season.
 */
export function weatherAt(s, now) {
  if (s.dead) {
    const d = now - s.dead.t;
    return { grit: 0, moss: d >= 90 * DAY ? 3 : d >= 30 * DAY ? 2 : d >= 7 * DAY ? 1 : 0 };
  }
  const quiet = now - (s.lastCare ?? s.born);
  return { grit: quiet >= 48 * HOUR ? 3 : quiet >= 24 * HOUR ? 2 : quiet >= 12 * HOUR ? 1 : 0, moss: 0 };
}

const BIRTHDAYS = [7, 30, 100]; // days; then every 365

/**
 * Anything special about this moment, for someone who only looks: its birthday, a morning it
 * moved, its day for facing the wall, or a small visitor (about one day in eight). At most one,
 * in that order; null on an ordinary day, at an extreme, and in death.
 */
export function occasion(s, now) {
  if (s.dead || inDanger(s)) return null;
  const days = Math.floor((now - s.born) / DAY);
  if (BIRTHDAYS.includes(days) || (days > 0 && days % 365 === 0)) return { what: 'birthday', days };
  if (placeAt(s.born, now).from !== null) return { what: 'sailed' };
  if (new Date(now).getUTCDay() === nature(s.born).wallDay) return { what: 'wall' };
  const day = dayOf(now);
  if (hash(s.born, 6, day) % 8 === 0) return { what: 'visitor', which: hash(s.born, 7, day) };
  return null;
}
