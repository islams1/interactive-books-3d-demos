// node --experimental-websocket snap.mjs "<url>" "<ready expression>" <out.png> [extra wait ms]
// Headless Chrome: waits until the expression is truthy (the page finished loading / reached the state), then saves a screenshot.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, expr, out, extra] = [process.argv[2], process.argv[3], process.argv[4], +process.argv[5] || 1500], port = 9342;
const prof = mkdtempSync(join(tmpdir(), 'sn_'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const call = (method, params = {}) => new Promise(res => { const my = ++id; const h = e => { const m = JSON.parse(e.data); if (m.id === my) { ws.removeEventListener('message', h); res(m.result); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: my, method, params })); });
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(500); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let ok = false;
  for (let i = 0; i < 240 && !ok; i++) {
    await sleep(1000);
    const r = await call('Runtime.evaluate', { expression: `(()=>{ try { return !!(${expr}); } catch(e) { return false; } })()`, returnByValue: true });
    ok = r?.result?.value === true;
  }
  await sleep(extra);
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(ok ? 'saved' : 'saved (ready check never passed)', out);
} finally { ws?.close(); chrome.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }
