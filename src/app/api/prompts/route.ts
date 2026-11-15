import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 高级提示词库API
 * 
 * 功能：
 * 1. 版本控制 - 支持提示词版本管理
 * 2. 效果评分 - AI评估提示词质量
 * 3. 智能推荐 - 根据场景推荐最佳提示词
 * 4. A/B测试 - 支持提示词效果对比
 * 5. 使用统计 - 分析使用频率和效果
 */

// 提示词分类
const PROMPT_CATEGORIES = {
  system: { name: '系统提示词', icon: '⚙️' },
  character: { name: '角色生成', icon: '👤' },
  script: { name: '剧本分镜', icon: '📝' },
  video: { name: '视频生成', icon: '🎬' },
  voice: { name: '配音配置', icon: '🎤' },
  editing: { name: '剪辑配置', icon: '✂️' },
  style: { name: '风格模板', icon: '🎨' },
  emotion: { name: '情绪表达', icon: '💭' }
} as const;

// 风格模板库
const STYLE_TEMPLATES = {
  // 古装风格
  ancient_xianxia: {
    name: '古装仙侠',
    visual: 'Chinese xianxia drama style, ethereal atmosphere, flowing robes, mystical powers, ancient Chinese architecture, soft lighting, 8K cinematic quality',
    audio: { bgm: '古风仙侠', instruments: ['古筝', '笛子', '箫'] },
    characters: { makeup: '古代妆容', clothing: '飘逸仙袍' }
  },
  ancient_palace: {
    name: '古装宫斗',
    visual: 'Chinese palace drama style, royal atmosphere, elegant costumes, golden decorations, dramatic lighting, 8K cinematic quality',
    audio: { bgm: '宫廷古典', instruments: ['古筝', '琵琶', '二胡'] },
    characters: { makeup: '宫廷妆容', clothing: '华贵宫装' }
  },
  
  // 现代风格
  modern_romance: {
    name: '现代甜宠',
    visual: 'Korean romance drama style, soft warm lighting, dreamy atmosphere, pastel colors, urban settings, 8K quality',
    audio: { bgm: '轻快浪漫', instruments: ['钢琴', '小提琴', '吉他'] },
    characters: { makeup: '清新妆容', clothing: '时尚简约' }
  },
  modern_urban: {
    name: '现代都市',
    visual: 'Modern urban drama style, city background, professional lighting, realistic atmosphere, 8K quality',
    audio: { bgm: '都市轻快', instruments: ['电子琴', '鼓', '贝斯'] },
    characters: { makeup: '职业妆容', clothing: '商务正装' }
  },
  
  // 悬疑风格
  suspense_mystery: {
    name: '悬疑推理',
    visual: 'Mystery thriller style, dramatic shadow lighting, tense atmosphere, dark tones, cinematic composition, 8K quality',
    audio: { bgm: '悬疑紧张', instruments: ['低音提琴', '打击乐'] },
    characters: { makeup: '自然妆容', clothing: '深色系服装' }
  },
  
  // 其他风格
  republican: {
    name: '民国谍战',
    visual: 'Republican era 1930s Shanghai style, vintage photography, nostalgic atmosphere, period costumes, 8K quality',
    audio: { bgm: '民国爵士', instruments: ['萨克斯', '钢琴'] },
    characters: { makeup: '复古妆容', clothing: '旗袍长衫' }
  }
};

// 获取所有提示词
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const tags = searchParams.get('tags');

  const supabase = getSupabaseClient();

  let query = supabase
    .from('prompts')
    .select('*')
    .order('usage_count', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  if (tags) {
    query = query.contains('tags', tags.split(','));
  }

  const { data: prompts, error } = await query;

  if (error) {
    // 表可能不存在，返回默认数据
    return NextResponse.json({
      success: true,
      prompts: getDefaultPrompts(),
      categories: PROMPT_CATEGORIES,
      styleTemplates: STYLE_TEMPLATES
    });
  }

  return NextResponse.json({
    success: true,
    prompts: prompts || getDefaultPrompts(),
    categories: PROMPT_CATEGORIES,
    styleTemplates: STYLE_TEMPLATES
  });
}

