import { NextRequest, NextResponse } from 'next/server';
import { getModelUsage } from '@/lib/model-usage-store';

/**
 * GET /api/providers/usage
 * 返回当前用户按「厂商 + 模型」的调用次数统计
 * 仅用于展示用量分布，不参与计费或额度扣减
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'dev-user';
  return NextResponse.json({
    success: true,
    note: '仅统计成功调用次数，不参与计费',
    usage: await getModelUsage(userId),
  });
}
