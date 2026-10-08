// Its meals (src/meal.mjs) and its hunger, drawn (src/screen.mjs): CHARACTER.md, "Its meals" and
// "When it is hungry".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mealAt, drawMeal } from '../src/meal.mjs';
import { render, sprite, faint, shownHunger, W } from '../src/screen.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { replay, born, HOUR } from '../src/engine.mjs';
import { nature } from '../src/character.mjs';
import { whereAt, roomOf } from '../src/wander.mjs';
import { look, act, name, newLog } from '../src/rock.mjs';

const MIN = 60_000, DAY = 24 * HOUR;
const T = Date.UTC(2026, 9, 6); // a Tuesday in October, so no winter moves; born now, it faces the wall on Tuesdays
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const grid = text => text.split('\n').slice(0, W);
const D = DRAWINGS[DRAWING];
const eyesOf = d => d.front.findIndex(row => row.includes('E')); // a box row; the screen row is one more
const EYES = eyesOf(D);
const face = (eye, rows = D.front) => rows[EYES].replaceAll('E', eye);
const shifted = (row, dx) => (dx >= 0 ? ' '.repeat(dx) + row : row.slice(-dx));
// Where the game draws the rock with this log at t (wander.mjs): where it died, for a grave.
const dxOf = (log, t) => { const s = replay(log, t); return whereAt(log, s.dead ? s.dead.t : t, D).dx; };
const spotsOf = d => { const { min, max } = roomOf(d); return Array.from({ length: max - min + 1 }, (_, i) => min + i); };
// The face row as it should look while it eats, spelled out here rather than read from meal.mjs:
// the food just past the row's right end, or past its left end where the grid has no room on the
// right; while its mouth is open, the end on that side turned toward the food.
function eating(row, { food, open }, dx = 0) {
  const g = shifted(row, dx).padEnd(W).split('');
  const left = g.join('').search(/\S/), right = g.join('').trimEnd().length - 1;
  if (right < W - 1) { g[right + 1] = food; if (open) g[right] = '<'; }
  else { g[left - 1] = food; if (open) g[left] = '>'; }
  return g.join('').trimEnd();
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

test('a meal lasts an hour of its life: whole, then half, its mouth open in even minutes', () => {
  const fed = { ...newLog(T), visits: [{ t: T + HOUR, acts: [['feed', 2]] }] };
  const at = ms => mealAt(fed, T + HOUR + ms);
  assert.deepEqual(at(0), { food: '#', open: true }, 'the moment of the feed, so its reply: whole, mouth open');
  assert.deepEqual(at(MIN - 1), { food: '#', open: true });
  assert.deepEqual(at(MIN), { food: '#', open: false }, 'a minute on, shut');
  assert.deepEqual(at(2 * MIN), { food: '#', open: true }, 'and open again');
  assert.deepEqual(at(30 * MIN - 1), { food: '#', open: false });
  assert.deepEqual(at(30 * MIN), { food: '+', open: true }, 'half eaten, half an hour on');
  assert.deepEqual(at(HOUR - 1), { food: '+', open: false });
  assert.equal(at(HOUR), null, 'eaten, an hour on');
  // Its mouth keeps the meal's own minutes, not the clock's: fed half a minute into an odd minute
  // of the clock (T is a midnight, an even one), it is still open a quarter minute later.
  const odd = { ...newLog(T), visits: [{ t: T + 61 * MIN + MIN / 2, acts: [['feed', 1]] }] };
  assert.deepEqual(mealAt(odd, T + 61 * MIN + (3 * MIN) / 4), { food: '#', open: true }, 'fed in an odd minute');
  assert.equal(mealAt(fed, T + HOUR - 1), null, 'not before the feed');
  assert.equal(mealAt(newLog(T), T + HOUR), null, 'never fed');
});

test('every feed starts a meal, whatever else the visit does; other care neither starts nor ends one', () => {
  const pets = { t: T + HOUR + 10 * MIN, acts: [['pet', 3], ['clean', 1]] };
  const log = { ...newLog(T), visits: [{ t: T + HOUR, acts: [['feed', 1]] }, pets] };
  assert.deepEqual(mealAt(log, T + HOUR + 30 * MIN), { food: '+', open: true }, 'petting and cleaning leave the meal going');
  assert.equal(mealAt({ ...log, visits: [pets] }, T + HOUR + 30 * MIN), null, 'and start none');
  const again = { ...log, visits: [...log.visits, { t: T + HOUR + 50 * MIN, acts: [['pet', 1], ['feed', 1]] }] };
  assert.deepEqual(mealAt(again, T + HOUR + 50 * MIN), { food: '#', open: true }, 'a feed among other care starts a new one');
  assert.deepEqual(mealAt(again, T + 2 * HOUR + 30 * MIN), { food: '+', open: true }, 'timed from the new feed, not the first');
  assert.equal(mealAt(again, T + 2 * HOUR + 50 * MIN), null);
  // A feed it didn't need still starts one: fed at its birth, at hunger 0, it eats anyway.
  const full = { ...newLog(T), visits: [{ t: T, acts: [['feed', 1]] }] };
  assert.equal(replay(full, T).fed, 0, 'the feed took no hunger away');
  assert.deepEqual(mealAt(full, T + 2 * MIN), { food: '#', open: true }, 'and it eats anyway');
  assert.equal(grid(act(newLog(T), 'feed', { now: T, host: 'h' }).text)[1 + EYES], eating(face('^'), { food: '#', open: true }, dxOf(full, T)), 'in the reply too');
});

test('a meal counts only the time it lives: host downtime pauses it', () => {
  // Fed, then the host was down from ten minutes later for 231 minutes, an odd number, so the
  // meal's own minutes and the clock's disagree about its mouth. It has lived ten minutes of its
  // meal when the host comes back, and the meal goes on from there.
  const back = T + 5 * HOUR + MIN;
  const log = { ...newLog(T), visits: [{ t: T + HOUR, acts: [['feed', 1]] }], outages: [{ start: T + HOUR + 10 * MIN, end: back, evidence: 'host-1' }] };
  assert.deepEqual(mealAt(log, back), { food: '#', open: true }, 'ten minutes lived');
  assert.deepEqual(mealAt(log, back + 15 * MIN), { food: '#', open: false }, 'twenty-five: shut, though 256 minutes have passed');
  assert.deepEqual(mealAt(log, back + 20 * MIN), { food: '+', open: true }, 'thirty: half eaten');
  assert.deepEqual(mealAt(log, back + 49 * MIN), { food: '+', open: false }, 'fifty-nine');
  assert.equal(mealAt(log, back + 50 * MIN), null, 'an hour lived: eaten');
  assert.equal(mealAt({ ...log, outages: [] }, back), null, 'by the calendar it would be long gone');
});

// A rock born on a Tuesday, its day for facing the wall, cared for in full every 8 hours, fed in
// full on the Wednesday afternoon: then looked at through the hour that follows.
const WEDNESDAY = T + DAY + 9 * HOUR + HOUR / 2;
function keptUntil(t) {
  const log = newLog(T);
  for (let at = T + HOUR; at < t; at += 8 * HOUR) log.visits.push({ t: at, acts: FULL });
  return log;
}

test('the reply to a feed opens its mouth beside the food, and looks after it see the meal go', () => {
  assert.notEqual(new Date(WEDNESDAY).getUTCDay(), nature(T).wallDay, 'a day it faces out');
  const log = keptUntil(WEDNESDAY);
  const r = act(log, 'feed x4 clean pet x10', { now: WEDNESDAY, host: 'h' });
  assert.equal(r.status, 200);
  const row = text => grid(text)[1 + EYES];
  const after = { ...log, visits: [...log.visits, r.visit] }, dx = dxOf(after, WEDNESDAY);
  assert.equal(row(r.text), eating(face('^'), { food: '#', open: true }, dx), 'its reply, where it went to eat');
  for (const [ms, meal] of [[MIN, { food: '#', open: false }], [29 * MIN, { food: '#', open: false }], [30 * MIN, { food: '+', open: true }], [59 * MIN, { food: '+', open: false }]]) {
    assert.equal(dxOf(after, WEDNESDAY + ms), dx, 'it rests where it eats');
    assert.equal(row(look(after, { now: WEDNESDAY + ms, host: 'h' }).text), eating(face('^'), meal, dx), `${ms / MIN} minutes on`);
  }
  assert.equal(row(look(after, { now: WEDNESDAY + HOUR, host: 'h' }).text), shifted(face('^'), dxOf(after, WEDNESDAY + HOUR)).trimEnd(), 'an hour on, it has eaten it all');
  assert.equal(row(act(after, 'pet', { now: WEDNESDAY + 2 * MIN, host: 'h' }).text), eating(face('^'), { food: '#', open: true }, dx), 'care that is not food leaves the meal going');
});

test('every reply draws the meal, from the whole log, the visit just made included', () => {
  const log = keptUntil(WEDNESDAY);
  const r = act(log, 'feed', { now: WEDNESDAY, host: 'h' });
  const after = { ...log, visits: [...log.visits, r.visit] };
  const opts = { now: WEDNESDAY + 2 * MIN, host: 'h' };
  const row = text => grid(text.split('\n').filter(l => !l.startsWith('error:')).join('\n'))[1 + EYES];
  const seen = row(look(after, opts).text);
  assert.equal(seen, eating(face('^'), { food: '#', open: true }, dxOf(after, opts.now)));
  assert.equal(row(act(after, 'dance', opts).text), seen, 'a refused act');
  assert.equal(row(name(after, 'x', opts).text), seen, 'a refused name');
  const named = name(after, 'Basalto', opts);
  assert.equal(named.status, 200);
  assert.equal(row(named.text), seen, 'a name given');
});

test('from behind it eats with its back to anyone who only looks; care turns it round', () => {
  // Born on its own day for facing the wall, fed in its first hour.
  const log = newLog(T);
  const r = act(log, 'feed x4 clean pet x10', { now: T + HOUR, host: 'h' });
  const after = { ...log, visits: [r.visit] }, dx = dxOf(after, T + HOUR);
  assert.equal(grid(r.text)[1 + EYES], eating(face('^'), { food: '#', open: true }, dx), 'care turns it round, and it eats');
  const seen = look(after, { now: T + HOUR + 2 * MIN, host: 'h' }); // a minute when its mouth is open
  assert.ok(seen.text.includes('quirk: it is facing the wall today.'), seen.text);
  assert.equal(grid(seen.text)[1 + EYES], eating(D.back[EYES], { food: '#', open: false }, dx), 'the food beside its back, and no mouth');
});

test('a grave eats nothing', () => {
  // Fed every half hour and never petted or cleaned, it dies within days, a feed a few minutes
  // before the end, so by the log it would still be eating.
  const log = newLog(T);
  for (let t = T + HOUR; t < T + 10 * DAY; t += 30 * MIN) log.visits.push({ t, acts: [['feed', 1]] });
  log.visits = log.visits.slice(0, replay(log, Infinity).visits);
  const s = replay(log, Infinity);
  assert.ok(s.dead, 'it died');
  const opts = { now: s.dead.t + MIN, host: 'h' };
  assert.ok(mealAt(log, opts.now), 'its last feed was within the hour');
  const lies = shifted(face('x'), dxOf(log, opts.now)).trimEnd();
  assert.equal(grid(look(log, opts).text)[1 + EYES], lies, 'a stone again: crosses, and no food');
  const refused = act(log, 'feed', opts);
  assert.equal(refused.status, 410);
  assert.equal(grid(refused.text)[1 + EYES], lies, 'nor in the grave care gets back');
});

// The rock's box drawn into a bare grid, `dx` columns over, as render does.
function boxed(s, now, pose, drawing, dx) {
  const g = Array.from({ length: W }, () => Array(W).fill(' '));
  sprite(s, now, pose, drawing, [], dx).forEach((row, r) => { for (let c = 0; c < W; c++) if (row[c] !== ' ' && c + dx >= 0 && c + dx < W) g[1 + r][c + dx] = row[c]; });
  return g;
}

test('every drawing eats on its right where there is room, else its left: only the food and its mouth are drawn', () => {
  const marked = { ...born(T - 41 * DAY), t: T, lastCare: T - 2 * MIN, visits: 90, hunger: 2, happy: 6, closeCalls: 3, petted: 3000, fed: 1500 };
  const hungry = { ...marked, hunger: 7 }; // fed once from starving: still faint while it eats
  const MEALS = [{ food: '#', open: true }, { food: '#', open: false }, { food: '+', open: true }, { food: '+', open: false }];
  let lefts = 0, rights = 0;
  for (const [name, drawing] of Object.entries(DRAWINGS)) for (const pose of ['front', 'away']) for (const dx of spotsOf(drawing)) for (const s of [marked, hungry]) {
    const lines = faint(s) ? drawing.faint : drawing, rows = pose === 'away' ? lines.back : lines.front;
    const eyes = eyesOf(drawing), r = 1 + eyes;
    const slots = new Set([...drawing.veins, ...drawing.polish, ...drawing.crystals].map(([mr, mc]) => `${1 + mr},${mc + dx}`));
    const before = boxed(s, T, pose, drawing, dx);
    const drawn = before[r].join('');
    const left = drawn.search(/\S/), right = drawn.trimEnd().length - 1;
    const onRight = right < W - 1, end = onRight ? right : left, food = onRight ? right + 1 : left - 1;
    onRight ? rights++ : lefts++;
    for (const meal of MEALS) {
      const at = `${name} ${pose} dx ${dx}${faint(s) ? ' faint' : ''} ${JSON.stringify(meal)}`;
      const g = before.map(row => [...row]);
      drawMeal(g, meal, rows, eyes, dx, pose);
      assert.ok(food >= 0 && food < W && before[r][food] === ' ', `${at}: the food on a bare cell in the grid`);
      assert.equal(g[r][food], meal.food, at);
      const mouth = meal.open && pose === 'front';
      assert.equal(g[r][end], mouth ? (onRight ? '<' : '>') : before[r][end], `${at}: the mouth`);
      assert.ok(!slots.has(`${r},${end}`) && before[r][end] === rows[eyes][end - dx], `${at}: the mouth is its outline, not a mark`);
      for (let row = 0; row < W; row++) for (let c = 0; c < W; c++) if (!(row === r && (c === food || c === end))) assert.equal(g[row][c], before[row][c], `${at}: nothing else changes (${row},${c})`);
      assert.equal(g.length, W, at);
      for (const line of g) assert.equal(line.length, W, `${at}: never past the grid's edge`);
      // Bytes: the food costs one where it lengthens its row, on the right, and none on the left.
      assert.equal(g[r].join('').trimEnd().length - drawn.trimEnd().length, onRight ? 1 : 0, `${at}: its cost`);
    }
  }
  assert.ok(lefts > 0 && rights > 0, 'both sides are tried');
});

test('a meal never shares a screen with the hunger danger line, and costs a byte at most', () => {
  // A feed takes 3 off hunger, and hunger rises 10 a day, so within the hour of a feed it is at
  // most 7.42: never at 10. The worst screen, which carries that line, is no worse for meals.
  const rnd = mulberry(21), VERBS = ['feed', 'clean', 'pet'];
  let meals = 0;
  for (let i = 0; i < 300; i++) {
    const b = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 365 * DAY), visits = [];
    for (let t = b + HOUR; t < b + 12 * DAY; t += HOUR * (0.2 + rnd() * (rnd() < 0.15 ? 60 : 10))) {
      visits.push({ t: Math.round(t), acts: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => [VERBS[Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 4)]) });
    }
    const log = { ...newLog(b), visits };
    log.visits = log.visits.slice(0, replay(log, Infinity).visits);
    const last = log.visits.at(-1);
    if (!last) continue;
    const now = last.t + Math.floor(rnd() * 1.5 * HOUR);
    const s = replay(log, now), meal = mealAt(log, now);
    if (s.dead || !meal) continue;
    meals++;
    assert.equal(s.starvingSince, null, `fed within the hour, and starving: ${JSON.stringify(s)}`);
    for (const drawing of Object.values(DRAWINGS)) {
      const n = render(s, { now, host: 'h', drawing, meal }).length - render(s, { now, host: 'h', drawing }).length;
      assert.ok(n === 0 || n === 1, `a meal cost ${n} bytes`);
    }
  }
  assert.ok(meals >= 40, `only ${meals} rocks met at a meal`);
});

