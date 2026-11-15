import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoGenerationClient, Config, HeaderUtils, APIError } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS } from '@/lib/config';
import { 
  DEFAULT_RATE_LIMIT_CONFIG,
  RateLimitState 
} from '@/lib/video-rate-limiter';

interface QueueTask {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  series_id?: string;
  episode_number?: number;
  storyboard_id?: string;
  attempts: number;
  max_attempts: number;
}

/**
 * 视频队列处理 API
 * 
 * 处理队列中的任务，实现智能限流
 * 
 * POST: 处理下一个任务（或批量处理）
 */

// 全局限流状态（内存中）
const globalRateLimitState: RateLimitState = {
  minuteCount: 0,
  hourCount: 0,
  lastRequestTime: 0,
  isRateLimited: false,
  consecutiveFailures: 0,
  currentInterval: DEFAULT_RATE_LIMIT_CONFIG.minInterval,
};

// 全局处理状态
let isProcessing = false;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { async = false, maxTasks = 1 } = body;

    // 如果是异步调用，立即返回并后台处理
    if (async) {
      // 非阻塞处理
      processQueueInBackground(request.headers, maxTasks).catch(err => {
        console.error('[队列处理] 后台处理错误:', err);
      });
      
      return NextResponse.json({ 
        success: true, 
        message: '队列处理已启动',
        processing: true,
      });
    }

    // 同步处理
    const result = await processNextTask(request.headers);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[队列处理] 错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '服务器错误',
      success: false,
    }, { status: 500 });
  }
}

// 后台处理队列
async function processQueueInBackground(headers: Headers, maxTasks: number = 10) {
  if (isProcessing) {
    console.log('[队列处理] 已有处理进程在运行');
    return;
  }

  isProcessing = true;
  console.log('[队列处理] 开始后台处理');

  try {
    let processedCount = 0;
    
    while (processedCount < maxTasks) {
      // 检查是否允许请求
      const { allowed, waitTime } = checkRateLimit();
      
      if (!allowed) {
        console.log(`[队列处理] 限流中，等待 ${waitTime}ms`);
        await sleep(waitTime);
        continue;
      }

      // 获取下一个任务
      const task = await getNextPendingTask();
      
      if (!task) {
        console.log('[队列处理] 队列为空');
        break;
      }

      // 执行任务
      const result = await executeTask(task, headers);
      
      // 更新任务状态
      await updateTaskStatus(task.id, result);
      
      // 更新限流状态
      if (result.success) {
        recordSuccess();
      } else {
        const isRateLimit = result.isRateLimited || false;
        recordFailure(isRateLimit);
        
        if (isRateLimit) {
          console.log('[队列处理] 触发限流，暂停处理');
          break;
        }
      }

      processedCount++;
      
      // 任务间隔
      await sleep(globalRateLimitState.currentInterval);
    }

    console.log(`[队列处理] 完成，共处理 ${processedCount} 个任务`);
  } finally {
    isProcessing = false;
  }
}

// 处理下一个任务
async function processNextTask(headers: Headers) {
  // 检查限流
  const { allowed, waitTime, reason } = checkRateLimit();
  
  if (!allowed) {
    return {
      success: false,
      error: `限流中，请等待 ${Math.ceil(waitTime / 1000)} 秒`,
      reason,
      waitTime,
      rateLimitState: globalRateLimitState,
    };
  }

  // 获取下一个任务
  const task = await getNextPendingTask();
  
  if (!task) {
    return {
      success: true,
      message: '队列为空',
      processed: false,
    };
  }

  // 执行任务
  const result = await executeTask(task!, headers);
  
  // 更新任务状态
  await updateTaskStatus(task!.id, result);
  
  // 更新限流状态
  if (result.success) {
    recordSuccess();
  } else {
    recordFailure(result.isRateLimited || false);
  }

  return {
    success: result.success,
    taskId: task!.id,
    result,
    rateLimitState: globalRateLimitState,
  };
}

// 检查限流
function checkRateLimit(): { allowed: boolean; waitTime: number; reason?: string } {
  const now = Date.now();

  // 限流状态检查
  if (globalRateLimitState.isRateLimited) {
    const cooldownEnd = (globalRateLimitState.rateLimitedSince || 0) + DEFAULT_RATE_LIMIT_CONFIG.cooldownPeriod;
    if (now < cooldownEnd) {
      return {
        allowed: false,
        waitTime: cooldownEnd - now,
        reason: 'rate_limited',
      };
    }
    globalRateLimitState.isRateLimited = false;
  }

  // 最小间隔检查
  const timeSinceLastRequest = now - globalRateLimitState.lastRequestTime;
  if (timeSinceLastRequest < globalRateLimitState.currentInterval) {
    return {
      allowed: false,
      waitTime: globalRateLimitState.currentInterval - timeSinceLastRequest,
      reason: 'min_interval',
    };
  }

  // 分钟限制检查
  if (globalRateLimitState.minuteCount >= DEFAULT_RATE_LIMIT_CONFIG.requestsPerMinute) {
    // 等待到下一分钟
    const minuteEnd = Math.ceil(globalRateLimitState.lastRequestTime / 60000) * 60000;
    const waitTime = Math.max(minuteEnd - now, 1000);
    return {
      allowed: false,
      waitTime,
      reason: 'minute_limit',
    };
  }

  // 小时限制检查
  if (globalRateLimitState.hourCount >= DEFAULT_RATE_LIMIT_CONFIG.requestsPerHour) {
    const hourEnd = Math.ceil(globalRateLimitState.lastRequestTime / 3600000) * 3600000;
    const waitTime = Math.max(hourEnd - now, 1000);
    return {
      allowed: false,
      waitTime,
      reason: 'hour_limit',
    };
  }

  return { allowed: true, waitTime: 0 };
}

