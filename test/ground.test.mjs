// The ground around the rock: its personality, drawn (src/ground.mjs; CHARACTER.md, "Its ground").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundOf, groundAt, tracesOf, drawGround } from '../src/ground.mjs';
import { personality, careTotals, PERSONALITIES } from '../src/personality.mjs';
import { render, sprite, fullCare, W, MESS_SPOTS } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { born, replay, HOUR } from '../src/engine.mjs';
import { placeAt } from '../src/character.mjs';
import { parseActions } from '../src/parse.mjs';
import { RULES } from '../src/rules.mjs';
import { act, look, name, newLog } from '../src/rock.mjs';

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
// Where footprints fall, nearest the rock first, for a rock that has not moved (spelled out here,
// not read from ground.mjs).
const PATH = [[6, 3], [7, 4], [8, 3], [9, 4], [10, 3]];
// One visit's acts for care totals, in words of at most 20.
const acts = care => Object.entries(care).flatMap(([verb, n]) => Array.from({ length: Math.ceil(n / 20) }, (_, i) => [verb, Math.min(20, n - 20 * i)]));

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
  const tenfold = Object.fromEntries(Object.entries(times({ pet: 4 })).map(([k, n]) => [k, 10 * n]));
  assert.deepEqual(groundOf(tenfold, grownUp), groundOf(times({ pet: 4 }), grownUp), 'only the balance counts, not the amount');
  assert.deepEqual(groundOf(BARE, grownUp), BARE, 'no care yet: still forming, so bare');
  assert.deepEqual(groundOf(null, grownUp), BARE, 'no totals given: bare');
  // Care reaches 28 mixes of levels: the least-given care never shows, and two traces can't reach
  // levels 3 and 3, or 3 and 2 (they would need more than the whole). Exact shares find them all.
  // Held levels add none: holding 3 and 2 takes traces of 0.58 and 0.43, still more than the whole.
  const mixes = new Set();
  for (let i = 0; i <= 60; i++) for (let j = 0; i + j <= 60; j++) {
    const g = groundOf({ feed: i / 60 * 10 / 3, clean: j / 60 * 2, pet: (60 - i - j) / 60 * 4.8 }, grownUp);
    mixes.add(`${g.feed}${g.clean}${g.pet}`);
  }
  const allowed = [];
  for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) for (let p = 0; p < 4; p++) {
    const [b, a] = [f, c, p].sort((x, y) => x - y).slice(1);
    if ([f, c, p].includes(0) && !(a === 3 && b >= 2)) allowed.push(`${f}${c}${p}`);
  }
  assert.equal(allowed.length, 28);
  assert.deepEqual([...mixes].sort(), allowed.sort());
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

test("the traces are personality()'s shares to the last bit, and refuse totals that are not finite and non-negative", () => {
  const rnd = mulberry(13), cases = [{ feed: 0, clean: 0, pet: 0 }, { feed: 2 ** 53 - 1, clean: 1, pet: 0 }, { feed: 0, clean: 0, pet: 7 }];
  for (let i = 0; i < 3000; i++) {
    const n = () => Math.floor(rnd() * 10 ** (1 + Math.floor(rnd() * 9)));
    const care = { feed: n(), clean: n(), pet: n() };
    if (i % 7 === 0) care[['feed', 'clean', 'pet'][i % 3]] = 0;
    cases.push(care);
  }
  for (const care of cases) {
    const shares = personality(care).shares, least = Math.min(shares.feed, shares.clean, shares.pet), traces = tracesOf(care);
    for (const k of ['feed', 'clean', 'pet']) assert.ok(Object.is(traces[k], shares[k] - least), `${k} of ${JSON.stringify(care)}: ${traces[k]} and ${shares[k] - least}`);
  }
  for (const care of [{ feed: -5, clean: 2, pet: 3 }, { feed: 1, clean: 2 }, { feed: NaN, clean: 2, pet: 3 }, { feed: Infinity, clean: 2, pet: 3 }, { feed: '7', clean: 2, pet: 3 }]) {
    assert.throws(() => tracesOf(care), /invalid (feed|pet) care total/, JSON.stringify(care));
  }
});

