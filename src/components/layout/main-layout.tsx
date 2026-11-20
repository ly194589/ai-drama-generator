'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AppSidebar } from './app-sidebar';
import { useSubscription } from '@/hooks/use-subscription';
import { Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 完全公开的页面（不需要登录，也不显示侧边栏）
const PUBLIC_PATHS = ['/login', '/solution', '/about'];

// 可选登录的页面（未登录可访问，始终显示侧边栏）
const OPTIONAL_AUTH_PATHS = ['/', '/profile', '/settings', '/skills', '/docs', '/help-center'];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // 检查页面类型
  const isPublicPage = PUBLIC_PATHS.some(path => pathname?.startsWith(path));
  const isOptionalAuthPage = OPTIONAL_AUTH_PATHS.includes(pathname || '');
  const pageTitle = pathname === '/' ? '创作工作台' : ({
    '/drama': '剧本创作', '/images': '图片管理', '/videos': '视频管理', '/audio': '音乐管理',
    '/workflow': '工作流', '/editor': '视频剪辑', '/chat': 'AI 顾问', '/ai-advisor': 'AI 顾问',
    '/settings': '模型设置', '/profile': '个人中心', '/config': '配置工具', '/prompts': '提示词库',
    '/docs': '文档中心', '/help-center': '帮助中心', '/storyboard': '分镜管理', '/skills': 'Skill 市场',
  } as Record<string, string>)[pathname || ''] || 'AI 短剧创作';

  // 始终检查用户登录状态（用于决定是否显示侧边栏）
  const { isAuthorized, isLoading } = useSubscription(!isPublicPage && !isOptionalAuthPage);

  // 公开页面且未登录：不显示侧边栏
  if (isPublicPage && !isAuthorized) {
    // 公开页中除登录（全屏 auth 布局）外，均与登录后页面使用同款容器
    const withContainer = !pathname?.startsWith('/login');
    return (
      <div className="min-h-screen bg-background">
        <main className="min-h-screen">
          {withContainer ? (
            <div className="app-page-content mx-auto min-h-screen w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10" data-page={pathname || 'public'}>
              {children}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    );
  }

  // 权限检查中（仅对需要授权的页面显示加载状态）
  if (isLoading && !isOptionalAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">验证授权中...</p>
        </div>
      </div>
    );
  }

  // 未授权且非公开/可选页面：跳转到登录
  if (!isAuthorized && !isPublicPage && !isOptionalAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">正在跳转...</p>
        </div>
      </div>
    );
  }

  // 已登录用户 或 可选登录页面：始终显示侧边栏
  if (isAuthorized || isOptionalAuthPage) {
    return (
      <div className="min-h-screen bg-background">
        <AppSidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="关闭导航菜单"
            className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <main className="app-workspace-main min-h-screen min-w-0 transition-[padding] duration-300 ease-in-out pl-0 lg:pl-64">
          <div className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
            <div className="sticky top-0 z-20 -mx-4 mb-5 flex h-14 items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="打开导航菜单"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="truncate text-sm font-semibold tracking-tight">{pageTitle}</span>
              <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">AI 短剧工作台</span>
            </div>
            <div className="app-page-content min-w-0" data-page={pathname || 'home'}>
            {children}
            </div>
          </div>
        </main>
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-40 -top-48 h-[32rem] w-[32rem] rounded-full bg-primary/[0.035] blur-3xl" />
          <div className="absolute -bottom-48 -left-48 h-[28rem] w-[28rem] rounded-full bg-accent/40 blur-3xl" />
        </div>
      </div>
    );
  }

  // 兜底：不显示侧边栏
  return (
    <div className="min-h-screen bg-background">
      <main className="min-h-screen">
        {children}
      </main>
    </div>
  );
}
