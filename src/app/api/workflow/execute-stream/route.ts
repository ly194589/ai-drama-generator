import { NextRequest } from 'next/server';
import { LLMClient, ImageGenerationClient, VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getScriptPromptProfile } from '@/lib/model-prompt-profiles';

/**
 * 工作流执行API（流式）
 * 
 * 特性：
 * 1. SSE实时进度推送
 * 2. DAG任务调度
 * 3. 并行执行
 * 4. 断点续传
 * 5. 错误恢复
 */

interface Task {
  id: string;
  type: string;
  name: string;
  dependencies: string[];
  priority: number;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
}

interface WorkflowState {
  id: string;
  tasks: Task[];
  completedTasks: string[];
  failedTasks: string[];
  context: Record<string, unknown>;
  startTime: Date;
}

// 默认配置
const DEFAULT_CONFIG = {
  llmModel: 'doubao-seed-2-0-pro-260215',
  videoModel: 'doubao-seedance-2-0-260128',
  imageSize: '2K',
  ttsSpeaker: 'zh_female_mizai_saturn_bigtts',
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workflowId, resumeFromTask } = body;

  const supabase = getSupabaseClient();
  const encoder = new TextEncoder();

  // 加载工作流定义
  const { data: workflowInstance } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (!workflowInstance) {
    return new Response(JSON.stringify({ error: '工作流不存在' }), { status: 404 });
  }

  const definition = workflowInstance.definition as { tasks: Task[], globalConfig: Record<string, unknown> };
  const contextData = (workflowInstance.context as Record<string, unknown>) || {};

  // 初始化状态
  const state: WorkflowState = {
    id: workflowId,
    tasks: definition.tasks.map(t => ({
      ...t,
      status: resumeFromTask && t.id !== resumeFromTask && t.status === 'completed' 
        ? 'completed' 
        : 'pending'
    })),
    completedTasks: resumeFromTask ? definition.tasks.filter(t => t.status === 'completed').map(t => t.id) : [],
    failedTasks: [],
    context: { ...contextData },
    startTime: new Date()
  };

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // 发送开始事件
        sendEvent({
          type: 'workflow_start',
          workflowId,
          totalTasks: state.tasks.length,
          message: '工作流开始执行'
        });

        // 获取可执行的任务（无依赖或依赖已完成）
        const getExecutableTasks = (): Task[] => {
          return state.tasks.filter(t => 
            t.status === 'pending' &&
            t.dependencies.every(depId => state.completedTasks.includes(depId))
          ).sort((a, b) => b.priority - a.priority);
        };

        // 检查是否所有任务完成
        const isComplete = (): boolean => {
          return state.tasks.every(t => 
            t.status === 'completed' || t.status === 'skipped'
          );
        };

        // 检查是否有失败导致无法继续
        const isBlocked = (): boolean => {
          const executable = getExecutableTasks();
          const pending = state.tasks.filter(t => t.status === 'pending');
          return executable.length === 0 && pending.length > 0;
        };

        // 执行单个任务
        const executeTask = async (task: Task): Promise<void> => {
          task.status = 'running';
          task.progress = 0;

          sendEvent({
            type: 'task_start',
            taskId: task.id,
            taskName: task.name,
            message: `开始执行：${task.name}`
          });

          try {
            // 根据任务类型执行
            const result = await executeTaskByType(task, state.context, request.headers, sendEvent);
            
            task.status = 'completed';
            task.progress = 100;
            task.result = result;
            state.completedTasks.push(task.id);

            // 更新上下文
            state.context[task.id] = result;

            sendEvent({
              type: 'task_complete',
              taskId: task.id,
              taskName: task.name,
              progress: 100,
              result: result
            });

          } catch (error) {
            task.retryCount++;
            
            if (task.retryCount >= task.maxRetries) {
              task.status = 'failed';
              task.error = error instanceof Error ? error.message : '执行失败';
              state.failedTasks.push(task.id);

              sendEvent({
                type: 'task_failed',
                taskId: task.id,
                taskName: task.name,
                error: task.error,
                retryCount: task.retryCount,
                maxRetries: task.maxRetries
              });
            } else {
              // 重试
              sendEvent({
                type: 'task_retry',
                taskId: task.id,
                taskName: task.name,
                retryCount: task.retryCount,
                message: `任务失败，正在重试 (${task.retryCount}/${task.maxRetries})`
              });
              
              task.status = 'pending';
            }
          }
        };

        // 主执行循环
        while (!isComplete() && !isBlocked()) {
          const executableTasks = getExecutableTasks();
          const parallelLimit = (definition.globalConfig.parallelLimit as number) || 3;
          
          // 并行执行任务
          const tasksToRun = executableTasks.slice(0, parallelLimit);
          
          await Promise.all(tasksToRun.map(task => executeTask(task)));

          // 更新整体进度
          const totalProgress = Math.round(
            (state.completedTasks.length / state.tasks.length) * 100
          );

          // 保存状态
          await supabase
            .from('workflow_instances')
            .update({
              progress: totalProgress,
              status: 'running',
              context: state.context
            })
            .eq('id', workflowId);

          sendEvent({
            type: 'progress',
            overallProgress: totalProgress,
            completedTasks: state.completedTasks.length,
            totalTasks: state.tasks.length
          });
        }

        // 最终状态
        const finalStatus = isComplete() ? 'completed' : 'failed';
        
        await supabase
          .from('workflow_instances')
          .update({
            status: finalStatus,
            progress: finalStatus === 'completed' ? 100 : state.completedTasks.length / state.tasks.length * 100,
            completed_at: new Date().toISOString()
          })
          .eq('id', workflowId);

        sendEvent({
          type: 'workflow_complete',
          status: finalStatus,
          completedTasks: state.completedTasks.length,
          failedTasks: state.failedTasks.length,
          totalTasks: state.tasks.length,
          duration: Math.round((Date.now() - state.startTime.getTime()) / 1000),
          context: state.context
        });

        controller.close();

      } catch (error) {
        sendEvent({
          type: 'error',
          message: error instanceof Error ? error.message : '工作流执行失败'
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// 根据任务类型执行
async function executeTaskByType(
  task: Task, 
  context: Record<string, unknown>,
  headers: Headers,
  sendEvent: (event: Record<string, unknown>) => void
): Promise<Record<string, unknown>> {
  
  const customHeaders = HeaderUtils.extractForwardHeaders(headers);
  const config = new Config();

  switch (task.type) {
    case 'script_generation': {
      sendEvent({ type: 'progress', taskId: task.id, progress: 10, message: '正在生成剧本...' });
      
      const llmClient = new LLMClient(config, customHeaders);
      const seriesInfo = (context.seriesInfo as Record<string, unknown>) || {};
      
      const response = await llmClient.invoke([
        { 
          role: 'system' as const, 
          content: `你是专业的AI短剧编剧，根据题材和冲突生成抖音短剧的分镜剧本。${getScriptPromptProfile(DEFAULT_CONFIG.llmModel).styleDirective}` 
        },
        { 
          role: 'user' as const, 
          content: `请为以下短剧生成分镜剧本：
题材：${seriesInfo.genre || '未指定'}
核心冲突：${seriesInfo.conflict || '未指定'}
角色：${JSON.stringify(seriesInfo.characters || [])}` 
        }
      ], {
        model: DEFAULT_CONFIG.llmModel,
        temperature: 0.9
      });

      return {
        script: response.content,
        model: DEFAULT_CONFIG.llmModel
      };
    }

    case 'image_generation': {
      sendEvent({ type: 'progress', taskId: task.id, progress: 10, message: '正在生成图片...' });
      
      const imageClient = new ImageGenerationClient(config, customHeaders);
      const prompt = (context.imagePrompt as string) || task.name;
      
      const response = await imageClient.generate({
        prompt,
        size: '1024x1024',
      });

      const helper = imageClient.getResponseHelper(response);
      
      return {
        imageUrls: helper.imageUrls,
        prompt
      };
    }

    case 'video_generation': {
      sendEvent({ type: 'progress', taskId: task.id, progress: 10, message: '正在生成视频...' });
      
      const videoClient = new VideoGenerationClient(config, customHeaders);
      const videoPrompt = (context.videoPrompt as string) || task.name;
      
      const response = await videoClient.videoGeneration([
        { type: 'text', text: videoPrompt }
      ], {
        model: DEFAULT_CONFIG.videoModel,
        duration: 5,
        ratio: '16:9',
        resolution: '720p',
        maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
      });

      return {
        videoUrl: response.videoUrl,
        lastFrameUrl: response.lastFrameUrl,
        prompt: videoPrompt,
        model: DEFAULT_CONFIG.videoModel
      };
    }

    default:
      return { message: `任务类型 ${task.type} 已跳过` };
  }
}
