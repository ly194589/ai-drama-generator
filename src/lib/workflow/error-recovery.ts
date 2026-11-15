/**
 * 工作流错误恢复机制
 * 
 * 核心功能：
 * 1. 断点续传 - 保存和恢复工作流状态
 * 2. 智能重试 - 分类错误和自适应重试策略
 * 3. 降级执行 - 主流程失败时的备选方案
 * 4. 错误分析 - 根因分析和修复建议
 */

// ============ 类型定义 ============

export type ErrorType = 
  | 'network'        // 网络错误
  | 'timeout'        // 超时错误
  | 'rate_limit'     // 频率限制
  | 'quota_exceeded' // 配额超限
  | 'invalid_input'  // 输入无效
  | 'model_error'    // 模型错误
  | 'resource_busy'  // 资源繁忙
  | 'internal'       // 内部错误
  | 'unknown';       // 未知错误

export type RecoveryAction = 
  | 'retry'          // 重试
  | 'retry_later'    // 延迟重试
  | 'fallback'       // 降级执行
  | 'skip'           // 跳过任务
  | 'abort'          // 终止工作流
  | 'manual';        // 需要人工干预

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  originalError: Error;
  isRecoverable: boolean;
  recoveryAction: RecoveryAction;
  suggestedDelay: number; // 秒
  maxRetries: number;
  context?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number; // 秒
  maxDelay: number;     // 秒
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: ErrorType[];
}

export interface Checkpoint {
  id: string;
  workflowId: string;
  timestamp: number;
  taskStates: Map<string, TaskCheckpoint>;
  context: Record<string, unknown>;
  progress: number;
  version: string;
}

export interface TaskCheckpoint {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  attempts: number;
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  retryCount?: number;
  nextAttemptAt?: number;
  fallbackUsed?: boolean;
}

// ============ 错误分类器 ============

export class ErrorClassifier {
  private static patterns: Array<{
    pattern: RegExp;
    type: ErrorType;
    isRecoverable: boolean;
    recoveryAction: RecoveryAction;
    suggestedDelay: number;
  }> = [
    // 网络错误
    {
      pattern: /network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|network error/i,
      type: 'network',
      isRecoverable: true,
      recoveryAction: 'retry',
      suggestedDelay: 5,
    },
    // 超时错误
    {
      pattern: /timeout|timed out|超时/i,
      type: 'timeout',
      isRecoverable: true,
      recoveryAction: 'retry',
      suggestedDelay: 10,
    },
    // 频率限制
    {
      pattern: /rate limit|too many requests|429|频率限制|请求过于频繁/i,
      type: 'rate_limit',
      isRecoverable: true,
      recoveryAction: 'retry_later',
      suggestedDelay: 60,
    },
    // 配额超限
    {
      pattern: /quota|配额|insufficient|余额不足/i,
      type: 'quota_exceeded',
      isRecoverable: false,
      recoveryAction: 'manual',
      suggestedDelay: 0,
    },
    // 输入无效
    {
      pattern: /invalid|参数错误|invalid input|bad request|400/i,
      type: 'invalid_input',
      isRecoverable: false,
      recoveryAction: 'abort',
      suggestedDelay: 0,
    },
    // 模型错误
    {
      pattern: /model|模型|ai error|generation failed/i,
      type: 'model_error',
      isRecoverable: true,
      recoveryAction: 'retry',
      suggestedDelay: 15,
    },
    // 资源繁忙
    {
      pattern: /busy|resource|资源|overload|503/i,
      type: 'resource_busy',
      isRecoverable: true,
      recoveryAction: 'retry_later',
      suggestedDelay: 30,
    },
  ];

  /**
   * 分类错误
   */
  static classify(error: Error): ClassifiedError {
    const message = error.message;

    // 匹配已知错误模式
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(message)) {
        return {
          type: pattern.type,
          message: this.extractMeaningfulMessage(error),
          originalError: error,
          isRecoverable: pattern.isRecoverable,
          recoveryAction: pattern.recoveryAction,
          suggestedDelay: pattern.suggestedDelay,
          maxRetries: this.getMaxRetries(pattern.type),
          context: this.extractContext(error),
        };
      }
    }

    // 未知错误
    return {
      type: 'unknown',
      message: this.extractMeaningfulMessage(error),
      originalError: error,
      isRecoverable: true,
      recoveryAction: 'retry',
      suggestedDelay: 10,
      maxRetries: 3,
      context: this.extractContext(error),
    };
  }

  private static extractMeaningfulMessage(error: Error): string {
    // 提取有意义的错误消息
    let message = error.message;

    // 移除技术性前缀
    message = message.replace(/^\[.*?\]\s*/, '');
    
    // 截断过长的消息
    if (message.length > 200) {
      message = message.slice(0, 200) + '...';
    }

    return message;
  }

  private static extractContext(error: Error): Record<string, unknown> {
    const context: Record<string, unknown> = {};

    // 提取错误中的上下文信息
    if ('code' in error && error.code !== undefined) {
      context.code = (error as { code?: unknown }).code as string | number | undefined;
    }
    if ('status' in error && error.status !== undefined) {
      context.status = (error as { status?: unknown }).status as string | number | undefined;
    }
    if ('response' in error) {
      try {
        const response = (error as { response?: unknown }).response as
          | { status: unknown; statusText: unknown }
          | undefined;
        if (response && typeof response === 'object') {
          context.response = {
            status: response.status,
            statusText: response.statusText,
          };
        }
      } catch {
        // 忽略
      }
    }

    return context;
  }

  private static getMaxRetries(type: ErrorType): number {
    const maxRetriesMap: Record<ErrorType, number> = {
      network: 5,
      timeout: 3,
      rate_limit: 3,
      quota_exceeded: 0,
      invalid_input: 0,
      model_error: 3,
      resource_busy: 5,
      internal: 2,
      unknown: 2,
    };

    return maxRetriesMap[type];
  }
}

// ============ 重试策略执行器 ============

export class RetryExecutor {
  private policy: RetryPolicy;
  private attemptCount = new Map<string, number>();

  constructor(policy: Partial<RetryPolicy> = {}) {
    this.policy = {
      maxRetries: policy.maxRetries || 3,
      initialDelay: policy.initialDelay || 5,
      maxDelay: policy.maxDelay || 300,
      backoffMultiplier: policy.backoffMultiplier || 2,
      jitter: policy.jitter !== false,
      retryableErrors: policy.retryableErrors || [
        'network',
        'timeout',
        'rate_limit',
        'model_error',
        'resource_busy',
        'unknown',
      ],
    };
  }

  /**
   * 执行带重试的任务
   */
  async execute<T>(
    taskId: string,
    task: () => Promise<T>,
    onRetry?: (attempt: number, error: ClassifiedError, delay: number) => void
  ): Promise<T> {
    let lastError: Error | null = null;
    const attempts = this.attemptCount.get(taskId) || 0;

    for (let attempt = attempts; attempt <= this.policy.maxRetries; attempt++) {
      try {
        const result = await task();
        this.attemptCount.delete(taskId);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classified = ErrorClassifier.classify(lastError);

        // 检查是否可重试
        if (!this.canRetry(classified, attempt)) {
          this.attemptCount.delete(taskId);
          throw lastError;
        }

        // 计算延迟
        const delay = this.calculateDelay(attempt, classified.suggestedDelay);

        // 通知重试
        onRetry?.(attempt + 1, classified, delay);

        // 等待
        await this.sleep(delay);

        // 更新尝试次数
        this.attemptCount.set(taskId, attempt + 1);
      }
    }

    this.attemptCount.delete(taskId);
    throw lastError;
  }

  /**
   * 检查是否可以重试
   */
  private canRetry(classified: ClassifiedError, currentAttempt: number): boolean {
    // 检查尝试次数
    const maxRetries = Math.min(
      this.policy.maxRetries,
      classified.maxRetries
    );

    if (currentAttempt >= maxRetries) {
      return false;
    }

    // 检查错误类型是否可重试
    return this.policy.retryableErrors.includes(classified.type);
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(attempt: number, baseDelay: number): number {
    // 指数退避
    let delay = baseDelay * Math.pow(this.policy.backoffMultiplier, attempt);
    delay = Math.min(delay, this.policy.maxDelay);

    // 添加抖动
    if (this.policy.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return Math.ceil(delay);
  }

  private sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  /**
   * 获取任务的重试次数
   */
  getRetryCount(taskId: string): number {
    return this.attemptCount.get(taskId) || 0;
  }

  /**
   * 重置任务的重试次数
   */
  resetRetryCount(taskId: string): void {
    this.attemptCount.delete(taskId);
  }
}

// ============ 检查点管理器 ============

export class CheckpointManager {
  private static instance: CheckpointManager | null = null;
  private checkpoints = new Map<string, Checkpoint>();
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private version = '2.0.0';

  static getInstance(): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }

  /**
   * 创建检查点
   */
  createCheckpoint(
    workflowId: string,
    taskStates: Map<string, TaskCheckpoint>,
    context: Record<string, unknown>,
    progress: number
  ): Checkpoint {
    const checkpoint: Checkpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      workflowId,
      timestamp: Date.now(),
      taskStates: new Map(taskStates),
      context: { ...context },
      progress,
      version: this.version,
    };

    this.checkpoints.set(workflowId, checkpoint);
    return checkpoint;
  }

