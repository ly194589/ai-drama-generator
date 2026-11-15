/**
 * 工作流进度反馈系统
 * 
 * 核心功能：
 * 1. 精确进度追踪 - 基于任务权重的进度计算
 * 2. 时间预估 - 智能预估剩余时间
 * 3. 实时状态推送 - SSE流式推送
 * 4. 进度可视化 - 前端展示数据
 */

// ============ 类型定义 ============

export interface TaskProgress {
  taskId: string;
  taskName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  weight: number;   // 权重
  startTime?: number;
  endTime?: number;
  estimatedDuration?: number; // 秒
  actualDuration?: number;    // 秒
  message?: string;
  subtasks?: TaskProgress[];
}

export interface WorkflowProgress {
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  overallProgress: number; // 0-100
  completedTasks: number;
  totalTasks: number;
  runningTasks: number;
  failedTasks: number;
  startTime?: number;
  estimatedEndTime?: number;
  estimatedTimeRemaining?: number; // 秒
  elapsedTime?: number; // 秒
  currentPhase?: string;
  tasks: TaskProgress[];
  message: string;
  speed: number; // 每秒完成进度
  lastUpdated: number;
}

export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'pause' | 'resume' | 'cancel';
  workflowId: string;
  timestamp: number;
  data: Partial<WorkflowProgress>;
}

export interface ProgressConfig {
  onProgress?: (progress: WorkflowProgress) => void;
  onEvent?: (event: ProgressEvent) => void;
  updateInterval: number; // 毫秒
  enableHistory: boolean;
  maxHistorySize: number;
}

// ============ 时间预估器 ============

export class TimeEstimator {
  private taskHistory = new Map<string, Array<{ estimated: number; actual: number }>>();
  private maxHistorySize = 10;

  /**
   * 记录任务执行时间
   */
  record(taskType: string, estimated: number, actual: number): void {
    if (!this.taskHistory.has(taskType)) {
      this.taskHistory.set(taskType, []);
    }

    const history = this.taskHistory.get(taskType)!;
    history.push({ estimated, actual });

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * 预估任务时间
   */
  estimate(taskType: string, baseEstimate: number): number {
    const history = this.taskHistory.get(taskType);
    
    if (!history || history.length < 3) {
      return baseEstimate;
    }

    // 计算平均偏差因子
    const factors = history.map(h => h.actual / h.estimated);
    const avgFactor = factors.reduce((a, b) => a + b, 0) / factors.length;

    // 使用移动平均预测
    return baseEstimate * avgFactor;
  }

  /**
   * 预估剩余时间
   */
  estimateRemaining(
    completedTasks: TaskProgress[],
    pendingTasks: TaskProgress[]
  ): number {
    if (pendingTasks.length === 0) return 0;

    // 计算已完成任务的平均速度
    const completedWithDuration = completedTasks.filter(t => t.actualDuration);
    
    if (completedWithDuration.length === 0) {
      // 没有历史数据，使用预估值
      return pendingTasks.reduce((sum, t) => sum + (t.estimatedDuration || 60), 0);
    }

    // 计算速度因子
    const speedFactors = completedWithDuration.map(t => 
      (t.actualDuration || t.estimatedDuration || 60) / (t.estimatedDuration || 60)
    );
    const avgSpeedFactor = speedFactors.reduce((a, b) => a + b, 0) / speedFactors.length;

    // 预估剩余时间
    const estimatedRemaining = pendingTasks.reduce((sum, t) => 
      sum * avgSpeedFactor + (t.estimatedDuration || 60), 0
    );

    return estimatedRemaining;
  }

  /**
   * 获取预估准确性统计
   */
  getAccuracyStats(taskType?: string): {
    avgDeviation: number;
    minDeviation: number;
    maxDeviation: number;
    sampleSize: number;
  } {
    let history: Array<{ estimated: number; actual: number }> = [];

    if (taskType) {
      history = this.taskHistory.get(taskType) || [];
    } else {
      this.taskHistory.forEach(h => history.push(...h));
    }

    if (history.length === 0) {
      return {
        avgDeviation: 0,
        minDeviation: 0,
        maxDeviation: 0,
        sampleSize: 0,
      };
    }

    const deviations = history.map(h => Math.abs(h.actual - h.estimated) / h.estimated);
    
    return {
      avgDeviation: deviations.reduce((a, b) => a + b, 0) / deviations.length,
      minDeviation: Math.min(...deviations),
      maxDeviation: Math.max(...deviations),
      sampleSize: history.length,
    };
  }
}

// ============ 进度追踪器 ============

export class ProgressTracker {
  private workflowId: string;
  private tasks = new Map<string, TaskProgress>();
  private config: ProgressConfig;
  private startTime?: number;
  private status: WorkflowProgress['status'] = 'pending';
  private timeEstimator: TimeEstimator;
  private history: WorkflowProgress[] = [];
  private updateTimer: NodeJS.Timeout | null = null;
  private previousProgress = 0;
  private previousTime = 0;

