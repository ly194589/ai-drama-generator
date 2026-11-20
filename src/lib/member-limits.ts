/**
 * 会员等级限制配置
 * 根据会员等级强制限制生成参数
 */

// 会员等级类型
export type MemberTier = 'trial' | 'monthly' | 'quarterly' | 'yearly' | 'lifetime' | 'admin';

// 视频限制配置
export interface VideoLimits {
  maxResolution: '480p' | '720p' | '1080p' | '4k';
  maxDuration: number; // 秒
  maxFileSize: number; // MB
  canGenerateAudio: boolean;
  description: string;
}

// 图片限制配置
export interface ImageLimits {
  maxSize: '1K' | '2K' | '4K';
  maxBatchCount: number;
  description: string;
}

// 音频限制配置
export interface AudioLimits {
  maxSampleRate: 24000 | 44100 | 48000;
  voiceOptions: 'basic' | 'standard' | 'premium' | 'custom';
  description: string;
}

// 会员等级完整限制
export interface MemberLimits {
  tier: MemberTier;
  video: VideoLimits;
  image: ImageLimits;
  audio: AudioLimits;
}

// 会员等级限制配置表
export const MEMBER_LIMITS: Record<MemberTier, MemberLimits> = {
  trial: {
    tier: 'trial',
    video: {
      maxResolution: '480p',
      maxDuration: 15,
      maxFileSize: 20,
      canGenerateAudio: true,
      description: '体验卡：480P视频，最长15秒',
    },
    image: {
      maxSize: '1K',
      maxBatchCount: 1,
      description: '体验卡：1K图片，单张生成',
    },
    audio: {
      maxSampleRate: 24000,
      voiceOptions: 'basic',
      description: '体验卡：基础音色，24kHz',
    },
  },
  monthly: {
    tier: 'monthly',
    video: {
      maxResolution: '1080p',
      maxDuration: 15,
      maxFileSize: 100,
      canGenerateAudio: true,
      description: '月卡：1080P视频，最长15秒',
    },
    image: {
      maxSize: '2K',
      maxBatchCount: 4,
      description: '月卡：2K图片，批量4张',
    },
    audio: {
      maxSampleRate: 44100,
      voiceOptions: 'standard',
      description: '月卡：标准音色，44.1kHz',
    },
  },
  quarterly: {
    tier: 'quarterly',
    video: {
      maxResolution: '1080p',
      maxDuration: 15,
      maxFileSize: 100,
      canGenerateAudio: true,
      description: '季卡：1080P视频，最长15秒',
    },
    image: {
      maxSize: '2K',
      maxBatchCount: 4,
      description: '季卡：2K图片，批量4张',
    },
    audio: {
      maxSampleRate: 44100,
      voiceOptions: 'standard',
      description: '季卡：标准音色，44.1kHz',
    },
  },
  yearly: {
    tier: 'yearly',
    video: {
      maxResolution: '4k',
      maxDuration: 15,
      maxFileSize: 500,
      canGenerateAudio: true,
      description: '年卡：4K视频，最长15秒',
    },
    image: {
      maxSize: '4K',
      maxBatchCount: 8,
      description: '年卡：4K图片，批量8张',
    },
    audio: {
      maxSampleRate: 48000,
      voiceOptions: 'custom',
      description: '年卡：定制音色，48kHz',
    },
  },
  lifetime: {
    tier: 'lifetime',
    video: {
      maxResolution: '4k',
      maxDuration: 15,
      maxFileSize: 500,
      canGenerateAudio: true,
      description: '终身卡：4K视频，最长15秒',
    },
    image: {
      maxSize: '4K',
      maxBatchCount: 8,
      description: '终身卡：4K图片，批量8张',
    },
    audio: {
      maxSampleRate: 48000,
      voiceOptions: 'custom',
      description: '终身卡：定制音色，48kHz',
    },
  },
  admin: {
    tier: 'admin',
    video: {
      maxResolution: '4k',
      maxDuration: 15,  // 管理员默认15s，2.0模型支持最长15s
      maxFileSize: 500,
      canGenerateAudio: true,
      description: '管理员：无限制（2.0模型支持最长15秒）',
    },
    image: {
      maxSize: '4K',
      maxBatchCount: 8,
      description: '管理员：无限制',
    },
    audio: {
      maxSampleRate: 48000,
      voiceOptions: 'custom',
      description: '管理员：无限制',
    },
  },
};

/**
 * 获取视频分辨率限制
 * 根据会员等级返回允许的最高分辨率
 */
export function getMaxVideoResolution(tier: MemberTier): '480p' | '720p' | '1080p' | '4k' {
  return MEMBER_LIMITS[tier].video.maxResolution;
}

