'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { useSubscription } from '@/hooks/use-subscription';
import { Loader2 } from 'lucide-react';

// 完全公开的页面（不需要登录，也不显示侧边栏）
const PUBLIC_PATHS = ['/login', '/docs', '/help-center', '/solution', '/about'];

// 可选登录的页面（未登录可访问，始终显示侧边栏）
const OPTIONAL_AUTH_PATHS = ['/', '/profile', '/settings'];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  // 检查页面类型
  const isPublicPage = PUBLIC_PATHS.some(path => pathname?.startsWith(path));
  const isOptionalAuthPage = OPTIONAL_AUTH_PATHS.includes(pathname || '');

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
            <div className="container mx-auto p-4 sm:p-6 max-w-7xl">{children}</div>
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
        <AppSidebar />
        <main className="min-h-screen transition-all duration-300 ease-in-out pl-0 lg:pl-64">
          <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
            {children}
          </div>
        </main>
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
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
