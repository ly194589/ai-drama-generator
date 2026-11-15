import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage, ImageGenerationClient, Config, HeaderUtils, LLMClient } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 为短剧生成宣传图/海报
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      type = 'poster', // poster, promotional, character, scene
      purpose = '封面', // 封面、海报、Banner、分享图
      style = '现代',
      mood = '浪漫',
      platform = '抖音',
      dimensions = '9:16', // 9:16, 1:1, 16:9
      customPrompt = '',
    } = body;

    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (!series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    // 获取图片风格
    const imageStyle = (series.image_style as string) || 'realistic';
    const isComicStyle = imageStyle === 'comic';

    // 提取转发头部
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    // 根据类型生成不同的提示词
    let finalPrompt = '';
    
    if (customPrompt) {
      finalPrompt = customPrompt;
    } else {
      // 使用AI生成提示词
      const llmClient = new LLMClient(config, customHeaders);

      // 根据图片风格设置不同的要求
      const styleRequirements = isComicStyle
        ? `【核心风格要求 - 必须遵守】
1. 必须是精美漫画风格（anime style, manga style, illustration）
2. 精致的线条和鲜艳的色彩（clean lines, vibrant colors）
3. 二次元人物特征（anime features, big eyes, stylized hair）
4. 高质量插画品质（high quality illustration, detailed artwork）
5. 禁止任何写实、真人、摄影风格（NO photorealistic, NO realistic photography）

【提示词格式要求】
请生成一个详细的AI绘画提示词（英文），包含：
1. 开头必须包含：anime style, manga illustration, high quality
2. 主体描述（人物/场景）
3. 风格描述（漫画风格、色调）
4. 构图建议
5. 氛围营造
6. 结尾必须包含：NO photorealistic, NO realistic photography, anime illustration quality`
        : `【核心风格要求 - 必须遵守】
1. 必须是写实风格（photorealistic, realistic photography）
2. 真实的光影效果（natural lighting, cinematic lighting）
3. 真实的材质质感（realistic textures, detailed skin/clothing/fabric）
4. 专业摄影品质（professional photography, high quality）
5. 禁止任何动漫、漫画、二次元、卡通、Q版风格（NO anime, NO cartoon, NO illustration style）

【提示词格式要求】
请生成一个详细的AI绘画提示词（英文），包含：
1. 开头必须包含：photorealistic, realistic photography, real person
2. 主体描述（人物/场景）
3. 风格描述（写实风格、色调）
4. 构图建议
5. 氛围营造
6. 结尾必须包含：NO anime, NO cartoon, NO illustration style, professional photography quality`;

      const promptGenRequest = `你是一个专业的${isComicStyle ? '动漫插画师' : '电影海报设计师'}。请为以下短剧设计${purpose}的AI绘画提示词。

【剧本信息】
标题：${series.title}
题材：${series.genre}
风格：${series.style}
简介：${series.description || '暂无'}
核心冲突：${series.core_conflict || '暂无'}

【设计要求】
图片类型：${type === 'poster' ? '海报' : type === 'promotional' ? '宣传图' : type === 'character' ? '角色图' : '场景图'}
用途：${purpose}
视觉风格：${style}
情绪基调：${mood}
平台：${platform}
尺寸比例：${dimensions}

${styleRequirements}

请直接输出提示词，不要有任何解释。`;

      const response = await llmClient.invoke([
        { role: 'user', content: promptGenRequest }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.8,
      });

      finalPrompt = response?.content || `A ${style} ${type} for a ${series.genre} drama, ${mood} mood, professional quality, highly detailed`;
    }

    // 根据尺寸比例计算图片尺寸
    let imgWidth = 768;
    let imgHeight = 1344;
    
    switch (dimensions) {
      case '9:16':
        imgWidth = 768;
        imgHeight = 1344;
        break;
      case '16:9':
        imgWidth = 1344;
        imgHeight = 768;
        break;
      case '1:1':
        imgWidth = 1024;
        imgHeight = 1024;
        break;
      case '4:3':
        imgWidth = 1024;
        imgHeight = 768;
        break;
      case '3:4':
        imgWidth = 768;
        imgHeight = 1024;
        break;
    }

    // 调用图片生成服务
    const imageClient = new ImageGenerationClient(config, customHeaders);
    
    const imageResponse = await imageClient.generate({
      prompt: finalPrompt,
      size: `${imgWidth}x${imgHeight}`,
    });

    const helper = imageClient.getResponseHelper(imageResponse);

    if (!helper.success || helper.imageUrls.length === 0) {
      return NextResponse.json(
        { error: helper.errorMessages.join(', ') || '生成图片失败' },
        { status: 500 }
      );
    }

    const generatedImageUrl = helper.imageUrls[0];

    // 下载生成的图片并上传到对象存储
    const downloadResponse = await fetch(generatedImageUrl);
    const imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());

    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: `images/generated/${id}/${type}-${Date.now()}.png`,
      contentType: 'image/png',
    });

    // 保存到数据库
    const { data: image, error } = await supabase
      .from('image_materials')
      .insert({
        title: `${series.title} - ${purpose}`,
        description: `${series.title}的${purpose}`,
        type,
        category: type,
        file_key: fileKey,
        file_name: `${series.title}-${purpose}-${Date.now()}.png`,
        file_size: imageBuffer.length,
        width: imgWidth,
        height: imgHeight,
        format: 'png',
        thumbnail_key: fileKey,
        series_id: id,
        purpose,
        style,
        mood,
        platform,
        dimensions,
        is_ai_generated: true,
        generation_prompt: finalPrompt,
        tags: [series.genre, series.style, mood],
      })
      .select()
      .single();

    if (error) {
      console.error('保存图片信息失败:', error);
    }

    // 获取图片URL
    const imageUrl = await storage.generatePresignedUrl({ key: fileKey });

    return NextResponse.json({
      success: true,
      image: {
        ...image,
        imageUrl,
        thumbnailUrl: imageUrl,
        prompt: finalPrompt,
      },
    });
  } catch (error) {
    console.error('生成图片失败:', error);
    return NextResponse.json(
      { error: '生成图片失败' },
      { status: 500 }
    );
  }
}
