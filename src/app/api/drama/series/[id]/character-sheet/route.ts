import { NextRequest, NextResponse } from 'next/server';
import { Config, HeaderUtils, ImageGenerationClient, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 设置最大执行时间为5分钟
export const maxDuration = 300;

/**
 * 带重试机制的图片生成函数
 */
async function generateImageWithRetry(
  imageClient: ImageGenerationClient,
  params: { prompt: string; size: string },
  maxRetries: number = 7,
  baseDelayMs: number = 15000
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await imageClient.generate(params);
      const helper = imageClient.getResponseHelper(response);
      
      if (helper.success && helper.imageUrls.length > 0) {
        console.log(`[人物立绘] 成功！尝试次数: ${attempt + 1}/${maxRetries}`);
        return { success: true, imageUrl: helper.imageUrls[0] };
      } else {
        return { success: false, error: helper.errorMessages.join('; ') };
      }
    } catch (error: unknown) {
      const err = error as { 
        statusCode?: number; 
        status?: number;
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      
      const httpStatus = err.statusCode || err.status || err.response?.status;
      const isRateLimit = httpStatus === 403 || 
        (err.message && err.message.includes('403'));
      
      if (httpStatus === 400) {
        return { success: false, error: `参数错误: ${err.message || 'Unknown error'}` };
      }
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const exponentialDelay = baseDelayMs * Math.pow(1.5, attempt);
        const jitter = Math.random() * 5000;
        const delay = Math.min(exponentialDelay + jitter, 120000);
        
        console.log(`[人物立绘] 触发限流(403)，等待 ${(delay/1000).toFixed(1)}s 后重试 (尝试 ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return { success: false, error: err.message || 'Unknown error' };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * 构建角色描述
 */
function buildCharacterDescription(
  char: Record<string, unknown>,
  genre: string,
  characterType: string
): string {
  const characterName = char.name as string;
  const isPet = genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物');
  const isMystery = characterType === 'mystery';
  const temperament = char.temperament as string || '';
  
  if (isPet) {
    // 萌宠拟人化角色
    const petType = char.petType as string || '宠物';
    const breed = char.breed as string || '';
    const furColor = char.furColor as string || '';
    const eyeColor = char.eyeColor as string || '';
    const roleType = char.roleType as string || '';
    const armorStyle = char.armorStyle as string || '';
    const signaturePose = char.signaturePose as string || '';
    const signatureLook = char.signatureLook as string || '';
    
    const desc = [
      `拟人化${petType}角色，名叫${characterName}`,
      breed && `品种：${breed}`,
      furColor && `毛色：${furColor}`,
      eyeColor && `眼睛颜色：${eyeColor}`,
      roleType && `角色定位：${roleType}`,
      armorStyle && `战甲风格：${armorStyle}`,
      temperament && `气质：${temperament}`,
      signaturePose && `标志性动作：${signaturePose}`,
      signatureLook && `标志性表情：${signatureLook}`,
    ].filter(Boolean).join('，');
    
    return desc;
  } else {
    // 人类角色
    const gender = char.gender as string;
    const age = char.age as number;
    const faceShape = char.faceShape as string || '';
    const hairstyle = char.hairstyle as string || '';
    const clothing = char.clothing as string || '';
    const skinTone = char.skinTone as string || '';
    const characteristic = char.characteristic as string || '';
    
    const genderDesc = gender === 'male' ? '男性' : gender === 'female' ? '女性' : '人物';
    const ageDesc = age ? `${age}岁左右` : '';
    
    const desc = [
      `一位${ageDesc}${genderDesc}角色，名叫${characterName}`,
      faceShape && !isMystery ? `脸型：${faceShape}` : '',
      hairstyle ? `发型：${hairstyle}` : '',
      clothing ? `服装：${clothing}` : '',
      skinTone && !isMystery ? `肤色：${skinTone}` : '',
      temperament ? `气质：${temperament}` : '',
      characteristic ? `特征：${characteristic}` : '',
      isMystery ? '身份神秘，若隐若现' : '',
    ].filter(Boolean).join('，');
    
    return desc;
  }
}

/**
 * 获取风格描述
 */
function getStyleDescription(genre: string, style: string): string {
  if (genre.includes('古装') || genre.includes('仙侠') || genre.includes('玄幻')) {
    return '东方古风风格，古典雅致，仙侠玄幻意境';
  } else if (genre.includes('古风') || genre.includes('仙侠')) {
    return '东方古风风格，古典雅致，仙侠玄幻意境';
  } else if (genre.includes('现代') || genre.includes('都市') || genre.includes('职场')) {
    return '现代都市风格，真实摄影质感';
  } else if (genre.includes('霸总') || genre.includes('豪门')) {
    return '奢华豪门风格，精致细腻';
  } else if (genre.includes('甜宠') || genre.includes('恋爱')) {
    return '温馨甜宠风格，柔和浪漫';
  } else if (genre.includes('悬疑') || genre.includes('犯罪')) {
    return '悬疑神秘风格，氛围感强';
  } else if (genre.includes('科幻') || genre.includes('未来')) {
    return '未来科幻风格，科技感强';
  } else if (genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物')) {
    if (genre.includes('仙侠') || genre.includes('玄幻')) {
      return '史诗奇幻风格，东方古风战甲，拟人化设计';
    }
    return '可爱萌宠风格，拟人化设计';
  }
  return '现代都市风格';
}

/**
 * 构建人物立绘提示词（正面半身照专用）
 */
function buildCharacterSheetPrompt(params: {
  characterName: string;
  description: string;
  outfit: string;
  style: string;
  imageStyle?: string; // 图片风格：realistic(真人风) / comic(漫画风)
}): string {
  const { characterName, description, outfit, style, imageStyle = 'realistic' } = params;

  // 判断是否为漫画风格
  const isComicStyle = imageStyle === 'comic';

  // 根据图片风格设置核心风格要求
  const coreStyleRequirement = isComicStyle
    ? '【核心风格】精致漫画风格，高质量二次元插画，精美细腻的动漫人物。'
    : '【核心风格】超写实摄影风格，真人实拍效果，照片级真实感，专业影棚拍摄。';

  // 根据图片风格设置禁止规则
  const forbiddenStyles = isComicStyle
    ? '，禁止Q版、简笔画、儿童画风格'
    : '，【严禁】动漫风格、漫画风格、二次元风格、卡通风格、Q版风格、插画风格、手绘风格、游戏CG风格，必须是真人实拍照片效果';

  // 正面半身照的核心构图要求
  const compositionRequirement = `
【构图要求】正面半身照，3:4宽高比：
- 精准构图：人物腰部以上至头顶完整展示，构图精准紧凑
- 角色位置：居中偏上，面部黄金分割点构图，增强视觉冲击力
- 半身范围：胸部腰部完整展示，避免过宽或过窄的裁切
- 肩膀展示：双肩完整可见，展示服装肩部设计和肩线
- 手部细节：如展示手臂，需保证手部细节清晰可见
- 适当留白：头部上方留有适当空间，避免过于拥挤`;

  // 面部细节强化
  const faceDetailRequirement = `
【面部细节强化】
- 眼睛：眼神明亮有神，眼神光点，瞳孔清晰可见，虹膜纹理自然
- 五官比例：黄金比例脸型，眉眼间距适中，鼻子挺拔，嘴唇饱满
- 表情：表情自然生动，符合角色性格特征，微表情细腻
- 皮肤质感：真实皮肤纹理，毛孔细节，自然肤色，光泽感
- 脸部光影：立体光影，鼻梁阴影，面部轮廓分明`;

  // 服装细节强化
  const outfitDetailRequirement = `
【服装细节强化】
- 布料质感：真实布料纹理，丝绸、棉麻、皮革等材质差异明显
- 服装细节：纽扣、拉链、刺绣、蕾丝等细节清晰可见
- 领口设计：领口、领带、领饰等细节精细展示
- 色彩还原：服装颜色准确饱和度，层次分明`;

  // 光影和专业摄影要求
  const lightingRequirement = isComicStyle
    ? `【光影效果】柔和均匀的漫射光，阴影层次分明，高光自然柔和，增强立体感。`
    : `【专业摄影】影棚打光，主光45度角，填充光柔化阴影，轮廓光勾勒人物轮廓。真实光影效果，光线柔和自然，无强烈对比度，专业人像摄影质感。`;

  // 背景要求
  const backgroundRequirement = isComicStyle
    ? '背景：纯色渐变背景，简洁干净，突出人物主体'
    : '背景：纯白色或浅灰色背景，专业影棚白幕，干净简洁，无任何背景元素，人物完全突出';

  const prompt = `${coreStyleRequirement}${forbiddenStyles}，高质量人物立绘摄影。

【角色信息】
角色名称：@${characterName}
角色特征：${description}
服装造型：${outfit}
风格基调：${style}

${compositionRequirement}

${faceDetailRequirement}

${outfitDetailRequirement}

${lightingRequirement}

${backgroundRequirement}

【质量标准】
- 分辨率：2K高清画质（1024x1365）
- 细节：发丝清晰可见，服装纹理真实，皮肤质感自然
- 色彩：色彩准确饱和度适中，色彩层次分明
- 锐度：画面锐度适中，避免过度锐化
- 噪点：低噪点，画面干净整洁

【角色一致性】
确保角色特征统一，同一角色不同角度生成时保持一致性：相同发型、相同五官、相同服装、相同肤色、相同体型。角色一致性ID: ${characterName}`;

  return prompt;
}

/**
 * POST - 为指定角色生成人物立绘
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { characterId, characterName, imageStyle: userImageStyle = 'realistic' } = body;

    if (!characterId || !characterName) {
      return NextResponse.json(
        { error: '缺少必填参数: characterId, characterName' },
        { status: 400 }
      );
    }

    const userId = request.headers.get('x-user-id') || 'dev-user';
    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      console.error('查询剧本失败:', seriesError);
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    // 获取角色信息
    const characters = (series.characters as Record<string, unknown>[]) || [];
    const character = characters.find((c: Record<string, unknown>) => c.id === characterId || c.name === characterName);

    if (!character) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      );
    }

    console.log(`[人物立绘] 生成请求:`, {
      userId,
      seriesId: id,
      characterId,
      characterName,
    });

    // 构建角色描述
    const characterType = character.characterType as string || 'supporting';
    const description = buildCharacterDescription(character, series.genre as string || '', characterType);
    const outfit = character.clothing as string || character.armorStyle as string || '现代服饰';
    const style = getStyleDescription(series.genre as string || '', series.style as string || '');
    // 优先使用用户提供的风格，否则使用剧本的图片风格
    const imageStyle = userImageStyle || (series.image_style as string) || 'realistic';

    // 构建提示词
    const prompt = buildCharacterSheetPrompt({
      characterName,
      description,
      outfit,
      style,
      imageStyle,
    });

    // 初始化图片生成客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);

    // 生成图片
    const size = '1024x1365'; // 3:4 比例，适合正面半身照
    const result = await generateImageWithRetry(imageClient, { prompt, size });

    if (!result.success || !result.imageUrl) {
      throw new Error(result.error || '图片生成失败');
    }

    // 保存图片到对象存储
    const imageUrl = result.imageUrl;
    const fileName = `character-sheet-${characterName}-${Date.now()}.png`;
    let fileKey = imageUrl; // 默认使用生成的URL

    try {
      // 下载图片
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('下载图片失败');
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // 上传到对象存储
      fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName,
        contentType: 'image/png',
      });
      console.log(`[人物立绘] 图片已上传: ${fileKey}`);
    } catch (uploadError) {
      console.error('[人物立绘] 上传失败:', uploadError);
      // 如果上传失败，使用原始URL
    }

    // 保存立绘信息到数据库
    const artworkData = {
      series_id: id,
      character_id: characterId,
      character_name: characterName,
      image_type: 'character-sheet',
      purpose: '人物立绘',
      purpose_detail: '三栏式布局（正面、侧面、背面）',
      generation_prompt: prompt,
      image_key: fileKey,
      image_url: imageUrl, // 临时使用生成的URL
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('drama_artwork')
      .insert(artworkData);

    if (insertError) {
      console.error('[人物立绘] 保存失败:', insertError);
      return NextResponse.json(
        { error: '保存立绘失败' },
        { status: 500 }
      );
    }

    console.log(`[人物立绘] 生成成功:`, {
      userId,
      seriesId: id,
      characterName,
      size,
      imageUrl,
    });

    return NextResponse.json({
      success: true,
      characterSheet: {
        url: imageUrl,
        prompt: prompt,
        size: size,
        characterName: characterName,
        description: description,
        outfit: outfit,
        characterType: characterType,
      },
    });

  } catch (error) {
    console.error('[人物立绘] 生成失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '人物立绘生成失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取人物立绘生成的使用说明
 */
export async function GET() {
  return NextResponse.json({
    name: '人物立绘生成 API',
    description: '为剧本中的角色生成包含正面照、侧面照、背面照的完整立绘图',
    version: '1.0.0',

    endpoint: 'POST /api/drama/series/[id]/character-sheet',

    request: {
      characterId: {
        type: 'string',
        required: true,
        description: '角色ID',
      },
      characterName: {
        type: 'string',
        required: true,
        description: '角色名称',
      },
    },

    response: {
      success: true,
      characterSheet: {
        url: '生成的立绘图片URL',
        prompt: '生成的提示词',
        size: '2560x1440',
        characterName: '角色名称',
        description: '角色描述',
        outfit: '服装描述',
        characterType: '角色类型',
      },
    },

    notes: [
      '生成的图片为 PNG 格式，16:9 宽高比',
      '一张图包含三个视角（左：正面，中：侧面，右：背面）',
      '会自动从剧本中提取角色信息生成提示词',
      '生成的立绘会保存到数据库，可在视频生成时使用',
    ],
  });
}
