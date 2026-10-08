// Where it is (src/wander.mjs; CHARACTER.md, "Where it is"): it wanders along its ground every few
// hours, goes to its food, rests after it moves, stays still at an extreme, slides on the ice on a
// few winter mornings, and lies where it died. Also statesAt (src/engine.mjs), which it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whereAt, furrowShows, roomOf } from '../src/wander.mjs';
import { replay, statesAt, HOUR } from '../src/engine.mjs';
import { iceTimes, inDanger } from '../src/character.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { look, act, newLog } from '../src/rock.mjs';
import { W } from '../src/screen.mjs';

const MIN = 60_000, DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 6, 3); // October: no ice
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const D = DRAWINGS[DRAWING];
const grid = text => text.split('\n').slice(0, W);
function kept(b, days, every = 8 * HOUR, acts = FULL) {
  const log = newLog(b);
  for (let t = b + HOUR; t < b + days * DAY; t += every) log.visits.push({ t, acts });
  return log;
}
// Its moves between `from` and `to`, seen minute by minute: [time, from, to, why].
function movesOf(log, from, to, drawing = D) {
  const out = [];
  let last = whereAt(log, from, drawing);
  for (let t = from + MIN; t <= to; t += MIN) {
    const p = whereAt(log, t, drawing);
    if (p.at !== last.at) out.push([t, last.dx, p.dx, p.why]);
    last = p;
  }
  return out;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('statesAt gives, in one pass, what replay gives at each moment', () => {
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
    const once = statesAt(log, times);
    times.forEach((t, k) => assert.deepEqual(once[k], replay(log, t), `rock ${i}, moment ${k}`));
  }
  assert.throws(() => statesAt(newLog(T), [T + HOUR, T]), /out of time order/);
});

test('it wanders regularly, not nonstop: about six times a day, still in between', () => {
  for (const b of [T, T + 5 * HOUR, T + 13 * HOUR + 7 * MIN]) {
    const log = kept(b, 12), moves = movesOf(log, b + 3 * DAY, b + 10 * DAY);
    const { min, max } = roomOf(D);
    const perDay = moves.length / 7;
    assert.ok(perDay > 3 && perDay < 9, `${perDay.toFixed(1)} moves a day`);
    for (const [t, from, to, why] of moves) {
      assert.ok(to >= min && to <= max && to !== from, `${from}>${to} at ${new Date(t).toISOString()}`);
      assert.ok(why === 'wander' || why === 'food', why);
    }
    // Rests at least an hour after each move, so never two within the hour.
    for (let k = 1; k < moves.length; k++) assert.ok(moves[k][0] - moves[k - 1][0] >= HOUR, `moves ${k - 1} and ${k} an hour apart`);
    // At most one wander in each four hours of UTC time, from 00:00.
    const blocks = moves.filter(m => m[3] === 'wander').map(m => Math.floor(m[0] / (4 * HOUR)));
    assert.equal(new Set(blocks).size, blocks.length, 'one wander a block at most');
    assert.ok(moves.some(m => m[3] === 'wander') && moves.some(m => m[3] === 'food'), 'both kinds of move');
  }
  assert.deepEqual(roomOf(DRAWINGS.pip), { min: -3, max: 3 }, 'the pip: three columns either way');
  assert.deepEqual(roomOf(DRAWINGS.lump), { min: -1, max: 1 }, 'the lump: one');
});

