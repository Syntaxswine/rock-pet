// The game's two operations for any server. Given the rock's log and the time, `look` and `act`
// return the HTTP status and the screen; `act` also returns the visit to append to the log.
// Storage, the clock and the network belong to the caller (server.mjs locally; a Worker later).

import { RULES } from './rules.mjs';
import { replay } from './engine.mjs';
import { parseActions } from './parse.mjs';
import { render } from './screen.mjs';

/** The log of a rock born at `now`. */
export const newLog = now => ({ born: now, rules: RULES.version, visits: [] });

// A log is only replayed under the rules it was written under, and a clock that has stepped
// back behind the last visit reads as that visit's time, so the log stays in order.
function moment(log, now) {
  if (log.rules !== RULES.version) throw new Error(`log written under rules v${log.rules}; this build runs v${RULES.version}`);
  return Math.max(now, log.visits.at(-1)?.t ?? log.born);
}

export function look(log, { now, host }) {
  const t = moment(log, now);
  return { status: 200, text: render(replay(log, t), { now: t, host }) };
}

export function act(log, body, { now, host }) {
  const t = moment(log, now);
  const s = replay(log, t);
  if (s.dead) return { status: 410, text: render(s, { now: t, host }) };
  const parsed = parseActions(body);
  if (parsed.error) return { status: 400, text: `error: ${parsed.error}. nothing was done.\n${render(s, { now: t, host })}` };
  const visit = { t, acts: parsed.acts };
  const after = replay({ ...log, visits: [...log.visits, visit] }, t);
  return { status: 200, text: render(after, { now: t, host }), visit };
}
