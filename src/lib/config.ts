/**
 * 用户配置管理工具
 * 用于读取和管理用户的模型选择等配置
 * 
 * 扣子平台内置模型配置（2026年9月更新，以平台可用模型清单为准）：
 * - LLM (AI顾问、剧本生成): doubao-seed-2-0-pro-260215 (Seed 2.0 Pro 旗舰) ✅
 * - 图片生成 (海报制作): doubao-seedream-5-0-260128 (Seedream 5.0) ✅
 * - 视频生成: doubao-seedance-2-0-260128 (Seedance 2.0) ✅
 * - 语音合成 (TTS): zh_female_mizai_saturn_bigtts (米子) ✅
 * 
 * 智谱AI模型配置（独立方案，直连开放平台，各家最新旗舰）：
 * - LLM: GLM-5.3 (glm-5.3) - 2026年8月发布，1M上下文
 * - 图片生成: GLM-Image (glm-image)
 * - 视频生成: CogVideoX-3
 * - TTS: GLM-TTS
 * - 文档: https://docs.bigmodel.cn/cn/guide/develop/http/introduction
 */

import { Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest } from 'next/server';

// ==================== 默认配置（必须最先定义）====================

/**
 * 默认模型配置
 *
 * 扣子平台最新模型 (2026年9月更新，以平台可用模型清单为准):
 * - LLM: doubao-seed-2-0-pro-260215 (Seed 2.0 Pro 旗舰) ✅
 * - 图片: doubao-seedream-5-0-260128 (Seedream 5.0) ✅
 * - 视频: doubao-seedance-2-0-260128 (Seedance 2.0) ✅
 * - TTS: zh_female_mizai_saturn_bigtts (米子) ✅
 *
 * 智谱模型（直连开放平台，官方最新）:
 * - LLM: glm-5.3 (GLM-5.3 旗舰，2026年8月) ✅
 * - 图片: glm-image ✅
 * - 视频: cogvideox-3 ✅
 * - TTS: glm-tts ✅
 *
 * 各家官方 API（直连，使用用户自有 Key，统一采用各家最新旗舰）:
 * - 智谱: glm-5.3（GLM-5.3 旗舰，1M上下文）/ glm-image（图像最新）/ glm-tts（TTS 最新）
 * - 千问: qwen3.8-max（旗舰最新）/ wan3.0 视频 / cosyvoice TTS
 * - MiniMax: MiniMax-M3（最新）
 *
 * 注意:
 * - 走扣子的模型以本地沙箱可用清单为准（doubao-seed-2-0-pro-260215 等）
 * - doubao-seedance-2-0-260128 已全量启用，所有用户可用
 */
export const DEFAULT_MODELS = {
  llm: 'doubao-seed-2-0-pro-260215',
  llmProvider: 'coze' as const, // 'coze' | 'zhipu' | 'qwen' | 'minimax'
  image: 'doubao-seedream-5-0-260128',
  video: 'doubao-seedance-2-0-260128',
  tts: 'zh_female_mizai_saturn_bigtts',
  imageSize: '2K',
  // 管理员配置
  admin: {
    video: 'doubao-seedance-2-0-260128',
  },
  // 智谱方案默认模型（直连智谱开放平台，各家最新旗舰）
  zhipu: {
    llm: 'glm-5.3',
    image: 'glm-image',
    video: 'cogvideox-3',
    tts: 'glm-tts',
  },
  // 千问方案默认模型（直连阿里云 DashScope，各家最新旗舰）
  qwen: {
    llm: 'qwen3.8-max',
    image: 'wan2.7-image-pro',  // 千问图片生成模型
    video: 'wan3.0-i2v',  // 万相3.0 最新视频生成模型
    tts: 'cosyvoice-v1',  // 千问语音TTS模型
  },
  // MiniMax 方案默认模型（直连 MiniMax 开放平台，最新旗舰）
  minimax: {
    llm: 'MiniMax-M3',
  },
  // 月之暗面（Kimi）方案默认模型
  moonshot: {
    llm: 'kimi-k3',
  },
  // DeepSeek 方案默认模型
  deepseek: {
    llm: 'deepseek-v4',
  },
  // 百度文心方案默认模型
  wenxin: {
    llm: 'ernie-5.0',
  },
  // 腾讯混元方案默认模型
  hunyuan: {
    llm: 'hunyuan-turbos',
  },
  // 自定义方案默认模型（用户在设置中自由填写模型名）
  custom: {
    llm: '',
  },
} as const;

// ==================== 扣子平台内置模型配置 ====================

/**
 * LLM 模型配置
 * 用于 AI 顾问、剧本生成、内容创作等
 * 
 * 可用模型（2026年8月更新）：
 * - 扣子方案：Doubao Seed 2.1 Pro（最新旗舰，ID: doubao-seed-2-0-pro-260215）
 * - 智谱方案：GLM-5.3、GLM-4.7、GLM-4.6V、GLM-4.5-Air
 */
export const LLM_MODELS = {
  // 扣子方案 - 最新旗舰模型（Seed 2.0 Pro，Agent 时代旗舰）
  'doubao-seed-2-0-pro-260215': {
    id: 'doubao-seed-2-0-pro-260215',
    name: 'Doubao Seed 2.0 Pro',
    description: '豆包旗舰全能模型，复杂推理、长链路 Agent 任务、多模态理解与结构化生成',
    provider: 'coze',
    available: true,
    recommended: true,
    useCase: ['剧本生成', 'AI顾问', '内容创作', '复杂推理'],
  },
  // 扣子方案 - 均衡版（Seed 2.0 Lite）
  'doubao-seed-2-0-lite-260215': {
    id: 'doubao-seed-2-0-lite-260215',
    name: 'Doubao Seed 2.0 Lite',
    description: '高性能与成本兼顾的均衡模型，内容创作、数据分析、多源信息融合',
    provider: 'coze',
    available: true,
    recommended: false,
    useCase: ['内容创作', '数据分析', '企业任务'],
  },
  // 扣子方案 - 轻量版（Seed 2.0 Mini）
  'doubao-seed-2-0-mini-260215': {
    id: 'doubao-seed-2-0-mini-260215',
    name: 'Doubao Seed 2.0 Mini',
    description: '低时延、高并发，成本敏感场景，支持256k上下文与多模态理解',
    provider: 'coze',
    available: true,
    recommended: false,
    useCase: ['快速对话', '简单问答', '批量处理'],
  },
  // 智谱方案 - 官方最新旗舰（直连 open.bigmodel.cn，model: glm-5.3）
  'glm-5.3': {
    id: 'glm-5.3',
    name: 'GLM-5.3',
    description: '智谱新一代旗舰基座，2026年8月发布，面向 Agentic Engineering，1M 上下文，复杂系统工程与长程 Agent 任务',
    provider: 'zhipu',
    available: true,
    recommended: true,
    useCase: ['剧本生成', 'AI顾问', '复杂推理', '内容创作'],
    contextWindow: 1000000,
    maxOutput: 131072,
  },
  // 智谱方案 - 高性价比多模态（直连 open.bigmodel.cn，model: glm-5.3-flash）
  'glm-5.3-flash': {
    id: 'glm-5.3-flash',
    name: 'GLM-5.3-Flash',
    description: '智谱高性价比多模态模型，1M 上下文，支持图片/视频/文件输入，成本仅为旗舰 1/10',
    provider: 'zhipu',
    available: true,
    recommended: false,
    useCase: ['日常对话', '内容创作', '多模态理解', '批量任务'],
    contextWindow: 1000000,
    maxOutput: 131072,
  },
  // MiniMax 方案 - 官方最新旗舰（直连 MiniMax 开放平台，model: MiniMax-M3）
  'MiniMax-M3': {
    id: 'MiniMax-M3',
    name: 'MiniMax M3',
    description: 'MiniMax 最新语言模型，面向 Agent 推理、工具调用、代码、多模态输入与百万级长上下文',
    provider: 'minimax',
    available: true,
    recommended: true,
    useCase: ['复杂推理', '编码', 'Agent 任务', '内容创作'],
    contextWindow: 1000000,
  },
  // 千问方案 - 官方最新旗舰（直连 DashScope，model: qwen3.8-max）
  'qwen3.8-max': {
    id: 'qwen3.8-max',
    name: 'Qwen3.8 Max',
    description: '千问官方最新旗舰，2.4万亿参数多模态 MoE，百万上下文，Coding 与复杂推理顶尖',
    provider: 'qwen',
    available: true,
    recommended: true,
    useCase: ['剧本生成', 'AI顾问', '复杂推理', '内容创作', '多模态理解'],
    supportsVision: true,
    contextWindow: 1000000,
  },
} as const;

/**
 * 图片生成模型配置
 * 用于海报制作、场景图、角色图生成
 */
export const IMAGE_MODELS = {
  // 扣子平台模型 - Seedream 5.0（最新旗舰，默认可用）
  'doubao-seedream-5-0-260128': {
    id: 'doubao-seedream-5-0-260128',
    name: 'Doubao Seedream 5.0',
    description: '最新旗舰图片生成模型，画质增强，高精度位置与元素控制，支持文生图/图生图/交互编辑',
    provider: 'coze',
    available: true,
    recommended: true,
    useCase: ['海报制作', '场景图', '角色图', '封面图', '立绘生成'],
    features: {
      resolutions: ['2K', '4K'],
      styles: ['写实', '动漫', '插画'],
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
      recommendedSizes: {
        '1:1': '2048x2048',
        '4:3': '2304x1728',
        '3:4': '1728x2304',
        '16:9': '2560x1440',
        '9:16': '1440x2560',
        '3:2': '2496x1664',
        '2:3': '1664x2496',
        '21:9': '3024x1296',
      },
      optimizePrompt: true,
      sequentialGeneration: true,
      multiImageInput: true,
      imageFormats: ['jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'],
      minPixels: 3686400,
      maxPixels: 16777216,
      aspectRatioRange: [1/16, 16],
    },
  },
  // 扣子平台模型 - Seedream 4.5（高性价比，稳定通用）
  'doubao-seedream-4-5-251128': {
    id: 'doubao-seedream-4-5-251128',
    name: 'Doubao Seedream 4.5',
    description: '成熟稳定的高画质图片生成模型，通用场景表现优秀',
    provider: 'coze',
    available: true,
    recommended: false,
    useCase: ['海报制作', '场景图', '角色图', '封面图', '立绘生成'],
    features: {
      resolutions: ['2K'],
      styles: ['写实', '动漫', '插画'],
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      recommendedSizes: {
        '1:1': '2048x2048',
        '4:3': '2304x1728',
        '3:4': '1728x2304',
        '16:9': '2560x1440',
        '9:16': '1440x2560',
      },
      optimizePrompt: true,
      sequentialGeneration: true,
      multiImageInput: true,
      imageFormats: ['jpeg', 'png', 'webp'],
    },
  },
  // 智谱模型 - GLM-Image（官方最新图像模型）
  'glm-image': {
    id: 'glm-image',
    name: 'GLM-Image',
    description: '智谱官方最新文生图模型，自回归+扩散混合架构，汉字渲染出色，支持文生图与图生图',
    provider: 'zhipu',
    available: true,
    recommended: true,
    useCase: ['海报制作', '场景图', '角色图', '封面图', '电商产品配图'],
    features: {
      resolutions: ['1280x1280'],
      styles: ['写实', '动漫', '插画'],
      aspectRatios: ['1:1', '3:4', '4:3', '16:9'],
      fast: true,
      optimizePrompt: false,
      sequentialGeneration: false,
      multiImageInput: true,
      chineseTextGeneration: true,
    },
  },
} as const;

/**
 * 视频生成模型配置
 * 用于 AI 视频生成
 */
export const VIDEO_MODELS = {
  // 火山引擎模型 - Seedance 2.0（全量启用）
  'doubao-seedance-2-0-260128': {
    id: 'doubao-seedance-2-0-260128',
    name: 'Seedance 2.0',
    description: '最新视频生成模型，支持文生视频、图生视频、音频生成、视频参考，支持最长15秒超长镜头，1080P超清画质',
    provider: 'volcengine',
    available: true,
    recommended: true,
    adminOnly: false,
    useCase: ['文生视频', '图生视频', '音频视频', '视频参考', '超长镜头'],
    features: {
      audioGeneration: true,
      firstFrameControl: true,
      lastFrameControl: true,
      videoReference: true,
      audioReference: true,
      dialogueInPrompt: true,
      durationRange: [2, 15],
      resolutions: ['480p', '720p', '1080p'],
      ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
      highlights: [
        '支持最长15秒超长镜头',
        '每镜头至少5句台词',
        '1080P超清画质',
        '首尾帧精确控制',
        '丰富的音效提示',
      ],
    },
  },
  // 智谱模型 - CogVideoX-3
  'cogvideox-3': {
    id: 'cogvideox-3',
    name: 'CogVideoX-3',
    description: '智谱最新视频生成模型，支持首尾帧控制，画面稳定度与清晰度大幅提升',
    provider: 'zhipu',
    available: true,
    recommended: true,
    useCase: ['文生视频', '图生视频', '短视频创作', '3D风格场景'],
    features: {
      audioGeneration: false,
      firstFrameControl: true,     // 新增首帧控制
      lastFrameControl: true,      // 新增尾帧控制
      dialogueInPrompt: false,
      durationRange: [7, 10],
      resolutions: ['720p', '1080p'],
      ratios: ['16:9', '9:16', '1:1'],
      highlights: [
        '画面稳定度大幅提升',
        '清晰度显著增强',
        '主体大幅度运动流畅自然',
        '指令遵循更精准',
        '物理真实模拟更佳',
        '高清现实场景表现提升',
        '3D风格场景表现提升',
      ],
    },
  },
} as const;

