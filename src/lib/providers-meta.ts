/**
 * 模型厂商元数据与密钥校验（服务端共用）
 *
 * 支持：zhipu / qwen / volcengine / minimax / moonshot / deepseek / wenxin / hunyuan / nvidia / custom
 * 每条配置包含：存储字段、默认 Base URL、用于连通性验证的模型与路径
 */
import { describeProviderStatus } from '@/lib/provider-errors';

export interface ProviderMeta {
  name: string;
  defaultBaseUrl: string;
  validationModel: string;
  validationPath: string;
  keyField: string;
  keySetAtField: string;
  baseUrlField: string;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
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

/** 环境变量兜底密钥（用户未保存时生效） */
export const ENV_PROVIDER_KEYS: Record<string, string | undefined> = {
  nvidia: process.env.NVIDIA_API_KEY,
};

export const ENV_PROVIDER_BASE_URLS: Record<string, string | undefined> = {
  nvidia: process.env.NVIDIA_BASE_URL,
};

/** 掩码 API Key，只显示前 4 位和后 4 位 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '****';
  return `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 8, 20))}${apiKey.slice(-4)}`;
}

/** 生效的 Base URL：用户保存 > 环境变量 > 默认值 */
export function resolveBaseUrl(
  row: Record<string, unknown> | null | undefined,
  providerId: string,
  meta: ProviderMeta
): string {
  const stored = row?.[meta.baseUrlField];
  if (typeof stored === 'string' && stored) return stored;
  return ENV_PROVIDER_BASE_URLS[providerId] || meta.defaultBaseUrl;
}

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
  latency?: number;
}

/**
 * 校验出站请求地址，阻断云元数据等敏感地址，避免自定义 Base URL 被用于 SSRF
 * 返回 null 表示可访问，否则返回错误说明
 */
export function checkOutboundUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Base URL 格式不正确';
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return '仅支持 http / https 地址';
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blockedHosts = ['metadata.google.internal', 'metadata', '0.0.0.0', '100.100.100.200'];
  if (blockedHosts.includes(host) || host.startsWith('169.254.')) {
    return '该地址不允许访问';
  }
  return null;
}

/**
 * 调用厂商接口校验密钥可用性
 * 自定义厂商协议可能不是 OpenAI 兼容格式，由调用方决定是否跳过校验
 */
export async function validateProviderKey(
  apiKey: string,
  baseUrl: string,
  model: string,
  path: string,
  skipValidation: boolean = false
): Promise<KeyValidationResult> {
  if (skipValidation || !baseUrl || !model) {
    return { valid: true };
  }

  const blocked = checkOutboundUrl(baseUrl);
  if (blocked) {
    return { valid: false, error: blocked };
  }

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - startedAt;

    if (response.ok) {
      return { valid: true, latency };
    }

    const body = await response.json().catch(() => ({} as Record<string, unknown>));
    const errObj = (body.error || body) as { message?: string };
    const detail = typeof errObj?.message === 'string' ? errObj.message.slice(0, 120) : '';
    const hint = describeProviderStatus(response.status);

    return {
      valid: false,
      latency,
      error: detail ? `${hint}（${detail}）` : hint,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: '验证超时，请检查网络或稍后重试' };
    }
    return { valid: false, error: '网络错误，请检查 Base URL 和网络连接' };
  }
}