/**
 * 强制限制视频分辨率
 * 如果用户请求的分辨率超过会员等级限制，强制降低到允许的最高分辨率
 */
export function enforceVideoResolution(
  tier: MemberTier,
  requestedResolution?: string
): string {
  const maxResolution = MEMBER_LIMITS[tier].video.maxResolution;
  
  // 如果没有请求分辨率，使用最大允许分辨率
  if (!requestedResolution) {
    return maxResolution;
  }
  
  // 分辨率等级映射
  const resolutionOrder: Record<string, number> = {
    '480p': 1,
    '720p': 2,
    '1080p': 3,
    '4k': 4,
  };
  
  const requestedLevel = resolutionOrder[requestedResolution] || 1;
  const maxLevel = resolutionOrder[maxResolution] || 1;
  
  // 如果请求的分辨率超过限制，强制降低
  if (requestedLevel > maxLevel) {
    console.log(`[会员限制] 视频分辨率从 ${requestedResolution} 降级为 ${maxResolution}（会员等级: ${tier}）`);
    return maxResolution;
  }
  
  return requestedResolution;
}

/**
 * 强制限制视频时长
 */
export function enforceVideoDuration(tier: MemberTier, requestedDuration: number): number {
  const maxDuration = MEMBER_LIMITS[tier].video.maxDuration;
  
  if (requestedDuration > maxDuration) {
    console.log(`[会员限制] 视频时长从 ${requestedDuration}秒 限制为 ${maxDuration}秒（会员等级: ${tier}）`);
    return maxDuration;
  }
  
  return requestedDuration;
}

/**
 * 获取图片尺寸限制
 */
export function getMaxImageSize(tier: MemberTier): '1K' | '2K' | '4K' {
  return MEMBER_LIMITS[tier].image.maxSize;
}

/**
 * 强制限制图片尺寸
 */
export function enforceImageSize(
  tier: MemberTier,
  requestedSize?: string
): string {
  const maxSize = MEMBER_LIMITS[tier].image.maxSize;
  
  if (!requestedSize) {
    return maxSize === '1K' ? '1024x1024' : maxSize;
  }
  
  // 尺寸等级映射
  const sizeOrder: Record<string, number> = {
    '1K': 1,
    '1024x1024': 1,
    '2K': 2,
    '2048x2048': 2,
    '4K': 3,
    '4096x4096': 3,
  };
  
  const requestedLevel = sizeOrder[requestedSize] || 1;
  const maxLevel = sizeOrder[maxSize] || 1;
  
  if (requestedLevel > maxLevel) {
    const enforcedSize = maxSize === '1K' ? '1024x1024' : maxSize === '2K' ? '2048x2048' : '4096x4096';
    console.log(`[会员限制] 图片尺寸从 ${requestedSize} 降级为 ${enforcedSize}（会员等级: ${tier}）`);
    return enforcedSize;
  }
  
  return requestedSize;
}

/**
 * 强制限制图片批量生成数量
 */
export function enforceImageBatchCount(tier: MemberTier, requestedCount: number): number {
  const maxCount = MEMBER_LIMITS[tier].image.maxBatchCount;
  
  if (requestedCount > maxCount) {
    console.log(`[会员限制] 图片批量数量从 ${requestedCount} 限制为 ${maxCount}（会员等级: ${tier}）`);
    return maxCount;
  }
  
  return requestedCount;
}

/**
 * 获取音频采样率限制
 */
export function getMaxAudioSampleRate(tier: MemberTier): number {
  return MEMBER_LIMITS[tier].audio.maxSampleRate;
}

/**
 * 强制限制音频采样率
 */
export function enforceAudioSampleRate(tier: MemberTier, requestedRate?: number): number {
  const maxRate = MEMBER_LIMITS[tier].audio.maxSampleRate;
  
  if (!requestedRate) {
    return maxRate;
  }
  
  if (requestedRate > maxRate) {
    console.log(`[会员限制] 音频采样率从 ${requestedRate}Hz 限制为 ${maxRate}Hz（会员等级: ${tier}）`);
    return maxRate;
  }
  
  return requestedRate;
}

/**
 * 获取可用音色等级
 */
export function getVoiceOptionsLevel(tier: MemberTier): 'basic' | 'standard' | 'premium' | 'custom' {
  return MEMBER_LIMITS[tier].audio.voiceOptions;
}

/**
 * 获取会员限制描述（用于前端提示）
 */
export function getMemberLimitsDescription(tier: MemberTier): {
  video: string;
  image: string;
  audio: string;
} {
  const limits = MEMBER_LIMITS[tier];
  return {
    video: limits.video.description,
    image: limits.image.description,
    audio: limits.audio.description,
  };
}
