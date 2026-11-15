import { NextRequest } from 'next/server';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';

const SYSTEM_PROMPT = `你是专业的AI短剧顾问，帮助用户解决短剧创作中的问题。

你可以帮助用户：
1. 优化剧本创意和冲突设计
2. 角色塑造建议
3. 分镜技巧指导
4. 节奏把控建议
5. 提示词优化

回答要简洁实用，聚焦于抖音短剧特点。`;

/**
 * 智谱AI顾问对话流式接口
 * 使用智谱 GLM-4 系列模型
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const configured = await isZhipuConfiguredForUser(userId);
    
    if (!configured) {
      return new Response(
        JSON.stringify({ error: '智谱API未配置，请在方案设置中配置 API Key' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { message, history, model } = await request.json();
    const client = await getZhipuClientAsync(userId);

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...(history || []),
      { role: 'user' as const, content: message }
    ];

    console.log(`[智谱Chat] 模型: ${model || 'glm-5.3'}`);

    // 返回流式响应
    return client.createStreamResponse(messages, {
      model: model || 'glm-5.3',
      temperature: 0.7,
    });

  } catch (error) {
    console.error('[智谱Chat] 错误:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '对话失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