  /**
   * 加载检查点
   */
  loadCheckpoint(workflowId: string): Checkpoint | null {
    return this.checkpoints.get(workflowId) || null;
  }

  /**
   * 从数据库加载检查点
   */
  async loadFromDatabase(workflowId: string): Promise<Checkpoint | null> {
    try {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('workflow_checkpoints')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      const checkpoint: Checkpoint = {
        id: data.id,
        workflowId: data.workflow_id,
        timestamp: data.timestamp,
        taskStates: new Map(Object.entries(data.task_states || {})),
        context: data.context || {},
        progress: data.progress || 0,
        version: data.version || '1.0.0',
      };

      this.checkpoints.set(workflowId, checkpoint);
      return checkpoint;
    } catch (error) {
      console.error('[CheckpointManager] 从数据库加载失败:', error);
      return null;
    }
  }

  /**
   * 保存检查点到数据库
   */
  async saveToDatabase(workflowId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(workflowId);
    if (!checkpoint) return false;

    try {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client');
      const supabase = getSupabaseClient();

      const taskStatesObj: Record<string, TaskCheckpoint> = {};
      checkpoint.taskStates.forEach((value, key) => {
        taskStatesObj[key] = value;
      });

      const { error } = await supabase
        .from('workflow_checkpoints')
        .upsert({
          id: checkpoint.id,
          workflow_id: checkpoint.workflowId,
          timestamp: checkpoint.timestamp,
          task_states: taskStatesObj,
          context: checkpoint.context,
          progress: checkpoint.progress,
          version: checkpoint.version,
        });

      if (error) {
        console.error('[CheckpointManager] 保存到数据库失败:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[CheckpointManager] 保存到数据库失败:', error);
      return false;
    }
  }

  /**
   * 删除检查点
   */
  deleteCheckpoint(workflowId: string): boolean {
    return this.checkpoints.delete(workflowId);
  }

  /**
   * 启动自动保存
   */
  startAutoSave(workflowId: string, intervalSeconds: number = 30): void {
    this.stopAutoSave();
    
    this.autoSaveInterval = setInterval(() => {
      this.saveToDatabase(workflowId);
    }, intervalSeconds * 1000);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * 获取工作流的恢复点
   */
  getRecoveryPoint(workflowId: string): {
    lastCompletedTask: string | null;
    nextTaskToRun: string | null;
    progress: number;
  } | null {
    const checkpoint = this.checkpoints.get(workflowId);
    if (!checkpoint) return null;

    let lastCompletedTask: string | null = null;
    let nextTaskToRun: string | null = null;

    checkpoint.taskStates.forEach((state, taskId) => {
      if (state.status === 'completed') {
        lastCompletedTask = taskId;
      } else if (state.status === 'pending' || state.status === 'running') {
        if (!nextTaskToRun) {
          nextTaskToRun = taskId;
        }
      }
    });

    return {
      lastCompletedTask,
      nextTaskToRun,
      progress: checkpoint.progress,
    };
  }
}

// ============ 降级执行器 ============

export class FallbackExecutor {
  private fallbacks = new Map<string, () => Promise<unknown>>();

  /**
   * 注册降级函数
   */
  register(taskId: string, fallback: () => Promise<unknown>): void {
    this.fallbacks.set(taskId, fallback);
  }

  /**
   * 执行降级
   */
  async execute(taskId: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const fallback = this.fallbacks.get(taskId);
    
    if (!fallback) {
      return {
        success: false,
        error: `未找到任务 ${taskId} 的降级函数`,
      };
    }

    try {
      const result = await fallback();
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '降级执行失败',
      };
    }
  }

  /**
   * 检查是否有降级函数
   */
  hasFallback(taskId: string): boolean {
    return this.fallbacks.has(taskId);
  }

  /**
   * 移除降级函数
   */
  remove(taskId: string): boolean {
    return this.fallbacks.delete(taskId);
  }
}

// ============ 错误恢复管理器 ============

export class ErrorRecoveryManager {
  private classifier = ErrorClassifier;
  private retryExecutor: RetryExecutor;
  private checkpointManager: CheckpointManager;
  private fallbackExecutor: FallbackExecutor;