test('a feed sends it to its food, unless it is resting; either way it stays by its food while it eats', () => {
  const rnd = mulberry(9);
  let went = 0, stayed = 0;
  for (let i = 0; i < 200; i++) {
    const b = T + Math.floor(rnd() * 30 * DAY), log = kept(b, 4);
    const t = b + 4 * DAY + Math.floor(rnd() * 8 * HOUR) * MIN / MIN;
    const before = whereAt(log, t - 1, D);
    const fed = { ...log, visits: [...log.visits, { t, acts: [['feed', 1]] }] };
    const p = whereAt(fed, t, D);
    const resting = before.at !== null && t - before.at < HOUR;
    if (p.at === t) { went++; assert.equal(p.why, 'food'); assert.ok(!resting, 'not while resting'); }
    else { stayed++; assert.equal(p.dx, before.dx); }
    for (const later of [MIN, 30 * MIN, HOUR - MIN]) assert.equal(whereAt(fed, t + later, D).dx, p.dx, `it stays by its food ${later / MIN} minutes on`);
  }
  assert.ok(went > 50 && stayed > 20, `went to its food ${went} times, stayed ${stayed}`);
  // Petting and cleaning send it nowhere: fed every 8 hours, petted and cleaned every hour between.
  const mixed = kept(T, 6);
  for (let t = T + 2 * HOUR; t < T + 6 * DAY; t += HOUR) if ((t - T) % (8 * HOUR) !== HOUR) mixed.visits.push({ t, acts: [['pet', 2], ['clean', 1]] });
  mixed.visits.sort((a, z) => a.t - z.t);
  const careOnly = new Set(mixed.visits.filter(v => !v.acts.some(([verb]) => verb === 'feed')).map(v => v.t));
  const moves = movesOf(mixed, T + 2 * DAY, T + 6 * DAY - HOUR);
  assert.ok(moves.length > 10, `${moves.length} moves`);
  for (const [t, , , why] of moves) assert.ok(!careOnly.has(t), `moved at ${new Date(t).toISOString()} (${why}), a visit with no food`);
});

test('at an extreme it holds still, and only the ice may move it; a grave lies where it died', () => {
  // Never visited: it reaches the sorrow floor in a day or so, and dies two days later.
  const alone = newLog(T), floor = replay(alone, Infinity).sorrowSince, grave = replay(alone, Infinity).dead;
  assert.ok(floor && grave);
  const still = whereAt(alone, floor, D);
  for (let t = floor; t <= grave.t; t += 17 * MIN) assert.equal(whereAt(alone, t, D).dx, still.dx, 'still at the brink');
  for (const later of [MIN, DAY, 400 * DAY]) assert.deepEqual(whereAt(alone, grave.t + later, D), whereAt(alone, grave.t, D), 'the grave stays put');
  assert.ok(movesOf(alone, T, floor).length > 0, 'it wandered while it was well');
  // Petted but never fed: starving from 24h, cheerful, still.
  const starving = kept(T, 3, 6 * HOUR, [['clean', 1], ['pet', 10]]), from = replay(starving, Infinity).dead.t - 47 * HOUR;
  assert.ok(inDanger(replay(starving, from)));
  assert.equal(movesOf(starving, from, from + 40 * HOUR).length, 0, 'no wandering while it starves');
  // A winter rock left alone at the brink: the ice still slides it.
  let shown = null;
  for (let b = Date.UTC(2026, 11, 1); !shown && b < Date.UTC(2027, 1, 1); b += 7 * HOUR) {
    const log = newLog(b), s = replay(log, Infinity), slide = iceTimes(b, s.dead.t).find(t => inDanger(replay(log, t)));
    if (slide) shown = [log, slide];
  }
  assert.ok(shown, 'found a slide at the brink');
  const [log, slide] = shown;
  assert.notEqual(whereAt(log, slide, D).dx, whereAt(log, slide - 1, D).dx, 'the ice moves it at the brink');
  assert.equal(whereAt(log, slide, D).why, 'ice');
  // One that died the same day it slid: its furrow would still show that day, but a grave has none.
  let tomb = null;
  for (let b = Date.UTC(2026, 11, 1); !tomb && b < Date.UTC(2027, 1, 20); b += 3 * HOUR) {
    const grave = replay(newLog(b), Infinity).dead, last = iceTimes(b, grave.t).at(-1);
    if (last && Math.floor(last / DAY) === Math.floor(grave.t / DAY) && grave.t % DAY < DAY - HOUR) tomb = [b, grave.t];
  }
  assert.ok(tomb, 'found a rock that died the day it slid');
  const [born, died] = tomb, end = whereAt(newLog(born), died, D);
  assert.ok(end.why === 'ice' && furrowShows(end, died + MIN), 'by the clock, its furrow would show');
  assert.ok(!grid(look(newLog(born), { now: died + MIN, host: 'h' }).text)[5].includes('~'), 'but a grave shows none');
});

