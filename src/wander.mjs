// Where it is (CHARACTER.md, "Where it is"): it wanders along its ground on its own, every few
// hours, goes to its food when it is fed, and on a few winter mornings slides on the ice
// (character.mjs). The owner's call (2026-10-08): "the pet should wander around the screen even
// without food. not nonstop, just regularly." It all follows from the log and the clock, so
// everyone sees it in the same place at the same moment. It is only drawn: nothing here changes
// the rock.
//
//   wandering  once in each four hours of UTC time, at a minute of its own, to a spot of its own,
//              which is sometimes where it already is
//   its food   a feed sends it to the spot its food fell on
//   resting    for an hour after it moves, and for the hour after a feed while it eats (meal.mjs),
//              it neither wanders nor goes to its food; then its food falls beside it where it is
//   the ice    a winter morning's slide takes it to another spot, whatever else, and it rests there
//              for the rest of that UTC day, its furrow beside it
//   the edge   at an extreme it doesn't wander or go to its food: only the ice moves it
//   downtime   it doesn't wander while the host is down, when its time doesn't pass
//   a grave    stays where it died
//
// It moves left and right along its ground, not up and down the screen: below it lie its
// personality's traces and its messes.

import { HOUR, statesAt } from './engine.mjs';
import { hash, iceTimes, inDanger } from './character.mjs';

const MINUTE = 60_000, DAY = 24 * HOUR;
/** How often it wanders: once in each block of this many hours, counted from 00:00 UTC. */
export const WANDER_H = 4;
/** How long it rests after it moves. */
export const REST_MS = HOUR;
/** How long the furrow of a wander or a walk to its food shows. The ice's shows all that day. */
export const FURROW_MS = HOUR;

/**
 * Where a drawing can go along a grid `W` wide: offsets from where the drawing puts it, from
 * `min` (its left side at the grid's left edge) to `max` (its right side at the right edge).
 */
export function roomOf(drawing, W = 12) {
  const rows = [...drawing.front, ...drawing.back].filter(row => /\S/.test(row));
  return { min: -Math.min(...rows.map(row => row.search(/\S/))), max: W - 1 - Math.max(...rows.map(row => row.trimEnd().length - 1)) };
}

// When it might wander: a minute in each block after its birth, up to `end`, outside downtime.
function wanderTimes(log, end) {
  const BLOCK = WANDER_H * HOUR, out = [];
  for (let k = Math.floor(log.born / BLOCK); k * BLOCK <= end; k++) {
    const t = k * BLOCK + (hash(log.born, 12, k) % (WANDER_H * 60)) * MINUTE;
    if (t <= log.born || t > end || (log.outages ?? []).some(o => t >= o.start && t < o.end)) continue;
    out.push({ t, why: 'wander', key: k });
  }
  return out;
}

const ORDER = { ice: 0, food: 1, wander: 2 };

/**
 * Where the rock with this log is at `end` (now, or the moment it died), drawn from `drawing`:
 * `dx`, its offset from where the drawing puts it; `from`, the offset it last moved from, or
 * null if it never has; `at`, when; and `why`: 'wander', 'food' or 'ice'.
 */
export function whereAt(log, end, drawing) {
  const { min, max } = roomOf(drawing), spots = max - min + 1;
  const events = [
    ...iceTimes(log.born, end).map(t => ({ t, why: 'ice', key: Math.floor(t / DAY) })),
    ...log.visits.filter(v => v.t <= end && v.acts.some(([verb]) => verb === 'feed')).map(v => ({ t: v.t, why: 'food', key: v.t })),
    ...wanderTimes(log, end),
  ].sort((a, z) => a.t - z.t || ORDER[a.why] - ORDER[z.why]);
  const states = statesAt(log, events.map(e => e.t));
  let spot = -min, from = null, at = null, why = null, rested = -Infinity;
  for (let i = 0; i < events.length; i++) {
    const e = events[i], s = states[i];
    if (s.dead) break;
    let to = spot;
    if (e.why === 'ice') to = (spot + 1 + (hash(log.born, 5, e.key) % (spots - 1))) % spots;
    else if (!inDanger(s) && e.t >= rested) to = hash(log.born, e.why === 'food' ? 11 : 10, e.key) % spots;
    if (to !== spot) {
      [from, spot, at, why] = [spot, to, e.t, e.why];
      rested = e.why === 'ice' ? (Math.floor(e.t / DAY) + 1) * DAY : e.t + REST_MS;
    }
    if (e.why === 'food') rested = Math.max(rested, e.t + REST_MS); // it stays by its food while it eats
  }
  return { dx: min + spot, from: from === null ? null : min + from, at, why };
}

/**
 * Whether the furrow of its last move still shows at `now`: for an hour after a wander or a walk
 * to its food, and for the rest of that UTC day after the ice.
 */
export function furrowShows(place, now) {
  if (place.from === null) return false;
  return place.why === 'ice' ? Math.floor(now / DAY) === Math.floor(place.at / DAY) : now - place.at < FURROW_MS;
}
