/**
 * 视频生成智能限流系统
 * 
 * 解决问题：
 * 1. API 限流（ErrTooManyRequests / 429 Too Many Requests）导致视频生成失败
 * 2. 频繁重试浪费资源和时间
 * 3. 用户体验差，无法预估等待时间
 * 
 * 核心策略：
 * 1. 令牌桶算法 - 应用层主动限流，避免触发平台限流
 * 2. 任务队列 - 有序执行，支持优先级和恢复
 * 3. 自适应调节 - 根据API反馈动态调整请求频率
 * 4. 状态持久化 - 支持任务恢复和断点续传
 * 
 * 扣子平台限流规则（基于搜索结果和实践经验）：
 * - 触发限流时返回 429 Too Many Requests
 * - 视频生成API较为严格，建议低频调用
 * - 建议使用指数退避策略处理限流
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

export interface RateLimitConfig {
  /** 每分钟最大请求数 */
  requestsPerMinute: number;
  /** 每小时最大请求数 */
  requestsPerHour: number;
  /** 最小请求间隔（毫秒） */
  minInterval: number;
  /** 限流后的冷却时间（毫秒） */
  cooldownPeriod: number;
  /** 最大重试次数 */
  maxRetries: number;
}

export interface QueueTask {
  id: string;
  type: 'video_generation';
  priority: number;
  payload: {
    content: unknown[];
    options: Record<string, unknown>;
    seriesId?: string;
    episodeNumber?: number;
    storyboardId?: string;
    storyboardIndex?: number;
  };
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'rate_limited';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  result?: {
    success: boolean;
    videoUrl?: string;
    error?: string;
  };
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RateLimitState {
  /** 当前分钟内已使用的请求数 */
  minuteCount: number;
  /** 当前小时内已使用的请求数 */
  hourCount: number;
  /** 上次请求时间 */
  lastRequestTime: number;
  /** 是否处于限流状态 */
  isRateLimited: boolean;
  /** 限流开始时间 */
  rateLimitedSince?: number;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 当前建议的间隔时间 */
  currentInterval: number;
  /** 上次限流发生时间 */
  lastRateLimitTime?: number;
}

// ==================== 默认配置 ====================

/**
 * 扣子平台视频生成API限流配置
 * 
 * 基于以下信息配置：
 * 1. 视频生成API是资源密集型操作，限流较为严格
 * 2. 触发限流返回 429 Too Many Requests
 * 3. 建议使用低频调用 + 指数退避策略
 * 
 * 配置原则：
 * - 宁可慢一点，也不要触发限流
 * - 触发限流后需要足够长的冷却时间
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 1,        // 每分钟最多1次请求（视频生成API较严格）
  requestsPerHour: 30,         // 每小时最多30次请求
  minInterval: 60000,          // 最小间隔60秒（给视频生成足够时间）
  cooldownPeriod: 120000,      // 限流后冷却2分钟
  maxRetries: 3,
};

// ==================== 令牌桶限流器 ====================

export class TokenBucketRateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;
  private tokens: number;
  private lastRefillTime: number;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.state = {
      minuteCount: 0,
      hourCount: 0,
      lastRequestTime: 0,
      isRateLimited: false,
      consecutiveFailures: 0,
      currentInterval: this.config.minInterval,
    };
    this.tokens = this.config.requestsPerMinute;
    this.lastRefillTime = Date.now();
  }

  /**
   * 尝试获取令牌
   * @returns 是否允许请求，以及需要等待的时间
   */
  tryAcquire(): { allowed: boolean; waitTime: number; reason?: string } {
    const now = Date.now();

    // 如果处于限流状态，检查是否已过冷却期
    if (this.state.isRateLimited) {
      const cooldownEnd = (this.state.rateLimitedSince || 0) + this.config.cooldownPeriod;
      if (now < cooldownEnd) {
        return {
          allowed: false,
          waitTime: cooldownEnd - now,
          reason: 'rate_limited',
        };
      }
      // 冷却期结束，重置限流状态
      this.state.isRateLimited = false;
      this.state.rateLimitedSince = undefined;
      this.state.consecutiveFailures = 0;
    }

    // 检查最小间隔
    const timeSinceLastRequest = now - this.state.lastRequestTime;
    if (timeSinceLastRequest < this.state.currentInterval) {
      return {
        allowed: false,
        waitTime: this.state.currentInterval - timeSinceLastRequest,
        reason: 'min_interval',
      };
    }

    // 检查分钟限制
    if (this.state.minuteCount >= this.config.requestsPerMinute) {
      const minuteEnd = Math.ceil(this.state.lastRequestTime / 60000) * 60000;
      const waitTime = minuteEnd - now;
      if (waitTime > 0) {
        return {
          allowed: false,
          waitTime: Math.max(waitTime, 1000),
          reason: 'minute_limit',
        };
      }
      // 新的一分钟，重置计数
      this.state.minuteCount = 0;
    }

    // 检查小时限制
    if (this.state.hourCount >= this.config.requestsPerHour) {
      const hourEnd = Math.ceil(this.state.lastRequestTime / 3600000) * 3600000;
      const waitTime = hourEnd - now;
      if (waitTime > 0) {
        return {
          allowed: false,
          waitTime,
          reason: 'hour_limit',
        };
      }
      // 新的一小时，重置计数
      this.state.hourCount = 0;
    }

    // 允许请求
    return { allowed: true, waitTime: 0 };
  }

