// 全站改版交互验证: node verify-redesign.mjs
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

async function goto(cdp, url) {
  await cdp.send('Page.navigate', { url });
  await sleep(3500);
}

async function waitFor(cdp, expression, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalJs(cdp, expression)) return true;
    await sleep(500);
  }
  throw new Error('waitFor timeout: ' + expression);
}

async function realClick(cdp, selectorExpr) {
  const rect = await evalJs(cdp, `(() => {
    const el = ${selectorExpr};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error('click target not found: ' + selectorExpr);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const out = {};

  // ===== 首页 =====
  await goto(cdp, 'http://localhost:5000/');
  await waitFor(cdp, `(() => {
    const el = document.querySelector('aside button');
    if (!el) return false;
    const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
    return typeof el[k]?.onClick === 'function';
  })()`);
  console.error('MARK home'); out.home = await evalJs(cdp, `(() => ({
    hydrated: (() => {
      const el = document.querySelector('aside button');
      const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
      return typeof el[k]?.onClick === 'function';
    })(),
    pipeline: document.body.innerText.includes('创作流水线'),
    pipelineSteps: ['剧本生成','分镜脚本','角色立绘','场景画面','配音配乐','成片合成'].every(t => document.body.innerText.includes(t)),
    onboarding: document.body.innerText.includes('登录后解锁创作仪表盘'),
    featureDescRendered: document.body.innerText.includes('AI自动生成完整剧本、分镜、角色设定'),
    sidebarBorder: (() => { const a = document.querySelector('aside'); return a ? getComputedStyle(a).borderRightWidth : null; })(),
    activeNavBg: (() => { const a = Array.from(document.querySelectorAll('aside a')).find(x => x.innerText.includes('首页')); return a ? getComputedStyle(a).backgroundColor : null; })(),
  }))()`);

  // 侧边栏折叠 → 展开
  await realClick(cdp, `document.querySelector('aside button')`);
  await sleep(600);
  console.error('MARK collapsed'); out.sidebarCollapsed = await evalJs(cdp, `(() => ({
    asideWidth: document.querySelector('aside').getBoundingClientRect().width,
    bodyClass: document.body.classList.contains('sidebar-collapsed'),
    mainPaddingLeft: getComputedStyle(document.querySelector('main')).paddingLeft,
  }))()`);
  await realClick(cdp, `document.querySelector('aside button')`);
  await sleep(600);
  console.error('MARK expanded'); out.sidebarExpanded = await evalJs(cdp, `(() => ({
    asideWidth: document.querySelector('aside').getBoundingClientRect().width,
    mainPaddingLeft: getComputedStyle(document.querySelector('main')).paddingLeft,
  }))()`);

  // 快捷操作导航（未登录应被守卫送到 /login）
  await realClick(cdp, `Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes('创建新剧本'))`);
  await sleep(3000);
  console.error('MARK nav'); out.quickActionNav = await evalJs(cdp, `location.pathname`);

  // ===== 帮助中心 =====
  await goto(cdp, 'http://localhost:5000/help-center');
  await waitFor(cdp, `!!document.querySelector('input[placeholder="搜索问题..."]')`);
  const faqCount = () => evalJs(cdp, `Array.from(document.querySelectorAll('button')).filter(b => /[?？]$/.test(b.innerText.trim())).length`);
  const before = await faqCount();
  await evalJs(cdp, `(() => {
    const input = document.querySelector('input[placeholder="搜索问题..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '视频');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(800);
  const after = await faqCount();
  console.error('MARK help'); out.helpSearch = { before, after, filtered: after < before && after > 0 };
  // 分类 chip 点击
  await realClick(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '视频生成' && b.className.includes('rounded-md'))`);
  await sleep(600);
  console.error('MARK helpcat'); out.helpCategory = await evalJs(cdp, `(() => {
    const chip = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '视频生成' && b.className.includes('rounded-md'));
    return { activeBg: getComputedStyle(chip).backgroundColor };
  })()`);

  // ===== 设置页 Tab =====
  await goto(cdp, 'http://localhost:5000/settings');
  await waitFor(cdp, `!!Array.from(document.querySelectorAll('[role=tab]')).find(t => t.innerText.includes('图文生成模型'))`);
  await realClick(cdp, `Array.from(document.querySelectorAll('[role=tab]')).find(t => t.innerText.includes('图文生成模型'))`);
  await sleep(800);
  console.error('MARK settings'); out.settingsTab = await evalJs(cdp, `(() => ({
    activeTab: document.querySelector('[role=tab][data-state=active]')?.innerText.trim(),
    headerTinted: !document.querySelector('h1').closest('.relative.overflow-hidden').className.includes('from-violet-500 via-purple-500'),
  }))()`);

  // ===== 登录页品牌色 =====
  await goto(cdp, 'http://localhost:5000/login');
  await waitFor(cdp, `!!Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '登录')`);
  console.error('MARK login'); out.loginBrand = await evalJs(cdp, `(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '登录');
    return { loginBtnBg: getComputedStyle(btn).backgroundColor };
  })()`);

  console.log(JSON.stringify(out, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });