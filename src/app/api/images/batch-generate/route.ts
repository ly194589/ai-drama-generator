import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 批量图片生成API
 * 支持角色立绘批量生成、场景图生成、风格一致性控制
 */

// 角色图片提示词模板
const CHARACTER_IMAGE_TEMPLATES: Record<string, string> = {
  // 古装风格
  '古装-仙侠': 'Chinese xianxia drama style, {characterDesc}, wearing {clothing}, ethereal atmosphere, cinematic lighting, 8K quality, professional portrait',
  '古装-宫斗': 'Chinese palace drama style, {characterDesc}, wearing {clothing}, royal atmosphere, elegant pose, dramatic lighting, 8K quality',
  '古装-武侠': 'Chinese martial arts style, {characterDesc}, wearing {clothing}, heroic posture, dynamic action, dramatic background, 8K quality',
  
  // 现代风格
  '现代-都市': 'Modern urban drama style, {characterDesc}, wearing {clothing}, city background, natural lighting, professional photography, 8K quality',
  '现代-甜宠': 'Korean romance drama style, {characterDesc}, wearing {clothing}, soft warm lighting, dreamy atmosphere, 8K quality',
  '现代-职场': 'Business professional style, {characterDesc}, wearing {clothing}, office environment, confident pose, professional photography, 8K quality',
  
  // 悬疑风格
  '悬疑-推理': 'Mystery thriller style, {characterDesc}, wearing {clothing}, dramatic shadow lighting, tense atmosphere, cinematic, 8K quality',
  '悬疑-惊悚': 'Horror thriller style, {characterDesc}, wearing {clothing}, dark atmosphere, eerie lighting, dramatic composition, 8K quality',
  
  // 其他风格
  '民国-谍战': 'Republican era style, {characterDesc}, wearing {clothing}, 1930s Shanghai atmosphere, vintage photography, 8K quality',
  '科幻-未来': 'Sci-fi futuristic style, {characterDesc}, wearing {clothing}, neon lights, cyberpunk atmosphere, 8K quality',
};

// 场景图片提示词模板
const SCENE_IMAGE_TEMPLATES: Record<string, string> = {
  '室内-客厅': 'Interior living room, {style} style, {mood} atmosphere, {lighting} lighting, detailed furniture, cinematic, 8K quality',
  '室内-卧室': 'Interior bedroom, {style} style, {mood} atmosphere, {lighting} lighting, cozy environment, cinematic, 8K quality',
  '室内-办公室': 'Modern office interior, {style} style, {mood} atmosphere, {lighting} lighting, professional environment, cinematic, 8K quality',
  '室外-街道': 'City street scene, {style} style, {mood} atmosphere, {lighting} lighting, urban environment, cinematic, 8K quality',
  '室外-公园': 'Park scene, {style} style, {mood} atmosphere, {lighting} lighting, natural environment, cinematic, 8K quality',
  '室外-山景': 'Mountain landscape, {style} style, {mood} atmosphere, {lighting} lighting, majestic scenery, cinematic, 8K quality',
  '特殊-宫殿': 'Ancient Chinese palace interior, {style} style, {mood} atmosphere, {lighting} lighting, magnificent architecture, cinematic, 8K quality',
  '特殊-竹林': 'Bamboo forest, {style} style, {mood} atmosphere, {lighting} lighting, mysterious environment, cinematic, 8K quality',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type = 'character', // character | scene | storyboard
      characters,
      scenes,
      style = '现代-都市',
      count = 1,
      seriesId,
      referenceImage, // 用于保持风格一致的参考图
    } = body;

    // 获取当前用户ID
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const results: Array<{ url: string; name: string; type: string }> = [];

    if (type === 'character' && characters) {
      // 批量生成角色立绘
      for (const char of characters) {
        const template = CHARACTER_IMAGE_TEMPLATES[style] || CHARACTER_IMAGE_TEMPLATES['现代-都市'];
        const characterDesc = `${char.gender === 'male' ? 'Male' : 'Female'}, ${char.age || 25} years old, ${char.temperament || 'elegant'} expression`;
        
        const prompt = template
          .replace('{characterDesc}', characterDesc)
          .replace('{clothing}', char.clothing || 'modern clothing');

        // 如果有参考图，使用图生图保持风格一致
        let response;
        if (referenceImage) {
          response = await client.generate({
            prompt,
            size: '4K',
            watermark: false,
            image: referenceImage,
          });
        } else {
          response = await client.generate({
            prompt,
            size: '4K',
            watermark: false,
          });
        }
        
        const helper = client.getResponseHelper(response);

        if (helper.success && helper.imageUrls.length > 0) {
          results.push({
            url: helper.imageUrls[0],
            name: char.name,
            type: 'character',
          });
        }
      }
    } else if (type === 'scene' && scenes) {
      // 批量生成场景图
      for (const scene of scenes) {
        const template = SCENE_IMAGE_TEMPLATES[scene.type] || SCENE_IMAGE_TEMPLATES['室内-客厅'];
        
        const prompt = template
          .replace('{style}', style.split('-')[0] || 'modern')
          .replace('{mood}', scene.mood || 'neutral')
          .replace('{lighting}', scene.lighting || 'natural');

        const response = await client.generate({
          prompt,
          size: '4K',
          watermark: false,
        });
        const helper = client.getResponseHelper(response);

        if (helper.success && helper.imageUrls.length > 0) {
          results.push({
            url: helper.imageUrls[0],
            name: scene.name,
            type: 'scene',
          });
        }
      }
    } else if (type === 'storyboard') {
      // 生成分镜参考图（连续故事图）
      const storyboardPrompt = body.prompt || 'A dramatic scene from a short drama';
      
      const response = await client.generate({
        prompt: storyboardPrompt,
        size: '4K',
        watermark: false,
        sequentialImageGeneration: 'auto', // 启用连续图生成
        sequentialImageGenerationMaxImages: Math.min(count, 5),
      });
      const helper = client.getResponseHelper(response);

      if (helper.success) {
        helper.imageUrls.forEach((url, index) => {
          results.push({
            url,
            name: `storyboard-${index + 1}`,
            type: 'storyboard',
          });
        });
      }
    }

    // 保存到数据库
    if (seriesId && results.length > 0) {
      const supabase = getSupabaseClient();
      
      for (const result of results) {
        await supabase.from('image_materials').insert({
          title: result.name,
          category: result.type,
          file_key: result.url,
          file_name: `${result.name}-${Date.now()}.png`,
          tags: [style, result.type, 'AI生成'],
          series_id: seriesId,
          user_id: userId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      images: results,
      count: results.length,
    });

  } catch (error) {
    console.error('批量图片生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
