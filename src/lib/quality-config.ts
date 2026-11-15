/**
 * AI生成质量配置
 * 
 * 支持三种质量等级：
 * - test: 测试级，快速生成，资源消耗低
 * - standard: 标准级，平衡质量与速度
 * - premium: 高级，最高质量
 */

export type QualityLevel = 'test' | 'standard' | 'premium';

// 视频生成配置
export const VIDEO_QUALITY_CONFIG = {
  test: {
    resolution: '480p' as const,
    description: '测试级 480P - 快速预览',
  },
  standard: {
    resolution: '720p' as const,
    description: '标准级 720P - 平衡质量',
  },
  premium: {
    resolution: '1080p' as const,
    description: '高级 1080P - 最高质量',
  },
};

// 图片生成配置
export const IMAGE_QUALITY_CONFIG = {
  test: {
    size: '1024x1024', // 1K
    description: '测试级 1K - 快速预览',
  },
  standard: {
    size: '2K',
    description: '标准级 2K - 平衡质量',
  },
  premium: {
    size: '4K',
    description: '高级 4K - 最高质量',
  },
};

// TTS音频配置
export const TTS_QUALITY_CONFIG = {
  test: {
    sampleRate: 24000 as const,
    description: '测试级 24kHz - 快速生成',
  },
  standard: {
    sampleRate: 44100 as const,
    description: '标准级 44.1kHz - CD质量',
  },
  premium: {
    sampleRate: 48000 as const,
    description: '高级 48kHz - 专业质量',
  },
};

// 默认质量等级（测试阶段使用test）
export const DEFAULT_QUALITY: QualityLevel = 'test';

/**
 * 解析质量参数
 */
export function parseQualityLevel(quality?: string): QualityLevel {
  if (quality === 'standard' || quality === 'premium') {
    return quality;
  }
  return DEFAULT_QUALITY;
}

/**
 * 获取视频质量配置
 */
export function getVideoQuality(quality: QualityLevel) {
  return VIDEO_QUALITY_CONFIG[quality];
}

/**
 * 获取图片质量配置
 */
export function getImageQuality(quality: QualityLevel) {
  return IMAGE_QUALITY_CONFIG[quality];
}

/**
 * 获取TTS音频质量配置
 */
export function getTTSQuality(quality: QualityLevel) {
  return TTS_QUALITY_CONFIG[quality];
}
