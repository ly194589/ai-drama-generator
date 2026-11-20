import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { isAuthSessionConfigured, setSessionCookie } from '@/lib/auth-session';
import { hashPassword, verifyPassword } from '@/lib/password';

/**
 * 用户登录 API
 * 
 * POST /api/auth/login
 * 使用用户名/邮箱和密码登录
 * 
 * 请求体：
 * - username: 用户名或邮箱（必填）
 * - password: 密码（必填）
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthSessionConfigured()) {
      return NextResponse.json({ error: '服务端未配置登录会话密钥' }, { status: 503 });
    }
    const { username, password } = await request.json();

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return NextResponse.json(
        { error: '请填写用户名和密码' },
        { status: 400 }
      );
    }

    // 本地开发兜底：未配置数据库时，使用 .env 中的本地管理员账号登录
    // 仅开发环境且无 Supabase 配置时生效，生产环境不会命中
    if (process.env.NODE_ENV !== 'production' && !process.env.COZE_SUPABASE_URL) {
      const localUser = process.env.LOCAL_ADMIN_USERNAME;
      const localPass = process.env.LOCAL_ADMIN_PASSWORD;
      if (localUser && localPass && username === localUser && password === localPass) {
        const response = NextResponse.json({
          success: true,
          user: {
            id: 'admin',
            username: localUser,
            email: `${localUser}@local.dev`,
            name: localUser,
            isAdmin: true,
          },
          subscription: {
            planType: 'admin',
            planName: '管理员',
            activatedAt: new Date().toISOString(),
            expiresAt: '9999-12-31T23:59:59.999Z',
            durationDays: -1,
            remainingDays: 999999,
          },
          authorized: true,
        });
        return await setSessionCookie(response, 'admin');
      }
    }

    const supabase = getSupabaseClient();
    const now = new Date();

    // 从 card_keys 表查找用户（通过 metadata 字段）
    const { data: cards, error: queryError } = await supabase
      .from('card_keys')
      .select('*')
      .eq('status', 'used');

    if (queryError) {
      console.error('[登录] 查询失败:', queryError);
      return NextResponse.json(
        { error: '登录失败，请稍后重试' },
        { status: 500 }
      );
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 400 }
      );
    }

    // 在结果中查找匹配的用户
    const userCard = cards.find(card => {
      let meta = card.metadata;
      
      // 如果 metadata 是字符串，尝试解析
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch {
          return false;
        }
      }
      
      if (!meta || typeof meta !== 'object') return false;
      
      const metaData = meta as Record<string, unknown>;
      return metaData.username === username || metaData.email === username;
    });

    if (!userCard) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 400 }
      );
    }

    // 获取 metadata
    let meta = userCard.metadata;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }
    const metaData = (meta as Record<string, unknown>) || {};

    // 验证密码
    const passwordResult = await verifyPassword(password, metaData.passwordHash);
    if (!passwordResult.valid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 400 }
      );
    }

    const userId = userCard.user_id;

    if (passwordResult.needsUpgrade) {
      const upgradedMetadata = { ...metaData, passwordHash: await hashPassword(password) };
      const { error: upgradeError } = await supabase
        .from('card_keys')
        .update({ metadata: upgradedMetadata })
        .eq('id', userCard.id);
      if (upgradeError) console.error('[登录] 密码哈希升级失败:', upgradeError);
    }

    // 检查订阅是否有效
    const expiresAt = new Date(userCard.expires_at);
    const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const isAuthorized = now <= expiresAt;

    if (!isAuthorized) {
      return NextResponse.json({ error: '会员已过期，请续费或激活新卡密' }, { status: 403 });
    }

    const planType = userCard.plan_type || 'trial';
    const isAdmin = planType === 'admin' || metaData.isAdmin === true;

    console.log(`[登录] 用户登录成功: ${metaData.username} (${userId})${isAdmin ? ' [管理员]' : ''}`);

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: metaData.username as string,
        email: metaData.email as string,
        name: metaData.username as string,
        isAdmin,
      },
      subscription: {
        planType: planType,
        planName: isAdmin ? '管理员' : planType === 'trial' ? '体验卡' : planType === 'lifetime' ? '终身卡' : planType === 'yearly' ? '年卡' : planType === 'quarterly' ? '季卡' : '月卡',
        activatedAt: userCard.activated_at,
        expiresAt: userCard.expires_at,
        durationDays: userCard.duration_days || 7,
        remainingDays: remainingDays,
      },
      authorized: isAuthorized,
    });
    return await setSessionCookie(response, userId, userCard.expires_at);

  } catch (error) {
    console.error('[登录] 处理请求失败:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
