// CDP screenshot helper: node capture.mjs <name> <url> [light|dark]
import fs from 'node:fs';
import path from 'node:path';

const [name, url, theme] = [process.argv[2], process.argv[3], process.argv[4] || 'light'];
const OUT = import.meta.dirname;

async function getWsUrl() {
  const res = await fetch('http://127.0.0.1:9333/json/list');
  const list = await res.json();
  return list.find(t => t.type === 'page').webSocketDebuggerUrl;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const handlers = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      } else if (msg.method) handlers.forEach(h => h(msg));
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      onEvent(h) { handlers.push(h); },
      close() { ws.close(); },
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const probe = await fetch(url);
  if (!probe.ok) throw new Error('server not healthy: ' + probe.status);

  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  if (theme === 'dark') {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  }
  let loaded = false;
  cdp.onEvent(m => { if (m.method === 'Page.loadEventFired') loaded = true; });
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 80 && !loaded; i++) await sleep(250);
  await sleep(2000);
  if (theme === 'dark') {
    // next-themes: force dark class if the app stores preference
    await cdp.send('Runtime.evaluate', { expression: `document.documentElement.classList.add('dark')` });
    await sleep(600);
  }
  const info = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify({title: document.title, len: document.body.innerText.length})', returnByValue: true });
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(name, '->', file, info.result.value);
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });