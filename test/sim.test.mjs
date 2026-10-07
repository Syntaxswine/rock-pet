// The engine (exact, continuous time) against the reference simulator (tools/rocksim.mjs, which
// steps 2-minute ticks). They share no code: the rule constants are checked equal here, and the
// implementations must then agree to within a tick or two on everything a caretaker can do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../tools/rocksim.mjs';
import { RULES } from '../src/rules.mjs';
import { replay, HOUR } from '../src/engine.mjs';

const R = { ...sim.RULESETS.rock, grace: 48, graceMode: 'continuous' };
const T0 = Date.UTC(2026, 0, 1); // the sim's t=0 sits on the mess clock; so does a UTC midnight
const TICK_MS = sim.DT * HOUR;   // 2 minutes
const TOL_H = 0.15;              // death times agree to this many hours (the sim's tick is 0.033h)
const TOL_HAPPY = 0.15;          // happiness at a visit; hunger must agree to 1e-6
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const log = (born, visits) => ({ born, rules: RULES.version, visits });

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the simulator and the engine run the same rules', () => {
  const S = sim.RULESETS.rock;
  assert.equal(S.outageMode, RULES.outageMode);
  assert.equal(S.hungerPerHour, RULES.hungerPerHour);
  assert.equal(S.feed, RULES.feed);
  assert.equal(S.decay, RULES.decay);
  assert.equal(S.messPain, RULES.messPain);
  assert.equal(S.pet, RULES.pet);
  assert.equal(S.messCeil, RULES.messCeil);
  assert.deepEqual(S.mess, { kind: 'clock', every: RULES.messEveryH });
  assert.equal(S.petCap, null);
  assert.equal(S.cleanAll, true);
  for (let hh = 0; hh <= 10; hh += 0.125) assert.equal(S.hungerPain(hh), RULES.painPerPoint * Math.max(0, hh - RULES.painFrom), `pain at ${hh}`);
});

test('the simulator\'s default grace is the rules\' 48h', { skip: process.env.GRACE !== undefined && 'GRACE is set in the environment' }, () => {
  assert.equal(sim.graceOf(sim.RULESETS.rock), RULES.graceH);
});

test('nobody comes: the engine agrees with the simulator at every point on the mess clock', () => {
  for (const ph of [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 11.9]) {
    const a = sim.absence(R, 24 + ph);
    const b = T0 + (24 + ph) * HOUR;
    const s = replay(log(b, []), Infinity);
    assert.equal(s.dead.cause, a.cause, `phase ${ph}`);
    assert.ok(Math.abs((s.dead.t - b) / HOUR - a.gap) <= TOL_H, `phase ${ph}: engine ${(s.dead.t - b) / HOUR}h, sim ${a.gap}h`);
    assert.ok(Math.abs((s.sorrowSince - b) / HOUR - a.jFloor) <= TOL_H, `phase ${ph}: floor engine ${(s.sorrowSince - b) / HOUR}h, sim ${a.jFloor}h`);
  }
});

// The sim's own driver loop (rocksim `live`), with each visit's verbs and a look before each.
// A visit at engine tick k is handed to the sim half a tick earlier, so the sim applies it after
// exactly k ticks: both see it at the same instant.
function simRun(visits, horizonH) {
  const rock = sim.newRock();
  const seen = [];
  let vi = 0;
  while (rock.t < horizonH && !rock.dead) {
    while (vi < visits.length && (visits[vi].k - 0.5) * sim.DT <= rock.t) {
      seen.push({ hunger: rock.h, happy: rock.j, messes: rock.messes });
      sim.visit(R, rock, visits[vi].does);
      vi++;
    }
    sim.tick(R, rock);
  }
  return { rock, seen };
}
const actsOf = does => [does.feed && ['feed', 4], does.clean && ['clean', 1], does.pet && ['pet', 10]].filter(Boolean);

function compare(visits, days, label) {
  const engineVisits = visits.map(v => ({ t: T0 + v.k * TICK_MS, acts: actsOf(v.does) }));
  const { rock, seen } = simRun(visits, days * 24);
  const end = T0 + days * 24 * HOUR;
  const fate = replay(log(T0, engineVisits), end);
  const out = { label, worstHappy: 0, deathGap: null, skipped: null };
  // Too close to call: a visit that could save the rock, arriving within reach of the moment it
  // would otherwise die (whether it then dies or is saved), may fall on either side of that
  // moment in the sim; so may a death at the horizon.
  const saves = cause => (cause === 'hungry' ? 'feed' : 'pet');
  if (engineVisits.some((v, i) => {
    const d = replay(log(T0, engineVisits.slice(0, i)), Infinity).dead; // if nobody came from here on
    return Math.abs(v.t - d.t) <= TOL_H * HOUR && v.acts.some(([w]) => w === saves(d.cause));
  })) out.skipped = 'a visit';
  else if (Math.abs(replay(log(T0, engineVisits), Infinity).dead.t - end) <= TOL_H * HOUR) out.skipped = 'the horizon';
  if (out.skipped) return out;
  for (let i = 0; i < seen.length; i++) {
    const e = replay(log(T0, engineVisits.slice(0, i)), engineVisits[i].t);
    if (e.dead) { // the sim died a hair later than the engine, with this (useless) visit between
      assert.ok(engineVisits[i].t - e.dead.t <= TOL_H * HOUR, `${label}, visit ${i}: the engine died ${(engineVisits[i].t - e.dead.t) / HOUR}h before it`);
      continue;
    }
    assert.ok(Math.abs(e.hunger - seen[i].hunger) <= 1e-6, `${label}, visit ${i}: hunger ${e.hunger} vs sim ${seen[i].hunger}`);
    assert.equal(e.messes, seen[i].messes, `${label}, visit ${i}: messes`);
    out.worstHappy = Math.max(out.worstHappy, Math.abs(e.happy - seen[i].happy));
    assert.ok(Math.abs(e.happy - seen[i].happy) <= TOL_HAPPY, `${label}, visit ${i}: happiness ${e.happy} vs sim ${seen[i].happy}`);
  }
  assert.equal(!!fate.dead, !!rock.dead, `${label}: engine ${fate.dead ? 'dead' : 'alive'}, sim ${rock.dead ? 'dead' : 'alive'}`);
  if (fate.dead) {
    assert.equal(fate.dead.cause, rock.dead.cause, `${label}: cause`);
    out.deathGap = Math.abs((fate.dead.t - T0) / HOUR - rock.dead.t);
    assert.ok(out.deathGap <= TOL_H, `${label}: death engine ${(fate.dead.t - T0) / HOUR}h, sim ${rock.dead.t}h`);
  }
  return out;
}
// Visit ticks next to a mess tick move 3 ticks on: there the sim's order of mess and visit
// depends on float rounding in its clock.
const offMessTick = k => (k % 360 <= 1 || k % 360 >= 359 ? k + 3 : k);

test('random caretakers: the engine agrees with the simulator at every visit and at death', () => {
  const rnd = mulberry(2026);
  const results = [];
  for (let run = 0; run < 160; run++) {
    const visits = [];
    for (let k = 0; ;) {
      const u = rnd();
      const gapH = u < 0.7 ? 1 + rnd() * 15 : u < 0.9 ? 16 + rnd() * 24 : 40 + rnd() * 34;
      k = offMessTick(k + Math.max(1, Math.round(gapH * 30)));
      if (k * sim.DT >= 14 * 24) break;
      const does = { feed: rnd() < 0.7, clean: rnd() < 0.7, pet: rnd() < 0.7 };
      if (does.feed || does.clean || does.pet) visits.push({ k, does });
    }
    results.push(compare(visits, 14, `run ${run}`));
  }
  const skipped = results.filter(r => r.skipped).length;
  const deaths = results.filter(r => r.deathGap !== null);
  const worstHappy = Math.max(...results.map(r => r.worstHappy));
  const worstDeath = Math.max(...deaths.map(r => r.deathGap));
  console.log(`  random caretakers: ${results.length} runs, ${deaths.length} deaths compared, ${skipped} too close to call; ` +
    `worst happiness gap ${worstHappy.toFixed(3)} (${(100 * worstHappy / TOL_HAPPY).toFixed(0)}% of tolerance), ` +
    `worst death gap ${worstDeath.toFixed(3)}h (${(100 * worstDeath / TOL_H).toFixed(0)}%)`);
  assert.ok(skipped <= 8, `${skipped} runs too close to call`);
  assert.ok(deaths.length >= 40, `only ${deaths.length} deaths compared`);
  assert.ok(results.length - skipped - deaths.length >= 10, 'too few rocks survived to compare a survival');
});

test('the published vectors: the engine agrees with the simulator', () => {
  const at = (every, does) => {
    const visits = [];
    for (let t = every; t < 365 * 24; t += every) visits.push({ k: offMessTick(Math.round(t * 30)), does });
    return visits;
  };
  const same = r => assert.equal(r.skipped, null, `${r.label}: too close to call (${r.skipped})`);
  // lazybot: pets (and cleans) but never feeds
  for (const clean of [false, true]) for (const every of [6, 8, 12]) same(compare(at(every, { feed: false, clean, pet: true }), 30, `lazybot every ${every}h clean ${clean}`));
  // ceiling: feeds and pets every 8h, never cleans
  same(compare(at(8, { feed: true, clean: false, pet: true }), 30, 'never cleans'));
  // life support: one full visit every N hours, for a year
  for (const every of [36, 48, 57, 63, 66, 68, 69, 70, 72]) same(compare(at(every, { feed: true, clean: true, pet: true }), 365, `every ${every}h`));
});
