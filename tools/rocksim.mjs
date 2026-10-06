// Rock Pet care simulator — an instrument, not a gate (always exits 0).
// Steps one rock in 2-minute ticks under a rule set and a list of visit times,
// and reports survival and mood over many simulated lives.
//
//   node rocksim.mjs gaps              longest absence in 30 days, per schedule family
//   node rocksim.mjs sweep             INSTANT-death reset model: survival vs lethal absence
//   node rocksim.mjs all [ruleset]     every schedule family under one rule set
//   node rocksim.mjs caps              the pet-cap options side by side
//   node rocksim.mjs readings          three readings of "48 hours at the extreme"
//   node rocksim.mjs lifesupport       one visit every N hours, for a year
//   node rocksim.mjs absence           hours from full care to death, with nobody visiting
//   node rocksim.mjs community         caretakers who drift away (and optional newcomers)
//   node rocksim.mjs solo              one caretaker: a year at 1-3/day, and trips, under each cap
//   node rocksim.mjs grace             hours to death with nobody coming, under each cap
//   node rocksim.mjs lazybot           a caretaker that pets (and maybe cleans) but never feeds
//   node rocksim.mjs ceiling           how much each visible mess should lower the happiness ceiling
//
// Env: GRACE       hours at an extreme before death (default 48; 0 = instant death)
//      GRACE_MODE  continuous | lifetime | rolling7 (default continuous)
//      CAP         pets that land per window (0 = no cap; default = the rule set's: none)
//      WINDOW      the cap's sliding window in hours (default = the rule set's, else 1)
//      CEIL        happiness ceiling lost per visible mess (default = the rule set's, 3; 0 = none)
// The comparison modes (caps, solo, readings, grace, ceiling) build on the `rock` rules with CEIL applied.
//
// Importable: test/sim.test.mjs checks the game's engine (src/engine.mjs) against this model.
// The CLI runs only when the file is executed.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DT = 2 / 60; // hours per tick
const DAY = 24;
const ENV_GRACE = Number(process.env.GRACE ?? 48);
const ENV_MODE = process.env.GRACE_MODE ?? 'continuous';
const ENV_CAP = process.env.CAP === undefined ? undefined : Number(process.env.CAP);
const ENV_WINDOW = process.env.WINDOW === undefined ? undefined : Number(process.env.WINDOW);
const ENV_CEIL = process.env.CEIL === undefined ? undefined : Number(process.env.CEIL);

// ---- rule sets -------------------------------------------------------------
// hungerPain(h): happiness lost per hour because of hunger.
// mess: 'clock' = one mess every `every` h on a fixed world clock (phase 0 = birth);
//       'afterClean' = first mess `first` h after the last clean, then every `every` h.
// petCap: only `count` pets inside any sliding `windowH`-hour window land (global, all visitors).
// messCeil: each visible mess lowers the most happiness can be by this much (10 - messCeil x messes).
// cleanAll: one clean removes every mess (one action); otherwise one action per mess.
const RULESETS = {
  // The owner's decisions of 2026-10-06: no pet cap, messes cap happiness, clean removes all,
  // pain while hunger is 7-9 (pain above 6), 48h in a row at an extreme is death.
  rock: {
    note: 'owner rules: decay 0.4/h, 12h world-clock mess 0.3/h each + ceiling, hunger pain above 6, pet +2, no cap',
    hungerPerHour: 10 / 24, feed: 3,
    hungerPain: h => 0.4 * Math.max(0, h - 6),
    decay: 0.4, mess: { kind: 'clock', every: 12 }, messPain: 0.3, pet: 2,
    petCap: null, messCeil: 3, cleanAll: true,
  },
  // The first review's pick (2026-10-06, superseded): 5 pets per sliding 6h, no mess ceiling.
  v1: {
    note: 'superseded pick: 5 pets per 6h, no mess ceiling, one clean per mess',
    hungerPerHour: 10 / 24, feed: 3,
    hungerPain: h => 0.4 * Math.max(0, h - 6),
    decay: 0.4, mess: { kind: 'clock', every: 12 }, messPain: 0.3, pet: 2,
    petCap: { count: 5, windowH: 6 },
  },
  // Base shape for the instant-death sweep: three clocks that stack inside one absence.
  stacked: {
    note: 'sweep base: decay + mess 6h after clean + hunger pain above 3; no cap',
    hungerPerHour: 10 / 24, feed: 3,
    hungerPain: h => 0.6 * Math.max(0, h - 3),
    decay: 0.9, mess: { kind: 'afterClean', first: 6, every: 12 }, messPain: 1.2, pet: 2,
  },
};

function withCap(R, cap, windowH) {
  if (cap === undefined && windowH === undefined) return R;
  const count = cap ?? R.petCap?.count ?? 0;
  return { ...R, petCap: count > 0 ? { count, windowH: windowH ?? R.petCap?.windowH ?? 1 } : null };
}
const capLabel = R => (R.petCap ? `${R.petCap.count} per ${R.petCap.windowH}h` : 'none');
// The cap options compared side by side: [label, pets that land, window hours].
const CAPS = [['no cap', 0, 1], ['5 per 6h', 5, 6], ['5 per 1h', 5, 1], ['4 per 1h', 4, 1], ['3 per 1h', 3, 1]];
const withCeil = (R, c) => (c === undefined ? R : { ...R, messCeil: c });
const BASE = withCeil(RULESETS.rock, ENV_CEIL);
const capped = ([, c, w]) => withCap(BASE, c, w);
const graceOf = R => R.grace ?? ENV_GRACE;
const modeOf = R => R.graceMode ?? ENV_MODE;

// ---- rng ---------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the rock ----------------------------------------------------------------
const ROLL_TICKS = Math.round(7 * DAY / DT);
function extremeClock() { return { since: null, total: 0, ring: new Uint8Array(ROLL_TICKS), roll: 0 }; }

function newRock(t0 = 0) {
  return {
    t: t0, n: 0, h: 0, j: 10, messes: 0, lastClean: t0, nextMess: null, pets: [],
    hungerX: extremeClock(), sorrowX: extremeClock(),
    dead: null, actions: 0, visits: 0, tAtFloor: 0, tSad: 0, loss: 0, lived: 0,
  };
}

function scheduleMess(R, rock) {
  if (R.mess.kind === 'afterClean') rock.nextMess = rock.lastClean + R.mess.first;
  else rock.nextMess = (Math.floor(rock.t / R.mess.every) + 1) * R.mess.every;
}

// Advances one extreme-clock; returns hours that count toward death under the reading.
function stepExtreme(X, atExtreme, t, n, mode) {
  const i = n % ROLL_TICKS;
  X.roll -= X.ring[i];
  X.ring[i] = atExtreme ? 1 : 0;
  X.roll += X.ring[i];
  if (atExtreme) { X.total += DT; X.since ??= t; } else X.since = null; // resets only when the stat LEAVES the extreme
  if (mode === 'lifetime') return X.total;
  if (mode === 'rolling7') return X.roll * DT;
  return X.since === null ? 0 : t - X.since;
}

function tick(R, rock) {
  rock.t += DT; rock.n++;
  rock.h = Math.min(10, rock.h + R.hungerPerHour * DT);
  if (rock.nextMess === null) scheduleMess(R, rock);
  while (rock.t >= rock.nextMess) { rock.messes++; rock.nextMess += R.mess.every; }
  const drain = (R.decay + R.hungerPain(rock.h) + R.messPain * rock.messes) * DT;
  rock.loss += drain;
  rock.j = Math.max(-10, Math.min(ceilingOf(R, rock), rock.j - drain));
  const G = graceOf(R), mode = modeOf(R);
  const hx = stepExtreme(rock.hungerX, rock.h >= 10, rock.t, rock.n, mode);
  const sx = stepExtreme(rock.sorrowX, rock.j <= -10, rock.t, rock.n, mode);
  if (rock.h >= 10 || rock.j <= -10) rock.tAtFloor += DT;
  if (rock.j < 0) rock.tSad += DT;
  rock.lived += DT;
  // The epitaph: hungry (hunger's 48h), filthy (sorrow's 48h with the mess ceiling at the floor),
  // lonely (sorrow's 48h for any other reason).
  if (G === 0 ? rock.h >= 10 : hx >= G) rock.dead = { t: rock.t, cause: 'hungry' };
  else if (G === 0 ? rock.j <= -10 : sx >= G) rock.dead = { t: rock.t, cause: ceilingOf(R, rock) <= -10 ? 'filthy' : 'lonely' };
}

// The most happiness can be right now: each visible mess lowers it by messCeil.
function ceilingOf(R, rock) { return Math.max(-10, 10 - (R.messCeil ?? 0) * rock.messes); }

// A modelled visit does everything it can: feed to empty, clean every mess, then pet until
// happiness reaches its ceiling or the cap stops landing pets. `does` can drop verbs.
function visit(R, rock, does = { feed: true, clean: true, pet: true }) {
  if (rock.dead) return;
  rock.visits++;
  if (does.feed) while (rock.h > 0) { rock.h = Math.max(0, rock.h - R.feed); rock.actions++; }
  if (does.clean && rock.messes > 0) {
    rock.actions += R.cleanAll ? 1 : rock.messes; rock.messes = 0;
  }
  if (does.clean) {
    rock.lastClean = rock.t;
    if (R.mess.kind === 'afterClean') scheduleMess(R, rock);
  }
  if (!does.pet) return;
  const top = ceilingOf(R, rock);
  if (!R.petCap) { while (rock.j < top) { rock.j = Math.min(top, rock.j + R.pet); rock.actions++; } return; }
  rock.pets = rock.pets.filter(p => p > rock.t - R.petCap.windowH);
  while (rock.j < top && rock.pets.length < R.petCap.count) {
    rock.j = Math.min(top, rock.j + R.pet); rock.pets.push(rock.t); rock.actions++;
  }
}

function live(R, visits, horizonH) {
  const rock = newRock();
  let vi = 0;
  while (rock.t < horizonH && !rock.dead) {
    while (vi < visits.length && visits[vi] <= rock.t) { visit(R, rock); vi++; }
    tick(R, rock);
  }
  return rock;
}

// Hours from TRUE full care (hunger 0, happiness +10, no mess) at world-clock `phase`
// to death, with nobody coming. Also when each stat first hit its extreme.
function absence(R, phase = 0) {
  const rock = newRock(phase);
  rock.pets = [];
  let hFloor = null, jFloor = null;
  while (!rock.dead && rock.t < phase + 14 * DAY) {
    tick(R, rock);
    if (hFloor === null && rock.h >= 10) hFloor = rock.t - phase;
    if (jFloor === null && rock.j <= -10) jFloor = rock.t - phase;
  }
  return { gap: rock.dead ? rock.dead.t - phase : Infinity, cause: rock.dead?.cause, hFloor, jFloor };
}

