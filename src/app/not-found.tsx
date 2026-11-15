import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <p className="text-6xl font-bold text-primary/80">404</p>
          <h1 className="text-xl font-semibold text-foreground">页面不存在</h1>
          <p className="text-sm text-muted-foreground">
            你访问的页面可能已被删除或地址有误。
          </p>
        </div>
        <Button asChild>
          <Link href="/" className="gap-2">
            <Home className="w-4 h-4" />
            返回首页
          </Link>
        </Button>
      </div>
    </div>
  );
}
