'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  TrendingUp, 
  Shield, 
  Turtle,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ScheduleStrategy = 'fast' | 'balanced' | 'stable' | 'slow';

interface StrategyConfig {
  name: string;
  icon: React.ElementType;
  iconColor: string;
  minInterval: number;
  maxRequestsPerMinute: number;
  maxRetries: number;
  description: string;
  recommended: boolean;
  speedLevel: number; // 1-4
}

const STRATEGY_CONFIGS: Record<ScheduleStrategy, StrategyConfig> = {
  fast: {
    name: '快速模式',
    icon: Zap,
    iconColor: 'text-yellow-500',
    minInterval: 15,
    maxRequestsPerMinute: 3,
    maxRetries: 3,
    description: '快速生成，但可能触发限流',
    recommended: false,
    speedLevel: 4,
  },
  balanced: {
    name: '均衡模式',
    icon: TrendingUp,
    iconColor: 'text-blue-500',
    minInterval: 30,
    maxRequestsPerMinute: 2,
    maxRetries: 5,
    description: '速度与稳定性兼顾，推荐使用',
    recommended: true,
    speedLevel: 3,
  },
  stable: {
    name: '稳定模式',
    icon: Shield,
    iconColor: 'text-green-500',
    minInterval: 60,
    maxRequestsPerMinute: 1,
    maxRetries: 7,
    description: '稳定优先，避免限流',
    recommended: false,
    speedLevel: 2,
  },
  slow: {
    name: '慢速模式',
    icon: Turtle,
    iconColor: 'text-purple-500',
    minInterval: 120,
    maxRequestsPerMinute: 0.5,
    maxRetries: 10,
    description: '最慢但最稳定，适合大批量任务',
    recommended: false,
    speedLevel: 1,
  },
};

interface SchedulerStats {
  strategy: ScheduleStrategy;
  state: {
    requestCount: number;
    successCount: number;
    failureCount: number;
    rateLimitCount: number;
    tokens: number;
  };
  successRate: number;
}

interface Props {
  currentStrategy?: ScheduleStrategy;
  onStrategyChange?: (strategy: ScheduleStrategy) => void;
  showStats?: boolean;
  compact?: boolean;
}

export function ScheduleStrategySelector({
  currentStrategy = 'balanced',
  onStrategyChange,
  showStats = true,
  compact = false,
}: Props) {
  const [selected, setSelected] = useState<ScheduleStrategy>(currentStrategy);
  const [stats, setStats] = useState<SchedulerStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载调度器状态
  const loadStats = async () => {
    try {
      const response = await fetch('/api/videos/queue/process');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
          setSelected(data.stats.strategy);
        }
      }
    } catch (error) {
      console.error('加载调度器状态失败:', error);
    }
  };

  // 更新调度策略
  const updateStrategy = async (strategy: ScheduleStrategy) => {
    setLoading(true);
    try {
      const response = await fetch('/api/videos/queue/process', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });

      if (response.ok) {
        setSelected(strategy);
        onStrategyChange?.(strategy);
        await loadStats();
      }
    } catch (error) {
      console.error('更新策略失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 重置调度器
  const resetScheduler = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/videos/queue/process', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });

      if (response.ok) {
        await loadStats();
      }
    } catch (error) {
      console.error('重置调度器失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showStats) {
      loadStats();
    }
  }, [showStats]);

  if (compact) {
    // 紧凑模式：只显示策略选择按钮
    return (
      <div className="flex items-center gap-2">
        {Object.entries(STRATEGY_CONFIGS).map(([key, config]) => {
          const Icon = config.icon;
          const isSelected = selected === key;
          
          return (
            <Button
              key={key}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateStrategy(key as ScheduleStrategy)}
              disabled={loading}
              className="relative"
            >
              <Icon className={cn('h-4 w-4 mr-1', config.iconColor)} />
              {config.name.replace('模式', '')}
              {config.recommended && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  推荐
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            视频生成调度策略
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetScheduler}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            重置
          </Button>
        </CardTitle>
        <CardDescription>
          选择合适的生成速度，避免API限流
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 策略选择 */}
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(STRATEGY_CONFIGS).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = selected === key;
            
            return (
              <Card
                key={key}
                className={cn(
                  'cursor-pointer transition-all hover:border-primary',
                  isSelected && 'border-primary bg-primary/5'
                )}
                onClick={() => updateStrategy(key as ScheduleStrategy)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-5 w-5', config.iconColor)} />
                      <span className="font-medium">{config.name}</span>
                    </div>
                    {config.recommended && (
                      <Badge variant="secondary" className="text-xs">
                        推荐
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {config.description}
                  </p>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        请求间隔
                      </span>
                      <span className="font-medium text-foreground">
                        {config.minInterval}秒
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>每分钟最大请求数</span>
                      <span className="font-medium text-foreground">
                        {config.maxRequestsPerMinute}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>最大重试次数</span>
                      <span className="font-medium text-foreground">
                        {config.maxRetries}
                      </span>
                    </div>
                  </div>
                  
                  {/* 速度指示器 */}
                  <div className="mt-3">
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-2 flex-1 rounded-full',
                            i < config.speedLevel 
                              ? isSelected ? 'bg-primary' : 'bg-muted-foreground/30'
                              : 'bg-muted'
                          )}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      速度等级: {'⚡'.repeat(config.speedLevel)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 统计信息 */}
        {showStats && stats && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              实时统计
            </h4>
            
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-500">
                  {stats.state.requestCount}
                </div>
                <div className="text-xs text-muted-foreground">总请求</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-500 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {stats.state.successCount}
                </div>
                <div className="text-xs text-muted-foreground">成功</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-red-500 flex items-center justify-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {stats.state.failureCount}
                </div>
                <div className="text-xs text-muted-foreground">失败</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {stats.state.rateLimitCount}
                </div>
                <div className="text-xs text-muted-foreground">限流</div>
              </div>
            </div>

            {/* 成功率 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">成功率</span>
                <span className="text-sm font-medium">
                  {(stats.successRate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={stats.successRate * 100} 
                className={cn(
                  'h-2',
                  stats.successRate >= 0.8 && '[&>div]:bg-green-500',
                  stats.successRate < 0.8 && stats.successRate >= 0.5 && '[&>div]:bg-yellow-500',
                  stats.successRate < 0.5 && '[&>div]:bg-red-500'
                )}
              />
            </div>

            {/* 令牌数 */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">当前令牌数</span>
              <span className="font-medium">{stats.state.tokens.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
