/**
 * 千问模型客户端
 *
 * 文档: https://help.aliyun.com/zh/dashscope/
 * API 文档: https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope/
 */

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

export interface QwenChatConfig {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: QwenTool[];
}

export interface QwenTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface QwenChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: unknown[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface QwenStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: unknown[];
    };
    finish_reason: string | null;
  }>;
}

export interface QwenError {
  code: string;
  message: string;
  details?: unknown;
}

const userApiKeyCache = new Map<string, { key: string; expires: number }>();

/**
 * 获取用户的千问 API Key
 */
async function fetchUserApiKey(userId?: string): Promise<string | null> {
  if (!userId) return null;

  const cached = userApiKeyCache.get(userId);
  if (cached && Date.now() < cached.expires) {
    return cached.key;
  }

  try {
    const { decryptSecret } = await import('@/lib/secret-crypto');
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();

    const { data } = await supabase
      .from('user_config')
      .select('qwen_api_key')
      .eq('user_id', userId)
      .single();

    if (data?.qwen_api_key) {
      const apiKey = decryptSecret(data.qwen_api_key);
      if (!apiKey) return null;
      userApiKeyCache.set(userId, {
        key: apiKey,
        expires: Date.now() + 5 * 60 * 1000, // 5 分钟缓存
      });
      return apiKey;
    }
  } catch (error) {
    console.warn('[千问] 获取用户 API Key 失败:', error);
  }

  return null;
}

/**
 * 千问速率限制器
 */
class QwenRateLimiter {
  private lastCallTime: number = 0;
  private minInterval: number = 100; // 最小间隔 100ms

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }
    this.lastCallTime = Date.now();
  }
}

const rateLimiter = new QwenRateLimiter();

/**
 * 千问客户端类
 */
