/**
 * 模型自适应提示词配置
 *
 * 针对各家最新大模型的能力特点，统一管理：
 * 1. 剧本 / 分镜 / 钩子 / 悬念生成时的系统级指令偏好
 * 2. 视频生成（Seedance / 万相 / CogVideo）的画面语言偏好
 * 3. 图片生成（Seedream / GLM-Image）的风格指令偏好
 *
 * 设计原则：
 * - 所有生成器（episodes / regenerate-cliffhanger / optimize-script /
 *   one-click-v2 / workflow）均应通过本模块获取"模型专属补充指令"
 * - 核心规则只写一份，模型差异通过「补充指令 + 输出约束」注入
 * - 未命中的模型回退到默认（豆包 Seed 2.0 Pro）配置，保证不报错
 */

export type ModelFamily =
  | 'doubao-seed'
  | 'glm'
  | 'qwen'
  | 'minimax'
  | 'seedream'
  | 'glm-image'
  | 'seedance'
  | 'wan'
  | 'cogvideo'
  | 'unknown';

export interface ScriptPromptProfile {
  /** 模型家族 */
  family: ModelFamily;
  /** 系统提示词中的"创作风格倾向"补充段 */
  styleDirective: string;
  /** 结构化输出（JSON）的约束强度：strict=要求纯净JSON，flexible=允许少量解释 */
  jsonStrictness: 'strict' | 'flexible';
  /** 是否擅长长上下文（影响是否注入"承接上集"的完整内容） */
  longContext: boolean;
  /** 推荐分镜数区间（模型指令遵循能力越强，可给越多） */
  recommendedStoryboardRange: [number, number];
  /** 输出补充指令（拼接到提示词末尾的模型专属建议） */
  outputHints: string[];
}

export interface VideoPromptProfile {
  family: ModelFamily;
  /** 画面描述语序（各模型敏感的关键词顺序） */
  structureOrder: string[];
  /** 是否在提示词中保留台词/口型描述 */
  keepDialogue: boolean;
  /** 是否支持首尾帧 */
  frameControl: boolean;
  /** 画质/风格后缀 */
  qualitySuffix: string;
}

export interface ImagePromptProfile {
  family: ModelFamily;
  /** 提示词语序 */
  structureOrder: string[];
  /** 中文提示词友好度（GLM-Image 对中文理解最佳） */
  chineseFriendly: boolean;
  /** 负向提示（不希望出现的内容） */
  negativePrompt: string;
}

/** 根据模型 ID 推断家族 */
export function detectModelFamily(modelId?: string | null): ModelFamily {
  if (!modelId) return 'unknown';
  const m = modelId.toLowerCase();
  if (m.includes('seedance')) return 'seedance';
  if (m.includes('seedream')) return 'seedream';
  if (m.includes('cogvideo')) return 'cogvideo';
  if (m.includes('glm-image') || m.includes('cogview')) return 'glm-image';
  if (m.includes('glm')) return 'glm';
  if (m.includes('qwen')) return 'qwen';
  if (m.includes('wan') || m.includes('tongyi-wan')) return 'wan';
  if (m.includes('minimax') || m.includes('abab') || m.includes('m2') || m.includes('m3'))
    return 'minimax';
  if (m.includes('doubao-seed') || m.includes('doubao')) return 'doubao-seed';
  return 'unknown';
}

/** 文本剧本生成：各模型的提示词画像 */
const SCRIPT_PROFILES: Record<ModelFamily, ScriptPromptProfile> = {
  'doubao-seed': {
    family: 'doubao-seed',
    styleDirective:
      '你擅长多模态理解与结构化创作。请以"画面先行、情绪驱动"的方式组织分镜，每镜都要给出可直接用于视频生成的纯视觉描述，并严格保证角色外观、服装、场景在全集中的一致性。',
    jsonStrictness: 'strict',
    longContext: true,
    recommendedStoryboardRange: [10, 14],
    outputHints: [
      '只输出单个 JSON 对象，不要使用 markdown 代码块',
      'timeDescriptions 的每个时间点都要包含具体景别、人物动作、微表情与光影',
      'dialogues 从 timeDescriptions 中提取，不要额外编造台词',
    ],
  },
  glm: {
    family: 'glm',
    styleDirective:
      '你具备强大的 Agentic 规划与长程任务能力。请以专业影视编剧的标准，先在内部完成"节奏曲线设计"（钩子—铺陈—冲突—反转—高潮—收束），再逐镜落地；人物动机、因果关系与情绪递进必须环环相扣、经得起推敲。',
    jsonStrictness: 'strict',
    longContext: true,
    recommendedStoryboardRange: [12, 16],
    outputHints: [
      '严格输出 JSON，键名使用英文引号，值可包含中文',
      '每个分镜的时间点描述要具象、可拍摄，避免抽象形容词堆砌',
      '台词需口语化、有潜台词，单句不超过 15 字',
      '注意本集与前后集的因果衔接，不要出现剧情断点',
    ],
  },
  qwen: {
    family: 'qwen',
    styleDirective:
      '你擅长复杂多模态推理与高保真结构化输出。请以"电影级分镜表"的精度创作，注重镜头之间的空间连续性（180 度轴线原则）、光影方向一致性与动作衔接，让分镜可直接进入工业化制作流程。',
    jsonStrictness: 'strict',
    longContext: true,
    recommendedStoryboardRange: [12, 16],
    outputHints: [
      '输出纯净 JSON，无多余解释',
      '景别、运镜、机位使用规范术语，保持轴线与光线方向连续',
      '关键转折镜请通过 isKeyframe 标记，并写清情绪爆点',
    ],
  },
  minimax: {
    family: 'minimax',
    styleDirective:
      '你在长上下文与多步任务执行上表现突出。请强化短剧的"强情绪、强反转、强冲突"特质，钩子与悬念要出人意料又在情理之中；对白追求锋利、有记忆点，适合短视频传播。',
    jsonStrictness: 'strict',
    longContext: true,
    recommendedStoryboardRange: [12, 16],
    outputHints: [
      '只输出 JSON 对象',
      '每镜情绪浓度要足，避免平铺直叙',
      '钩子台词和悬念转折需具备传播力，避免俗套',
    ],
  },
  // 以下为媒体生成家族，文本场景下走默认
  seedream: {
    family: 'seedream',
    styleDirective: '',
    jsonStrictness: 'strict',
    longContext: false,
    recommendedStoryboardRange: [10, 14],
    outputHints: [],
  },
  'glm-image': {
    family: 'glm-image',
    styleDirective: '',
    jsonStrictness: 'strict',
    longContext: false,
    recommendedStoryboardRange: [10, 14],
    outputHints: [],
  },
  seedance: {
    family: 'seedance',
    styleDirective: '',
    jsonStrictness: 'strict',
    longContext: false,
    recommendedStoryboardRange: [10, 14],
    outputHints: [],
  },
  wan: {
    family: 'wan',
    styleDirective: '',
    jsonStrictness: 'strict',
    longContext: false,
    recommendedStoryboardRange: [10, 14],
    outputHints: [],
  },
  cogvideo: {
    family: 'cogvideo',
    styleDirective: '',
    jsonStrictness: 'strict',
    longContext: false,
    recommendedStoryboardRange: [10, 14],
    outputHints: [],
  },
  unknown: {
    family: 'unknown',
    styleDirective: '',
    jsonStrictness: 'strict',
    longContext: true,
    recommendedStoryboardRange: [10, 14],
    outputHints: ['只输出 JSON 对象，不要使用 markdown 代码块'],
  },
};