  constructor(workflowId: string, config: Partial<ProgressConfig> = {}) {
    this.workflowId = workflowId;
    this.config = {
      updateInterval: config.updateInterval || 1000,
      enableHistory: config.enableHistory !== false,
      maxHistorySize: config.maxHistorySize || 100,
      ...config,
    };
    this.timeEstimator = new TimeEstimator();
  }

  /**
   * 初始化任务列表
   */
  initTasks(tasks: Array<{
    id: string;
    name: string;
    weight: number;
    estimatedDuration?: number;
  }>): void {
    this.tasks.clear();
    
    tasks.forEach(task => {
      this.tasks.set(task.id, {
        taskId: task.id,
        taskName: task.name,
        status: 'pending',
        progress: 0,
        weight: task.weight,
        estimatedDuration: task.estimatedDuration || this.getDefaultDuration(task.id),
      });
    });

    this.startTime = Date.now();
    this.status = 'running';
    this.startUpdateTimer();

    this.emitEvent('start', this.buildProgress());
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(
    taskId: string,
    progress: number,
    message?: string
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.min(100, Math.max(0, progress));
    task.status = progress >= 100 ? 'completed' : 'running';
    if (message) task.message = message;

    if (!task.startTime && progress > 0) {
      task.startTime = Date.now();
    }

    this.notifyProgress();
  }

  /**
   * 标记任务开始
   */
  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.startTime = Date.now();
    task.progress = 0;

    this.notifyProgress();
  }

  /**
   * 标记任务完成
   */
  completeTask(taskId: string, result?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.progress = 100;
    task.endTime = Date.now();
    task.actualDuration = task.startTime 
      ? (task.endTime - task.startTime) / 1000 
      : undefined;

    // 记录时间用于改进预估
    if (task.estimatedDuration && task.actualDuration) {
      this.timeEstimator.record(taskId.split('_')[0], task.estimatedDuration, task.actualDuration);
    }

    this.notifyProgress();
  }

  /**
   * 标记任务失败
   */
  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.endTime = Date.now();
    task.message = error;

    this.notifyProgress();
  }

  /**
   * 跳过任务
   */
  skipTask(taskId: string, reason: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'skipped';
    task.endTime = Date.now();
    task.message = reason;
    task.progress = 100;

    this.notifyProgress();
  }

  /**
   * 暂停工作流
   */
  pause(): void {
    this.status = 'paused';
    this.stopUpdateTimer();
    this.emitEvent('pause', this.buildProgress());
  }

  /**
   * 恢复工作流
   */
  resume(): void {
    this.status = 'running';
    this.startUpdateTimer();
    this.emitEvent('resume', this.buildProgress());
  }

  /**
   * 取消工作流
   */
  cancel(): void {
    this.status = 'cancelled';
    this.stopUpdateTimer();
    this.emitEvent('cancel', this.buildProgress());
  }

  /**
   * 完成工作流
   */
  complete(): void {
    this.status = 'completed';
    this.stopUpdateTimer();
    this.emitEvent('complete', this.buildProgress());
  }

  /**
   * 获取当前进度
   */
  getProgress(): WorkflowProgress {
    return this.buildProgress();
  }

  /**
   * 获取进度历史
   */
  getHistory(): WorkflowProgress[] {
    return [...this.history];
  }

  /**
   * 获取预估信息
   */
  getEstimation(): {
    estimatedTimeRemaining: number;
    estimatedEndTime: number;
    confidence: number;
  } {
    const progress = this.buildProgress();
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed');
    const pendingTasks = Array.from(this.tasks.values()).filter(t => 
      t.status === 'pending' || t.status === 'running'
    );

    const estimatedTimeRemaining = this.timeEstimator.estimateRemaining(completedTasks, pendingTasks);
    const accuracy = this.timeEstimator.getAccuracyStats();

    return {
      estimatedTimeRemaining,
      estimatedEndTime: Date.now() + estimatedTimeRemaining * 1000,
      confidence: 1 - accuracy.avgDeviation,
    };
  }

  // ============ 内部方法 ============

  private buildProgress(): WorkflowProgress {
    const taskList = Array.from(this.tasks.values());
    const completedTasks = taskList.filter(t => t.status === 'completed');
    const runningTasks = taskList.filter(t => t.status === 'running');
    const failedTasks = taskList.filter(t => t.status === 'failed');

    // 计算加权进度
    const totalWeight = taskList.reduce((sum, t) => sum + t.weight, 0);
    const completedWeight = taskList.reduce((sum, t) => {
      if (t.status === 'completed') return sum + t.weight;
      if (t.status === 'running') return sum + t.weight * (t.progress / 100);
      return sum;
    }, 0);

    const overallProgress = totalWeight > 0 
      ? Math.round((completedWeight / totalWeight) * 100) 
      : 0;

    // 计算速度
    const now = Date.now();
    const timeDiff = (now - this.previousTime) / 1000;
    const progressDiff = overallProgress - this.previousProgress;
    const speed = timeDiff > 0 ? progressDiff / timeDiff : 0;

    this.previousProgress = overallProgress;
    this.previousTime = now;

    // 预估剩余时间
    const estimation = this.getEstimation();

    // 当前阶段
    const currentPhase = runningTasks.length > 0 
      ? runningTasks.map(t => t.taskName).join(', ')
      : undefined;

    // 消息
    let message = '';
    if (this.status === 'pending') {
      message = '等待开始...';
    } else if (this.status === 'running') {
      if (runningTasks.length > 0) {
        message = `正在执行: ${runningTasks.map(t => t.taskName).join(', ')}`;
      } else {
        message = `已完成 ${completedTasks.length}/${taskList.length} 个任务`;
      }
    } else if (this.status === 'completed') {
      message = '工作流完成！';
    } else if (this.status === 'failed') {
      message = `工作流失败: ${failedTasks.length} 个任务失败`;
    } else if (this.status === 'paused') {
      message = '工作流已暂停';
    } else if (this.status === 'cancelled') {
      message = '工作流已取消';
    }

    const elapsedTime = this.startTime 
      ? Math.floor((Date.now() - this.startTime) / 1000)
      : undefined;

    return {
      workflowId: this.workflowId,
      status: this.status,
      overallProgress,
      completedTasks: completedTasks.length,
      totalTasks: taskList.length,
      runningTasks: runningTasks.length,
      failedTasks: failedTasks.length,
      startTime: this.startTime,
      estimatedEndTime: estimation.estimatedEndTime,
      estimatedTimeRemaining: estimation.estimatedTimeRemaining,
      elapsedTime,
      currentPhase,
      tasks: taskList,
      message,
      speed,
      lastUpdated: Date.now(),
    };
  }

  private notifyProgress(): void {
    const progress = this.buildProgress();
    
    // 保存历史
    if (this.config.enableHistory) {
      this.history.push(progress);
      if (this.history.length > this.config.maxHistorySize) {
        this.history.shift();
      }
    }

    // 回调
    this.config.onProgress?.(progress);
  }

  private emitEvent(type: ProgressEvent['type'], data: Partial<WorkflowProgress>): void {
    const event: ProgressEvent = {
      type,
      workflowId: this.workflowId,
      timestamp: Date.now(),
      data,
    };

    this.config.onEvent?.(event);
  }

  private startUpdateTimer(): void {
    this.stopUpdateTimer();
    
    this.updateTimer = setInterval(() => {
      this.notifyProgress();
    }, this.config.updateInterval);
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  private getDefaultDuration(taskId: string): number {
    // 根据任务类型返回默认时长
    const type = taskId.split('_')[0];
    const defaults: Record<string, number> = {
      script: 120,
      character: 180,
      scene: 120,
      video: 300,
      voice: 60,
      audio: 120,
      compose: 180,
    };

    return defaults[type] || 60;
  }

  /**
   * 销毁追踪器
   */
  destroy(): void {
    this.stopUpdateTimer();
    this.tasks.clear();
    this.history = [];
  }
}

// ============ SSE进度推送器 ============

export class SSEProgressPusher {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController | null = null;
  private isClosed = false;

  /**
   * 创建SSE流
   */
  createStream(): ReadableStream {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return new ReadableStream({
      start(controller) {
        self.controller = controller;
        // 发送初始连接消息
        self.sendEvent('connected', { message: 'SSE连接已建立' });
      },
      cancel() {
        self.close();
      }
    });
  }

  /**
   * 发送进度事件
   */
  sendProgress(progress: WorkflowProgress): void {
    this.sendEvent('progress', progress);
  }

  /**
   * 发送任务事件
   */
  sendTaskEvent(event: {
    taskId: string;
    taskName: string;
    status: string;
    progress: number;
    message?: string;
  }): void {
    this.sendEvent('task', event);
  }

  /**
   * 发送完成事件
   */
  sendComplete(result: Record<string, unknown>): void {
    this.sendEvent('complete', result);
  }

  /**
   * 发送错误事件
   */
  sendError(error: string): void {
    this.sendEvent('error', { error });
  }

  /**
   * 发送通用事件
   */
  private sendEvent(type: string, data: unknown): void {
    if (this.isClosed || !this.controller) return;

    try {
      const eventData = typeof data === 'object' && data !== null ? data : { data };
      const event = `data: ${JSON.stringify({ type, ...eventData })}\n\n`;
      this.controller.enqueue(this.encoder.encode(event));
    } catch (error) {
      console.error('[SSEProgressPusher] 发送事件失败:', error);
    }
  }

  /**
   * 关闭流
   */
  close(): void {
    if (this.isClosed) return;
    
    this.isClosed = true;
    
    try {
      this.controller?.close();
    } catch {
      // 忽略已关闭的错误
    }
    
    this.controller = null;
  }

  /**
   * 获取响应头
   */
  static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    };
  }
}

// ============ 导出 ============

export default ProgressTracker;
