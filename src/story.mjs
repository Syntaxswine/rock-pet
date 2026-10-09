// Authored fragments only. Biography is derived from the shared log, with no visitor
// names, messages or identities. Personality never feeds back into the game engine.
// Every line is an observation of the rock, never words from it and never words to the visitor:
// it starts with "it", is lowercase, short and plain, and asks nothing (CHARACTER.md, "The voice";
// test/character.test.mjs holds every line to it).
import { careTotals, personality, personalitySummary, percentages } from './personality.mjs';
import { HOUR } from './engine.mjs';
import { activeElapsed } from './outages.mjs';
import { hash, nature, inDanger, iceTimes } from './character.mjs';
import { marksOf, POLISH_AT, CRYSTALS_AT } from './marks.mjs';

// The strongest part of its continuous personality blend chooses a short reaction.
// Order within each row: clean, feed, pet. All variants are benevolent.
const REACTIONS = {
  balanced: ['it settles into its clean corner.', 'it considers that a good meal.', 'it holds the warmth for a moment.'],
  feed: ['it makes itself comfortable.', 'it saves an imaginary crumb.', 'it settles closer, comfortably full.'],
  clean: ['it admires the empty floor.', 'it leaves no imaginary crumbs.', 'it accepts a very orderly pat.'],
  pet: ['it watches with fond attention.', 'it lingers happily over dinner.', 'it leans into the attention.'],
  'feed-clean': ['it settles neatly into place.', 'it enjoys a tidy little meal.', 'it seems quietly at home.'],
  'feed-pet': ['it makes room for company.', 'it imagines sharing a crumb.', 'it nestles into the company.'],
  'clean-pet': ['it seems touched by the tidying.', 'it accepts the meal gently.', 'it returns a very gentle lean.'],
};

// What a clean shows of each kind of stone: wet stone shows its colours and grain, which is why
// geologists lick rocks.
const WASHED = {
  granite: 'it shows pink feldspar and grey quartz.',
  basalt: 'it shows the gas bubbles it cooled around.',
  sandstone: 'it shows faint layers of old sand.',
  limestone: 'it shows a tiny fossil shell in its side.',
  quartzite: 'it glints like sugar where it is clean.',
  obsidian: 'it shines like dark glass, which it is.',
  schist: 'it glitters with mica, now it is clean.',
  flint: 'it shows dark flint under its chalky rind.',
};
const KIND = {
  granite: 'a granite pebble: feldspar, quartz and mica',
  basalt: 'a basalt pebble: dark lava, pocked with gas holes',
  sandstone: 'a sandstone pebble: sand grains cemented in layers',
  limestone: 'a limestone pebble: calcite, with a fossil in it',
  quartzite: 'a quartzite pebble: sandstone baked hard and glassy',
  obsidian: 'an obsidian pebble: volcanic glass',
  schist: 'a schist pebble: layered, glittering with mica',
  flint: 'a flint pebble: dark chert in a white chalky rind',
};

// A close call: a stretch at an extreme, a day or more of it, ended by care. The screen keeps
// each as a vein, the way a cracked rock heals with quartz.
const CLOSE = ['it was nearly lost. a vein seals the crack.', 'it nearly broke again. a new vein seals it.'];
// Brought back from the -10 floor, or from hunger 10, within a day.
const RECOVERED = ['it is slowly coming round.', 'it had gone very still, even for a rock.', 'it warms slowly, the way stone does.'];
const HUNGRY = ['it was very hungry. it is less so now.', 'it eats slowly, all of it.'];
const VISITS = {
  1: 'it has had its first visitor.', 10: 'it has had ten visits now.', 100: 'it has had a hundred visits now.',
  1000: 'it has had a thousand visits now.', 10000: 'it has had ten thousand visits now.',
};

// For someone who only looks, on a day that is not ordinary.
const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const BIRTHDAY = { 7: 'it is one week old today.', 30: 'it is thirty days old today.', 100: 'it is a hundred days old today.' };
const VISITORS = [
  'it is sheltering a woodlouse.', "it carries a snail's silver trail.", "it is anchoring a spider's thread.",
  'it has a beetle living under it.', 'it watches an ant carry a crumb past.', 'it has a centipede tucked under it.',
  'it has a moth asleep on it.', 'it has a ladybird resting on it.',
];

const SAILED = 'it slid on the ice this morning.';
const WALL = 'it is facing the wall today.';

/** Every fixed line, for the voice test (which also tries the birthdays of every year). */
export const LINES = [
  ...Object.values(REACTIONS).flat(), ...Object.values(WASHED), ...CLOSE, 'it has weathered another close call.', ...RECOVERED,
  ...HUNGRY, ...Object.values(VISITS), ...Object.values(BIRTHDAY), SAILED, WALL, ...VISITORS,
];