test('the ground forms over the time it has lived, with levels at 0.3, 0.45 and 0.6', () => {
  // A corner's trace is exactly 1 and a side's middle exactly 0.5, so each level comes at a whole
  // millisecond: 0.3, 0.45 and 0.6 of two weeks for a corner, 0.6 and 0.9 of them mid-side.
  const corner = only('feed'), side = only('feed', 'clean');
  for (const [age, level] of [[362_880_000, 1], [544_320_000, 2], [725_760_000, 3]]) { // 4.2, 6.3 and 8.4 days
    assert.equal(groundOf(corner, age).feed, level, `${age / DAY} days`);
    assert.equal(groundOf(corner, age - 1).feed, level - 1, `just before ${age / DAY} days`);
  }
  for (const [age, level] of [[725_760_000, 1], [1_088_640_000, 2]]) { // 8.4 and 12.6 days
    assert.deepEqual(groundOf(side, age), { ...BARE, feed: level, clean: level }, `${age / DAY} days`);
    assert.deepEqual(groundOf(side, age - 1), { ...BARE, feed: level - 1, clean: level - 1 }, `just before ${age / DAY} days`);
  }
  for (const age of [14 * DAY, 100 * DAY, 3650 * DAY]) {
    assert.deepEqual(groundOf(side, age), { ...BARE, feed: 2, clean: 2 }, `${age / DAY} days: it is full grown at two weeks`);
  }
  for (const k of ['feed', 'clean', 'pet']) assert.deepEqual(groundOf(only(k), 4 * DAY), BARE, 'four days old: one habit does not stamp it yet');
  // groundAt keeps the same clock: a log of nothing but petting reaches its first level at 4.2
  // days of life, to the millisecond. (Such a rock would have died by then; the clock is the point.)
  const b = Date.UTC(2026, 9, 6), once = { ...newLog(b), visits: [{ t: b + HOUR, acts: [['pet', 20], ['pet', 20]] }] };
  assert.deepEqual(groundAt(once, b + 362_880_000), { ...BARE, pet: 1 });
  assert.deepEqual(groundAt(once, b + 362_879_999), BARE);
  // Verified downtime doesn't count, as for moss: petted hard once, then the host was down for
  // sixteen days. It has lived three hours, so its ground is still bare (by the calendar it would
  // wear five footprints).
  const log = { ...once, outages: [{ start: b + 2 * HOUR, end: b + 16 * DAY, evidence: 'host-1' }] };
  const after = look(log, { now: b + 16 * DAY + HOUR, host: 'h' });
  assert.equal(after.status, 200);
  assert.ok(!grid(after.text).slice(6, 11).join('').includes(':'), `no footprints after three hours of life:\n${after.text}`);
  assert.deepEqual(groundAt({ ...log, outages: [] }, b + 16 * DAY), { ...BARE, pet: 3 }, 'what the calendar would have drawn');
});

// Follow the act line's own suggestion for 30 days, with visits `gap()` apart.
function suggested(gap, rnd) {
  const b = Date.UTC(2026, 9, 1) + Math.floor(rnd() * DAY), log = { born: b, rules: RULES.version, visits: [] };
  for (let t = b + HOUR; t < b + 30 * DAY; t += gap()) {
    const body = fullCare(replay(log, t));
    if (body) log.visits.push({ t: Math.round(t), acts: parseActions(body).acts });
  }
  assert.ok(!replay(log, b + 30 * DAY).dead);
  return groundAt(log, b + 30 * DAY);
}

test("the act line's own suggestion: bare every 3 to 10 hours, sand every hour, a path once a day", () => {
  // The pets that make up for messes and hunger lift petting's share a little, which the first
  // level stays above when someone comes every few hours. Once a day, the suggestion is mostly
  // petting. Every hour, it is a small feed each time, each counted as a feed.
  const rnd = mulberry(3);
  for (let i = 0; i < 12; i++) {
    assert.deepEqual(suggested(() => 8 * HOUR, rnd), BARE, 'every 8 hours');
    assert.deepEqual(suggested(() => HOUR * (4 + rnd() * 6), rnd), BARE, 'every 4 to 10 hours');
    assert.deepEqual(suggested(() => 24 * HOUR, rnd), { ...BARE, pet: 1 }, 'once a day: two footprints');
  }
  assert.deepEqual(suggested(() => HOUR, rnd), { ...BARE, feed: 1 }, 'every hour: sand at its foot');
});

