// 帮助中心改版交互验证: node verify-help.mjs
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

async function waitFor(cdp, expression, timeout = 20000) {
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

const catBtn = (label) => `Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '${label}' && b.className.includes('flex-col'))`;

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: 'http://localhost:5000/help-center' });
  await waitFor(cdp, `(() => {
    const el = document.querySelector('input[placeholder="搜索问题..."]');
    if (!el) return false;
    const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
    return typeof el[k]?.onChange === 'function';
  })()`);
  const out = {};

  out.initial = await evalJs(cdp, `(() => ({
    categoryCards: ['快速入门','视频生成','素材管理','音频配音','账户与计费'].filter(t => Array.from(document.querySelectorAll('[data-slot=card-title]')).some(c => c.innerText.includes(t))).length,
    allTabGradient: getComputedStyle(${catBtn('全部')}).backgroundImage.includes('linear-gradient'),
    quickCards: ['新建剧本','素材管理','视频生成'].every(t => document.body.innerText.includes(t)),
    supportCard: document.body.innerText.includes('需要更多帮助？'),
  }))()`);

  // 分类切换
  await evalJs(cdp, `${catBtn('视频生成')}.click()`);
  await sleep(600);
  out.categoryFilter = await evalJs(cdp, `(() => ({
    onlyVideo: document.body.innerText.includes('视频生成需要多长时间') && !document.body.innerText.includes('如何创建我的第一个AI短剧项目'),
    activeGradient: getComputedStyle(${catBtn('视频生成')}).backgroundImage.includes('linear-gradient'),
  }))()`);
  await evalJs(cdp, `${catBtn('全部')}.click()`);
  await sleep(600);

  // 搜索
  const qCount = () => evalJs(cdp, `Array.from(document.querySelectorAll('button')).filter(b => /[?？]$/.test(b.innerText.trim())).length`);
  const before = await qCount();
  await evalJs(cdp, `(() => {
    const input = document.querySelector('input[placeholder="搜索问题..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '视频');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(600);
  const after = await qCount();
  out.search = { before, after, filtered: after < before && after > 0 };
  await evalJs(cdp, `(() => {
    const input = document.querySelector('input[placeholder="搜索问题..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(600);

  // 展开 FAQ + 投票
  await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('如何创建我的第一个AI短剧项目')).click()`);
  await sleep(600);
  out.accordion = await evalJs(cdp, `(() => ({
    answerVisible: document.body.innerText.includes('进入"项目管理"页面'),
    relatedShown: document.body.innerText.includes('相关教程：'),
  }))()`);
  await evalJs(cdp, `document.querySelector('button[aria-label="有用"]').click()`);
  await sleep(400);
  out.vote = await evalJs(cdp, `getComputedStyle(document.querySelector('button[aria-label="有用"]')).backgroundColor`);

  // 相关教程一键切视图
  await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('剧本创作技巧')).click()`);
  await sleep(700);
  out.relatedJump = await evalJs(cdp, `(() => ({
    activeView: document.querySelector('[role=tab][data-state=active]')?.innerText.trim(),
    tutorialsVisible: document.body.innerText.includes('工作流自动化'),
    resourceCard: document.body.innerText.includes('更多资源'),
  }))()`);

  console.log(JSON.stringify(out, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });