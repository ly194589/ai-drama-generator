/**
 * 工作流并行执行引擎
 * 
 * 核心功能：
 * 1. DAG依赖图构建和拓扑排序
 * 2. 智能并发控制 - 基于资源类型的动态调整
 * 3. 任务批次调度 - 最大化并行度
 * 4. 资源冲突检测 - 避免API频率限制
 */

// ============ 类型定义 ============

export type ResourceType = 'llm' | 'image' | 'video' | 'tts' | 'storage' | 'database' | 'cpu' | 'memory';

export interface ResourceLimits {
  llm: number;      // LLM并发数
  image: number;    // 图片生成并发数
  video: number;    // 视频生成并发数
  tts: number;      // TTS并发数
  storage: number;  // 存储操作并发数
  database: number; // 数据库操作并发数
  cpu: number;      // CPU密集型任务并发数
  memory: number;   // 内存密集型任务并发数
}

export interface TaskResource {
  type: ResourceType;
  weight: number;  // 资源权重，用于计算资源消耗
  exclusive?: boolean; // 是否独占资源
}

export interface ExecutorTask<T = unknown, R = unknown> {
  id: string;
  name: string;
  type: string;
  resources: TaskResource[];
  dependencies: string[];
  priority: number;
  estimatedDuration: number; // 秒
  input?: T;
  execute: () => Promise<R>;
}

export interface ExecutorTaskState {
  id: string;
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  result?: unknown;
}

export interface ExecutionPlan {
  batches: string[][];  // 按批次分组的任务ID
  criticalPath: string[]; // 关键路径
  estimatedDuration: number; // 预估总时长（秒）
  maxParallelism: number; // 最大并行度
}

export interface ParallelExecutorConfig {
  resourceLimits: Partial<ResourceLimits>;
  maxRetries: number;
  retryDelay: number;
  taskTimeout: number;
  onTaskStart?: (taskId: string) => void;
  onTaskComplete?: (taskId: string, result: unknown) => void;
  onTaskError?: (taskId: string, error: Error) => void;
  onBatchStart?: (batch: string[], batchIndex: number) => void;
  onBatchComplete?: (batch: string[], results: Map<string, unknown>) => void;
}

// ============ DAG图构建器 ============

export class DAGBuilder {
  private nodes = new Map<string, { id: string; dependencies: string[] }>();
  private edges = new Map<string, string[]>(); // node -> dependents

  addNode(id: string, dependencies: string[] = []): void {
    this.nodes.set(id, { id, dependencies });
    
    // 更新边
    dependencies.forEach(depId => {
      if (!this.edges.has(depId)) {
        this.edges.set(depId, []);
      }
      this.edges.get(depId)!.push(id);
    });
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // 移除相关边
    node.dependencies.forEach(depId => {
      const dependents = this.edges.get(depId);
      if (dependents) {
        const index = dependents.indexOf(id);
        if (index !== -1) {
          dependents.splice(index, 1);
        }
      }
    });

    this.nodes.delete(id);
    this.edges.delete(id);
  }

