import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { parseQualityLevel, getImageQuality } from '@/lib/quality-config';
import { DEFAULT_MODELS, SOLUTION_PRESETS, IMAGE_MODELS, SolutionType } from '@/lib/config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { createImageClient, getUserIdFromRequest } from '@/lib/service-factory';
import { getUserMemberTier } from '@/lib/quota-service';
import { enforceImageSize, enforceImageBatchCount, getMemberLimitsDescription } from '@/lib/member-limits';
import { hasDatabaseConfig, getLocalUserConfig } from '@/lib/server-config-store';

/**
 * 获取用户的方案与图片厂商/模型设置
 */
async function getUserSolution(userId: string): Promise<SolutionType> {
  let preset: unknown;
  if (hasDatabaseConfig()) {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_config')
      .select('solution_preset')
      .eq('user_id', userId)
      .single();
    preset = data?.solution_preset;
  } else {
    // 未配置数据库：读取本地兜底存储
    preset = getLocalUserConfig(userId).solution_preset;
  }

  if (preset === 'zhipu') {
    return 'zhipu';
  }
  if (preset === 'qwen') {
    return 'qwen';
  }
  return 'standard';
}

/**
 * 读取用户在模型设置中保存的图片厂商与模型
 */
async function getUserImageSettings(userId: string): Promise<{ provider: string | null; model: string | null }> {
  let record: Record<string, unknown>;
  if (hasDatabaseConfig()) {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_config')
      .select('image_provider,image_model')
      .eq('user_id', userId)
      .single();
    record = (data || {}) as unknown as Record<string, unknown>;
  } else {
    // 未配置数据库：读取本地兜底存储
    record = getLocalUserConfig(userId);
  }

  return {
    provider: typeof record.image_provider === 'string' && record.image_provider ? record.image_provider : null,
    model: typeof record.image_model === 'string' && record.image_model ? record.image_model : null,
  };
}

/**
 * 计算符合 Seedream 5.0 Lite 要求的尺寸
 * 
 * Seedream 5.0 Lite 要求：
 * - 总像素范围：[2560x1440=3686400, 4096x4096=16777216]
 * - 宽高比范围：[1/16, 16]
 */
function calculateValidSize(
  width?: number,
  height?: number,
  qualityConfig?: { size: string }
): string {
  // 如果指定了宽高，验证并调整
  if (width && height) {
    const pixels = width * height;
    const aspectRatio = width / height;
    
    // Seedream 5.0 Lite 的像素范围
    const minPixels = 3686400;  // 2560x1440
    const maxPixels = 16777216; // 4096x4096
    
    // 如果在有效范围内，直接使用
    if (pixels >= minPixels && pixels <= maxPixels && 
        aspectRatio >= 1/16 && aspectRatio <= 16) {
      return `${width}x${height}`;
    }
    
    // 如果像素不足，按比例放大
    if (pixels < minPixels) {
      const scale = Math.sqrt(minPixels / pixels);
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      return `${newWidth}x${newHeight}`;
    }
    
    // 如果像素超限，按比例缩小
    if (pixels > maxPixels) {
      const scale = Math.sqrt(maxPixels / pixels);
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      return `${newWidth}x${newHeight}`;
    }
  }
  
  // 使用默认尺寸策略
  const imageSize = String(DEFAULT_MODELS.imageSize);
  if (imageSize === '4K') {
    return '3840x2160';
  }
  
  // 默认使用推荐的 2K 横版尺寸
  return '2560x1440';
}

