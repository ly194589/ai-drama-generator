import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils, S3Storage, LLMClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { DEFAULT_MODELS } from '@/lib/config';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 角色四视图 UID 生成 API
 * 
 * 根据角色特征生成包含正面、侧面、背面、表情的角色设定图
 * 这张图将作为角色的"身份证"，用于后续生成时保持一致性
 * 
 * 核心思路：
 * 1. 生成一张包含四视图的角色设定图
 * 2. 在图上标注角色 UID 和特征
 * 3. 后续生成角色图片时，使用这张图作为参考
 * 
 * 参考：AI漫剧人物一致性保持方案
 */

// 设置最大执行时间
export const maxDuration = 300;

/**
 * 构建四视图 UID 生成提示词
 */
function buildUIDPrompt(
  characterName: string,
  characterDesc: Record<string, unknown>,
  genre: string,
  isPet: boolean
): string {
  // 基础风格要求
  const styleBase = `【核心风格】超写实摄影风格，真人实拍效果，照片级真实感。`;
  const styleSuffix = `【严禁】动漫风格、漫画风格、二次元风格、卡通风格、Q版风格、插画风格、手绘风格`;
  
  // 根据题材调整背景
  let backgroundStyle = '纯白背景，角色设定稿风格';
  if (genre.includes('古风') || genre.includes('古装') || genre.includes('仙侠')) {
    backgroundStyle = '浅灰色背景，古典角色设定稿风格';
  } else if (genre.includes('科幻')) {
    backgroundStyle = '浅蓝色科技感背景，未来角色设定稿风格';
  }

  if (isPet) {
    // 萌宠拟人化角色
    const petType = (characterDesc.petType as string) || '猫';
    const furColor = (characterDesc.furColor as string) || '白色';
    const armorStyle = (characterDesc.armorStyle as string) || '精致战甲';
    const roleType = (characterDesc.roleType as string) || '战士';
    
    return `${styleBase}

【角色设定图】一张完整的角色四视图设定图，包含同一只${furColor}毛色的${petType}拟人化角色"${characterName}"。

【画面布局】
- 从左到右排列：正视图、左侧面、右侧面、背视图
- 每个视图都是全身立绘，从头到脚完整展示
- 底部留出空间标注角色 UID: ${characterName}

【角色特征】
- 角色：${roleType}，身穿${armorStyle}
- 毛色：${furColor}
- 气质：${characterDesc.temperament || '英勇'}

【风格要求】
- ${backgroundStyle}
- 清晰的线条和细节，方便后续参考
- 四个角度的角色必须是同一只宠物，外观完全一致
- 保持体型、毛色、战甲完全相同

${styleSuffix}`;
  } else {
    // 人类角色
    const gender = (characterDesc.gender as string) === 'male' ? '男性' : 
                   (characterDesc.gender as string) === 'female' ? '女性' : '人物';
    const age = characterDesc.age as number;
    const faceShape = (characterDesc.faceShape as string) || '';
    const hairstyle = (characterDesc.hairstyle as string) || '';
    const clothing = (characterDesc.clothing as string) || '';
    const temperament = (characterDesc.temperament as string) || '';

    return `${styleBase}

【角色设定图】一张完整的角色四视图设定图，包含同一位${age ? age + '岁' : ''}${gender}角色"${characterName}"。

【画面布局】
- 从左到右排列：正视图、左侧面、右侧面、背视图
- 每个视图都是全身立绘，从头到脚完整展示
- 底部留出空间标注角色 UID: ${characterName}

【角色特征】
- 脸型：${faceShape || '标准'}
- 发型：${hairstyle || '自然发型'}
- 服装：${clothing || '日常服装'}
- 气质：${temperament || '自然'}

【风格要求】
- ${backgroundStyle}
- 清晰的面部特征和服装细节，方便后续参考
- 四个角度的人物必须是同一个人，外观完全一致
- 保持发型、服装、体型、五官完全相同

${styleSuffix}`;
  }
}

/**
 * 提取角色特征描述（用于保存到数据库）
 */
async function extractCharacterFeatures(
  characterName: string,
  characterDesc: Record<string, unknown>,
  genre: string,
  llmClient: LLMClient
): Promise<string> {
  const isPet = genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物');
  
  const prompt = isPet ? 
`请为以下萌宠拟人化角色生成详细的外观特征描述（用于AI生成时保持一致性）：

角色名称：${characterName}
角色类型：${characterDesc.petType || '猫'}
毛色：${characterDesc.furColor || '白色'}
战甲：${characterDesc.armorStyle || '精致战甲'}
定位：${characterDesc.roleType || '战士'}
气质：${characterDesc.temperament || '英勇'}

请用简洁的英文描述该角色的核心视觉特征，格式如下：
- 体型: ...
- 毛色与纹路: ...
- 头部特征: ...
- 眼睛: ...
- 战甲/服饰: ...
- 标志性姿态: ...
- 一致性关键词: ...

只输出英文描述，不要其他内容。` :
`请为以下角色生成详细的外观特征描述（用于AI生成时保持一致性）：

角色名称：${characterName}
性别：${characterDesc.gender || 'female'}
年龄：${characterDesc.age || 25}
脸型：${characterDesc.faceShape || '标准'}
发型：${characterDesc.hairstyle || '自然'}
服装：${characterDesc.clothing || '日常'}
气质：${characterDesc.temperament || '自然'}

请用简洁的英文描述该角色的核心视觉特征，格式如下：
- 体型: ...
- 脸型: ...
- 发型与发色: ...
- 眼睛: ...
- 服装: ...
- 标志性姿态: ...
- 一致性关键词: ...

只输出英文描述，不要其他内容。`;

  try {
    const response = await llmClient.invoke([
      { role: 'user', content: prompt }
    ], {
      model: DEFAULT_MODELS.llm,
      temperature: 0.3,
    });
    
    return response?.content || '';
  } catch (error) {
    console.error('[角色特征提取] 错误:', error);
    return '';
  }
}

