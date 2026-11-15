/**
 * 工作流系统统一入口
 * 
 * 提供完整的工作流解决方案：
 * - 核心调度器
 * - 并行执行引擎
 * - 智能缓存系统
 * - 错误恢复机制
 * - 进度反馈系统
 */

import {
  WorkflowScheduler as Scheduler,
  createLLMTask,
  createImageTask,
  createVideoTask,
  createTTSTask,
  createDramaProductionWorkflow,
  type TaskStatus,
  type WorkflowStatus,
  type TaskResult,
  type TaskExecutionContext,
  type TaskDefinition,
  type TaskState,
  type WorkflowState,
  type WorkflowConfig,
  type WorkflowResult,
} from './scheduler';

import {
  DAGBuilder,
  ResourceManager,
  ParallelExecutor,
  inferTaskResources,
  estimateTaskDuration,
  type ResourceType,
  type ResourceLimits,
  type TaskResource,
  type ExecutorTask,
  type ExecutorTaskState,
  type ExecutionPlan,
  type ParallelExecutorConfig,
} from './parallel-executor';

import {
  SmartCache,
  CacheKeyGenerator,
  getWorkflowCache,
  type CacheEntry,
  type CacheConfig,
  type CacheStats,
} from './smart-cache';

import {
  ErrorClassifier,
  RetryExecutor,
  CheckpointManager,
  FallbackExecutor,
  ErrorRecoveryManager,
  type ErrorType,
  type RecoveryAction,
  type ClassifiedError,
  type RetryPolicy,
  type Checkpoint,
  type TaskCheckpoint,
  type RecoveryResult,
} from './error-recovery';

import {
  TimeEstimator,
  ProgressTracker,
  SSEProgressPusher,
  type TaskProgress,
  type WorkflowProgress,
  type ProgressEvent,
  type ProgressConfig,
} from './progress-tracker';

// 重新导出类型
export type {
  TaskStatus,
  WorkflowStatus,
  TaskResult,
  TaskExecutionContext,
  TaskDefinition,
  TaskState,
  WorkflowState,
  WorkflowConfig,
  WorkflowResult,
  ResourceType,
  ResourceLimits,
  TaskResource,
  ExecutorTask,
  ExecutorTaskState,
  ExecutionPlan,
  ParallelExecutorConfig,
  CacheEntry,
  CacheConfig,
  CacheStats,
  ErrorType,
  RecoveryAction,
  ClassifiedError,
  RetryPolicy,
  Checkpoint,
  TaskCheckpoint,
  RecoveryResult,
  TaskProgress,
  WorkflowProgress,
  ProgressEvent,
  ProgressConfig,
};

// 重新导出类和函数
export {
  Scheduler as WorkflowScheduler,
  createLLMTask,
  createImageTask,
  createVideoTask,
  createTTSTask,
  createDramaProductionWorkflow,
  DAGBuilder,
  ResourceManager,
  ParallelExecutor,
  inferTaskResources,
  estimateTaskDuration,
  SmartCache,
  CacheKeyGenerator,
  getWorkflowCache,
  ErrorClassifier,
  RetryExecutor,
  CheckpointManager,
  FallbackExecutor,
  ErrorRecoveryManager,
  TimeEstimator,
  ProgressTracker,
  SSEProgressPusher,
};

// ============ 工作流执行器 ============

export interface WorkflowExecutorOptions {
  workflowId: string;
  tasks: TaskDefinition[];
  config?: Partial<WorkflowConfig>;
  enableCache?: boolean;
  enableRecovery?: boolean;
}

export interface WorkflowExecutor {
  scheduler: Scheduler;
  progressTracker: ProgressTracker;
  cache: SmartCache | null;
  errorRecovery: ErrorRecoveryManager | null;
  execute: (context?: Record<string, unknown>) => Promise<WorkflowResult>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  getProgress: () => WorkflowProgress;
  destroy: () => void;
}

/**
 * 创建完整的工作流执行器
 */
export function createWorkflowExecutor(options: WorkflowExecutorOptions): WorkflowExecutor {
  const { workflowId, tasks, config, enableCache = true, enableRecovery = true } = options;

  // 创建调度器
  const scheduler = new Scheduler(workflowId, tasks, config);

  // 创建进度追踪器
  const progressTracker = new ProgressTracker(workflowId, {
    onProgress: config?.onWorkflowProgress
      ? (progress) => config.onWorkflowProgress!(progress.overallProgress, progress.message)
      : undefined,
  });

  // 创建缓存（如果启用）
  const cache = enableCache 
    ? new SmartCache({ persistToDatabase: true })
    : null;

  // 创建错误恢复管理器（如果启用）
  const errorRecovery = enableRecovery
    ? new ErrorRecoveryManager()
    : null;

  return {
    scheduler,
    progressTracker,
    cache,
    errorRecovery,

    /**
     * 执行工作流
     */
    async execute(context: Record<string, unknown> = {}) {
      // 初始化进度追踪
      progressTracker.initTasks(tasks.map(t => ({
        id: t.id,
        name: t.name,
        weight: t.weight,
        estimatedDuration: t.timeout,
      })));

      try {
        // 执行工作流
        const result = await scheduler.start(context);
        
        // 更新进度
        progressTracker.complete();
        
        return result;
      } catch (error) {
        progressTracker.failTask('workflow', error instanceof Error ? error.message : '执行失败');
        throw error;
      }
    },

    /**
     * 暂停工作流
     */
    pause() {
      scheduler.pause();
      progressTracker.pause();
    },

    /**
     * 恢复工作流
     */
    resume() {
      scheduler.resume();
      progressTracker.resume();
    },

    /**
     * 取消工作流
     */
    cancel() {
      scheduler.cancel();
      progressTracker.cancel();
    },

    /**
     * 获取当前进度
     */
    getProgress() {
      return progressTracker.getProgress();
    },

    /**
     * 销毁执行器
     */
    destroy() {
      progressTracker.destroy();
      cache?.destroy();
    },
  };
}

// 默认导出
export default {
  WorkflowScheduler: Scheduler,
  createWorkflowExecutor,
  DAGBuilder,
  ResourceManager,
  ParallelExecutor,
  SmartCache,
  CacheKeyGenerator,
  ErrorRecoveryManager,
  ProgressTracker,
  SSEProgressPusher,
};
