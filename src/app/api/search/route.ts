import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { query, count, sites, timeRange } = await request.json();
    
    console.log('[Search API] 开始搜索:', { query, count, sites, timeRange });
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new SearchClient(config, customHeaders);

    // 如果 sites 为空字符串，不添加站点限制
    const searchOptions: Parameters<typeof client.advancedSearch>[1] = {
      searchType: 'web',
      count: count || 10,
      needContent: true,
      needUrl: true,
      timeRange: timeRange || '1m',
      needSummary: true,
    };
    
    // 只有当 sites 有值时才添加站点限制
    if (sites && sites.trim()) {
      searchOptions.sites = sites;
    }

    console.log('[Search API] 搜索选项:', JSON.stringify(searchOptions, null, 2));
    
    const response = await client.advancedSearch(query || '豆包 Seedream 5.0 图片生成模型 API 文档', searchOptions);

    console.log('[Search API] 搜索结果数量:', response.web_items?.length || 0);
    console.log('[Search API] 搜索结果摘要:', response.summary?.substring(0, 200));

    return NextResponse.json({
      summary: response.summary,
      results: response.web_items?.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        content: item.content?.substring(0, 2000), // 限制内容长度
        siteName: item.site_name,
        publishTime: item.publish_time,
        authInfo: item.auth_info_des,
      })) || [],
    });
  } catch (error) {
    console.error('[Search API] 搜索失败:', error);
    return NextResponse.json(
      { error: '搜索失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query') || '豆包 Seedream 5.0 图片生成模型 API 文档';
  const count = parseInt(searchParams.get('count') || '10');
  
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new SearchClient(config, customHeaders);

    const response = await client.advancedSearch(query, {
      searchType: 'web',
      count,
      sites: 'volcengine.com,bytedance.com',
      needContent: true,
      needUrl: true,
      timeRange: '1m',
      needSummary: true,
    });

    return NextResponse.json({
      summary: response.summary,
      results: response.web_items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        content: item.content?.substring(0, 2000),
        siteName: item.site_name,
        publishTime: item.publish_time,
        authInfo: item.auth_info_des,
      })),
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return NextResponse.json(
      { error: '搜索失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
