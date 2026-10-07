import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, eyes, fullCare, shownHunger, shownHappy, MESS_SPOTS, W } from '../src/screen.mjs';
import { replay, applyVisit, born, HOUR } from '../src/engine.mjs';
import { parseActions } from '../src/parse.mjs';
import { RULES } from '../src/rules.mjs';

const MIN = 60_000, DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 0, 1);
const state = o => ({ ...born(0), ...o });
const show = (s, now = s.t) => render(s, { now, host: 'rockpet.example' });

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rocks met along random lives: alive and dead, at every mood, hunger and mess count.
function sampleRocks(n, seed) {
  const rnd = mulberry(seed);
  const VERBS = ['feed', 'clean', 'pet'];
  const out = [];
  while (out.length < n) {
    const b = T0 + Math.floor(rnd() * DAY);
    const visits = [];
    for (let t = b + HOUR; t < b + 12 * DAY; t += HOUR * (1 + rnd() * (rnd() < 0.1 ? 70 : 20))) {
      visits.push({ t: Math.round(t), acts: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => [VERBS[Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 6)]) });
    }
    const now = b + Math.floor(rnd() * 14 * DAY);
    out.push({ s: replay({ born: b, rules: RULES.version, visits }, now), now });
  }
  return out;
}

// Times in the mocks sit late in their unit (6h40m, 41d20h), so a rounding mutant shows.
test('the alive screen is the DESIGN-NOTES mock', () => {
  const now = Date.UTC(2026, 10, 16, 14, 5);
  const s = state({ born: now - 41 * DAY - 20 * HOUR, t: now, hunger: 3.2, happy: -2.2, messes: 1, lastCare: now - 6 * HOUR - 40 * MIN, visits: 9 });
  assert.equal(show(s), [
    '3         -2', '', '', '   .----.', '  ( -  - )', "   '----'", '', '        @', '', '', '', '',
    'hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)',
    'age 41d  now 14:05Z  last care 6h ago',
    'act: POST rockpet.example/act  body e.g. feed clean pet x6',
  ].join('\n') + '\n');
});

test('the dead screen is the DESIGN-NOTES mock', () => {
  const died = Date.UTC(2026, 10, 16, 3, 14), now = died + 9 * HOUR;
  const s = state({ born: died - 41 * DAY - 20 * HOUR, t: died, hunger: 10, happy: -10, messes: 3, starvingSince: died - 30 * HOUR, sorrowSince: died - 48 * HOUR, lastCare: now - 3 * DAY - 20 * HOUR, dead: { t: died, cause: 'lonely' } });
  assert.equal(show(s, now), [
    'died: lonely', '', '', '   .----.', '  ( x  x )', "   '----'", '', '  @     @', '     @', '', '', '',
    'age 41d  died 2026-11-16 03:14Z',
    'last care 3d ago  it does not stir',
  ].join('\n') + '\n');
});

test('every epitaph fills the top row exactly', () => {
  for (const cause of ['lonely', 'filthy', 'hungry']) {
    const row1 = show(state({ t: DAY, hunger: 10, happy: -10, starvingSince: 0, sorrowSince: 0, dead: { t: DAY, cause } }), 2 * DAY).split('\n')[0];
    assert.equal(row1, `died: ${cause}`);
    assert.equal(row1.length, W, cause);
  }
});

test('the ceiling bottoms out at -10, and the named line says so', () => {
  for (const [messes, max] of [[1, 7], [3, 1], [6, -8], [7, -10], [9, -10]]) {
    const text = show(state({ t: HOUR, hunger: 2, happy: Math.min(-8, max), messes }), HOUR);
    assert.ok(text.includes(` (max ${max})  mess ${messes} (@)\n`), `${messes} messes: ${text}`);
  }
});

test('every screen: a 12x12 grid with no trailing spaces, an @ per mess, the rock intact', () => {
  for (const { s, now } of sampleRocks(400, 5)) {
    const lines = show(s, now).split('\n');
    assert.equal(lines.pop(), '', 'ends with a newline');
    const grid = lines.slice(0, W);
    for (const row of grid) { assert.ok(row.length <= W, `row "${row}"`); assert.equal(row, row.trimEnd()); }
    assert.equal(grid[3], '   .----.');
    assert.equal(grid[4], `  ( ${eyes(s)} )`);
    assert.equal(grid[5], "   '----'");
    assert.equal(grid.join('').split('@').length - 1, Math.min(s.messes, MESS_SPOTS.length), 'one @ per mess');
    if (s.dead) {
      assert.equal(grid[0], `died: ${s.dead.cause}`);
      assert.ok(!lines.some(l => l.startsWith('act:')), 'no act line on a grave');
    } else {
      // Row 1 is hunger left-aligned and happiness right-aligned, the same numbers as the named line.
      const top = /^([0-9]+) +(-?[0-9]+)$/.exec(grid[0]);
      assert.ok(top && grid[0].length === W, `row 1 "${grid[0]}"`);
      const named = /^hunger ([0-9]+)\/10 \(10=starving\)  happy (-?[0-9]+)( \(max (-?[0-9]+)\))?  mess ([0-9]+)( \(@\))?$/.exec(lines[W]);
      assert.ok(named, `named line "${lines[W]}"`);
      assert.deepEqual([named[1], named[2]], [top[1], top[2]]);
      assert.equal(Number(named[5]), s.messes);
      assert.equal(named[3] !== undefined, s.messes > 0, '(max N) only while a mess lowers the ceiling');
      assert.equal(lines.some(l => l.startsWith('sorrow: at -10 for ')), s.sorrowSince !== null);
      assert.equal(lines.some(l => l.startsWith('hunger: at 10 for ')), s.starvingSince !== null);
      assert.ok(lines.at(-1).startsWith('act: POST rockpet.example/act  '));
    }
  }
});

test('the sample covers what the screen has to show', () => {
  const rocks = sampleRocks(400, 5).map(r => r.s);
  const alive = rocks.filter(s => !s.dead);
  for (const [what, n] of [
    ['dead', rocks.filter(s => s.dead).length],
    ['lonely', rocks.filter(s => s.dead?.cause === 'lonely').length],
    ['hungry', rocks.filter(s => s.dead?.cause === 'hungry').length],
    ['at the sorrow floor', alive.filter(s => s.sorrowSince !== null).length],
    ['starving', alive.filter(s => s.starvingSince !== null).length],
    ['3+ messes', alive.filter(s => s.messes >= 3).length],
    ['no mess', alive.filter(s => s.messes === 0).length],
    ...['^  ^', 'o  o', '-  -', ';  ;'].map(e => [`eyes ${e}`, alive.filter(s => eyes(s) === e).length]),
  ]) assert.ok(n >= 3, `only ${n} rocks ${what}`);
});

test('the face follows the mood', () => {
  assert.equal(eyes(state({ happy: 10 })), '^  ^');
  assert.equal(eyes(state({ happy: 5 })), '^  ^');
  assert.equal(eyes(state({ happy: 4.9 })), 'o  o');
  assert.equal(eyes(state({ happy: 0 })), 'o  o');
  assert.equal(eyes(state({ happy: -0.1 })), '-  -');
  assert.equal(eyes(state({ happy: -5 })), '-  -');
  assert.equal(eyes(state({ happy: -5.1 })), ';  ;');
  assert.equal(eyes(state({ happy: -10, sorrowSince: 0 })), 'T  T');
  assert.equal(eyes(state({ happy: -10, sorrowSince: 0, dead: { t: 1, cause: 'lonely' } })), 'x  x');
});

test('an extreme shows only while the stat is truly there', () => {
  assert.equal(shownHunger(state({ hunger: 9.97 })), 9);
  assert.equal(shownHunger(state({ hunger: 10, starvingSince: 0 })), 10);
  assert.equal(shownHappy(state({ happy: -9.97 })), -9);
  assert.equal(shownHappy(state({ happy: -10, sorrowSince: 0 })), -10);
  assert.equal(shownHappy(state({ happy: 9.6 })), 10);
  assert.equal(Object.is(shownHappy(state({ happy: -0.3 })), 0), true, 'no "-0"');
});