  /**
   * 拓扑排序
   */
  topologicalSort(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): boolean => {
      if (visited.has(id)) return true;
      if (visiting.has(id)) return false; // 检测到环

      visiting.add(id);
      const node = this.nodes.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visit(dep)) return false;
        }
      }
      visiting.delete(id);
      visited.add(id);
      result.push(id);
      return true;
    };

    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        if (!visit(id)) {
          throw new Error('检测到循环依赖');
        }
      }
    }

    return result;
  }

  /**
   * 获取执行批次
   * 返回可以并行执行的任务组
   */
  getExecutionBatches(): string[][] {
    const batches: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(this.nodes.keys());

    while (remaining.size > 0) {
      const batch: string[] = [];
      
      for (const id of remaining) {
        const node = this.nodes.get(id)!;
        const allDepsCompleted = node.dependencies.every(dep => completed.has(dep));
        
        if (allDepsCompleted) {
          batch.push(id);
        }
      }

      if (batch.length === 0) {
        // 没有可执行的任务，说明存在问题
        throw new Error('无法继续执行：存在未满足的依赖');
      }

      batch.forEach(id => {
        remaining.delete(id);
        completed.add(id);
      });

      batches.push(batch);
    }

    return batches;
  }

  /**
   * 计算关键路径
   */
  getCriticalPath(taskDurations: Map<string, number>): string[] {
    // 计算最早完成时间
    const earliestFinish = new Map<string, number>();
    const sorted = this.topologicalSort();

    for (const id of sorted) {
      const node = this.nodes.get(id)!;
      const duration = taskDurations.get(id) || 0;
      
      const maxDepFinish = Math.max(
        0,
        ...node.dependencies.map(dep => earliestFinish.get(dep) || 0)
      );
      
      earliestFinish.set(id, maxDepFinish + duration);
    }

    // 从最后一个任务反向追踪关键路径
    const criticalPath: string[] = [];
    let current = sorted[sorted.length - 1];

    while (current) {
      criticalPath.unshift(current);
      
      const node = this.nodes.get(current)!;
      const duration = taskDurations.get(current) || 0;
      const currentFinish = earliestFinish.get(current) || 0;
      
      // 找到关键路径上的前驱
      let criticalDep: string | null = null;
      for (const dep of node.dependencies) {
        const depDuration = taskDurations.get(dep) || 0;
        if (earliestFinish.get(dep) === currentFinish - duration) {
          criticalDep = dep;
          break;
        }
      }
      
      current = criticalDep as string;
    }

    return criticalPath;
  }

  /**
   * 获取节点的前驱
   */
  getPredecessors(id: string): string[] {
    return this.nodes.get(id)?.dependencies || [];
  }

  /**
   * 获取节点的后继
   */
  getSuccessors(id: string): string[] {
    return this.edges.get(id) || [];
  }

  /**
   * 检查是否有环
   */
  hasCycle(): boolean {
    try {
      this.topologicalSort();
      return false;
    } catch {
      return true;
    }
  }
}

// ============ 资源管理器 ============

export class ResourceManager {
  private limits: ResourceLimits;
  private current: Map<ResourceType, number> = new Map();
  private waiting: Map<ResourceType, Array<() => void>> = new Map();

  constructor(limits: Partial<ResourceLimits> = {}) {
    this.limits = {
      llm: limits.llm || 5,
      image: limits.image || 2,
      video: limits.video || 1,
      tts: limits.tts || 3,
      storage: limits.storage || 5,
      database: limits.database || 10,
      cpu: limits.cpu || 4,
      memory: limits.memory || 2,
    };

    // 初始化当前使用量
    Object.keys(this.limits).forEach(type => {
      this.current.set(type as ResourceType, 0);
      this.waiting.set(type as ResourceType, []);
    });
  }

  /**
   * 申请资源
   */
  async acquire(resources: TaskResource[]): Promise<() => void> {
    // 按资源类型分组
    const groupedResources = new Map<ResourceType, number>();
    for (const r of resources) {
      const current = groupedResources.get(r.type) || 0;
      groupedResources.set(r.type, current + r.weight);
    }

    // 检查是否需要等待
    const waitFor: ResourceType[] = [];
    for (const [type, weight] of groupedResources) {
      if (this.current.get(type)! + weight > this.limits[type]) {
        waitFor.push(type);
      }
    }

    // 如果需要等待，注册等待回调
    if (waitFor.length > 0) {
      await new Promise<void>(resolve => {
        const checkAndResolve = () => {
          const canAcquire = waitFor.every(type => {
            const weight = groupedResources.get(type)!;
            return this.current.get(type)! + weight <= this.limits[type];
          });

          if (canAcquire) {
            resolve();
          } else {
            // 继续等待
            waitFor.forEach(type => {
              this.waiting.get(type)!.push(checkAndResolve);
            });
          }
        };

        // 立即检查一次
        checkAndResolve();
      });
    }

    // 分配资源
    for (const [type, weight] of groupedResources) {
      this.current.set(type, this.current.get(type)! + weight);
    }

    // 返回释放函数
    return () => {
      for (const [type, weight] of groupedResources) {
        this.current.set(type, this.current.get(type)! - weight);
      }

      // 通知等待的任务
      for (const type of groupedResources.keys()) {
        const waitingList = this.waiting.get(type)!;
        if (waitingList.length > 0) {
          const next = waitingList.shift()!;
          next();
        }
      }
    };
  }

  /**
   * 获取当前资源使用情况
   */
  getUsage(): Record<ResourceType, { used: number; limit: number; available: number }> {
    const result = {} as Record<ResourceType, { used: number; limit: number; available: number }>;
    
    for (const type of Object.keys(this.limits) as ResourceType[]) {
      const used = this.current.get(type) || 0;
      result[type] = {
        used,
        limit: this.limits[type],
        available: this.limits[type] - used,
      };
    }

    return result;
  }

  /**
   * 更新资源限制
   */
  updateLimits(newLimits: Partial<ResourceLimits>): void {
    Object.assign(this.limits, newLimits);
  }
}

// ============ 并行执行器 ============

export class ParallelExecutor {
  private config: ParallelExecutorConfig;
  private dag: DAGBuilder;
  private resourceManager: ResourceManager;
  private taskStates = new Map<string, ExecutorTaskState>();
  private tasks = new Map<string, ExecutorTask>();
  private results = new Map<string, unknown>();
  private isRunning = false;

  constructor(config: Partial<ParallelExecutorConfig> = {}) {
    this.config = {
      resourceLimits: config.resourceLimits || {},
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5,
      taskTimeout: config.taskTimeout || 600,
      onTaskStart: config.onTaskStart,
      onTaskComplete: config.onTaskComplete,
      onTaskError: config.onTaskError,
      onBatchStart: config.onBatchStart,
      onBatchComplete: config.onBatchComplete,
    };

    this.dag = new DAGBuilder();
    this.resourceManager = new ResourceManager(this.config.resourceLimits);
  }

  /**
   * 添加任务
   */
  addTask(task: ExecutorTask): void {
    this.tasks.set(task.id, task);
    this.dag.addNode(task.id, task.dependencies);
    this.taskStates.set(task.id, {
      id: task.id,
      status: 'pending',
    });
  }

  /**
   * 批量添加任务
   */
  addTasks(tasks: ExecutorTask[]): void {
    tasks.forEach(task => this.addTask(task));
  }

  /**
   * 生成执行计划
   */
  generatePlan(): ExecutionPlan {
    const batches = this.dag.getExecutionBatches();
    
    // 计算任务时长映射
    const durations = new Map<string, number>();
    this.tasks.forEach((task, id) => {
      durations.set(id, task.estimatedDuration);
    });

    const criticalPath = this.dag.getCriticalPath(durations);
    const estimatedDuration = criticalPath.reduce(
      (sum, id) => sum + (durations.get(id) || 0),
      0
    );

    // 计算最大并行度
    let maxParallelism = 0;
    batches.forEach(batch => {
      const parallelism = this.calculateBatchParallelism(batch);
      maxParallelism = Math.max(maxParallelism, parallelism);
    });

    return {
      batches,
      criticalPath,
      estimatedDuration,
      maxParallelism,
    };
  }

  /**
   * 计算批次的并行度
   */
  private calculateBatchParallelism(batch: string[]): number {
    const resourceNeeds = new Map<ResourceType, number>();
    
    batch.forEach(id => {
      const task = this.tasks.get(id);
      if (task) {
        task.resources.forEach(r => {
          const current = resourceNeeds.get(r.type) || 0;
          resourceNeeds.set(r.type, current + r.weight);
        });
      }
    });

    // 并行度受限于最紧缺的资源
    let parallelism = batch.length;
    resourceNeeds.forEach((need, type) => {
      const limit = this.resourceManager.getUsage()[type].limit;
      parallelism = Math.min(parallelism, limit / (need / batch.length));
    });

    return Math.ceil(parallelism);
  }

  /**
   * 执行工作流
   */
  async execute(): Promise<Map<string, unknown>> {
    if (this.isRunning) {
      throw new Error('执行器已在运行');
    }

    this.isRunning = true;
    const plan = this.generatePlan();

    for (let i = 0; i < plan.batches.length; i++) {
      const batch = plan.batches[i];
      this.config.onBatchStart?.(batch, i);

      // 执行当前批次
      const batchResults = await this.executeBatch(batch);
      
      this.config.onBatchComplete?.(batch, batchResults);

      // 检查是否有失败的任务导致后续无法执行
      const failedTasks = Array.from(this.taskStates.values())
        .filter(s => s.status === 'failed');
      
      if (failedTasks.length > 0) {
        // 检查是否有关键任务失败
        const criticalFailed = failedTasks.some(s => plan.criticalPath.includes(s.id));
        if (criticalFailed) {
          console.error('[ParallelExecutor] 关键任务失败，终止执行');
          break;
        }
      }
    }

    this.isRunning = false;
    return this.results;
  }

  /**
   * 执行单个批次
   */
  private async executeBatch(batch: string[]): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    
    // 按优先级排序
    const sortedBatch = [...batch].sort((a, b) => {
      const taskA = this.tasks.get(a)!;
      const taskB = this.tasks.get(b)!;
      return taskB.priority - taskA.priority;
    });

    // 并行执行
    const promises = sortedBatch.map(async id => {
      const task = this.tasks.get(id)!;
      const state = this.taskStates.get(id)!;

      // 申请资源
      const release = await this.resourceManager.acquire(task.resources);

      try {
        state.status = 'running';
        state.startTime = new Date();
        this.config.onTaskStart?.(id);

        // 执行任务（带超时和重试）
        const result = await this.executeWithRetry(task);

        state.status = 'completed';
        state.endTime = new Date();
        state.duration = state.endTime.getTime() - state.startTime.getTime();
        state.result = result;
        
        this.results.set(id, result);
        results.set(id, result);
        
        this.config.onTaskComplete?.(id, result);

        return result;
      } catch (error) {
        state.status = 'failed';
        state.error = error instanceof Error ? error.message : '执行失败';
        this.config.onTaskError?.(id, error instanceof Error ? error : new Error(String(error)));
        
        throw error;
      } finally {
        release();
      }
    });

    // 等待所有任务完成（忽略错误继续执行）
    await Promise.allSettled(promises);

    return results;
  }

  /**
   * 带重试的任务执行
   */
  private async executeWithRetry<R>(task: ExecutorTask, retryCount = 0): Promise<R> {
    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('任务超时')), this.config.taskTimeout * 1000);
      });

      const result = await Promise.race([
        task.execute(),
        timeoutPromise,
      ]);

      return result as R;
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        // 延迟重试
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retryDelay * 1000 * (retryCount + 1))
        );
        return this.executeWithRetry(task, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * 获取执行状态
   */
  getStatus(): {
    isRunning: boolean;
    tasks: ExecutorTaskState[];
    resourceUsage: ReturnType<ResourceManager['getUsage']>;
  } {
    return {
      isRunning: this.isRunning,
      tasks: Array.from(this.taskStates.values()),
      resourceUsage: this.resourceManager.getUsage(),
    };
  }

  /**
   * 获取执行计划概览
   */
  getPlanOverview(): string {
    const plan = this.generatePlan();
    const lines: string[] = [
      '执行计划概览：',
      `- 总任务数: ${this.tasks.size}`,
      `- 批次数: ${plan.batches.length}`,
      `- 关键路径: ${plan.criticalPath.join(' → ')}`,
      `- 预估时长: ${Math.ceil(plan.estimatedDuration / 60)} 分钟`,
      `- 最大并行度: ${plan.maxParallelism}`,
      '',
      '批次详情：',
    ];

    plan.batches.forEach((batch, i) => {
      lines.push(`批次 ${i + 1}: ${batch.join(', ')}`);
    });

    return lines.join('\n');
  }
}

// ============ 辅助函数 ============

/**
 * 根据任务类型推断资源需求
 */
export function inferTaskResources(type: string): TaskResource[] {
  const resourceMap: Record<string, TaskResource[]> = {
    'llm': [{ type: 'llm', weight: 1 }],
    'script': [{ type: 'llm', weight: 1 }],
    'image': [{ type: 'image', weight: 1 }],
    'character': [{ type: 'image', weight: 1 }],
    'scene': [{ type: 'image', weight: 1 }],
    'video': [{ type: 'video', weight: 1 }],
    'tts': [{ type: 'tts', weight: 1 }],
    'voice': [{ type: 'tts', weight: 1 }],
    'audio': [{ type: 'cpu', weight: 1 }],
    'storage': [{ type: 'storage', weight: 1 }],
    'database': [{ type: 'database', weight: 1 }],
    'compose': [{ type: 'cpu', weight: 2 }, { type: 'memory', weight: 1 }],
  };

  return resourceMap[type] || [{ type: 'cpu', weight: 1 }];
}

/**
 * 估算任务时长
 */
export function estimateTaskDuration(type: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): number {
  const baseDurations: Record<string, Record<string, number>> = {
    'llm': { simple: 30, medium: 60, complex: 120 },
    'script': { simple: 60, medium: 120, complex: 180 },
    'image': { simple: 30, medium: 60, complex: 120 },
    'character': { simple: 60, medium: 120, complex: 180 },
    'scene': { simple: 60, medium: 90, complex: 120 },
    'video': { simple: 180, medium: 300, complex: 600 },
    'tts': { simple: 10, medium: 30, complex: 60 },
    'voice': { simple: 10, medium: 30, complex: 60 },
    'audio': { simple: 30, medium: 60, complex: 120 },
    'compose': { simple: 60, medium: 180, complex: 300 },
  };

  return baseDurations[type]?.[complexity] || 60;
}

export default ParallelExecutor;
