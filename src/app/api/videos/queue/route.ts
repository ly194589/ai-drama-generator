import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface QueueTaskItem {
  priority?: number;
  content?: unknown;
  options?: Record<string, unknown>;
  seriesId?: string;
  episodeNumber?: number;
  storyboardId?: string;
}
import { VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS } from '@/lib/config';
import { 
  getVideoTaskScheduler, 
  QueueTask,
  DEFAULT_RATE_LIMIT_CONFIG 
} from '@/lib/video-rate-limiter';

/**
 * 视频生成智能队列 API
 * 
 * POST: 添加任务到队列
 * GET: 获取队列状态
 * 
 * 特性：
 * - 令牌桶限流，主动控制请求频率
 * - 任务队列，支持优先级和断点续传
 * - 自适应调节，根据API反馈动态调整
 */

// 获取队列状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');

    const supabase = getSupabaseClient();
    const scheduler = getVideoTaskScheduler();

    // 获取队列统计
    const stats = await scheduler.getQueueStats();
    
    // 获取限流器状态
    const rateLimiterState = scheduler.getRateLimiterState();

    // 如果指定了 seriesId，获取该系列的任务列表
    let tasks: unknown[] = [];
    if (seriesId) {
      const { data } = await supabase
        .from('video_task_queue')
        .select('*')
        .eq('series_id', seriesId)
        .order('created_at', { ascending: false })
        .limit(50);
      tasks = data || [];
    }

    return NextResponse.json({
      success: true,
      queue: stats,
      rateLimiter: {
        isRateLimited: rateLimiterState.isRateLimited,
        consecutiveFailures: rateLimiterState.consecutiveFailures,
        currentInterval: rateLimiterState.currentInterval,
        minuteCount: rateLimiterState.minuteCount,
        hourCount: rateLimiterState.hourCount,
      },
      config: {
        requestsPerMinute: DEFAULT_RATE_LIMIT_CONFIG.requestsPerMinute,
        requestsPerHour: DEFAULT_RATE_LIMIT_CONFIG.requestsPerHour,
        minInterval: DEFAULT_RATE_LIMIT_CONFIG.minInterval,
        cooldownPeriod: DEFAULT_RATE_LIMIT_CONFIG.cooldownPeriod,
      },
      tasks,
    });
  } catch (error) {
    console.error('[队列API] 获取状态失败:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}

// 添加任务到队列
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tasks, 
      priority = 5,
      seriesId,
      episodeNumber,
      // 或者单个任务
      content,
      options,
    } = body;

    const supabase = getSupabaseClient();

    // 批量添加任务
    if (tasks && Array.isArray(tasks)) {
      const taskRecords = tasks.map((t: QueueTaskItem, index: number) => ({
        type: 'video_generation',
        priority: t.priority || priority,
        payload: {
          content: t.content,
          options: t.options || {},
        },
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        series_id: t.seriesId || seriesId,
        episode_number: t.episodeNumber || episodeNumber,
        storyboard_id: t.storyboardId,
        created_at: new Date(),
      }));

      const { data, error } = await supabase
        .from('video_task_queue')
        .insert(taskRecords)
        .select('id');

      if (error) {
        console.error('[队列API] 批量添加任务失败:', error);
        return NextResponse.json({ error: '添加任务失败' }, { status: 500 });
      }

      console.log(`[队列API] 已添加 ${data.length} 个任务到队列`);

      // 触发队列处理
      triggerQueueProcessing();

      return NextResponse.json({
        success: true,
        taskIds: data.map(d => d.id),
        message: `已添加 ${data.length} 个任务到队列`,
      });
    }

    // 单个任务
    if (content) {
      const { data, error } = await supabase
        .from('video_task_queue')
        .insert({
          type: 'video_generation',
          priority,
          payload: {
            content,
            options: options || {},
          },
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
          series_id: seriesId,
          episode_number: episodeNumber,
          created_at: new Date(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('[队列API] 添加任务失败:', error);
        return NextResponse.json({ error: '添加任务失败' }, { status: 500 });
      }

      console.log(`[队列API] 任务已添加: ${data.id}`);

      // 触发队列处理
      triggerQueueProcessing();

      return NextResponse.json({
        success: true,
        taskId: data.id,
        message: '任务已添加到队列',
      });
    }

    return NextResponse.json({ error: '缺少任务数据' }, { status: 400 });
  } catch (error) {
    console.error('[队列API] 错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}

// 删除/取消任务
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const seriesId = searchParams.get('seriesId');

    const supabase = getSupabaseClient();

    if (taskId) {
      // 删除单个任务
      const { error } = await supabase
        .from('video_task_queue')
        .delete()
        .eq('id', taskId)
        .in('status', ['pending', 'queued']);

      if (error) {
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '任务已删除' });
    }

    if (seriesId) {
      // 删除系列的所有待处理任务
      const { error } = await supabase
        .from('video_task_queue')
        .delete()
        .eq('series_id', seriesId)
        .in('status', ['pending', 'queued']);

      if (error) {
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已删除所有待处理任务' });
    }

    return NextResponse.json({ error: '缺少taskId或seriesId' }, { status: 400 });
  } catch (error) {
    console.error('[队列API] 删除错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}

// 触发队列处理
function triggerQueueProcessing() {
  // 使用 fetch 调用处理接口（非阻塞）
  const processUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/videos/queue/process`;
  
  fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ async: true }),
  }).catch(err => {
    console.error('[队列API] 触发处理失败:', err);
  });
}
