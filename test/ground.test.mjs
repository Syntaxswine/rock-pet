// The ground around the rock: its personality, drawn (src/ground.mjs; CHARACTER.md, "Its ground").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundOf, tracesOf, drawGround } from '../src/ground.mjs';
import { personality, careTotals, PERSONALITIES } from '../src/personality.mjs';
import { render, sprite, W, MESS_SPOTS } from '../src/screen.mjs';
import { DRAWINGS } from '../src/drawings.mjs';
import { born, replay, HOUR } from '../src/engine.mjs';
import { RULES } from '../src/rules.mjs';
import { act, look, newLog } from '../src/rock.mjs';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 10, 16, 14, 5); // a November afternoon: no winter move, no trail
// Lifetime care in proportion to each daily need (10/3 feeds, 2 cleans, 4.8 pets): together these
// sit at the triangle's center, and each alone at a corner (PERSONALITY.md's own example).
const NEED = { feed: 25, clean: 15, pet: 36 };
const only = (...cares) => Object.fromEntries(Object.keys(NEED).map(k => [k, cares.includes(k) ? NEED[k] : 0]));
const times = x => Object.fromEntries(Object.keys(NEED).map(k => [k, NEED[k] * (x[k] ?? 1)]));
const BARE = { feed: 0, clean: 0, pet: 0 };
const grid = text => text.split('\n').slice(0, W);
// Traces come from weighted shares, so a half can be a hair under one half.
const near = (got, want, what) => { for (const k of Object.keys(want)) assert.ok(Math.abs(got[k] - want[k]) < 1e-12, `${what}: ${JSON.stringify(got)}`); };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the ground reads the triangle: bare at its center, one trace at a corner, two half traces mid-side', () => {
  const grownUp = 14 * DAY;
  near(tracesOf(NEED), BARE, 'center');
  assert.deepEqual(groundOf(NEED, grownUp), BARE, 'even-tempered: nothing stands above the rest');
  for (const k of ['feed', 'clean', 'pet']) {
    assert.deepEqual(tracesOf(only(k)), { ...BARE, [k]: 1 });
    assert.deepEqual(groundOf(only(k), grownUp), { ...BARE, [k]: 3 }, k);
  }
  for (const [a, b] of [['feed', 'clean'], ['feed', 'pet'], ['clean', 'pet']]) {
    near(tracesOf(only(a, b)), { ...BARE, [a]: 0.5, [b]: 0.5 }, `${a} and ${b}`);
    assert.deepEqual(groundOf(only(a, b), grownUp), { ...BARE, [a]: 2, [b]: 2 }, `${a} and ${b}`);
  }
  const tenfold = Object.fromEntries(Object.entries(times({ pet: 3 })).map(([k, n]) => [k, 10 * n]));
  assert.deepEqual(groundOf(tenfold, grownUp), groundOf(times({ pet: 3 }), grownUp), 'only the balance counts, not the amount');
  assert.deepEqual(groundOf(BARE, grownUp), BARE, 'no care yet: still forming, so bare');
  assert.deepEqual(groundOf(null, grownUp), BARE, 'no totals given: bare');
});

test('each trace is the personality blend: corner plus half the pair, then half the pair, then nothing', () => {
  const rnd = mulberry(7);
  const pairOf = (a, b) => PERSONALITIES.find(p => p.axes.length === 2 && p.axes.includes(a) && p.axes.includes(b)).id;
  const cornerOf = a => PERSONALITIES.find(p => p.axes.length === 1 && p.axes[0] === a).id;
  for (let i = 0; i < 2000; i++) {
    const care = { feed: Math.floor(rnd() * 400), clean: Math.floor(rnd() * 400), pet: Math.floor(rnd() * 400) };
    if (i % 5 === 0) care[['feed', 'clean', 'pet'][i % 3]] = 0;
    const p = personality(care);
    if (!p.formed) continue;
    const [low, mid, high] = ['feed', 'clean', 'pet'].sort((a, b) => p.shares[a] - p.shares[b]);
    const traces = tracesOf(care), pair = p.blend[pairOf(mid, high)];
    assert.ok(Math.abs(traces[high] - (p.blend[cornerOf(high)] + pair / 2)) < 1e-12, JSON.stringify(care));
    assert.ok(Math.abs(traces[mid] - pair / 2) < 1e-12, JSON.stringify(care));
    assert.equal(traces[low], 0, 'the least-given care never shows, so at most two traces do');
    assert.ok(Math.abs(traces.feed + traces.clean + traces.pet - (1 - p.blend.balanced)) < 1e-12, 'the center weight is bare ground');
  }
});

