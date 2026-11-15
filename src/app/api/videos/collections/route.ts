import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 视频合集API
 * 
 * GET: 获取合集列表
 * POST: 创建新合集
 */

// 获取合集列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seriesId = searchParams.get('seriesId');
    
    const supabase = getSupabaseClient();
    
    // 构建查询
    let query = supabase
      .from('video_collections')
      .select('*')
      .order('created_at', { ascending: false });
    
    // 如果指定了seriesId，过滤
    if (seriesId) {
      query = query.eq('series_id', seriesId);
    }
    
    const { data: collections, error } = await query;

    if (error) {
      console.error('查询合集失败:', error);
      return NextResponse.json(
        { error: '获取合集列表失败' },
        { status: 500 }
      );
    }

    // 为每个合集统计视频数量
    const collectionsWithCount = await Promise.all(
      (collections || []).map(async (collection) => {
        const { count } = await supabase
          .from('video_materials')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id);
        
        return {
          ...collection,
          videoCount: count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      collections: collectionsWithCount,
    });
  } catch (error) {
    console.error('获取合集列表失败:', error);
    return NextResponse.json(
      { error: '获取合集列表失败' },
      { status: 500 }
    );
  }
}

// 创建合集
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, seriesId, coverImageUrl } = body;

    if (!title) {
      return NextResponse.json(
        { error: '合集标题不能为空' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 如果有seriesId，检查是否已存在该剧本的合集
    if (seriesId) {
      const { data: existing } = await supabase
        .from('video_collections')
        .select('id')
        .eq('series_id', seriesId)
        .single();
      
      if (existing) {
        return NextResponse.json({
          success: true,
          collection: existing,
          message: '该剧本的合集已存在',
        });
      }
    }

    // 创建合集
    const { data: collection, error } = await supabase
      .from('video_collections')
      .insert({
        title,
        description: description || '',
        series_id: seriesId || null,
        cover_image_url: coverImageUrl || null,
        video_count: 0,
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      console.error('创建合集失败:', error);
      return NextResponse.json(
        { error: '创建合集失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      collection,
    });
  } catch (error) {
    console.error('创建合集失败:', error);
    return NextResponse.json(
      { error: '创建合集失败' },
      { status: 500 }
    );
  }
}
