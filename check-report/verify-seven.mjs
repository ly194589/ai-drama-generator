// 第七轮真实浏览器验证：自定义模型添加/持久化/删除 + AI 顾问 NVIDIA 真实流式回复
import fs from 'node:fs';
import path from 'node:path';

const OUT = import.meta.dirname;
const BASE = 'http://localhost:5000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = {};

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

async function ev(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

async function goto(cdp, url) {
  let loaded = false;
  const h = m => { if (m.method === 'Page.loadEventFired') loaded = true; };
  cdp.onEvent(h);
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 100 && !loaded; i++) await sleep(200);
  for (let i = 0; i < 40; i++) {
    const ok = await ev(cdp, `Object.keys(document.body).some(k => k.startsWith('__reactContainer'))`);
    if (ok) break;
    await sleep(250);
  }
  await sleep(1500);
}

async function clickRect(cdp, rect) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await sleep(600);
}

async function clickSel(cdp, selector, index = 0) {
  const rect = await ev(cdp, `(() => {
    const els = document.querySelectorAll(${JSON.stringify(selector)});
    const el = els[${index}];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  })()`);
  if (!rect || rect.w === 0) return false;
  await sleep(250);
  const r2 = await ev(cdp, `(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await clickRect(cdp, r2);
  return true;
}

async function clickButtonText(cdp, text) {
  const rect = await ev(cdp, `(() => {
    const els = [...document.querySelectorAll('button')];
    const el = els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  })()`);
  if (!rect || rect.w === 0) return false;
  await sleep(250);
  const r2 = await ev(cdp, `(() => {
    const els = [...document.querySelectorAll('button')];
    const el = els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}));
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await clickRect(cdp, r2);
  return true;
}