  constructor(retryPolicy: Partial<RetryPolicy> = {}) {
    this.retryExecutor = new RetryExecutor(retryPolicy);
    this.checkpointManager = CheckpointManager.getInstance();
    this.fallbackExecutor = new FallbackExecutor();
  }

  /**
   * 处理错误并尝试恢复
   */
  async handleError(
    taskId: string,
    error: Error,
    options: {
      attempt?: number;
      onRetry?: (attempt: number, delay: number) => void;
      onFallback?: () => void;
      onAbort?: () => void;
    } = {}
  ): Promise<RecoveryResult> {
    const classified = this.classifier.classify(error);
    const attempt = options.attempt || 0;

    switch (classified.recoveryAction) {
      case 'retry':
      case 'retry_later':
        if (attempt < classified.maxRetries) {
          const delay = classified.suggestedDelay;
          options.onRetry?.(attempt + 1, delay);
          
          return {
            success: true,
            action: 'retry',
            message: `将在 ${delay} 秒后重试`,
            retryCount: attempt + 1,
            nextAttemptAt: Date.now() + delay * 1000,
          };
        }
        // 尝试降级
        if (this.fallbackExecutor.hasFallback(taskId)) {
          options.onFallback?.();
          return {
            success: true,
            action: 'fallback',
            message: '重试次数已用尽，使用降级方案',
            fallbackUsed: true,
          };
        }
        // 没有降级方案
        options.onAbort?.();
        return {
          success: false,
          action: 'abort',
          message: '重试次数已用尽且无降级方案',
          retryCount: attempt,
        };

      case 'fallback':
        if (this.fallbackExecutor.hasFallback(taskId)) {
          options.onFallback?.();
          return {
            success: true,
            action: 'fallback',
            message: '使用降级方案',
            fallbackUsed: true,
          };
        }
        options.onAbort?.();
        return {
          success: false,
          action: 'abort',
          message: '无可用降级方案',
        };

      case 'skip':
        return {
          success: true,
          action: 'skip',
          message: '跳过此任务',
        };

      case 'abort':
        options.onAbort?.();
        return {
          success: false,
          action: 'abort',
          message: '错误不可恢复',
        };

      case 'manual':
        return {
          success: false,
          action: 'manual',
          message: '需要人工干预',
        };

      default:
        options.onAbort?.();
        return {
          success: false,
          action: 'abort',
          message: '未知错误',
        };
    }
  }

  /**
   * 注册降级函数
   */
  registerFallback(taskId: string, fallback: () => Promise<unknown>): void {
    this.fallbackExecutor.register(taskId, fallback);
  }

  /**
   * 创建检查点
   */
  createCheckpoint(
    workflowId: string,
    taskStates: Map<string, TaskCheckpoint>,
    context: Record<string, unknown>,
    progress: number
  ): Checkpoint {
    return this.checkpointManager.createCheckpoint(workflowId, taskStates, context, progress);
  }

  /**
   * 恢复工作流
   */
  async restoreWorkflow(workflowId: string): Promise<Checkpoint | null> {
    // 先尝试内存
    let checkpoint = this.checkpointManager.loadCheckpoint(workflowId);
    
    if (!checkpoint) {
      // 再尝试数据库
      checkpoint = await this.checkpointManager.loadFromDatabase(workflowId);
    }

    return checkpoint;
  }

  /**
   * 保存检查点
   */
  async saveCheckpoint(workflowId: string): Promise<boolean> {
    return this.checkpointManager.saveToDatabase(workflowId);
  }

  /**
   * 获取重试执行器
   */
  getRetryExecutor(): RetryExecutor {
    return this.retryExecutor;
  }

  /**
   * 获取降级执行器
   */
  getFallbackExecutor(): FallbackExecutor {
    return this.fallbackExecutor;
  }
}

// ============ 导出 ============

export default ErrorRecoveryManager;
