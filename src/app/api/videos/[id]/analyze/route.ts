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

// 视频分析
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

    // 更新状态为处理中
    await supabase
      .from('video_materials')
      .update({ status: 'processing' })
      .eq('id', id);

    // 初始化LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 分析提示词
    const analyzePrompt = `你是一个专业的短视频内容分析师。请分析以下视频信息，并生成详细的分析报告：

视频标题：${video.title}
视频描述：${video.description || '无'}
文件名：${video.file_name}
文件大小：${((video.file_size as number) / 1024 / 1024).toFixed(2)} MB

请从以下几个方面进行分析：

1. **风格分析**
   - 视频类型（剧情、搞笑、情感、科普等）
   - 叙事风格（线性、倒叙、插叙）
   - 镜头风格（快节奏、慢节奏、文艺、写实）

2. **角色特征**
   - 主要角色数量
   - 角色类型（主角、配角、群演）
   - 角色特征（年龄范围、性别、气质）

3. **节奏分析**
   - 整体节奏（快/中/慢）
   - 关键时间点（开头、转折、高潮、结尾）
   - 情绪曲线变化

4. **画面风格**
   - 色调（暖色、冷色、自然）
   - 光线（明亮、昏暗、对比强烈）
   - 构图特点

5. **音频特点**
   - 是否有背景音乐
   - 是否有人声对话
   - 音效使用情况

6. **创作建议**
   - 如何复刻类似风格
   - 关键要素提炼
   - 改进建议

请以JSON格式输出，格式如下：
{
  "style": { "type": "", "narrative": "", "camera": "" },
  "characters": [{ "role": "", "type": "", "age": "", "gender": "", "temperament": "" }],
  "rhythm": { "overall": "", "keyPoints": [], "emotionCurve": "" },
  "visual": { "colorTone": "", "lighting": "", "composition": "" },
  "audio": { "bgm": false, "dialogue": false, "soundEffects": [] },
  "suggestions": { "replicate": [], "keyElements": [], "improvements": [] }
}`;

    // 调用LLM进行分析
    const response = await llmClient.invoke([
      { role: 'user', content: analyzePrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    let analysisResult = {};
    
    if (response?.content) {
      const content = response.content.trim();
      try {
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          analysisResult = { rawAnalysis: content };
        }
      } catch {
        analysisResult = { rawAnalysis: content };
      }
    }

    // 更新数据库
    const { data: updatedVideo, error: updateError } = await supabase
      .from('video_materials')
      .update({
        status: 'analyzed',
        metadata: analysisResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('更新数据库错误:', updateError);
    }

    // 生成访问URL
    const videoUrl = await storage.generatePresignedUrl({ 
      key: video.file_key as string, 
      expireTime: 86400 
    });

    return NextResponse.json({
      success: true,
      video: {
        ...updatedVideo,
        videoUrl,
      },
      analysis: analysisResult,
    });
  } catch (error) {
    console.error('视频分析失败:', error);
    
    // 更新状态为错误
    const { id } = await params;
    const supabase = getSupabaseClient();
    await supabase
      .from('video_materials')
      .update({ status: 'error' })
      .eq('id', id);

    return NextResponse.json(
      { error: '视频分析失败' },
      { status: 500 }
    );
  }
}
