// look / act (src/rock.mjs) and the log's format (src/log.mjs), without a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { look, act, newLog } from '../src/rock.mjs';
import { parseLog, birthLine, visitLine, deathLine } from '../src/log.mjs';
import { replay } from '../src/engine.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 6, 14, 5);
const H = { host: 'h' };

test('a clock behind the birth acts at the birth', () => {
  const r = act(newLog(NOW), 'pet', { now: NOW - 5 * HOUR, ...H });
  assert.equal(r.status, 200);
  assert.equal(r.visit.t, NOW);
});

test('the first sight of a death is returned for the log, by a look or by an act', () => {
  const log = newLog(NOW - 10 * DAY);
  const fate = replay(log, Infinity).dead;
  assert.deepEqual(look(log, { now: NOW, ...H }).died, fate);
  const r = act(log, 'feed x4 clean pet x10', { now: NOW, ...H });
  assert.equal(r.status, 410);
  assert.deepEqual(r.died, fate, 'a caretaker that only ever acts still records the death');
  assert.equal(r.visit, undefined);
  const recorded = { ...log, died: fate };
  assert.equal(look(recorded, { now: NOW, ...H }).died, undefined, 'and only once');
  assert.equal(act(recorded, 'pet', { now: NOW, ...H }).died, undefined);
});

test('a recorded death must be the one the visits produce: same moment, same cause', () => {
  const log = newLog(NOW - 10 * DAY);
  const fate = replay(log, Infinity).dead;
  assert.equal(look({ ...log, died: fate }, { now: NOW, ...H }).status, 200);
  for (const died of [{ ...fate, t: fate.t + HOUR }, { ...fate, t: fate.t - 1 }, { ...fate, cause: 'hungry' }]) {
    assert.throws(() => look({ ...log, died }, { now: NOW, ...H }), /do not produce/, JSON.stringify(died));
  }
  assert.throws(() => look({ ...newLog(NOW - HOUR), died: { t: NOW - 1, cause: 'lonely' } }, { now: NOW, ...H }), /do not produce/, 'a living rock');
});

test('the clock is floored at the latest entry in the log', () => {
  const log = { ...newLog(NOW - 10 * DAY), visits: [{ t: NOW - 9 * DAY, acts: [['pet', 1]] }] };
  const r = act(log, 'pet', { now: NOW - 9 * DAY - HOUR, ...H });
  assert.equal(r.visit.t, NOW - 9 * DAY, 'behind the last visit');
  const fate = replay(log, Infinity).dead;
  const dead = act({ ...log, died: fate }, 'pet', { now: fate.t - DAY, ...H });
  assert.equal(dead.status, 410, 'behind a recorded death');
});

test('the log reads back exactly what the server writes', () => {
  const visits = [{ t: NOW + 0.5, acts: [['feed', 4], ['clean', 1], ['pet', 20]] }, { t: NOW + HOUR, acts: [['pet', 1]] }];
  const died = { t: NOW + 3 * DAY + 0.123456789, cause: 'lonely' };
  const text = birthLine(NOW) + visits.map(visitLine).join('') + deathLine(died);
  assert.deepEqual(parseLog(text), { born: NOW, rules: newLog(0).rules, visits, died });
  assert.deepEqual(parseLog(text.replaceAll('\n', '\r\n')), parseLog(text), 'CRLF');
});

test('the log refuses every shape the server never writes', () => {
  const b = birthLine(NOW);
  const visit = acts => b + JSON.stringify({ t: NOW, acts }) + '\n';
  for (const [what, text] of [
    ['a count of 0', visit([['pet', 0]])],
    ['a count of 1.5', visit([['pet', 1.5]])],
    ['a count of 21', visit([['pet', 21]])],
    ['a count as text', visit([['pet', '2']])],
    ['three parts', visit([['pet', 1, 'x']])],
    ['an unknown verb', visit([['hug', 1]])],
    ['no verbs', visit([])],
    ['no time', b + JSON.stringify({ acts: [['pet', 1]] }) + '\n'],
    ['a birth that is not a time', JSON.stringify({ born: true, rules: 1 }) + '\n'],
    ['no birth', JSON.stringify({ t: NOW, acts: [['pet', 1]] }) + '\n'],
    ['a death at no time', b + JSON.stringify({ died: 'soon', cause: 'lonely' }) + '\n'],
    ['a death of no known cause', b + JSON.stringify({ died: NOW, cause: 'bored' }) + '\n'],
    ['a line after the death', b + JSON.stringify({ died: NOW, cause: 'lonely' }) + '\n' + JSON.stringify({ died: NOW, cause: 'lonely' }) + '\n'],
    ['a line that is not JSON', b + '{"t":17913\n'],
    ['null', b + 'null\n'],
    ['nothing', ''],
  ]) assert.throws(() => parseLog(text), /line|empty/, what);
});