test('worn ground fades slowly: a level holds until its trace falls 0.02 below it', () => {
  const b = Date.UTC(2026, 9, 6), at = d => b + d * DAY;
  // Past two weeks old, petted more than anything: a trace of 1/3, two footprints...
  const log = { ...newLog(b), visits: [{ t: at(15), acts: acts({ feed: 2500, clean: 1500, pet: 9000 }) }] };
  assert.deepEqual(groundAt(log, at(15)), { ...BARE, pet: 1 });
  // ...then meals and cleaning bring it to 0.2804, under the level by less than 0.02...
  log.visits.push({ t: at(16), acts: acts({ feed: 382, clean: 229 }) });
  const held = tracesOf({ feed: 2882, clean: 1729, pet: 9000 }).pet;
  assert.ok(held > 0.2800 && held < 0.2805, `${held}`);
  assert.deepEqual(groundAt(log, at(16)), { ...BARE, pet: 1 }, 'so the path stays');
  assert.deepEqual(groundOf({ feed: 2882, clean: 1729, pet: 9000 }, 30 * DAY), BARE, 'though the same care, reached from below, wears none');
  // ...and a little more to 0.2798, under it by more than 0.02: the path is gone.
  log.visits.push({ t: at(17), acts: acts({ feed: 4, clean: 3 }) });
  const gone = tracesOf({ feed: 2886, clean: 1732, pet: 9000 }).pet;
  assert.ok(gone > 0.2795 && gone < 0.2800, `${gone}`);
  assert.deepEqual(groundAt(log, at(17)), BARE);
  // The same 0.02 at the second level: three footprints at 0.4653, kept at 0.4304, two at 0.4299.
  const two = { ...newLog(b), visits: [{ t: at(15), acts: acts({ feed: 2500, clean: 1500, pet: 13000 }) }] };
  assert.deepEqual(groundAt(two, at(15)), { ...BARE, pet: 2 });
  two.visits.push({ t: at(16), acts: acts({ feed: 263, clean: 158 }) });
  const kept2 = tracesOf({ feed: 2763, clean: 1658, pet: 13000 }).pet;
  assert.ok(kept2 > 0.4300 && kept2 < 0.4305, `${kept2}`);
  assert.deepEqual(groundAt(two, at(16)), { ...BARE, pet: 2 });
  two.visits.push({ t: at(17), acts: acts({ clean: 12 }) });
  const fell2 = tracesOf({ feed: 2763, clean: 1670, pet: 13000 }).pet;
  assert.ok(fell2 > 0.4295 && fell2 < 0.4300, `${fell2}`);
  assert.deepEqual(groundAt(two, at(17)), { ...BARE, pet: 1 });
  // And at the third: five footprints at 0.6646, kept at 0.5805, three at 0.5800.
  const three = { ...newLog(b), visits: [{ t: at(15), acts: acts({ feed: 2500, clean: 1500, pet: 25000 }) }] };
  assert.deepEqual(groundAt(three, at(15)), { ...BARE, pet: 3 });
  three.visits.push({ t: at(16), acts: acts({ feed: 869, clean: 525 }) });
  const kept3 = tracesOf({ feed: 3369, clean: 2025, pet: 25000 }).pet;
  assert.ok(kept3 > 0.5800 && kept3 < 0.5805, `${kept3}`);
  assert.deepEqual(groundAt(three, at(16)), { ...BARE, pet: 3 });
  three.visits.push({ t: at(17), acts: acts({ clean: 12 }) });
  const fell3 = tracesOf({ feed: 3369, clean: 2037, pet: 25000 }).pet;
  assert.ok(fell3 > 0.5795 && fell3 < 0.5800, `${fell3}`);
  assert.deepEqual(groundAt(three, at(17)), { ...BARE, pet: 2 });
});

