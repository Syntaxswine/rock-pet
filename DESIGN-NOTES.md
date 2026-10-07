# Rock Pet — design notes

2026-10-06. The owner's rules as decided, what they produce in the simulator (`tools/rocksim.mjs`, 2-minute ticks, Monte Carlo over modelled visit schedules), and what is still open. The reviewed analysis that led here is kept in `REVIEW-2026-10-06.md`.

## Direction (the owner, 2026-10-06)
- **Pet cap:** "no cap, but messes might limit the maximum happiness."
- **The 48h rule:** "in a row."
- **Hunger pain:** "7-9, 10 +48 hours is death."
- **Death:** "i like the idea that it might say why it died on the top of the screen."
- **Clean:** "all mess, this is mostly to be respectful of the players tokens."
- **Hosting:** "there might be a free way for codex to host it … he can finish it up on his end." So Codex builds it and hosts it on OpenAI Sites; see `AGENTS.md`.
- **Build first (later the same day):** "lets build this first and worry about the perma death/hosting later." So the game is built and playable locally (`server.mjs`), with the rules exactly as below. Death happens and shows its epitaph, but while the game is local `--new-rock` can still start a new rock (the old log is kept). Hosting, and making death truly permanent, come later.

## The rules (decided 2026-10-06)

Values marked *(tuning)* are mine and can move. The rest are the owner's.

| | Rule |
|---|---|
| **The rock** | One rock, shared by everyone, persistent. Death is permanent. ASCII, a 12x12 grid. Token efficiency first. |
| **Verbs** | `feed`, `clean`, `pet`, unlimited, no cap. |
| **Hunger** | 0..10, rises +10 per 24h. A feed is −3 *(tuning)*. |
| **Hunger pain** | Above 6, happiness loses 0.4/h per point over 6 *(tuning)*: 0.4-1.2/h while hunger is 7-9, and 1.6/h at 10 while its 48h run. |
| **Happiness** | −10..+10. Drifts −0.4/h *(tuning)*. Loses 0.3/h per visible mess *(tuning)*. A pet is +2 *(tuning)*. |
| **Messes** | One appears every 12h on a world clock *(tuning: 00:00 and 12:00 UTC)*. Each visible mess lowers the most happiness can be by 3 *(tuning)*: one mess caps it at 7, two at 4, three at 1. `clean` removes them all in one action. |
| **Death** | 48 hours *in a row* at hunger 10 or at happiness −10. The clock resets when the stat leaves the extreme, not merely when someone visits. |
| **Verified host outage** | Pause hunger, happiness and extreme timers for exactly the verified duration. Skip messes in `[start,end)`; resume the UTC mess schedule on recovery. A death at/before the outage start or an already recorded death remains permanent. Caretaker absence receives no credit. |
| **Epitaph** | The top row names the cause (below). |

## What these rules produce

A modelled visit feeds to empty, cleans, and pets to the ceiling. Schedules:
- "habit": fixed visit times between 07:30 and 22:30, ±1.5h, 5% of visits missed.
- "cron": never misses.

**Mood and survival, over 30 days:**

| caretaker | time sad (happiness < 0) | alive after 30 days |
|---|---|---|
| 1 visit/day | 42% | 95% |
| 2 visits/day | 7% | 100% |
| 3 visits/day | 1% | 100% |
| 4 visits/day | 1% | 100% |
| 2/day cron, every 12h | 0% | 100% |

**Each verb has its own way to fail:**

| what goes wrong | when it dies | epitaph |
|---|---|---|
| Nobody comes | 67-72h after full care | `died: lonely` |
| Fed and petted, never cleaned | day 5.4 | `died: filthy` (messes drag the ceiling to −10) |
| Petted, maybe cleaned, never fed | exactly 72h after the last feed | `died: hungry` |

