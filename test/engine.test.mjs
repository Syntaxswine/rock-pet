import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.mjs';
import { replay, drain, hoursToLose, ceilingOf, nextMessAfter, HOUR } from '../src/engine.mjs';

const T0 = Date.UTC(2026, 0, 1); // a midnight: a mess falls due then, and every 12h after
const h = n => n * HOUR;
const log = (born, ...visits) => ({ born, rules: RULES.version, visits });
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tolerance ${tol})`);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the rules are the decided ones (the DESIGN-NOTES rules table)', () => {
  assert.deepEqual({ ...RULES }, {
    version: 1, hungerPerHour: 10 / 24, feed: 3, painFrom: 6, painPerPoint: 0.4, decay: 0.4,
    messPain: 0.3, messEveryH: 12, messCeil: 3, pet: 2, graceH: 48, maxCount: 20,
  });
});

test('messes fall due at 00:00 and 12:00 UTC, never at the moment asked about', () => {
  assert.equal(nextMessAfter(T0), T0 + h(12));
  assert.equal(nextMessAfter(T0 + 1), T0 + h(12));
  assert.equal(nextMessAfter(T0 + h(12) - 1), T0 + h(12));
  assert.equal(new Date(nextMessAfter(Date.UTC(2026, 5, 3, 13, 7))).toISOString(), '2026-06-04T00:00:00.000Z');
});

test('hunger rises 10 per 24h; a feed takes 3 and never goes below 0', () => {
  const b = T0 + h(1);
  near(replay(log(b), b + h(6)).hunger, 2.5, 1e-12, 'hunger after 6h');
  assert.equal(replay(log(b, { t: b + h(6), acts: [['feed', 1]] }), b + h(6)).hunger, 0);
  near(replay(log(b, { t: b + h(18), acts: [['feed', 1]] }), b + h(18)).hunger, 4.5, 1e-12, '7.5 fed once');
  near(replay(log(b), b + h(30)).hunger, 10, 0, 'hunger stops at 10');
});

test('happiness drifts 0.4/h with no mess and no hunger pain', () => {
  const b = T0 + h(1); // the first mess is 11h away
  near(replay(log(b), b + h(6)).happy, 7.6, 1e-12, 'happiness after 6h');
});

test('a mess lowers the ceiling by 3 the moment it appears, and drains 0.3/h more', () => {
  const b = T0 + h(11);
  const at = replay(log(b), T0 + h(12)); // 9.6 after an hour, then the mess pins it to 7
  assert.equal(at.messes, 1);
  assert.equal(at.happy, 7);
  near(replay(log(b), T0 + h(13)).happy, 7 - 0.7, 1e-12, 'an hour with one mess (hunger still below 6)');
});

test('clean removes every mess in one action; pets stop at the ceiling', () => {
  const b = T0 + h(1), t = T0 + h(37); // messes at 12, 24 and 36h
  assert.equal(replay(log(b), t).messes, 3);
  assert.equal(replay(log(b, { t, acts: [['pet', 10]] }), t).happy, ceilingOf(3));
  const c = replay(log(b, { t, acts: [['clean', 1], ['pet', 10]] }), t);
  assert.equal(c.messes, 0);
  assert.equal(c.happy, 10);
  assert.equal(ceilingOf(3), 1);
  assert.equal(ceilingOf(7), -10);
  assert.equal(ceilingOf(9), -10);
});

test('hunger pain: the closed-form drain matches a numerical integral of the rules, and inverts', () => {
  // Written from the rules table, not from src: 0.4/h, 0.3/h per mess, 0.4/h per point above 6.
  const rate = (hh, m) => 0.4 + 0.3 * m + 0.4 * Math.max(0, Math.min(10, hh) - 6);
  const rnd = mulberry(7);
  let worst = 0, worstInv = 0;
  for (let i = 0; i < 300; i++) {
    const h0 = rnd() * 10, m = Math.floor(rnd() * 9), tau = rnd() * 40;
    const n = 20000, dx = tau / n;
    let sum = 0;
    for (let k = 0; k <= n; k++) sum += (k === 0 || k === n ? 0.5 : 1) * rate(h0 + (10 / 24) * k * dx, m);
    worst = Math.max(worst, Math.abs(drain(h0, m, tau) - sum * dx));
    worstInv = Math.max(worstInv, Math.abs(hoursToLose(h0, m, drain(h0, m, tau)) - tau));
  }
  assert.ok(worst < 1e-5, `drain off the integral by ${worst}`);
  assert.ok(worstInv < 1e-9, `hoursToLose off its inverse by ${worstInv}`);
});

test('nobody comes after full care: it dies lonely 67-72h later, at the floor from 19-23.6h', () => {
  for (const ph of [0, 3, 6, 9, 11.9]) { // where full care falls on the 12h mess clock
    const b = T0 + h(24 + ph);
    const s = replay(log(b), b + h(14 * 24));
    assert.equal(s.dead?.cause, 'lonely', `phase ${ph}`);
    // AGENTS.md publishes these to one decimal.
    const gap = Number(((s.dead.t - b) / HOUR).toFixed(1)), floor = Number(((s.sorrowSince - b) / HOUR).toFixed(1));
    assert.ok(gap >= 67 && gap <= 72, `phase ${ph}: died ${gap}h after care`);
    assert.ok(floor >= 19 && floor <= 23.6, `phase ${ph}: at the floor from ${floor}h`);
    near(s.dead.t - s.sorrowSince, h(48), 1e-6, 'death is 48h after reaching the floor');
  }
});

test('petted (and cleaned) every 6/8/12h but never fed: it dies hungry exactly 72h after birth', () => {
  for (const clean of [false, true]) for (const every of [6, 8, 12]) {
    const visits = [];
    for (let t = every; t < 30 * 24; t += every) visits.push({ t: T0 + h(t), acts: clean ? [['clean', 1], ['pet', 10]] : [['pet', 10]] });
    const s = replay(log(T0, ...visits), T0 + h(30 * 24));
    assert.equal(s.dead?.cause, 'hungry', `every ${every}h, clean ${clean}`);
    near(s.dead.t, T0 + h(72), 1, `every ${every}h, clean ${clean}: time of death`);
  }
});

test('fed and petted every 8h but never cleaned: it dies filthy on day 5.4', () => {
  const visits = [];
  for (let t = 8; t < 30 * 24; t += 8) visits.push({ t: T0 + h(t), acts: [['feed', 4], ['pet', 10]] });
  const s = replay(log(T0, ...visits), T0 + h(30 * 24));
  assert.equal(s.dead?.cause, 'filthy');
  assert.equal(((s.dead.t - T0) / h(24)).toFixed(1), '5.4');
  assert.ok(s.messes >= 7, `${s.messes} messes at death`);
});

test('life support: one full visit every <=68h keeps it alive a year; every 69h or more kills it within a week', () => {
  for (const every of [12, 24, 36, 48, 60, 66, 68, 69, 70, 72]) {
    const visits = [];
    for (let t = every; t < 365 * 24; t += every) visits.push({ t: T0 + h(t), acts: FULL });
    const s = replay(log(T0, ...visits), T0 + h(365 * 24));
    if (every <= 68) assert.equal(s.dead, null, `every ${every}h died on day ${s.dead && (s.dead.t - T0) / h(24)}`);
    else assert.ok(s.dead && s.dead.t - T0 < h(7 * 24), `every ${every}h: ${s.dead ? `died on day ${(s.dead.t - T0) / h(24)}` : 'alive'}`);
  }
});

test('"in a row": the 48h clock resets when the stat leaves the extreme, not when someone merely visits', () => {
  const b = T0 + h(24);
  const alone = replay(log(b), Infinity);
  const t = Math.round(alone.sorrowSince + h(47));
  // Feeding and cleaning leave happiness at -10: the sorrow clock runs on to the same moment.
  const tended = replay(log(b, { t, acts: [['feed', 4], ['clean', 1]] }), Infinity);
  assert.deepEqual(tended.dead, { t: alone.dead.t, cause: 'lonely' });
  // One pet lifts it off the floor; the clock starts again only when it sinks back.
  const petted = replay(log(b, { t, acts: [['feed', 4], ['pet', 1]] }), Infinity);
  assert.ok(petted.sorrowSince > t, 'the clock restarted after the pet');
  assert.ok(petted.dead.t > alone.dead.t, 'it lived longer');
  near(petted.dead.t, petted.sorrowSince + h(48), 1e-6, '48h from the new start');
  // The same for hunger: pets do not reset the starving clock (above); a feed does.
  const starving = replay(log(b, { t: b + h(30), acts: [['pet', 10]] }), Infinity);
  near(starving.starvingSince, b + h(24), 1, 'starving since 24h, through the pet');
  assert.equal(starving.dead.cause, 'hungry');
  const fed = replay(log(b, { t: b + h(30), acts: [['feed', 1], ['pet', 10]] }), b + h(31));
  assert.equal(fed.starvingSince, null);
});

test('a rock pinned to -10 by its messes starts the sorrow clock the moment the mess appears', () => {
  // Fed and petted every half hour, never cleaned: happiness stays near the ceiling (above -10)
  // until the 7th mess drops the ceiling itself to -10.
  const visits = [];
  for (let t = 0.5; t < 30 * 24; t += 0.5) visits.push({ t: T0 + h(t) + 1, acts: [['feed', 4], ['pet', 10]] });
  const s = replay(log(T0, ...visits), Infinity);
  assert.equal(s.dead.cause, 'filthy');
  assert.equal(s.sorrowSince, T0 + h(84), 'the clock started with the 7th mess');
  near(s.dead.t, T0 + h(84 + 48), 1e-6, 'dead 48h later');
  assert.equal(s.messes, 10, 'three more messes before death; the fourth is due at the moment of death');
});

test('a visit at or after the moment of death changes nothing', () => {
  const alone = replay(log(T0), Infinity);
  for (const dt of [0, 1, h(1), h(100)]) {
    const late = replay(log(T0, { t: alone.dead.t + dt, acts: FULL }), Infinity);
    assert.deepEqual(late, alone, `a visit ${dt}ms after death`);
  }
});

test('death is computed, not ticked: every look after the death agrees on its moment', () => {
  const rnd = mulberry(3);
  const visits = [];
  for (let t = T0 + h(5); t < T0 + h(9 * 24); t += h(4 + rnd() * 30)) visits.push({ t: Math.round(t), acts: FULL });
  const L = log(T0, ...visits);
  const fate = replay(L, Infinity);
  assert.ok(fate.dead, 'the visits stop on day 9, so it dies');
  for (let now = T0; now < T0 + h(20 * 24); now += h(1) + 7) {
    const s = replay(L, now);
    if (now < fate.dead.t) assert.equal(s.dead, null, `alive at ${now}`);
    else assert.deepEqual(s.dead, fate.dead, `seen from ${now}`);
  }
});

test('every action is benevolent: an extra visit never brings death sooner or leaves any stat worse', () => {
  const rnd = mulberry(11);
  const VERBS = ['feed', 'clean', 'pet'];
  const acts = () => Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => [VERBS[Math.floor(rnd() * 3)], 1 + Math.floor(rnd() * 5)]);
  let compared = 0;
  for (let run = 0; run < 300; run++) {
    const b = T0 + Math.floor(rnd() * h(24));
    const visits = Array.from({ length: Math.floor(rnd() * 14) }, () => ({ t: b + Math.floor(rnd() * h(240)), acts: acts() })).sort((x, y) => x.t - y.t);
    const without = log(b, ...visits);
    const A = replay(without, Infinity);
    const extra = { t: b + Math.floor(rnd() * (A.dead.t - b)), acts: acts() }; // while it lives
    const withIt = log(b, ...[...visits, extra].sort((x, y) => x.t - y.t));
    const B = replay(withIt, Infinity);
    assert.ok(B.dead.t >= A.dead.t, `run ${run}: the extra visit brought death ${(A.dead.t - B.dead.t) / HOUR}h sooner`);
    for (let k = 0; k < 8; k++) {
      const t = extra.t + rnd() * (A.dead.t - extra.t);
      if (!(t > extra.t)) continue;
      const a = replay(without, t), c = replay(withIt, t);
      assert.ok(c.hunger <= a.hunger + 1e-9, `run ${run}: hungrier`);
      assert.ok(c.happy >= a.happy - 1e-9, `run ${run}: sadder`);
      assert.ok(c.messes <= a.messes, `run ${run}: messier`);
      compared++;
    }
  }
  assert.ok(compared > 1000, `only ${compared} comparisons ran`);
});

test('the log must be in time order', () => {
  assert.throws(() => replay(log(T0, { t: T0 + h(2), acts: FULL }, { t: T0 + h(1), acts: FULL }), T0 + h(3)), /out of time order/);
  assert.throws(() => replay(log(T0, { t: T0 - 1, acts: FULL }), T0 + h(3)), /out of time order/);
});
