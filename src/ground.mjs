// The ground around the rock: its personality (personality.mjs), drawn. Each care wears its own
// trace into the ground, as large as that care's weighted share stands above the least-given
// care's. So a balanced rock's ground stays bare; a rock given more of one care shows one trace;
// a rock given more of two shows both, half as large. Those are the triangle's seven blends, and
// the same rule draws every shade between them (CHARACTER.md, "Its ground"). It is only drawn:
// nothing here changes the rock.
//
//   feed   it settles into soft sand: at its foot, then along its base, then over its base, with
//          only its marks and moss showing through
//   clean  a raked floor in front of it: under it, then the whole row, then raked deeper
//   pet    footprints worn up to its front: 2, 3 or 5. Where they cross the raked floor they step
//          on a stone, the way a garden's stepping stones keep feet off its raking.

import { personality } from './personality.mjs';
import { HOUR } from './engine.mjs';

/** The ground fills in over the rock's first two weeks, so no early habit stamps it at once. */
export const FORMING_DAYS = 14;
/** How far a care's share must stand above the least-given care's for levels 1, 2 and 3. */
export const LEVELS_AT = [0.12, 0.35, 0.6];
/** Footprints at each level of petting. */
export const STEPS = [0, 2, 3, 5];

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
 * Its ground as three levels, 0-3, from its lifetime care totals at `age` ms old; a grave's age
 * stops at its death. No totals, or no care yet, is bare ground.
 */
export function groundOf(care, age) {
  const traces = tracesOf(care);
  const grown = Math.min(1, age / (FORMING_DAYS * 24 * HOUR));
  const level = trace => LEVELS_AT.filter(at => trace * grown >= at).length;
  return { feed: level(traces.feed), clean: level(traces.clean), pet: level(traces.pet) };
}

/**
 * Draw `ground` into the grid `g` (rows of single characters) around a rock drawn from `rows`
 * (its drawing's front or back), `dx` columns from where it began. Call it after the rock and
 * before its trail and the messes, which lie on top. It draws only on bare cells, except that
 * deep sand covers the outline of the rock's base; marks and moss there still show.
 */
export function drawGround(g, ground, rows, dx) {
  const W = g[BASE].length;
  const base = rows[4], left = base.search(/\S/) + dx, right = base.trimEnd().length - 1 + dx;
  const bare = (r, c) => c >= 0 && c < W && g[r][c] === ' ';
  if (ground.feed >= 1) for (const c of [left - 1, right + 1]) if (bare(BASE, c)) g[BASE][c] = '.';
  if (ground.feed >= 2) for (let c = 0; c < W; c++) if (bare(BASE, c)) g[BASE][c] = '.';
  if (ground.feed >= 3) {
    for (let c = 0; c < W; c++) {
      const own = base[c - dx] ?? ' ';
      if (own !== ' ' && g[BASE][c] === own) g[BASE][c] = '.';
    }
  }
  const rake = ground.clean >= 3 ? '=' : '-';
  const [from, to] = ground.clean >= 2 ? [0, W - 1] : [left, right];
  if (ground.clean >= 1) for (let c = from; c <= to; c++) if (bare(BASE + 1, c)) g[BASE + 1][c] = rake;
  for (let i = 0; i < STEPS[ground.pet]; i++) {
    const r = BASE + 1 + i, c = left + (i % 2 ? 1 : 2);
    if (g[r][c] === ' ') g[r][c] = ':';
    else if (g[r][c] === '-' || g[r][c] === '=') g[r][c] = 'o';
  }
}