/**
 * TTS 语音配置
 * 用于视频配音、旁白生成
 * 
 * 音色分类：
 * 1. 通用场景 - 适合旁白、解说、通用配音
 * 2. 视频配音 - 专业短剧、影视配音
 * 3. 角色扮演 - 适合特定角色类型
 * 4. 有声书 - 适合长文本朗读
 * 
 * 年龄分组：
 * - child: 幼年 (0-12岁) 童声
 * - young: 少年 (13-25岁) 青春活力
 * - adult: 中年 (26-55岁) 成熟稳重
 * - elderly: 老年 (56岁以上) 沧桑睿智
 */
export const TTS_SPEAKERS = {
  // ==================== 幼年童声 (0-12岁) ====================
  'zh_child_huoli_moon_bigtts': {
    id: 'zh_child_huoli_moon_bigtts',
    name: '活力童声',
    description: '活泼可爱的童声，适合儿童角色、童话故事',
    provider: 'coze',
    gender: 'neutral',
    ageGroup: 'child',
    style: ['cute', 'lively', 'innocent'],
    useCase: ['儿童角色', '童话故事', '动画配音', '亲子内容'],
    recommended: true,
    category: 'child',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'zh_child_keai_moon_bigtts': {
    id: 'zh_child_keai_moon_bigtts',
    name: '可爱童声',
    description: '软萌可爱的童声，适合小女孩、萌娃角色',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'child',
    style: ['cute', 'sweet', 'innocent'],
    useCase: ['小女孩', '萌娃', '童话公主', '动画角色'],
    recommended: true,
    category: 'child',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'zh_child_tiaopi_moon_bigtts': {
    id: 'zh_child_tiaopi_moon_bigtts',
    name: '调皮童声',
    description: '调皮活泼的童声，适合小男孩、调皮角色',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'child',
    style: ['playful', 'energetic', 'naughty'],
    useCase: ['小男孩', '调皮角色', '动画配音', '儿童故事'],
    recommended: true,
    category: 'child',
    suitableRoles: ['protagonist', 'supporting'],
  },
  
  // ==================== 通用场景 ====================
  'zh_female_xiaohe_uranus_bigtts': {
    id: 'zh_female_xiaohe_uranus_bigtts',
    name: '小荷',
    description: '通用女声，适合旁白和解说',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['neutral', 'calm'],
    useCase: ['旁白', '解说', '通用'],
    recommended: true,
    category: 'general',
  },
  'zh_female_vv_uranus_bigtts': {
    id: 'zh_female_vv_uranus_bigtts',
    name: 'Vivi',
    description: '中英双语女声，适合双语场景',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['neutral', 'professional'],
    useCase: ['双语配音', '解说'],
    recommended: false,
    category: 'general',
    features: { bilingual: true },
  },
  'zh_male_m191_uranus_bigtts': {
    id: 'zh_male_m191_uranus_bigtts',
    name: '云舟',
    description: '通用男声，适合旁白和解说',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['neutral', 'calm'],
    useCase: ['旁白', '解说', '通用'],
    recommended: true,
    category: 'general',
  },
  'zh_male_taocheng_uranus_bigtts': {
    id: 'zh_male_taocheng_uranus_bigtts',
    name: '小天',
    description: '通用男声，年轻活力',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'young',
    style: ['energetic', 'bright'],
    useCase: ['旁白', '解说', '青春题材'],
    recommended: false,
    category: 'general',
  },
  
  // ==================== 视频配音（专业短剧）====================
  'zh_female_mizai_saturn_bigtts': {
    id: 'zh_female_mizai_saturn_bigtts',
    name: '米子',
    description: '专业视频配音女声，情感丰富，适合短剧女主角',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['emotional', 'versatile'],
    useCase: ['短剧配音', '女主角', '情感戏'],
    recommended: true,
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'zh_male_dayi_saturn_bigtts': {
    id: 'zh_male_dayi_saturn_bigtts',
    name: '大毅',
    description: '专业视频配音男声，沉稳有力，适合短剧男主角',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['confident', 'mature'],
    useCase: ['短剧配音', '男主角', '霸总', '职场'],
    recommended: true,
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'zh_female_jitangnv_saturn_bigtts': {
    id: 'zh_female_jitangnv_saturn_bigtts',
    name: '励志女声',
    description: '励志激昂的女声，适合演讲、激励场景',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['inspiring', 'powerful'],
    useCase: ['演讲', '激励', '职场女强人'],
    recommended: false,
    category: 'video',
    suitableRoles: ['supporting'],
  },
  'zh_female_meilinvyou_saturn_bigtts': {
    id: 'zh_female_meilinvyou_saturn_bigtts',
    name: '迷人女友',
    description: '温柔甜美的女声，适合恋爱、甜宠场景',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'young',
    style: ['sweet', 'gentle', 'romantic'],
    useCase: ['甜宠剧', '恋爱', '女友角色'],
    recommended: true,
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'zh_female_santongyongns_saturn_bigtts': {
    id: 'zh_female_santongyongns_saturn_bigtts',
    name: '温柔女声',
    description: '温柔舒缓的女声，适合治愈、温馨场景',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['gentle', 'soothing', 'warm'],
    useCase: ['治愈系', '温馨', '旁白'],
    recommended: false,
    category: 'video',
  },
  'zh_male_ruyayichen_saturn_bigtts': {
    id: 'zh_male_ruyayichen_saturn_bigtts',
    name: '儒雅男声',
    description: '温文尔雅的男声，适合古风、儒雅角色',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['elegant', 'refined', 'gentleman'],
    useCase: ['古风剧', '儒雅角色', '书生'],
    recommended: true,
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
  },
  
  // ==================== 角色扮演 ====================
  'saturn_zh_female_keainvsheng_tob': {
    id: 'saturn_zh_female_keainvsheng_tob',
    name: '可爱女生',
    description: '活泼可爱的女声，适合年轻女性、少女角色',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'young',
    style: ['cute', 'lively', 'innocent'],
    useCase: ['少女角色', '校园剧', '甜宠'],
    recommended: true,
    category: 'roleplay',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'saturn_zh_female_tiaopigongzhu_tob': {
    id: 'saturn_zh_female_tiaopigongzhu_tob',
    name: '调皮公主',
    description: '调皮活泼的女声，适合古灵精怪的角色',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'young',
    style: ['playful', 'mischievous', 'energetic'],
    useCase: ['古灵精怪', '公主角色', '喜剧'],
    recommended: false,
    category: 'roleplay',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'saturn_zh_male_shuanglangshaonian_tob': {
    id: 'saturn_zh_male_shuanglangshaonian_tob',
    name: '爽朗少年',
    description: '阳光爽朗的男声，适合年轻男性、校园男神',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'young',
    style: ['sunny', 'cheerful', 'confident'],
    useCase: ['校园剧', '少年角色', '阳光男孩'],
    recommended: true,
    category: 'roleplay',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'saturn_zh_male_tiancaitongzhuo_tob': {
    id: 'saturn_zh_male_tiancaitongzhuo_tob',
    name: '天才同桌',
    description: '聪明冷静的男声，适合学霸、精英角色',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'young',
    style: ['intelligent', 'calm', 'confident'],
    useCase: ['校园剧', '学霸角色', '精英'],
    recommended: false,
    category: 'roleplay',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'saturn_zh_female_cancan_tob': {
    id: 'saturn_zh_female_cancan_tob',
    name: '知性灿灿',
    description: '知性优雅的女声，适合职业女性、知性角色',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['intellectual', 'elegant', 'mature'],
    useCase: ['职场剧', '知性角色', '女强人'],
    recommended: false,
    category: 'roleplay',
    suitableRoles: ['protagonist', 'supporting'],
  },
  
  // ==================== 有声书/朗读 ====================
  'zh_female_xueayi_saturn_bigtts': {
    id: 'zh_female_xueayi_saturn_bigtts',
    name: '儿童有声书',
    description: '适合儿童故事、童话朗读',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'child',
    style: ['storytelling', 'expressive', 'warm'],
    useCase: ['儿童故事', '童话', '有声书'],
    recommended: false,
    category: 'audiobook',
  },
  
  // ==================== 老年音色 (56岁以上) ====================
  'zh_elderly_male_cangsang_moon_bigtts': {
    id: 'zh_elderly_male_cangsang_moon_bigtts',
    name: '沧桑老者',
    description: '沧桑深沉的老年男声，适合智者、长辈角色',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'elderly',
    style: ['deep', 'wise', 'weathered'],
    useCase: ['老年角色', '智者', '长辈', '旁白'],
    recommended: true,
    category: 'elderly',
    suitableRoles: ['supporting'],
  },
  'zh_elderly_female_cixiang_moon_bigtts': {
    id: 'zh_elderly_female_cixiang_moon_bigtts',
    name: '慈祥老人',
    description: '慈祥温和的老年女声，适合奶奶、长辈角色',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'elderly',
    style: ['warm', 'gentle', 'kind'],
    useCase: ['老年角色', '奶奶', '长辈', '温馨场景'],
    recommended: true,
    category: 'elderly',
    suitableRoles: ['supporting'],
  },
  'zh_elderly_male_gushi_moon_bigtts': {
    id: 'zh_elderly_male_gushi_moon_bigtts',
    name: '故事老人',
    description: '善于讲述故事的老年男声，适合回忆、讲述场景',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'elderly',
    style: ['storytelling', 'nostalgic', 'slow'],
    useCase: ['回忆录', '故事讲述', '旁白', '有声书'],
    recommended: false,
    category: 'elderly',
  },
  'zh_elderly_female_wenhe_moon_bigtts': {
    id: 'zh_elderly_female_wenhe_moon_bigtts',
    name: '温和老人',
    description: '温和亲切的老年女声，适合日常、家庭场景',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'elderly',
    style: ['gentle', 'warm', 'caring'],
    useCase: ['家庭剧', '日常场景', '长辈'],
    recommended: false,
    category: 'elderly',
    suitableRoles: ['supporting'],
  },
  
  // ==================== 智谱方案 ====================
  'glm-tts': {
    id: 'glm-tts',
    name: 'GLM-TTS',
    description: '新一代智谱语音大模型，上下文智能预判情绪语调，情感表达开源SOTA',
    provider: 'zhipu',
    gender: 'neutral',
    ageGroup: 'adult',
    style: ['natural', 'expressive', 'context-aware'],
    useCase: ['语音合成', '配音', '旁白', '角色配音'],
    recommended: true,
    category: 'zhipu',
    features: {
      contextAware: true,
      emotionControl: true,
      speedControl: true,
      naturalProsody: true,
      highQuality: true,
    },
    voices: [
      { id: 'alloy', name: 'Alloy', gender: 'neutral', description: '中性音色，适合通用场景' },
      { id: 'echo', name: 'Echo', gender: 'male', description: '男声，适合旁白解说' },
      { id: 'fable', name: 'Fable', gender: 'female', description: '女声，适合故事讲述' },
      { id: 'onyx', name: 'Onyx', gender: 'male', description: '深沉男声，适合严肃内容' },
      { id: 'nova', name: 'Nova', gender: 'female', description: '活力女声，适合角色配音' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female', description: '温柔女声，适合情感内容' },
    ],
  },
  'glm-tts-clone': {
    id: 'glm-tts-clone',
    name: 'GLM-TTS-Clone',
    description: '智谱音色克隆模型，只需3秒语音样本即可克隆音色',
    provider: 'zhipu',
    gender: 'custom',
    ageGroup: 'custom',
    style: ['custom'],
    useCase: ['自定义音色', '角色配音', '音色克隆'],
    recommended: false,
    category: 'zhipu',
    features: {
      voiceCloning: true,
      minSampleDuration: 3,
    },
  },

  // ==================== 千问方案 ====================
  'qwen-tts-v1': {
    id: 'qwen-tts-v1',
    name: 'Qwen TTS v1',
    description: '千问语音合成模型，支持多语言和多种音色',
    provider: 'qwen',
    gender: 'neutral',
    ageGroup: 'adult',
    style: ['natural', 'expressive', 'clear'],
    useCase: ['语音合成', '配音', '旁白', '角色配音'],
    recommended: true,
    category: 'qwen',
    features: {
      multiLanguage: true,
      emotionControl: true,
      speedControl: true,
      highQuality: true,
    },
    voices: [
      { id: 'zhixia', name: '知夏', gender: 'female', description: '温柔女声，适合日常对话' },
      { id: 'zhishu', name: '知书', gender: 'male', description: '知性男声，适合旁白解说' },
      { id: 'zhikong', name: '知空', gender: 'male', description: '沉稳男声，适合严肃内容' },
      { id: 'zhimeng', name: '知梦', gender: 'female', description: '甜美女声，适合角色配音' },
    ],
  },

  // ==================== 待验证/不可用 ====================
  // 豆包语音2.0新音色需要特殊资源配置，当前SDK暂不支持
  // 错误信息: "resource ID is mismatched with speaker related resource"
  // 待扣子平台开放相关API后启用
  'doubao-tts-2-0': {
    id: 'doubao-tts-2-0',
    name: '豆包语音合成2.0',
    description: '最新一代语音合成模型，支持TTS对话式合成新范式（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'neutral',
    ageGroup: 'adult',
    style: ['natural', 'expressive', 'emotional'],
    useCase: ['短剧配音', '角色对白', '旁白', '解说'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    features: {
      queryResponse: true, // 支持对话式合成
      maxLength: 100000, // 最大10万字符
      storageDays: 7, // 服务端保存7天
    },
  },
  
  // ==================== 豆包语音2.0 - 多情感音色（暂不可用）====================
  'zh_female_gaolengyujie_emo_v2_mars_bigtts': {
    id: 'zh_female_gaolengyujie_emo_v2_mars_bigtts',
    name: '高冷御姐（多情感）',
    description: '多情感女声，支持开心、悲伤、生气等情感（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['emotional', 'versatile', 'cold'],
    useCase: ['短剧配音', '御姐角色', '反派', '女王'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist', 'supporting', 'antagonist'],
    features: { multiEmotion: ['开心', '悲伤', '生气', '惊讶', '恐惧', '厌恶', '激动', '冷漠', '中性'] },
  },
  'zh_male_aojiaobazong_emo_v2_mars_bigtts': {
    id: 'zh_male_aojiaobazong_emo_v2_mars_bigtts',
    name: '傲娇霸总（多情感）',
    description: '多情感男声，支持中性、开心、愤怒、厌恶（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['emotional', 'arrogant', 'powerful'],
    useCase: ['短剧配音', '霸总角色', '男主', '傲娇'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
    features: { multiEmotion: ['中性', '开心', '愤怒', '厌恶'] },
  },
  'zh_female_tianxinxiaomei_emo_v2_mars_bigtts': {
    id: 'zh_female_tianxinxiaomei_emo_v2_mars_bigtts',
    name: '甜心小美（多情感）',
    description: '多情感女声，支持悲伤、恐惧、厌恶、中性（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'young',
    style: ['emotional', 'sweet', 'cute'],
    useCase: ['短剧配音', '甜宠剧', '少女角色'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
    features: { multiEmotion: ['悲伤', '恐惧', '厌恶', '中性'] },
  },
  
  // ==================== 豆包语音2.0 - 趣味口音（暂不可用）====================
  'zh_female_yueyunv_mars_bigtts': {
    id: 'zh_female_yueyunv_mars_bigtts',
    name: '粤语小溏',
    description: '粤语口音女声，适合港风、粤语场景（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['cantonese', 'playful'],
    useCase: ['港风剧', '粤语场景', '喜剧'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'special',
  },
  'zh_male_lubanqihao_mars_bigtts': {
    id: 'zh_male_lubanqihao_mars_bigtts',
    name: '鲁班七号',
    description: '趣味男声，机械感，适合游戏、科幻场景',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['mechanical', 'playful'],
    useCase: ['游戏配音', '科幻剧', '机器人角色'],
    recommended: false,
    category: 'special',
  },
  'zh_female_yangmi_mars_bigtts': {
    id: 'zh_female_yangmi_mars_bigtts',
    name: '林潇',
    description: '明星风格女声，适合现代剧女主角',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['elegant', 'confident'],
    useCase: ['现代剧', '都市剧', '女主角'],
    recommended: true,
    category: 'video',
    suitableRoles: ['protagonist'],
  },
  'zh_male_tangseng_mars_bigtts': {
    id: 'zh_male_tangseng_mars_bigtts',
    name: '唐僧',
    description: '经典唐僧音色，适合古风、神话剧',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['classic', 'monk'],
    useCase: ['古风剧', '神话剧', '西游记'],
    recommended: false,
    category: 'special',
  },
  'zh_male_zhubajie_mars_bigtts': {
    id: 'zh_male_zhubajie_mars_bigtts',
    name: '猪八戒',
    description: '经典猪八戒音色，适合神话剧、喜剧（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['classic', 'comedic'],
    useCase: ['神话剧', '喜剧', '西游记'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'special',
  },
  
  // ==================== 豆包语音2.0 - 角色扮演（暂不可用）====================
  'ICL_zh_female_aojiaonvyou_tob': {
    id: 'ICL_zh_female_aojiaonvyou_tob',
    name: '傲娇女友（SC）',
    description: '强人格版本，适合角色扮演、情感陪聊（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'young',
    style: ['tsundere', 'playful', 'emotional'],
    useCase: ['角色扮演', '情感陪聊', '女友角色'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'roleplay',
    suitableRoles: ['protagonist', 'supporting'],
    features: { strongCharacter: true },
  },
  'ICL_zh_female_bingjiaojiejie_tob': {
    id: 'ICL_zh_female_bingjiaojiejie_tob',
    name: '冰娇姐姐（SC）',
    description: '强人格版本，冷艳高贵，适合女王、御姐角色（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['cold', 'elegant', 'noble'],
    useCase: ['角色扮演', '女王角色', '御姐'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'roleplay',
    suitableRoles: ['protagonist', 'antagonist'],
    features: { strongCharacter: true },
  },
  'ICL_zh_male_lengkugege_v1_tob': {
    id: 'ICL_zh_male_lengkugege_v1_tob',
    name: '冷酷哥哥',
    description: '冷酷帅气男声，适合霸总、高冷角色（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['cold', 'cool', 'confident'],
    useCase: ['短剧配音', '霸总', '高冷男主'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist'],
  },
  'ICL_zh_male_guaogongzi_v1_tob': {
    id: 'ICL_zh_male_guaogongzi_v1_tob',
    name: '孤傲公子',
    description: '孤傲清高男声，适合古风、仙侠男主（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['aloof', 'noble', 'elegant'],
    useCase: ['古风剧', '仙侠剧', '男主'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist'],
  },
  'ICL_zh_male_buyan_v1_tob': {
    id: 'ICL_zh_male_buyan_v1_tob',
    name: '醇厚低音',
    description: '低沉磁性男声，适合旁白、叙述、严肃角色（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'male',
    ageGroup: 'adult',
    style: ['deep', 'magnetic', 'serious'],
    useCase: ['旁白', '叙述', '严肃角色', '有声书'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
  },
  'ICL_zh_female_yuxin_v1_tob': {
    id: 'ICL_zh_female_yuxin_v1_tob',
    name: '初恋女友',
    description: '温柔甜美女声，适合甜宠剧、恋爱场景（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'young',
    style: ['sweet', 'gentle', 'romantic'],
    useCase: ['甜宠剧', '恋爱', '女友角色'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist', 'supporting'],
  },
  'ICL_zh_female_xnx_tob': {
    id: 'ICL_zh_female_xnx_tob',
    name: '贴心闺蜜',
    description: '温柔贴心女声，适合闺蜜、知己角色（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['warm', 'caring', 'friendly'],
    useCase: ['闺蜜角色', '知己', '配角'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'roleplay',
    suitableRoles: ['supporting'],
  },
  'zh_female_leidian_mars_bigtts': {
    id: 'zh_female_leidian_mars_bigtts',
    name: '女雷神',
    description: '霸气女声，适合女战士、强势角色（需要特殊资源配置，暂不可用）',
    provider: 'coze',
    gender: 'female',
    ageGroup: 'adult',
    style: ['powerful', 'dominant', 'fierce'],
    useCase: ['动作剧', '女战士', '强势角色'],
    recommended: false,
    available: false, // 需要特殊资源配置
    category: 'video',
    suitableRoles: ['protagonist', 'antagonist'],
  },
} as const;

/**
 * 按类别获取音色列表
 */
export function getTTSSpeakersByCategory(category: string) {
  return Object.values(TTS_SPEAKERS).filter(speaker => speaker.category === category);
}

/**
 * 按性别获取音色列表
 */
export function getTTSSpeakersByGender(gender: 'male' | 'female') {
  return Object.values(TTS_SPEAKERS).filter(speaker => speaker.gender === gender);
}

/**
 * 获取推荐的女声音色
 */
export function getRecommendedFemaleVoices() {
  return Object.values(TTS_SPEAKERS).filter(
    speaker => speaker.gender === 'female' && speaker.recommended
  );
}

/**
 * 获取推荐的男声音色
 */
export function getRecommendedMaleVoices() {
  return Object.values(TTS_SPEAKERS).filter(
    speaker => speaker.gender === 'male' && speaker.recommended
  );
}

/**
 * 根据角色类型获取推荐音色
 */
export function getRecommendedVoicesForRole(roleType: string) {
  return Object.values(TTS_SPEAKERS).filter(
    speaker => 'suitableRoles' in speaker && (speaker.suitableRoles as readonly string[]).includes(roleType)
  );
}

/**
 * 图片尺寸配置
 */
export const IMAGE_SIZES = {
  '2K': {
    id: '2K',
    name: '2K (2560x1440)',
    description: '标准高清，平衡质量与速度',
    width: 2560,
    height: 1440,
  },
  '4K': {
    id: '4K',
    name: '4K (3840x2160)',
    description: '超高清，更高质量但耗时更长',
    width: 3840,
    height: 2160,
  },
} as const;

// ==================== 解决方案预设（向后兼容）====================

/**
 * 解决方案类型
 */
export type SolutionType = 'standard' | 'zhipu' | 'qwen' | 'minimax' | 'volcengine' | 'moonshot' | 'deepseek' | 'wenxin' | 'hunyuan' | 'custom';

/**
 * 解决方案预设配置
 * - standard: 扣子平台内置模型方案（最新模型）
 * - zhipu: 智谱AI模型方案（独立方案，全套智谱模型）
 * - qwen: 千问模型方案（独立方案，千问模型 + 扣子图片/视频）
 *
 * 注意: 管理员专用模型（如 doubao-seedance-2-0-260128）不在用户方案中，
 * 需要通过管理员专用 API 调用
 */
export const SOLUTION_PRESETS = {
  'standard': {
    id: 'standard',
    name: '扣子方案',
    description: '使用扣子平台内置模型（最新版本）',
    provider: 'coze',
    available: true,
    models: {
      video: DEFAULT_MODELS.video,
      videoDescription: 'Seedance 2.0 - 高质量视频生成',
      llm: DEFAULT_MODELS.llm,
      llmDescription: 'Doubao Seed 2.0 Pro - 旗舰模型',
      image: DEFAULT_MODELS.image,
      imageDescription: 'Doubao Seedream 5.0 - 最新高质量图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '米子 - 专业视频配音',
    },
    features: [
      '扣子平台内置模型',
      '最新旗舰 LLM 模型 (Doubao Seed 2.0 Pro)',
      '专业视频生成 (Seedance 2.0)',
      '最新图片生成 (Seedream 5.0)',
      '专业视频配音 (米子)',
    ],
    useCase: ['短剧创作', '视频生成', 'AI顾问'],
  },
  'zhipu': {
    id: 'zhipu',
    name: '智谱方案',
    description: '使用智谱AI全套模型（需配置 API Key）',
    provider: 'zhipu',
    available: true,
    models: {
      llm: DEFAULT_MODELS.zhipu.llm,
      llmDescription: 'GLM-5.3 - 最新旗舰模型',
      llmAlternative: 'glm-5.3-flash',
      llmAlternativeDescription: 'GLM-5.3-Flash - 高性价比多模态（1M上下文，支持图片/视频输入）',
      image: DEFAULT_MODELS.zhipu.image,
      imageDescription: 'GLM-Image - 智谱专业图片生成模型',
      imageSize: '2K',
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.zhipu.video,
      videoDescription: 'CogVideoX-3 - 支持首尾帧控制，画面稳定度大幅提升',
      tts: DEFAULT_MODELS.zhipu.tts,
      ttsDescription: 'GLM-TTS 新一代语音大模型（上下文智能预判情绪语调，情感表达开源SOTA）+ GLM-TTS-Clone 音色克隆（3秒样本）',
    },
    features: [
      '智谱AI全套模型',
      'GLM-5.3 最新旗舰模型（1M上下文）',
      'GLM-5.3-Flash 高性价比多模态',
      'GLM-Image 专业图片生成',
      'CogVideoX-3 首尾帧控制',
      '画面稳定度大幅提升',
      '主体运动流畅自然',
      'GLM-TTS 新一代语音大模型',
      '上下文智能预判情绪语调',
      '情感表达开源SOTA',
      'GLM-TTS-Clone 音色克隆（3秒样本）',
      '高性价比',
    ],
    useCase: ['剧本生成', '图片创作', '视频生成', '语音合成'],
    requiresApiKey: true,
    apiKeyEnvVar: 'ZHIPU_API_KEY',
  },
  'qwen': {
    id: 'qwen',
    name: '千问方案',
    description: '使用千问AI全套模型（需配置 API Key）',
    provider: 'qwen',
    available: true,
    models: {
      llm: DEFAULT_MODELS.qwen.llm,
      llmDescription: 'Qwen3.8 Max - 千问官方最新旗舰模型',
      image: DEFAULT_MODELS.qwen.image,
      imageDescription: 'Wan 系列 - 千问专业图片生成模型',
      imageSize: '2K',
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.qwen.video,
      videoDescription: 'Wan3.0 - 万相最新视频生成模型，原生支持长时长',
      tts: DEFAULT_MODELS.qwen.tts,
      ttsDescription: 'CosyVoice - 千问语音合成模型',
    },
    features: [
      '千问AI全套模型',
      'Qwen3.8 Max 官方最新旗舰模型',
      'Wan 系列专业图片生成',
      'Wan3.0 最新视频生成',
      'CosyVoice 语音合成',
      '百万级超长上下文',
      '支持图像理解与生成',
      '多语言支持',
      '高性价比',
    ],
    useCase: ['剧本生成', '图片创作', '视频生成', '语音合成', '多模态理解'],
    requiresApiKey: true,
    apiKeyEnvVar: 'QWEN_API_KEY',
  },
  'minimax': {
    id: 'minimax',
    name: 'MiniMax 方案',
    description: '使用 MiniMax 官方最新模型（需配置 API Key）',
    provider: 'minimax',
    available: true,
    models: {
      llm: DEFAULT_MODELS.minimax.llm,
      llmDescription: 'MiniMax M3 - 官方最新旗舰，百万上下文，Agent 与 Coding',
      image: DEFAULT_MODELS.image,
      imageDescription: '可回退扣子 Seedream 5.0 图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: '可回退扣子 Seedance 2.0 视频生成',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '可回退扣子米子配音',
    },
    features: [
      'MiniMax M3 官方最新旗舰',
      '百万级超长上下文',
      'Agent 推理与工具调用',
      '多模态输入',
      '高性价比',
    ],
    useCase: ['剧本生成', '复杂推理', '编码', 'Agent 任务'],
    requiresApiKey: true,
    apiKeyEnvVar: 'MINIMAX_API_KEY',
  },
  'volcengine': {
    id: 'volcengine',
    name: '火山引擎方案',
    description: '直连火山方舟，官方豆包模型（需配置 API Key）',
    provider: 'volcengine',
    available: true,
    models: {
      llm: DEFAULT_MODELS.llm,
      llmDescription: 'Doubao Seed 2.0 Pro - 火山方舟官方旗舰模型',
      image: DEFAULT_MODELS.image,
      imageDescription: 'Doubao Seedream 5.0 图片生成（方舟端点）',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: 'Seedance 2.0 视频生成（方舟端点）',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '扣子内置配音（火山大模型配音可切换）',
    },
    features: [
      '火山方舟官方直连',
      'Doubao Seed 2.0 Pro 旗舰模型',
      'Seedream 5.0 图片生成',
      'Seedance 2.0 视频生成',
      '支持自定义端点',
    ],
    useCase: ['剧本生成', '图片创作', '视频生成'],
    requiresApiKey: true,
    apiKeyEnvVar: 'ARK_API_KEY',
  },
  'moonshot': {
    id: 'moonshot',
    name: 'Kimi 方案',
    description: '月之暗面 Kimi 官方最新模型（需配置 API Key）',
    provider: 'moonshot',
    available: true,
    models: {
      llm: DEFAULT_MODELS.moonshot.llm,
      llmDescription: 'Kimi K3 - 官方最新旗舰模型',
      image: DEFAULT_MODELS.image,
      imageDescription: '可回退扣子 Seedream 5.0 图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: '可回退扣子 Seedance 2.0 视频生成',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '可回退扣子米子配音',
    },
    features: [
      'Kimi K3 官方最新旗舰',
      '超长上下文理解',
      '中文创作能力强',
      '高性价比',
    ],
    useCase: ['剧本生成', '长文本理解', 'AI顾问'],
    requiresApiKey: true,
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
  },
  'deepseek': {
    id: 'deepseek',
    name: 'DeepSeek 方案',
    description: 'DeepSeek 官方最新模型（需配置 API Key）',
    provider: 'deepseek',
    available: true,
    models: {
      llm: DEFAULT_MODELS.deepseek.llm,
      llmDescription: 'DeepSeek V4 - 官方最新旗舰模型',
      image: DEFAULT_MODELS.image,
      imageDescription: '可回退扣子 Seedream 5.0 图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: '可回退扣子 Seedance 2.0 视频生成',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '可回退扣子米子配音',
    },
    features: [
      'DeepSeek V4 官方最新旗舰',
      'R1 深度推理模型可选',
      '推理能力业界领先',
      '极高性价比',
    ],
    useCase: ['剧本生成', '复杂推理', '逻辑分析'],
    requiresApiKey: true,
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
  },
  'wenxin': {
    id: 'wenxin',
    name: '文心方案',
    description: '百度文心一言官方最新模型（需配置 API Key）',
    provider: 'wenxin',
    available: true,
    models: {
      llm: DEFAULT_MODELS.wenxin.llm,
      llmDescription: '文心 5.0 - 百度官方最新旗舰模型',
      image: DEFAULT_MODELS.image,
      imageDescription: '可回退扣子 Seedream 5.0 图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: '可回退扣子 Seedance 2.0 视频生成',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '可回退扣子米子配音',
    },
    features: [
      '文心 5.0 官方最新旗舰',
      '中文知识理解扎实',
      '合规稳定',
      '多模态支持',
    ],
    useCase: ['剧本生成', '中文创作', 'AI顾问'],
    requiresApiKey: true,
    apiKeyEnvVar: 'WENXIN_API_KEY',
  },
  'hunyuan': {
    id: 'hunyuan',
    name: '混元方案',
    description: '腾讯混元官方最新模型（需配置 API Key）',
    provider: 'hunyuan',
    available: true,
    models: {
      llm: DEFAULT_MODELS.hunyuan.llm,
      llmDescription: '混元 TurboS - 腾讯官方最新旗舰模型',
      image: DEFAULT_MODELS.image,
      imageDescription: '可回退扣子 Seedream 5.0 图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: '可回退扣子 Seedance 2.0 视频生成',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '可回退扣子米子配音',
    },
    features: [
      '混元 TurboS 官方最新旗舰',
      '腾讯生态整合',
      '响应速度快',
      '多语言支持',
    ],
    useCase: ['剧本生成', '对话创作', 'AI顾问'],
    requiresApiKey: true,
    apiKeyEnvVar: 'HUNYUAN_API_KEY',
  },
  'custom': {
    id: 'custom',
    name: '自定义方案',
    description: '接入任意 OpenAI 兼容协议的服务（需配置端点与 API Key）',
    provider: 'custom',
    available: true,
    models: {
      llm: '',
      llmDescription: '自定义模型 - 在设置中输入模型名',
      image: DEFAULT_MODELS.image,
      imageDescription: '可回退扣子 Seedream 5.0 图片生成',
      imageSize: DEFAULT_MODELS.imageSize,
      imageSizeDescription: '2K 标清图片',
      video: DEFAULT_MODELS.video,
      videoDescription: '可回退扣子 Seedance 2.0 视频生成',
      tts: DEFAULT_MODELS.tts,
      ttsDescription: '可回退扣子米子配音',
    },
    features: [
      '任意 OpenAI 兼容协议接入',
      '支持中转/私有化部署',
      '自定义 Base URL 与模型名',
      '灵活扩展',
    ],
    useCase: ['私有化模型', '中转服务', '灵活定制'],
    requiresApiKey: true,
    apiKeyEnvVar: 'CUSTOM_API_KEY',
  },
} as const;

/**
 * 获取方案配置
 */
export function getSolutionPreset(solution: SolutionType) {
  return SOLUTION_PRESETS[solution];
}

/**
 * 获取所有可用方案
 */
export function getAvailableSolutions() {
  return Object.values(SOLUTION_PRESETS);
}

// ==================== 视频模型 Prompt 配置 ====================

/**
 * 视频模型 Prompt 偏好配置
 * 针对 Seedance 2.0 的 prompt 生成策略
 */
export const VIDEO_MODEL_PROMPT_CONFIGS = {
  'doubao-seedance-2-0-260128': {
    id: 'doubao-seedance-2-0-260128',
    name: 'Seedance 2.0 Prompt 配置',
    promptStyle: 'structured',
    features: {
      audioGeneration: true,
      firstFrameControl: true,
      lastFrameControl: true,
      dialogueInPrompt: true,
    },
    promptTemplate: {
      structure: ['style', 'camera', 'scene', 'character', 'action', 'atmosphere'],
      dialogueFormat: '某人说道："对话内容"',
      scenePreference: {
        level: 'detailed',
        includeProps: true,
        includeLighting: true,
      },
      characterPreference: {
        level: 'detailed',
        includeAppearance: true,
        includeCostume: true,
        includeExpression: true,
      },
    },
    examplePrompt: '甜宠古装仙侠，特写镜头慢推，正午九重天斩仙台，玄铁台面刻满金色符咒，20岁女弟子左手被按在台上，玄铁刀架在手腕，穿破碎的淡青色弟子服，手腕捆着缚仙索，表情错愕悲愤，眼眶泛红，日光刺眼，氛围压抑紧张',
  },
  'doubao-seedance-2-0': {
    id: 'doubao-seedance-2-0',
    name: 'Seedance 2.0 Prompt 配置',
    promptStyle: 'structured',
    features: {
      audioGeneration: true,
      firstFrameControl: true,
      lastFrameControl: true,
      dialogueInPrompt: true,
    },
    promptTemplate: {
      structure: ['style', 'camera', 'scene', 'character', 'action', 'atmosphere'],
      dialogueFormat: '某人说道："对话内容"',
      scenePreference: {
        level: 'detailed',
        includeProps: true,
        includeLighting: true,
      },
      characterPreference: {
        level: 'detailed',
        includeAppearance: true,
        includeCostume: true,
        includeExpression: true,
      },
    },
    examplePrompt: '甜宠古装仙侠，特写镜头慢推，正午九重天斩仙台，玄铁台面刻满金色符咒，20岁女弟子左手被按在台上，玄铁刀架在手腕，穿破碎的淡青色弟子服，手腕捆着缚仙索，表情错愕悲愤，眼眶泛红，日光刺眼，氛围压抑紧张',
  },
  'doubao-seedance-2-0-fast': {
    id: 'doubao-seedance-2-0-fast',
    name: 'Seedance 2.0 Fast Prompt 配置',
    promptStyle: 'structured',
    features: {
      audioGeneration: true,
      firstFrameControl: true,
      lastFrameControl: true,
      dialogueInPrompt: true,
    },
    promptTemplate: {
      structure: ['style', 'camera', 'scene', 'character', 'action', 'atmosphere'],
      dialogueFormat: '某人说道："对话内容"',
      scenePreference: {
        level: 'detailed',
        includeProps: true,
        includeLighting: true,
      },
      characterPreference: {
        level: 'detailed',
        includeAppearance: true,
        includeCostume: true,
        includeExpression: true,
      },
    },
    examplePrompt: '甜宠古装仙侠，特写镜头慢推，正午九重天斩仙台，玄铁台面刻满金色符咒，20岁女弟子左手被按在台上，玄铁刀架在手腕，穿破碎的淡青色弟子服，手腕捆着缚仙索，表情错愕悲愤，眼眶泛红，日光刺眼，氛围压抑紧张',
  },
} as const;

// ==================== SDK 配置函数 ====================

/**
 * 创建扣子 SDK 配置
 * 扣子编程环境通过转发头自动处理认证
 */
export function createSdkConfig(_request?: NextRequest): Config {
  return new Config();
}

/**
 * 从请求中提取转发头
 * 用于扣子平台 SDK 认证
 */
export function extractForwardHeaders(request: NextRequest): Record<string, string> {
  return HeaderUtils.extractForwardHeaders(request.headers);
}

/**
 * 获取默认视频模型
 */
export function getDefaultVideoModel(): string {
  return DEFAULT_MODELS.video;
}

/**
 * 获取默认 LLM 模型
 */
export function getDefaultLLMModel(): string {
  return DEFAULT_MODELS.llm;
}

/**
 * 获取默认图片模型
 */
export function getDefaultImageModel(): string {
  return DEFAULT_MODELS.image;
}

/**
 * 获取默认 TTS 语音
 */
export function getDefaultTTSSpeaker(): string {
  return DEFAULT_MODELS.tts;
}

/**
 * 获取默认图片尺寸
 */
export function getDefaultImageSize(): string {
  return DEFAULT_MODELS.imageSize;
}

// ==================== 向后兼容函数 ====================

/**
 * 获取视频模型的 Prompt 配置
 */
export function getVideoModelPromptConfig(modelId: string) {
  return VIDEO_MODEL_PROMPT_CONFIGS[modelId as keyof typeof VIDEO_MODEL_PROMPT_CONFIGS] || null;
}

/**
 * 用户配置表类型
 */
export interface UserConfig {
  id: string;
  user_id: string;
  solution?: SolutionType;  // 方案选择：standard | zhipu
  video_model?: string;
  llm_model?: string;
  image_model?: string;
  image_size?: string;
  tts_speaker?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 获取用户当前方案
 */
export function getUserSolution(config: UserConfig | null): SolutionType {
  return config?.solution || 'standard';
}

/**
 * 根据方案获取默认LLM模型
 */
export function getDefaultLLMBySolution(solution: SolutionType): string {
  const preset = SOLUTION_PRESETS[solution];
  return preset.models.llm;
}

/**
 * 根据方案获取默认视频模型
 */
export function getDefaultVideoBySolution(solution: SolutionType): string {
  const preset = SOLUTION_PRESETS[solution];
  return preset.models.video;
}

/**
 * 保存用户配置
 */
export async function saveUserConfig(
  userId: string,
  config: Partial<Omit<UserConfig, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserConfig | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('user_config')
    .upsert({
      user_id: userId,
      ...config,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[配置] 保存用户配置失败:', error);
    return null;
  }

  return data;
}

/**
 * 获取用户配置
 */
export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  // 从数据库读取用户保存的配置（未配置时回退到默认模型）
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return {
        id: 'default',
        user_id: userId,
        video_model: DEFAULT_MODELS.video,
        llm_model: DEFAULT_MODELS.llm,
        image_model: DEFAULT_MODELS.image,
        image_size: DEFAULT_MODELS.imageSize,
        tts_speaker: DEFAULT_MODELS.tts,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return {
      id: data.id,
      user_id: data.user_id,
      video_model: data.video_model || DEFAULT_MODELS.video,
      llm_model: data.llm_model || DEFAULT_MODELS.llm,
      image_model: data.image_model || DEFAULT_MODELS.image,
      image_size: data.image_size || DEFAULT_MODELS.imageSize,
      tts_speaker: data.tts_speaker || DEFAULT_MODELS.tts,
      created_at: data.created_at ?? new Date().toISOString(),
      updated_at: data.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return {
      id: 'default',
      user_id: userId,
      video_model: DEFAULT_MODELS.video,
      llm_model: DEFAULT_MODELS.llm,
      image_model: DEFAULT_MODELS.image,
      image_size: DEFAULT_MODELS.imageSize,
      tts_speaker: DEFAULT_MODELS.tts,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * 获取平台类型（向后兼容）
 */
export type PlatformType = 'coze';
export async function getPlatformType(): Promise<PlatformType> {
  return 'coze';
}

/**
 * 获取有效的 API Key（向后兼容，扣子平台无需 API Key）
 */
export async function getEffectiveApiKey(_request?: NextRequest): Promise<string> {
  return '';
}
