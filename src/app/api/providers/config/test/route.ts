import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, getLocalUserConfig } from '@/lib/server-config-store';
import { PROVIDER_META, ENV_PROVIDER_KEYS, resolveBaseUrl, validateProviderKey } from '@/lib/providers-meta';
import { decryptSecret } from '@/lib/secret-crypto';

/**
 * 已保存密钥的连通性测试
 *
 * POST /api/providers/config/test  { provider: string }
 * - 使用已保存（或环境变量兜底）的密钥发起一次最小请求
 * - 不返回任何密钥内容，只返回是否可用、耗时与错误建议
 */
export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();
    const meta = PROVIDER_META[provider];
    if (!meta) {
      return NextResponse.json({ error: '未知的提供商' }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id') || 'dev-user';
    let row: Record<string, unknown> | null = null;
    if (hasDatabaseConfig()) {
      const { data } = await getSupabaseClient()
        .from('user_config')
        .select('*')
        .eq('user_id', userId)
        .single();
      row = (data as unknown as Record<string, unknown>) || null;
    } else {
      row = getLocalUserConfig(userId);
    }

    const stored = typeof row?.[meta.keyField] === 'string' ? (row?.[meta.keyField] as string) : undefined;
    const apiKey = decryptSecret(stored) || ENV_PROVIDER_KEYS[provider] || '';
    if (!apiKey) {
      return NextResponse.json({ success: false, error: `${meta.name} 尚未配置 API Key` }, { status: 400 });
    }

    const baseUrl = resolveBaseUrl(row, provider, meta);
    const result = await validateProviderKey(
      apiKey,
      baseUrl,
      meta.validationModel,
      meta.validationPath,
      // 自定义厂商也做一次真实连通性测试，仅跳过「协议不兼容」的提前返回
      false
    );

    return NextResponse.json({
      success: result.valid,
      provider,
      name: meta.name,
      latency: result.latency ?? null,
      baseUrl,
      message: result.valid
        ? `${meta.name} 连接正常${result.latency ? `，耗时 ${result.latency}ms` : ''}`
        : result.error,
    });
  } catch (error) {
    console.error('[提供商配置] 连通性测试失败:', error);
    return NextResponse.json({ success: false, error: '测试失败，请稍后重试' }, { status: 500 });
  }
}
