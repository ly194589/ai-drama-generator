import { NextRequest } from 'next/server';
import { createLLMClient } from '@/lib/service-factory';
import { DEFAULT_MODELS } from '@/lib/config';

const SYSTEM_PROMPT = `你是专业的AI短剧顾问，帮助用户解决短剧创作中的问题。

你可以帮助用户：
1. 优化剧本创意和冲突设计
2. 角色塑造建议
3. 分镜技巧指导
4. 节奏把控建议
5. 提示词优化

回答要简洁实用，聚焦于抖音短剧特点。`;

/**
 * AI顾问对话流式接口
 * 使用扣子内置 Doubao-Seed-2.0-pro 模型
 * 支持用户自己的扣子Token
 */
export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // 使用服务工厂创建LLM客户端（支持用户Token）
    const { client, useUserToken } = await createLLMClient(request);

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...(history || []),
      { role: 'user' as const, content: message }
    ];

    console.log(`[Chat] 模型: ${DEFAULT_MODELS.llm}, 使用用户Token: ${useUserToken}`);

    // 创建流式响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of client.stream(messages, {
            model: DEFAULT_MODELS.llm,
            temperature: 0.7
          })) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content.toString() })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[Chat] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[Chat] 错误:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '对话失败' }),
      { status: 500 }
    );
  }
}
