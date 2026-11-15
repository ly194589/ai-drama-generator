'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 可在此接入错误监控
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">页面出错了</h1>
            <p className="text-sm text-muted-foreground">
              {error.message || '发生了未知错误，请稍后重试。'}
            </p>
          </div>
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            重新加载
          </Button>
        </div>
      </body>
    </html>
  );
}
