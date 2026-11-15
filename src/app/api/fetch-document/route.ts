import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 文档解析 API
 * 支持解析各种文档格式（PDF、Office文档、电子书等）
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: '请提供文档URL' },
        { status: 400 }
      );
    }

    console.log(`[文档解析] 开始解析: ${url}`);

    // 提取请求头并转发
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    // 获取文档内容
    const response = await client.fetch(url);

    if (response.status_code !== 0) {
      console.error(`[文档解析] 失败: ${response.status_message}`);
      return NextResponse.json(
        { error: response.status_message || '文档解析失败' },
        { status: 500 }
      );
    }

    // 提取文本内容
    const textContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    console.log(`[文档解析] 成功: 标题=${response.title}, 内容长度=${textContent.length}`);

    return NextResponse.json({
      success: true,
      title: response.title,
      filetype: response.filetype,
      content: textContent,
      rawContent: response.content,
    });
  } catch (error) {
    console.error('[文档解析] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '文档解析失败' },
      { status: 500 }
    );
  }
}