test('a fall through the levels lands where the trace is, all at once', () => {
  const b = Date.UTC(2026, 9, 6), at = d => b + d * DAY;
  // From five footprints to none in one visit: balanced care so plentiful the lean is gone.
  const deep = { ...newLog(b), visits: [{ t: at(15), acts: acts({ feed: 25, clean: 15, pet: 3600 }) }] };
  assert.deepEqual(groundAt(deep, at(15)), { ...BARE, pet: 3 });
  deep.visits.push({ t: at(15) + 60_000, acts: acts({ feed: 2500, clean: 1500 }) });
  assert.deepEqual(groundAt(deep, at(15) + 60_000), BARE, 'not stopping a level or two on the way');
  // From three footprints to just under the first level, where the fall stops: two footprints.
  const half = { ...newLog(b), visits: [{ t: at(15), acts: acts({ feed: 25, clean: 15, pet: 144 }) }] };
  assert.deepEqual(groundAt(half, at(15)), { ...BARE, pet: 2 });
  half.visits.push({ t: at(15) + 60_000, acts: acts({ feed: 20, clean: 12 }) });
  assert.ok(Math.abs(tracesOf({ feed: 45, clean: 27, pet: 144 }).pet - 0.2895) < 0.0001);
  assert.deepEqual(groundAt(half, at(15) + 60_000), { ...BARE, pet: 1 }, 'within 0.02 of the first level, it keeps that one');
  // A living rock: extra petting for its first twenty days, then just what the act line asks.
  // Its path wears down a level at a time as the rest of its care catches up.
  const life = newLog(b);
  for (let t = b + HOUR; t < at(201); t += 8 * HOUR) {
    const body = fullCare(replay(life, t)), sent = t < at(20) ? `${body} pet x20`.trim() : body;
    if (sent) life.visits.push({ t, acts: parseActions(sent).acts });
  }
  // (Its five footprints go at day 60.04, three at 121.04 and two at 296.7: well clear of these.)
  assert.deepEqual([50, 100, 200].map(d => groundAt(life, at(d)).pet), [3, 2, 1]);
});

test('the ground keeps a level reached between visits, as a look saw it, and loses it to a visit', () => {
  // Fed and petted hard every 8h for five days, then left a while: as it grows, its petting
  // trace reaches the first level between visits, and a look shows two footprints. A visit of
  // meals an hour later lowers the trace a little, not by 0.02: its own reply still shows them.
  const b = Date.UTC(2026, 9, 6, 2), log = newLog(b);
  for (let t = b + HOUR; t < b + 5 * DAY; t += 8 * HOUR) log.visits.push({ t, acts: [['feed', 4], ['clean', 1], ['pet', 20], ['pet', 20]] });
  let first = b + 5 * DAY;
  while (first < b + 14 * DAY && groundAt(log, first).pet === 0) first += 10 * 60_000;
  assert.ok(first < b + 14 * DAY, 'the path shows while the ground is still growing');
  assert.ok(first > log.visits.at(-1).t, 'reached between visits');
  const prints = text => grid(text).slice(6, 8).map(row => row.padEnd(W)).map((row, i) => row[[3, 4][i]]);
  const scaled = (visit, t) => tracesOf(careTotals({ visits: [...log.visits, visit] })).pet * (t - b) / (14 * DAY);
  assert.deepEqual(prints(look(log, { now: first + HOUR - 60_000, host: 'h' }).text), [':', ':']);
  const r = act(log, 'feed x20 feed x10', { now: first + HOUR, host: 'h' });
  assert.equal(r.status, 200);
  const after = scaled(r.visit, first + HOUR);
  assert.ok(after > 0.28 && after < 0.3, `the trace after the meal: ${after}`);
  assert.deepEqual(prints(r.text), [':', ':'], 'the reply keeps the path the look showed');
  // A heavier meal lowers it by more than 0.02: the path goes with that visit, and does not come
  // back until the growing trace reaches the level again, more than half a day later.
  const heavy = act(log, 'feed x20 clean x10', { now: first + HOUR, host: 'h' });
  const low = scaled(heavy.visit, first + HOUR);
  assert.ok(low < 0.28, `the trace after the heavier meal: ${low}`);
  assert.deepEqual(prints(heavy.text), [' ', ' '], 'the reply has lost the path');
  const later = { ...log, visits: [...log.visits, heavy.visit] };
  for (const hours of [3, 7, 12]) {
    assert.ok(scaled(heavy.visit, first + (1 + hours) * HOUR) < 0.3);
    assert.deepEqual(prints(look(later, { now: first + (1 + hours) * HOUR, host: 'h' }).text), [' ', ' '], `${hours}h on: not back before its trace is`);
  }
});

