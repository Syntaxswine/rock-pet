// Where it is (CHARACTER.md, "Where it is"): it moves along its ground about once in four hours,
// to its food if it has just been fed and on its own otherwise, and on a few winter mornings it
// slides on the ice (character.mjs). The owner's call (2026-10-08): "the pet should wander around
// the screen even without food. not nonstop, just regularly." It all follows from the log and the
// clock, so everyone sees it in the same place at the same moment. It is only drawn: nothing here
// changes the rock.
//
//   its chance   one in each four hours of UTC time, taken by the first of these to find it free,
//                however often it is fed; the spot it picks may be where it already is
//     a feed       sends it to the spot its food fell on
//     wandering    at a minute of its own, to a spot of its own, unless it is eating (meal.mjs):
//                  it doesn't wander off from its food
//   free         not resting, for an hour of its life after it moves, and not at an extreme
//   the ice      a winter morning's slide takes it to another spot, whatever else, its food with
//                it, and it rests there for the rest of that UTC day, its furrow beside it
//   downtime     no wandering and no ice while the host is down, when its time doesn't pass
//   a grave      stays where it died
//
// It moves left and right along its ground, not up and down the screen: below it lie its
// personality's traces and its messes.

import { HOUR, replayer } from './engine.mjs';
import { activeElapsed } from './outages.mjs';
import { hash, iceTimes, inDanger } from './character.mjs';
import { MEAL_MS } from './meal.mjs';

const MINUTE = 60_000, DAY = 24 * HOUR;
/** How often it may move: once in each block of this many hours, counted from 00:00 UTC. */
export const WANDER_H = 4;
/** How long it rests after it moves, in time it has lived. */
export const REST_MS = HOUR;
/** How long the furrow of a wander or a walk to its food shows, in time it has lived. The ice's shows all that day. */
export const FURROW_MS = HOUR;

/**
 * Where a drawing can go along a grid `W` wide: offsets from where the drawing puts it, from
 * `min` (its left side at the grid's left edge) to `max` (its right side at the right edge).
 */
export function roomOf(drawing, W = 12) {
  const rows = [...drawing.front, ...drawing.back].filter(row => /\S/.test(row));
  return { min: -Math.min(...rows.map(row => row.search(/\S/))), max: W - 1 - Math.max(...rows.map(row => row.trimEnd().length - 1)) };
}

// Its own minute in each block after its birth, up to `end`, outside downtime.
function wanderTimes(log, end) {
  const BLOCK = WANDER_H * HOUR, out = [];
  for (let k = Math.floor(log.born / BLOCK); k * BLOCK <= end; k++) {
    const t = k * BLOCK + (hash(log.born, 12, k) % (WANDER_H * 60)) * MINUTE;
    if (t <= log.born || t > end || (log.outages ?? []).some(o => t >= o.start && t < o.end)) continue;
    out.push({ t, why: 'wander', key: k });
  }
  return out;
}

// At the same moment, the ice comes first, then a feed, then its own minute.
const ORDER = { ice: 0, food: 1, wander: 2 };

/**
 * The moves of the rock with this log, from its birth up to `end` (now, or the moment it died),
 * drawn from `drawing`: for each, `at`, when; `from` and `to`, offsets from where the drawing
 * puts it; and `why`: 'wander', 'food' or 'ice'.
 */
export function movesOf(log, end, drawing) {
  const { min, max } = roomOf(drawing), spots = max - min + 1;
  if (!(spots >= 2)) throw new Error('a drawing must leave it room to move');
  const events = [
    ...iceTimes(log.born, end, log.outages ?? []).map(t => ({ t, why: 'ice', key: Math.floor(t / DAY) })),
    ...log.visits.filter(v => v.t <= end && v.acts.some(([verb]) => verb === 'feed')).map(v => ({ t: v.t, why: 'food', key: v.t })),
    ...wanderTimes(log, end),
  ].sort((a, z) => a.t - z.t || ORDER[a.why] - ORDER[z.why]);
  const stateAt = replayer(log), moves = [];
  let spot = -min, at = null;
  let iced = -Infinity, spent = null, fed = null; // resting until this midnight; the block whose chance it has had; its latest feed
  for (const e of events) {
    if (e.why === 'food') fed = e.t;
    const block = Math.floor(e.t / (WANDER_H * HOUR));
    if (e.why !== 'ice') { // the ice moves it whatever else; the rest needs its chance, and to find it free
      if (block === spent || e.t < iced || (at !== null && activeElapsed(log, at, e.t) < REST_MS)) continue;
      if (e.why === 'wander' && fed !== null && activeElapsed(log, fed, e.t) < MEAL_MS) continue; // it is eating
    }
    const s = stateAt(e.t);
    if (s.dead) break;
    let to;
    if (e.why === 'ice') to = (spot + 1 + (hash(log.born, 5, e.key) % (spots - 1))) % spots;
    else {
      if (inDanger(s)) continue;
      spent = block;
      to = hash(log.born, e.why === 'food' ? 11 : 10, e.key) % spots;
    }
    if (to === spot) continue;
    moves.push({ at: e.t, from: min + spot, to: min + to, why: e.why });
    [spot, at] = [to, e.t];
    if (e.why === 'ice') iced = (Math.floor(e.t / DAY) + 1) * DAY;
  }
  return moves;
}

/**
 * Where the rock with this log is at `end` (now, or the moment it died), drawn from `drawing`:
 * `dx`, its offset from where the drawing puts it; `from`, the offset it last moved from, or
 * null if it never has; `at`, when; and `why`: 'wander', 'food' or 'ice'.
 */
export function whereAt(log, end, drawing) {
  const last = movesOf(log, end, drawing).at(-1);
  return last ? { dx: last.to, from: last.from, at: last.at, why: last.why } : { dx: 0, from: null, at: null, why: null };
}

/**
 * Whether the furrow of its last move still shows at `now`: for an hour of its life after a
 * wander or a walk to its food, and for the rest of that UTC day after the ice.
 */
export function furrowShows(log, place, now) {
  if (place.from === null) return false;
  return place.why === 'ice' ? Math.floor(now / DAY) === Math.floor(place.at / DAY) : activeElapsed(log, place.at, now) < FURROW_MS;
}
