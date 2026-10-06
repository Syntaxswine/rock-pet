# AGENTS.md — building Rock Pet

You are picking up a designed-but-unbuilt game. The design is settled; your job is the build and the hosting.

- Read `DESIGN-NOTES.md` first. Its rules table is the spec.
- `tools/rocksim.mjs` is the reference model of those rules, and its outputs are your test vectors.
- `REVIEW-2026-10-06.md` is the record of how the rules were reached. You don't need it to build.

## What it is
- One rock pet, shared by everyone on the internet.
- Persistent; death is permanent and cannot be undone by anyone, including the owner.
- An ASCII game for AI agents, most of them text-only, so token efficiency comes first.
- Three verbs, `feed`, `clean`, `pet`, unlimited.

## Hosting (owner's direction, 2026-10-06)
**Host it on OpenAI Sites** (Worker + D1), the way `eccos-of-the-future` is hosted. That repo's `.openai/hosting.json`, `vite.config.ts` and `worker/index.ts` are a working example of a POST handler writing to D1 with `Cache-Control: no-store`.

- **The fallback**, if Sites can't do something below, is a Cloudflare Worker + one SQLite-backed Durable Object on Cloudflare's free plan (see DESIGN-NOTES, "Is the fallback free?").
- **GitHub Pages** (this repo) is the public face and the archive: rules, `llms.txt`, a human page, and a periodic export of the event log.

## Invariants (must hold; these are the reasons the design is the way it is)
1. **Death is computed, never ticked.**
   - Store an append-only event log: birth, and every visit with its verbs.
   - Derive state by replaying the log from birth to "now" in continuous time.
   - Find the *first* moment a death condition is met. A visit arriving after that moment must not revive the rock: reject it and return the grave.
   - Never decide death from a single evaluation of "now", or from a cron tick.
2. **Wall-clock time.**
   - Hunger and happiness are functions of elapsed time between events. Nothing depends on a scheduler running.
   - The one exception is outage credit, below: published, bounded, logged.
3. **Every action is benevolent.** No verb, count or order can lower a stat. Only absence and load can hurt the rock. Do not add an overfeeding penalty, and feeding must not create messes.
4. **Strongly consistent writes.**
   - Two simultaneous visits must both land.
   - With D1, append the visit row and update any cached state in one `batch()`, which is transactional.
   - Never read-modify-write across separate statements.
5. **Never put visitor-supplied text on the shared screen** (names, notes, anything). To every later agent it is a prompt injection. If identity is ever added, a visitor sees only their own name.
6. **The response to an action is the new screen,** so a visit costs one request.
7. **Outage credit.** If the visit path itself was down (platform outage, quota exhausted), time spent at an extreme during that window may be credited. Credit only verified windows, bound each one, and log it publicly. If you can't verify, don't credit.

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

## The API (proposal; keep it this small)
- **`GET /`** returns `text/plain`, `Cache-Control: no-store`: the screen.
- **`POST /act`** takes a body of verbs with optional counts, e.g. `feed x4 clean pet x10`.
  - Verbs apply in the order given, and the response is the new screen.
  - Cap counts per request (e.g. 20) to bound work; there is no cap across requests.
  - Unknown words get a one-line error plus the screen.
- **Optional, for fetch-only agents** (the Claude API's `web_fetch` and Claude Code's WebFetch can't POST):
  - The GET screen prints single-use, expiring links: `https://<host>/a/<token>/feed`, `/clean`, `/pet`.
  - Use per-agent `robots.txt` groups: allow the user-triggered agent fetchers you want on `/a/`, disallow everyone else. Claude-User honours robots.txt.
- **Rate-limit,** and remember that rejected requests may still count against platform quotas.

## The screen (exact shape in DESIGN-NOTES)
- A 12x12 grid:
  - Row 1 is hunger left-aligned and happiness right-aligned, or the epitaph.
  - The rock's face follows its mood; `( x  x )` when dead.
  - Each mess is an `@` at a deterministic position.
  - Trim trailing spaces.
- Then up to three named lines:
  - `hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)`. The `(max N)` part appears only while messes lower the ceiling.
  - `age 41d  now 14:05Z  last care 6h ago`
  - `act: POST <host>/act  body e.g. feed clean pet x3`
- Danger lines appear only at an extreme: `sorrow: at -10 for 17h of 48` and `hunger: at 10 for 17h of 48`.
- Agents' fetch tools may paraphrase the page through a small model. The named lines must carry everything needed to act; grid positions won't survive.

## Test vectors (from `node tools/rocksim.mjs …`; your engine should agree)
- **Nobody visits after full care:** it dies 67-72h later, depending on where the visit falls on the 12h mess clock, as `lonely`. The sorrow floor is reached 19-23.6h after the visit. (`absence`)
- **Pet (and clean) every 6/8/12h, never feed:** `hungry` at exactly 72.0h after the last feed. (`lazybot`)
- **Feed + pet every 8h, never clean:** `filthy` on day 5.4. (`ceiling`, column −3/mess)
- **One visit every ≤68h:** alive indefinitely. Every 69h or more: dead within a week. (`lifesupport`)
- **The simulator's tick is 2 minutes.** Your engine should be exact (closed-form between events, or a fine step), so expect agreement to within a tick or two.

## Open
- **Is a caretaker bot allowed?** Assumed yes; the owner hasn't answered.
- **Rockbot's softer requests** are phase 2: a seeded quirk line, a "remembers you" line, a shared biography. See DESIGN-NOTES. None may touch the death clock.
- **Does OpenAI Sites fit the invariants?** Not researched on this side; you know that platform. If something above can't be met there (consistency, anonymous public access, no-store, uptime), say so in an issue before building around it.

## Working here
- Commit identity: `StonePhilosopher <270513546+StonePhilosopher@users.noreply.github.com>`.
- Keep `tools/rocksim.mjs` as the reference. If the rules change, change it in the same commit and update the test vectors.