test('the ice always takes it somewhere else, and it rests there for the rest of that day', () => {
  let seen = 0;
  for (let b = Date.UTC(2026, 10, 15); seen < 12; b += 11 * HOUR) {
    const t = iceTimes(b, b + 90 * DAY).find(at => at > b + 3 * DAY);
    if (!t) continue;
    const log = kept(b, (t - b) / DAY + 2, 3 * HOUR); // fed every three hours, so food calls too
    const p = whereAt(log, t, D);
    assert.equal(p.why, 'ice');
    assert.notEqual(p.dx, whereAt(log, t - 1, D).dx);
    const end = (Math.floor(t / DAY) + 1) * DAY;
    for (let later = t; later < end; later += 13 * MIN) {
      const q = whereAt(log, later, D);
      assert.deepEqual([q.dx, q.why], [p.dx, 'ice'], `still where the ice left it, ${new Date(later).toISOString()}`);
      assert.ok(furrowShows(q, later), 'its furrow shows all that day');
    }
    assert.ok(!furrowShows(p, end), 'but not the next');
    seen++;
  }
});

test('its furrow shows for an hour after a wander or a walk to its food', () => {
  const log = kept(T, 6), moves = movesOf(log, T + 2 * DAY, T + 4 * DAY);
  assert.ok(moves.length > 6);
  for (const [t] of moves) {
    const p = whereAt(log, t, D);
    assert.ok(furrowShows(p, t) && furrowShows(p, t + HOUR - 1), 'for the hour after');
    assert.ok(!furrowShows(p, t + HOUR), 'and then no longer');
  }
  assert.equal(furrowShows({ dx: 0, from: null, at: null, why: null }, T), false, 'never, before it has moved');
});

test("it doesn't wander while the host is down, when its time doesn't pass", () => {
  const log = kept(T, 3), start = log.visits.at(-1).t + HOUR, end = start + 5 * DAY;
  const down = { ...log, outages: [{ start, end, evidence: 'host-1' }] };
  const during = movesOf(down, start, end - MIN);
  assert.deepEqual(during, [], 'still through five days of downtime');
  assert.ok(movesOf(log, start, start + DAY).length > 0, 'though it would have wandered by the calendar');
});

test('the screen draws it where it is, in every reply', () => {
  const kept6 = kept(T, 6), base = D.front[4], left = base.search(/\S/);
  const until = t => ({ ...kept6, visits: kept6.visits.filter(v => v.t <= t) }); // the log as it stood at t
  for (let t = T + 4 * DAY; t < T + 5 * DAY; t += 47 * MIN) {
    const log = until(t), p = whereAt(log, t, D), g = grid(look(log, { now: t, host: 'h' }).text);
    assert.equal(g[5].search(/[^ ~.]/), left + p.dx, `its base, at ${new Date(t).toISOString()}: "${g[5]}"`);
    assert.equal(g[5].includes('~'), furrowShows(p, t), 'with its furrow while it shows');
  }
  // The reply to a feed shows where the feed sent it.
  const t = T + 5 * DAY + 3 * HOUR, log = until(t), r = act(log, 'feed', { now: t, host: 'h' });
  const p = whereAt({ ...log, visits: [...log.visits, r.visit] }, t, D);
  assert.equal(grid(r.text)[5].search(/[^ ~.]/), left + p.dx);
});