/** One authored line, with danger taking precedence over every occasion or preference. */
export function reaction(log, before, after) {
  if (after.dead || inDanger(after)) return '';
  const did = { pet: after.happy > before.happy, clean: after.messes < before.messes, feed: after.hunger < before.hunger };
  const birth = log.born;
  const pick = lines => lines[hash(birth, 8, after.visits) % lines.length];
  let line;
  if (after.closeCalls > before.closeCalls) line = after.closeCalls > 3 ? 'it has weathered another close call.' : CLOSE[after.closeCalls > 1 ? 1 : 0];
  else if (after.visits > before.visits && VISITS[after.visits]) line = VISITS[after.visits];
  else if (!did.pet && !did.clean && !did.feed) return '';
  else if (before.sorrowSince !== null) line = pick(RECOVERED);
  else if (before.starvingSince !== null) line = pick(HUNGRY);
  else {
    const profile = personality(careTotals(log));
    // Among effective verbs, prefer the largest daily-weighted share; ties prefer pet, clean, feed.
    const care = ['pet', 'clean', 'feed'].filter(verb => did[verb])
      .sort((a, b) => profile.shares[b] - profile.shares[a])[0];
    // Any effective clean can reveal its stone, whatever personality it has developed.
    line = did.clean && hash(birth, 9, after.visits) % 4 === 0 ? WASHED[nature(birth).kind] :
      REACTIONS[profile.dominant?.id ?? 'balanced'][['clean', 'feed', 'pet'].indexOf(care)];
  }
  return `quirk: ${line}\n`;
}

/** The line for an occasion (character.mjs), or nothing. */
export function remark(o) {
  if (!o) return '';
  let line;
  if (o.what === 'birthday') {
    line = o.years ? `it is ${WORDS[o.years] ?? o.years} year${o.years > 1 ? 's' : ''} old today.` : BIRTHDAY[o.days];
  } else if (o.what === 'sailed') line = SAILED;
  else if (o.what === 'wall') line = WALL;
  else line = VISITORS[o.which % VISITORS.length];
  return `quirk: ${line}\n`;
}

const date = t => new Date(t).toISOString().slice(0, 10);
const iso = t => new Date(t).toISOString();
const duration = ms => `${Math.floor(ms / HOUR)}h ${Math.floor(ms / 60000) % 60}m`;
const WEEKDAYS = ['sundays', 'mondays', 'tuesdays', 'wednesdays', 'thursdays', 'fridays', 'saturdays'];

export function biography(log, s, now) {
  const profile = personality(careTotals(log));
  const balance = percentages(profile.shares);
  const end = s.dead?.t ?? now;
  let firstMeal = null, previous = log.born, longest = 0;
  if (log.checkpoint) ({ firstMeal, previous, longest } = log.checkpoint.biography);
  for (const v of log.visits) {
    longest = Math.max(longest, activeElapsed(log, previous, v.t));
    previous = v.t;
    if (firstMeal === null && v.acts.some(([verb]) => verb === 'feed')) firstMeal = v.t;
  }
  longest = Math.max(longest, activeElapsed(log, previous, end));
  const credited = (log.outages ?? []).reduce((sum, o) => sum + o.end - o.start, 0);
  const n = nature(log.born);
  // Its slides up to now; a grave's, those before it died. One due at the very moment it died
  // never came: it was dead by then (wander.mjs).
  const slides = iceTimes(log.born, now, log.outages ?? []).filter(t => !s.dead || t < s.dead.t).length;
  const m = marksOf(s);
  const lines = [
    'one rock, one shared life',
    `name: ${log.name ? `${log.name.name} (since ${date(log.name.t)})` : 'none yet'}`,
    `born: ${date(log.born)}`,
    `age: ${Math.floor((end - log.born) / (24 * HOUR))}d`,
    `visits: ${s.visits}`,
    `care totals: feed ${profile.totals.feed}  clean ${profile.totals.clean}  pet ${profile.totals.pet}`,
    ...(profile.formed ? [`care balance: feed ${balance.feed}%  clean ${balance.clean}%  pet ${balance.pet}% (weighted)`] : []),
    personalitySummary(profile),
    `first meal: ${firstMeal === null ? 'not yet' : date(firstMeal)}`,
    `longest quiet stretch: ${duration(longest)} (host downtime excluded)`,
    `host downtime credited: ${duration(credited)}`,
    `kind: ${KIND[n.kind]}`,
    `habit: it faces the wall on ${WEEKDAYS[n.wallDay]} (utc)`,
    `close calls: ${s.closeCalls} (up to three veins shown)`,
    `petting received: ${Math.floor(s.petted)} points of happiness (polished at ${POLISH_AT.join(' and ')})`,
    `meals: ${Math.floor(m.meals)} (crystals at ${CRYSTALS_AT.join(' and ')})`,
    `slid on the ice: ${slides === 1 ? 'once' : `${slides} times`}`,
  ];
  if (s.dead) lines.push(`died: ${date(s.dead.t)} (${s.dead.cause})`);
  for (const o of log.outages ?? []) {
    lines.push(`outage: ${iso(o.start)} to ${iso(o.end)}; credit ${o.end - o.start}ms; evidence ${o.evidence}`);
  }
  return lines.join('\n') + '\n';
}
