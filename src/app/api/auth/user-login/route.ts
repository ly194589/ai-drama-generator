import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员用户ID列表 - 这些用户拥有无限期权限
const ADMIN_USER_IDS = [
  'admin',
  'dev_user',
  'demo-user',
  'coze_7462288027250219042', // 扣子管理员账号
];

/**
 * 用户ID登录 API
 * 
 * GET /api/auth/user-login?userId=xxx
 * 已激活用户通过用户ID登录
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '请输入用户ID' },
        { status: 400 }
      );
    }

    const trimmedUserId = userId.trim();

    // 管理员账号直接放行 - 返回无限期订阅信息
    if (ADMIN_USER_IDS.includes(trimmedUserId)) {
      return NextResponse.json({
        success: true,
        user: {
          id: trimmedUserId,
          name: '管理员',
          email: `${trimmedUserId}@admin.local`,
          role: 'admin',
        },
        subscription: {
          planType: 'admin',
          planName: '管理员',
          activatedAt: new Date().toISOString(),
          expiresAt: '9999-12-31T23:59:59.999Z', // 永不过期
          remainingDays: 999999, // 无限天数
          durationDays: -1, // -1 表示无限期
        },
      });
    }

    const supabase = getSupabaseClient();

    // 查询该用户绑定的卡密
    const { data: cardRecord, error: queryError } = await supabase
      .from('card_keys')
      .select('*')
      .eq('user_id', userId.trim())
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    if (queryError || !cardRecord) {
      return NextResponse.json(
        { error: '用户ID不存在，请检查输入' },
        { status: 400 }
      );
    }

    // 检查卡密状态和有效期
    if (cardRecord.status !== 'used') {
      return NextResponse.json(
        { error: '账号状态异常，请联系客服' },
        { status: 400 }
      );
    }

    // 检查是否过期
    const now = new Date();
    const expiresAt = new Date(cardRecord.expires_at);

    if (now > expiresAt) {
      return NextResponse.json({
        error: '会员已过期，请续费',
        expired: true,
        expiresAt: cardRecord.expires_at,
      }, { status: 400 });
    }

    // 计算剩余天数
    const remainingDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    // 确定套餐类型名称
    const planName = cardRecord.plan_name || (
      cardRecord.duration_days >= 36500 ? '终身卡' :
      cardRecord.duration_days >= 365 ? '年卡' :
      cardRecord.duration_days >= 90 ? '季卡' : cardRecord.duration_days >= 30 ? '月卡' : '体验卡'
    );

    return NextResponse.json({
      success: true,
      user: {
        id: cardRecord.user_id,
        name: `用户${cardRecord.user_id?.substring(0, 6) || '会员'}`,
        email: `${cardRecord.user_id}@drama.local`,
      },
      subscription: {
        planType: cardRecord.plan_type || 'test',
        planName: planName,
        activatedAt: cardRecord.activated_at,
        expiresAt: cardRecord.expires_at,
        durationDays: cardRecord.duration_days,
        remainingDays: remainingDays,
      },
    });

  } catch (error) {
    console.error('[用户ID登录] 处理请求失败:', error);
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
