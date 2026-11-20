/**
 * 开放 API（/api/v1）统一鉴权与错误响应
 *
 * 鉴权方式：Authorization: Bearer sk_live_xxx
 * 错误响应统一为 { error: { code, message } }，便于客户端按 code 分支处理。
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveApiKey } from '@/lib/api-key-store';
import { consumeRateLimit } from '@/lib/api-rate-limit';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/** 统一错误响应 */
export function apiError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export type ApiAuthResult =
  | { ok: true; userId: string; keyId: string; remaining: number }
  | { ok: false; response: NextResponse };

/** 校验 Bearer Key 并消耗一次限流额度 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const header = request.headers.get('authorization') || '';
  const plaintext = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!plaintext) {
    return {
      ok: false,
      response: apiError(401, 'MISSING_API_KEY', '缺少 Authorization: Bearer <API Key>'),
    };
  }

  const resolved = await resolveApiKey(plaintext);
  if (!resolved) {
    return { ok: false, response: apiError(401, 'INVALID_API_KEY', 'API Key 无效或已被吊销') };
  }

  const limit = consumeRateLimit(resolved.keyId);
  if (!limit.allowed) {
    return {
      ok: false,
      response: apiError(429, 'RATE_LIMITED', '请求过于频繁，请稍后重试', {
        'Retry-After': String(limit.retryAfterSec),
      }),
    };
  }

  return { ok: true, userId: resolved.userId, keyId: resolved.keyId, remaining: limit.remaining };
}
