/**
 * 模型目录 - 模型设置页唯一数据源
 *
 * 按"模型类型 → 厂商 → 模型清单"组织，只收录经后端真实分发支持、可正常工作的模型。
 * 厂商元信息与 /api/providers/config 的 PROVIDER_META 对齐（同一个 Key 复用）。
 * 自定义厂商在四个分类下均可配置密钥/端点/模型名；其中视频自定义端点因各家协议不统一，
 * 生成暂未接入（仅保存配置），目录项与设置页均有明确提示。
 */

export type ModelType = 'llm' | 'image' | 'video' | 'tts';

export interface ModelProviderMeta {
  id: string;
  name: string;
  /** 是否需要用户配置 API Key（扣子内置无需） */
  needsKey: boolean;
  /** 支持的模型类型 */
  supports: Record<ModelType, boolean>;
  /** 厂商简介 */
  description: string;
  /** 免 Key 说明（如扣子内置） */
  builtinNote?: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
  /** custom 厂商使用：模型名由用户输入 */
  isCustomInput?: boolean;
}

export const MODEL_TYPE_META: Record<ModelType, { label: string; description: string; icon: string }> = {
  llm: { label: '大语言模型', description: '剧本生成、AI 顾问、分镜创作等文本生成', icon: 'BrainCircuit' },
  image: { label: '图文生成模型', description: '人物立绘、场景照、封面海报等图片生成', icon: 'ImageIcon' },
  video: { label: '视频生成模型', description: '分镜视频、图生视频、预告片等视频生成', icon: 'Video' },
  tts: { label: '配音语音模型', description: '角色配音、旁白解说等语音合成', icon: 'Mic' },
};

export const MODEL_PROVIDERS: ModelProviderMeta[] = [
  {
    id: 'coze',
    name: '扣子内置',
    needsKey: false,
    supports: { llm: true, image: true, video: true, tts: true },
    description: '扣子平台内置豆包全系模型，开箱即用',
    builtinNote: '平台内置，无需配置',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    needsKey: true,
    supports: { llm: true, image: false, video: false, tts: false },
    description: 'NVIDIA Nemotron 系列超大模型，高性能推理',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    needsKey: true,
    supports: { llm: true, image: true, video: true, tts: true },
    description: 'GLM 全家桶，覆盖文本/图像/视频/语音',
  },
  {
    id: 'qwen',
    name: '千问',
    needsKey: true,
    supports: { llm: true, image: true, video: true, tts: false },
    description: '阿里百炼 DashScope，通义千问与万相系列',
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    needsKey: true,
    supports: { llm: true, image: true, video: false, tts: false },
    description: '字节跳动方舟平台，豆包系列 OpenAI 兼容接口',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    needsKey: true,
    supports: { llm: true, image: false, video: false, tts: false },
    description: 'MiniMax 大模型开放平台',
  },
  {
    id: 'moonshot',
    name: '月之暗面',
    needsKey: true,
    supports: { llm: true, image: false, video: false, tts: false },
    description: 'Kimi 系列长文本模型',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    needsKey: true,
    supports: { llm: true, image: false, video: false, tts: false },
    description: 'DeepSeek V4 / R2 推理系列',
  },
  {
    id: 'wenxin',
    name: '百度文心',
    needsKey: true,
    supports: { llm: true, image: false, video: false, tts: false },
    description: '文心大模型 5.0 系列',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    needsKey: true,
    supports: { llm: true, image: false, video: false, tts: false },
    description: '混元 TurboS 系列',
  },
  {
    id: 'custom',
    name: '自定义',
    needsKey: true,
    supports: { llm: true, image: true, video: true, tts: true },
    description: '任意 OpenAI 兼容端点，每个分类均可配置协议地址与模型名',
  },
];

