import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 保存配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      genre,
      conflict,
      characters,
      storyboards,
    } = body;

    const supabase = getSupabaseClient();

    // 创建一个剧本记录
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .insert({
        title: title || `${genre}短剧`,
        description: conflict,
        genre,
        core_conflict: conflict,
        style: genre,
        total_episodes: 1,
        characters: characters || [],
        status: 'draft',
      })
      .select()
      .single();

    if (seriesError) {
      console.error('创建剧本失败:', seriesError);
      return NextResponse.json(
        { error: '保存配置失败' },
        { status: 500 }
      );
    }

    // 如果有分镜，创建单集剧本
    if (storyboards && storyboards.length > 0) {
      await supabase
        .from('drama_episodes')
        .insert({
          series_id: series.id,
          episode_number: 1,
          title: `第1集 - ${title || genre}`,
          summary: conflict,
          storyboards: storyboards,
          status: 'draft',
        });
    }

    return NextResponse.json({
      success: true,
      series,
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    return NextResponse.json(
      { error: '保存配置失败' },
      { status: 500 }
    );
  }
}

// 获取已保存的配置列表
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 按用户隔离（drama_episodes 无外键约束，不能用嵌套 select，拆为两次查询后在代码中组装）
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false, configs: [] },
        { status: 401 }
      );
    }

    const { data: seriesRows, error } = await supabase
      .from('drama_series')
      .select(`
        id,
        title,
        genre,
        core_conflict,
        characters,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('获取配置列表失败(查询剧集):', error);
      return NextResponse.json(
        { error: '获取配置列表失败' },
        { status: 500 }
      );
    }

    const configs = seriesRows || [];

    // 批量查询关联分集并按 series_id 挂载
    if (configs.length > 0) {
      const seriesIds = configs.map((s: { id: string }) => s.id);
      const { data: episodeRows, error: epError } = await supabase
        .from('drama_episodes')
        .select('id, series_id, episode_number, title, storyboards')
        .in('series_id', seriesIds)
        .order('episode_number', { ascending: true });

      if (epError) {
        console.error('获取配置列表失败(查询分集):', epError);
        return NextResponse.json(
          { error: '获取配置列表失败' },
          { status: 500 }
        );
      }

      const episodeMap = new Map<string, unknown[]>();
      for (const ep of episodeRows || []) {
        const list = episodeMap.get(ep.series_id) || [];
        list.push(ep);
        episodeMap.set(ep.series_id, list);
      }
      for (const s of configs as Array<Record<string, unknown>>) {
        s.drama_episodes = episodeMap.get(s.id as string) || [];
      }
    }

    return NextResponse.json({
      success: true,
      configs,
    });
  } catch (error) {
    console.error('获取配置列表失败:', error);
    return NextResponse.json(
      { error: '获取配置列表失败' },
      { status: 500 }
    );
  }
}
