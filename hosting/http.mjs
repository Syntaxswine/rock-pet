import { operate, Busy } from './store.mjs';
import { PAGE, SCRIPT, STYLE, RULES_TEXT } from './page.mjs';

const HEADERS = {
  'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
const BROKEN = 'error: the rock is unavailable. please try again later.\n';

async function bodyOf(request) {
  if (Number(request.headers.get('content-length')) > 1024) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

export async function serve(request, env) {
  const route = new URL(request.url).pathname;
  // Browsers can refresh a plain-text document without adding HTML or scripts
  // to the agent API. Never refresh a POST response (which could repeat care).
  const refresh = route === '/' && ['GET', 'HEAD'].includes(request.method);
  const send = (text, status = 200, extra = {}) => new Response(request.method === 'HEAD' ? null : text, { status, headers: { ...HEADERS, ...(refresh ? { refresh: status >= 400 ? '60' : '15' } : {}), ...extra } });
  try {
    const read = request.method === 'GET' || request.method === 'HEAD';
    const staticFiles = {
      '/play': [PAGE, 'text/html; charset=utf-8'], '/play.js': [SCRIPT, 'text/javascript; charset=utf-8'],
      '/play.css': [STYLE, 'text/css; charset=utf-8'], '/rules': [RULES_TEXT, HEADERS['content-type']],
      '/llms.txt': [RULES_TEXT, HEADERS['content-type']],
      '/robots.txt': ['User-agent: *\nDisallow: /act\nDisallow: /name\n', HEADERS['content-type']],
    };
    if (Object.hasOwn(staticFiles, route)) {
      if (!read) return send('error: use GET or HEAD.\n', 405, { allow: 'GET, HEAD' });
      return send(staticFiles[route][0], 200, { 'content-type': staticFiles[route][1] });
    }
    if (!['/', '/history', '/act', '/name', '/health'].includes(route)) return send('error: GET / for the rock; /play for a keyboard prompt.\n', 404);
    const write = route === '/act' || route === '/name';
    if (write ? request.method !== 'POST' : !read) return send('error: method not allowed.\n', 405, { allow: write ? 'POST' : 'GET, HEAD' });
    if (env.ROCK_MAINTENANCE === '1') return send('the host is under maintenance. care is closed pending verification.\n', 503, { 'retry-after': '60' });
    if (route === '/health') {
      await env.DB.withSession('first-primary').prepare('SELECT id FROM rock LIMIT 1').first();
      return send('ok\n'); // Never looks at, feeds, or otherwise cares for the pet.
    }
    const body = write ? await bodyOf(request) : '';
    if (body === null) return send('error: body exceeds 1024 bytes.\n', 413);
    const outage = env.ROCK_VERIFIED_OUTAGE ? JSON.parse(env.ROCK_VERIFIED_OUTAGE) : undefined;
    const result = await operate(env.DB, route, body, { outage });
    return send(result.text, result.status, { 'x-rock-phase': result.phase });
  } catch (error) {
    if (error instanceof Busy) return send('error: busy; please try again shortly.\n', error.message === 'rate' ? 429 : 503, { 'retry-after': '10' });
    console.error('rock request failed', error instanceof Error ? error.message : 'unknown');
    return send(BROKEN, 503);
  }
}
