import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateCardKey } from '@/lib/alipay';

/**
 * POST /api/payment/confirm
 * 确认支付（模拟支付/手动确认）
 * 
 * 实际项目中，支付确认由支付宝回调自动处理
 * 此接口用于：
 * 1. 开发环境模拟支付
 * 2. 管理员手动确认收款
 */
export async function POST(request: NextRequest) {
  try {
    const { orderNo } = await request.json();

    if (!orderNo) {
      return NextResponse.json(
        { error: '订单号不能为空' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 查询订单
    const { data: order, error: queryError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (queryError || !order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 检查订单状态
    if (order.status === 'paid') {
      // 如果是资源包订单，返回成功信息
      if (order.plan_type === 'resource_pack') {
        return NextResponse.json({
          success: true,
          message: '订单已支付',
          isResourcePack: true,
          quotas: order.metadata?.quotas,
        });
      }
      return NextResponse.json(
        { error: '订单已支付', cardKey: order.card_key },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: '订单已取消' },
        { status: 400 }
      );
    }

    const now = new Date();

    // 处理资源包订单
    if (order.plan_type === 'resource_pack') {
      const metadata = order.metadata as Record<string, unknown>;
      const userId = metadata?.userId as string;
      const quotas = metadata?.quotas as { scripts?: number; videos?: number; images?: number };

      if (!userId || !quotas) {
        return NextResponse.json(
          { error: '订单信息不完整' },
          { status: 400 }
        );
      }

      // 更新订单状态
      const { error: updateOrderError } = await supabase
        .from('payment_orders')
        .update({
          status: 'paid',
          paid_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', order.id);

      if (updateOrderError) {
        console.error('[确认支付] 更新订单失败:', updateOrderError);
        return NextResponse.json(
          { error: '支付处理失败' },
          { status: 500 }
        );
      }

      // 直接给用户添加配额
      const { error: quotaError } = await addResourceQuotas(userId, quotas);

      if (quotaError) {
        console.error('[确认支付] 添加配额失败:', quotaError);
        return NextResponse.json(
          { error: '添加配额失败' },
          { status: 500 }
        );
      }

      console.log(`[确认支付] 资源包支付成功: 订单=${orderNo}, 用户=${userId}, 配额=${JSON.stringify(quotas)}`);

      return NextResponse.json({
        success: true,
        message: '支付成功，配额已添加',
        isResourcePack: true,
        quotas,
      });
    }

    // 处理套餐订单 - 生成卡密
    const cardKey = generateCardKey();

    // 更新订单状态
    const { error: updateOrderError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        card_key: cardKey,
        paid_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', order.id);

    if (updateOrderError) {
      console.error('[确认支付] 更新订单失败:', updateOrderError);
      return NextResponse.json(
        { error: '支付处理失败' },
        { status: 500 }
      );
    }

    // 创建卡密记录
    const { error: createCardError } = await supabase
      .from('card_keys')
      .insert({
        card_key: cardKey,
        status: 'unused',
        plan_type: order.plan_type,
        price: order.amount,
        duration_days: order.duration_days,
        order_id: order.order_no,
      });

    if (createCardError) {
      console.error('[确认支付] 创建卡密失败:', createCardError);
      return NextResponse.json(
        { error: '生成卡密失败' },
        { status: 500 }
      );
    }

    console.log(`[确认支付] 支付成功: 订单=${orderNo}, 卡密=${cardKey}, 套餐=${order.plan_type}`);

    return NextResponse.json({
      success: true,
      message: '支付成功',
      cardKey: cardKey,
      planType: order.plan_type,
      durationDays: order.duration_days,
      expiresAt: new Date(now.getTime() + order.duration_days * 24 * 60 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error('[确认支付] 处理请求失败:', error);
    return NextResponse.json(
      { error: '支付处理失败' },
      { status: 500 }
    );
  }
}

/**
 * 给用户添加资源配额
 */
async function addResourceQuotas(
  userId: string, 
  quotas: { scripts?: number; videos?: number; images?: number }
): Promise<{ error: unknown }> {
  const supabase = getSupabaseClient();

  // 查找用户的当前订阅记录
  const { data: userCard, error: queryError } = await supabase
    .from('card_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'used')
    .order('expires_at', { ascending: false })
    .limit(1)
    .single();

  if (queryError || !userCard) {
    return { error: '用户订阅记录不存在' };
  }

  // 更新配额
  const currentMetadata = (userCard.metadata as Record<string, unknown>) || {};
  const currentQuotas = (currentMetadata.quotas as Record<string, { total: number; used: number }>) || {
    scripts: { total: 0, used: 0 },
    videos: { total: 0, used: 0 },
    images: { total: 0, used: 0 },
  };

  // 累加配额
  if (quotas.scripts) {
    currentQuotas.scripts = currentQuotas.scripts || { total: 0, used: 0 };
    currentQuotas.scripts.total += quotas.scripts;
  }
  if (quotas.videos) {
    currentQuotas.videos = currentQuotas.videos || { total: 0, used: 0 };
    currentQuotas.videos.total += quotas.videos;
  }
  if (quotas.images) {
    currentQuotas.images = currentQuotas.images || { total: 0, used: 0 };
    currentQuotas.images.total += quotas.images;
  }

  // 更新数据库
  const { error: updateError } = await supabase
    .from('card_keys')
    .update({
      metadata: {
        ...currentMetadata,
        quotas: currentQuotas,
        lastQuotaUpdate: new Date().toISOString(),
      },
    })
    .eq('id', userCard.id);

  return { error: updateError };
}

/**
 * GET /api/payment/confirm?orderNo=xxx
 * 查询订单支付状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNo = searchParams.get('orderNo');

    if (!orderNo) {
      return NextResponse.json(
        { error: '订单号不能为空' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data: order, error } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      order: {
        orderNo: order.order_no,
        planType: order.plan_type,
        amount: order.amount,
        durationDays: order.duration_days,
        status: order.status,
        cardKey: order.status === 'paid' ? order.card_key : null,
        paidAt: order.paid_at,
        createdAt: order.created_at,
      },
    });

  } catch (error) {
    console.error('[查询订单] 处理请求失败:', error);
    return NextResponse.json(
      { error: '查询订单失败' },
      { status: 500 }
    );
  }
}
