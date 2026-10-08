// The ground around the rock: its personality (personality.mjs), drawn. Each care wears its own
// trace into the ground, as large as that care's weighted share stands above the least-given
// care's. So a balanced rock's ground stays bare; a rock given more of one care shows one trace;
// a rock given more of two shows both, half as large. Those are the triangle's seven blends, and
// the same rule draws every shade between them (CHARACTER.md, "Its ground"). It is only drawn:
// nothing here changes the rock.
//
//   feed   it settles into sand: at its foot, then over the corners of its base, then over the
//          whole base, with only its marks and moss showing through
//   clean  a raked floor in front of it: a line under it, then two lines across the ground, then
//          three, the way a dry garden's gravel is raked in lines (the owner's choice, 2026-10-08)
//   pet    footprints worn up to its front: 2, 3 or 5. Where they cross the raked floor they step
//          on a stone, the way a garden's stepping stones keep feet off its raking.

import { addCare, CARE_AXES, DAILY_CARE } from './personality.mjs';
import { HOUR } from './engine.mjs';
import { activeElapsed } from './outages.mjs';

const DAY = 24 * HOUR;

/** The ground fills in over the rock's first two weeks, so no early habit stamps it at once. */
export const FORMING_DAYS = 14;
/**
 * How far a care's share must stand above the least-given care's for levels 1, 2 and 3. The
 * first sits above what the act line's own suggestion leaves when it is followed every 3 to 10
 * hours (the pets that make up for messes and hunger lift petting's share a little), so a rock
 * kept that way reads as even-tempered (CHARACTER.md, "Its ground").
 */
export const LEVELS_AT = [0.3, 0.45, 0.6];
/**
 * Worn ground fades slowly: a level, once reached, holds until its trace falls this far below
 * it. Care that settles right on a level would otherwise flicker its trace on and off. When every
 * visit sends what the act line suggests, a trace that has reached a level dips under it by
 * 0.0074 at most (review round 3: ten routines, from busy minutes to once a day); 0.02 covers
 * that with room, and lets a past habit fade within weeks of where it would without it. Mixed
 * care can drift further, but slowly, over weeks, and the ground follows it.
 */
export const FADE = 0.02;
/** Footprints at each level of petting. */
export const STEPS = [0, 2, 3, 5];
/**
 * Where footprints fall, nearest the rock first, moved as the rock has moved. The same cells
 * for every drawing; they keep off the first fourteen mess spots (screen.mjs), wherever it is.
 */
export const FOOTPRINTS = [[6, 3], [7, 4], [8, 3], [9, 4], [10, 3]];

// The grid row of the rock's base: screen.mjs draws the rock's box at rows 1-5.
const BASE = 5;
// How far the ground has grown after `lived` ms of life: to full at FORMING_DAYS.
const grownBy = lived => Math.min(1, lived / (FORMING_DAYS * DAY));

/**
 * How strongly each care shows, 0-1, from lifetime care totals (careTotals in personality.mjs):
 * its weighted share above the least-given care's. That is the personality blend again: the
 * favourite care's is its corner weight plus half its pair weight, the next one's is half the
 * pair weight, the least-given care's is 0, and the center weight is bare ground. The shares are
 * personality()'s, worked the same way step for step but without the rest of its profile, since
 * groundAt needs them after every visit (test/ground.test.mjs holds them bit for bit). Like
 * personality(), it refuses totals that are not finite and non-negative.
 */
export function tracesOf(care) {
  const zero = { feed: 0, clean: 0, pet: 0 };
  if (!care) return zero;
  for (const key of CARE_AXES) if (!Number.isFinite(care[key]) || care[key] < 0) throw new Error(`invalid ${key} care total`);
  const equivalents = CARE_AXES.map(key => care[key] / DAILY_CARE[key]);
  const scale = Math.max(...equivalents);
  if (!scale) return zero;
  const sum = equivalents.reduce((n, e) => n + e / scale, 0);
  const shares = equivalents.map(e => e / scale / sum), least = Math.min(...shares);
  return Object.fromEntries(CARE_AXES.map((key, i) => [key, shares[i] - least]));
}

