// The rock's character: its nature (src/character.mjs), its lines (src/story.mjs) and how it is
// drawn (src/screen.mjs), held to the rules CHARACTER.md gives it. None of it may change the game.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nature, occasion, iceTimes, slidToday, inDanger, KINDS } from '../src/character.mjs';
import { whereAt, roomOf, furrowShows } from '../src/wander.mjs';
import { mossAt } from '../src/marks.mjs';
import { groundAt } from '../src/ground.mjs';
import { mealAt } from '../src/meal.mjs';
import { NAMED } from '../src/name.mjs';
import { reaction, remark, LINES } from '../src/story.mjs';
import { render, W } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { replay, born, applyVisit, HOUR } from '../src/engine.mjs';
import { look, act, history, newLog, creditOutage } from '../src/rock.mjs';
import { parseActions } from '../src/parse.mjs';
import { RULES } from '../src/rules.mjs';
import { sheet } from '../tools/model-sheet.mjs';

const DAY = 24 * HOUR, MIN = 60_000;
const T = Date.UTC(2026, 9, 6); // a Tuesday; this rock faces the wall on Tuesdays
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const opts = now => ({ now, host: 'rock.test' });
const quirks = text => text.split('\n').filter(l => l.startsWith('quirk: '));
const grid = text => text.split('\n').slice(0, W);
// The drawing the screen uses, so these tests hold whichever one the owner picks.
const D = DRAWINGS[DRAWING];
const EYE_ROW = D.front.findIndex(r => r.includes('E')); // a box row; the screen row is one more
const faceOf = (eye, faintly = false) => (faintly ? D.faint : D).front[EYE_ROW].replaceAll('E', eye);
const BASE_LEFT = D.front[4].search(/\S/), BASE_RIGHT = D.front[4].trimEnd().length - 1;
const baseAt = row => row.search(/[^ .,"~]/); // where a base row's outline starts, past moss, sand and furrow
// Where the game draws the rock with this log at t (wander.mjs), a row of its drawing moved there,
// and a screen's rock rows (2-5) without the furrow of its last move.
const dxOf = (log, t) => { const s = replay(log, t); return whereAt(log, s.dead ? s.dead.t : t, D).dx; };
const shift = (row, dx) => (dx >= 0 ? ' '.repeat(dx) + row : row.slice(-dx)).trimEnd();
const rockRows = text => grid(text).slice(2, 6).map(row => row.replaceAll('~', ' ').trimEnd());


function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random lives with random care, looked at and acted on at random moments, in every season.
function lives(n, seed) {
  const rnd = mulberry(seed), VERBS = ['feed', 'clean', 'pet'], out = [];
  for (let i = 0; i < n; i++) {
    const b = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 365 * DAY);
    const visits = [];
    for (let t = b + HOUR; t < b + 20 * DAY; t += HOUR * (1 + rnd() * (rnd() < 0.15 ? 60 : 16))) {
      visits.push({ t: Math.round(t), acts: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => [VERBS[Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 6)]) });
    }
    const now = b + Math.floor(rnd() * 22 * DAY);
    const log = { ...newLog(b), visits: visits.filter(v => v.t <= now) };
    log.visits = log.visits.slice(0, replay(log, Infinity).visits); // a dead rock takes no visits
    out.push({ log, now });
  }
  return out;
}

test("a rock's nature is fixed at its birth, and every nature is born about as often", () => {
  assert.deepEqual(nature(T), nature(T));
  const counts = { kind: {}, wallDay: {} };
  const N = 2100;
  for (let i = 0; i < N; i++) {
    const n = nature(T + i * 7_777_777);
    for (const k of Object.keys(counts)) counts[k][n[k]] = (counts[k][n[k]] ?? 0) + 1;
  }
  for (const [k, size] of [['kind', KINDS.length], ['wallDay', 7]]) {
    assert.equal(Object.keys(counts[k]).length, size, k);
    for (const [v, c] of Object.entries(counts[k])) assert.ok(c > (N / size) * 0.7 && c < (N / size) * 1.3, `${k} ${v}: ${c} of ${N}`);
  }
});

