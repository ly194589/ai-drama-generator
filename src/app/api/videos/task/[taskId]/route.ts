import { NextRequest, NextResponse } from 'next/server';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 查询视频任务状态
 * 
 * GET /api/videos/task/[taskId]
 * 
 * 用于查询智谱视频生成任务的状态
 * 
 * Query参数:
 * - save: boolean - 是否保存视频到数据库（默认true）
 * - title: string - 视频标题
 * - prompt: string - 视频描述/提示词
 * - seriesId: string - 剧本ID
 * - episodeNumber: number - 剧集编号
 * - storyboardId: string - 分镜ID
 * - hookType: 'hook' | 'cliffhanger' | 'storyboard'
 * - solution: 'zhipu' - 任务来源方案
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const userId = request.headers.get('x-user-id') || 'dev-user';
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const shouldSave = searchParams.get('save') !== 'false';
    const inputTitle = searchParams.get('title');
    const prompt = searchParams.get('prompt') || null;
    const seriesId = searchParams.get('seriesId') || null;
    const episodeNumber = searchParams.get('episodeNumber');
    const storyboardId = searchParams.get('storyboardId') || null;
    const hookTypeParam = searchParams.get('hookType') as 'hook' | 'cliffhanger' | 'storyboard' | null;
    const hookType = hookTypeParam || 'storyboard';
    const solution = searchParams.get('solution') as 'zhipu' | null;
    const sortOrderParam = searchParams.get('sortOrder');
    const sortOrder = sortOrderParam ? parseInt(sortOrderParam, 10) : undefined;
    
    // 视频标题命名规则
    const videoTitle = inputTitle && inputTitle.trim() 
      ? inputTitle.trim() 
      : `AI生成视频 ${new Date().toLocaleString('zh-CN')}`;
    
    if (!taskId) {
      return NextResponse.json(
        { error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    console.log(`[视频任务查询] taskId: ${taskId}, userId: ${userId}, solution: ${solution}`, {
      shouldSave,
      videoTitle,
      seriesId,
      episodeNumber,
      storyboardId,
    });

    // 智谱任务查询
    return await queryZhipuTask(taskId, {
      shouldSave,
      inputTitle,
      prompt,
      seriesId,
      episodeNumber,
      storyboardId,
      hookType,
      sortOrder,
    });
  } catch (error) {
    console.error('[视频任务查询] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * 查询智谱任务状态
 */
async function queryZhipuTask(
  taskId: string,
  params: {
    shouldSave: boolean;
    inputTitle?: string | null;
    prompt?: string | null;
    seriesId?: string | null;
    episodeNumber?: string | null;
    storyboardId?: string | null;
    hookType: 'hook' | 'cliffhanger' | 'storyboard';
    sortOrder?: number;
  }
) {
  const { shouldSave, inputTitle, prompt, seriesId, episodeNumber, storyboardId, hookType, sortOrder } = params;

  // 构建响应对象
  const response: {
    id: string;
    status: string;
    videoUrl?: string;
    coverUrl?: string;
    duration?: number;
    model?: string;
    saved?: boolean;
    solution?: string;
  } = {
    id: taskId,
    status: 'PROCESSING',
    solution: 'zhipu',
  };

  // 检查智谱API是否配置
  const configured = await isZhipuConfiguredForUser('dev-user');
  if (!configured) {
    return NextResponse.json(
      { error: '智谱API未配置' },
      { status: 400 }
    );
  }

  // 获取智谱客户端
  const client = await getZhipuClientAsync('dev-user');
  
  // 查询任务状态
  const result = await client.getVideoTask(taskId);
  
  console.log(`[智谱任务查询] taskId: ${taskId}, status: ${result.task_status}`, {
    hasVideo: !!result.video_result?.[0]?.url,
    hasCover: !!result.video_result?.[0]?.cover_image_url,
  });

  response.status = result.task_status || 'PROCESSING';
  response.model = result.model;

  // 如果任务成功，提取视频信息
  if (result.task_status === 'SUCCESS' && result.video_result?.[0]) {
    const video = result.video_result[0];
    response.videoUrl = video.url;
    response.coverUrl = video.cover_image_url;
    response.duration = video.duration;
    
    // 保存视频到数据库
    if (shouldSave && video.url) {
      await saveVideoToDatabase({
        videoUrl: video.url,
        prompt: prompt || '智谱生成视频',
        seriesId,
        episodeNumber,
        storyboardId,
        hookType,
        inputTitle,
        model: result.model || 'cogvideox-3',
        coverUrl: video.cover_image_url,
        sortOrder,
      });
      response.saved = true;
    }
  }

  return NextResponse.json(response);
}

/**
 * 保存视频到数据库
 */
async function saveVideoToDatabase(params: {
  videoUrl: string;
  prompt: string;
  seriesId?: string | null;
  episodeNumber?: string | null;
  storyboardId?: string | null;
  hookType: 'hook' | 'cliffhanger' | 'storyboard';
  inputTitle?: string | null;
  model: string;
  coverUrl?: string;
  ratio?: string;
  resolution?: string;
  duration?: number;
  sortOrder?: number | null;
}) {
  const { videoUrl, prompt, seriesId, episodeNumber, storyboardId, hookType, inputTitle, model, coverUrl, ratio, resolution, duration, sortOrder: paramsSortOrder } = params;
  
  try {
    const supabase = getSupabaseClient();
    
    // 获取剧名（用于生成标题）
    let seriesTitle = '';
    if (seriesId) {
      const { data: series } = await supabase
        .from('drama_series')
        .select('title')
        .eq('id', seriesId)
        .single();
      seriesTitle = series?.title || '';
    }
    
    // 根据hookType生成标题
    const epNum = episodeNumber ? parseInt(episodeNumber, 10) : 1;
    const storyboardNum = storyboardId && storyboardId.match(/^sb-\d+-(\d+)$/)
      ? parseInt(storyboardId.match(/^sb-\d+-(\d+)$/)?.[1] || '0', 10)
      : null;
    let finalTitle: string;
    if (hookType === 'hook') {
      finalTitle = seriesTitle ? `${seriesTitle}钩子` : '开篇钩子视频';
    } else if (hookType === 'cliffhanger') {
      finalTitle = seriesTitle ? `${seriesTitle}结尾` : '结尾悬念视频';
    } else {
      finalTitle = storyboardNum !== null
        ? `${seriesTitle ? seriesTitle + '第' + epNum + '集' : '第' + epNum + '集'}分镜${storyboardNum}`
        : `${seriesTitle ? seriesTitle + '第' + epNum + '集' : '第' + epNum + '集'}分镜`;
    }
    
    // 查找或创建合集
    let collectionId = null;
    if (seriesId) {
      const { data: existingCollection } = await supabase
        .from('video_collections')
        .select('id')
        .eq('series_id', seriesId)
        .single();
      
      if (existingCollection) {
        collectionId = existingCollection.id;
      } else {
        const { data: newCollection } = await supabase
          .from('video_collections')
          .insert({
            title: seriesTitle || '未命名合集',
            series_id: seriesId,
          })
          .select('id')
          .single();
        
        collectionId = newCollection?.id;
      }
    }
    
    // sortOrder：优先使用外部传入的参数，否则从 storyboardId 中提取
    let finalSortOrder: number | null = paramsSortOrder ?? null;
    if (finalSortOrder === null && storyboardId && storyboardId.match(/^sb-\d+-(\d+)$/)) {
      finalSortOrder = parseInt(storyboardId.match(/^sb-\d+-(\d+)$/)?.[1] || '0', 10) - 1;
    }
    
    // 保存到 videos 表
    const { data: savedVideo, error: saveError } = await supabase
      .from('videos')
      .insert({
        title: finalTitle,
        prompt: prompt,
        video_url: videoUrl,
        duration: duration || 15,
        ratio: ratio || '16:9',
        resolution: resolution || '1080p',
        file_size: 0,
        model: model,
        collection_id: collectionId,
        episode_number: episodeNumber ? parseInt(episodeNumber, 10) : null,
        status: 'completed',
        hook_type: hookType,
        last_frame_url: coverUrl,
        sort_order: finalSortOrder,
      })
      .select('id')
      .single();
    
    if (saveError) {
      console.error('[视频保存] 保存失败:', saveError);
    } else {
      console.log('[视频保存] 视频已保存:', savedVideo?.id);
    }
  } catch (error) {
    console.error('[视频保存] 保存异常:', error);
  }
}