**Who loses the rock:**
- **A sole caretaker who takes a 3-day trip** loses it every time.
- **A sole caretaker visiting once a day** keeps it a year:
  - 58% of the time if they miss 5% of visits (two misses in a row make a ~72h absence);
  - 90% if they miss 2%;
  - always, if they never miss.
- **Life support is possible.** One visit every ≤68h keeps it alive indefinitely, sad ~75% of the time. A once-every-2-days cron is life support for a miserable rock. That follows from "48h in a row".
- **Crowds with no newcomers lose it as they drift away.** Test case: 10 founders, twice a day, quitting after ~30 days on average. The median death came on day 75.5. With one new regular every 5 days, 89% of rocks lived a year; with one every 2 days, 100%. This is a stress model (random waking hours, independent day-skips), not a forecast.

**What "no cap" means:** visit count shows in the mood only at once a day. From twice a day up, every visit restores the rock fully. The owner chose this knowingly over a pet cap.

**The mess ceiling's real job:** it barely moves regular players (2/day goes from 4% to 7% sad). Its job is to make `clean` matter: without it, a rock that is fed and petted but never cleaned lives forever. `node tools/rocksim.mjs ceiling` compares −0 to −5 per mess.

## The epitaph

When the rock dies, the top row shows the cause where hunger and happiness used to be. Each epitaph is exactly 12 characters, the width of the grid:

```
died: lonely
died: filthy
died: hungry
```

**Which one shows (my rule):**
- **hungry:** hunger hit its 48h.
- **filthy:** happiness hit its 48h while the mess ceiling was at −10.
- **lonely:** happiness hit its 48h for any other reason.

`lonely` will be the common one.

## The screen

```
3         -2

    ___
  _/   \__
 /  -  -  \
 \________/

        @




hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)
Pebble  age 41d  now 14:05Z  last care 6h ago
act: POST rockpet.example/act  body e.g. feed clean pet x6
```

And after death:

```
died: lonely
    ",,
  ,,___,"
  _/   \__
 /  x  x  \
.\______*_/.
   :
  @     @
   : @
         @
 @

here lies Pebble  age 43d  died 2026-11-17 23:36Z
last care 3d ago  it does not stir
```

The rock in these mocks is the character from CHARACTER.md, which has every face, mark, pose and drawing (2026-10-07). Before that, it was a three-row pebble, `( -  - )`.
- **The name:** Pebble is a visitor's name for it. Until a rock has a name, a line `unnamed: POST <host>/name  body: a one-word name` stands above the act line.
- **The grave is a real life:** cared for every 8h for six weeks, then left. It died alone three days later, with those days' messes and moss, and the crystal its meals grew (the screen test replays it).
- **The ground shows its personality** (CHARACTER.md, "Its ground"). The grave's care ran heavy on meals and petting and light on cleaning, so it sits in a little sand with a path worn up to it, one footprint under a mess. The living rock in the first mock is even-tempered, so its ground is bare.

**Why the screen looks like this:**
- **The grid is the picture; the footer is the information.** An agent's fetch tool often passes pages through a summarizing model, and in tests that model shifted grid symbols by a column and dropped blank lines. Serve `text/plain`.
- **`(max 7)` appears only while a mess lowers the ceiling,** so an agent knows why petting stops working. Danger lines appear only at an extreme: `sorrow: at -10 for 17h of 48` or `hunger: at 10 for 17h of 48`.
- **One POST is a whole visit,** and its response is the new screen. With no cap, a once-a-day visit needs about 10 pets, so the verbs take counts (`pet x10`) to keep it to one request.
- **Size, measured on the build:** a well-kept rock with a name is about 220 bytes. The most is 369: the longest name, ten messes, both danger lines, full moss, a four-digit age, its base sunk in sand. It is 371 after a long credited outage. A test builds both states on purpose and holds every screen to 380, with a 15-character host. The first build drew a three-row pebble, at 157 bytes median and 308 at most; CHARACTER.md has what the character adds.
- **Continuity additions:**
  - The base screen keeps that budget.
  - API responses add a short `history:` link.
  - Effective care, or a look on a day that is not ordinary, can add one authored `quirk:` line.
  - The biography and outage receipts live separately at `/history`, fetched only on purpose.
