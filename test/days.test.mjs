// The rock's days (src/character.mjs: occasion, iceTimes; src/wander.mjs) and their edges, held to CHARACTER.md,
// "Its days": what comes first, how often each comes, and that nothing odd happens at either
// extreme. Run in a time zone far from UTC, so a local-time slip in the code shows.
process.env.TZ = 'Pacific/Kiritimati'; // UTC+14

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nature, occasion, iceTimes, slidToday, inDanger, hash } from '../src/character.mjs';
import { whereAt } from '../src/wander.mjs';
import { reaction, remark } from '../src/story.mjs';
import { render, W } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
const D = DRAWINGS[DRAWING];
const EYES = [...D.front.entries()].flatMap(([r, row]) => [...row].flatMap((c, k) => (c === 'E' ? [[r, k]] : [])));
import { replay, born, applyVisit, HOUR } from '../src/engine.mjs';
import { look, act, history, newLog } from '../src/rock.mjs';
import { spawnSync } from 'node:child_process';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 6); // a Tuesday
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const opts = now => ({ now, host: 'rock.test' });
const quirks = text => text.split('\n').filter(l => l.startsWith('quirk: '));
const grid = text => text.split('\n').slice(0, W);
const dayOf = t => Math.floor(t / DAY);

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
    const dx = whereAt(cared, at, D).dx, g = grid(seen);
    for (const [r, c] of EYES) assert.match(g[1 + r][c + dx], /[\^o]/, `${what}: its face, from the front:\n${g.join('\n')}`);
    const fed = { ...born(b), hunger: 10, starvingSince: at - 16 * HOUR, happy: 5, t: at };
    const petted = structuredClone(fed);
    applyVisit(petted, [['pet', 1]]);
    assert.equal(reaction(b, fed, petted), '', `${what}: petted, still starving, no reaction`);
    assert.deepEqual(quirks(act(cared, 'pet', opts(at)).text), [], `${what}: a visit that leaves it starving says nothing`);
  }
});

test('its days come in order: a birthday, then a move, then the wall, then a visitor', () => {
  // A day that is both a slide on the ice and its wall day says it moved; a wall day with a visitor faces the wall.
  let both = null, wallAndVisitor = null;
  for (let b = Date.UTC(2026, 10, 15); (both === null || wallAndVisitor === null) && b < Date.UTC(2026, 10, 15) + 400 * DAY; b += 7 * HOUR) {
    for (let d = 1; d < 120; d++) {
      const t = Math.floor(b / DAY) * DAY + d * DAY + 12 * HOUR;
      if (Math.floor((t - b) / DAY) in { 7: 1, 30: 1, 100: 1 }) continue;
      const wall = new Date(t).getUTCDay() === nature(b).wallDay;
      if (!wall) continue;
      if (both === null && slidToday(b, t, [])) both = [b, t];
      if (wallAndVisitor === null && hash(b, 6, dayOf(t)) % 8 === 0 && !slidToday(b, t, [])) wallAndVisitor = [b, t];
    }
  }
  assert.ok(both && wallAndVisitor, 'found both coincidences');
  const at = ([b, t]) => occasion({ ...born(b), t, lastCare: t - HOUR }, t, [])?.what;
  assert.equal(at(both), 'sailed', 'a move beats the wall');
  assert.equal(at(wallAndVisitor), 'wall', 'the wall beats a visitor');
  const birthdayAndMove = (() => {
    for (let b = Date.UTC(2026, 10, 1); b < Date.UTC(2026, 10, 1) + 2000 * DAY; b += 13 * HOUR) {
      const t = b + 30 * DAY + 13 * HOUR;
      if (slidToday(b, t, [])) return [b, t];
    }
  })();
  assert.equal(at(birthdayAndMove), 'birthday', 'a birthday beats a move');
});

test('a year birthday can fall in a different calendar year than the one before it', () => {
  const b = Date.UTC(2026, 11, 31, 12);
  const at = t => occasion({ ...born(b), t, lastCare: t - HOUR }, t, []);
  assert.deepEqual(at(Date.UTC(2027, 11, 31, 12)), { what: 'birthday', years: 1 });
  assert.deepEqual(at(Date.UTC(2028, 0, 1, 6)), { what: 'birthday', years: 1 }, 'its first birthday runs on into New Year');
  assert.notEqual(at(Date.UTC(2028, 0, 1, 12))?.what, 'birthday');
});

