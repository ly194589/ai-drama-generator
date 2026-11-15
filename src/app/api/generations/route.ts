import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  createGenerationTask,
  updateGenerationTask,
  getGenerationTasksByIds,
  getActiveGenerationTasks,
} from '@/lib/generation-tasks';

type TaskType = 'artwork' | 'video';

const ALLOWED_TYPES: TaskType[] = ['artwork', 'video'];

/**
 * 在后台执行生成任务：直接调用现有生成路由（立绘 / 视频），
 * 生成完成后把原始响应写入任务记录。页面切换不影响执行。
 */
async function executeTask(
  taskId: string,
  type: TaskType,
  seriesId: string | null,
  payload: Record<string, unknown>,
  userId: string,
): Promise<void> {
  await updateGenerationTask(taskId, { status: 'running' });
  try {
    const port = process.env.DEPLOY_RUN_PORT || '5000';
    const baseUrl = `http://localhost:${port}`;
    const headers = {
      'content-type': 'application/json',
      'x-user-id': userId,
    };

    let result: Record<string, unknown>;
    if (type === 'artwork') {
      const mod = await import('@/app/api/drama/series/[id]/artwork/route');
      const req = new Request(`${baseUrl}/api/drama/series/${seriesId}/artwork`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const res = await mod.POST(req as unknown as NextRequest, {
        params: Promise.resolve({ id: seriesId || '' }),
      });
      result = (await res.json()) as Record<string, unknown>;
      if (!res.ok || result.success === false) {
        throw new Error((result.error as string) || `生成请求失败 (HTTP ${res.status})`);
      }
    } else {
      const mod = await import('@/app/api/videos/generate/route');
      const req = new Request(`${baseUrl}/api/videos/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const res = await mod.POST(req as unknown as NextRequest);
      result = (await res.json()) as Record<string, unknown>;
      if (!res.ok || result.success === false) {
        throw new Error((result.error as string) || `生成请求失败 (HTTP ${res.status})`);
      }
    }

    await updateGenerationTask(taskId, { status: 'completed', result });
    console.log(`[后台任务] ${type} 任务完成: ${taskId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成失败';
    console.error(`[后台任务] ${type} 执行失败: ${message}`);
    await updateGenerationTask(taskId, { status: 'failed', error: message });
  }
}

/**
 * 创建后台生成任务
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, seriesId, payload = {} } = body as {
      type?: string;
      seriesId?: string;
      payload?: Record<string, unknown>;
    };

    if (!type || !ALLOWED_TYPES.includes(type as TaskType)) {
      return NextResponse.json(
        { success: false, error: `不支持的任务类型: ${type}` },
        { status: 400 },
      );
    }

    const task = await createGenerationTask({ userId, type, seriesId, payload });
    if (!task) {
      return NextResponse.json({ success: false, error: '任务创建失败' }, { status: 500 });
    }

    // 响应返回后继续在后台执行，页面切换不影响生成进度
    after(() => executeTask(task.id, type as TaskType, seriesId || null, payload, userId));

    return NextResponse.json({ success: true, taskId: task.id });
  } catch (err) {
    console.error('[后台任务] 创建异常:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: '任务创建异常' }, { status: 500 });
  }
}

/**
 * 查询任务状态
 * - ?ids=a,b,c  按 ID 查询
 * - ?active=1&seriesId=xxx  查询运行中任务
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    const seriesId = searchParams.get('seriesId') || undefined;
    const active = searchParams.get('active');

    if (ids) {
      const tasks = await getGenerationTasksByIds(ids.split(',').filter(Boolean), userId);
      return NextResponse.json({ success: true, tasks });
    }

    if (active === '1') {
      const tasks = await getActiveGenerationTasks(userId, seriesId);
      return NextResponse.json({ success: true, tasks });
    }

    return NextResponse.json({ success: true, tasks: [] });
  } catch (err) {
    console.error('[后台任务] 查询异常:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
