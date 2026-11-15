import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(url);

    // 提取文本内容
    const textContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    return NextResponse.json({
      title: response.title,
      url: response.url,
      publishTime: response.publish_time,
      fileType: response.filetype,
      textContent,
      rawContent: response.content,
    });
  } catch (error) {
    console.error('[Fetch URL] 获取失败:', error);
    return NextResponse.json(
      { error: '获取失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
