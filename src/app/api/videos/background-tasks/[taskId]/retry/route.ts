import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS, SOLUTION_PRESETS, SolutionType } from '@/lib/config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';

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
 * 重试失败的视频生成
 * 
 * POST: 重试指定索引的视频，或重试所有失败的视频
 * GET: 获取失败的视频列表
 */

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 5000,
  maxDelay: 60000,
  backoffMultiplier: 3,
};

function getRetryDelay(retryCount: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 获取失败的视频列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  
  if (!taskId) {
    return NextResponse.json({ error: '缺少taskId' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  try {
    const { data: task, error } = await supabase
      .from('video_generation_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const result = task.result as {
      storyboards?: StoryboardItem[];
      results?: Array<{
        storyboardId: string;
        success: boolean;
        videoUrl?: string;
        error?: string;
        retryCount?: number;
      }>;
      failedIndices?: number[];
    } || {};

    const results = result.results || [];
    const failedIndices = result.failedIndices || [];
    const storyboards = (result.storyboards || []) as StoryboardItem[];

    // 构建失败视频列表
    const failedVideos = failedIndices.map((index: number) => ({
      index,
      storyboardId: results[index]?.storyboardId || storyboards[index]?.id,
      description: storyboards[index]?.scene?.description?.substring(0, 100) || 
                   storyboards[index]?.prompt?.substring(0, 100) || '未知场景',
      error: results[index]?.error,
      retryCount: results[index]?.retryCount || 0,
      canRetry: (results[index]?.retryCount || 0) < RETRY_CONFIG.maxRetries,
    }));

    return NextResponse.json({
      success: true,
      taskId,
      status: task.status,
      totalVideos: storyboards.length,
      successCount: results.filter(r => r.success).length,
      failedCount: failedIndices.length,
      failedVideos,
      maxRetries: RETRY_CONFIG.maxRetries,
    });
  } catch (error) {
    console.error('[重试查询] 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 重试失败的视频
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  
  if (!taskId) {
    return NextResponse.json({ error: '缺少taskId' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { index, retryAll = false } = body;

    const supabase = getSupabaseClient();

    // 获取任务信息
    const { data: task, error: fetchError } = await supabase
      .from('video_generation_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const result = task.result as {
      storyboards?: unknown[];
      results?: Array<{
        storyboardId: string;
        success: boolean;
        videoUrl?: string;
        error?: string;
        retryCount?: number;
      }>;
      failedIndices?: number[];
    } || {};

    const failedIndices = result.failedIndices || [];
    const storyboards = result.storyboards || [];
    const results = result.results || [];

    if (failedIndices.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有失败的视频需要重试',
        done: true,
      });
    }

    // 确定要重试的索引
    let indicesToRetry: number[];
    
    if (retryAll) {
      indicesToRetry = [...failedIndices];
    } else if (typeof index === 'number') {
      if (!failedIndices.includes(index)) {
        return NextResponse.json({ error: '指定的索引不在失败列表中' }, { status: 400 });
      }
      indicesToRetry = [index];
    } else {
      // 默认只重试第一个失败的
      indicesToRetry = [failedIndices[0]];
    }

    console.log(`[重试] 任务 ${taskId} 重试视频: ${indicesToRetry.join(', ')}`);

    // 获取用户ID和方案
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);

    // 执行重试
    const retryResults: Array<{
      index: number;
      success: boolean;
      videoUrl?: string;
      error?: string;
    }> = [];

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    for (const idx of indicesToRetry) {
      const storyboard = storyboards[idx] as StoryboardItem;
      const previousResult = results[idx];
      const currentRetryCount = previousResult?.retryCount || 0;

      if (currentRetryCount >= RETRY_CONFIG.maxRetries) {
        retryResults.push({
          index: idx,
          success: false,
          error: '已达最大重试次数',
        });
        continue;
      }

      // 获取上一镜头的尾帧URL
      let lastFrameUrl: string | null = null;
      if (idx > 0) {
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
      
      // 构建内容
      const content: ContentItem[] = [];
      
      if (videoGen?.firstFrameUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: videoGen.firstFrameUrl as string },
          role: 'first_frame',
        });
      } else if (lastFrameUrl && idx > 0) {
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
        idx,
        taskId,
        customHeaders,
        currentRetryCount,
        userId,
        solution
      );

      retryResults.push({
        index: idx,
        success: generateResult.success,
        videoUrl: generateResult.videoUrl,
        error: generateResult.error,
      });

      // 更新结果
      results[idx] = {
        ...results[idx],
        success: generateResult.success,
        videoUrl: generateResult.videoUrl || results[idx]?.videoUrl,
        error: generateResult.error,
        retryCount: currentRetryCount + (generateResult.retryCount || 1),
      };

      if (generateResult.success && generateResult.videoUrl) {
        // 保存视频
        await supabase
          .from('video_materials')
          .insert({
            title: `第 ${idx + 1} 个视频 (重试) - ${storyboard.scene?.description?.substring(0, 30) || '重试'}`,
            description: prompt.substring(0, 500),
            file_key: generateResult.videoUrl,
            duration: (videoGen?.duration as number) || storyboard.duration || 6,
            status: 'uploaded',
            metadata: {
              taskId,
              seriesId: task.series_id,
              episodeNumber: task.episode_number,
              storyboardId: storyboard.id,
              generatedAt: new Date().toISOString(),
              isRetry: true,
              retryCount: results[idx].retryCount,
            },
            series_id: task.series_id,
          });

        // 从失败列表中移除
        const newFailedIndices = failedIndices.filter(i => i !== idx);
        result.failedIndices = newFailedIndices;
      }

      // 重试之间添加延迟
      if (indicesToRetry.indexOf(idx) < indicesToRetry.length - 1) {
        await delay(30000);
      }
    }

    // 更新任务状态
    const newFailedIndices = result.failedIndices || [];
    const allSuccess = retryResults.every(r => r.success);
    
    await supabase
      .from('video_generation_tasks')
      .update({
        status: newFailedIndices.length === 0 ? 'completed' : task.status,
        current_item: allSuccess 
          ? `重试成功: ${retryResults.length} 个视频`
          : `重试完成: ${retryResults.filter(r => r.success).length}/${retryResults.length} 成功`,
        result: {
          ...result,
          results,
          failedIndices: newFailedIndices,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    return NextResponse.json({
      success: true,
      message: `重试完成: ${retryResults.filter(r => r.success).length}/${retryResults.length} 成功`,
      retryResults,
      remainingFailed: newFailedIndices.length,
      done: newFailedIndices.length === 0,
    });
  } catch (error) {
    console.error('[重试] 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
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
  startRetryCount: number = 0,
  userId: string = 'dev-user',
  solution: SolutionType = 'standard'
): Promise<{ success: boolean; videoUrl?: string; error?: string; retryCount?: number }> {
  
  let lastError: string | undefined;
  const remainingRetries = RETRY_CONFIG.maxRetries - startRetryCount;
  const useZhipu = solution === 'zhipu';
  
  // 提取通用参数
  const prompt = (videoGen?.prompt as string) || storyboard.scene?.description || storyboard.prompt || '';
  const duration = Math.max(4, Math.min((videoGen?.duration as number) || storyboard.duration || 15, 15));
  const ratio = (videoGen?.ratio as '16:9') || '16:9';
  const resolution = (videoGen?.resolution as '720p') || '720p';
  
  // 获取首帧图URL
  const firstFrameItem = content.find((c: ContentItem) => c.role === 'first_frame');
  const firstFrameUrl = firstFrameItem?.image_url?.url as string | undefined;
  
  for (let retry = 0; retry <= remainingRetries; retry++) {
    try {
      if (retry > 0) {
        const delayMs = getRetryDelay(retry - 1);
        console.log(`[重试 ${taskId}] 第 ${index + 1} 个视频第 ${startRetryCount + retry} 次重试，等待 ${delayMs}ms`);
        await delay(delayMs);
      }
      
      let videoUrl: string | null = null;
      
      if (useZhipu) {
        // ===== 智谱方案 =====
        const zhipuClient = await getZhipuClientAsync(userId);
        
        const taskResponse = (await zhipuClient.generateVideo(prompt.substring(0, 2000), {
          model: SOLUTION_PRESETS.zhipu.models.video,
          firstFrameImage: firstFrameUrl,
          generateAudio: videoGen?.generateAudio as boolean ?? true,
        }) as unknown as ZhipuVideoResponse);
        
        const zhipuTaskId = taskResponse.id || taskResponse.task_id;
        const taskStatus = taskResponse.task_status || taskResponse.status;
        
        if (taskStatus === 'SUCCESS' && taskResponse.video_result?.length) {
          videoUrl = taskResponse.video_result[0].url || null;
          // 获取尾帧图用于下一个视频的首帧（保持视频连贯性）
        } else if (!zhipuTaskId) {
          throw new Error('智谱视频创建失败：未返回任务ID');
        } else {
          const maxWaitTime = 5 * 60 * 1000;
          const pollInterval = 30000; // 30秒
          const startTime = Date.now();
          
          // 首次查询前等待更长时间
          console.log(`[智谱重试 ${taskId}] 第 ${index + 1} 个视频: 等待30秒后开始查询...`);
          await delay(30000);
          
          while (Date.now() - startTime < maxWaitTime) {
            const statusResponse = (await zhipuClient.getVideoTask(zhipuTaskId)) as unknown as ZhipuVideoResponse;
            const pollStatus = statusResponse.task_status || statusResponse.status;
            const videoResult = statusResponse.video_result || statusResponse.video_result;
            
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`[智谱重试 ${taskId}] 第 ${index + 1} 个视频: 状态=${pollStatus}, 已等待${elapsed}秒`);
            
            if (pollStatus === 'SUCCESS' && videoResult?.length) {
              videoUrl = videoResult[0].url || null;
              // 获取尾帧图用于下一个视频的首帧（保持视频连贯性）
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
      }

      if (videoUrl) {
        return { 
          success: true, 
          videoUrl,
          retryCount: startRetryCount + retry,
        };
      } else {
        lastError = 'API返回空URL';
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : '未知错误';
      console.error(`[重试 ${taskId}] 第 ${index + 1} 个视频尝试 ${startRetryCount + retry + 1} 失败:`, lastError);
      
      if (lastError.includes('429') || lastError.includes('rate limit') || lastError.includes('quota')) {
        continue;
      }
      
      if (retry === 0) {
        continue;
      }
    }
  }
  
  return { 
    success: false, 
    error: lastError || '重试次数用尽',
    retryCount: RETRY_CONFIG.maxRetries,
  };
}