export const MODEL_CATALOG: Record<ModelType, Record<string, CatalogModel[]>> = {
  llm: {
    coze: [
      { id: 'doubao-seed-2-0-pro-260215', name: 'Doubao Seed 2.0 Pro', description: '豆包旗舰全能模型，复杂推理、长链路 Agent 与结构化生成', recommended: true },
      { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', description: '高性能与成本兼顾的均衡模型，日常创作首选' },
      { id: 'doubao-seed-2-0-mini-260215', name: 'Doubao Seed 2.0 Mini', description: '低时延高并发，256K 上下文，批量处理场景' },
    ],
    zhipu: [
      { id: 'glm-5.3', name: 'GLM-5.3', description: '智谱新一代旗舰，1M 上下文，面向 Agentic Engineering', recommended: true },
      { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', description: '高性价比多模态模型，支持图片/视频/文件输入' },
      { id: 'glm-4.6', name: 'GLM-4.6', description: '上一代旗舰基座，编码与工具调用表现稳定' },
      { id: 'glm-4.6-flash', name: 'GLM-4.6-Flash', description: '免费额度充足，适合轻量对话与批量任务' },
    ],
    qwen: [
      { id: 'qwen3.8-max', name: 'Qwen3.8 Max', description: '千问旗舰，2.4 万亿参数多模态 MoE，百万上下文', recommended: true },
      { id: 'qwen3.8-plus', name: 'Qwen3.8 Plus', description: '均衡版本，剧本生成与内容创作性价比之选' },
      { id: 'qwen3.8-flash', name: 'Qwen3.8 Flash', description: '极速响应版本，适合高频短文本生成' },
      { id: 'qwen3.8-mini', name: 'Qwen3.8 Mini', description: '轻量模型，成本敏感场景' },
    ],
    volcengine: [
      { id: 'doubao-seed-2-0-pro-260215', name: 'Doubao Seed 2.0 Pro', description: '火山方舟直连的豆包旗舰模型', recommended: true },
      { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', description: '火山方舟直连的豆包均衡模型' },
      { id: 'doubao-1-8-thinking', name: 'Doubao 1.8 Thinking', description: '深度推理模型，适合复杂剧本逻辑与分镜规划' },
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32K', description: '经典 Pro 版本，32K 上下文稳定输出' },
    ],
    minimax: [
      { id: 'MiniMax-M3', name: 'MiniMax M3', description: '最新旗舰，Agent 推理、工具调用与百万级长上下文', recommended: true },
      { id: 'MiniMax-M2.1', name: 'MiniMax M2.1', description: '上一代旗舰，编码与推理能力均衡' },
      { id: 'MiniMax-Text-01', name: 'MiniMax Text-01', description: '经典文本模型，稳定可靠' },
    ],
    moonshot: [
      { id: 'kimi-k3', name: 'Kimi K3', description: '月之暗面最新旗舰，长文本创作与推理', recommended: true },
      { id: 'kimi-k3-mini', name: 'Kimi K3 Mini', description: '轻量版，响应更快成本更低' },
      { id: 'kimi-k2-0905-preview', name: 'Kimi K2', description: 'K2 稳定版，长上下文理解出色' },
    ],
    deepseek: [
      { id: 'deepseek-v4', name: 'DeepSeek V4', description: '通用旗舰，推理与创作均衡', recommended: true },
      { id: 'deepseek-r2', name: 'DeepSeek R2', description: '深度推理模型，复杂剧本逻辑与世界观构建' },
      { id: 'deepseek-v3.2-exp', name: 'DeepSeek V3.2 Exp', description: '实验版本，抢先体验最新能力' },
    ],
    wenxin: [
      { id: 'ernie-5.0', name: '文心 5.0', description: '百度文心最新旗舰，中文创作表现优秀', recommended: true },
      { id: 'ernie-4.5-turbo', name: '文心 4.5 Turbo', description: '高性价比版本，响应更快' },
      { id: 'ernie-4.5', name: '文心 4.5', description: '标准版，多模态理解与创作' },
    ],
    hunyuan: [
      { id: 'hunyuan-turbos', name: '混元 TurboS', description: '腾讯混元旗舰快思考模型', recommended: true },
      { id: 'hunyuan-t1', name: '混元 T1', description: '深度推理模型，长思考链' },
      { id: 'hunyuan-turbos-long', name: '混元 TurboS 长文本', description: '长文本优化版本，适合超长剧本' },
      { id: 'hunyuan-lite', name: '混元 Lite', description: '轻量免费版本' },
    ],
    custom: [
      { id: '', name: '自定义模型', description: '输入你的 OpenAI 兼容端点支持的模型名', isCustomInput: true },
    ],
    nvidia: [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', description: 'NVIDIA 旗舰超大模型，550B 参数，极致推理与创作能力', recommended: true },
      { id: 'nvidia/nemotron-3-ultra-550b', name: 'Nemotron 3 Ultra 550B (标准)', description: 'NVIDIA 旗舰模型标准版，平衡性能与速度' },
    ],
  },
  image: {
    coze: [
      { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0', description: '最新旗舰文生图，高精度位置与元素控制，2K/4K', recommended: true },
      { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5', description: '成熟稳定的高画质模型，通用场景表现优秀' },
    ],
    zhipu: [
      { id: 'glm-image', name: 'GLM-Image', description: '汉字渲染出色，文生图与图生图', recommended: true },
      { id: 'cogview-4-250304', name: 'CogView-4', description: '智谱经典文生图模型，多尺寸灵活输出' },
    ],
    qwen: [
      { id: 'wan2.7-image-pro', name: '万相 2.7 Pro', description: '通义万相文生图旗舰，构图与细节增强', recommended: true },
      { id: 'wan2.7-image', name: '万相 2.7', description: '标准版文生图，性价比高' },
      { id: 'wan2.6-image', name: '万相 2.6', description: '上一代文生图模型' },
    ],
    volcengine: [
      { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0（方舟）', description: '火山方舟直连的 Seedream 旗舰', recommended: true },
      { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5（方舟）', description: '火山方舟直连的稳定版' },
    ],
    custom: [
      { id: '', name: '自定义模型', description: '输入你的端点支持的图片模型名（OpenAI 兼容 /images/generations）', isCustomInput: true },
    ],
  },
  video: {
    coze: [
      { id: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0', description: '文生/图生视频，最长 15 秒，1080P，可生成音频', recommended: true },
      { id: 'doubao-seedance-1-5-pro-250528', name: 'Seedance 1.5 Pro', description: '上一代 Pro，5-12 秒镜头，稳定输出' },
      { id: 'doubao-seedance-1-5-lite-250528', name: 'Seedance 1.5 Lite', description: '轻量版，速度快成本低' },
      { id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro', description: '经典版本，多比例支持' },
    ],
    zhipu: [
      { id: 'cogvideox-3', name: 'CogVideoX-3', description: '首尾帧控制，画面稳定清晰', recommended: true },
    ],
    qwen: [
      { id: 'wan3.0-i2v', name: '万相 3.0 图生视频', description: '通义万相最新图生视频旗舰', recommended: true },
      { id: 'wan2.7-t2v', name: '万相 2.7 文生视频', description: '文生视频模型' },
      { id: 'wan2.6-i2v-flash', name: '万相 2.6 图生视频 Flash', description: '极速图生视频，适合快速预览' },
    ],
    custom: [
      { id: '', name: '自定义模型', description: '输入你的端点支持的视频模型名（自定义端点视频生成暂未接入，仅保存配置）', isCustomInput: true },
    ],
  },
  tts: {
    coze: [
      { id: 'zh_female_mizai_saturn_bigtts', name: '米子（女）', description: '专业短剧配音女声，情感丰富', recommended: true },
      { id: 'zh_female_tianwei_saturn_bigtts', name: '天薇（女）', description: '温柔知性女声' },
      { id: 'zh_male_yangxuan_saturn_bigtts', name: '云希（男）', description: '深沉磁性男声' },
      { id: 'zh_male_yufan_saturn_bigtts', name: '羽凡（男）', description: '活力阳光男声' },
      { id: 'zh_female_xiaohe_uranus_bigtts', name: '小荷（女）', description: '通用旁白解说女声' },
      { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi（女）', description: '中英双语女声' },
      { id: 'zh_child_huoli_moon_bigtts', name: '活力童声', description: '活泼童声，适合儿童角色' },
      { id: 'zh_child_keai_moon_bigtts', name: '可爱童声', description: '软萌童声，适合萌娃角色' },
    ],
    zhipu: [
      { id: 'glm-tts', name: 'GLM-TTS', description: '智谱语音大模型，情绪语调智能预判', recommended: true },
    ],
    custom: [
      { id: '', name: '自定义音色', description: '输入端点支持的音色 ID（OpenAI 兼容 /audio/speech 的 voice 参数）', isCustomInput: true },
    ],
  },
};

/** 获取某类型支持的厂商列表 */
export function getProvidersForType(type: ModelType): ModelProviderMeta[] {
  return MODEL_PROVIDERS.filter(p => p.supports[type]);
}

/** 获取某厂商某类型的模型清单 */
export function getModelsForType(type: ModelType, providerId: string): CatalogModel[] {
  return MODEL_CATALOG[type][providerId] || [];
}

/**
 * 按模型名兜底识别厂商（兼容旧配置：user_config 未写 provider 字段时）
 */
export function detectProviderFromModel(type: ModelType, model: string): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (type === 'llm') {
    if (m.startsWith('nvidia/') || m.includes('nemotron')) return 'nvidia';
    if (m.startsWith('glm')) return 'zhipu';
    if (m.startsWith('qwen')) return 'qwen';
    if (m.startsWith('minimax') || m.startsWith('abab')) return 'minimax';
    if (m.startsWith('kimi') || m.startsWith('moonshot')) return 'moonshot';
    if (m.startsWith('deepseek')) return 'deepseek';
    if (m.startsWith('ernie')) return 'wenxin';
    if (m.startsWith('hunyuan')) return 'hunyuan';
    if (m.startsWith('doubao')) return 'coze';
    return null;
  }
  if (type === 'image') {
    if (m.startsWith('glm-image') || m.startsWith('cogview')) return 'zhipu';
    // 万相系列（wan2.x-image / wanx2.x-t2i 等）及 qwen-image，含日期后缀变体
    if (m.startsWith('wan') || m.startsWith('qwen-image')) return 'qwen';
    if (m.startsWith('doubao-seedream')) return 'coze';
    return null;
  }
  if (type === 'video') {
    if (m.startsWith('cogvideox')) return 'zhipu';
    if (m.startsWith('wan') && (m.includes('i2v') || m.includes('t2v') || m.includes('video'))) return 'qwen';
    if (m.startsWith('doubao-seedance')) return 'coze';
    return null;
  }
  if (type === 'tts') {
    if (m.startsWith('glm-tts')) return 'zhipu';
    if (m.startsWith('cosyvoice') || m.startsWith('qwen3-tts')) return 'qwen';
    return 'coze';
  }
  return null;
}
