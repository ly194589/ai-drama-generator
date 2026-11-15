import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/card/expire
 * 让卡密过期（仅开发环境使用）
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

    // 将过期时间设置为过去，并更新状态为 expired
    const { data, error } = await supabase
      .from('card_keys')
      .update({
        status: 'expired',
        expires_at: new Date(Date.now() - 1000).toISOString(), // 设置为过去时间
        updated_at: new Date().toISOString(),
      })
      .eq('card_key', cardKey.trim().toUpperCase())
      .select()
      .single();

    if (error) {
      console.error('[过期卡密] 失败:', error);
      return NextResponse.json({ error: '卡密不存在或操作失败' }, { status: 400 });
    }

    console.log(`[过期卡密] 成功: ${cardKey}`);

    return NextResponse.json({
      success: true,
      message: '卡密已设置为过期状态',
      card: {
        cardKey: data.card_key,
        status: data.status,
        expiresAt: data.expires_at,
      },
    });

  } catch (error) {
    console.error('[过期卡密] 处理失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