test('the ground forms over its first two weeks, with levels at 0.12, 0.35 and 0.6', () => {
  // A corner's trace is exactly 1 and a side's middle exactly 0.5, so each level comes at a whole
  // millisecond: 0.12, 0.35 and 0.6 of two weeks for a corner, 0.7 of two weeks for a side.
  const corner = only('feed'), side = only('feed', 'clean');
  for (const [age, level] of [[145_152_000, 1], [423_360_000, 2], [725_760_000, 3]]) { // 1.68, 4.9 and 8.4 days
    assert.equal(groundOf(corner, age).feed, level, `${age / DAY} days`);
    assert.equal(groundOf(corner, age - 1).feed, level - 1, `just before ${age / DAY} days`);
  }
  assert.deepEqual(groundOf(side, 846_720_000), { ...BARE, feed: 2, clean: 2 }, '9.8 days');
  assert.deepEqual(groundOf(side, 846_719_999), { ...BARE, feed: 1, clean: 1 }, 'just before 9.8 days');
  for (const age of [14 * DAY, 100 * DAY, 3650 * DAY]) {
    assert.deepEqual(groundOf(side, age), { ...BARE, feed: 2, clean: 2 }, `${age / DAY} days: it is full grown at two weeks`);
  }
  for (const k of ['feed', 'clean', 'pet']) assert.deepEqual(groundOf(only(k), DAY), BARE, 'one day old: one habit does not stamp it yet');
});

// A well-kept rock 41 days old, as the model sheet draws it, on whichever drawing.
const kept = { ...born(T - 41 * DAY), t: T, lastCare: T - 2 * HOUR, visits: 90, hunger: 2, happy: 6 };
const groundRows = (care, drawing = DRAWINGS.lump) => grid(render(kept, { now: T, host: 'h', drawing, care })).slice(5, 11);

test('the ground, drawn: the seven personalities and the first level of each care, on the lump', () => {
  const lump = ' \\________/', none = ['', '', '', '', ''];
  const cases = [
    ['even-tempered', NEED, [lump, ...none]],
    ['comfort-loving: its base sunk in sand', only('feed'), ['............', ...none]],
    ['orderly: a floor raked deep', only('clean'), [lump, '============', '', '', '', '']],
    ['affectionate: five footprints', only('pet'), [lump, '   :', '  :', '   :', '  :', '   :']],
    ['settled', only('feed', 'clean'), ['.\\________/.', '------------', '', '', '', '']],
    ['sociable', only('feed', 'pet'), ['.\\________/.', '   :', '  :', '   :', '', '']],
    ['gentle: footprints step on a stone where they cross the raking', only('clean', 'pet'), [lump, '---o--------', '  :', '   :', '', '']],
    ['a little more feeding: sand at its foot', times({ feed: 2 }), ['.\\________/.', ...none]],
    ['a little more cleaning: raked under it', times({ clean: 2 }), [lump, ' ----------', '', '', '', '']],
    ['a little more petting: two footprints', times({ pet: 2 }), [lump, '   :', '  :', '', '', '']],
  ];
  for (const [what, care, rows] of cases) assert.deepEqual(groundRows(care), rows, what);
  assert.deepEqual(groundRows(times({ feed: 3 }), DRAWINGS.pebble)[0], "...'----'...", 'more feeding, on a narrow rock: sand all along its base');
});

// The rock's box drawn into a bare grid, `dx` columns over, as render does.
function boxed(s, now, pose, drawing, dx) {
  const g = Array.from({ length: W }, () => Array(W).fill(' '));
  sprite(s, now, pose, drawing).forEach((row, r) => { for (let c = 0; c < W; c++) if (row[c] !== ' ' && c + dx >= 0 && c + dx < W) g[1 + r][c + dx] = row[c]; });
  return g;
}

