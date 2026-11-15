/**
 * 剧本生成统一类型定义
 * 
 * 核心原则：
 * - 总时长：300秒
 * - 每镜固定：12秒
 * - 最少分镜：30个
 * - 统一性控制：风格、主体、场景
 */

// ===========================================
// 统一性控制 - 三维度系统
// ===========================================

/**
 * 视觉风格定义
 * 确保全剧视觉风格一致
 */
export interface VisualStyle {
  // 风格类型
  type: 'urban_modern' | 'ancient_beauty' | 'suspense_dark' | 'sweet_romance' | 'workplace_elite' | 'fantasy_fairy';
  
  // 风格描述（用于提示词）
  description: string;
  
  // 光影风格
  lighting: string;
  
  // 色调
  colorTone: string;
  
  // 运镜风格
  cameraStyle: string;
  
  // 整体氛围
  atmosphere: string;
}

/**
 * 角色外观锁定
 * 确保角色在全剧中外观一致
 */
export interface CharacterLock {
  // 角色ID
  characterId: string;
  
  // 角色名称
  name: string;
  
  // 性别
  gender: 'male' | 'female';
  
  // 年龄
  age: number;
  
  // 外观特征（固定不变）
  appearance: {
    // 发型
    hairstyle: string;
    // 发色
    hairColor: string;
    // 服装（根据场景可变化，但风格统一）
    clothing: string;
    // 配饰
    accessories: string[];
    // 妆容/胡须
    makeup: string;
  };
  
  // 性格标签（影响表情和动作）
  personality: string[];
  
  // 参考图URL（角色立绘）
  referenceImageUrl?: string;
  
  // 关键特征（用于提示词）
  keyFeatures: string;
  
  // ==================== 语音配音配置 ====================
  // TTS 音色 ID（扣子平台）
  voiceId?: string;
  
  // 音色名称（显示用）
  voiceName?: string;
  
  // 语速调整 (-50 到 100)
  speechRate?: number;
  
  // 音量调整 (-50 到 100)
  loudnessRate?: number;
}

/**
 * 场景定义
 * 确保场景切换合理，同一场景视觉一致
 */
export interface SceneDefinition {
  // 场景ID
  sceneId: string;
  
  // 场景名称
  name: string;
  
  // 场景类型
  type: 'indoor' | 'outdoor' | 'vehicle' | 'virtual';
  
  // 场景描述
  description: string;
  
  // 环境特征
  environment: {
    // 时间段
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    // 天气
    weather?: string;
    // 光线
    lighting: string;
    // 背景
    background: string;
  };
  
  // 关键帧参考（场景首帧）
  keyframePrompt?: string;
  
  // 场景参考图
  referenceImageUrl?: string;
}

/**
 * 统一性配置
 * 全局控制剧本生成的一致性
 */
export interface UnityConfig {
  // 视觉风格
  style: VisualStyle;
  
  // 角色锁定列表
  characterLocks: CharacterLock[];
  
  // 场景定义列表
  sceneDefinitions: SceneDefinition[];
  
  // 主场景（核心场景，出现频率最高）
  mainScenes: string[];
  
  // 风格标签（用于所有提示词）
  styleTags: string[];
}

// ===========================================
// 分镜生成规则
// ===========================================

/**
 * 分镜时长控制（普通用户：每镜12秒）
 */
export const SHOT_DURATION_RULES = {
  // 最大时长
  maxDuration: 12,
  
  // 最小时长
  minDuration: 12,
  
  // 默认时长
  defaultDuration: 12,
  
  // 镜头类型到时长的映射（统一12秒）
  shotTypeDurations: {
    '特写': { min: 12, max: 12, default: 12 },
    '近景': { min: 12, max: 12, default: 12 },
    '中景': { min: 12, max: 12, default: 12 },
    '全景': { min: 12, max: 12, default: 12 },
    '快切': { min: 12, max: 12, default: 12 },
    '慢推': { min: 12, max: 12, default: 12 },
    '俯拍': { min: 12, max: 12, default: 12 },
    '跟拍': { min: 12, max: 12, default: 12 },
    '摇镜': { min: 12, max: 12, default: 12 },
  },
};

