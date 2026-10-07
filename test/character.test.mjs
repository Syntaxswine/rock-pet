// The rock's character: its nature (src/character.mjs), its lines (src/story.mjs) and how it is
// drawn (src/screen.mjs), held to the rules CHARACTER.md gives it. None of it may change the game.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nature, occasion, placeAt, weatherAt, inDanger, KINDS, VOICES } from '../src/character.mjs';
import { reaction, remark, LINES } from '../src/story.mjs';
import { render, W } from '../src/screen.mjs';
import { replay, born, applyVisit, HOUR } from '../src/engine.mjs';
import { look, act, history, newLog } from '../src/rock.mjs';
import { RULES } from '../src/rules.mjs';
import { sheet } from '../tools/model-sheet.mjs';

const DAY = 24 * HOUR, MIN = 60_000;
const T = Date.UTC(2026, 9, 6); // a Tuesday; this rock faces the wall on Tuesdays
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const opts = now => ({ now, host: 'rock.test' });
const quirks = text => text.split('\n').filter(l => l.startsWith('quirk: '));
const grid = text => text.split('\n').slice(0, W);
const marks = rows => rows.join('').split('').filter(c => ".',".includes(c)).length;

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
  const counts = { voice: {}, likes: {}, kind: {}, wallDay: {} };
  const N = 2100;
  for (let i = 0; i < N; i++) {
    const n = nature(T + i * 7_777_777);
    for (const k of Object.keys(counts)) counts[k][n[k]] = (counts[k][n[k]] ?? 0) + 1;
  }
  for (const [k, size] of [['voice', VOICES.length], ['likes', 3], ['kind', KINDS.length], ['wallDay', 7]]) {
    assert.equal(Object.keys(counts[k]).length, size, k);
    for (const [v, c] of Object.entries(counts[k])) assert.ok(c > (N / size) * 0.7 && c < (N / size) * 1.3, `${k} ${v}: ${c} of ${N}`);
  }
});

// The reactions before this build (a6ef9c8): one line per care, the voice by whole seconds of birth.
const OLD = {
  pet: ['it leans into the attention.', 'it seems a little less stone-faced.', 'it holds the warmth for a moment.'],
  clean: ['it admires the empty floor.', 'it settles into its clean corner.', 'it looks pleased with the tidying.'],
  feed: ['it saves an imaginary crumb.', 'it looks comfortably heavier.', 'it considers that a good meal.'],
};

test('a rock born before this build keeps its voice: its old line is still one of its lines', () => {
  const after = (b, care, visits) => {
    const before = { ...born(b), hunger: 5, happy: 0, messes: 1, visits: visits - 1 };
    const s = structuredClone(before);
    applyVisit(s, care === 'pet' ? [['pet', 1]] : care === 'clean' ? [['clean', 1]] : [['feed', 1]]);
    return reaction(b, before, s);
  };
  for (let i = 0; i < 9; i++) {
    const b = T + i * 1000; // successive seconds: each voice three times
    const v = Math.abs(Math.trunc(b / 1000)) % 3;
    for (const care of ['pet', 'clean', 'feed']) {
      const said = new Set();
      for (let visits = 2; visits < 80; visits++) if (visits !== 10) said.add(after(b, care, visits));
      assert.ok(said.has(`quirk: ${OLD[care][v]}\n`), `${care}, voice ${v}: ${[...said]}`);
      for (const other of OLD[care].filter((_, j) => j !== v)) assert.ok(!said.has(`quirk: ${other}\n`), other);
      assert.ok(said.size >= 3, `${care}: some variety (${said.size} lines)`);
    }
  }
});

test('grit settles while nobody comes, and any care brushes it off', () => {
  const grit = h => weatherAt({ ...born(T), t: T + h * HOUR, lastCare: T }, T + h * HOUR).grit;
  assert.deepEqual([0, 11.99, 12, 23.99, 24, 47.99, 48, 70].map(grit), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(weatherAt(born(T), T + 12 * HOUR).grit, 1, 'never cared for: counted from birth');
  const log = { ...newLog(T), visits: [{ t: T + HOUR, acts: [['pet', 1]] }] };
  for (const [h, n] of [[11, 0], [12, 1], [24, 2], [48, 3]]) {
    assert.equal(marks(grid(look(log, opts(T + HOUR + h * HOUR)).text).slice(1, 3)), n, `${h}h`);
  }
  assert.equal(marks(grid(act(log, 'pet', opts(T + 40 * HOUR)).text).slice(1, 3)), 0, 'a visit brushes it off');
});

test('moss creeps over a grave: after a week, a month, a season', () => {
  const s = replay(newLog(T), Infinity); // nobody ever comes
  const moss = d => weatherAt(s, s.dead.t + d).moss;
  assert.deepEqual([0, 7 * DAY - 1, 7 * DAY, 30 * DAY - 1, 30 * DAY, 90 * DAY - 1, 90 * DAY, 900 * DAY].map(moss), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(weatherAt(s, s.dead.t + 90 * DAY).grit, 0, 'no grit on a grave');
  const commas = d => grid(look(newLog(T), opts(s.dead.t + d)).text).join('').split(',').length - 1;
  assert.deepEqual([0, 7 * DAY, 30 * DAY, 90 * DAY].map(commas), [0, 4, 7, 10]);
  assert.match(grid(look(newLog(T), opts(s.dead.t + 90 * DAY)).text)[4], /^ ,        ,$/, 'down its sides, and no face');
});

test('a close call is being brought back after a day or more at an extreme; it leaves a vein', () => {
  const at = (o, acts) => { const s = { ...born(T), t: T + 100 * HOUR, ...o }; applyVisit(s, acts); return s.closeCalls; };
  const t = T + 100 * HOUR;
  assert.equal(at({ happy: -10, sorrowSince: t - DAY + 1 }, [['pet', 1]]), 0, 'a millisecond short of a day');
  assert.equal(at({ happy: -10, sorrowSince: t - DAY }, [['pet', 1]]), 1);
  assert.equal(at({ hunger: 10, starvingSince: t - DAY }, [['feed', 1]]), 1);
  assert.equal(at({ hunger: 10, starvingSince: t - DAY, happy: -10, sorrowSince: t - DAY }, FULL), 1, 'one visit, one close call');
  assert.equal(at({ happy: -10, sorrowSince: t - 2 * DAY + 1 }, [['clean', 1]]), 0, 'not brought back');
  assert.equal(at({ hunger: 10, starvingSince: t - 2 * DAY + 1 }, [['pet', 1]]), 0, 'petted, but still starving');
  assert.equal(at({ hunger: 10, starvingSince: t - 30 * HOUR, happy: -10, sorrowSince: t - 30 * HOUR }, [['pet', 1]]), 1, 'brought back from one');
  // Through the game: nobody comes until happiness has been at -10 for a day.
  const floor = replay(newLog(T), Infinity).sorrowSince;
  const visitAt = v => ({ ...newLog(T), visits: [{ t: v, acts: FULL }] });
  assert.equal(replay(visitAt(floor + DAY - MIN), Infinity).closeCalls, 0);
  const log = visitAt(floor + DAY);
  assert.equal(replay(log, floor + DAY).closeCalls, 1);
  const r = act(newLog(T), 'feed x4 clean pet x10', opts(floor + DAY));
  assert.deepEqual(quirks(r.text), ['quirk: it was nearly lost. a vein seals the crack.']);
  const g = grid(r.text);
  assert.equal(g[3], '  _/ / \\__', 'the vein');
  assert.match(history(log, opts(floor + DAY + HOUR)).text, /^close calls: 1 \(each kept as a vein\)$/m);
  // Three veins are drawn (top, base, shoulder); more are counted, not drawn.
  const later = floor + DAY + HOUR, s = replay(log, later);
  const drawn = n => grid(render({ ...s, closeCalls: n }, { now: later, host: 'x' }));
  const veins = n => { const g = drawn(n); return [g[3][5], g[5][7], g[3][8]].filter(c => c === '/').length; };
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(veins), [0, 1, 2, 3, 3, 3]);
  assert.deepEqual(drawn(9), drawn(3), 'nothing more is drawn after three');
});

test('it faces the wall on its weekday, for someone who only looks; care turns it round', () => {
  assert.equal(nature(T).wallDay, new Date(T).getUTCDay());
  const log = { ...newLog(T), visits: [{ t: T + HOUR, acts: FULL }] };
  const seen = look(log, opts(T + 3 * HOUR));
  assert.deepEqual(quirks(seen.text), ['quirk: it is facing the wall today.']);
  assert.deepEqual(grid(seen.text).slice(2, 6), ['     ___', '  __/   \\_', ' /        \\', ' \\________/'], 'from behind: mirrored, no face');
  const r = act(log, 'pet', opts(T + 5 * HOUR));
  assert.equal(grid(r.text)[4], ' /  ^  ^  \\', 'it turns round for care');
  assert.equal(quirks(r.text).length, 1);
  assert.ok(!r.text.includes('wall'), r.text);
  const wednesday = T + 30 * HOUR, cared = { ...log, visits: [...log.visits, { t: T + 28 * HOUR, acts: FULL }] };
  assert.equal(occasion(replay(cared, wednesday), wednesday), null);
  assert.equal(grid(look(cared, opts(wednesday)).text)[4], ' /  ^  ^  \\', 'the next day it faces out');
  // At an extreme it does nothing odd, on any day.
  const floor = replay(newLog(T), Infinity).sorrowSince;
  assert.equal(new Date(floor + MIN).getUTCDay(), nature(T).wallDay, 'still its day when it reaches the floor');
  const sad = look(newLog(T), opts(floor + MIN)).text;
  assert.deepEqual(quirks(sad), []);
  assert.equal(grid(sad)[4], ' /  T  T  \\');
});

test('it may move on a winter morning, by one column, and leaves a trail that day', () => {
  let moved = 0;
  for (let i = 0; i < 60; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 3_333_333;
    let last = 0;
    for (let d = 1; d < 150; d++) {
      const t = Math.floor(b / DAY) * DAY + d * DAY + 12 * HOUR, p = placeAt(b, t); // each day after the 10:00Z moves
      const early = placeAt(b, t - 2 * HOUR - 1);
      assert.ok(early.from === null && early.col === last, 'until 10:00Z it is where it was');
      if (p.from === null) { assert.equal(p.col, last, 'no move, no change'); continue; }
      moved++;
      const month = new Date(t).getUTCMonth();
      assert.ok(month === 11 || month <= 1, `only in winter, not month ${month}`);
      assert.equal(p.from, last);
      assert.ok([-1, 0, 1].includes(p.col) && Math.abs(p.col - p.from) === 1, JSON.stringify(p));
      last = p.col;
    }
  }
  assert.ok(moved > 150 && moved < 450, `${moved} moves over 60 winters (about 270 expected)`);
  // On the screen: where it is, the trail behind it that day, the line for someone who looks.
  const b = Date.UTC(2026, 10, 1);
  let day = 1;
  while (placeAt(b, b + day * DAY + 12 * HOUR).from === null || [7, 30, 100].includes(day)) day++;
  const t = b + day * DAY + 10 * HOUR, p = placeAt(b, t);
  const care = until => { const v = []; for (let at = b + HOUR; at < until; at += 8 * HOUR) v.push({ t: at, acts: FULL }); return v; };
  const log = { ...newLog(b), visits: care(t) };
  const g = grid(look(log, opts(t)).text);
  assert.equal(g[5].indexOf('\\'), 1 + p.col, `the base, at column ${1 + p.col}: "${g[5]}"`);
  const trail = p.col > p.from ? g[5].slice(0, 1 + p.col) : g[5].slice(11 + p.col);
  assert.match(trail, /^\.+$/, `the trail: "${g[5]}"`);
  assert.deepEqual(quirks(look(log, opts(t)).text), ['quirk: it moved this morning. no one saw it go.']);
  const next = grid(look({ ...log, visits: care(t + 21 * HOUR) }, opts(t + 21 * HOUR)).text);
  assert.equal(next[5].trim().startsWith('.') || next[5].endsWith('.'), placeAt(b, t + 21 * HOUR).from !== null, 'a trail only on the day it moved');
  // It does not move after it dies: a rock that would have moved since, drawn where it died.
  let gone = b;
  const graveOf = g => replay(newLog(g), Infinity);
  while (placeAt(gone, graveOf(gone).dead.t + 120 * DAY).col === placeAt(gone, graveOf(gone).dead.t).col) gone += 3 * HOUR;
  const grave = graveOf(gone), still = placeAt(gone, grave.dead.t).col;
  for (const later of [HOUR, 30 * DAY, 120 * DAY]) {
    assert.equal(grid(look(newLog(gone), opts(grave.dead.t + later)).text)[5].indexOf('\\'), 1 + still, `${later / DAY} days on`);
  }
  // A rock that died on the afternoon it moved: its grave shows no trail.
  let last = Date.UTC(2026, 11, 1);
  while (placeAt(last, graveOf(last).dead.t).from === null) last += HOUR;
  const tomb = graveOf(last);
  assert.ok(!grid(look(newLog(last), opts(tomb.dead.t + MIN)).text)[5].includes('.'), 'no trail on a grave');
});

test('birthdays: a week, thirty days, a hundred, then each year on the date', () => {
  const at = (b, t) => occasion({ ...born(b), t, lastCare: t - HOUR }, t);
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

test('after care, one line: a close call, then a round number of visits, being missed, the care it likes', () => {
  const at = (b, o, acts) => {
    const before = { ...born(b), t: T, hunger: 5, happy: 0, messes: 1, visits: 4, ...o };
    const after = structuredClone(before);
    applyVisit(after, acts);
    return reaction(b, before, after);
  };
  const sad = { happy: -10, sorrowSince: T - 5 * HOUR };
  assert.equal(at(T, { ...sad, sorrowSince: T - DAY }, FULL), 'quirk: it was nearly lost. a vein seals the crack.\n');
  assert.equal(at(T, { ...sad, sorrowSince: T - DAY, closeCalls: 1 }, FULL), 'quirk: it nearly broke again. a new vein seals it.\n');
  assert.equal(at(T, { ...sad, sorrowSince: T - DAY, visits: 99 }, FULL), 'quirk: it was nearly lost. a vein seals the crack.\n', 'a close call first');
  assert.equal(at(T, { ...sad, visits: 99 }, FULL), 'quirk: it has had a hundred visits now.\n', 'then the round number');
  assert.match(at(T, sad, FULL), /^quirk: it (seems to have missed someone|had gone very still, even for a rock|warms slowly, the way stone does)\.\n$/);
  assert.match(at(T, { hunger: 10, starvingSince: T - HOUR }, FULL), /^quirk: it (was very hungry\. it is less so now|eats slowly, all of it)\.\n$/);
  assert.equal(at(T, sad, [['feed', 1]]), '', 'nothing while it is still at an extreme');
  assert.equal(at(T, { hunger: 0, happy: 10, messes: 0 }, FULL), '', 'nothing when nothing changed');
  // The care it likes comes first: a full visit gets the line that care alone would have got.
  const lines = (b, acts) => {
    const said = [];
    for (let visits = 2; visits < 80; visits++) if (visits !== 10) said.push(at(b, { visits: visits - 1 }, acts));
    return said;
  };
  for (const likes of ['feed', 'clean', 'pet']) {
    let b = T;
    while (nature(b).likes !== likes) b += 1000;
    assert.deepEqual(lines(b, FULL), lines(b, [[likes, 1]]), `a rock that likes ${likes === 'pet' ? 'petting' : likes + 'ing'}`);
  }
  // Without what it likes, the order is pet, clean, feed.
  let b = T;
  while (nature(b).likes !== 'feed') b += 1000;
  assert.deepEqual(lines(b, [['clean', 1], ['pet', 1]]), lines(b, [['pet', 1]]));
  b = T;
  while (nature(b).likes !== 'pet') b += 1000;
  assert.deepEqual(lines(b, [['feed', 1], ['clean', 1]]), lines(b, [['clean', 1]]));
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
    const o = occasion(replay(log, now), now);
    if (o) { spoke++; said[o.what] = (said[o.what] ?? 0) + 1; }
    assert.equal(quirks(look(log, opts(now)).text).length, o ? 1 : 0);
  }
  assert.ok(looks > 250, `${looks} looks`);
  assert.ok(spoke > looks * 0.15 && spoke < looks * 0.4, `${spoke} of ${looks} looks had a line`);
  for (const what of ['wall', 'visitor']) assert.ok(said[what] >= 10, `${what}: ${said[what]}`);
});

test('every line is in its voice: about it, never to anyone, short and plain', () => {
  const years = Array.from({ length: 30 }, (_, i) => remark({ what: 'birthday', years: i + 1 }).slice(7, -1));
  for (const line of [...LINES, ...years]) {
    assert.match(line, /^it [a-z0-9 ,.'-]+\.$/, `starts "it", lowercase plain ASCII, ends with a full stop: ${line}`);
    assert.ok(line.length <= 44, `${line.length} characters: ${line}`);
    assert.ok(!/\b(you|your|please|must|should)\b/.test(line), `asks or addresses: ${line}`);
  }
  assert.equal(new Set(LINES).size, LINES.length, 'no line twice');
});

test('the biography names its kind, its nature, its habit, its close calls and its travels', () => {
  const text = history(newLog(T), opts(T + HOUR)).text;
  assert.match(text, /^kind: a limestone pebble: calcite, with a fossil in it$/m);
  assert.match(text, /^nature: curious; it likes being petted best$/m);
  assert.match(text, /^habit: it faces the wall on tuesdays \(utc\)$/m);
  assert.match(text, /^close calls: 0 \(each kept as a vein\)$/m);
  assert.match(text, /^moved on its own: 0 times$/m);
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
    assert.ok(list.at(-1) < 440, `${what}: ${list.at(-1)} bytes`);
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
    for (const pose of ['front', 'away']) render(s, { now, host: 'x', pose });
    remark(occasion(s, now));
    weatherAt(s, now);
    reaction(log.born, s, s);
    assert.equal(JSON.stringify(s), before);
    assert.ok(Number.isInteger(s.closeCalls) && s.closeCalls >= 0 && s.closeCalls <= s.visits);
  }
  assert.equal(RULES.version, 1, 'no new rules: a log replays exactly as it did');
});
