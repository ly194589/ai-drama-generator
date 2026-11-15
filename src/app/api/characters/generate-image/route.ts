import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { DEFAULT_MODELS, SOLUTION_PRESETS, IMAGE_MODELS, SolutionType } from '@/lib/config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import {
  getAgeGroup,
  AGE_GROUP_BOUNDARIES,
  AGE_FACIAL_FEATURES,
  AGE_HAIRSTYLE_FEATURES,
  AGE_BODY_FEATURES,
  type AgeGroup,
} from '@/lib/age-features';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 获取用户的方案选择
 */
async function getUserSolution(userId: string): Promise<SolutionType> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('user_config')
    .select('solution_preset')
    .eq('user_id', userId)
    .single();
  
  const preset = data?.solution_preset;
  if (preset === 'zhipu') {
    return 'zhipu';
  }
  return 'standard';
}

/**
 * 获取符合 Seedream 5.0 Lite 要求的人物立绘尺寸 (9:16 竖版)
 * 
 * Seedream 5.0 Lite 要求：
 * - 总像素范围：[2560x1440=3686400, 4096x4096=16777216]
 * - 宽高比范围：[1/16, 16]
 * 
 * 人物立绘使用 9:16 竖版：
 * - 1440x2560 (9:16) - 2K 标准，总像素 3686400
 * 
 * 适用于：角色人物立绘
 */
function getPortraitSize(): string {
  // 人物立绘使用 9:16 竖版
  // 1440x2560 = 3686400，符合 Seedream 5.0 Lite 的像素下限
  return '1440x2560';
}

/**
 * 根据年龄生成详细的人物外貌描述
 */
function generateAgeAppropriateDescription(
  age: number,
  gender: 'male' | 'female',
  style: string,
  customDescriptions: {
    faceShape?: string;
    hairstyle?: string;
    clothing?: string;
    skinTone?: string;
    temperament?: string;
  }
): string {
  const ageGroup = getAgeGroup(age);
  const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;
  const genderDesc = gender === 'male' ? '男性' : '女性';
  
  // 获取年龄对应的特征配置
  const facialFeatures = AGE_FACIAL_FEATURES[ageGroup];
  const hairstyleFeatures = AGE_HAIRSTYLE_FEATURES[ageGroup];
  const bodyFeatures = AGE_BODY_FEATURES[ageGroup];
  
  // 构建外貌描述
  const descriptions: string[] = [];
  
  // 年龄和性别基础描述
  descriptions.push(`${ageLabel}${genderDesc}，约${age}岁`);
  
  // 脸型描述（优先使用用户自定义，否则根据年龄自动生成）
  if (customDescriptions.faceShape) {
    descriptions.push(`脸型：${customDescriptions.faceShape}`);
  } else {
    const defaultFace = facialFeatures.faceShape[0];
    descriptions.push(`脸型：${defaultFace}`);
  }
  
  // 皮肤质感（根据年龄自动添加）
  const skinTexture = facialFeatures.skinTexture[0];
  if (customDescriptions.skinTone) {
    descriptions.push(`肤色：${customDescriptions.skinTone}，${skinTexture}`);
  } else {
    descriptions.push(`皮肤：${skinTexture}`);
  }
  
  // 眼部特征（根据年龄自动添加）
  const eyeFeature = facialFeatures.eyeCharacteristics[0];
  descriptions.push(`眼睛：${eyeFeature}`);
  
  // 皱纹特征（仅中老年显示）
  if (ageGroup === 'adult' || ageGroup === 'elderly') {
    const wrinkles = facialFeatures.wrinkles.filter(w => w !== '无皱纹' && w !== '基本无皱纹' && w !== '光滑平整');
    if (wrinkles.length > 0) {
      descriptions.push(`岁月痕迹：${wrinkles.slice(0, 2).join('，')}`);
    }
  }
  
  // 发型描述（优先使用用户自定义，否则根据年龄生成建议）
  if (customDescriptions.hairstyle) {
    descriptions.push(`发型：${customDescriptions.hairstyle}`);
  } else {
    const hairColor = hairstyleFeatures.hairColor[0];
    const hairStyle = hairstyleFeatures.commonStyles[0];
    descriptions.push(`发型：${hairColor}，${hairStyle}`);
  }
  
  // 体型描述（根据年龄自动添加）
  const bodyType = bodyFeatures.bodyType[0];
  const posture = bodyFeatures.posture[0];
  descriptions.push(`体态：${bodyType}，${posture}`);
  
  // 服装描述
  if (customDescriptions.clothing) {
    descriptions.push(`服装：${customDescriptions.clothing}`);
  }
  
  // 气质描述
  if (customDescriptions.temperament) {
    descriptions.push(`气质：${customDescriptions.temperament}`);
  }
  
  return descriptions.join('。');
}

/**
 * 根据风格生成风格提示词
 */
function getStylePrompt(style: string, ageGroup: AgeGroup): string {
  const styleMap: Record<string, string> = {
    '古风': '中国古代背景，古典服饰，唯美古风风格，水墨意境，传统美学',
    '科幻': '未来科幻背景，赛博朋克风格，霓虹光影，科技感',
    '现代': '现代都市背景，时尚摄影风格，柔和自然光，专业摄影',
    '唯美': '梦幻唯美风格，柔和光影，艺术感，浪漫氛围',
    '暗黑': '暗黑风格，戏剧性光影，神秘氛围，电影质感',
    '动漫': '动漫风格，日系插画，精致细腻，二次元美学',
    '写实': '写实摄影风格，真实质感，高清画质，专业人像',
  };
  
  const baseStyle = styleMap[style] || styleMap['写实'];
  
  // 根据年龄调整风格描述
  const ageAdjustments: Record<AgeGroup, string> = {
    child: '可爱活泼的视觉效果，明亮柔和的光线',
    youth: '青春活力的视觉效果，时尚现代的感觉',
    adult: '成熟稳重的视觉效果，专业大气的质感',
    elderly: '沧桑睿智的视觉效果，温暖柔和的光线',
  };
  
  return `${baseStyle}，${ageAdjustments[ageGroup]}`;
}

