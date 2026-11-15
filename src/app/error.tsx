'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-foreground">加载失败</h1>
          <p className="text-sm text-muted-foreground">
            {error.message || '内容加载出现问题，请重试。'}
          </p>
        </div>
        <Button onClick={reset} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          重试
        </Button>
      </div>
    </div>
  );
}
