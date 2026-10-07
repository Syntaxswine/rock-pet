// The rock's character: what it is, what it is doing today, and where it has moved to.
// Everything here follows from the log and the clock, so anyone can work out why the rock looks
// and behaves as it does, and nothing here feeds back into the engine: no hunger, happiness, mess
// or death depends on it. The marks of its life are in marks.mjs, the words in story.mjs, the
// drawing in screen.mjs, and the design (with the real things it is built on) in CHARACTER.md.

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

/**
 * At an extreme: hunger 10 or happiness -10, with its 48h running. Then it has no habits, no
 * days and no reactions; only the ice may still have moved it.
 */
export const inDanger = s => s.starvingSince !== null || s.sorrowSince !== null;

// Sailing stones. On Racetrack Playa in Death Valley, rocks slide across the dry lake bed in
// winter, pushed by wind on panels of ice 3-6 mm thick that break up in the late-morning sun
// (Norris et al. 2014, PLoS ONE 9: e105948, the first time anyone saw it happen). This one may
// move on a winter morning, December to February, about one day in twenty: at 10:00 UTC, late
// morning by the rock's own clock (at the Playa itself, about 19:00 UTC). It moves from the
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

const BIRTHDAYS = [7, 30, 100]; // days; then each year on the calendar date

// Whole years old, if t falls in the day after a birthday: the same UTC date and time of day as
// its birth (a 29 February rock has its birthday on 1 March in other years).
function yearsOld(born, t) {
  const b = new Date(born);
  const at = k => Date.UTC(b.getUTCFullYear() + k, b.getUTCMonth(), b.getUTCDate(), b.getUTCHours(), b.getUTCMinutes(), b.getUTCSeconds(), b.getUTCMilliseconds());
  const k = new Date(t).getUTCFullYear() - b.getUTCFullYear();
  for (const years of [k, k - 1]) if (years >= 1 && t >= at(years) && t < at(years) + DAY) return years;
  return 0;
}

/**
 * Anything special about this moment, for someone who only looks: its birthday, a morning it
 * moved, its day for facing the wall, or a small visitor (about one day in eight). At most one,
 * in that order; null on an ordinary day, at an extreme, and in death.
 */
export function occasion(s, now) {
  if (s.dead || inDanger(s)) return null;
  const days = Math.floor((now - s.born) / DAY), years = yearsOld(s.born, now);
  if (BIRTHDAYS.includes(days)) return { what: 'birthday', days };
  if (years) return { what: 'birthday', years };
  if (placeAt(s.born, now).from !== null) return { what: 'sailed' };
  if (new Date(now).getUTCDay() === nature(s.born).wallDay) return { what: 'wall' };
  const day = dayOf(now);
  if (hash(s.born, 6, day) % 8 === 0) return { what: 'visitor', which: hash(s.born, 7, day) };
  return null;
}
