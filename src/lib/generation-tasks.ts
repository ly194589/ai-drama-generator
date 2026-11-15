import { getSupabaseClient } from '@/storage/database/supabase-client';

export type GenerationTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface GenerationTask {
  id: string;
  user_id: string;
  type: string;
  series_id: string | null;
  status: GenerationTaskStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 创建生成任务
 */
export async function createGenerationTask(params: {
  userId: string;
  type: string;
  seriesId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<GenerationTask | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('generation_tasks')
      .insert({
        user_id: params.userId,
        type: params.type,
        series_id: params.seriesId || null,
        payload: params.payload || {},
        status: 'pending' as GenerationTaskStatus,
      })
      .select()
      .single();

    if (error) {
      console.error('[生成任务] 创建失败:', error.message);
      return null;
    }
    return data as GenerationTask;
  } catch (err) {
    console.error('[生成任务] 创建异常:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 更新任务状态/结果
 */
export async function updateGenerationTask(
  taskId: string,
  patch: {
    status?: GenerationTaskStatus;
    result?: Record<string, unknown> | null;
    error?: string | null;
  },
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('generation_tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', taskId);
  } catch (err) {
    console.error('[生成任务] 更新失败:', err instanceof Error ? err.message : err);
  }
}

/**
 * 按 ID 列表查询任务
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getGenerationTasksByIds(ids: string[], userId: string): Promise<GenerationTask[]> {
  // 过滤非法 UUID，避免 Postgres 语法错误
  const validIds = ids.filter((id) => UUID_RE.test(id));
  if (!validIds.length) return [];
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('generation_tasks')
      .select('*')
      .in('id', validIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[生成任务] 查询失败:', error.message);
      return [];
    }
    return (data || []) as GenerationTask[];
  } catch (err) {
    console.error('[生成任务] 查询异常:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * 查询用户的运行中/待执行任务（页面切换恢复用）
 */
export async function getActiveGenerationTasks(userId: string, seriesId?: string): Promise<GenerationTask[]> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('generation_tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false });

    if (seriesId) {
      query = query.eq('series_id', seriesId);
    }

    const { data, error } = await query.limit(20);
    if (error) {
      console.error('[生成任务] 活跃任务查询失败:', error.message);
      return [];
    }
    return (data || []) as GenerationTask[];
  } catch (err) {
    console.error('[生成任务] 活跃任务查询异常:', err instanceof Error ? err.message : err);
    return [];
  }
}
