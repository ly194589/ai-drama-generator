import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys, revokeApiKey, MAX_API_KEYS } from '@/lib/api-key-store';

/** 读取当前用户（内部接口沿用 x-user-id 身份体系） */
function currentUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

/** GET /api/keys - 当前用户的 API Key 列表（仅掩码） */
export async function GET(request: NextRequest) {
  const userId = currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ success: true, keys: await listApiKeys(userId) });
}

/** POST /api/keys - 创建 API Key，明文仅在本次响应返回 */
export async function POST(request: NextRequest) {
  const userId = currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let name = '默认 Key';
  try {
    const body = (await request.json()) as { name?: string };
    if (body?.name && body.name.trim()) name = body.name.trim().slice(0, 40);
  } catch {
    // 允许空请求体，使用默认名称
  }

  const { record, plaintext, evictedCount } = await createApiKey(userId, name);
  return NextResponse.json({
    success: true,
    key: { ...record, plaintext },
    notice:
      evictedCount > 0
        ? `请立即保存，明文 Key 仅显示这一次；已达 ${MAX_API_KEYS} 个上限，已自动吊销最早创建的 Key`
        : '请立即保存，明文 Key 仅显示这一次',
    evictedCount,
  });
}

/** DELETE /api/keys?id=xxx - 吊销 API Key */
export async function DELETE(request: NextRequest) {
  const userId = currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '缺少 id', code: 'MISSING_ID' }, { status: 400 });
  }

  const revoked = await revokeApiKey(userId, id);
  if (!revoked) {
    return NextResponse.json({ error: 'Key 不存在', code: 'KEY_NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
