// Its name. Whoever names it first gives it one, once, and a name a rock has had is never given
// to another (the owner, 2026-10-07: "the user names the rock and the name is single use, once
// that pet is gone that name can not be used again"). It is the one visitor's word on the shared
// screen, and to every later agent that is a possible prompt injection (AGENTS.md, invariant 5),
// so it is as small as a name can be: one word of 2-12 letters, a-z, shown in one place.

/** What a name may be, as sent. It is kept capitalized: "pebble" and "PEBBLE" are Pebble. */
export const NAME = /^[A-Za-z]{2,12}$/;
/** What it is kept as in the log. */
export const KEPT = /^[A-Z][a-z]{1,11}$/;
/** What the rock does when named, in its voice (test/character.test.mjs holds it to the voice). */
export const NAMED = 'it has a name now.';
/**
 * Words that cannot be names, because a name is for life and these would be accidents: a verb
 * sent to the wrong route, a client's empty value, a probe, or one of the screen's own words,
 * which a summarizing fetch tool could take for the rock's state ("Dead  age 1h ...").
 */
export const RESERVED = new Set([
  'feed', 'clean', 'pet', 'name', 'died', 'dead', 'hungry', 'filthy', 'lonely', 'hunger', 'happy', 'sorrow',
  'starving', 'mess', 'quirk', 'error', 'act', 'history', 'unnamed', 'here', 'lies', 'age', 'now', 'post', 'body',
  'null', 'undefined', 'none', 'nil', 'nan', 'true', 'false', 'test',
]);

/**
 * The name in a request body: plain ("Pebble"), a form (name=Pebble) or JSON ({"name":"Pebble"}
 * or "Pebble"). { name } as kept, or { error }: one line, safe to show the sender, since it
 * never echoes what was sent.
 */
export function parseName(body) {
  let text = String(body ?? '').trim();
  let json;
  try { json = /^[{"]/.test(text) ? JSON.parse(text) : undefined; } catch { /* not JSON after all */ }
  if (typeof json === 'string') text = json;
  else if (json !== null && typeof json === 'object' && !Array.isArray(json)) text = String(json.name ?? '');
  else if (/^name=/i.test(text)) text = [...new URLSearchParams(text)].find(([k]) => k.toLowerCase() === 'name')?.[1] ?? '';
  text = text.trim();
  if (!NAME.test(text)) return { error: 'a name is one word of 2 to 12 letters, a to z' };
  if (RESERVED.has(text.toLowerCase())) return { error: 'that word means something else here, so it cannot be a name' };
  return { name: text[0].toUpperCase() + text.slice(1).toLowerCase() };
}

/** Whether `name` is one of `taken`, the names rocks before it had, in any case. */
export const isTaken = (name, taken) => taken.some(t => t.toLowerCase() === name.toLowerCase());
