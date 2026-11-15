'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 检查是否已登录且是管理员
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.isAdmin) {
          // 已登录管理员，跳转到首页
          router.replace('/');
          return;
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 未登录，跳转到登录页
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <CardTitle>正在跳转...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            管理员请通过普通登录页面登录，登录后可使用管理员功能。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
