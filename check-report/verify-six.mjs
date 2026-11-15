// 六页真实浏览器验证：settings / prompts / docs / about / solution / ai-advisor
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
  // hydration gate
  for (let i = 0; i < 40; i++) {
    const ok = await ev(cdp, `Object.keys(document.body).some(k => k.startsWith('__reactContainer'))`);
    if (ok) break;
    await sleep(250);
  }
  await sleep(1200);
}

async function clickSel(cdp, selector, index = 0) {
  const rect = await ev(cdp, `(() => {
    const els = document.querySelectorAll(${JSON.stringify(selector)});
    const el = els[${index}];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  })()`);
  if (!rect || rect.w === 0) return false;
  await sleep(250);
  const r2 = await ev(cdp, `(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
  await sleep(600);
  return true;
}

async function setInput(cdp, selector, value) {
  await ev(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(500);
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
  await sleep(500);
}

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 注入演示账号（应用内置 demo-user 管理员白名单），使受授权保护页面可访问
  await goto(cdp, BASE + '/login');
  await ev(cdp, `localStorage.setItem('user', JSON.stringify({ id: 'demo-user', name: '演示用户', email: 'demo@local.dev' }))`);

  // ---------- /settings ----------
  try {
    await goto(cdp, BASE + '/settings');
    const r = {};
    r.h1 = await ev(cdp, `document.querySelector('h1')?.textContent`);
    r.tabCount = await ev(cdp, `document.querySelectorAll('[role="tab"]').length`);
    r.activeGradient = await ev(cdp, `(() => {
      const t = document.querySelector('[role="tab"][data-state="active"]');
      return t ? t.className.includes('data-[state=active]:bg-gradient-to-r') : false;
    })()`);
    r.providerButtons = await ev(cdp, `document.querySelectorAll('[role="tabpanel"] button').length`);
    // 切换到「图像」tab（第 2 个）
    await clickSel(cdp, '[role="tab"]', 1);
    r.imageTabActive = await ev(cdp, `document.querySelectorAll('[role="tab"]')[1]?.getAttribute('data-state')`);
    r.sections = await ev(cdp, `['生成参数','当前配置','API 密钥状态','认证方式'].every(t => document.body.innerText.includes(t))`);
    r.summaryItems = await ev(cdp, `document.body.innerText.includes('文本模型') || document.body.innerText.includes('语言模型')`);
    await shot(cdp, 'six-settings-light');
    await setDark(cdp, true);
    await shot(cdp, 'six-settings-dark');
    await setDark(cdp, false);
    results.settings = r;
  } catch (e) { results.settings = { error: String(e.message || e) }; }

  // ---------- /prompts ----------
  try {
    await goto(cdp, BASE + '/prompts');
    const r = {};
    r.h1 = await ev(cdp, `document.querySelector('h1')?.textContent`);
    r.totalStat = await ev(cdp, `document.body.innerText.includes('24')`);
    r.cardCount = await ev(cdp, `document.querySelectorAll('.grid.grid-cols-1 > div').length`);
    // 搜索「钩子」
    await setInput(cdp, 'input[placeholder*="搜索提示词"]', '钩子');
    r.searchCount = await ev(cdp, `document.querySelectorAll('.grid.grid-cols-1 > div').length`);
    await setInput(cdp, 'input[placeholder*="搜索提示词"]', '');
    // 分类：配音配置（第 6 个 tab：all/system/character/script/video/voice）
    await clickSel(cdp, '[role="tab"]', 5);
    r.voiceCount = await ev(cdp, `document.querySelectorAll('.grid.grid-cols-1 > div').length`);
    r.voiceActive = await ev(cdp, `document.querySelectorAll('[role="tab"]')[5]?.getAttribute('data-state')`);
    await clickSel(cdp, '[role="tab"]', 0);
    // 收藏第一张卡
    await clickSel(cdp, '.grid.grid-cols-1 > div button', 0);
    r.favBadge = await ev(cdp, `document.body.innerText.includes('收藏 (1)')`);
    // 打开完整内容弹窗
    const opened = await ev(cdp, `(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('查看完整内容'));
      if (!btns[0]) return false;
      btns[0].scrollIntoView({ block: 'center' });
      return true;
    })()`);
    if (opened) {
      const rect = await ev(cdp, `(() => {
        const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('查看完整内容'));
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      await sleep(800);
    }
    r.dialogOpen = await ev(cdp, `!!document.querySelector('[role="dialog"]')`);
    r.dialogCopyBtn = await ev(cdp, `document.body.innerText.includes('复制提示词')`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);
    // 列表视图
    await clickSel(cdp, 'button[aria-label="列表视图"]');
    r.listView = await ev(cdp, `document.querySelectorAll('.space-y-3 > div').length > 0`);
    await clickSel(cdp, 'button[aria-label="网格视图"]');
    await shot(cdp, 'six-prompts-light');
    await setDark(cdp, true);
    await shot(cdp, 'six-prompts-dark');
    await setDark(cdp, false);
    results.prompts = r;
  } catch (e) { results.prompts = { error: String(e.message || e) }; }

  // ---------- /docs ----------
  try {
    await goto(cdp, BASE + '/docs');
    const r = {};
    r.tabCount = await ev(cdp, `document.querySelectorAll('[role="tab"]').length`);
    r.tabLabels = await ev(cdp, `[...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim())`);
    // 最佳实践（第 6 个）
    await clickSel(cdp, '[role="tab"]', 5);
    r.bestPractice = await ev(cdp, `document.body.innerText.includes('总裁的替身新娘') && document.body.innerText.includes('节奏锚点方法论')`);
    await shot(cdp, 'six-docs-bestpractice-light');
    // 常见问题（第 7 个）
    await clickSel(cdp, '[role="tab"]', 6);
    r.faq = await ev(cdp, `document.body.innerText.includes('如何保证AI生成的人物不换脸')`);
    r.faqCount = await ev(cdp, `[...document.querySelectorAll('button')].filter(b => b.textContent.includes('复制')).length`);
    // 回到快速入门并搜索
    await clickSel(cdp, '[role="tab"]', 0);
    await setInput(cdp, 'input[placeholder*="搜索"]', '界面');
    r.searchHit = await ev(cdp, `document.body.innerText.includes('界面导览')`);
    await setInput(cdp, 'input[placeholder*="搜索"]', '');
    await shot(cdp, 'six-docs-light');
    await setDark(cdp, true);
    await shot(cdp, 'six-docs-dark');
    await setDark(cdp, false);
    results.docs = r;
  } catch (e) { results.docs = { error: String(e.message || e) }; }

  // ---------- /about ----------
  try {
    await goto(cdp, BASE + '/about');
    const r = {};
    r.newSections = await ev(cdp, `['tech','partners','contact'].every(id => !!document.getElementById(id))`);
    r.techCards = await ev(cdp, `document.querySelectorAll('#tech .bg-gradient-to-br').length`);
    r.partnerChips = await ev(cdp, `document.querySelectorAll('#partners > div > div').length`);
    r.milestones = await ev(cdp, `document.querySelectorAll('#milestones [data-slot="badge"], #milestones .rounded-full').length`);
    r.milestoneYears = await ev(cdp, `document.body.innerText.includes('2026 Q3') && document.body.innerText.includes('插件生态开放')`);
    r.email = await ev(cdp, `document.body.innerText.includes('contact@aidrama.com')`);
    r.contactCards = await ev(cdp, `document.querySelectorAll('#contact a, #contact > div > div').length`);
    await shot(cdp, 'six-about-light', true);
    await setDark(cdp, true);
    await shot(cdp, 'six-about-dark', true);
    await setDark(cdp, false);
    results.about = r;
  } catch (e) { results.about = { error: String(e.message || e) }; }

  // ---------- /solution ----------
  try {
    await goto(cdp, BASE + '/solution');
    const r = {};
    r.newTestimonials = await ev(cdp, `['赵制片','陈运营','刘品牌'].every(n => document.body.innerText.includes(n))`);
    r.newUseCases = await ev(cdp, `document.body.innerText.includes('网文IP改编方') && document.body.innerText.includes('出海短剧团队')`);
    r.newPacks = await ev(cdp, `document.body.innerText.includes('音乐包·50次') && document.body.innerText.includes('剧本包·10次')`);
    r.newFaqs = await ev(cdp, `document.body.innerText.includes('当月额度没用完可以结转吗') && document.body.innerText.includes('支持开发票吗')`);
    r.faqTriggers = await ev(cdp, `document.querySelectorAll('[data-slot="accordion-trigger"], button[aria-expanded]').length`);
    await shot(cdp, 'six-solution-light', true);
    results.solution = r;
  } catch (e) { results.solution = { error: String(e.message || e) }; }

  // ---------- /ai-advisor ----------
  try {
    await goto(cdp, BASE + '/ai-advisor');
    const r = {};
    r.h1 = await ev(cdp, `document.querySelector('h1')?.textContent`);
    r.suggestionCount = await ev(cdp, `[...document.querySelectorAll('button')].filter(b => b.textContent.includes('？')).length`);
    r.sendGradient = await ev(cdp, `(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.querySelector('svg.lucide-send'));
      return b ? b.className.includes('from-violet-600') : false;
    })()`);
    r.sidebarVisible = await ev(cdp, `(() => {
      const a = document.querySelector('aside');
      return a ? getComputedStyle(a).display !== 'none' : false;
    })()`);
    // 点击第一个建议 → 无 .env 时预期出现错误气泡（客户端链路证明）
    const clicked = await ev(cdp, `(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('如何设计更强的开篇钩子'));
      if (!b) return false;
      b.scrollIntoView({ block: 'center' });
      return true;
    })()`);
    if (clicked) {
      const rect = await ev(cdp, `(() => {
        const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('如何设计更强的开篇钩子'));
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      await sleep(7000);
    }
    r.errorBubble = await ev(cdp, `document.body.innerText.includes('抱歉，发生了错误，请重试')`);
    r.anyAssistantBubble = await ev(cdp, `document.querySelectorAll('.rounded-2xl.bg-muted, .bg-muted .whitespace-pre-wrap').length`);
    await shot(cdp, 'six-advisor-light');
    await setDark(cdp, true);
    await shot(cdp, 'six-advisor-dark');
    await setDark(cdp, false);
    results.advisor = r;
  } catch (e) { results.advisor = { error: String(e.message || e) }; }

  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'six-results.json'), JSON.stringify(results, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });