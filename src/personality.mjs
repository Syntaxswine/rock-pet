// Personality is a summary of received care, never an input to survival or mood.
// Three lifetime counters suffice; old logs can reconstruct them without migration.
import { RULES } from './rules.mjs';

export const CARE_AXES = Object.freeze(['feed', 'clean', 'pet']);
// Baseline maintenance, with no avoidable hunger/mess pain. These fixed denominators
// make different kinds of care comparable without making personality depend on timing.
export const DAILY_CARE = Object.freeze({
  feed: 24 * RULES.hungerPerHour / RULES.feed,
  clean: 24 / RULES.messEveryH,
  pet: 24 * RULES.decay / RULES.pet,
});

export const PERSONALITIES = Object.freeze([
  { id: 'balanced', name: 'even-tempered', axes: ['feed', 'clean', 'pet'] },
  { id: 'feed-clean', name: 'settled', axes: ['feed', 'clean'] },
  { id: 'feed-pet', name: 'sociable', axes: ['feed', 'pet'] },
  { id: 'clean-pet', name: 'gentle', axes: ['clean', 'pet'] },
  { id: 'feed', name: 'comfort-loving', axes: ['feed'] },
  { id: 'clean', name: 'orderly', axes: ['clean'] },
  { id: 'pet', name: 'affectionate', axes: ['pet'] },
].map(p => Object.freeze({ ...p, axes: Object.freeze(p.axes) })));

function checkCounts(counts) {
  for (const key of CARE_AXES) {
    if (!Number.isFinite(counts?.[key]) || counts[key] < 0) throw new Error(`invalid ${key} care total`);
  }
}

/** Add one accepted visit; counts include repeats and care at an already satisfied stat. */
export function addCare(totals, acts) {
  checkCounts(totals);
  const next = { ...totals };
  for (const [verb, n] of acts) {
    if (!CARE_AXES.includes(verb) || !Number.isInteger(n) || n < 1 || n > RULES.maxCount) throw new Error('invalid accepted care');
    next[verb] += n;
    if (!Number.isSafeInteger(next[verb])) throw new Error('care counter exceeds safe integer range');
  }
  return next;
}

/** Input is an accepted event log, not a hypothetical future visit schedule. */
export function careTotals(log) {
  let totals = { feed: 0, clean: 0, pet: 0 };
  if (log.checkpoint) totals = { ...log.checkpoint.care };
  for (const visit of log.visits) totals = addCare(totals, visit.acts);
  return totals;
}

/**
 * Normalize counters by daily demand, then plot their shares in an equilateral triangle.
 * Within each of its six sectors, blend the center, a side midpoint, and a corner:
 * center = 3*smallest; pair = 2*(middle-smallest); corner = largest-middle.
 * Weights are continuous, nonnegative, sum to one, and reconstruct the plotted point.
 */
export function personality(totals, daily = DAILY_CARE) {
  checkCounts(totals);
  for (const key of CARE_AXES) {
    if (!Number.isFinite(daily?.[key]) || daily[key] <= 0) throw new Error(`invalid ${key} daily demand`);
  }
  const equivalents = Object.fromEntries(CARE_AXES.map(key => [key, totals[key] / daily[key]]));
  if (Object.values(equivalents).some(n => !Number.isFinite(n))) throw new Error('care normalization exceeds numeric range');
  // Scale first so large, valid totals cannot overflow when summed.
  const scale = Math.max(...Object.values(equivalents));
  const sum = scale ? CARE_AXES.reduce((n, key) => n + equivalents[key] / scale, 0) : 0;
  const shares = Object.fromEntries(CARE_AXES.map(key => [key, scale ? equivalents[key] / scale / sum : 0]));
  const blend = Object.fromEntries(PERSONALITIES.map(p => [p.id, 0]));
  let dominant = null;
  if (scale) {
    const order = [...CARE_AXES].sort((a, b) => shares[a] - shares[b]);
    const [low, middle, high] = order;
    blend.balanced = 3 * shares[low];
    const pair = CARE_AXES.filter(key => key === middle || key === high).join('-');
    blend[pair] = 2 * (shares[middle] - shares[low]);
    blend[high] = shares[high] - shares[middle];
    // Stable ties prefer the center, then the pairs, then the corners.
    dominant = PERSONALITIES.reduce((best, p) => blend[p.id] > blend[best.id] + 1e-12 ? p : best);
  }
  return {
    formed: scale > 0, totals: { ...totals }, equivalents, shares, blend, dominant,
    // feed at the top, clean bottom-left, pet bottom-right; unit-width coordinates.
    point: scale ? { x: shares.feed / 2 + shares.pet, y: Math.sqrt(3) / 2 * (shares.clean + shares.pet) } : null,
  };
}

/** Rounded percentages that still sum to 100. Works for shares or the seven-way blend. */
export function percentages(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((n, [, value]) => n + value, 0);
  if (!total) return Object.fromEntries(entries.map(([key]) => [key, 0]));
  const rows = entries.map(([key, value]) => ({ key, exact: 100 * value / total, n: Math.floor(100 * value / total) }));
  let remaining = 100 - rows.reduce((n, r) => n + r.n, 0);
  for (const row of [...rows].sort((a, b) => (b.exact - b.n) - (a.exact - a.n))) {
    if (remaining-- > 0) row.n++;
  }
  return Object.fromEntries(rows.map(({ key, n }) => [key, n]));
}

export function personalitySummary(profile) {
  if (!profile.formed) return 'personality: still forming (no care received)';
  const rounded = percentages(profile.blend);
  const parts = PERSONALITIES.filter(p => rounded[p.id] > 0).sort((a, b) => profile.blend[b.id] - profile.blend[a.id]);
  return `personality: ${parts.map(p => `${rounded[p.id]}% ${p.name}`).join(', ')}`;
}
