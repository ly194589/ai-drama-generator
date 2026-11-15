// 关于我们交互验证: node verify-about.mjs
import fs from 'node:fs';
import path from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  await sleep(3000);
}

async function realClick(cdp, selector, text) {
  const rect = await evalJs(cdp, `(() => {
    const el = Array.from(document.querySelectorAll('${selector}')).find(e => e.innerText.trim().includes('${text}'));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error('click target not found: ' + text);
  await sleep(300);
  const r2 = await evalJs(cdp, `(() => {
    const el = Array.from(document.querySelectorAll('${selector}')).find(e => e.innerText.trim().includes('${text}'));
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
}

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(cdp, 'http://localhost:5000/about');

  // 水合闸门：hero 的 /login 链接带 React props
  for (let i = 0; i < 20; i++) {
    const ok = await evalJs(cdp, `(() => {
      const el = document.querySelector('a[href="/login"]');
      if (!el) return false;
      const k = Object.keys(el).find(k => k.startsWith('__reactProps$'));
      return !!el[k];
    })()`);
    if (ok) break;
    await sleep(400);
  }

  const out = {};
  out.structure = await evalJs(cdp, `(() => {
    const hero = document.querySelector('section');
    const cs = getComputedStyle(hero);
    const chips = Array.from(document.querySelectorAll('#features .bg-gradient-to-br'));
    return {
      h1: document.querySelector('h1')?.innerText.trim(),
      heroGradient: cs.backgroundImage.includes('linear-gradient'),
      dotPattern: !!Array.from(hero.querySelectorAll('div')).find(d => (d.getAttribute('style') || '').includes('radial-gradient')),
      statCards: hero.querySelectorAll('.backdrop-blur-sm').length,
      featureCards: document.querySelectorAll('#features [data-slot=card]').length || document.querySelectorAll('#features h3').length,
      featureChipGradient: chips.length ? getComputedStyle(chips[0]).backgroundImage.includes('linear-gradient') : false,
      teamCards: document.querySelectorAll('#team h3').length,
      teamAvatarChar: document.querySelector('#team .rounded-2xl')?.innerText.trim(),
      valueCards: document.querySelectorAll('#values h3').length,
      milestoneCards: document.querySelectorAll('#milestones [data-slot=card]').length || document.querySelectorAll('#milestones h3').length,
      containerMargin: document.querySelector('section').getBoundingClientRect().x,
    };
  })()`);

  // 死链审计：所有内部 href 必须落在真实路由集合
  out.hrefAudit = await evalJs(cdp, `(() => {
    const known = ['/', '/login', '/docs', '/help-center', '/solution', '/about', '/drama', '/storyboard', '/images', '/videos', '/audio', '/settings', '/prompts', '/ai-advisor', '/workflow', '/editor', '/chat', '/profile', '/admin', '/config'];
    const bad = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (h.startsWith('mailto:') || h.startsWith('http')) return;
      const p = h.split('#')[0];
      if (p && !known.includes(p)) bad.push(h);
    });
    return { bad, total: document.querySelectorAll('a[href]').length };
  })()`);

  // 真实点击「认识核心团队」→ 平滑滚动到 team
  await realClick(cdp, 'button', '认识核心团队');
  await sleep(1200);
  out.scroll = await evalJs(cdp, `(() => ({
    scrollY: Math.round(window.scrollY),
    teamTop: Math.round(document.getElementById('team').getBoundingClientRect().top),
  }))()`);

  // 回顶部，真实点击 hero CTA → /login
  await evalJs(cdp, `window.scrollTo({ top: 0 })`);
  await sleep(500);
  await realClick(cdp, 'a', '立即免费体验');
  await sleep(1500);
  out.ctaNav = await evalJs(cdp, `location.pathname`);

  // 回 about，真实点击 footer「文档中心」→ /docs
  await goto(cdp, 'http://localhost:5000/about');
  await realClick(cdp, 'a', '文档中心');
  await sleep(1500);
  out.footerNav = await evalJs(cdp, `location.pathname`);

  // 整页截图 light
  await goto(cdp, 'http://localhost:5000/about');
  await sleep(1000);
  let shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, 'after-about2-light.png'), Buffer.from(shot.data, 'base64'));
  // dark
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await evalJs(cdp, `document.documentElement.classList.add('dark')`);
  await sleep(800);
  shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, 'after-about2-dark.png'), Buffer.from(shot.data, 'base64'));
  out.shots = ['after-about2-light.png', 'after-about2-dark.png'];

  console.log(JSON.stringify(out, null, 2));
  cdp.close();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });