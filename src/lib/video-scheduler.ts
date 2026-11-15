/**
 * 全局视频生成任务调度器
 * 
 * 采用令牌桶算法 + 滑动窗口策略，彻底解决API限流问题
 * 
 * 核心特性：
 * 1. 令牌桶算法：控制请求速率，避免突发流量
 * 2. 滑动窗口：统计API调用频率，动态调整策略
 * 3. 智能调度：根据历史成功率调整请求间隔
 * 4. 多密钥轮询：支持多个API密钥，分散请求压力
 * 5. 持久化状态：将调度状态存储到数据库，支持跨进程共享
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// 调度策略配置
export type ScheduleStrategy = 'fast' | 'balanced' | 'stable' | 'slow';

interface StrategyConfig {
  name: string;
  minInterval: number;        // 最小请求间隔（毫秒）
  maxRequestsPerMinute: number; // 每分钟最大请求数
  burstSize: number;          // 令牌桶容量
  refillRate: number;         // 令牌补充速率（个/秒）
  retryDelay: number;         // 重试延迟（毫秒）
  maxRetries: number;         // 最大重试次数
  description: string;
}

const STRATEGIES: Record<ScheduleStrategy, StrategyConfig> = {
  fast: {
    name: '快速模式',
    minInterval: 15000,        // 15秒
    maxRequestsPerMinute: 3,
    burstSize: 2,
    refillRate: 0.05,          // 每秒补充0.05个令牌（20秒补充1个）
    retryDelay: 30000,
    maxRetries: 3,
    description: '快速生成，但可能触发限流',
  },
  balanced: {
    name: '均衡模式',
    minInterval: 30000,        // 30秒
    maxRequestsPerMinute: 2,
    burstSize: 1,
    refillRate: 0.033,         // 每秒补充0.033个令牌（30秒补充1个）
    retryDelay: 60000,
    maxRetries: 5,
    description: '速度与稳定性兼顾',
  },
  stable: {
    name: '稳定模式',
    minInterval: 60000,        // 60秒
    maxRequestsPerMinute: 1,
    burstSize: 1,
    refillRate: 0.016,         // 每秒补充0.016个令牌（60秒补充1个）
    retryDelay: 90000,
    maxRetries: 7,
    description: '稳定优先，避免限流',
  },
  slow: {
    name: '慢速模式',
    minInterval: 120000,       // 120秒
    maxRequestsPerMinute: 0.5,
    burstSize: 1,
    refillRate: 0.008,         // 每秒补充0.008个令牌（120秒补充1个）
    retryDelay: 180000,
    maxRetries: 10,
    description: '最慢但最稳定，适合大批量任务',
  },
};

// 调度器状态
interface SchedulerState {
  strategy: ScheduleStrategy;
  tokens: number;              // 当前令牌数
  lastRefillTime: number;      // 上次补充令牌时间
  lastRequestTime: number;     // 上次请求时间
  requestCount: number;        // 请求计数
  successCount: number;        // 成功计数
  failureCount: number;        // 失败计数
  rateLimitCount: number;      // 限流次数
  currentApiKeyIndex: number;  // 当前API密钥索引
  slidingWindow: number[];     // 滑动窗口（记录最近请求时间戳）
}

// 数据库中的调度器状态表
interface DbSchedulerState {
  id: string;
  state: SchedulerState;
  updated_at: string;
}

/**
 * 全局视频生成调度器类
 */
export class VideoScheduler {
  private static instance: VideoScheduler | null = null;
  private state: SchedulerState;
  private strategy: StrategyConfig;
  private apiKeys: string[] = [];
  private listeners: Set<(event: SchedulerEvent) => void> = new Set();

  private constructor(strategy: ScheduleStrategy = 'balanced') {
    this.strategy = STRATEGIES[strategy];
    this.state = {
      strategy,
      tokens: this.strategy.burstSize,
      lastRefillTime: Date.now(),
      lastRequestTime: 0,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      currentApiKeyIndex: 0,
      slidingWindow: [],
    };
  }

  /**
   * 获取调度器单例
   */
  static getInstance(strategy?: ScheduleStrategy): VideoScheduler {
    if (!VideoScheduler.instance) {
      VideoScheduler.instance = new VideoScheduler(strategy);
    }
    return VideoScheduler.instance;
  }

  /**
   * 设置API密钥列表
   */
  setApiKeys(keys: string[]): void {
    this.apiKeys = keys;
    this.state.currentApiKeyIndex = 0;
  }

  /**
   * 获取当前API密钥（轮询）
   */
  getCurrentApiKey(): string | null {
    if (this.apiKeys.length === 0) return null;
    const key = this.apiKeys[this.state.currentApiKeyIndex];
    this.state.currentApiKeyIndex = (this.state.currentApiKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * 切换调度策略
   */
  setStrategy(strategy: ScheduleStrategy): void {
    this.strategy = STRATEGIES[strategy];
    this.state.strategy = strategy;
    this.state.tokens = Math.min(this.state.tokens, this.strategy.burstSize);
    this.emit({ type: 'strategy_changed', strategy });
  }

  /**
   * 补充令牌（令牌桶算法核心）
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.state.lastRefillTime) / 1000; // 秒
    const tokensToAdd = elapsed * this.strategy.refillRate;
    
    this.state.tokens = Math.min(
      this.state.tokens + tokensToAdd,
      this.strategy.burstSize
    );
    this.state.lastRefillTime = now;
  }

  /**
   * 清理滑动窗口（移除过期请求记录）
   */
  private cleanSlidingWindow(): void {
    const now = Date.now();
    const windowSize = 60000; // 1分钟窗口
    this.state.slidingWindow = this.state.slidingWindow.filter(
      timestamp => now - timestamp < windowSize
    );
  }

  /**
   * 检查是否可以发送请求
   */
  canMakeRequest(): { allowed: boolean; waitTime: number; reason: string } {
    const now = Date.now();

    // 1. 补充令牌
    this.refillTokens();

    // 2. 清理滑动窗口
    this.cleanSlidingWindow();

    // 3. 检查令牌数
    if (this.state.tokens < 1) {
      const timeToNextToken = (1 - this.state.tokens) / this.strategy.refillRate * 1000;
      console.log(`[调度器] 令牌不足: tokens=${this.state.tokens.toFixed(2)}, 需等待${timeToNextToken}ms`);
      return {
        allowed: false,
        waitTime: Math.ceil(timeToNextToken),
        reason: '令牌不足，需要等待',
      };
    }

    // 4. 检查最小间隔
    const elapsed = now - this.state.lastRequestTime;
    if (elapsed < this.strategy.minInterval) {
      const waitTime = this.strategy.minInterval - elapsed;
      console.log(`[调度器] 间隔不足: elapsed=${elapsed}ms, 需等待${waitTime}ms`);
      return {
        allowed: false,
        waitTime: this.strategy.minInterval - elapsed,
        reason: '请求间隔不足',
      };
    }

    // 5. 检查滑动窗口（每分钟最大请求数）
    if (this.state.slidingWindow.length >= this.strategy.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.state.slidingWindow);
      const waitTime = 60000 - (now - oldestRequest);
      console.log(`[调度器] 超过每分钟限制: window=${this.state.slidingWindow.length}, 需等待${waitTime}ms`);
      return {
        allowed: false,
        waitTime: Math.max(0, waitTime),
        reason: '超过每分钟请求限制',
      };
    }

    console.log(`[调度器] 允许请求: tokens=${this.state.tokens.toFixed(2)}, elapsed=${elapsed}ms`);
    return {
      allowed: true,
      waitTime: 0,
      reason: '允许请求',
    };
  }

  /**
   * 记录请求（消耗令牌）
   */
  recordRequest(): void {
    const now = Date.now();
    this.state.tokens -= 1;
    this.state.lastRequestTime = now;
    this.state.requestCount += 1;
    this.state.slidingWindow.push(now);
    this.emit({ type: 'request_made', timestamp: now });
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.state.successCount += 1;
    this.emit({ type: 'request_success', successRate: this.getSuccessRate() });
  }

  /**
   * 记录失败
   */
  recordFailure(error?: string): void {
    this.state.failureCount += 1;
    this.emit({ 
      type: 'request_failed', 
      error,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * 记录限流
   */
  recordRateLimit(): void {
    this.state.rateLimitCount += 1;
    
    // 动态调整策略：如果频繁限流，自动降级到更慢的策略
    if (this.state.rateLimitCount >= 3 && this.state.strategy !== 'slow') {
      const strategies: ScheduleStrategy[] = ['fast', 'balanced', 'stable', 'slow'];
      const currentIndex = strategies.indexOf(this.state.strategy);
      if (currentIndex < strategies.length - 1) {
        this.setStrategy(strategies[currentIndex + 1]);
        this.emit({ 
          type: 'auto_downgrade', 
          reason: '频繁限流，自动降级策略',
          newStrategy: this.state.strategy,
        });
      }
    }

    this.emit({ 
      type: 'rate_limited',
      rateLimitCount: this.state.rateLimitCount,
    });
  }

  /**
   * 获取成功率
   */
  getSuccessRate(): number {
    const total = this.state.successCount + this.state.failureCount;
    return total === 0 ? 1 : this.state.successCount / total;
  }

  /**
   * 获取等待时间建议
   */
  getWaitTimeRecommendation(): number {
    const check = this.canMakeRequest();
    if (check.allowed) return 0;

    // 如果之前有限流，增加额外等待时间
    const extraWait = this.state.rateLimitCount * 10000; // 每次限流增加10秒
    
    return check.waitTime + extraWait;
  }

  /**
   * 获取调度器统计信息
   */
  getStats(): {
    strategy: StrategyConfig;
    state: SchedulerState;
    successRate: number;
    averageInterval: number;
  } {
    const intervals: number[] = [];
    for (let i = 1; i < this.state.slidingWindow.length; i++) {
      intervals.push(this.state.slidingWindow[i] - this.state.slidingWindow[i - 1]);
    }
    
    const averageInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;

    return {
      strategy: this.strategy,
      state: { ...this.state },
      successRate: this.getSuccessRate(),
      averageInterval,
    };
  }

  /**
   * 重置调度器状态
   */
  reset(): void {
    this.state = {
      strategy: this.state.strategy,
      tokens: this.strategy.burstSize,
      lastRefillTime: Date.now(),
      lastRequestTime: 0,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      currentApiKeyIndex: 0,
      slidingWindow: [],
    };
    this.emit({ type: 'reset' });
  }

  /**
   * 保存状态到数据库
   */
  async saveState(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('video_scheduler_state')
        .upsert({
          id: 'global',
          state: this.state,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[调度器] 保存状态失败:', error);
    }
  }

  /**
   * 从数据库加载状态
   */
  async loadState(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('video_scheduler_state')
        .select('state')
        .eq('id', 'global')
        .single();

      if (data && !error) {
        const loadedState = data.state as SchedulerState;
        
        // 验证加载的状态是否有效
        const isValidState = 
          loadedState &&
          typeof loadedState.tokens === 'number' &&
          typeof loadedState.requestCount === 'number' &&
          loadedState.tokens >= 0;
        
        if (isValidState) {
          this.state = {
            ...this.state,
            ...loadedState,
          };
          this.strategy = STRATEGIES[this.state.strategy];
          
          // 加载后立即补充令牌（根据经过的时间）
          this.refillTokens();
          
          // 如果令牌不足，至少给一个令牌，确保可以开始工作
          if (this.state.tokens < 1) {
            this.state.tokens = 1;
            console.log('[调度器] 令牌不足，自动补充到1');
          }
          
          console.log('[调度器] 状态已加载:', {
            strategy: this.state.strategy,
            tokens: this.state.tokens,
            requestCount: this.state.requestCount,
            successCount: this.state.successCount,
            failureCount: this.state.failureCount,
          });
          
          this.emit({ type: 'state_loaded' });
        } else {
          console.warn('[调度器] 加载的状态无效，使用初始状态');
          this.reset();
        }
      }
    } catch (error) {
      console.error('[调度器] 加载状态失败:', error);
      // 加载失败时，确保有令牌可用
      this.state.tokens = this.strategy.burstSize;
    }
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: (event: SchedulerEvent) => void): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeListener(listener: (event: SchedulerEvent) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * 触发事件
   */
  private emit(event: SchedulerEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[调度器] 事件监听器错误:', error);
      }
    });
  }
}

// 调度器事件类型
type SchedulerEvent =
  | { type: 'strategy_changed'; strategy: ScheduleStrategy }
  | { type: 'request_made'; timestamp: number }
  | { type: 'request_success'; successRate: number }
  | { type: 'request_failed'; error?: string; successRate: number }
  | { type: 'rate_limited'; rateLimitCount: number }
  | { type: 'auto_downgrade'; reason: string; newStrategy: ScheduleStrategy }
  | { type: 'reset' }
  | { type: 'state_loaded' };

/**
 * 简化的全局限流器
 * 
 * 用于直接调用API时的简单限流控制
 */
class SimpleRateLimiter {
  private lastRequestTime = 0;
  private rateLimitUntil = 0;
  private readonly minInterval: number;
  private readonly rateLimitCooldown: number;

  constructor(minInterval = 30000, rateLimitCooldown = 60000) {
    this.minInterval = minInterval;
    this.rateLimitCooldown = rateLimitCooldown;
  }

  async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    
    // 如果有限流状态，等待到解除
    if (now < this.rateLimitUntil) {
      const waitTime = this.rateLimitUntil - now;
      console.log(`[限流器] 等待限流解除: ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // 确保最小间隔
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      const waitTime = this.minInterval - elapsed;
      console.log(`[限流器] 等待间隔: ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  handleRateLimit(): void {
    this.rateLimitUntil = Date.now() + this.rateLimitCooldown;
    console.log(`[限流器] 设置限流到: ${new Date(this.rateLimitUntil).toISOString()}`);
  }
}

// 导出简化的限流器实例
export const simpleRateLimiter = new SimpleRateLimiter(30000, 60000);

/**
 * 辅助函数：等待调度器允许请求
 */
export async function waitForScheduler(
  scheduler: VideoScheduler,
  onProgress?: (waitTime: number, reason: string) => void
): Promise<void> {
  return new Promise((resolve) => {
    let checkCount = 0;
    const maxChecks = 100; // 最多检查100次，避免无限循环
    
    const check = () => {
      checkCount++;
      
      if (checkCount > maxChecks) {
        console.warn('[调度器] 检查次数超过限制，强制允许请求');
        scheduler.recordRequest();
        resolve();
        return;
      }
      
      const result = scheduler.canMakeRequest();
      
      if (result.allowed) {
        scheduler.recordRequest();
        resolve();
      } else {
        const actualWaitTime = Math.max(result.waitTime, 1000); // 最少等待1秒
        console.log(`[调度器] 等待 ${actualWaitTime}ms (${result.reason})`);
        onProgress?.(actualWaitTime, result.reason);
        setTimeout(check, actualWaitTime);
      }
    };
    
    check();
  });
}

/**
 * 导出策略配置供UI使用
 */
export { STRATEGIES };
export type { StrategyConfig };