test('the ground never covers the rock, its marks, its moss or a mess: every drawing, pose, column and level', () => {
  const marked = { ...kept, closeCalls: 3, petted: 3000, fed: 1500 };
  const grave = replay({ born: T, rules: RULES.version, visits: [] }, Infinity);
  const states = [[marked, T], [grave, grave.dead.t + 120 * DAY]];
  const STEPS = [0, 2, 3, 5];
  let buried = 0, stones = 0;
  for (const [name, drawing] of Object.entries(DRAWINGS)) for (const pose of ['front', 'away']) for (const dx of [-1, 0, 1]) for (const [s, now] of states) {
    const rows = pose === 'away' ? drawing.back : drawing.front;
    const outline = c => rows[4][c - dx] ?? ' ';
    const left = rows[4].search(/\S/) + dx;
    const steps = new Set([0, 1, 2, 3, 4].map(i => `${6 + i},${left + (i % 2 ? 1 : 2)}`));
    for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) for (let p = 0; p < 4; p++) for (const messes of [0, 7]) {
      const before = boxed(s, now, pose, drawing, dx);
      for (const [r, col] of MESS_SPOTS.slice(0, messes)) before[r][col] = '@';
      const g = before.map(row => [...row]);
      drawGround(g, { feed: f, clean: c, pet: p }, rows, dx);
      const at = `${name} ${pose} dx ${dx} feed ${f} clean ${c} pet ${p} messes ${messes}${s.dead ? ' grave' : ''}`;
      let prints = 0;
      for (let r = 0; r < W; r++) for (let col = 0; col < W; col++) {
        const was = before[r][col], is = g[r][col];
        if (r >= 6 && (is === ':' || is === 'o')) prints++;
        if (was === is) continue;
        assert.ok(r >= 5 && r <= 10, `${at}: drew on row ${r}`);
        if (r === 5) {
          assert.equal(is, '.', `${at}: row 5 holds only sand`);
          assert.ok(was === ' ' || (f === 3 && was === outline(col)), `${at}: sand over "${was}" at column ${col}`);
          if (was !== ' ') buried++;
        } else if (r === 6 && is !== ':' && is !== 'o') {
          assert.equal(was, ' ', at);
          assert.equal(is, c === 3 ? '=' : '-', `${at}: the raked floor`);
          assert.ok(c >= 1, at);
        } else {
          // A footprint on bare ground, or a stone where it crosses the raked floor (row 6).
          assert.ok(steps.has(`${r},${col}`), `${at}: a footprint off the path at ${r},${col}`);
          assert.equal(was, ' ', `${at}: "${is}" over "${was}"`);
          assert.ok(is === ':' || (is === 'o' && r === 6 && c >= 1), `${at}: "${is}" at ${r},${col}`);
          if (is === 'o') stones++;
        }
      }
      if (f === 3) assert.ok([...Array(W).keys()].every(col => outline(col) === ' ' || g[5][col] !== outline(col)), `${at}: deep sand covers the whole base`);
      if (messes === 0) assert.equal(prints, STEPS[p], `${at}: footprints`);
    }
  }
  assert.ok(buried > 0 && stones > 0, 'the cases include a buried base and stepping stones');
});

test('a grave keeps the ground it had when it died', () => {
  // Petted once and never fed, it died at three days old: two footprints (one under a mess), and
  // never the five that a grown rock as fond of petting would wear.
  const b = Date.UTC(2026, 9, 6);
  const log = { ...newLog(b), visits: [{ t: b + HOUR, acts: [['pet', 20], ['pet', 20]] }] };
  const end = replay(log, Infinity).dead;
  assert.ok(end.t - b < 3 * DAY, 'it died young');
  for (const later of [HOUR, 30 * DAY, 400 * DAY]) {
    assert.deepEqual(grid(look(log, { now: end.t + later, host: 'h' }).text).slice(6, 11), ['   :', '  @     @', '     @', '         @', ' @'], `${later / DAY} days on`);
  }
});

test('the game draws the ground from the whole log, the visit just made included', () => {
  const b = Date.UTC(2026, 9, 6);
  // Full care in proportion to each need, every 8h for two weeks: its ground is bare.
  const log = newLog(b);
  for (let t = b + HOUR; t < b + 14 * DAY; t += 8 * HOUR) log.visits.push({ t, acts: [['feed', 5], ['clean', 3], ['pet', 7]] });
  const now = b + 14 * DAY + 2 * HOUR, opts = { now, host: 'h' };
  assert.deepEqual(grid(look(log, opts).text).slice(6, 8), ['', '        @']);
  // One visit with 140 pets tips it: two footprints, in that visit's own reply.
  const r = act(log, 'pet x20 pet x20 pet x20 pet x20 pet x20 pet x20 pet x20', opts);
  assert.equal(r.status, 200);
  assert.deepEqual(grid(r.text).slice(6, 8), ['   :', '  :     @']);
  assert.deepEqual(grid(look({ ...log, visits: [...log.visits, r.visit] }, opts).text).slice(5), grid(r.text).slice(5), 'and looks after it see the same ground');
  // Kept up for three weeks, extra petting wears three.
  const fond = newLog(b);
  for (let t = b + HOUR; t < b + 20 * DAY; t += 8 * HOUR) fond.visits.push({ t, acts: [['feed', 5], ['clean', 3], ['pet', 20]] });
  assert.deepEqual(groundOf(careTotals(fond), 20 * DAY), { ...BARE, pet: 2 });
  assert.deepEqual(grid(look(fond, { now: b + 20 * DAY, host: 'h' }).text).slice(6, 10).map(row => row.slice(0, 4).trimEnd()), ['   :', '  :', '   :', '']);
});