test('from hunger 7 on the screen it is drawn faint, until a feed brings it below 7; a grave is solid', () => {
  const s0 = { ...born(T), t: T, lastCare: T - HOUR, visits: 5, hunger: 2, happy: 6 };
  const at = o => sprite({ ...s0, ...o }, T)[EYES].trimEnd();
  assert.equal(at({ hunger: 6.49 }), face('^'), 'hunger 6 on the screen: solid');
  assert.equal(at({ hunger: 6.5 }), face('^', D.faint.front), 'hunger 7: faint');
  assert.equal(at({ hunger: 10, starvingSince: T - HOUR }), face('^', D.faint.front), 'starving: faint');
  assert.equal(sprite({ ...s0, hunger: 6.5 }, T, 'away')[EYES].trimEnd(), D.faint.back[EYES], 'its back too');
  const starved = { ...s0, hunger: 10, starvingSince: T - 48 * HOUR, dead: { t: T, cause: 'hungry' } };
  assert.equal(sprite(starved, T + HOUR)[EYES].trimEnd(), face('x'), 'a stone again, even when it starved');
  // Faint follows the number the screen shows, wherever it is between 0 and 10.
  for (let h = 0; h <= 10; h += 0.01) {
    const s = { ...s0, hunger: h };
    assert.equal(faint(s), shownHunger(s) >= 7, `hunger ${h}`);
  }
});

test('a rock petted but never fed shows happy eyes in every reply, drawn faint from hunger 7 until it dies', () => {
  let log = newLog(T);
  const seen = [];
  for (let t = T + 8 * HOUR; t <= T + 64 * HOUR; t += 8 * HOUR) {
    const r = act(log, 'pet x10 clean', { now: t, host: 'h' });
    assert.equal(r.status, 200);
    log = { ...log, visits: [...log.visits, r.visit] };
    const row = grid(r.text)[1 + EYES], hunger = Number(grid(r.text)[0].split(/ +/)[0]);
    assert.equal(row, shifted(face('^', hunger >= 7 ? D.faint.front : D.front), dxOf(log, t)).trimEnd(), `at ${(t - T) / HOUR}h, hunger ${hunger}`);
    seen.push(hunger >= 7);
  }
  assert.deepEqual(seen, [false, true, true, true, true, true, true, true], 'faint from the second visit, at hunger 7');
  const grave = replay(log, Infinity).dead;
  assert.equal(grave.cause, 'hungry');
  assert.equal(grid(look(log, { now: grave.t + HOUR, host: 'h' }).text)[1 + EYES], shifted(face('x'), dxOf(log, grave.t + HOUR)).trimEnd(), 'and solid in its grave');
});

test('every drawing has a faint front and back: the same cells and eyes, in lighter lines', () => {
  const footprint = rows => rows.map(row => [...row].map(ch => (ch === ' ' ? ' ' : '#')).join('').trimEnd());
  for (const [name, drawing] of Object.entries(DRAWINGS)) {
    const lighter = {}; // what each solid glyph becomes, row by row, on its front; its back must agree
    for (const side of ['front', 'back']) {
      const solid = drawing[side], light = drawing.faint[side];
      assert.equal(light.length, solid.length, `${name} ${side}`);
      assert.deepEqual(footprint(light), footprint(solid), `${name} ${side}: the same cells`);
      light.forEach((row, r) => [...row].forEach((ch, c) => {
        assert.equal(ch === 'E', solid[r][c] === 'E', `${name} ${side}: an eye at ${r},${c}`);
        if (ch === ' ' || ch === 'E') return;
        // Dots, colons and ticks, and the rims of googly eyes, which are its eyes, not its outline.
        // The base (row 4) keeps its line between its ends, since sand is `.` on that row.
        const rim = (ch === '(' && row[c + 1] === 'E') || (ch === ')' && row[c - 1] === 'E');
        const end = c === row.search(/\S/) || c === row.trimEnd().length - 1;
        assert.ok(rim || ".:'".includes(ch) || (r === 4 && !end && ch === solid[r][c] && '_-'.includes(ch)), `${name} ${side}: "${ch}" at ${r},${c} is not a light line`);
        // No tick beside a polish slot, where a polish mark would run into it (`.''`).
        if (side === 'front' && ch === "'") assert.ok(!drawing.polish.some(([pr, pc]) => pr === r && Math.abs(pc - c) === 1), `${name}: a tick at ${r},${c}, beside a polish slot`);
        const key = `${r} ${solid[r][c]}`;
        if (side === 'front' && !(key in lighter)) lighter[key] = ch;
        else if (key in lighter && !rim) assert.equal(ch, lighter[key], `${name} ${side}: "${solid[r][c]}" on row ${r} goes faint as "${lighter[key]}" on its front`);
      }));
    }
  }
});

