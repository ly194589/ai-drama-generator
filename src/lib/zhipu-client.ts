/**
 * 智谱AI API 客户端
 * 文档: https://docs.bigmodel.cn/cn/guide/develop/http/introduction
 * 
 * 支持的模型（官方最新）:
 * - LLM: glm-5.3 (GLM-5.3 旗舰)
 *   文档: https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3
 * - 图片生成: glm-image (GLM-Image 最新)
 *   文档: https://docs.bigmodel.cn/api-reference/模型-api/图像生成
 * - 视频生成: cogvideox-3
 *   文档: https://docs.bigmodel.cn/cn/guide/models/video-generation/cogvideox-3
 * - TTS: glm-tts
 *   文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts
 * 
 * 速率限制: https://www.bigmodel.cn/usercenter/proj-mgmt/rate-limits
 */

// ==================== 模型配置 ====================

export const ZHIPU_MODELS = {
  // ==================== LLM 模型 ====================
  // 智谱官方最新旗舰模型（GLM-5.3，2026年8月上线）
  'glm-5.3': {
    id: 'glm-5.3',
    name: 'GLM-5.3',
    type: 'llm',
    description: '智谱官方最新旗舰，Agentic Engineering，复杂系统工程与长程 Agent 任务，1M 上下文',
    contextWindow: 1000000,
    maxOutput: 131072,
    recommended: true,
    useCase: ['剧本生成', 'AI顾问', '复杂推理', '内容创作'],
    rateLimit: {
      rpm: 500,
      tpm: 200000,
    },
  },
  // 智谱官方高性价比多模态模型（GLM-5.3-Flash，2026年8月上线）
  'glm-5.3-flash': {
    id: 'glm-5.3-flash',
    name: 'GLM-5.3-Flash',
    type: 'llm',
    description: '智谱高性价比多模态模型，1M 上下文，支持图片/视频/文件输入，成本仅为旗舰 1/10',
    contextWindow: 1000000,
    maxOutput: 131072,
    recommended: false,
    useCase: ['日常对话', '内容创作', '多模态理解', '批量任务'],
    rateLimit: {
      rpm: 500,
      tpm: 200000,
    },
  },
  // ==================== 图片生成模型 ====================
  'glm-image': {
    id: 'glm-image',
    name: 'GLM-Image',
    type: 'image',
    description: '智谱官方最新文生图模型，自回归+扩散混合架构，汉字渲染出色，支持文生图与图生图',
    recommended: true,
    useCase: ['海报制作', '场景图', '角色图', '封面图', '电商产品配图'],
    rateLimit: {
      rpm: 10,  // 每分钟请求数
    },
    sizes: ['1440x720', '1024x1024', '768x1024', '1024x768'],
  },
  // 视频生成模型
  'cogvideox-3': {
    id: 'cogvideox-3',
    name: 'CogVideoX-3',
    type: 'video',
    description: '智谱最新视频生成模型，支持首尾帧控制，画面稳定度与清晰度大幅提升',
    recommended: true,
    useCase: ['文生视频', '图生视频', '短视频创作', '3D风格场景'],
    features: {
      firstFrameControl: true,     // 新增首帧控制
      lastFrameControl: true,      // 新增尾帧控制
      durationRange: [7, 10],
      resolutions: ['720p', '1080p'],
      ratios: ['16:9', '9:16', '1:1'],
      highlights: [
        '画面稳定度大幅提升',
        '清晰度显著增强',
        '主体大幅度运动流畅自然',
        '指令遵循更精准',
        '物理真实模拟更佳',
        '高清现实及3D风格场景表现提升',
      ],
    },
    rateLimit: {
      rpm: 3,  // 每分钟3次（账户级限流更严格）
    },
  },
  // TTS模型 - 新一代智谱语音大模型
  'glm-tts': {
    id: 'glm-tts',
    name: 'GLM-TTS',
    type: 'tts',
    description: '新一代智谱语音大模型，上下文智能预判情绪语调，情感表达开源SOTA',
    recommended: true,
    useCase: ['语音合成', '配音', '旁白', '角色配音'],
    features: {
      emotionControl: true,        // 上下文智能预判情绪与语调
      speedControl: true,          // 语速控制
      highQuality: true,           // 开源SOTA表现
      naturalProsody: true,        // 真实情感与生命力
      twoStageGeneration: true,    // 两阶段生成架构
      grpoRL: true,                // GRPO强化学习方案
    },
    highlights: [
      '突破传统语音合成框架',
      '上下文智能预判文本情绪与语调',
      '显著提升语音自然度与表现力',
      '合成语音具备真实情感与生命力',
      '两阶段生成架构',
      'GRPO强化学习方案',
      '字错误率和情感表达开源SOTA',
    ],
    // 支持的音色列表
    voices: [
      { id: 'alloy', name: 'Alloy', description: '中性音色' },
      { id: 'echo', name: 'Echo', description: '男声' },
      { id: 'fable', name: 'Fable', description: '女声' },
      { id: 'onyx', name: 'Onyx', description: '深沉男声' },
      { id: 'nova', name: 'Nova', description: '活力女声' },
      { id: 'shimmer', name: 'Shimmer', description: '温柔女声' },
    ],
    rateLimit: {
      rpm: 20,
    },
  },
  // 音色克隆模型 - GLM-TTS-Clone
  'glm-tts-clone': {
    id: 'glm-tts-clone',
    name: 'GLM-TTS-Clone',
    type: 'tts',
    description: '智谱音色克隆模型，只需3秒语音样本即可克隆音色',
    recommended: true,
    useCase: ['自定义音色', '角色配音', '音色克隆'],
    features: {
      voiceCloning: true,          // 音色克隆
      minSampleDuration: 3,        // 最少3秒样本
      speedControl: true,          // 语速控制
      highQuality: true,           // 超拟人高质量
      naturalProsody: true,        // 自然韵律
    },
    rateLimit: {
      rpm: 10,  // 克隆操作限流更严格
    },
  },
} as const;