test('it slides on the ice in each of December, January and February, about one day in twenty', () => {
  const months = new Set();
  let winterDays = 0, slides = 0;
  for (let i = 0; i < 300; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 7_919_000;
    for (let d = 1; d <= 150; d++) {
      const t = Math.floor(b / DAY) * DAY + d * DAY + 12 * HOUR;
      const month = new Date(t).getUTCMonth();
      if (month === 11 || month <= 1) winterDays++;
      if (slidToday(b, t, [])) { slides++; months.add(month); }
    }
  }
  assert.deepEqual([...months].sort((a, z) => a - z), [0, 1, 11]);
  assert.ok(slides / winterDays > 0.045 && slides / winterDays < 0.055, `${slides} slides in ${winterDays} winter days`);
  // Once, and how many times, on /history.
  for (let i = 0; ; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 3_600_000;
    const t = Date.UTC(2027, 2, 1);
    if (iceTimes(b, t, []).length !== 1) continue;
    const visits = [];
    for (let at = b + HOUR; at < t; at += 8 * HOUR) visits.push({ t: at, acts: FULL });
    assert.match(history({ ...newLog(b), visits }, opts(t)).text, /^slid on the ice: once$/m);
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
      if (occasion({ ...born(b), t, lastCare: t - HOUR }, t, [])?.what === 'visitor') visitors++;
    }
  }
  assert.ok(visitors / days > 0.095 && visitors / days < 0.117, `${visitors} visitors in ${days} days`);
});

test('these formulas are frozen: the same births slide and wander the same (CHARACTER.md, "Size and staying the same")', () => {
  const b = Date.UTC(2026, 10, 1, 9, 30);
  assert.deepEqual(iceTimes(b, b + 130 * DAY, []).map(t => new Date(t).toISOString().slice(0, 10)), PINNED_SLIDES);
  // Kept every 8h, on the pip (its room is part of the formula): its moves on its ninth and tenth
  // days, where it went and why, a walk to its food among them; and where the ice took it.
  const log = newLog(b);
  for (let t = b + HOUR; t < b + 130 * DAY; t += 8 * HOUR) log.visits.push({ t, acts: FULL });
  const moves = [];
  for (let t = b + 8 * DAY, last = null; t < b + 10 * DAY; t += 60_000) {
    const p = whereAt(log, t, DRAWINGS.pip);
    if (p.at !== last && p.at === t) moves.push(`${new Date(t).toISOString().slice(11, 16)} ${p.from}>${p.dx} ${p.why}`);
    last = p.at;
  }
  assert.deepEqual(moves, PINNED_WANDERS);
  const slides = iceTimes(b, b + 130 * DAY, []).map(t => {
    const p = whereAt(log, t, DRAWINGS.pip);
    assert.deepEqual([p.why, p.at], ['ice', t]);
    return `${new Date(t).toISOString().slice(0, 10)} ${whereAt(log, t - 1, DRAWINGS.pip).dx}>${p.dx}`;
  });
  assert.deepEqual(slides, PINNED_ICE);
});
test('the visitors are frozen too: the same birth has the same visitors on the same days', () => {
  const b = Date.UTC(2026, 10, 1, 9, 30), seen = [];
  for (let d = 1; d <= 60; d++) {
    const t = b + d * DAY + 2 * HOUR;
    const o = occasion({ ...born(b), t, lastCare: t - HOUR }, t, []);
    if (o?.what === 'visitor') seen.push(`${new Date(t).toISOString().slice(0, 10)} ${remark(o).slice(7, -1)}`);
  }
  assert.deepEqual(seen, PINNED_VISITORS);
});
const PINNED_VISITORS = [ // b = 2026-11-01T09:30Z
  "2026-11-28 it is anchoring a spider's thread.", "2026-12-14 it carries a snail's silver trail.",
  "2026-12-21 it carries a snail's silver trail.", "2026-12-23 it is anchoring a spider's thread.",
  "2026-12-24 it is anchoring a spider's thread.", '2026-12-27 it has a beetle living under it.',
];