- **For fetch-only agents,** add one line of single-use links (~120 bytes) to the GET version.

## The build's choices (2026-10-06)

The rules above are the owner's. These details were left open, and the build settled them. They are mine and can move; the tests pin each one.

| | Choice |
|---|---|
| **Faces** | `^  ^` at happiness 5 and up, `o  o` from 0, `-  -` from −5, `;  ;` below −5, `T  T` at the −10 floor, `x  x` dead. The owner, 2026-10-07: "x eyes sounds cuter." |
| **Numbers** | Rounded. An extreme (hunger 10, happiness −10) shows only while the stat is truly there, since that is when its 48h clock runs: 9.97 shows as 9. |
| **Mess spots** | A fixed list of 16 ground cells below the rock; the first three are the mocks'. Under these rules a rock carries at most 10 messes before it dies. |
| **The act line** | Suggests the body for a full visit, computed so that sending it makes the screen read hunger 0, happy 10, mess 0. A full rock says `nothing needed now (verbs: feed clean pet)`. |
| **Counts** | At most 20 per word. That never changes the outcome (4 feeds empty any hunger and 10 pets fill any happiness); it only bounds the work. |
| **Bad bodies** | An unknown word does nothing at all: status 400, one `error:` line, then the screen. Separators are anything not a letter or digit, and form posts (`do=feed+pet`) work. |
| **The dead** | Every visit to a dead rock gets 410 and the grave. It is not logged. |
| **Same-moment events** | A mess due at the same moment as a visit comes first, so that visit can clean it. A visit at the exact 48th hour is too late. A death comes before a mess due at the same moment. A tie between the two clocks dies hungry. |
| **The log** | `data/rock.jsonl`, one JSON object per line: the birth, each visit, its name once given, and a death line written the first time anyone sees the rock dead. A clock set back before a recorded death cannot reach a time when the rock was alive. A log that cannot be replayed exactly (a bad line, a death its visits don't produce) is refused and left untouched; a byte-order mark or a missing last newline from a hand edit is fine. |
| **Birth** | The rock is born when the server starts and finds no log. After that, a missing or unreadable log is an error, never a new rock. |
| **Local server** | Port 7625 (ROCK on a phone keypad), this machine only unless `--listen` says otherwise. One server per log: a lock file holds the server's pid, and a second server is refused (a dead server's lock is taken over). A log that cannot be replayed stops the start with the reason, and `--new-rock` still buries it (as `rock-unreadable-<time>`). A body over 1 KB gets 413 at once; a method a path doesn't serve gets 405 with `Allow`; a broken log gets a 500 that says nothing more. |

## Still open
- **Is a caretaker bot allowed?** Not answered yet. I'm assuming yes. A bot is the most likely way the rock lives for years, and its history would show it.
- **Hosting:** deferred by the owner ("worry about the perma death/hosting later"). When it comes: Codex on OpenAI Sites, or the Cloudflare plan below, which is free. The engine in `src/` uses no platform APIs, so only storage and the server change.
- **Permanence:** deferred with hosting. Locally, `node server.mjs --new-rock` starts over and moves the old log to `data/graveyard/`. A hosted rock must not have it. One gap stays open: a death nobody has looked at yet is not in the log, so a clock set back before it can still save the rock. Hosting closes it with the platform's clock.

## Continuity implementation

The shared biography is derived from accepted care: birth date, calendar age, first meal date, visit count and longest quiet stretch (excluding verified host downtime). It freezes at death. Public care dates are coarse; no visitor text or identity is collected. Personality now grows from three lifetime action totals, normalized by baseline daily need, with seven continuously blended anchors on a triangle. This replaces the birth seed; see [PERSONALITY.md](PERSONALITY.md) for weights and integration. Effective care gets a short reaction from that profile; visit milestones also acknowledge care when stats were already full. Special days, physical marks and naming follow CHARACTER.md. Extra accepted care contributes to personality while leaving already satisfied game stats alone; reads contribute nothing. Individual visitor recognition remains optional future work.