/**
 * 角色形象生成API
 * 根据用户方案选择模型：
 * - standard: 扣子 Doubao-Seedream-5.0-Lite (支持2K/4K，提示词优化)
 * - zhipu: 智谱 Cogview-3-Flash (免费)
 * 
 * 根据角色档案生成人物形象图片，保存到图片素材库
 * 
 * Seedream 5.0 Lite 优化：
 * - 使用有效尺寸：1440x2560（9:16竖版，符合像素范围要求）
 * - 支持提示词优化：standard（高质量）/ fast（快速）
 * 
 * 请求参数：
 * - characterId: 角色ID（可选，用于关联已有角色）
 * - characterName: 角色姓名
 * - gender: 性别 (male/female)
 * - age: 年龄（必填，用于确定年龄分组）
 * - faceShape: 脸型描述
 * - hairstyle: 发型描述
 * - clothing: 服装描述
 * - skinTone: 肤色
 * - temperament: 气质描述
 * - style: 风格（现代/古风/科幻等）
 * - seriesId: 剧集ID（用于关联剧集）
 * - saveToLibrary: 是否保存到素材库（默认true）
 * - generateMultiple: 是否生成多角度（默认false，生成正面/侧面/背影）
 * - optimizePromptMode: 提示词优化模式（standard/fast，默认standard）
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);

    const body = await request.json();
    const {
      characterId,
      characterName,
      gender,
      age,
      faceShape,
      hairstyle,
      clothing,
      skinTone,
      temperament,
      style = '现代',
      seriesId,
      saveToLibrary = true,
      generateMultiple = false,
      optimizePromptMode = 'standard',  // 新增：提示词优化模式
    } = body;

    if (!characterName) {
      return NextResponse.json(
        { error: '请提供角色姓名' },
        { status: 400 }
      );
    }

    if (!age || age < 0 || age > 120) {
      return NextResponse.json(
        { error: '请提供有效的年龄（0-120岁）' },
        { status: 400 }
      );
    }

    // 确定年龄分组
    const ageGroup = getAgeGroup(age);
    const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;

    // 生成符合年龄特征的外貌描述
    const characterDescription = generateAgeAppropriateDescription(
      age,
      gender || 'female',
      style,
      { faceShape, hairstyle, clothing, skinTone, temperament }
    );

    // 获取风格提示词
    const stylePrompt = getStylePrompt(style, ageGroup);

    // 构建完整的生成提示词
    const basePrompt = `高质量人物肖像摄影，${characterDescription}，${stylePrompt}，清晰的面部特征，专业的摄影构图，高清画质，电影级光影效果。

【年龄特征要求】
- 角色${ageLabel}，务必体现该年龄段的面部特征、皮肤质感、眼神神态
- 发型、服装要符合${ageLabel}角色的气质
- 整体形象要真实自然，避免年龄与外貌不符

【生成要求】
- 保持人物特征鲜明且一致
- 服装和发型要清晰可辨
- 面部表情自然
- 适合用作影视角色定妆照
- 标签：角色形象，${characterName}，${style}风格，${ageLabel}`;

    const model = solution === 'zhipu' 
      ? SOLUTION_PRESETS.zhipu.models.image 
      : DEFAULT_MODELS.image;

    console.log(`[角色立绘] 方案: ${solution}, 模型: ${model}, 角色: ${characterName}, 年龄: ${age}岁(${ageLabel}), 提示词优化: ${optimizePromptMode}`);

    // 如果需要生成多角度
    if (generateMultiple) {
      return await generateMultipleAngles(
        request,
        userId,
        solution,
        model,
        characterName,
        age,
        ageGroup,
        gender,
        characterDescription,
        stylePrompt,
        basePrompt,
        seriesId,
        characterId,
        optimizePromptMode
      );
    }

    // 单张生成
    let imageUrl: string;

    if (solution === 'zhipu') {
      const result = await generateWithZhipu(userId, basePrompt);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      imageUrl = result.imageUrl!;
    } else {
      // Seedream 5.0 Lite 生成
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new ImageGenerationClient(config, customHeaders);

      // 获取模型配置
      const modelConfig = IMAGE_MODELS[model as keyof typeof IMAGE_MODELS];
      const portraitSize = getPortraitSize();

      console.log(`[Seedream 5.0 Lite] 尺寸: ${portraitSize}, 提示词优化: ${optimizePromptMode}`);

      const response = await client.generate({
        prompt: basePrompt,
        size: portraitSize,
        watermark: false,
        optimizePromptMode: modelConfig?.features?.optimizePrompt ? optimizePromptMode : undefined,
      });

      const helper = client.getResponseHelper(response);
      if (!helper.success || helper.imageUrls.length === 0) {
        return NextResponse.json(
          { error: helper.errorMessages.join(', ') || '生成角色形象失败' },
          { status: 500 }
        );
      }
      imageUrl = helper.imageUrls[0];
    }

    let savedImage = null;

    // 保存到素材库
    if (saveToLibrary) {
      savedImage = await saveImageToLibrary(
        imageUrl,
        characterName,
        age,
        ageGroup,
        gender,
        style,
        characterDescription,
        basePrompt,
        seriesId,
        characterId
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      savedImage,
      prompt: basePrompt,
      solution,
      model,
      character: {
        name: characterName,
        gender,
        age,
        ageGroup,
        ageLabel,
        description: characterDescription,
      },
    });
  } catch (error) {
    console.error('生成角色形象失败:', error);
    return NextResponse.json(
      { error: '生成角色形象失败' },
      { status: 500 }
    );
  }
}

/**
 * 生成多角度角色形象（正面、侧面、背影）
 * 使用 Seedream 5.0 Lite 的推荐尺寸
 */
