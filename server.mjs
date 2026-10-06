// Rock Pet, served locally: one rock, whose event log is data/rock.jsonl (one JSON object per
// line: its birth, then each visit). No dependencies.
//
//   node server.mjs                serve on http://localhost:7625 (7625 is ROCK on a phone keypad)
//   node server.mjs --port 8000    another port; ROCK_HOST sets the host the screen prints
//   node server.mjs --new-rock     move the current rock's log to data/graveyard/, start a new rock
//
//   GET /        the screen (text/plain, no-store)
//   POST /act    a body of verbs, e.g. "feed clean pet x3"; the reply is the new screen

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { look, act, newLog } from './src/rock.mjs';

const MAX_BODY = 1024; // bytes; a full visit is under 30

/** The log in `file`, refusing anything it cannot read exactly. */
export function readLog(file) {
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim() !== '').map(l => JSON.parse(l));
  const [head, ...visits] = rows;
  if (typeof head?.born !== 'number') throw new Error('the first line is not a birth');
  for (const v of visits) if (typeof v?.t !== 'number' || !Array.isArray(v.acts)) throw new Error('a line is not a visit');
  return { born: head.born, rules: head.rules, visits };
}

// The rock in `file`; one is born now if there is none yet.
function rockIn(file, now) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const { visits, ...head } = newLog(now);
    try { fs.writeFileSync(file, JSON.stringify(head) + '\n', { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  return readLog(file);
}

/** An http.Server for the rock whose log is `file`. `host` is printed on the screen. */
export function createRockServer({ file, host, now = Date.now }) {
  return http.createServer((req, res) => {
    const send = ({ status, text }) => {
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(text);
    };
    // Anything that goes wrong reading the log leaves the log as it was.
    const guard = fn => {
      let r;
      try { r = fn(); } catch (e) {
        console.error(e);
        r = { status: 500, text: `error: the rock's log could not be read (${e.message}). nothing was changed.\n` };
      }
      send(r);
    };
    req.on('error', () => {});
    const { pathname } = new URL(req.url, 'http://localhost');

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/') {
      return guard(() => { const t = now(); return look(rockIn(file, t), { now: t, host }); });
    }
    if (req.method === 'POST' && pathname === '/act') {
      const chunks = [];
      let size = 0;
      req.on('data', c => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
      req.on('end', () => {
        if (size > MAX_BODY) return send({ status: 413, text: `error: a body is at most ${MAX_BODY} bytes. nothing was done.\n` });
        // Read, decide and append with no await in between, so visits land one at a time.
        guard(() => {
          const t = now();
          const r = act(rockIn(file, t), Buffer.concat(chunks).toString('utf8'), { now: t, host });
          if (r.visit) fs.appendFileSync(file, JSON.stringify(r.visit) + '\n');
          return r;
        });
      });
      return;
    }
    if (pathname === '/act') {
      return guard(() => {
        const t = now();
        const { text } = look(rockIn(file, t), { now: t, host });
        return { status: 405, text: `error: /act takes POST, with a body like "feed clean pet x3".\n${text}` };
      });
    }
    send({ status: 404, text: 'not here. GET / to see the rock; POST /act to care for it.\n' });
  });
}

// Permadeath waits for hosting; until then this is the only way to a new rock, and it keeps
// the old rock's log at data/graveyard/rock-<birth>.jsonl, never over another.
function bury(file) {
  if (!fs.existsSync(file)) return;
  const { born } = readLog(file);
  const grave = path.join(path.dirname(file), 'graveyard');
  fs.mkdirSync(grave, { recursive: true });
  const stem = `rock-${new Date(born).toISOString().replace(/[:.]/g, '-')}`;
  let to = path.join(grave, `${stem}.jsonl`);
  for (let n = 2; fs.existsSync(to); n++) to = path.join(grave, `${stem}-${n}.jsonl`);
  fs.renameSync(file, to);
  console.log(`the old rock's log is now ${to}`);
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const port = Number(opt('--port') ?? process.env.PORT ?? 7625);
  const dir = path.resolve(opt('--dir') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'data'));
  const file = path.join(dir, 'rock.jsonl');
  if (args.includes('--new-rock')) bury(file);
  rockIn(file, Date.now());
  const host = process.env.ROCK_HOST ?? `localhost:${port}`;
  createRockServer({ file, host }).listen(port, () => console.log(`Rock Pet on http://localhost:${port}/  (log: ${file})`));
}