// ==================== 类型定义 ====================

export interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ZhipuContentPart[];
}

export interface ZhipuContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ZhipuChatConfig {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
  tools?: ZhipuTool[];
  tool_choice?: 'auto' | 'none' | { type: string; function: { name: string } };
}

export interface ZhipuTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ZhipuChatResponse {
  id: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: {
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ZhipuStreamChunk {
  id: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

// 图片生成请求
export interface ZhipuImageRequest {
  model: string;
  prompt: string;
  /** glm-image: 1024x1024/768x1024/1024x768；cogview-4 支持 16 倍数任意尺寸 */
  size?: string;
}

// 图片生成响应
export interface ZhipuImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

// 视频生成请求
export interface ZhipuVideoRequest {
  model: string;
  prompt: string;
  first_frame_image?: string;  // 首帧图片URL（可选）
  last_frame_image?: string;   // 尾帧图片URL（可选）
  generate_audio?: boolean;    // 是否生成音频（可选，默认 true）
}

// 视频生成响应
export interface ZhipuVideoResponse {
  id: string;
  model: string;
  task_status?: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  video_result?: Array<{
    url?: string;
    duration?: number;
    cover_image_url?: string;  // 视频封面/尾帧图
  }>;
}

// TTS请求 - 新一代智谱语音大模型
// 文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts
// 
// 核心特性：
// - 以新一代智谱语音大模型为核心
// - 突破传统语音合成框架
// - 上下文智能预判文本情绪与语调
// - 显著提升语音自然度与表现力
// - 合成语音具备真实情感与生命力
// - 两阶段生成架构
// - GRPO强化学习方案
// - 字错误率和情感表达开源SOTA
export interface ZhipuTTSRequest {
  model: string;
  input: string;
  voice?: string;           // 音色：alloy, echo, fable, onyx, nova, shimmer 或自定义音色ID
  response_format?: string; // 输出格式：mp3, opus, aac, flac, wav, pcm
  speed?: number;           // 语速：0.25 ~ 4.0
}

// TTS响应（返回音频数据）
export type ZhipuTTSResponse = ArrayBuffer;

// 音色克隆请求
// 文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts-clone
export interface ZhipuVoiceCloneRequest {
  model: string;
  audio_file?: string;      // 音频文件URL或Base64
  voice_name?: string;      // 音色名称
}

// 音色克隆响应
export interface ZhipuVoiceCloneResponse {
  voice_id: string;         // 生成的音色ID
  voice_name: string;
  status: 'success' | 'failed';
  message?: string;
}

// 用户自定义音色
export interface UserVoice {
  id: string;
  user_id: string;
  voice_id: string;         // 智谱返回的音色ID
  voice_name: string;
  sample_url: string;       // 样本音频URL
  duration?: number;        // 样本时长（秒）
  status: 'active' | 'deleted';
  created_at: string;
  updated_at: string;
}

// 错误响应
export interface ZhipuError {
  error: {
    code: string;
    message: string;
  };
}

// ==================== 智谱AI客户端 ====================

// 缓存用户 API Key（内存缓存，避免频繁查询数据库）
const userApiKeyCache = new Map<string, { key: string; expires: number }>();

/**
 * 从数据库获取用户的智谱 API Key
 */
async function fetchUserApiKey(userId?: string): Promise<string | null> {
  if (!userId) return null;
  
  // 检查缓存
  const cached = userApiKeyCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.key;
  }
  
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('user_config')
      .select('zhipu_api_key')
      .eq('user_id', userId)
      .single();
    
    if (error || !data?.zhipu_api_key) {
      return null;
    }
    
    // 缓存 5 分钟
    userApiKeyCache.set(userId, {
      key: data.zhipu_api_key,
      expires: Date.now() + 5 * 60 * 1000,
    });
    
    return data.zhipu_api_key;
  } catch (error) {
    console.error('[智谱] 获取用户API Key失败:', error);
    return null;
  }
}

// ==================== 限流管理器 ====================

/**
 * 智谱API限流配置
 * 文档: https://www.bigmodel.cn/usercenter/proj-mgmt/rate-limits
 * 
 * 注意：实际账户级限流可能比文档更严格，需要适当增加间隔
 */
const RATE_LIMIT_CONFIG = {
  'glm-5.3': { rpm: 500, minInterval: 200 },         // 每分钟500次，最小间隔200ms
  'glm-5.3-flash': { rpm: 500, minInterval: 200 },   // 每分钟500次，最小间隔200ms
  'glm-image': { rpm: 10, minInterval: 8000 },       // 每分钟10次，最小间隔8秒
  'cogvideox-3': { rpm: 3, minInterval: 20000 },     // 每分钟3次，最小间隔20秒（账户级限流更严格）
  'glm-tts': { rpm: 20, minInterval: 4000 },         // 每分钟20次，最小间隔4秒
  'glm-tts-clone': { rpm: 10, minInterval: 6000 },   // 每分钟10次，最小间隔6秒
};

/**
 * 限流管理器
 * 实现请求队列和指数退避重试
 */
class ZhipuRateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private requestQueue: Map<string, Array<() => Promise<void>>> = new Map();
  private isProcessing: Map<string, boolean> = new Map();

