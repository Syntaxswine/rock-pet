# Personality from received care

The rock's personality grows from three lifetime counters: accepted **feed**, **clean** and **pet** actions. `pet x5` contributes five pets. Extra care counts even when a need is already satisfied. Invalid requests, rejected visits after death, reads, time passing and host downtime contribute nothing. Counts are the accepted counts already in the event log, including its existing per-word cap of 20.

These counters summarize personality; the event log is still needed for survival, outage auditing and biography dates. No new log format or migration is needed. A future hosted checkpoint can keep just `{ feed, clean, pet }` for this feature and call `addCare` for each newly accepted visit. (The screen's ground, which draws these shares, also keeps its three levels; see AGENTS.md, "Keep the state".)

## Weights

Divide each counter by its baseline daily maintenance demand, then normalize the three results to sum to one:

| Axis | Actions per day | Basis |
|---|---:|---|
| Feed | 10 / 3 ≈ 3.33 | 10 hunger/day; one feed removes 3 |
| Clean | 2 | One world-clock mess every 12 hours |
| Pet | 4.8 | 0.4 happiness/hour × 24 hours ÷ 2 per pet |

These are fixed baseline equivalents, not a prediction of the exact integer actions needed for a real care schedule. Extra pets needed because of hunger or accumulated mess are not built into the denominator. One clean can remove multiple messes. Those schedule effects must not make the same three totals produce a different personality. The module accepts alternative positive daily weights explicitly so this tuning can be adjusted later.

For example, **25 feeds, 15 cleans, 36 pets** represent the same amount of baseline care on all three axes and land at the center. Equal raw counts do not: one clean carries more weight than one feed or one pet.

## Seven anchors, continuous shades

| Favored care | Personality |
|---|---|
| All three equally | Even-tempered |
| Feed | Comfort-loving |
| Clean | Orderly |
| Pet | Affectionate |
| Feed + clean | Settled |
| Feed + pet | Sociable |
| Clean + pet | Gentle |

These names describe authored flavor, not changes to happiness, need rates, action strength or death. Feed is the triangle's top corner, clean the bottom-left, and pet the bottom-right. The three pairs sit at side midpoints; balanced care sits at the center.

The position is a continuous blend of the center, the relevant side midpoint and the strongest corner. Sort the three normalized shares from smallest to largest:

- Center weight = 3 × smallest.
- Pair weight = 2 × (middle − smallest).
- Corner weight = largest − middle.

The seven weights are nonnegative, sum to one, and reconstruct the same triangle position. A 50% feed / 30% clean / 20% pet balance therefore means 60% even-tempered, 20% settled and 20% comfort-loving. No hard region thresholds discard those shades. The strongest blend component chooses the brief care reaction; ties prefer the center, then pairs, then corners. The full blend appears in `/history` alongside totals and weighted shares.

A newborn with zero care is **still forming**, with no plotted point; it has not earned a balanced history. First care establishes a direction. Personality is based on lifetime totals with no rolling window or forgetting, so a long history changes more gradually. Scaling every counter equally leaves its position unchanged.

## Integration

`src/personality.mjs` has no storage, clock or platform dependency beyond reading the existing numerical rules:

- `careTotals(log)` reconstructs the three counters from accepted visits.
- `addCare(totals, acts)` returns updated counters for a future checkpoint.
- `personality(totals, dailyWeights?)` returns normalized shares, unit-width triangle coordinates, all seven blend weights and the strongest component.
- `personalitySummary(profile)` provides a short description whose rounded percentages sum to 100.

`story.mjs` uses the profile for care reactions and the biography. The screen draws its shares as the ground around the rock (`src/ground.mjs`; CHARACTER.md, "Its ground"). `rock.mjs` passes the log including the newly accepted visit to the reaction. Personality changes no survival rules. Claude's character design adds naming, physical marks and occasions alongside it. A care action at an already satisfied stat still changes these counters, but stays quiet except at visit milestones; its influence is visible in history, subsequent reactions and the ground on the screen.
