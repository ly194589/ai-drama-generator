import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 工作流统计 API
 * 
 * GET: 获取工作流统计数据
 * - 总数、完成数、运行中数
 * - 最近活动记录
 */

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    // 尝试获取工作流实例统计
    let workflowStats = {
      total: 0,
      completed: 0,
      running: 0,
      pending: 0,
      failed: 0,
    };
    
    let recentActivity: Array<{
      id: string;
      type: string;
      title: string;
      time: string;
      status: 'success' | 'processing' | 'error';
    }> = [];

    // 尝试查询 workflow_instances 表
    try {
      const { data: workflows, error } = await supabase
        .from('workflow_instances')
        .select('id, name, status, progress, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && workflows) {
        workflowStats = {
          total: workflows.length,
          completed: workflows.filter(w => w.status === 'completed').length,
          running: workflows.filter(w => w.status === 'running' || w.status === 'in_progress').length,
          pending: workflows.filter(w => w.status === 'pending').length,
          failed: workflows.filter(w => w.status === 'failed' || w.status === 'error').length,
        };

        // 转换为最近活动格式
        recentActivity = workflows.slice(0, 5).map(w => {
          const timeAgo = getTimeAgo(new Date(w.updated_at || w.created_at));
          const status: 'success' | 'processing' | 'error' = 
            w.status === 'completed' ? 'success' :
            w.status === 'running' || w.status === 'in_progress' ? 'processing' :
            w.status === 'failed' || w.status === 'error' ? 'error' : 'processing';
          
          return {
            id: w.id,
            type: 'workflow',
            title: w.name || '工作流任务',
            time: timeAgo,
            status,
          };
        });
      }
    } catch (dbError) {
      console.log('[Workflow Stats] workflow_instances 表不存在或查询失败，使用默认值');
    }

    // 如果没有工作流数据，尝试查询视频任务队列
    if (recentActivity.length === 0) {
      try {
        const { data: videoTasks, error } = await supabase
          .from('video_task_queue')
          .select('id, status, created_at, updated_at, payload')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && videoTasks && videoTasks.length > 0) {
          recentActivity = videoTasks.map(t => {
            const timeAgo = getTimeAgo(new Date(t.updated_at || t.created_at));
            const status: 'success' | 'processing' | 'error' = 
              t.status === 'completed' ? 'success' :
              t.status === 'running' ? 'processing' :
              t.status === 'failed' ? 'error' : 'processing';
            
            const payload = t.payload as { storyboardId?: string } | null;
            
            return {
              id: t.id,
              type: 'video',
              title: `视频生成${t.status === 'completed' ? '完成' : t.status === 'running' ? '中' : ''}`,
              time: timeAgo,
              status,
            };
          });
        }
      } catch (videoError) {
        console.log('[Workflow Stats] video_task_queue 表不存在或查询失败');
      }
    }

    // 如果仍然没有数据，提供一些默认的示例活动
    if (recentActivity.length === 0) {
      recentActivity = [
        { id: '1', type: 'tip', title: '开始创作你的第一个短剧', time: '刚刚', status: 'processing' },
      ];
    }

    return NextResponse.json({
      success: true,
      workflowStats,
      recentActivity,
    });

  } catch (error) {
    console.error('[Workflow Stats] 错误:', error);
    return NextResponse.json({
      success: true,
      workflowStats: { total: 0, completed: 0, running: 0, pending: 0, failed: 0 },
      recentActivity: [],
    });
  }
}

// 计算时间差
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return date.toLocaleDateString('zh-CN');
}
