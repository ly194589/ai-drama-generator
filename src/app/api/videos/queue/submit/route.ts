import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 视频生成任务提交API
 * 
 * 支持一次性提交多个视频生成任务到队列
 * 返回batchId用于追踪进度
 */

interface VideoTask {
  shotIndex: number;
  shotName: string;
  prompt: string;
  imageUrl?: string;
  duration?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tasks,
      seriesId,
      episodeNumber,
      autoStart = true,
    } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: '请提供任务列表' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 生成批次ID
    const batchId = crypto.randomUUID();

    // 插入所有任务
    const tasksToInsert = tasks.map((task: VideoTask) => ({
      batch_id: batchId,
      series_id: seriesId,
      episode_number: episodeNumber,
      shot_index: task.shotIndex,
      shot_name: task.shotName || `镜头${task.shotIndex + 1}`,
      prompt: task.prompt,
      image_url: task.imageUrl,
      duration: task.duration || 5,
      status: 'pending',
      max_retries: 3,
    }));

    const { error: insertError } = await supabase
      .from('video_generation_queue')
      .insert(tasksToInsert);

    if (insertError) {
      console.error('插入任务失败:', insertError);
      return NextResponse.json({ error: '提交任务失败' }, { status: 500 });
    }

    // 如果需要自动开始处理，触发处理API
    let processUrl = null;
    if (autoStart) {
      processUrl = `/api/videos/queue/process`;
    }

    return NextResponse.json({
      success: true,
      batchId,
      totalTasks: tasks.length,
      processUrl,
      message: `已提交 ${tasks.length} 个视频生成任务`,
    });
  } catch (error) {
    console.error('提交任务失败:', error);
    return NextResponse.json(
      { error: '提交任务失败' },
      { status: 500 }
    );
  }
}

/**
 * 查询批次状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: '缺少batchId' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data: tasks, error } = await supabase
      .from('video_generation_queue')
      .select('*')
      .eq('batch_id', batchId)
      .order('shot_index', { ascending: true });

    if (error) {
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    const total = tasks?.length || 0;
    const pending = tasks?.filter(t => t.status === 'pending').length || 0;
    const processing = tasks?.filter(t => t.status === 'processing').length || 0;
    const completed = tasks?.filter(t => t.status === 'completed').length || 0;
    const failed = tasks?.filter(t => t.status === 'failed').length || 0;

    // 计算进度
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 获取已完成的视频
    const videos = tasks
      ?.filter(t => t.status === 'completed' && t.result_url)
      .map(t => ({
        shotIndex: t.shot_index,
        shotName: t.shot_name,
        url: t.result_url,
      })) || [];

    // 获取失败的任务
    const errors = tasks
      ?.filter(t => t.status === 'failed')
      .map(t => ({
        shotIndex: t.shot_index,
        shotName: t.shot_name,
        error: t.error_message,
      })) || [];

    // 判断是否全部完成
    const isComplete = total > 0 && (completed + failed) === total;

    return NextResponse.json({
      batchId,
      total,
      pending,
      processing,
      completed,
      failed,
      progress,
      isComplete,
      videos,
      errors,
      tasks: tasks?.map(t => ({
        id: t.id,
        shotIndex: t.shot_index,
        shotName: t.shot_name,
        status: t.status,
        retryCount: t.retry_count,
        resultUrl: t.result_url,
        errorMessage: t.error_message,
      })),
    });
  } catch (error) {
    console.error('查询状态失败:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * 取消/删除批次任务
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: '缺少batchId' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 只删除未开始的任务
    const { error } = await supabase
      .from('video_generation_queue')
      .delete()
      .eq('batch_id', batchId)
      .eq('status', 'pending');

    if (error) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '已取消待处理的任务',
    });
  } catch (error) {
    console.error('取消任务失败:', error);
    return NextResponse.json(
      { error: '取消失败' },
      { status: 500 }
    );
  }
}
