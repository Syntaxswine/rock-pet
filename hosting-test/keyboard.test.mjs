import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { SCRIPT, PAGE } from '../hosting/page.mjs';

const settle = () => new Promise(resolve => setImmediate(resolve));
function browser(initialPhase = 'alive') {
  const calls = [], elements = {};
  const document = { activeElement: null, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; },
    querySelector(id) { return elements[id] ??= { value: '', handlers: {}, disabled: false,
      addEventListener(type, fn) { this.handlers[type] = fn; },
      focus() { document.activeElement = this; }, blur() { if (document.activeElement === this) document.activeElement = null; } }; } };
  let phase = initialPhase, remoteText = 'ASCII rock', remoteScene, failing = false, deferNext = false, release;
  let clock = 0, reduced = false, timerId = 0;
  const timers = new Map();
  let interval;
  runInNewContext(SCRIPT, { document, AbortSignal, performance: { now: () => clock },
    matchMedia: () => ({ matches: reduced }),
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, at: clock + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) { interval = { fn, ms }; }, fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (url === '/name') phase = 'alive';
    const text = remoteText, scene = url === '/history' ? undefined : remoteScene, nextPhase = phase, failed = failing;
    if (deferNext) { deferNext = false; await new Promise(resolve => { release = resolve; }); }
    return { ok: !failed, status: failed ? 503 : 200, text: async () => text, json: async () => ({ text, scene }),
      headers: { get: key => key === 'x-rock-phase' ? nextPhase : 'application/json' } };
  } });
  return { calls, document, elements,
    tick() { assert.equal(interval.ms, 15000); return interval.fn(); },
    remote(text, failed = false) { remoteText = text; failing = failed; },
    scene(frames) { remoteScene = { at: 100000, frames: frames.map(([offset, text]) => ({ at: 100000 + offset, text })) }; },
    timeline(scene) { remoteScene = scene; },
    reduced() { reduced = true; },
    advance(ms) { clock += ms; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); } },
    timers,
    hold() { deferNext = true; }, release() { release(); },
    key(key, extra = {}) { document.handlers.keydown({ key, preventDefault() {}, ...extra }); },
    submit(value) { elements['#command'].value = value; elements['#terminal'].handlers.submit({ preventDefault() {} }); },
  };
}

test('keyboard: F C P each submit one text action; holding a key or a modifier does not automate care', async () => {
  const ui = browser(); await settle();
  for (const [key, action] of [['F', 'feed'], ['c', 'clean'], ['P', 'pet']]) {
    ui.key(key); await settle();
    assert.equal(ui.calls.at(-1).url, '/act');
    assert.equal(ui.calls.at(-1).body, action);
  }
  const count = ui.calls.length;
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) ui.key('f', extra);
  await settle(); assert.equal(ui.calls.length, count);
  assert.doesNotMatch(PAGE, /<button\b/i);
});

test('animation: timed ASCII frames move without extra requests or disturbing a typed command', async () => {
  const ui = browser(); await settle();
  ui.key('Enter'); ui.elements['#command'].value = 'pet x';
  ui.scene([[0, 'start'], [500, 'one space'], [1000, 'two spaces']]);
  await ui.tick(); const calls = ui.calls.length;
  assert.equal(ui.elements['#rock'].textContent, 'start');
  ui.advance(500); assert.equal(ui.elements['#rock'].textContent, 'one space');
  ui.advance(500); assert.equal(ui.elements['#rock'].textContent, 'two spaces');
  assert.equal(ui.calls.length, calls);
  assert.equal(ui.document.activeElement, ui.elements['#command']);
  assert.equal(ui.elements['#command'].value, 'pet x');
  assert.equal(ui.calls.at(-1).headers.Accept, 'application/json');
});

test('animation: commands, hidden tabs and newer snapshots cancel the old frames; reduced motion stays still', async () => {
  const ui = browser(); await settle();
  ui.scene([[0, 'old start'], [500, 'obsolete']]); await ui.tick();
  ui.hold(); ui.key('p'); ui.advance(500);
  assert.equal(ui.elements['#rock'].textContent, 'old start', 'a pending command cancels old frames immediately');
  ui.release(); await settle();
  ui.scene([[0, 'old start'], [500, 'obsolete']]); await ui.tick();
  ui.remote('history'); ui.submit('history'); await settle();
  ui.advance(500); assert.equal(ui.elements['#rock'].textContent, 'history');
  ui.submit('look'); await settle();
  ui.remote('current'); ui.scene([[0, 'current']]); await ui.tick();
  ui.advance(1000); assert.equal(ui.elements['#rock'].textContent, 'current');
  ui.scene([[0, 'start'], [500, 'hidden frame']]); await ui.tick();
  ui.document.hidden = true; ui.document.handlers.visibilitychange();
  assert.equal(ui.timers.size, 0); ui.advance(500);
  assert.equal(ui.elements['#rock'].textContent, 'start');
  ui.document.hidden = false; ui.reduced(); ui.remote('destination'); await ui.tick();
  assert.equal(ui.elements['#rock'].textContent, 'destination'); assert.equal(ui.timers.size, 0);
});

