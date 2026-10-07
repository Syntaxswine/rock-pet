import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCare, careTotals, personality, percentages, personalitySummary, PERSONALITIES, DAILY_CARE, CARE_AXES } from '../src/personality.mjs';
import { act, history, newLog } from '../src/rock.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { parseLog, birthLine, visitLine } from '../src/log.mjs';

const T = Date.UTC(2026, 9, 7), opts = t => ({ now: t, host: 'rock.test' });
const empty = () => ({ feed: 0, clean: 0, pet: 0 });
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-10, `${label}: ${a} vs ${b}`);
const at = shares => Object.fromEntries(CARE_AXES.map((key, i) => [key, shares[i] * DAILY_CARE[key]]));

test('daily weights follow the baseline demand of the three actual verbs', () => {
  near(DAILY_CARE.feed, 10 / 3, 'feeds/day');
  near(DAILY_CARE.clean, 2, 'cleans/day');
  near(DAILY_CARE.pet, 4.8, 'pets/day');
  const profile = personality({ feed: 25, clean: 15, pet: 36 });
  for (const value of Object.values(profile.shares)) near(value, 1 / 3, 'equal normalized care');
  assert.equal(profile.dominant.id, 'balanced');
  near(profile.blend.balanced, 1, 'center weight');
  const equalRaw = personality({ feed: 10, clean: 10, pet: 10 });
  assert.ok(equalRaw.shares.clean > equalRaw.shares.feed && equalRaw.shares.feed > equalRaw.shares.pet);
});

test('the three corners, three pair balances, and center have exactly seven distinct variants', () => {
  const cases = [
    [[1, 0, 0], 'feed'], [[0, 1, 0], 'clean'], [[0, 0, 1], 'pet'],
    [[0.5, 0.5, 0], 'feed-clean'], [[0.5, 0, 0.5], 'feed-pet'], [[0, 0.5, 0.5], 'clean-pet'],
    [[1 / 3, 1 / 3, 1 / 3], 'balanced'],
  ];
  assert.equal(PERSONALITIES.length, 7);
  for (const [shares, id] of cases) {
    const profile = personality(at(shares));
    assert.equal(profile.dominant.id, id);
    near(profile.blend[id], 1, id);
    for (const other of PERSONALITIES.filter(p => p.id !== id)) near(profile.blend[other.id], 0, `${id}/${other.id}`);
  }
  assert.deepEqual(personality(at([1, 0, 0])).point, { x: 0.5, y: 0 });
  assert.deepEqual(personality(at([0, 1, 0])).point, { x: 0, y: Math.sqrt(3) / 2 });
  assert.deepEqual(personality(at([0, 0, 1])).point, { x: 1, y: Math.sqrt(3) / 2 });
});

test('every triangle position blends smoothly and reconstructs the same care shares', () => {
  for (let feed = 0; feed <= 20; feed++) for (let clean = 0; clean <= 20 - feed; clean++) {
    const target = [feed / 20, clean / 20, (20 - feed - clean) / 20];
    const profile = personality(at(target));
    near(Object.values(profile.blend).reduce((sum, x) => sum + x, 0), 1, 'blend sum');
    assert.ok(Object.values(profile.blend).every(x => x >= 0 && x <= 1));
    for (const [i, key] of CARE_AXES.entries()) {
      const reconstructed = PERSONALITIES.reduce((sum, p) => sum + (p.axes.includes(key) ? profile.blend[p.id] / p.axes.length : 0), 0);
      near(reconstructed, target[i], key);
    }
    near(profile.point.x, target[0] / 2 + target[2], 'x');
    near(profile.point.y, Math.sqrt(3) / 2 * (target[1] + target[2]), 'y');
    assert.equal(Object.values(percentages(profile.blend)).reduce((n, v) => n + v, 0), 100);
  }
  const left = personality(at([0.4 - 1e-8, 0.4 + 1e-8, 0.2]));
  const right = personality(at([0.4 + 1e-8, 0.4 - 1e-8, 0.2]));
  for (const p of PERSONALITIES) assert.ok(Math.abs(left.blend[p.id] - right.blend[p.id]) < 1e-6, p.id);
  const shades = personality(at([0.5, 0.3, 0.2]));
  near(shades.blend.balanced, 0.6, 'balanced shade');
  near(shades.blend['feed-clean'], 0.2, 'pair shade');
  near(shades.blend.feed, 0.2, 'corner shade');
});

test('zero history is unformed; scale and birth time do not invent a personality', () => {
  const zero = personality(empty());
  assert.equal(zero.formed, false);
  assert.equal(zero.dominant, null);
  assert.equal(zero.point, null);
  assert.match(personalitySummary(zero), /still forming/);
  const a = personality({ feed: 10, clean: 2, pet: 20 });
  const b = personality({ feed: 1000, clean: 200, pet: 2000 });
  for (const key of CARE_AXES) near(a.shares[key], b.shares[key], key);
  assert.deepEqual(a.dominant, b.dominant);
  assert.ok(Object.values(personality({ feed: 1e300, clean: 1e300, pet: 1e300 }).shares).every(Number.isFinite));
  assert.deepEqual(personality({ feed: 1, clean: 1, pet: 1 }, { feed: 1, clean: 1, pet: 1 }).shares, { feed: 1 / 3, clean: 1 / 3, pet: 1 / 3 });
});

test('three counters accumulate every accepted repetition and can be checkpointed or rebuilt', () => {
  const acts = [['pet', 5], ['clean', 3], ['feed', 4], ['pet', 2]];
  const original = empty();
  const total = addCare(original, acts);
  assert.deepEqual(total, { feed: 4, clean: 3, pet: 7 });
  assert.deepEqual(original, empty());
  const split = acts.reduce((counts, act) => addCare(counts, [act]), empty());
  assert.deepEqual(split, total);
  const v1 = { t: T, acts }, v2 = { t: T + HOUR, acts: [['feed', 2]] };
  const oldLog = parseLog(birthLine(T) + visitLine(v1) + visitLine(v2));
  assert.deepEqual(careTotals(oldLog), { feed: 6, clean: 3, pet: 7 });
  assert.deepEqual(addCare(careTotals({ visits: [v1] }), v2.acts), careTotals(oldLog));
  assert.deepEqual(careTotals({ visits: [{ t: T + 5000, acts }, { t: T + 10000, acts: v2.acts }] }), careTotals(oldLog));
});

test('extra care affects personality, while invalid/dead requests and reads add nothing', () => {
  const log = newLog(T);
  const accepted = act(log, 'feed x20 clean x3 pet x5', opts(T));
  assert.equal(accepted.status, 200);
  assert.match(accepted.text, /quirk: it has had its first visitor\./);
  const after = { ...log, visits: [accepted.visit] };
  assert.deepEqual(careTotals(after), { feed: 20, clean: 3, pet: 5 });
  assert.deepEqual([replay(after, T).hunger, replay(after, T).happy, replay(after, T).messes], [0, 10, 0]);
  const copy = JSON.stringify(after);
  const bio = history(after, opts(T)).text;
  assert.match(bio, /care totals: feed 20  clean 3  pet 5/);
  assert.match(bio, /care balance: .*\(weighted\)/);
  assert.match(bio, /personality: /);
  assert.equal(JSON.stringify(after), copy);
  assert.equal(act(after, 'hug', opts(T)).visit, undefined);
  assert.equal(act(after, 'feed', opts(T + 100 * HOUR)).visit, undefined);
  assert.equal(history(after, opts(T + 100 * HOUR)).text.match(/^personality:.*$/m)[0], bio.match(/^personality:.*$/m)[0]);
  assert.deepEqual(careTotals(after), { feed: 20, clean: 3, pet: 5 });
});

test('care-derived personality replaces the birth seed and includes the current action', () => {
  const log = b => ({ ...newLog(b), visits: [{ t: b, acts: [['clean', 1]] }] });
  const a = act(log(T), 'feed x20', opts(T + HOUR));
  const b = act(log(T + 1000), 'feed x20', opts(T + HOUR + 1000));
  assert.match(a.text, /quirk: it saves an imaginary crumb\./);
  assert.equal(a.text.match(/^quirk:.*$/m)[0], b.text.match(/^quirk:.*$/m)[0]);
  const petted = act(log(T), 'pet x20', opts(T + HOUR));
  assert.match(petted.text, /quirk: it leans into the attention\./);
});

test('bad counters, daily weights and accepted actions fail explicitly', () => {
  for (const value of [NaN, Infinity, -1, undefined, '3']) assert.throws(() => personality({ ...empty(), feed: value }));
  for (const value of [0, -1, Infinity, NaN]) assert.throws(() => personality(empty(), { ...DAILY_CARE, clean: value }));
  for (const act of [['hug', 1], ['pet', 0], ['pet', 21], ['pet', 1.5]]) assert.throws(() => addCare(empty(), [act]));
  assert.throws(() => addCare({ ...empty(), feed: Number.MAX_SAFE_INTEGER }, [['feed', 1]]));
});
