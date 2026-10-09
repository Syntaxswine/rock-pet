// A checkpoint ends at an accepted visit, never at a read. Retain the newest
// millisecond's visits so simultaneous care keeps the original event ordering.
import { replay } from './engine.mjs';
import { groundAt } from './ground.mjs';
import { careTotals } from './personality.mjs';
import { motionAt } from './wander.mjs';
import { activeElapsed } from './outages.mjs';
import { DRAWING, DRAWINGS } from './drawings.mjs';

export function compact(log) {
  if (log.visits.length < 2) return log;
  const latest = log.visits.at(-1).t;
  const older = log.visits.filter(v => v.t < latest);
  if (!older.length) return log;
  const cut = older.at(-1).t;
  const prefix = { ...log, visits: older };
  const engine = replay(prefix, cut);
  if (engine.dead) throw new Error('cannot checkpoint care after death');
  const motion = motionAt(prefix, cut, DRAWINGS[DRAWING]);
  let biography = { firstMeal: null, previous: log.born, longest: 0 };
  if (log.checkpoint) biography = { ...log.checkpoint.biography };
  let fed = log.checkpoint?.fed ?? null;
  for (const v of older) {
    biography.longest = Math.max(biography.longest, activeElapsed(log, biography.previous, v.t));
    biography.previous = v.t;
    if (v.acts.some(([verb]) => verb === 'feed')) {
      fed = v.t;
      biography.firstMeal ??= v.t;
    }
  }
  const { moves, ...movement } = motion;
  return {
    ...log,
    visits: log.visits.filter(v => v.t >= latest),
    checkpoint: {
      version: 1, drawing: DRAWING, engine,
      ground: groundAt(prefix, cut), care: careTotals(prefix),
      motion: movement, biography, fed,
    },
  };
}

export function readCheckpoint(json) {
  const log = JSON.parse(json);
  if (!log || !Number.isFinite(log.born) || !Array.isArray(log.visits)) throw new Error('invalid stored rock');
  const c = log.checkpoint;
  if (c && (c.version !== 1 || c.drawing !== DRAWING || c.engine?.born !== log.born ||
      !Number.isFinite(c.engine.t) || !Number.isSafeInteger(c.engine.visits) || c.engine.visits < 1 ||
      !c.ground || !c.care || !c.motion || !c.biography ||
      log.visits.some(v => v.t <= c.engine.t))) throw new Error('invalid checkpoint');
  return log;
}
