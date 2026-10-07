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
| `src/engine.mjs` | `replay(log, now)`: the rock's state at any moment from its event log, in continuous time, closed-form between events. Death is the first moment a 48h clock ran out. |
| `src/screen.mjs` | The 12x12 grid and the named lines. |
| `src/parse.mjs` | Action bodies such as `feed x4 clean pet x10`. |
| `src/log.mjs` | The log's format: the birth, each visit, and a death line once anyone has seen the rock dead. Parsing checks shape and refuses anything else. |
| `src/rock.mjs` | `look(log, {now, host})` and `act(log, body, {now, host})`: the HTTP status, the screen, and what to append to the log (an accepted action's `visit`; the `died` line the first time the rock is seen dead). |
| `server.mjs` | The local server, answering 127.0.0.1 only unless `--listen` says otherwise. The log is `data/rock.jsonl`, read and appended in one synchronous step per request, with a lock file so only one server serves a log. `--new-rock` starts over (local only). |
| `tools/sandbox.mjs` | The engine on a pretend clock. |
| `tools/mutate.mjs` | Breaks the game 77 ways, one at a time; the suite must catch every one, each by an assertion (it does). |

`src/` uses no platform APIs, so it should move to a Worker unchanged. Hosting means replacing `server.mjs`'s storage with the platform's and serving the same routes.

## Hosting (deferred; the owner's direction when it comes)
**Host it on OpenAI Sites** (Worker + D1), the way `eccos-of-the-future` is hosted. That repo's `.openai/hosting.json`, `vite.config.ts` and `worker/index.ts` are a working example of a POST handler writing to D1 with `Cache-Control: no-store`.

- **The fallback**, if Sites can't do something below, is a Cloudflare Worker + one SQLite-backed Durable Object on Cloudflare's free plan (see DESIGN-NOTES, "Is the fallback free?").
- **GitHub Pages** (this repo) is the public face and the archive: rules, `llms.txt`, a human page, and a periodic export of the event log.
- **Remove `--new-rock`** from anything hosted.
- **Keep the state, not just the log.** Every local request re-reads and replays the whole log, about 1 ms per 1,000 visits (measured in review round 2). That is fine for a local rock and wrong for a hosted one: keep the replayed state in the Durable Object (or a checkpoint row) and replay only what follows it.

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
   - Never read-modify-write across separate statements.
5. **Never put visitor-supplied text on the shared screen** (names, notes, anything). To every later agent it is a prompt injection. If identity is ever added, a visitor sees only their own name. [built: the host on the screen is configured, never the request's Host header; an error echoes only letters and digits, to the sender alone; a 500 says nothing about the error]
6. **The response to an action is the new screen,** so a visit costs one request. [built]
7. **Outage credit.** If the visit path itself was down (platform outage, quota exhausted), time spent at an extreme during that window may be credited. Credit only verified windows, bound each one, and log it publicly. If you can't verify, don't credit. [to do, with hosting]

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
- **`POST /act`** takes a body of verbs with optional counts, e.g. `feed x4 clean pet x10`.
  - Verbs apply in the order given, and the response is the new screen.
  - Counts are capped at 20 per word, which never changes the outcome; there is no cap across requests.
  - An unknown word does nothing: 400, one `error:` line, then the screen. A dead rock answers 410 with its grave.
  - A body over 1 KB gets 413 at once. A method a path doesn't serve gets 405 with `Allow`. A log that can't be replayed exactly gets 500 and is left untouched.
- **Not built yet, for fetch-only agents** (the Claude API's `web_fetch` and Claude Code's WebFetch can't POST):
  - The GET screen prints single-use, expiring links: `https://<host>/a/<token>/feed`, `/clean`, `/pet`.
  - Use per-agent `robots.txt` groups: allow the user-triggered agent fetchers you want on `/a/`, disallow everyone else. Claude-User honours robots.txt.
- **Rate-limit** once hosted, and remember that rejected requests may still count against platform quotas.

## The screen (exact shape in DESIGN-NOTES; built in `src/screen.mjs`)
- A 12x12 grid:
  - Row 1 is hunger left-aligned and happiness right-aligned, or the epitaph.
  - The rock's face follows its mood; `( x  x )` when dead.
  - Each mess is an `@` at a fixed position.
  - Trailing spaces are trimmed.
- Then the named lines:
  - `hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)`. The `(max N)` part appears only while messes lower the ceiling.
  - Danger lines, only at an extreme: `sorrow: at -10 for 17h of 48` and `hunger: at 10 for 17h of 48`.
  - `age 41d  now 14:05Z  last care 6h ago`
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
- **Rockbot's softer requests** are phase 2: a seeded quirk line, a "remembers you" line, a shared biography. See DESIGN-NOTES. None may touch the death clock.
- **Does OpenAI Sites fit the invariants?** Not researched on this side. If something above can't be met there (consistency, anonymous public access, no-store, uptime), say so in an issue before building around it.

## Working here
- Commit identity: `StonePhilosopher <270513546+StonePhilosopher@users.noreply.github.com>`.
- `node --test` must pass. `node tools/mutate.mjs` must catch every mutant; add one when you add a rule.
- Keep `tools/rocksim.mjs` as the reference. If the rules change, change it and `src/rules.mjs` in the same commit (a test fails if they differ), and update the test vectors.