test('an early habit does not stamp the ground before it has grown', () => {
  // Petted hard in its first hour, then kept with a little more petting than it needs: its trace
  // settles just under the first level, and it never wore a path. A hard first visit doesn't
  // stamp a ground that hasn't grown (a far harder one would lift the trace itself, and show).
  const b = Date.UTC(2026, 9, 6, 2), log = newLog(b);
  log.visits.push({ t: b + HOUR, acts: [['pet', 20], ['pet', 20]] });
  for (let t = b + 9 * HOUR; t < b + 20 * DAY; t += 8 * HOUR) log.visits.push({ t, acts: [['feed', 5], ['clean', 3], ['pet', 15]] });
  const trace = tracesOf(careTotals(log)).pet;
  assert.ok(trace > 0.28 && trace < 0.3, `${trace}`);
  assert.ok(!replay(log, b + 20 * DAY).dead);
  assert.deepEqual(groundAt(log, b + 20 * DAY), BARE);
  assert.ok(!grid(look(log, { now: b + 20 * DAY, host: 'h' }).text).slice(6, 11).join('').includes(':'));
});

test('care that settles right on a level does not flicker its trace', () => {
  // A busy rock's petting share can settle within a hair of a level. Here visits push the trace
  // just over 0.3 and back under it, again and again.
  const b = Date.UTC(2026, 9, 6), log = { ...newLog(b), visits: [] };
  let care = { feed: 200, clean: 120, pet: 600 }, t = b + 15 * DAY, crossings = 0, last = null, rising = true;
  log.visits.push({ t, acts: acts(care) });
  for (let i = 0; i < 600 && crossings < 20; i++) {
    const trace = tracesOf(care).pet;
    if (rising && trace >= 0.303) rising = false;
    if (!rising && trace <= 0.297) rising = true;
    const add = rising ? { pet: 1 } : { feed: 1, clean: 1 };
    care = Object.fromEntries(Object.entries(care).map(([k, n]) => [k, n + (add[k] ?? 0)]));
    log.visits.push({ t: t += 10 * 60_000, acts: acts(add) });
    const above = tracesOf(care).pet >= 0.3;
    if (last !== null && above !== last) crossings++;
    last = above;
  }
  assert.ok(crossings >= 20, `the trace crossed the level only ${crossings} times`);
  const seen = log.visits.map(v => groundAt(log, v.t).pet);
  const changes = seen.filter((level, i) => i > 0 && level !== seen[i - 1]).length;
  assert.equal(changes, 1, `the path came and went: ${seen.join('')}`);
  assert.equal(seen.at(-1), 1);
});

// A well-kept rock 41 days old, as the model sheet draws it, on whichever drawing; and the same
// rock the day after it has moved a column either way (found, not assumed).
const kept = { ...born(T - 41 * DAY), t: T, lastCare: T - 2 * HOUR, visits: 90, hunger: 2, happy: 6 };
function moved(col, onTheDay = false) {
  for (let b = Date.UTC(2026, 10, 1); ; b += HOUR) {
    for (let d = 30; d < 110; d++) {
      const t = Math.floor(b / DAY) * DAY + d * DAY + 14 * HOUR, p = placeAt(b, t);
      if (p.col === col && (p.from !== null) === onTheDay) return [{ ...born(b), t, lastCare: t - 2 * HOUR, visits: 90, hunger: 2, happy: 6 }, t];
    }
  }
}
const groundRows = (care, drawing = DRAWINGS.lump, [s, now] = [kept, T]) => grid(render(s, { now, host: 'h', drawing, ground: groundOf(care, 41 * DAY) })).slice(5, 11);

