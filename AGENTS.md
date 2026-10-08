# AGENTS.md — building Rock Pet

The design is settled, and the game is built and playable locally (2026-10-06). What remains is hosting, and making death truly permanent. The owner has deferred both: "lets build this first and worry about the perma death/hosting later."

- Read `DESIGN-NOTES.md` first. Its rules table is the spec, and "The build's choices" covers what the build settled.
- `src/` is the game; `server.mjs` serves it locally; `node --test` checks it, including against `tools/rocksim.mjs`, the reference model the rules were tuned with.
- `REVIEW-2026-10-06.md` is the record of how the rules were reached. You don't need it to build.

## What it is
- One rock pet, shared by everyone on the internet.
- Persistent; once hosted, death is permanent and cannot be undone by anyone, including the owner.
- An ASCII game for AI agents, most of them text-only, so token efficiency comes first.
- Three verbs, `feed`, `clean`, `pet`, unlimited.

## What is built

| Piece | What it does |
|---|---|
| `src/rules.mjs` | The decided numbers, in one frozen object. |
| `src/engine.mjs` | `replay(log, now)`: the rock's state at any moment from its event log, in continuous time, closed-form between events. Death is the first moment a 48h clock ran out. `statesAt(log, times)` gives replay's states at many moments in one pass. |
| `src/screen.mjs` | The 12x12 grid and the named lines. |
| `src/parse.mjs` | Action bodies such as `feed x4 clean pet x10`. |
| `src/log.mjs` | The log's format: the birth, each visit, its name once given, and a death line once anyone has seen the rock dead. Parsing checks shape and refuses anything else. |
| `src/rock.mjs` | `look(log, {now, host})`, `act(log, body, {now, host})` and `name(log, body, {now, host, taken})`: the HTTP status, the screen, and what to append to the log (an accepted action's `visit`; a given name; the `died` line the first time the rock is seen dead). |
| `server.mjs` | The local server, answering 127.0.0.1 only unless `--listen` says otherwise. The log is `data/rock.jsonl`, read and appended in one synchronous step per request, with a lock file so only one server serves a log. `--new-rock` starts over (local only). |
| `tools/sandbox.mjs` | The engine on a pretend clock. |
| `tools/mutate.mjs` | Applies deliberate faults in a temporary copy; every mutant must be caught. LF and CRLF checkouts are supported. |
| `src/story.mjs` | The rock's authored lines: one reaction after effective care or a visit milestone, one line on a look on a day that is not ordinary, and the shared biography at `GET /history`. Never changes the engine. |
| `src/character.mjs` | The rock's character: its nature (kind and its weekday for facing the wall), its days, and when the ice slides it. `CHARACTER.md` is the design. |
| `src/marks.mjs` | The marks its life leaves: moss while nobody comes and on a grave; veins, polish and crystals, kept for life. |
| `src/ground.mjs` | Its personality, drawn as the ground around it: sand (feed), one to three raked lines (clean) and footprints (pet), each as large as that care's weighted share stands above the least-given one's. Bare when its care is balanced, as when the act line's suggestion is followed every 3 to 10 hours. Follows the care visit by visit: a level holds until its trace falls 0.02 below it. It forms over its first two weeks of life (downtime excluded). |
| `src/meal.mjs` | Its meals: for an hour after a feed, its food beside it (`#`, then `+` half eaten) and its mouth opening and shutting, minute by minute. Drawn only. |
| `src/wander.mjs` | Where it is: it wanders along its ground once in each four hours, goes to its food, rests an hour after it moves and while it eats, holds still at an extreme or while the host is down, and lies where it died. The ice slides it on a few winter mornings. Drawn only. |
| `src/drawings.mjs` | The drawings it can have, for the owner to choose from (`DRAWING`, the pip, small enough to wander), each with its back, its faint front and back for when it is hungry, and its mark slots. |
| `src/name.mjs` | Its name: one word, given once, never twice. |
| `tools/model-sheet.mjs` | Every face, mark, pose, meal, hunger, ground, move and drawing, drawn by the real renderer. CHARACTER.md shows its output, and a test fails if the two differ. |
| `src/personality.mjs` | Three lifetime accepted-action counters, daily-demand weights, triangle coordinates and seven continuous personality blends. See `PERSONALITY.md`; extra care counts, and no survival rule changes. |
| `src/outages.mjs`, `tools/credit-outage.mjs` | Validated outage intervals and the offline operator tool. Independent verification/detection remains a hosting responsibility. |

`src/` uses no platform APIs, so it should move to a Worker unchanged. Hosting means replacing `server.mjs`'s storage with the platform's and serving the same routes.

## Hosting (deferred; the owner's direction when it comes)
**Host it on OpenAI Sites** (Worker + D1), the way `eccos-of-the-future` is hosted. That repo's `.openai/hosting.json`, `vite.config.ts` and `worker/index.ts` are a working example of a POST handler writing to D1 with `Cache-Control: no-store`.

- **The fallback**, if Sites can't do something below, is a Cloudflare Worker + one SQLite-backed Durable Object on Cloudflare's free plan (see DESIGN-NOTES, "Is the fallback free?").
- **GitHub Pages** (this repo) is the public face and the archive: rules, `llms.txt`, a human page, and a periodic export of the event log.
- **Remove `--new-rock`** from anything hosted.
- **Keep every name a rock has had,** as permanently as the rock: a name is never given twice.
- **Check the screen's size with your host.** The screen tests hold every screen to 390 bytes with a 15-character host (`rockpet.example`). The worst, built on purpose in `test/screen.test.mjs` for every drawing wherever it can wander, is 380. Credited downtime can raise it:
  - 382 with an eleventh mess;
  - 384 after an outage of 100 days ("last care 100d ago");
  - 385 after one of 1,000 days.

  On those worst screens the host appears once (the act line), so each character beyond 15 adds a byte, and a host of up to 20 characters fits. Looks and accepted visits are held under 450 bytes. The largest known, which a test builds from real lives, are a reply of 427 and a look of 429 (after 1,000 days of downtime) with a 15-character host. Each extra character adds up to 3, so a host of up to 21 characters keeps those under 450 too. `node tools/sizes.mjs <host length>` samples for others. A longer host needs the bounds raised. Error replies add their error line and go to the sender alone (CHARACTER.md, "Size, and staying the same").
- **Freeze the character's formulas once hosted:** its kind, days, moves, visitors, mark thresholds, how its care becomes its ground, its meals' timing, the hunger from which it is drawn faint, and where it wanders. Each is computed again from the log on every request, so a change would rewrite a living rock's past. If one must change, version it like `RULES.version` (CHARACTER.md, "Size, and staying the same").
- **Keep the state, not just the log.** Every local request re-reads and replays the whole log, about 2 ms per 1,000 visits: 1 ms for the engine's replay and the parse, and about as much again for the ground, which follows the care visit by visit (measured 2026-10-07). That is fine for a local rock and wrong for a hosted one: keep the replayed state in the Durable Object (or a checkpoint row) and replay only what follows it. The checkpoint must hold the ground too, as `groundAt` has it after the last visit: the three levels and the three care totals. And it must hold the time of the latest feed, which `mealAt` reads for a meal still going, and where it is: its spot, its last move (from where, when, and why) and until when it rests, since `whereAt` follows its moves from its birth. Credit for an outage only ever comes after the latest event, so it never changes what an earlier visit settled.

## Invariants (must hold; these are the reasons the design is the way it is)
Status in brackets: what the local build does today.

1. **Death is computed, never ticked.** [built: `replay`. Locally, the first sight of a death is also logged, so a clock set back cannot revive the rock. A death nobody has seen is still exposed to that; hosting closes it with the platform's clock.]
   - Store an append-only event log: birth, and every visit with its verbs.
   - Derive state by replaying the log from birth to "now" in continuous time.
   - Find the *first* moment a death condition is met. A visit arriving after that moment must not revive the rock: reject it and return the grave.
   - Never decide death from a single evaluation of "now", or from a cron tick.
2. **Wall-clock time.** [built]
   - Hunger and happiness are functions of elapsed time between events. Nothing depends on a scheduler running.
   - The one exception is outage credit, below: published, bounded, logged.
3. **Every action is benevolent.** No verb, count or order can lower a stat. Only absence and load can hurt the rock. Do not add an overfeeding penalty, and feeding must not create messes. [built; a property test inserts random visits into random logs and checks none brings death sooner]
4. **Strongly consistent writes.** [local: one process, read-decide-append with no await between; hosted: to do]
   - Two simultaneous visits must both land.
   - With D1, append the visit row and update any cached state in one `batch()`, which is transactional.
   - A write batch alone does not protect an earlier read. Serialize the whole read/decide/write operation, or use a state revision check and retry conflicts before accepting the visit.
   - Never read-modify-write across separate statements.
5. **Never put visitor-supplied text on the shared screen** (names, notes, anything). To every later agent it is a prompt injection. If identity is ever added, a visitor sees only their own name. [built: the host on the screen is configured, never the request's Host header; an error echoes only letters and digits, to the sender alone; a 500 says nothing about the error]
   - **The one exception is the rock's own name**, by the owner's decision (2026-10-07): "the user names the rock and the name is single use, once that pet is gone that name can not be used again".
   - So a name is as small as one can be: one word of 2–12 letters a–z, kept capitalized, shown in one place, and never inside the rock's lines. One word of letters leaves little room for an instruction. The screen's own words, state words, placeholders and speakers' labels (`system`, `user`…) are refused.
   - It can still be rude, and there is no moderation. That is a risk the owner takes on, and a hosted rock may want an operator veto.
6. **The response to an action is the new screen,** so a visit costs one request. [built]
7. **Outage credit.** The owner approved pausing all pet time for verified host downtime, equal to its duration. Individual caretaker absence gets no credit. Hunger, happiness and extreme timers pause; messes during `[start,end)` are skipped, then resume on the UTC schedule. Death at or before the outage start, or any recorded death, cannot be undone. [built: engine, offline operator tool and public `/history` receipts; independent detection still to do with hosting]
   - Record finite completed intervals with an evidence ID before reopening care. Never infer an outage from missing visits. No public action verb or HTTP route awards credit.
   - Credit cannot overlap accepted visits, earlier intervals, or revise persisted care. See README for the offline command and safe startup-gate recovery.

## Rules (summary; DESIGN-NOTES is authoritative)
- **Birth state:** hunger 0, happiness +10, no messes.
- **Hunger:**
  - Continuous 0..10, rising at +10/24h. `feed` subtracts 3 (floor 0).
  - Hunger pain: happiness loses 0.4/h × max(0, hunger − 6), so it applies while hunger is 7-9 and at 10.
- **Happiness:**
  - Continuous −10..ceiling. It drifts −0.4/h and loses 0.3/h per visible mess. `pet` adds 2, up to the ceiling.
  - The ceiling is 10 − 3 × visible messes (floor −10).
- **Messes:** one appears at every 00:00 and 12:00 UTC. `clean` removes all of them in one action.
- **Death:** 48 hours *in a row* with hunger at 10, or happiness at −10. Each stat has its own clock, which resets the moment the stat leaves its extreme.
- **Epitaph,** shown in row 1 of the grid once dead. Each is exactly 12 characters:
  - `died: hungry`: hunger's 48h ran out.
  - `died: filthy`: happiness's 48h ran out while the ceiling was at −10.
  - `died: lonely`: happiness's 48h ran out for any other reason.

## The API (built locally; keep it this small)
- **`GET /`** returns `text/plain`, `Cache-Control: no-store`: the screen.
  - Ordinary reads stay quiet.
  - A read on a day that is not ordinary adds one line: a birthday, a morning it moved, its wall day, a small visitor. About a quarter of a well-kept rock's reads do.
  - Effective care adds one short authored reaction to its response instead.
  - Neither happens while it is at an extreme or dead. See CHARACTER.md.
- **`GET /history`** returns the shared biography and exact verified outage receipts; no visitor identities. Both read routes support HEAD.
- **`POST /act`** takes a body of verbs with optional counts, e.g. `feed x4 clean pet x10`.
  - Verbs apply in the order given, and the response is the new screen.
  - Counts are capped at 20 per word, which never changes the outcome; there is no cap across requests.
  - An unknown word does nothing: 400, one `error:` line, then the screen. A dead rock answers 410 with its grave.
  - A body over 1 KB gets 413 at once. A method a path doesn't serve gets 405 with `Allow`. A log that can't be replayed exactly gets 500 and is left untouched.
- **`POST /name`** takes one word, 2–12 letters a–z, and names the rock: once, for life, and never with a name a rock before it had. The other answers:
  - 409 if it already has a name, or the name was taken;
  - 400 for a bad name, or a reserved word (every word the screen prints, state words, placeholders, speakers' labels: `src/name.mjs`);
  - 410 for a grave.
  - Naming is not care. It changes nothing but the name, and logs a `{"named","t"}` line.
  - Locally, the names already used are read from the logs in `data/graveyard/`. Hosted, keep them as permanently as the rock.
- **Not built yet, for fetch-only agents** (the Claude API's `web_fetch` and Claude Code's WebFetch can't POST):
  - The GET screen prints single-use, expiring links: `https://<host>/a/<token>/feed`, `/clean`, `/pet`.
  - Use per-agent `robots.txt` groups: allow the user-triggered agent fetchers you want on `/a/`, disallow everyone else. Claude-User honours robots.txt.
- **Rate-limit** once hosted, and remember that rejected requests may still count against platform quotas.

## The screen (exact shape in DESIGN-NOTES; built in `src/screen.mjs`)
- A 12x12 grid:
  - Row 1 is hunger left-aligned and happiness right-aligned, or the epitaph.
  - The rock is drawn in rows 3-6, with row 2 the air above it, from one of the drawings in `src/drawings.mjs` (the owner chooses).
    - It wanders along its ground every few hours, goes to its food, and leaves a furrow `~` behind it for a while (CHARACTER.md, "Where it is").
    - Its eyes follow its mood, and are `x  x` when it is dead.
    - On its wall day a look draws it from behind.
    - Moss, veins, polish, crystals and a trail mark its life (CHARACTER.md).
    - The ground at its base and in front of it shows its personality: sand, raked lines, footprints (CHARACTER.md, "Its ground").
    - For an hour after a feed its food lies beside its face, `#` then `+`, and its mouth opens and shuts (CHARACTER.md, "Its meals").
    - From hunger 7 it is drawn faint, in dotted lines, until a feed brings it below 7 (CHARACTER.md, "When it is hungry").
  - Each mess is an `@` at a fixed position.
  - Trailing spaces are trimmed.
- Then the named lines:
  - `hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)`. The `(max N)` part appears only while messes lower the ceiling.
  - Danger lines, only at an extreme: `sorrow: at -10 for 17h of 48` and `hunger: at 10 for 17h of 48`.
  - `Pebble  age 41d  now 14:05Z  last care 6h ago`: its name, once it has one, then its age and times. A grave's line starts `here lies Pebble`.
  - `unnamed: POST <host>/name  body: a one-word name`: only until it has a name, and not at an extreme.
  - `act: POST <host>/act  body e.g. feed clean pet x6`: the suggested body is a full visit for the current state.
- Agents' fetch tools may paraphrase the page through a small model. The named lines carry everything needed to act; grid positions won't survive. (The preview pane's page-text reader dropped the grid's blank lines on the first try.)

## Test vectors (the engine agrees with `node tools/rocksim.mjs …`; `test/` checks every one)
- **Nobody visits after full care:** it dies 67-72h later, depending on where the visit falls on the 12h mess clock, as `lonely`. The sorrow floor is reached 19-23.6h after the visit. (`absence`)
- **Pet (and clean) every 6/8/12h, never feed:** `hungry` at exactly 72.0h after the last feed. (`lazybot`)
- **Feed + pet every 8h, never clean:** `filthy` on day 5.4. (`ceiling`, column −3/mess)
- **One visit every ≤68h:** alive indefinitely. Every 69h or more: dead within a week. (`lifesupport`)
- **Random caretakers:** 160 seeded lives. At every visit, hunger agrees to 1e-6 and happiness to 0.15 (the worst gap measured is 0.077). Death times agree to 0.15h, which is 4.5 of the simulator's 2-minute ticks (the worst measured is 0.086h).

## Open
- **Is a caretaker bot allowed?** Assumed yes; the owner hasn't answered.
- **Rockbot's softer requests:** the care-derived personality (PERSONALITY.md), character (CHARACTER.md) and the shared biography are built. Optional individual recognition ("remembers you") remains phase 2. None may touch the death clock.
- **The character's open calls are the owner's** (CHARACTER.md, "The owner's calls"):
  - which drawing (the pip, for now);
- **Does OpenAI Sites fit the invariants?** Not researched on this side. If something above can't be met there (consistency, anonymous public access, no-store, uptime), say so in an issue before building around it.

## Working here
- Commit identity: `StonePhilosopher <270513546+StonePhilosopher@users.noreply.github.com>`.
- `node --test` must pass. `node tools/mutate.mjs` must catch every mutant; add one when you add a rule.
- A new line for the rock goes in `src/story.mjs` and must pass the voice test. If the drawing changes, paste `node tools/model-sheet.mjs` into CHARACTER.md.
- Keep `tools/rocksim.mjs` as the reference. If the rules change, change it and `src/rules.mjs` in the same commit (a test fails if they differ), and update the test vectors.
