'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock,
  Film,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Loader2,
  MessageCircle,
  MessageSquareText,
  MoveVertical,
  Music,
  Palette,
  Plus,
  RefreshCw,
  Rocket,
  Scissors,
  Settings2,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Video,
  Volume2,
  Wand2,
  Workflow,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 快捷操作配置
const quickActions = [
  {
    title: '创建新剧本',
    description: 'AI生成完整短剧剧本',
    icon: BookOpen,
    href: '/drama',
    gradient: 'from-violet-500 to-purple-600',
    badge: '推荐'
  },
  {
    title: '生成宣传图',
    description: 'AI生成海报、封面',
    icon: ImageIcon,
    href: '/images',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    title: '生成配乐',
    description: 'AI生成BGM、音效',
    icon: Music,
    href: '/audio',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    title: '视频剪辑',
    description: 'AI一键剪辑合成',
    icon: Scissors,
    href: '/editor',
    gradient: 'from-cyan-500 to-teal-500',
  },
];

// 模块配置
const modules = [
  {
    title: '图片管理',
    description: '海报、宣传图、角色图',
    icon: ImageIcon,
    href: '/images',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    title: '音乐管理',
    description: '配乐、BGM、音效素材',
    icon: Music,
    href: '/audio',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    title: '视频管理',
    description: '视频素材、AI生成视频',
    icon: Video,
    href: '/videos',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    title: '视频剪辑',
    description: '分镜剪辑、AI合成输出',
    icon: Scissors,
    href: '/editor',
    gradient: 'from-cyan-500 to-teal-500',
  },
  {
    title: '配置工具',
    description: '角色档案、分镜剧本配置',
    icon: Settings2,
    href: '/config',
    gradient: 'from-emerald-500 to-green-500',
  },
  {
    title: '工作流执行',
    description: '自动化短剧生成流程',
    icon: Workflow,
    href: '/workflow',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    title: '提示词库',
    description: 'AI提示词管理与复用',
    icon: MessageSquareText,
    href: '/prompts',
    gradient: 'from-sky-500 to-blue-500',
  },
  {
    title: 'AI顾问',
    description: '专业短剧创作建议',
    icon: MessageCircle,
    href: '/chat',
    gradient: 'from-teal-500 to-cyan-500',
  },
];

// 核心能力亮点
const highlights = [
  { label: '人物一致', icon: Users, desc: '角色不换脸不变装' },
  { label: '画面一致', icon: Film, desc: '光影色调统一' },
  { label: '声音一致', icon: Music, desc: '音色情绪统一' },
  { label: '全自动化', icon: Zap, desc: '一键生成成片' },
];

// 创作流水线（hero 右侧视觉）
const pipeline = [
  { label: '剧本生成', desc: '大纲 → 分集剧本', icon: BookOpen },
  { label: '分镜脚本', desc: '镜头语言拆解', icon: Clapperboard },
  { label: '角色立绘', desc: '多角度人物一致', icon: Wand2 },
  { label: '场景画面', desc: '光影色调统一', icon: Palette },
  { label: '配音配乐', desc: '音色情绪统一', icon: Volume2 },
  { label: '成片合成', desc: '一键剪辑输出', icon: Video },
];

// 统计数据接口
interface Stats {
  images: number;
  audios: number;
  videos: number;
  dramas: number;
  recentActivity: Array<{
    type: string;
    title: string;
    time: string;
    status: 'success' | 'processing' | 'error';
  }>;
  workflowStats: {
    total: number;
    completed: number;
    running: number;
  };
}

interface Recommendation {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: LucideIcon;
  type: 'tip' | 'action' | 'alert';
}

// 未登录用户可见的通用建议
const recommendations: Recommendation[] = [
  {
    title: '设计开场悬念',
    description: '在开场尽早呈现冲突、目标或悬念，帮助观众快速进入剧情。',
    action: '查看详情',
    href: '/docs#rhythm-design',
    icon: Lightbulb,
    type: 'tip',
  }
];

