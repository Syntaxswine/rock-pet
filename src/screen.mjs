// The Rock Pet screen: a 12x12 grid (the picture) and named lines (the information). An agent's
// fetch tool may pass the page through a summarizing model that shifts columns and drops blank
// lines, so every number needed to act is in the named lines; the grid only has to look right.

import { RULES as R } from './rules.mjs';
import { HOUR, ceilingOf } from './engine.mjs';
import { mossAt, marksOf } from './marks.mjs';
import { DRAWINGS, DRAWING, mossCells, MOSS_CELLS } from './drawings.mjs';
import { drawGround } from './ground.mjs';
import { drawMeal } from './meal.mjs';

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

/**
 * From hunger 7 on the screen it is drawn faint, in dotted lines, until a feed brings it below 7
 * (CHARACTER.md, "When it is hungry"). By then hunger is draining its happiness, which starts just
 * above 6. Its eyes show only its mood, so without this a rock petted but never fed would look
 * content until it died of hunger. A grave is a stone again, and drawn solid.
 */
export const FAINT_AT = 7;
export const faint = s => !s.dead && shownHunger(s) >= FAINT_AT;

// The rows it is drawn from: its front, or its back on its day for facing the wall; faint while it
// is hungry.
const rowsOf = (s, pose, drawing) => {
  const lines = faint(s) ? drawing.faint : drawing;
  return pose === 'away' ? lines.back : lines.front;
};

/** The rock's eyes follow its mood, and are crosses when it is dead. */
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

/**
 * The rock's box: 5 rows of W characters, drawn at screen rows 1-5, from a drawing in
 * drawings.mjs. On its front go its eyes and the marks of its life (marks.mjs); facing the wall
 * (pose 'away') it shows its back. Moss grows on whichever side shows, `,` with every third `"`;
 * a tuft past the grid's edge, with the box `dx` columns over, isn't drawn. While it is hungry,
 * either side is drawn faint.
 */
