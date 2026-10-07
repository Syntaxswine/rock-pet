// The marks a life leaves on the rock (CHARACTER.md, "The marks"), from its state and the clock:
// moss, which comes and goes, and veins, polish and crystals, which it keeps. The screen draws
// them and /history counts them. Nothing here changes the rock.

import { HOUR } from './engine.mjs';
import { RULES as R } from './rules.mjs';
import { activeElapsed } from './outages.mjs';

const DAY = 24 * HOUR;

/**
 * How much moss is on it, 0-6. A rolling stone gathers no moss; a stone left alone does.
 * - While it lives, moss starts 12h after anyone last came, spreads at a day, and covers its top
 *   at two. It cannot live a third. Any visit brushes it off. Verified host downtime (`outages`,
 *   from the log) pauses it, as it pauses everything else about the rock.
 * - A grave keeps what it had, and after a week, a month and a season the moss creeps further,
 *   down its sides.
 */
export function mossAt(s, now, outages = []) {
  const alone = (from, to) => {
    const ms = activeElapsed({ outages }, from, to);
    return ms >= 48 * HOUR ? 3 : ms >= 24 * HOUR ? 2 : ms >= 12 * HOUR ? 1 : 0;
  };
  const last = s.lastCare ?? s.born;
  if (!s.dead) return alone(last, now);
  const d = now - s.dead.t;
  return Math.max(alone(last, s.dead.t), d >= 90 * DAY ? 6 : d >= 30 * DAY ? 5 : d >= 7 * DAY ? 4 : 0);
}

/** Where marks begin: points of happiness given by petting, and meals (one feed's worth of hunger). */
export const POLISH_AT = [500, 3000];
export const CRYSTALS_AT = [100, 500];

/**
 * The marks of a long life, which never go:
 * - `veins`: one for each close call, up to the three a drawing has room for;
 * - `polish`: hands polish stone, so a little after 500 points of happiness given by petting,
 *   more after 3,000;
 * - `crystals`: what it is fed seeps in and crystallizes in a hollow, so one after 100 meals,
 *   two after 500.
 * Also `meals`, for /history.
 */
export function marksOf(s) {
  const meals = s.fed / R.feed;
  const level = (n, at) => at.filter(x => n >= x).length;
  return { veins: Math.min(3, s.closeCalls), polish: level(s.petted, POLISH_AT), crystals: level(meals, CRYSTALS_AT), meals };
}