test('faint, it keeps its marks, its moss and its ground, and costs nothing', () => {
  // A hungry rock with every mark, alone 13 hours (two tufts of moss), its base sunk in sand.
  const s = { ...born(T - 41 * DAY), t: T, lastCare: T - 13 * HOUR, visits: 90, hunger: 7, happy: 2, closeCalls: 3, petted: 3000, fed: 1500 };
  for (const [name, drawing] of Object.entries(DRAWINGS)) {
    const g = grid(render(s, { now: T, host: 'h', drawing, ground: { feed: 3, clean: 0, pet: 0 } })).map(row => row.padEnd(W));
    for (const [r, c, mark] of [...drawing.veins, ...drawing.polish, ...drawing.crystals]) assert.equal(g[1 + r][c], mark, `${name}: its mark at ${r},${c}`);
    assert.equal(g.join('').split('').filter(ch => ch === ',' || ch === '"').length, 2, `${name}: two tufts of moss`);
    const marks = new Set([...drawing.veins, ...drawing.polish, ...drawing.crystals].filter(([r]) => r === 4).map(([, c]) => c));
    [...drawing.faint.front[4]].forEach((ch, c) => { if (ch !== ' ' && !marks.has(c)) assert.equal(g[5][c], '.', `${name}: sand over its faint base at ${c}: "${g[5]}"`); });
    // The same rock a hair less hungry is drawn solid, in exactly as many bytes.
    for (const pose of ['front', 'away']) {
      const bytes = hunger => render({ ...s, hunger }, { now: T, host: 'h', drawing, pose }).length;
      assert.equal(bytes(6.5), bytes(6.49), `${name} ${pose}`);
    }
  }
});
