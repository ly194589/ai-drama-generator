'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface VideoTask {
  shotIndex: number;
  shotName: string;
  prompt: string;
  imageUrl?: string;
  duration?: number;
}

interface QueueStatus {
  batchId: string;
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  progress: number;
  isComplete: boolean;
  videos: Array<{
    shotIndex: number;
    shotName: string;
    url: string;
  }>;
  errors: Array<{
    shotIndex: number;
    shotName: string;
    error: string;
  }>;
}

interface UseVideoQueueOptions {
  onProgress?: (progress: number, message: string) => void;
  onTaskComplete?: (shotIndex: number, videoUrl: string) => void;
  onTaskFailed?: (shotIndex: number, error: string) => void;
  onComplete?: (videos: QueueStatus['videos'], errors: QueueStatus['errors']) => void;
  onError?: (error: string) => void;
}

interface UseVideoQueueReturn {
  // 状态
  batchId: string | null;
  isSubmitting: boolean;
  isProcessing: boolean;
  status: QueueStatus | null;
  error: string | null;
  
  // 方法
  submitTasks: (tasks: VideoTask[], seriesId?: string, episodeNumber?: number) => Promise<string | null>;
  startProcessing: () => void;
  stopProcessing: () => void;
  checkStatus: () => Promise<QueueStatus | null>;
  cancelTasks: () => Promise<boolean>;
}

export function useVideoQueue(options: UseVideoQueueOptions = {}): UseVideoQueueReturn {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // 提交任务
  const submitTasks = useCallback(async (
    tasks: VideoTask[],
    seriesId?: string,
    episodeNumber?: number
  ): Promise<string | null> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/videos/queue/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          seriesId,
          episodeNumber,
          autoStart: false,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '提交失败');
      }
      
      setBatchId(data.batchId);
      setStatus({
        batchId: data.batchId,
        total: data.totalTasks,
        pending: data.totalTasks,
        processing: 0,
        completed: 0,
        failed: 0,
        progress: 0,
        isComplete: false,
        videos: [],
        errors: [],
      });
      
      return data.batchId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '提交失败';
      setError(errorMsg);
      options.onError?.(errorMsg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [options]);

  // 开始处理（使用SSE）
  const startProcessing = useCallback(() => {
    if (!batchId) return;
    
    setIsProcessing(true);
    cleanup();
    
    // 使用SSE连接处理进度
    const eventSource = new EventSource(`/api/videos/queue/process?batchId=${batchId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'init':
            setStatus(prev => prev ? {
              ...prev,
              total: data.totalTasks,
              pending: data.pendingTasks,
              completed: data.completedTasks,
              failed: data.failedTasks,
            } : null);
            break;
            
          case 'progress':
            options.onProgress?.(data.progress, data.message);
            setStatus(prev => prev ? {
              ...prev,
              progress: data.progress,
              processing: 1,
              pending: prev.pending - 1,
            } : null);
            break;
            
          case 'task_complete':
            options.onTaskComplete?.(data.shotIndex, data.videoUrl);
            setStatus(prev => prev ? {
              ...prev,
              progress: data.progress,
              completed: prev.completed + 1,
              processing: 0,
              videos: [...prev.videos, {
                shotIndex: data.shotIndex,
                shotName: data.shotName,
                url: data.videoUrl,
              }],
            } : null);
            break;
            
          case 'task_failed':
            options.onTaskFailed?.(data.shotIndex, data.error);
            setStatus(prev => prev ? {
              ...prev,
              failed: prev.failed + 1,
              processing: 0,
              errors: [...prev.errors, {
                shotIndex: data.shotIndex,
                shotName: data.shotName,
                error: data.error,
              }],
            } : null);
            break;
            
          case 'complete':
            setIsProcessing(false);
            setStatus(prev => prev ? {
              ...prev,
              isComplete: true,
              progress: 100,
              videos: data.videos,
              errors: data.errors,
            } : null);
            options.onComplete?.(data.videos, data.errors);
            cleanup();
            break;
            
          case 'error':
            setError(data.message);
            options.onError?.(data.message);
            setIsProcessing(false);
            cleanup();
            break;
            
          case 'rate_limit':
            options.onProgress?.(0, data.message);
            break;
            
          case 'wait':
            options.onProgress?.(0, data.message);
            break;
        }
      } catch (err) {
        console.error('解析SSE消息失败:', err);
      }
    };
    
    eventSource.onerror = () => {
      // SSE连接出错，切换到轮询模式
      console.log('SSE连接失败，切换到轮询模式');
      eventSource.close();
      
      // 使用轮询
      pollingIntervalRef.current = setInterval(async () => {
        const result = await checkStatus();
        if (result?.isComplete) {
          stopProcessing();
        }
      }, 3000);
    };
  }, [batchId, cleanup, options]);

  // 停止处理
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    cleanup();
  }, [cleanup]);

  // 检查状态
  const checkStatus = useCallback(async (): Promise<QueueStatus | null> => {
    if (!batchId) return null;
    
    try {
      const response = await fetch(`/api/videos/queue/submit?batchId=${batchId}`);
      const data = await response.json();
      
      if (response.ok) {
        setStatus(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('查询状态失败:', err);
      return null;
    }
  }, [batchId]);

  // 取消任务
  const cancelTasks = useCallback(async (): Promise<boolean> => {
    if (!batchId) return false;
    
    try {
      const response = await fetch(`/api/videos/queue/submit?batchId=${batchId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('取消任务失败:', err);
      return false;
    }
  }, [batchId]);

  // 清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    batchId,
    isSubmitting,
    isProcessing,
    status,
    error,
    submitTasks,
    startProcessing,
    stopProcessing,
    checkStatus,
    cancelTasks,
  };
}
