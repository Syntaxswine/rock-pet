// Offline operator tool. Stop the server, verify the host outage independently, then
// record its interval BEFORE reopening care. Never infer an outage from missing visits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { takeLock, releaseLock } from '../server.mjs';
import { parseLog, outageLine } from '../src/log.mjs';
import { creditOutage } from '../src/rock.mjs';

export function recordOutage(file, outage, now = Date.now()) {
  takeLock(file);
  try {
    const text = fs.readFileSync(file, 'utf8');
    const accepted = creditOutage(parseLog(text), outage, { now });
    fs.appendFileSync(file, (text.endsWith('\n') ? '' : '\n') + outageLine(accepted), { flush: true });
    return accepted;
  } finally { releaseLock(file); }
}

const isMain = import.meta.main ?? path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--dir', '--start', '--end', '--evidence'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error('use --dir DIR --start ISO-UTC --end ISO-UTC --evidence INCIDENT-ID');
      options[args[i]] = args[i + 1];
    }
    for (const key of ['--start', '--end']) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(options[key] ?? '')) throw new Error(`${key} needs an explicit UTC timestamp, e.g. 2026-10-06T12:00:00Z`);
      const canonical = options[key].includes('.') ? options[key] : options[key].replace('Z', '.000Z');
      if (!Number.isFinite(Date.parse(canonical)) || new Date(canonical).toISOString() !== canonical) throw new Error(`${key} is not a valid calendar date`);
    }
    const dir = path.resolve(options['--dir'] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
    const o = recordOutage(path.join(dir, 'rock.jsonl'), {
      start: Date.parse(options['--start']), end: Date.parse(options['--end']), evidence: options['--evidence'],
    });
    console.log(`credited ${o.end - o.start}ms of verified host downtime; evidence ${o.evidence}`);
  } catch (e) { console.error(`not credited: ${e.message}`); process.exitCode = 1; }
}
