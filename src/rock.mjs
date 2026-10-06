// The game's two operations for any server. Given the rock's log and the time, `look` and `act`
// return the HTTP status and the screen, plus what to append to the log: the visit an action
// made, and the death the first time anyone sees the rock dead.
// Storage, the clock and the network belong to the caller (server.mjs locally; a Worker later).

import { RULES } from './rules.mjs';
import { replay } from './engine.mjs';
import { parseActions } from './parse.mjs';
import { render } from './screen.mjs';

/** The log of a rock born at `now`. */
export const newLog = now => ({ born: now, rules: RULES.version, visits: [], died: null });

// The moment to act at. A log is only replayed under the rules it was written under. A clock
// behind the log's latest entry reads as that entry's time, so the log stays in order, and a
// clock set back before a recorded death cannot reach a time when the rock was alive.
function moment(log, now) {
  if (log.rules !== RULES.version) throw new Error(`log written under rules v${log.rules}; this build runs v${RULES.version}`);
  return Math.max(now, log.born, log.visits.at(-1)?.t ?? -Infinity, log.died?.t ?? -Infinity);
}

// The rock at t. A recorded death must be the one the visits produce.
function rockAt(log, t) {
  const s = replay(log, t);
  if (log.died && !(s.dead && s.dead.t === log.died.t && s.dead.cause === log.died.cause)) {
    throw new Error('the log records a death its visits do not produce');
  }
  return s;
}

// The death to record, the first time it is seen.
const firstSight = (log, s) => (s.dead && !log.died ? { died: s.dead } : {});

export function look(log, { now, host }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  return { status: 200, text: render(s, { now: t, host }), ...firstSight(log, s) };
}

export function act(log, body, { now, host }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  if (s.dead) return { status: 410, text: render(s, { now: t, host }), ...firstSight(log, s) };
  const parsed = parseActions(body);
  if (parsed.error) return { status: 400, text: `error: ${parsed.error}. nothing was done.\n${render(s, { now: t, host })}` };
  const visit = { t, acts: parsed.acts };
  const after = replay({ ...log, visits: [...log.visits, visit] }, t);
  return { status: 200, text: render(after, { now: t, host }), visit };
}