/**
 * 管理员分镜时长控制（每镜15秒）
 */
export const ADMIN_SHOT_DURATION_RULES = {
  // 最大时长
  maxDuration: 15,
  
  // 最小时长
  minDuration: 15,
  
  // 默认时长
  defaultDuration: 15,
  
  // 镜头类型到时长的映射（统一15秒）
  shotTypeDurations: {
    '特写': { min: 15, max: 15, default: 15 },
    '近景': { min: 15, max: 15, default: 15 },
    '中景': { min: 15, max: 15, default: 15 },
    '全景': { min: 15, max: 15, default: 15 },
    '快切': { min: 15, max: 15, default: 15 },
    '慢推': { min: 15, max: 15, default: 15 },
    '俯拍': { min: 15, max: 15, default: 15 },
    '跟拍': { min: 15, max: 15, default: 15 },
    '摇镜': { min: 15, max: 15, default: 15 },
  },
};

/**
 * 节奏阶段定义
 * 基于总时长300秒分配
 */
export const STAGE_RATIOS = {
  钩子: { ratio: 0.08, seconds: 24, shots: 3 },     // 开场钩子，快速抓住观众
  冲突: { ratio: 0.17, seconds: 51, shots: 5 },     // 引入冲突
  升温: { ratio: 0.25, seconds: 75, shots: 8 },     // 矛盾升级
  高潮: { ratio: 0.25, seconds: 75, shots: 8 },     // 冲突爆发（快切为主）
  反转: { ratio: 0.15, seconds: 45, shots: 4 },     // 意外转折
  收尾: { ratio: 0.10, seconds: 30, shots: 4 },     // 悬念收尾
};

/**
 * 分镜数量规则
 * 总时长：120-150秒
 */
export const STORYBOARD_COUNT_RULES = {
  minCount: 12,
  maxCount: 15,
  defaultCount: 12,
  
  // 根据总时长计算分镜数
  calculateCount: (totalSeconds: number = 135): number => {
    const avgDuration = 10; // 平均每镜10秒
    return Math.max(12, Math.min(15, Math.floor(totalSeconds / avgDuration)));
  },
};

// ===========================================
// 提示词工程模板
// ===========================================

/**
 * 统一提示词模板
 * 确保所有分镜提示词风格一致
 */
export interface PromptTemplate {
  // 风格前缀
  stylePrefix: string;
  
  // 角色描述模板
  characterTemplate: string;
  
  // 场景描述模板
  sceneTemplate: string;
  
  // 动作描述模板
  actionTemplate: string;
  
  // 光影描述模板
  lightingTemplate: string;
  
  // 完整提示词组装函数
  buildPrompt: (params: {
    style: VisualStyle;
    character: CharacterLock;
    scene: SceneDefinition;
    action: string;
    dialogue?: string;
    shotType: string;
    emotion?: string;
  }) => string;
}

/**
 * 默认提示词构建函数
 */
export function buildUnifiedPrompt(params: {
  style: VisualStyle;
  character: CharacterLock;
  scene: SceneDefinition;
  action: string;
  dialogue?: string;
  shotType: string;
  emotion?: string;
}): string {
  const { style, character, scene, action, dialogue, shotType, emotion } = params;
  
  // 风格层
  const stylePart = `${style.description}，${style.lighting}，${style.colorTone}色调`;
  
  // 角色层
  const charPart = `${character.name}，${character.keyFeatures}，${character.appearance.clothing}`;
  
  // 场景层
  const scenePart = `${scene.description}，${scene.environment.lighting}，${scene.environment.background}`;
  
  // 动作层
  const actionPart = action;
  
  // 对话层（如果有）
  const dialoguePart = dialogue ? `说道："${dialogue}"` : '';
  
  // 情绪层（如果有）
  const emotionPart = emotion ? `，${emotion}的表情` : '';
  
  // 组装
  return `${stylePart}，${shotType}，${scenePart}，${charPart}${emotionPart}，${actionPart}${dialoguePart}`;
}

// ===========================================
// 预设风格模板
// ===========================================

export const PRESET_STYLES: Record<string, VisualStyle> = {
  // 都市现代风格
  urban_modern: {
    type: 'urban_modern',
    description: '都市现代风格，时尚精致',
    lighting: '明亮柔和的城市光线',
    colorTone: '暖色调偏冷，高级灰',
    cameraStyle: '稳定运镜，中景为主',
    atmosphere: '都市职场氛围，干净利落',
  },
  
  // 古风唯美
  ancient_beauty: {
    type: 'ancient_beauty',
    description: '古风唯美，水墨意境',
    lighting: '柔和自然光，烛光',
    colorTone: '淡雅水墨色，暖黄',
    cameraStyle: '缓慢运镜，意境镜头',
    atmosphere: '诗意古风，温婉含蓄',
  },
  
  // 悬疑暗黑
  suspense_dark: {
    type: 'suspense_dark',
    description: '悬疑暗黑，紧张氛围',
    lighting: '低调光线，明暗对比强烈',
    colorTone: '冷色调，暗蓝灰',
    cameraStyle: '快切，特写，不稳定运镜',
    atmosphere: '压抑紧张，神秘悬疑',
  },
  
  // 甜蜜恋爱
  sweet_romance: {
    type: 'sweet_romance',
    description: '甜蜜恋爱，温馨浪漫',
    lighting: '柔和暖光，梦幻光晕',
    colorTone: '暖粉色调，柔和明亮',
    cameraStyle: '浪漫推镜，柔焦特写',
    atmosphere: '甜蜜温馨，心动感觉',
  },
  
  // 职场精英
  workplace_elite: {
    type: 'workplace_elite',
    description: '职场精英，干练专业',
    lighting: '明亮办公光，自然窗光',
    colorTone: '冷色调，蓝灰白',
    cameraStyle: '稳定运镜，对称构图',
    atmosphere: '专业严谨，职场氛围',
  },
  
  // 仙侠玄幻
  fantasy_fairy: {
    type: 'fantasy_fairy',
    description: '仙侠玄幻，梦幻空灵',
    lighting: '神秘光源，仙气缭绕',
    colorTone: '梦幻紫蓝，仙气白',
    cameraStyle: '飘逸运镜，大全景',
    atmosphere: '仙气飘飘，玄幻神秘',
  },
};

// ===========================================
// 预设场景模板
// ===========================================

export const PRESET_SCENES: Record<string, SceneDefinition> = {
  // 豪宅客厅
  luxury_living_room: {
    sceneId: 'scene_001',
    name: '豪宅客厅',
    type: 'indoor',
    description: '豪华别墅客厅，欧式装修',
    environment: {
      timeOfDay: 'evening',
      lighting: '暖色吊灯，落地窗自然光',
      background: '真皮沙发，大理石茶几，艺术挂画',
    },
  },
  
  // 办公室
  ceo_office: {
    sceneId: 'scene_002',
    name: '总裁办公室',
    type: 'indoor',
    description: '高层办公室，落地窗俯瞰城市',
    environment: {
      timeOfDay: 'afternoon',
      lighting: '明亮办公光线，城市反光',
      background: '大办公桌，真皮座椅，城市天际线',
    },
  },
  
  // 咖啡厅
  coffee_shop: {
    sceneId: 'scene_003',
    name: '咖啡厅',
    type: 'indoor',
    description: '精致咖啡厅，温馨氛围',
    environment: {
      timeOfDay: 'afternoon',
      lighting: '柔和暖光，自然光',
      background: '咖啡机，木质桌椅，绿植',
    },
  },
  
  // 卧室
  bedroom: {
    sceneId: 'scene_004',
    name: '卧室',
    type: 'indoor',
    description: '温馨卧室，私密空间',
    environment: {
      timeOfDay: 'night',
      lighting: '床头灯柔和光线',
      background: '大床，衣柜，梳妆台',
    },
  },
  
  // 街道
  city_street: {
    sceneId: 'scene_005',
    name: '城市街道',
    type: 'outdoor',
    description: '繁华都市街道，人流穿梭',
    environment: {
      timeOfDay: 'evening',
      lighting: '霓虹灯光，路灯',
      background: '高楼大厦，广告牌，行人',
    },
  },
};

// ===========================================
// 关键帧引导
// ===========================================

/**
 * 关键帧定义
 * 用于场景切换和重要镜头的视觉引导
 */
export interface KeyframeGuide {
  // 关键帧ID
  keyframeId: string;
  
  // 所属场景
  sceneId: string;
  
  // 镜头序号
  shotSequence: number;
  
  // 关键帧类型
  type: 'scene_opening' | 'scene_closing' | 'emotion_peak' | 'action_key' | 'transition';
  
  // 提示词
  prompt: string;
  
  // 参考图URL
  referenceImageUrl?: string;
  
  // 重要程度
  importance: 'critical' | 'high' | 'normal';
}

/**
 * 关键帧生成规则
 */
export const KEYFRAME_RULES = {
  // 每个场景必须有开场关键帧
  requireSceneOpening: true,
  
  // 情绪高峰镜头需要关键帧
  requireEmotionPeak: true,
  
  // 关键帧提示词增强
  enhanceKeyframePrompt: (basePrompt: string, keyframe: KeyframeGuide): string => {
    const importanceMap = {
      critical: '【核心关键帧】',
      high: '【重要镜头】',
      normal: '',
    };
    return `${importanceMap[keyframe.importance]}${basePrompt}`;
  },
};

// ===========================================
// 完整剧本结构
// ===========================================

/**
 * 完整分镜数据
 */
export interface Storyboard {
  // 分镜ID
  id: string;
  
  // 序号
  sequence: number;
  
  // 名称
  name: string;
  
  // 时长（秒）
  duration: number;
  
  // 镜头类型
  shotType: string;
  
  // 所属阶段
  stage: string;
  
  // 场景引用
  sceneId: string;
  scene: SceneDefinition;
  
  // 角色引用列表
  characterIds: string[];
  characters: CharacterLock[];
  
  // 画面描述
  description: string;
  
  // 动作描述
  action: string;
  
  // 对话（如果有）
  dialogue?: {
    characterId: string;
    characterName: string;
    content: string;
    emotion?: string;
  };
  
  // 旁白（如果有）
  narration?: string;
  
  // 情绪标签
  emotion?: string;
  
  // 紧张度
  tension: number;
  
  // 视频生成提示词
  videoPrompt: string;
  
  // 关键帧标记
  isKeyframe: boolean;
  keyframeGuide?: KeyframeGuide;
  
  // 参考图
  referenceImages?: string[];
}

/**
 * 完整剧本
 */
export interface Script {
  // 剧本ID
  id: string;
  
  // 标题
  title: string;
  
  // 摘要
  summary: string;
  
  // 题材
  genre: string;
  
  // 核心冲突
  conflict: string;
  
  // 统一性配置
  unity: UnityConfig;
  
  // 开场钩子
  hook: string;
  
  // 结尾悬念
  cliffhanger: string;
  
  // 分镜列表
  storyboards: Storyboard[];
  
  // 关键帧列表
  keyframes: KeyframeGuide[];
  
  // 总时长（秒）
  totalDuration: number;
  
  // 分镜数量
  storyboardCount: number;
  
  // 模型信息
  llmModel?: string;
  llmProvider?: string;
}