test('a close call is being brought back after a day or more at an extreme; it leaves a vein', () => {
  const visit = (o, acts) => { const s = { ...born(T), t: T + 100 * HOUR, ...o }; applyVisit(s, acts); return s; };
  const at = (o, acts) => visit(o, acts).closeCalls;
  const t = T + 100 * HOUR;
  assert.equal(at({ happy: -10, sorrowSince: t - DAY + 1 }, [['pet', 1]]), 0, 'a millisecond short of a day');
  assert.equal(at({ happy: -10, sorrowSince: t - DAY }, [['pet', 1]]), 1);
  assert.equal(at({ hunger: 10, starvingSince: t - DAY }, [['feed', 1]]), 1);
  assert.equal(at({ hunger: 10, starvingSince: t - DAY, happy: -10, sorrowSince: t - DAY }, FULL), 1, 'one visit, one close call');
  assert.equal(at({ happy: -10, sorrowSince: t - 2 * DAY + 1 }, [['clean', 1]]), 0, 'not brought back');
  assert.equal(at({ hunger: 10, starvingSince: t - 2 * DAY + 1 }, [['pet', 1]]), 0, 'petted, but still starving');
  // Lifted off one extreme while the other runs on, it has not been saved yet: the close call
  // counts once, at the visit that ends the stretch (review round 1).
  const half = visit({ hunger: 10, starvingSince: t - 30 * HOUR, happy: -10, sorrowSince: t - 30 * HOUR }, [['pet', 1]]);
  assert.deepEqual([half.closeCalls, half.brink], [0, true], 'petted, but still starving: not yet');
  const whole = { ...half, t: t + HOUR };
  applyVisit(whole, [['feed', 4]]);
  assert.deepEqual([whole.closeCalls, whole.brink], [1, false], 'then fed: one close call for the stretch');
  const sandbox = (...visits) => replay({ ...newLog(T), visits }, Infinity);
  const low = replay(newLog(T), Infinity).sorrowSince; // nobody comes: it reaches -10 here, and starves from 24h
  const pets = { t: low + 30 * HOUR, acts: [['pet', 10]] }; // at -10 for 30h, starving all the while
  assert.ok(pets.t < T + 72 * HOUR && low > T + 18 * HOUR, 'alive, and starving, when the pets come');
  assert.equal(sandbox(pets, { t: pets.t + HOUR, acts: [['feed', 4]] }).closeCalls, 1, 'one vein, not two');
  const grave = sandbox(pets);
  assert.deepEqual([grave.dead?.cause, grave.closeCalls], ['hungry', 0], 'a rock that died before it was saved keeps no vein');
  const r1 = act({ ...newLog(T), visits: [pets] }, 'feed x4', opts(pets.t + HOUR));
  assert.deepEqual(quirks(r1.text), ['quirk: it was nearly lost. a vein seals the crack.'], 'its first vein, not "again"');
  // Through the game: nobody comes until happiness has been at -10 for a day.
  const floor = replay(newLog(T), Infinity).sorrowSince;
  const visitAt = v => ({ ...newLog(T), visits: [{ t: v, acts: FULL }] });
  assert.equal(replay(visitAt(floor + DAY - MIN), Infinity).closeCalls, 0);
  const log = visitAt(floor + DAY);
  assert.equal(replay(log, floor + DAY).closeCalls, 1);
  const r = act(newLog(T), 'feed x4 clean pet x10', opts(floor + DAY));
  assert.deepEqual(quirks(r.text), ['quirk: it was nearly lost. a vein seals the crack.']);
  const g = grid(r.text);
  const [vr, vc, vm] = D.veins[0], veined = D.front[vr].padEnd(W).split('');
  veined[vc] = vm;
  assert.equal(g[1 + vr], shift(veined.join(''), dxOf({ ...newLog(T), visits: [r.visit] }, floor + DAY)), 'the vein');
  assert.match(history(log, opts(floor + DAY + HOUR)).text, /^close calls: 1 \(up to three veins shown\)$/m);
  // Three veins are drawn, in the drawing's three vein slots; more are counted, not drawn.
  const later = floor + DAY + HOUR, s = replay(log, later);
  const drawn = n => grid(render({ ...s, closeCalls: n }, { now: later, host: 'x' }));
  const veins = n => { const g = drawn(n); return D.veins.filter(([r, c, mark]) => g[1 + r][c] === mark).length; };
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(veins), [0, 1, 2, 3, 3, 3]);
  assert.deepEqual(drawn(9), drawn(3), 'nothing more is drawn after three');
});