  /**
   * 获取模型的最小请求间隔
   */
  private getMinInterval(model: string): number {
    return RATE_LIMIT_CONFIG[model as keyof typeof RATE_LIMIT_CONFIG]?.minInterval || 1000;
  }

  /**
   * 等待指定时间
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 执行带限流的请求
   * @param model 模型名称
   * @param requestFn 实际请求函数
   * @param maxRetries 最大重试次数
   */
  async executeWithRateLimit<T>(
    model: string,
    requestFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const minInterval = this.getMinInterval(model);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 检查是否需要等待
        const lastTime = this.lastRequestTime.get(model) || 0;
        const elapsed = Date.now() - lastTime;
        
        if (elapsed < minInterval) {
          const waitTime = minInterval - elapsed;
          console.log(`[智谱限流] ${model} 等待 ${waitTime}ms...`);
          await this.wait(waitTime);
        }

        // 记录请求时间
        this.lastRequestTime.set(model, Date.now());

        // 执行请求
        const result = await requestFn();
        return result;

      } catch (error) {
        lastError = error as Error;
        const isRateLimited = this.isRateLimitError(error as Error);
        
        if (isRateLimited && attempt < maxRetries) {
          // 指数退避重试：基础时间更长（5秒起），最大120秒
          const backoffTime = Math.min(5000 * Math.pow(2, attempt), 120000);
          console.log(`[智谱限流] ${model} 触发限流，${backoffTime}ms 后重试 (尝试 ${attempt + 1}/${maxRetries})`);
          await this.wait(backoffTime);
          
          // 重置该模型的请求时间，给系统喘息时间
          this.lastRequestTime.set(model, Date.now() + backoffTime);
        } else {
          throw error;
        }
      }
    }

    throw lastError || new Error('请求失败');
  }

  /**
   * 判断是否为限流错误
   */
  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('速率限制') ||
      message.includes('too many requests')
    );
  }

  /**
   * 重置指定模型的限流状态
   */
  reset(model?: string): void {
    if (model) {
      this.lastRequestTime.delete(model);
    } else {
      this.lastRequestTime.clear();
    }
  }
}