// ---- schedule families -------------------------------------------------------
// Visit times in hours from birth; birth is 00:00 local.
const fam = {
  even: (n, jitter) => (r, days) => {
    const out = [];
    for (let d = 0; d < days; d++) for (let i = 0; i < n; i++)
      out.push(d * DAY + (i + 0.5) * (DAY / n) + (r() * 2 - 1) * jitter);
    return out.sort((a, b) => a - b);
  },
  // Habitual: n anchor times spread over 07:30-22:30, each visit jittered +/-jit h and
  // skipped with probability `skip`. Skips are independent, so this family can never
  // produce a multi-day absence; `trip` adds one.
  habit: (n, jit = 1.5, skip = 0.05, trip = null) => (r, days) => {
    const out = [];
    const anchors = n === 1 ? [12] : Array.from({ length: n }, (_, i) => 7.5 + i * (15 / (n - 1)));
    for (let d = 0; d < days; d++) for (const a of anchors) {
      if (trip && d >= trip.from && d < trip.from + trip.days) continue;
      if (r() < skip) continue;
      out.push(d * DAY + a + (r() * 2 - 1) * jit);
    }
    return out.sort((a, b) => a - b);
  },
  waking: n => (r, days) => {
    const out = [];
    for (let d = 0; d < days; d++) for (let i = 0; i < n; i++) out.push(d * DAY + 7 + r() * 16);
    return out.sort((a, b) => a - b);
  },
  bookend: n => (r, days) => {
    const out = [];
    for (let d = 0; d < days; d++) {
      out.push(d * DAY + 7 + r());
      if (n >= 2) out.push(d * DAY + 22 + r());
      for (let i = 2; i < n; i++) out.push(d * DAY + 8 + r() * 14);
    }
    return out.sort((a, b) => a - b);
  },
  workday: n => (r, days) => {
    const out = [];
    for (let d = 0; d < days; d++) for (let i = 0; i < n; i++) out.push(d * DAY + 9 + r() * 8);
    return out.sort((a, b) => a - b);
  },
  // Once a day, but split into two calls gapH apart (probes whether the cap window can be gamed).
  split: (gapH = 1.08) => (r, days) => fam.habit(1)(r, days).flatMap(t => [t, t + gapH]),
  every: hours => (r, days) => {
    const out = [];
    for (let t = hours; t < days * DAY; t += hours) out.push(t);
    return out;
  },
};

const SCHEDULES = [
  ['1/day habit', fam.habit(1)],
  ['1/day as two calls 65 min apart', fam.split(1.08)],
  ['2/day habit (07:30, 22:30)', fam.habit(2)],
  ['3/day habit (07:30, 15:00, 22:30)', fam.habit(3)],
  ['4/day habit', fam.habit(4)],
  ['3/day sloppy (+/-3h, 10% skipped)', fam.habit(3, 3, 0.10)],
  ['4/day sloppy (+/-3h, 10% skipped)', fam.habit(4, 3, 0.10)],
  ['2/day cron (every 12h +/-1h)', fam.even(2, 1)],
  ['3/day cron (every 8h +/-1h)', fam.even(3, 1)],
  ['2/day bookend (07-08, 22-23)', fam.bookend(2)],
  ['3/day bookend', fam.bookend(3)],
  ['4/day bookend', fam.bookend(4)],
  ['4/day workday only (09-17)', fam.workday(4)],
  ['4/day random waking hours', fam.waking(4)],
  ['3/day habit + one 3-day trip', fam.habit(3, 1.5, 0.05, { from: 10, days: 3 })],
];

function survey(R, gen, { runs = 400, days = 30, seed = 1 } = {}) {
  let alive = 0, actions = 0, visits = 0, floor = 0, sad = 0, lived = 0, loss = 0;
  const deaths = [], causes = { hungry: 0, lonely: 0, filthy: 0 };
  for (let i = 0; i < runs; i++) {
    const rock = live(R, gen(rng(seed * 7919 + i), days), days * DAY);
    if (!rock.dead) alive++; else { deaths.push(rock.dead.t / DAY); causes[rock.dead.cause]++; }
    actions += rock.actions; visits += rock.visits; floor += rock.tAtFloor; sad += rock.tSad; lived += rock.lived; loss += rock.loss;
  }
  deaths.sort((a, b) => a - b);
  return {
    alive: alive / runs, medianDeath: deaths.length ? deaths[deaths.length >> 1] : null,
    actionsPerVisit: visits ? actions / visits : 0, floorFrac: floor / lived, sadFrac: sad / lived,
    drainPerDay: loss / (lived / DAY), causes,
  };
}

const pct = x => (100 * x).toFixed(0).padStart(4) + '%';
const day = d => (d === null ? '    -' : d.toFixed(1).padStart(5) + 'd');
const row = s => `${pct(s.alive)}   ${pct(s.sadFrac)}   ${pct(s.floorFrac)}   ${day(s.medianDeath)}  ${s.actionsPerVisit.toFixed(1).padStart(5)}`;
const header = '  schedule (30 days, 400 lives)          alive  time-sad  at-floor  med-death  acts/visit';

function maxGapStat(gen, days = 30, runs = 400) {
  const m = [];
  for (let i = 0; i < runs; i++) {
    const v = [0, ...gen(rng(7919 + i), days), days * DAY];
    let g = 0; for (let k = 1; k < v.length; k++) g = Math.max(g, v[k] - v[k - 1]);
    m.push(g);
  }
  m.sort((a, b) => a - b);
  return { p10: m[Math.floor(runs * 0.1)], med: m[runs >> 1], p90: m[Math.floor(runs * 0.9)] };
}

// ---- CLI ---------------------------------------------------------------------
export { DT, RULESETS, newRock, tick, visit, live, absence, ceilingOf, graceOf, survey, fam, rng };
const isMain = import.meta.main ?? (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url));
const mode = isMain ? process.argv[2] || 'all' : null; // imported: no mode runs
const pick = process.argv[3];
const RULE = withCeil(withCap(RULESETS[pick] ?? RULESETS.rock, ENV_CAP, ENV_WINDOW), ENV_CEIL);

if (mode === 'gaps') {
  console.log('longest absence in 30 days of visits (10th pct / median / 90th pct), hours:');
  for (const [label, gen] of SCHEDULES) {
    const g = maxGapStat(gen);
    console.log(`  ${label.padEnd(38)} ${g.p10.toFixed(1).padStart(5)} ${g.med.toFixed(1).padStart(5)} ${g.p90.toFixed(1).padStart(5)}`);
  }
}

if (mode === 'sweep') {
  // Instant death (grace 0) and full-reset visits: scale every penalty so the lethal
  // absence hits each target, then ask which schedules survive 30 days.
  const base = { ...RULESETS.stacked, grace: 0 };
  const scaled = k => ({ ...base, decay: base.decay * k, messPain: base.messPain * k, hungerPain: h => k * RULESETS.stacked.hungerPain(h) });
  const targets = [10, 12, 14, 16, 18, 20, 22];
  const fits = targets.map(L => {
    let lo = 0.01, hi = 5;
    for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; (absence(scaled(mid)).gap > L ? (lo = mid) : (hi = mid)); }
    const k = (lo + hi) / 2, got = absence(scaled(k)).gap;
    return { L, k, ok: Math.abs(got - L) < 0.1, got };
  });
  console.log('INSTANT-death reset model ("stacked" shape, grace 0): penalties scaled to each lethal absence L; % alive after 30 days');
  console.log('  ' + 'schedule'.padEnd(38) + fits.map(f => `L=${f.L}h`.padStart(7)).join(''));
  console.log('  ' + '(scale factor; * = did not converge)'.padEnd(38) + fits.map(f => (f.k.toFixed(2) + (f.ok ? '' : '*')).padStart(7)).join(''));
  for (const [label, gen] of SCHEDULES) {
    const cells = fits.map(f => (f.ok ? pct(survey(scaled(f.k), gen, { runs: 300 }).alive) : '  n/a').padStart(7));
    console.log('  ' + label.padEnd(38) + cells.join(''));
  }
}

if (mode === 'all') {
  console.log(`=== ${pick ?? 'rock'}: ${RULE.note}  [grace ${graceOf(RULE)}h ${modeOf(RULE)}, cap ${capLabel(RULE)}]`);
  console.log(header);
  const tally = { hungry: 0, lonely: 0, filthy: 0 };
  for (const [label, gen] of SCHEDULES) { const sv = survey(RULE, gen); for (const k in tally) tally[k] += sv.causes[k]; console.log(`  ${label.padEnd(38)} ${row(sv)}`); }
  console.log(`  epitaphs across all rows: lonely ${tally.lonely}, filthy ${tally.filthy}, hungry ${tally.hungry}`);
}