test('it faces the wall on its weekday, for someone who only looks; care turns it round', () => {
  assert.equal(nature(T).wallDay, new Date(T).getUTCDay());
  const log = { ...newLog(T), visits: [{ t: T + HOUR, acts: FULL }] };
  const seen = look(log, opts(T + 3 * HOUR));
  assert.deepEqual(quirks(seen.text), ['quirk: it is facing the wall today.']);
  assert.deepEqual(rockRows(seen.text), D.back.slice(1).map(row => shift(row, dxOf(log, T + 3 * HOUR))), 'from behind: its back, no face');
  const r = act(log, 'pet', opts(T + 5 * HOUR));
  assert.equal(grid(r.text)[1 + EYE_ROW], shift(faceOf('^'), dxOf({ ...log, visits: [...log.visits, r.visit] }, T + 5 * HOUR)), 'it turns round for care');
  assert.equal(quirks(r.text).length, 1);
  assert.ok(!r.text.includes('wall'), r.text);
  const wednesday = T + 30 * HOUR, cared = { ...log, visits: [...log.visits, { t: T + 28 * HOUR, acts: FULL }] };
  assert.equal(occasion(replay(cared, wednesday), wednesday, []), null);
  assert.equal(grid(look(cared, opts(wednesday)).text)[1 + EYE_ROW], shift(faceOf('^'), dxOf(cared, wednesday)), 'the next day it faces out');
  // At an extreme it does nothing odd, on any day.
  const floor = replay(newLog(T), Infinity).sorrowSince;
  assert.equal(new Date(floor + MIN).getUTCDay(), nature(T).wallDay, 'still its day when it reaches the floor');
  const sad = look(newLog(T), opts(floor + MIN)).text;
  assert.deepEqual(quirks(sad), []);
  assert.equal(grid(sad)[1 + EYE_ROW], shift(faceOf('T', true), dxOf(newLog(T), floor + MIN)), 'hungry by then too, so drawn faint');
});

test('on a few winter mornings the ice slides it to another spot, and its furrow shows all that day', () => {
  let slides = 0;
  for (let i = 0; i < 60; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 3_333_333;
    for (const t of iceTimes(b, b + 150 * DAY, [])) {
      slides++;
      const month = new Date(t).getUTCMonth();
      assert.ok(month === 11 || month <= 1, `only in winter, not month ${month}`);
      assert.equal(t % DAY, 10 * HOUR, 'at 10:00 UTC, late morning by its own clock');
      assert.ok(Math.floor(t / DAY) > Math.floor(b / DAY), 'not on the day it was born');
      assert.ok(slidToday(b, t, []) && !slidToday(b, t - 1, []) && slidToday(b, t + 13 * HOUR, []) && !slidToday(b, t + 14 * HOUR, []), 'that day, from 10:00');
    }
  }
  assert.ok(slides > 150 && slides < 450, `${slides} slides over 60 winters (about 270 expected)`);
  // On the screen: a rock kept every 8h, on a morning it slid.
  const b = Date.UTC(2026, 10, 1);
  const care = until => { const v = []; for (let at = b + HOUR; at < until; at += 8 * HOUR) v.push({ t: at, acts: FULL }); return v; };
  const t = iceTimes(b, b + 120 * DAY, []).find(at => ![7, 30, 100].includes(Math.floor((at - b) / DAY)));
  const log = { ...newLog(b), visits: care(t + 15 * HOUR) };
  const before = whereAt(log, t - 1, D), after = whereAt(log, t, D);
  assert.notEqual(after.dx, before.dx, 'the ice always takes it somewhere else');
  assert.deepEqual([after.why, after.at, after.from], ['ice', t, before.dx]);
  // Its furrow: the cells its base swept, sliding a column at a time, less those it covers now.
  const swept = new Set();
  for (let x = after.from; x !== after.dx; x += Math.sign(after.dx - after.from)) for (let c = BASE_LEFT + x; c <= BASE_RIGHT + x; c++) swept.add(c);
  for (let c = BASE_LEFT + after.dx; c <= BASE_RIGHT + after.dx; c++) swept.delete(c);
  const furrow = [Math.min(...swept), Math.max(...swept)];
  assert.equal(swept.size, furrow[1] - furrow[0] + 1, 'one stretch');
  for (const later of [MIN, 9 * HOUR, 14 * HOUR - MIN]) {
    const g = grid(look(log, opts(t + later)).text).map(row => row.padEnd(W));
    assert.equal(whereAt(log, t + later, D).dx, after.dx, 'it rests where the ice left it, all that day, fed or not');
    assert.equal(baseAt(g[5]), BASE_LEFT + after.dx, `the base: "${g[5]}"`);
    const marked = [...g[5]].flatMap((ch, c) => (ch === '~' ? [c] : []));
    assert.deepEqual(marked, Array.from({ length: furrow[1] - furrow[0] + 1 }, (_, k) => furrow[0] + k), `its furrow, the ground its base slid off: "${g[5]}"`);
  }
  assert.deepEqual(quirks(look(log, opts(t + 2 * HOUR)).text), ['quirk: it moved this morning. no one saw it go.']);
  const next = whereAt(log, t + 14 * HOUR, D);
  assert.equal(furrowShows(log, next, t + 14 * HOUR), next.at > t && next.at > t + 14 * HOUR - HOUR, 'the next day, only a fresh move shows a furrow');
  // It does not move after it dies: its grave stays where it died, with no furrow.
  let gone = b;
  const graveOf = g => replay(newLog(g), Infinity);
  while (iceTimes(gone, graveOf(gone).dead.t + 120 * DAY, []).length === iceTimes(gone, graveOf(gone).dead.t, []).length) gone += 3 * HOUR;
  const grave = graveOf(gone), still = whereAt(newLog(gone), grave.dead.t, D).dx;
  for (const later of [HOUR, 30 * DAY, 120 * DAY]) {
    const g = grid(look(newLog(gone), opts(grave.dead.t + later)).text);
    assert.equal(baseAt(g[5]), BASE_LEFT + still, `${later / DAY} days on`);
    assert.ok(!g[5].includes('~'), 'no furrow on a grave');
  }
});

