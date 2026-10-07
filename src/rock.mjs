// The game's two operations for any server. Given the rock's log and the time, `look` and `act`
// return the HTTP status and the screen, plus what to append to the log: the visit an action
// made, and the death the first time anyone sees the rock dead.
// Storage, the clock and the network belong to the caller (server.mjs locally; a Worker later).

import { RULES } from './rules.mjs';
import { replay } from './engine.mjs';
import { parseActions } from './parse.mjs';
import { render } from './screen.mjs';
import { isTime, validateOutages } from './outages.mjs';
import { biography, reaction, remark } from './story.mjs';
import { occasion } from './character.mjs';

/** The log of a rock born at `now`. */
export const newLog = now => ({ born: now, rules: RULES.version, visits: [], died: null });

// The moment to act at. A log is only replayed under the rules it was written under. A clock
// behind the log's latest entry reads as that entry's time, so the log stays in order, and a
// clock set back before a recorded death cannot reach a time when the rock was alive.
function moment(log, now) {
  if (log.rules !== RULES.version) throw new Error(`log written under rules v${log.rules}; this build runs v${RULES.version}`);
  return Math.max(now, log.born, log.visits.at(-1)?.t ?? -Infinity, log.died?.t ?? -Infinity, log.outages?.at(-1)?.end ?? -Infinity);
}

// The rock at t. A recorded death must be the one the visits produce.
function rockAt(log, t) {
  const s = replay(log, t);
  if (s.visits !== log.visits.length) throw new Error('the log contains visits at or after death');
  if (s.dead && log.outages?.some(o => o.start >= s.dead.t)) throw new Error('the log contains an outage at or after death');
  if (log.died && !(s.dead && s.dead.t === log.died.t && s.dead.cause === log.died.cause)) {
    throw new Error('the log records a death its visits do not produce');
  }
  return s;
}

// The death to record, the first time it is seen.
const firstSight = (log, s) => (s.dead && !log.died ? { died: s.dead } : {});

/** Administrative operation, never an action verb. Apply before reopening the visit path. */
export function creditOutage(log, outage, { now }) {
  if (!isTime(now) || !outage || !isTime(outage.end) || outage.end > now) throw new Error('only a completed outage can be credited');
  if (log.died) throw new Error('a recorded death is permanent');
  const last = Math.max(log.born, log.visits.at(-1)?.t ?? -Infinity, log.outages?.at(-1)?.end ?? -Infinity);
  if (outage.start < last) throw new Error('credit must follow the latest recorded event');
  const after = { ...log, outages: [...(log.outages ?? []), outage] };
  validateOutages(after);
  if (rockAt(log, moment(log, outage.start)).dead) throw new Error('the rock died before the outage began');
  // Validate the result before storage; never rewrite past care or a recorded grave.
  rockAt(after, moment(after, now));
  return { start: outage.start, end: outage.end, evidence: outage.evidence };
}

// A look on a day that is not ordinary gets one line about it; on its day for facing the wall it
// is drawn from behind. Someone caring for it gets a reaction instead, and it turns round for them.
export function look(log, { now, host }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  const o = occasion(s, t);
  const pose = o?.what === 'wall' ? 'away' : 'front';
  return { status: 200, text: render(s, { now: t, host, pose }) + remark(o) + `history: ${host}/history\n`, ...firstSight(log, s) };
}

export function history(log, { now }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  return { status: 200, text: biography(log, s, t), ...firstSight(log, s) };
}

export function act(log, body, { now, host }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  if (s.dead) return { status: 410, text: render(s, { now: t, host }) + `history: ${host}/history\n`, ...firstSight(log, s) };
  const parsed = parseActions(body);
  if (parsed.error) return { status: 400, text: `error: ${parsed.error}. nothing was done.\n${render(s, { now: t, host })}` };
  const visit = { t, acts: parsed.acts };
  const after = replay({ ...log, visits: [...log.visits, visit] }, t);
  return { status: 200, text: render(after, { now: t, host }) + reaction(log.born, s, after) + `history: ${host}/history\n`, visit };
}
