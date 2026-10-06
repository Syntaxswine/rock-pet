// Rock Pet, served locally: one rock, whose event log is data/rock.jsonl (src/log.mjs has the
// format). No dependencies.
//
//   node server.mjs                   serve http://localhost:7625 to this machine only
//                                     (7625 is ROCK on a phone keypad)
//   node server.mjs --port 8000       another port
//   node server.mjs --listen 0.0.0.0  serve the local network too, and set ROCK_HOST to the
//                                     address agents should use: the screen prints it
//   node server.mjs --new-rock        move the current rock's log to data/graveyard/ and start
//                                     a new rock (only while permadeath waits for hosting)
//
//   GET /        the screen (text/plain, no-store)
//   POST /act    a body of verbs, e.g. "feed clean pet x3"; the reply is the new screen
//
// The rock is born when the server starts and finds no log. After that, a missing or unreadable
// log is an error, never a new rock.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { look, act } from './src/rock.mjs';
import { parseLog, birthLine, visitLine, deathLine } from './src/log.mjs';

const MAX_BODY = 1024; // bytes; a full visit is under 30
const BROKEN = "error: the rock's log could not be read. nothing was changed.\n";

export const readLog = file => parseLog(fs.readFileSync(file, 'utf8'));

/** Give birth to a rock in `file` if there is none yet. */
export function ensureRock(file, now) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, birthLine(now), { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
}

/**
 * An http.Server for the rock whose log is `file`. `host` is what the screen prints, `now` the
 * clock, and `onError` hears what went wrong (a client is only told that something did).
 */
export function createRockServer({ file, host, now = Date.now, onError = console.error }) {
  // One request's whole business with the log: read it, decide, append. It is synchronous, so
  // visits land one at a time and in time order.
  function withLog(decide) {
    const text = fs.readFileSync(file, 'utf8');
    const r = decide(parseLog(text), now());
    const lines = (r.visit ? visitLine(r.visit) : '') + (r.died ? deathLine(r.died) : '');
    if (lines) fs.appendFileSync(file, (text.endsWith('\n') ? '' : '\n') + lines);
    return r;
  }

  function handle(req, res) {
    const send = (status, text, headers = {}) => {
      if (res.headersSent) return;
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
      res.end(text);
    };
    const answer = (decide, headers) => {
      let r;
      try { r = withLog(decide); } catch (e) { onError(e); r = { status: 500, text: BROKEN }; }
      send(r.status, r.text, headers);
    };
    req.on('error', () => {});
    const route = (req.url ?? '/').split('?')[0]; // never parsed as a URL, so a malformed one cannot throw

    if (route === '/') {
      if (req.method === 'GET' || req.method === 'HEAD') return answer((log, t) => look(log, { now: t, host }));
      return send(405, 'error: GET / to see the rock; POST /act to care for it.\n', { allow: 'GET, HEAD' });
    }
    if (route === '/act' && req.method !== 'POST') {
      return answer((log, t) => {
        const r = look(log, { now: t, host });
        return { ...r, status: 405, text: `error: /act takes POST, with a body like "feed clean pet x3".\n${r.text}` };
      }, { allow: 'POST' });
    }
    if (route === '/act') {
      const chunks = [];
      let size = 0;
      req.on('data', c => {
        size += c.length;
        if (size <= MAX_BODY) return void chunks.push(c);
        // Over the limit: answer now and stop listening, rather than wait for a body that may
        // never end.
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.resume();
        send(413, `error: a body is at most ${MAX_BODY} bytes. nothing was done.\n`, { connection: 'close' });
      });
      req.on('end', () => answer((log, t) => act(log, Buffer.concat(chunks).toString('utf8'), { now: t, host })));
      return;
    }
    send(404, 'not here. GET / to see the rock; POST /act to care for it.\n');
  }

  return http.createServer((req, res) => {
    try { handle(req, res); } catch (e) {
      onError(e);
      if (!res.headersSent) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end(BROKEN); }
    }
  });
}

/**
 * Move the rock's log to graveyard/rock-<birth>.jsonl beside it, never over another; returns
 * where it went. Permadeath waits for hosting; until then this is the only way to a new rock.
 */
export function bury(file) {
  if (!fs.existsSync(file)) return null;
  const { born } = readLog(file);
  const grave = path.join(path.dirname(file), 'graveyard');
  fs.mkdirSync(grave, { recursive: true });
  const stem = `rock-${new Date(born).toISOString().replace(/[:.]/g, '-')}`;
  let to = path.join(grave, `${stem}.jsonl`);
  for (let n = 2; fs.existsSync(to); n++) to = path.join(grave, `${stem}-${n}.jsonl`);
  fs.renameSync(file, to);
  return to;
}

/** The command line (see the top of this file). Resolves to the listening server. */
export async function main(argv, { say = console.log } = {}) {
  const opt = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const port = Number(opt('--port') ?? process.env.PORT ?? 7625);
  const listen = opt('--listen') ?? '127.0.0.1';
  const dir = path.resolve(opt('--dir') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'data'));
  const file = path.join(dir, 'rock.jsonl');
  if (argv.includes('--new-rock')) {
    const to = bury(file);
    if (to) say(`the old rock's log is now ${to}`);
  }
  ensureRock(file, Date.now());
  const host = process.env.ROCK_HOST ?? `localhost:${port}`;
  const server = createRockServer({ file, host });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, listen, resolve); });
  say(`Rock Pet on http://${host}/  (log: ${file})`);
  return server;
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
