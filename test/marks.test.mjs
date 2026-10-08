// The marks a life leaves on the rock (src/marks.mjs) and the drawings it can have
// (src/drawings.mjs), held to CHARACTER.md: "The marks" and "The drawings".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mossAt, marksOf, POLISH_AT, CRYSTALS_AT } from '../src/marks.mjs';
import { DRAWINGS, DRAWING, mossCells, MOSS_CELLS } from '../src/drawings.mjs';
import { render, sprite, eyes, W } from '../src/screen.mjs';
import { placeAt } from '../src/character.mjs';
import { replay, born, applyVisit, HOUR } from '../src/engine.mjs';
import { look, act, history, newLog } from '../src/rock.mjs';
import { RULES } from '../src/rules.mjs';

const DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 6); // October: no rock moves by itself
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const opts = now => ({ now, host: 'rock.test' });
const grid = text => text.split('\n').slice(0, W);
const moss = rows => rows.join('').split('').filter(c => c === ',' || c === '"').length;
const TUFTS = [0, 2, 4, 7, 9, 11, Infinity]; // per level, as CHARACTER.md ("The marks") has it

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random lives in every season, as logs a server could have written.
function lives(n, seed) {
  const rnd = mulberry(seed), VERBS = ['feed', 'clean', 'pet'], out = [];
  for (let i = 0; i < n; i++) {
    const b = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 365 * DAY);
    const visits = [];
    for (let t = b + HOUR; t < b + 30 * DAY; t += HOUR * (1 + rnd() * (rnd() < 0.15 ? 60 : 16))) {
      visits.push({ t: Math.round(t), acts: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => [VERBS[Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 20)]) });
    }
    const now = b + Math.floor(rnd() * 120 * DAY);
    const log = { ...newLog(b), visits: visits.filter(v => v.t <= now) };
    log.visits = log.visits.slice(0, replay(log, Infinity).visits);
    out.push({ log, now });
  }
  return out;
}

test('moss levels are the ones CHARACTER.md gives', () => {
  assert.deepEqual(MOSS_CELLS, TUFTS);
});

