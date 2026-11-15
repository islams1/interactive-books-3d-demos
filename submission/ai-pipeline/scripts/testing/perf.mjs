// node --experimental-websocket perf.mjs "<url>" [port]
// Opens the page in headless Chrome on the real GPU (ANGLE D3D11), waits for window.__perf, prints it.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2], port = +(process.argv[3] || 9333);
const prof = mkdtempSync(join(tmpdir(), 'perf_'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${process.argv[4] || '1280,720'}`,
  '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit=false', url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const call = (method, params = {}) => new Promise(res => { const my = ++id; const h = e => { const m = JSON.parse(e.data); if (m.id === my) { ws.removeEventListener('message', h); res(m.result); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: my, method, params })); });
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(500); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let out = null;
  for (let i = 0; i < 120 && !out; i++) {
    await sleep(1000);
    const r = await call('Runtime.evaluate', { expression: 'JSON.stringify(window.__perf || null)', returnByValue: true });
    if (r?.result?.value && r.result.value !== 'null') out = r.result.value;
  }
  console.log(out || 'no result');
} finally { ws?.close(); chrome.kill(); await sleep(800); try { rmSync(prof, { recursive: true, force: true }); } catch {} }
