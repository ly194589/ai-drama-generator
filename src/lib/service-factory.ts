/**
 * AI 服务工厂
 * 所有 AI 能力均通过扣子平台 SDK 提供
 * 
 * 支持两种Token模式：
 * 1. 用户Token模式：每个用户使用自己的扣子账号Token
 * 2. 系统Token模式：管理员或无Token用户使用系统默认Token
 * 
 * 内置模型配置：
 * - LLM: doubao-seed-2-0-pro (AI顾问、剧本生成)
 * - 图片: doubao-seedream-5-0-260128 (海报制作、场景图)
 * - 视频: doubao-seedance-2-0-260128 (视频生成)
 * - TTS: 扣子内置语音服务
 */

import { NextRequest } from 'next/server';
import {
  LLMClient,
  ImageGenerationClient,
  TTSClient,
  VideoGenerationClient,
  Config,
  HeaderUtils,
} from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS, VIDEO_MODEL_PROMPT_CONFIGS } from './config';
import { getUserIdFromRequest, getValidUserToken, getUserCozeToken } from './user-token';

// 系统级扣子Token（环境变量 - 使用工作负载身份API Key）
const SYSTEM_COZE_TOKEN = process.env.COZE_WORKLOAD_IDENTITY_API_KEY || '';
const SYSTEM_BASE_URL = process.env.COZE_INTEGRATION_BASE_URL || '';
const SYSTEM_MODEL_BASE_URL = process.env.COZE_INTEGRATION_MODEL_BASE_URL || '';

// 导出用户ID获取函数
export { getUserIdFromRequest };

// ==================== 类型定义 ====================

export interface LLMService {
  stream(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>, options?: { model?: string; temperature?: number }): AsyncIterable<{ content: string }>;
  chat(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>, options?: { model?: string; temperature?: number }): Promise<string>;
}

export interface ImageService {
  generate(prompt: string, options?: { size?: string; count?: number }): Promise<{ urls: string[] }>;
}

export interface TTSService {
  synthesize(text: string, options?: { speaker?: string; audioFormat?: string; sampleRate?: number }): Promise<{ audioUri: string; audioSize: number }>;
}

export interface VideoService {
  generateVideo(content: Array<{ type: string; text?: string; image_url?: { url: string }; role?: string }>, options?: Record<string, unknown>): Promise<{ status: string; videoUrl?: string; lastFrameUrl?: string }>;
}

// ==================== 扣子平台服务适配器 ====================

class CozeLLMAdapter implements LLMService {
  private client: LLMClient;
  private defaultModel: string;

  constructor(client: LLMClient, defaultModel: string) {
    this.client = client;
    this.defaultModel = defaultModel;
  }

  async *stream(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>, options?: { model?: string; temperature?: number }): AsyncIterable<{ content: string }> {
    const formattedMessages = messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
      }
      // 处理多模态消息
      return { 
        role: m.role as 'system' | 'user' | 'assistant', 
        content: m.content.map(c => {
          if (c.type === 'text') {
            return { type: 'text' as const, text: c.text || '' };
          } else if (c.type === 'image_url') {
            return { type: 'image_url' as const, image_url: { url: c.image_url?.url || '' } };
          }
          return { type: 'text' as const, text: '' };
        })
      };
    });

    const stream = this.client.stream(formattedMessages, {
      model: options?.model || this.defaultModel,
      temperature: options?.temperature,
    });
    
    for await (const chunk of stream) {
      if (chunk.content) {
        yield { content: chunk.content.toString() };
      }
    }
  }

  async chat(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>, options?: { model?: string; temperature?: number }): Promise<string> {
    let result = '';
    for await (const chunk of this.stream(messages, options)) {
      result += chunk.content;
    }
    return result;
  }
}

class CozeImageAdapter implements ImageService {
  private client: ImageGenerationClient;

  constructor(client: ImageGenerationClient) {
    this.client = client;
  }

  async generate(prompt: string, options?: { size?: string; count?: number }): Promise<{ urls: string[] }> {
    const response = await this.client.generate({
      prompt,
      size: options?.size || DEFAULT_MODELS.imageSize,
    });

    const helper = this.client.getResponseHelper(response);
    
    if (helper.success && helper.imageUrls.length > 0) {
      return { urls: helper.imageUrls };
    }
    
    throw new Error(helper.errorMessages.join(', ') || '图片生成失败');
  }
}

class CozeTTSAdapter implements TTSService {
  private client: TTSClient;
  private defaultSpeaker: string;

  constructor(client: TTSClient, defaultSpeaker: string) {
    this.client = client;
    this.defaultSpeaker = defaultSpeaker;
  }

