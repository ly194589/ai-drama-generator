import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { input, context, seriesId, seriesTitle } = await request.json();
    const supabase = getSupabaseClient();

    // 如果有 seriesId，从数据库获取全剧集的分镜数据
    let allEpisodesStoryboards: unknown[] = [];
    let sceneImagesWithPrompts: unknown[] = [];
    
    if (seriesId) {
      // 获取所有剧集的分镜数据
      const { data: episodes, error: episodesError } = await supabase
        .from('drama_episodes')
        .select('episodeNumber, title, storyboards')
        .eq('series_id', seriesId)
        .order('episodeNumber', { ascending: true });
      
      if (episodesError) {
        console.error('[finalize] 获取剧集数据失败:', episodesError);
      } else if (episodes) {
        allEpisodesStoryboards = episodes.map(ep => ({
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          storyboards: ep.storyboards || []
        }));
      }
      
      // 获取场景照数据（包含提示词）
      const { data: seriesData } = await supabase
        .from('drama_series')
        .select('metadata')
        .eq('id', seriesId)
        .single();
      
      const metadata = seriesData?.metadata as Record<string, unknown> | null;
      if (metadata?.sceneImages) {
        sceneImagesWithPrompts = metadata.sceneImages as unknown[];
      }
    }

    // 汇总所有步骤的结果，生成完整的短剧配置方案
    const finalConfig = {
      // 基本信息
      title: seriesTitle || context.title || `${input.genre}短剧`,
      genre: input.genre,
      duration: '300秒',
      aspectRatio: '9:16',
      resolution: '1080P',
      
      // 核心冲突
      coreConflict: input.conflict,
      
      // 角色档案
      characters: context.characters || [],
      
      // 当前分镜剧本（单集）
      storyboards: context.storyboards || [],
      
      // 全剧集分镜数据
      allEpisodesStoryboards: allEpisodesStoryboards.length > 0 ? allEpisodesStoryboards : undefined,
      
      // 场景照（包含提示词）
      sceneImages: sceneImagesWithPrompts.length > 0 ? sceneImagesWithPrompts : context.sceneImages || [],
      
      // 一致性规则
      consistencyRules: {
        character: {
          description: '人物全程一致',
          rules: [
            '不换脸、不变装、不换发型',
            '表情统一：平静微严肃、开心浅笑、生气皱眉、委屈垂眼',
            '微动作统一：思考摸下巴、紧张扣手指',
            '站位统一：主角在画面黄金分割点'
          ]
        },
        visual: {
          description: '画面全程一致',
          rules: [
            '比例：9:16竖屏',
            '风格：超写实真人电影风',
            '色调：暖白光4500K',
            '运镜：90%静止，8%推进，2%平移'
          ]
        },
        audio: {
          description: '声音全程一致',
          rules: [
            '每个角色绑定唯一音色',
            '人声：-16 LUFS',
            'BGM：-24 LUFS',
            '室内混响15%，室外无混响'
          ]
        }
      },
      
      // 节奏锚点
      rhythmAnchors: [
        { time: '0-3秒', event: '强钩子' },
        { time: '30秒', event: '第一次冲突' },
        { time: '90秒', event: '第一次反转' },
        { time: '150秒', event: '情绪最高点' },
        { time: '210秒', event: '第二次反转' },
        { time: '270-300秒', event: '强结尾+留悬念' }
      ],
      
      // 生成时间
      generatedAt: new Date().toISOString(),
      
      // 平台信息
      platform: '扣子(Coze) AI应用开发平台'
    };

    // 保存工作流历史到数据库
    if (seriesId) {
      // 获取现有 metadata
      const { data: existingSeries } = await supabase
        .from('drama_series')
        .select('metadata')
        .eq('id', seriesId)
        .single();

      const existingMetadata = (existingSeries?.metadata as Record<string, unknown>) || {};
      const existingHistory = (existingMetadata.workflow_history as unknown[]) || [];

      // 创建新的历史记录
      const historyEntry = {
        id: `wh_${Date.now()}`,
        executedAt: new Date().toISOString(),
        title: seriesTitle || '工作流执行',
        input: {
          genre: input.genre,
          style: input.style,
          totalEpisodes: input.totalEpisodes,
          characterCount: input.characterCount,
          coreConflictTypes: input.coreConflictTypes,
        },
        result: {
          charactersCount: context.characters?.length || 0,
          storyboardsCount: context.storyboards?.length || 0,
          sceneImagesCount: sceneImagesWithPrompts.length || context.sceneImages?.length || 0,
        },
        config: finalConfig,
      };

      // 更新 metadata，添加新的历史记录
      const updatedMetadata = {
        ...existingMetadata,
        workflow_history: [historyEntry, ...existingHistory].slice(0, 20), // 保留最近20条
      };

      await supabase
        .from('drama_series')
        .update({ metadata: updatedMetadata })
        .eq('id', seriesId);
    }

    return NextResponse.json({
      success: true,
      config: finalConfig,
      message: '短剧配置方案生成完成'
    });
  } catch (error) {
    console.error('生成最终配置失败:', error);
    return NextResponse.json(
      { error: '生成最终配置失败' },
      { status: 500 }
    );
  }
}
