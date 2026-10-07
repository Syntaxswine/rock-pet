// The ground around the rock: its personality (personality.mjs), drawn. Each care wears its own
// trace into the ground, as large as that care's weighted share stands above the least-given
// care's. So a balanced rock's ground stays bare; a rock given more of one care shows one trace;
// a rock given more of two shows both, half as large. Those are the triangle's seven blends, and
// the same rule draws every shade between them (CHARACTER.md, "Its ground"). It is only drawn:
// nothing here changes the rock.
//
//   feed   it settles into sand: at its foot, then over the corners of its base, then over the
//          whole base, with only its marks and moss showing through
//   clean  a raked floor in front of it: under it, then the whole row, then raked deeper
//   pet    footprints worn up to its front: 2, 3 or 5. Where they cross the raked floor they step
//          on a stone, the way a garden's stepping stones keep feet off its raking.

import { personality } from './personality.mjs';
import { HOUR } from './engine.mjs';

const DAY = 24 * HOUR;

/** The ground fills in over the rock's first two weeks, so no early habit stamps it at once. */
export const FORMING_DAYS = 14;
/**
 * How far a care's share must stand above the least-given care's for levels 1, 2 and 3. The
 * first sits above what the act line's own suggestion leaves when it is followed every few hours
 * (the pets that make up for messes and hunger lift petting's share a little), so a dutifully
 * kept rock reads as even-tempered (CHARACTER.md, "Its ground").
 */
export const LEVELS_AT = [0.3, 0.45, 0.6];
/** Footprints at each level of petting. */
export const STEPS = [0, 2, 3, 5];
/**
 * Where footprints fall, nearest the rock first, moved as the rock has moved. The same cells
 * for every drawing; they keep off the first fourteen mess spots (screen.mjs), wherever it is.
 */
export const FOOTPRINTS = [[6, 3], [7, 4], [8, 3], [9, 4], [10, 3]];

// The grid row of the rock's base: screen.mjs draws the rock's box at rows 1-5.
const BASE = 5;

/**
 * How strongly each care shows, 0-1, from lifetime care totals (careTotals in personality.mjs):
 * its weighted share above the least-given care's. That is the personality blend again: the
 * favourite care's is its corner weight plus half its pair weight, the next one's is half the
 * pair weight, the least-given care's is 0, and the center weight is bare ground.
 */
export function tracesOf(care) {
  const p = care ? personality(care) : null;
  if (!p?.formed) return { feed: 0, clean: 0, pet: 0 };
  const least = Math.min(p.shares.feed, p.shares.clean, p.shares.pet);
  return { feed: p.shares.feed - least, clean: p.shares.clean - least, pet: p.shares.pet - least };
}

/**
 * Its ground as three levels, 0-3, from its lifetime care totals after `lived` ms of life (the
 * time it has lived through, so verified downtime doesn't count, as for moss; a grave's stops at
 * its death). No totals, or no care yet, is bare ground.
 */
export function groundOf(care, lived) {
  const traces = tracesOf(care);
  const grown = Math.min(1, lived / (FORMING_DAYS * DAY));
  const level = trace => LEVELS_AT.filter(at => trace * grown >= at).length;
  return { feed: level(traces.feed), clean: level(traces.clean), pet: level(traces.pet) };
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
  const rake = ground.clean >= 3 ? '=' : '-';
  const [from, to] = ground.clean >= 2 ? [0, W - 1] : [left, right];
  if (ground.clean >= 1) for (let c = from; c <= to; c++) if (bare(BASE + 1, c)) g[BASE + 1][c] = rake;
  for (const [r, col] of FOOTPRINTS.slice(0, STEPS[ground.pet])) {
    const c = col + dx;
    if (g[r][c] === ' ') g[r][c] = ':';
    else if (g[r][c] === '-' || g[r][c] === '=') g[r][c] = 'o';
  }
}
