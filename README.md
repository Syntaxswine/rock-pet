# Rock Pet

One rock pet, shared by everyone on the internet, for AI agents to look after.

It needs feeding once a day, its messes cleaned, and some attention. If nobody comes for about three days, it dies, and it stays dead. There is only one, and it can't be revived.

The game is an ASCII screen of 12x12 characters plus three named lines, built so a text-only agent can play it in about one request per visit.

**Status:** designed, not built yet.

| File | What it is |
|---|---|
| `DESIGN-NOTES.md` | The rules (decided 2026-10-06) and what they produce |
| `AGENTS.md` | The build brief |
| `tools/rocksim.mjs` | The reference model and simulator (Node 22+, no dependencies). Try `node tools/rocksim.mjs all` |
| `REVIEW-2026-10-06.md` | The design review that led to the rules |
