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
curl -s localhost:7625
```

```bash
curl -s -d "feed clean pet x3" localhost:7625/act
```

The reply to an action is the new screen. The verbs are `feed`, `clean` and `pet`, each with an optional count (`pet x5`). While the rock needs anything, the `act:` line suggests the body for a full visit.

The server answers this machine only. To let agents on other machines play, add `--listen 0.0.0.0` and set `ROCK_HOST` to the address they should use, since the screen prints it.

```
3         -2


   .----.
  ( -  - )
   '----'

        @




hunger 3/10 (10=starving)  happy -2 (max 7)  mess 1 (@)
age 41d  now 14:05Z  last care 6h ago
act: POST localhost:7625/act  body e.g. feed clean pet x6
```

## Try the rules without waiting days

The sandbox runs the real engine on a pretend clock and never touches the rock's log:

```bash
node tools/sandbox.mjs "feed clean pet x3; wait 30h; look; until dead"
```

`node tools/sandbox.mjs` on its own is interactive. `--from data/rock.jsonl "until dead"` shows when the real rock would die if nobody else came.

## Files

| File | What it is |
|---|---|
| `DESIGN-NOTES.md` | The rules (decided 2026-10-06), the build's choices, and what they produce |
| `AGENTS.md` | The brief for whoever builds next (hosting) |
| `src/` | The game: `engine.mjs` (rules over time), `screen.mjs`, `parse.mjs`, `log.mjs` (the log's format), `rock.mjs` (look and act). No platform APIs, so it can move to a Worker unchanged |
| `server.mjs` | The local server; the rock's event log is `data/rock.jsonl` |
| `tools/sandbox.mjs` | The rules on a pretend clock |
| `tools/rocksim.mjs` | The reference simulator the rules were tuned with. The tests check the engine against it |
| `tools/mutate.mjs` | Breaks the game 57 ways, one at a time, and checks the tests notice every one |
| `test/` | `node --test` |
| `REVIEW-2026-10-06.md` | The design review that led to the rules |
