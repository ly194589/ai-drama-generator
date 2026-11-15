import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getZhipuClient, isZhipuConfigured } from '@/lib/zhipu-client';
import { getQwenClientAsync, isQwenConfigured } from '@/lib/qwen-client';
import {
  isCompatibleProvider,
  getCompatibleClient,
  CompatibleMessage,
  CompatibleChatConfig,
} from '@/lib/openai-compatible-client';
import { LLM_MODELS, SOLUTION_PRESETS, SolutionType, getDefaultLLMBySolution } from '@/lib/config';

/**
 * 统一LLM调用接口
 * 支持扣子平台 / 智谱AI / 千问 / 火山引擎 / MiniMax / Kimi / DeepSeek / 文心 / 混元 / 自定义端点
 *
 * POST /api/llm/invoke
 * Body: {
 *   messages: Array<{role: string, content: string}>,
 *   model?: string,        // 模型ID（可选，根据solution自动选择）
 *   solution?: SolutionType,  // 方案（可选，默认standard）
 *   provider?: string,  // 提供商（可选，优先级：provider > model.provider > solution.provider）
 *   stream?: boolean,      // 是否流式
 *   temperature?: number,
 *   max_tokens?: number,
 * }
 */

// 消息类型
type MessageRole = 'system' | 'user' | 'assistant';
interface Message {
  role: MessageRole;
  content: string;
}

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = '你是一个有帮助的AI助手。';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages: rawMessages,
      model,
      solution,
      provider,
      stream = true,
      temperature = 0.7,
      max_tokens = 4096,
      system_prompt,
    } = body;

    if (!rawMessages || !Array.isArray(rawMessages)) {
      return NextResponse.json(
        { error: 'messages 参数必填' },
        { status: 400 }
      );
    }

    // 转换消息格式，确保类型正确
    const messages: Message[] = rawMessages.map((m: { role: string; content: string }) => ({
      role: m.role as MessageRole,
      content: m.content,
    }));

    // 添加系统提示词
    const fullMessages: Message[] = system_prompt
      ? [{ role: 'system' as const, content: system_prompt }, ...messages]
      : messages;

    // 确定方案
    const solutionType: SolutionType = solution || 'standard';
    const solutionPreset = SOLUTION_PRESETS[solutionType];

    // 读取用户在模型设置中保存的 LLM 提供商与模型（优先级最高）
    const userId = request.headers.get('x-user-id') || 'dev-user';
    let userLlmProvider: string | null = null;
    let userLlmModel: string | null = null;
    try {
      const { hasDatabaseConfig, getLocalUserConfig } = await import('@/lib/server-config-store');
      let cfg: Record<string, unknown> | null = null;
      if (hasDatabaseConfig()) {
        const { getSupabaseClient } = await import('@/storage/database/supabase-client');
        const supabase = getSupabaseClient();
        const { data: userCfg } = await supabase
          .from('user_config')
          .select('llm_provider,llm_model')
          .eq('user_id', userId)
          .single();
        cfg = (userCfg as unknown as Record<string, unknown>) || null;
      } else {
        // 未配置数据库：读取本地兜底存储
        cfg = getLocalUserConfig(userId);
      }
      if (cfg) {
        userLlmProvider = typeof cfg.llm_provider === 'string' && cfg.llm_provider ? cfg.llm_provider : null;
        userLlmModel = typeof cfg.llm_model === 'string' && cfg.llm_model ? cfg.llm_model : null;
      }
    } catch (error) {
      console.warn('[LLM] 读取用户模型设置失败，回退方案默认:', error);
    }

    // 确定提供商：显式provider参数 > 用户设置 > 模型名兜底识别 > 方案默认
    const { detectProviderFromModel } = await import('@/lib/model-catalog');
    const fallbackProvider = userLlmModel ? detectProviderFromModel('llm', userLlmModel) : null;
    const providerType = provider || userLlmProvider || fallbackProvider || solutionPreset.provider;

    // 确定模型：显式model参数 > 用户设置 > 方案默认模型
    const modelId = model || userLlmModel || getDefaultLLMBySolution(solutionType);
    const modelConfig = LLM_MODELS[modelId as keyof typeof LLM_MODELS];

    console.log(`[LLM] 方案: ${solutionType}, 提供商: ${providerType}, 模型: ${modelId}, 流式: ${stream}`);

    // 根据提供商选择客户端
    if (providerType === 'zhipu') {
      return handleZhipuRequest(fullMessages, {
        model: modelId,
        stream,
        temperature,
        max_tokens,
      });
    } else if (providerType === 'qwen') {
      return handleQwenRequest(fullMessages, {
        model: modelId,
        stream,
        temperature,
        max_tokens,
      });
    } else if (isCompatibleProvider(providerType)) {
      const compatibleUserId = request.headers.get('x-user-id') || 'dev-user';
      return handleCompatibleRequest(compatibleUserId, providerType, fullMessages, {
        model: modelId,
        stream,
        temperature,
        max_tokens,
      });
    } else {
      return handleCozeRequest(request, fullMessages, {
        model: modelId,
        stream,
        temperature,
      });
    }

  } catch (error) {
    console.error('[LLM] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'LLM调用失败' },
      { status: 500 }
    );
  }
}

