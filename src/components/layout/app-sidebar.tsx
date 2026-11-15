'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/use-subscription';
import {
  FileText,
  Settings,
  Settings2,
  MessageSquareText,
  Home,
  MessageCircle,
  Video,
  Scissors,
  Music,
  Image as ImageIcon,
  Sparkles,
  BookOpen,
  Layers,
  HelpCircle,
  User,
  LogIn,
  LogOut,
  Loader2,
  ChevronLeft,
  Menu,
  Zap,
  Wand2,
  Clock,
  Crown,
  Star,
  Gift,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// 存储侧边栏折叠状态的key
const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const navGroups = [
  {
    title: '概览',
    items: [
      {
        title: '首页',
        href: '/',
        icon: Home,
        color: 'from-blue-500 to-cyan-500',
      },
      {
        title: '模型设置',
        href: '/settings',
        icon: Settings,
        description: '方案选择、API配置、模型参数',
        color: 'from-violet-500 to-purple-500',
      },
      {
        title: '剧本创作',
        href: '/drama',
        icon: BookOpen,
        description: 'AI生成剧本、分镜、视频',
        color: 'from-orange-500 to-amber-500',
      },
    ],
  },
  {
    title: '素材管理',
    items: [
      {
        title: '图片管理',
        href: '/images',
        icon: ImageIcon,
        description: '海报、宣传图、角色图',
        color: 'from-pink-500 to-rose-500',
      },
      {
        title: '音乐管理',
        href: '/audio',
        icon: Music,
        description: '配乐、BGM、音效',
        color: 'from-green-500 to-emerald-500',
      },
      {
        title: '视频管理',
        href: '/videos',
        icon: Video,
        description: '视频素材、AI生成视频',
        color: 'from-red-500 to-orange-500',
      },
    ],
  },
  {
    title: '创作工具',
    items: [
      {
        title: '视频剪辑',
        href: '/editor',
        icon: Scissors,
        description: 'AI剪辑合成',
        color: 'from-indigo-500 to-blue-500',
      },
      {
        title: '配置工具',
        href: '/config',
        icon: Settings2,
        description: '角色档案、分镜剧本',
        color: 'from-emerald-500 to-green-500',
      },
    ],
  },
  {
    title: 'AI助手',
    items: [
      {
        title: '提示词库',
        href: '/prompts',
        icon: MessageSquareText,
        color: 'from-sky-500 to-blue-500',
      },
      {
        title: 'AI顾问',
        href: '/chat',
        icon: MessageCircle,
        color: 'from-violet-500 to-indigo-500',
      },
    ],
  },
  {
    title: '系统',
    items: [
      {
        title: '帮助中心',
        href: '/help-center',
        icon: HelpCircle,
        description: 'FAQ和使用指南',
        color: 'from-amber-500 to-yellow-500',
      },
      {
        title: '文档站',
        href: '/docs',
        icon: BookOpen,
        description: '详细文档',
        color: 'from-slate-500 to-gray-500',
      },
    ],
  },
  {
    title: '更多',
    items: [
      {
        title: '解决方案',
        href: '/solution',
        icon: Zap,
        description: '方案和定价',
        color: 'from-cyan-500 to-blue-500',
      },
      {
        title: '关于我们',
        href: '/about',
        icon: Sparkles,
        description: '了解我们',
        color: 'from-pink-500 to-rose-500',
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthorized, isAdmin, subscription, isLoading } = useSubscription(false);
  
  // 从 localStorage 读取用户信息
  const [user, setUser] = useState<{ id: string; name?: string } | null>(null);
  
  // 从localStorage读取折叠状态，默认不折叠
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 客户端挂载后从 localStorage 读取状态
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
    
    // 读取用户信息
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error('解析用户信息失败:', e);
      }
    }
    
    setMounted(true);
  }, []);

  // 当折叠状态改变时，保存到localStorage并更新body class
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  const handleLogout = () => {
    // 清理所有认证相关的存储
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('oauth_provider');
    localStorage.removeItem('session');
    localStorage.removeItem('subscription');
    setUser(null);
    router.push('/login');
  };

  // 获取套餐图标
  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'yearly':
        return Crown;
      case 'quarterly':
        return Gift;
      case 'monthly':
        return Star;
      default:
        return Sparkles;
    }
  };

  // 获取套餐名称
  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'yearly':
        return '年卡';
      case 'quarterly':
        return '季卡';
      case 'monthly':
        return '月卡';
      default:
        return '体验卡';
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r border-border/60 bg-background/95 backdrop-blur-xl transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo - 更炫酷的渐变 */}
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              {/* 主图标 - 使用更炫酷的渐变 */}
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/30 group-hover:shadow-xl group-hover:shadow-fuchsia-500/40 transition-all duration-300 group-hover:scale-105">
                <Wand2 className="h-5 w-5" />
                {/* 光晕效果 */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">AI短剧</span>
                  <span className="text-[10px] text-muted-foreground leading-tight -mt-0.5">智能创作平台</span>
                </div>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 hover:bg-accent/50 rounded-lg transition-colors',
                collapsed && 'absolute right-2'
              )}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <Menu className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {navGroups.map((group, groupIndex) => (
              <div key={group.title} className={cn('mb-3', groupIndex > 0 && 'mt-3')}>
                {!collapsed && (
                  <h3 className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {group.title}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    // 特殊处理：剧本创作链接在 drama 页面内时，添加 refresh 参数
                    const itemHref = item.href === '/drama' && pathname.startsWith('/drama') 
                      ? '/drama?refresh=true' 
                      : item.href;
                    const linkContent = (
                      <Link
                        key={item.href}
                        href={itemHref}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 group relative',
                          'hover:shadow-sm',
                          isActive
                            ? 'bg-primary/10 text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                          collapsed && 'justify-center px-2.5'
                        )}
                      >
                        {/* 图标容器 - 带彩色背景 */}
                        <div 
                          className={cn(
                            'flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-200 sidebar-icon',
                            isActive
                              ? `bg-gradient-to-br ${item.color} text-white shadow-sm`
                              : 'bg-muted/50 text-muted-foreground group-hover:gradient-active group-hover:text-white group-hover:shadow-sm'
                          )}
                          data-color={item.color}
                        >
                          <item.icon className="h-4 w-4" />
                        </div>
                        
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">{item.title}</span>
                            {isActive && (
                              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse" />
                            )}
                          </>
                        )}
                        
                        {/* 活跃状态指示条 */}
                        {isActive && (
                          <div className={cn(
                            'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-gradient-to-b from-violet-500 to-fuchsia-500',
                            collapsed && 'left-1'
                          )} />
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                          <TooltipContent 
                            side="right" 
                            className="font-medium bg-popover/95 backdrop-blur-sm border-border/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full bg-gradient-to-r', item.color)} />
                              {item.title}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return linkContent;
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User Section */}
          <div className="border-t border-border/50 p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : isAuthorized && user ? (
              <div className="space-y-2">
                {/* 用户信息 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full gap-2 px-2 hover:bg-accent/50 rounded-lg transition-colors',
                        collapsed && 'justify-center'
                      )}
                    >
                      <Avatar className="h-8 w-8 ring-2 ring-violet-500/20 ring-offset-1 ring-offset-background">
                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-sm font-medium">
                          {user.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {!collapsed && (
                        <div className="flex flex-col items-start text-left flex-1 min-w-0">
                          <span className="text-sm font-medium truncate w-full">
                            {user.name || '用户'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isAdmin ? '管理员' : '会员用户'}
                          </span>
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover/95 backdrop-blur-xl border-border/50">
                    <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* 个人信息 */}
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        个人信息
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 订阅状态 - 非折叠时显示 */}
                {!collapsed && !isAdmin && subscription && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20">
                    {(() => {
                      const PlanIcon = getPlanIcon(subscription.planType);
                      return <PlanIcon className={cn(
                        'h-3.5 w-3.5',
                        subscription.planType === 'yearly' ? 'text-amber-600' :
                        subscription.planType === 'quarterly' ? 'text-blue-600' : 'text-green-600'
                      )} />;
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300">
                          {getPlanName(subscription.planType)}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {subscription.remainingDays}天
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 管理员标识 - 永久授权 */}
                {!collapsed && isAdmin && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                    <Crown className="h-3.5 w-3.5 text-amber-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          管理员
                        </span>
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Zap className="h-3 w-3" />
                          永久
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                className={cn('w-full border-dashed hover:border-violet-500/50 hover:bg-violet-500/5', collapsed && 'px-2')}
                onClick={() => router.push('/login')}
              >
                <LogIn className={cn('h-4 w-4', !collapsed && 'mr-2')} />
                {!collapsed && '登录'}
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
