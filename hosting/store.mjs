// D1 batches are transactions, but reads before a batch are not. Every state
// update compares its revision; ledger inserts also require that write's token.
import { start, title, look, act, name, history, newLog, creditOutage } from '../src/rock.mjs';
import { compact, readCheckpoint } from '../src/checkpoint.mjs';
import { birthLine, nameLine, visitLine, deathLine, outageLine } from '../src/log.mjs';

export const MAX_OUTAGE_MS = 7 * 86400000;
export class Busy extends Error {}

export async function limited(db, now) {
  const window = Math.floor(now / 60000);
  const row = await db.prepare(`INSERT INTO rock_limits (id, window, count) VALUES (1, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      count = CASE WHEN excluded.window > rock_limits.window THEN 1 ELSE rock_limits.count + 1 END,
      window = MAX(rock_limits.window, excluded.window) RETURNING count`).bind(window).first();
  return row.count > 600;
}

export async function operate(binding, route, body, { now = Date.now(), outage } = {}) {
  // Start each request at the primary, never at a stale replica's title screen.
  const db = binding.withSession('first-primary');
  if (await limited(db, now)) throw new Busy('rate');
  for (let attempt = 0; attempt < 32; attempt++) {
    const head = await db.prepare('SELECT * FROM rock WHERE id = 1').first();
    const token = crypto.randomUUID();
    let log, result, lines = '', kind = 'read';
    const t = Math.max(now, head?.observed_at ?? now);
    if (!head) {
      // This independent, permanent birth/name ledger is the hosted begun mark.
      const begun = await db.prepare('SELECT name FROM rock_names LIMIT 1').first();
      const event = await db.prepare('SELECT seq FROM rock_events LIMIT 1').first();
      if (begun || event) throw new Error('missing rock with an existing birth ledger');
      if (route !== '/name') {
        result = title({ host: '' });
        if (route === '/act') result = { ...result, status: 409, text: 'error: give it a name first.\n' + result.text };
        return { ...result, phase: 'title' };
      }
      result = start(body, { now: t, host: '' });
      if (!result.named) return { ...result, phase: 'title' };
      log = { ...newLog(t), name: result.named };
      lines = birthLine(t) + nameLine(result.named);
      kind = 'birth';
    } else {
      log = readCheckpoint(head.state);
      if (outage) {
        const recorded = (log.outages ?? []).find(o => o.evidence === outage.evidence);
        if (recorded && (recorded.start !== outage.start || recorded.end !== outage.end)) throw new Error('outage evidence reused');
        if (!recorded) {
          if (outage.end - outage.start > MAX_OUTAGE_MS) throw new Error('outage exceeds the seven-day bound');
          // Deployment configuration is the only source of credit, never a request.
          const credited = creditOutage(log, outage, { now: t });
          log = { ...log, outages: [...(log.outages ?? []), credited] };
          lines += outageLine(credited);
          kind = 'outage';
        }
      }
      result = route === '/act' ? act(log, body, { now: t, host: '' })
        : route === '/name' ? name(log, body, { now: t, host: '' })
        : route === '/history' ? history(log, { now: t }) : look(log, { now: t, host: '' });
      if (result.visit) {
        log = compact({ ...log, visits: [...log.visits, result.visit] });
        lines += visitLine(result.visit); kind = 'care';
      }
      if (result.named) {
        // Hosted births always have a name. Legacy imports must be named offline.
        throw new Error('unexpected unnamed stored rock');
      }
      if (result.died) {
        log = { ...log, died: result.died };
        lines += deathLine(result.died); kind = 'death';
      }
    }
    const statements = [head
      ? db.prepare('UPDATE rock SET revision = revision + 1, state = ?, observed_at = ?, token = ? WHERE id = 1 AND revision = ?')
        .bind(JSON.stringify(log), t, token, head.revision)
      : db.prepare('INSERT INTO rock (id, revision, state, observed_at, token) VALUES (1, 1, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
        .bind(JSON.stringify(log), t, token)];
    if (lines) statements.push(db.prepare(`INSERT INTO rock_events (token, at, kind, payload)
      SELECT ?, ?, ?, ? FROM rock WHERE id = 1 AND token = ?`).bind(token, t, kind, lines, token));
    if (!head) statements.push(db.prepare(`INSERT INTO rock_names (name, born)
      SELECT ?, ? FROM rock WHERE id = 1 AND token = ?`).bind(log.name.name, log.born, token));
    const saved = await db.batch(statements);
    if (saved[0].meta.changes === 1) return { ...result, phase: log.died ? 'dead' : 'alive' };
    // A competing visit won. Recompute from its committed state, including death.
  }
  throw new Busy('contention');
}
