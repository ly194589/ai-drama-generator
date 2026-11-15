import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoGenerationClient, Config, HeaderUtils, Content } from 'coze-coding-dev-sdk';
import { getUserMemberTier } from '@/lib/quota-service';
import { enforceVideoResolution, enforceVideoDuration } from '@/lib/member-limits';

const maxDuration = 300;

/**
 * 分镜视频同步 API
 *
 * 为分镜中的场景自动生成缺失的视频素材
 * 跳过已生成的视频，只生成未有的
 *
 * 参数：
 * - storyboardIndex: 分镜索引（-1=hook, -2=cliffhanger, 0+=storyboard）
 *   不传则同步所有分镜
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; episodeNumber: string }> }
) {
  const { id, episodeNumber } = await params;
  const supabase = getSupabaseClient();

  // 获取当前用户ID
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 解析请求体，获取可选的 storyboardIndex
  let storyboardIndex: number | undefined;
  try {
    const body = await request.json();
    storyboardIndex = body?.storyboardIndex;
  } catch {
    // 没有请求体，同步所有
  }

  const modeDesc = storyboardIndex !== undefined
    ? (storyboardIndex === -1 ? '开篇钩子' : storyboardIndex === -2 ? '结尾悬念' : `分镜${storyboardIndex + 1}`)
    : '所有分镜';
  console.log(`[视频素材同步] 开始同步剧集 ${episodeNumber} ${modeDesc} 的视频素材...`);

  // 获取剧本信息
  const { data: series, error: seriesError } = await supabase
    .from('drama_series')
    .select('*')
    .eq('id', id)
    .single();

  if (seriesError || !series) {
    return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
  }

  // 获取该集剧集信息
  const { data: episode, error: episodeError } = await supabase
    .from('drama_episodes')
    .select('*')
    .eq('series_id', id)
    .eq('episode_number', parseInt(episodeNumber))
    .single();

  if (episodeError || !episode) {
    return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
  }

  // 解析分镜数据
  const storyboards = episode.storyboards || [];
  const hook = episode.hook;
  const cliffhanger = episode.cliffhanger;

  // 查询现有的视频素材
  const { data: existingVideos } = await supabase
    .from('videos')
    .select('*')
    .eq('series_id', id)
    .eq('episode_number', parseInt(episodeNumber))
    .eq('status', 'completed');

  // 构建已有视频的映射（按hook_type和sort_order）
  const existingVideosMap = new Map<string, boolean>();
  (existingVideos || []).forEach((video: Record<string, unknown>) => {
    const hookType = video.hook_type as string;
    const sortOrder = video.sort_order as number;
    const key = `${hookType}_${sortOrder}`;
    existingVideosMap.set(key, true);
  });

  // 确定需要同步的分镜
  const storyboardsToSync: Array<{ index: number; type: string; data: Record<string, unknown> }> = [];

  if (storyboardIndex === undefined || storyboardIndex === -1) {
    // 同步hook（索引为-1）
    if (hook) {
      const hasVideo = existingVideosMap.has('hook_-1');
      if (!hasVideo) {
        let hookData: Record<string, unknown> = {};
        if (typeof hook === 'string') {
          try { hookData = JSON.parse(hook); } catch { hookData = { scene: { description: hook } }; }
        } else {
          hookData = hook as Record<string, unknown>;
        }
        storyboardsToSync.push({ index: -1, type: 'hook', data: hookData });
      }
    }
  }

  if (storyboardIndex === undefined) {
    // 同步所有storyboard
    storyboards.forEach((sb: unknown, idx: number) => {
      const hasVideo = existingVideosMap.has(`storyboard_${idx}`);
      if (!hasVideo) {
        storyboardsToSync.push({ index: idx, type: 'storyboard', data: sb as Record<string, unknown> });
      }
    });
  } else if (storyboardIndex >= 0 && storyboardIndex < storyboards.length) {
    // 同步指定分镜
    const hasVideo = existingVideosMap.has(`storyboard_${storyboardIndex}`);
    if (!hasVideo) {
      storyboardsToSync.push({ index: storyboardIndex, type: 'storyboard', data: storyboards[storyboardIndex] as Record<string, unknown> });
    }
  }

  if (storyboardIndex === undefined || storyboardIndex === -2) {
    // 同步cliffhanger（索引为-2）
    if (cliffhanger) {
      const hasVideo = existingVideosMap.has('cliffhanger_-2');
      if (!hasVideo) {
        let cliffhangerData: Record<string, unknown> = {};
        if (typeof cliffhanger === 'string') {
          try { cliffhangerData = JSON.parse(cliffhanger); } catch { cliffhangerData = { scene: { description: cliffhanger } }; }
        } else {
          cliffhangerData = cliffhanger as Record<string, unknown>;
        }
        storyboardsToSync.push({ index: -2, type: 'cliffhanger', data: cliffhangerData });
      }
    }
  }

  console.log(`[视频素材同步] 需要生成 ${storyboardsToSync.length} 个视频素材`);

  // 如果没有需要生成的视频，直接返回
  if (storyboardsToSync.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        totalStoryboards: (hook ? 1 : 0) + storyboards.length + (cliffhanger ? 1 : 0),
        generatedVideos: 0,
        failedVideos: [],
        skippedVideos: existingVideosMap.size,
      },
      generated: [],
      message: '所有分镜的视频素材已完整，无需生成新视频',
    });
  }

  // 初始化视频生成客户端
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const videoClient = new VideoGenerationClient(config, customHeaders);

  // 获取用户会员等级
  const memberTier = await getUserMemberTier(userId);

  // 判断是否为宠物风
  const isPetGenre = (series.genre as string)?.includes('宠物') ||
                     (series.genre as string)?.includes('萌宠') ||
                     (series.genre as string)?.includes('动物');

  const genreStyle = isPetGenre ? '可爱宠物风格' : '古风古装风格';

  // Seedance 2.0 已全量启用，所有用户使用 Seedance 2.0
  const standardModel = 'doubao-seedance-2-0-260128';

  // 生成缺失的视频素材
  const generatedVideos: Array<{ index: number; type: string; title: string }> = [];
  const failedVideos: Array<{ index: number; type: string; error: string }> = [];

  for (const item of storyboardsToSync) {
    console.log(`[视频素材同步] 生成视频: ${item.type} 索引 ${item.index}`);

    try {
      // 提取场景描述
      const scene = item.data.scene as Record<string, unknown> | string | undefined;
      const sceneLocation = typeof scene === 'object' ? scene?.location as string : '';
      const sceneDesc = typeof scene === 'object' ? scene?.description as string : (typeof scene === 'string' ? scene : '');

      // 提取运镜信息
      const cameraMovement = item.data.cameraMovement as string || '';
      const mood = item.data.mood as string || '';
      const action = item.data.action as string || '';
      const shotType = item.data.shotType as string || '';

      // 查询场景图片URL
      const { data: sceneImage } = await supabase
        .from('scene_images')
        .select('image_url')
        .eq('series_id', id)
        .eq('title', sceneLocation)
        .single();

      const sceneImageUrl = sceneImage?.image_url || '';

      // 查询角色立绘URL（兼容 characterList 和 characters 两种字段名）
      const characters = (item.data.characterList as Array<string | { name: string }>) || 
                         (item.data.characters as Array<string | { name: string }>) || [];
      const characterNames = characters.map(c => typeof c === 'string' ? c : c.name).filter(Boolean);

      const { data: characterArtworks } = await supabase
        .from('character_artworks')
        .select('character_name, image_url')
        .eq('series_id', id)
        .in('character_name', characterNames);

      const characterImageMap = new Map<string, string>();
      (characterArtworks || []).forEach((art: { character_name: string; image_url: string }) => {
        characterImageMap.set(art.character_name, art.image_url);
      });

      // 构建视频描述提示词（使用@格式作为超链接标记）
      let prompt = '光线追踪，虚幻引擎渲染，角色发型服饰统一，真实肌肤纹理，真实布料纹理，IMAX电影质感，35mm镜头，f4光圈，胶片颗粒，电影级光线追踪，电影光影，动态流畅，运镜丝滑，无字幕，人物双脚稳站地面身体比例自然，';

      // 场景位置（使用@格式作为超链接标记）
      if (sceneLocation) {
        prompt += `@${sceneLocation}`;
      }

      // 添加场景描述（如果没有其他字段，直接拼接；否则添加逗号）
      if (sceneDesc) {
        prompt += (prompt ? ',' : '') + sceneDesc;
      }

      // 添加角色外观参考描述（确保视频中的角色与立绘一致）
      if (characterNames.length > 0) {
        const charRefs = characterNames.map(name => {
          const hasArtwork = characterImageMap.has(name);
          return hasArtwork ? `@${name}（参考角色立绘外观）` : `@${name}`;
        });
        prompt += `，角色：${charRefs.join('、')}`;
      }

      // 可选字段（只有在有值时才添加）
      if (shotType) prompt += `，镜头：${shotType}`;
      if (cameraMovement) prompt += `，运镜：${cameraMovement}`;
      if (action) prompt += `，动作：${action}`;
      if (mood && !sceneDesc.includes(mood)) prompt += `，氛围：${mood}`;

      // 添加对话内容（如果有）
      const dialogues = item.data.dialogues as Array<{ speaker: string; content: string; emotion?: string }> | undefined;
      if (dialogues && dialogues.length > 0) {
        const dialogueTexts = dialogues.map(d => {
          const emotionDesc = d.emotion ? `（${d.emotion}地）` : '';
          return `@${d.speaker}${emotionDesc}说："${d.content}"`;
        }).join('，');
        prompt += `。${dialogueTexts}`;
      }

      console.log(`[视频素材同步] 提示词: ${prompt}`);
      console.log(`[视频素材同步] 场景图: ${sceneImageUrl || '无'}, 角色立绘: ${characterNames.filter(n => characterImageMap.has(n)).join(', ') || '无'}`);

      // 提取时长
      const durationRaw = item.data.duration;
      let duration = 8; // 默认8秒
      if (durationRaw !== undefined && durationRaw !== null) {
        // 确保是字符串类型再调用 replace
        const durationStr = typeof durationRaw === 'string' 
          ? durationRaw 
          : String(durationRaw);
        const num = parseInt(durationStr.replace(/[^\d]/g, ''));
        if (!isNaN(num)) {
          duration = Math.max(4, Math.min(num, 15)); // 限制在4-15秒之间
        }
      }

      // Seedance 2.0 已全量启用，所有用户使用 Seedance 2.0（最大15秒）
      const finalDuration = enforceVideoDuration(memberTier, Math.max(duration, 12));  // 最低12秒，按会员等级限制上限
      const finalResolution = enforceVideoResolution(memberTier, '1080p');  // 默认请求1080p，按会员等级限制
      const finalRatio = '16:9';  // 固定16:9
      const finalModel = standardModel;  // 统一使用 Seedance 2.0

      console.log(`[视频素材同步] 生成参数: 模型=${finalModel}, 时长=${finalDuration}秒, 分辨率=${finalResolution}, 宽高比=${finalRatio}`);

      // 构建内容数组
      // 关键：将场景图作为首帧传入，让视频参考场景风格
      const content: Content[] = [];

      // 添加场景图作为首帧（参考图）
      if (sceneImageUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: sceneImageUrl },
          role: 'first_frame',
        });
        console.log(`[视频素材同步] 添加场景图作为首帧: ${sceneImageUrl.substring(0, 80)}...`);
      }

      // 添加文本描述
      content.push({
        type: 'text',
        text: prompt,
      });

      // 调用视频生成
      const response = await videoClient.videoGeneration(content, {
        model: finalModel,
        duration: finalDuration,
        ratio: finalRatio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive',
        resolution: finalResolution as '480p' | '720p' | '1080p',
        generateAudio: true,
        // 设置最大等待时间为5分钟（300秒）
        maxWaitTime: 300,
      });

      if (response.videoUrl) {
        // 保存视频记录
        let title = '';
        if (item.type === 'hook') {
          title = `${series.title}第${episodeNumber}集-开篇钩子`;
        } else if (item.type === 'cliffhanger') {
          title = `${series.title}第${episodeNumber}集-结尾悬念`;
        } else {
          title = `${series.title}第${episodeNumber}集-分镜${item.index + 1}`;
        }

        await supabase.from('videos').insert({
          title,
          prompt,
          video_url: response.videoUrl,
          duration: finalDuration,
          ratio: finalRatio,
          resolution: finalResolution,
          model: finalModel,
          series_id: id,
          episode_number: parseInt(episodeNumber),
          status: 'completed',
          hook_type: item.type,
          sort_order: item.index,
          user_id: userId,
        });

        generatedVideos.push({
          index: item.index,
          type: item.type,
          title,
        });

        console.log(`[视频素材同步] 视频生成成功: ${title}`);
      } else {
        failedVideos.push({
          index: item.index,
          type: item.type,
          error: '视频生成返回空结果',
        });
        console.error(`[视频素材同步] 视频生成失败: ${item.type} 索引 ${item.index} - 返回空结果`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      failedVideos.push({
        index: item.index,
        type: item.type,
        error: errorMessage,
      });
      console.error(`[视频素材同步] 视频生成失败: ${item.type} 索引 ${item.index}`, error);
    }

    // 延迟避免限流（5秒）
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log(`[视频素材同步] 完成！生成视频: ${generatedVideos.length}, 失败: ${failedVideos.length}`);

  return NextResponse.json({
    success: true,
    summary: {
      totalStoryboards: (hook ? 1 : 0) + storyboards.length + (cliffhanger ? 1 : 0),
      generatedVideos: generatedVideos.length,
      failedVideos: failedVideos.length,
      skippedVideos: existingVideosMap.size,
    },
    generated: generatedVideos,
    failed: failedVideos,
  });
}
