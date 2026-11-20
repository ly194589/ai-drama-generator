import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getUserQuotas } from '@/lib/quota-service';

// 管理员用户ID列表 - 这些用户拥有无限期权限
const ADMIN_USER_IDS = [
  'admin',
  'dev_user',
  'demo-user',
  'coze_7462288027250219042', // 扣子管理员账号
];

/**
 * 用户订阅状态检查 API
 * 
 * GET /api/auth/subscription?userId=xxx
 * 检查用户订阅是否有效
 * 
 * GET /api/auth/subscription
 * 检查当前登录用户的订阅状态（从localStorage中的user.id获取）
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: '未登录', authorized: false },
        { status: 401 }
      );
    }

    // 管理员账号直接放行 - 返回无限期订阅信息
    if (ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json({
        authorized: true,
        isAdmin: true,
        message: '管理员账号',
        subscription: {
          planType: 'admin',
          planName: '管理员',
          activatedAt: new Date().toISOString(),
          expiresAt: '9999-12-31T23:59:59.999Z',
          remainingDays: 999999,
          durationDays: -1,
          quotas: {
            scripts: { total: 999999, used: 0 },
            videos: { total: 999999, used: 0 },
            images: { total: 999999, used: 0 },
            music: { total: 999999, used: 0 },
          },
        },
      });
    }

    const supabase = getSupabaseClient();

    // 查询用户的卡密记录（按激活时间倒序，取最新的一条）
    const { data: cardRecord, error } = await supabase
      .from('card_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'used')
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !cardRecord) {
      // 新用户没有卡密记录，返回体验卡配额（但标记为未授权）
      const quotas = await getUserQuotas(userId);
      return NextResponse.json({
        authorized: false,
        error: '未找到有效订阅',
        message: '请购买卡密激活账号',
        subscription: {
          planType: 'trial',
          planName: '体验卡',
          quotas: quotas || {
            scripts: { total: 1, used: 0 },
            videos: { total: 5, used: 0 },
            images: { total: 20, used: 0 },
            music: { total: 5, used: 0 },
          },
        },
      });
    }

    // 检查是否过期
    const now = new Date();
    const expiresAt = new Date(cardRecord.expires_at);

    if (now > expiresAt) {
      // 更新卡密状态为过期
      await supabase
        .from('card_keys')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', cardRecord.id);

      return NextResponse.json({
        authorized: false,
        expired: true,
        error: '订阅已过期',
        message: '您的订阅已过期，请续费',
        expiresAt: cardRecord.expires_at,
      });
    }

    // 订阅有效
    const remainingDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    // 确保有默认的套餐类型
    const planType = cardRecord.plan_type || (
      cardRecord.duration_days >= 36500 ? 'lifetime' :
      cardRecord.duration_days >= 365 ? 'yearly' : 
      cardRecord.duration_days >= 90 ? 'quarterly' : 'monthly'
    );

    // 获取实际配额（包含已使用量）
    const quotas = await getUserQuotas(userId);

    return NextResponse.json({
      authorized: true,
      subscription: {
        planType: planType,
        planName: planType === 'lifetime' ? '终身卡' : planType === 'yearly' ? '年卡' : planType === 'quarterly' ? '季卡' : planType === 'trial' ? '体验卡' : '月卡',
        activatedAt: cardRecord.activated_at,
        expiresAt: cardRecord.expires_at,
        remainingDays,
        durationDays: cardRecord.duration_days,
        quotas: quotas || {
          scripts: { total: 0, used: 0 },
          videos: { total: 0, used: 0 },
          images: { total: 0, used: 0 },
          music: { total: 0, used: 0 },
        },
      },
    });

  } catch (error) {
    console.error('[订阅检查] 处理请求失败:', error);
    return NextResponse.json(
      { error: '检查失败', authorized: false },
      { status: 500 }
    );
  }
}
