// 真实浏览器验证：登录页表单 → 会话 Cookie → 进入首页（headless Edge + CDP）
// 用法: node check-report/verify-auth-login.mjs
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const env = Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8')
  .split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9334;

// 自管 dev server：工具调用结束会回收进程组，故由本脚本 spawn 并在结束时回收
const server = spawn(process.execPath, [join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--webpack', '--port', '5000'], {
  cwd: ROOT, env: { ...process.env, NODE_ENV: 'development' }, detached: true, stdio: 'ignore',
});
server.unref();
let serverUp = false;
for (let i = 0; i < 100; i++) {
  try { const r = await fetch('http://localhost:5000/api/health'); if (r.ok) { serverUp = true; break; } } catch {}
  await new Promise(r => setTimeout(r, 500));
}
if (!serverUp) { console.log('FAIL dev server 未就绪'); process.exit(1); }
console.log('PASS dev server 就绪');
const profile = mkdtempSync(join(tmpdir(), 'edge-auth-'));
const edge = spawn(EDGE, [`--headless=new`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Edge CDP not reachable');
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const ws = new WebSocket(await getWsUrl());
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5000/login' });

// 等待 hydration 完成（React props 挂到输入框）
let hydrated = false;
for (let i = 0; i < 60; i++) {
  hydrated = await evaluate(`(() => { const el = document.querySelector('input[placeholder="请输入用户名"]'); if (!el) return false; const k = Object.keys(el).find(k => k.startsWith('__reactProps$')); return !!(k && typeof el[k].onChange === 'function'); })()`);
  if (hydrated) break;
  await sleep(400);
}
check('登录页表单 hydration', hydrated === true);

const setVal = (placeholder, value) => evaluate(`(() => {
  const el = document.querySelector('input[placeholder="${placeholder}"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el.value;
})()`);
check('填入用户名', (await setVal('请输入用户名', env.LOCAL_ADMIN_USERNAME)) === env.LOCAL_ADMIN_USERNAME);
check('填入密码', (await setVal('请输入密码', env.LOCAL_ADMIN_PASSWORD)) === env.LOCAL_ADMIN_PASSWORD);

// 真实鼠标点击提交按钮
const rect = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '登录'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
check('找到登录按钮', !!rect);
if (rect) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}

let landed = null;
for (let i = 0; i < 40; i++) {
  landed = await evaluate(`(async () => { const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null); return { path: location.pathname, authed: !!(me && me.authenticated), user: me && me.user && me.user.id }; })()`);
  if (landed && landed.authed && landed.path !== '/login') break;
  await sleep(500);
}
check('登录后会话生效', !!(landed && landed.authed), JSON.stringify(landed));
check('离开登录页进入站点', !!(landed && landed.path !== '/login'), landed?.path);

// 等待侧栏异步认证状态落定（冷编译时 hydration 可能较慢），轮询断言 UI 登录态
let footer = null;
for (let i = 0; i < 40; i++) {
  footer = await evaluate(`(() => { const aside = document.querySelector('aside'); if (!aside) return null; const btns = [...aside.querySelectorAll('button')].map(b => b.textContent.trim()); return { hasLoginBtn: btns.includes('登录'), text: aside.innerText.slice(-120) }; })()`);
  if (footer && !footer.hasLoginBtn) break;
  await sleep(500);
}
check('侧栏显示已登录态（无登录按钮）', !!(footer && !footer.hasLoginBtn), JSON.stringify(footer));

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(ROOT, 'check-report', 'auth-login-after.png'), Buffer.from(shot.result.data, 'base64'));
check('登录后截图落盘', true, 'check-report/auth-login-after.png');

writeFileSync(join(ROOT, 'check-report', 'auth-e2e-results.json'), JSON.stringify({ api: 'see report', ui: results }, null, 2));
const failed = results.filter(r => !r.ok);
console.log(failed.length ? `${failed.length} FAILED` : `ALL ${results.length} PASS`);
ws.close(); edge.kill();
try { spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
process.exit(failed.length ? 1 : 0);