  /**
   * 记录请求成功
   */
  recordSuccess(): void {
    const now = Date.now();
    this.state.lastRequestTime = now;
    this.state.minuteCount++;
    this.state.hourCount++;
    this.state.consecutiveFailures = 0;
    
    // 成功后可以稍微缩短间隔（但不能低于最小间隔）
    this.state.currentInterval = Math.max(
      this.config.minInterval,
      this.state.currentInterval * 0.95
    );
  }

  /**
   * 记录请求失败
   */
  recordFailure(isRateLimit: boolean = false): void {
    this.state.consecutiveFailures++;
    
    if (isRateLimit) {
      // 触发限流
      this.state.isRateLimited = true;
      this.state.rateLimitedSince = Date.now();
      this.state.lastRateLimitTime = Date.now();
      
      // 增加间隔时间（指数退避）
      this.state.currentInterval = Math.min(
        this.config.cooldownPeriod * 2,
        this.state.currentInterval * 2
      );
    } else {
      // 普通失败，线性增加间隔
      this.state.currentInterval = Math.min(
        this.config.cooldownPeriod,
        this.state.currentInterval * 1.5
      );
    }
  }

  /**
   * 获取当前状态
   */
  getState(): RateLimitState {
    return { ...this.state };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      minuteCount: 0,
      hourCount: 0,
      lastRequestTime: 0,
      isRateLimited: false,
      consecutiveFailures: 0,
      currentInterval: this.config.minInterval,
    };
    this.tokens = this.config.requestsPerMinute;
    this.lastRefillTime = Date.now();
  }
}

// ==================== 任务队列调度器 ====================

export class VideoTaskScheduler {
  private rateLimiter: TokenBucketRateLimiter;
  private processing: boolean = false;
  private currentTask: QueueTask | null = null;
  private onTaskComplete?: (task: QueueTask) => void;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.rateLimiter = new TokenBucketRateLimiter(config);
  }

  /**
   * 设置任务完成回调
   */
  setOnTaskComplete(callback: (task: QueueTask) => void): void {
    this.onTaskComplete = callback;
  }

  /**
   * 添加任务到队列
   */
  async addTask(task: Omit<QueueTask, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const supabase = getSupabaseClient();
    
    const newTask: Omit<QueueTask, 'id'> = {
      ...task,
      status: 'pending',
      attempts: 0,
      maxAttempts: task.maxAttempts || 3,
      createdAt: new Date(),
    };

    const { data, error } = await supabase
      .from('video_task_queue')
      .insert(newTask)
      .select('id')
      .single();

    if (error) {
      console.error('[任务队列] 添加任务失败:', error);
      throw new Error('添加任务失败');
    }

    console.log(`[任务队列] 任务已添加: ${data.id}`);
    
    // 触发队列处理
    this.processQueue();
    
    return data.id;
  }

  /**
   * 批量添加任务
   */
  async addBatchTasks(tasks: Array<Omit<QueueTask, 'id' | 'status' | 'attempts' | 'createdAt'>>): Promise<string[]> {
    const supabase = getSupabaseClient();
    
    const newTasks = tasks.map(task => ({
      ...task,
      status: 'pending' as const,
      attempts: 0,
      maxAttempts: task.maxAttempts || 3,
      createdAt: new Date(),
    }));

    const { data, error } = await supabase
      .from('video_task_queue')
      .insert(newTasks)
      .select('id');

    if (error) {
      console.error('[任务队列] 批量添加任务失败:', error);
      throw new Error('批量添加任务失败');
    }

    console.log(`[任务队列] 已添加 ${data.length} 个任务`);
    
    // 触发队列处理
    this.processQueue();
    
    return data.map(d => d.id);
  }

  /**
   * 处理队列
   */
  async processQueue(): Promise<void> {
    if (this.processing) {
      console.log('[任务队列] 已有处理进程在运行');
      return;
    }

    this.processing = true;
    console.log('[任务队列] 开始处理队列');

    try {
      while (true) {
        // 检查是否允许请求
        const { allowed, waitTime, reason } = this.rateLimiter.tryAcquire();
        
        if (!allowed) {
          console.log(`[任务队列] 等待 ${waitTime}ms (原因: ${reason})`);
          await this.sleep(waitTime);
          continue;
        }

        // 获取下一个待处理任务
        const task = await this.getNextTask();
        
        if (!task) {
          console.log('[任务队列] 队列为空，停止处理');
          break;
        }

        this.currentTask = task;
        
        // 执行任务
        const result = await this.executeTask(task);
        
        // 更新任务状态
        await this.updateTaskStatus(task.id!, result);
        
        // 记录结果
        if (result.success) {
          this.rateLimiter.recordSuccess();
          console.log(`[任务队列] 任务 ${task.id} 完成`);
        } else {
          const isRateLimit = result.error?.includes('限流') || 
                              result.error?.includes('TooManyRequests') ||
                              result.error?.includes('429');
          this.rateLimiter.recordFailure(isRateLimit);
          console.log(`[任务队列] 任务 ${task.id} 失败: ${result.error}`);
        }

        // 回调通知
        if (this.onTaskComplete) {
          this.onTaskComplete({ ...task, result } as QueueTask);
        }

        this.currentTask = null;
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * 获取下一个待处理任务
   */
  private async getNextTask(): Promise<QueueTask | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('video_task_queue')
      .select('*')
      .in('status', ['pending', 'queued', 'rate_limited'])
      .lt('attempts', 10) // 最大尝试次数限制
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 队列为空
      }
      console.error('[任务队列] 获取任务失败:', error);
      return null;
    }

    return data as QueueTask;
  }

  /**
   * 执行任务
   */
  private async executeTask(task: QueueTask): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
    const supabase = getSupabaseClient();
    
    // 更新状态为运行中
    await supabase
      .from('video_task_queue')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        attempts: task.attempts + 1,
      })
      .eq('id', task.id);

    // 这里只返回任务信息，实际执行由外部调用
    // 这样设计是为了让调用方可以控制视频生成客户端
    return { success: false, error: '需要外部执行器' };
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string, 
    result: { success: boolean; videoUrl?: string; error?: string }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    
    // 使用 any 类型来避免 TypeScript 接口与数据库字段名不匹配的问题
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      status: result.success ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      result: result,
    };

    if (!result.success) {
      // 失败时更新 attempts，但不改变状态（允许重试）
      const { data: task } = await supabase
        .from('video_task_queue')
        .select('attempts, max_attempts')
        .eq('id', taskId)
        .single();

      if (task && task.attempts < task.max_attempts) {
        updateData.status = 'queued'; // 允许重试
      }
    }

    await supabase
      .from('video_task_queue')
      .update(updateData)
      .eq('id', taskId);
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
    rateLimited: boolean;
    nextAvailableIn: number;
  }> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('video_task_queue')
      .select('status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[任务队列] 获取统计失败:', error);
      return {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        rateLimited: false,
        nextAvailableIn: 0,
      };
    }

    const stats = {
      pending: data.filter(t => t.status === 'pending' || t.status === 'queued').length,
      running: data.filter(t => t.status === 'running').length,
      completed: data.filter(t => t.status === 'completed').length,
      failed: data.filter(t => t.status === 'failed').length,
      rateLimited: this.rateLimiter.getState().isRateLimited,
      nextAvailableIn: 0,
    };

    // 计算下一个可用时间
    const { waitTime } = this.rateLimiter.tryAcquire();
    stats.nextAvailableIn = waitTime;

    return stats;
  }

  /**
   * 获取限流器状态
   */
  getRateLimiterState(): RateLimitState {
    return this.rateLimiter.getState();
  }

  /**
   * 手动重置限流器
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
    console.log('[任务队列] 限流器已重置');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== 单例实例 ====================

let schedulerInstance: VideoTaskScheduler | null = null;

export function getVideoTaskScheduler(config?: Partial<RateLimitConfig>): VideoTaskScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new VideoTaskScheduler(config);
  }
  return schedulerInstance;
}
