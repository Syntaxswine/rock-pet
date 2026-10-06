// Rock Pet engine. The rock's state at any moment is derived by replaying its event log from
// birth in continuous time, closed-form between events: nothing depends on a timer having run,
// and death is the FIRST moment a death condition held, whenever anyone happens to look.
// Pure: no clock, no I/O, no platform APIs, so it runs unchanged in Node or in a Worker.

import { RULES as R } from './rules.mjs';

export const HOUR = 3_600_000; // ms
const MESS_MS = R.messEveryH * HOUR;
const GRACE_MS = R.graceH * HOUR;
const PAIN_MAX = 10 - R.painFrom; // hunger points of pain at hunger 10

/** The most happiness can be with `messes` visible. */
export const ceilingOf = messes => Math.max(-10, 10 - R.messCeil * messes);

/** The first mess time strictly after t. Epoch multiples of 12h are 00:00 and 12:00 UTC. */
export const nextMessAfter = t => (Math.floor(t / MESS_MS) + 1) * MESS_MS;

/**
 * Happiness drained over `tau` hours from hunger h0 with `messes` visible, ignoring the -10
 * floor. Hunger climbs linearly to 10 and stops there, so the pain term is zero, then grows
 * linearly (a quadratic drain), then holds.
 */
export function drain(h0, messes, tau) {
  const r = R.hungerPerHour;
  const k = R.decay + R.messPain * messes;
  const tPain = Math.max(0, (R.painFrom - h0) / r); // hunger passes painFrom
  const tFull = Math.max(0, (10 - h0) / r);         // hunger reaches 10
  const e0 = Math.max(0, h0 - R.painFrom);          // pain points at tPain
  let pain = 0; // point-hours of hunger above painFrom
  if (tau > tPain) {
    const u = Math.min(tau, tFull) - tPain;
    pain = e0 * u + (r * u * u) / 2;
    if (tau > tFull) pain += PAIN_MAX * (tau - tFull);
  }
  return k * tau + R.painPerPoint * pain;
}

/** Hours until `loss` happiness has drained: the inverse of drain, for loss >= 0. */
export function hoursToLose(h0, messes, loss) {
  const r = R.hungerPerHour, c = R.painPerPoint;
  const k = R.decay + R.messPain * messes;
  const tPain = Math.max(0, (R.painFrom - h0) / r);
  const tFull = Math.max(0, (10 - h0) / r);
  const e0 = Math.max(0, h0 - R.painFrom);
  if (k * tPain >= loss) return loss / k; // before any hunger pain
  const atFull = drain(h0, messes, tFull);
  if (atFull >= loss) {
    // While the pain grows: a u^2 + b u = rest, with u the hours since tPain.
    const a = (c * r) / 2, b = k + c * e0, rest = loss - k * tPain;
    return tPain + (2 * rest) / (b + Math.sqrt(b * b + 4 * a * rest));
  }
  return tFull + (loss - atFull) / (k + c * PAIN_MAX); // at hunger 10
}

/** A newborn rock: fed, happy, clean. */
export function born(t) {
  return {
    born: t, t, hunger: 0, happy: 10, messes: 0,
    starvingSince: null, // when hunger reached 10, while it stays there
    sorrowSince: null,   // when happiness reached -10, while it stays there
    dead: null,          // { t, cause: 'hungry' | 'filthy' | 'lonely' }
    lastCare: null, visits: 0,
  };
}

/** One visit's verbs, in the order given. No verb, count or order can make any stat worse. */
export function applyVisit(s, acts) {
  for (const [verb, n] of acts) {
    if (verb === 'feed') s.hunger = Math.max(0, s.hunger - R.feed * n);
    else if (verb === 'clean') s.messes = 0;
    else if (verb === 'pet') s.happy = Math.min(ceilingOf(s.messes), s.happy + R.pet * n);
    else throw new Error(`unknown verb: ${verb}`);
  }
  // An extreme's clock resets when the stat LEAVES the extreme, not merely because someone came.
  if (s.hunger < 10) s.starvingSince = null;
  if (s.happy > -10) s.sorrowSince = null;
  s.lastCare = s.t;
  s.visits++;
}

