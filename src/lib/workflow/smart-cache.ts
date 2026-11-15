/**
 * 工作流智能缓存系统
 * 
 * 核心功能：
 * 1. 多级缓存 - 内存缓存 + 持久化缓存
 * 2. 智能失效 - 基于时间、依赖关系、内容变化的自动失效
 * 3. 缓存预热 - 预加载常用资源
 * 4. 缓存统计 - 命中率、大小、性能分析
 */

// ============ 类型定义 ============

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  metadata: {
    createdAt: number;
    expiresAt: number;
    lastAccessedAt: number;
    accessCount: number;
    size: number; // 字节
    tags: string[];
    dependencies: string[];
    version: string;
  };
  stats: {
    hits: number;
    misses: number;
    avgAccessTime: number;
  };
}

export interface CacheConfig {
  maxSize: number; // 最大缓存大小（字节）
  maxEntries: number; // 最大条目数
  defaultTTL: number; // 默认过期时间（秒）
  cleanupInterval: number; // 清理间隔（秒）
  persistToDatabase: boolean; // 是否持久化到数据库
  compressionThreshold: number; // 压缩阈值（字节）
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  entries: number;
  oldestEntry?: number;
  newestEntry?: number;
  avgAge: number;
  topKeys: Array<{ key: string; hits: number; accessCount: number }>;
}

// ============ 缓存键生成器 ============

export class CacheKeyGenerator {
  private static version = '1.0.0';

  /**
   * 生成LLM缓存键
   */
  static forLLM(prompt: string, model: string, options: Record<string, unknown> = {}): string {
    const content = JSON.stringify({ prompt: prompt.slice(0, 500), model, options });
    const hash = this.hash(content);
    return `llm:${model}:${hash}`;
  }

  /**
   * 生成图片缓存键
   */
  static forImage(prompt: string, size: string, style: string): string {
    const content = JSON.stringify({ prompt: prompt.slice(0, 300), size, style });
    const hash = this.hash(content);
    return `img:${size}:${hash}`;
  }

  /**
   * 生成视频缓存键
   */
  static forVideo(prompt: string, duration: number, ratio: string): string {
    const content = JSON.stringify({ prompt: prompt.slice(0, 300), duration, ratio });
    const hash = this.hash(content);
    return `vid:${duration}s:${hash}`;
  }

  /**
   * 生成TTS缓存键
   */
  static forTTS(text: string, speaker: string): string {
    const content = JSON.stringify({ text: text.slice(0, 200), speaker });
    const hash = this.hash(content);
    return `tts:${speaker}:${hash}`;
  }

  /**
   * 生成工作流状态缓存键
   */
  static forWorkflowState(workflowId: string): string {
    return `wf:state:${workflowId}`;
  }

  /**
   * 生成角色数据缓存键
   */
  static forCharacter(characterId: string): string {
    return `char:${characterId}`;
  }

  /**
   * 生成剧本缓存键
   */
  static forScript(seriesId: string, episode: number): string {
    return `script:${seriesId}:${episode}`;
  }

  private static hash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// ============ 智能缓存管理器 ============

export class SmartCache {
  private memoryCache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private dependencyGraph = new Map<string, Set<string>>(); // key -> dependent keys

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 100 * 1024 * 1024, // 100MB
      maxEntries: config.maxEntries || 10000,
      defaultTTL: config.defaultTTL || 3600, // 1小时
      cleanupInterval: config.cleanupInterval || 300, // 5分钟
      persistToDatabase: config.persistToDatabase || false,
      compressionThreshold: config.compressionThreshold || 10 * 1024, // 10KB
    };