test('birthdays: a week, thirty days, a hundred, then each year on the date', () => {
  const at = (b, t) => occasion({ ...born(b), t, lastCare: t - HOUR }, t, []);
  const day = (b, t, o) => {
    assert.deepEqual(at(b, t), o);
    assert.deepEqual(at(b, t + DAY - 1), o, 'all that day');
    assert.notEqual(at(b, t - 1)?.what, 'birthday', 'not the day before');
    assert.notEqual(at(b, t + DAY)?.what, 'birthday', 'nor after');
  };
  for (const days of [7, 30, 100]) day(T, T + days * DAY, { what: 'birthday', days });
  // Years fall on the date, leap years or not: its second birthday is 731 days on.
  for (const years of [1, 2, 10]) day(T, Date.UTC(2026 + years, 9, 6), { what: 'birthday', years });
  const leapling = Date.UTC(2028, 1, 29, 12); // in other years, 1 March
  day(leapling, Date.UTC(2029, 2, 1, 12), { what: 'birthday', years: 1 });
  day(leapling, Date.UTC(2032, 1, 29, 12), { what: 'birthday', years: 4 });
  assert.equal(remark({ what: 'birthday', days: 7 }), 'quirk: it is one week old today.\n');
  assert.equal(remark({ what: 'birthday', years: 1 }), 'quirk: it is one year old today.\n');
  assert.equal(remark({ what: 'birthday', years: 2 }), 'quirk: it is two years old today.\n');
  assert.equal(remark({ what: 'birthday', years: 12 }), 'quirk: it is 12 years old today.\n');
});