/**
 * AI图片生成接口
 * 根据用户方案选择模型：
 * - standard: 扣子 Doubao-Seedream-5.0-Lite (支持2K/4K，提示词优化，组图生成)
 * - zhipu: 智谱 Cogview-3-Flash (免费)
 * - qwen: 千问方案 - 使用扣子 Doubao-Seedream-5.0-Lite (复用扣子)
 * 
 * Seedream 5.0 Lite 新功能：
 * - 提示词优化模式：standard（高质量）/ fast（快速）
 * - 组图生成：sequentialImageGeneration + maxImages
 * - 多图输入：最多14张参考图
 * 
 * 用于海报制作、场景图、角色图生成
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);
    // 用户在模型设置中选择的图片厂商与模型（优先级最高）
    const userImageSettings = await getUserImageSettings(userId);
    
    // 获取用户会员等级并强制应用限制
    const memberTier = await getUserMemberTier(userId);
    const limitsDescription = getMemberLimitsDescription(memberTier);
    
    console.log(`[图片生成] 方案: ${solution}, 会员等级: ${memberTier}`);
    console.log(`[图片生成] 限制: ${limitsDescription.image}`);
    
    const body = await request.json();
    const {
      prompt,
      width,
      height,
      count = 1,
      quality,
      referenceImage,
      referenceImages,      // 新增：多图输入（数组）
      optimizePromptMode,   // 新增：提示词优化模式（standard/fast）
      sequentialGeneration, // 新增：是否启用组图生成
      maxImages,            // 新增：组图最大数量（1-15）
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供图片描述' },
        { status: 400 }
      );
    }

    // 解析质量等级
    const qualityLevel = parseQualityLevel(quality);
    const qualityConfig = getImageQuality(qualityLevel);

    // 强制应用会员等级限制
    const requestedSize = width && height ? `${width}x${height}` : qualityConfig.size;
    const enforcedSize = enforceImageSize(memberTier, requestedSize);
    const enforcedCount = enforceImageBatchCount(memberTier, count);

    // 根据用户设置确定图片厂商与模型
    // 优先级：用户设置厂商 > 方案；模型：请求参数 > 用户设置 > 厂商默认
    const { detectProviderFromModel } = await import('@/lib/model-catalog');
    const imageProvider = userImageSettings.provider
      || (body.model ? detectProviderFromModel('image', body.model) : null)
      || (solution === 'zhipu' ? 'zhipu' : solution === 'qwen' ? 'qwen' : 'coze');
    const model = body.model
      || userImageSettings.model
      || (imageProvider === 'zhipu'
        ? SOLUTION_PRESETS.zhipu.models.image
        : imageProvider === 'qwen'
          ? SOLUTION_PRESETS.qwen.models.image
          : DEFAULT_MODELS.image);

    console.log(`[图片生成] 厂商: ${imageProvider}, 模型: ${model}, 尺寸: ${enforcedSize}, 数量: ${enforcedCount}`);

    // 根据厂商调用不同的生成服务
    if (imageProvider === 'zhipu') {
      return await generateWithZhipu(userId, {
        prompt,
        enforcedSize,
        count: enforcedCount,
        qualityLevel,
        memberTier,
        model,
      });
    } else if (imageProvider === 'qwen' || imageProvider === 'volcengine' || imageProvider === 'custom') {
      // 千问万相 / 火山方舟 / 自定义端点：统一走厂商分发模块
      return await generateWithProvider(userId, {
        provider: imageProvider,
        model,
        prompt,
        size: enforcedSize,
        count: enforcedCount,
        qualityLevel,
        memberTier,
        solution,
      });
    } else {
      // 扣子方案
      return await generateWithCoze(request, {
        prompt,
        enforcedSize,
        count: enforcedCount,
        qualityLevel,
        qualityConfig,
        referenceImage,
        referenceImages,
        optimizePromptMode,
        sequentialGeneration,
        maxImages,
        model,
        memberTier,
        solution,
      });
    }

  } catch (error) {
    console.error('[图片生成] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 使用 S3 存储转存临时图片 URL
 */
const imageStorage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

async function persistTempImage(url: string, prefix: string): Promise<{ fileKey: string; presignedUrl: string } | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) throw new Error(`下载临时图片失败 HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const fileKey = await imageStorage.uploadFile({
      fileContent: buffer,
      fileName: `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
      contentType: 'image/jpeg',
    });
    const presignedUrl = await imageStorage.generatePresignedUrl({ key: fileKey });
    return { fileKey, presignedUrl };
  } catch (error) {
    console.error('[图片生成] 转存临时图片失败，返回原始URL:', error);
    return null;
  }
}

