import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/payment/verify-keys
 * 验证支付宝密钥配置是否正确
 * 
 * 注意：此接口仅用于调试，生产环境应删除或限制访问
 */
export async function GET() {
  const appId = process.env.ALIPAY_APPID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const publicKey = process.env.ALIPAY_PUBLIC_KEY;

  // 检查基本配置
  const configStatus = {
    appId: appId ? `${appId.substring(0, 6)}...` : '未配置',
    privateKey: privateKey ? `${privateKey.length} 字符` : '未配置',
    publicKey: publicKey ? `${publicKey.length} 字符` : '未配置',
  };

  if (!privateKey) {
    return NextResponse.json({
      status: 'error',
      message: '支付宝私钥未配置',
      config: configStatus,
      help: '请在扣子平台配置 ALIPAY_PRIVATE_KEY 环境变量',
    });
  }

  // 测试签名
  const testContent = 'app_id=test&method=alipay.trade.wap.pay';
  let signResult: { success: boolean; error?: string } = { success: false };

  try {
    // 尝试 PKCS#1 格式
    let formattedKey = privateKey.includes('-----BEGIN')
      ? privateKey
      : `-----BEGIN RSA PRIVATE KEY-----\n${privateKey.trim()}\n-----END RSA PRIVATE KEY-----`;

    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(testContent, 'utf8');
      sign.sign(formattedKey, 'base64');
      signResult = { success: true };
    } catch {
      // 尝试 PKCS#8 格式
      formattedKey = privateKey.includes('-----BEGIN')
        ? privateKey
        : `-----BEGIN PRIVATE KEY-----\n${privateKey.trim()}\n-----END PRIVATE KEY-----`;

      try {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(testContent, 'utf8');
        sign.sign(formattedKey, 'base64');
        signResult = { success: true };
      } catch (pkcs8Error: unknown) {
        signResult = { 
          success: false, 
          error: `PKCS#1 和 PKCS#8 格式都失败` 
        };
      }
    }
  } catch (error: unknown) {
    signResult = { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }

  // 检查私钥格式
  const keyFormat = {
    hasHeader: privateKey.includes('-----BEGIN'),
    isPKCS1: privateKey.includes('RSA PRIVATE KEY'),
    isPKCS8: privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.includes('RSA'),
    firstLine: privateKey.split('\n')[0]?.substring(0, 30) || '',
  };

  // 诊断结果
  const diagnostics: string[] = [];
  
  if (!appId) {
    diagnostics.push('❌ ALIPAY_APPID 未配置');
  } else {
    diagnostics.push('✅ ALIPAY_APPID 已配置');
  }

  if (!privateKey) {
    diagnostics.push('❌ ALIPAY_PRIVATE_KEY 未配置');
  } else if (!signResult.success) {
    diagnostics.push('❌ ALIPAY_PRIVATE_KEY 格式错误，无法用于签名');
  } else {
    diagnostics.push('✅ ALIPAY_PRIVATE_KEY 格式正确，可用于签名');
  }

  if (!publicKey) {
    diagnostics.push('⚠️ ALIPAY_PUBLIC_KEY 未配置（回调验签将失败）');
  } else {
    diagnostics.push('✅ ALIPAY_PUBLIC_KEY 已配置');
  }

  // 常见问题排查
  const commonIssues: string[] = [];
  
  if (privateKey && !signResult.success) {
    commonIssues.push('私钥可能不是有效的 RSA 私钥');
    commonIssues.push('请确认私钥是支付宝密钥生成工具生成的');
  }
  
  if (privateKey && signResult.success) {
    commonIssues.push('如果支付时出现 invalid-signature 错误，请检查：');
    commonIssues.push('1. 支付宝开放平台配置的应用公钥是否与本私钥匹配');
    commonIssues.push('2. 是否配置了正确的应用（沙箱/正式环境）');
    commonIssues.push('3. 密钥是否是最近重新生成的（旧密钥可能已失效）');
  }

  return NextResponse.json({
    status: signResult.success ? 'ok' : 'error',
    message: signResult.success 
      ? '密钥配置正确，可以发起支付'
      : '密钥配置有问题，请检查',
    config: configStatus,
    keyFormat,
    signTest: signResult,
    diagnostics,
    commonIssues,
    help: {
      step1: '在支付宝开放平台创建应用并获取 APPID',
      step2: '使用支付宝密钥生成工具生成 RSA2 密钥对',
      step3: '将应用公钥上传到支付宝开放平台',
      step4: '将应用私钥配置到扣子平台的 ALIPAY_PRIVATE_KEY 环境变量',
      step5: '将支付宝公钥配置到扣子平台的 ALIPAY_PUBLIC_KEY 环境变量',
    },
  });
}