/**
 * 处理扣子平台请求
 */
async function handleCozeRequest(
  request: NextRequest,
  messages: Message[],
  config: { model: string; stream: boolean; temperature: number }
) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const sdkConfig = new Config();
  const client = new LLMClient(sdkConfig, customHeaders);

  if (config.stream) {
    // 流式响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of client.stream(messages, {
            model: config.model,
            temperature: config.temperature,
          })) {
            if (chunk.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk.content.toString() })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[LLM-Coze] 流式错误:', error);
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
  } else {
    // 非流式响应
    const response = await client.invoke(messages, {
      model: config.model,
      temperature: config.temperature,
    });

    return NextResponse.json({
      provider: 'coze',
      model: config.model,
      content: response.content,
    });
  }
}

/**
 * 处理智谱AI请求
 */
async function handleZhipuRequest(
  messages: Message[],
  config: { model: string; stream: boolean; temperature: number; max_tokens: number }
) {
  if (!isZhipuConfigured()) {
    return NextResponse.json(
      { error: '智谱API未配置，请设置 ZHIPU_API_KEY 环境变量' },
      { status: 400 }
    );
  }

  const client = getZhipuClient();

  // 转换消息格式
  const zhipuMessages = messages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }));

  if (config.stream) {
    // 流式响应
    return client.createStreamResponse(zhipuMessages, {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });
  } else {
    // 非流式响应
    const response = await client.invoke(zhipuMessages, {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });

    return NextResponse.json({
      provider: 'zhipu',
      model: response.model,
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
    });
  }
}

/**
 * 处理千问AI请求
 */
async function handleQwenRequest(
  messages: Message[],
  config: { model: string; stream: boolean; temperature: number; max_tokens: number }
) {
  if (!(await isQwenConfigured('dev-user'))) {
    return NextResponse.json(
      { error: '千问API未配置，请设置 QWEN_API_KEY 环境变量或在设置页面配置' },
      { status: 400 }
    );
  }

  // 获取千问客户端
  const client = await getQwenClientAsync('dev-user');

  // 转换消息格式
  const qwenMessages = messages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }));

  if (config.stream) {
    // 流式响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of client.stream(qwenMessages, {
            model: config.model,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
          })) {
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
          console.error('[LLM-Qwen] 流式错误:', error);
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
  } else {
    // 非流式响应
    const response = await client.invoke(qwenMessages, {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });

    return NextResponse.json({
      provider: 'qwen',
      model: response.model,
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
    });
  }
}

/**
 * 处理 OpenAI 兼容协议提供商请求
 * （火山引擎 / MiniMax / Kimi / DeepSeek / 文心 / 混元 / 自定义端点）
 */
async function handleCompatibleRequest(
  userId: string,
  provider: string,
  messages: Message[],
  config: { model: string; stream: boolean; temperature: number; max_tokens: number }
) {
  const client = await getCompatibleClient(userId, provider as Parameters<typeof getCompatibleClient>[1]);
  if (!client) {
    return NextResponse.json(
      { error: `${provider} API 未配置，请先在模型设置中填写密钥` },
      { status: 400 }
    );
  }

  const compatibleMessages: CompatibleMessage[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const chatConfig: CompatibleChatConfig = {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
  };

  if (config.stream) {
    return client.createStreamResponse(compatibleMessages, chatConfig);
  }

  const response = await client.invoke(compatibleMessages, chatConfig);
  return NextResponse.json({
    provider,
    model: response.model,
    content: response.choices[0]?.message?.content || '',
    usage: response.usage,
  });
}

/**
 * GET: 获取可用的LLM模型列表和方案信息
 */
export async function GET() {
  const models = Object.values(LLM_MODELS).map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    provider: m.provider,
    recommended: m.recommended,
    useCase: m.useCase,
    contextWindow: 'contextWindow' in m ? m.contextWindow : undefined,
    maxOutput: 'maxOutput' in m ? m.maxOutput : undefined,
  }));

  const solutions = Object.values(SOLUTION_PRESETS).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    provider: s.provider,
    defaultModel: s.models.llm,
    features: s.features,
    configured: s.id === 'zhipu' ? isZhipuConfigured() : s.id === 'qwen' ? isQwenConfigured() : true,
  }));

  return NextResponse.json({
    models,
    solutions,
    zhipuConfigured: isZhipuConfigured(),
    qwenConfigured: isQwenConfigured(),
    defaultSolution: 'standard',
  });
}
