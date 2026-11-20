import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { isAuthSessionConfigured, setSessionCookie } from '@/lib/auth-session';
import { hashPassword } from '@/lib/password';

/**
 * 用户注册 API
 * 
 * POST /api/auth/register
 * 注册新用户并自动分配体验卡
 * 
 * 请求体：
 * - username: 用户名（必填）
 * - password: 密码（必填）
 * - email: 邮箱（可选）
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthSessionConfigured()) {
      return NextResponse.json({ error: '服务端未配置登录会话密钥' }, { status: 503 });
    }
    const { username, password, email } = await request.json();

    // 参数验证
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return NextResponse.json(
        { error: '请填写用户名和密码' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: '用户名长度需在3-20个字符之间' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少6个字符' },
        { status: 400 }
      );
    }

    // 用户名格式验证（只允许字母、数字、下划线、连字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { error: '用户名只能包含字母、数字、下划线和连字符' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 检查用户名是否已被使用
    const { data: existingCards } = await supabase
      .from('card_keys')
      .select('metadata, user_id')
      .eq('plan_type', 'trial');

    if (existingCards) {
      const existingUser = existingCards.find(card => {
        const meta = card.metadata as Record<string, unknown>;
        return meta?.username === username;
      });

      if (existingUser) {
        return NextResponse.json(
          { error: '用户名已被使用' },
          { status: 400 }
        );
      }
      
    }

    const now = new Date();
    
    // Registration must never grant a privileged user ID or role.
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const isAdmin = false;

    // 生成体验卡卡密
    const cardKey = `TRIAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 管理员账号有效期设为100年，普通用户7天
    const expiryDays = isAdmin ? 36500 : 7;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    // 保存密码哈希（用于后续登录验证）
    const passwordHash = await hashPassword(password);

    // 创建体验卡记录并直接激活，将用户信息存储在metadata中
    const { error: cardError } = await supabase
      .from('card_keys')
      .insert({
        card_key: cardKey,
        plan_type: isAdmin ? 'admin' : 'trial',
        status: 'used',
        user_id: userId,
        price: 0,
        duration_days: expiryDays,
        activated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        metadata: {
          username,
          email: email || `${userId}@drama.local`,
          passwordHash,
          createdAt: now.toISOString(),
          isAdmin,
        },
      });

    if (cardError) {
      console.error('[注册] 创建体验卡失败:', cardError);
      return NextResponse.json(
        { error: '注册失败，请稍后重试' },
        { status: 500 }
      );
    }

    // 在 user_config 表中创建用户记录（可选，用于存储其他配置）
    await supabase
      .from('user_config')
      .upsert({
        user_id: userId,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      });

    console.log(`[注册] 用户注册成功: ${username} (${userId})${isAdmin ? ' [管理员]' : ''}`);

    const response = NextResponse.json({
      success: true,
      message: '注册成功',
      user: {
        id: userId,
        username: username,
        email: email || `${userId}@drama.local`,
        name: username,
        isAdmin,
      },
      subscription: {
        planType: isAdmin ? 'admin' : 'trial',
        planName: isAdmin ? '管理员' : '体验卡',
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        durationDays: expiryDays,
        remainingDays: expiryDays,
        quotas: isAdmin ? null : {
          scripts: { total: 1, used: 0 },
          videos: { total: 5, used: 0 },
          images: { total: 20, used: 0 },
          music: { total: 5, used: 0 },
        },
      },
    });
    return await setSessionCookie(response, userId);

  } catch (error) {
    console.error('[注册] 处理请求失败:', error);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}
