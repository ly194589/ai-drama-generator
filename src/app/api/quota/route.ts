import { NextRequest, NextResponse } from 'next/server';
import { checkQuota, decrementQuota, refundQuota, recordUsage, QuotaType } from '@/lib/quota-service';

/**
 * 配额管理 API
 * 
 * GET /api/quota?userId=xxx&type=videos
 * 检查用户配额
 * 
 * POST /api/quota
 * 扣减配额
 * Body: { userId, type, action, count }
 * 
 * PUT /api/quota
 * 退还配额
 * Body: { userId, type, action, count }
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as QuotaType | null;

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    if (type) {
      // 检查特定类型的配额
      const result = await checkQuota(userId, type);
      return NextResponse.json(result);
    } else {
      // 返回所有配额信息（通过订阅API获取）
      return NextResponse.json({ 
        message: '请使用 /api/auth/subscription 获取完整配额信息' 
      });
    }
  } catch (error) {
    console.error('[配额检查] 失败:', error);
    return NextResponse.json({ error: '配额检查失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, action, count = 1 } = body;

    if (!userId || !type || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 扣减配额
    const result = await decrementQuota(userId, type as QuotaType, count);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 记录使用
    await recordUsage(userId, type as QuotaType, action, count, 'success');

    return NextResponse.json({ 
      success: true, 
      quotas: result.quotas 
    });
  } catch (error) {
    console.error('[配额扣减] 失败:', error);
    return NextResponse.json({ error: '配额扣减失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, action, count = 1 } = body;

    if (!userId || !type || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 退还配额
    const result = await refundQuota(userId, type as QuotaType, count);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 记录退还
    await recordUsage(userId, type as QuotaType, action, count, 'refunded');

    return NextResponse.json({ 
      success: true, 
      quotas: result.quotas 
    });
  } catch (error) {
    console.error('[配额退还] 失败:', error);
    return NextResponse.json({ error: '配额退还失败' }, { status: 500 });
  }
}
