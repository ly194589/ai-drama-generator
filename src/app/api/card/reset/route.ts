import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/card/reset
 * 重置卡密状态（仅开发环境使用）
 * 
 * 请求体：
 * - cardKey: 卡密码
 */
export async function POST(request: NextRequest) {
  // 仅在开发环境启用
  if (process.env.COZE_PROJECT_ENV === 'PROD') {
    return NextResponse.json({ error: '禁止访问' }, { status: 403 });
  }

  try {
    const { cardKey } = await request.json();

    if (!cardKey) {
      return NextResponse.json({ error: '请输入卡密' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 重置卡密状态为未使用
    const { data, error } = await supabase
      .from('card_keys')
      .update({
        status: 'unused',
        user_id: null,
        activated_at: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('card_key', cardKey.trim().toUpperCase())
      .select()
      .single();

    if (error) {
      console.error('[重置卡密] 失败:', error);
      return NextResponse.json({ error: '卡密不存在或重置失败' }, { status: 400 });
    }

    console.log(`[重置卡密] 成功: ${cardKey}`);

    return NextResponse.json({
      success: true,
      message: '卡密已重置为未使用状态',
      card: {
        cardKey: data.card_key,
        status: data.status,
        planType: data.plan_type,
        durationDays: data.duration_days,
      },
    });

  } catch (error) {
    console.error('[重置卡密] 处理失败:', error);
    return NextResponse.json({ error: '重置失败' }, { status: 500 });
  }
}