/**
 * 使用厂商分发模块生成图片（千问万相 / 火山方舟 / 自定义端点）
 */
async function generateWithProvider(
  userId: string,
  params: {
    provider: string;
    model: string;
    prompt: string;
    size: string;
    count: number;
    qualityLevel: string;
    memberTier: string;
    solution: string;
  }
) {
  const { provider, model, prompt, size, count, qualityLevel, memberTier, solution } = params;

  try {
    const { generateImageForProvider } = await import('@/lib/media-generation');
    const result = await generateImageForProvider({ userId, provider, model, prompt, size, count });

    // DashScope 等返回临时 URL，转存到对象存储保证长期可用
    const persisted = await Promise.all(
      result.urls.map(url => persistTempImage(url, 'images/generated'))
    );

    const images = persisted.map((p, i) => ({
      url: p?.presignedUrl || result.urls[i],
      fileKey: p?.fileKey || null,
    }));

    return NextResponse.json({
      success: true,
      images,
      quality: qualityLevel,
      size,
      model: result.model,
      provider: result.provider,
      solution,
      memberTier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片生成失败';
    console.error(`[${provider}图片] 生成失败:`, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * 使用智谱SDK生成图片
 */
async function generateWithZhipu(
  userId: string,
  params: {
    prompt: string;
    enforcedSize: string;
    count: number;
    qualityLevel: string;
    memberTier: string;
    /** 用户所选智谱图片模型（glm-image / cogview-4 等，含日期后缀变体） */
    model?: string;
  }
) {
  const { prompt, enforcedSize, count, qualityLevel, memberTier, model: userModel } = params;
  const imageModel = userModel || 'glm-image';

  // 检查智谱API是否配置
  const configured = await isZhipuConfiguredForUser(userId);
  if (!configured) {
    return NextResponse.json(
      { error: '智谱API未配置，请在方案设置中配置 API Key' },
      { status: 400 }
    );
  }

  try {
    const client = await getZhipuClientAsync(userId);

    // 解析强制尺寸（按模型能力：cogview-4 支持更多宽高比，glm-image 仅三种）
    const isCogView = imageModel.startsWith('cogview');
    let size: string;
    const [w, h] = enforcedSize.split('x').map(Number);
    if (w && h) {
      const ratio = w / h;
      if (ratio > 1.2) {
        size = isCogView ? '1344x768' : '1024x768';  // 横版
      } else if (ratio < 0.8) {
        size = isCogView ? '768x1344' : '768x1024';  // 竖版
      } else {
        size = '1024x1024'; // 正方形
      }
    } else {
      size = '1024x1024';
    }

    // 增强写实风格提示词
    const enhancedPrompt = `超写实摄影风格，真人实拍效果，照片级真实感，${prompt}，真实皮肤纹理、真实服装材质、真实光影效果，严禁动漫风格、漫画风格、二次元风格、卡通风格、插画风格、手绘风格`;

    console.log(`[智谱图片] 生成: ${imageModel}, 尺寸: ${size}`);

    const response = await client.generateImage(enhancedPrompt, { size, model: imageModel });

    // 提取图片URL
    const images = (response.data || [])
      .slice(0, count)
      .map((item) => ({ 
        url: item.url,
        b64Json: item.b64_json,
      }));

    return NextResponse.json({
      success: true,
      images,
      quality: qualityLevel,
      size,
      model: 'glm-image',
      solution: 'zhipu',
      memberTier,
    });

  } catch (error) {
    console.error('[智谱图片] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 使用扣子SDK生成图片（Seedream 5.0 Lite）
 * 
 * 支持功能：
 * - 提示词优化：optimizePromptMode（standard/fast）
 * - 组图生成：sequentialImageGeneration（auto/disabled）
 * - 多图输入：referenceImages（最多14张）
 */
async function generateWithCoze(
  request: NextRequest,
  params: {
    prompt: string;
    enforcedSize: string;
    count: number;
    qualityLevel: string;
    qualityConfig: { size: string };
    referenceImage?: string;
    referenceImages?: string[];    // 多图输入
    optimizePromptMode?: string;   // 提示词优化模式
    sequentialGeneration?: boolean; // 组图生成开关
    maxImages?: number;            // 组图最大数量
    model: string;
    memberTier: string;
    solution: string;              // 方案标识
  }
) {
  const {
    prompt,
    enforcedSize,
    count,
    qualityLevel,
    qualityConfig,
    referenceImage,
    referenceImages,
    optimizePromptMode = 'standard',
    sequentialGeneration = false,
    maxImages = 15,
    model,
    memberTier,
    solution
  } = params;

  // 使用强制尺寸
  const size = enforcedSize;

  // 获取模型配置
  const modelConfig = IMAGE_MODELS[model as keyof typeof IMAGE_MODELS];
  const modelFeatures = modelConfig?.features;

  console.log(`[扣子图片] 生成: ${model}, 尺寸: ${size}, 提示词优化: ${optimizePromptMode}, 组图: ${sequentialGeneration}`);

  // 使用服务工厂创建客户端（支持用户Token）
  const { client, useUserToken } = await createImageClient(request);
  console.log(`[扣子图片] 使用用户Token: ${useUserToken}`);

  // 增强写实风格提示词
  const enhancedPrompt = `超写实摄影风格，真人实拍效果，照片级真实感，${prompt}，真实皮肤纹理、真实服装材质、真实光影效果，严禁动漫风格、漫画风格、二次元风格、卡通风格、插画风格、手绘风格`;

  // 合并参考图片
  let imageInput: string | string[] | undefined;
  if (referenceImages && referenceImages.length > 0) {
    // 多图输入（最多14张）
    imageInput = referenceImages.slice(0, 14);
  } else if (referenceImage) {
    // 单图输入
    imageInput = referenceImage;
  }

  // 构建生成请求
  const generateRequest: {
    prompt: string;
    size: string;
    image?: string | string[];
    watermark: boolean;
    optimizePromptMode?: string;
    sequentialImageGeneration?: 'auto' | 'disabled';
    sequentialImageGenerationMaxImages?: number;
  } = {
    prompt: enhancedPrompt,
    size,
    watermark: false,
  };

  // 添加参考图片
  if (imageInput) {
    generateRequest.image = imageInput;
  }

  // Seedream 5.0 Lite / 4.5 新功能：提示词优化
  if (modelFeatures?.optimizePrompt && optimizePromptMode) {
    generateRequest.optimizePromptMode = optimizePromptMode;
  }

  // Seedream 5.0 Lite / 4.5 新功能：组图生成
  if (modelFeatures?.sequentialGeneration && sequentialGeneration) {
    generateRequest.sequentialImageGeneration = 'auto';
    generateRequest.sequentialImageGenerationMaxImages = Math.min(maxImages, 15);
  }

  // 调用图片生成
  const response = await client.generate(generateRequest);

  const helper = client.getResponseHelper(response);

  if (!helper.success || helper.imageUrls.length === 0) {
    return NextResponse.json(
      { error: helper.errorMessages.join(', ') || '图片生成失败' },
      { status: 500 }
    );
  }

  // 返回结果
  const images = helper.imageUrls.slice(0, sequentialGeneration ? maxImages : count).map(url => ({ url }));

  return NextResponse.json({
    success: true,
    images,
    quality: qualityLevel,
    size,
    model,
    solution,
    memberTier,
    features: {
      optimizePrompt: modelFeatures?.optimizePrompt || false,
      sequentialGeneration: modelFeatures?.sequentialGeneration || false,
      multiImageInput: modelFeatures?.multiImageInput || false,
    },
    request: {
      promptLength: enhancedPrompt.length,
      optimizePromptMode,
      sequentialGeneration,
      maxImages: sequentialGeneration ? maxImages : undefined,
      referenceImageCount: Array.isArray(imageInput) ? imageInput.length : (imageInput ? 1 : 0),
    },
  });
}
