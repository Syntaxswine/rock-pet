// ASCII animation is a read-only view of the existing journey, never a new
// movement event. Stored destinations, checkpoints and survival are unchanged.
import { look } from '../src/rock.mjs';
import { replay, HOUR } from '../src/engine.mjs';
import { whereAt, roomOf, furrowShows } from '../src/wander.mjs';
import { DRAWINGS, DRAWING } from '../src/drawings.mjs';
import { hash, inDanger } from '../src/character.mjs';
import { mealAt } from '../src/meal.mjs';

export const STEP_MS = 500;
export const HORIZON_MS = 16000;
const D = DRAWINGS[DRAWING], BLOCK = 8 * HOUR;

// A rare, shared one-cell shuffle: about one per day, at a minute determined
// by the rock's birth. It steps out, holds for two seconds, then settles back.
export function shuffleAt(born, block) {
  return hash(born, 31, block) % 3 === 0
    ? block * BLOCK + (hash(born, 32, block) % 480) * 60000 : null;
}

export function displayPlace(log, now) {
  const s = replay(log, now), end = s.dead ? s.dead.t : now;
  const p = whereAt(log, end, D);
  const place = { dx: p.dx, from: p.from, furrow: !s.dead && furrowShows(log, p, now), dy: 0 };
  if (s.dead || inDanger(s) || (log.outages ?? []).some(o => now >= o.start && now < o.end)) return place;
  if (p.at !== null) {
    const steps = Math.floor((now - p.at) / STEP_MS), distance = Math.abs(p.dx - p.from);
    if (steps >= 0 && steps < distance) {
      place.dx = p.from + Math.sign(p.dx - p.from) * steps;
      return place;
    }
  }
  const block = Math.floor(now / BLOCK), at = shuffleAt(log.born, block);
  if (at === null || at <= log.born || now < at + STEP_MS || now >= at + 2500 ||
      mealAt(log, now) || (p.at !== null && now - p.at < HOUR)) return place;
  const [dx, dy] = [[-1, 0], [1, 0], [0, -1], [0, 1]][hash(log.born, 33, block) % 4];
  const room = roomOf(D);
  if (place.dx + dx < room.min || place.dx + dx > room.max) return place;
  return { ...place, dx: place.dx + dx, dy, furrow: false };
}

export function frameAt(log, now, caring = false, place = displayPlace(log, now)) {
  return look(log, { now, host: '', displayPlace: place, displayPose: caring ? 'front' : undefined }).text;
}

// Send the next polling interval's frames so short movements are visible
// without making a server request for each step. This predicts only from the
// current log; the next read or a manual command replaces the entire schedule.
export function sceneAt(log, now, reply, caring = false) {
  // Keep a care reply's authored reaction while its ASCII picture slides.
  const draw = (at, place) => {
    const text = frameAt(log, at, caring, place);
    if (!reply || !caring || text.startsWith('died:')) return text;
    const reaction = reply.split('\n').find(line => line.startsWith('quirk:'));
    return text.split('\n').filter(line => !line.startsWith('quirk:'))
      .flatMap(line => reaction && line.startsWith('history:') ? [reaction, line] : [line]).join('\n');
  };
  const frames = [{ at: now, text: draw(now) }];
  for (let at = Math.floor(now / STEP_MS) * STEP_MS + STEP_MS; at <= now + HORIZON_MS; at += STEP_MS) {
    const text = draw(at);
    if (text !== frames.at(-1).text) frames.push({ at, text });
  }
  const s = replay(log, now), p = whereAt(log, s.dead?.t ?? now, D);
  const moveAt = whereAt(log, s.dead?.t ?? now + HORIZON_MS, D).at;
  const distance = Math.abs(p.dx - p.from);
  let recent;
  if (!s.dead && !inDanger(s) && !(log.outages ?? []).some(o => now >= o.start && now < o.end) &&
      p.at !== null && now - p.at >= distance * STEP_MS && now - p.at < 15000) {
    // An unexpected feed may have moved it between reads. Supply a short
    // catch-up sequence from the current state, without replaying old care.
    recent = { at: p.at, frames: Array.from({ length: distance + 1 }, (_, i) => ({
      at: now + i * STEP_MS,
      text: draw(now, { dx: p.from + Math.sign(p.dx - p.from) * i, from: p.from, furrow: true, dy: 0 }),
    })) };
  }
  return { at: now, frames, moveAt, ...(recent ? { recent } : {}) };
}