/** 视频生成：各模型的画面语言画像 */
const VIDEO_PROFILES: Partial<Record<ModelFamily, VideoPromptProfile>> = {
  seedance: {
    family: 'seedance',
    structureOrder: ['风格题材', '景别运镜', '场景环境', '人物外观', '动作表情', '光影氛围'],
    keepDialogue: true,
    frameControl: true,
    qualitySuffix:
      '电影感构图，专业影视布光，色彩自然通透，人物造型前后一致，表情细腻，动作连贯，超高清画质，无字幕、无水印、无文字',
  },
  wan: {
    family: 'wan',
    structureOrder: ['主体人物', '场景环境', '运镜方式', '动作内容', '光线色调', '风格画质'],
    keepDialogue: false,
    frameControl: true,
    qualitySuffix:
      '真实光影，细腻质感，人物一致性高，镜头运动平稳自然，高清晰度，无水印无文字',
  },
  cogvideo: {
    family: 'cogvideo',
    structureOrder: ['人物主体', '动作', '场景', '运镜', '光线', '风格'],
    keepDialogue: false,
    frameControl: true,
    qualitySuffix: '真实感强，动作流畅，画面稳定，细节丰富，无字幕水印',
  },
};

/** 图片生成：各模型的风格画像 */
const IMAGE_PROFILES: Partial<Record<ModelFamily, ImagePromptProfile>> = {
  seedream: {
    family: 'seedream',
    structureOrder: ['主体', '外观服装', '姿态表情', '场景', '光线', '镜头景别', '风格画质'],
    chineseFriendly: true,
    negativePrompt: '低质量、模糊、变形、多余手指、画面文字、水印、违和的现代物品',
  },
  'glm-image': {
    family: 'glm-image',
    structureOrder: ['主体', '画面内容', '场景氛围', '光线色调', '构图', '艺术风格'],
    chineseFriendly: true,
    negativePrompt: '低清晰度、畸变、比例失调、多余肢体、文字错乱、水印标识',
  },
};

/** 获取剧本生成画像（未命中时回退豆包 Seed） */
export function getScriptPromptProfile(modelId?: string | null): ScriptPromptProfile {
  const family = detectModelFamily(modelId);
  const profile = SCRIPT_PROFILES[family];
  // 媒体家族或无画像时回退默认
  if (!profile.styleDirective) return SCRIPT_PROFILES['doubao-seed'];
  return profile;
}

/** 获取视频生成画像 */
export function getVideoPromptProfile(modelId?: string | null): VideoPromptProfile {
  const family = detectModelFamily(modelId);
  return (
    VIDEO_PROFILES[family] || {
      family: 'unknown',
      structureOrder: ['风格题材', '景别运镜', '场景环境', '人物', '动作表情', '光影氛围'],
      keepDialogue: false,
      frameControl: true,
      qualitySuffix: '高清画质，画面稳定，无字幕水印',
    }
  );
}

/** 获取图片生成画像 */
export function getImagePromptProfile(modelId?: string | null): ImagePromptProfile {
  const family = detectModelFamily(modelId);
  return (
    IMAGE_PROFILES[family] || {
      family: 'unknown',
      structureOrder: ['主体', '外观', '姿态', '场景', '光线', '风格'],
      chineseFriendly: true,
      negativePrompt: '低质量、变形、模糊、水印、画面文字',
    }
  );
}

/**
 * 生成模型专属的"系统风格指令"，供剧本类提示词拼接
 * 例如：generateStyleDirective(llmModel)
 */
export function generateStyleDirective(modelId?: string | null): string {
  return getScriptPromptProfile(modelId).styleDirective;
}

/**
 * 生成模型专属的输出约束列表（已带序号），供提示词末尾拼接
 */
export function generateOutputHints(modelId?: string | null): string {
  const hints = getScriptPromptProfile(modelId).outputHints;
  if (!hints.length) return '';
  return hints.map((h, i) => `${i + 1}. ${h}`).join('\n');
}
