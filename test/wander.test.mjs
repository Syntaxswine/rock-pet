// Where it is (src/wander.mjs; CHARACTER.md, "Where it is"): about once in four hours it moves along
// its ground, to its food if it has just been fed and on its own otherwise; it rests after it moves,
// stays by its food while it eats, holds still at an extreme or while the host is down, slides on
// the ice on a few winter mornings, and lies where it died. Also replayer (src/engine.mjs), which
// it reads. The rules are held on the pip, whose room is part of the formula; the screen's tests
// draw whichever drawing is DRAWING.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whereAt, movesOf, furrowShows, roomOf } from '../src/wander.mjs';
import { replay, replayer, HOUR } from '../src/engine.mjs';
import { activeElapsed } from '../src/outages.mjs';
import { iceTimes, inDanger, occasion, hash } from '../src/character.mjs';
import { mealAt } from '../src/meal.mjs';
import { fullCare, W } from '../src/screen.mjs';
import { parseActions } from '../src/parse.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { look, act, name, history, newLog } from '../src/rock.mjs';

const MIN = 60_000, DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 6, 3); // October: no ice
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const BOT = [['feed', 1], ['clean', 1], ['pet', 1]];
const PIP = DRAWINGS.pip, D = DRAWINGS[DRAWING];
const BLOCK = 4 * HOUR; // spelled out here, not read from wander.mjs
const grid = text => text.split('\n').slice(text.startsWith('error:') ? 1 : 0).slice(0, W);
const iso = t => new Date(t).toISOString().slice(0, 16);
function kept(b, days, every = 8 * HOUR, acts = FULL) {
  const log = newLog(b);
  for (let t = b + HOUR; t < b + days * DAY; t += every) log.visits.push({ t, acts });
  return log;
}
// Its moves after `a` and up to `z`.
const movesIn = (log, a, z, drawing = PIP) => movesOf(log, z, drawing).filter(m => m.at > a);
// An unfed rock's own moves while it is well, in its first 20 hours: wanders, at minutes of its own.
const own = b => movesOf(newLog(b), b + 20 * HOUR, PIP);
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('replayer gives, in one pass, what replay gives at each moment', () => {
  const rnd = mulberry(4), VERBS = ['feed', 'clean', 'pet'];
  for (let i = 0; i < 60; i++) {
    const b = T + Math.floor(rnd() * DAY), log = newLog(b);
    for (let t = b + HOUR; t < b + 9 * DAY; t += HOUR * (0.5 + rnd() * (rnd() < 0.1 ? 60 : 12))) {
      log.visits.push({ t: Math.round(t), acts: [[VERBS[Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 5)]] });
    }
    if (i % 3 === 0) { // downtime after a visit, before the next
      const k = Math.floor(log.visits.length / 2), start = log.visits[k].t + HOUR, end = start + 30 * HOUR;
      log.visits = [...log.visits.slice(0, k + 1), ...log.visits.slice(k + 1).filter(v => v.t >= end)];
      log.outages = [{ start, end, evidence: 'host-1' }];
    }
    const times = [b, ...log.visits.slice(0, 5).map(v => v.t), ...Array.from({ length: 40 }, () => b + Math.floor(rnd() * 12 * DAY)), b + 12 * HOUR, b + 24 * HOUR]
      .sort((a, z) => a - z);
    const at = replayer(log);
    times.forEach((t, k) => assert.deepEqual(at(t), replay(log, t), `rock ${i}, moment ${k}`));
  }
  const at = replayer(newLog(T));
  at(T + HOUR);
  assert.throws(() => at(T), /out of time order/);
});

test('it moves regularly, not nonstop, however often it is visited: about five times a day, once a four-hour block at most', () => {
  // The owner: "not nonstop, just regularly." A bot that feeds every few minutes once froze it,
  // and one every hour made it hop twenty times a day (PR #6, review round 1).
  const paces = [
    ['a bot every 10 minutes', 10 * MIN, BOT], ['a bot every 59 minutes', 59 * MIN, BOT], ['a bot every hour', HOUR, BOT],
    ['a bot every 61 minutes', 61 * MIN, BOT], ['full care every 3 hours', 3 * HOUR, FULL], ['full care every 8 hours', 8 * HOUR, FULL],
    ['full care once a day', DAY, FULL], ['the act line every 10 minutes', 10 * MIN, null],
  ];
  for (const [what, every, acts] of paces) for (const b of [T + 7 * MIN, T + 5 * DAY + 13 * HOUR + 31 * MIN]) {
    const log = newLog(b);
    for (let t = b + 10 * MIN; t < b + 9 * DAY; t += every) {
      if (acts) { log.visits.push({ t, acts }); continue; }
      const body = fullCare(replay(log, t));
      if (body) log.visits.push({ t, acts: parseActions(body).acts });
    }
    const moves = movesIn(log, b + 2 * DAY, b + 9 * DAY);
    const perDay = moves.length / 7, food = moves.filter(m => m.why === 'food').length;
    assert.ok(perDay >= 4 && perDay <= 6, `${what}: ${perDay.toFixed(1)} moves a day`);
    for (let k = 1; k < moves.length; k++) {
      assert.notEqual(Math.floor(moves[k].at / BLOCK), Math.floor(moves[k - 1].at / BLOCK), `${what}: two moves in one block, ${iso(moves[k].at)}`);
      assert.ok(moves[k].at - moves[k - 1].at >= HOUR, `${what}: moves within the hour, ${iso(moves[k].at)}`);
    }
    for (const m of moves) assert.ok(m.to >= -3 && m.to <= 3 && m.to !== m.from, `${what}: ${m.from}>${m.to}`);
    if (every < HOUR) assert.ok(food / moves.length > 0.8, `${what}: a feed takes its chance (${food} of ${moves.length} to food)`);
    if (every === 8 * HOUR) assert.ok(food > 0 && food < moves.length, `${what}: both kinds of move`);
  }
});

test('a feed sends it to its food when it has its chance; else its food falls beside it, and it stays there while it eats', () => {
  const rnd = mulberry(9);
  let went = 0, stayed = 0;
  for (let i = 0; i < 200; i++) {
    const b = T + Math.floor(rnd() * 30 * DAY), log = kept(b, 4);
    const t = b + 4 * DAY + Math.floor(rnd() * 8 * HOUR);
    const fed = { ...log, visits: [...log.visits, { t, acts: [['feed', 1]] }] };
    const before = movesOf(fed, t - 1, PIP), p = whereAt(fed, t, PIP), last = before.at(-1);
    if (p.at === t) {
      went++;
      assert.equal(p.why, 'food');
      assert.ok(!last || t - last.at >= HOUR, 'not while it rests');
      assert.ok(!last || Math.floor(last.at / BLOCK) !== Math.floor(t / BLOCK), 'nor when it has moved already in these four hours');
    } else {
      stayed++;
      assert.equal(p.dx, last?.to ?? 0);
    }
    for (const later of [MIN, 30 * MIN, HOUR - MIN]) assert.equal(whereAt(fed, t + later, PIP).dx, p.dx, `it stays by its food ${later / MIN} minutes on`);
  }
  assert.ok(went > 40 && stayed > 40, `went to its food ${went} times, stayed ${stayed}`);
  // Petting and cleaning send it nowhere: fed every 8 hours, petted and cleaned every hour between.
  const mixed = kept(T, 6);
  for (let t = T + 2 * HOUR; t < T + 6 * DAY; t += HOUR) if ((t - T) % (8 * HOUR) !== HOUR) mixed.visits.push({ t, acts: [['pet', 2], ['clean', 1]] });
  mixed.visits.sort((a, z) => a.t - z.t);
  const careOnly = new Set(mixed.visits.filter(v => !v.acts.some(([verb]) => verb === 'feed')).map(v => v.t));
  const moves = movesIn(mixed, T + 2 * DAY, T + 6 * DAY);
  assert.ok(moves.length > 12, `${moves.length} moves`);
  for (const m of moves) assert.ok(!(m.why === 'food' && careOnly.has(m.at)), `went to food at ${iso(m.at)}, a visit with no food`);
});

test('its rest, its meal and its furrow count the time it has lived: downtime ends none of them', () => {
  // Pairs of its own moves, the second at least two hours after the first.
  const pairs = [];
  for (let b = T; pairs.length < 6; b += 37 * MIN) {
    const ms = own(b);
    for (let k = 1; k < ms.length; k++) if (ms[k].at - ms[k - 1].at >= 2 * HOUR) { pairs.push([b, ms[k - 1], ms[k]]); break; }
  }
  for (const [b, m, w] of pairs) {
    // Fed while it rests, 20 minutes after it moved; then the host goes down 10 minutes into the
    // meal and comes back 35 minutes before its next minute. By then it has rested 65 minutes of
    // its life and eaten for 45: so it stays by its food, though it would have wandered.
    const F = m.at + 20 * MIN, eat = { ...newLog(b), visits: [{ t: F, acts: [['feed', 1]] }], outages: [{ start: F + 10 * MIN, end: w.at - 35 * MIN, evidence: 'host-1' }] };
    assert.ok(mealAt(eat, w.at), `the meal still shows at ${iso(w.at)}`);
    assert.deepEqual(movesOf(eat, w.at, PIP).at(-1), m, `it stays by its food, born ${iso(b)}`);
    // Not fed, and the host down from 10 minutes after the move until 30 minutes before the next:
    // 40 minutes of its life, so it is still resting.
    const rest = { ...newLog(b), outages: [{ start: m.at + 10 * MIN, end: w.at - 30 * MIN, evidence: 'host-1' }] };
    assert.deepEqual(movesOf(rest, w.at, PIP).at(-1), m, `it is still resting, born ${iso(b)}`);
    // Its furrow: the host down from 10 minutes after the move for three hours, then 20 minutes on.
    const down = { ...newLog(b), outages: [{ start: m.at + 10 * MIN, end: m.at + 3 * HOUR, evidence: 'host-1' }] };
    const place = { dx: m.to, from: m.from, at: m.at, why: m.why };
    assert.ok(furrowShows(down, place, m.at + 3 * HOUR + 20 * MIN), 'its furrow shows 30 minutes of its life on');
    assert.ok(!furrowShows(down, place, m.at + 3 * HOUR + 50 * MIN), 'and not an hour on');
  }
  // A walk to its food leaves its furrow for an hour of its life too.
  let walks = 0;
  for (let b = T; walks < 3 && b < T + 10 * DAY; b += 47 * MIN) {
    const F = b + HOUR, fed = { ...newLog(b), visits: [{ t: F, acts: [['feed', 1]] }] }, m = movesOf(fed, F, PIP).at(-1);
    if (!m || m.at !== F) continue; // it must have gone to its food
    const down = { ...fed, outages: [{ start: F + 10 * MIN, end: F + 3 * HOUR, evidence: 'host-1' }] }, place = { dx: m.to, from: m.from, at: m.at, why: m.why };
    assert.equal(m.why, 'food');
    assert.ok(furrowShows(down, place, F + 3 * HOUR + 20 * MIN), `born ${iso(b)}: its furrow 30 minutes of its life after a walk to food`);
    assert.ok(!furrowShows(down, place, F + 3 * HOUR + 50 * MIN), 'and not an hour on');
    walks++;
  }
  assert.equal(walks, 3, 'walks to food with downtime after them');
  // And on the screen: the host down from 10 minutes after a move for three hours; a look 20
  // minutes after it is back shows the furrow, 30 minutes of its life on.
  let shown = 0;
  for (let b = T; shown < 3 && b < T + 10 * DAY; b += 53 * MIN) {
    const m = movesOf(newLog(b), b + 20 * HOUR, D)[0];
    if (!m) continue;
    const down = { ...newLog(b), outages: [{ start: m.at + 10 * MIN, end: m.at + 3 * HOUR, evidence: 'host-1' }] }, t = m.at + 3 * HOUR + 20 * MIN;
    if (whereAt(down, t, D).at !== m.at) continue; // no newer move by then
    assert.ok(grid(look(down, { now: t, host: 'h' }).text)[5].includes('~'), `born ${iso(b)}: the screen's furrow, 30 minutes of its life on`);
    shown++;
  }
  assert.equal(shown, 3, 'looks after downtime with the furrow still showing');
  // The review's case: fed, then the host down 15 minutes into the meal for two hours. Whatever
  // the rock, it doesn't move while its meal shows.
  for (let k = 0; k < 60; k++) {
    const b = T + k * 37 * MIN, log = kept(b, 2);
    const F = log.visits.at(-1).t + 3 * HOUR + 7 * MIN, start = F + 15 * MIN, end = start + 2 * HOUR;
    const down = { ...log, visits: [...log.visits, { t: F, acts: [['feed', 1]] }], outages: [{ start, end, evidence: 'host-1' }] };
    const settled = whereAt(down, F, PIP);
    for (let t = end; mealAt(down, t); t += 5 * MIN) assert.deepEqual(whereAt(down, t, PIP), settled, `born ${iso(b)}: moved mid-meal at ${iso(t)}`);
  }
});

test('at the same moment, the ice comes first, then a feed, then its own minute', () => {
  // A feed at its own minute takes that minute's chance: it goes to its food, not on its own way.
  let found = 0;
  for (let b = T; found < 3 && b < T + 20 * DAY; b += 41 * MIN) {
    const w = own(b)[1];
    if (!w) continue;
    const p = whereAt({ ...newLog(b), visits: [{ t: w.at, acts: [['feed', 1]] }] }, w.at, PIP);
    assert.ok(p.at !== w.at || p.why === 'food', `born ${iso(b)}: ${p.why} at its own minute`);
    if (p.at === w.at) found++;
  }
  assert.equal(found, 3, 'feeds at its own minute that sent it to its food');
  // A feed at 10:00 on an icy morning: the ice slides it from where it was, and its food goes with
  // it. Fed a moment earlier instead, it would have gone to its food first.
  let tied = 0;
  for (let b = Date.UTC(2026, 11, 1); tied < 5 && b < Date.UTC(2027, 1, 1); b += 5 * HOUR) {
    const ice = iceTimes(b, b + 60 * DAY, []).find(t => t > b + 2 * DAY);
    if (!ice) continue;
    const log = kept(b, (ice - b) / DAY, 3 * HOUR);
    const early = { ...log, visits: [...log.visits, { t: ice - 1, acts: [['feed', 1]] }] };
    if (whereAt(early, ice - 1, PIP).at !== ice - 1) continue; // that feed must have sent it to its food
    const at = { ...log, visits: [...log.visits, { t: ice, acts: [['feed', 1]] }] };
    const p = whereAt(at, ice, PIP);
    assert.deepEqual([p.why, p.at, p.from], ['ice', ice, whereAt(at, ice - 1, PIP).dx], `born ${iso(b)}`);
    assert.ok(mealAt(at, ice + MIN), 'eating where the ice took it');
    tied++;
  }
  assert.equal(tied, 5, 'feeds at 10:00 on an icy morning, when a feed a moment sooner would have sent it to its food');
});

test('its meal ends an hour of its life after its feed, to the millisecond: then it may wander', () => {
  // Its own moves m and w in blocks one after the other, w in its block's first hour; fed at w - 1h,
  // after m, so the feed takes no chance (m had its block's) and its meal ends just as w comes.
  let found = 0;
  for (let b = T; found < 3 && b < T + 30 * DAY; b += 31 * MIN) {
    const ms = own(b), k = ms.findIndex((w, i) => i > 0 && Math.floor(w.at / BLOCK) === Math.floor(ms[i - 1].at / BLOCK) + 1 && w.at % BLOCK < HOUR && w.at - HOUR > ms[i - 1].at);
    if (k < 0) continue;
    const w = ms[k], fed = { ...newLog(b), visits: [{ t: w.at - HOUR, acts: [['feed', 1]] }] };
    assert.equal(mealAt(fed, w.at - 1) !== null, true, 'a millisecond before, it is eating');
    assert.deepEqual(movesOf(fed, w.at, PIP).at(-1), w, `born ${iso(b)}: its meal over, it wanders at its minute`);
    found++;
  }
  assert.equal(found, 3);
});

test('its rest ends an hour of its life after it moves, to the millisecond', () => {
  let found = 0;
  for (let b = T; found < 3 && b < T + 30 * DAY; b += 23 * MIN) {
    const ms = own(b);
    // A move in the last hour of its block, so an hour on is in the next block, before that block's own minute.
    const m = ms.find((x, k) => x.at % BLOCK >= 3 * HOUR && (!ms[k + 1] || ms[k + 1].at > x.at + HOUR));
    if (!m) continue;
    const fed = t => ({ ...newLog(b), visits: [{ t, acts: [['feed', 1]] }] });
    const p = whereAt(fed(m.at + HOUR), m.at + HOUR, PIP);
    if (p.at !== m.at + HOUR) continue; // its food must fall elsewhere
    assert.equal(p.why, 'food');
    assert.equal(whereAt(fed(m.at + HOUR - 1), m.at + HOUR - 1, PIP).at, m.at, 'a millisecond sooner it is still resting');
    found++;
  }
  assert.equal(found, 3, 'feeds exactly an hour after a move');
});

test('the feed that brings it back from an extreme may send it to its food; a feed met at the extreme spends no chance', () => {
  // Never visited, at the sorrow floor: in four hours that begin an hour or more after it got
  // there (so it has long stopped resting), fed once, which lifts no sorrow, then half an hour later
  // given a full visit, which brings it back.
  let found = 0;
  for (let b = T; found < 3 && b < T + 20 * DAY; b += 37 * MIN) {
    const floor = replay(newLog(b), Infinity).sorrowSince, k = Math.floor((floor + HOUR) / BLOCK) + 1;
    const t1 = k * BLOCK + 10 * MIN, t2 = t1 + 30 * MIN;
    const log = { ...newLog(b), visits: [{ t: t1, acts: [['feed', 1]] }, { t: t2, acts: FULL }] };
    assert.ok(inDanger(replay(log, t1)) && !inDanger(replay(log, t2)), 'still at the floor after the feed, back after the full visit');
    const p = whereAt(log, t2, PIP), before = whereAt(log, t1, PIP);
    assert.ok(before.at === null || (before.at < floor && t1 - before.at >= HOUR), 'no move at the floor, and long rested by the feed');
    if (p.at !== t2) continue; // its food must fall elsewhere
    assert.equal(p.why, 'food', `born ${iso(b)}`);
    found++;
  }
  assert.equal(found, 3, 'rescues that sent it to its food');
});

test('at an extreme it holds still, starving or in sorrow, and only the ice may move it; a grave lies where it died', () => {
  // Never visited: it reaches the sorrow floor in a day or so, and dies two days later.
  const alone = newLog(T), floor = replay(alone, Infinity).sorrowSince, grave = replay(alone, Infinity).dead;
  assert.ok(floor && grave);
  assert.deepEqual(movesIn(alone, floor, grave.t), [], 'still at the brink');
  for (const later of [MIN, DAY, 400 * DAY]) assert.deepEqual(whereAt(alone, grave.t + later, PIP), whereAt(alone, grave.t, PIP), 'the grave stays put');
  assert.ok(movesIn(alone, T, floor).length > 0, 'it wandered while it was well');
  // Petted but never fed: starving from 24h, cheerful, still, even when someone pets it.
  const starving = kept(T, 3, 6 * HOUR, [['clean', 1], ['pet', 10]]), from = replay(starving, Infinity).dead.t - 47 * HOUR;
  assert.ok(inDanger(replay(starving, from)) && replay(starving, from).sorrowSince === null);
  assert.deepEqual(movesIn(starving, from, from + 40 * HOUR), [], 'no wandering while it starves');
  // Fed and cleaned every 3 hours but never petted: well fed, in sorrow, still, even when fed.
  const sad = kept(T, 6, 3 * HOUR, [['feed', 2], ['clean', 1]]), s = replay(sad, Infinity);
  assert.ok(s.dead && s.dead.cause === 'lonely', JSON.stringify(s.dead));
  const low = replay(sad, s.dead.t - 1).sorrowSince;
  assert.ok(low !== null && replay(sad, s.dead.t - 1).starvingSince === null, 'sorrow alone');
  assert.ok(movesIn(sad, T, low).length > 3, 'it wandered while it was well');
  assert.deepEqual(movesIn(sad, low, s.dead.t), [], 'no wandering, and no walks to its food, in sorrow');
  // A winter rock left alone at the brink: the ice still slides it.
  let shown = null;
  for (let b = Date.UTC(2026, 11, 1); !shown && b < Date.UTC(2027, 1, 1); b += 7 * HOUR) {
    const log = newLog(b), dead = replay(log, Infinity).dead, slide = iceTimes(b, dead.t, []).find(t => inDanger(replay(log, t)));
    if (slide) shown = [log, slide];
  }
  assert.ok(shown, 'found a slide at the brink');
  const [log, slide] = shown;
  assert.notEqual(whereAt(log, slide, PIP).dx, whereAt(log, slide - 1, PIP).dx, 'the ice moves it at the brink');
  assert.equal(whereAt(log, slide, PIP).why, 'ice');
  // One that died the same day it slid: its furrow would still show that day, but a grave has none.
  let tomb = null;
  for (let b = Date.UTC(2026, 11, 1); !tomb && b < Date.UTC(2027, 1, 20); b += 3 * HOUR) {
    const dead = replay(newLog(b), Infinity).dead, last = iceTimes(b, dead.t, []).at(-1);
    if (last && Math.floor(last / DAY) === Math.floor(dead.t / DAY) && dead.t % DAY < DAY - HOUR) tomb = [b, dead.t];
  }
  assert.ok(tomb, 'found a rock that died the day it slid');
  const [born, died] = tomb, end = whereAt(newLog(born), died, D);
  assert.ok(end.why === 'ice' && furrowShows(newLog(born), end, died + MIN), 'by the clock, its furrow would show');
  assert.ok(!grid(look(newLog(born), { now: died + MIN, host: 'h' }).text)[5].includes('~'), 'but a grave shows none');
});

test('the ice always takes it somewhere else; it rests there the rest of that day, and moves again the next', () => {
  let seen = 0;
  for (let b = Date.UTC(2026, 10, 15); seen < 12; b += 11 * HOUR) {
    const t = iceTimes(b, b + 90 * DAY, []).find(at => at > b + 3 * DAY);
    if (!t) continue;
    const log = kept(b, (t - b) / DAY + 3, 3 * HOUR); // fed every three hours, so its food calls too
    const p = whereAt(log, t, PIP);
    assert.equal(p.why, 'ice');
    assert.notEqual(p.dx, whereAt(log, t - 1, PIP).dx);
    const end = (Math.floor(t / DAY) + 1) * DAY;
    for (let later = t; later < end; later += 13 * MIN) {
      const q = whereAt(log, later, PIP);
      assert.deepEqual([q.dx, q.why], [p.dx, 'ice'], `still where the ice left it, ${iso(later)}`);
      assert.ok(furrowShows(log, q, later), 'its furrow shows all that day');
    }
    assert.ok(!furrowShows(log, p, end), 'but not the next');
    const next = movesIn(log, t, end + DAY)[0];
    assert.ok(next && next.at >= end, `it moves again the next day (born ${iso(b)})`);
    seen++;
  }
  // Its rest ends at midnight to the millisecond: its own minute at exactly 00:00 the next day
  // moves it (about one icy morning in 280 is followed by one).
  let midnight = 0;
  for (let i = 0; midnight < 2 && i < 3000; i++) {
    const b = Date.UTC(2026, 10, 1) + i * 7_919_311, log = kept(b, 120);
    const moves = movesOf(log, b + 120 * DAY, PIP);
    for (let k = 1; k < moves.length; k++) {
      const m = moves[k], prev = moves[k - 1];
      if (m.at % DAY === 0 && prev.why === 'ice' && Math.floor(prev.at / DAY) + 1 === m.at / DAY) { assert.equal(m.why, 'wander'); midnight++; }
    }
  }
  assert.equal(midnight, 2, 'moves at the midnight after the ice');
});