test('after care, one line: a close call, then a round number of visits, then recovery', () => {
  const at = (b, o, acts) => {
    const before = { ...born(b), t: T, hunger: 5, happy: 0, messes: 1, visits: 4, ...o };
    const after = structuredClone(before);
    applyVisit(after, acts);
    return reaction({ ...newLog(b), visits: [{ t: T, acts }] }, before, after);
  };
  const sad = { happy: -10, sorrowSince: T - 5 * HOUR };
  assert.equal(at(T, { ...sad, sorrowSince: T - DAY }, FULL), 'quirk: it was nearly lost. a vein seals the crack.\n');
  assert.equal(at(T, { ...sad, sorrowSince: T - DAY, closeCalls: 1 }, FULL), 'quirk: it nearly broke again. a new vein seals it.\n');
  assert.equal(at(T, { ...sad, sorrowSince: T - DAY, visits: 99 }, FULL), 'quirk: it was nearly lost. a vein seals the crack.\n', 'a close call first');
  assert.equal(at(T, { ...sad, visits: 99 }, FULL), 'quirk: it has had a hundred visits now.\n', 'then the round number');
  assert.match(at(T, sad, FULL), /^quirk: it (is slowly coming round|had gone very still, even for a rock|warms slowly, the way stone does)\.\n$/);
  assert.match(at(T, { hunger: 10, starvingSince: T - HOUR }, FULL), /^quirk: it (was very hungry\. it is less so now|eats slowly, all of it)\.\n$/);
  assert.equal(at(T, sad, [['feed', 1]]), '', 'nothing while it is still at an extreme');
  assert.equal(at(T, { hunger: 0, happy: 10, messes: 0 }, FULL), '', 'nothing when nothing changed');

});

test('one line of character at most, and none at an extreme or in death', () => {
  const seen = { dead: 0, danger: 0, well: 0 };
  for (const { log, now } of lives(300, 7)) {
    const s = replay(log, now);
    const q = quirks(look(log, opts(now)).text);
    assert.ok(q.length <= 1, q.join('\n'));
    const state = s.dead ? 'dead' : inDanger(s) ? 'danger' : 'well';
    seen[state]++;
    if (state !== 'well') assert.deepEqual(q, [], `${state}: ${q}`);
    if (!s.dead) assert.ok(quirks(act(log, 'feed x4 clean pet x10', opts(now)).text).length <= 1);
  }
  for (const [state, n] of Object.entries(seen)) assert.ok(n >= 20, `the sample has only ${n} rocks ${state}`);
});

test('a well-kept rock has something to say on about a quarter of looks', () => {
  const rnd = mulberry(5), said = {};
  let looks = 0, spoke = 0;
  for (let i = 0; i < 300; i++) {
    const b = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 365 * DAY);
    const visits = [];
    for (let t = b + HOUR; t < b + 60 * DAY; t += HOUR * (4 + rnd() * 10)) visits.push({ t: Math.round(t), acts: FULL });
    const now = b + Math.floor(rnd() * 60 * DAY);
    const log = { ...newLog(b), visits: visits.filter(v => v.t <= now) };
    if (inDanger(replay(log, now))) continue;
    looks++;
    const o = occasion(replay(log, now), now, log.outages ?? []);
    if (o) { spoke++; said[o.what] = (said[o.what] ?? 0) + 1; }
    assert.equal(quirks(look(log, opts(now)).text).length, o ? 1 : 0);
  }
  assert.ok(looks > 250, `${looks} looks`);
  assert.ok(spoke > looks * 0.15 && spoke < looks * 0.4, `${spoke} of ${looks} looks had a line`);
  for (const what of ['wall', 'visitor']) assert.ok(said[what] >= 10, `${what}: ${said[what]}`);
});

