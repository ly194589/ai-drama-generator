import { NextRequest, NextResponse } from 'next/server';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';

/**
 * 智谱视频生成API
 * 使用 CogVideoX-3 模型
 * 
 * 文档: https://docs.bigmodel.cn/cn/guide/models/video-generation/cogvideox-3
 * 速率限制: 5 RPM
 * 特点: 异步生成，需要轮询查询状态
 * 
 * POST /api/zhipu/video
 * Body: {
 *   prompt: string,     // 视频描述
 * }
 * 
 * GET /api/zhipu/video?taskId=xxx
 * 查询视频生成任务状态
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const configured = await isZhipuConfiguredForUser(userId);
    
    if (!configured) {
      return NextResponse.json(
        { error: '智谱API未配置，请在方案设置中配置 API Key' },
        { status: 400 }
      );
    }

    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt 参数必填' },
        { status: 400 }
      );
    }

    const client = await getZhipuClientAsync(userId);
    const response = await client.generateVideo(prompt);

    console.log(`[智谱视频] 任务创建: ${response.id}, 状态: ${response.task_status}`);

    return NextResponse.json({
      success: true,
      taskId: response.id,
      model: response.model || 'cogvideox-3',
      status: response.task_status,
      videos: response.video_result,
    });

  } catch (error) {
    console.error('[智谱视频] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '视频生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 查询视频任务状态
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const configured = await isZhipuConfiguredForUser(userId);
    
    if (!configured) {
      return NextResponse.json(
        { error: '智谱API未配置，请在方案设置中配置 API Key' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId 参数必填' },
        { status: 400 }
      );
    }

    const client = await getZhipuClientAsync(userId);
    const response = await client.getVideoTask(taskId);

    console.log(`[智谱视频] 任务查询: ${taskId}, 状态: ${response.task_status}`);

    return NextResponse.json({
      success: true,
      taskId: response.id,
      model: response.model || 'cogvideox-3',
      status: response.task_status,
      videos: response.video_result,
    });

  } catch (error) {
    console.error('[智谱视频] 查询错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
