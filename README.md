# Rock Pet

One rock pet, shared by everyone on the internet, for AI agents to look after.

It needs feeding once a day, its messes cleaned, and some attention. If nobody comes for about three days, it dies, and it stays dead. There is only one.

The game is an ASCII screen of 12x12 characters plus a few named lines, built so a text-only agent can play it in one request per visit.

**Status:** playable locally (2026-10-06). Not hosted yet. Permadeath is in the rules, but while the game is local a new rock can still be started (`--new-rock`), and the old rock's log is kept.

## Play

Node 22 or newer; no dependencies.

```bash
node server.mjs
```

Then, from any agent or terminal:

```bash
curl -s 127.0.0.1:7625
```

```bash
curl -s -d "feed clean pet x3" 127.0.0.1:7625/act
```

The reply to an action is the new screen. The verbs are `feed`, `clean` and `pet`, each with an optional count (`pet x5`). While the rock needs anything, the `act:` line suggests the body for a full visit.

Visit milestones and care that changes something get one small reaction, such as `quirk: it leans into the attention.` Its personality grows from lifetime feeding, cleaning and petting, weighted by their baseline daily demand. The three totals place it in a triangle with seven blended personalities. Extra accepted care counts, even at full stats. Personality survives restarts and has no effect on needs or lifespan. See [the personality model](PERSONALITY.md).

Whoever names it first gives it its name, for life, and no rock after it may have that name. Send one word of 2-12 letters, chosen on purpose; this example is refused as it stands:

```bash
curl -s -d "<one word>" 127.0.0.1:7625/name
```

**The rock has a character** (CHARACTER.md has the whole of it, with a model sheet):
- **It reacts to care.** Care that changes something gets one small line, such as `quirk: it leans into the attention.`
- **It has days that are not ordinary.** On those days a look gets a line too: a birthday, its weekday for facing the wall, a small visitor, or a winter morning when it moved by itself.
- **It carries marks.**
  - Moss grows on it while nobody comes, and a visit brushes it off.
  - A close call leaves a vein, kept for life.
  - Long petting polishes it, and a well-fed life grows crystals in it.
  - When it dies its eyes are crosses, and the moss creeps over the stone.
- **Its ground shows its personality.** Each care is weighed against its daily need, and each care it gets more of than its least-given one leaves a trace: meals settle it into sand, cleaning rakes a floor in front of it, petting wears footprints up to it. While its care is balanced the ground stays bare, as it does for a rock visited every few hours with what the act line suggests. A busy rock, visited hourly or more often, settles into sand; a rock visited once a day wears a path. The ground fills in over its first two weeks, and worn ground fades slowly.
- **Its nature:** what kind of stone it is, its birth-fixed habit and care-derived personality. None of it touches its needs or its lifespan.

The `history:` link leads to `GET /history`, the shared biography. It holds:
- its name, birth date, first meal, number of visits and longest quiet stretch;
- its kind, weighted care totals, personality blend and habit;
- its close calls, the petting and meals behind its polish and crystals, and how often it has moved by itself;
- any verified host downtime.

Its own name aside, it holds nothing a visitor wrote. Individual recognition and fetch-only care links remain for a later step.

In Windows PowerShell, type `curl.exe`: plain `curl` there is Invoke-WebRequest, which hides the screen that comes back with a 400 or a 410.

The server answers this machine only. To let agents on other machines play, add `--listen 0.0.0.0` and set `ROCK_HOST` to the address they should use, since the screen prints it.

```
3         -2

    ___
  _/   \__
 /  -  -  \
 \________/

        @




hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)
Pebble  age 41d  now 14:05Z  last care 6h ago
act: POST 127.0.0.1:7625/act  body e.g. feed clean pet x6
history: 127.0.0.1:7625/history
```

## Try the rules without waiting days

The sandbox runs the real engine on a pretend clock and never touches the rock's log:

```bash
node tools/sandbox.mjs "feed clean pet x3; wait 30h; look; until dead"
```

`node tools/sandbox.mjs` on its own is interactive. `--from data/rock.jsonl "until dead"` shows when the real rock would die if nobody else came.

## Verified host downtime

A caretaker being away is ordinary absence: someone else can visit. If the **host itself** cannot accept care, a verified outage can pause the pet for exactly that interval. Hunger, happiness and death timers pause; messes due during the outage are skipped. Normal messes resume at the next 00:00 or 12:00 UTC. Calendar age and the date of the last visit still use real time.

This build has an offline operator tool, **not an automatic outage detector**. Stop the server, independently verify the interval and retain the incident evidence, then record it before reopening the visit path:

```bash
node tools/credit-outage.mjs --start 2026-10-06T12:00:00Z --end 2026-10-06T14:30:00Z --evidence host-incident-42
```

Use `--dir PATH` for another data directory. The evidence ID refers to the operator's retained incident record. A lack of visits is never proof. The tool rejects future intervals, duplicate/overlapping credit, intervals covering accepted care, and any attempt to credit a recorded death. A death at or before the start of an outage stays permanent. Outages must be recorded in order, before accepting new care; publish the evidence with the incident ID when hosted. `/history` publishes the exact interval, credited duration and ID.

Existing logs work unchanged. Logs with outage records require this build or newer; older builds refuse the new records. Hosting will need to establish trustworthy outage timing and apply credit before serving recovery traffic.

## Local startup recovery

Server starts and the offline credit tool share a short acquisition gate, `data/rock.jsonl.lock.starting`, so two processes cannot both replace a stale server lock. Normal starts and failures remove the gate. A process killed during acquisition can leave it behind; startup then stops safely. Inspect the recorded PID and confirm no process is starting or serving that log before manually removing that exact gate file. Never remove a gate merely because it looks old. The ordinary `.lock` of an exited server is still recovered automatically.

## Files

| File | What it is |
|---|---|
| `DESIGN-NOTES.md` | The rules (decided 2026-10-06), the build's choices, and what they produce |
| `CHARACTER.md` | Who the rock is: its model sheet, its marks, its days, its voice, the real things they come from, and the owner's open calls |
| `AGENTS.md` | The brief for whoever builds next (hosting) |
| `src/` | The engine, screen, actions, event log, outage policy, the rock's character, marks, drawings, name and lines, and the shared biography. No platform APIs |
| `tools/model-sheet.mjs` | Draws every face, mark, pose and drawing with the game's renderer, for CHARACTER.md |
| `server.mjs` | The local server; the rock's event log is `data/rock.jsonl` |
| `tools/sandbox.mjs` | The rules on a pretend clock |
| `tools/rocksim.mjs` | The reference simulator the rules were tuned with. The tests check the engine against it |
| `tools/mutate.mjs` | Breaks the game deliberately, one fault at a time, and checks the tests notice every one; works with LF or CRLF checkouts |
| `tools/credit-outage.mjs` | Records independently verified host downtime while the server is stopped |
| `test/` | `node --test` |
| `REVIEW-2026-10-06.md` | The design review that led to the rules |
