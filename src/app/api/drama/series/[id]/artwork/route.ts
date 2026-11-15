import { NextRequest, NextResponse } from 'next/server';
import { Config, HeaderUtils, ImageGenerationClient, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateImageForProvider } from '@/lib/media-generation';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 设置最大执行时间为5分钟（Next.js API路由最大值）
export const maxDuration = 300;

/**
 * 带重试机制的图片生成函数
 * 处理API限流问题（403 ErrTooManyRequests）
 * 
 * 优化策略：
 * - 更长的等待时间：基础 15s，最大 120s
 * - 更多重试次数：7 次
 * - 指数退避 + 随机抖动避免惊群效应
 */
async function generateImageWithRetry(
  imageClient: ImageGenerationClient,
  params: { prompt: string; size: string; image?: string },
  maxRetries: number = 7,
  baseDelayMs: number = 15000
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await imageClient.generate(params);
      const helper = imageClient.getResponseHelper(response);
      
      if (helper.success && helper.imageUrls.length > 0) {
        console.log(`[图片生成] 成功！尝试次数: ${attempt + 1}/${maxRetries}`);
        return { success: true, imageUrl: helper.imageUrls[0] };
      } else {
        return { success: false, error: helper.errorMessages.join('; ') };
      }
    } catch (error: unknown) {
      // 兼容多种错误格式：axios错误、fetch错误、SDK错误
      const err = error as { 
        statusCode?: number; 
        status?: number;
        response?: { status?: number; data?: unknown };
        message?: string;
        data?: unknown;
      };
      
      // 从多个可能的属性中获取状态码
      const httpStatus = err.statusCode || err.status || err.response?.status;
      const isRateLimit = httpStatus === 403 || 
        (err.message && err.message.includes('403'));
      
      console.log(`[图片生成] 错误捕获: status=${httpStatus}, message=${err.message?.substring(0, 100)}, attempt=${attempt + 1}/${maxRetries}`);
      
      // 对于400错误，不重试，直接返回错误
      if (httpStatus === 400) {
        console.log(`[图片生成] 参数错误(400)，不重试`);
        return { 
          success: false, 
          error: `参数错误: ${err.message || 'Unknown error'}` 
        };
      }
      
      if (isRateLimit && attempt < maxRetries - 1) {
        // 指数退避 + 随机抖动：15s, 30s, 60s, 90s, 120s...
        // 最大等待 120 秒，避免无限增长
        const exponentialDelay = baseDelayMs * Math.pow(1.5, attempt);
        const jitter = Math.random() * 5000; // 0-5秒随机抖动
        const delay = Math.min(exponentialDelay + jitter, 120000);
        
        console.log(`[图片生成] 触发限流(403)，等待 ${(delay/1000).toFixed(1)}s 后重试 (尝试 ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return { 
        success: false, 
        error: err.message || 'Unknown error' 
      };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * 立绘生成 API
 * 
 * 根据剧本的角色和场景信息，批量生成：
 * 1. 角色多角度立绘（根据角色类型生成不同数量）
 * 2. 场景照（根据场景类型生成不同风格）
 * 
 * 角色类型与立绘数量：
 * - protagonist（主角）: 3个角度（正面、侧面、动作）
 * - supporting（配角）: 3个角度（正面、侧面、动作）
 * - mystery（神秘人）: 2个角度（侧面、剪影/背影）
 * - extra（路人甲）: 1个角度（正面/半身）
 * 
 * 场景类型与风格：
 * - fixed（固定场景）: 全景，细节丰富
 * - common（常见场景）: 中景，通用性强
 * - special（特殊场景）: 特色视角，氛围感强
 * - transition（过渡场景）: 简洁风格
 * 
 * 流程：概览 → 大纲 → 立绘 → 剧集 → 音频
 */

// 角色立绘角度配置 - 按角色类型分组
// 核心要求：必须是全身立绘，从头到脚完整展示
// 【重要】所有角色类型都必须生成3张照片（正面、侧面、背面）
const CHARACTER_ANGLE_CONFIGS = {
  // 主角：3个角度，完整展示
  protagonist: [
    {
      type: 'front',
      name: '正面照',
      promptSuffix: '【必须】正面全身立绘，人物站在画面中央，从头到脚完整展示，脚踩地面，头顶有适当留白，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'side',
      name: '侧面照',
      promptSuffix: '【必须】侧面全身立绘，侧身站立，从头到脚完整展示，展示侧脸轮廓和全身姿态，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'back',
      name: '背影照',
      promptSuffix: '【必须】背影全身立绘，从头到脚完整展示，背对镜头站立，禁止半身照，禁止裁切身体任何部位',
    },
  ],
  // 配角：3个角度，完整展示
  supporting: [
    {
      type: 'front',
      name: '正面照',
      promptSuffix: '【必须】正面全身立绘，人物站在画面中央，从头到脚完整展示，脚踩地面，头顶有适当留白，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'side',
      name: '侧面照',
      promptSuffix: '【必须】侧面全身立绘，侧身站立，从头到脚完整展示，展示侧脸轮廓和全身姿态，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'back',
      name: '背影照',
      promptSuffix: '【必须】背影全身立绘，从头到脚完整展示，背对镜头站立，禁止半身照，禁止裁切身体任何部位',
    },
  ],
  // 神秘人：3个角度，保持神秘感（使用剪影和背影）
  mystery: [
    {
      type: 'front',
      name: '正面剪影',
      promptSuffix: '【必须】正面全身剪影立绘，从头到脚完整展示，面部若隐若现，光影对比强烈，神秘氛围，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'side',
      name: '侧面剪影',
      promptSuffix: '【必须】侧面全身立绘，从头到脚完整展示，侧脸轮廓若隐若现，光影对比强烈，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'back',
      name: '背影形象',
      promptSuffix: '【必须】背影全身立绘，从头到脚完整展示，背对镜头，神秘氛围，禁止半身照，禁止裁切身体任何部位',
    },
  ],
  // 路人甲：3个角度（与其他角色一致）
  extra: [
    {
      type: 'front',
      name: '正面照',
      promptSuffix: '【必须】正面全身立绘，人物站在画面中央，从头到脚完整展示，脚踩地面，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'side',
      name: '侧面照',
      promptSuffix: '【必须】侧面全身立绘，侧身站立，从头到脚完整展示，展示侧脸轮廓和全身姿态，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'back',
      name: '背影照',
      promptSuffix: '【必须】背影全身立绘，从头到脚完整展示，背对镜头站立，禁止半身照，禁止裁切身体任何部位',
    },
  ],
  // 场景通用人物：3个角度（与其他角色一致）
  sceneNPC: [
    {
      type: 'front',
      name: '正面照',
      promptSuffix: '【必须】正面全身立绘，人物站在画面中央，从头到脚完整展示，脚踩地面，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'side',
      name: '侧面照',
      promptSuffix: '【必须】侧面全身立绘，侧身站立，从头到脚完整展示，展示侧脸轮廓和全身姿态，禁止半身照，禁止裁切身体任何部位',
    },
    {
      type: 'back',
      name: '背影照',
      promptSuffix: '【必须】背影全身立绘，从头到脚完整展示，背对镜头站立，禁止半身照，禁止裁切身体任何部位',
    },
  ],
};

// 默认角度配置（兼容旧数据）
const CHARACTER_ANGLES = CHARACTER_ANGLE_CONFIGS.protagonist;

// 根据题材、风格和图片风格获取风格提示词
function getStylePrompt(genre: string, style: string, imageStyle: string = 'realistic'): string {
  // 判断是否为漫画风格
  const isComicStyle = imageStyle === 'comic';
  
  // 根据图片风格设置基础前缀和后缀
  let stylePrefix: string;
  let styleSuffix: string;
  
  if (isComicStyle) {
    // 漫画风格基础前缀 - 精致二次元风格
    stylePrefix = '【核心风格】精致动漫风格，高质量二次元插画，精美细腻的动漫人物，';
    // 漫画风格基础后缀：严禁真人写实效果
    styleSuffix = '，【风格要求】精美的线条、鲜艳的色彩、动漫人物特征、大眼睛、精致五官、流畅发丝，高质量的二次元插画效果。【严禁】真人实拍风格、写实照片风格、真实皮肤毛孔、摄影棚写真、3D渲染CG质感，必须是纯二次元动漫插画效果';
  } else {
    // 真人风格：真人实拍摄影写真，严禁任何动漫/3D CG/游戏渲染痕迹
    stylePrefix = '【核心风格】真人实拍摄影写真，专业人像摄影，真实人物质感，';
    // 风格后缀：严禁动漫和CG风格
    styleSuffix = '，【严禁】动漫风格、漫画风格、二次元风格、卡通风格、Q版风格、插画风格、手绘风格、3D渲染风格、CG风格、游戏建模风格、虚幻引擎渲染，必须是真人实拍照片效果，真实皮肤毛孔纹理、真实发丝细节、真实服装布料质感';
  }
  
  // 优先根据题材判断时代背景
  const genreStyleMap: Record<string, string> = {
    '古装': '淡颜系东方脸，身穿古典改良旗袍，灰调水绿色系，哑光丝绸布料质感，赤脚或绣花鞋，古风发型，水墨意境，禁止出现现代元素',
    '仙侠': '淡颜系东方脸，身穿古典仙侠服饰，灰调水绿色系，哑光丝绸布料质感，赤脚或素履，古风发型，仙气飘渺，古典仙侠背景，禁止出现现代元素',
    '玄幻': '淡颜系东方脸，身穿古典玄幻服饰，灰调水绿色系，哑光丝绸布料质感，赤脚或绣花鞋，古风发型，神秘玄幻氛围，禁止出现现代元素',
    '古风': '淡颜系东方脸，身穿古典改良旗袍，灰调水绿色系，哑光丝绸布料质感，赤脚或绣花鞋，古风发型，唯美古风意境，禁止出现现代元素',
    '现代': '现代都市背景，时尚摄影风格，柔和自然光，真实街景',
    '都市': '现代都市背景，时尚摄影风格，柔和自然光，真实街景',
    '职场': '现代职场背景，职业装束，专业氛围，真实办公场景',
    '霸总': '现代奢华背景，高档商务风格，精致质感，真实豪华场景',
    '豪门': '现代奢华背景，富贵气息，精致质感，真实豪宅场景',
    '科幻': '未来科幻背景，赛博朋克风格，霓虹光影，真实科幻场景',
    '悬疑': '神秘氛围，戏剧性光影，暗调处理，真实场景',
    '甜宠': '温馨浪漫氛围，柔和光影，唯美质感，真实场景',
    '宠物': '温馨可爱风格，柔和光线，温暖色调，真实场景',
    '萌宠': '温馨可爱风格，柔和光线，温暖色调，真实场景',
  };
  
  // 先根据题材匹配
  for (const [key, value] of Object.entries(genreStyleMap)) {
    if (genre.includes(key)) {
      return stylePrefix + value + styleSuffix;
    }
  }
  
  // 再根据风格匹配
  for (const [key, value] of Object.entries(genreStyleMap)) {
    if (style.includes(key)) {
      return stylePrefix + value + styleSuffix;
    }
  }
  
  // 默认：如果包含古代相关词汇，强制添加古代背景
  if (genre.includes('古') || genre.includes('仙') || genre.includes('侠')) {
    return stylePrefix + '淡颜系东方脸，身穿古典改良旗袍，灰调水绿色系，哑光丝绸布料质感，赤脚或绣花鞋，古风发型，唯美古风意境，禁止出现现代元素' + styleSuffix;
  }
  
  return stylePrefix + '专业摄影风格，高清质感' + styleSuffix;
}

// 判断是否为宠物风
function isPetGenre(genre: string): boolean {
  return genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物');
}

// 构建核心角色特征描述（用于所有角度，确保一致性）
function buildCoreCharacterDescription(char: Record<string, unknown>, genre: string, characterType: string): string {
  const characterName = char.name as string;
  const temperament = char.temperament as string || '';
  const isMystery = characterType === 'mystery';
  
  if (isPetGenre(genre)) {
    // 萌宠拟人化角色
    const petType = (char.petType as string) || '猫';
    const furColor = char.furColor as string || '白色';
    const eyeColor = char.eyeColor as string || '黑色';
    const armorStyle = char.armorStyle as string || '精致战甲';
    const roleType = char.roleType as string || '战士';
    const signatureLook = char.signatureLook as string || '';
    
    const desc = [
      `一只${furColor}毛色的${petType}拟人化战士`,
      `名叫${characterName}`,
      `角色定位：${roleType}`,
      `身穿${armorStyle}`,
      temperament ? `性格气质：${temperament}` : '',
      signatureLook ? `标志性表情：${signatureLook}` : '',
      isMystery ? '身份神秘，若隐若现' : '',
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

// 根据题材获取背景描述（用于场景图，立绘使用纯白背景）
function getBackgroundDescription(genre: string): string {
  if (isPetGenre(genre)) {
    if (genre.includes('仙侠') || genre.includes('玄幻')) {
      return '仙侠世界背景，云雾缭绕的仙山，玄幻仙境氛围';
    } else if (genre.includes('古风') || genre.includes('古装')) {
      return '古代东方背景，古典建筑与山水意境';
    } else if (genre.includes('现代') || genre.includes('都市')) {
      return '现代都市背景，霓虹灯光与摩天大楼氛围';
    } else if (genre.includes('神话') || genre.includes('传说')) {
      return '神话世界背景，神秘的仙境与神殿';
    } else if (genre.includes('末世') || genre.includes('废土')) {
      return '末世废土背景，残破的城市与荒芜大地';
    }
    return '史诗战场氛围背景';
  } else {
    if (genre.includes('古装') || genre.includes('仙侠')) {
      return '古典雅致的室内场景，虚化的屏风窗棂背景';
    } else if (genre.includes('都市') || genre.includes('职场')) {
      return '现代都市室内场景，虚化的城市背景';
    } else if (genre.includes('霸总') || genre.includes('豪门')) {
      return '奢华豪宅室内场景，虚化的水晶灯背景';
    } else if (genre.includes('悬疑')) {
      return '神秘氛围场景，虚化的暗调背景';
    }
    return '柔和虚化的室内背景';
  }
}

// 立绘专用背景描述 - 纯白背景，突出人物
function getCharacterArtworkBackground(): string {
  return '纯白色背景，干净简洁，无任何背景元素，人物完全突出，专业影棚拍摄效果';
}

// 读取用户所选图文生成厂商与模型（未配置时默认扣子内置）
async function getUserImageProviderConfig(userId: string): Promise<{ provider: string; model: string }> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_config')
      .select('image_provider, image_model')
      .eq('user_id', userId)
      .single();
    const model = data?.image_model || '';
    let provider = (typeof data?.image_provider === 'string' && data.image_provider) || '';
    if (!provider) {
      // 兼容旧数据：按模型名识别厂商（支持 glm/cogview/wan/doubao 前缀及日期后缀变体）
      try {
        const { detectProviderFromModel } = await import('@/lib/model-catalog');
        provider = detectProviderFromModel('image', model) || 'coze';
      } catch {
        provider = 'coze';
      }
    }
    return { provider, model };
  } catch {
    return { provider: 'coze', model: '' };
  }
}

// 立绘/场景照统一生成入口：coze 走原 SDK 重试逻辑，其他厂商走对应 API
async function generateArtworkImage(
  userId: string,
  prompt: string,
  cozeGenerate: () => Promise<string | null>,
): Promise<string | null> {
  const { provider, model } = await getUserImageProviderConfig(userId);
  if (provider === 'coze') return cozeGenerate();
  try {
    const result = await generateImageForProvider({
      userId,
      provider,
      model,
      prompt,
      size: '2560x1440',
      count: 1,
    });
    return result.urls[0] || null;
  } catch (err) {
    console.error(`[立绘/场景生成] ${provider} 厂商生成失败:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// 生成角色立绘图片
async function generateCharacterImage(
  char: Record<string, unknown>,
  angle: typeof CHARACTER_ANGLES[0],
  style: string,
  genre: string,
  seriesId: string,
  imageClient: ImageGenerationClient,
  supabase: ReturnType<typeof getSupabaseClient>,
  characterType: string = 'supporting',
  referenceImageUrl?: string, // 参考图像URL，用于保持一致性
  characterFeatures?: string, // 角色特征描述（用于增强一致性）
  imageStyle: string = 'realistic', // 图片风格：realistic(真人风) / comic(漫画风)
  userId?: string, // 用户ID，用于数据隔离
): Promise<{ angleType: string; angleName: string; fileKey: string; imageId: string; presignedUrl: string; imageUrl: string } | null> {
  try {
    const characterName = char.name as string;
    const temperament = char.temperament as string || '';
    const isMystery = characterType === 'mystery';
    const isExtra = characterType === 'extra';
    
    // 构建核心角色特征描述（所有角度共用，确保一致性）
    const coreCharacterDesc = buildCoreCharacterDescription(char, genre, characterType);
    
    // 判断是否为漫画风格
    const isComicStyle = imageStyle === 'comic';
    
    // 根据图片风格设置风格要求
    const styleRequirement = isComicStyle 
      ? '【超级核心要求】必须生成精美漫画风格插画，高质量二次元效果：精致线条、鲜艳色彩、大眼睛、精致五官、流畅发丝、动漫人物特征。'
      : '【超级核心要求】必须生成真实人物摄影照片，像专业影棚拍摄的真人立绘：真实皮肤毛孔纹理、真实发丝细节、真实服装布料质感、专业打光效果。严禁任何动漫、漫画、卡通、插画、手绘、游戏CG风格的痕迹！';
    
    let prompt: string;
    
    if (isPetGenre(genre)) {
      // 萌宠拟人化角色
      const stylePrompt = getStylePrompt(genre, style, imageStyle);
      // 立绘使用纯白背景
      const backgroundDesc = getCharacterArtworkBackground();
      
      // 一致性提示词 - 结合角色特征描述
      const featuresPrompt = characterFeatures 
        ? `【角色特征】${characterFeatures}` 
        : '';
      const consistencyPrompt = referenceImageUrl 
        ? `【重要】严格保持与参考图像中角色外观完全一致，相同毛色、相同眼色、相同战甲、相同体型，仅改变拍摄角度。${featuresPrompt}` 
        : featuresPrompt;
      
      // 萌宠标准化提示词模板 - 根据图片风格调整：真人风用真实质感，漫画风用动漫质感
      const petStylePrefix = isComicStyle 
        ? '杰作，最佳画质，8K超高清，精致动漫风格，高质量二次元插画，'
        : '杰作，最佳画质，8K超高清，真实宠物摄影质感，写实照片风格，';
      const petStyleSuffix = isComicStyle
        ? '，精美二次元动漫效果，【严禁】真人实拍风格、写实照片风格'
        : '，真实毛发纹理，【严禁】动漫风格、卡通风格、3D渲染CG风格、游戏建模风格';
      prompt = `${petStylePrefix}${style}风格，角色设定图排版：左侧大图头部特写，右侧横向排列三视图（正面全身像、侧面全身像、背面全身像），纯浅灰色纯色背景，全身像，${coreCharacterDesc}，${angle.promptSuffix}，${consistencyPrompt}${petStyleSuffix}，${backgroundDesc}，【严格禁止】图片中不得出现任何文字、标签、水印、角色名称、说明文字、注释、编号，即使AI自动添加也必须消除，角色一致性ID: ${characterName}。`;
    } else {
      // 人类角色
      const stylePrompt = getStylePrompt(genre, style, imageStyle);
      // 立绘使用纯白背景
      const backgroundDesc = getCharacterArtworkBackground();
      
      // 一致性提示词 - 强调保持角色特征一致，结合角色特征描述
      const featuresPrompt = characterFeatures 
        ? `【角色特征】${characterFeatures}` 
        : '';
      const consistencyPrompt = referenceImageUrl 
        ? `【重要】严格保持与参考图像中角色完全相同：相同发型、相同五官、相同服装、相同肤色、相同体型，仅改变拍摄角度和姿态，确保是同一个人物。${featuresPrompt}` 
        : `确保角色特征统一，便于后续多角度一致性。${featuresPrompt}`;
      
      // 神秘人特殊处理
      const mysteryStyle = isMystery ? '，光影对比强烈，剪影效果，神秘氛围，面部若隐若现' : '';
      const extraStyle = isExtra ? '，简洁大方，类型化特征明显' : '';
      
      // 全身立绘强制要求 - 使用新的标准化模板
      const fullBodyRequirement = '【核心要求】全身立绘，从头到脚完整展示';
      
      // 根据图片风格设置额外描述
      const styleExtra = isComicStyle 
        ? '，精美二次元插画效果，动漫人物特征'
        : '，真实皮肤毛孔纹理，真实发丝细节，专业摄影打光，浅景深虚化';
      
      // 根据图片风格设置技术描述：真人风严禁3D/CG/Octane渲染词汇
      const techDesc = isComicStyle
        ? '，动漫角色设定稿，赛璐璐渲染，二次元插画细节'
        : '，专业影棚摄影，真实人物摄影质感，单反相机拍摄效果';
      
      // 新版标准化提示词模板 - 根据图片风格调整渲染风格
      prompt = `杰作，最佳画质，8K超高清${isComicStyle ? '，精致动漫风格，高质量二次元插画' : '，真人实拍摄影写真，真实人物质感'}，${style}风格，角色设定图排版：左侧大图头部特写，右侧横向排列三视图（正面全身像、侧面全身像、背面全身像），纯浅灰色纯色背景，全身像，${coreCharacterDesc}，${angle.promptSuffix}，${consistencyPrompt}${mysteryStyle}${extraStyle}${styleExtra}，纯白背景${techDesc}，极致细节${isComicStyle ? '' : '，照片级真实感'}，${stylePrompt}，【严格禁止】图片中不得出现任何文字、标签、水印、角色名称、说明文字、注释、编号，即使AI自动添加也必须消除${isComicStyle ? '，【严禁】真人实拍风格、写实照片风格、真实皮肤毛孔、摄影棚写真、3D渲染CG质感' : '，【严禁】动漫风格、漫画风格、二次元风格、卡通风格、3D渲染风格、CG风格、游戏建模风格、Octane渲染、虚幻引擎渲染'}，角色一致性ID: ${characterName}。`;
    }

    console.log(`[立绘生成] 生成 ${characterName} (${characterType}) - ${angle.name}${referenceImageUrl ? ' [参考图生图]' : ''}...`);
    console.log(`[立绘生成] 📝 Prompt: ${prompt}`);
    if (referenceImageUrl) {
      console.log(`[立绘生成] 参考图URL完整: ${referenceImageUrl}`);
    }

    // 按用户所选图文厂商生成：coze 走原 SDK + 重试，其他厂商走对应 API
    const imageUrl = await generateArtworkImage(userId || 'dev-user', prompt, async () => {
      // 使用带重试机制的图片生成（最多7次，指数退避 15s→22s→33s→50s→75s→112s→120s）
      const generateRequest: {
        prompt: string;
        size: string;
        image?: string;
      } = {
        prompt,
        size: '2560x1440', // 明确指定16:9横版尺寸
      };

      // 如果有参考图像，尝试使用图生图功能
      // 图生图API要求：image参数为图片URL字符串
      if (referenceImageUrl) {
        console.log(`[立绘生成] 使用图生图功能，参考图URL: ${referenceImageUrl.substring(0, 100)}...`);
        generateRequest.image = referenceImageUrl;
      }

      const result = await generateImageWithRetry(imageClient, generateRequest, 7, 15000);

      if (!result.success) {
        console.error(`[立绘生成] 生成失败: ${result.error}`);
        return null;
      }
      return result.imageUrl!;
    });

    if (!imageUrl) {
      return null;
    }
    const downloadResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());
      
      const fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `images/character/${Date.now()}-${characterName}-${angle.type}.jpg`,
        contentType: 'image/jpeg',
      });

      // 根据角色类型设置分类标签
      const typeLabelMap: Record<string, string> = {
        protagonist: '主角',
        supporting: '配角',
        mystery: '神秘人',
        extra: '路人甲',
        sceneNPC: '场景人物',
      };
      const typeLabel = typeLabelMap[characterType] || '角色';

      // 保存到图片素材库
      const { data: savedImage } = await supabase
        .from('image_materials')
        .insert({
          title: characterName,
          description: `${characterName}（${typeLabel}）`,
          type: 'character',
          category: `角色立绘/${typeLabel}`,
          file_key: fileKey,
          file_name: `${characterName}-${angle.type}.jpg`,
          file_size: imageBuffer.length,
          width: 2560,  // 16:9横版
          height: 1440,
          format: 'jpg',
          thumbnail_key: fileKey,
          series_id: seriesId,
          character_id: char.id as string,
          character_name: characterName,
          purpose: `角色${angle.name}`,
          style,
          is_ai_generated: true,
          generation_prompt: prompt,
          tags: ['角色立绘', typeLabel, characterName, angle.name, style, 'AI生成'],
          user_id: userId, // 添加用户ID
        })
        .select()
        .single();

      const presignedUrl = await storage.generatePresignedUrl({ key: fileKey });

      return {
        angleType: angle.type,
        angleName: angle.name,
        fileKey,
        imageId: savedImage?.id || '',
        presignedUrl,
        imageUrl, // 原始图片URL，用于后续图生图的参考
      };
  } catch (error) {
    console.error(`生成角色立绘失败:`, error);
    // 输出更详细的错误信息
    if (error instanceof Error) {
      console.error(`[立绘生成] 错误消息: ${error.message}`);
      console.error(`[立绘生成] 错误堆栈: ${error.stack}`);
    }
  }
  return null;
}

