# Public hosting

The shared rock is at <https://rock-pet.vladimirs-lemons.chatgpt.site/>.
Humans can use the keyboard terminal at [/play](https://rock-pet.vladimirs-lemons.chatgpt.site/play):
F feeds, C cleans, P pets. Enter focuses the command prompt; Escape leaves it.
While typing a name or command, those letters never trigger care. Held keys do
not repeat care. There are no buttons.
The terminal refreshes its current rock/history display every 15 seconds while
visible, and when returning to the tab. Background reads preserve typing and
focus, never submit care, and cannot overwrite a newer command response. Failed
reads retain the last screen and retry; each read times out after ten seconds.
The plain-text root sends `Refresh: 15` for browser GET/HEAD requests (60 seconds
on errors). POST replies never request a refresh. Ordinary API clients still get
one plain-text response per request.
Browser document navigation at `/` opens the same ASCII keyboard terminal as
`/play`. This requires `Sec-Fetch-Dest: document` and `Accept: text/html`; simply
accepting HTML does not divert a text agent to a JavaScript shell. `/?view=text`
explicitly opens the plain text display in a browser. Responses vary by Accept
and Sec-Fetch-Dest and remain uncached.

The terminal asks for `application/json`: the usual reply plus a short timeline
of ASCII frames for the next 16 seconds. Existing journeys slide one column per
half second, retaining their established destination. A rare one-cell shuffle
can go left, right, up or down, holds for two seconds, then settles back. It only
happens while alive, comfortable, not eating, not resting from a journey, and
outside verified downtime. Vertical frames that would clip or cover a mess are
skipped. Needs and messes stay fixed; the rock, its marks and immediate ground
move together. These are display effects, never movement or care events.

Frames share the server's clock and are predicted from the latest accepted log;
care by another visitor is picked up at the next 15-second read.
An unpredicted journey that finished between reads gets one brief catch-up slide;
the first visit and journeys already in the preceding timeline do not replay.
The catch-up is presentation only and uses the current state. A local command
immediately cancels its pending frames. Hidden tabs cancel animation and fetch
fresh state on return; reduced-motion preferences get the normal settled view.
No per-frame network requests, care actions, timers in the engine, or changes to
stored movement history are involved. Animation timings and shuffle seeds are
display version 1 in `hosting/scene.mjs`.

The root remains plain text for agents. Links printed in that screen are relative
to this origin, keeping the original 390-byte screen and 450-byte reply bounds.

OpenAI Sites runs the Worker and provisions the `DB` D1 binding. It is independent
of a visitor's browser and this development computer. There is no timer process:
every request computes the elapsed wall-clock time from durable care. Closing
every browser does not pause any need. Deployment never creates or replaces a pet;
only the first successful `POST /name` starts its life.

## Storage and permanence

- `rock`: the one hot state row, a revision, and the latest observed platform time.
- `rock_events`: an append-only, ordered JSONL ledger of birth, name, accepted care,
  verified outages and the first observed death. Every event and state update is
  committed in the same D1 transaction.
- `rock_names`: the permanent birth/name ledger, independent of the hot state.
- `rock_limits`: the shared request budget, 600 game requests per minute.

Requests read the primary through a D1 session. A revision comparison and unique
write token guard the state update and its event inserts. Losing writers reread
and recompute; a failed transaction never acknowledges care. The clock cannot
move behind a committed observation. Recorded death is permanent. A missing hot
row with either ledger still present is an error, never another title screen.
There is no reset, burial, replacement, or credit HTTP endpoint.

Checkpoints preserve the engine, weighted care, ground, meal, biography and
movement after an accepted care timestamp. The newest millisecond's visits stay
uncompacted so simultaneous care retains the original order. Reads do not add care
or checkpoint the engine's floating-point flow. The complete event ledger remains
available to an operator for independent replay and recovery.

The application stores no visitor identity, IP address, or user text other than
the rock's constrained one-word name. Infrastructure logging belongs to the host.
Do not add caretaker bots. `/health` checks the database without looking at or
caring for the rock; a health probe must never call `/act` or `/name`.

## Verified outage recovery

Detection is **manual**, using independent provider incident records or external
probe records. Missing visitors are not evidence. Keep the evidence in a public
GitHub issue with a stable identifier that matches the receipt's `evidence` field.
This version does not promise automatic compensation for every provider failure.

1. Close care before recovery: set the Sites runtime variable
   `ROCK_MAINTENANCE=1` and deploy the saved version. All game and health requests
   then return 503; the human page may load but cannot perform care.
2. Establish the verified start and end in UTC milliseconds. Only completed
   intervals qualify, at most seven days per receipt. The interval must follow
   the latest accepted care/name/outage and cannot overlap a visit. A recorded
   death, or death at/before the outage start, cannot be reversed.
3. Set `ROCK_VERIFIED_OUTAGE` in Sites runtime configuration to JSON such as
   `{"start":1791540000000,"end":1791543600000,"evidence":"github-incident-123"}`.
   These are illustrative timestamps, not a real outage. Remove
   `ROCK_MAINTENANCE` and deploy. The first game request atomically commits the
   validated receipt before looking at or caring for the rock. Concurrent
   requests cannot duplicate the receipt. Invalid configuration fails closed.
4. Read `/history` to verify the public receipt. The evidence identifier, exact
   interval and equal credit are public. Then remove `ROCK_VERIFIED_OUTAGE` and
   redeploy; the permanent receipt stays in D1.

If the provider resumes serving before the operator gates recovery, accepted
care or a persisted grave can make credit ineligible. Do not rewrite those events
or resurrect the rock. Reliable independent detection and a recovery gate that
precedes provider auto-recovery remain an operational improvement.

## Build, check and publish

The local game remains `node server.mjs` and needs no packages. Hosting uses Node
24 and the pinned dependencies in `package-lock.json`.

```sh
npm ci
npm test
npm run mutate
npm run build
node tools/hosting-smoke.mjs
```

`node --test` includes the SQLite concurrency/transaction tests and exact
checkpoint-versus-ledger comparisons. The smoke test runs the built Worker in
Cloudflare's local runtime, uses actual D1, tests competing births and care, and
restarts the runtime to verify persistence. Its test database is removed in
`finally`; it never reaches the production site.

Schema edits go in `db/schema.ts`; `npm run db:generate` generates schema-only
Drizzle migrations. Sites applies those before uploading the Worker. Never
create/reset tables at request time, delete the database on deployment, or put
test births in a migration. Keep `.openai/hosting.json`'s project ID unchanged.

Publish with the Sites plugin's source/build/package workflow, saving and
deploying the exact pushed source. Reuse the existing Site. GitHub `main` is the
reviewable source; pushing to GitHub alone does not publish a Sites version.
Verify a successful native deployment plus anonymous GET `/`, `/play`, and
`/health`. Do not name the production rock as a smoke test.

The published entrypoint is `worker/index.ts`, a small standalone game Worker.
Vinext and its starter integration are used for Sites packaging; no React Server
Components or arbitrary image/ZIP processing endpoints are exposed. The current
dependency audit retains the unpatched `braces` nested-pattern advisory in the
Vinext build dependency chain. It processes repository build inputs, is absent
from the game Worker bundle, and is not exposed to visitor requests. Do not add
untrusted build inputs to that pipeline.

## Backups and recovery

Use the Sites database read/export tools or the provider's D1 backup facilities.
Export **all four tables**, retaining event sequence order, names, rules version
and checkpoint version. No scheduled export is configured by this change.
To recover a hot state, replay the `payload` values in `rock_events` ordered by
`seq`, compare the independently reconstructed screen/state, and restore under
maintenance. A lost ledger is never proof that the rock did not exist.

An owner-requested new generation after death requires a separate reviewed
storage/code operation that archives the old ledger and keeps all used names;
this release intentionally provides no such command or route.
