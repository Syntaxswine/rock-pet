// Authored fragments only. Biography is derived from the shared log, with no visitor
// names, messages or identities. Personality never feeds back into the game engine.
import { HOUR } from './engine.mjs';
import { activeElapsed } from './outages.mjs';
import { careTotals, personality, personalitySummary, percentages } from './personality.mjs';

// The strongest part of its continuous personality blend chooses a short reaction.
// Order within each row: clean, feed, pet. All variants are benevolent.
const REACTIONS = {
  balanced: ['it settles into its clean corner.', 'it considers that a good meal.', 'it holds the warmth for a moment.'],
  feed: ['it makes itself comfortable.', 'it saves an imaginary crumb.', 'it settles closer, comfortably full.'],
  clean: ['it admires the empty floor.', 'it leaves no imaginary crumbs.', 'it accepts a very orderly pat.'],
  pet: ['it watches you with fond attention.', 'it seems glad you stayed for dinner.', 'it leans into the attention.'],
  'feed-clean': ['it settles neatly into place.', 'it enjoys a tidy little meal.', 'it seems quietly at home.'],
  'feed-pet': ['it makes room for company.', 'it imagines sharing a crumb.', 'it nestles into the company.'],
  'clean-pet': ['it seems touched by the tidying.', 'it accepts the meal gently.', 'it returns a very gentle lean.'],
};

export function reaction(log, before, after) {
  if (after.dead) return '';
  const event = after.happy > before.happy ? 'pet' : after.messes < before.messes ? 'clean' :
    after.hunger < before.hunger ? 'feed' : null;
  if (!event) return '';
  const profile = personality(careTotals(log));
  return `quirk: ${REACTIONS[profile.dominant?.id ?? 'balanced'][['clean', 'feed', 'pet'].indexOf(event)]}\n`;
}

const date = t => new Date(t).toISOString().slice(0, 10);
const iso = t => new Date(t).toISOString();
const duration = ms => `${Math.floor(ms / HOUR)}h ${Math.floor(ms / 60000) % 60}m`;

export function biography(log, s, now) {
  const profile = personality(careTotals(log));
  const balance = percentages(profile.shares);
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
    `care totals: feed ${profile.totals.feed}  clean ${profile.totals.clean}  pet ${profile.totals.pet}`,
    ...(profile.formed ? [`care balance: feed ${balance.feed}%  clean ${balance.clean}%  pet ${balance.pet}% (weighted)`] : []),
    personalitySummary(profile),
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
