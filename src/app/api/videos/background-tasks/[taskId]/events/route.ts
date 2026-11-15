import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * SSE (Server-Sent Events) 进度推送接口
 * 
 * 客户端通过 EventSource 连接此接口，实时接收任务进度更新
 * 
 * 使用方式:
 * const eventSource = new EventSource('/api/videos/background-tasks/{taskId}/events');
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log('进度更新:', data);
 * };
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  
  if (!taskId) {
    return new Response(JSON.stringify({ error: '缺少taskId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabaseClient();
  
  // 创建可读流
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始连接消息
      const connectMessage = `data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // 轮询数据库获取任务状态
      intervalId = setInterval(async () => {
        if (isClosed) {
          if (intervalId) clearInterval(intervalId);
          return;
        }

        try {
          const { data: task, error } = await supabase
            .from('video_generation_tasks')
            .select('*')
            .eq('id', taskId)
            .single();

          if (error) {
            const errorMessage = `data: ${JSON.stringify({ type: 'error', error: '任务查询失败' })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
            return;
          }

          if (!task) {
            const errorMessage = `data: ${JSON.stringify({ type: 'error', error: '任务不存在' })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
            controller.close();
            if (intervalId) clearInterval(intervalId);
            return;
          }

          // 构建进度消息
          const result = task.result as {
            storyboards?: Array<{ id?: string }>;
            results?: Array<{
              storyboardId: string;
              success: boolean;
              videoUrl?: string;
              error?: string;
            }>;
            failedIndices?: number[];
          } | null || {};
          
          // 获取当前正在生成的分镜索引（基于进度）
          const currentStoryboardIndex = task.status === 'running' ? task.progress : null;
          
          // 获取已成功生成的分镜ID列表
          const completedStoryboardIds = (result.results || [])
            .filter(r => r.success)
            .map(r => r.storyboardId)
            .filter(id => id);
          
          const progressData = {
            type: 'progress',
            taskId: task.id,
            seriesId: task.series_id,
            episodeNumber: task.episode_number,
            status: task.status,
            progress: task.progress,
            total: task.total,
            currentItem: task.current_item,
            successCount: result.results?.filter(r => r.success).length || 0,
            failedCount: result.failedIndices?.length || 0,
            // 新增：用于同步分镜按钮状态
            currentStoryboardIndex,
            completedStoryboardIds,
            timestamp: new Date().toISOString(),
          };

          const message = `data: ${JSON.stringify(progressData)}\n\n`;
          controller.enqueue(encoder.encode(message));

          // 如果任务完成或失败，发送完成消息并关闭连接
          if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
            const completeMessage = `data: ${JSON.stringify({
              type: 'complete',
              status: task.status,
              message: task.status === 'completed' 
                ? '任务完成' 
                : task.status === 'failed' 
                  ? '任务失败' 
                  : '任务已取消',
            })}\n\n`;
            controller.enqueue(encoder.encode(completeMessage));
            controller.close();
            if (intervalId) clearInterval(intervalId);
          }
        } catch (err) {
          console.error('[SSE] 轮询错误:', err);
          const errorMessage = `data: ${JSON.stringify({ type: 'error', error: '内部错误' })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
        }
      }, 2000); // 每2秒轮询一次

      // 发送心跳，保持连接
      const heartbeatId = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatId);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatId);
        }
      }, 15000); // 每15秒发送心跳
    },

    cancel() {
      isClosed = true;
      if (intervalId) clearInterval(intervalId);
      console.log(`[SSE] 客户端断开连接: ${taskId}`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    },
  });
}
