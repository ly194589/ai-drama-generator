import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 本地接口定义
interface StoryboardItem {
  id?: string;
  type?: string;
  sequence?: number;
  scene?: {
    description?: string;
  };
  videoGeneration?: Record<string, unknown>;
  prompt?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
}

/**
 * 后台视频生成任务API
 * 
 * POST: 创建后台生成任务，立即返回任务ID
 * GET: 查询任务状态
 */

// 创建后台任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      seriesId, 
      episodeNumber,
      storyboards,  // 分镜列表
      taskType = 'episode', // single | episode | batch
    } = body;

    if (!seriesId) {
      return NextResponse.json({ error: '缺少seriesId' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 如果传入了storyboards，直接使用；否则从数据库获取
    let finalStoryboards = storyboards || [];
    
    // 从剧集获取分镜数据（包括hook和cliffhanger）
    if (finalStoryboards.length === 0 || episodeNumber) {
      const { data: episode } = await supabase
        .from('drama_episodes')
        .select('storyboards, hook, cliffhanger')
        .eq('series_id', seriesId)
        .eq('episode_number', episodeNumber || 1)
        .single();
      
      if (episode?.storyboards && finalStoryboards.length === 0) {
        finalStoryboards = [...(episode.storyboards as unknown[])];
      }
      
      // 将hook和cliffhanger转换为特殊的分镜对象
      // hook作为第一个分镜（开篇钩子）
      if (episode?.hook) {
        // hook 可能是对象或字符串，需要正确提取 prompt
        const hookObj = typeof episode.hook === 'object' ? episode.hook as Record<string, unknown> : null;
        const hookPrompt = hookObj?.visualPrompt as string || 
                           (hookObj?.scene as Record<string, unknown>)?.description as string ||
                           (typeof episode.hook === 'string' ? episode.hook : '');
        
        if (hookPrompt) {
          const hookStoryboard = {
            id: 'hook-opening',
            sequence: 0,
            type: 'opening',
            duration: (hookObj?.duration as number) || 8,
            shotType: (hookObj?.shotType as string) || '特写',
            scene: { description: hookPrompt },
            videoGeneration: {
              prompt: hookPrompt,
              duration: (hookObj?.duration as number) || 8,
              ratio: '16:9',
              resolution: '720p',
              generateAudio: true,
            },
          };
          finalStoryboards.unshift(hookStoryboard);
          console.log('[后台任务] 添加开篇钩子分镜:', hookPrompt.substring(0, 50));
        }
      }
      
      // cliffhanger作为最后一个分镜（结尾悬念）
      if (episode?.cliffhanger) {
        // cliffhanger 可能是对象或字符串，需要正确提取 prompt
        const cliffhangerObj = typeof episode.cliffhanger === 'object' ? episode.cliffhanger as Record<string, unknown> : null;
        const cliffhangerPrompt = cliffhangerObj?.visualPrompt as string || 
                                  (cliffhangerObj?.scene as Record<string, unknown>)?.description as string ||
                                  (typeof episode.cliffhanger === 'string' ? episode.cliffhanger : '');
        
        if (cliffhangerPrompt) {
          const cliffhangerStoryboard = {
            id: 'cliffhanger-ending',
            sequence: finalStoryboards.length + 1,
            type: 'ending',
            duration: (cliffhangerObj?.duration as number) || 6,
            shotType: (cliffhangerObj?.shotType as string) || '特写',
            scene: { description: cliffhangerPrompt },
            videoGeneration: {
              prompt: cliffhangerPrompt,
              duration: (cliffhangerObj?.duration as number) || 6,
              ratio: '16:9',
              resolution: '720p',
              generateAudio: true,
            },
          };
          finalStoryboards.push(cliffhangerStoryboard);
          console.log('[后台任务] 添加结尾悬念分镜:', cliffhangerPrompt.substring(0, 50));
        }
      }
    }

    // 创建任务记录
    const { data: task, error } = await supabase
      .from('video_generation_tasks')
      .insert({
        series_id: seriesId,
        episode_number: episodeNumber || null,
        task_type: taskType,
        status: 'pending',
        progress: 0,
        total: finalStoryboards.length || 1,
        current_item: '任务已创建，等待开始',
        result: { storyboards: finalStoryboards },
      })
      .select()
      .single();

    if (error) {
      console.error('[后台任务] 创建任务失败:', error);
      return NextResponse.json({ error: '创建任务失败' }, { status: 500 });
    }

    console.log('[后台任务] 任务已创建:', task.id);

    // 立即返回任务ID，前端需要调用 /api/videos/background-tasks/execute 来执行任务
    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: '后台任务已创建，请调用执行接口开始生成',
    });
  } catch (error) {
    console.error('[后台任务] 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 查询任务状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const seriesId = searchParams.get('seriesId');

    const supabase = getSupabaseClient();

    if (taskId) {
      // 查询单个任务
      const { data: task, error } = await supabase
        .from('video_generation_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) {
        return NextResponse.json({ error: '任务不存在' }, { status: 404 });
      }

      return NextResponse.json({ success: true, task });
    } else if (seriesId) {
      // 查询剧本的所有任务
      const { data: tasks, error } = await supabase
        .from('video_generation_tasks')
        .select('*')
        .eq('series_id', seriesId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, tasks });
    } else {
      return NextResponse.json({ error: '缺少taskId或seriesId' }, { status: 400 });
    }
  } catch (error) {
    console.error('[后台任务] 查询错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除/取消任务
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: '缺少taskId' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 更新任务状态为已取消
    const { error } = await supabase
      .from('video_generation_tasks')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId)
      .in('status', ['pending', 'running']);

    if (error) {
      return NextResponse.json({ error: '取消失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '任务已取消' });
  } catch (error) {
    console.error('[后台任务] 取消错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 后台任务执行函数
async function startBackgroundTask(
  taskId: string, 
  seriesId: string, 
  episodeNumber: number | undefined,
  storyboards: unknown[] | undefined,
  headers: Headers
) {
  const supabase = getSupabaseClient();
  
  try {
    // 更新任务状态为运行中
    await supabase
      .from('video_generation_tasks')
      .update({ 
        status: 'running', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);

    console.log(`[后台任务 ${taskId}] 开始执行`);

    // 如果没有传入分镜数据，从数据库获取
    if (!storyboards || storyboards.length === 0) {
      const { data: episode } = await supabase
        .from('episodes')
        .select('storyboards')
        .eq('series_id', seriesId)
        .eq('episode_number', episodeNumber || 1)
        .single();
      
      storyboards = (episode?.storyboards as StoryboardItem[] | undefined) || [];
    }

    if (!storyboards || storyboards.length === 0) {
      throw new Error('没有找到分镜数据');
    }

    const results: unknown[] = [];
    let lastFrameUrl: string | null = null;

    // 逐个生成视频
    for (let i = 0; i < storyboards.length; i++) {
      const storyboard = storyboards[i] as StoryboardItem;
      
      // 更新进度
      await supabase
        .from('video_generation_tasks')
        .update({
          progress: i,
          current_item: `正在生成分镜 ${i + 1}/${storyboards.length}: ${storyboard.scene?.description?.substring(0, 50) || '未知场景'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      console.log(`[后台任务 ${taskId}] 生成第 ${i + 1}/${storyboards.length} 个视频`);

      try {
        // 调用视频生成API
        const response: Response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/videos/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 转发必要的头部
            ...(headers.get('authorization') && { authorization: headers.get('authorization')! }),
          },
          body: JSON.stringify({
            prompt: storyboard.videoGeneration?.prompt || storyboard.scene?.description,
            duration: storyboard.duration || 5,
            ratio: storyboard.videoGeneration?.ratio || '16:9',
            resolution: storyboard.videoGeneration?.resolution || '720p',
            generateAudio: storyboard.videoGeneration?.generateAudio ?? true,
            title: `${storyboard.id || `分镜${i + 1}`}`,
            seriesId,
            episodeNumber,
            firstFrameUrl: storyboard.videoGeneration?.firstFrameUrl || (i === 0 ? null : lastFrameUrl),
            useLastFrame: i > 0 && !storyboard.videoGeneration?.firstFrameUrl,
            outputLastFrame: true,
            cameraMovement: storyboard.videoGeneration?.cameraMovement,
          }),
        });

        const data: { success?: boolean; video?: { id?: string; url?: string }; videoUrl?: string; lastFrameUrl?: string; error?: string } = await response.json();

        if (data.success || data.video) {
          results.push({
            storyboardId: storyboard.id,
            videoId: data.video?.id,
            videoUrl: data.video?.url || data.videoUrl,
            lastFrameUrl: data.lastFrameUrl,
          });
          lastFrameUrl = data.lastFrameUrl || null;
          console.log(`[后台任务 ${taskId}] 第 ${i + 1} 个视频生成成功`);
        } else {
          console.error(`[后台任务 ${taskId}] 第 ${i + 1} 个视频生成失败:`, data.error);
          results.push({
            storyboardId: storyboard.id,
            error: data.error,
          });
        }

        // 等待一段时间再生成下一个，避免API限流
        if (i < storyboards.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 30000)); // 30秒间隔
        }
      } catch (err) {
        console.error(`[后台任务 ${taskId}] 第 ${i + 1} 个视频生成异常:`, err);
        results.push({
          storyboardId: storyboard.id,
          error: err instanceof Error ? err.message : '未知错误',
        });
      }
    }

    // 更新任务状态为完成
    await supabase
      .from('video_generation_tasks')
      .update({
        status: 'completed',
        progress: storyboards.length,
        total: storyboards.length,
        current_item: '所有视频生成完成',
        result: { results, total: results.length, success: (results as { videoId?: string }[]).filter(r => r.videoId).length },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    console.log(`[后台任务 ${taskId}] 完成: ${(results as { videoId?: string }[]).filter(r => r.videoId).length}/${results.length} 成功`);
  } catch (error) {
    console.error(`[后台任务 ${taskId}] 执行失败:`, error);
    
    // 更新任务状态为失败
    await supabase
      .from('video_generation_tasks')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : '未知错误',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }
}