    this.startCleanupTimer();
  }

  // ============ 核心方法 ============

  /**
   * 获取缓存
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const startTime = Date.now();

    // 检查内存缓存
    let entry: CacheEntry | undefined = this.memoryCache.get(key);

    if (!entry) {
      // 尝试从持久化存储加载
      if (this.config.persistToDatabase) {
        const dbEntry = await this.loadFromDatabase(key);
        if (dbEntry) {
          entry = dbEntry;
          this.memoryCache.set(key, entry);
        }
      }
    }

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.metadata.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // 更新访问统计
    entry.metadata.lastAccessedAt = Date.now();
    entry.metadata.accessCount++;
    entry.stats.hits++;
    entry.stats.avgAccessTime = 
      (entry.stats.avgAccessTime * (entry.stats.hits - 1) + (Date.now() - startTime)) 
      / entry.stats.hits;

    this.stats.hits++;
    this.stats.totalAccessTime += Date.now() - startTime;
    this.stats.accessCount++;

    return entry.data as T;
  }

  /**
   * 设置缓存
   */
  async set<T = unknown>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
      version?: string;
    } = {}
  ): Promise<void> {
    const now = Date.now();
    const ttl = options.ttl || this.config.defaultTTL;
    const size = this.calculateSize(data);

    // 检查是否需要清理空间
    if (this.getCurrentSize() + size > this.config.maxSize) {
      await this.evict(size);
    }

    // 检查是否超过条目数限制
    if (this.memoryCache.size >= this.config.maxEntries) {
      await this.evictEntries(1);
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      metadata: {
        createdAt: now,
        expiresAt: now + ttl * 1000,
        lastAccessedAt: now,
        accessCount: 0,
        size,
        tags: options.tags || [],
        dependencies: options.dependencies || [],
        version: options.version || '1.0.0',
      },
      stats: {
        hits: 0,
        misses: 0,
        avgAccessTime: 0,
      },
    };

    this.memoryCache.set(key, entry);

    // 更新依赖图
    options.dependencies?.forEach(depKey => {
      if (!this.dependencyGraph.has(depKey)) {
        this.dependencyGraph.set(depKey, new Set());
      }
      this.dependencyGraph.get(depKey)!.add(key);
    });

    // 持久化
    if (this.config.persistToDatabase) {
      await this.saveToDatabase(key, entry);
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    this.memoryCache.delete(key);

    // 清理依赖关系
    entry.metadata.dependencies.forEach(depKey => {
      this.dependencyGraph.get(depKey)?.delete(key);
    });

    // 删除依赖此键的缓存
    const dependents = this.dependencyGraph.get(key);
    if (dependents) {
      dependents.forEach(depKey => this.delete(depKey));
      this.dependencyGraph.delete(key);
    }

    return true;
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    // 检查是否过期
    if (Date.now() > entry.metadata.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.memoryCache.clear();
    this.dependencyGraph.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      accessCount: 0,
    };
  }

  /**
   * 按标签清除缓存
   */
  clearByTag(tag: string): number {
    let count = 0;
    const keysToDelete: string[] = [];

    this.memoryCache.forEach((entry, key) => {
      if (entry.metadata.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      if (this.delete(key)) {
        count++;
      }
    });

    return count;
  }

  /**
   * 刷新缓存（延长过期时间）
   */
  refresh(key: string, ttl?: number): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;

    entry.metadata.expiresAt = Date.now() + (ttl || this.config.defaultTTL) * 1000;
    return true;
  }

  // ============ 高级功能 ============

  /**
   * 批量获取
   */
  async mget<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(keys.map(async key => {
      const data = await this.get<T>(key);
      if (data !== null) {
        results.set(key, data);
      }
    }));

    return results;
  }

  /**
   * 批量设置
   */
  async mset<T = unknown>(
    entries: Array<{ key: string; data: T; options?: Parameters<SmartCache['set']>[2] }>
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, data, options }) => this.set(key, data, options))
    );
  }

  /**
   * 获取或计算（如果不存在则执行计算函数）
   */
  async getOrCompute<T = unknown>(
    key: string,
    compute: () => Promise<T>,
    options: Parameters<SmartCache['set']>[2] = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await compute();
    await this.set(key, data, options);
    return data;
  }

  /**
   * 预热缓存
   */
  async warmup(entries: Array<{ key: string; compute: () => Promise<unknown>; options?: Parameters<SmartCache['set']>[2] }>): Promise<void> {
    await Promise.all(
      entries.map(async ({ key, compute, options }) => {
        if (!this.has(key)) {
          const data = await compute();
          await this.set(key, data, options);
        }
      })
    );
  }

  /**
   * 使依赖缓存失效
   */
  invalidateDependencies(key: string): number {
    const dependents = this.dependencyGraph.get(key);
    if (!dependents) return 0;

    let count = 0;
    dependents.forEach(depKey => {
      if (this.delete(depKey)) {
        count++;
      }
    });

    return count;
  }

  // ============ 统计和管理 ============

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const entries = Array.from(this.memoryCache.values());
    const totalRequests = this.stats.hits + this.stats.misses;
    const now = Date.now();

    const accessStats = entries
      .map(e => ({
        key: e.key,
        hits: e.stats.hits,
        accessCount: e.metadata.accessCount,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    const ages = entries.map(e => now - e.metadata.createdAt);
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      size: this.getCurrentSize(),
      entries: this.memoryCache.size,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.metadata.createdAt)) : undefined,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.metadata.createdAt)) : undefined,
      avgAge,
      topKeys: accessStats,
    };
  }

  /**
   * 获取缓存详情
   */
  getEntry(key: string): CacheEntry | undefined {
    return this.memoryCache.get(key);
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.memoryCache.keys());
  }

  /**
   * 获取当前大小
   */
  getCurrentSize(): number {
    let size = 0;
    this.memoryCache.forEach(entry => {
      size += entry.metadata.size;
    });
    return size;
  }

  // ============ 内部方法 ============

  private calculateSize(data: unknown): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // 处理循环引用等情况
      return 1024; // 默认1KB
    }
  }

  private async evict(requiredSpace: number): Promise<void> {
    // 按LRU策略清除
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].metadata.lastAccessedAt - b[1].metadata.lastAccessedAt);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;
      freedSpace += entry.metadata.size;
      this.delete(key);
    }
  }

  private async evictEntries(count: number): Promise<void> {
    // 按LFU策略清除
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].stats.hits - b[1].stats.hits);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.delete(entries[i][0]);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.memoryCache.forEach((entry, key) => {
      if (now > entry.metadata.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.delete(key));

    console.log(`[SmartCache] 清理完成，删除 ${expiredKeys.length} 个过期条目`);
  }

  private async loadFromDatabase(key: string): Promise<CacheEntry | null> {
    // 数据库持久化实现
    try {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('workflow_cache')
        .select('*')
        .eq('key', key)
        .single();

      if (error || !data) return null;

      return {
        key: data.key,
        data: JSON.parse(data.value),
        metadata: {
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          lastAccessedAt: data.last_accessed_at || data.created_at,
          accessCount: data.access_count || 0,
          size: data.size || 0,
          tags: data.tags || [],
          dependencies: data.dependencies || [],
          version: data.version || '1.0.0',
        },
        stats: {
          hits: data.hits || 0,
          misses: 0,
          avgAccessTime: 0,
        },
      };
    } catch (error) {
      console.error('[SmartCache] 加载数据库缓存失败:', error);
      return null;
    }
  }

  private async saveToDatabase(key: string, entry: CacheEntry): Promise<void> {
    try {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client');
      const supabase = getSupabaseClient();

      await supabase
        .from('workflow_cache')
        .upsert({
          key,
          value: JSON.stringify(entry.data),
          created_at: entry.metadata.createdAt,
          expires_at: entry.metadata.expiresAt,
          last_accessed_at: entry.metadata.lastAccessedAt,
          access_count: entry.metadata.accessCount,
          size: entry.metadata.size,
          tags: entry.metadata.tags,
          dependencies: entry.metadata.dependencies,
          version: entry.metadata.version,
          hits: entry.stats.hits,
        });
    } catch (error) {
      console.error('[SmartCache] 保存数据库缓存失败:', error);
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// ============ 单例实例 ============

let cacheInstance: SmartCache | null = null;

export function getWorkflowCache(config?: Partial<CacheConfig>): SmartCache {
  if (!cacheInstance) {
    cacheInstance = new SmartCache(config);
  }
  return cacheInstance;
}

export default SmartCache;