test('the ground, drawn: the seven personalities and the first level of each care, on the lump', () => {
  const lump = ' \\________/', none = ['', '', '', '', ''];
  const cases = [
    ['even-tempered', NEED, [lump, ...none]],
    ['comfort-loving: its base sunk in sand', only('feed'), ['............', ...none]],
    ['orderly: three raked lines', only('clean'), [lump, '------------', '------------', '------------', '', '']],
    ['affectionate: five footprints', only('pet'), [lump, '   :', '    :', '   :', '    :', '   :']],
    ['settled: sand over its corners, two raked lines', only('feed', 'clean'), ['..________..', '------------', '------------', '', '', '']],
    ['sociable', only('feed', 'pet'), ['..________..', '   :', '    :', '   :', '', '']],
    ['gentle: footprints step on stones where they cross the raking', only('clean', 'pet'), [lump, '---o--------', '----o-------', '   :', '', '']],
    ['a little more feeding: sand at its foot', times({ feed: 3 }), ['.\\________/.', ...none]],
    ['a little more cleaning: raked under it', times({ clean: 3 }), [lump, ' ----------', '', '', '', '']],
    ['a little more petting: two footprints', times({ pet: 3 }), [lump, '   :', '    :', '', '', '']],
  ];
  for (const [what, care, rows] of cases) assert.deepEqual(groundRows(care), rows, what);
  // Each level of sand looks different, on a narrow rock too.
  const sand = drawing => [times({ feed: 3 }), times({ feed: 4 }), only('feed')].map(care => groundRows(care, drawing)[0]);
  assert.deepEqual(sand(DRAWINGS.lump), ['.\\________/.', '..________..', '............']);
  assert.deepEqual(sand(DRAWINGS.pebble), ["  .'----'.", '....----....', '............']);
});

test('the ground goes where the rock has moved, and a trail lies on top of it', () => {
  const right = moved(1), left = moved(-1);
  assert.deepEqual(groundRows(times({ feed: 3 }), DRAWINGS.lump, right)[0], ' .\\________/', 'sand at its foot, one column over');
  assert.deepEqual(groundRows(times({ feed: 3 }), DRAWINGS.lump, left)[0], '\\________/.');
  assert.deepEqual(groundRows(times({ feed: 3 }), DRAWINGS.pebble, right)[0], "   .'----'.");
  assert.deepEqual(groundRows(times({ feed: 3 }), DRAWINGS.pebble, left)[0], " .'----'.");
  assert.deepEqual(groundRows(only('feed'), DRAWINGS.pebble, right)[0], '............');
  assert.deepEqual(groundRows(only('clean', 'pet'), DRAWINGS.lump, right).slice(1, 4), ['----o-------', '-----o------', '    :'], 'the path moves with it');
  assert.deepEqual(groundRows(only('clean', 'pet'), DRAWINGS.lump, left).slice(1, 4), ['--o---------', '---o--------', '  :']);
  // On the morning it moved, its trail is drawn over the sand: ~ where it slid, never sand.
  for (const col of [1, -1]) {
    const [s, t] = moved(col, true), p = placeAt(s.born, t);
    for (const care of [times({ feed: 4 }), only('feed')]) {
      const row = groundRows(care, DRAWINGS.lump, [s, t])[0], base = DRAWINGS.lump.front[4];
      const trail = p.col > p.from ? [base.search(/\S/) + p.col - 2, base.search(/\S/) + p.col - 1] : [base.trimEnd().length + p.col, base.trimEnd().length + p.col + 1];
      for (const c of trail.filter(c => c >= 0 && c < W)) assert.equal(row[c], '~', `moved ${p.from}>${p.col}: "${row}"`);
    }
  }
});

test("every drawing's back stands on its front's base, which the ground and the trail both read", () => {
  for (const [name, drawing] of Object.entries(DRAWINGS)) assert.equal(drawing.back[4], drawing.front[4], name);
});

// The rock's box drawn into a bare grid, `dx` columns over, as render does.
function boxed(s, now, pose, drawing, dx) {
  const g = Array.from({ length: W }, () => Array(W).fill(' '));
  sprite(s, now, pose, drawing).forEach((row, r) => { for (let c = 0; c < W; c++) if (row[c] !== ' ' && c + dx >= 0 && c + dx < W) g[1 + r][c + dx] = row[c]; });
  return g;
}