test('its furrow shows for an hour after a wander or a walk to its food', () => {
  const log = kept(T, 7), moves = movesIn(log, T + 2 * DAY, T + 6 * DAY);
  assert.ok(moves.length > 12, `${moves.length} moves`);
  for (const m of moves) {
    const p = whereAt(log, m.at, PIP);
    assert.deepEqual(p, { dx: m.to, from: m.from, at: m.at, why: m.why });
    assert.ok(furrowShows(log, p, m.at) && furrowShows(log, p, m.at + HOUR - 1), 'for the hour after');
    assert.ok(!furrowShows(log, p, m.at + HOUR), 'and then no longer');
  }
  assert.equal(furrowShows(log, { dx: 0, from: null, at: null, why: null }, T), false, 'never, before it has moved');
});

test("while the host is down it neither wanders nor slides on the ice, when its time doesn't pass; to the millisecond", () => {
  const log = kept(T, 3), start = log.visits.at(-1).t + HOUR, end = start + 5 * DAY;
  const down = { ...log, outages: [{ start, end, evidence: 'host-1' }] };
  assert.deepEqual(movesIn(down, start, end - 1), [], 'still through five days of downtime');
  assert.ok(movesIn(log, start, start + DAY).length > 0, 'though it would have wandered by the calendar');
  // Downtime that ends at its own minute lets it go; downtime that starts then doesn't.
  let edges = 0;
  for (let b = T; edges < 3 && b < T + 20 * DAY; b += 29 * MIN) {
    const ms = own(b), k = ms.findIndex((w, i) => i > 0 && w.at - ms[i - 1].at >= 3 * HOUR);
    if (k < 0) continue;
    const w = ms[k], at = outage => whereAt({ ...newLog(b), outages: [outage] }, w.at, PIP).at;
    assert.equal(at({ start: w.at - 2 * HOUR, end: w.at, evidence: 'host-1' }), w.at, `born ${iso(b)}: back at its minute, it goes`);
    assert.notEqual(at({ start: w.at, end: w.at + 2 * HOUR, evidence: 'host-1' }), w.at, 'down from its minute, it stays');
    edges++;
  }
  assert.equal(edges, 3);
  // The ice: down across 10:00, or from 10:00, there is no slide, no "it moved this morning" and
  // nothing for /history; back at 10:00, it slides.
  let iced = 0;
  for (let b = Date.UTC(2026, 10, 20, 5); iced < 3 && b < Date.UTC(2027, 0, 20); b += 7 * HOUR) {
    const t = iceTimes(b, b + 80 * DAY, []).find(at => at > b + 4 * DAY);
    if (!t) continue;
    const care = kept(b, (t - b) / DAY - 1);
    const lastVisit = care.visits.at(-1).t;
    const with_ = outage => ({ ...care, outages: [outage] });
    const across = with_({ start: lastVisit + HOUR, end: t + 5 * HOUR, evidence: 'host-1' });
    const from10 = with_({ start: t, end: t + 5 * HOUR, evidence: 'host-1' });
    const until10 = with_({ start: lastVisit + HOUR, end: t, evidence: 'host-1' });
    for (const [what, l] of [['across 10:00', across], ['from 10:00', from10]]) {
      assert.notEqual(whereAt(l, t + 6 * HOUR, PIP).why, 'ice', `down ${what}: no slide`);
      assert.deepEqual(iceTimes(b, t + 6 * HOUR, l.outages).filter(at => at === t), [], what);
      const now = t + 6 * HOUR;
      assert.notDeepEqual(occasion(replay(l, now), now, l.outages), { what: 'sailed' }, `down ${what}: no remark`);
      assert.ok(!look(l, { now, host: 'h' }).text.includes('it moved this morning'), `down ${what}: the look says nothing of it`);
      const n = iceTimes(b, now, []).length - 1;
      assert.match(history(l, { now }).text, new RegExp(`^slid on the ice: ${n === 1 ? 'once' : `${n} times`}$`, 'm'), `down ${what}: nor /history`);
    }
    const p = whereAt(until10, t, PIP);
    assert.deepEqual([p.why, p.at], ['ice', t], 'back at 10:00, it slides');
    assert.ok(look(until10, { now: t + HOUR, host: 'h' }).text.includes('it moved this morning'));
    iced++;
  }
  assert.equal(iced, 3);
});