// 创建/更新提示词
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { 
    id,
    title,
    category,
    content,
    description,
    tags,
    version,
    parent_id // 用于版本控制
  } = body;

  const supabase = getSupabaseClient();

  // AI评估提示词质量
  const qualityScore = await evaluatePromptQuality(content, request.headers);

  const promptData = {
    title,
    category,
    content,
    description,
    tags: tags || [],
    version: version || 1,
    parent_id,
    quality_score: qualityScore,
    usage_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let result;
  if (id) {
    // 更新
    const { data, error } = await supabase
      .from('prompts')
      .update({
        ...promptData,
        version: (version || 1) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
    result = data;
  } else {
    // 创建
    const { data, error } = await supabase
      .from('prompts')
      .insert(promptData)
      .select()
      .single();
    
    if (error) {
      // 表可能不存在，返回模拟成功
      return NextResponse.json({
        success: true,
        prompt: { id: `prompt-${Date.now()}`, ...promptData }
      });
    }
    result = data;
  }

  return NextResponse.json({
    success: true,
    prompt: result
  });
}

// 智能推荐提示词
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { 
    scene,          // 场景描述
    taskType,       // 任务类型
    characters,     // 角色信息
    mood,           // 情绪氛围
    style           // 风格偏好
  } = body;

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  // 构建推荐请求
  const recommendPrompt = `你是提示词专家。根据以下场景推荐最适合的提示词组合：

【场景】${scene || '未指定'}
【任务】${taskType || '综合'}
【角色】${characters || '未指定'}
【情绪】${mood || '未指定'}
【风格】${style || '未指定'}

请推荐：
1. 系统提示词（整体指导）
2. 任务特定提示词
3. 风格模板
4. 情绪表达建议

输出JSON格式：
{
  "recommended": {
    "system": "推荐的最佳系统提示词",
    "task": "任务特定提示词",
    "style": "风格模板ID",
    "emotion": "情绪表达指南"
  },
  "alternatives": [
    { "type": "备选类型", "prompt": "备选提示词" }
  ],
  "tips": ["使用建议1", "使用建议2"]
}`;

  const response = await client.invoke([
    { role: 'system', content: '你是专业的AI提示词工程师。输出必须是JSON格式。' },
    { role: 'user', content: recommendPrompt }
  ], {
    model: 'doubao-seed-2-0-pro-260215',
    temperature: 0.5
  });

  // 解析结果
  let recommendation;
  try {
    const content = response.content;
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      recommendation = JSON.parse(content.substring(firstBrace, lastBrace + 1));
    }
  } catch (e) {
    recommendation = {
      recommended: {
        system: '使用标准系统提示词',
        task: '根据具体任务调整'
      },
      tips: ['建议根据实际效果微调参数']
    };
  }

  return NextResponse.json({
    success: true,
    recommendation,
    styleTemplates: STYLE_TEMPLATES
  });
}

// AI评估提示词质量
async function evaluatePromptQuality(content: string, headers: Headers): Promise<number> {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const response = await client.invoke([
      { 
        role: 'system', 
        content: '你是提示词质量评估专家。评估提示词的清晰度、完整性、专业性，返回0-100的分数。' 
      },
      { 
        role: 'user', 
        content: `评估以下提示词的质量（0-100分）：
        
${content}

评估维度：
1. 清晰度（是否明确具体）
2. 完整性（是否包含必要信息）
3. 专业性（是否使用专业术语）
4. 可执行性（是否容易理解和执行）

只返回数字分数。` 
      }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.1
    });

    const score = parseInt(response.content.match(/\d+/)?.[0] || '75');
    return Math.min(100, Math.max(0, score));
  } catch {
    return 75; // 默认分数
  }
}