/**
 * The ground's three levels, 0-3, for care totals given always in the same proportions, after
 * `lived` ms of life. (A real rock's care changes as it goes; groundAt follows it.)
 */
export function groundOf(care, lived) {
  const traces = tracesOf(care), grown = grownBy(lived);
  const level = trace => LEVELS_AT.filter(at => trace * grown >= at).length;
  return { feed: level(traces.feed), clean: level(traces.clean), pet: level(traces.pet) };
}

/**
 * The ground of the rock with this log at `end` (now, or its death), following its care visit
 * by visit: a level comes when its trace reaches it, and goes when the trace falls FADE below
 * it. The traces grow with the time it has lived, verified downtime excluded, as moss does.
 */
export function groundAt(log, end) {
  const ground = { feed: 0, clean: 0, pet: 0 };
  let care = { feed: 0, clean: 0, pet: 0 }, traces = tracesOf(care);
  const settle = t => {
    const grown = grownBy(activeElapsed(log, log.born, t));
    for (const k of CARE_AXES) {
      const trace = traces[k] * grown;
      while (ground[k] < LEVELS_AT.length && trace >= LEVELS_AT[ground[k]]) ground[k]++;
      while (ground[k] > 0 && trace < LEVELS_AT[ground[k] - 1] - FADE) ground[k]--;
    }
  };
  for (const visit of log.visits) {
    if (visit.t > end) break;
    // Between visits a trace only grows (with the time lived), so it is at its highest just
    // before the next one: settle there, then after the visit's care.
    settle(visit.t);
    care = addCare(care, visit.acts);
    traces = tracesOf(care);
    settle(visit.t);
  }
  settle(end);
  return ground;
}

/**
 * Draw `ground` into the grid `g` (rows of single characters) around a rock drawn from `rows`
 * (its drawing's front or back), `dx` columns from where it began. Call it after the rock and
 * before its trail and the messes, which lie on top. It draws on bare cells, with two
 * exceptions: sand covers the outline of the rock's base (its corners, then all of it; marks
 * and moss there still show), and a footprint on the raked floor becomes a stone.
 */
export function drawGround(g, ground, rows, dx) {
  const W = g[BASE].length;
  const base = rows[4], left = base.search(/\S/) + dx, right = base.trimEnd().length - 1 + dx;
  const bare = (r, c) => c >= 0 && c < W && g[r][c] === ' ';
  // Where the base's own outline still shows, not a mark or moss.
  const outline = c => c >= 0 && c < W && base[c - dx] !== ' ' && g[BASE][c] === base[c - dx];
  if (ground.feed >= 1) for (const c of [left - 1, right + 1]) if (bare(BASE, c)) g[BASE][c] = '.';
  if (ground.feed >= 2) {
    for (let c = 0; c < W; c++) if (bare(BASE, c)) g[BASE][c] = '.';
    for (const c of [left, right]) if (outline(c)) g[BASE][c] = '.';
  }
  if (ground.feed >= 3) for (let c = left; c <= right; c++) if (outline(c)) g[BASE][c] = '.';
  // One raked line for each level of cleaning: the first under it, then across the ground.
  const [from, to] = ground.clean >= 2 ? [0, W - 1] : [left, right];
  for (let line = 1; line <= ground.clean; line++) for (let c = from; c <= to; c++) if (bare(BASE + line, c)) g[BASE + line][c] = '-';
  for (const [r, col] of FOOTPRINTS.slice(0, STEPS[ground.pet])) {
    const c = col + dx;
    if (g[r][c] === ' ') g[r][c] = ':';
    else if (g[r][c] === '-') g[r][c] = 'o';
  }
}
