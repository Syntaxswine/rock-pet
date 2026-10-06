// Reads an action body such as "feed x4 clean pet x10": the verbs feed, clean and pet, each
// optionally followed by a count ("x3" or "3"), applied in the order given. Anything that is
// not a letter or digit separates words, so "feed, pet*3" and "feed+pet+x3" read the same.

import { RULES } from './rules.mjs';

export const VERBS = ['feed', 'clean', 'pet'];
const MAX_WORDS = 40;
const COUNT = /^x?([0-9]+)$/;

/** { acts: [[verb, count], ...] } or { error: one line, safe to show the sender } */
export function parseActions(body) {
  let text = String(body ?? '').trim();
  // Bodies agents send besides plain words. A JSON object or a form is read for its values, and
  // a key that is itself a verb is kept: {"body":"feed pet x3"}, do=feed+pet+x3 and
  // feed=1&pet=3 all read as words. A percent-encoded body without a key (curl
  // --data-urlencode) is decoded byte by byte.
  const fields = entries => entries.map(([k, v]) => (VERBS.includes(String(k).toLowerCase()) ? `${k} ${v}` : String(v))).join(' ');
  let json;
  try { json = /^[{"]/.test(text) ? JSON.parse(text) : undefined; } catch { /* not JSON after all: words */ }
  if (typeof json === 'string') text = json;
  else if (json !== null && typeof json === 'object' && !Array.isArray(json)) text = fields(Object.entries(json));
  else if (/^[A-Za-z_]+=/.test(text)) text = fields([...new URLSearchParams(text)]);
  else text = text.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return { error: 'nothing to do: send verbs, e.g. feed clean pet x3' };
  if (words.length > MAX_WORDS) return { error: `too many words (at most ${MAX_WORDS})` };
  const acts = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // Words are letters and digits only by now, so echoing one back is safe; clip it anyway.
    if (COUNT.test(w)) return { error: `"${w.slice(0, 12)}" must follow a verb, e.g. pet x3` };
    if (!VERBS.includes(w)) return { error: `unknown word "${w.slice(0, 12)}"; the verbs are feed, clean, pet` };
    let n = 1;
    const m = COUNT.exec(words[i + 1] ?? '');
    if (m) {
      n = Number(m[1]);
      i++;
      if (n < 1) return { error: `"${w} x0": a count is at least 1` };
    }
    acts.push([w, Math.min(n, RULES.maxCount)]);
  }
  return { acts };
}
