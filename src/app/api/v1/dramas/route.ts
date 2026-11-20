import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, apiError } from '@/lib/api-v1';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/** GET /api/v1/dramas - 当前账号的剧集列表 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20));
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0);
  const status = request.nextUrl.searchParams.get('status');

  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('drama_series')
      .select('id,title,genre,style,image_style,total_episodes,status,created_at,updated_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[API v1] 剧集查询失败:', error);
      return apiError(502, 'UPSTREAM_ERROR', '剧集数据读取失败，请稍后重试');
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: { limit, offset, count: (data || []).length },
    });
  } catch (error) {
    console.error('[API v1] 剧集接口异常:', error);
    return apiError(500, 'INTERNAL_ERROR', '服务端异常');
  }
}
