import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoGenerationClient, Config, HeaderUtils, APIError } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS, SOLUTION_PRESETS, SolutionType } from '@/lib/config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { getOrCreateCollectionForSeries, updateCollectionVideoCount } from '@/lib/video-collection';

// 本地接口定义，避免使用 any/unknown 导致类型安全问题
interface VideoGenParams {
  prompt?: string;
  disableLastFrame?: boolean;
  firstFrameUrl?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
}

interface StoryboardItem {
  id?: string;
  type?: string;
  sequence?: number;
  scene?: {
    description?: string;
  };
  videoGeneration?: VideoGenParams;
  prompt?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
}

interface BackgroundTaskData {
  id: string;
  series_id?: string;
  episode_number?: number;
  progress?: number;
  current_item?: string;
  total?: number;
  status?: string;
  updated_at?: string;
  result?: {
    storyboards?: StoryboardItem[];
    results?: unknown[];
    failedIndices?: number[];
  };
}

interface ZhipuVideoResponse {
  id?: string;
  task_id?: string;
  task_status?: string;
  status?: string;
  video_result?: Array<{ url?: string; cover_image_url?: string }>;
}

interface ContentItem {
  type: 'image_url' | 'text';
  image_url?: { url: string };
  role?: string;
  text?: string;
}

/**
 * 获取用户的方案选择
 */
async function getUserSolution(userId: string): Promise<SolutionType> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('user_config')
    .select('solution_preset')
    .eq('user_id', userId)
    .single();
  
  const preset = data?.solution_preset;
  if (preset === 'seedance-1-5-pro' || preset === 'standard' || !preset) {
    return 'standard';
  }
  return preset as SolutionType;
}

/**
 * 单步执行后台任务 - 带重试机制
 * 每次只生成一个视频，避免长时间运行的任务被中断
 * 支持失败自动重试（最多3次，指数退避）
 */

// 重试配置 - 针对限流优化
const RETRY_CONFIG = {
  maxRetries: 3,           // 最大重试次数
  baseDelay: 30000,        // 基础延迟 30秒（应对限流）
  maxDelay: 180000,        // 最大延迟 3分钟
  backoffMultiplier: 2,    // 退避倍数
  rateLimitDelay: 60000,   // 限流时等待 60秒
};