// 功能特性
const features = [
  {
    icon: Clapperboard,
    title: '剧本智能生成',
    description: 'AI自动生成完整剧本、分镜、角色设定',
  },
  {
    icon: Wand2,
    title: '角色立绘生成',
    description: '一键生成多角度角色立绘，保持一致性',
  },
  {
    icon: Palette,
    title: '场景画面生成',
    description: 'AI生成场景图、宣传图、海报',
  },
  {
    icon: Volume2,
    title: '配音配乐生成',
    description: 'AI语音合成、BGM自动生成',
  },
  {
    icon: Video,
    title: '视频自动生成',
    description: '分镜转视频，AI智能合成',
  },
  {
    icon: MoveVertical,
    title: '全流程自动化',
    description: '从剧本到成片，一键完成',
  },
];

// 创作指南入口
const guideLinks = [
  { title: '快速开始', desc: '5 分钟上手第一部短剧', href: '/docs' },
  { title: '核心概念', desc: '剧本 · 分镜 · 三一致', href: '/docs' },
  { title: '集成与部署', desc: 'API 参考与自动化', href: '/docs' },
];

// 分区标题
function SectionHeader({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold tracking-tight">{title}</h2>
          {desc && <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    images: 0,
    audios: 0,
    videos: 0,
    dramas: 0,
    recentActivity: [],
    workflowStats: { total: 0, completed: 0, running: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const dashboardRecommendations: Recommendation[] = useMemo(() => {
    if (!isLoggedIn || loading) return recommendations;

    const items: Recommendation[] = [];
    if (stats.workflowStats.running > 0) {
      items.push({
        title: `继续处理 ${stats.workflowStats.running} 个进行中的工作流`,
        description: '查看生成进度，处理失败步骤或继续未完成的任务。',
        action: '查看任务', href: '/workflow', icon: Workflow, type: 'action',
      });
    }
    if (stats.dramas === 0) {
      items.push({
        title: '创建第一部短剧',
        description: '从题材和故事设定开始，生成大纲、分集剧本与分镜。',
        action: '开始创作', href: '/drama', icon: BookOpen, type: 'action',
      });
    } else if (stats.videos === 0) {
      items.push({
        title: '从剧本开始生成视频',
        description: '打开已有剧集，继续准备分镜素材并生成镜头视频。',
        action: '打开剧集', href: '/drama', icon: Video, type: 'action',
      });
    }
    if (stats.images === 0) {
      items.push({
        title: '准备角色与场景图片',
        description: '生成可复用的角色立绘和场景图，为分镜视频准备素材。',
        action: '生成图片', href: '/images', icon: ImageIcon, type: 'tip',
      });
    }
    if (items.length === 0) return recommendations;
    return items.slice(0, 3);
  }, [isLoggedIn, loading, stats]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    // 检查是否登录
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      // 未登录，不加载统计数据
      setIsLoggedIn(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const user = JSON.parse(userStr);
    const userId = user?.id;

    if (!userId) {
      setIsLoggedIn(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setIsLoggedIn(true);

    const authHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    };

    try {
      const [imagesRes, audiosRes, videosRes, dramasRes, workflowStatsRes] = await Promise.all([
        fetch('/api/images', { headers: authHeaders }).catch(() => null),
        fetch('/api/audio', { headers: authHeaders }).catch(() => null),
        fetch('/api/videos', { headers: authHeaders }).catch(() => null),
        fetch('/api/drama/series', { headers: authHeaders }).catch(() => null),
        fetch('/api/workflow/stats', { headers: authHeaders }).catch(() => null),
      ]);

      const statsData: Stats = {
        images: 0,
        audios: 0,
        videos: 0,
        dramas: 0,
        recentActivity: [],
        workflowStats: { total: 0, completed: 0, running: 0 }
      };

      if (imagesRes?.ok) {
        const data = await imagesRes.json();
        statsData.images = data.images?.length || 0;
      }
      if (audiosRes?.ok) {
        const data = await audiosRes.json();
        statsData.audios = data.audios?.length || 0;
      }
      if (videosRes?.ok) {
        const data = await videosRes.json();
        statsData.videos = data.videos?.length || 0;
      }
      if (dramasRes?.ok) {
        const data = await dramasRes.json();
        statsData.dramas = data.series?.length || 0;
      }

      if (workflowStatsRes?.ok) {
        const data = await workflowStatsRes.json();
        if (data.success) {
          statsData.workflowStats = {
            total: data.workflowStats?.total || 0,
            completed: data.workflowStats?.completed || 0,
            running: data.workflowStats?.running || 0,
          };
          if (data.recentActivity && data.recentActivity.length > 0) {
            statsData.recentActivity = data.recentActivity;
          }
        }
      }

      setStats(statsData);
    } catch (error) {
      console.error('加载统计失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const statCards = [
    { label: '剧本项目', value: stats.dramas, icon: BookOpen, href: '/drama', iconClass: 'text-violet-500', chipClass: 'bg-violet-500/10' },
    { label: '图片素材', value: stats.images, icon: ImageIcon, href: '/images', iconClass: 'text-orange-500', chipClass: 'bg-orange-500/10' },
    { label: '音频素材', value: stats.audios, icon: Music, href: '/audio', iconClass: 'text-pink-500', chipClass: 'bg-pink-500/10' },
    { label: '视频素材', value: stats.videos, icon: Video, href: '/videos', iconClass: 'text-cyan-500', chipClass: 'bg-cyan-500/10' },
    { label: '工作流', value: `${stats.workflowStats.completed}/${stats.workflowStats.total}`, icon: Zap, href: '/workflow', iconClass: 'text-emerald-500', chipClass: 'bg-emerald-500/10', running: stats.workflowStats.running },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Section - 品牌渐变 + 创作流水线视觉 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-600">
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl" />

          <div className="relative z-10 p-5 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-center">
              {/* 左侧：标题与行动 */}
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-white/15 border border-white/10 text-white/90 text-xs sm:text-sm mb-3 sm:mb-4 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  AI驱动的短剧创作平台
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 tracking-tight leading-tight">
                  从剧本到成片，一键完成
                </h1>
                <p className="text-white/80 text-xs sm:text-sm md:text-base mb-4 sm:mb-6">
                  真人风短剧 · 人物画面声音三一致 · 全流程自动化
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Button size="default" className="bg-white text-violet-700 hover:bg-white/90 shadow-lg h-9 sm:h-10 md:h-11" asChild>
                    <Link href="/drama">
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                      创建新剧本
                    </Link>
                  </Button>
                  <Button size="default" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-9 sm:h-10 md:h-11" asChild>
                    <Link href="/docs">
                      <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      使用指南
                    </Link>
                  </Button>
                </div>
              </div>

              {/* 右侧：创作流水线玻璃面板 */}
              <div className="hidden lg:block rounded-xl border border-white/15 bg-white/10 backdrop-blur-md p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-white">创作流水线</span>
                  <Badge className="bg-white/15 text-white/90 border-0 text-[10px] hover:bg-white/15">全自动</Badge>
                </div>
                <ol>
                  {pipeline.map((step, i) => (
                    <li key={step.label} className="relative flex items-center gap-3 pb-3 last:pb-0">
                      {i < pipeline.length - 1 && (
                        <span className="absolute left-4 top-9 bottom-0 w-px bg-white/20" aria-hidden />
                      )}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 border border-white/10 text-white">
                        <step.icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-white flex-1">{step.label}</span>
                      <span className="text-[10px] text-white/60">{step.desc}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* 核心亮点 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-6 sm:mt-8">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/10"
                >
                  <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/20 shrink-0">
                    <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-white">{item.label}</p>
                    <p className="text-[10px] sm:text-xs text-white/70 hidden sm:block">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 主内容区：左侧主区域 + 右侧边栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧主区域 */}
          <div className="lg:col-span-3 space-y-6">
            {/* 数据仪表盘 / 登录引导 */}
            {isLoggedIn ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                {statCards.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group p-3 sm:p-4 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', item.chipClass)}>
                        <item.icon className={cn('h-4 w-4', item.iconClass)} />
                      </span>
                      {item.running !== undefined && item.running > 0 && (
                        <span className="text-[10px] sm:text-xs text-blue-500 flex items-center">
                          <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 animate-spin" />
                          {item.running}
                        </span>
                      )}
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums">{loading ? '...' : item.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white w-fit shadow-lg shadow-primary/20 shrink-0">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight">登录后解锁创作仪表盘</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      实时统计剧本、图片、音频、视频素材与工作流进度
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button asChild className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-md shadow-primary/20">
                      <Link href="/login">立即登录</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/about">了解平台</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 快捷操作 */}
            <section className="space-y-3">
              <SectionHeader
                icon={Zap}
                title="快捷操作"
                desc="高频创作入口，一键直达"
                action={
                  <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8 p-0" aria-label="刷新统计">
                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                }
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group relative p-3 sm:p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                      <div className={cn('p-2 sm:p-2.5 rounded-xl bg-gradient-to-br text-white shadow-sm', action.gradient)}>
                        <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      {action.badge && (
                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 sm:h-5 bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm flex items-center gap-1">
                      {action.title}
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{action.description}</p>
                  </Link>
                ))}
              </div>
            </section>

            {/* 功能模块 */}
            <section className="space-y-3">
              <SectionHeader icon={Layers} title="功能模块" desc="素材管理与创作工具全景" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {modules.map((module) => (
                  <Link
                    key={module.title}
                    href={module.href}
                    className="group p-3 sm:p-3.5 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                  >
                    <div className={cn('p-2 rounded-lg mb-2 w-fit bg-gradient-to-br text-white shadow-sm', module.gradient)}>
                      <module.icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-medium text-xs sm:text-sm">{module.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{module.description}</p>
                  </Link>
                ))}
              </div>
            </section>

            {/* 全链路创作能力 */}
            <section className="space-y-3">
              <SectionHeader icon={Sparkles} title="全链路创作能力" desc="从剧本到成片的六大核心能力" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="group p-4 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card hover:border-primary/30 hover:shadow-md transition-all"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 mb-2.5 w-fit text-primary">
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm">{feature.title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-4 sm:space-y-6">
            {/* 智能推荐 */}
            <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                    <Lightbulb className="h-4 w-4" />
                  </span>
                  智能推荐
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {dashboardRecommendations.map((rec, index) => (
                    <Link
                      key={index}
                      href={rec.href}
                      className={cn(
                        'group block p-3 rounded-lg border transition-all hover:shadow-sm active:scale-[0.98]',
                        rec.type === 'alert' && 'border-amber-200/50 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20',
                        rec.type === 'tip' && 'border-blue-200/50 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/20',
                        rec.type === 'action' && 'border-emerald-200/50 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/20'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <rec.icon className={cn(
                          'h-4 w-4 mt-0.5 shrink-0',
                          rec.type === 'alert' && 'text-amber-600',
                          rec.type === 'tip' && 'text-blue-600',
                          rec.type === 'action' && 'text-emerald-600'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium">{rec.title}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 mt-0.5">{rec.description}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors mt-0.5 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 创作指南 */}
            <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  创作指南
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1">
                  {guideLinks.map((link) => (
                    <Link
                      key={link.title}
                      href={link.href}
                      className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium">{link.title}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{link.desc}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 最近活动 */}
            {isLoggedIn && (
              <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                      <Clock className="h-4 w-4" />
                    </span>
                    最近活动
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {stats.recentActivity.length > 0 ? (
                    <div className="space-y-1.5 sm:space-y-2">
                      {stats.recentActivity.slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-accent/50 transition-colors">
                          <div className={cn(
                            'p-0.5 sm:p-1 rounded-full',
                            activity.status === 'success' && 'bg-emerald-500/10',
                            activity.status === 'processing' && 'bg-blue-500/10',
                            activity.status === 'error' && 'bg-red-500/10'
                          )}>
                            {activity.status === 'success' && <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-500" />}
                            {activity.status === 'processing' && <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500 animate-spin" />}
                            {activity.status === 'error' && <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs truncate">{activity.title}</p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 sm:py-6 text-center">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50 mb-1.5 sm:mb-2" />
                      <p className="text-[10px] sm:text-xs text-muted-foreground">暂无最近活动</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
