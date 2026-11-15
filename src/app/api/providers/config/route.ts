import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, getLocalUserConfig, saveLocalUserConfig } from '@/lib/server-config-store';

/**
 * 通用 AI 提供商配置管理 API
 *
 * 支持提供商：zhipu / qwen / volcengine / minimax / moonshot / deepseek / wenxin / hunyuan / custom
 * 每个提供商支持：API Key + 自定义 Base URL（协议端点）
 *
 * GET  /api/providers/config           获取所有提供商配置状态
 * GET  /api/providers/config?provider=x 获取指定提供商配置状态
 * POST /api/providers/config           保存提供商配置 { provider, apiKey, baseUrl? }
 * DELETE /api/providers/config?provider=x 删除提供商配置
 */

// 提供商元数据定义
const PROVIDER_META: Record<string, {
  name: string;
  defaultBaseUrl: string;
  validationModel: string;
  validationPath: string;
  keyField: string;
  keySetAtField: string;
  baseUrlField: string;
}> = {
  zhipu: {
    name: '智谱 AI',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    validationModel: 'glm-4-flash',
    validationPath: '/chat/completions',
    keyField: 'zhipu_api_key',
    keySetAtField: 'zhipu_api_key_set_at',
    baseUrlField: 'zhipu_base_url',
  },
  qwen: {
    name: '千问（阿里百炼）',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    validationModel: 'qwen-turbo',
    validationPath: '/chat/completions',
    keyField: 'qwen_api_key',
    keySetAtField: 'qwen_api_key_set_at',
    baseUrlField: 'qwen_base_url',
  },
  volcengine: {
    name: '火山引擎（豆包）',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    validationModel: 'doubao-seed-1-6-250615',
    validationPath: '/chat/completions',
    keyField: 'volcengine_api_key',
    keySetAtField: 'volcengine_api_key_set_at',
    baseUrlField: 'volcengine_base_url',
  },
  minimax: {
    name: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    validationModel: 'MiniMax-M3',
    validationPath: '/chat/completions',
    keyField: 'minimax_api_key',
    keySetAtField: 'minimax_api_key_set_at',
    baseUrlField: 'minimax_base_url',
  },
  moonshot: {
    name: '月之暗面（Kimi）',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    validationModel: 'moonshot-v1-8k',
    validationPath: '/chat/completions',
    keyField: 'moonshot_api_key',
    keySetAtField: 'moonshot_api_key_set_at',
    baseUrlField: 'moonshot_base_url',
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    validationModel: 'deepseek-chat',
    validationPath: '/chat/completions',
    keyField: 'deepseek_api_key',
    keySetAtField: 'deepseek_api_key_set_at',
    baseUrlField: 'deepseek_base_url',
  },
  wenxin: {
    name: '百度文心',
    defaultBaseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    validationModel: 'ernie-4.0-8k-latest',
    validationPath: '/completions',
    keyField: 'wenxin_api_key',
    keySetAtField: 'wenxin_api_key_set_at',
    baseUrlField: 'wenxin_base_url',
  },
  hunyuan: {
    name: '腾讯混元',
    defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    validationModel: 'hunyuan-turbo',
    validationPath: '/chat/completions',
    keyField: 'hunyuan_api_key',
    keySetAtField: 'hunyuan_api_key_set_at',
    baseUrlField: 'hunyuan_base_url',
  },
  nvidia: {
    name: 'NVIDIA',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    validationModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    validationPath: '/chat/completions',
    keyField: 'nvidia_api_key',
    keySetAtField: 'nvidia_api_key_set_at',
    baseUrlField: 'nvidia_base_url',
  },
  custom: {
    name: '自定义提供商',
    defaultBaseUrl: '',
    validationModel: '',
    validationPath: '/chat/completions',
    keyField: 'custom_api_key',
    keySetAtField: 'custom_api_key_set_at',
    baseUrlField: 'custom_base_url',
  },
};

// 掩码 API Key，只显示前4位和后4位
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '****';
  return `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 8, 20))}${apiKey.slice(-4)}`;
}

// 环境变量兜底密钥（.env），用户未保存密钥时生效（如 NVIDIA_API_KEY）
const ENV_PROVIDER_KEYS: Record<string, string | undefined> = {
  nvidia: process.env.NVIDIA_API_KEY,
};

/** 取生效密钥：用户保存的优先，其次环境变量 */
function getEffectiveKey(
  row: Record<string, unknown> | null | undefined,
  providerId: string,
  keyField: string
): string | undefined {
  const stored = row?.[keyField];
  if (typeof stored === 'string' && stored) return stored;
  return ENV_PROVIDER_KEYS[providerId] || undefined;
}

/** 取生效 Base URL：用户保存的优先，其次环境变量，最后默认值 */
function getEffectiveBaseUrl(
  row: Record<string, unknown> | null | undefined,
  providerId: string,
  baseUrlField: string,
  defaultBaseUrl: string
): string {
  const stored = row?.[baseUrlField];
  if (typeof stored === 'string' && stored) return stored;
  if (providerId === 'nvidia' && process.env.NVIDIA_BASE_URL) return process.env.NVIDIA_BASE_URL;
  return defaultBaseUrl;
}

// 验证 API Key 是否有效（调用 OpenAI 兼容接口）
async function validateApiKey(
  apiKey: string,
  baseUrl: string,
  model: string,
  path: string,
  skipValidation: boolean = false
): Promise<{ valid: boolean; error?: string }> {
  // 自定义提供商跳过验证（协议可能不是 OpenAI 兼容格式）
  if (skipValidation || !baseUrl || !model) {
    return { valid: true };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json().catch(() => ({} as Record<string, unknown>));
    const errObj = (error.error || error) as { message?: string };
    const errorMessage = errObj?.message || `HTTP ${response.status}`;

    return { valid: false, error: errorMessage };
  } catch (error) {
    // 网络超时等错误 - 保存但不拦截（部分厂商网络在国内可能受限）
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: '验证超时，请检查网络或稍后重试' };
    }
    return { valid: false, error: '网络错误，请检查 Base URL 和网络连接' };
  }
}

// 获取用户的提供商配置记录
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
      // 返回单个提供商
      const meta = PROVIDER_META[providerParam];
      if (!meta) {
        return NextResponse.json({ error: '未知的提供商' }, { status: 400 });
      }
      const effectiveKey = getEffectiveKey(row, providerParam, meta.keyField);
      const hasKey = !!effectiveKey;
      return NextResponse.json({
        configured: hasKey,
        maskedApiKey: hasKey ? maskApiKey(effectiveKey as string) : null,
        baseUrl: getEffectiveBaseUrl(row, providerParam, meta.baseUrlField, meta.defaultBaseUrl),
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
        baseUrl: getEffectiveBaseUrl(row, id, meta.baseUrlField, meta.defaultBaseUrl),
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

    // 验证 API Key 是否有效
    const validation = await validateApiKey(
      apiKey,
      effectiveBaseUrl,
      meta.validationModel,
      meta.validationPath,
      skipValidation === true || provider === 'custom'
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: `API Key 验证失败: ${validation.error}` },
        { status: 400 }
      );
    }

    const userId = request.headers.get('x-user-id') || 'dev-user';

    // 构建更新对象
    const updateData: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    updateData[meta.keyField] = apiKey;
    updateData[meta.keySetAtField] = new Date().toISOString();
    // baseURL：用户填了就存，没填就存 null（使用默认值）
    updateData[meta.baseUrlField] = (baseUrl && baseUrl.trim()) || null;

    if (!hasDatabaseConfig()) {
      // 未配置数据库：写入本地文件兜底存储
      saveLocalUserConfig(userId, updateData);
    } else {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_config')
        .upsert(updateData, { onConflict: 'user_id' });

      if (error) {
        console.error('[提供商配置] 保存失败:', error);
        return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
      }
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

    const updateData: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    updateData[meta.keyField] = null;
    updateData[meta.keySetAtField] = null;
    updateData[meta.baseUrlField] = null;

    if (!hasDatabaseConfig()) {
      // 未配置数据库：写入本地文件兜底存储
      saveLocalUserConfig(userId, updateData);
    } else {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_config')
        .upsert(updateData, { onConflict: 'user_id' });

      if (error) {
        console.error('[提供商配置] 删除失败:', error);
        return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: `${meta.name} 配置已删除` });

  } catch (error) {
    console.error('[提供商配置] 删除失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
