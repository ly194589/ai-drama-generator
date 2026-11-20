import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-v1';
import { getModelUsage } from '@/lib/model-usage-store';

/** GET /api/v1/usage - 按模型调用次数统计（仅统计，不计费） */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    success: true,
    data: await getModelUsage(auth.userId),
    rateLimit: { limit: 60, windowSeconds: 60, remaining: auth.remaining },
  });
}
