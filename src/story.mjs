// Authored fragments only. Biography is derived from the shared log, with no visitor
// names, messages or identities. Personality never feeds back into the game engine.
// Every line is an observation of the rock, never words from it and never words to the visitor:
// it starts with "it", is lowercase, short and plain, and asks nothing (CHARACTER.md, "The voice";
// test/character.test.mjs holds every line to it).
import { HOUR } from './engine.mjs';
import { activeElapsed } from './outages.mjs';
import { hash, nature, inDanger, placeAt } from './character.mjs';

// Care, by voice. The first line of each is the reaction that voice had before (a6ef9c8).
const CARE = {
  curious: {
    pet: ['it leans into the attention.', 'it tilts toward the hand.', 'it would like the other side done too.'],
    clean: ['it admires the empty floor.', 'it inspects where the mess was.', 'it seems to count the clean spots.'],
    feed: ['it saves an imaginary crumb.', 'it eats, then looks around for more.', 'it hides a little for later.'],
  },
  stoic: {
    pet: ['it seems a little less stone-faced.', 'it allows this.', 'it does not purr. it is a rock.'],
    clean: ['it settles into its clean corner.', 'it permits the tidying.', 'it was going to do that itself.'],
    feed: ['it looks comfortably heavier.', 'it accepts the meal without comment.', 'it is, briefly, satisfied.'],
  },
  warm: {
    pet: ['it holds the warmth for a moment.', 'it is a little smoother for it.', 'it settles, content.'],
    clean: ['it looks pleased with the tidying.', 'it rests easier in the clean.', 'it seems lighter for it.'],
    feed: ['it considers that a good meal.', 'it is quietly grateful.', 'it warms a little, from the inside.'],
  },
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
  flint: 'it shows dark glass under its white rind.',
};
const KIND = {
  granite: 'a granite pebble: feldspar, quartz and mica',
  basalt: 'a basalt pebble: dark lava, pocked with gas holes',
  sandstone: 'a sandstone pebble: sand grains cemented in layers',
  limestone: 'a limestone pebble: calcite, with a fossil in it',
  quartzite: 'a quartzite pebble: sandstone baked hard and glassy',
  obsidian: 'an obsidian pebble: volcanic glass',
  schist: 'a schist pebble: layered, glittering with mica',
  flint: 'a flint pebble: dark glassy chert in a white rind',
};

// Brought back after a day or more at an extreme: the screen keeps each as a vein, the way a
// cracked rock heals with quartz.
const CLOSE = ['it was nearly lost. a vein seals the crack.', 'it nearly broke again. a new vein seals it.'];
// Brought back from the -10 floor, or from hunger 10, within a day.
const MISSED = ['it seems to have missed someone.', 'it had gone very still, even for a rock.', 'it warms slowly, the way stone does.'];
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
  'it has a beetle living under it.', 'it watches an ant carry a crumb past.', 'it has a feather resting against it.',
  'it has a moth asleep on it.', 'it is beaded with dew.',
];

const SAILED = 'it moved this morning. no one saw it go.';
const WALL = 'it is facing the wall today.';

/** Every fixed line, for the voice test (which also tries the birthdays of every year). */
export const LINES = [
  ...Object.values(CARE).flatMap(v => Object.values(v).flat()), ...Object.values(WASHED), ...CLOSE, ...MISSED,
  ...HUNGRY, ...Object.values(VISITS), ...Object.values(BIRTHDAY), SAILED, WALL, ...VISITORS,
];

/**
 * One line after care that changed something, when it is no longer at an extreme; otherwise
 * nothing. In order: a close call, a round number of visits, being brought back, then the care
 * itself (what it likes first). Which of a few lines is stable for a given visit.
 */
export function reaction(birth, before, after) {
  if (after.dead || inDanger(after)) return '';
  const did = { pet: after.happy > before.happy, clean: after.messes < before.messes, feed: after.hunger < before.hunger };
  if (!did.pet && !did.clean && !did.feed) return '';
  const n = nature(birth);
  const pick = lines => lines[hash(birth, 8, after.visits) % lines.length];
  let line;
  if (after.closeCalls > before.closeCalls) line = CLOSE[after.closeCalls > 1 ? 1 : 0];
  else if (VISITS[after.visits]) line = VISITS[after.visits];
  else if (before.sorrowSince !== null) line = pick(MISSED);
  else if (before.starvingSince !== null) line = pick(HUNGRY);
  else {
    const care = did[n.likes] ? n.likes : ['pet', 'clean', 'feed'].find(verb => did[verb]);
    line = pick(care === 'clean' ? [...CARE[n.voice].clean, WASHED[n.kind]] : CARE[n.voice][care]);
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
const LIKES = { feed: 'being fed', clean: 'being cleaned', pet: 'being petted' };

export function biography(log, s, now) {
  const end = s.dead?.t ?? now;
  let firstMeal = null, previous = log.born, longest = 0;
  for (const v of log.visits) {
    longest = Math.max(longest, activeElapsed(log, previous, v.t));
    previous = v.t;
    if (firstMeal === null && v.acts.some(([verb]) => verb === 'feed')) firstMeal = v.t;
  }
  longest = Math.max(longest, activeElapsed(log, previous, end));
  const credited = (log.outages ?? []).reduce((sum, o) => sum + o.end - o.start, 0);
  const n = nature(log.born);
  const moves = placeAt(log.born, end).moves;
  const lines = [
    'one rock, one shared life',
    `born: ${date(log.born)}`,
    `age: ${Math.floor((end - log.born) / (24 * HOUR))}d`,
    `visits: ${s.visits}`,
    `first meal: ${firstMeal === null ? 'not yet' : date(firstMeal)}`,
    `longest quiet stretch: ${duration(longest)} (host downtime excluded)`,
    `host downtime credited: ${duration(credited)}`,
    `kind: ${KIND[n.kind]}`,
    `nature: ${n.voice}; it likes ${LIKES[n.likes]} best`,
    `habit: it faces the wall on ${WEEKDAYS[n.wallDay]} (utc)`,
    `close calls: ${s.closeCalls} (each kept as a vein)`,
    `moved on its own: ${moves === 1 ? 'once' : `${moves} times`}`,
  ];
  if (s.dead) lines.push(`died: ${date(s.dead.t)} (${s.dead.cause})`);
  for (const o of log.outages ?? []) {
    lines.push(`outage: ${iso(o.start)} to ${iso(o.end)}; credit ${o.end - o.start}ms; evidence ${o.evidence}`);
  }
  return lines.join('\n') + '\n';
}
