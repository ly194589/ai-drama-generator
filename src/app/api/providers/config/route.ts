import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, getLocalUserConfig, saveLocalUserConfig } from '@/lib/server-config-store';
import {
  PROVIDER_META,
  ENV_PROVIDER_KEYS,
  maskApiKey,
  resolveBaseUrl,
  validateProviderKey,
  checkOutboundUrl,
} from '@/lib/providers-meta';
import { decryptSecret, encryptSecret } from '@/lib/secret-crypto';

/**
 * 通用 AI 提供商配置管理 API
 *
 * 支持提供商：zhipu / qwen / volcengine / minimax / moonshot / deepseek / wenxin / hunyuan / nvidia / custom
 * 每个提供商支持：API Key + 自定义 Base URL（协议端点）
 * Key 加密落库（AES-256-GCM），读取时自动解密，接口只返回掩码
 *
 * GET  /api/providers/config             获取所有提供商配置状态
 * GET  /api/providers/config?provider=x  获取指定提供商配置状态
 * POST /api/providers/config             保存提供商配置 { provider, apiKey, baseUrl? }
 * DELETE /api/providers/config?provider=x 删除提供商配置
 */

/** 取生效密钥：用户保存的优先，其次环境变量；存储值自动解密 */
function getEffectiveKey(
  row: Record<string, unknown> | null | undefined,
  providerId: string,
  keyField: string
): string | undefined {
  const stored = decryptSecret(typeof row?.[keyField] === 'string' ? (row?.[keyField] as string) : undefined);
  if (stored) return stored;
  return ENV_PROVIDER_KEYS[providerId] || undefined;
}

/** 获取用户的提供商配置记录 */
async function getUserConfigRow(supabase: ReturnType<typeof getSupabaseClient>, userId: string) {
  const { data, error } = await supabase
    .from('user_config')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('[提供商配置] 查询失败:', error);
  }
  return data;
}

/** 写入用户配置（数据库或本地兜底） */
async function writeUserConfig(userId: string, patch: Record<string, unknown>): Promise<string | null> {
  const updateData: Record<string, unknown> = {
    ...patch,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (!hasDatabaseConfig()) {
    saveLocalUserConfig(userId, updateData);
    return null;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('user_config')
    .upsert(updateData, { onConflict: 'user_id' });

  return error ? error.message : null;
}

/**
 * GET: 获取提供商配置状态
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const providerParam = request.nextUrl.searchParams.get('provider');

    // 未配置数据库时使用本地文件兜底存储
    const row: Record<string, unknown> | null = hasDatabaseConfig()
      ? await getUserConfigRow(getSupabaseClient(), userId)
      : getLocalUserConfig(userId);

    if (providerParam) {
      const meta = PROVIDER_META[providerParam];
      if (!meta) {
        return NextResponse.json({ error: '未知的提供商' }, { status: 400 });
      }
      const effectiveKey = getEffectiveKey(row, providerParam, meta.keyField);
      const hasKey = !!effectiveKey;
      return NextResponse.json({
        configured: hasKey,
        maskedApiKey: hasKey ? maskApiKey(effectiveKey as string) : null,
        baseUrl: resolveBaseUrl(row, providerParam, meta),
        defaultBaseUrl: meta.defaultBaseUrl,
        name: meta.name,
        setAt: (row?.[meta.keySetAtField as keyof typeof row] as string) || null,
      });
    }

    // 返回全部提供商
    const providers: Record<string, unknown> = {};
    for (const [id, meta] of Object.entries(PROVIDER_META)) {
      const effectiveKey = getEffectiveKey(row, id, meta.keyField);
      const hasKey = !!effectiveKey;
      providers[id] = {
        configured: hasKey,
        maskedApiKey: hasKey ? maskApiKey(effectiveKey as string) : null,
        baseUrl: resolveBaseUrl(row, id, meta),
        defaultBaseUrl: meta.defaultBaseUrl,
        name: meta.name,
      };
    }

    return NextResponse.json({ success: true, providers });
  } catch (error) {
    console.error('[提供商配置] 获取状态失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

/**
 * POST: 保存并验证提供商配置
 */
export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, baseUrl, skipValidation } = await request.json();

    const meta = PROVIDER_META[provider];
    if (!meta) {
      return NextResponse.json({ error: '未知的提供商' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }

    const effectiveBaseUrl = (baseUrl && baseUrl.trim()) || meta.defaultBaseUrl;

    if (effectiveBaseUrl) {
      const blocked = checkOutboundUrl(effectiveBaseUrl);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 400 });
      }
    }

    const validation = await validateProviderKey(
      apiKey,
      effectiveBaseUrl,
      meta.validationModel,
      meta.validationPath,
      skipValidation === true || provider === 'custom'
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: `API Key 验证失败：${validation.error}` },
        { status: 400 }
      );
    }

    const userId = request.headers.get('x-user-id') || 'dev-user';
    const now = new Date().toISOString();
    const saveError = await writeUserConfig(userId, {
      [meta.keyField]: encryptSecret(apiKey),
      [meta.keySetAtField]: now,
      // baseURL：用户填了就存，没填就存 null（使用默认值）
      [meta.baseUrlField]: (baseUrl && baseUrl.trim()) || null,
    });

    if (saveError) {
      console.error('[提供商配置] 保存失败:', saveError);
      return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
    }

    console.log(`[提供商配置] ${meta.name} API Key 已保存: ${maskApiKey(apiKey)}`);

    return NextResponse.json({
      success: true,
      message: `${meta.name} API Key 配置成功`,
      maskedApiKey: maskApiKey(apiKey),
    });
  } catch (error) {
    console.error('[提供商配置] 保存失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

/**
 * DELETE: 删除提供商配置
 */
export async function DELETE(request: NextRequest) {
  try {
    const providerParam = request.nextUrl.searchParams.get('provider');
    const meta = providerParam ? PROVIDER_META[providerParam] : null;
    if (!meta) {
      return NextResponse.json({ error: '未知的提供商' }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id') || 'dev-user';
    const saveError = await writeUserConfig(userId, {
      [meta.keyField]: null,
      [meta.keySetAtField]: null,
      [meta.baseUrlField]: null,
    });

    if (saveError) {
      console.error('[提供商配置] 删除失败:', saveError);
      return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `${meta.name} 配置已删除` });
  } catch (error) {
    console.error('[提供商配置] 删除失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
