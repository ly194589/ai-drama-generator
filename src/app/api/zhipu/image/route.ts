import { NextRequest, NextResponse } from 'next/server';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';

/**
 * 智谱图片生成API
 * 使用 Cogview-3-Flash 模型（免费）
 * 
 * 文档: https://docs.bigmodel.cn/cn/guide/models/free/glm-image
 * 速率限制: 10 RPM
 * 
 * POST /api/zhipu/image
 * Body: {
 *   prompt: string,     // 图片描述
 *   size?: '1024x1024' | '768x1024' | '1024x768',  // 图片尺寸
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const configured = await isZhipuConfiguredForUser(userId);
    
    if (!configured) {
      return NextResponse.json(
        { error: '智谱API未配置，请在方案设置中配置 API Key' },
        { status: 400 }
      );
    }

    const { prompt, size } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt 参数必填' },
        { status: 400 }
      );
    }

    const client = await getZhipuClientAsync(userId);
    const response = await client.generateImage(prompt, { size });

    console.log(`[智谱图片] 生成成功`);

    // 提取图片URL
    const images = response.data?.map((item) => ({
      url: item.url,
      b64Json: item.b64_json,
    })) || [];

    return NextResponse.json({
      success: true,
      model: 'glm-image',
      images,
      created: response.created,
    });

  } catch (error) {
    console.error('[智谱图片] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片生成失败' },
      { status: 500 }
    );
  }
}
