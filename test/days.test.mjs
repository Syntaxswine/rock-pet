// The rock's days (src/character.mjs: occasion, placeAt) and their edges, held to CHARACTER.md,
// "Its days": what comes first, how often each comes, and that nothing odd happens at either
// extreme. Run in a time zone far from UTC, so a local-time slip in the code shows.
process.env.TZ = 'Pacific/Kiritimati'; // UTC+14

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nature, occasion, placeAt, inDanger, hash } from '../src/character.mjs';
import { reaction } from '../src/story.mjs';
import { render, W } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { replay, born, applyVisit, HOUR } from '../src/engine.mjs';
import { look, act, history, newLog } from '../src/rock.mjs';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 6); // a Tuesday
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const opts = now => ({ now, host: 'rock.test' });
const quirks = text => text.split('\n').filter(l => l.startsWith('quirk: '));
const grid = text => text.split('\n').slice(0, W);
const dayOf = t => Math.floor(t / DAY);
const eyesRow = g => g[4];
const front = { happy: ' /  ^  ^  \\', hungry: ' /  o  o  \\' };

test('the time zone is not UTC, so a local-time slip would show', () => {
  assert.notEqual(new Date(0).getTimezoneOffset(), 0);
});

// A rock cleaned and petted every 6h and never fed: from 24h old it starves, happiness kept up.
function starving(b) {
  const visits = [];
  for (let t = b + 6 * HOUR; t < b + 70 * HOUR; t += 6 * HOUR) visits.push({ t, acts: [['clean', 1], ['pet', 10]] });
  return { ...newLog(b), visits };
}

test('at the hunger extreme, as at the sorrow floor, it has no days and no reactions', () => {
  // Rocks whose wall day, or a visitor's day, falls while they starve at full happiness.
  const found = { wall: null, visitor: null };
  for (let b = T; (found.wall === null || found.visitor === null) && b < T + 2000 * HOUR; b += HOUR) {
    const at = b + 40 * HOUR; // starving since 24h, happiness high
    const wall = new Date(at).getUTCDay() === nature(b).wallDay;
    const visitor = !wall && hash(b, 6, dayOf(at)) % 8 === 0;
    if (wall && found.wall === null) found.wall = b;
    if (visitor && found.visitor === null) found.visitor = b;
  }
  for (const [what, b] of Object.entries(found)) {
    assert.ok(b !== null, `a rock whose ${what} day comes while it starves`);
    const log = starving(b), at = b + 40 * HOUR;
    const s = replay({ ...log, visits: log.visits.filter(v => v.t <= at) }, at);
    assert.ok(s.starvingSince !== null && s.sorrowSince === null && s.happy > 0, `${what}: starving, not sad`);
    const cared = { ...log, visits: log.visits.filter(v => v.t <= at) };
    const seen = look(cared, opts(at)).text;
    assert.deepEqual(quirks(seen), [], `${what}: no line`);
    assert.match(eyesRow(grid(seen)), /^ \/  [\^o]  [\^o]  \\$/, `${what}: its face, from the front`);
    const fed = { ...born(b), hunger: 10, starvingSince: at - 16 * HOUR, happy: 5, t: at };
    const petted = structuredClone(fed);
    applyVisit(petted, [['pet', 1]]);
    assert.equal(reaction(b, fed, petted), '', `${what}: petted, still starving, no reaction`);
    assert.deepEqual(quirks(act(cared, 'pet', opts(at)).text), [], `${what}: a visit that leaves it starving says nothing`);
  }
});

test('its days come in order: a birthday, then a move, then the wall, then a visitor', () => {
  // A day that is both a move and its wall day says it moved; a wall day with a visitor faces the wall.
  let both = null, wallAndVisitor = null;
  for (let b = Date.UTC(2026, 10, 15); (both === null || wallAndVisitor === null) && b < Date.UTC(2026, 10, 15) + 400 * DAY; b += 7 * HOUR) {
    for (let d = 1; d < 120; d++) {
      const t = Math.floor(b / DAY) * DAY + d * DAY + 12 * HOUR;
      if (Math.floor((t - b) / DAY) in { 7: 1, 30: 1, 100: 1 }) continue;
      const wall = new Date(t).getUTCDay() === nature(b).wallDay;
      if (!wall) continue;
      if (both === null && placeAt(b, t).from !== null) both = [b, t];
      if (wallAndVisitor === null && hash(b, 6, dayOf(t)) % 8 === 0 && placeAt(b, t).from === null) wallAndVisitor = [b, t];
    }
  }
  assert.ok(both && wallAndVisitor, 'found both coincidences');
  const at = ([b, t]) => occasion({ ...born(b), t, lastCare: t - HOUR }, t)?.what;
  assert.equal(at(both), 'sailed', 'a move beats the wall');
  assert.equal(at(wallAndVisitor), 'wall', 'the wall beats a visitor');
  const birthdayAndMove = (() => {
    for (let b = Date.UTC(2026, 10, 1); b < Date.UTC(2026, 10, 1) + 2000 * DAY; b += 13 * HOUR) {
      const t = b + 30 * DAY + 13 * HOUR;
      if (placeAt(b, t).from !== null) return [b, t];
    }
  })();
  assert.equal(at(birthdayAndMove), 'birthday', 'a birthday beats a move');
});

