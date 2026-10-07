// The Rock Pet screen: a 12x12 grid (the picture) and named lines (the information). An agent's
// fetch tool may pass the page through a summarizing model that shifts columns and drops blank
// lines, so every number needed to act is in the named lines; the grid only has to look right.

import { RULES as R } from './rules.mjs';
import { HOUR, ceilingOf } from './engine.mjs';

export const W = 12; // the grid is W x W

// Where the k-th visible mess lies, [row, col] from 0. Row 0 holds the numbers and rows 3-5
// the rock, so messes keep to the ground below it. The first three are the DESIGN-NOTES mocks.
export const MESS_SPOTS = [
  [7, 8], [7, 2], [8, 5], [9, 9], [10, 1], [6, 11], [10, 6], [11, 10],
  [8, 0], [11, 3], [9, 11], [6, 0], [11, 7], [8, 10], [9, 4], [11, 0],
];

// Shown values are rounded, but an extreme (hunger 10, happiness -10) shows only while the stat
// is truly there, since that is when its 48h clock runs.
export const shownHunger = s => (s.starvingSince !== null ? 10 : Math.min(9, Math.round(s.hunger)));
export const shownHappy = s => (s.sorrowSince !== null ? -10 : Math.max(-9, Math.round(s.happy)) || 0);

/** The rock's eyes follow its mood. */
export function eyes(s) {
  if (s.dead) return 'x  x';
  if (s.sorrowSince !== null) return 'T  T';
  if (s.happy < -5) return ';  ;';
  if (s.happy < 0) return '-  -';
  if (s.happy < 5) return 'o  o';
  return '^  ^';
}

/**
 * The body for a full visit right now: the fewest feeds and pets after which the screen reads
 * hunger 0 and happy 10 (shown values round, so under 0.5 and from 9.5), and a clean if there
 * is a mess (which lifts the ceiling to 10). Empty when nothing is needed. Counted forward with
 * the engine's own arithmetic, so float rounding cannot leave it one short.
 */
export function fullCare(s) {
  let feeds = 0, pets = 0;
  while (Math.max(0, s.hunger - R.feed * feeds) >= 0.5) feeds++;
  while (Math.min(10, s.happy + R.pet * pets) < 9.5) pets++;
  const words = [];
  if (feeds > 0) words.push(feeds > 1 ? `feed x${feeds}` : 'feed');
  if (s.messes > 0) words.push('clean');
  if (pets > 0) words.push(pets > 1 ? `pet x${pets}` : 'pet');
  return words.join(' ');
}

// 3d, 6h, 12m: the largest whole unit.
function span(ms) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m >= 1440) return `${Math.floor(m / 1440)}d`;
  if (m >= 60) return `${Math.floor(m / 60)}h`;
  return `${m}m`;
}
const hours = ms => Math.max(0, Math.floor(ms / HOUR));
const iso = t => new Date(t).toISOString();

/** The whole screen for state `s` (from replay) as seen at `now`, ending in a newline. */
export function render(s, { now, host }) {
  const g = Array.from({ length: W }, () => Array(W).fill(' '));
  const put = (row, col, text) => { for (let i = 0; i < text.length; i++) g[row][col + i] = text[i]; };
  const hunger = String(shownHunger(s)), happy = String(shownHappy(s));
  if (s.dead) put(0, 0, `died: ${s.dead.cause}`);
  else { put(0, 0, hunger); put(0, W - happy.length, happy); }
  put(3, 3, '.----.');
  put(4, 2, `( ${eyes(s)} )`);
  put(5, 3, "'----'");
  for (const [row, col] of MESS_SPOTS.slice(0, s.messes)) g[row][col] = '@';
  const lines = g.map(row => row.join('').trimEnd());

  const ago = t => (t === null ? 'never' : now - t < 60_000 ? 'just now' : `${span(now - t)} ago`);
  if (s.dead) {
    lines.push(`age ${span(s.dead.t - s.born)}  died ${iso(s.dead.t).slice(0, 10)} ${iso(s.dead.t).slice(11, 16)}Z`);
    lines.push(`last care ${ago(s.lastCare)}  it does not stir`);
  } else {
    const max = s.messes > 0 ? ` (max ${ceilingOf(s.messes)})` : '';
    const mess = s.messes > 0 ? `mess ${s.messes} (@)` : 'mess 0';
    lines.push(`hunger ${hunger}/10 (10=starving)  happy ${happy}${max}  ${mess}`);
    if (s.sorrowSince !== null) lines.push(`sorrow: at -10 for ${hours(now - s.sorrowSince)}h of ${R.graceH}`);
    if (s.starvingSince !== null) lines.push(`hunger: at 10 for ${hours(now - s.starvingSince)}h of ${R.graceH}`);
    lines.push(`age ${span(now - s.born)}  now ${iso(now).slice(11, 16)}Z  last care ${ago(s.lastCare)}`);
    const care = fullCare(s);
    lines.push(`act: POST ${host}/act  ${care ? `body e.g. ${care}` : 'nothing needed now (verbs: feed clean pet)'}`);
  }
  return lines.join('\n') + '\n';
}