// 全局限流管理器实例
const rateLimiter = new ZhipuRateLimiter();

export class ZhipuClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ZHIPU_API_KEY || '';
    this.baseUrl = process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    
    if (!this.apiKey) {
      console.warn('[智谱] 未配置 ZHIPU_API_KEY，请设置环境变量或在方案设置中配置');
    }
  }

  /**
   * 设置 API Key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  private async handleError(response: Response): Promise<never> {
    let errorMessage = response.statusText;
    try {
      const error: ZhipuError = await response.json();
      errorMessage = error.error?.message || errorMessage;
    } catch {
      // 忽略解析错误
    }
    throw new Error(`智谱API错误 (${response.status}): ${errorMessage}`);
  }

  // ==================== LLM 文本模型 ====================

  /**
   * 文本生成（非流式）
   * 文档: https://docs.bigmodel.cn/cn/guide/models/text/glm-4.7
   * 
   * 内置限流控制：每分钟500次，自动重试
   */
  async invoke(
    messages: ZhipuMessage[],
    config?: ZhipuChatConfig
  ): Promise<ZhipuChatResponse> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const model = config?.model || 'glm-5.3';
    
    return rateLimiter.executeWithRateLimit(model, async () => {
      const requestBody = {
        model,
        messages,
        temperature: config?.temperature ?? 0.7,
        top_p: config?.top_p ?? 0.9,
        max_tokens: config?.max_tokens ?? 4096,
        stream: false,
        stop: config?.stop,
        tools: config?.tools,
        tool_choice: config?.tool_choice,
      };

      console.log(`[智谱LLM] 调用模型: ${model}`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return response.json();
    });
  }

  /**
   * 文本生成（流式）
   */
  async *stream(
    messages: ZhipuMessage[],
    config?: ZhipuChatConfig
  ): AsyncGenerator<ZhipuStreamChunk> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const requestBody = {
      model: config?.model || 'glm-5.3',
      messages,
      temperature: config?.temperature ?? 0.7,
      top_p: config?.top_p ?? 0.9,
      max_tokens: config?.max_tokens ?? 4096,
      stream: true,
      stop: config?.stop,
    };

    console.log(`[智谱LLM] 流式调用: ${requestBody.model}`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;
          
          const data = trimmedLine.slice(5).trim();
          if (data === '[DONE]') return;

          try {
            const chunk: ZhipuStreamChunk = JSON.parse(data);
            yield chunk;
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 创建SSE流式响应
   */
  async createStreamResponse(
    messages: ZhipuMessage[],
    config?: ZhipuChatConfig
  ): Promise<Response> {
    const encoder = new TextEncoder();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of self.stream(messages, config)) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[智谱LLM] 流式响应错误:', error);
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
        'Connection': 'keep-alive',
      },
    });
  }

  // ==================== 图片生成 ====================

  /**
   * 图片生成
   * 文档: https://docs.bigmodel.cn/cn/guide/models/free/glm-image
   * 
   * 内置限流控制：每分钟10次，自动重试
   */
  async generateImage(
    prompt: string,
    options?: {
      model?: string;
      /** glm-image: 1024x1024/768x1024/1024x768；cogview-4 支持 16 倍数任意尺寸（如 1344x768） */
      size?: string;
    }
  ): Promise<ZhipuImageResponse> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const model = options?.model || 'glm-image';
    
    return rateLimiter.executeWithRateLimit(model, async () => {
      const requestBody: ZhipuImageRequest = {
        model,
        prompt,
        size: options?.size || '1024x1024',
      };

      console.log(`[智谱图片] 生成: ${model}, 尺寸: ${requestBody.size}`);

      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return response.json();
    });
  }

  // ==================== 视频生成 ====================

  /**
   * 视频生成（异步）
   * 文档: https://docs.bigmodel.cn/cn/guide/models/video-generation/cogvideox-3
   * 
   * 新特性：
   * - 支持首尾帧控制，实现图生视频
   * - 画面稳定度大幅提升
   * - 清晰度显著增强
   * - 主体大幅度运动流畅自然
   * - 指令遵循更精准
   * - 物理真实模拟更佳
   * - 高清现实及3D风格场景表现提升
   * 
   * 内置限流控制：每分钟5次，自动重试
   */
  async generateVideo(
    prompt: string,
    options?: {
      model?: string;
      firstFrameImage?: string;  // 首帧图片URL
      lastFrameImage?: string;   // 尾帧图片URL
      generateAudio?: boolean;   // 是否生成音频（默认 true）
    }
  ): Promise<ZhipuVideoResponse> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const model = options?.model || 'cogvideox-3';
    
    return rateLimiter.executeWithRateLimit(model, async () => {
      const requestBody: ZhipuVideoRequest = {
        model,
        prompt,
        generate_audio: options?.generateAudio ?? true,  // 默认开启音频
      };

      // 添加首帧图片（如果提供）
      if (options?.firstFrameImage) {
        requestBody.first_frame_image = options.firstFrameImage;
      }

      // 添加尾帧图片（如果提供）
      if (options?.lastFrameImage) {
        requestBody.last_frame_image = options.lastFrameImage;
      }

      const hasFirstFrame = !!options?.firstFrameImage;
      const hasLastFrame = !!options?.lastFrameImage;
      const hasAudio = options?.generateAudio ?? true;
      
      console.log(`[智谱视频] 生成: ${model}`, {
        hasFirstFrame,
        hasLastFrame,
        hasAudio,
        promptLength: prompt.length,
      });

      const response = await fetch(`${this.baseUrl}/videos/generations`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[智谱视频] 创建失败`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
        });
        await this.handleError(response);
      }

      const result = await response.json();
      console.log(`[智谱视频] 创建响应:`, JSON.stringify(result).substring(0, 500));
      
      // 检查响应格式
      if (!result.id && !result.task_id) {
        console.warn(`[智谱视频] 响应中缺少任务ID`, result);
      }
      
      return result;
    });
  }

  /**
   * 查询视频任务状态
   * 
   * 智谱API文档: https://docs.bigmodel.cn/api-reference/模型-api/查询异步结果
   * 
   * 创建: POST /api/paas/v4/videos/generations
   * 查询: GET /api/paas/v4/async-result/{id} （统一异步结果查询端点）
   * 
   * 注意：视频生成通常需要2-5分钟，在生成过程中查询可能返回404
   */
  async getVideoTask(taskId: string): Promise<ZhipuVideoResponse> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    if (!taskId) {
      throw new Error('taskId 不能为空');
    }

    // 使用统一的异步结果查询端点
    // 文档: https://docs.bigmodel.cn/api-reference/模型-api/查询异步结果
    const url = `${this.baseUrl}/async-result/${taskId}`;
    
    console.log(`[智谱视频] 查询任务: ${taskId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // 如果返回404，说明任务还在处理中或不存在
      if (response.status === 404) {
        console.log(`[智谱视频] 任务 ${taskId} 未找到或仍在处理中`);
        // 返回PROCESSING状态，让调用方继续等待
        return {
          id: taskId,
          model: 'cogvideox-3',
          task_status: 'PROCESSING',
        };
      }
      
      console.error(`[智谱视频] 查询失败: ${response.status}`, errorText.substring(0, 200));
      await this.handleError(response);
    }

    const result = await response.json();
    console.log(`[智谱视频] 查询成功:`, JSON.stringify(result).substring(0, 300));
    
    // 将异步结果格式转换为视频响应格式
    if (result.video_result && !result.task_status) {
      result.task_status = 'SUCCESS';
    }
    
    return result;
  }

  // ==================== TTS 语音合成 ====================

  /**
   * 文本转语音 - 新一代智谱语音大模型
   * 文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts
   * 
   * 核心特性：
   * - 以新一代智谱语音大模型为核心
   * - 突破传统语音合成框架
   * - 上下文智能预判文本情绪与语调
   * - 显著提升语音自然度与表现力
   * - 合成语音具备真实情感与生命力
   * - 两阶段生成架构
   * - GRPO强化学习方案
   * - 字错误率和情感表达开源SOTA
   * 
   * @param text - 要合成的文本
   * @param options - 合成选项
   * @param options.voice - 音色：alloy(中性), echo(男声), fable(女声), onyx(深沉男声), nova(活力女声), shimmer(温柔女声)
   * @param options.speed - 语速：0.25 ~ 4.0，默认1.0
   * @param options.response_format - 输出格式：mp3, opus, aac, flac, wav, pcm，默认mp3
   * 
   * 内置限流控制：每分钟20次，自动重试
   */
  async textToSpeech(
    text: string,
    options?: {
      model?: string;
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      speed?: number;
      response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
    }
  ): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const model = options?.model || 'glm-tts';
    
    return rateLimiter.executeWithRateLimit(model, async () => {
      const requestBody: ZhipuTTSRequest = {
        model,
        input: text,
        voice: options?.voice || 'alloy',
        speed: options?.speed,
        response_format: options?.response_format || 'mp3',
      };

      console.log(`[智谱TTS] 合成: ${model}, 音色: ${requestBody.voice}`);

      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      // 返回音频数据
      return response.arrayBuffer();
    });
  }

  /**
   * 文本转语音（返回Base64）
   */
  async textToSpeechBase64(
    text: string,
    options?: {
      model?: string;
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | string;
      speed?: number;
      response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
    }
  ): Promise<string> {
    const audioBuffer = await this.textToSpeech(text, {
      ...options,
      voice: options?.voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | undefined,
    });
    return Buffer.from(audioBuffer).toString('base64');
  }

  // ==================== 音色克隆 ====================

  /**
   * 创建音色克隆
   * 文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts-clone
   * 
   * 特性：
   * - 只需 3 秒语音样本
   * - 学习说话者的音色与语气习惯
   * - 生成自然流畅、贴近真人的语音
   * 
   * @param audioFile - 音频文件URL或Base64（最少3秒）
   * @param voiceName - 音色名称
   * @returns 音色ID
   * 
   * 内置限流控制：每分钟10次，自动重试
   */
  async createVoiceClone(
    audioFile: string,
    voiceName: string
  ): Promise<ZhipuVoiceCloneResponse> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const model = 'glm-tts-clone';
    
    return rateLimiter.executeWithRateLimit(model, async () => {
      const requestBody: ZhipuVoiceCloneRequest = {
        model,
        audio_file: audioFile,
        voice_name: voiceName,
      };

      console.log(`[智谱音色克隆] 创建音色: ${voiceName}`);

      const response = await fetch(`${this.baseUrl}/audio/voice_cloning`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      const result = await response.json();
      return result;
    });
  }

  /**
   * 使用克隆音色进行语音合成
   * 
   * @param text - 要合成的文本
   * @param voiceId - 克隆音色ID（从 createVoiceClone 返回）
   * @param options - 合成选项
   */
  async textToSpeechWithClone(
    text: string,
    voiceId: string,
    options?: {
      speed?: number;
      response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
    }
  ): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new Error('智谱API Key未配置');
    }

    const model = 'glm-tts-clone';
    
    return rateLimiter.executeWithRateLimit(model, async () => {
      const requestBody = {
        model,
        input: text,
        voice: voiceId,  // 使用克隆的音色ID
        speed: options?.speed || 1.0,
        response_format: options?.response_format || 'mp3',
      };

      console.log(`[智谱音色克隆] 合成: ${model}, 音色ID: ${voiceId}`);

      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return response.arrayBuffer();
    });
  }
}