test('animation: an unseen remote move catches up once, but a predicted move or first visit never replays', async () => {
  const ui = browser(); await settle();
  const prior = { at: 100000, moveAt: null, frames: [{ at: 100000, text: 'before' }] };
  const next = { at: 115000, moveAt: 110000, frames: [{ at: 115000, text: 'settled' }],
    recent: { at: 110000, frames: [{ at: 115000, text: 'from' }, { at: 115500, text: 'middle' }, { at: 116000, text: 'settled' }] } };
  ui.timeline(prior); await ui.tick();
  ui.timeline(next); await ui.tick();
  assert.equal(ui.elements['#rock'].textContent, 'from');
  ui.advance(500); assert.equal(ui.elements['#rock'].textContent, 'middle');
  ui.advance(500); assert.equal(ui.elements['#rock'].textContent, 'settled');
  await ui.tick(); assert.equal(ui.elements['#rock'].textContent, 'settled');
  const predicted = browser(); await settle();
  predicted.timeline({ ...prior, moveAt: 110000 }); await predicted.tick();
  predicted.timeline(next); await predicted.tick();
  assert.equal(predicted.elements['#rock'].textContent, 'settled');
  const first = browser(); await settle(); first.timeline(next); await first.tick();
  assert.equal(first.elements['#rock'].textContent, 'settled');
});

test('keyboard: typing names and commands never triggers care hotkeys; Escape restores them', async () => {
  const ui = browser('title'); await settle();
  ui.key('f'); ui.key('c'); ui.key('p'); await settle();
  assert.equal(ui.calls.length, 1);
  ui.submit('name Flint'); await settle();
  assert.equal(ui.calls.at(-1).url, '/name'); assert.equal(ui.calls.at(-1).body, 'Flint');
  assert.equal(ui.document.activeElement, null);
  ui.key('Enter'); assert.equal(ui.document.activeElement, ui.elements['#command']);
  const count = ui.calls.length;
  ui.key('f'); ui.key('c'); ui.key('p'); await settle();
  assert.equal(ui.calls.length, count);
  ui.submit('feed x4 clean pet x10'); await settle();
  assert.equal(ui.calls.at(-1).body, 'feed x4 clean pet x10');
  ui.key('Enter'); ui.key('Escape'); ui.key('f'); await settle();
  assert.equal(ui.calls.at(-1).body, 'feed');
  ui.submit('help'); assert.match(ui.elements['#status'].textContent, /combine care/);
  ui.submit('history'); await settle(); assert.equal(ui.calls.at(-1).url, '/history');
});

test('keyboard: grave keys do nothing and rapid keys do not queue hidden care', async () => {
  const dead = browser('dead'); await settle();
  dead.key('f'); dead.key('c'); dead.key('p'); await settle(); assert.equal(dead.calls.length, 1);
  const ui = browser(); await settle();
  ui.key('f'); ui.key('c'); ui.key('p'); await settle(); assert.equal(ui.calls.length, 2);
});

test('refresh: shows other visitors care with GET only, preserving command text, focus and status', async () => {
  const ui = browser(); await settle();
  ui.key('Enter'); ui.elements['#command'].value = 'feed x4 clean';
  ui.elements['#status'].textContent = 'help is still visible';
  ui.remote('cleaned and cared for by someone else');
  await ui.tick();
  assert.equal(ui.elements['#rock'].textContent, 'cleaned and cared for by someone else');
  assert.equal(ui.calls.at(-1).url, '/'); assert.equal(ui.calls.at(-1).method, 'GET');
  assert.equal(ui.calls.at(-1).body, undefined);
  assert.equal(ui.elements['#command'].value, 'feed x4 clean');
  assert.equal(ui.document.activeElement, ui.elements['#command']);
  assert.equal(ui.elements['#command'].disabled, false);
  assert.equal(ui.elements['#status'].textContent, 'help is still visible');
});

test('refresh: hidden tabs pause, returning resumes, history stays open and failed reads retry', async () => {
  const ui = browser(); await settle();
  const count = ui.calls.length;
  ui.document.hidden = true; await ui.tick(); assert.equal(ui.calls.length, count);
  ui.remote('new screen'); ui.document.hidden = false;
  ui.document.handlers.visibilitychange(); await settle();
  assert.equal(ui.elements['#rock'].textContent, 'new screen');
  ui.submit('history'); await settle();
  ui.remote('new biography'); await ui.tick();
  assert.equal(ui.calls.at(-1).url, '/history');
  assert.equal(ui.elements['#rock'].textContent, 'new biography');
  ui.remote('database unavailable', true); await ui.tick();
  assert.equal(ui.elements['#rock'].textContent, 'new biography');
  ui.remote('recovered biography'); await ui.tick();
  assert.equal(ui.elements['#rock'].textContent, 'recovered biography');
});

test('refresh: one background request at a time and stale reads cannot overwrite a newer care reply', async () => {
  const ui = browser(); await settle();
  ui.remote('old snapshot'); ui.hold(); const pending = ui.tick();
  const count = ui.calls.length;
  await ui.tick(); assert.equal(ui.calls.length, count);
  ui.remote('fresh care reply'); ui.key('p'); await settle();
  assert.equal(ui.calls.at(-1).body, 'pet', 'background reads do not block manual care');
  assert.equal(ui.elements['#rock'].textContent, 'fresh care reply');
  ui.release(); await pending;
  assert.equal(ui.elements['#rock'].textContent, 'fresh care reply');
  ui.hold(); ui.key('c'); const duringCare = ui.calls.length;
  await ui.tick(); assert.equal(ui.calls.length, duringCare, 'no polling during a foreground command');
  ui.release(); await settle();
  ui.remote('later screen'); await ui.tick();
  assert.equal(ui.elements['#rock'].textContent, 'later screen');
});