// Continuous change from s.t to te, with no event in between. An extreme's clock starts the
// moment its stat reaches the extreme; the stretch stops early at the moment of death.
function flow(s, te) {
  const tau = (te - s.t) / HOUR;
  if (s.starvingSince === null && s.hunger + R.hungerPerHour * tau >= 10)
    s.starvingSince = s.t + ((10 - s.hunger) / R.hungerPerHour) * HOUR;
  if (s.sorrowSince === null && drain(s.hunger, s.messes, tau) >= s.happy + 10)
    s.sorrowSince = s.t + hoursToLose(s.hunger, s.messes, s.happy + 10) * HOUR;
  const starve = s.starvingSince === null ? Infinity : s.starvingSince + GRACE_MS;
  const sorrow = s.sorrowSince === null ? Infinity : s.sorrowSince + GRACE_MS;
  const end = Math.min(te, starve, sorrow);
  const dt = (end - s.t) / HOUR;
  s.happy = Math.max(-10, s.happy - drain(s.hunger, s.messes, dt)); // drain reads the starting hunger
  s.hunger = Math.min(10, s.hunger + R.hungerPerHour * dt);
  s.t = end;
  // At `end`, a stat sits at its extreme exactly while its clock runs. A clock due to start
  // after `end` (death came first) has not started; a float hair at the extreme starts it now.
  if (s.starvingSince !== null && s.starvingSince > end) s.starvingSince = null;
  if (s.sorrowSince !== null && s.sorrowSince > end) s.sorrowSince = null;
  if (s.starvingSince !== null) s.hunger = 10;
  else if (s.hunger >= 10) s.starvingSince = end;
  if (s.sorrowSince !== null) s.happy = -10;
  else if (s.happy <= -10) s.sorrowSince = end;
  // A deadline that falls exactly on the next event still comes first: a visit at the 48th
  // hour is too late. A tie between the two clocks dies hungry.
  if (end === starve) s.dead = { t: end, cause: 'hungry' };
  else if (end === sorrow) s.dead = { t: end, cause: ceilingOf(s.messes) <= -10 ? 'filthy' : 'lonely' };
}

// A mess appears: one more mess and a lower ceiling. If the ceiling pins happiness to -10, the
// sorrow clock starts now.
function addMess(s) {
  s.messes++;
  s.happy = Math.min(s.happy, ceilingOf(s.messes));
  if (s.happy <= -10 && s.sorrowSince === null) s.sorrowSince = s.t;
}

// Everything from s.t up to and including time T: the flow, and each mess as it falls due.
function advance(s, T) {
  while (!s.dead && s.t < T) {
    const mess = nextMessAfter(s.t);
    if (mess > T) { flow(s, T); break; }
    flow(s, mess);
    if (!s.dead) addMess(s);
  }
}

/**
 * The rock at `now`, from its log: { born, visits: [{ t, acts: [[verb, count], ...] }, ...] },
 * visits in time order. A mess due at the same moment as a visit comes first. Visits after
 * `now` are not counted yet. A visit at or after the moment of death is ignored: the rock was
 * already dead, and nothing revives it. Pass now = Infinity for the rock's fate if nobody else
 * ever comes.
 */
export function replay(log, now) {
  const s = born(log.born);
  let last = log.born;
  for (const v of log.visits) {
    if (!(v.t >= last)) throw new Error(`visits out of time order at ${v.t}`);
    last = v.t;
    if (v.t > now) break;
    advance(s, v.t);
    if (s.dead) break;
    applyVisit(s, v.acts);
  }
  if (!s.dead) advance(s, now);
  return s;
}