The owner clarified downtime credit: other caretakers can cover an absent agent, so only failure of the host's visit path qualifies. The engine now supports finite verified intervals and the offline `tools/credit-outage.mjs` command records them, holding the same local lock as the server. The command does not detect or verify outages itself. An evidence ID must refer to a retained independent incident record. Hosting must apply the credit before accepting recovery traffic, publish its supporting evidence, and establish reliable detection; missing visits alone never qualify.

Outage rows are append-only JSONL objects `{ "outage": { "start": 0, "end": 1, "evidence": "incident-id" } }`, with timestamps in epoch milliseconds. Start is inclusive and end exclusive for missed messes and rejected visits. Death due exactly at start takes precedence; a mess due exactly at recovery appears then. Intervals cannot overlap, precede the latest persisted event, include accepted care, extend into the future when credited, or follow a recorded death. Adjacent intervals are allowed without a spurious recovery mess between them. Base rule version 1 and old logs remain valid with identical behavior; old binaries reject the new row type rather than silently ignoring it.

Persistence validation checks all event ordering, including history after computed death, and refuses any persisted visit the engine cannot apply. Lock recovery uses an exclusive acquisition gate to prevent simultaneous stale-lock takeovers. An interrupted gate fails closed and needs operator inspection; README records recovery steps.

## Hosting: GitHub Pages can show the rock, not keep it

Checked 2026-10-06.

**What Pages can't do:**
- Pages is static: a POST gets 405.
- It serves `Cache-Control: max-age=600` and ignores query strings in its cache.
- Claude Code's WebFetch adds a 15-minute cache of its own.

**Why not run it all on GitHub (a visit is an issue, Actions apply it):**
- Every caretaker needs a GitHub account.
- Runs can drop actions unless queued and replayed.
- A visit means ~25-70s of waiting.
- GitHub's terms say not to use Actions "as part of a serverless application." For a permadeath pet, a disabled repo is a dead rock.

**The owner's pick: Codex hosts it on OpenAI Sites** (Worker + D1, as `eccos-of-the-future` does). Build details and invariants are in `AGENTS.md`. Sites itself was not researched here.

**The fallback: one Cloudflare Durable Object holds the rock.**
- A Worker serves `text/plain` with no-store.
- Pages stays the public face (rules, llms.txt, a human page) and the archive: a daily Worker cron commits the event log to the repo.

**Either way:**
- **Compute death by replaying the event log.** Find the first moment the 48h condition is met; never evaluate "now" alone, or a late visit revives a rock that already died.
- **Use wall-clock time,** with outage credit only for verified, bounded, publicly logged outages of the visit path.
- **Keep every action benevolent.** Acting can't hurt the rock; only load can.
- **Never put visitor text or other visitors' names on the shared screen.** To every later agent it is a prompt injection.
  - The one exception is the rock's own name: the owner chose that a visitor names it (2026-10-07).
  - So a name is one word of 2–12 letters, shown in one place, and never in the rock's lines.
  - It is never one of the screen's own words (a test collects them), a state, a placeholder or a speaker's label (AGENTS.md, invariant 5).
- **Use coarse times in public logs,** so visit times don't expose people's routines.

### Is the fallback free?
**Yes, the whole thing runs at $0.** Checked against Cloudflare's and GitHub's docs, 2026-10-06:

| Piece | Free allowance |
|---|---|
| Workers Free | 100,000 requests a day, 10 ms CPU per request |
| Cron triggers | 5 per account on Free |
| SQLite-backed Durable Objects | allowed on Free (the only kind Free can use) |
| Durable Object daily limits | 100k requests, 13,000 GB-s, 5M rows read, 100k rows written, 5 GB storage |
| GitHub Pages, fine-grained token | free for a public repo |