// ==================== 单例导出 ====================

let zhipuClient: ZhipuClient | null = null;

/**
 * 获取智谱客户端（支持用户级别的 API Key）
 * @param apiKey - 可选的 API Key，如果不提供则从环境变量或数据库获取
 * @param userId - 可选的用户 ID，用于从数据库获取用户配置的 API Key
 */
export function getZhipuClient(apiKey?: string): ZhipuClient {
  if (!zhipuClient) {
    zhipuClient = new ZhipuClient(apiKey);
  } else if (apiKey) {
    // 如果提供了新的 API Key，更新客户端
    zhipuClient.setApiKey(apiKey);
  }
  return zhipuClient;
}

/**
 * 获取智谱客户端（异步版本，支持从数据库获取用户 API Key）
 */
export async function getZhipuClientAsync(userId?: string): Promise<ZhipuClient> {
  // 优先使用环境变量
  const envApiKey = process.env.ZHIPU_API_KEY;
  if (envApiKey) {
    return getZhipuClient(envApiKey);
  }
  
  // 其次从数据库获取用户 API Key
  if (userId) {
    const userApiKey = await fetchUserApiKey(userId);
    if (userApiKey) {
      return getZhipuClient(userApiKey);
    }
  }
  
  // 返回未配置的客户端
  return getZhipuClient();
}

/**
 * 检查智谱是否已配置（支持用户级别的 API Key）
 */
export function isZhipuConfigured(): boolean {
  return !!(process.env.ZHIPU_API_KEY);
}

/**
 * 检查用户是否配置了智谱 API Key（异步版本）
 */
export async function isZhipuConfiguredForUser(userId?: string): Promise<boolean> {
  // 环境变量优先
  if (process.env.ZHIPU_API_KEY) {
    return true;
  }
  
  // 检查用户配置
  if (userId) {
    const userApiKey = await fetchUserApiKey(userId);
    return !!userApiKey;
  }
  
  return false;
}

/**
 * 清除用户 API Key 缓存
 */
export function clearZhipuCache(userId?: string): void {
  if (userId) {
    userApiKeyCache.delete(userId);
  } else {
    userApiKeyCache.clear();
  }
}
