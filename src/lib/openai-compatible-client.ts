/**
 * OpenAI 兼容协议统一客户端
 *
 * 支持火山引擎(方舟) / MiniMax / 月之暗面(Kimi) / DeepSeek / 百度文心 / 腾讯混元 / 自定义端点
 * 统一走 OpenAI 兼容协议 /chat/completions，密钥与端点均从 user_config 读取
 */

export type CompatibleProvider =
  | 'volcengine'
  | 'minimax'
  | 'moonshot'
  | 'deepseek'
  | 'wenxin'
  | 'hunyuan'
  | 'custom';

export interface CompatibleProviderMeta {
  name: string;
  keyField: string;
  baseUrlField: string;
  defaultBaseUrl: string;
}

export const COMPATIBLE_PROVIDERS: Record<CompatibleProvider, CompatibleProviderMeta> = {
  volcengine: {
    name: '火山引擎',
    keyField: 'volcengine_api_key',
    baseUrlField: 'volcengine_base_url',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  minimax: {
    name: 'MiniMax',
    keyField: 'minimax_api_key',
    baseUrlField: 'minimax_base_url',
    defaultBaseUrl: 'https://api.minimaxi.com/v1',
  },
  moonshot: {
    name: '月之暗面',
    keyField: 'moonshot_api_key',
    baseUrlField: 'moonshot_base_url',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  deepseek: {
    name: 'DeepSeek',
    keyField: 'deepseek_api_key',
    baseUrlField: 'deepseek_base_url',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
  },
  wenxin: {
    name: '百度文心',
    keyField: 'wenxin_api_key',
    baseUrlField: 'wenxin_base_url',
    defaultBaseUrl: 'https://aip.baidubce.com/v2',
  },
  hunyuan: {
    name: '腾讯混元',
    keyField: 'hunyuan_api_key',
    baseUrlField: 'hunyuan_base_url',
    defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
  },
  custom: {
    name: '自定义',
    keyField: 'custom_api_key',
    baseUrlField: 'custom_base_url',
    defaultBaseUrl: '',
  },
};

export function isCompatibleProvider(provider: string): provider is CompatibleProvider {
  return provider in COMPATIBLE_PROVIDERS;
}

export interface CompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompatibleChatConfig {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface CompatibleChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CompatibleStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export interface ProviderConfigData {
  apiKey: string;
  baseUrl: string;
}

/**
 * 从 user_config 读取提供商配置（apiKey + baseUrl）
 * 每次实时读取，不做持久缓存，保证保存后立即生效
 */
export async function getCompatibleProviderConfig(
  userId: string,
  provider: CompatibleProvider
): Promise<ProviderConfigData | null> {
  const meta = COMPATIBLE_PROVIDERS[provider];
  if (!userId) return null;

  try {
    const { hasDatabaseConfig, getLocalUserConfig } = await import('@/lib/server-config-store');
    let record: Record<string, unknown> | null = null;
    if (hasDatabaseConfig()) {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client');
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('user_config')
        .select(`${meta.keyField},${meta.baseUrlField}`)
        .eq('user_id', userId)
        .single();
      record = (data as unknown as Record<string, unknown>) || null;
    } else {
      // 未配置数据库：读取本地兜底存储，保证自定义端点密钥保存后立即可用
      record = getLocalUserConfig(userId);
    }

    if (!record) return null;
    const apiKey = record[meta.keyField];
    const baseUrl = record[meta.baseUrlField];

    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) return null;

    const resolvedBaseUrl =
      typeof baseUrl === 'string' && baseUrl.trim().length > 0
        ? baseUrl.trim().replace(/\/+$/, '')
        : meta.defaultBaseUrl.replace(/\/+$/, '');

    return { apiKey: apiKey.trim(), baseUrl: resolvedBaseUrl };
  } catch (error) {
    console.error(`[兼容客户端] 读取 ${meta.name} 配置失败:`, error);
    return null;
  }
}

/**
 * 检查提供商是否已配置
 */
export async function isCompatibleProviderConfigured(
  userId: string,
  provider: CompatibleProvider
): Promise<boolean> {
  const config = await getCompatibleProviderConfig(userId, provider);
  if (!config) return false;
  // custom 必须同时配置了端点
  if (provider === 'custom') {
    return config.baseUrl.trim().length > 0;
  }
  return true;
}

/**
 * OpenAI 兼容客户端
 */
export class CompatibleLLMClient {
  constructor(
    private userId: string,
    private provider: CompatibleProvider,
    private config: ProviderConfigData
  ) {}

  get providerName(): string {
    return COMPATIBLE_PROVIDERS[this.provider].name;
  }

  /**
   * 非流式调用
   */
  async invoke(messages: CompatibleMessage[], options: CompatibleChatConfig = {}): Promise<CompatibleChatResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature,
        top_p: options.top_p,
        max_tokens: options.max_tokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${this.providerName}] 非流式调用失败 ${response.status}:`, errorText.slice(0, 500));
      throw new Error(`${this.providerName} API 调用失败 (HTTP ${response.status})`);
    }

    return (await response.json()) as CompatibleChatResponse;
  }

  /**
   * 流式调用，返回 SSE ReadableStream（与 qwen/zhipu 客户端输出格式一致）
   */
  createStreamResponse(messages: CompatibleMessage[], options: CompatibleChatConfig = {}): Response {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start: async (controller) => {
        try {
          const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
              model: options.model,
              messages,
              temperature: options.temperature,
              top_p: options.top_p,
              max_tokens: options.max_tokens,
              stream: true,
            }),
            signal: AbortSignal.timeout(300_000),
          });

          if (!response.ok || !response.body) {
            const errorText = await response.text().catch(() => '');
            console.error(`[${this.providerName}] 流式调用失败 ${response.status}:`, errorText.slice(0, 500));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: `${this.providerName} API 调用失败 (HTTP ${response.status})` })}\n\n`)
            );
            controller.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }
              try {
                const chunk = JSON.parse(payload) as CompatibleStreamChunk;
                const content = chunk.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // 忽略无法解析的行
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error(`[${this.providerName}] 流式错误:`, error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
}

/**
 * 获取客户端实例（未配置时返回 null）
 */
export async function getCompatibleClient(
  userId: string,
  provider: CompatibleProvider
): Promise<CompatibleLLMClient | null> {
  const config = await getCompatibleProviderConfig(userId, provider);
  if (!config) return null;
  return new CompatibleLLMClient(userId, provider, config);
}
