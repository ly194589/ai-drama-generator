import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyAlipayNotify, generateCardKey } from '@/lib/alipay';

/**
 * POST /api/payment/notify
 * 支付宝异步通知回调
 * 
 * 支付宝会在支付成功后调用此接口
 * 需要验证签名确保请求来自支付宝
 */
export async function POST(request: NextRequest) {
  try {
    // 解析表单数据（支付宝使用 application/x-www-form-urlencoded）
    const formData = await request.formData();
    const params: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      // 解码 URL 编码的值
      const decodedKey = decodeURIComponent(key);
      const decodedValue = decodeURIComponent(value.toString());
      params[decodedKey] = decodedValue;
    });

    console.log('[支付回调] 收到通知:');
    console.log('  - out_trade_no:', params.out_trade_no);
    console.log('  - trade_status:', params.trade_status);
    console.log('  - trade_no:', params.trade_no);
    console.log('  - total_amount:', params.total_amount);
    console.log('  - sign_type:', params.sign_type);

    const orderNo = params.out_trade_no;
    const tradeStatus = params.trade_status;
    const tradeNo = params.trade_no;

    // 验证签名
    const signValid = verifyAlipayNotify(params);
    console.log('[支付回调] 签名验证结果:', signValid);
    
    // 生产环境必须验签
    const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
    if (!signValid && isProd) {
      console.error('[支付回调] 签名验证失败（生产环境）');
      return new NextResponse('fail', { status: 400 });
    }
    
    // 开发环境或验签通过，继续处理
    if (!signValid && !isProd) {
      console.warn('[支付回调] 签名验证失败，但开发环境继续处理');
    }

    // 查询订单
    const supabase = getSupabaseClient();
    const { data: order, error: queryError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (queryError || !order) {
      console.error('[支付回调] 订单不存在:', orderNo);
      return new NextResponse('fail', { status: 400 });
    }

    // 检查订单状态
    if (order.status === 'paid') {
      console.log('[支付回调] 订单已处理过:', orderNo);
      return new NextResponse('success');
    }

    // 检查交易状态
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 支付成功
      const now = new Date();

      // 生成卡密
      const cardKey = generateCardKey();

      // 更新订单状态
      const { error: updateOrderError } = await supabase
        .from('payment_orders')
        .update({
          status: 'paid',
          card_key: cardKey,
          paid_at: now.toISOString(),
          updated_at: now.toISOString(),
          metadata: {
            trade_no: tradeNo,
            buyer_id: params.buyer_id,
            buyer_logon_id: params.buyer_logon_id,
            total_amount: params.total_amount,
            receipt_amount: params.receipt_amount,
          },
        })
        .eq('id', order.id);

      if (updateOrderError) {
        console.error('[支付回调] 更新订单失败:', updateOrderError);
        return new NextResponse('fail', { status: 500 });
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
        console.error('[支付回调] 创建卡密失败:', createCardError);
        // 订单已更新，卡密创建失败不影响支付结果
      }

      console.log(`[支付回调] 支付成功: 订单=${orderNo}, 卡密=${cardKey}, 交易号=${tradeNo}`);

      return new NextResponse('success');
    } else {
      // 其他状态（如 WAIT_BUYER_PAY）
      console.log('[支付回调] 交易状态:', tradeStatus);
      return new NextResponse('success');
    }

  } catch (error) {
    console.error('[支付回调] 处理失败:', error);
    return new NextResponse('fail', { status: 500 });
  }
}

/**
 * GET /api/payment/notify
 * 模拟支付成功（开发测试用）
 */
export async function GET(request: NextRequest) {
  // 仅在开发环境启用
  if (process.env.COZE_PROJECT_ENV === 'PROD') {
    return NextResponse.json({ error: '禁止访问' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const orderNo = searchParams.get('orderNo');

  if (!orderNo) {
    return NextResponse.json({ error: '缺少订单号' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();

    // 查询订单
    const { data: order, error: queryError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (queryError || !order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    if (order.status === 'paid') {
      return NextResponse.json({ 
        success: true, 
        message: '订单已支付',
        cardKey: order.card_key,
      });
    }

    // 生成卡密
    const cardKey = generateCardKey();
    const now = new Date();

    // 更新订单
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
      return NextResponse.json({ error: '更新订单失败' }, { status: 500 });
    }

    // 创建卡密
    await supabase
      .from('card_keys')
      .insert({
        card_key: cardKey,
        status: 'unused',
        plan_type: order.plan_type,
        price: order.amount,
        duration_days: order.duration_days,
        order_id: order.order_no,
      });

    console.log(`[模拟支付] 支付成功: 订单=${orderNo}, 卡密=${cardKey}`);

    return NextResponse.json({
      success: true,
      message: '模拟支付成功',
      cardKey,
      expiresAt: new Date(now.getTime() + order.duration_days * 24 * 60 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error('[模拟支付] 失败:', error);
    return NextResponse.json({ error: '处理失败' }, { status: 500 });
  }
}
