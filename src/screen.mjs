// The Rock Pet screen: a 12x12 grid (the picture) and named lines (the information). An agent's
// fetch tool may pass the page through a summarizing model that shifts columns and drops blank
// lines, so every number needed to act is in the named lines; the grid only has to look right.

import { RULES as R } from './rules.mjs';
import { HOUR, ceilingOf } from './engine.mjs';
import { placeAt, weatherAt } from './character.mjs';

export const W = 12; // the grid is W x W

// Where the k-th visible mess lies, [row, col] from 0. Row 0 holds the numbers and rows 1-5
// the rock, so messes keep to the ground below it. The first three are the DESIGN-NOTES mocks.
export const MESS_SPOTS = [
  [7, 8], [7, 2], [8, 5], [9, 9], [10, 1], [6, 11], [10, 6], [11, 10],
  [8, 0], [11, 3], [9, 11], [6, 0], [11, 7], [8, 10], [9, 4], [11, 0],
];

// Shown values are rounded, but an extreme (hunger 10, happiness -10) shows only while the stat
// is truly there, since that is when its 48h clock runs.
export const shownHunger = s => (s.starvingSince !== null ? 10 : Math.min(9, Math.round(s.hunger)));
export const shownHappy = s => (s.sorrowSince !== null ? -10 : Math.max(-9, Math.round(s.happy)) || 0);

/** The rock's eyes follow its mood. In death the face goes: it is a stone again. */
export function eyes(s) {
  if (s.dead) return '    ';
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

// The rock: a lump with a flat base, in a box of 5 rows across the grid's width, drawn at rows
// 1-5 (the box's first row is the air above it, where things settle). Marks are [row, col] in the
// box: the first three veins (close calls); grit, one more mark for each level; moss by level.
const VEINS = [[2, 5, '/'], [4, 7, '/'], [2, 8, '/']];
const GRIT = [[1, 8, '.'], [1, 2, "'"], [0, 5, ',']];
const MOSS = [[[0, 4], [0, 6], [1, 2], [1, 8]], [[0, 5], [1, 3], [1, 9]], [[1, 7], [3, 1], [3, 10]]];

/** The rock's box, 5 rows of W characters. Facing the wall (pose 'away'), it is mirrored and shows no face. */
export function sprite(s, now, pose = 'front') {
  const b = Array.from({ length: 5 }, () => Array(W).fill(' '));
  const put = (row, col, text) => { for (let i = 0; i < text.length; i++) b[row][col + i] = text[i]; };
  put(1, 4, '___');
  put(2, 2, '_/   \\__');
  put(3, 1, `/  ${pose === 'away' ? '    ' : eyes(s)}  \\`);
  put(4, 1, '\\________/');
  for (const [row, col, mark] of VEINS.slice(0, s.closeCalls)) b[row][col] = mark;
  const { grit, moss } = weatherAt(s, now);
  for (const [row, col, mark] of GRIT.slice(0, grit)) b[row][col] = mark;
  for (const level of MOSS.slice(0, moss)) for (const [row, col] of level) b[row][col] = ',';
  const flip = { '/': '\\', '\\': '/' };
  if (pose === 'away') for (const row of b) row.reverse().forEach((c, i) => { row[i] = flip[c] ?? c; });
  return b.map(row => row.join(''));
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

/**
 * The whole screen for state `s` (from replay) as seen at `now`, ending in a newline. `pose` is
 * 'away' only for a look on its day for facing the wall (story.mjs says so on the screen).
 */
export function render(s, { now, host, pose = 'front' }) {
  const g = Array.from({ length: W }, () => Array(W).fill(' '));
  const put = (row, col, text) => { for (let i = 0; i < text.length; i++) g[row][col + i] = text[i]; };
  const hunger = String(shownHunger(s)), happy = String(shownHappy(s));
  if (s.dead) put(0, 0, `died: ${s.dead.cause}`);
  else { put(0, 0, hunger); put(0, W - happy.length, happy); }
  // Where it has sailed to (it stops when it dies), and on the day it moved, its trail.
  const { col: dx, from } = placeAt(s.born, s.dead ? s.dead.t : now);
  sprite(s, now, pose).forEach((row, r) => { for (let c = 0; c < W; c++) if (row[c] !== ' ') g[1 + r][c + dx] = row[c]; });
  if (!s.dead && from !== null) {
    if (dx > from) for (let c = 0; c <= dx; c++) g[5][c] = '.';
    else for (let c = W - 1 + dx; c < W; c++) g[5][c] = '.';
  }
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