// 获取下一个待处理任务
async function getNextPendingTask(): Promise<QueueTask | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('video_task_queue')
    .select('*')
    .in('status', ['pending', 'queued'])
    .lt('attempts', 10)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[队列处理] 获取任务失败:', error);
    return null;
  }

  return data;
}

// 执行任务
async function executeTask(
  task: QueueTask, 
  headers: Headers
): Promise<{ 
  success: boolean; 
  videoUrl?: string; 
  error?: string;
  isRateLimited?: boolean;
}> {
  const supabase = getSupabaseClient();
  
  // 更新状态为运行中
  await supabase
    .from('video_task_queue')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      attempts: task.attempts + 1,
    })
    .eq('id', task.id);

  try {
    const { content, options } = task.payload;
    const customHeaders = HeaderUtils.extractForwardHeaders(headers);
    
    const config = new Config();
    const videoClient = new VideoGenerationClient(config, customHeaders);

    console.log(`[队列处理] 执行任务 ${task.id}，尝试 ${task.attempts + 1}`);

    const response = await videoClient.videoGeneration(content as unknown as never, {
      model: (options as { model?: string })?.model || DEFAULT_MODELS.video,
      duration: (options as { duration?: number })?.duration || 5,
      ratio: ((options as { ratio?: string })?.ratio || '16:9') as '16:9',
      resolution: ((options as { resolution?: string })?.resolution || '720p') as '720p',
      generateAudio: (options as { generateAudio?: boolean })?.generateAudio ?? true,
      watermark: false,
      maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
    });

    if (response.videoUrl) {
      console.log(`[队列处理] 任务 ${task.id} 成功`);
      
      // 保存到 video_materials
      if (task.series_id) {
        await supabase
          .from('video_materials')
          .insert({
            title: `队列生成视频 - ${task.storyboard_id || task.id}`,
            description: '通过智能队列生成',
            file_key: response.videoUrl,
            duration: (options as { duration?: number })?.duration || 5,
            status: 'uploaded',
            metadata: {
              taskId: task.id,
              seriesId: task.series_id,
              episodeNumber: task.episode_number,
              generatedAt: new Date().toISOString(),
            },
            series_id: task.series_id,
          });
      }

      return { success: true, videoUrl: response.videoUrl };
    } else {
      return { success: false, error: 'API未返回视频URL' };
    }
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : '未知错误';
    let isRateLimited = false;

    if (error instanceof APIError) {
      const apiError = error as APIError & { response?: { error?: { code?: string } } };
      const errorCode = apiError.response?.error?.code;
      
      if (
        errorCode === 'ErrTooManyRequests' ||
        apiError.statusCode === 429 ||
        errorMessage.includes('限流') ||
        errorMessage.includes('TooManyRequests')
      ) {
        isRateLimited = true;
        errorMessage = 'API限流，需要等待后重试';
      }
    }

    console.error(`[队列处理] 任务 ${task.id} 失败:`, errorMessage);
    
    return { 
      success: false, 
      error: errorMessage,
      isRateLimited,
    };
  }
}

// 更新任务状态
async function updateTaskStatus(
  taskId: string,
  result: { success: boolean; videoUrl?: string; error?: string; isRateLimited?: boolean }
) {
  const supabase = getSupabaseClient();

  if (result.success) {
    await supabase
      .from('video_task_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: result,
      })
      .eq('id', taskId);
  } else {
    // 获取当前任务
    const { data: task } = await supabase
      .from('video_task_queue')
      .select('attempts, max_attempts')
      .eq('id', taskId)
      .single();

    const newStatus = result.isRateLimited 
      ? 'rate_limited' 
      : (task && task.attempts < task.max_attempts ? 'queued' : 'failed');

    await supabase
      .from('video_task_queue')
      .update({
        status: newStatus,
        last_error: result.error,
        result: result,
      })
      .eq('id', taskId);
  }
}

// 记录成功
function recordSuccess() {
  globalRateLimitState.lastRequestTime = Date.now();
  globalRateLimitState.minuteCount++;
  globalRateLimitState.hourCount++;
  globalRateLimitState.consecutiveFailures = 0;
  
  // 成功后稍微缩短间隔
  globalRateLimitState.currentInterval = Math.max(
    DEFAULT_RATE_LIMIT_CONFIG.minInterval,
    globalRateLimitState.currentInterval * 0.95
  );
}

// 记录失败
function recordFailure(isRateLimit: boolean) {
  globalRateLimitState.consecutiveFailures++;
  
  if (isRateLimit) {
    globalRateLimitState.isRateLimited = true;
    globalRateLimitState.rateLimitedSince = Date.now();
    globalRateLimitState.currentInterval = Math.min(
      DEFAULT_RATE_LIMIT_CONFIG.cooldownPeriod * 2,
      globalRateLimitState.currentInterval * 2
    );
  } else {
    globalRateLimitState.currentInterval = Math.min(
      DEFAULT_RATE_LIMIT_CONFIG.cooldownPeriod,
      globalRateLimitState.currentInterval * 1.5
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// GET: 获取处理状态
export async function GET() {
  return NextResponse.json({
    success: true,
    processing: isProcessing,
    rateLimitState: globalRateLimitState,
    config: DEFAULT_RATE_LIMIT_CONFIG,
  });
}