test('moss grows on a rock nobody comes to, and any visit brushes it off', () => {
  const at = h => mossAt({ ...born(T), t: T + h * HOUR, lastCare: T }, T + h * HOUR);
  assert.deepEqual([0, 11.99, 12, 23.99, 24, 47.99, 48, 70].map(at), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(mossAt(born(T), T + 12 * HOUR), 1, 'never cared for: counted from birth');
  const log = { ...newLog(T), visits: [{ t: T + HOUR, acts: [['pet', 1]] }] };
  for (const [h, level] of [[11, 0], [12, 1], [24, 2], [48, 3]]) {
    assert.equal(moss(grid(look(log, opts(T + HOUR + h * HOUR)).text).slice(1, 6)), TUFTS[level], `${h}h`);
  }
  assert.equal(moss(grid(act(log, 'pet', opts(T + 40 * HOUR)).text).slice(1, 6)), 0, 'a visit brushes it off');
});

test('verified host downtime grows no moss: it pauses moss as it pauses everything else', () => {
  // A full visit, then the host down for 50h (credited), then a look an hour after it came back.
  const visit = { t: T + HOUR, acts: FULL };
  const log = { ...newLog(T), visits: [visit], outages: [{ start: T + 2 * HOUR, end: T + 52 * HOUR, evidence: 'host-1' }] };
  const at = T + 53 * HOUR; // 52h since the visit, but only 2h of it the rock lived through
  assert.equal(mossAt(replay(log, at), at, log.outages), 0);
  assert.equal(moss(grid(look(log, opts(at)).text).slice(1, 6)), 0, 'none on the screen');
  assert.equal(mossAt(replay(log, at), at), 3, 'which the wall clock alone would have drawn as two days alone');
  assert.equal(moss(grid(look(log, opts(at + 11 * HOUR)).text).slice(1, 6)), TUFTS[1], '12 lived hours alone: the first tufts');
  // A grave keeps only the time it lived through alone: petted to the edge of the outage, never
  // fed, it starved 43 lived hours later (74 on the clock): the moss of under two days, not three.
  const visits = [];
  for (let t = T + 5 * HOUR; t <= T + 29 * HOUR; t += 6 * HOUR) visits.push({ t, acts: [['clean', 1], ['pet', 10]] });
  const kept = { ...newLog(T), visits, outages: [{ start: T + 30 * HOUR, end: T + 60 * HOUR, evidence: 'host-2' }] };
  const grave = replay(kept, Infinity);
  assert.equal(grave.dead.cause, 'hungry');
  assert.equal(mossAt(grave, grave.dead.t, kept.outages), 2, 'under two lived days alone');
  assert.equal(mossAt(grave, grave.dead.t), 3, 'the wall clock alone would say more than two');
});

test('a grave keeps the moss of its last days alone, and greens over: a week, a month, a season', () => {
  const lonely = replay(newLog(T), Infinity); // nobody ever came: alone for days before it died
  const at = (s, d) => mossAt(s, s.dead.t + d);
  assert.deepEqual([0, 7 * DAY - 1, 7 * DAY, 30 * DAY - 1, 30 * DAY, 90 * DAY - 1, 90 * DAY, 900 * DAY].map(d => at(lonely, d)), [3, 3, 4, 4, 5, 5, 6, 6]);
  // Petted to the end but never fed: it starved with someone close by, and starts bare.
  const visits = [];
  for (let t = T + 6 * HOUR; t < T + 80 * HOUR; t += 6 * HOUR) visits.push({ t, acts: [['pet', 5]] });
  const fed = replay({ ...newLog(T), visits }, Infinity);
  assert.equal(fed.dead.cause, 'hungry');
  assert.deepEqual([0, 7 * DAY, 30 * DAY, 90 * DAY].map(d => at(fed, d)), [0, 4, 5, 6]);
  const drawn = d => grid(look(newLog(T), opts(lonely.dead.t + d)).text).slice(1, 6);
  const room = mossCells(DRAWINGS[DRAWING].front).length;
  assert.deepEqual([0, 7 * DAY, 30 * DAY, 90 * DAY].map(d => moss(drawn(d))), [3, 4, 5, 6].map(l => Math.min(TUFTS[l], room)));
  const d = DRAWINGS[DRAWING], dx = placeAt(T, lonely.dead.t).col;
  for (const [r, row] of d.front.entries()) for (const [c, cell] of [...row].entries()) if (cell === 'E') assert.equal(drawn(0)[r][c + dx], 'x', 'crosses for eyes');
});

test('polish and crystals count what the care did, never what was asked for', () => {
  // A rock kept full: petting and feeding it changes nothing, so it gains nothing.
  const s = { ...born(T) };
  for (let i = 0; i < 50; i++) applyVisit(s, [['pet', 20], ['feed', 20]]);
  assert.deepEqual([s.petted, s.fed], [0, 0]);
  // From happiness 3 and hunger 5: pets raise it to 10, feeds take hunger to 0, however many.
  const t = { ...born(T), happy: 3, hunger: 5 };
  applyVisit(t, [['pet', 20], ['feed', 20]]);
  assert.deepEqual([t.petted, t.fed], [7, 5]);
  // Never negative, and never more than the care could have done, over any life.
  for (const { log, now } of lives(200, 3)) {
    const r = replay(log, now);
    assert.ok(r.petted >= 0 && r.fed >= 0, JSON.stringify(r));
    const asked = c => log.visits.filter(v => v.t <= now).reduce((n, v) => n + v.acts.filter(([verb]) => verb === c).reduce((k, [, x]) => k + x, 0), 0);
    assert.ok(r.petted <= asked('pet') * RULES.pet + 1e-9 && r.fed <= asked('feed') * RULES.feed + 1e-9);
  }
});

test('a close call counts when the short extreme ends after the long one (review round 3)', () => {
  const visits = [];
  for (let t = T + 6 * HOUR; t <= T + 48 * HOUR; t += 6 * HOUR) visits.push({ t, acts: [['clean', 1], ['pet', 10]] });
  visits.push({ t: T + 60 * HOUR, acts: [['feed', 4]] }); // starving 36h ends; sorrow, two hours old, runs on
  const mid = replay({ ...newLog(T), visits }, T + 60 * HOUR);
  assert.deepEqual([mid.closeCalls, mid.brink, mid.sorrowSince !== null], [0, true, true]);
  visits.push({ t: T + 61 * HOUR, acts: [['pet', 10]] });
  assert.equal(replay({ ...newLog(T), visits }, T + 61 * HOUR).closeCalls, 1);
});

test('a grave that died in company stays bare until its first week (review round 3)', () => {
  const visits = [];
  for (let t = T + 6 * HOUR; t < T + 80 * HOUR; t += 6 * HOUR) visits.push({ t, acts: [['pet', 5]] });
  const g = replay({ ...newLog(T), visits }, Infinity);
  assert.deepEqual([1, 2, 3, 6].map(d => mossAt(g, g.dead.t + d * DAY)), [0, 0, 0, 0]);
  assert.equal(mossAt(g, g.dead.t + 7 * DAY), 4);
});

test('the marks of a long life: polish at 500 and 3000 points of petting, crystals at 100 and 500 meals', () => {
  const m = o => marksOf({ ...born(T), ...o });
  assert.deepEqual(POLISH_AT, [500, 3000]);
  assert.deepEqual(CRYSTALS_AT, [100, 500]);
  assert.deepEqual([499.9, 500, 2999, 3000].map(petted => m({ petted }).polish), [0, 1, 1, 2]);
  assert.deepEqual([299, 300, 1499, 1500].map(fed => m({ fed }).crystals), [0, 1, 1, 2], 'a meal is one feed (3 hunger)');
  assert.deepEqual([0, 1, 3, 9].map(closeCalls => m({ closeCalls }).veins), [0, 1, 3, 3]);
  // On the screen, at the drawing's slots; marks show on the front only.
  const d = DRAWINGS[DRAWING];
  const front = sprite({ ...born(T), petted: 3000, fed: 1500, closeCalls: 3 }, T);
  for (const [r, c, mark] of [...d.veins, ...d.polish, ...d.crystals]) assert.equal(front[r][c], mark, `${mark} at ${r},${c}`);
  for (const [name, drawing] of Object.entries(DRAWINGS)) {
    const full = sprite({ ...born(T), petted: 3000, fed: 1500, closeCalls: 3 }, T, 'front', drawing);
    for (const [r, c, mark] of [...drawing.veins, ...drawing.polish, ...drawing.crystals]) assert.equal(full[r][c], mark, `${name}: ${mark} at ${r},${c}`);
  }
  const back = sprite({ ...born(T), petted: 3000, fed: 1500, closeCalls: 3 }, T, 'away');
  assert.equal(back.join('').replace(/[ _/\\|().'`-]/g, ''), '', `nothing but outline on its back: ${back}`);
  // A well-kept rock earns them in weeks, and the second polish and crystals take most of a year.
  const visits = [];
  for (let t = T + 8 * HOUR; t < T + 400 * DAY; t += 12 * HOUR) visits.push({ t, acts: FULL });
  const when = (pick, level) => { for (let day = 1; day < 400; day++) if (pick(marksOf(replay({ ...newLog(T), visits }, T + day * DAY))) >= level) return day; return Infinity; };
  const days = [when(x => x.polish, 1), when(x => x.crystals, 1), when(x => x.polish, 2), when(x => x.crystals, 2)];
  console.log(`  twice a day: polished on day ${days[0]}, a crystal on day ${days[1]}, worn smooth on day ${days[2]}, two crystals on day ${days[3]}`);
  assert.ok(days[0] > 20 && days[0] < 60 && days[1] > 20 && days[1] < 45, days.join());
  assert.ok(days[2] > 120 && days[3] > 120 && days[2] < 240 && days[3] < 240, days.join());
  const bio = history({ ...newLog(T), visits }, opts(T + 400 * DAY)).text, kept = replay({ ...newLog(T), visits }, T + 400 * DAY);
  assert.match(bio, new RegExp(`^petting received: ${Math.floor(kept.petted)} points of happiness \\(polished at 500 and 3000\\)$`, 'm'));
  assert.match(bio, new RegExp(`^meals: ${Math.floor(kept.fed / RULES.feed)} \\(crystals at 100 and 500\\)$`, 'm'));
  assert.ok(kept.fed / RULES.feed > 1000, 'a year of meals, counted as meals');
});

test('every drawing is well formed', () => {
  assert.ok(DRAWINGS[DRAWING], `${DRAWING} is one of the drawings`);
  for (const [name, d] of Object.entries(DRAWINGS)) {
    for (const side of ['front', 'back']) {
      assert.equal(d[side].length, 5, `${name} ${side}: 5 rows`);
      assert.equal(d[side][0], '', `${name} ${side}: its first row is air`);
      for (const row of d[side]) {
        assert.equal(row, row.trimEnd(), `${name}: no trailing spaces`);
        assert.ok(row.length <= 11 && !/\S/.test(row.slice(0, 1)), `${name} ${side}: keeps to columns 1-10: "${row}"`);
      }
    }
    const eyesAt = d.front.flatMap((row, r) => [...row].flatMap((c, k) => (c === 'E' ? [[r, k]] : [])));
    assert.equal(eyesAt.length, 2, `${name}: two eyes`);
    assert.ok(!d.back.join('').includes('E'), `${name}: no eyes on its back`);
    const slots = [...d.veins, ...d.polish, ...d.crystals];
    assert.deepEqual([d.veins.length, d.polish.length, d.crystals.length], [3, 2, 2], name);
    const keys = slots.map(([r, c]) => `${r},${c}`);
    assert.equal(new Set(keys).size, keys.length, `${name}: one mark to a slot`);
    for (const [r, c] of slots) {
      const row = d.front[r], from = row.search(/\S/), to = row.trimEnd().length - 1;
      assert.ok(from >= 0 && c >= from && c <= to, `${name}: slot ${r},${c} on the rock, within its row "${row}"`);
      assert.ok(!eyesAt.some(([er, ec]) => er === r && ec === c), `${name}: slot ${r},${c} is not an eye`);
    }
    for (const side of ['front', 'back']) {
      for (const [r, c] of mossCells(d[side])) {
        assert.equal((d[side][r] ?? '').padEnd(12)[c], ' ', `${name} ${side}: moss at ${r},${c} grows beside the rock, not over it`);
      }
      assert.ok(mossCells(d[side]).length >= 12, `${name} ${side}: room for 12 tufts, the most before the last level`);
    }
  }
});

test('every drawing leaves its trail beside its base on the day it moves, and none the next', () => {
  const visits = b => { const v = []; for (let at = b + HOUR; at < b + 120 * DAY; at += 8 * HOUR) v.push({ t: at, acts: FULL }); return v; };
  for (const [name, drawing] of Object.entries(DRAWINGS)) {
    const base = drawing.front[4], left = base.search(/\S/), right = base.trimEnd().length - 1;
    const seen = {};
    for (let b = Date.UTC(2026, 10, 1); Object.keys(seen).length < 4; b += 5 * HOUR) {
      for (let day = 1; day < 110 && Object.keys(seen).length < 4; day++) {
        const t = Math.floor(b / DAY) * DAY + day * DAY + 11 * HOUR, p = placeAt(b, t);
        if (p.from === null || seen[`${p.from}>${p.col}`]) continue;
        const log = { ...newLog(b), visits: visits(b).filter(v => v.t <= t) };
        const g = grid(render(replay(log, t), { now: t, host: 'x', drawing }));
        const trail = p.col > p.from ? [left + p.col - 1, left + p.col - 2] : [right + p.col + 1, right + p.col + 2];
        const furrow = trail.filter(c => c >= 0 && c < W).map(c => g[5][c]).join('');
        assert.equal(furrow, '~'.repeat(furrow.length), `${name}, moved ${p.from}>${p.col}: "${g[5]}"`);
        assert.ok(furrow.length >= 1, `${name}: some room for a trail`);
        const next = grid(render(replay(log, t + DAY), { now: t + DAY, host: 'x', drawing }));
        if (placeAt(b, t + DAY).from === null) assert.ok(!next[5].includes('~'), `${name}: gone the next day: "${next[5]}"`);
        seen[`${p.from}>${p.col}`] = true;
      }
    }
  }
});

test('every drawing draws every rock whole: the eyes, the outline, an @ per mess, the trail beside its base', () => {
  for (const { log, now } of lives(150, 9)) {
    const s = replay(log, now);
    const { col: dx, from } = placeAt(s.born, s.dead ? s.dead.t : now);
    for (const [name, drawing] of Object.entries(DRAWINGS)) {
      const g = render(s, { now, host: 'x', drawing }).split('\n').slice(0, W);
      const slots = new Set([...drawing.veins, ...drawing.polish, ...drawing.crystals].map(([r, c]) => `${r},${c}`));
      drawing.front.forEach((row, r) => [...row].forEach((cell, c) => {
        if (cell === ' ' || slots.has(`${r},${c}`)) return;
        assert.equal(g[1 + r][c + dx], cell === 'E' ? eyes(s)[0] : cell, `${name}, row ${1 + r}:\n${g.join('\n')}`);
      }));
      for (const row of g) assert.ok(row.length <= W && row === row.trimEnd(), `${name}: "${row}"`);
      assert.equal(g.join('').split('@').length - 1, Math.min(s.messes, 16), `${name}: an @ per mess`);
      const base = drawing.front[4], left = base.search(/\S/) + dx, right = base.trimEnd().length - 1 + dx;
      const beside = [g[5][left - 1], g[5][left - 2], g[5][right + 1], g[5][right + 2]].filter(c => c === '~').length;
      assert.equal(beside > 0, !s.dead && from !== null, `${name}: a trail only the day it moved, and not on a grave:\n${g.join('\n')}`);
    }
  }
});