async function generateMultipleAngles(
  request: NextRequest,
  userId: string,
  solution: SolutionType,
  model: string,
  characterName: string,
  age: number,
  ageGroup: AgeGroup,
  gender: string | undefined,
  characterDescription: string,
  stylePrompt: string,
  basePrompt: string,
  seriesId?: string,
  characterId?: string,
  optimizePromptMode: string = 'standard'
): Promise<NextResponse> {
  const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;
  const portraitSize = getPortraitSize();
  
  // 角度配置
  const angles = [
    { name: '正面', desc: '正面全身照或半身照，清晰展示面部特征' },
    { name: '侧面', desc: '侧面轮廓照，展示侧面线条和五官轮廓' },
    { name: '背影', desc: '背影照，展示整体身形和服装背面' },
  ];

  const results: Array<{
    angle: string;
    imageUrl: string;
    savedImage?: unknown;
  }> = [];

  for (const angle of angles) {
    const anglePrompt = `${basePrompt}

【角度要求】
- ${angle.desc}
- 保持与其他角度的服装、发型、体态一致`;

    try {
      let imageUrl: string;

      if (solution === 'zhipu') {
        const result = await generateWithZhipu(userId, anglePrompt);
        if (!result.success) {
          console.error(`[${angle.name}角度生成失败]`, result.error);
          continue;
        }
        imageUrl = result.imageUrl!;
      } else {
        // Seedream 5.0 Lite 生成
        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const config = new Config();
        const client = new ImageGenerationClient(config, customHeaders);

        // 获取模型配置
        const modelConfig = IMAGE_MODELS[model as keyof typeof IMAGE_MODELS];

        const response = await client.generate({
          prompt: anglePrompt,
          size: portraitSize,
          watermark: false,
          optimizePromptMode: modelConfig?.features?.optimizePrompt ? optimizePromptMode : undefined,
        });

        const helper = client.getResponseHelper(response);
        if (!helper.success || helper.imageUrls.length === 0) {
          console.error(`[${angle.name}角度生成失败]`, helper.errorMessages);
          continue;
        }
        imageUrl = helper.imageUrls[0];
      }

      // 保存到素材库
      const savedImage = await saveImageToLibrary(
        imageUrl,
        `${characterName}-${angle.name}`,
        age,
        ageGroup,
        gender,
        stylePrompt.split('，')[0],
        `${characterDescription}，${angle.name}角度`,
        anglePrompt,
        seriesId,
        characterId
      );

      results.push({
        angle: angle.name,
        imageUrl,
        savedImage,
      });

      console.log(`[角色立绘] ${characterName} ${angle.name}角度生成成功`);
    } catch (error) {
      console.error(`[${angle.name}角度生成异常]`, error);
    }
  }

  return NextResponse.json({
    success: results.length > 0,
    results,
    totalGenerated: results.length,
    character: {
      name: characterName,
      gender,
      age,
      ageGroup,
      ageLabel,
      description: characterDescription,
    },
    solution,
    model,
    size: portraitSize,
    optimizePromptMode,
  });
}

/**
 * 保存图片到素材库
 */
async function saveImageToLibrary(
  imageUrl: string,
  characterName: string,
  age: number,
  ageGroup: AgeGroup,
  gender: string | undefined,
  style: string,
  description: string,
  prompt: string,
  seriesId?: string,
  characterId?: string
): Promise<unknown> {
  try {
    // 下载图片并上传到对象存储
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: `images/character/${Date.now()}-${characterName}.jpg`,
      contentType: 'image/jpeg',
    });

    // 保存到数据库
    // 使用 Seedream 5.0 Lite 推荐尺寸
    const supabase = getSupabaseClient();
    const { data: image, error } = await supabase
      .from('image_materials')
      .insert({
        title: `${characterName} - 角色形象`,
        description: `${characterName}的角色定妆照（${age}岁，${AGE_GROUP_BOUNDARIES[ageGroup].label}）。${description}`,
        type: 'character',
        category: '角色形象',
        file_key: fileKey,
        file_name: `${characterName}.jpg`,
        file_size: imageBuffer.length,
        width: 1440,   // Seedream 5.0 Lite 9:16 竖版
        height: 2560,  // 9:16 人物立绘
        format: 'jpg',
        thumbnail_key: fileKey,
        series_id: seriesId || null,
        character_id: characterId || null,
        character_name: characterName,
        purpose: '角色定妆照',
        style,
        is_ai_generated: true,
        generation_prompt: prompt,
        tags: ['角色形象', characterName, style, 'AI生成', AGE_GROUP_BOUNDARIES[ageGroup].label, `${age}岁`, 'Seedream-5.0-Lite'],
      })
      .select()
      .single();

    if (!error && image && characterId) {
      // 如果有角色ID，更新角色表中的形象ID
      await supabase
        .from('drama_characters')
        .update({ image_id: image.id })
        .eq('id', characterId);
    }

    return image;
  } catch (saveError) {
    console.error('保存角色形象失败:', saveError);
    return null;
  }
}

/**
 * 使用智谱SDK生成角色立绘
 */
async function generateWithZhipu(userId: string, prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const configured = await isZhipuConfiguredForUser(userId);
  if (!configured) {
    return { success: false, error: '智谱API未配置，请在方案设置中配置 API Key' };
  }

  try {
    const client = await getZhipuClientAsync(userId);
    
    // 智谱只支持特定尺寸，使用 9:16 竖版
    const response = await client.generateImage(prompt, { size: '768x1024' });

    if (!response.data || response.data.length === 0) {
      return { success: false, error: '图片生成失败' };
    }

    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      return { success: false, error: '图片生成失败：未返回URL' };
    }

    return { success: true, imageUrl };
  } catch (error) {
    console.error('[智谱角色立绘] 错误:', error);
    return { success: false, error: error instanceof Error ? error.message : '图片生成失败' };
  }
}
