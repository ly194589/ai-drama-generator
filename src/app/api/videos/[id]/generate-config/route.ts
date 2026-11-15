import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 基于视频生成短剧配置
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 获取视频信息
    const { data: video, error: fetchError } = await supabase
      .from('video_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !video) {
      return NextResponse.json(
        { error: '视频不存在' },
        { status: 404 }
      );
    }

    // 如果未分析，先分析
    if (video.status !== 'analyzed' && !video.metadata) {
      return NextResponse.json(
        { error: '请先分析视频' },
        { status: 400 }
      );
    }

    // 初始化LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 生成配置提示词
    const generatePrompt = `基于以下视频分析结果，生成一个完整的短剧配置方案：

参考视频分析：
${JSON.stringify(video.metadata, null, 2)}

请生成完整的短剧配置，包括：
1. 角色档案（2-4个主要角色）
2. 分镜剧本（15-20个镜头）
3. 一致性规则
4. 节奏锚点

要求：
- 保持参考视频的风格特点
- 原创剧情，不要照搬
- 符合抖音短视频规范
- 包含完整的视觉和音频指导

请以JSON格式输出完整配置。`;

    // 调用LLM生成配置
    const response = await llmClient.invoke([
      { role: 'user', content: generatePrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.8,
    });

    let finalConfig: Record<string, unknown> = {};
    
    if (response?.content) {
      const content = response.content.trim();
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          finalConfig = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error('解析配置失败');
      }
    }

    const metadata = video.metadata as Record<string, unknown>;
    const style = metadata?.style as Record<string, unknown> | undefined;

    // 生成完整配置
    const configResult = {
      sourceVideo: {
        id: video.id,
        title: video.title,
        analysis: video.metadata,
      },
      title: (finalConfig.title as string) || `${video.title}风格短剧`,
      genre: (style?.type as string) || '都市情感',
      duration: '300秒',
      aspectRatio: '9:16',
      resolution: '1080P',
      characters: (finalConfig.characters as unknown[]) || [],
      storyboards: (finalConfig.storyboards as unknown[]) || [],
      consistencyRules: (finalConfig.consistencyRules as Record<string, unknown>) || {
        character: {
          description: '人物全程一致',
          rules: ['不换脸、不变装、不换发型', '表情统一', '微动作统一', '站位统一']
        },
        visual: {
          description: '画面全程一致',
          rules: ['比例：9:16竖屏', '风格：超写实真人电影风', '色调统一', '运镜规范']
        },
        audio: {
          description: '声音全程一致',
          rules: ['每个角色绑定唯一音色', '音量标准化', '混响统一']
        }
      },
      rhythmAnchors: (finalConfig.rhythmAnchors as unknown[]) || [
        { time: '0-3秒', event: '强钩子' },
        { time: '30秒', event: '第一次冲突' },
        { time: '90秒', event: '第一次反转' },
        { time: '150秒', event: '情绪最高点' },
        { time: '210秒', event: '第二次反转' },
        { time: '270-300秒', event: '强结尾+留悬念' }
      ],
      generatedAt: new Date().toISOString(),
      platform: '扣子(Coze) AI应用开发平台'
    };

    return NextResponse.json({
      success: true,
      config: configResult,
      message: '短剧配置生成完成'
    });
  } catch (error) {
    console.error('生成配置失败:', error);
    return NextResponse.json(
      { error: '生成配置失败' },
      { status: 500 }
    );
  }
}