/**
 * POST: 生成角色四视图 UID
 * 
 * 请求参数：
 * - seriesId: 剧集ID
 * - characterId: 角色ID
 * - characterName: 角色名称
 * - characterDesc: 角色描述（包含外貌、服装等）
 * - genre: 题材
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      seriesId,
      characterId,
      characterName,
      characterDesc,
      genre = '现代',
    } = body;

    if (!characterName || !characterDesc) {
      return NextResponse.json(
        { error: '请提供角色名称和描述' },
        { status: 400 }
      );
    }

    const isPet = genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物');
    
    // 初始化客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);
    const llmClient = new LLMClient(config, customHeaders);
    const supabase = getSupabaseClient();

    console.log(`[角色UID] 生成 ${characterName} 的四视图设定图...`);

    // 1. 生成四视图 UID 图片
    const uidPrompt = buildUIDPrompt(characterName, characterDesc, genre, isPet);
    
    const response = await imageClient.generate({
      prompt: uidPrompt,
      size: '2560x1440',  // 16:9横版
    });

    const helper = imageClient.getResponseHelper(response);
    
    if (!helper.success || helper.imageUrls.length === 0) {
      return NextResponse.json(
        { error: helper.errorMessages.join(', ') || '生成角色UID失败' },
        { status: 500 }
      );
    }

    const imageUrl = helper.imageUrls[0];

    // 2. 下载并上传到对象存储
    const downloadResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());
    
    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: `images/character-uid/${Date.now()}-${characterName}-uid.jpg`,
      contentType: 'image/jpeg',
    });

    const presignedUrl = await storage.generatePresignedUrl({ key: fileKey });

    // 3. 提取角色特征描述
    const characterFeatures = await extractCharacterFeatures(
      characterName,
      characterDesc,
      genre,
      llmClient
    );

    // 4. 保存到数据库
    const { data: savedImage, error } = await supabase
      .from('image_materials')
      .insert({
        title: `${characterName} - 角色UID设定图`,
        description: `${characterName}的四视图角色设定图，用于保持角色一致性`,
        type: 'character-uid',
        category: '角色设定图',
        file_key: fileKey,
        file_name: `${characterName}-uid.jpg`,
        file_size: imageBuffer.length,
        width: 2560,
        height: 1440,
        format: 'jpg',
        thumbnail_key: fileKey,
        series_id: seriesId || null,
        character_id: characterId || null,
        character_name: characterName,
        purpose: '角色UID设定图',
        is_ai_generated: true,
        generation_prompt: uidPrompt,
        tags: ['角色设定图', 'UID', characterName, '一致性', 'AI生成'],
        // 将角色特征保存在 description 字段中，便于后续使用
      })
      .select()
      .single();

    if (error) {
      console.error('[角色UID] 保存失败:', error);
    }

    // 5. 更新角色信息，添加 UID 图片和特征描述
    if (seriesId) {
      const { data: series } = await supabase
        .from('drama_series')
        .select('characters')
        .eq('id', seriesId)
        .single();

      if (series?.characters) {
        const characters = series.characters as Record<string, unknown>[];
        const charIndex = characters.findIndex(
          c => c.id === characterId || c.name === characterName
        );

        if (charIndex !== -1) {
          characters[charIndex] = {
            ...characters[charIndex],
            uidImageUrl: presignedUrl,
            uidImageKey: fileKey,
            characterFeatures, // 保存角色特征描述
          };

          await supabase
            .from('drama_series')
            .update({
              characters,
              updated_at: new Date().toISOString(),
            })
            .eq('id', seriesId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      uidImage: {
        id: savedImage?.id,
        fileKey,
        presignedUrl,
        characterFeatures,
      },
      prompt: uidPrompt,
      message: `成功生成 ${characterName} 的角色UID设定图`,
    });
  } catch (error) {
    console.error('[角色UID] 生成失败:', error);
    return NextResponse.json(
      { error: '生成角色UID失败' },
      { status: 500 }
    );
  }
}

/**
 * GET: 获取角色的 UID 设定图
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');
    const characterId = searchParams.get('characterId');
    const characterName = searchParams.get('characterName');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('image_materials')
      .select('*')
      .eq('type', 'character-uid');

    if (seriesId) {
      query = query.eq('series_id', seriesId);
    }
    if (characterId) {
      query = query.eq('character_id', characterId);
    }
    if (characterName) {
      query = query.eq('character_name', characterName);
    }

    const { data: images, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: '获取角色UID失败' },
        { status: 500 }
      );
    }

    // 生成预签名URL
    const imagesWithUrls = await Promise.all(
      (images || []).map(async (img) => {
        try {
          const presignedUrl = await storage.generatePresignedUrl({ key: img.file_key });
          return { ...img, imageUrl: presignedUrl };
        } catch {
          return { ...img, imageUrl: '' };
        }
      })
    );

    return NextResponse.json({
      success: true,
      uidImages: imagesWithUrls,
    });
  } catch (error) {
    console.error('[角色UID] 获取失败:', error);
    return NextResponse.json(
      { error: '获取角色UID失败' },
      { status: 500 }
    );
  }
}
