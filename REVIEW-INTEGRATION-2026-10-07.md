# Character and personality integration review

Scope: Claude's `character/design` through `d965b76`, combined with `codex/rock-personality` through `785f29a`. Reviewed in an isolated worktree; the shared main checkout was left alone.

The character design fits the small ASCII game: readable moods, persistent physical marks, occasional observations, and no character mechanic changing hunger, happiness or survival. The renderer's model sheet covers all seven drawings, living and dead, with moss, marks, wall poses and movement. The default remains the lump; choosing a different drawing is still an owner decision.

## Findings addressed

- **P2 — A name persisted after computed death was accepted.** A syntactically valid name row could describe naming a dead rock when no death row had yet been recorded. Replay validation now refuses such logs, just as it refuses visits after death. Regression coverage checks all public game operations and the last valid naming instant.
- **Personality integration:** birth-assigned voices and preferred verbs conflicted with the owner's weighted lifetime-care model. Reactions and biography now use the seven-component triangle. Stone kind and wall weekday remain birth-fixed physical/habit details. The current accepted visit contributes before selecting a reaction.
- **Story consistency:** visit milestones now acknowledge care at already satisfied stats, including the first visitor. Recovery no longer assumes nobody visited. Rescues after the third visible vein use wording that does not announce an undrawn mark. Any effective clean can reveal the stone's kind, whatever its personality.
- **Voice consistency:** personality lines address the rock, never the visitor, and follow the existing short authored-line constraints. Danger and death suppress all character reactions.

Personality counts every accepted repetition, including extra care. Physical polish and crystals count the actual improvement in hunger/happiness. Reads, naming, rejected requests and care after death do not add personality counts. No log migration or survival-rule change is needed.

## Validation and boundaries

The combined tests cover all seven personalities and continuous blends, event replay, naming, outage credit, drawing bounds, the generated model sheet, HTTP behavior, four time zones, and comparison with the independent simulator. All 145 tests pass. All 177 of 177 curated mutations are caught, covering the inherited rules and the integration fixes.

Public hosting and independent outage detection remain deferred. Names remain a one-word, first-visitor choice under the owner's character brief; name reuse checks use the local graveyard. Seasonal visitor selection and more gradual grave moss are optional design refinements, not merge blockers.
