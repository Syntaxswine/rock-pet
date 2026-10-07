// The decided rules (DESIGN-NOTES.md, 2026-10-06). tools/rocksim.mjs keeps its own copy as the
// reference model; test/sim.test.mjs fails if the two drift apart. Change both in one commit.
export const RULES = Object.freeze({
  version: 1,             // stored in every rock's log; a log is only replayed under its own rules
  hungerPerHour: 10 / 24, // hunger 0..10 rises +10 per 24h
  feed: 3,                // one feed: hunger -3 (floor 0)
  painFrom: 6,            // hunger pain while hunger is above 6 (7-9, and at 10)
  painPerPoint: 0.4,      // happiness lost per hour, per hunger point above painFrom
  decay: 0.4,             // happiness lost per hour, always
  messPain: 0.3,          // happiness lost per hour, per visible mess
  messEveryH: 12,         // one mess at every 00:00 and 12:00 UTC
  messCeil: 3,            // each visible mess lowers the most happiness can be by 3 (floor -10)
  pet: 2,                 // one pet: happiness +2, up to that ceiling
  graceH: 48,             // hours IN A ROW at hunger 10, or at happiness -10, before death
  // Most repeats of one verb per word. Outcome-neutral: 4 feeds empty any hunger and 10 pets
  // fill any happiness, so a larger count could not change the result, only the work.
  maxCount: 20,
});
