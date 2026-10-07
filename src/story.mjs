// Authored fragments only. Biography is derived from the shared log, with no visitor
// names, messages or identities. Personality never feeds back into the game engine.
import { HOUR } from './engine.mjs';
import { activeElapsed } from './outages.mjs';

const REACTIONS = {
  clean: ['it admires the empty floor.', 'it settles into its clean corner.', 'it looks pleased with the tidying.'],
  feed: ['it saves an imaginary crumb.', 'it looks comfortably heavier.', 'it considers that a good meal.'],
  pet: ['it leans into the attention.', 'it seems a little less stone-faced.', 'it holds the warmth for a moment.'],
};

export function reaction(birth, before, after) {
  if (after.dead) return '';
  const event = after.happy > before.happy ? 'pet' : after.messes < before.messes ? 'clean' :
    after.hunger < before.hunger ? 'feed' : null;
  if (!event) return '';
  // One stable temperament per birth, independent of polls, process restarts and time.
  const seed = Math.abs(Math.trunc(birth / 1000)) % 3;
  return `quirk: ${REACTIONS[event][seed]}\n`;
}

const date = t => new Date(t).toISOString().slice(0, 10);
const iso = t => new Date(t).toISOString();
const duration = ms => `${Math.floor(ms / HOUR)}h ${Math.floor(ms / 60000) % 60}m`;

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
  const lines = [
    'one rock, one shared life',
    `born: ${date(log.born)}`,
    `age: ${Math.floor((end - log.born) / (24 * HOUR))}d`,
    `visits: ${s.visits}`,
    `first meal: ${firstMeal === null ? 'not yet' : date(firstMeal)}`,
    `longest quiet stretch: ${duration(longest)} (host downtime excluded)`,
    `host downtime credited: ${duration(credited)}`,
  ];
  if (s.dead) lines.push(`died: ${date(s.dead.t)} (${s.dead.cause})`);
  for (const o of log.outages ?? []) {
    lines.push(`outage: ${iso(o.start)} to ${iso(o.end)}; credit ${o.end - o.start}ms; evidence ${o.evidence}`);
  }
  return lines.join('\n') + '\n';
}
