export const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rock Pet</title><meta name="description" content="One shared ASCII rock. Type a little care.">
<link rel="stylesheet" href="/play.css"><script src="/play.js" defer></script></head>
<body><main><pre id="rock" aria-live="polite">looking for the rock...</pre>
<form id="terminal"><label for="command">&gt;</label><input id="command" name="command" aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus placeholder="look"></form>
<pre id="status" role="status"></pre><p class="help">F feed | C clean | P pet<br>Enter: type a command. Escape: return to hotkeys.<br>name &lt;one word&gt; | look | history | help<br>combine care: feed x4 clean pet x10</p>
<p class="help">display refreshes every 15 seconds while this tab is visible.<br>one shared rock. time passes even when nobody is here.<br>no automatic caretakers.</p>
<footer><a href="/">plain text API</a> &middot; <a href="/rules">rules</a> &middot; <a href="https://github.com/Syntaxswine/rock-pet">source</a></footer>
</main></body></html>`;

export const SCRIPT = String.raw`const rock=document.querySelector('#rock'), status=document.querySelector('#status'), input=document.querySelector('#command');
const HOTKEYS={f:'feed',c:'clean',p:'pet'};
let busy=false, phase='title', view='/', revision=0, refreshing=false;
async function visit(path='/', body) {
  if(busy)return; busy=true; revision++; input.disabled=true; status.textContent='';
  try {
    const response=await fetch(path,{method:body===undefined?'GET':'POST',body,cache:'no-store',headers:body===undefined?{}:{'Content-Type':'text/plain'}});
    const text=await response.text(), nextPhase=response.headers.get('x-rock-phase');
    if(nextPhase){view=path==='/history'?'/history':'/';phase=nextPhase;rock.textContent=text;input.placeholder=phase==='title'?'name <one word>':phase==='dead'?'history':'look';}
    else status.textContent=text;
    if(nextPhase&&!response.ok)status.textContent=response.status===410?'its story stays here.':'nothing was changed.';
  } catch {status.textContent='could not reach the rock. please try again.';}
  finally {busy=false;input.disabled=false;if(phase==='title')input.focus();else input.blur();}
}
// Background reads never disable the prompt, take focus, or submit care. A
// foreground command invalidates an older read so it cannot overwrite its reply.
async function refresh() {
  if(document.hidden||busy||refreshing)return;
  refreshing=true; const before=revision;
  try {
    const response=await fetch(view,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(10000)});
    const text=await response.text(), nextPhase=response.headers.get('x-rock-phase');
    if(!response.ok||before!==revision||document.hidden||!nextPhase)return;
    phase=nextPhase;
    if(rock.textContent!==text)rock.textContent=text;
    input.placeholder=phase==='title'?'name <one word>':phase==='dead'?'history':'look';
  } catch { /* Keep the last good screen; retry on the next interval. */ }
  finally {refreshing=false;}
}
setInterval(refresh,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
function command(text) {
  const value=text.trim();
  if(!value||value==='look')return visit();
  if(value==='history')return visit('/history');
  if(value==='help'){status.textContent='name <one word> starts its life, once.\nlook | history | feed | clean | pet\ncombine care: feed x4 clean pet x10';return;}
  if(/^name\s/i.test(value))return visit('/name',value.replace(/^name\s+/i,''));
  return visit('/act',HOTKEYS[value.toLowerCase()]??value);
}
document.querySelector('#terminal').addEventListener('submit',event=>{event.preventDefault();if(!busy){const value=input.value;input.value='';command(value);}});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){input.blur();return;}
  if(event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||document.activeElement===input)return;
  if(event.key==='Enter'){event.preventDefault();if(!busy)input.focus();return;}
  const verb=HOTKEYS[event.key.toLowerCase()];
  if(verb&&phase==='alive'){event.preventDefault();visit('/act',verb);}
});
visit();`;

export const STYLE = `:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f0e7;color:#343a30;font:14px/1.6 'Cascadia Mono',Consolas,monospace}main{max-width:740px;margin:0 auto;padding:40px 22px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 22px}form{display:flex;align-items:center;gap:12px;border-bottom:1px solid #9da88a;padding:8px 0}input{font:inherit;flex:1;min-width:0;border:0;background:transparent;color:inherit;outline-offset:5px}input:focus-visible{outline:1px solid #597439}input:disabled{opacity:.5}#status{margin-top:18px;min-height:22px}.help,footer{font-size:12px;color:#6a7162}a{color:inherit;text-underline-offset:4px}@media(max-width:480px){main{padding:24px 14px}body{font-size:12px}}`;

export const RULES_TEXT = `Rock Pet — one shared, persistent ASCII pet.

GET / — the current rock, plain text. GET /play — a keyboard command prompt.
POST /name — one word, 2–12 letters, only on the initial title screen.
The first valid name begins its life. No visitor can reset or replace it.
POST /act — plain text, e.g. feed x4 clean pet x10. Response: the new screen.
GET /history — its biography, grave, and verified outage receipts.

Hunger rises continuously by 10 per day. Feed removes 3.
Happiness drifts down 0.4 per hour, faster when hungry or surrounded by mess.
Pet adds 2 happiness. Clean removes all mess. Mess arrives at 00:00 and 12:00 UTC.
48 uninterrupted hours at hunger 10 or happiness -10 ends its life.
The clocks keep going when nobody visits. There is no pause on closing the page.
Every care action is benevolent. Its lifelong balance of care shapes its personality.
No automatic caretaker bots. Visit and choose to care; do not schedule care.

Host outages are distinct from visitor absence. Only independently verified,
completed downtime may receive equal credit, at most seven days per receipt.
Credit is operator-applied through deployment configuration, publicly logged in
/history, and cannot overlap accepted care or undo a recorded death.
Detection is not automatic. Missing visits never qualify as evidence.

No accounts, visitor names, or IP addresses are stored by the game. The hosting
provider may keep infrastructure logs. Care and the rock's name are permanent.
The shared API is limited to 600 requests per minute; rejected requests do no care.
Source and complete rules: https://github.com/Syntaxswine/rock-pet
`;