  async synthesize(text: string, options?: { speaker?: string; audioFormat?: string; sampleRate?: number }): Promise<{ audioUri: string; audioSize: number }> {
    const response = await this.client.synthesize({
      uid: `user-${Date.now()}`,
      text,
      speaker: options?.speaker || this.defaultSpeaker,
      audioFormat: (options?.audioFormat || 'mp3') as import('coze-coding-dev-sdk').AudioFormat,
      sampleRate: (options?.sampleRate || 24000) as import('coze-coding-dev-sdk').SampleRate,
    });

    if (!response.audioUri) {
      throw new Error('语音合成失败');
    }

    return {
      audioUri: response.audioUri,
      audioSize: response.audioSize,
    };
  }
}

class CozeVideoAdapter implements VideoService {
  private client: VideoGenerationClient;

  constructor(client: VideoGenerationClient) {
    this.client = client;
  }

  async generateVideo(content: Array<{ type: string; text?: string; image_url?: { url: string }; role?: string }>, options?: Record<string, unknown>): Promise<{ status: string; videoUrl?: string; lastFrameUrl?: string }> {
    // 添加超时保护：最多等待15分钟
    const timeoutMs = 15 * 60 * 1000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`视频生成超时（${timeoutMs / 1000}秒）`)), timeoutMs);
    });
    
    const generatePromise = this.client.videoGeneration(
      content.map(c => {
        if (c.type === 'text') {
          return { type: 'text' as const, text: c.text || '' };
        } else {
          return {
            type: 'image_url' as const,
            image_url: { url: c.image_url?.url || '' },
            role: c.role as 'first_frame' | 'last_frame' | undefined,
          };
        }
      }),
      {
        model: options?.model as string || DEFAULT_MODELS.video,
        duration: options?.duration as number,
        ratio: options?.ratio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive',
        resolution: options?.resolution as '480p' | '720p' | '1080p',
        generateAudio: options?.generateAudio as boolean,
        // 设置最大等待时间为15分钟（单位：秒），与SDK默认超时一致
        maxWaitTime: 900,
      }
    );
    
    const response = await Promise.race([generatePromise, timeoutPromise]);
    
    return {
      status: response.response?.status || 'succeeded',
      videoUrl: response.videoUrl || undefined,
      lastFrameUrl: response.lastFrameUrl || undefined,
    };
  }
}

// ==================== 配置创建 ====================

/**
 * 创建带用户Token的Config
 * 
 * @param request 请求对象
 * @returns Config对象和用户Token信息
 */
async function createUserConfig(request?: NextRequest): Promise<{
  config: Config;
  customHeaders: Record<string, string>;
  userId: string | null;
  useUserToken: boolean;
}> {
  // 提取请求头
  const customHeaders = request?.headers 
    ? HeaderUtils.extractForwardHeaders(request.headers)
    : {};
  
  // 尝试获取用户ID
  const userId = request ? getUserIdFromRequest(request) : null;
  
  if (!userId) {
    // 无用户ID，使用系统Token
    console.log('[ServiceFactory] 无用户ID，使用系统Token');
    return {
      config: new Config({ 
        apiKey: SYSTEM_COZE_TOKEN,
        baseUrl: SYSTEM_BASE_URL,
        modelBaseUrl: SYSTEM_MODEL_BASE_URL,
      }),
      customHeaders,
      userId: null,
      useUserToken: false,
    };
  }
  
  // 获取用户的Token信息
  const tokenInfo = await getUserCozeToken(userId);
  
  if (!tokenInfo || !tokenInfo.accessToken || tokenInfo.isAdmin) {
    // 用户没有Token或是管理员，使用系统Token
    console.log(`[ServiceFactory] 用户 ${userId} 使用系统Token (isAdmin: ${tokenInfo?.isAdmin})`);
    return {
      config: new Config({ 
        apiKey: SYSTEM_COZE_TOKEN,
        baseUrl: SYSTEM_BASE_URL,
        modelBaseUrl: SYSTEM_MODEL_BASE_URL,
      }),
      customHeaders,
      userId,
      useUserToken: false,
    };
  }
  
  // 检查Token是否有效
  const validToken = await getValidUserToken(userId);
  
  if (!validToken) {
    // Token无效或过期，使用系统Token
    console.log(`[ServiceFactory] 用户 ${userId} Token无效，使用系统Token`);
    return {
      config: new Config({ 
        apiKey: SYSTEM_COZE_TOKEN,
        baseUrl: SYSTEM_BASE_URL,
        modelBaseUrl: SYSTEM_MODEL_BASE_URL,
      }),
      customHeaders,
      userId,
      useUserToken: false,
    };
  }
  
  // 使用用户的Token创建Config
  console.log(`[ServiceFactory] 用户 ${userId} 使用自己的扣子Token`);
  const config = new Config({
    apiKey: validToken,
  });
  
  return {
    config,
    customHeaders,
    userId,
    useUserToken: true,
  };
}

