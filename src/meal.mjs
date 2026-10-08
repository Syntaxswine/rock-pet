// Its meals (CHARACTER.md, "Its meals"): for an hour after someone feeds it, its food lies beside
// it and it eats, its mouth opening and shutting. The owner's idea (2026-10-08). It is only drawn:
// nothing here changes the rock.
//
//   the food    #, then + for the second half hour, then gone
//   its mouth   the end of its face row, open toward the food in the meal's even minutes and shut
//               in its odd ones, so the reply to a feed always shows it open
//
// An agent sees one frame per request, so a meal plays out across looks: on a busy rock, looks a
// few minutes apart catch it chewing. Every feed starts one, whatever the feed did: a rock that was
// not hungry still eats what it is given. The hour is time it has lived, so verified host downtime
// pauses a meal, as it pauses moss.

import { HOUR } from './engine.mjs';
import { activeElapsed } from './outages.mjs';

const MINUTE = 60_000;
/** How long a meal lasts, in time the rock has lived. */
export const MEAL_MS = HOUR;
/**
 * The food as the meal goes: whole, then half. Not `=` or `-`, which beside its mouth would read
 * as `<=` and `<-`, arrows and operators to a language model; and not `.`, which is sand's, and a
 * faint outline's.
 */
export const FOOD = ['#', '+'];

/**
 * The meal it is eating at `now`, from its log: `food`, the food as it is by then, and `open`,
 * whether its mouth is open; or null when no feed has come within the hour.
 */
export function mealAt(log, now) {
  for (let i = log.visits.length - 1; i >= 0; i--) {
    const v = log.visits[i];
    if (v.t > now) continue;
    const ms = activeElapsed(log, v.t, now);
    if (ms >= MEAL_MS) return null;
    if (v.acts.some(([verb]) => verb === 'feed')) return { food: FOOD[Math.floor((ms * FOOD.length) / MEAL_MS)], open: Math.floor(ms / MINUTE) % 2 === 0 };
  }
  return null;
}

/**
 * Draw `meal` into the grid `g` beside a rock drawn from `rows` (its drawing's front or back, as
 * the screen drew it), `dx` columns from where it began, with its eyes on row `eyes` of its box.
 * The food goes just past the end of that row: on its right where the grid has room, else on its
 * left (only a rock that has moved right can lack room there). While the mouth is open and its
 * face shows, the end of the row on that side becomes its mouth, opening toward the food. Call it
 * after the rock is drawn. The food's cell is always bare: nothing else is drawn on that row
 * outside the rock but moss, and a meal means a visit within the hour, which brushed it off.
 */
export function drawMeal(g, meal, rows, eyes, dx, pose) {
  const r = 1 + eyes, row = rows[eyes], W = g[r].length;
  const right = row.trimEnd().length - 1 + dx, onRight = right + 1 < W;
  const end = onRight ? right : row.search(/\S/) + dx;
  g[r][onRight ? end + 1 : end - 1] = meal.food;
  if (meal.open && pose !== 'away') g[r][end] = onRight ? '<' : '>';
}
