import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayPlace, frameAt, sceneAt } from '../hosting/scene.mjs';
import { newLog, look } from '../src/rock.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { compact } from '../src/checkpoint.mjs';
import { render } from '../src/screen.mjs';
import { whereAt } from '../src/wander.mjs';
import { DRAWINGS } from '../src/drawings.mjs';

const T = Date.UTC(2026, 9, 11), D = DRAWINGS.pip;
const grid = text => text.split('\n').slice(0, 12);
const base = text => grid(text).findIndex(row => row.includes("'----'"));

test('sliding: a journey moves the whole ASCII pet one column per half second, then stops at its original destination', () => {
  const log = newLog(T), at = 1791691620000;
  const xs = [], before = JSON.stringify(log);
  for (const ms of [0, 499, 500, 1000, 1500, 2000, 10000]) {
    const p = displayPlace(log, at + ms), rows = grid(frameAt(log, at + ms));
    xs.push(p.dx);
    assert.equal(rows[3].indexOf('.----.'), 3 + p.dx);
    assert.equal(rows[4].indexOf('('), 3 + p.dx);
    assert.equal(rows[5].indexOf("'----'"), 3 + p.dx);
    assert.ok(rows.every(row => row.length <= 12));
  }
  assert.deepEqual(xs, [2, 2, 1, 0, -1, -2, -2]);
  assert.equal(JSON.stringify(log), before, 'drawing never appends a visit');
  assert.equal(displayPlace(log, at + 10000).dx, whereAt(log, at + 10000, D).dx);
});

test('sliding: upcoming frames include a short journey between polls, with shared timestamps and bounded payload', () => {
  const log = newLog(T), at = 1791686820000, now = at - 5000;
  const scene = sceneAt(log, now);
  assert.equal(scene.at, now);
  assert.equal(scene.frames[0].text, frameAt(log, now));
  assert.ok(scene.frames.some(f => f.at === at + 500 && grid(f.text)[3].indexOf('.') === 4));
  assert.ok(scene.frames.some(f => f.at === at + 1000 && grid(f.text)[3].indexOf('.') === 5));
  assert.ok(scene.frames.every((f, i) => f.at <= now + 16000 && (!i || f.at > scene.frames[i - 1].at)));
  assert.ok(JSON.stringify(scene).length < 8000);
  assert.deepEqual(sceneAt(log, now), scene, 'two visitors receive the same timeline');
});

test('sliding: a just-finished journey supplies catch-up frames without replaying historical state', () => {
  const log = newLog(T), at = 1791691620000, now = at + 10000;
  const scene = sceneAt(log, now);
  assert.equal(scene.moveAt, at); assert.equal(scene.recent.at, at);
  assert.deepEqual(scene.recent.frames.map(f => grid(f.text)[3].indexOf('.')), [5, 4, 3, 2, 1]);
  assert.deepEqual(scene.recent.frames.map(f => f.at), [now, now + 500, now + 1000, now + 1500, now + 2000]);
  assert.equal(sceneAt(log, at + 15000).recent, undefined, 'old journeys do not get replayed');
});

test('animation: each frame keeps its needs consistent and preserves a care reaction without hiding death', () => {
  const log = newLog(T), now = T + 4320000 - 1000;
  const reply = look(log, { now, host: '' }).text;
  for (const frame of sceneAt(log, now, reply).frames) {
    const hunger = frame.text.split('\n')[0].trim().split(/\s+/)[0];
    assert.ok(frame.text.includes(`hunger ${hunger}/10`), frame.text);
  }
  const caring = sceneAt(log, now, reply.replace(/^quirk:.*\n/gm, '') + 'quirk: thank you.\n', true);
  assert.ok(caring.frames.every(frame => frame.text.includes('quirk: thank you.')));
  const death = replay(log, Infinity).dead.t;
  const dying = sceneAt(log, death - 1000, look(log, { now: death - 1000, host: '' }).text, true);
  const grave = dying.frames.find(frame => frame.text.startsWith('died:'));
  assert.ok(grave && grave.text.includes('it does not stir'));
  assert.ok(!grave.text.includes('hunger '));
});