async function setInput(cdp, selector, value) {
  await ev(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
}

async function shot(cdp, name, full = false) {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
  return file;
}

async function setDark(cdp, dark) {
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  await ev(cdp, `document.documentElement.classList.${dark ? 'add' : 'remove'}('dark')`);
  await sleep(600);
}

const activeSelectText = cdp => ev(cdp, `(() => {
  const el = document.querySelector('[role="tabpanel"][data-state="active"] [role="combobox"]');
  return el ? el.textContent : '';
})()`);

const toastTexts = cdp => ev(cdp, `[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent).join(' | ')`);

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 注入演示账号（应用内置 demo-user 管理员白名单）
  await goto(cdp, BASE + '/login');
  await ev(cdp, `localStorage.setItem('user', JSON.stringify({ id: 'demo-user', name: '演示用户', email: 'demo@local.dev' }))`);
  await ev(cdp, `localStorage.removeItem('custom-models')`);

  // ---------- /settings：四类模型逐一添加自定义模型 ----------
  await goto(cdp, BASE + '/settings');
  results.settingsLoaded = await ev(cdp, `document.body.innerText.includes('模型设置')`);
  let nvidiaOk = false;
  for (let i = 0; i < 20; i++) {
    nvidiaOk = await ev(cdp, `[...document.querySelectorAll('code')].some(c => c.textContent.startsWith('nvap'))`);
    if (nvidiaOk) break;
    await sleep(300);
  }
  results.nvidiaConfigured = nvidiaOk;

  const types = [
    { tab: 0, type: 'llm', id: 'custom-llm-e2e' },
    { tab: 1, type: 'image', id: 'custom-image-e2e' },
    { tab: 2, type: 'video', id: 'custom-video-e2e' },
    { tab: 3, type: 'tts', id: 'custom_voice_e2e' },
  ];

  for (const t of types) {
    await clickSel(cdp, '[role="tab"]', t.tab);
    await sleep(400);
    const opened = await clickButtonText(cdp, '添加自定义');
    await sleep(400);
    const typed = await setInput(cdp, 'input[placeholder^="输入"]', t.id);
    const clicked = await clickButtonText(cdp, '添加并启用');
    // 等待成功 toast
    let toast = '';
    for (let i = 0; i < 30; i++) {
      toast = await toastTexts(cdp);
      if (toast.includes('已生效')) break;
      await sleep(300);
    }
    await sleep(500);
    const chip = await ev(cdp, `!!document.querySelector('button[title="启用 ${t.id}"]')`);
    const selectText = await activeSelectText(cdp);
    results[`add_${t.type}`] = {
      opened, typed, clicked,
      toastOk: toast.includes('已生效') && toast.includes(t.id),
      toast: toast.slice(0, 120),
      chip,
      selectShowsId: selectText.includes(t.id),
    };
  }

  // 截图：llm tab，含自定义清单
  await clickSel(cdp, '[role="tab"]', 0);
  await sleep(400);
  await shot(cdp, 'seven-settings-light');

  // ---------- 刷新后持久化验证 ----------
  await goto(cdp, BASE + '/settings');
  const persistedSelect = await activeSelectText(cdp);
  const storedList = await ev(cdp, `localStorage.getItem('custom-models')`);
  results.persistence = {
    selectShowsId: persistedSelect.includes('custom-llm-e2e'),
    localList: storedList,
    chip: await ev(cdp, `!!document.querySelector('button[title="启用 custom-llm-e2e"]')`),
  };

  // ---------- 添加表单外观截图 ----------
  await clickButtonText(cdp, '添加自定义');
  await sleep(300);
  await setInput(cdp, 'input[placeholder^="输入"]', 'my-preview-model');
  await shot(cdp, 'seven-settings-addform-light');
  await clickSel(cdp, 'button[aria-label="取消添加"]');
  await sleep(300);

  // ---------- 删除自定义模型 → 回退到清单内模型 ----------
  await clickSel(cdp, 'button[aria-label="删除自定义模型 custom-llm-e2e"]');
  let delToast = '';
  for (let i = 0; i < 20; i++) {
    delToast = await toastTexts(cdp);
    if (delToast.includes('已删除')) break;
    await sleep(300);
  }
  await sleep(800);
  const afterDeleteSelect = await activeSelectText(cdp);
  results.delete = {
    toastOk: delToast.includes('已删除'),
    chipGone: await ev(cdp, `!document.querySelector('button[title="启用 custom-llm-e2e"]')`),
    fallbackToCatalog: afterDeleteSelect.includes('Doubao Seed 2.0 Pro'),
    selectText: afterDeleteSelect.slice(0, 80),
  };

  // 暗色截图（video tab，仍有自定义模型）
  await clickSel(cdp, '[role="tab"]', 2);
  await sleep(400);
  await setDark(cdp, true);
  await shot(cdp, 'seven-settings-dark');
  await setDark(cdp, false);

  // ---------- /ai-advisor：真实 NVIDIA 流式回复 ----------
  await goto(cdp, BASE + '/ai-advisor');
  results.advisorModelLabel = await ev(cdp, `document.body.innerText.includes('nvidia/nemotron-3-ultra-550b-a55b')`);
  const sent = await clickButtonText(cdp, '如何设计更强的开篇钩子？');
  let reply = '';
  let dots = 1;
  for (let i = 0; i < 240; i++) { // 最多 120s
    reply = await ev(cdp, `[...document.querySelectorAll('div.rounded-2xl.bg-muted p.whitespace-pre-wrap')].map(p => p.textContent).join('\\n')`);
    dots = await ev(cdp, `document.querySelectorAll('.animate-bounce').length`);
    if (reply.length > 30 && dots === 0) break;
    if (/模型调用失败|抱歉，发生了错误/.test(reply)) break;
    await sleep(500);
  }
  results.advisor = {
    sent,
    replyLength: reply.length,
    replyPreview: reply.slice(0, 150),
    isError: /模型调用失败|抱歉，发生了错误/.test(reply),
    realReply: reply.length > 30 && !/模型调用失败|抱歉，发生了错误/.test(reply),
    sessionInSidebar: await ev(cdp, `[...document.querySelectorAll('aside')].some(a => a.innerText.includes('如何设计更强的开篇钩子'))`),
  };
  await shot(cdp, 'seven-advisor-light');
  await setDark(cdp, true);
  await shot(cdp, 'seven-advisor-dark');
  await setDark(cdp, false);

  // 刷新后历史消息仍在（会话+消息持久化）
  await goto(cdp, BASE + '/ai-advisor');
  await sleep(1500);
  const reloadedReply = await ev(cdp, `[...document.querySelectorAll('div.rounded-2xl.bg-muted p.whitespace-pre-wrap')].map(p => p.textContent).join('\\n')`);
  results.advisorHistoryPersisted = reloadedReply.length > 30;

  fs.writeFileSync(path.join(OUT, 'seven-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });