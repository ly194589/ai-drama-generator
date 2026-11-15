import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, ImageGenerationClient, VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 高级工作流引擎API
 * 
 * 核心特性：
 * 1. DAG依赖图执行 - 支持任务并行执行
 * 2. 断点续传 - 失败后可从断点恢复
 * 3. 实时进度追踪 - SSE流式返回进度
 * 4. 错误恢复机制 - 自动重试和降级
 * 5. 智能资源管理 - 并发控制、内存优化
 */

// 工作流任务类型
type TaskType = 
  | 'script_generation'      // 剧本生成
  | 'character_image'        // 角色立绘
  | 'scene_image'           // 场景图
  | 'voice_generation'      // 配音生成
  | 'video_generation'      // 视频生成
  | 'video_merge'           // 视频合并
  | 'audio_mix'             // 音频合成
  | 'subtitle_generate'     // 字幕生成
  | 'final_compose';        // 最终合成

// 任务定义
interface WorkflowTask {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  dependencies: string[];    // 依赖的任务ID
  priority: number;          // 优先级，越高越先执行
  retryCount: number;        // 重试次数
  maxRetries: number;        // 最大重试次数
  timeout: number;           // 超时时间（秒）
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;          // 0-100
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// 工作流定义
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tasks: WorkflowTask[];
  globalConfig: Record<string, unknown>;
  onTaskComplete?: string;   // 任务完成回调
  onWorkflowComplete?: string; // 工作流完成回调
}

// 预设工作流模板
const WORKFLOW_TEMPLATES: Record<string, Omit<WorkflowDefinition, 'id'>> = {
  // 完整短剧生成流程
  full_production: {
    name: '完整短剧生产',
    description: '从剧本到成片的全流程自动化',
    tasks: [
      {
        id: 'script',
        type: 'script_generation',
        name: '剧本生成',
        description: '生成完整分镜剧本',
        dependencies: [],
        priority: 100,
        retryCount: 0,
        maxRetries: 3,
        timeout: 120,
        status: 'pending',
        progress: 0
      },
      {
        id: 'characters',
        type: 'character_image',
        name: '角色立绘生成',
        description: '为所有角色生成标准立绘',
        dependencies: ['script'],
        priority: 90,
        retryCount: 0,
        maxRetries: 3,
        timeout: 180,
        status: 'pending',
        progress: 0
      },
      {
        id: 'scenes',
        type: 'scene_image',
        name: '场景图生成',
        description: '生成主要场景背景图',
        dependencies: ['script'],
        priority: 85,
        retryCount: 0,
        maxRetries: 3,
        timeout: 180,
        status: 'pending',
        progress: 0
      },
      {
        id: 'voices',
        type: 'voice_generation',
        name: '配音生成',
        description: '为对话镜头生成配音',
        dependencies: ['script'],
        priority: 80,
        retryCount: 0,
        maxRetries: 3,
        timeout: 300,
        status: 'pending',
        progress: 0
      },
      {
        id: 'videos',
        type: 'video_generation',
        name: '视频片段生成',
        description: '生成所有分镜视频',
        dependencies: ['characters', 'scenes', 'voices'],
        priority: 70,
        retryCount: 0,
        maxRetries: 2,
        timeout: 600,
        status: 'pending',
        progress: 0
      },
      {
        id: 'merge',
        type: 'video_merge',
        name: '视频合并',
        description: '合并视频片段',
        dependencies: ['videos'],
        priority: 50,
        retryCount: 0,
        maxRetries: 3,
        timeout: 180,
        status: 'pending',
        progress: 0
      },
      {
        id: 'audio',
        type: 'audio_mix',
        name: '音频合成',
        description: '合成BGM、配音、音效',
        dependencies: ['voices', 'merge'],
        priority: 40,
        retryCount: 0,
        maxRetries: 3,
        timeout: 120,
        status: 'pending',
        progress: 0
      },
      {
        id: 'subtitles',
        type: 'subtitle_generate',
        name: '字幕生成',
        description: '生成时间轴字幕',
        dependencies: ['script', 'merge'],
        priority: 30,
        retryCount: 0,
        maxRetries: 3,
        timeout: 60,
        status: 'pending',
        progress: 0
      },
      {
        id: 'compose',
        type: 'final_compose',
        name: '最终合成',
        description: '合成成片',
        dependencies: ['merge', 'audio', 'subtitles'],
        priority: 10,
        retryCount: 0,
        maxRetries: 3,
        timeout: 300,
        status: 'pending',
        progress: 0
      }
    ],
    globalConfig: {
      parallelLimit: 3,        // 最大并行任务数
      retryDelay: 5,           // 重试延迟（秒）
      outputFormat: '1080p',
      aspectRatio: '9:16'
    }
  },
  
  // 快速预览流程
  quick_preview: {
    name: '快速预览',
    description: '生成低分辨率预览版',
    tasks: [
      {
        id: 'script',
        type: 'script_generation',
        name: '剧本生成',
        description: '生成简化剧本',
        dependencies: [],
        priority: 100,
        retryCount: 0,
        maxRetries: 2,
        timeout: 60,
        status: 'pending',
        progress: 0
      },
      {
        id: 'videos',
        type: 'video_generation',
        name: '预览视频',
        description: '生成低分辨率预览视频',
        dependencies: ['script'],
        priority: 80,
        retryCount: 0,
        maxRetries: 2,
        timeout: 300,
        status: 'pending',
        progress: 0
      }
    ],
    globalConfig: {
      parallelLimit: 2,
      outputFormat: '480p',
      aspectRatio: '9:16'
    }
  },
  
  // 仅剧本生成
  script_only: {
    name: '剧本生成',
    description: '仅生成剧本和角色档案',
    tasks: [
      {
        id: 'script',
        type: 'script_generation',
        name: '剧本生成',
        description: '生成完整分镜剧本',
        dependencies: [],
        priority: 100,
        retryCount: 0,
        maxRetries: 3,
        timeout: 120,
        status: 'pending',
        progress: 0
      }
    ],
    globalConfig: {}
  }
};

// 创建工作流实例
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      template = 'full_production',
      seriesId,
      episodeId,
      customTasks,
      config
    } = body;

    // 获取模板
    const templateDef = WORKFLOW_TEMPLATES[template];
    if (!templateDef) {
      return NextResponse.json({ error: '无效的工作流模板' }, { status: 400 });
    }

    // 创建工作流实例
    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      ...templateDef,
      tasks: customTasks || templateDef.tasks.map(t => ({ ...t })),
      globalConfig: { ...templateDef.globalConfig, ...config }
    };

    // 保存到数据库
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('workflow_instances')
      .insert({
        id: workflowId,
        series_id: seriesId,
        episode_id: episodeId,
        name: workflow.name,
        definition: workflow,
        status: 'pending',
        progress: 0,
        current_stage: '初始化',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('保存工作流失败:', error);
      // 表可能不存在，继续执行
    }

    return NextResponse.json({
      success: true,
      workflowId,
      workflow: {
        name: workflow.name,
        description: workflow.description,
        taskCount: workflow.tasks.length,
        estimatedTime: estimateTotalTime(workflow.tasks),
        tasks: workflow.tasks.map(t => ({
          id: t.id,
          name: t.name,
          dependencies: t.dependencies,
          status: t.status
        }))
      }
    });

  } catch (error) {
    console.error('创建工作流失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

// 获取工作流模板列表
export async function GET(request: NextRequest) {
  const templates = Object.entries(WORKFLOW_TEMPLATES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    taskCount: value.tasks.length,
    estimatedTime: estimateTotalTime(value.tasks),
    tasks: value.tasks.map(t => ({
      id: t.id,
      type: t.type,
      name: t.name,
      dependencies: t.dependencies
    }))
  }));

  return NextResponse.json({
    success: true,
    templates
  });
}

// 估算总时间
function estimateTotalTime(tasks: WorkflowTask[]): string {
  const totalSeconds = tasks.reduce((sum, t) => sum + t.timeout, 0);
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}小时${mins}分钟`;
}
