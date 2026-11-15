/**
 * 工作流核心调度器
 * 
 * 核心功能：
 * 1. 统一的任务调度和状态管理
 * 2. DAG依赖解析和并行执行
 * 3. 智能缓存和断点续传
 * 4. 错误恢复和重试机制
 * 5. 精确进度追踪和预估
 */

// ============ 类型定义 ============

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TaskResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number; // 毫秒
  retries: number;
  cached: boolean;
}

export interface TaskExecutionContext {
  workflowId: string;
  taskId: string;
  attempt: number;
  signal: AbortSignal;
  progressCallback: (progress: number, message?: string) => void;
  logCallback: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface TaskDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  type: string;
  dependencies: string[];
  priority: number;
  timeout: number; // 秒
  maxRetries: number;
  retryDelay: number; // 秒
  weight: number; // 权重，用于进度计算
  input?: TInput;
  execute: (context: TaskExecutionContext, input: TInput) => Promise<TaskResult<TOutput>>;
  onProgress?: (progress: number) => void;
  fallback?: (error: Error, context: TaskExecutionContext) => Promise<TaskResult<TOutput>>;
}

export interface TaskState {
  id: string;
  status: TaskStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  attempts: number;
  result?: unknown;
  cached: boolean;
}

export interface WorkflowState {
  id: string;
  status: WorkflowStatus;
  tasks: Map<string, TaskState>;
  context: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  totalDuration?: number;
  progress: number;
  estimatedTimeRemaining?: number;
}

export interface WorkflowConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryDelay: number;
  enableCache: boolean;
  cacheTTL: number; // 秒
  persistState: boolean;
  onTaskStart?: (taskId: string, task: TaskDefinition) => void;
  onTaskProgress?: (taskId: string, progress: number, message?: string) => void;
  onTaskComplete?: (taskId: string, result: TaskResult) => void;
  onTaskError?: (taskId: string, error: Error) => void;
  onWorkflowProgress?: (progress: number, message: string) => void;
  onWorkflowComplete?: (result: WorkflowResult) => void;
}

export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  status: WorkflowStatus;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  totalTasks: number;
  duration: number;
  context: Record<string, unknown>;
  errors: Array<{ taskId: string; error: string }>;
}

// ============ 缓存管理器 ============

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

class WorkflowCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 3600) { // 默认1小时
    this.defaultTTL = defaultTTL;
  }

  generateKey(taskId: string, input: unknown): string {
    const inputHash = this.hashInput(input);
    return `${taskId}:${inputHash}`;
  }

  private hashInput(input: unknown): string {
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  get<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T = unknown>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      key,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// ============ 任务队列 ============

interface QueuedTask {
  task: TaskDefinition;
  priority: number;
  enqueuedAt: Date;
}

class TaskQueue {
  private queue: QueuedTask[] = [];

  enqueue(task: TaskDefinition): void {
    const queuedTask: QueuedTask = {
      task,
      priority: task.priority,
      enqueuedAt: new Date(),
    };

    // 按优先级插入（优先级高的在前）
    let insertIndex = this.queue.findIndex(t => t.priority < task.priority);
    if (insertIndex === -1) {
      insertIndex = this.queue.length;
    }
    this.queue.splice(insertIndex, 0, queuedTask);
  }

  dequeue(): TaskDefinition | null {
    const item = this.queue.shift();
    return item?.task || null;
  }

  peek(): TaskDefinition | null {
    return this.queue[0]?.task || null;
  }

  remove(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.task.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  get length(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  toArray(): TaskDefinition[] {
    return this.queue.map(t => t.task);
  }
}

// ============ 工作流调度器 ============

export class WorkflowScheduler {
  private tasks: Map<string, TaskDefinition> = new Map();
  private state: WorkflowState;
  private config: WorkflowConfig;
  private cache: WorkflowCache;
  private queue: TaskQueue;
  private runningTasks: Map<string, AbortController> = new Map();
  private isRunning = false;
  private isPaused = false;
  private abortController: AbortController | null = null;

  constructor(
    workflowId: string,
    tasks: TaskDefinition[],
    config: Partial<WorkflowConfig> = {}
  ) {
    // 初始化任务定义
    tasks.forEach(task => this.tasks.set(task.id, task));

    // 初始化状态
    this.state = {
      id: workflowId,
      status: 'pending',
      tasks: new Map(tasks.map(t => [t.id, {
        id: t.id,
        status: 'pending',
        progress: 0,
        attempts: 0,
        cached: false,
      }])),
      context: {},
      progress: 0,
    };

    // 合并配置
    this.config = {
      maxConcurrentTasks: 3,
      taskTimeout: 300,
      retryDelay: 5,
      enableCache: true,
      cacheTTL: 3600,
      persistState: true,
      ...config,
    };

    // 初始化缓存和队列
    this.cache = new WorkflowCache(this.config.cacheTTL);
    this.queue = new TaskQueue();
  }

  // ============ 核心方法 ============

  /**
   * 启动工作流
   */
  async start(initialContext: Record<string, unknown> = {}): Promise<WorkflowResult> {
    if (this.isRunning) {
      throw new Error('工作流已在运行中');
    }

    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();

    this.state.status = 'running';
    this.state.startedAt = new Date();
    this.state.context = { ...initialContext };

    // 初始化任务队列
    this.initializeQueue();

    // 执行任务
    try {
      await this.runTasks();
    } catch (error) {
      if (error instanceof Error && error.message === 'CANCELLED') {
        this.state.status = 'cancelled';
      } else {
        this.state.status = 'failed';
      }
    }

    // 生成结果
    const result = this.generateResult();
    this.config.onWorkflowComplete?.(result);

    this.isRunning = false;
    return result;
  }

  /**
   * 暂停工作流
   */
  pause(): void {
    this.isPaused = true;
    this.state.status = 'paused';
  }

  /**
   * 恢复工作流
   */
  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.state.status = 'running';
    // 重新开始执行
    this.runTasks();
  }

  /**
   * 取消工作流
   */
  cancel(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.abortController?.abort();
    this.state.status = 'cancelled';

    // 取消所有运行中的任务
    this.runningTasks.forEach(controller => controller.abort());
    this.runningTasks.clear();
  }

  /**
   * 重试失败的任务
   */
  async retryFailed(): Promise<void> {
    const failedTasks = Array.from(this.state.tasks.entries())
      .filter(([_, state]) => state.status === 'failed')
      .map(([id]) => id);

    for (const taskId of failedTasks) {
      this.state.tasks.set(taskId, {
        id: taskId,
        status: 'pending',
        progress: 0,
        attempts: 0,
        cached: false,
      });

      const task = this.tasks.get(taskId);
      if (task) {
        this.queue.enqueue(task);
      }
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.state.status = 'running';
      await this.runTasks();
    }
  }

  /**
   * 从检查点恢复
   */
  restoreFromCheckpoint(checkpoint: WorkflowState): void {
    this.state = { ...checkpoint };
    
    // 将未完成的任务加入队列
    this.state.tasks.forEach((taskState, taskId) => {
      if (taskState.status === 'pending' || taskState.status === 'queued') {
        const task = this.tasks.get(taskId);
        if (task && this.canExecute(task)) {
          this.queue.enqueue(task);
          taskState.status = 'queued';
        }
      }
    });
  }

  /**
   * 获取当前状态
   */
  getState(): WorkflowState {
    return { ...this.state };
  }

  /**
   * 获取任务状态
   */
  getTaskState(taskId: string): TaskState | undefined {
    return this.state.tasks.get(taskId);
  }

  /**
   * 获取上下文数据
   */
  getContext(): Record<string, unknown> {
    return { ...this.state.context };
  }

  // ============ 内部方法 ============

  private initializeQueue(): void {
    this.queue.clear();

    // 将所有可执行的任务加入队列
    this.tasks.forEach(task => {
      const taskState = this.state.tasks.get(task.id);
      if (taskState?.status === 'pending' && this.canExecute(task)) {
        this.queue.enqueue(task);
        taskState.status = 'queued';
      }
    });
  }

  private canExecute(task: TaskDefinition): boolean {
    // 检查所有依赖是否已完成
    return task.dependencies.every(depId => {
      const depState = this.state.tasks.get(depId);
      return depState?.status === 'completed';
    });
  }

  private async runTasks(): Promise<void> {
    const running: Promise<void>[] = [];

    while (this.isRunning && !this.isPaused) {
      // 检查是否被取消
      if (this.abortController?.signal.aborted) {
        throw new Error('CANCELLED');
      }

      // 获取可执行的任务
      while (this.runningTasks.size < this.config.maxConcurrentTasks && this.queue.length > 0) {
        const task = this.queue.dequeue();
        if (!task) break;

        // 再次检查依赖
        if (!this.canExecute(task)) {
          // 放回队列末尾
          this.queue.enqueue({ ...task, priority: task.priority - 1 });
          continue;
        }

        // 执行任务
        const promise = this.executeTask(task);
        running.push(promise);
      }

      // 检查是否所有任务完成
      if (this.runningTasks.size === 0 && this.queue.length === 0) {
        const allCompleted = Array.from(this.state.tasks.values())
          .every(state => 
            state.status === 'completed' || 
            state.status === 'skipped' ||
            state.status === 'failed'
          );

        if (allCompleted) {
          this.state.status = 'completed';
          this.state.completedAt = new Date();
          this.state.totalDuration = this.state.completedAt.getTime()! - this.state.startedAt!.getTime();
          break;
        }

        // 检查是否有阻塞的任务
        const blockedTasks = Array.from(this.state.tasks.values())
          .filter(state => state.status === 'pending' || state.status === 'queued');

        if (blockedTasks.length > 0 && this.runningTasks.size === 0) {
          // 有待执行任务但无法执行，说明存在依赖问题
          const failedDeps = blockedTasks.map(t => t.id);
          console.error(`[Workflow] 任务被阻塞: ${failedDeps.join(', ')}`);
          
          // 将阻塞的任务标记为失败
          blockedTasks.forEach(taskState => {
            taskState.status = 'failed';
            taskState.error = '依赖任务未完成';
          });

          this.state.status = 'failed';
          break;
        }
      }

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 等待所有运行中的任务完成
    await Promise.allSettled(running);
  }

  private async executeTask(task: TaskDefinition): Promise<void> {
    const taskState = this.state.tasks.get(task.id)!;
    taskState.status = 'running';
    taskState.startedAt = new Date();
    taskState.attempts++;

    const controller = new AbortController();
    this.runningTasks.set(task.id, controller);

    this.config.onTaskStart?.(task.id, task);

    try {
      // 检查缓存
      const cacheKey = this.cache.generateKey(task.id, task.input);
      let result: TaskResult;

      if (this.config.enableCache && this.cache.has(cacheKey)) {
        const cachedData = this.cache.get(cacheKey);
        result = {
          success: true,
          data: cachedData,
          duration: 0,
          retries: 0,
          cached: true,
        };
        taskState.cached = true;
      } else {
        // 执行任务
        const context: TaskExecutionContext = {
          workflowId: this.state.id,
          taskId: task.id,
          attempt: taskState.attempts,
          signal: controller.signal,
          progressCallback: (progress, message) => {
            taskState.progress = progress;
            this.config.onTaskProgress?.(task.id, progress, message);
            this.updateOverallProgress();
          },
          logCallback: (level, message) => {
            console.log(`[Workflow][${task.id}][${level}] ${message}`);
          },
        };

        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('任务超时')), task.timeout * 1000);
        });

        result = await Promise.race([
          task.execute(context, task.input),
          timeoutPromise,
        ]);

        // 缓存结果
        if (this.config.enableCache && result.success && !result.cached) {
          this.cache.set(cacheKey, result.data);
        }
      }

      // 更新状态
      taskState.status = 'completed';
      taskState.progress = 100;
      taskState.completedAt = new Date();
      taskState.duration = taskState.completedAt.getTime() - taskState.startedAt.getTime();
      taskState.result = result.data;

      // 更新上下文
      if (result.data !== undefined) {
        this.state.context[task.id] = result.data;
      }

      this.config.onTaskComplete?.(task.id, result);

      // 将依赖此任务的待执行任务加入队列
      this.enqueueDependentTasks(task.id);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // 检查是否需要重试
      if (taskState.attempts < task.maxRetries && !controller.signal.aborted) {
        // 延迟重试
        await new Promise(resolve => setTimeout(resolve, task.retryDelay * 1000));
        
        // 重置状态
        taskState.status = 'pending';
        taskState.progress = 0;
        
        // 重新加入队列
        this.queue.enqueue({ ...task, priority: task.priority - 1 });
      } else if (task.fallback && !controller.signal.aborted) {
        // 执行降级逻辑
        try {
          const context: TaskExecutionContext = {
            workflowId: this.state.id,
            taskId: task.id,
            attempt: taskState.attempts,
            signal: controller.signal,
            progressCallback: (progress) => {
              taskState.progress = progress;
              this.updateOverallProgress();
            },
            logCallback: (level, message) => {
              console.log(`[Workflow][${task.id}][${level}] ${message}`);
            },
          };
          
          const result = await task.fallback(err, context);
          
          if (result.success) {
            taskState.status = 'completed';
            taskState.result = result.data;
            this.state.context[task.id] = result.data;
            this.config.onTaskComplete?.(task.id, result);
            this.enqueueDependentTasks(task.id);
          } else {
            throw new Error(result.error || '降级执行失败');
          }
        } catch (fallbackError) {
          taskState.status = 'failed';
          taskState.error = fallbackError instanceof Error ? fallbackError.message : '降级执行失败';
          this.config.onTaskError?.(task.id, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
        }
      } else {
        taskState.status = 'failed';
        taskState.error = err.message;
        this.config.onTaskError?.(task.id, err);
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.updateOverallProgress();
    }
  }

  private enqueueDependentTasks(completedTaskId: string): void {
    this.tasks.forEach(task => {
      if (task.dependencies.includes(completedTaskId)) {
        const taskState = this.state.tasks.get(task.id);
        if (taskState?.status === 'pending' && this.canExecute(task)) {
          this.queue.enqueue(task);
          taskState.status = 'queued';
        }
      }
    });
  }

  private updateOverallProgress(): void {
    const totalWeight = Array.from(this.tasks.values())
      .reduce((sum, task) => sum + task.weight, 0);

    const completedWeight = Array.from(this.state.tasks.values())
      .reduce((sum, state) => {
        const task = this.tasks.get(state.id);
        if (!task) return sum;
        
        if (state.status === 'completed') {
          return sum + task.weight;
        } else if (state.status === 'running') {
          return sum + task.weight * (state.progress / 100);
        }
        return sum;
      }, 0);

    this.state.progress = totalWeight > 0 
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;

    // 估算剩余时间
    if (this.state.startedAt && this.state.progress > 0) {
      const elapsed = Date.now() - this.state.startedAt.getTime();
      const estimatedTotal = elapsed / (this.state.progress / 100);
      this.state.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
    }

    this.config.onWorkflowProgress?.(
      this.state.progress,
      this.getProgressMessage()
    );
  }

  private getProgressMessage(): string {
    const completed = Array.from(this.state.tasks.values())
      .filter(s => s.status === 'completed').length;
    const total = this.state.tasks.size;
    const running = Array.from(this.state.tasks.values())
      .filter(s => s.status === 'running').length;

    if (running > 0) {
      return `正在执行 ${running} 个任务，已完成 ${completed}/${total}`;
    }
    return `已完成 ${completed}/${total} 个任务`;
  }

  private generateResult(): WorkflowResult {
    const completedTasks = Array.from(this.state.tasks.values())
      .filter(s => s.status === 'completed').length;
    const failedTasks = Array.from(this.state.tasks.values())
      .filter(s => s.status === 'failed').length;
    const skippedTasks = Array.from(this.state.tasks.values())
      .filter(s => s.status === 'skipped').length;

    const errors = Array.from(this.state.tasks.entries())
      .filter(([_, state]) => state.status === 'failed' && state.error)
      .map(([id, state]) => ({ taskId: id, error: state.error! }));

    return {
      success: failedTasks === 0 && this.state.status === 'completed',
      workflowId: this.state.id,
      status: this.state.status,
      completedTasks,
      failedTasks,
      skippedTasks,
      totalTasks: this.state.tasks.size,
      duration: this.state.totalDuration || 0,
      context: this.state.context,
      errors,
    };
  }
}

// ============ 预定义任务类型 ============

/**
 * 创建LLM调用任务
 */
export function createLLMTask(
  id: string,
  name: string,
  prompt: string | ((context: Record<string, unknown>) => string),
  options: {
    dependencies?: string[];
    priority?: number;
    timeout?: number;
    maxRetries?: number;
    model?: string;
    temperature?: number;
  } = {}
): TaskDefinition {
  return {
    id,
    name,
    description: `LLM任务: ${name}`,
    type: 'llm',
    dependencies: options.dependencies || [],
    priority: options.priority || 50,
    timeout: options.timeout || 120,
    maxRetries: options.maxRetries || 3,
    retryDelay: 5,
    weight: 10,
    execute: async (context, input) => {
      const startTime = Date.now();
      try {
        const { LLMClient, Config, HeaderUtils } = await import('coze-coding-dev-sdk');
        
        const config = new Config();
        const client = new LLMClient(config);
        
        const promptText = typeof prompt === 'function' 
          ? prompt({ ...context, input: input as Record<string, unknown> })
          : prompt;

        const response = await client.invoke([
          { role: 'system', content: '你是一个专业的AI助手。' },
          { role: 'user', content: promptText },
        ], {
          model: options.model || 'doubao-seed-2-0-pro-260215',
          temperature: options.temperature || 0.7,
        });

        return {
          success: true,
          data: response.content,
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'LLM调用失败',
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      }
    },
  };
}

/**
 * 创建图片生成任务
 */
export function createImageTask(
  id: string,
  name: string,
  prompt: string | ((context: Record<string, unknown>) => string),
  options: {
    dependencies?: string[];
    priority?: number;
    timeout?: number;
    maxRetries?: number;
    size?: string;
  } = {}
): TaskDefinition {
  return {
    id,
    name,
    description: `图片生成: ${name}`,
    type: 'image',
    dependencies: options.dependencies || [],
    priority: options.priority || 50,
    timeout: options.timeout || 180,
    maxRetries: options.maxRetries || 2,
    retryDelay: 10,
    weight: 15,
    execute: async (context) => {
      const startTime = Date.now();
      try {
        const { ImageGenerationClient, Config } = await import('coze-coding-dev-sdk');
        
        const config = new Config();
        const client = new ImageGenerationClient(config);
        
        const promptText = typeof prompt === 'function'
          ? prompt({ ...context, input: {} })
          : prompt;

        context.progressCallback(10, '正在生成图片...');

        const response = await client.generate({
          prompt: promptText,
          size: options.size || '4K',
          watermark: false,
        });

        const helper = client.getResponseHelper(response);

        if (!helper.success || helper.imageUrls.length === 0) {
          const errorMsg = helper.errorMessages?.join(', ') || '图片生成失败';
          throw new Error(errorMsg);
        }

        context.progressCallback(100, '图片生成完成');

        return {
          success: true,
          data: { urls: helper.imageUrls, prompt: promptText },
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '图片生成失败',
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      }
    },
  };
}

/**
 * 创建视频生成任务
 */
export function createVideoTask(
  id: string,
  name: string,
  prompt: string | ((context: Record<string, unknown>) => string),
  options: {
    dependencies?: string[];
    priority?: number;
    timeout?: number;
    maxRetries?: number;
    duration?: number;
    aspectRatio?: string;
  } = {}
): TaskDefinition {
  return {
    id,
    name,
    description: `视频生成: ${name}`,
    type: 'video',
    dependencies: options.dependencies || [],
    priority: options.priority || 50,
    timeout: options.timeout || 600,
    maxRetries: options.maxRetries || 2,
    retryDelay: 15,
    weight: 25,
    execute: async (context) => {
      const startTime = Date.now();
      try {
        const { VideoGenerationClient, Config } = await import('coze-coding-dev-sdk');
        
        const config = new Config();
        const client = new VideoGenerationClient(config);
        
        const promptText = typeof prompt === 'function'
          ? prompt({ ...context, input: {} })
          : prompt;

        context.progressCallback(5, '正在生成视频...');

        const response = await client.videoGeneration(
          [{ type: 'text', text: promptText }],
          {
            model: 'doubao-seedance-2-0-260128',
            duration: options.duration || 5,
            ratio: (options.aspectRatio || '9:16') as import('coze-coding-dev-sdk').Ratio,
            resolution: '1080p',
            generateAudio: false,
            maxWaitTime: 5 * 60 * 1000,
          }
        );

        if (!response.videoUrl) {
          throw new Error('视频生成失败：未返回视频URL');
        }

        context.progressCallback(100, '视频生成完成');

        return {
          success: true,
          data: { 
            videoUrl: response.videoUrl,
            lastFrameUrl: response.lastFrameUrl,
            prompt: promptText,
          },
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '视频生成失败',
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      }
    },
  };
}

/**
 * 创建TTS语音合成任务
 */
export function createTTSTask(
  id: string,
  name: string,
  text: string | ((context: Record<string, unknown>) => string),
  options: {
    dependencies?: string[];
    priority?: number;
    timeout?: number;
    maxRetries?: number;
    speaker?: string;
  } = {}
): TaskDefinition {
  return {
    id,
    name,
    description: `TTS语音: ${name}`,
    type: 'tts',
    dependencies: options.dependencies || [],
    priority: options.priority || 50,
    timeout: options.timeout || 60,
    maxRetries: options.maxRetries || 3,
    retryDelay: 5,
    weight: 10,
    execute: async (context) => {
      const startTime = Date.now();
      try {
        const { TTSClient, Config } = await import('coze-coding-dev-sdk');
        
        const config = new Config();
        const client = new TTSClient(config);
        
        const textContent = typeof text === 'function'
          ? text({ ...context, input: {} })
          : text;

        context.progressCallback(20, '正在合成语音...');

        const response = await client.synthesize({
          uid: `workflow-${context.workflowId}`,
          text: textContent,
          speaker: options.speaker || 'zh_female_mizai_saturn_bigtts',
          audioFormat: 'mp3',
          sampleRate: 48000,
        });

        if (!response.audioUri) {
          throw new Error('语音合成失败：未返回音频URL');
        }

        context.progressCallback(100, '语音合成完成');

        return {
          success: true,
          data: { 
            audioUrl: response.audioUri,
            text: textContent,
            speaker: options.speaker,
          },
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '语音合成失败',
          duration: Date.now() - startTime,
          retries: 0,
          cached: false,
        };
      }
    },
  };
}

// ============ 工作流模板 ============

/**
 * 创建短剧完整制作工作流
 */
export function createDramaProductionWorkflow(
  workflowId: string,
  config: Partial<WorkflowConfig> = {}
): WorkflowScheduler {
  const tasks: TaskDefinition[] = [
    // 第一阶段：剧本和角色（可并行）
    {
      id: 'script_generation',
      name: '剧本生成',
      description: '生成完整分镜剧本',
      type: 'script',
      dependencies: [],
      priority: 100,
      timeout: 180,
      maxRetries: 3,
      retryDelay: 10,
      weight: 20,
      execute: async (context) => {
        context.progressCallback(10, '正在生成分镜剧本...');
        // 实际实现在调用时注入
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
    {
      id: 'character_generation',
      name: '角色档案生成',
      description: '生成角色档案和立绘',
      type: 'character',
      dependencies: [],
      priority: 95,
      timeout: 300,
      maxRetries: 3,
      retryDelay: 10,
      weight: 15,
      execute: async (context) => {
        context.progressCallback(10, '正在生成角色立绘...');
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
    {
      id: 'scene_generation',
      name: '场景图生成',
      description: '生成主要场景背景图',
      type: 'scene',
      dependencies: [],
      priority: 90,
      timeout: 300,
      maxRetries: 3,
      retryDelay: 10,
      weight: 10,
      execute: async (context) => {
        context.progressCallback(10, '正在生成场景图...');
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
    // 第二阶段：音视频（依赖第一阶段）
    {
      id: 'voice_generation',
      name: '配音生成',
      description: '为所有角色生成配音',
      type: 'voice',
      dependencies: ['script_generation', 'character_generation'],
      priority: 80,
      timeout: 600,
      maxRetries: 3,
      retryDelay: 10,
      weight: 15,
      execute: async (context) => {
        context.progressCallback(10, '正在生成配音...');
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
    {
      id: 'video_generation',
      name: '视频片段生成',
      description: '生成分镜视频',
      type: 'video',
      dependencies: ['script_generation', 'character_generation', 'scene_generation'],
      priority: 70,
      timeout: 1800,
      maxRetries: 2,
      retryDelay: 30,
      weight: 25,
      execute: async (context) => {
        context.progressCallback(5, '正在生成视频...');
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
    // 第三阶段：后期合成
    {
      id: 'audio_mix',
      name: '音频合成',
      description: '合成BGM、配音、音效',
      type: 'audio',
      dependencies: ['voice_generation', 'video_generation'],
      priority: 50,
      timeout: 300,
      maxRetries: 3,
      retryDelay: 10,
      weight: 10,
      execute: async (context) => {
        context.progressCallback(10, '正在合成音频...');
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
    {
      id: 'final_compose',
      name: '最终合成',
      description: '合成最终成片',
      type: 'compose',
      dependencies: ['video_generation', 'audio_mix'],
      priority: 10,
      timeout: 600,
      maxRetries: 3,
      retryDelay: 10,
      weight: 5,
      execute: async (context) => {
        context.progressCallback(10, '正在合成最终成片...');
        return { success: true, duration: 0, retries: 0, cached: false };
      },
    },
  ];

  return new WorkflowScheduler(workflowId, tasks, config);
}

export default WorkflowScheduler;