test('danger lines count the whole hours at the extreme', () => {
  const now = T0 + 50 * HOUR;
  const text = show(state({ born: T0, t: now, hunger: 10, happy: -10, starvingSince: now - 17 * HOUR - 35 * MIN, sorrowSince: now - 3 * HOUR - 40 * MIN }), now);
  assert.ok(text.includes('\nsorrow: at -10 for 3h of 48\n'), text);
  assert.ok(text.includes('\nhunger: at 10 for 17h of 48\n'), text);
  assert.ok(text.includes('\n10       -10\n') || text.startsWith('10       -10\n'), text);
});

test('the suggested body is the smallest full visit: sent as is, the screen reads hunger 0, happy 10, mess 0', () => {
  const after = (s, acts) => { const c = structuredClone(s); applyVisit(c, acts); return [shownHunger(c), shownHappy(c), c.messes]; };
  const rocks = sampleRocks(400, 9).map(r => r.s).filter(s => !s.dead);
  // Float edges the sample would never hit: happiness a hair below -6.5 and -8.5.
  rocks.push(state({ happy: -6.500000000000002 }), state({ happy: -8.500000000000002 }), state({ hunger: 0.5 }), state({ hunger: 3.5000000000000004 }));
  for (const s of rocks) {
    const body = fullCare(s);
    const acts = body ? parseActions(body).acts : [];
    assert.deepEqual(after(s, acts), [0, 10, 0], `"${body}" from ${JSON.stringify(s)}`);
    for (const [i, [verb, n]] of acts.entries()) { // one fewer of any verb is not enough
      if (verb === 'clean') continue;
      const fewer = acts.map((a, j) => (j === i ? [verb, n - 1] : a)).filter(([, k]) => k > 0);
      assert.notDeepEqual(after(s, fewer), [0, 10, 0], `"${body}" is not the smallest from ${JSON.stringify(s)}`);
    }
    if (body) assert.ok(show(s).includes(`body e.g. ${body}\n`));
    else assert.ok(show(s).includes('nothing needed now'));
  }
  assert.ok(rocks.length > 150, `only ${rocks.length} live rocks`);
});

test('a rock never shows more messes than the grid has spots for', () => {
  // The most messes a rock can carry: fed and petted every hour, never cleaned.
  const visits = [];
  for (let t = T0 + HOUR; t < T0 + 30 * DAY; t += HOUR) visits.push({ t, acts: [['feed', 4], ['pet', 10]] });
  const s = replay({ born: T0, rules: RULES.version, visits }, Infinity);
  assert.ok(s.dead && s.messes <= MESS_SPOTS.length, `${s.messes} messes, ${MESS_SPOTS.length} spots`);
  const keys = MESS_SPOTS.map(([r, c]) => `${r},${c}`);
  assert.equal(new Set(keys).size, MESS_SPOTS.length, 'spots are distinct');
  for (const [r, c] of MESS_SPOTS) assert.ok(r >= 6 && r < W && c >= 0 && c < W, `spot ${r},${c} is on the ground`);
  assert.deepEqual(MESS_SPOTS.slice(0, 3), [[7, 8], [7, 2], [8, 5]], 'the first three are where the mocks draw them');
});

test('the screen stays small (token efficiency): at most 340 bytes, whatever the state', () => {
  // The largest is a rock with many messes and both danger lines; a cared-for rock is ~160.
  const sizes = sampleRocks(400, 13).map(({ s, now }) => Buffer.byteLength(show(s, now))).sort((a, b) => a - b);
  console.log(`  screen bytes: median ${sizes[sizes.length >> 1]}, largest ${sizes.at(-1)}`);
  assert.ok(sizes.at(-1) <= 340, `${sizes.at(-1)} bytes`);
});