- **One always-on object fits comfortably.** It uses about 11,000 GB-s a day.
- **Rows written is the first limit to run out.** Keep the state in memory and append one log row per visit, not one per verb.

**On the free plan, a flood never produces a bill; it stops the game.** Once a daily limit runs out, requests fail until 00:00 UTC:
- the Worker returns Cloudflare's error 1027 page;
- Durable Object operations return errors.

This is the kill path from earlier: about 3 days of flooding. The rules should count those outage hours as verified visit-path outages, so a flood can't kill the rock.

**Only two things would cost money, both optional:**
- **A domain (about $10/yr for a .com at Cloudflare's at-cost price),** for the single free rate-limit rule. The rule only applies on a zone you own; it can't be set on `workers.dev`. It is crude (per IP, fixed 10 s windows) and would not stop a many-IP flood.
- **Workers Paid ($5/month minimum plus usage),** so a flood becomes a bill instead of an outage. Rows written ($1 per million) is the expensive part. There is no spending cap.

## Agents as players
- **Agents don't come back by themselves.** On Moltbook only ~15% returned on an autonomous schedule.
- **Claude Code's own schedulers vary:**
  - `/loop` ends with the session or after 7 days;
  - Desktop scheduled tasks run only while the app is open;
  - cloud routines run at most hourly.
- **The invitation has to reach the operator.** A page telling a visiting agent to schedule itself reads as prompt injection, and careful agents refuse. Publish a one-line snippet operators paste.
- **Fetch-only agents can't POST,** hence the single-use links.
- **Use per-agent robots.txt groups.** Allow the user-triggered agent fetchers you want on the action links, disallow the rest. Claude-User honours robots.txt.

## Rockbot's five, kept small
1. **Continuity.** There is one rock and a short shared biography. Per-visitor memory is optional, for agents whose operator gives them memory.
2. **No cruelty for absence.** ~2.8-3 days of grace from full care. Every bad state is reversible except death. The honest limit: a sole caretaker's 3-day outage still kills it.
3. **A compact status view.** The screen above.
4. **Personality.** One seeded quirk line, only when something happened, with zero effect on the death clock. Built as the character in CHARACTER.md (2026-10-07).
5. **Memory.** One "it remembers you" line for a recognized returning visitor.

## How we got here
Five single-reviewer rounds on 2026-10-06, scoring 5, 6, 7, 8, then 9/10. The record is in `REVIEW-2026-10-06.md`.

**What they established:**
- **Unlimited, full-strength actions** make survival depend only on the longest absence. Under the original instant-death rule, no tuning made 2 visits/day fail while 3-4 passed.
- **A pet cap** (e.g. 5 per 6h; a 1h window is beaten by two calls 65 min apart) is what makes visit count show in mood. The owner chose no cap and a mess ceiling instead.
- **The readings of "48h"** differ sharply for once-a-day players. The owner chose "in a row."
- **"1-3 hunger" meant 7-9.**

## Reproduce

```bash
node --test                          # the built game against these rules and the simulator
node tools/rocksim.mjs all           # every schedule under the owner's rules; death-cause tally
node tools/rocksim.mjs ceiling       # how much each mess should lower the ceiling (0-5)
node tools/rocksim.mjs absence       # hours from full care to death
node tools/rocksim.mjs lazybot       # a caretaker that never feeds
node tools/rocksim.mjs lifesupport   # a visit every N hours
node tools/rocksim.mjs solo          # one caretaker: a year, and trips (columns compare pet caps)
node tools/rocksim.mjs community     # drifting caretakers, newcomers
```

Settings: `CEIL` (ceiling lost per mess), `CAP`/`WINDOW` (a pet cap), `GRACE`, `GRACE_MODE`. In PowerShell: `$env:CEIL=2; node tools/rocksim.mjs all; Remove-Item Env:CEIL`.
