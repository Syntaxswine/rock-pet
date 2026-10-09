// The game's operations for any server. Given the rock's log and the time, `look`, `act` and
// `name` return the HTTP status and the screen, plus what to append to the log: the visit an
// action made, the name it was given, and the death the first time anyone sees the rock dead.
// Storage, the clock and the network belong to the caller (server.mjs locally; a Worker later).

import { RULES } from './rules.mjs';
import { replay } from './engine.mjs';
import { parseActions } from './parse.mjs';
import { render, renderTitle } from './screen.mjs';
import { isTime, validateOutages } from './outages.mjs';
import { biography, reaction, remark } from './story.mjs';
import { occasion, inDanger } from './character.mjs';
import { parseName, isTaken, NAMED } from './name.mjs';
import { groundAt } from './ground.mjs';
import { mealAt } from './meal.mjs';
import { whereAt, furrowShows } from './wander.mjs';
import { DRAWINGS, DRAWING } from './drawings.mjs';

/** The log of a rock born at `now`. */
export const newLog = now => ({ born: now, rules: RULES.version, visits: [], died: null });

// The moment to act at. A log is only replayed under the rules it was written under. A clock
// behind the log's latest entry reads as that entry's time, so the log stays in order, and a
// clock set back before a recorded death cannot reach a time when the rock was alive.
function moment(log, now) {
  if (log.rules !== RULES.version) throw new Error(`log written under rules v${log.rules}; this build runs v${RULES.version}`);
  return Math.max(now, log.born, log.visits.at(-1)?.t ?? -Infinity, log.died?.t ?? -Infinity, log.outages?.at(-1)?.end ?? -Infinity, log.name?.t ?? -Infinity);
}

// What a screen of rock `s` at `t` shows besides the rock itself: its name, the verified downtime
// its moss does not count, its ground (a grave's, as it was when it died), its meal, and where it
// has moved to (a grave where it died; the screen draws no furrow on a grave).
function seen(log, s, t) {
  const end = s.dead ? s.dead.t : t, place = whereAt(log, end, DRAWINGS[DRAWING]);
  return {
    name: log.name?.name ?? null, outages: log.outages ?? [], ground: groundAt(log, end), meal: mealAt(log, t),
    place: { dx: place.dx, from: place.from, furrow: furrowShows(log, place, t) },
  };
}

// The rock at t. A recorded death must be the one the visits produce.
function rockAt(log, t) {
  const s = replay(log, t);
  if (s.dead && log.name?.t >= s.dead.t) throw new Error('the log contains a name at or after death');
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
  const last = Math.max(log.born, log.visits.at(-1)?.t ?? -Infinity, log.outages?.at(-1)?.end ?? -Infinity, log.name?.t ?? -Infinity);
  if (outage.start < last) throw new Error('credit must follow the latest recorded event');
  const after = { ...log, outages: [...(log.outages ?? []), outage] };
  validateOutages(after);
  if (rockAt(log, moment(log, outage.start)).dead) throw new Error('the rock died before the outage began');
  // Validate the result before storage; never rewrite past care or a recorded grave.
  rockAt(after, moment(after, now));
  return { start: outage.start, end: outage.end, evidence: outage.evidence };
}

/**
 * The title screen (screen.mjs), shown only until someone starts the game: what the rock is, its
 * three verbs, and how to start it and care for it.
 */
export const title = ({ host }) => ({ status: 200, text: renderTitle({ host }) });

// The names rocks before it had: a list, or a function giving it, asked only when a name needs it.
const namesOf = taken => (typeof taken === 'function' ? taken() : taken);

/**
 * Start the game from the title screen with a name (name.mjs: one word, and never one a rock
 * before it had): a rock born at `now`, named then. `born` and `named` are for the caller to store
 * as the log's first two lines. A name refused leaves the title screen, with why.
 */
export function start(body, { now, host, taken = [] }) {
  const again = () => renderTitle({ host });
  const parsed = parseName(body);
  if (parsed.error) return { status: 400, text: `error: ${parsed.error}. nothing was done.\n${again()}` };
  if (isTaken(parsed.name, namesOf(taken))) return { status: 409, text: `error: a rock before it had that name, and a name is never given twice. nothing was done.\n${again()}` };
  const named = { name: parsed.name, t: now };
  const log = { ...newLog(now), name: named };
  const s = rockAt(log, now);
  return { status: 200, text: render(s, { now, host, ...seen(log, s, now) }) + `quirk: ${NAMED}\n` + `history: ${host}/history\n`, born: now, named };
}

// A look on a day that is not ordinary gets one line about it; on its day for facing the wall it
// is drawn from behind. Someone caring for it gets a reaction instead, and it turns round for them.
export function look(log, { now, host }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  const o = occasion(s, t, log.outages ?? []);
  const pose = o?.what === 'wall' ? 'away' : 'front';
  return { status: 200, text: render(s, { now: t, host, pose, ...seen(log, s, t) }) + remark(o) + `history: ${host}/history\n`, ...firstSight(log, s) };
}

export function history(log, { now }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  return { status: 200, text: biography(log, s, t), ...firstSight(log, s) };
}

export function act(log, body, { now, host }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  if (s.dead) return { status: 410, text: render(s, { now: t, host, ...seen(log, s, t) }) + `history: ${host}/history\n`, ...firstSight(log, s) };
  const parsed = parseActions(body);
  if (parsed.error) return { status: 400, text: `error: ${parsed.error}. nothing was done.\n${render(s, { now: t, host, ...seen(log, s, t) })}` };
  const visit = { t, acts: parsed.acts };
  const afterLog = { ...log, visits: [...log.visits, visit] };
  const after = replay(afterLog, t);
  return { status: 200, text: render(after, { now: t, host, ...seen(afterLog, after, t) }) + reaction(afterLog, s, after) + `history: ${host}/history\n`, visit };
}

/**
 * Give it a name (name.mjs): once, while it lives, and only a name no rock before it had.
 * `taken` is those names, from wherever the dead are kept, or a function giving them. Naming it is not care: nothing about
 * the rock changes but its name. Like every line of character, its reply is kept back while the
 * rock is at an extreme.
 */
export function name(log, body, { now, host, taken = [] }) {
  const t = moment(log, now);
  const s = rockAt(log, t);
  const screen = () => render(s, { now: t, host, ...seen(log, s, t) }) + `history: ${host}/history\n`;
  if (s.dead) return { ...firstSight(log, s), status: 410, text: screen() };
  if (log.name) return { status: 409, text: `error: it already has a name, for life. nothing was done.\n${screen()}` };
  const parsed = parseName(body);
  if (parsed.error) return { status: 400, text: `error: ${parsed.error}. nothing was done.\n${screen()}` };
  if (isTaken(parsed.name, namesOf(taken))) return { status: 409, text: `error: a rock before it had that name, and a name is never given twice. nothing was done.\n${screen()}` };
  const named = { name: parsed.name, t };
  const said = inDanger(s) ? '' : `quirk: ${NAMED}\n`;
  return { status: 200, text: render(s, { now: t, host, ...seen(log, s, t), name: named.name }) + said + `history: ${host}/history\n`, named };
}
