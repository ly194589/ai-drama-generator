// 文档中心交互验证: node verify-docs.mjs
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
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
      close() { ws.close(); },
    });
  });
}

async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: 'http://localhost:5000/docs' });
  await sleep(3000);

  const out = {};
  out.header = await evalJs(cdp, `(() => {
    const h1 = Array.from(document.querySelectorAll('h1')).find(e => e.innerText.includes('文档中心'));
    const cs = getComputedStyle(h1);
    return { text: h1.innerText.trim(), color: cs.color };
  })()`);

  // 水合闸门
  out.hydrated = await evalJs(cdp, `(() => {
    const el = document.querySelector('input');
    const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
    return typeof el[k]?.onChange === 'function';
  })()`);

  // 初始内容：快速开始 -> 介绍卡片，且无原始 markdown 标签泄露
  out.initial = await evalJs(cdp, `(() => ({
    firstCard: document.querySelector('[role=tabpanel] h3, [role=tabpanel] [data-slot=card-title]')?.innerText || document.body.innerText.includes('介绍'),
    rawTagLeak: document.body.innerText.includes('<code class='),
    rawHashLeak: document.body.innerText.includes('###'),
    preCount: document.querySelectorAll('pre').length,
  }))()`);

  // 真实鼠标点击「API 参考」Tab（Radix Tabs 监听 pointerdown）
  async function realClickTab(label) {
    const rect = await evalJs(cdp, `(() => {
      const tab = Array.from(document.querySelectorAll('[role=tab]')).find(t => t.innerText.includes('${label}'));
      const r = tab.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  }
  await realClickTab('API 参考');
  await sleep(800);
  out.afterTabClick = await evalJs(cdp, `(() => ({
    activeTab: document.querySelector('[role=tab][data-state=active]')?.innerText.trim(),
    hasAuthDoc: document.body.innerText.includes('API Key 认证'),
    preCount: document.querySelectorAll('pre').length,
    tableCount: document.querySelectorAll('table').length,
  }))()`);

  // 搜索 Docker（切到部署运维再搜应命中）
  await realClickTab('部署运维');
  await sleep(600);
  await evalJs(cdp, `(() => {
    const input = document.querySelector('input[placeholder="搜索文档..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Docker');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(800);
  out.search = await evalJs(cdp, `(() => ({
    resultHint: (document.body.innerText.match(/找到\\s*\\d+\\s*条匹配项/) || [null])[0],
    hasDockerCard: document.body.innerText.includes('docker-compose.yml'),
    preCount: document.querySelectorAll('pre').length,
  }))()`);

  console.log(JSON.stringify(out, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });