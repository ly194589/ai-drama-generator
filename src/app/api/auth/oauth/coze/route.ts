import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * 扣子 OAuth 登录入口
 * 
 * 支持两种模式：
 * 1. 系统级OAuth应用（推荐）：配置 OAUTH_CLIENT_ID 环境变量，用户无需创建应用
 * 2. 用户自定义OAuth应用：用户传入 client_id 参数
 * 
 * 支持：移动端/PC 桌面端/单页面应用（PKCE模式，推荐）
 *      Web 后端应用（授权码模式）
 */

function getBaseUrl(request: NextRequest): string {
  if (process.env.COZE_PROJECT_DOMAIN_DEFAULT) {
    return process.env.COZE_PROJECT_DOMAIN_DEFAULT;
  }
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  if (host) {
    return `${protocol}://${host}`;
  }
  // 生产环境使用配置的域名，开发环境 fallback 到 localhost
  if (process.env.COZE_PROJECT_DOMAIN_DEFAULT) {
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
    return domain.startsWith('http') ? domain : `https://${domain}`;
  }
  return 'http://localhost:5000';
}

function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomBytes = crypto.randomBytes(64);
  for (let i = 0; i < 64; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirect_to = searchParams.get('redirect_to') || '/';
    const mode = searchParams.get('mode') || 'bind'; // bind | login
    const stateParam = searchParams.get('state'); // 前端传来的state参数
    
    // 解析前端传来的state参数
    let currentUserId = '';
    let stateData: Record<string, string | number> = {
      redirect_to,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7),
      mode,
    };
    
    if (stateParam) {
      try {
        const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
        currentUserId = parsed.current_user_id || '';
        stateData = { ...stateData, ...parsed };
      } catch {
        // ignore
      }
    }
    
    // 优先使用系统级OAuth配置
    const systemClientId = process.env.OAUTH_CLIENT_ID;
    const systemClientSecret = process.env.OAUTH_CLIENT_SECRET;
    // 系统级OAuth应用类型：'pkce'（移动端/SPA）或 'code'（Web后端）
    const systemClientType = process.env.OAUTH_CLIENT_TYPE || 'pkce';
    
    // 用户传入的参数（可选）
    const clientId = searchParams.get('client_id') || systemClientId;
    const clientSecret = searchParams.get('client_secret') || systemClientSecret;
    const clientType = searchParams.get('client_type') || systemClientType;
    
    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/api/auth/oauth/coze/callback`;

    // 如果没有任何 client_id，显示配置页面
    if (!clientId) {
      return showConfigPage(redirectUri, redirect_to, mode);
    }

    console.log('[OAuth] client_id:', clientId, 'clientType:', clientType, 'hasSecret:', !!clientSecret);

    // PKCE 模式（移动端/SPA应用）
    if (clientType === 'pkce') {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      // 合并state数据
      const finalState = Buffer.from(JSON.stringify({
        ...stateData,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_type: 'pkce',
        current_user_id: currentUserId,
      })).toString('base64url');

      const authUrl = new URL('https://www.coze.cn/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', finalState);
      // 使用更广泛的权限范围
      authUrl.searchParams.set('scope', 'user:read bot:read');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      console.log('[OAuth PKCE] client_id:', clientId, 'mode:', mode, 'currentUserId:', currentUserId);
      
      return NextResponse.redirect(authUrl.toString());
    }

    // 授权码模式
    const finalState = Buffer.from(JSON.stringify({
      ...stateData,
      client_id: clientId,
      client_secret: clientSecret,
      client_type: 'code',
      current_user_id: currentUserId,
    })).toString('base64url');

    const authUrl = new URL('https://www.coze.cn/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', finalState);
    authUrl.searchParams.set('scope', 'user:read');
    
    console.log('[OAuth Code] client_id:', clientId, 'mode:', mode, 'currentUserId:', currentUserId);
    
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('OAuth 登录失败:', error);
    const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    return NextResponse.redirect(new URL('/login?error=登录失败', baseUrl));
  }
}

/**
 * 显示OAuth配置页面
 */
function showConfigPage(redirectUri: string, redirectTo: string, _mode: string): NextResponse {
  const configHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>扣子账号绑定</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 32px;
          max-width: 560px;
          width: 100%;
          color: white;
        }
        h1 { 
          color: #a855f7; 
          font-size: 24px; 
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .subtitle { 
          color: rgba(255,255,255,0.6); 
          margin-bottom: 24px; 
          font-size: 14px;
        }
        .info-box {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .info-box h3 {
          color: #3b82f6;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .info-box p {
          color: rgba(255,255,255,0.8);
          font-size: 13px;
          line-height: 1.6;
        }
        .warning-box {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .warning-box h3 {
          color: #f59e0b;
          font-size: 14px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .warning-box p {
          color: rgba(255,255,255,0.8);
          font-size: 13px;
          line-height: 1.5;
        }
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .tab {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.2);
          background: transparent;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .tab.active {
          background: rgba(168, 85, 247, 0.2);
          border-color: #a855f7;
          color: white;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .step-guide {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .step {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .step:last-child { margin-bottom: 0; }
        .step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          flex-shrink: 0;
        }
        .step-content h4 {
          font-size: 14px;
          margin-bottom: 4px;
        }
        .step-content p {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
        }
        .step-content a {
          color: #a855f7;
          text-decoration: none;
        }
        .step-content a:hover { text-decoration: underline; }
        .callback-box {
          background: rgba(0,0,0,0.3);
          border: 1px dashed rgba(168, 85, 247, 0.5);
          border-radius: 8px;
          padding: 12px;
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .callback-box code {
          flex: 1;
          font-size: 12px;
          color: #10b981;
          word-break: break-all;
        }
        .copy-btn {
          background: rgba(168, 85, 247, 0.3);
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        .copy-btn:hover { background: rgba(168, 85, 247, 0.5); }
        .form-section {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 20px;
        }
        .form-section label {
          display: block;
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 6px;
        }
        .form-section input, .form-section select {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.3);
          color: white;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .form-section input::placeholder { color: rgba(255,255,255,0.4); }
        .form-section select { cursor: pointer; }
        .form-section select option { background: #1a1a2e; }
        .form-section .tip {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin-top: -12px;
          margin-bottom: 16px;
        }
        .submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          color: white;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .submit-btn:hover { opacity: 0.9; }
        .footer {
          text-align: center;
          margin-top: 20px;
        }
        .footer a {
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        .footer a:hover { color: white; }
        code { 
          background: rgba(0,0,0,0.3); 
          padding: 2px 6px; 
          border-radius: 4px; 
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔗 扣子账号绑定</h1>
        <p class="subtitle">绑定您的扣子账号，使用自己的词元调用AI服务</p>

        <div class="info-box">
          <h3>💡 OAuth工作原理</h3>
          <p>OAuth应用的<strong>Client ID</strong>可以公开使用。用户授权时会登录<strong>自己的扣子账号</strong>，获得<strong>自己的Token</strong>，不会影响词元归属。</p>
        </div>

        <div class="tabs">
          <button class="tab active" onclick="switchTab('system')">系统级OAuth（推荐）</button>
          <button class="tab" onclick="switchTab('custom')">自建OAuth应用</button>
        </div>

        <div id="system-tab" class="tab-content active">
          <div class="warning-box">
            <h3>⚠️ 需要管理员配置</h3>
            <p>系统暂未配置统一的OAuth应用。请联系管理员在环境变量中配置 <code>OAUTH_CLIENT_ID</code>，所有用户即可一键绑定。</p>
            <p style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(245,158,11,0.3);">
              <strong>管理员须知：</strong>OAuth应用需设置为"公开"或"所有人可见"，否则会出现"无法查看智能体"错误。
            </p>
          </div>
          
          <div class="step-guide">
            <div class="step">
              <div class="step-num">1</div>
              <div class="step-content">
                <h4>管理员创建OAuth应用</h4>
                <p>在 <a href="https://www.coze.cn/open/oauth/apps" target="_blank">扣子开放平台</a> 创建应用</p>
              </div>
            </div>
            <div class="step">
              <div class="step-num">2</div>
              <div class="step-content">
                <h4>配置回调地址</h4>
                <div class="callback-box">
                  <code>${redirectUri}</code>
                  <button class="copy-btn" onclick="copyUrl()">复制</button>
                </div>
              </div>
            </div>
            <div class="step">
              <div class="step-num">3</div>
              <div class="step-content">
                <h4>设置应用可见性为"公开"</h4>
                <p style="color: #f59e0b;">⚠️ 这一步很重要！否则其他用户无法使用</p>
              </div>
            </div>
            <div class="step">
              <div class="step-num">4</div>
              <div class="step-content">
                <h4>配置环境变量</h4>
                <p>设置 <code>OAUTH_CLIENT_ID</code> = 应用ID</p>
              </div>
            </div>
          </div>
        </div>

        <div id="custom-tab" class="tab-content">
          <div class="step-guide">
            <div class="step">
              <div class="step-num">1</div>
              <div class="step-content">
                <h4>创建您的OAuth应用</h4>
                <p>前往 <a href="https://www.coze.cn/open/oauth/apps" target="_blank">扣子开放平台 →</a></p>
              </div>
            </div>
            <div class="step">
              <div class="step-num">2</div>
              <div class="step-content">
                <h4>选择应用类型</h4>
                <p>推荐选择「<strong>移动端/PC 桌面端/单页面应用</strong>」（PKCE模式，无需密钥）</p>
              </div>
            </div>
            <div class="step">
              <div class="step-num">3</div>
              <div class="step-content">
                <h4>添加回调地址</h4>
                <div class="callback-box">
                  <code>${redirectUri}</code>
                  <button class="copy-btn" onclick="copyUrl()">复制</button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <label>应用 ID (Client ID)</label>
            <input type="text" id="clientId" placeholder="例如：35545701333246129901899716777303.app.coze" />
            
            <label>应用类型</label>
            <select id="clientType" onchange="toggleSecret()">
              <option value="pkce">移动端/PC 桌面端/单页面应用（推荐，无需密钥）</option>
              <option value="code">Web 后端应用（需要密钥）</option>
            </select>
            
            <div id="secretSection" style="display: none;">
              <label>Client Secret</label>
              <input type="password" id="clientSecret" placeholder="Web 后端应用需要" />
            </div>
            <p class="tip">💡 推荐选择「移动端/PC 桌面端/单页面应用」，无需配置密钥，更安全</p>

            <button class="submit-btn" onclick="submit()">
              绑定扣子账号
              <span>→</span>
            </button>
          </div>
        </div>

        <div class="footer">
          <a href="/profile">← 返回个人中心</a>
          <a href="https://www.coze.cn/open/oauth/apps" target="_blank">扣子开放平台 →</a>
        </div>
      </div>

      <script>
        function copyUrl() {
          navigator.clipboard.writeText('${redirectUri}').then(() => {
            alert('已复制回调地址！');
          });
        }

        function switchTab(tab) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
          document.querySelector('.tab.' + tab + '-tab-btn, .tabs .tab:nth-child(' + (tab === 'system' ? 1 : 2) + ')').classList.add('active');
          document.getElementById(tab + '-tab').classList.add('active');
        }

        function toggleSecret() {
          const type = document.getElementById('clientType').value;
          const section = document.getElementById('secretSection');
          section.style.display = type === 'pkce' ? 'none' : 'block';
        }

        function submit() {
          const clientId = document.getElementById('clientId').value.trim();
          const clientType = document.getElementById('clientType').value;
          const clientSecret = document.getElementById('clientSecret').value.trim();

          if (!clientId) {
            alert('请输入应用 ID');
            return;
          }

          if (clientType === 'code' && !clientSecret) {
            alert('Web 后端应用需要输入 Client Secret');
            return;
          }

          let url = '/api/auth/oauth/coze?client_id=' + encodeURIComponent(clientId) + '&client_type=' + clientType;
          if (clientSecret) {
            url += '&client_secret=' + encodeURIComponent(clientSecret);
          }
          url += '&redirect_to=${redirectTo}&mode=bind';
          
          window.location.href = url;
        }
      </script>
    </body>
    </html>
  `;
  return new NextResponse(configHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
