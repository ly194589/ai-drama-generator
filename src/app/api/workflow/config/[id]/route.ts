import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 获取短剧完整配置API
 * 用于工作流执行器自动获取已有配置
 * 
 * 返回：
 * - 基本信息（title, genre, style, core_conflict, total_episodes）
 * - 角色配置（characters）
 * - 场景配置（scenes from metadata）
 * - 剧集配置（episodes with storyboards）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 1. 获取短剧基本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    // 2. 获取剧集列表（包含分镜剧本）
    const { data: episodes, error: episodesError } = await supabase
      .from('drama_episodes')
      .select('id, episode_number, title, summary, storyboards, hook, cliffhanger')
      .eq('series_id', id)
      .order('episode_number', { ascending: true });

    if (episodesError) {
      console.error('获取剧集失败:', episodesError);
    }

    // 3. 提取角色配置
    const characters = series.characters || [];
    const hasCharacters = characters.length > 0;
    
    // 检查角色是否有立绘
    const charactersWithImages = characters.filter((char: { images?: unknown[] }) => 
      char.images && Array.isArray(char.images) && char.images.length > 0
    );
    const hasCharacterImages = charactersWithImages.length > 0;

    // 4. 提取场景配置（存储在 metadata.sceneImages）
    const sceneImages = (series.metadata as Record<string, unknown>)?.sceneImages as unknown[] || [];
    const hasSceneImages = sceneImages.length > 0;

    // 5. 提取分镜剧本配置
    const episodesWithStoryboards = (episodes || []).filter(
      (ep: { storyboards?: unknown[] }) => ep.storyboards && Array.isArray(ep.storyboards) && ep.storyboards.length > 0
    );
    const hasStoryboards = episodesWithStoryboards.length > 0;

    // 6. 计算工作流步骤完成状态
    const workflowStatus = {
      hasCharacters,          // 角色是否已生成
      hasCharacterImages,     // 角色立绘是否已生成
      hasSceneImages,         // 场景照是否已生成
      hasStoryboards,         // 分镜剧本是否已生成
      completedEpisodes: episodesWithStoryboards.length, // 已生成剧本的集数
      totalEpisodes: series.total_episodes || 1,
    };

    // 7. 构建完整配置
    const config = {
      // 基本信息
      id: series.id,
      title: series.title,
      genre: series.genre,
      style: series.style,
      coreConflict: series.core_conflict,
      coreConflictTypes: series.core_conflict_types || [], // 冲突类型数组
      totalEpisodes: series.total_episodes || 1,
      description: series.description,
      
      // 角色配置
      characters,
      charactersWithImagesCount: charactersWithImages.length, // 有立绘的角色数量
      
      // 场景配置
      sceneImages,
      sceneImagesCount: sceneImages.length, // 场景图片数量
      
      // 剧集配置
      episodes: episodes || [],
      episodesWithStoryboards,
      
      // 工作流状态
      workflowStatus,
      
      // 工作流历史
      workflowHistory: (series.metadata as Record<string, unknown>)?.workflow_history || [],
    };

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('获取短剧配置失败:', error);
    return NextResponse.json(
      { error: '获取短剧配置失败' },
      { status: 500 }
    );
  }
}
