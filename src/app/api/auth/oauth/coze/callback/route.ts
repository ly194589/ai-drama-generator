import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 扣子 OAuth 回调处理
 * 
 * GET: 处理 OAuth 授权回调 / 响应 challenge 验证
 * POST: 响应扣子开放平台的回调地址验证
 * 
 * 支持两种授权模式：
 * 1. PKCE 模式：使用 code_verifier 换取 token（无需 client_secret）
 * 2. 授权码模式：使用 client_secret 换取 token
 * 
 * 支持两种业务模式：
 * 1. bind 模式：绑定扣子账号到当前用户
 * 2. login 模式：使用扣子账号登录
 */

// 响应扣子开放平台的回调地址验证请求（POST）
export async function POST(request: NextRequest) {
  console.log('[OAuth Callback] 收到 POST 验证请求');
  
  try {
    const contentType = request.headers.get('content-type') || '';
    let challenge = '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      console.log('[OAuth Callback] JSON body:', JSON.stringify(body));
      
      // 扣子平台的格式：{ event: { challenge: 'xxx' } }
      if (body.event && body.event.challenge) {
        challenge = body.event.challenge;
      } else if (body.challenge) {
        challenge = body.challenge;
      }
    } else {
      const body = await request.text();
      console.log('[OAuth Callback] Text body:', body);
      
      try {
        const json = JSON.parse(body);
        if (json.event && json.event.challenge) {
          challenge = json.event.challenge;
        } else if (json.challenge) {
          challenge = json.challenge;
        }
      } catch {
        const params = new URLSearchParams(body);
        challenge = params.get('challenge') || '';
      }
    }
    
    if (challenge) {
      console.log('[OAuth Callback] 返回 challenge:', challenge);
      return NextResponse.json({ challenge }, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[OAuth Callback] 未找到 challenge，返回默认响应');
    return NextResponse.json({
      success: true,
      message: 'Callback URL verified',
    });
  } catch (error) {
    console.error('[OAuth Callback] 验证请求处理失败:', error);
    return NextResponse.json({
      success: true,
      message: 'Callback URL is ready',
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 处理 challenge 验证（GET 方式）
  const challenge = searchParams.get('challenge');
  if (challenge) {
    console.log('[OAuth Callback] 收到 GET challenge:', challenge);
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  
  // 正常的 OAuth 回调处理
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  try {
    // 处理授权错误
    if (error) {
      console.error('OAuth 授权错误:', error, errorDescription);
      
      // 常见错误处理
      const errorMessages: Record<string, string> = {
        'access_denied': '您拒绝了授权，请重新尝试',
        'invalid_client': 'OAuth应用配置错误，请检查Client ID是否正确',
        'invalid_grant': '授权码已过期或无效，请重新授权',
        'unauthorized_client': 'OAuth应用未授权，请检查应用配置',
        'unsupported_response_type': '不支持的授权类型',
      };
      
      const errorMessage = errorMessages[error] || errorDescription || error;
      const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
      
      // 对于配置相关错误，显示帮助页面
      if (['invalid_client', 'unauthorized_client'].includes(error)) {
        return showErrorPage(errorMessage, '请确认您的OAuth应用配置是否正确，回调地址是否已添加。');
      }
      
      return NextResponse.redirect(
        new URL(`/profile?bind_error=${encodeURIComponent(errorMessage)}`, baseUrl)
      );
    }

    if (!code) {
      const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
      return NextResponse.redirect(new URL('/profile?bind_error=no_code', baseUrl));
    }

    // 解析 state 获取配置
    let clientId = '';
    let clientSecret = '';
    let codeVerifier = '';
    let clientType = 'code';
    let mode = 'login'; // bind | login
    let currentUserId = ''; // 绑定模式下的当前用户ID
    
    try {
      if (state) {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        clientId = stateData.client_id || '';
        clientSecret = stateData.client_secret || '';
        codeVerifier = stateData.code_verifier || '';
        clientType = stateData.client_type || 'code';
        mode = stateData.mode || 'login';
        currentUserId = stateData.current_user_id || '';
      }
    } catch (e) {
      console.error('[OAuth Callback] state 解析失败:', e);
    }

    if (!clientId) {
      const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
      return NextResponse.redirect(new URL('/profile?bind_error=oauth_not_configured', baseUrl));
    }

    const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const redirectUri = `${baseUrl}/api/auth/oauth/coze/callback`;

    // 构建获取 token 的请求参数
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    };

    if (clientType === 'pkce' && codeVerifier) {
      // PKCE 模式：使用 code_verifier
      console.log('[OAuth Callback] 使用 PKCE 模式');
      tokenParams.code_verifier = codeVerifier;
    } else {
      // 授权码模式：使用 client_secret
      console.log('[OAuth Callback] 使用授权码模式');
      if (!clientSecret) {
        return NextResponse.redirect(new URL('/profile?bind_error=client_secret_required', baseUrl));
      }
      tokenParams.client_secret = clientSecret;
    }

    console.log('[OAuth Callback] 请求 token, client_id:', clientId, 'mode:', mode);

    // 使用授权码换取 access_token
    const tokenResponse = await fetch('https://api.coze.cn/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('获取 token 失败:', errorText);
      return NextResponse.redirect(
        new URL(`/profile?bind_error=${encodeURIComponent('获取令牌失败')}`, baseUrl)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    console.log('[OAuth Callback] 获取 token 成功');

    // 使用 access_token 获取用户信息
    const userResponse = await fetch('https://api.coze.cn/v1/user/info', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('获取用户信息失败');
      return NextResponse.redirect(
        new URL('/profile?bind_error=user_info_failed', baseUrl)
      );
    }

    const userData = await userResponse.json();
    const cozeUser = userData.data;
    
    // 用户唯一标识
    const cozeUserId = cozeUser.user_id || cozeUser.id;
    const userEmail = cozeUser.email || `${cozeUserId}@coze.user`;
    const userName = cozeUser.nickname || cozeUser.name || cozeUser.user_name || 'Coze用户';
    const avatarUrl = cozeUser.avatar_url || cozeUser.avatar;

    console.log('[OAuth Callback] 用户信息:', { cozeUserId, userName, mode });

    const supabase = getSupabaseClient();
    
    // 绑定模式：更新当前用户的扣子信息
    if (mode === 'bind') {
      if (!currentUserId) {
        console.error('[OAuth Callback] 绑定模式下缺少 currentUserId');
        return NextResponse.redirect(
          new URL('/profile?bind_error=' + encodeURIComponent('绑定失败：未找到用户信息，请重新登录后重试'), baseUrl)
        );
      }
      
      console.log('[OAuth Callback] 绑定模式，更新用户:', currentUserId);
      
      // 检查该扣子账号是否已被其他用户绑定
      const { data: existingBinding } = await supabase
        .from('user_config')
        .select('user_id')
        .eq('coze_user_id', cozeUserId)
        .neq('user_id', currentUserId)
        .single();
      
      if (existingBinding) {
        return NextResponse.redirect(
          new URL('/profile?bind_error=' + encodeURIComponent('该扣子账号已被其他用户绑定'), baseUrl)
        );
      }
      
      // 使用 upsert 确保用户记录存在，并更新扣子信息
      const { error: updateError, data: updatedRecord } = await supabase
        .from('user_config')
        .upsert({
          user_id: currentUserId,
          coze_user_id: cozeUserId,
          coze_access_token: access_token,
          coze_refresh_token: refresh_token,
          coze_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select();
      
      if (updateError) {
        console.error('[OAuth Callback] 更新用户绑定失败:', updateError);
        return NextResponse.redirect(
          new URL('/profile?bind_error=' + encodeURIComponent('绑定失败: ' + updateError.message), baseUrl)
        );
      }
      
      console.log('[OAuth Callback] 绑定成功, 记录:', updatedRecord);
      return NextResponse.redirect(new URL('/profile?bind_success=true', baseUrl));
    }
    
    // 登录模式：创建或更新用户
    // 查找是否已存在该扣子用户
    const { data: existingUser } = await supabase
      .from('user_config')
      .select('user_id')
      .eq('coze_user_id', cozeUserId)
      .single();

    let supabaseUserId: string;

    if (existingUser) {
      supabaseUserId = existingUser.user_id;
      
      await supabase
        .from('user_config')
        .update({
          coze_access_token: access_token,
          coze_refresh_token: refresh_token,
          coze_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', supabaseUserId);
    } else {
      supabaseUserId = `coze_${cozeUserId}`;
      
      await supabase
        .from('user_config')
        .insert({
          user_id: supabaseUserId,
          coze_user_id: cozeUserId,
          coze_access_token: access_token,
          coze_refresh_token: refresh_token,
          coze_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          solution_preset: 'seedance-1-5-pro',
          video_model: 'doubao-seedance-2-0-260128',
          llm_model: 'doubao-seed-2-0-pro-260215',
          image_size: '2K',
          tts_speaker: 'zh_female_mizai_saturn_bigtts',
        });
    }

    // 创建 session token
    const sessionToken = Buffer.from(JSON.stringify({
      user_id: supabaseUserId,
      coze_user_id: cozeUserId,
      email: userEmail,
      name: userName,
      avatar: avatarUrl,
      coze_access_token: access_token,
      expires_at: Date.now() + expires_in * 1000,
    })).toString('base64url');

    // 构建重定向 URL
    const redirectUrl = new URL('/login', baseUrl);
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('token', sessionToken);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth 回调处理失败:', error);
    const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    return NextResponse.redirect(new URL('/profile?bind_error=oauth_callback_failed', baseUrl));
  }
}

/**
 * 显示错误帮助页面
 */
function showErrorPage(title: string, description: string): NextResponse {
  const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>绑定失败</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 480px;
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 40px;
          text-align: center;
        }
        .error-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 32px;
        }
        h1 {
          color: #ef4444;
          font-size: 20px;
          margin-bottom: 12px;
        }
        p {
          color: rgba(255,255,255,0.7);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .tips {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          margin-bottom: 24px;
        }
        .tips h3 {
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          margin-bottom: 12px;
        }
        .tips ul {
          color: rgba(255,255,255,0.6);
          font-size: 13px;
          padding-left: 20px;
          margin: 0;
        }
        .tips li {
          margin-bottom: 8px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          color: white;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }
        .btn:hover { opacity: 0.9; }
        .link {
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          font-size: 13px;
          margin-top: 16px;
          display: inline-block;
        }
        .link:hover { color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">❌</div>
        <h1>${title}</h1>
        <p>${description}</p>
        
        <div class="tips">
          <h3>💡 常见解决方案：</h3>
          <ul>
            <li>确保您已创建自己的 <a href="https://www.coze.cn/open/oauth/apps" target="_blank" style="color: #a855f7;">扣子OAuth应用</a></li>
            <li>应用类型选择「移动端/PC桌面端/单页面应用」</li>
            <li>添加正确的回调地址（当前页面URL去掉query参数）</li>
            <li>确保使用的是您自己创建的应用ID</li>
          </ul>
        </div>
        
        <a href="/profile" class="btn">返回个人中心</a>
        <a href="https://www.coze.cn/open/oauth/apps" class="link" target="_blank">前往扣子开放平台 →</a>
      </div>
    </body>
    </html>
  `;
  
  return new NextResponse(errorHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