const shuffles = [
  [1791680400000, 1791687060000, -1, 0],
  [1791684000000, 1791696660000, 1, 0],
  [1791727200000, 1791730320000, 0, 1],
  [1791752400000, 1791772680000, 0, -1],
];
test('shuffle: each cardinal direction moves the complete pet one cell and returns it to its established spot', () => {
  for (const [born, at, dx, dy] of shuffles) {
    const log = newLog(born), regular = whereAt(log, at, D).dx;
    assert.equal(displayPlace(log, at).dx, regular);
    const p = displayPlace(log, at + 1000), text = frameAt(log, at + 1000), rows = grid(text);
    assert.deepEqual([p.dx - regular, p.dy], [dx, dy]);
    assert.equal(base(text), 5 + dy);
    assert.equal(rows[3 + dy].indexOf('.----.'), 3 + regular + dx);
    assert.equal(rows[4 + dy].indexOf('('), 3 + regular + dx);
    assert.equal(rows[5 + dy].indexOf("'----'"), 3 + regular + dx);
    assert.equal(rows[0], grid(look(log, { now: at + 1000, host: '' }).text)[0], 'needs stay fixed');
    const end = displayPlace(log, at + 2500);
    assert.deepEqual([end.dx, end.dy], [regular, 0]);
  }
});

test('shuffle: eating, danger, death and a verified outage never acquire an idle shuffle', () => {
  const [born, at] = shuffles[2];
  const eating = { ...newLog(born), visits: [{ t: at - 1000, acts: [['feed', 1]] }] };
  assert.equal(displayPlace(eating, at + 1000).dy, 0);
  const down = { ...newLog(born), outages: [{ start: at, end: at + 10000, evidence: 'test' }] };
  assert.equal(displayPlace(down, at + 1000).dy, 0);
  const log = newLog(born);
  for (const now of [born + 30 * HOUR, born + 100 * HOUR]) {
    const s = replay(log, now), p = displayPlace(log, now);
    assert.equal(p.dy, 0); assert.equal(p.dx, whereAt(log, s.dead?.t ?? now, D).dx);
  }
});

test('vertical frames keep marks, ground and messes intact; unsafe shifts stay on the ground', () => {
  const s = replay(newLog(T), T), options = { now: T, host: '', name: 'Pebble', place: { dx: 0, from: null, furrow: false, dy: 1 } };
  const plain = grid(render(s, { ...options, place: { ...options.place, dy: 0 } }));
  const down = grid(render(s, options));
  for (let r = 1; r < 11; r++) assert.equal(down[r + 1], plain[r]);
  const mossy = { ...s, born: T - 50 * 24 * HOUR, lastCare: T - 48 * HOUR };
  assert.ok(grid(render(mossy, { ...options, place: { ...options.place, dy: -1 } })).every(r => r.length <= 12));
  const messy = { ...s, messes: 6 };
  const crowded = grid(render(messy, { ...options, place: { dx: 3, from: null, furrow: false, dy: 1 } }));
  assert.equal(crowded.join('').split('@').length - 1, 6);
  assert.equal(crowded[5].indexOf("'----'"), 6, 'a mess in the destination prevents the shift');
});

test('sliding: checkpointed and full lives produce identical frames', () => {
  const log = newLog(T);
  for (let i = 1; i <= 8; i++) log.visits.push({ t: T + i * 6 * HOUR, acts: [['feed', 4], ['clean', 1], ['pet', 10]] });
  const saved = compact(log), now = log.visits.at(-1).t;
  for (const offset of [0, 500, 1000, HOUR, 4 * HOUR]) assert.deepEqual(sceneAt(saved, now + offset), sceneAt(log, now + offset));
});
