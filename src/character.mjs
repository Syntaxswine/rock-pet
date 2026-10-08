// The rock's character: what it is, what it is doing today, and when the ice moved it.
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

/** Its nature, fixed at birth. */
export function nature(born) {
  return {
    kind: KINDS[hash(born, 2) % KINDS.length],
    wallDay: hash(born, 3) % 7,                         // the UTC weekday it faces the wall (0 = Sunday)
  };
}

/**
 * At an extreme: hunger 10 or happiness -10, with its 48h running. Then it has no habits, no
 * days and no reactions, and it does not wander or go to its food (wander.mjs): only the ice may
 * still move it.
 */
export const inDanger = s => s.starvingSince !== null || s.sorrowSince !== null;

// Sailing stones. On Racetrack Playa in Death Valley, rocks slide across the dry lake bed in
// winter, pushed by wind on panels of ice 3-6 mm thick that break up in the late-morning sun
// (Norris et al. 2014, PLoS ONE 9: e105948, the first time anyone saw it happen). This one may
// slide on a winter morning, December to February, about one day in twenty: at 10:00 UTC, late
// morning by the rock's own clock (at the Playa itself, about 19:00 UTC). Where it slides to,
// and its wandering the rest of the time, are wander.mjs's. It does not slide while the host is
// down, when its time doesn't pass, any more than it wanders then; nor after it dies.
const SAILS_PER_MILLE = 50;
const SAILS_AT = 10 * HOUR;
function sails(born, day) {
  const month = new Date(day * DAY).getUTCMonth();
  return (month === 11 || month <= 1) && hash(born, 4, day) % 1000 < SAILS_PER_MILLE;
}

/**
 * The moments it slid on the ice, after the day it was born, up to t: 10:00 UTC on those mornings,
 * but none while the host was down. `outages` are the log's verified downtime, [start, end).
 */
export function iceTimes(born, t, outages) {
  const out = [];
  for (let d = dayOf(born) + 1; d * DAY + SAILS_AT <= t; d++) {
    const at = d * DAY + SAILS_AT;
    if (sails(born, d) && !outages.some(o => at >= o.start && at < o.end)) out.push(at);
  }
  return out;
}

/** Whether it slid on the ice earlier on t's UTC day. */
export const slidToday = (born, t, outages) => { const last = iceTimes(born, t, outages).at(-1); return last !== undefined && dayOf(last) === dayOf(t); };

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
 * slid on the ice, its day for facing the wall, or a small visitor (about one day in eight). At most one,
 * in that order; null on an ordinary day, at an extreme, and in death. `outages` are the log's
 * verified downtime, when it doesn't slide.
 */
export function occasion(s, now, outages) {
  if (s.dead || inDanger(s)) return null;
  const days = Math.floor((now - s.born) / DAY), years = yearsOld(s.born, now);
  if (BIRTHDAYS.includes(days)) return { what: 'birthday', days };
  if (years) return { what: 'birthday', years };
  if (slidToday(s.born, now, outages)) return { what: 'sailed' };
  if (new Date(now).getUTCDay() === nature(s.born).wallDay) return { what: 'wall' };
  const day = dayOf(now);
  if (hash(s.born, 6, day) % 8 === 0) return { what: 'visitor', which: hash(s.born, 7, day) };
  return null;
}
