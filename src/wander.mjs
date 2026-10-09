// Where it is (CHARACTER.md, "Where it is"): it moves along its ground about once in four hours,
// to its food if it has just been fed and on its own otherwise, and on a few winter mornings it
// slides on the ice (character.mjs). The owner's call (2026-10-08): "the pet should wander around
// the screen even without food. not nonstop, just regularly." It all follows from the log and the
// clock, so everyone sees it in the same place at the same moment. It is only drawn: nothing here
// changes the rock.
//
//   its spot     each four hours of UTC time has one, sometimes where it already is, and the
//                first of these to find it free takes it there, so it moves once in them at most
//     a feed       and its food falls there: however often it is fed, and whenever, that is
//                  where it goes
//     wandering    at a minute of its own, unless it is eating (meal.mjs): it doesn't wander off
//                  from its food
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
  for (let k = Math.floor((log.checkpoint?.engine.t ?? log.born) / BLOCK); k * BLOCK <= end; k++) {
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
  return motionAt(log, end, drawing).moves;
}

// On a compacted log, moves includes the last archived move and the new ones.
export function motionAt(log, end, drawing) {
  const { min, max } = roomOf(drawing), spots = max - min + 1;
  if (!(spots >= 2)) throw new Error('a drawing must leave it room to move');
  const events = [
    ...iceTimes(log.born, end, log.outages ?? []).map(t => ({ t, why: 'ice', key: Math.floor(t / DAY) })),
    ...log.visits.filter(v => v.t <= end && v.acts.some(([verb]) => verb === 'feed')).map(v => ({ t: v.t, why: 'food', key: Math.floor(v.t / (WANDER_H * HOUR)) })),
    ...wanderTimes(log, end),
  ].filter(e => !log.checkpoint || e.t > log.checkpoint.engine.t).sort((a, z) => a.t - z.t || ORDER[a.why] - ORDER[z.why]);
  const stateAt = replayer(log), moves = [];
  let spot = -min, at = null;
  let iced = -Infinity, fed = null; // resting until this midnight; its latest feed
  if (log.checkpoint) {
    ({ spot, at, iced, fed } = log.checkpoint.motion);
    iced ??= -Infinity;
    if (log.checkpoint.motion.last) moves.push({ ...log.checkpoint.motion.last });
  }
  for (const e of events) {
    if (e.why === 'food') fed = e.t;
    if (e.why !== 'ice') { // the ice moves it whatever else; anything else has to find it free
      if (e.t < iced || (at !== null && activeElapsed(log, at, e.t) < REST_MS)) continue;
      if (e.why === 'wander' && fed !== null && activeElapsed(log, fed, e.t) < MEAL_MS) continue; // it is eating
    }
    // Where it would go: on the ice anywhere else; otherwise its four hours' spot, whichever takes it
    // there. Once it is there, nothing more in those hours can move it.
    const to = e.why === 'ice' ? (spot + 1 + (hash(log.born, 5, e.key) % (spots - 1))) % spots : hash(log.born, 10, e.key) % spots;
    if (to === spot) continue;
    const s = stateAt(e.t);
    if (s.dead) break;
    if (e.why !== 'ice' && inDanger(s)) continue;
    moves.push({ at: e.t, from: min + spot, to: min + to, why: e.why });
    [spot, at] = [to, e.t];
    if (e.why === 'ice') iced = (Math.floor(e.t / DAY) + 1) * DAY;
  }
  return { moves, spot, at, iced: Number.isFinite(iced) ? iced : null, fed, last: moves.at(-1) ?? null };
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