test('every line is in its voice: about it, never to anyone, short and plain', () => {
  const years = Array.from({ length: 30 }, (_, i) => remark({ what: 'birthday', years: i + 1 }).slice(7, -1));
  for (const line of [...LINES, ...years, NAMED]) {
    assert.match(line, /^it [a-z0-9 ,.'-]+\.$/, `starts "it", lowercase plain ASCII, ends with a full stop: ${line}`);
    assert.ok(line.length <= 44, `${line.length} characters: ${line}`);
    assert.ok(!/\b(you|your|please|must|should)\b/.test(line), `asks or addresses: ${line}`);
  }
  assert.equal(new Set(LINES).size, LINES.length, 'no line twice');
});

test('the biography names its kind, its nature, its habit, its close calls and its travels', () => {
  const text = history(newLog(T), opts(T + HOUR)).text;
  assert.match(text, /^kind: a limestone pebble: calcite, with a fossil in it$/m);
  assert.match(text, /^personality: /m);
  assert.ok(!text.includes('nature:'));
  assert.match(text, /^habit: it faces the wall on tuesdays \(utc\)$/m);
  assert.match(text, /^close calls: 0 \(up to three veins shown\)$/m);
  assert.match(text, /^slid on the ice: 0 times$/m);
});

test('a look or a visit stays small', () => {
  const sizes = { look: [], act: [] };
  for (const { log, now } of lives(300, 11)) {
    sizes.look.push(Buffer.byteLength(look(log, opts(now)).text));
    if (!replay(log, now).dead) sizes.act.push(Buffer.byteLength(act(log, 'feed x4 clean pet x10', opts(now)).text));
  }
  for (const [what, list] of Object.entries(sizes)) {
    list.sort((a, b) => a - b);
    console.log(`  ${what} bytes: median ${list[list.length >> 1]}, largest ${list.at(-1)}`);
    assert.ok(list.at(-1) < 450, `${what}: ${list.at(-1)} bytes`);
  }
});

// A look, or an accepted visit's reply, composed as rock.mjs composes them, for any drawing,
// mix of ground levels and place (rock.mjs draws only the owner's drawing, and the rock's own
// ground and place).
function sendings(log, now, body = null) {
  const s = replay(log, now);
  const visited = body && { ...log, visits: [...log.visits, { t: now, acts: parseActions(body).acts }] };
  const seen = visited ? replay(visited, now) : s, o = visited ? null : occasion(s, now, log.outages ?? []);
  const tail = visited ? reaction(visited, s, seen) : remark(o);
  return (host, drawing, ground, place) => render(seen, {
    now, host, pose: o?.what === 'wall' ? 'away' : 'front', name: log.name?.name ?? null, drawing, outages: log.outages ?? [], ground, meal: mealAt(visited || log, now), place,
  }) + tail + `history: ${host}/history\n`;
}
const placeOf = (log, now, drawing) => { const p = whereAt(log, now, drawing); return { dx: p.dx, from: p.from, furrow: furrowShows(log, p, now) }; };
// The largest over every drawing, every mix of ground levels, and every place its room allows, with
// no furrow or with the longest (from the far end of its room).
const largestOf = (send, host) => {
  let all = 0, reached = 0;
  for (const drawing of Object.values(DRAWINGS)) {
    const { min, max } = roomOf(drawing), places = [];
    for (let dx = min; dx <= max; dx++) places.push({ dx, from: null, furrow: false }, { dx, from: dx - min > max - dx ? min : max, furrow: dx !== min || max !== min });
    for (const place of places) for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) for (let p = 0; p < 4; p++) {
      const n = Buffer.byteLength(send(host, drawing, { feed: f, clean: c, pet: p }, place));
      const [b, a] = [f, c, p].sort((x, y) => x - y).slice(1);
      all = Math.max(all, n);
      if ([f, c, p].includes(0) && !(a === 3 && b >= 2)) reached = Math.max(reached, n); // the 28 mixes care can reach
    }
  }
  return [all, reached];
};

test('the largest look and reply known, each from a real life, stay under 450 up to a 20-character host', () => {
  const FULL_ = [['feed', 4], ['clean', 1], ['pet', 10]], HALF = 12 * HOUR;
  // A reply: unnamed, kept in full every 8h for about 1,066 days, then left to a bot that only pets
  // (pet x10 every 20 minutes). It starves from a day after, and its messes pile up to six. Then
  // someone sends "feed": a close call ends (a 43-character line), it is faint at hunger 7 and
  // eating, and its act line asks for "feed x3 clean pet x10".
  const b1 = Date.UTC(2023, 0, 1, 0, 30), last1 = Math.floor((b1 + 1066 * DAY) / HALF) * HALF + HALF - MIN, now1 = last1 + 60 * HOUR + 30 * MIN;
  const kept = newLog(b1);
  for (let t = b1 + HOUR; t < last1 - 8 * HOUR; t += 8 * HOUR) kept.visits.push({ t, acts: FULL_ });
  kept.visits.push({ t: last1, acts: FULL_ });
  for (let t = last1 + HOUR; t <= now1 - 15 * MIN; t += 20 * MIN) kept.visits.push({ t, acts: [['pet', 10]] });
  // A look: unnamed, about three years old, on a morning it slid on the ice (a 40-character line),
  // 18 hours after a visit that fed it a little and petted it, its last cleans skipped, so two
  // messes and moss are on it.
  const b2 = 1671131460000, now2 = 1765484241974, last2 = 1765418373895, left = newLog(b2);
  for (let t = b2 + HOUR; t < last2 - 8 * HOUR; t += 8 * HOUR) left.visits.push({ t, acts: t > last2 - HALF ? [['feed', 4], ['pet', 10]] : FULL_ });
  left.visits.push({ t: last2, acts: [['feed', 2], ['pet', 10]] });
  assert.deepEqual(occasion(replay(left, now2), now2, []), { what: 'sailed' });
  // The same kind of look after 1,166 days of credited host downtime ("last care 1166d ago"),
  // found in review round 2: kept for 340 days, its last cleans skipped (two messes), last fed and
  // petted at 16:49. The host goes down at 01:38, after the 00:00 mess, and is back at 09:25 on an
  // icy morning, before the ice at 10:00, which doesn't slide it while the host is down; the look
  // comes at 12:36, after the 12:00 mess. So four messes, moss after 12 hours of its life alone,
  // and the morning's remark.
  const b3 = 1667812192732, now3 = 1798029390112, last3 = 1697215750479, gone = newLog(b3);
  for (let t = b3 + HOUR; t < b3 + 340 * DAY; t += 8 * HOUR) gone.visits.push({ t, acts: t > b3 + 340 * DAY - HALF ? [['feed', 4], ['pet', 10]] : FULL_ });
  gone.visits.push({ t: last3, acts: [['feed', 4], ['pet', 10]] });
  const outage = creditOutage(gone, { start: 1697247502683, end: 1798017935409, evidence: 'host-1' }, { now: 1798017935409 });
  const down = { ...gone, outages: [outage] };
  assert.deepEqual([replay(down, now3).messes, occasion(replay(down, now3), now3, down.outages)], [4, { what: 'sailed' }]);
  const [a, z, d] = [[427, 423], [427, 416], [433, 427]];
  const cases = [['a reply', sendings(kept, now1, 'feed'), a], ['a look', sendings(left, now2), z], ['a look after downtime', sendings(down, now3), d]];
  // What they compose is what the game sends.
  const host = 'rockpet.example';
  const fed = { ...kept, visits: [...kept.visits, { t: now1, acts: [['feed', 1]] }] };
  assert.equal(cases[0][1](host, D, groundAt(fed, now1), placeOf(fed, now1, D)), act(kept, 'feed', { now: now1, host }).text);
  assert.equal(cases[1][1](host, D, groundAt(left, now2), placeOf(left, now2, D)), look(left, { now: now2, host }).text);
  assert.equal(cases[2][1](host, D, groundAt(down, now3), placeOf(down, now3, D)), look(down, { now: now3, host }).text);
  for (const [what, send, sizes] of cases) {
    assert.deepEqual(largestOf(send, host), sizes, `${what}, with a 15-character host: every ground, then the 28 care can reach`);
    const [most] = largestOf(send, 'x'.repeat(20));
    assert.ok(most < 450, `${what}: ${most} bytes with a 20-character host`);
  }
});

test('the model sheet in CHARACTER.md is what the renderer draws', () => {
  const doc = fs.readFileSync(new URL('../CHARACTER.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  assert.ok(doc.includes(sheet()), 'CHARACTER.md is out of date: paste the output of node tools/model-sheet.mjs into it');
});

test('the character only reads the rock: drawing it and describing it never change it', () => {
  // Modules run in strict mode, so a write to a frozen state throws.
  const freeze = o => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
  for (const { log, now } of lives(100, 3)) {
    const s = freeze(replay(log, now));
    const before = JSON.stringify(s);
    for (const pose of ['front', 'away']) render(s, { now, host: 'x', pose, ground: groundAt(log, now), meal: mealAt(log, now) });
    remark(occasion(s, now, log.outages ?? []));
    mossAt(s, now);
    reaction(log, s, s);
    assert.equal(JSON.stringify(s), before);
    assert.ok(Number.isInteger(s.closeCalls) && s.closeCalls >= 0 && s.closeCalls <= s.visits);
  }
  assert.equal(RULES.version, 1, 'no new rules: a log replays exactly as it did');
});
