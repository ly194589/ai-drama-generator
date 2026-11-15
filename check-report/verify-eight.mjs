// 第八轮真实浏览器验证：自定义厂商在四个分类下均可配置 + 自定义端点真实分发
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

// 点击当前激活分类面板内的厂商卡片（按名称前缀匹配）
async function clickPanelTile(cdp, name) {
  const rect = await ev(cdp, `(() => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    if (!panel) return null;
    const el = [...panel.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(name)}) && b.textContent.includes('密钥'));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  })()`);
  if (!rect || rect.w === 0) return false;
  await sleep(250);
  const r2 = await ev(cdp, `(() => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    const el = [...panel.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(name)}) && b.textContent.includes('密钥'));
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await clickRect(cdp, r2);
  return true;
}

async function setInputScoped(cdp, selector, value) {
  return await ev(cdp, `(() => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    const el = panel && panel.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
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

const panelText = cdp => ev(cdp, `(() => {
  const el = document.querySelector('[role="tabpanel"][data-state="active"]');
  return el ? el.innerText : '';
})()`);

const toastTexts = cdp => ev(cdp, `[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent).join(' | ')`);

const HEADERS = { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' };

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 注入演示账号并清空旧的自定义模型清单
  await goto(cdp, BASE + '/login');
  await ev(cdp, `localStorage.setItem('user', JSON.stringify({ id: 'demo-user', name: '演示用户', email: 'demo@local.dev' }))`);
  await ev(cdp, `localStorage.setItem('userId', 'demo-user')`);
  await ev(cdp, `localStorage.removeItem('custom-models')`);

  await goto(cdp, BASE + '/settings');
  results.settingsLoaded = await ev(cdp, `document.body.innerText.includes('模型设置')`);

  const types = [
    { tab: 0, type: 'llm', id: 'custom-llm-e2e', note: '/chat/completions' },
    { tab: 1, type: 'image', id: 'custom-image-e2e', note: '/images/generations' },
    { tab: 2, type: 'video', id: 'custom-video-e2e', note: '暂未接入视频生成' },
    { tab: 3, type: 'tts', id: 'custom_voice_e2e', note: '/audio/speech' },
  ];

  // ---------- 四个分类逐一：自定义卡片 → 密钥表单 + 协议说明 + 自动展开添加表单 → 添加自定义模型 ----------
  for (const t of types) {
    await clickSel(cdp, '[role="tab"]', t.tab);
    await sleep(500);
    const tileExists = await ev(cdp, `(() => {
      const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
      return !!panel && [...panel.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('自定义') && b.textContent.includes('密钥'));
    })()`);
    const tileClicked = await clickPanelTile(cdp, '自定义');
    await sleep(800);
    const text = await panelText(cdp);
    const keyFormVisible = await ev(cdp, `!!document.querySelector('[role="tabpanel"][data-state="active"] input[placeholder="sk-..."]')`);
    const addFormAutoOpened = await ev(cdp, `!!document.querySelector('[role="tabpanel"][data-state="active"] input[placeholder^="输入"]')`);
    const typed = await setInputScoped(cdp, 'input[placeholder^="输入"]', t.id);
    const clicked = await clickButtonText(cdp, '添加并启用');
    let toast = '';
    for (let i = 0; i < 30; i++) {
      toast = await toastTexts(cdp);
      if (toast.includes('已生效')) break;
      await sleep(300);
    }
    await sleep(500);
    results[`tab_${t.type}`] = {
      tileExists,
      tileClicked,
      keyFormVisible,
      noteVisible: text.includes(t.note),
      addFormAutoOpened,
      typed, clicked,
      toastOk: toast.includes('已生效') && toast.includes(t.id),
      chip: await ev(cdp, `!!document.querySelector('button[title="启用 ${t.id}"]')`),
      selectShowsId: (await activeSelectText(cdp)).includes(t.id),
    };
  }

  // ---------- tts 分类：保存自定义端点密钥（指向本地模拟端点） ----------
  await clickSel(cdp, '[role="tab"]', 3);
  await sleep(400);
  const keyTyped = await setInputScoped(cdp, 'input[placeholder="sk-..."]', 'sk-e2e-custom-key-0001');
  const urlTyped = await setInputScoped(cdp, 'input[placeholder="https://your-endpoint/v1"]', 'http://127.0.0.1:5099/v1');
  const saveClicked = await clickButtonText(cdp, '保存密钥');
  let keyToast = '';
  for (let i = 0; i < 30; i++) {
    keyToast = await toastTexts(cdp);
    if (keyToast.includes('配置成功')) break;
    await sleep(300);
  }
  await sleep(800);
  const ttsText = await panelText(cdp);
  results.customKeySave = {
    keyTyped, urlTyped, saveClicked,
    toastOk: keyToast.includes('配置成功'),
    tileConfigured: ttsText.includes('密钥已配置'),
  };
  await shot(cdp, 'eight-tts-custom-light');

  // ---------- video 分类：能力边界提示截图 ----------
  await clickSel(cdp, '[role="tab"]', 2);
  await sleep(500);
  await shot(cdp, 'eight-video-custom-light');

  // ---------- 刷新后持久化：厂商选择 + 自定义模型 + 密钥状态 ----------
  await goto(cdp, BASE + '/settings');
  const persisted = {};
  for (const t of types) {
    await clickSel(cdp, '[role="tab"]', t.tab);
    await sleep(500);
    const sel = await activeSelectText(cdp);
    persisted[t.type] = {
      selectShowsId: sel.includes(t.id),
      chip: await ev(cdp, `!!document.querySelector('button[title="启用 ${t.id}"]')`),
      tileSelected: await ev(cdp, `(() => {
        const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
        const el = panel && [...panel.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('自定义') && b.textContent.includes('密钥'));
        return !!el && el.className.includes('border-primary');
      })()`),
    };
  }
  results.persistence = persisted;

  // ---------- 暗色截图 ----------
  await clickSel(cdp, '[role="tab"]', 2);
  await sleep(400);
  await setDark(cdp, true);
  await shot(cdp, 'eight-video-custom-dark');
  await clickSel(cdp, '[role="tab"]', 3);
  await sleep(400);
  await shot(cdp, 'eight-tts-custom-dark');
  await setDark(cdp, false);

  // ---------- 后端真实分发：自定义端点（本地模拟） ----------
  // TTS：/audio/speech（新实现的自定义配音分发）
  const audioRes = await fetch(BASE + '/api/audio/generate', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ text: '你好，这是一次自定义端点配音测试', speaker: 'custom_voice_e2e' }),
  });
  const audioJson = await audioRes.json().catch(() => ({}));
  results.dispatchTts = {
    status: audioRes.status,
    success: audioJson.success === true,
    solution: audioJson.solution,
    speaker: audioJson.speaker,
    audioUrlKind: typeof audioJson.audio?.audioUrl === 'string' ? audioJson.audio.audioUrl.slice(0, 30) : null,
    error: audioJson.error || null,
  };

  // LLM：/chat/completions（用户设置 llm_provider=custom 已持久化）
  const llmRes = await fetch(BASE + '/api/llm/invoke', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: false }),
  });
  const llmText = await llmRes.text();
  results.dispatchLlm = { status: llmRes.status, mockContentReturned: llmText.includes('mock ok'), preview: llmText.slice(0, 160) };

  // 图片：/images/generations
  const imgRes = await fetch(BASE + '/api/images/generate', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ prompt: '自定义端点图片测试' }),
  });
  const imgJson = await imgRes.json().catch(() => ({}));
  results.dispatchImage = {
    status: imgRes.status,
    success: imgJson.success === true,
    provider: imgJson.provider,
    imageUrl: imgJson.images?.[0]?.url || null,
    error: imgJson.error || null,
  };

  // 视频：自定义端点应明确拒绝（协议未接入，诚实提示）
  const vidRes = await fetch(BASE + '/api/videos/generate', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ prompt: '自定义端点视频测试' }),
  });
  const vidJson = await vidRes.json().catch(() => ({}));
  results.dispatchVideo = {
    status: vidRes.status,
    honestRejection: vidRes.status === 400 && String(vidJson.error || '').includes('自定义端点暂不支持视频生成'),
    error: vidJson.error || null,
  };

  // 模拟端点命中记录
  await sleep(500);
  const hits = JSON.parse(fs.readFileSync(path.join(OUT, 'mock-hits.json'), 'utf-8'));
  results.mockHits = hits.map(h => h.url);

  // ---------- 清理测试数据 ----------
  await ev(cdp, `localStorage.removeItem('custom-models')`);
  await fetch(BASE + '/api/providers/config?provider=custom', { method: 'DELETE', headers: HEADERS });
  await fetch(BASE + '/api/config', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({
      llm_provider: 'coze', image_provider: 'coze', video_provider: 'coze', tts_provider: 'coze',
      llm_model: 'doubao-seed-2-0-pro-260215', image_model: 'doubao-seedream-5-0-260128',
      video_model: 'doubao-seedance-2-0-260128', tts_speaker: 'zh_female_mizai_saturn_bigtts',
    }),
  });
  const storeFile = path.join(OUT, '..', '.data', 'server-config.json');
  if (fs.existsSync(storeFile)) fs.unlinkSync(storeFile);
  results.cleaned = !fs.existsSync(storeFile);

  fs.writeFileSync(path.join(OUT, 'eight-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });