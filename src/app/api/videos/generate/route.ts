import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { parseQualityLevel, getVideoQuality } from '@/lib/quality-config';
import { VideoGenerationClient, Config, HeaderUtils, Content, S3Storage } from 'coze-coding-dev-sdk';
import { getQwenMediaConfig, qwenVideoGenerate } from '@/lib/qwen-media-client';
import { DEFAULT_MODELS, SOLUTION_PRESETS, VIDEO_MODELS, SolutionType } from '@/lib/config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { createVideoService, getUserIdFromRequest } from '@/lib/service-factory';
import { enhanceCameraMovementPrompt, generateCameraMovementPrompt } from '@/lib/camera-movement-prompts';
import { getUserMemberTier } from '@/lib/quota-service';
import { enforceVideoResolution, enforceVideoDuration, getMemberLimitsDescription, MEMBER_LIMITS } from '@/lib/member-limits';
import { hasDatabaseConfig, getLocalUserConfig } from '@/lib/server-config-store';



// 初始化对象存储客户端
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 千问等厂商视频为同步等待异步任务，最长约 4.5 分钟
export const maxDuration = 300;

/**
 * 获取视频模型的最大时长限制
 */
function getModelMaxDuration(model: string): number {
  const modelConfig = VIDEO_MODELS[model as keyof typeof VIDEO_MODELS];
  if (modelConfig?.features?.durationRange) {
    return modelConfig.features.durationRange[1]; // 返回最大值
  }
  // 默认最大时长 15 秒（Seedance 2.0 已全量启用）
  return 15;
}

/**
 * 获取视频模型支持的分辨率列表
 */
function getModelSupportedResolutions(model: string): string[] {
  const modelConfig = VIDEO_MODELS[model as keyof typeof VIDEO_MODELS];
  if (modelConfig?.features?.resolutions) {
    return [...modelConfig.features.resolutions]; // 复制数组以支持修改
  }
  // 默认支持 1080p
  return ['480p', '720p', '1080p'];
}

/**
 * 根据模型限制调整视频分辨率
 * 如果模型不支持请求的分辨率，强制降级到模型支持的最高分辨率
 */
function adjustResolutionByModel(resolution: string, model: string): string {
  const supportedResolutions = getModelSupportedResolutions(model);
  console.log(`[分辨率调整] 请求分辨率: ${resolution}, 模型: ${model}, 支持: ${supportedResolutions.join(', ')}`);
  
  // 如果模型支持请求的分辨率，直接返回
  if (supportedResolutions.includes(resolution)) {
    return resolution;
  }
  
  // 分辨率等级映射（从低到高）
  const resolutionOrder = ['480p', '720p', '1080p'];
  
  // 找到模型支持的最高分辨率
  let highestSupported = supportedResolutions[supportedResolutions.length - 1];
  for (let i = resolutionOrder.length - 1; i >= 0; i--) {
    if (supportedResolutions.includes(resolutionOrder[i])) {
      highestSupported = resolutionOrder[i];
      break;
    }
  }
  
  console.log(`[分辨率调整] 强制降级为: ${highestSupported}`);
  return highestSupported;
}

/**
 * 根据模型限制调整视频时长
 */
function adjustDurationByModel(duration: number, model: string): number {
  // 精确匹配优先；带后缀变体（如 doubao-seedance-1-5-pro-250528-test）按前缀/包含匹配
  let modelConfig = VIDEO_MODELS[model as keyof typeof VIDEO_MODELS];
  if (!modelConfig && model) {
    const key = Object.keys(VIDEO_MODELS).find(k => model.toLowerCase().startsWith(k.toLowerCase()));
    if (key) modelConfig = VIDEO_MODELS[key as keyof typeof VIDEO_MODELS];
  }
  console.log(`[时长调整] 输入时长: ${duration}, 模型: ${model}, 配置:`, modelConfig?.features?.durationRange);
  if (modelConfig?.features?.durationRange) {
    const [min, max] = modelConfig.features.durationRange;
    const adjusted = Math.max(min, Math.min(duration, max));
    console.log(`[时长调整] 调整后时长: ${adjusted} (范围: ${min}-${max})`);
    return adjusted;
  }
  console.log(`[时长调整] 无配置，返回原时长: ${duration}`);
  return duration;
}

/**
 * 获取用户的方案选择
 */
async function getUserSolution(userId: string): Promise<SolutionType> {
  let preset: unknown;
  if (hasDatabaseConfig()) {
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

  // 兼容旧数据：seedance-1-5-pro -> standard
  if (preset === 'seedance-1-5-pro' || preset === 'standard' || !preset) {
    return 'standard';
  }
  return preset as SolutionType;
}

// AI生成视频 - 根据用户方案选择模型
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);
    
    // 获取用户会员等级并强制应用限制
    const memberTier = await getUserMemberTier(userId);
    const limitsDescription = getMemberLimitsDescription(memberTier);
    
    console.log(`[视频生成] 用户方案: ${solution}, 会员等级: ${memberTier}`);
    console.log(`[视频生成] 限制: ${limitsDescription.video}`);

    const body = await request.json();
    const {
      prompt,
      firstFrameUrl,       // 首帧图URL
      lastFrameUrl,        // 尾帧图URL
      referenceImageUrls,  // 角色立绘参考图URL数组（多模态参考生视频）
      duration = 15,       // 持续时间 (4-15秒)
      ratio = '16:9',      // 宽高比
      resolution,
      generateAudio = true, // 是否生成音频
      title,
      seriesId,
      episodeNumber,
      testMode = false,
      quality,
      hookType,            // 视频类型: hook | cliffhanger | storyboard
      sortOrder,           // 视频排序顺序
      model: requestModel, // 自定义模型
    } = body;

    // 解析质量等级并获取配置
    const qualityLevel = parseQualityLevel(quality);
    const qualityConfig = getVideoQuality(qualityLevel);

    // 检查用户是否为管理员
    const isAdminUser = request.headers.get('x-user-id') === 'admin';

    // 获取实际使用的模型（用户自定义模型或默认模型）
    const actualModel = requestModel || DEFAULT_MODELS.video;
    
    // 强制应用会员等级限制（管理员也受会员等级限制）
    const requestedResolution = resolution || qualityConfig.resolution;
    const memberLimitedResolution = enforceVideoResolution(memberTier, requestedResolution);
    // 再根据视频模型限制分辨率（模型可能不支持会员等级允许的最高分辨率）
    const finalResolution = adjustResolutionByModel(memberLimitedResolution, actualModel);
    console.log(`[视频生成] 分辨率计算: 用户请求=${requestedResolution}, 会员限制=${memberLimitedResolution}, 模型支持=${getModelSupportedResolutions(actualModel).join(',')}, 最终=${finalResolution}`);
    
    // 视频时长限制：根据会员等级和视频模型双重限制
    // 1. 先根据会员等级获取最大时长限制
    // 2. 再根据视频模型限制最大时长
    // 3. 最终时长 = min(用户请求时长, 会员等级最大时长, 模型最大时长)
    const memberMaxDuration = MEMBER_LIMITS[memberTier].video.maxDuration;
    const modelMaxDuration = getModelMaxDuration(actualModel);
    const maxAllowedDuration = Math.min(memberMaxDuration, modelMaxDuration);
    
    // 用户请求的时长不能超过最大允许时长
    // 如果用户请求超过限制，取最大允许时长；否则取用户请求值
    const requestedDuration = duration > maxAllowedDuration
      ? maxAllowedDuration
      : duration;
    
    console.log(`[视频生成] 时长限制计算: 用户请求=${duration}s, 会员限制=${memberMaxDuration}s, 模型限制=${modelMaxDuration}s, 最终=${requestedDuration}s`);

    // 测试模式：直接返回模拟结果
    if (testMode) {
      console.log('[视频生成] 测试模式：返回模拟结果');
      await new Promise(resolve => setTimeout(resolve, 2000));
      // 测试模式也使用模型限制
      const testModel = requestModel || (solution === 'zhipu'
        ? 'cogvideox-3'
        : solution === 'qwen'
          ? 'wan3.0-i2v'
          : DEFAULT_MODELS.video);
      const testFinalDuration = adjustDurationByModel(requestedDuration, testModel);
      return NextResponse.json({
        success: true,
        video: {
          url: 'https://test-video.example.com/mock.mp4',
          duration: testFinalDuration,
        },
        message: '测试模式：模拟生成成功',
        quality: qualityLevel,
        resolution: finalResolution,
        duration: testFinalDuration,
        model: testModel,
        memberTier,
        limitsApplied: {
          resolution: requestedResolution !== finalResolution,
          duration: requestedDuration !== testFinalDuration,
        },
      });
    }

    if (!prompt && !firstFrameUrl) {
      return NextResponse.json(
        { error: '请提供视频描述或首帧图片' },
        { status: 400 }
      );
    }

    // 获取用户选择的视频模型与厂商（尊重用户在设置中的选择）
    let userConfig: Record<string, unknown> | null = null;
    if (hasDatabaseConfig()) {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('user_config')
        .select('video_model,video_provider')
        .eq('user_id', userId)
        .single();
      userConfig = (data as unknown as Record<string, unknown>) || null;
    } else {
      // 未配置数据库：读取本地兜底存储
      userConfig = getLocalUserConfig(userId);
    }
    const userVideoModel = typeof userConfig?.video_model === 'string' && userConfig.video_model
      ? userConfig.video_model
      : undefined;
    // 视频厂商：用户设置 > 旧方案兼容（zhipu 方案默认智谱，其余扣子）
    const userVideoProvider: string =
      (typeof (userConfig as unknown as Record<string, unknown> | null)?.video_provider === 'string'
        && ((userConfig as unknown as Record<string, unknown>).video_provider as string))
      || (solution === 'zhipu' ? 'zhipu' : 'coze');

    // 根据方案和用户选择选择模型
    // 优先级：1. 请求参数中的模型 2. 用户设置的视频模型 3. 方案默认模型
    let model: string;
    if (requestModel) {
      // 使用请求中指定的模型
      model = requestModel;
    } else if (userVideoModel) {
      // 使用用户在设置中选择的视频模型
      model = userVideoModel;
      console.log(`[视频生成] 使用用户设置的视频模型: ${model}`);
    } else if (userVideoProvider === 'zhipu') {
      model = SOLUTION_PRESETS.zhipu.models.video;
    } else if (userVideoProvider === 'qwen') {
      model = SOLUTION_PRESETS.qwen.models.video;
    } else {
      model = DEFAULT_MODELS.video;
    }

    // 根据模型限制调整时长（Seedance 1.5 Pro 只支持 5-12 秒）
    const finalDuration = adjustDurationByModel(requestedDuration, model);
    const durationAdjusted = requestedDuration !== finalDuration;

    console.log(`[视频生成] 开始生成视频`, {
      solution,
      provider: userVideoProvider,
      model,
      isAdmin: isAdminUser,
      userVideoModel, // 用户在设置中选择的视频模型
      requestModel,   // 请求中指定的模型
      quality: qualityLevel,
      resolution: finalResolution,
      duration: finalDuration,
      requestedDuration, // 用户请求的原始时长
      durationAdjusted,  // 时长是否被模型限制调整
      modelMaxDuration,  // 模型支持的最大时长
      ratio,
      generateAudio,
      hasFirstFrame: !!firstFrameUrl,
      hasLastFrame: !!lastFrameUrl,
      title,
      seriesId,
      episodeNumber,
      memberTier,
    });

    // AI运镜提示词增强
    let enhancedPrompt = prompt;
    if (prompt) {
      try {
        // 智能增强运镜提示词
        enhancedPrompt = enhanceCameraMovementPrompt(prompt, {
          shotType: undefined, // 从prompt中提取
          mood: undefined,     // 从prompt中提取
          action: undefined,   // 从prompt中提取
        });
        console.log('[视频生成] 运镜提示词增强完成');
      } catch (error) {
        console.warn('[视频生成] 运镜提示词增强失败，使用原始prompt:', error);
      }
    }

    // 按用户选择的厂商分发（统一使用扣子 SDK 生成视频包括 Seedance 2.0）
    if (userVideoProvider === 'zhipu') {
      return await generateWithZhipu(request, userId, {
        prompt: enhancedPrompt,
        firstFrameUrl,
        lastFrameUrl,
        referenceImageUrls,
        duration: finalDuration,
        ratio,
        resolution: finalResolution,
        generateAudio,
        title,
        seriesId,
        episodeNumber,
        model,
        hookType,
        sortOrder,
        memberTier,
      });
    } else if (userVideoProvider === 'qwen') {
      // 千问方案：万相视频（DashScope 异步任务，同步等待结果）
      return await generateWithQwen(userId, {
        prompt: enhancedPrompt,
        firstFrameUrl,
        duration: finalDuration,
        ratio,
        resolution: finalResolution,
        generateAudio,
        title,
        seriesId,
        episodeNumber,
        model,
        hookType,
        sortOrder,
        memberTier,
      });
    } else if (userVideoProvider === 'custom') {
      return NextResponse.json(
        { error: '自定义端点暂不支持视频生成，请在模型设置中选择扣子内置、智谱或千问的视频模型' },
        { status: 400 }
      );
    } else {
      return await generateWithCoze(request, {
        prompt: enhancedPrompt,
        firstFrameUrl,
        lastFrameUrl,
        referenceImageUrls,
        duration: finalDuration,
        ratio,
        resolution: finalResolution,
        generateAudio,
        title,
        seriesId,
        episodeNumber,
        qualityLevel,
        model,
        hookType,
        sortOrder,
        memberTier,
        userId,
      });
    }

  } catch (error) {
    console.error('[视频生成] 处理请求失败:', error);
    return NextResponse.json(
      { error: '视频生成请求处理失败' },
      { status: 500 }
    );
  }
}

/**
 * 使用智谱SDK生成视频
 */
async function generateWithZhipu(
  request: NextRequest,
  userId: string,
  params: {
    prompt: string;
    firstFrameUrl?: string;  // 首帧图片URL
    lastFrameUrl?: string;   // 尾帧图片URL
    referenceImageUrls?: string[]; // 角色立绘参考图URL
    duration: number;
    ratio: string;
    resolution: string;
    generateAudio?: boolean; // 是否生成音频
    title?: string;
    seriesId?: string;
    episodeNumber?: number;
    model: string;
    hookType?: 'hook' | 'cliffhanger' | 'storyboard'; // 视频类型
    sortOrder?: number; // 视频排序顺序
    memberTier: string;
  }
) {
  const { prompt, firstFrameUrl, lastFrameUrl, duration, ratio, resolution, generateAudio, title, seriesId, episodeNumber, model, hookType, sortOrder } = params;

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
    
    // 智谱视频生成是异步的，需要先创建任务
    // CogVideoX-3 现已支持首尾帧控制
    const response = await client.generateVideo(prompt, {
      model,
      firstFrameImage: firstFrameUrl,
      lastFrameImage: lastFrameUrl,
      generateAudio: generateAudio ?? true,
    });

    console.log(`[智谱视频] 任务创建: ${response.id}, 状态: ${response.task_status}`, {
      hasFirstFrame: !!firstFrameUrl,
      hasLastFrame: !!lastFrameUrl,
    });

    // 如果任务完成，保存记录
    if (response.task_status === 'SUCCESS' && response.video_result && response.video_result.length > 0) {
      const videoUrl = response.video_result[0].url || '';
      if (videoUrl) {
        await saveVideoRecord({
          prompt,
          videoUrl,
          duration,
          ratio,
          resolution,
          model,
          title,
          seriesId,
          episodeNumber,
          hookType,
          sortOrder,
          userId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      taskId: response.id,
      model,
      status: response.task_status,
      videos: response.video_result,
      solution: 'zhipu',
      message: response.task_status === 'SUCCESS' 
        ? '视频生成成功' 
        : '视频生成任务已创建，请稍后查询状态',
    });

  } catch (error) {
    console.error('[智谱视频] 错误:', error);
    
    // 判断是否为限流错误
    const errorMessage = error instanceof Error ? error.message : '视频生成失败';
    const isRateLimited = errorMessage.includes('429') || 
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('速率限制');
    
    if (isRateLimited) {
      return NextResponse.json({
        error: errorMessage,
        isRateLimited: true,
        retryAfter: 60, // 建议60秒后重试
        suggestion: '智谱API请求频率过高，请稍后重试'
      }, { status: 429 });
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 使用千问万相生成视频（DashScope 异步任务，同步等待结果）
 */
async function generateWithQwen(
  userId: string,
  params: {
    prompt: string;
    firstFrameUrl?: string;
    duration: number;
    ratio: string;
    resolution: string;
    generateAudio?: boolean; // 是否生成音频
    title?: string;
    seriesId?: string;
    episodeNumber?: number;
    model: string;
    hookType?: 'hook' | 'cliffhanger' | 'storyboard';
    sortOrder?: number;
    memberTier: string;
  }
) {
  const { prompt, firstFrameUrl, duration, ratio, resolution, generateAudio, title, seriesId, episodeNumber, model, hookType, sortOrder } = params;

  // 检查千问API是否配置
  const config = await getQwenMediaConfig(userId);
  if (!config) {
    return NextResponse.json(
      { error: '千问 API Key 未配置，请前往「模型设置」配置后再使用' },
      { status: 400 }
    );
  }

  try {
    // 万相视频时长限制（万相 2.7/3.0 支持 5 秒左右）
    const qwenDuration = Math.min(Math.max(Math.round(duration), 5), 8);
    // 图生视频需要首帧；文生视频模型不传
    const isImageToVideo = model.toLowerCase().includes('i2v');
    const qwenResolution = resolution === '1080p' ? '1080p' : '720p';

    console.log(`[千问视频] 生成: ${model}, 图生视频: ${isImageToVideo}, 时长: ${qwenDuration}s, 分辨率: ${qwenResolution}`);

    const videoUrl = await qwenVideoGenerate(config, {
      model,
      prompt,
      imgUrl: isImageToVideo ? firstFrameUrl : undefined,
      resolution: qwenResolution,
      duration: qwenDuration,
    });

    // 下载并转存到对象存储
    let finalVideoUrl = videoUrl;
    let fileSize = 0;
    try {
      const videoResponse = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      fileSize = videoBuffer.length;
      const fileKey = await storage.uploadFile({
        fileContent: videoBuffer,
        fileName: `videos/generated/${Date.now()}-qwen-${Math.random().toString(36).slice(2)}.mp4`,
        contentType: 'video/mp4',
      });
      finalVideoUrl = fileKey;
      console.log('[千问视频] 视频已转存到对象存储:', fileKey);
    } catch (e) {
      console.error('[千问视频] 转存失败，使用 DashScope 临时URL:', e);
    }

    // 保存视频记录
    await saveVideoRecord({
      prompt,
      videoUrl: finalVideoUrl,
      duration: qwenDuration,
      ratio,
      resolution: qwenResolution,
      model,
      title,
      seriesId,
      episodeNumber,
      fileSize,
      hookType,
      sortOrder,
      userId,
    });

    return NextResponse.json({
      success: true,
      taskId: `qwen-${Date.now()}`,
      model,
      status: 'SUCCESS',
      videos: [{ url: finalVideoUrl }],
      solution: 'qwen',
      message: '视频生成成功',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '千问视频生成失败';
    console.error('[千问视频] 错误:', errorMessage);
    const isRateLimited = errorMessage.includes('429') || errorMessage.includes('Throttling') || errorMessage.includes('rate');
    if (isRateLimited) {
      return NextResponse.json(
        { error: errorMessage, isRateLimited: true, retryAfter: 60, suggestion: '千问API请求频率过高，请稍后重试' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 使用扣子SDK生成视频
 */
async function generateWithCoze(
  request: NextRequest,
  params: {
    prompt?: string;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
    referenceImageUrls?: string[]; // 角色立绘参考图URL
    duration: number;
    ratio: string;
    resolution: string;
    generateAudio: boolean;
    title?: string;
    seriesId?: string;
    episodeNumber?: number;
    qualityLevel: string;
    model: string;
    hookType?: 'hook' | 'cliffhanger' | 'storyboard'; // 视频类型
    sortOrder?: number; // 视频排序顺序
    memberTier: string;
    userId: string;
  }
) {
  const {
    prompt,
    firstFrameUrl,
    lastFrameUrl,
    referenceImageUrls,
    duration,
    ratio,
    resolution,
    generateAudio,
    title,
    seriesId,
    episodeNumber,
    qualityLevel,
    model,
    sortOrder,
    userId,
  } = params;
  const hookType = params.hookType || 'storyboard';

  // 构建内容数组（扣子 SDK 格式）
  const content: Content[] = [];

  // 添加首帧图
  if (firstFrameUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: firstFrameUrl },
      role: 'first_frame',
    });
    console.log('[视频生成] 添加首帧图');
  }

  // 添加尾帧图
  if (lastFrameUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: lastFrameUrl },
      role: 'last_frame',
    });
    console.log('[视频生成] 添加尾帧图');
  }

  // 添加角色立绘参考图（多模态参考生视频，SDK 最多支持 9 张）
  // 去重并排除已经用作首帧/尾帧的图片，最多取 9 张
  if (Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0) {
    const frameUrls = new Set([firstFrameUrl, lastFrameUrl].filter(Boolean) as string[]);
    const uniqueRefs = [...new Set(referenceImageUrls)]
      .filter(url => url && !frameUrls.has(url))
      .slice(0, 9);
    for (const refUrl of uniqueRefs) {
      content.push({
        type: 'image_url',
        image_url: { url: refUrl },
        role: 'reference_image',
      });
    }
    if (uniqueRefs.length > 0) {
      console.log(`[视频生成] 添加 ${uniqueRefs.length} 张角色立绘参考图`);
    }
  }

  // 添加文本描述
  if (prompt) {
    content.push({
      type: 'text',
      text: prompt,
    });
  }

  // 使用服务工厂创建客户端（支持用户Token）
  const { service, useUserToken } = await createVideoService(request);
  console.log(`[视频生成] 使用用户Token: ${useUserToken}`);

  // 调用视频生成
  let response;
  try {
    console.log('[视频生成] 开始调用 Coze SDK videoGeneration...');
    console.log('[视频生成] 参数:', {
      model,
      duration,
      ratio,
      resolution,
      generateAudio,
      contentLength: content.length,
      hasPrompt: !!prompt,
      hasFirstFrame: !!firstFrameUrl,
      hasLastFrame: !!lastFrameUrl,
      referenceImageCount: Array.isArray(referenceImageUrls)
        ? [...new Set(referenceImageUrls.filter((u: string) => u && u !== firstFrameUrl && u !== lastFrameUrl))].slice(0, 9).length
        : 0,
    });
    
    // 添加重试机制处理超时错误，超时后自动降级参数
    const maxRetries = 2;
    let lastError: unknown = null;
    let currentDuration = duration;
    let currentResolution = resolution;
    let currentGenerateAudio = generateAudio;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[视频生成] 第 ${attempt} 次尝试调用 Coze SDK... (时长: ${currentDuration}s, 分辨率: ${currentResolution}, 音频: ${currentGenerateAudio})`);
        response = await service.generateVideo(content, {
          model,
          duration: currentDuration,
          ratio: ratio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive',
          resolution: currentResolution as '480p' | '720p' | '1080p',
          generateAudio: currentGenerateAudio,
        });
        
        console.log('[视频生成] Coze SDK 调用完成，状态:', response.status);
        break; // 成功则跳出重试循环
      } catch (apiError: unknown) {
        lastError = apiError;
        const error = apiError as Error & { 
          statusCode?: number; 
          details?: { message?: string };
          response?: { 
            error?: { 
              code?: string; 
              message?: string 
            } 
          }
        };
        
        const isTimeout = error.statusCode === 408 || error.message.includes('超时');
        
        if (isTimeout && attempt < maxRetries) {
          // 超时后自动降级参数：减少时长、降低分辨率、关闭音频
          console.warn(`[视频生成] 第 ${attempt} 次尝试超时，自动降级参数后重试...`);
          
          // 降低时长（至少 5 秒）
          if (currentDuration > 5) {
            currentDuration = Math.max(5, currentDuration - 5);
            console.log(`[视频生成] 时长降级: ${currentDuration}s`);
          }
          
          // 降低分辨率
          if (currentResolution === '720p') {
            currentResolution = '480p';
            console.log(`[视频生成] 分辨率降级: 480p`);
          } else if (currentResolution === '1080p') {
            currentResolution = '720p';
            console.log(`[视频生成] 分辨率降级: 720p`);
          }
          
          // 关闭音频生成
          if (currentGenerateAudio) {
            currentGenerateAudio = false;
            console.log(`[视频生成] 关闭音频生成`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        
        // 非超时错误或已达到最大重试次数，抛出错误
        throw apiError;
      }
    }
  } catch (apiError: unknown) {
    const error = apiError as Error & { 
      statusCode?: number; 
      details?: { message?: string };
      response?: { 
        error?: { 
          code?: string; 
          message?: string 
        } 
      }
    };
    console.error('[视频生成] API调用失败:', error.message);
    
    const statusCode = error.statusCode || 500;
    const errorCode = error.response?.error?.code || '';
    const errorMessage = error.message || '未知错误';
    
    const isRateLimited = statusCode === 429 || 
      errorCode === 'ErrTooManyRequests' ||
      errorMessage.includes('TooManyRequests') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('限流');
    
    const isModelNotOpen = statusCode === 403 && (
      errorCode === 'model_not_found' ||
      errorMessage.includes('model') && errorMessage.includes('not found') ||
      errorMessage.includes('模型') && errorMessage.includes('未开通')
    );
    
    const isPlatformRateLimit = statusCode === 403 && (
      errorCode === 'ErrTooManyRequests' ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('限流') ||
      errorMessage.includes('quota')
    );
    
    const isAuthError = statusCode === 403 && !isPlatformRateLimit && !isModelNotOpen && (
      errorCode === 'unauthorized' ||
      errorCode === 'forbidden' ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('认证') ||
      errorMessage.includes('权限') ||
      errorMessage.includes('Permission denied')
    );
    
    const isRegionNotSupported = errorMessage.includes('不支持当前地区') || 
      errorMessage.includes('region') && errorMessage.includes('not supported') ||
      errorMessage.includes('region not available') ||
      errorMessage.includes('服务不可用');
    
    console.error('[视频生成] 错误详情:', {
      statusCode,
      errorCode,
      errorMessage,
      isRateLimited,
      isModelNotOpen,
      isPlatformRateLimit,
      isAuthError,
      isRegionNotSupported
    });
    
    // 判断是否需要降级到 Seedance 1.5 Pro
    // 降级条件：地区不支持、模型未开通、平台限流、Seedance 2.0 内部错误（如 Repetitive tool calls）
    const shouldFallback = model === 'doubao-seedance-2-0-260128' && (
      isRegionNotSupported ||
      isModelNotOpen ||
      isPlatformRateLimit ||
      errorMessage.includes('Repetitive tool calls') ||
      errorMessage.includes('InternalError') ||
      errorMessage.includes('exceeds max retries')
    );

    if (shouldFallback) {
      const fallbackModel = 'doubao-seedance-1-5-pro-251215';
      const fallbackReason = isRegionNotSupported ? '地区不支持'
        : isModelNotOpen ? '模型未开通'
        : isPlatformRateLimit ? '平台限流'
        : 'Seedance 2.0 内部错误';
      console.log(`[视频生成] ${fallbackReason}，自动降级到 Seedance 1.5 Pro 重试...`);
      try {
        const fallbackDuration = Math.min(duration, 12); // 1.5 Pro 最大12秒
        response = await service.generateVideo(content, {
          model: fallbackModel,
          duration: fallbackDuration,
          ratio: ratio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive',
          resolution: resolution as '480p' | '720p' | '1080p',
          generateAudio: generateAudio,
        });
        console.log('[视频生成] 降级到 Seedance 1.5 Pro 成功');
      } catch (fallbackError: unknown) {
        const fbErr = fallbackError as Error;
        console.error('[视频生成] 降级到 Seedance 1.5 Pro 也失败:', fbErr.message);
        return NextResponse.json(
          { 
            error: `视频生成失败（已尝试降级）: ${fbErr.message}`, 
            statusCode: 500,
            originalError: errorMessage,
            fallbackAttempted: true,
            fallbackModel,
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { 
          error: `视频生成失败: ${errorMessage}`, 
          statusCode,
          errorCode,
          isRateLimited,
          isModelNotOpen,
          isPlatformRateLimit,
          isAuthError,
          details: error.details,
          suggestion: isModelNotOpen 
            ? '请在控制台开通 Seedance 视频生成模型' 
            : isPlatformRateLimit || isRateLimited
              ? 'API调用频率受限，请稍后重试'
              : isAuthError
                ? '请检查登录状态或重新登录'
                : isRegionNotSupported
                  ? '当前地区暂不支持该模型'
                  : undefined,
        },
        { status: statusCode }
      );
    }
  }

  // 处理成功响应
  if (!response) {
    return NextResponse.json(
      { error: '视频生成失败：未获取到响应' },
      { status: 500 }
    );
  }
  if (response.videoUrl) {
    console.log('[视频生成] 视频生成成功，原始URL:', response.videoUrl);

    // 下载视频并上传到我们自己的对象存储（避免扣子URL过期）
    let finalVideoUrl = response.videoUrl;
    let fileSize = 0;
    
    try {
      console.log('[视频生成] 开始下载视频...');
      const videoResponse = await fetch(response.videoUrl);
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      fileSize = videoBuffer.length;
      
      console.log(`[视频生成] 视频下载完成，大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
      
      // 上传到对象存储
      const fileKey = await storage.uploadFile({
        fileContent: videoBuffer,
        fileName: `videos/generated/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
        contentType: 'video/mp4',
      });
      
      console.log('[视频生成] 视频已上传到对象存储:', fileKey);
      
      // 使用我们自己的file_key作为最终URL
      finalVideoUrl = fileKey;
    } catch (e) {
      console.error('[视频生成] 视频上传失败，使用原始URL:', e);
      // 如果上传失败，尝试获取原始文件大小
      try {
        const headResponse = await fetch(response.videoUrl, { method: 'HEAD' });
        const contentLength = headResponse.headers.get('content-length');
        if (contentLength) {
          fileSize = parseInt(contentLength, 10);
        }
      } catch (headError) {
        console.warn('[视频生成] 获取文件大小失败:', headError);
      }
    }

    // 保存到数据库
    await saveVideoRecord({
      prompt,
      videoUrl: finalVideoUrl,
      duration,
      ratio,
      resolution,
      model,
      title,
      seriesId,
      episodeNumber,
      fileSize,
      generateAudio,
      hookType,
      sortOrder,
      userId,
    });

    // 返回永久访问URL
    let displayUrl = finalVideoUrl;
    if (!finalVideoUrl.startsWith('http')) {
      // 如果是file_key，生成签名URL
      displayUrl = await storage.generatePresignedUrl({ key: finalVideoUrl, expireTime: 3600 });
    }

    return NextResponse.json({
      success: true,
      video: {
        url: displayUrl,
        duration,
      },
      quality: qualityLevel,
      resolution,
      fileSize,
      lastFrameUrl: response.lastFrameUrl,
      model,
      solution: 'standard',
    });
  }

  return NextResponse.json(
    { error: '视频生成失败：未知状态' },
    { status: 500 }
  );
}

/**
 * 保存视频记录到数据库
 */
async function saveVideoRecord(params: {
  prompt?: string;
  videoUrl: string;
  duration: number;
  ratio: string;
  resolution: string;
  model: string;
  title?: string;
  seriesId?: string;
  episodeNumber?: number;
  fileSize?: number;
  generateAudio?: boolean;
  hookType?: 'hook' | 'cliffhanger' | 'storyboard'; // 视频类型
  sortOrder?: number; // 视频排序顺序
  userId: string; // 用户ID
}) {
  const { prompt, videoUrl, duration, ratio, resolution, model, title, seriesId, episodeNumber, fileSize, generateAudio, hookType = 'storyboard', sortOrder, userId } = params;
  const supabase = getSupabaseClient();
  
  // 获取剧名（用于生成标题）
  let seriesTitle = '';
  if (seriesId) {
    const { data: series } = await supabase
      .from('drama_series')
      .select('title')
      .eq('id', seriesId)
      .single();
    seriesTitle = series?.title || '';
  }
  
  // 根据hookType生成标题
  // - hook（开篇钩子）：剧名+钩子
  // - cliffhanger（结尾悬念）：剧名+结尾
  // - storyboard（普通分镜）：剧名+第X集第X个分镜
  const epNum = episodeNumber || 1;
  let finalTitle: string;
  if (title && title.trim()) {
    finalTitle = title.trim();
  } else if (hookType === 'hook') {
    finalTitle = seriesTitle ? `${seriesTitle}钩子` : '开篇钩子视频';
  } else if (hookType === 'cliffhanger') {
    finalTitle = seriesTitle ? `${seriesTitle}结尾` : '结尾悬念视频';
  } else {
    finalTitle = seriesTitle ? `${seriesTitle}第${epNum}集分镜` : `第${epNum}集视频`;
  }
  
  // 如果有seriesId，查找或创建合集
  let collectionId = null;
  if (seriesId) {
    const { data: existingCollection } = await supabase
      .from('video_collections')
      .select('id')
      .eq('series_id', seriesId)
      .single();
    
    if (existingCollection) {
      collectionId = existingCollection.id;
    } else {
      const { data: newCollection } = await supabase
        .from('video_collections')
        .insert({
          title: seriesTitle || '未命名合集',
          series_id: seriesId,
          user_id: userId,
        })
        .select('id')
        .single();
      
      collectionId = newCollection?.id;
    }
  }

  // 保存视频记录到 videos 表
  const { data: videoRecord, error: insertError } = await supabase
    .from('videos')
    .insert({
      title: finalTitle,  // 添加标题字段
      prompt,
      video_url: videoUrl,
      duration,
      ratio,
      resolution,
      file_size: fileSize || 0,
      model,
      collection_id: collectionId,
      episode_number: episodeNumber,
      status: 'completed',
      hook_type: hookType,
      sort_order: sortOrder,
      user_id: userId,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[视频生成] 保存视频记录失败:', insertError);
  }

  // 同时保存到 video_materials 表
  const videoTitle = title && title.trim() 
    ? title.trim() 
    : `AI生成视频 ${new Date().toLocaleString('zh-CN')}`;
  
  const { error: materialError } = await supabase
    .from('video_materials')
    .insert({
      title: videoTitle,
      description: prompt,
      file_key: videoUrl,
      file_name: `ai-generated-${Date.now()}.mp4`,
      file_size: fileSize || 0,
      duration: duration,
      status: 'uploaded',
      metadata: {
        model,
        resolution,
        ratio,
        generatedAt: new Date().toISOString(),
        prompt,
        generateAudio,
      },
      series_id: seriesId || null,
      episode_number: episodeNumber || null,
      user_id: userId,
    });

  if (materialError) {
    console.error('[视频生成] 保存到 video_materials 失败:', materialError);
  } else {
    console.log('[视频生成] 已保存到 video_materials 表');
  }

  return videoRecord;
}
