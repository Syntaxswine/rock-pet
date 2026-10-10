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
  let phase = initialPhase, remoteText = 'ASCII rock', failing = false, deferNext = false, release;
  let interval;
  runInNewContext(SCRIPT, { document, AbortSignal, setInterval(fn, ms) { interval = { fn, ms }; }, fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (url === '/name') phase = 'alive';
    const text = remoteText, nextPhase = phase, failed = failing;
    if (deferNext) { deferNext = false; await new Promise(resolve => { release = resolve; }); }
    return { ok: !failed, status: failed ? 503 : 200, text: async () => text, headers: { get: () => nextPhase } };
  } });
  return { calls, document, elements,
    tick() { assert.equal(interval.ms, 15000); return interval.fn(); },
    remote(text, failed = false) { remoteText = text; failing = failed; },
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