// 计算重试延迟（指数退避）
function getRetryDelay(retryCount: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  
  if (!taskId) {
    return NextResponse.json({ error: '缺少taskId' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  try {
    // 获取任务信息
    const { data: task, error: fetchError } = await supabase
      .from('video_generation_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 检查任务状态
    if (task.status === 'completed') {
      return NextResponse.json({ 
        success: true, 
        message: '任务已完成',
        task,
        done: true
      });
    }

    if (task.status === 'failed') {
      return NextResponse.json({ 
        success: false, 
        message: '任务已失败',
        task 
      });
    }

    // 获取当前进度和重试信息
    const currentProgress = task.progress || 0;
    const result = task.result as {
      storyboards?: StoryboardItem[];
      results?: Array<{
        storyboardId: string;
        success: boolean;
        videoUrl?: string;
        error?: string;
        retryCount?: number;
      }>;
      failedIndices?: number[];  // 记录失败的索引
    } || {};
    
    const storyboards = (result.storyboards || []) as StoryboardItem[];
    
    if (storyboards.length === 0) {
      return NextResponse.json({ 
        error: '没有找到分镜数据',
        done: true 
      }, { status: 400 });
    }

    // 获取用户ID和方案（提前获取，用于重试逻辑）
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);
    
    // 获取剧名和剧集编号
    const { data: series } = await supabase
      .from('drama_series')
      .select('title')
      .eq('id', task.series_id)
      .single();
    const seriesTitle = series?.title || '未知剧名';
    const epNum = task.episode_number || 1;
    
    // 获取或创建该剧本的视频合集
    let collectionId: string | null = null;
    if (task.series_id) {
      const collection = await getOrCreateCollectionForSeries(task.series_id, seriesTitle);
      collectionId = collection?.id || null;
    }

    // 检查是否已完成
    if (currentProgress >= storyboards.length) {
      // 检查是否有失败的视频需要重试
      const failedIndices = result.failedIndices || [];
      
      if (failedIndices.length > 0) {
        // 还有失败的视频，尝试重试
        const nextFailedIndex = failedIndices[0];
        const retryResult = await retryFailedVideo(
          task,
          nextFailedIndex,
          storyboards[nextFailedIndex],
          result,
          request.headers,
          userId,
          solution
        );
        
        return NextResponse.json(retryResult);
      }
      
      // 全部完成
      await supabase
        .from('video_generation_tasks')
        .update({
          status: 'completed',
          current_item: '所有视频生成完成',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      
      return NextResponse.json({
        success: true,
        message: '任务已完成',
        done: true,
        progress: currentProgress,
        total: storyboards.length,
      });
    }

    // 更新任务状态为运行中
    await supabase
      .from('video_generation_tasks')
      .update({ 
        status: 'running', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);

    // 获取当前要生成的分镜
    const storyboard = storyboards[currentProgress];
    const videoGen = storyboard.videoGeneration as Record<string, unknown> | undefined;

    // 获取上一镜头的尾帧URL（如果有）
    let lastFrameUrl: string | null = null;
    if (currentProgress > 0) {
      // 从上一个视频的 metadata 中获取尾帧图URL
      const { data: lastVideo } = await supabase
        .from('video_materials')
        .select('metadata, file_key')
        .eq('series_id', task.series_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // 优先使用 metadata 中的尾帧图，如果没有则使用视频URL作为备选
      if (lastVideo?.metadata?.lastFrameUrl) {
        lastFrameUrl = lastVideo.metadata.lastFrameUrl as string;
        console.log(`[单步执行 ${taskId}] 使用上一个视频的尾帧图作为首帧`);
      } else if (lastVideo?.file_key) {
        // 备选：如果API支持直接用视频URL作为参考
        console.log(`[单步执行 ${taskId}] 警告：上一个视频没有尾帧图，视频连贯性可能受影响`);
      }
    }

    // 提取请求头用于转发认证
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 构建视频生成内容
    const content: ContentItem[] = [];
    
    // 首帧图
    if (videoGen?.firstFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: videoGen.firstFrameUrl as string },
        role: 'first_frame',
      });
    } else if (lastFrameUrl && currentProgress > 0) {
      content.push({
        type: 'image_url',
        image_url: { url: lastFrameUrl },
        role: 'first_frame',
      });
    }

    // 添加文本描述
    const prompt = (videoGen?.prompt as string) || storyboard.scene?.description || storyboard.prompt || '';
    if (prompt) {
      content.push({
        type: 'text',
        text: prompt.substring(0, 2000),
      });
    }

    console.log(`[单步执行 ${taskId}] 生成第 ${currentProgress + 1}/${storyboards.length} 个视频 (方案: ${solution})`);

    // 带重试的视频生成
    const generateResult = await generateVideoWithRetry(
      content,
      videoGen,
      storyboard,
      currentProgress,
      taskId,
      customHeaders,
      userId,
      solution
    );

    if (generateResult.success && generateResult.videoUrl) {
      console.log(`[单步执行 ${taskId}] 第 ${currentProgress + 1} 个视频生成成功`);
      
      // 构建视频标题，命名规则：
      // - 开篇钩子：剧名+钩子
      // - 结尾悬念：剧名+结尾
      // - 普通分镜：剧名+第X集第X个分镜
      const storyboardType = storyboard.type;
      let videoTitle: string;
      if (storyboardType === 'opening') {
        videoTitle = `${seriesTitle}钩子`;
      } else if (storyboardType === 'ending') {
        videoTitle = `${seriesTitle}结尾`;
      } else {
        // 普通分镜，使用storyboard.sequence或索引
        const seq = storyboard.sequence || (currentProgress + 1);
        videoTitle = `${seriesTitle}第${epNum}集第${seq}个分镜`;
      }
      
      // 保存到 video_materials 表
      console.log(`[单步执行 ${taskId}] 保存视频到数据库: ${generateResult.videoUrl?.substring(0, 50)}...`);
      const { error: insertError } = await supabase
        .from('video_materials')
        .insert({
          title: videoTitle,
          description: prompt.substring(0, 500),
          file_key: generateResult.videoUrl,
          file_name: `ai-generated-${taskId}-${currentProgress + 1}.mp4`,  // 添加必填字段
          file_size: 0,  // AI生成的视频没有文件大小信息，设为0
          duration: (videoGen?.duration as number) || storyboard.duration || 6,
          status: 'uploaded',
          metadata: {
            taskId,
            seriesId: task.series_id,
            episodeNumber: task.episode_number,
            storyboardId: storyboard.id,
            generatedAt: new Date().toISOString(),
            retryCount: generateResult.retryCount,
            lastFrameUrl: generateResult.lastFrameUrl, // 保存尾帧图用于下一个视频的首帧
          },
          series_id: task.series_id,
          episode_number: task.episode_number,  // 添加剧集编号，用于视频列表过滤
          collection_id: collectionId,  // 关联合集
        });
      
      if (insertError) {
        console.error(`[单步执行 ${taskId}] 保存视频失败:`, insertError);
      } else {
        console.log(`[单步执行 ${taskId}] 视频保存成功`);
        // 更新合集视频数量
        if (collectionId) {
          await updateCollectionVideoCount(collectionId);
        }
      }

      // 更新进度和结果
      const newProgress = currentProgress + 1;
      const results = result.results || [];
      // 使用与前端一致的 ID 格式：storyboard.id 或 index-${index}
      const storyboardId = storyboard.id || `index-${currentProgress}`;
      results.push({
        storyboardId,
        success: true,
        videoUrl: generateResult.videoUrl,
        retryCount: generateResult.retryCount,
      });
      
      const isComplete = newProgress >= storyboards.length;
      const failedIndices = result.failedIndices || [];
      
      await supabase
        .from('video_generation_tasks')
        .update({
          progress: newProgress,
          status: isComplete && failedIndices.length === 0 ? 'completed' : 'running',
          current_item: isComplete 
            ? `完成: ${results.filter(r => r.success).length}/${storyboards.length} 个视频成功`
            : `已完成 ${newProgress}/${storyboards.length}，等待继续...`,
          result: {
            ...result,
            results,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      return NextResponse.json({
        success: true,
        message: `第 ${currentProgress + 1}/${storyboards.length} 个视频生成成功${generateResult.retryCount ? ` (重试${generateResult.retryCount}次)` : ''}`,
        progress: newProgress,
        total: storyboards.length,
        done: isComplete && failedIndices.length === 0,
        videoUrl: generateResult.videoUrl,
        retryCount: generateResult.retryCount,
        storyboardId,  // 添加 storyboardId，用于前端更新按钮状态
      });
    } else {
      // 生成失败，记录失败信息
      console.error(`[单步执行 ${taskId}] 第 ${currentProgress + 1} 个视频生成失败: ${generateResult.error}`);
      
      const newProgress = currentProgress + 1;
      const results = result.results || [];
      const failedIndices = result.failedIndices || [];
      // 使用与前端一致的 ID 格式：storyboard.id 或 index-${index}
      const storyboardId = storyboard.id || `index-${currentProgress}`;
      
      // 如果还有重试机会，添加到失败列表
      if (generateResult.retryCount && generateResult.retryCount < RETRY_CONFIG.maxRetries) {
        failedIndices.push(currentProgress);
      }
      
      results.push({
        storyboardId,
        success: false,
        error: generateResult.error,
        retryCount: generateResult.retryCount,
      });
      
      await supabase
        .from('video_generation_tasks')
        .update({
          progress: newProgress,
          current_item: `第 ${currentProgress + 1} 个失败: ${generateResult.error?.substring(0, 30)}`,
          result: {
            ...result,
            results,
            failedIndices,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      return NextResponse.json({
        success: false,
        message: `视频生成失败: ${generateResult.error}`,
        progress: newProgress,
        total: storyboards.length,
        done: false,
        error: generateResult.error,
        willRetry: failedIndices.includes(currentProgress),
      });
    }

  } catch (error) {
    console.error('[单步执行] 错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '服务器错误',
      done: false
    }, { status: 500 });
  }
}

// 带重试的视频生成
async function generateVideoWithRetry(
  content: ContentItem[],
  videoGen: Record<string, unknown> | undefined,
  storyboard: StoryboardItem,
  index: number,
  taskId: string,
  customHeaders: Record<string, string>,
  userId: string,
  solution: SolutionType
): Promise<{ success: boolean; videoUrl?: string; lastFrameUrl?: string; error?: string; retryCount?: number; isRateLimited?: boolean }> {
  
  let lastError: string | undefined;
  let isRateLimited = false;
  const useZhipu = solution === 'zhipu';
  
  // 提取通用参数
  const prompt = (videoGen?.prompt as string) || storyboard.scene?.description || storyboard.prompt || '';
  const duration = Math.max(4, Math.min((videoGen?.duration as number) || storyboard.duration || 15, 15));
  const ratio = (videoGen?.ratio as '16:9') || '16:9';
  const resolution = (videoGen?.resolution as '720p') || '720p';
  
  // 获取首帧图URL
  const firstFrameItem = (content as ContentItem[]).find((c: ContentItem) => c.role === 'first_frame');
  const firstFrameUrl = firstFrameItem?.image_url?.url as string | undefined;
  
  let lastFrameUrl: string | null = null; // 尾帧图URL
  
  for (let retry = 0; retry <= RETRY_CONFIG.maxRetries; retry++) {
    try {
      // 非首次尝试时，添加延迟
      if (retry > 0) {
        // 如果是限流错误，使用更长的延迟
        const delayMs = isRateLimited 
          ? RETRY_CONFIG.rateLimitDelay 
          : getRetryDelay(retry - 1);
        console.log(`[重试 ${taskId}] 第 ${index + 1} 个视频第 ${retry} 次重试，等待 ${delayMs}ms${isRateLimited ? ' (限流恢复)' : ''}`);
        await delay(delayMs);
      }
      
      let videoUrl: string | null = null;
      
      if (useZhipu) {
        // ===== 智谱方案 =====
        const zhipuClient = await getZhipuClientAsync(userId);
        
        // 创建视频生成任务
        const taskResponse = (await zhipuClient.generateVideo(prompt.substring(0, 2000), {
          model: SOLUTION_PRESETS.zhipu.models.video,
          firstFrameImage: firstFrameUrl,
          generateAudio: videoGen?.generateAudio as boolean ?? true,
        }) as unknown as ZhipuVideoResponse);
        
        const zhipuTaskId = taskResponse.id || taskResponse.task_id;
        const taskStatus = taskResponse.task_status || taskResponse.status;
        
        // 如果任务立即完成
        if (taskStatus === 'SUCCESS' && taskResponse.video_result?.length) {
          videoUrl = taskResponse.video_result[0].url || null;
          lastFrameUrl = taskResponse.video_result[0].cover_image_url || null;
        } else if (!zhipuTaskId) {
          throw new Error('智谱视频创建失败：未返回任务ID');
        } else {
          // 轮询任务状态（最多等待5分钟）
          // 智谱视频生成通常需要2-5分钟
          const maxWaitTime = 5 * 60 * 1000;
          const pollInterval = 30000; // 30秒
          const startTime = Date.now();
          
          // 首次查询前等待更长时间
          console.log(`[智谱 ${taskId}] 第 ${index + 1} 个视频: 等待30秒后开始查询...`);
          await delay(30000);
          
          while (Date.now() - startTime < maxWaitTime) {
            const statusResponse = (await zhipuClient.getVideoTask(zhipuTaskId)) as unknown as ZhipuVideoResponse;
            const pollStatus = statusResponse.task_status || statusResponse.status;
            const videoResult = statusResponse.video_result || statusResponse.video_result;
            
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`[智谱 ${taskId}] 第 ${index + 1} 个视频: 状态=${pollStatus}, 已等待${elapsed}秒`);
            
            if (pollStatus === 'SUCCESS' && videoResult?.length) {
              videoUrl = videoResult[0].url || null;
              lastFrameUrl = videoResult[0].cover_image_url || null;
              break;
            } else if (pollStatus === 'FAILED') {
              throw new Error('智谱视频生成任务失败');
            }
            
            await delay(pollInterval);
          }
          
          if (!videoUrl) {
            throw new Error('智谱视频生成超时（5分钟）');
          }
        }
        
      } else {
        // ===== 扣子方案 =====
        const config = new Config();
        const videoClient = new VideoGenerationClient(config, customHeaders);
        
        const response = await videoClient.videoGeneration(content as unknown as never, {
          model: DEFAULT_MODELS.video,
          duration,
          ratio,
          resolution,
          generateAudio: videoGen?.generateAudio as boolean ?? true,
          watermark: false,
          maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
        });

        videoUrl = response.videoUrl;
        lastFrameUrl = response.lastFrameUrl || null;
      }

      if (videoUrl) {
        return { 
          success: true, 
          videoUrl,
          lastFrameUrl: lastFrameUrl || undefined,
          retryCount: retry > 0 ? retry : undefined,
        };
      } else {
        lastError = 'API返回空URL';
        isRateLimited = false;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : '未知错误';
      
      // 检查智谱限流错误
      if (useZhipu && (
        lastError.includes('429') ||
        lastError.includes('rate limit') ||
        lastError.includes('速率限制')
      )) {
        isRateLimited = true;
        console.log(`[限流检测] 任务 ${taskId} 智谱API限流，将在下次重试时等待 ${RETRY_CONFIG.rateLimitDelay}ms`);
        continue;
      }
      
      // 检查扣子限流错误
      if (!useZhipu && error instanceof APIError) {
        const apiError = error as APIError & { response?: { error?: { code?: string } } };
        const errorCode = apiError.response?.error?.code;
        
        console.error(`[重试 ${taskId}] 第 ${index + 1} 个视频尝试 ${retry + 1} 失败:`, {
          message: lastError,
          statusCode: apiError.statusCode,
          errorCode,
        });
        
        // 检测限流错误
        if (
          errorCode === 'ErrTooManyRequests' ||
          apiError.statusCode === 429 ||
          lastError.includes('429') || 
          lastError.includes('rate limit') || 
          lastError.includes('限流') ||
          lastError.includes('TooManyRequests')
        ) {
          isRateLimited = true;
          console.log(`[限流检测] 任务 ${taskId} 触发限流，将在下次重试时等待 ${RETRY_CONFIG.rateLimitDelay}ms`);
          continue;
        }
      } else {
        console.error(`[重试 ${taskId}] 第 ${index + 1} 个视频尝试 ${retry + 1} 失败:`, lastError);
      }
      
      // 检查是否是其他可重试错误
      if (lastError.includes('429') || lastError.includes('rate limit') || lastError.includes('quota') || lastError.includes('限流')) {
        isRateLimited = true;
        continue;
      }
      
      // 其他错误，如果是首次尝试，继续重试一次
      if (retry === 0) {
        isRateLimited = false;
        continue;
      }
    }
  }
  
  return { 
    success: false, 
    error: lastError || '重试次数用尽',
    retryCount: RETRY_CONFIG.maxRetries,
    isRateLimited,
  };
}

// 重试失败的视频
async function retryFailedVideo(
  task: BackgroundTaskData,
  index: number,
  storyboard: StoryboardItem,
  result: BackgroundTaskData["result"],
  headers: Headers,
  userId: string,
  solution: SolutionType
): Promise<{ success: boolean; message: string; done?: boolean; progress?: number; total?: number; videoUrl?: string; error?: string } | void> {
  const supabase = getSupabaseClient();
  const taskId = task.id;
  
  console.log(`[重试失败] 任务 ${taskId} 重试第 ${index + 1} 个视频 (方案: ${solution})`);
  
  // 获取之前生成的结果
  const results = result?.results || [];
  const previousResult = (results[index] as { retryCount?: number } | undefined);
  
  // 检查重试次数
  const currentRetryCount = previousResult?.retryCount || 0;
  if (currentRetryCount >= RETRY_CONFIG.maxRetries) {
    // 已达最大重试次数，从失败列表中移除
    const failedIndices = (result?.failedIndices || []).filter((i: number) => i !== index);
    
    await supabase
      .from('video_generation_tasks')
      .update({
        current_item: `第 ${index + 1} 个视频已达最大重试次数`,
        result: {
          ...(result || {}),
          failedIndices,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    
    return {
      success: false,
      message: `第 ${index + 1} 个视频已达最大重试次数`,
      done: failedIndices.length === 0,
    };
  }
  
  // 获取上一镜头的尾帧URL
  let lastFrameUrl: string | null = null;
  if (index > 0) {
    const { data: lastVideo } = await supabase
      .from('video_materials')
      .select('file_key')
      .eq('series_id', task.series_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastVideo?.file_key) {
      lastFrameUrl = lastVideo.file_key;
    }
  }
  
  const videoGen = storyboard.videoGeneration as Record<string, unknown> | undefined;
  const customHeaders = HeaderUtils.extractForwardHeaders(headers);
  
  // 构建内容
  const content: ContentItem[] = [];
  
  if (videoGen?.firstFrameUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: videoGen.firstFrameUrl as string },
      role: 'first_frame',
    });
  } else if (lastFrameUrl && index > 0) {
    content.push({
      type: 'image_url',
      image_url: { url: lastFrameUrl },
      role: 'first_frame',
    });
  }
  
  const prompt = (videoGen?.prompt as string) || storyboard.scene?.description || storyboard.prompt || '';
  if (prompt) {
    content.push({
      type: 'text',
      text: prompt.substring(0, 2000),
    });
  }
  
  // 重试生成
  const generateResult = await generateVideoWithRetry(
    content,
    videoGen,
    storyboard,
    index,
    taskId,
    customHeaders,
    userId,
    solution
  );
  
  // 更新结果
  const failedIndices = result?.failedIndices || [];
  results[index] = {
    ...((results[index] as Record<string, unknown>) || {}),
    success: generateResult.success,
    videoUrl: generateResult.videoUrl,
    error: generateResult.error,
    retryCount: currentRetryCount + (generateResult.retryCount || 1),
  };
  
  if (generateResult.success) {
    // 从失败列表中移除
    const newFailedIndices = failedIndices.filter((i: number) => i !== index);
    
    // 获取剧名（在retryFailedVideo函数中需要重新获取）
    const { data: series } = await supabase
      .from('drama_series')
      .select('title')
      .eq('id', task.series_id)
      .single();
    const seriesTitle = series?.title || '未知剧名';
    const epNum = task.episode_number || 1;
    
    // 构建视频标题，命名规则（重试视频也遵循相同规则，可加重试标识）：
    // - 开篇钩子：剧名+钩子(重试)
    // - 结尾悬念：剧名+结尾(重试)
    // - 普通分镜：剧名+第X集第X个分镜(重试)
    const storyboardType = storyboard.type;
    let videoTitle: string;
    if (storyboardType === 'opening') {
      videoTitle = `${seriesTitle}钩子(重试)`;
    } else if (storyboardType === 'ending') {
      videoTitle = `${seriesTitle}结尾(重试)`;
    } else {
      const seq = storyboard.sequence || (index + 1);
      videoTitle = `${seriesTitle}第${epNum}集第${seq}个分镜(重试)`;
    }
    
    // 获取或创建合集
    let collectionId: string | null = null;
    if (task.series_id) {
      const collection = await getOrCreateCollectionForSeries(task.series_id, seriesTitle);
      collectionId = collection?.id || null;
    }
    
    // 保存视频
    await supabase
      .from('video_materials')
      .insert({
        title: videoTitle,
        description: prompt.substring(0, 500),
        file_key: generateResult.videoUrl,
        file_name: `ai-generated-${taskId}-retry-${index + 1}.mp4`,  // 添加必填字段
        file_size: 0,  // AI生成的视频没有文件大小信息，设为0
        duration: (videoGen?.duration as number) || storyboard.duration || 6,
        status: 'uploaded',
        metadata: {
          taskId,
          seriesId: task.series_id,
          episodeNumber: task.episode_number,
          storyboardId: storyboard.id,
          generatedAt: new Date().toISOString(),
          isRetry: true,
          retryCount: (results[index] as { retryCount?: number })?.retryCount,
        },
        series_id: task.series_id,
        episode_number: task.episode_number,  // 添加剧集编号，用于视频列表过滤
        collection_id: collectionId,  // 关联合集
      });
    
    // 更新合集视频数量
    if (collectionId) {
      await updateCollectionVideoCount(collectionId);
    }
    
    await supabase
      .from('video_generation_tasks')
      .update({
        current_item: `重试成功: 第 ${index + 1} 个视频`,
        result: {
          ...result,
          results,
          failedIndices: newFailedIndices,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    
    return {
      success: true,
      message: `第 ${index + 1} 个视频重试成功`,
      progress: task.progress,
      total: result?.storyboards?.length || 0,
      done: newFailedIndices.length === 0,
      videoUrl: generateResult.videoUrl,
    };
  } else {
    // 更新失败信息
    await supabase
      .from('video_generation_tasks')
      .update({
        current_item: `重试失败: 第 ${index + 1} 个视频 - ${generateResult.error?.substring(0, 30)}`,
        result: {
          ...result,
          results,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    
    return {
      success: false,
      message: `第 ${index + 1} 个视频重试失败: ${generateResult.error}`,
      progress: task.progress,
      total: result?.storyboards?.length || 0,
      done: false,
      error: generateResult.error,
    };
  }
}