// ==================== 服务工厂 ====================

export interface ServiceFactoryResult {
  llm: LLMService;
  image: ImageService;
  tts: TTSService;
  config: {
    llmModel: string;
    imageModel: string;
    imageSize: string;
    ttsSpeaker: string;
    videoModel: string;
  };
  /** 是否使用用户的Token */
  useUserToken: boolean;
  /** 用户ID */
  userId: string | null;
}

/**
 * 创建 AI 服务实例
 * 所有服务通过扣子平台 SDK 提供
 * 
 * @param request 请求对象（可选）
 * @param forceSystemToken 强制使用系统Token（可选）
 */
export async function createServices(
  request?: NextRequest, 
  forceSystemToken: boolean = false
): Promise<ServiceFactoryResult> {
  // 获取配置
  const { config, customHeaders, userId, useUserToken } = forceSystemToken 
    ? { config: new Config(), customHeaders: {}, userId: null, useUserToken: false }
    : await createUserConfig(request);
  
  const llmClient = new LLMClient(config, customHeaders);
  const imageClient = new ImageGenerationClient(config, customHeaders);
  const ttsClient = new TTSClient(config, customHeaders);
  
  return {
    llm: new CozeLLMAdapter(llmClient, DEFAULT_MODELS.llm),
    image: new CozeImageAdapter(imageClient),
    tts: new CozeTTSAdapter(ttsClient, DEFAULT_MODELS.tts),
    config: {
      llmModel: DEFAULT_MODELS.llm,
      imageModel: DEFAULT_MODELS.image,
      imageSize: DEFAULT_MODELS.imageSize,
      ttsSpeaker: DEFAULT_MODELS.tts,
      videoModel: DEFAULT_MODELS.video,
    },
    useUserToken,
    userId,
  };
}

/**
 * 创建视频服务实例
 * 视频服务通过扣子平台 SDK 提供
 * 
 * @param request 请求对象（可选）
 * @param forceSystemToken 强制使用系统Token（可选）
 */
export async function createVideoService(
  request?: NextRequest,
  forceSystemToken: boolean = false
): Promise<{ service: VideoService; useUserToken: boolean; userId: string | null }> {
  // 获取配置
  const { config, customHeaders, userId, useUserToken } = forceSystemToken 
    ? { config: new Config(), customHeaders: {}, userId: null, useUserToken: false }
    : await createUserConfig(request);
  
  const client = new VideoGenerationClient(config, customHeaders);
  
  return {
    service: new CozeVideoAdapter(client),
    useUserToken,
    userId,
  };
}

/**
 * 创建LLM客户端
 * 用于直接调用LLM API
 * 
 * @param request 请求对象（可选）
 * @param forceSystemToken 强制使用系统Token（可选）
 */
export async function createLLMClient(
  request?: NextRequest,
  forceSystemToken: boolean = false
): Promise<{ client: LLMClient; useUserToken: boolean; userId: string | null }> {
  const { config, customHeaders, userId, useUserToken } = forceSystemToken 
    ? { config: new Config(), customHeaders: {}, userId: null, useUserToken: false }
    : await createUserConfig(request);
  
  return {
    client: new LLMClient(config, customHeaders),
    useUserToken,
    userId,
  };
}

/**
 * 创建图片生成客户端
 * 
 * @param request 请求对象（可选）
 * @param forceSystemToken 强制使用系统Token（可选）
 */
export async function createImageClient(
  request?: NextRequest,
  forceSystemToken: boolean = false
): Promise<{ client: ImageGenerationClient; useUserToken: boolean; userId: string | null }> {
  const { config, customHeaders, userId, useUserToken } = forceSystemToken 
    ? { config: new Config(), customHeaders: {}, userId: null, useUserToken: false }
    : await createUserConfig(request);
  
  return {
    client: new ImageGenerationClient(config, customHeaders),
    useUserToken,
    userId,
  };
}

/**
 * 创建TTS客户端
 * 
 * @param request 请求对象（可选）
 * @param forceSystemToken 强制使用系统Token（可选）
 */
export async function createTTSClient(
  request?: NextRequest,
  forceSystemToken: boolean = false
): Promise<{ client: TTSClient; useUserToken: boolean; userId: string | null }> {
  const { config, customHeaders, userId, useUserToken } = forceSystemToken 
    ? { config: new Config(), customHeaders: {}, userId: null, useUserToken: false }
    : await createUserConfig(request);
  
  return {
    client: new TTSClient(config, customHeaders),
    useUserToken,
    userId,
  };
}

/**
 * 获取视频模型 Prompt 配置
 */
export function getVideoModelPromptConfig() {
  return VIDEO_MODEL_PROMPT_CONFIGS[DEFAULT_MODELS.video];
}

// 导出类型
export type { PlatformType } from './config';