const PINNED_SLIDES = [ // b = 2026-11-01T09:30Z: the same days its slides came on before it wandered
  '2026-12-01', '2026-12-05', '2026-12-08', '2026-12-19', '2026-12-20', '2027-01-17', '2027-02-09', '2027-02-17',
];
const PINNED_ICE = [ // the same rock kept every 8h: where each slide took it on the pip
  '2026-12-01 -3>0', '2026-12-05 -1>-2', '2026-12-08 -1>-2', '2026-12-19 -1>-2', '2026-12-20 1>-1', '2027-01-17 2>-1', '2027-02-09 0>-1', '2027-02-17 1>0',
];
const PINNED_WANDERS = [ // its ninth and tenth days, on the pip
  '10:30 1>-2 food', '12:46 -2>1 wander', '16:42 1>-2 wander', '21:27 -2>-1 wander', '00:00 -1>3 wander', '06:24 3>-1 wander',
  '10:11 -1>-2 wander', '12:39 -2>0 wander', '23:52 0>-1 wander', '02:04 -1>3 wander', '05:06 3>2 wander',
];

test('its days are the same in every time zone', () => {
  // The same probes, run by four processes in four zones: a local-time slip anywhere differs.
  const probe = `
    const { occasion, slidToday } = await import(${JSON.stringify(new URL('../src/character.mjs', import.meta.url).href)});
    const { born, HOUR } = await import(${JSON.stringify(new URL('../src/engine.mjs', import.meta.url).href)});
    const { whereAt } = await import(${JSON.stringify(new URL('../src/wander.mjs', import.meta.url).href)});
    const { DRAWINGS, DRAWING } = await import(${JSON.stringify(new URL('../src/drawings.mjs', import.meta.url).href)});
    const out = [];
    for (let i = 0; i < 16; i++) {
      const b = Date.UTC(2026, 10, 1) + i * 37 * HOUR + i * 7919;
      const log = { born: b, rules: 1, visits: [] };
      for (let t = b + HOUR; t < b + 30 * 24 * HOUR; t += 8 * HOUR) log.visits.push({ t, acts: [['feed', 4], ['clean', 1], ['pet', 10]] });
      for (let h = 0; h < 24 * 30; h += 7) out.push(whereAt(log, b + h * HOUR, DRAWINGS[DRAWING]).dx);
      const at = t => out.push(JSON.stringify(occasion({ ...born(b), t, lastCare: t - HOUR }, t, [])), slidToday(b, t, []));
      for (let h = 0; h < 24 * 120; h += 5) at(b + h * HOUR);
      for (const k of [1, 2]) for (const h of [-13, -1, 0, 1, 11, 23, 25]) at(Date.UTC(2026 + k, 10, 1) + i * 37 * HOUR + i * 7919 + h * HOUR);
    }
    process.stdout.write(JSON.stringify(out));`;
  const run = TZ => spawnSync(process.execPath, ['--input-type=module', '-e', probe], { env: { ...process.env, TZ }, encoding: 'utf8' });
  const zones = ['UTC', 'Etc/GMT+12', 'Pacific/Kiritimati', 'America/New_York'];
  const results = zones.map(z => { const r = run(z); assert.equal(r.status, 0, r.stderr); return r.stdout; });
  assert.ok(JSON.parse(results[0]).length > 5000);
  for (let i = 1; i < zones.length; i++) assert.equal(results[i], results[0], `${zones[i]} differs from UTC`);
});

test('/history counts only the moves made before death (review round 3)', () => {
  let b = Date.UTC(2026, 10, 1);
  const graveOf = g => replay(newLog(g), Infinity);
  while (iceTimes(b, graveOf(b).dead.t + 120 * DAY, []).length === iceTimes(b, graveOf(b).dead.t, []).length) b += 3 * HOUR;
  const slides = iceTimes(b, graveOf(b).dead.t, []).length;
  assert.match(history(newLog(b), { now: graveOf(b).dead.t + 120 * DAY }).text, new RegExp(`^slid on the ice: ${slides === 1 ? 'once' : `${slides} times`}$`, 'm'));
});

test('choosing a line never writes to the rock it describes', () => {
  const freeze = o => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
  for (const o of [{ happy: 0 }, { hunger: 6, messes: 2 }, { happy: -10, sorrowSince: T - 5 * HOUR }, { happy: -10, sorrowSince: T - DAY }]) {
    const before = { ...born(T), t: T, visits: 4, ...o };
    const after = structuredClone(before);
    applyVisit(after, FULL);
    freeze(before); freeze(after);
    assert.match(reaction({ ...newLog(T), visits: [{ t: T, acts: FULL }] }, before, after), /^quirk: it /, JSON.stringify(o));
  }
});
