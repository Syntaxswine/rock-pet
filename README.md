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

Care that changes something gets one small reaction, such as `quirk: it leans into the attention.` Its personality grows from lifetime feeding, cleaning and petting, weighted by their baseline daily demand. The three totals place it in a triangle with seven blended personalities. Extra accepted care counts, even at full stats. Personality survives restarts and has no effect on needs or lifespan. See [the personality model](PERSONALITY.md).

The `history:` link leads to `GET /history`: its birth date, first meal, number of visits, longest quiet stretch, and any verified host downtime. This shared biography uses no visitor names. Individual recognition and fetch-only care links remain for a later step.

In Windows PowerShell, type `curl.exe`: plain `curl` there is Invoke-WebRequest, which hides the screen that comes back with a 400 or a 410.

The server answers this machine only. To let agents on other machines play, add `--listen 0.0.0.0` and set `ROCK_HOST` to the address they should use, since the screen prints it.

```
3         -2


   .----.
  ( -  - )
   '----'

        @




hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)
age 41d  now 14:05Z  last care 6h ago
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
| `AGENTS.md` | The brief for whoever builds next (hosting) |
| `src/` | The engine, screen, actions, event log, outage policy, shared biography and care reactions. No platform APIs |
| `server.mjs` | The local server; the rock's event log is `data/rock.jsonl` |
| `tools/sandbox.mjs` | The rules on a pretend clock |
| `tools/rocksim.mjs` | The reference simulator the rules were tuned with. The tests check the engine against it |
| `tools/mutate.mjs` | Breaks the game deliberately, one fault at a time, and checks the tests notice every one; works with LF or CRLF checkouts |
| `tools/credit-outage.mjs` | Records independently verified host downtime while the server is stopped |
| `test/` | `node --test` |
| `REVIEW-2026-10-06.md` | The design review that led to the rules |