test('the ground never covers the rock, its marks, its moss or a mess, and each level holds the last', () => {
  const marked = { ...kept, closeCalls: 3, petted: 3000, fed: 1500 };
  const grave = replay({ born: T, rules: RULES.version, visits: [] }, Infinity);
  const states = [[marked, T], [grave, grave.dead.t + 120 * DAY]];
  const STEPS = [0, 2, 3, 5];
  let buried = 0, corners = 0, stones = 0;
  for (const [name, drawing] of Object.entries(DRAWINGS)) for (const pose of ['front', 'away']) for (const dx of [-1, 0, 1]) for (const [s, now] of states) {
    const rows = pose === 'away' ? drawing.back : drawing.front;
    const outline = c => rows[4][c - dx] ?? ' ';
    const left = rows[4].search(/\S/) + dx, right = rows[4].trimEnd().length - 1 + dx;
    const steps = new Set(PATH.map(([r, c]) => `${r},${c + dx}`));
    for (const messes of [0, 7]) {
      const before = boxed(s, now, pose, drawing, dx);
      for (const [r, col] of MESS_SPOTS.slice(0, messes)) before[r][col] = '@';
      const changed = {};
      for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) for (let p = 0; p < 4; p++) {
        const g = before.map(row => [...row]);
        drawGround(g, { feed: f, clean: c, pet: p }, rows, dx);
        const at = `${name} ${pose} dx ${dx} feed ${f} clean ${c} pet ${p} messes ${messes}${s.dead ? ' grave' : ''}`;
        const cells = new Set(), raked = new Set();
        let prints = 0;
        for (let r = 0; r < W; r++) for (let col = 0; col < W; col++) {
          const was = before[r][col], is = g[r][col];
          if (r >= 6 && (is === ':' || is === 'o')) prints++;
          if (was === is) continue;
          cells.add(`${r},${col}`);
          assert.ok(r >= 5 && r <= 10, `${at}: drew on row ${r}`);
          if (r === 5) {
            assert.equal(is, '.', `${at}: row 5 holds only sand`);
            const corner = col === left || col === right;
            assert.ok(was === ' ' || (was === outline(col) && (f === 3 || (f === 2 && corner))), `${at}: sand over "${was}" at column ${col}`);
            if (was !== ' ') { buried++; if (f === 2) corners++; }
          } else if (is === '-') {
            // The raked floor: one line for each level of cleaning, from the row under it.
            assert.equal(was, ' ', at);
            assert.ok(r - 5 <= c, `${at}: a raked line on row ${r}`);
            raked.add(r);
          } else {
            // A footprint on bare ground, or a stone where it crosses a raked line.
            assert.ok(steps.has(`${r},${col}`), `${at}: a footprint off the path at ${r},${col}`);
            assert.equal(was, ' ', `${at}: "${is}" over "${was}"`);
            assert.ok(is === ':' || (is === 'o' && r - 5 <= c), `${at}: "${is}" at ${r},${col}`);
            if (is === 'o') stones++;
          }
        }
        if (f === 3) assert.ok([...Array(W).keys()].every(col => outline(col) === ' ' || g[5][col] !== outline(col)), `${at}: deep sand covers the whole base`);
        if (messes === 0) assert.equal(prints, STEPS[p], `${at}: footprints`);
        assert.equal(raked.size, c, `${at}: raked lines`);
        changed[`${f}${c}${p}`] = cells;
      }
      // Each level draws everything the level below it drew, and more.
      for (const key of Object.keys(changed)) for (let i = 0; i < 3; i++) {
        if (key[i] === '0') continue;
        const below = key.slice(0, i) + (Number(key[i]) - 1) + key.slice(i + 1);
        for (const cell of changed[below]) assert.ok(changed[key].has(cell), `${name} ${pose} dx ${dx}: ${key} leaves out ${cell}, which ${below} drew`);
      }
    }
  }
  assert.ok(buried > 0 && corners > 0 && stones > 0, 'the cases include a buried base, buried corners and stepping stones');
});

test('the footprints keep off the mess spots a rock is likely to have, wherever it has moved', () => {
  const early = new Set(MESS_SPOTS.slice(0, 14).map(([r, c]) => `${r},${c}`));
  for (const dx of [-1, 0, 1]) for (const [r, c] of PATH) assert.ok(!early.has(`${r},${c + dx}`), `a footprint on a mess spot at ${r},${c + dx}`);
  // So the messes a once-a-day visitor finds leave both of a light path's prints.
  const b = Date.UTC(2026, 9, 6), log = newLog(b);
  for (let t = b + HOUR; t < b + 20 * DAY; t += 24 * HOUR) log.visits.push({ t, acts: [['feed', 4], ['clean', 1], ['pet', 10]] });
  const s = replay(log, b + 20 * DAY);
  assert.ok(s.messes >= 1);
  assert.deepEqual(grid(look(log, { now: b + 20 * DAY, host: 'h' }).text).slice(6, 8).map(row => [row.padEnd(W)[3], row.padEnd(W)[4]]), [[':', ' '], [' ', ':']]);
});

