import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newLog, look, act, history, creditOutage } from '../src/rock.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { compact, readCheckpoint } from '../src/checkpoint.mjs';

const FULL = 'feed x4 clean pet x10';
const host = 'rock.test';
const roundtrip = log => readCheckpoint(JSON.stringify(compact(log)));

test('stored checkpoints preserve the complete game across care, same-millisecond visits, ice, meals, personality and death', () => {
  for (const born of [Date.UTC(2026, 11, 1), Date.UTC(2027, 0, 12), Date.UTC(2026, 6, 6)]) {
    let full = newLog(born), saved = roundtrip(full);
    for (let i = 1; i <= 110; i++) {
      const now = born + Math.ceil(i / 2) * 8 * HOUR;
      const body = i % 2 ? FULL : ['pet x20', 'feed x20', 'clean x20'][i % 3];
      const a = act(full, body, { now, host }), b = act(saved, body, { now, host });
      assert.deepEqual(b, a, `care ${i}`);
      full = { ...full, visits: [...full.visits, a.visit] };
      saved = roundtrip({ ...saved, visits: [...saved.visits, b.visit] });
      for (const dt of [0, 61_000, HOUR / 2, HOUR, 4 * HOUR]) {
        assert.deepEqual(replay(saved, now + dt), replay(full, now + dt), `engine ${i}+${dt}`);
        assert.deepEqual(look(saved, { now: now + dt, host }), look(full, { now: now + dt, host }), `look ${i}+${dt}`);
      }
      assert.deepEqual(history(saved, { now }), history(full, { now }));
      assert.ok(saved.visits.length <= 2, 'old care is compacted, not carried in the hot row');
    }
    const now = born + 90 * 24 * HOUR;
    assert.deepEqual(look(saved, { now, host }), look(full, { now, host }), 'unwatched death');
    assert.deepEqual(act(saved, FULL, { now, host }), act(full, FULL, { now, host }), 'late care');
    assert.deepEqual(history(saved, { now }), history(full, { now }), 'the grave biography');
  }
});

test('checkpointed needs, meals and movement pause only for recorded host outages', () => {
  const born = Date.UTC(2026, 11, 2);
  let full = newLog(born), saved = roundtrip(full);
  for (let i = 1; i <= 18; i++) {
    const now = born + i * 8 * HOUR;
    const a = act(full, FULL, { now, host }), b = act(saved, FULL, { now, host });
    full = { ...full, visits: [...full.visits, a.visit] };
    saved = roundtrip({ ...saved, visits: [...saved.visits, b.visit] });
  }
  const start = born + 144 * HOUR + 60_000, end = start + 8 * 24 * HOUR;
  const outage = { start, end, evidence: 'independent-host-incident' };
  for (const log of [full, saved]) log.outages = [creditOutage(log, outage, { now: end })];
  for (const now of [start, start + HOUR, end, end + HOUR / 2, end + 6 * HOUR]) {
    assert.deepEqual(replay(saved, now), replay(full, now));
    assert.deepEqual(look(saved, { now, host }), look(full, { now, host }));
    assert.deepEqual(history(saved, { now }), history(full, { now }));
  }
});

test('unreadable or incompatible checkpoints are errors, never newborn rocks', () => {
  assert.throws(() => readCheckpoint('broken'));
  assert.throws(() => readCheckpoint('{}'));
  assert.throws(() => readCheckpoint(JSON.stringify({ ...newLog(0), checkpoint: { version: 2 } })));
});

test('a recent archived feed still has its meal and rest while later visits only pet', () => {
  const born = Date.UTC(2026, 9, 9, 10);
  let full = newLog(born), saved = roundtrip(full);
  for (const [dt, body] of [[1, 'feed'], [60_000, 'pet'], [120_000, 'pet'], [180_000, 'clean']]) {
    const now = born + dt;
    const a = act(full, body, { now, host }), b = act(saved, body, { now, host });
    assert.deepEqual(b, a);
    full = { ...full, visits: [...full.visits, a.visit] };
    saved = roundtrip({ ...saved, visits: [...saved.visits, b.visit] });
    for (const offset of [0, 30 * 60_000, HOUR]) assert.deepEqual(look(saved, { now: now + offset, host }), look(full, { now: now + offset, host }));
  }
});
