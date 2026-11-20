import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 消耗记录类型
interface UsageRecord {
  id: string;
  type: 'script' | 'video' | 'image' | 'music';
  action: string;
  cost: number;
  status: 'success' | 'failed' | 'refunded';
  createdAt: string;
  detail?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = request.headers.get('x-user-id');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    // 查询消耗记录
    const { data: records, error } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('查询消耗记录失败:', error);
      // 如果表不存在，返回空数组
      return NextResponse.json({ records: [] });
    }
    
    // 转换数据格式
    const formattedRecords: UsageRecord[] = (records || []).map((record: Record<string, unknown>) => ({
      id: record.id as string,
      type: record.type as 'script' | 'video' | 'image' | 'music',
      action: record.action as string,
      cost: record.cost as number,
      status: record.status as 'success' | 'failed' | 'refunded',
      createdAt: record.created_at as string,
      detail: record.detail as string | undefined,
    }));
    
    return NextResponse.json({ records: formattedRecords });
  } catch (error) {
    console.error('获取消耗记录失败:', error);
    return NextResponse.json({ records: [] });
  }
}

// 记录消耗
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const { type, action, cost, status = 'success', detail } = body;
    
    if (!userId || !type || !action || cost === undefined) {
      return NextResponse.json({ error: '未登录或缺少必要参数' }, { status: userId ? 400 : 401 });
    }
    
    const { data, error } = await supabase
      .from('usage_records')
      .insert({
        user_id: userId,
        type,
        action,
        cost,
        status,
        detail,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('记录消耗失败:', error);
      return NextResponse.json({ error: '记录消耗失败' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('记录消耗失败:', error);
    return NextResponse.json({ error: '记录消耗失败' }, { status: 500 });
  }
}
