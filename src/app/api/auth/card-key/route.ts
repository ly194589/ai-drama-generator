import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 卡密验证 API
 * 
 * POST /api/auth/card-key/verify
 * 验证卡密并激活用户账号
 * 
 * 请求体：
 * - cardKey: 卡密码
 * - userId: 用户ID（可选，用于绑定卡密）
 */
export async function POST(request: NextRequest) {
  try {
    const { cardKey, userId } = await request.json();

    if (!cardKey) {
      return NextResponse.json(
        { error: '请输入卡密' },
        { status: 400 }
      );
    }

    // 格式化卡密（移除空格、转大写）
    const formattedKey = cardKey.trim().toUpperCase().replace(/\s+/g, '');

    const supabase = getSupabaseClient();

    // 查询卡密
    const { data: cardRecord, error: queryError } = await supabase
      .from('card_keys')
      .select('*')
      .eq('card_key', formattedKey)
      .single();

    if (queryError || !cardRecord) {
      return NextResponse.json(
        { error: '卡密不存在，请检查输入' },
        { status: 400 }
      );
    }

    // 检查卡密状态
    if (cardRecord.status === 'used') {
      // 卡密已激活，检查是否过期
      const now = new Date();
      const expiresAt = new Date(cardRecord.expires_at);
      
      if (now > expiresAt) {
        // 已过期
        return NextResponse.json({
          error: '会员已过期，请续费',
          expired: true,
          expiresAt: cardRecord.expires_at,
        }, { status: 400 });
      }
      
      // 未过期，允许登录（返回已有用户信息）
      const remainingDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const planName = cardRecord.plan_name || (
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
    }

    if (cardRecord.status === 'expired') {
      return NextResponse.json(
        { error: '卡密已过期，请续费', expired: true },
        { status: 400 }
      );
    }

    if (cardRecord.status === 'disabled') {
      return NextResponse.json(
        { error: '卡密已被禁用' },
        { status: 400 }
      );
    }

    // 激活卡密
    const now = new Date();
    const expiresAt = new Date(now.getTime() + cardRecord.duration_days * 24 * 60 * 60 * 1000);
    const effectiveUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { error: updateError } = await supabase
      .from('card_keys')
      .update({
        status: 'used',
        user_id: effectiveUserId,
        activated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', cardRecord.id);

    if (updateError) {
      console.error('[卡密验证] 更新卡密状态失败:', updateError);
      return NextResponse.json(
        { error: '激活失败，请稍后重试' },
        { status: 500 }
      );
    }

    console.log(`[卡密验证] 卡密激活成功: ${formattedKey}, 用户: ${effectiveUserId}, 有效期至: ${expiresAt.toISOString()}`);

    // 在 user_config 表中创建用户记录（用于存储 OAuth Token 等）
    const { error: userConfigError } = await supabase
      .from('user_config')
      .upsert({
        user_id: effectiveUserId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      });

    if (userConfigError) {
      console.error('[卡密验证] 创建用户配置失败:', userConfigError);
      // 不影响激活流程，继续返回成功
    }

    // 计算剩余天数
    const remainingDays = cardRecord.duration_days;
    
    // 确定套餐类型名称
    const planName = cardRecord.plan_name || (
      cardRecord.duration_days >= 365 ? '年卡' :
      cardRecord.duration_days >= 90 ? '季卡' : '月卡'
    );

    return NextResponse.json({
      success: true,
      user: {
        id: effectiveUserId,
        name: `用户${effectiveUserId.substring(0, 6)}`,
        email: `${effectiveUserId}@drama.local`,
      },
      subscription: {
        planType: cardRecord.plan_type || (cardRecord.duration_days >= 365 ? 'yearly' : cardRecord.duration_days >= 90 ? 'quarterly' : 'monthly'),
        planName: planName,
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        durationDays: cardRecord.duration_days,
        remainingDays: remainingDays,
      },
    });

  } catch (error) {
    console.error('[卡密验证] 处理请求失败:', error);
    return NextResponse.json(
      { error: '验证失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/card-key/status
 * 查询卡密状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardKey = searchParams.get('cardKey');

    if (!cardKey) {
      return NextResponse.json(
        { error: '请提供卡密' },
        { status: 400 }
      );
    }

    const formattedKey = cardKey.trim().toUpperCase().replace(/\s+/g, '');

    const supabase = getSupabaseClient();

    const { data: cardRecord, error } = await supabase
      .from('card_keys')
      .select('card_key, status, duration_days, activated_at, expires_at')
      .eq('card_key', formattedKey)
      .single();

    if (error || !cardRecord) {
      return NextResponse.json(
        { valid: false, error: '卡密不存在' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: cardRecord.status === 'unused',
      status: cardRecord.status,
      durationDays: cardRecord.duration_days,
      activatedAt: cardRecord.activated_at,
      expiresAt: cardRecord.expires_at,
    });

  } catch (error) {
    console.error('[卡密查询] 处理请求失败:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}
