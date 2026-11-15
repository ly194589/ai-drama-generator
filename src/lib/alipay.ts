import crypto from 'crypto';

/**
 * 支付宝支付工具类
 * 
 * 支持两种模式：
 * 1. 支付宝官方API（需要企业/个体户资质）
 *    - 配置 ALIPAY_APPID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY
 * 2. 模拟支付（开发测试/手动收款）
 *    - 未配置以上环境变量时自动降级
 */

// 支付宝网关地址
const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';

/**
 * 检查支付宝配置是否完整
 */
export function isAlipayConfigured(): boolean {
  return !!(
    process.env.ALIPAY_APPID &&
    process.env.ALIPAY_PRIVATE_KEY
  );
}

/**
 * RSA签名 - 支持多种私钥格式
 */
export function rsaSign(content: string, privateKey: string): string {
  // 去除空白字符
  let cleanKey = privateKey.trim();
  
  // 如果私钥已经包含 PEM 头尾，直接使用
  if (cleanKey.includes('-----BEGIN')) {
    // 已有格式，直接使用
  } else {
    // 没有头尾，尝试两种格式
    // 先尝试 PKCS#1 格式（支付宝默认格式）
    cleanKey = `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey}\n-----END RSA PRIVATE KEY-----`;
  }

  try {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(content, 'utf8');
    return sign.sign(cleanKey, 'base64');
  } catch (error: unknown) {
    // 如果 PKCS#1 格式失败，尝试 PKCS#8 格式
    if (!privateKey.includes('-----BEGIN')) {
      const pkcs8Key = `-----BEGIN PRIVATE KEY-----\n${privateKey.trim()}\n-----END PRIVATE KEY-----`;
      try {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(content, 'utf8');
        return sign.sign(pkcs8Key, 'base64');
      } catch {
        // 两种格式都失败
      }
    }
    console.error('[支付宝签名] 签名失败:', error);
    throw new Error('私钥格式错误，请检查 ALIPAY_PRIVATE_KEY 配置');
  }
}

/**
 * RSA验签
 */
export function rsaVerify(content: string, sign: string, publicKey: string): boolean {
  try {
    const formattedKey = publicKey.includes('-----BEGIN')
      ? publicKey
      : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(content, 'utf8');
    return verify.verify(formattedKey, sign, 'base64');
  } catch {
    return false;
  }
}

/**
 * 生成支付宝支付链接（手机网站支付）
 * 
 * @param options 支付参数
 * @returns 支付链接
 */
export function createAlipayWapUrl(options: {
  orderId: string;
  subject: string;
  amount: number;
  notifyUrl: string;
  returnUrl: string;
}): string {
  const { orderId, subject, amount, notifyUrl, returnUrl } = options;

  const appId = process.env.ALIPAY_APPID!;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY!;

  // 公共请求参数
  const commonParams: Record<string, string> = {
    app_id: appId,
    method: 'alipay.trade.wap.pay',
    format: 'JSON',
    return_url: returnUrl,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    version: '1.0',
    notify_url: notifyUrl,
  };

  // 业务参数
  const bizContent = {
    out_trade_no: orderId,
    total_amount: amount.toFixed(2),
    subject: subject,
    product_code: 'QUICK_WAP_WAY',
  };

  // 构建待签名字符串
  const allParams: Record<string, string> = {
    ...commonParams,
    biz_content: JSON.stringify(bizContent),
  };

  const signContent = Object.keys(allParams)
    .sort()
    .map(key => `${key}=${allParams[key]}`)
    .join('&');

  // 签名
  const sign = rsaSign(signContent, privateKey);

  // 构建最终URL
  const encodedParams = Object.entries(allParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `${ALIPAY_GATEWAY}?${encodedParams}&sign=${encodeURIComponent(sign)}`;
}

/**
 * 生成支付宝支付链接（电脑网站支付）
 */
export function createAlipayPageUrl(options: {
  orderId: string;
  subject: string;
  amount: number;
  notifyUrl: string;
  returnUrl: string;
}): string {
  const { orderId, subject, amount, notifyUrl, returnUrl } = options;

  const appId = process.env.ALIPAY_APPID!;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY!;

  // 公共请求参数
  const commonParams: Record<string, string> = {
    app_id: appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    return_url: returnUrl,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    version: '1.0',
    notify_url: notifyUrl,
  };

  // 业务参数
  const bizContent = {
    out_trade_no: orderId,
    total_amount: amount.toFixed(2),
    subject: subject,
    product_code: 'FAST_INSTANT_TRADE_PAY',
  };

  // 构建待签名字符串
  const allParams: Record<string, string> = {
    ...commonParams,
    biz_content: JSON.stringify(bizContent),
  };

  const signContent = Object.keys(allParams)
    .sort()
    .map(key => `${key}=${allParams[key]}`)
    .join('&');

  // 签名
  const sign = rsaSign(signContent, privateKey);

  // 构建最终URL
  const encodedParams = Object.entries(allParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `${ALIPAY_GATEWAY}?${encodedParams}&sign=${encodeURIComponent(sign)}`;
}

/**
 * 验证支付宝回调签名
 */
export function verifyAlipayNotify(params: Record<string, string>): boolean {
  const sign = params.sign;
  const signType = params.sign_type || 'RSA2';
  
  if (!sign) {
    console.error('[支付宝验签] sign 参数不存在');
    return false;
  }

  // 移除sign和sign_type
  const { sign: _, sign_type: __, ...dataToVerify } = params;

  // 构建待验证字符串
  const content = Object.keys(dataToVerify)
    .sort()
    .map(key => `${key}=${dataToVerify[key]}`)
    .join('&');

  console.log('[支付宝验签] sign_type:', signType);

  // 使用支付宝公钥验证
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!alipayPublicKey) {
    console.error('[支付宝] 未配置ALIPAY_PUBLIC_KEY，无法验证回调');
    return false;
  }

  const result = rsaVerify(content, sign, alipayPublicKey);
  console.log('[支付宝验签] 验证结果:', result);
  return result;
}

/**
 * 生成卡密
 */
export function generateCardKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments: string[] = [];
  
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return segments.join('-');
}
