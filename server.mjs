// Rock Pet, served locally: one rock, whose event log is data/rock.jsonl (src/log.mjs has the
// format). No dependencies.
//
//   node server.mjs                   serve http://127.0.0.1:7625 to this machine only
//                                     (7625 is ROCK on a phone keypad)
//   node server.mjs --port 8000       another port
//   node server.mjs --listen 0.0.0.0  serve the local network too, and set ROCK_HOST to the
//                                     address agents should use: the screen prints it
//   node server.mjs --new-rock        move the current rock's log to data/graveyard/ and start
//                                     a new rock (only while permadeath waits for hosting)
//
//   GET /        the screen (text/plain, no-store)
//   GET /history the shared biography and verified downtime receipts
//   POST /act    a body of verbs, e.g. "feed clean pet x3"; the reply is the new screen
//   POST /name   its name, one word, once (never one a rock in data/graveyard/ had)
//
// The rock is born when the server starts and finds no log. After that, a missing or unreadable
// log is an error, never a new rock.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { look, act, history, name } from './src/rock.mjs';
import { parseLog, birthLine, visitLine, deathLine, nameLine } from './src/log.mjs';

const MAX_BODY = 1024; // bytes; a full visit is under 30
const BROKEN = "error: the rock's log could not be read. nothing was changed.\n";

export const readLog = file => parseLog(fs.readFileSync(file, 'utf8'));

/**
 * The names the rocks in graveyard/ beside `file` had: a name is never given twice. Read line by
 * line, so a torn log still gives up its name.
 */
export function takenNames(file) {
  const grave = path.join(path.dirname(file), 'graveyard');
  let entries;
  try { entries = fs.readdirSync(grave, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const names = [];
  for (const f of entries.filter(e => e.isFile() && e.name.endsWith('.jsonl'))) { // bury() writes only these
    for (const line of fs.readFileSync(path.join(grave, f.name), 'utf8').split('\n')) {
      if (!line.includes('"named"')) continue;
      try { const row = JSON.parse(line); if (typeof row.named === 'string') names.push(row.named); } catch { /* torn */ }
    }
  }
  return names;
}

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
    const lines = (r.visit ? visitLine(r.visit) : '') + (r.named ? nameLine(r.named) : '') + (r.died ? deathLine(r.died) : '');
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
    // A POST body, then `then(text)`. Over MAX_BODY: 413 at once, and stop listening, rather than
    // wait for a body that may never end.
    const withBody = then => {
      const chunks = [];
      let size = 0;
      req.on('data', c => {
        size += c.length;
        if (size <= MAX_BODY) return void chunks.push(c);
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.resume();
        send(413, `error: a body is at most ${MAX_BODY} bytes. nothing was done.\n`, { connection: 'close' });
      });
      req.on('end', () => then(Buffer.concat(chunks).toString('utf8')));
    };
    req.on('error', () => {});
    const route = (req.url ?? '/').split('?')[0]; // never parsed as a URL, so a malformed one cannot throw

    if (route === '/history') {
      if (req.method === 'GET' || req.method === 'HEAD') return answer((log, t) => history(log, { now: t }));
      return send(405, 'error: GET /history to read the shared biography.\n', { allow: 'GET, HEAD' });
    }

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
    if (route === '/act') return withBody(body => answer((log, t) => act(log, body, { now: t, host })));
    if (route === '/name') {
      if (req.method !== 'POST') return send(405, 'error: POST /name with a one-word name. it is named once, for life.\n', { allow: 'POST' });
      return withBody(body => answer((log, t) => name(log, body, { now: t, host, taken: takenNames(file) })));
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
 * where it went. A log too broken to say when its rock was born is named for when it was
 * buried instead. Permadeath waits for hosting; until then this is the only way to a new rock.
 */
export function bury(file, now = Date.now()) {
  if (!fs.existsSync(file)) return null;
  let stem;
  try { stem = `rock-${new Date(readLog(file).born).toISOString()}`; } catch { stem = `rock-unreadable-${new Date(now).toISOString()}`; }
  stem = stem.replace(/[:.]/g, '-');
  const grave = path.join(path.dirname(file), 'graveyard');
  fs.mkdirSync(grave, { recursive: true });
  let to = path.join(grave, `${stem}.jsonl`);
  for (let n = 2; fs.existsSync(to); n++) to = path.join(grave, `${stem}-${n}.jsonl`);
  fs.renameSync(file, to);
  return to;
}

// One server per log: two would interleave their appends and break it. The lock holds the
// server's pid; a lock whose process is gone (a hard kill) is stale and taken over.
const lockOf = file => `${file}.lock`;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
export function takeLock(file) {
  // Serialize *all* acquisition/recovery. Without this gate two starters can read the
  // same stale PID and the second can unlink the first's newly acquired lock.
  // A crash while holding the gate fails closed; never guess that a gate is stale.
  const gate = `${lockOf(file)}.starting`;
  try { fs.writeFileSync(gate, String(process.pid), { flag: 'wx' }); }
  catch (e) {
    if (e.code === 'EEXIST') throw new Error(`another server is starting, or startup was interrupted: inspect ${gate}`);
    throw e;
  }
  try {
    for (;;) {
      try { return void fs.writeFileSync(lockOf(file), String(process.pid), { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
      const pid = Number(fs.readFileSync(lockOf(file), 'utf8'));
      if (pid > 0 && alive(pid)) throw new Error(`another server (pid ${pid}) is already serving ${file}`);
      fs.rmSync(lockOf(file), { force: true });
    }
  } finally { fs.rmSync(gate); }
}
export function releaseLock(file) {
  try { if (fs.readFileSync(lockOf(file), 'utf8') === String(process.pid)) fs.rmSync(lockOf(file)); } catch {}
}

/** The command line (see the top of this file). Resolves to the listening server. */
export async function main(argv, { say = console.log } = {}) {
  const opt = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const port = Number(opt('--port') ?? process.env.PORT ?? 7625);
  const listen = opt('--listen') ?? '127.0.0.1';
  const dir = path.resolve(opt('--dir') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'data'));
  const file = path.join(dir, 'rock.jsonl');
  // 127.0.0.1, not localhost: where localhost means ::1 first, some clients wait 2s per request.
  const host = process.env.ROCK_HOST ?? `127.0.0.1:${port}`;
  fs.mkdirSync(dir, { recursive: true });
  takeLock(file);
  const release = () => releaseLock(file);
  try {
    if (argv.includes('--new-rock')) {
      const to = bury(file);
      if (to) say(`the old rock's log is now ${to}`);
    }
    ensureRock(file, Date.now());
    look(readLog(file), { now: Date.now(), host }); // refuse to serve a log that cannot be replayed
    const server = createRockServer({ file, host });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, listen, resolve); });
    process.on('exit', release);
    server.on('close', () => { release(); process.off('exit', release); });
    say(`Rock Pet on http://${host}/  (log: ${file})`);
    return server;
  } catch (e) {
    release();
    throw e;
  }
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) {
  // Ctrl+C and kill run the exit handlers, which release the lock.
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.once(signal, () => process.exit(code));
  main(process.argv.slice(2)).catch(e => { console.error(`not serving: ${e.message}`); process.exit(1); });
}