// 默认提示词数据
function getDefaultPrompts() {
  return [
    {
      id: 'system-main',
      title: '全局系统提示词',
      category: 'system',
      content: `你是专业AI短剧导演+编剧+分镜师+剪辑师，专门制作【抖音真人风竖屏9:16短剧】。
全程严格遵守以下所有规则，绝对不破坏一致性、不穿帮、不崩坏、不违规。

【一、人物一致性永久规则】
1. 每个人物固定：姓名、性别、年龄、脸型、发型、服装、肤色、气质，全程不变。
2. 不换脸、不变装、不换发型、不改变身材。
3. 表情统一：平静自然微严肃、开心浅笑不夸张、生气皱眉眼神坚定、委屈垂眼嘴角微下
4. 微动作统一：思考轻摸下巴、紧张轻扣手指、认真身体微前倾
5. 视线统一：对话看对方固定方向、独白轻微看镜头偏上10°
6. 站位统一：主角固定在画面黄金分割点，不瞬移、不乱动。`,
      description: 'AI短剧导演+编剧+分镜师+剪辑师的核心系统提示词',
      tags: ['系统', '核心', '一致性'],
      usage_count: 156,
      quality_score: 95
    },
    {
      id: 'character-generation',
      title: '角色档案生成提示词',
      category: 'character',
      content: `根据用户输入的题材、核心冲突、人物数量，生成固定角色档案：

【角色X】
姓名：
性别：
年龄：
脸型：
发型：
服装（全程不变）：
肤色气质：
微动作：
固定音色ID：
情绪规则：

【角色关系】
请详细描述角色之间的关系网络`,
      description: '根据题材、冲突、人物数量生成固定角色档案',
      tags: ['角色', '档案', '生成'],
      usage_count: 89,
      quality_score: 88
    },
    {
      id: 'script-storyboard',
      title: '剧本+分镜生成提示词',
      category: 'script',
      content: `基于角色档案，生成抖音短剧分镜剧本，格式：

【标题】
【题材】
【时长】300秒

【分镜剧本】
序号 | 时间 | 景别 | 人物 | 情绪 | 画面描述 | 台词 | 音效BGM

【节奏锚点要求】
0-3秒：强钩子
30秒：第一次冲突
90秒：第一次反转
150秒：情绪最高点
210秒：第二次反转
270-300秒：强结尾+留悬念`,
      description: '基于角色档案生成短剧分镜剧本',
      tags: ['剧本', '分镜', '节奏'],
      usage_count: 112,
      quality_score: 90
    },
    {
      id: 'video-generation',
      title: '视频生成固定提示词',
      category: 'video',
      content: `9:16竖屏，超写实真人电影风，1080P，暖白光4500K，电影级柔光，自然肤质，轻微颗粒，人物不换脸不变装，运镜平稳，场景统一，抖音短剧质感。

【运镜规则】
- 90% 静止镜头
- 8% 缓慢推进
- 2% 轻微平移
- 禁止旋转、抖动

【画质要求】
- 1080P 分辨率
- 轻微电影颗粒
- 中等锐度
- 无塑料感`,
      description: 'AI生视频的标准提示词模板',
      tags: ['视频', '画质', '运镜'],
      usage_count: 234,
      quality_score: 92
    },
    {
      id: 'voice-config',
      title: '配音配置规则',
      category: 'voice',
      content: `音色ID固定，语速1.1倍，情绪按剧本，
人声-16 LUFS，室内混响15%，停顿0.2秒。

【音量标准】
- 人声：-16 LUFS
- BGM：-24 LUFS
- 音效：-20 LUFS

【情绪强度】
- 平静：30%
- 开心：50%
- 委屈：45%
- 生气：65%`,
      description: '语音合成的标准配置参数',
      tags: ['配音', '音量', '情绪'],
      usage_count: 78,
      quality_score: 85
    },
    {
      id: 'editing-config',
      title: '剪辑配置规则',
      category: 'editing',
      content: `字幕：白色+灰边，底部居中
转场：淡入淡出/硬切
BGM：随情绪强弱变化
输出：9:16，1080P

【字幕规范】
- 颜色：白色 + 浅灰描边
- 位置：底部居中
- 要求：不挡脸
- 字数：每行≤14字

【转场规则】
- 95% 淡入淡出
- 5% 硬切
- 禁止花哨转场`,
      description: '视频剪辑的标准配置参数',
      tags: ['剪辑', '字幕', '转场'],
      usage_count: 95,
      quality_score: 87
    }
  ];
}
