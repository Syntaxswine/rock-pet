// The ways the rock can be drawn, for the owner to choose from (CHARACTER.md, "The drawings").
// Each is a box of 5 rows across the 12-column grid, drawn at screen rows 1-5. Its first row is
// the air above the rock, where moss grows.
// - `front`: the rock, with E at each eye.
// - `back`: the rock from behind, for a day it faces the wall.
// - `veins`, `polish`, `crystals`: where each mark of its life goes, [row, col, mark], in order.
// Every drawing keeps to columns 1-10, so a rock that has moved a column either way still fits.

export const DRAWINGS = {
  lump: {
    about: 'a lump with a flat base',
    front: ['', '    ___', '  _/   \\__', ' /  E  E  \\', ' \\________/'],
    back: ['', '     ___', '  __/   \\_', ' /        \\', ' \\________/'],
    veins: [[2, 5, '/'], [4, 7, '/'], [2, 8, '/']], polish: [[3, 2, "'"], [2, 4, "'"]], crystals: [[4, 8, '*'], [4, 3, '*']],
  },
  googly: {
    about: 'googly eyes, the craft-table pet rock',
    front: ['', '    ____', "  .'    '.", ' / (E)(E) \\', ' \\________/'],
    back: ['', '    ____', "  .'    '.", ' /        \\', ' \\________/'],
    veins: [[2, 6, '/'], [4, 7, '/'], [2, 4, '\\']], polish: [[3, 2, "'"], [2, 5, "'"]], crystals: [[4, 8, '*'], [4, 3, '*']],
  },
  boulder: {
    about: 'round and solid',
    front: ['', '   .----.', '  /      \\', ' |  E  E  |', '  \\______/'],
    back: ['', '   .----.', '  /      \\', ' |        |', '  \\______/'],
    veins: [[2, 6, '/'], [4, 5, '/'], [3, 9, '/']], polish: [[2, 4, "'"], [3, 2, "'"]], crystals: [[4, 7, '*'], [2, 8, '*']],
  },
  cairn: {
    about: 'a small stone perched on a flat one',
    front: ['', '    .--.', '   (E  E)', '  .------.', ' (________)'],
    back: ['', '    .--.', '   (    )', '  .------.', ' (________)'],
    veins: [[3, 5, '/'], [4, 7, '/'], [4, 3, '/']], polish: [[1, 5, "'"], [3, 3, "'"]], crystals: [[4, 9, '*'], [3, 8, '*']],
  },
  sett: {
    about: 'a squared paving stone, a sett (a cobble is rounded)',
    front: ['', '', '  ._______.', '  | E   E |', '  |_______|'],
    back: ['', '', '  ._______.', '  |       |', '  |_______|'],
    veins: [[2, 6, '/'], [4, 7, '/'], [2, 8, '/']], polish: [[3, 3, "'"], [2, 4, "'"]], crystals: [[4, 8, '*'], [4, 4, '*']],
  },
  hoodoo: {
    about: 'a little spire with a cap stone',
    front: ['', '   ______', '  (______)', '   | EE |', '   |____|'],
    back: ['', '   ______', '  (______)', '   |    |', '   |____|'],
    veins: [[1, 6, '/'], [3, 7, '/'], [2, 4, '/']], polish: [[3, 4, "'"], [2, 7, "'"]], crystals: [[4, 5, '*'], [4, 6, '*']],
  },
  pebble: {
    about: 'the first drawing, a small pebble',
    front: ['', '', '   .----.', '  ( E  E )', "   '----'"],
    back: ['', '', '   .----.', '  (      )', "   '----'"],
    veins: [[2, 5, '/'], [4, 6, '/'], [3, 3, '/']], polish: [[2, 7, "'"], [3, 8, "'"]], crystals: [[4, 4, '*'], [4, 7, '*']],
  },
};

/** The one the screen draws. The owner's choice. */
export const DRAWING = 'lump';

// Where moss grows on a drawing, in the order it spreads: the cell above its outline in each
// column, from the middle out, then down its sides.
export function mossCells(rows) {
  const b = rows.map(r => r.padEnd(12));
  const top = [];
  for (let c = 0; c < 12; c++) {
    const r = b.findIndex(row => row[c] !== ' ');
    if (r > 0) top.push([r - 1, c]);
  }
  top.sort((a, z) => Math.abs(a[1] - 5.5) - Math.abs(z[1] - 5.5) || a[1] - z[1]);
  const sides = [];
  for (let r = 2; r < 5; r++) {
    const left = b[r].search(/\S/), right = b[r].trimEnd().length - 1;
    if (left > 0) sides.push([r, left - 1]);
    if (right >= 0 && right < 11) sides.push([r, right + 1]);
  }
  const seen = new Set(top.map(([r, c]) => `${r},${c}`));
  return [...top, ...sides.filter(([r, c]) => !seen.has(`${r},${c}`) && seen.add(`${r},${c}`))];
}
/**
 * How many of those cells hold moss at each level, 0-6 (marks.mjs says when). Every drawing has
 * at least 12; at the last level, a season after death, all of them do (but a side that a moved
 * rock has pushed past the grid's edge is not drawn).
 */
export const MOSS_CELLS = [0, 2, 4, 7, 9, 11, Infinity];
