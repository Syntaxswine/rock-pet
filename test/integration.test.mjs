import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reaction } from '../src/story.mjs';
import { born, applyVisit, replay, HOUR } from '../src/engine.mjs';
import { act, look, history, newLog, name } from '../src/rock.mjs';
import { birthLine, nameLine, parseLog } from '../src/log.mjs';
import { hash } from '../src/character.mjs';

const T = Date.UTC(2026, 9, 7), opts = now => ({ now, host: 'rock.test' });
const FULL = [['feed', 4], ['clean', 1], ['pet', 10]];
const logOf = acts => ({ ...newLog(T), visits: [{ t: T, acts }] });

test('all seven care histories keep their own reaction, independent of birth', () => {
  const cases = [
    [[['feed', 20]], 'it settles closer, comfortably full.'],
    [[['clean', 20]], 'it accepts a very orderly pat.'],
    [[['pet', 20]], 'it leans into the attention.'],
    [[['feed', 20], ['clean', 12]], 'it seems quietly at home.'],
    [[['feed', 10], ['pet', 14]], 'it nestles into the company.'],
    [[['clean', 10], ['pet', 20]], 'it returns a very gentle lean.'],
    [[['feed', 10], ['clean', 6], ['pet', 14]], 'it holds the warmth for a moment.'],
  ];
  for (const [acts, line] of cases) for (const offset of [0, 1000, 60000]) {
    const before = { ...born(T + offset), happy: 0, visits: 1 };
    const after = structuredClone(before);
    applyVisit(after, [['pet', 1]]);
    const log = { ...logOf(acts), born: T + offset };
    assert.equal(reaction(log, before, after), `quirk: ${line}\n`);
    assert.equal(reaction(log, before, after), reaction(log, before, after));
  }
});

test('weighted preferences choose among effective verbs, while any clean can reveal the stone', () => {
  const before = { ...born(T), hunger: 5, happy: 0, messes: 1, visits: 1 };
  const after = structuredClone(before); applyVisit(after, FULL);
  const feedLog = logOf([['feed', 20]]);
  // Find both geological and ordinary choices; this still tests a feed-favoring rock.
  const lines = new Set();
  for (let visits = 2; visits < 30; visits++) {
    if (visits === 10) continue;
    const line = reaction(feedLog, { ...before, visits: visits - 1 }, { ...after, visits });
    lines.add(line);
    if (hash(T, 9, visits) % 4 !== 0) assert.equal(line, 'quirk: it saves an imaginary crumb.\n');
    else assert.match(line, /^quirk: it (shows|glints|shines|glitters)/);
  }
  assert.equal(lines.size, 2);
  const ineffectiveClean = { ...before, messes: 0 };
  const fed = structuredClone(ineffectiveClean); applyVisit(fed, [['feed', 1], ['clean', 1]]);
  assert.equal(reaction(feedLog, ineffectiveClean, fed), 'quirk: it saves an imaginary crumb.\n');
});

test('milestones acknowledge accepted visits even with full stats; ordinary repeats stay quiet', () => {
  const log = newLog(T);
  for (let visits = 1; visits <= 100; visits++) {
    const r = act(log, 'pet', opts(T));
    assert.equal(r.status, 200);
    assert.equal(r.text.includes('quirk:'), [1, 10, 100].includes(visits));
    log.visits.push(r.visit);
  }
  const s = replay(log, T);
  assert.equal(reaction(log, s, s), '', 'merely describing an existing milestone is silent');
});

test('recovery never invents absence or announces undrawn fourth and later veins', () => {
  for (const closeCalls of [0, 1, 2, 3, 7]) {
    const before = { ...born(T), t: T + 30 * HOUR, happy: -10, sorrowSince: T, closeCalls, visits: 4 };
    const after = structuredClone(before); applyVisit(after, FULL);
    const line = reaction(logOf(FULL), before, after);
    if (closeCalls >= 3) assert.equal(line, 'quirk: it has weathered another close call.\n');
    else assert.match(line, /vein seals/);
  }
  const log = newLog(T);
  for (let hour = 8; hour <= 88; hour += 8) log.visits.push({ t: T + hour * HOUR, acts: [['feed', 4], ['pet', 10]] });
  const before = replay(log, T + 88 * HOUR);
  assert.equal(before.happy, -10);
  assert.equal(before.lastCare, T + 88 * HOUR);
  const rescue = act(log, 'clean pet x10', opts(T + 89 * HOUR));
  assert.equal(rescue.status, 200);
  assert.match(rescue.text, /quirk: it /);
  assert.doesNotMatch(rescue.text, /missed someone/);
});

test('recovery lines vary deterministically without inventing absence', () => {
  const log = logOf(FULL), lines = new Set();
  for (let visits = 2; visits < 80; visits++) {
    if (visits === 10) continue;
    const before = { ...born(T), t: T + HOUR, happy: -10, sorrowSince: T, visits: visits - 1 };
    const after = structuredClone(before); applyVisit(after, FULL);
    lines.add(reaction(log, before, after));
    assert.equal(reaction(log, before, after), reaction(log, before, after));
  }
  assert.equal(lines.size, 3);
});

test('a persisted name at or after computed death is rejected, even without a death row', () => {
  const end = replay(newLog(T), Infinity).dead.t;
  for (const t of [Math.ceil(end), Math.ceil(end) + HOUR]) {
    const log = parseLog(birthLine(T) + nameLine({ name: 'Pebble', t }));
    for (const read of [look, act, name, history]) {
      assert.throws(() => read === act || read === name ? read(log, 'pet', opts(t)) : read(log, opts(t)), /name at or after death/);
    }
  }
  assert.equal(look(parseLog(birthLine(T) + nameLine({ name: 'Pebble', t: Math.floor(end) - 1 })), opts(end + HOUR)).status, 200);
});
