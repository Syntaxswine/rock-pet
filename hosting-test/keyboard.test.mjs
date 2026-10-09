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
  let phase = initialPhase;
  runInNewContext(SCRIPT, { document, fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (url === '/name') phase = 'alive';
    return { ok: true, status: 200, text: async () => 'ASCII rock', headers: { get: () => phase } };
  } });
  return { calls, document, elements,
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