test('a year birthday can fall in a different calendar year than the one before it', () => {
  const b = Date.UTC(2026, 11, 31, 12);
  const at = t => occasion({ ...born(b), t, lastCare: t - HOUR }, t);
  assert.deepEqual(at(Date.UTC(2027, 11, 31, 12)), { what: 'birthday', years: 1 });
  assert.deepEqual(at(Date.UTC(2028, 0, 1, 6)), { what: 'birthday', years: 1 }, 'its first birthday runs on into New Year');
  assert.notEqual(at(Date.UTC(2028, 0, 1, 12))?.what, 'birthday');
});

test('it moves in each of December, January and February, about one day in twenty, and leaves two dots', () => {
  const months = new Set();
  let winterDays = 0, moves = 0;
  for (let i = 0; i < 300; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 7_919_000;
    for (let d = 1; d <= 150; d++) {
      const t = Math.floor(b / DAY) * DAY + d * DAY + 12 * HOUR;
      const month = new Date(t).getUTCMonth();
      if (month === 11 || month <= 1) winterDays++;
      if (placeAt(b, t).from !== null) { moves++; months.add(month); }
    }
  }
  assert.deepEqual([...months].sort((a, z) => a - z), [0, 1, 11]);
  assert.ok(moves / winterDays > 0.045 && moves / winterDays < 0.055, `${moves} moves in ${winterDays} winter days`);
  // The trail: the two cells behind its base, where there is room for two; one where there is room for one.
  const d = DRAWINGS[DRAWING], base = d.front[4], left = base.search(/\S/), right = base.trimEnd().length - 1;
  const cases = {};
  for (let i = 0; Object.keys(cases).length < 4 && i < 5000; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 3_600_000;
    for (let day = 1; day < 120; day++) {
      const t = Math.floor(b / DAY) * DAY + day * DAY + 11 * HOUR;
      const p = placeAt(b, t);
      if (p.from === null) continue;
      const key = `${p.from}>${p.col}`;
      if (cases[key]) continue;
      const visits = [];
      for (let at = b + HOUR; at < t; at += 8 * HOUR) visits.push({ t: at, acts: FULL });
      const g = grid(look({ ...newLog(b), visits }, opts(t)).text);
      cases[key] = p.col > p.from ? g[5].slice(0, left + p.col) : g[5].slice(right + p.col + 1);
    }
  }
  assert.equal(cases['0>1'].replace(/^ +/, ''), '..', `moved right from the middle: ${JSON.stringify(cases)}`);
  assert.equal(cases['-1>0'].replace(/^ +/, ''), '.'.repeat(Math.min(2, left)), 'back to the middle from the left');
  assert.equal(cases['0>-1'].trimEnd(), '..', 'moved left from the middle');
  assert.equal(cases['1>0'].trimEnd(), '.'.repeat(Math.min(2, W - 1 - right)), 'back to the middle from the right');
  // Once, and how many times, on /history.
  for (let i = 0; ; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 3_600_000;
    const t = Date.UTC(2027, 2, 1);
    if (placeAt(b, t).moves !== 1) continue;
    const visits = [];
    for (let at = b + HOUR; at < t; at += 8 * HOUR) visits.push({ t: at, acts: FULL });
    assert.match(history({ ...newLog(b), visits }, opts(t)).text, /^moved on its own: once$/m);
    break;
  }
});

test('a small visitor comes on about one day in ten (one in eight, less the days already spoken for)', () => {
  let days = 0, visitors = 0;
  for (let i = 0; i < 200; i++) {
    const b = Date.UTC(2026, 0, 1) + i * 1_790_000_000;
    for (let d = 1; d <= 120; d++) {
      const t = b + d * DAY + (d % 4) * 5 * HOUR;
      days++;
      if (occasion({ ...born(b), t, lastCare: t - HOUR }, t)?.what === 'visitor') visitors++;
    }
  }
  assert.ok(visitors / days > 0.095 && visitors / days < 0.117, `${visitors} visitors in ${days} days`);
});

test('these formulas are frozen: the same births move on the same days (CHARACTER.md, "Size and staying the same")', () => {
  const b = Date.UTC(2026, 10, 1, 9, 30);
  const moves = [];
  for (let d = 1; d <= 130; d++) {
    const t = Math.floor(b / DAY) * DAY + d * DAY + 12 * HOUR;
    const p = placeAt(b, t);
    if (p.from !== null) moves.push(`${new Date(t).toISOString().slice(0, 10)} ${p.from}>${p.col}`);
  }
  assert.deepEqual(moves, PINNED_MOVES);
});
const PINNED_MOVES = [ // b = 2026-11-01T09:30Z
  '2026-12-01 0>-1', '2026-12-05 -1>0', '2026-12-08 0>1', '2026-12-19 1>0',
  '2026-12-20 0>-1', '2027-01-17 -1>0', '2027-02-09 0>1', '2027-02-17 1>0',
];

test('choosing a line never writes to the rock it describes', () => {
  const freeze = o => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
  for (const o of [{ happy: 0 }, { hunger: 6, messes: 2 }, { happy: -10, sorrowSince: T - 5 * HOUR }, { happy: -10, sorrowSince: T - DAY }]) {
    const before = { ...born(T), t: T, visits: 4, ...o };
    const after = structuredClone(before);
    applyVisit(after, FULL);
    freeze(before); freeze(after);
    assert.match(reaction(T, before, after), /^quirk: it /, JSON.stringify(o));
  }
});