export class QwenClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.QWEN_API_KEY || '';
    this.baseUrl = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    if (!this.apiKey) {
      console.warn('[千问] 未配置 QWEN_API_KEY，请设置环境变量');
    }
  }

  /**
   * 设置 API Key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * 获取请求头
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 调用千问 API
   */
  async invoke(
    messages: QwenMessage[],
    config?: QwenChatConfig
  ): Promise<QwenChatResponse> {
    if (!this.apiKey) {
      throw new Error('[千问] API Key 未配置');
    }

    await rateLimiter.waitForSlot();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: config?.model || 'qwen3.8-max',
          messages,
          temperature: config?.temperature ?? 0.7,
          top_p: config?.top_p ?? 0.8,
          max_tokens: config?.max_tokens ?? 4096,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error: QwenError = await response.json();
        throw new Error(`[千问] API 错误: ${error.message} (${response.status})`);
      }

      const data = await response.json();
      console.log('[千问] 调用成功:', {
        model: data.model,
        tokens: data.usage,
      });

      return data;
    } catch (error) {
      console.error('[千问] 调用失败:', error);
      throw error;
    }
  }

  /**
   * 流式调用千问 API
   */
  async *stream(
    messages: QwenMessage[],
    config?: QwenChatConfig
  ): AsyncGenerator<QwenStreamChunk> {
    if (!this.apiKey) {
      throw new Error('[千问] API Key 未配置');
    }

    await rateLimiter.waitForSlot();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: config?.model || 'qwen-max-latest',
          messages,
          temperature: config?.temperature ?? 0.7,
          top_p: config?.top_p ?? 0.8,
          max_tokens: config?.max_tokens ?? 4096,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error: QwenError = await response.json();
        throw new Error(`[千问] API 错误: ${error.message} (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('[千问] 无法读取响应流');
      }

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
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              yield chunk;
            } catch (e) {
              console.warn('[千问] 解析流数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('[千问] 流式调用失败:', error);
      throw error;
    }
  }

  /**
   * 文本转语音（TTS）
   * 支持多种音色和参数配置
   * 文档: https://help.aliyun.com/zh/dashscope/developer-reference/api-details
   */
  async textToSpeech(params: {
    text: string;
    model?: string;      // 模型名称，默认 cosyvoice-v1
    voice?: string;      // 音色，默认 longxiaochun
    format?: string;     // 音频格式，默认 mp3
    sampleRate?: number; // 采样率，默认 24000
    speechRate?: number; // 语速，范围 0.5-2.0，默认 1.0
    pitchRate?: number;  // 音调，范围 0.5-2.0，默认 1.0
  }): Promise<{ audioUrl: string; audioSize: number }> {
    if (!this.apiKey) {
      throw new Error('[千问] API Key 未配置');
    }

    await rateLimiter.waitForSlot();

    try {
      const {
        text,
        model = 'cosyvoice-v1',
        voice = 'longxiaochun',
        format = 'mp3',
        sampleRate = 24000,
        speechRate = 1.0,
        pitchRate = 1.0
      } = params;

      console.log('[千问] TTS 调用:', {
        text: text.substring(0, 50) + '...',
        model,
        voice,
        format,
        sampleRate,
      });

      const response = await fetch(
        'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/generation-sync',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: { text },
            parameters: {
              text_type: 'PlainText',
            },
          }),
        }
      );

      if (!response.ok) {
        const error: QwenError = await response.json();
        console.error('[千问] TTS 调用失败:', error);
        throw new Error(`千问 TTS 调用失败: ${error.message || '未知错误'} (${response.status})`);
      }

      const data = await response.json();
      console.log('[千问] TTS 响应:', JSON.stringify(data, null, 2));

      // 处理不同的返回格式
      const audioUrl = data.output?.audio_url || data.output?.binary_audio_url;

      if (!audioUrl) {
        throw new Error('千问 TTS 未返回音频 URL');
      }

      // 下载音频文件获取大小
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioSize = audioBuffer.byteLength;

      console.log('[千问] TTS 生成成功:', {
        audioSize,
        textLength: text.length,
      });

      return { audioUrl, audioSize };
    } catch (error) {
      console.error('[千问] TTS 错误:', error);
      throw error;
    }
  }
}

let qwenClient: QwenClient | null = null;

/**
 * 获取千问客户端单例
 */
export function getQwenClient(apiKey?: string): QwenClient {
  if (!qwenClient) {
    qwenClient = new QwenClient(apiKey);
  } else if (apiKey) {
    qwenClient.setApiKey(apiKey);
  }
  return qwenClient;
}

/**
 * 异步获取千问客户端（支持从数据库获取用户 API Key）
 */
export async function getQwenClientAsync(userId?: string): Promise<QwenClient> {
  const envApiKey = process.env.QWEN_API_KEY;
  if (envApiKey) {
    return getQwenClient(envApiKey);
  }

  const userApiKey = await fetchUserApiKey(userId);
  if (userApiKey) {
    return getQwenClient(userApiKey);
  }

  return getQwenClient();
}

/**
 * 检查千问是否为用户配置（环境变量或数据库）
 * 默认检查 dev-user 的配置
 */
export async function isQwenConfigured(userId?: string): Promise<boolean> {
  const targetUserId = userId || 'dev-user';

  // 环境变量优先
  if (process.env.QWEN_API_KEY) {
    return true;
  }

  // 检查用户配置
  const userApiKey = await fetchUserApiKey(targetUserId);
  return !!userApiKey;
}

/**
 * 检查千问是否为用户配置（环境变量或数据库）
 * 使用传入的 userId
 */
export async function isQwenConfiguredForUser(userId?: string): Promise<boolean> {
  // 环境变量优先
  if (process.env.QWEN_API_KEY) {
    return true;
  }

  // 检查用户配置
  const userApiKey = await fetchUserApiKey(userId);
  return !!userApiKey;
}

/**
 * 清除 API Key 缓存
 */
export function clearQwenCache(userId?: string): void {
  if (userId) {
    userApiKeyCache.delete(userId);
  } else {
    userApiKeyCache.clear();
  }
}
