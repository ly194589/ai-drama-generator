import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth-session';

const PUBLIC_API_METHODS: Record<string, string[]> = {
  '/api/auth/login': ['POST'],
  '/api/auth/register': ['POST'],
  '/api/auth/card-key': ['POST'],
  '/api/auth/dev-login': ['POST'],
  '/api/auth/oauth/coze': ['GET'],
  '/api/auth/oauth/coze/callback': ['GET', 'POST'],
  '/api/payment/notify': ['POST'],
  '/api/payment/create-order': ['GET'],
  '/api/health': ['GET'],
};

function isPublicApi(pathname: string, method: string): boolean {
  return PUBLIC_API_METHODS[pathname]?.includes(method) ?? false;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

/** 开放 API 的跨域响应头（不使用 Cookie，允许任意来源） */
const OPEN_API_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Max-Age': '86400',
};

function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(OPEN_API_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    // 开放 API：使用平台签发的 Bearer Key 鉴权，由路由自行校验
    if (pathname.startsWith('/api/v1/')) {
      // 浏览器预检请求无需鉴权
      if (request.method === 'OPTIONS') {
        return addSecurityHeaders(withCors(new NextResponse(null, { status: 204 })));
      }

      const authorization = request.headers.get('authorization') || '';
      if (/^bearer\s+sk_live_/i.test(authorization)) {
        const openHeaders = new Headers(request.headers);
        // 外部请求不得自带身份头，用户身份由 API Key 反查得到
        openHeaders.delete('x-user-id');
        return addSecurityHeaders(withCors(NextResponse.next({ request: { headers: openHeaders } })));
      }
      return addSecurityHeaders(withCors(NextResponse.json(
        { error: { code: 'MISSING_API_KEY', message: '缺少 Authorization: Bearer <API Key>' } },
        { status: 401 },
      )));
    }

    if (isPublicApi(pathname, request.method)) {
      const publicHeaders = new Headers(request.headers);
      // Public endpoints must never consume caller supplied identity headers.
      publicHeaders.delete('x-user-id');
      publicHeaders.delete('authorization');
      return addSecurityHeaders(NextResponse.next({ request: { headers: publicHeaders } }));
    }

    const userId = await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
    if (!userId) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Unauthorized', message: 'A valid session is required' },
        { status: 401 },
      ));
    }

    const authenticatedHeaders = new Headers(request.headers);
    authenticatedHeaders.set('x-user-id', userId);
    // Do not let route handlers interpret an unverified bearer token as a second identity.
    authenticatedHeaders.delete('authorization');
    return addSecurityHeaders(NextResponse.next({ request: { headers: authenticatedHeaders } }));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
