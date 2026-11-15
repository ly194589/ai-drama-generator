import { NextRequest, NextResponse } from 'next/server';
import { getZhipuClientAsync, isZhipuConfiguredForUser, ZHIPU_MODELS } from '@/lib/zhipu-client';

/**
 * 智谱AI模型测试接口
 * GET: 检查配置状态和可用模型
 * POST: 测试模型调用
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'dev-user';
  const configured = await isZhipuConfiguredForUser(userId);
  
  return NextResponse.json({
    configured,
    message: configured 
      ? '智谱API已配置，可以使用' 
      : '智谱API未配置，请在方案设置中配置 API Key',
    models: Object.values(ZHIPU_MODELS).map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      recommended: m.recommended,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { message, model, stream } = await request.json();
    
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const configured = await isZhipuConfiguredForUser(userId);
    
    if (!configured) {
      return NextResponse.json(
        { error: '智谱API未配置，请在方案设置中配置 API Key' },
        { status: 400 }
      );
    }
    
    const client = await getZhipuClientAsync(userId);
    const messages = [
      { role: 'system' as const, content: '你是智谱AI助手，请用中文简洁回答用户问题。' },
      { role: 'user' as const, content: message || '你好，请介绍一下你自己。' },
    ];
    
    const modelId = model || 'glm-5.3';
    
    // 流式响应
    if (stream) {
      return client.createStreamResponse(messages, { model: modelId });
    }
    
    // 非流式响应
    const response = await client.invoke(messages, { model: modelId });
    const content = response.choices[0]?.message?.content || '';
    
    return NextResponse.json({
      success: true,
      model: response.model,
      content,
      usage: response.usage,
    });
    
  } catch (error) {
    console.error('[智谱测试] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '测试失败' },
      { status: 500 }
    );
  }
}
