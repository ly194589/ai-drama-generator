import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { 
  isAlipayConfigured, 
  createAlipayWapUrl, 
  createAlipayPageUrl,
  generateCardKey 
} from '@/lib/alipay';

/**
 * 套餐配置
 */
const PLAN_CONFIG = {
  trial: {
    name: '体验卡',
    price: 0,
    durationDays: 7,
    description: '新用户免费体验',
  },
  monthly: {
    name: '月卡',
    price: 29.9,
    durationDays: 30,
    description: '适合个人创作者',
  },
  quarterly: {
    name: '季卡',
    price: 79,
    durationDays: 90,
    description: '超值选择，省11%',
  },
  yearly: {
    name: '年卡',
    price: 199,
    durationDays: 365,
    description: '最佳性价比，省44%',
  },
};

/**
 * POST /api/payment/create-order
 * 创建支付宝支付订单
 * 
 * 请求体：
 * - planType: 套餐类型 (monthly | quarterly | yearly)
 * - payType: 支付方式 (wap-手机网页 | page-电脑网页)，默认 wap
 */
export async function POST(request: NextRequest) {
  try {
    const { planType, payType = 'wap' } = await request.json();

    if (!planType || !PLAN_CONFIG[planType as keyof typeof PLAN_CONFIG]) {
      return NextResponse.json(
        { error: '请选择有效的套餐' },
        { status: 400 }
      );
    }

    const plan = PLAN_CONFIG[planType as keyof typeof PLAN_CONFIG];
    const supabase = getSupabaseClient();

    // 生成订单号
    const orderNo = `ALI${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 创建订单记录
    const { data: order, error } = await supabase
      .from('payment_orders')
      .insert({
        order_no: orderNo,
        plan_type: planType,
        amount: plan.price,
        duration_days: plan.durationDays,
        status: 'pending',
        payment_method: 'alipay',
      })
      .select()
      .single();

    if (error) {
      console.error('[创建订单] 失败:', error);
      return NextResponse.json(
        { error: '创建订单失败' },
        { status: 500 }
      );
    }

    console.log(`[创建订单] 支付宝订单创建成功: ${orderNo}, 套餐: ${plan.name}, 金额: ¥${plan.price}`);

    // 获取域名
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const notifyUrl = `${domain}/api/payment/notify`;
    const returnUrl = `${domain}/payment/success?orderNo=${orderNo}`;

    // 检查支付宝配置
    if (isAlipayConfigured()) {
      // 生成支付宝支付链接
      const paymentUrl = payType === 'page'
        ? createAlipayPageUrl({
            orderId: orderNo,
            subject: `AI短剧生成器 - ${plan.name}`,
            amount: plan.price,
            notifyUrl,
            returnUrl,
          })
        : createAlipayWapUrl({
            orderId: orderNo,
            subject: `AI短剧生成器 - ${plan.name}`,
            amount: plan.price,
            notifyUrl,
            returnUrl,
          });

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNo: order.order_no,
          planType: planType,
          planName: plan.name,
          amount: plan.price,
          durationDays: plan.durationDays,
          description: plan.description,
          status: order.status,
          createdAt: order.created_at,
        },
        paymentUrl,
        paymentMethod: 'alipay',
        qrPayMode: payType === 'page' ? '2' : undefined, // 电脑网页支付显示二维码
      });
    } else {
      // 未配置支付宝，返回模拟支付模式
      console.log('[创建订单] 支付宝未配置，使用模拟支付模式');
      
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNo: order.order_no,
          planType: planType,
          planName: plan.name,
          amount: plan.price,
          durationDays: plan.durationDays,
          description: plan.description,
          status: order.status,
          createdAt: order.created_at,
        },
        paymentUrl: `/payment/pay?orderNo=${orderNo}`,
        paymentMethod: 'mock',
        message: '支付功能正在配置中，请联系管理员购买卡密',
        // 提供管理员联系方式或收款二维码
        adminContact: process.env.ADMIN_CONTACT || '请联系管理员',
      });
    }

  } catch (error) {
    console.error('[创建订单] 处理请求失败:', error);
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment/create-order
 * 获取套餐配置和支付状态
 */
export async function GET() {
  const alipayConfigured = isAlipayConfigured();

  return NextResponse.json({
    plans: Object.entries(PLAN_CONFIG).map(([key, value]) => ({
      type: key,
      name: value.name,
      price: value.price,
      durationDays: value.durationDays,
      description: value.description,
    })),
    paymentMethod: alipayConfigured ? 'alipay' : 'mock',
    alipayConfigured,
    message: alipayConfigured 
      ? '已接入支付宝支付' 
      : '支付功能正在配置中，请联系管理员购买卡密',
  });
}