test('a grave keeps the ground it had when it died', () => {
  // Petted hard for six days, then left: it died at eight days old with two footprints, and
  // never wears the five a rock as fond of petting wears once grown.
  const b = Date.UTC(2026, 9, 6), log = newLog(b);
  for (let t = b + HOUR; t < b + 6 * DAY; t += 8 * HOUR) log.visits.push({ t, acts: [['feed', 4], ['clean', 1], ['pet', 20]] });
  const end = replay(log, Infinity).dead;
  assert.ok(end.t - b < 9 * DAY, 'it died young');
  // (Its base row greens over with moss as the months go by; the ground in front stays as it was.)
  const rows = ['   :       @', '  @ :   @', '     @', '         @', ' @'];
  assert.equal(grid(look(log, { now: end.t + HOUR, host: 'h' }).text)[5], DRAWINGS[DRAWING].front[4]);
  for (const later of [HOUR, 30 * DAY, 400 * DAY]) {
    assert.deepEqual(grid(look(log, { now: end.t + later, host: 'h' }).text).slice(6, 11), rows, `${later / DAY} days on`);
  }
  const refused = act(log, 'pet', { now: end.t + HOUR, host: 'h' });
  assert.equal(refused.status, 410);
  assert.deepEqual(grid(refused.text).slice(6, 11), rows, 'and the grave care gets back shows it too');
  // A grave whose life had downtime in it counts only the time it lived: petted hard, then the
  // host was down ten days, and it died three days after. By the calendar it would wear five.
  const down = { ...newLog(b), visits: [{ t: b + HOUR, acts: [['pet', 20], ['pet', 20]] }], outages: [{ start: b + 2 * HOUR, end: b + 10 * DAY, evidence: 'host-1' }] };
  const gone = replay(down, Infinity).dead;
  assert.ok(gone.t > b + 12 * DAY, 'it died after the outage');
  assert.ok(!grid(look(down, { now: gone.t + HOUR, host: 'h' }).text).slice(6, 11).join('').includes(':'), 'bare: it lived three days');
});

test('the game draws the ground from the whole log, the visit just made included, in every reply', () => {
  const b = Date.UTC(2026, 9, 6);
  // Full care in proportion to each need, every 8h for two weeks: its ground is bare.
  const log = newLog(b);
  for (let t = b + HOUR; t < b + 14 * DAY; t += 8 * HOUR) log.visits.push({ t, acts: [['feed', 5], ['clean', 3], ['pet', 7]] });
  const now = b + 14 * DAY + 2 * HOUR, opts = { now, host: 'h' };
  assert.deepEqual(grid(look(log, opts).text).slice(6, 8), ['', '        @']);
  // One visit with 400 pets tips it: two footprints, in that visit's own reply.
  const r = act(log, Array(20).fill('pet x20').join(' '), opts);
  assert.equal(r.status, 200);
  assert.deepEqual(grid(r.text).slice(6, 8), ['   :', '    :   @']);
  const after = { ...log, visits: [...log.visits, r.visit] };
  const seen = grid(look(after, opts).text).slice(5);
  assert.deepEqual(seen, grid(r.text).slice(5), 'and looks after it see the same ground');
  // Every other reply draws it too: a refused body, a refused name, a name given.
  const ground = text => grid(text.split('\n').filter(l => !l.startsWith('error:')).join('\n')).slice(5);
  assert.deepEqual(ground(act(after, 'dance', opts).text), seen, 'a refused act');
  assert.deepEqual(ground(name(after, 'x', opts).text), seen, 'a refused name');
  const named = name(after, 'Basalto', opts);
  assert.equal(named.status, 200);
  assert.deepEqual(ground(named.text), seen, 'a name given');
  // Kept up for three weeks, extra petting wears a path.
  const fond = newLog(b);
  for (let t = b + HOUR; t < b + 20 * DAY; t += 8 * HOUR) fond.visits.push({ t, acts: [['feed', 5], ['clean', 3], ['pet', 20]] });
  assert.deepEqual(groundAt(fond, b + 20 * DAY), { ...BARE, pet: 1 });
  assert.deepEqual(grid(look(fond, { now: b + 20 * DAY, host: 'h' }).text).slice(6, 9).map(row => row.slice(0, 5).trimEnd()), ['   :', '    :', '']);
});