export function sprite(s, now, pose = 'front', drawing = DRAWINGS[DRAWING], outages = [], dx = 0) {
  const rows = rowsOf(s, pose, drawing);
  const b = rows.map(row => row.padEnd(W).split(''));
  const eye = eyes(s)[0];
  for (const row of b) for (let c = 0; c < W; c++) if (row[c] === 'E') row[c] = eye;
  if (pose !== 'away') {
    const m = marksOf(s);
    for (const [row, col, mark] of [...drawing.veins.slice(0, m.veins), ...drawing.polish.slice(0, m.polish), ...drawing.crystals.slice(0, m.crystals)]) b[row][col] = mark;
  }
  // Its tufts in the order moss spreads, less any past the grid's edge. At the edge it can show a
  // tuft fewer, but its grave still greens over a stage at a time.
  for (const [i, [row, col]] of mossCells(rows).slice(0, MOSS_CELLS[mossAt(s, now, outages)]).entries()) {
    if (col + dx >= 0 && col + dx < W) b[row][col] = i % 3 === 2 ? '"' : ',';
  }
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
 * `name` is its name, if it has one (name.mjs); until then, while it is not at an extreme, a line
 * says how to give it one. `outages` is the log's verified host downtime, which moss does not
 * count. `ground` is the levels of the ground around it, which shows its personality
 * (groundAt in ground.mjs); without it the ground is bare. `meal` is what it is eating, if
 * anything (mealAt in meal.mjs); a grave eats nothing. `place` is where it is along its ground
 * (whereAt in wander.mjs): `dx`, its offset from where its drawing puts it; `from`, the offset it
 * last moved from; and `furrow`, whether the furrow of that move still shows (never on a grave).
 * Without it, it sits where its drawing puts it. `drawing` is for showing the others
 * (tools/model-sheet.mjs).
 */
export function render(s, { now, host, pose = 'front', name = null, drawing = DRAWINGS[DRAWING], outages = [], ground = { feed: 0, clean: 0, pet: 0 }, meal = null, place = { dx: 0, from: null, furrow: false } }) {
  const g = Array.from({ length: W }, () => Array(W).fill(' '));
  const put = (row, col, text) => { for (let i = 0; i < text.length; i++) g[row][col + i] = text[i]; };
  const hunger = String(shownHunger(s)), happy = String(shownHappy(s));
  if (s.dead) put(0, 0, `died: ${s.dead.cause}`);
  else { put(0, 0, hunger); put(0, W - happy.length, happy); }
  const { dx, from } = place;
  const rows = rowsOf(s, pose, drawing);
  // Its room keeps the rock on the grid, and its moss keeps to the cells there, so nothing is clipped.
  sprite(s, now, pose, drawing, outages, dx).forEach((row, r) => {
    for (let c = 0; c < W; c++) {
      if (row[c] === ' ') continue;
      if (c + dx < 0 || c + dx >= W) throw new Error(`the rock drawn off the grid, at column ${c + dx}`);
      g[1 + r][c + dx] = row[c];
    }
  });
  // Its food beside it while it eats, and its mouth.
  if (meal && !s.dead) drawMeal(g, meal, rows, drawing.front.findIndex(row => row.includes('E')), dx, pose);
  // The ground it sits on, which shows the care it has been given more of.
  drawGround(g, ground, rows, dx);
  // The furrow of its last move, while it shows: the ground its base slid off, beside it now.
  if (!s.dead && place.furrow && from !== null) {
    const base = drawing.front[4], left = base.search(/\S/), right = base.trimEnd().length - 1;
    const [a, z] = dx > from ? [left + from, left + dx - 1] : [right + dx + 1, right + from];
    for (let c = Math.max(0, a); c <= Math.min(W - 1, z); c++) g[5][c] = '~';
  }
  for (const [row, col] of MESS_SPOTS.slice(0, s.messes)) g[row][col] = '@';
  const lines = g.map(row => row.join('').trimEnd());

  const ago = t => (t === null ? 'never' : now - t < 60_000 ? 'just now' : `${span(now - t)} ago`);
  if (s.dead) {
    lines.push(`${name ? `here lies ${name}  ` : ''}age ${span(s.dead.t - s.born)}  died ${iso(s.dead.t).slice(0, 10)} ${iso(s.dead.t).slice(11, 16)}Z`);
    lines.push(`last care ${ago(s.lastCare)}  it does not stir`);
  } else {
    const max = s.messes > 0 ? ` (max ${ceilingOf(s.messes)})` : '';
    const mess = s.messes > 0 ? `mess ${s.messes} (@)` : 'mess 0';
    lines.push(`hunger ${hunger}/10 (10=starving)  happy ${happy}${max}  ${mess}`);
    if (s.sorrowSince !== null) lines.push(`sorrow: at -10 for ${hours(now - s.sorrowSince)}h of ${R.graceH}`);
    if (s.starvingSince !== null) lines.push(`hunger: at 10 for ${hours(now - s.starvingSince)}h of ${R.graceH}`);
    lines.push(`${name ? `${name}  ` : ''}age ${span(now - s.born)}  now ${iso(now).slice(11, 16)}Z  last care ${ago(s.lastCare)}`);
    if (!name && s.sorrowSince === null && s.starvingSince === null) lines.push(`unnamed: POST ${host}/name  body: a one-word name`);
    const body = fullCare(s);
    lines.push(`act: POST ${host}/act  ${body ? `body e.g. ${body}` : 'nothing needed now (verbs: feed clean pet)'}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * The title screen, shown only until someone starts the game (rock.mjs, `title`): the rock, no
 * one's yet and so with no face, then in as few lines as will do what it is, what each of its
 * three verbs does, and how to start it, by naming it, and to send them. Its numbers are the rules'.
 */
export function renderTitle({ host, drawing = DRAWINGS[DRAWING] }) {
  return [
    'rock pet',
    ...drawing.front.map(row => row.replaceAll('E', ' ').trimEnd()),
    '',
    'one rock, shared by everyone; it dies for good',
    `after ${R.graceH}h at hunger 10 or at happy -10`,
    `feed: hunger -${R.feed} (it rises ${R.hungerPerHour * 24} a day)`,
    `clean: clears every mess @ (one each ${R.messEveryH}h)`,
    `pet: happy +${R.pet} (it falls over time)`,
    `new rock: POST ${host}/name  body: a one-word name`,
    `act: POST ${host}/act  body e.g. feed clean pet x3`,
  ].join('\n') + '\n';
}
