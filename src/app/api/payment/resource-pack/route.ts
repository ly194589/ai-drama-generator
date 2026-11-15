import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { 
  isAlipayConfigured, 
  createAlipayWapUrl, 
  createAlipayPageUrl,
} from '@/lib/alipay';
import { resourcePacks } from '@/lib/site-config';

/**
 * 资源包支付 API
 * 
 * POST /api/payment/resource-pack
 * 创建资源包支付订单
 * 
 * 请求体：
 * - packId: 资源包ID (script_pack_5 | video_pack_20 | video_pack_50 | image_pack_100)
 * - payType: 支付方式 (wap | page)
 * - userId: 用户ID（用于绑定资源包）
 */
export async function POST(request: NextRequest) {
  try {
    const { packId, payType = 'wap', userId } = await request.json();

    // 查找资源包配置
    const pack = resourcePacks.find(p => p.id === packId);
    if (!pack) {
      return NextResponse.json(
        { error: '资源包不存在' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();

    // 生成订单号
    const orderNo = `RPK${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 创建订单记录
    const { data: order, error } = await supabase
      .from('payment_orders')
      .insert({
        order_no: orderNo,
        plan_type: 'resource_pack',
        amount: pack.price,
        duration_days: 0, // 资源包无有效期
        status: 'pending',
        payment_method: 'alipay',
        metadata: {
          packId,
          packName: pack.name,
          quotas: pack.quotas,
          userId,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[资源包订单] 创建失败:', error);
      return NextResponse.json(
        { error: '创建订单失败' },
        { status: 500 }
      );
    }

    console.log(`[资源包订单] 创建成功: ${orderNo}, 资源包: ${pack.name}, 金额: ¥${pack.price}`);

    // 获取域名
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const notifyUrl = `${domain}/api/payment/notify`;
    const returnUrl = `${domain}/payment/success?orderNo=${orderNo}`;

    // 检查支付宝配置
    if (isAlipayConfigured()) {
      const paymentUrl = payType === 'page'
        ? createAlipayPageUrl({
            orderId: orderNo,
            subject: `AI短剧生成器 - ${pack.name}`,
            amount: pack.price,
            notifyUrl,
            returnUrl,
          })
        : createAlipayWapUrl({
            orderId: orderNo,
            subject: `AI短剧生成器 - ${pack.name}`,
            amount: pack.price,
            notifyUrl,
            returnUrl,
          });

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNo: order.order_no,
          packId,
          packName: pack.name,
          amount: pack.price,
          quotas: pack.quotas,
          status: order.status,
          createdAt: order.created_at,
        },
        paymentUrl,
        paymentMethod: 'alipay',
      });
    } else {
      // 未配置支付宝，返回模拟支付模式
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNo: order.order_no,
          packId,
          packName: pack.name,
          amount: pack.price,
          quotas: pack.quotas,
          status: order.status,
          createdAt: order.created_at,
        },
        paymentUrl: `/payment/pay?orderNo=${orderNo}`,
        paymentMethod: 'mock',
        message: '支付功能正在配置中，请联系管理员购买资源包',
      });
    }
  } catch (error) {
    console.error('[资源包订单] 处理请求失败:', error);
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment/resource-pack
 * 获取资源包列表
 */
export async function GET() {
  return NextResponse.json({
    packs: resourcePacks.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      description: p.description,
      quotas: p.quotas,
      popular: p.popular,
    })),
    paymentMethod: isAlipayConfigured() ? 'alipay' : 'mock',
  });
}
