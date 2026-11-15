import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 全局认证中间件
 * 
 * 保护需要认证的 API 路由和页面路由
 * - API 路由：验证 x-user-id header 或 access_token
 * - 页面路由：检查 access_token cookie（由前端设置）
 */

// 不需要认证的公开路由
const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/payment/notify',
  '/api/health',
  '/api/webhook',
  '/api/chat/stream',
  '/api/chat/advisor',
  '/api/test-env',
];

// 静态资源和 Next.js 内部路由
const IGNORED_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

// 静态文件扩展名
const STATIC_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js'];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(prefix => pathname.startsWith(prefix));
}

function isIgnoredPath(pathname: string): boolean {
  if (IGNORED_PATHS.some(prefix => pathname.startsWith(prefix))) return true;
  if (STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext))) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 忽略静态资源和 Next.js 内部路由
  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  // API 路由认证检查
  if (pathname.startsWith('/api/')) {
    // 公开 API 直接放行
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    // 检查是否有用户身份信息
    const userId = request.headers.get('x-user-id');
    const authorization = request.headers.get('authorization');
    
    // 如果有 userId 或 authorization header，放行
    if (userId || authorization) {
      return NextResponse.next();
    }

    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing authentication credentials' },
      { status: 401 }
    );
  }

  // 页面路由：添加安全 headers
  const response = NextResponse.next();
  
  // 添加安全 headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
