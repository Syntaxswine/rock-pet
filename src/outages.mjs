// Trusted, verified host outages only. This module cannot verify an outage; the operator
// or future hosting adapter supplies evidence. An absence of visits proves nothing.
export const isTime = t => Number.isFinite(t) && Math.abs(t) <= 8.64e15;
const EVIDENCE = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;

export function validateOutages(log) {
  let end = log.born;
  for (const o of log.outages ?? []) {
    if (!o || !isTime(o.start) || !isTime(o.end) || o.start < end || o.end <= o.start ||
        typeof o.evidence !== 'string' || !EVIDENCE.test(o.evidence)) {
      throw new Error('outages need ordered, nonoverlapping finite windows and an evidence ID');
    }
    if (log.visits.some(v => v.t >= o.start && v.t < o.end)) {
      throw new Error('an outage overlaps an accepted visit');
    }
    end = o.end;
  }
}

/** Active elapsed time: intervals are [start, end), with no double-counted credit. */
export function activeElapsed(log, start, end) {
  let ms = end - start;
  for (const o of log.outages ?? []) ms -= Math.max(0, Math.min(end, o.end) - Math.max(start, o.start));
  return Math.max(0, ms);
}