if (mode === 'absence') {
  const R = RULE;
  console.log(`hours from full care to death with nobody visiting [grace ${graceOf(R)}h ${modeOf(R)}], by where full care falls on the 12h mess clock:`);
  for (const ph of [0, 3, 6, 9, 11.9]) {
    const a = absence(R, 24 + ph);
    console.log(`  care at mess-clock +${ph.toFixed(1)}h: dies at ${a.gap.toFixed(1)}h (${a.cause}); sorrow floor at ${a.jFloor?.toFixed(1)}h, hunger max at ${a.hFloor?.toFixed(1)}h`);
  }
}

if (mode === 'caps') {
  const sched = SCHEDULES.filter(([l]) => /^(1\/day habit|1\/day as two|2\/day habit|2\/day cron|3\/day habit \(|4\/day habit|3\/day sloppy)/.test(l));
  console.log(`time sad (happiness < 0) over 30 days under each pet cap [grace ${ENV_GRACE}h ${ENV_MODE}]; alive% in brackets when below 100%`);
  console.log('  ' + 'schedule'.padEnd(38) + CAPS.map(c => c[0].padStart(12)).join(''));
  for (const [label, gen] of sched) {
    const cells = CAPS.map(c => { const s = survey(capped(c), gen); return (pct(s.sadFrac) + (s.alive < 1 ? ` [${(100 * s.alive).toFixed(0)}]` : '')).padStart(12); });
    console.log('  ' + label.padEnd(38) + cells.join(''));
  }
  const d2 = survey(withCap(BASE, 0), fam.habit(2)).drainPerDay;
  console.log(`  measured happiness drain, 2/day habit, no cap: ${d2.toFixed(1)}/day. Visits/day to break even ~ drain / (pets per visit x pet size): ` +
    [5, 4, 3].map(c => `${c} pets: ${(d2 / (c * BASE.pet)).toFixed(2)}`).join(', '));
}

if (mode === 'readings') {
  const sched = SCHEDULES.filter(([l]) => /^(1\/day habit|2\/day habit|3\/day habit \(|4\/day habit|3\/day sloppy|3\/day habit \+)/.test(l));
  for (const cap of CAPS.filter(c => ['no cap', '5 per 6h', '3 per 1h'].includes(c[0]))) {
    console.log(`three readings of "48h at the extreme", cap ${cap[0]}: % alive after 30 days (median death day)`);
    const modes = ['continuous', 'rolling7', 'lifetime'];
    console.log('  ' + 'schedule'.padEnd(38) + modes.map(m => m.padStart(16)).join(''));
    for (const [label, gen] of sched) {
      const cells = modes.map(m => { const s = survey({ ...capped(cap), graceMode: m }, gen); return `${pct(s.alive)}${s.medianDeath === null ? '' : ' (' + s.medianDeath.toFixed(1) + 'd)'}`.padStart(16); });
      console.log('  ' + label.padEnd(38) + cells.join(''));
    }
  }
}

if (mode === 'community') {
  // k founding caretakers plus newcomers arriving at `arrive` per day; each visits `per`
  // times a day at random waking hours in their own timezone, skips whole days with
  // probability `skip`, and quits after an exponential tenure (mean `tenure` days).
  const R = RULE, days = 365, runs = 300;
  console.log(`community lifespan, 1 year, ${runs} lives [grace ${graceOf(R)}h ${modeOf(R)}, cap ${capLabel(R)}]`);
  console.log('  founders  per-day  skip  tenure  arrive/day   alive@1y  med-death  deaths-before-last-quit');
  for (const [k, per, skip, tenure, arrive] of [
    [3, 2, 0.10, 60, 0], [10, 2, 0.20, 30, 0], [30, 1, 0.30, 30, 0], [100, 1, 0.50, 20, 0],
    [10, 2, 0.20, 30, 0.2], [10, 2, 0.20, 30, 0.5], [30, 1, 0.30, 30, 1],
  ]) {
    let alive = 0, early = 0; const deaths = [];
    for (let i = 0; i < runs; i++) {
      const r = rng(31 * 7919 + i), v = []; let lastQuit = 0;
      const people = Array.from({ length: k }, () => 0);
      for (let d = 1; d < days; d++) { let x = r(); let p = Math.exp(-arrive), c = 0, cum = p; while (x > cum) { c++; p *= arrive / c; cum += p; } for (let j = 0; j < c; j++) people.push(d + r()); }
      for (const join of people) {
        const tz = r() * 24 - 12, quit = join + -Math.log(1 - r()) * tenure;
        lastQuit = Math.max(lastQuit, Math.min(quit, days));
        for (let d = Math.floor(join); d < days && d < quit; d++) {
          if (d < join || r() < skip) continue;
          for (let q = 0; q < per; q++) { const t = d * DAY + 7 + r() * 16 + tz; if (t > 0) v.push(t); }
        }
      }
      v.sort((a, b) => a - b);
      const rock = live(R, v, days * DAY);
      if (!rock.dead) alive++; else { deaths.push(rock.dead.t / DAY); if (rock.dead.t / DAY < lastQuit) early++; }
    }
    deaths.sort((a, b) => a - b);
    console.log(`  ${String(k).padStart(8)}  ${String(per).padStart(7)}  ${skip.toFixed(2)}  ${String(tenure).padStart(5)}d  ${String(arrive).padStart(10)}   ${pct(alive / runs)}    ${day(deaths.length ? deaths[deaths.length >> 1] : null)}   ${deaths.length ? pct(early / deaths.length) : '    -'}`);
  }
}

if (mode === 'solo') {
  const rowsY = [['1/day, never misses, 1 year', fam.habit(1, 1.5, 0), 365], ['1/day, 2% missed, 1 year', fam.habit(1, 1.5, 0.02), 365],
    ['1/day habit (5% missed), 1 year', fam.habit(1), 365], ['2/day habit, 1 year', fam.habit(2), 365], ['3/day habit, 1 year', fam.habit(3), 365],
    ['2/day habit + 2-day trip (30d)', fam.habit(2, 1.5, 0.05, { from: 10, days: 2 }), 30],
    ['3/day habit + 2-day trip (30d)', fam.habit(3, 1.5, 0.05, { from: 10, days: 2 }), 30],
    ['3/day habit + 3-day trip (30d)', fam.habit(3, 1.5, 0.05, { from: 10, days: 3 }), 30]];
  console.log(`one caretaker, % alive at the end [grace ${ENV_GRACE}h ${ENV_MODE}]`);
  console.log('  ' + 'schedule'.padEnd(38) + CAPS.map(c => c[0].padStart(10)).join(''));
  for (const [label, gen, days] of rowsY) {
    const cells = CAPS.map(c => pct(survey(capped(c), gen, { runs: days > 100 ? 200 : 400, days }).alive).padStart(10));
    console.log('  ' + label.padEnd(38) + cells.join(''));
  }
}

if (mode === 'grace') {
  console.log(`hours to death with nobody coming [grace ${ENV_GRACE}h ${ENV_MODE}], over 5 points on the mess clock`);
  for (const c of CAPS) {
    const R = capped(c);
    const full = [0, 3, 6, 9, 11.9].map(p => absence(R, 24 + p).gap);
    // a rock at the floor (hunger 10, happiness -10, two messes) gets one full visit, then nobody
    const after = [0, 3, 6, 9, 11.9].map(p => {
      const rock = newRock(24 + p); rock.h = 10; rock.j = -10; rock.messes = 2; rock.nextMess = null;
      visit(R, rock); const t0 = rock.t;
      while (!rock.dead && rock.t < t0 + 14 * DAY) tick(R, rock);
      return rock.dead.t - t0;
    });
    const span = a => `${Math.min(...a).toFixed(1)}-${Math.max(...a).toFixed(1)}h`;
    console.log(`  ${c[0].padEnd(9)} from full care: ${span(full)}   after one visit to a rock at the floor: ${span(after)}`);
  }
}

if (mode === 'ceiling') {
  // No pet cap; each visible mess lowers the most happiness can be by c.
  const cs = [0, 1, 2, 3, 4, 5];
  const sched = SCHEDULES.filter(([l]) => ['1/day habit', '2/day habit', '2/day cron', '3/day habit (', '4/day habit', '3/day sloppy'].some(p => l.startsWith(p)));
  console.log(`time sad (happiness < 0) over 30 days, no pet cap, by how much each visible mess lowers the ceiling [grace ${ENV_GRACE}h ${ENV_MODE}]`);
  console.log('  ' + 'schedule'.padEnd(38) + cs.map(c => `-${c}/mess`.padStart(9)).join(''));
  for (const [label, gen] of sched) {
    const cells = cs.map(c => { const sv = survey(withCap(withCeil(RULESETS.rock, c), 0), gen); return (pct(sv.sadFrac) + (sv.alive < 1 ? `[${(100 * sv.alive).toFixed(0)}]` : '')).padStart(9); });
    console.log('  ' + label.padEnd(38) + cells.join(''));
  }
  const yr = cs.map(c => pct(survey(withCap(withCeil(RULESETS.rock, c), 0), fam.habit(1), { runs: 200, days: 365 }).alive).padStart(9));
  console.log('  ' + '1/day habit, alive after 1 year'.padEnd(38) + yr.join(''));
  const gap = cs.map(c => { const R = withCap(withCeil(RULESETS.rock, c), 0); const g = [0, 3, 6, 9, 11.9].map(p => absence(R, 24 + p).gap); return `${Math.min(...g).toFixed(0)}-${Math.max(...g).toFixed(0)}h`.padStart(9); });
  console.log('  ' + 'hours to death from full care'.padEnd(38) + gap.join(''));
  const lazy = cs.map(c => { const R = withCap(withCeil(RULESETS.rock, c), 0); const rock = newRock();
    for (let next = 8; !rock.dead && rock.t < 30 * DAY; ) { if (rock.t >= next) { visit(R, rock, { feed: true, clean: false, pet: true }); next += 8; } tick(R, rock); }
    return (rock.dead ? `${(rock.dead.t / DAY).toFixed(1)}d ${rock.dead.cause[0]}` : 'lives').padStart(9); });
  console.log('  ' + 'feeds + pets every 8h, never cleans'.padEnd(38) + lazy.join(''));
}

if (mode === 'lazybot') {
  // One full visit at t=0 (the rock starts at full care), then a bot that never feeds.
  const R = RULE;
  console.log(`a bot that never feeds, after one full-care start [grace ${graceOf(R)}h ${modeOf(R)}, cap ${capLabel(R)}]`);
  for (const clean of [false, true]) for (const every of [6, 8, 12]) {
    const rock = newRock();
    for (let next = every; !rock.dead && rock.t < 30 * DAY; ) {
      if (rock.t >= next) { visit(R, rock, { feed: false, clean, pet: true }); next += every; }
      tick(R, rock);
    }
    console.log(`  pets${clean ? ' + cleans' : ''} every ${String(every).padStart(2)}h: ${rock.dead ? `dies at ${rock.dead.t.toFixed(1)}h (${rock.dead.cause})` : 'alive at 30 days'}`);
  }
}

if (mode === 'lifesupport') {
  console.log(`one visit every N hours for a year [grace ${ENV_GRACE}h ${ENV_MODE}, cap ${capLabel(RULE)}]`);
  for (const N of [36, 48, 55, 57, 58, 60, 62, 63, 64, 66, 68, 69, 70, 72]) {
    const s = survey(RULE, fam.every(N), { runs: 1, days: 365 });
    console.log(`  every ${String(N).padStart(2)}h: ${s.alive ? 'alive at 1 year' : 'dead on day ' + s.medianDeath.toFixed(1)}   sad ${pct(s.sadFrac)}  at floor ${pct(s.floorFrac)}`);
  }
}
