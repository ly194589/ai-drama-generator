// 清理+UX 改动的 headless Edge CDP 端到端验证
// 用法: node check-report/verify-cleanup.mjs  （需先 pnpm build && pnpm start）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const BASE = 'http://localhost:5000';
const OUT = path.resolve('check-report');
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const home = await fetch(BASE + '/');
if (home.status !== 200) { console.error('server not ready'); process.exit(1); }

const userDataDir = path.join(process.env.TEMP || '.', 'edge-cdp-cleanup-' + Date.now());
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find(t => t.type === 'page');
    if (target) break;
  } catch {}
  await new Promise(r => setTimeout(r, 500));
}
if (!target) { child.kill(); throw new Error('no CDP target'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
let mid = 0; const pending = new Map(); const consoleErrors = [];
let rscMode = 'off'; // off | block | delay —— CDP 网络层拦截 settings 的 RSC 请求
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  else if (m.method === 'Fetch.requestPaused') {
    const u = m.params.request.url;
    const rid = m.params.requestId;
    if (u.includes('settings') && u.includes('_rsc')) {
      if (rscMode === 'block') send('Fetch.failRequest', { requestId: rid, errorReason: 'Aborted' }).catch(() => {});
      else if (rscMode === 'delay') setTimeout(() => send('Fetch.continueRequest', { requestId: rid }).catch(() => {}), 6000);
      else send('Fetch.continueRequest', { requestId: rid }).catch(() => {});
    } else send('Fetch.continueRequest', { requestId: rid }).catch(() => {});
  }
  else if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || 'unknown');
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') consoleErrors.push(m.params.entry.text);
};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++mid; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const navigate = async (p) => { await send('Page.navigate', { url: BASE + p }); await sleep(2000); };
const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64')); console.log('saved', name); };
const rectOf = (sel, text) => evaluate(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); const el = ${text ? `els.find(e => e.textContent.includes(${JSON.stringify(text)}))` : 'els[0]'}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
const clickAt = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
const clickEl = async (sel, text) => { const r = await rectOf(sel, text); if (!r || r.w === 0) throw new Error('element not found: ' + sel + ' ' + (text || '')); await clickAt(r.x, r.y); await sleep(600); };
const waitProp = async (sel, prop) => {
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const k = Object.keys(el).find(k => k.startsWith('__reactProps$')); return !!(k && typeof el[k][${JSON.stringify(prop)}] === 'function'); })()`);
    if (ready) return true;
    await sleep(500);
  }
  return false;
};
const setQuery = (v) => evaluate(`(() => { const input = document.querySelector('input[placeholder="搜索问题..."]'); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(v)}); input.dispatchEvent(new Event('input', { bubbles: true })); return input.value; })()`);
const setDark = (on) => evaluate(`document.documentElement.classList.${on ? 'add' : 'remove'}('dark')`);

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

try {
  // A. 帮助中心空态（浅色）
  await navigate('/help-center');
  ok('help-center 水合', await waitProp('input[placeholder="搜索问题..."]', 'onChange'));
  await setQuery('xyz不存在的关键词');
  await sleep(600);
  const empty = await evaluate(`(() => { const d = [...document.querySelectorAll('div')].find(x => x.className.includes && x.className.includes('rounded-xl') && x.textContent.includes('未找到与')); return d ? { text: d.textContent.slice(0, 120), chips: [...d.querySelectorAll('button')].map(b => b.textContent.trim()) } : null; })()`);
  ok('空态回显关键词+推荐词', !!empty && empty.text.includes('xyz不存在的关键词') && ['剧本', '视频生成', '配音', '素材', '查看全部'].every(c => empty.chips.includes(c)), JSON.stringify(empty));
  ok('清空按钮出现', await evaluate(`!!document.querySelector('button[aria-label="清空搜索"]')`));
  await shot('cleanup-help-empty-light.png');

  // B. 点推荐词 chip → 出结果
  await clickEl('button.rounded-full', '剧本');
  const afterChip = await evaluate(`(() => ({ emptyGone: !document.body.textContent.includes('未找到与'), inputValue: document.querySelector('input[placeholder="搜索问题..."]').value }))()`);
  ok('推荐词点击生效', afterChip.emptyGone && afterChip.inputValue === '剧本', JSON.stringify(afterChip));

  // C. 点 X 清空 → 恢复全部
  await clickEl('button[aria-label="清空搜索"]');
  const afterClear = await evaluate(`(() => ({ value: document.querySelector('input[placeholder="搜索问题..."]').value, fullList: document.body.textContent.includes('账户与计费') }))()`);
  ok('清空按钮生效', afterClear.value === '' && afterClear.fullList, JSON.stringify(afterClear));

  // D. 深色空态
  await setDark(true);
  await setQuery('xyz不存在的关键词');
  await sleep(600);
  await shot('cleanup-help-empty-dark.png');
  ok('深色空态截图', await evaluate(`document.documentElement.classList.contains('dark') && document.body.textContent.includes('未找到与')`));
  await setDark(false);
  await setQuery('');
  await sleep(400);

  // E. 404 页
  await navigate('/nonexistent-page-xyz');
  await sleep(1000);
  const nf = await evaluate(`(() => ({ has404: document.body.textContent.includes('404'), btns: [...document.querySelectorAll('a')].map(a => a.textContent.trim()).filter(t => t === '返回首页' || t === '帮助中心') }))()`);
  ok('404 双按钮', nf.has404 && nf.btns.includes('返回首页') && nf.btns.includes('帮助中心'), JSON.stringify(nf));
  await shot('cleanup-404-light.png');
  await setDark(true); await sleep(300);
  await shot('cleanup-404-dark.png');
  await setDark(false);

  // F. 404 → 帮助中心 真实点击导航
  await clickEl('a', '帮助中心');
  await sleep(1500);
  ok('404 跳转帮助中心', await evaluate(`location.pathname`) === '/help-center');

  // G. 加载骨架：CDP 网络层先中止 settings 的 RSC 预取，点击导航时再延迟 6s
  // 起点用首页：help-center 是公开页未登录无侧边栏，首页属 OPTIONAL_AUTH 始终有侧边栏
  rscMode = 'block';
  await send('Fetch.enable', { patterns: [{ urlPattern: '*_rsc*', requestStage: 'Request' }] });
  await navigate('/');
  for (let i = 0; i < 30; i++) { if (await rectOf('a[href="/settings"]')) break; await sleep(500); }
  await sleep(1000); // 让预取请求先被中止
  rscMode = 'delay';
  await clickEl('a[href="/settings"]');
  const timeline = [];
  let skelShot = false;
  for (let i = 0; i < 16; i++) {
    const s = await evaluate(`(() => ({ path: location.pathname, skeletons: document.querySelectorAll('[data-slot="skeleton"]').length }))()`);
    timeline.push({ t: (i + 1) * 500, ...s });
    if (s.skeletons >= 5 && !skelShot) { await shot('cleanup-settings-skeleton.png'); skelShot = true; }
    if (s.path === '/settings' && s.skeletons === 0 && i > 4) break;
    await sleep(500);
  }
  console.log('skeleton timeline:', JSON.stringify(timeline));
  const peak = Math.max(...timeline.map(t => t.skeletons));
  ok('settings 骨架屏', peak >= 5, 'peak=' + peak + (skelShot ? ' (已截图)' : ''));
  if (!skelShot) await shot('cleanup-settings-skeleton.png');
  await sleep(3000);
  const loaded = await evaluate(`(() => ({ path: location.pathname, skeletons: document.querySelectorAll('[data-slot="skeleton"]').length, hasContent: document.body.textContent.includes('模型') }))()`);
  ok('骨架后真实页面接管', loaded.path === '/settings' && loaded.skeletons === 0 && loaded.hasContent, JSON.stringify(loaded));
  rscMode = 'off';
  await send('Fetch.disable');
  await shot('cleanup-settings-loaded-light.png');
} catch (err) {
  ok('执行异常', false, String(err && err.message || err));
}

const realErrors = consoleErrors.filter(t => !/favicon|fonts\.googleapis|net::ERR_|Failed to load resource|prefetch-blocked/i.test(t));
ok('无页面 JS 异常', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
fs.writeFileSync(path.join(OUT, 'cleanup-verify-results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
console.log('---'); console.log(`${results.filter(r => r.pass).length}/${results.length} passed`);
ws.close(); child.kill();
process.exit(results.every(r => r.pass) ? 0 : 1);