test('never twice in a four-hour block, nor within an hour of its life, nor off from its food, nor while down, nor at an extreme: random lives', () => {
  const rnd = mulberry(21);
  let moves = 0, slides = 0;
  for (let i = 0; i < 24; i++) {
    const winter = i % 2 === 1, b = (winter ? Date.UTC(2026, 11, 1) : T) + Math.floor(rnd() * 50 * DAY), log = newLog(b), outages = [];
    let t = b + HOUR;
    while (t < b + 8 * DAY) {
      log.visits.push({ t, acts: rnd() < 0.6 ? FULL : rnd() < 0.5 ? [['feed', 1]] : [['pet', 3]] });
      if (rnd() < 0.3) { // the host goes down a little after a visit, for up to five hours
        const start = t + MIN + Math.floor(rnd() * 50) * MIN, end = start + Math.floor(30 + rnd() * 300) * MIN;
        outages.push({ start, end, evidence: 'host-1' });
        t = end + MIN + Math.floor(rnd() * 90) * MIN;
      } else t += Math.floor(5 + rnd() * 300) * MIN;
    }
    log.outages = outages;
    const all = movesOf(log, b + 9 * DAY, PIP), dead = replay(log, b + 9 * DAY).dead;
    for (let k = 0; k < all.length; k++) {
      const m = all[k], prev = all.slice(0, k).filter(x => x.why !== 'ice').at(-1), where = `rock ${i}, ${m.why} at ${iso(m.at)}`;
      moves++;
      assert.ok(!outages.some(o => m.at >= o.start && m.at < o.end), `${where}: while the host was down`);
      assert.ok(!dead || m.at < dead.t, `${where}: after it died`);
      if (m.why === 'ice') { slides++; continue; }
      assert.ok(!prev || Math.floor(prev.at / BLOCK) !== Math.floor(m.at / BLOCK), `${where}: twice in a block`);
      assert.ok(k === 0 || activeElapsed(log, all[k - 1].at, m.at) >= HOUR, `${where}: within an hour of its life of its last move`);
      assert.ok(!inDanger(replay(log, m.at)), `${where}: at an extreme`);
      if (m.why === 'wander') assert.equal(mealAt(log, m.at), null, `${where}: off from its food`);
    }
    // Where it is at any moment is its last move by then, and the visits after it change nothing.
    for (let k = 0; k < 20; k++) {
      const u = b + Math.floor(rnd() * 9 * DAY), last = all.filter(m => m.at <= u).at(-1);
      const sofar = { ...log, visits: log.visits.filter(v => v.t <= u), outages: outages.filter(o => o.start <= u) };
      assert.deepEqual(whereAt(log, u, PIP), last ? { dx: last.to, from: last.from, at: last.at, why: last.why } : { dx: 0, from: null, at: null, why: null });
      if (!sofar.outages.some(o => o.end > u)) assert.deepEqual(movesOf(sofar, u, PIP), all.filter(m => m.at <= u), `rock ${i}: the past, as it stood at ${iso(u)}`);
    }
  }
  assert.ok(moves > 400 && slides > 0, `${moves} moves, ${slides} on the ice`);
});

test('its first chance comes in the four hours it was born in, after its birth, without waiting', () => {
  let first = 0, soon = 0;
  for (let i = 0; i < 40; i++) {
    const b = Math.ceil(T / BLOCK) * BLOCK + i * BLOCK + MIN + i * 997, m = own(b)[0]; // born a minute into a block
    assert.ok(!m || m.at > b, 'nothing moves it at or before its birth');
    if (m && Math.floor(m.at / BLOCK) === Math.floor(b / BLOCK)) first++;
    if (m && m.at - b < HOUR) soon++;
  }
  assert.ok(first > 15, `${first} of 40 moved in the four hours they were born in`);
  assert.ok(soon > 3, `${soon} of 40 moved within the hour after their birth`);
});

test('a chance that leaves it where it is starts no rest: the next four hours may move it at once', () => {
  // Never fed, it is free at its own minute in the last 45 minutes of a block, and doesn't move:
  // that block's spot is where it is. A feed 45 minutes on, in the next four hours, takes it to
  // their spot. (Its minutes are found with their formula, spelled out here; where it goes is the
  // game's own.)
  const ownMinute = (b, k) => k * BLOCK + (hash(b, 12, k) % 240) * MIN;
  let found = 0;
  for (let b = T; found < 3 && b < T + 60 * DAY; b += 41 * MIN) {
    const ms = own(b);
    for (let k = Math.floor(b / BLOCK) + 1; (k + 1) * BLOCK < b + 16 * HOUR; k++) {
      const w = ownMinute(b, k), before = ms.filter(m => m.at < w).at(-1);
      if (w % BLOCK < 3 * HOUR + 15 * MIN || ms.some(m => Math.floor(m.at / BLOCK) === k) || (before && w - before.at < HOUR)) continue;
      const F = w + 45 * MIN, p = whereAt({ ...newLog(b), visits: [{ t: F, acts: [['feed', 1]] }] }, F, PIP);
      if (p.at !== F) continue; // the next four hours' spot must be elsewhere
      assert.equal(p.why, 'food');
      found++;
      break;
    }
  }
  assert.equal(found, 3, 'feeds 45 minutes after a chance that left it where it was');
});

test('each four hours has one spot: a feed anywhere in them takes it where its own minute would, so nobody can steer it', () => {
  // Never fed, it wanders at its own minute late in a block, free from the block's start; fed
  // instead at the start, a minute and a millisecond in, or an hour or two in, it goes there too.
  let found = 0;
  for (let b = T; found < 6 && b < T + 60 * DAY; b += 43 * MIN) {
    const ms = own(b);
    for (const w of ms) {
      const B = Math.floor(w.at / BLOCK) * BLOCK, before = ms.filter(m => m.at < w.at).at(-1);
      if (B <= b || w.at - B < 3 * HOUR || (before && B - before.at < HOUR)) continue;
      for (const F of [B, B + MIN + 1, B + MIN + 999, B + HOUR + 7 * MIN, B + 2 * HOUR + 31 * MIN]) {
        const p = whereAt({ ...newLog(b), visits: [{ t: F, acts: [['feed', 1]] }] }, F, PIP);
        assert.deepEqual([p.at, p.why, p.dx], [F, 'food', w.to], `born ${iso(b)}: fed at ${iso(F)}, where its minute took it`);
      }
      found++;
      break;
    }
  }
  assert.equal(found, 6, 'blocks fed at five different moments');
});

test('every drawing moves within its room, and a drawing with no room to move is refused', () => {
  const log = kept(T, 4);
  for (const [n, drawing] of Object.entries(DRAWINGS)) {
    const { min, max } = roomOf(drawing), moves = movesOf(log, T + 4 * DAY, drawing);
    assert.ok(moves.length > 6, `${n}: ${moves.length} moves`);
    for (const m of moves) assert.ok(m.to >= min && m.to <= max && m.from >= min && m.from <= max && m.to !== m.from, `${n}: ${m.from}>${m.to}`);
  }
  assert.deepEqual(roomOf(PIP), { min: -3, max: 3 }, 'the pip: three columns either way');
  assert.deepEqual(roomOf(DRAWINGS.lump), { min: -1, max: 1 }, 'the lump: one');
  const wide = { front: ['', '', '.----------.', '(E        E)', "'----------'"], back: ['', '', '.----------.', '(          )', "'----------'"] };
  assert.throws(() => whereAt(log, T + DAY, wide), /room to move/);
});

test('the screen draws it where it is, with its furrow while it shows, in every reply', () => {
  const log6 = kept(T, 6, 3 * HOUR), base = D.front[4], left = base.search(/\S/);
  const until = t => ({ ...log6, visits: log6.visits.filter(v => v.t <= t) }); // the log as it stood at t
  const check = (text, log, t, what) => {
    const p = whereAt(log, t, D), g = grid(text);
    assert.equal(g[5].search(/[^ ~.]/), left + p.dx, `${what}, at ${iso(t)}: its base, "${g[5]}"`);
    assert.equal(g[5].includes('~'), furrowShows(log, p, t), `${what}, at ${iso(t)}: its furrow while it shows, "${g[5]}"`);
  };
  let furrowed = 0;
  for (let t = T + 4 * DAY; t < T + 5 * DAY; t += 23 * MIN) {
    const log = until(t), named = { ...log, name: { name: 'Mabel', t: T + DAY } };
    if (furrowShows(log, whereAt(log, t, D), t)) furrowed++;
    check(look(log, { now: t, host: 'h' }).text, log, t, 'a look');
    const fed = act(log, 'feed', { now: t, host: 'h' });
    check(fed.text, { ...log, visits: [...log.visits, fed.visit] }, t, 'a feed');
    check(act(log, 'dance', { now: t, host: 'h' }).text, log, t, 'a refused act');
    check(name(log, 'Mabel', { now: t, host: 'h' }).text, log, t, 'a name');
    check(name(log, '!!', { now: t, host: 'h' }).text, log, t, 'a refused name');
    check(name(log, 'Mabel', { now: t, host: 'h', taken: ['mabel'] }).text, log, t, 'a name taken before');
    check(name(named, 'Other', { now: t, host: 'h' }).text, named, t, 'a second name');
  }
  assert.ok(furrowed > 5, `${furrowed} of the moments show a furrow`);
  // A grave: where it died, and no furrow, to a look, a visit or a name.
  const alone = newLog(T), dead = replay(alone, Infinity).dead, p = whereAt(alone, dead.t, D);
  for (const text of [look(alone, { now: dead.t + MIN, host: 'h' }).text, act(alone, 'feed', { now: dead.t + MIN, host: 'h' }).text, name(alone, 'Mabel', { now: dead.t + MIN, host: 'h' }).text]) {
    const g = grid(text);
    assert.equal(g[5].search(/[^ ~.,"]/), left + p.dx, `a grave lies where it died: "${g[5]}"`);
    assert.ok(!g[5].includes('~'));
  }
});
