import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 从请求中获取用户ID
 */
function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || '';
}

/**
 * 获取用户用量统计
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const supabase = getSupabaseClient();
    
    // 获取本月用量
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // 查询各类别的用量
    const { data: usageData, error } = await supabase
      .from('api_usage')
      .select('type, count, created_at')
      .eq('user_id', userId)
      .gte('created_at', monthStart);

    if (error && error.code !== 'PGRST116') {
      console.error('获取用量失败:', error);
    }

    // 统计各类别数量
    const stats = {
      video: 0,
      image: 0,
      audio: 0,
      chat: 0,
      total_duration: 0,
    };

    if (usageData) {
      for (const item of usageData) {
        if (item.type === 'video') stats.video += item.count || 1;
        if (item.type === 'image') stats.image += item.count || 1;
        if (item.type === 'audio') stats.audio += item.count || 1;
        if (item.type === 'chat') stats.chat += item.count || 1;
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      period: {
        start: monthStart,
        end: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('获取用量失败:', error);
    return NextResponse.json(
      { error: '获取用量失败' },
      { status: 500 }
    );
  }
}

/**
 * 记录 API 用量
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const { type, count = 1, duration, metadata } = body;

    if (!type) {
      return NextResponse.json(
        { error: '缺少 type 参数' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 插入用量记录
    const { error } = await supabase
      .from('api_usage')
      .insert({
        user_id: userId,
        type,
        count,
        duration,
        metadata,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('记录用量失败:', error);
      // 不返回错误，用量记录失败不影响主流程
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('记录用量失败:', error);
    return NextResponse.json({
      success: true, // 用量记录失败不影响主流程
    });
  }
}