// 生成场景图片
async function generateSceneImage(
  scene: Record<string, unknown>,
  style: string,
  genre: string,
  seriesId: string,
  imageClient: ImageGenerationClient,
  supabase: ReturnType<typeof getSupabaseClient>,
  imageStyle: string = 'realistic', // 图片风格：realistic(真人风) / comic(漫画风)
  userId?: string, // 用户ID，用于数据隔离
): Promise<{ sceneName: string; fileKey: string; imageId: string; presignedUrl: string } | null> {
  try {
    const sceneName = scene.name as string;
    const description = scene.description as string || '';
    const atmosphere = scene.atmosphere as string || '';
    const keyElements = (scene.keyElements as string[]) || [];
    const sceneType = (scene.sceneType as string) || 'common';
    const timeOfDay = (scene.timeOfDay as string) || '';
    const weather = (scene.weather as string) || '';
    
    const stylePrompt = getStylePrompt(genre, style, imageStyle);
    const noHumanRule = isPetGenre(genre) ? '，禁止出现人类或人类任何部位' : '，禁止出现任何人物立绘、人物轮廓、人物剪影、人物身影';
    
    // 场景图明确禁止包含人物立绘
    const noCharacterRule = '【严禁】场景图中不得出现任何人物立绘、角色形象、人物剪影、人物轮廓，禁止将角色立绘图合成到场景中，只能是纯场景环境图';
    
    // 根据图片风格设置风格要求
    const isComicStyle = imageStyle === 'comic';
    const styleRequirement = isComicStyle 
      ? '【超级核心要求】必须生成精美漫画风格场景，高质量二次元效果：精致线条、鲜艳色彩、动漫场景特征。'
      : '【超级核心要求】必须生成真实场景摄影照片，像用专业相机拍摄的真实场景照片一样：真实材质纹理、真实光影效果、真实环境氛围。严禁任何动漫、漫画、卡通、插画、手绘、游戏CG风格的痕迹！';
    
    const styleExtra = isComicStyle 
      ? '，精美二次元场景效果'
      : '，8K超高清照片画质，电影级真实光影效果';
    
    // 根据场景类型调整提示词
    const sceneTypeStyles: Record<string, { angle: string; quality: string }> = {
      fixed: { 
        angle: '全景构图，多角度展示空间布局', 
        quality: '细节丰富，层次分明，主场景质感' 
      },
      common: { 
        angle: '中景构图，通用性强', 
        quality: '干净整洁，适合多场景使用' 
      },
      special: { 
        angle: '特色视角，氛围感强', 
        quality: '视觉冲击力，独特风格' 
      },
      transition: { 
        angle: '简洁构图', 
        quality: '简洁大方，过渡自然' 
      },
    };
    
    const sceneStyle = sceneTypeStyles[sceneType] || sceneTypeStyles.common;
    
    // 时间和天气提示
    const timePrompt = timeOfDay && timeOfDay !== '不限' ? `，${timeOfDay}光线` : '';
    const weatherPrompt = weather && weather !== '不限' ? `，${weather}氛围` : '';
    
    const prompt = `${styleRequirement}高质量场景图，@${sceneName}，${description}${atmosphere ? `，${atmosphere}` : ''}${keyElements.length > 0 ? `，包含：${keyElements.join('、')}` : ''}，${stylePrompt}${noHumanRule}，${sceneStyle.angle}，${sceneStyle.quality}${timePrompt}${weatherPrompt}${styleExtra}。${noCharacterRule}`;

    console.log(`[场景照生成] 生成 @${sceneName} (${sceneType})...`);

    // 按用户所选图文厂商生成：coze 走原 SDK + 重试，其他厂商走对应 API
    const imageUrl = await generateArtworkImage(userId || 'dev-user', prompt, async () => {
      // 使用带重试机制的图片生成（最多5次，指数退避 5s→10s→20s→40s）
      const result = await generateImageWithRetry(
        imageClient,
        { prompt, size: '2560x1440' },  // 明确指定16:9横版尺寸
        7,  // 增加重试次数
        15000  // 增加基础等待时间
      );

      if (!result.success) {
        console.error(`[场景照生成] 生成失败: ${result.error}`);
        return null;
      }
      return result.imageUrl!;
    });

    if (!imageUrl) {
      return null;
    }
    const downloadResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());
    
    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: `images/scene/${Date.now()}-${sceneName}.jpg`,
      contentType: 'image/jpeg',
    });

    // 根据场景类型设置分类标签
    const typeLabelMap: Record<string, string> = {
      fixed: '固定场景',
      common: '常见场景',
      special: '特殊场景',
      transition: '过渡场景',
    };
    const typeLabel = typeLabelMap[sceneType] || '场景';

    const { data: savedImage } = await supabase
        .from('image_materials')
        .insert({
          title: sceneName,
          description: description,
          type: 'scene',
          category: `场景图/${typeLabel}`,
          file_key: fileKey,
          file_name: `${sceneName}.jpg`,
          file_size: imageBuffer.length,
          width: 2560,  // 16:9横版
          height: 1440,
          format: 'jpg',
          thumbnail_key: fileKey,
          series_id: seriesId,
          purpose: `${typeLabel}定妆照`,
          style,
          is_ai_generated: true,
          generation_prompt: prompt,
          tags: ['场景图', typeLabel, sceneName, style, 'AI生成'],
          user_id: userId, // 添加用户ID
        })
        .select()
        .single();

      const presignedUrl = await storage.generatePresignedUrl({ key: fileKey });

      return {
        sceneName,
        fileKey,
        imageId: savedImage?.id || '',
        presignedUrl,
      };
  } catch (error) {
    console.error('生成场景照失败:', error);
    if (error instanceof Error) {
      console.error(`[场景照生成] 错误消息: ${error.message}`);
      console.error(`[场景照生成] 错误堆栈: ${error.stack}`);
    }
  }
  return null;
}

/**
 * POST: 批量生成立绘
 * 
 * 请求参数：
 * - seriesId: 剧集ID
 * - generateCharacters: 是否生成角色立绘（默认true）
 * - generateScenes: 是否生成场景照（默认true）
 * - characterId: 单个角色ID（可选，指定时只生成该角色的立绘）
 * - sceneName: 单个场景名称（可选，指定时只生成该场景的图片）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seriesId } = await params;
    const body = await request.json();
    const { 
      generateCharacters = true, 
      generateScenes = true,
      characterId, // 单个角色ID（可选）
      sceneName,   // 单个场景名称（可选）
      angleType,   // 特定角度类型（可选）：front/side/back，指定时只生成该角度
      regenerateScene = false, // 是否重新生成场景（删除旧记录）
    } = body;

    // 获取当前用户ID
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', seriesId)
      .single();

    if (seriesError || !series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);

    const genre = series.genre as string || '现代';
    const style = series.style as string || '现代';
    const imageStyle = (series.image_style as string) || 'realistic'; // 图片风格：realistic(真人风) / comic(漫画风)
    const characters = (series.characters as Record<string, unknown>[]) || [];
    const metadata = (series.metadata as Record<string, unknown>) || {};
    const sceneDefinitions = (metadata.sceneDefinitions as Record<string, Record<string, unknown>>) || {};

    // 获取已存在的立绘，避免重复生成
    // 同时查询 character_name 以便通过名称匹配（因为重新提取角色时 ID 会变化）
    const { data: existingCharImages } = await supabase
      .from('image_materials')
      .select('character_id, character_name, purpose, file_key')
      .eq('series_id', seriesId)
      .eq('type', 'character');

    // 建立名称到角度的映射（更可靠的匹配方式）
    const existingCharAngleMap = new Map<string, Set<string>>(); // 按角色名称
    const existingCharIdMap = new Map<string, Set<string>>(); // 按角色ID
    
    if (existingCharImages) {
      for (const img of existingCharImages) {
        // 映射purpose到angle type
        const purpose = img.purpose as string;
        const angles = new Set<string>();
        if (purpose.includes('正面')) angles.add('front');
        if (purpose.includes('侧面')) angles.add('side');
        if (purpose.includes('背影')) angles.add('back');
        if (purpose.includes('动作')) angles.add('action');
        
        // 按名称存储
        const charName = img.character_name as string;
        if (charName) {
          if (!existingCharAngleMap.has(charName)) {
            existingCharAngleMap.set(charName, new Set());
          }
          angles.forEach(a => existingCharAngleMap.get(charName)!.add(a));
        }
        
        // 按ID存储
        const charId = img.character_id as string;
        if (charId) {
          if (!existingCharIdMap.has(charId)) {
            existingCharIdMap.set(charId, new Set());
          }
          angles.forEach(a => existingCharIdMap.get(charId)!.add(a));
        }
      }
    }

    // 获取已存在的场景照，避免重复生成
    const { data: existingSceneImages } = await supabase
      .from('image_materials')
      .select('title, file_key')
      .eq('series_id', seriesId)
      .eq('type', 'scene');

    const existingSceneNames = new Set<string>();
    if (existingSceneImages) {
      for (const img of existingSceneImages) {
        // 提取场景名称
        const title = img.title as string;
        const sceneName = title.replace(' - 场景照', '').trim();
        existingSceneNames.add(sceneName);
      }
    }

    const results = {
      characters: {} as Record<string, Record<string, { fileKey: string; imageId: string; presignedUrl: string }>>,
      scenes: {} as Record<string, { fileKey: string; imageId: string; presignedUrl: string }>,
    };

    // 1. 生成角色立绘
    if (generateCharacters && characters.length > 0) {
      // 如果指定了单个角色ID，只生成该角色
      const charactersToProcess = characterId 
        ? characters.filter(c => c.id === characterId)
        : characters;
      
      if (characterId && charactersToProcess.length === 0) {
        console.log(`[立绘生成] 未找到角色ID: ${characterId}`);
      } else {
        console.log(`[立绘生成] 开始生成 ${charactersToProcess.length} 个角色的立绘...`);

        for (const char of charactersToProcess) {
        const charId = char.id as string;
        const charName = char.name as string;
        const characterType = (char.characterType as string) || 'supporting';
        results.characters[charId] = {};
        
        // 检查该角色已有的立绘角度（优先通过名称匹配，ID作为后备）
        let existingAngles = existingCharAngleMap.get(charName) || new Set();
        if (existingAngles.size === 0) {
          existingAngles = existingCharIdMap.get(charId) || new Set();
        }
        console.log(`[立绘生成] ${charName} (${characterType}) 已有立绘角度: ${Array.from(existingAngles).join(', ') || '无'}`);

        // 根据角色类型选择角度配置
        const validTypes = ['protagonist', 'supporting', 'mystery', 'extra', 'sceneNPC'] as const;
        const characterTypeKey = validTypes.includes(characterType as typeof validTypes[number]) 
          ? characterType as typeof validTypes[number] 
          : 'supporting';
        const allAngles = CHARACTER_ANGLE_CONFIGS[characterTypeKey];
        
        // 如果指定了特定角度，只生成该角度
        const anglesToGenerate = angleType 
          ? allAngles.filter(a => a.type === angleType)
          : allAngles;
        
        if (angleType && anglesToGenerate.length === 0) {
          console.log(`[立绘生成] 无效的角度类型: ${angleType}`);
          continue;
        }
        
        if (angleType) {
          console.log(`[立绘生成] 只生成 ${charName} 的 ${angleType} 角度立绘`);
        }

        // 用于存储参考图像URL（优先使用UID图片，其次是正面照）
        // 获取角色的 UID 图片和特征描述
        const uidImageUrl = char.uidImageUrl as string | undefined;
        const uidImageKey = char.uidImageKey as string | undefined;
        const characterFeatures = char.characterFeatures as string | undefined;
        
        // 如果有 UID 图片，优先使用作为参考图
        let referenceImageUrl: string | undefined = uidImageUrl;
        
        // 如果有 UID 图片但需要生成预签名 URL
        if (uidImageKey && !uidImageUrl) {
          try {
            referenceImageUrl = await storage.generatePresignedUrl({ key: uidImageKey });
            console.log(`[立绘生成] 使用角色UID作为参考图: ${charName}`);
          } catch (e) {
            console.error(`[立绘生成] 获取UID图片URL失败:`, e);
          }
        }
        
        // 如果没有 UID 图片，尝试使用已有的正面照或侧面照作为参考
        if (!referenceImageUrl) {
          // 先找正面照
          const frontImg = existingCharImages?.find(
            img => (img.character_name === charName || img.character_id === charId) && img.purpose.includes('正面')
          );
          console.log(`[立绘生成] 查找正面照: charName=${charName}, charId=${charId}, frontImg=`, frontImg ? `found, file_key=${frontImg.file_key}` : 'not found');
          if (frontImg) {
            try {
              referenceImageUrl = await storage.generatePresignedUrl({ key: frontImg.file_key });
              console.log(`[立绘生成] 使用已有正面照作为参考图: ${charName}, URL长度=${referenceImageUrl?.length || 0}`);
            } catch (e) {
              console.error(`[立绘生成] 获取正面照URL失败:`, e);
            }
          }
        }
        
        // 如果还是没有，尝试使用侧面照
        if (!referenceImageUrl) {
          const sideImg = existingCharImages?.find(
            img => (img.character_name === charName || img.character_id === charId) && img.purpose.includes('侧面')
          );
          if (sideImg) {
            try {
              referenceImageUrl = await storage.generatePresignedUrl({ key: sideImg.file_key });
              console.log(`[立绘生成] 使用已有侧面照作为参考图: ${charName}`);
            } catch (e) {
              console.error(`[立绘生成] 获取侧面照URL失败:`, e);
            }
          }
        }

        // 为角色生成对应角度的立绘（跳过已存在的，除非明确指定了角度）
        for (const angle of anglesToGenerate) {
          // 如果该角度已存在，且没有明确指定角度，则跳过生成
          // 如果明确指定了角度（angleType），则强制重新生成
          if (existingAngles.has(angle.type) && !angleType) {
            console.log(`[立绘生成] 跳过 ${charName} - ${angle.name}（已存在）`);
            // 从数据库获取已存在的图片信息（优先按名称匹配）
            const existingImg = existingCharImages?.find(
              img => (img.character_name === charName || img.character_id === charId) && 
              ((angle.type === 'front' && img.purpose.includes('正面')) ||
               (angle.type === 'side' && img.purpose.includes('侧面')) ||
               (angle.type === 'back' && img.purpose.includes('背影')))
            );
            if (existingImg) {
              const presignedUrl = await storage.generatePresignedUrl({ key: existingImg.file_key });
              results.characters[charId][angle.type] = {
                fileKey: existingImg.file_key,
                imageId: '',
                presignedUrl,
              };
              // 如果已有正面照，将其作为参考图
              if (angle.type === 'front' || !referenceImageUrl) {
                referenceImageUrl = presignedUrl;
              }
            }
            continue;
          }
          
          // 如果明确指定了角度且已存在，删除旧的图片记录
          if (existingAngles.has(angle.type) && angleType) {
            console.log(`[立绘生成] 重新生成 ${charName} - ${angle.name}（删除旧图片）`);
            const existingImg = existingCharImages?.find(
              img => (img.character_name === charName || img.character_id === charId) && 
              ((angle.type === 'front' && img.purpose.includes('正面')) ||
               (angle.type === 'side' && img.purpose.includes('侧面')) ||
               (angle.type === 'back' && img.purpose.includes('背影')))
            );
            if (existingImg) {
              // 删除旧图片记录（使用 file_key 匹配）
              const { error: deleteError } = await supabase
                .from('image_materials')
                .delete()
                .eq('file_key', existingImg.file_key);
              if (deleteError) {
                console.error(`[立绘生成] 删除旧图片记录失败:`, deleteError);
              } else {
                console.log(`[立绘生成] 已删除旧的 ${angle.name} 图片记录`);
              }
            }
          }

          console.log(`[立绘生成] 开始生成 ${charName} - ${angle.name}...`);
          const result = await generateCharacterImage(
            char,
            angle,
            style,
            genre,
            seriesId,
            imageClient,
            supabase,
            characterType,
            referenceImageUrl, // 传递参考图URL
            characterFeatures, // 传递角色特征描述
            imageStyle, // 传递图片风格
            userId // 传递用户ID
          );

          if (result) {
            results.characters[charId][result.angleType] = {
              fileKey: result.fileKey,
              imageId: result.imageId,
              presignedUrl: result.presignedUrl,
            };
            // 第一个生成的图片作为后续角度的参考图（使用对象存储URL，避免时效性问题）
            if (!referenceImageUrl) {
              referenceImageUrl = result.presignedUrl;
              console.log(`[立绘生成] 设置参考图: ${charName} - ${angle.name}`);
            }
          }

          // 每张图片之间等待，避免API限流（根据是否成功调整等待时间）
          // 成功后等待较短，失败后等待较长
          const waitTime = result ? 3000 : 10000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // 每个角色之间等待更长时间，给API喘息时间
        console.log(`[立绘生成] ${charName} 立绘生成完成，等待 15s 后处理下一个角色...`);
        await new Promise(resolve => setTimeout(resolve, 15000));

        // 更新角色的referenceImages（使用合并策略，保留已有角度）
        const charIndex = characters.findIndex(c => c.id === charId);
        if (charIndex !== -1) {
          // 合并已有的 referenceImages 和新生成的图片
          const existingRefImages = (characters[charIndex].referenceImages || {}) as Record<string, { fileKey: string; imageId: string; presignedUrl: string }>;
          const newRefImages: Record<string, { fileKey: string; imageId: string; presignedUrl: string }> = {
            ...existingRefImages,
            ...results.characters[charId] // 新生成的角度会覆盖已有的同名角度
          };
          
          // 根据角色类型选择主图
          let mainImageUrl: string | undefined;
          if (characterType === 'mystery') {
            // 神秘人优先使用侧面剪影
            mainImageUrl = newRefImages.side?.fileKey || 
                          newRefImages.back?.fileKey;
          } else if (characterType === 'extra') {
            // 路人甲使用正面半身
            mainImageUrl = newRefImages.front?.fileKey;
          } else {
            // 主角和配角优先使用正面照
            mainImageUrl = newRefImages.front?.fileKey || 
                          newRefImages.side?.fileKey;
          }
          
          characters[charIndex] = {
            ...characters[charIndex],
            referenceImages: newRefImages,
            imageAngles: Object.keys(newRefImages),
            referenceImageUrl: mainImageUrl,
          };
        }
      }
      }

      // 更新剧本的角色信息
      await supabase
        .from('drama_series')
        .update({ 
          characters,
          updated_at: new Date().toISOString()
        })
        .eq('id', seriesId);
    }

    // 2. 生成场景照
    if (generateScenes && Object.keys(sceneDefinitions).length > 0) {
      // 如果指定了单个场景名称，只生成该场景
      // 支持两种匹配方式：
      // 1. 通过 sceneName 匹配场景的 key（如 scene_1）
      // 2. 通过 sceneName 匹配场景的 name 属性（如 御书房）
      const scenesToProcess = sceneName
        ? Object.entries(sceneDefinitions).filter(([key, scene]) => 
            key === sceneName || (scene as Record<string, unknown>).name === sceneName
          )
        : Object.entries(sceneDefinitions);
      
      if (sceneName && scenesToProcess.length === 0) {
        console.log(`[场景照生成] 未找到场景: ${sceneName}`);
        return NextResponse.json({
          success: false,
          error: `未找到场景 "${sceneName}"，请检查场景名称是否正确`,
          results: { characters: {}, scenes: {} },
        });
      } else if (scenesToProcess.length > 0) {
        console.log(`[场景照生成] 开始生成 ${scenesToProcess.length} 个场景照... (regenerateScene=${regenerateScene})`);

        for (const [sceneId, scene] of scenesToProcess) {
          const currentSceneName = scene.name as string;
          
          // 如果场景照已存在，跳过生成（除非是重新生成模式）
          if (existingSceneNames.has(currentSceneName) && !regenerateScene) {
            console.log(`[场景照生成] 跳过场景 ${currentSceneName}（已存在）`);
            // 从数据库获取已存在的图片信息
            const existingImg = existingSceneImages?.find(
              img => img.title.includes(currentSceneName)
            );
            if (existingImg) {
              const presignedUrl = await storage.generatePresignedUrl({ key: existingImg.file_key });
              results.scenes[sceneId] = {
                fileKey: existingImg.file_key,
                imageId: '',
                presignedUrl,
              };
            }
            continue;
          }
          
          // 如果是重新生成模式，先删除旧记录
          if (regenerateScene && existingSceneNames.has(currentSceneName)) {
            console.log(`[场景照生成] 重新生成 ${currentSceneName}，删除旧记录...`);
            const existingImg = existingSceneImages?.find(
              img => img.title.includes(currentSceneName)
            );
            if (existingImg) {
              // 删除旧的图片文件
              try {
                await storage.deleteFile({ fileKey: existingImg.file_key });
                console.log(`[场景照生成] 已删除旧图片文件: ${existingImg.file_key}`);
              } catch (e) {
                console.error(`[场景照生成] 删除旧图片文件失败:`, e);
              }
              // 删除数据库记录
              await supabase
                .from('image_materials')
                .delete()
                .eq('series_id', seriesId)
                .eq('title', existingImg.title);
              console.log(`[场景照生成] 已删除旧数据库记录: ${existingImg.title}`);
            }
          }

          const result = await generateSceneImage(
            scene,
            style,
            genre,
            seriesId,
            imageClient,
            supabase,
            imageStyle, // 传递图片风格
            userId // 传递用户ID
          );

          if (result) {
            results.scenes[sceneId] = {
              fileKey: result.fileKey,
              imageId: result.imageId,
              presignedUrl: result.presignedUrl,
            };
          }

          // 每个场景之间等待，避免API限流（根据是否成功调整等待时间）
          const waitTime = result ? 5000 : 15000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // 更新剧本的元数据中的场景图片信息
      const scenesMetadata: Record<string, string> = {};
      Object.entries(results.scenes).forEach(([sceneId, data]) => {
        scenesMetadata[sceneId] = data.fileKey;
      });

      await supabase
        .from('drama_series')
        .update({ 
          metadata: {
            ...metadata,
            sceneImages: scenesMetadata,
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', seriesId);
    }

    const characterCount = Object.keys(results.characters).length;
    const sceneCount = Object.keys(results.scenes).length;
    // 计算实际生成的角色立绘数量
    const actualCharImageCount = Object.values(results.characters).reduce(
      (sum, angles) => sum + Object.keys(angles).length, 0
    );
    const totalImages = actualCharImageCount + sceneCount;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        charactersGenerated: characterCount,
        scenesGenerated: sceneCount,
        totalImagesGenerated: totalImages,
        characterImageCount: actualCharImageCount,
      },
      message: `成功处理 ${characterCount} 个角色（共${actualCharImageCount}张立绘）和 ${sceneCount} 个场景照`,
    });
  } catch (error) {
    console.error('生成立绘失败:', error);
    return NextResponse.json(
      { error: '生成立绘失败' },
      { status: 500 }
    );
  }
}

/**
 * GET: 获取剧集的立绘列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seriesId } = await params;
    const supabase = getSupabaseClient();

    // 获取角色立绘
    const { data: characterImages, error: charError } = await supabase
      .from('image_materials')
      .select('*')
      .eq('series_id', seriesId)
      .eq('type', 'character')
      .order('created_at', { ascending: false });

    // 获取场景照
    const { data: sceneImages, error: sceneError } = await supabase
      .from('image_materials')
      .select('*')
      .eq('series_id', seriesId)
      .eq('type', 'scene')
      .order('created_at', { ascending: false });

    // 生成预签名URL
    const generateUrls = async (images: typeof characterImages) => {
      if (!images) return [];
      return Promise.all(
        images.map(async (img) => {
          try {
            const presignedUrl = await storage.generatePresignedUrl({ key: img.file_key });
            return { ...img, imageUrl: presignedUrl };
          } catch {
            return { ...img, imageUrl: '' };
          }
        })
      );
    };

    const charactersWithUrls = await generateUrls(characterImages);
    const scenesWithUrls = await generateUrls(sceneImages);

    // 过滤重复：只保留每个角色每个角度的最新图片
    const uniqueCharacters = new Map<string, typeof charactersWithUrls[0]>();
    for (const img of charactersWithUrls) {
      const key = `${img.character_id}_${img.purpose}`;
      if (!uniqueCharacters.has(key)) {
        uniqueCharacters.set(key, img);
      }
    }

    // 过滤重复场景：只保留每个场景名称的最新图片
    const uniqueScenes = new Map<string, typeof scenesWithUrls[0]>();
    for (const img of scenesWithUrls) {
      const sceneName = img.title.replace(' - 场景照', '').trim();
      if (!uniqueScenes.has(sceneName)) {
        uniqueScenes.set(sceneName, img);
      }
    }

    return NextResponse.json({
      success: true,
      characters: Array.from(uniqueCharacters.values()),
      scenes: Array.from(uniqueScenes.values()),
    });
  } catch (error) {
    console.error('获取立绘失败:', error);
    return NextResponse.json(
      { error: '获取立绘失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 清理重复的立绘图片
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seriesId } = await params;
    const supabase = getSupabaseClient();

    // 获取所有角色立绘
    const { data: characterImages, error: charError } = await supabase
      .from('image_materials')
      .select('*')
      .eq('series_id', seriesId)
      .eq('type', 'character')
      .order('created_at', { ascending: false });

    // 获取所有场景照
    const { data: sceneImages, error: sceneError } = await supabase
      .from('image_materials')
      .select('*')
      .eq('series_id', seriesId)
      .eq('type', 'scene')
      .order('created_at', { ascending: false });

    if (charError || sceneError) {
      return NextResponse.json(
        { error: '获取图片失败' },
        { status: 500 }
      );
    }

    // 找出重复的角色立绘（保留最新的）
    const uniqueCharKeys = new Set<string>();
    const duplicateCharIds: string[] = [];
    
    for (const img of characterImages || []) {
      const key = `${img.character_id}_${img.purpose}`;
      if (uniqueCharKeys.has(key)) {
        duplicateCharIds.push(img.id);
      } else {
        uniqueCharKeys.add(key);
      }
    }

    // 找出重复的场景照（保留最新的）
    const uniqueSceneNames = new Set<string>();
    const duplicateSceneIds: string[] = [];
    
    for (const img of sceneImages || []) {
      const sceneName = (img.title as string).replace(' - 场景照', '').trim();
      if (uniqueSceneNames.has(sceneName)) {
        duplicateSceneIds.push(img.id);
      } else {
        uniqueSceneNames.add(sceneName);
      }
    }

    const allDuplicateIds = [...duplicateCharIds, ...duplicateSceneIds];

    // 删除重复的图片
    if (allDuplicateIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('image_materials')
        .delete()
        .in('id', allDuplicateIds);

      if (deleteError) {
        console.error('删除重复图片失败:', deleteError);
        return NextResponse.json(
          { error: '删除重复图片失败' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: allDuplicateIds.length,
      message: `已清理 ${duplicateCharIds.length} 张重复的角色立绘和 ${duplicateSceneIds.length} 张重复的场景照`,
    });
  } catch (error) {
    console.error('清理重复图片失败:', error);
    return NextResponse.json(
      { error: '清理重复图片失败' },
      { status: 500 }
    );
  }
}
