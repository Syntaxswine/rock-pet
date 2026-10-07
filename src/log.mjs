// The rock's event log as text: one JSON object per line. The birth comes first, then each
// visit, then (once a server has seen the rock dead) its death. Parsing refuses anything it
// could not replay exactly; a log is never repaired by guessing.

import { RULES } from './rules.mjs';
import { VERBS } from './parse.mjs';
import { isTime, validateOutages } from './outages.mjs';

const CAUSES = ['hungry', 'filthy', 'lonely'];
const isAct = a => Array.isArray(a) && a.length === 2 && VERBS.includes(a[0]) &&
  Number.isInteger(a[1]) && a[1] >= 1 && a[1] <= RULES.maxCount;

/** { born, rules, visits: [{ t, acts }], died: { t, cause } | null } from the log's text. */
export function parseLog(text) {
  // trim() also drops a CR and a byte-order mark, which Windows editors like to add.
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('the log is empty');
  const rows = lines.map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`line ${i + 1} is not JSON`); }
  });
  const [head, ...rest] = rows;
  if (!isTime(head?.born)) throw new Error('line 1 is not a birth');
  const log = { born: head.born, rules: head.rules, visits: [], died: null };
  // Validate the whole history even when replay would stop early at death.
  let last = log.born;
  rest.forEach((row, i) => {
    const where = `line ${i + 2}`;
    if (log.died) throw new Error(`${where} comes after the death`);
    if (row !== null && typeof row === 'object' && 'outage' in row) {
      const o = row.outage;
      if (!o || !isTime(o.start) || !isTime(o.end) || o.start < last) throw new Error(`${where} is not an ordered outage`);
      (log.outages ??= []).push({ start: o.start, end: o.end, evidence: o.evidence });
      last = o.end;
      return;
    }
    if (row !== null && typeof row === 'object' && 'died' in row) {
      if (!isTime(row.died) || !CAUSES.includes(row.cause)) throw new Error(`${where} is not a death`);
      log.died = { t: row.died, cause: row.cause };
      return;
    }
    if (!(isTime(row?.t) && Array.isArray(row.acts) && row.acts.length > 0 && row.acts.every(isAct))) {
      throw new Error(`${where} is not a visit`);
    }
    if (row.t < last) throw new Error(`${where}: visits out of time order`);
    last = row.t;
    log.visits.push({ t: row.t, acts: row.acts });
  });
  validateOutages(log);
  return log;
}

export const birthLine = born => JSON.stringify({ born, rules: RULES.version }) + '\n';
export const visitLine = visit => JSON.stringify({ t: visit.t, acts: visit.acts }) + '\n';
export const deathLine = died => JSON.stringify({ died: died.t, cause: died.cause }) + '\n';
export const outageLine = outage => JSON.stringify({ outage }) + '\n';
