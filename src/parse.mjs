// Reads an action body such as "feed x4 clean pet x10": the verbs feed, clean and pet, each
// optionally followed by a count ("x3" or "3"), applied in the order given. Anything that is
// not a letter or digit separates words, so "feed, pet*3" and "feed+pet+x3" read the same.

import { RULES } from './rules.mjs';

export const VERBS = ['feed', 'clean', 'pet'];
const MAX_WORDS = 40;
const COUNT = /^x?([0-9]+)$/;

/** { acts: [[verb, count], ...] } or { error: one line, safe to show the sender } */
export function parseActions(body) {
  let text = String(body ?? '');
  // A form post ("do=feed+pet+x3") is read for its values; a percent-encoded body without a
  // key (curl --data-urlencode) is decoded byte by byte.
  if (/^[A-Za-z_]+=/.test(text.trim())) text = [...new URLSearchParams(text.trim()).values()].join(' ');
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
