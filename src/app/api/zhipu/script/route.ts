import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { LLM_MODELS, SOLUTION_PRESETS, SolutionType, getDefaultLLMBySolution } from '@/lib/config';
import {
  SHOT_DURATION_RULES,
  STAGE_RATIOS,
  STORYBOARD_COUNT_RULES,
  PRESET_STYLES,
  PRESET_SCENES,
  buildUnifiedPrompt,
  type VisualStyle,
  type CharacterLock,
  type SceneDefinition,
  type KeyframeGuide,
} from '@/lib/script-types';

/**
 * 智谱模型剧本生成 API
 * 支持使用智谱 GLM-4 系列模型生成剧本
 * 
 * 核心规则：
 * - 总时长：300秒
 * - 每镜固定：12秒
 * - 最少分镜：30个
 * - 统一性控制：风格、主体、场景
 */

// 根据题材匹配视觉风格
function matchVisualStyle(genre: string): VisualStyle {
  // 按优先级顺序匹配（部分匹配）
  if (genre.includes('古装') || genre.includes('古风')) {
    return PRESET_STYLES['ancient_beauty'];
  }
  if (genre.includes('仙侠') || genre.includes('玄幻')) {
    return PRESET_STYLES['fantasy_fairy'];
  }
  if (genre.includes('悬疑') || genre.includes('推理')) {
    return PRESET_STYLES['suspense_dark'];
  }
  if (genre.includes('甜宠') || genre.includes('恋爱') || genre.includes('言情')) {
    return PRESET_STYLES['sweet_romance'];
  }
  if (genre.includes('都市') || genre.includes('现代')) {
    return PRESET_STYLES['urban_modern'];
  }
  if (genre.includes('职场') || genre.includes('商战')) {
    return PRESET_STYLES['workplace_elite'];
  }
  // 默认：古风唯美
  return PRESET_STYLES['ancient_beauty'];
}

// 根据题材匹配场景
function matchScenes(genre: string): SceneDefinition[] {
  const genreSceneMap: Record<string, string[]> = {
    '都市': ['luxury_living_room', 'ceo_office', 'coffee_shop', 'city_street'],
    '现代': ['luxury_living_room', 'ceo_office', 'coffee_shop', 'bedroom'],
    '古装': ['ancient_palace', 'ancient_garden', 'ancient_chamber'],
    '悬疑': ['ceo_office', 'luxury_living_room', 'city_street', 'dark_room'],
    '甜宠': ['coffee_shop', 'bedroom', 'luxury_living_room'],
    '职场': ['ceo_office', 'meeting_room', 'coffee_shop'],
  };
  
  const sceneKeys = genreSceneMap[genre] || ['luxury_living_room', 'ceo_office', 'coffee_shop', 'bedroom'];
  return sceneKeys.map(key => PRESET_SCENES[key]).filter(Boolean);
}

// 根据分镜序号和总数获取阶段
function getStageBySeq(seq: number, total: number): string {
  let cumulative = 0;
  for (const [stage, config] of Object.entries(STAGE_RATIOS)) {
    cumulative += config.ratio;
    if (seq <= Math.ceil(total * cumulative)) {
      return stage;
    }
  }
  return '收尾';
}

// 根据阶段获取镜头类型
function getShotTypeByStage(stage: string, seq: number): string {
  const stageShots: Record<string, string[]> = {
    '钩子': ['特写', '近景', '快切'],
    '冲突': ['中景', '近景', '跟拍'],
    '升温': ['中景', '近景', '特写'],
    '高潮': ['快切', '特写', '近景'],
    '反转': ['特写', '近景', '慢推'],
    '收尾': ['中景', '慢推', '全景'],
  };
  
  const shots = stageShots[stage] || ['中景'];
  return shots[seq % shots.length];
}

// 根据阶段获取紧张度
function getTensionByStage(stage: string): number {
  const tensionMap: Record<string, number> = {
    '钩子': 9,
    '冲突': 6,
    '升温': 7,
    '高潮': 10,
    '反转': 8,
    '收尾': 10,
  };
  return tensionMap[stage] || 7;
}

// 根据镜头类型获取时长
function getDurationByShot(shotType: string): number {
  const rules = SHOT_DURATION_RULES.shotTypeDurations[shotType as keyof typeof SHOT_DURATION_RULES.shotTypeDurations];
  if (rules) {
    return rules.default;
  }
  return SHOT_DURATION_RULES.defaultDuration;
}

// 生成系统提示词
function generateSystemPrompt(
  total: number,
  style: VisualStyle,
  scenes: SceneDefinition[]
): string {
  const totalDuration = 300;
  const sceneDescriptions = scenes.map(s => `${s.name}(${s.description})`).join('、');
  
  return `你是专业的抖音短剧编剧，必须严格按规则生成剧本。

【核心规则 - 必须遵守】
- 分镜数量：恰好${total}个，不能多也不能少
- 总时长：${totalDuration}秒
- 每镜时长：固定12秒
- 开篇钩子、核心分镜、结尾悬念：统一12秒

【统一性控制 - 三维度】
1. 风格：${style.description}，${style.lighting}，${style.colorTone}色调
2. 场景：仅使用以下场景：${sceneDescriptions}
3. 主体：角色外观必须保持一致，服装发型不变

【节奏分配】
- 钩子(8%)：快速抓住观众，特写/快切
- 冲突(17%)：引入矛盾，中景/近景
- 升温(25%)：矛盾升级，对话为主
- 高潮(25%)：冲突爆发，快切为主
- 反转(15%)：意外转折，特写/慢推
- 收尾(10%)：悬念结尾，中景/慢推

【关键帧规则】
- 每个场景首次出现必须是关键帧
- 情绪高峰镜头标记为关键帧
- 关键帧提示词需要更详细的视觉描述

【对话要求】
- 对话精简有力，每句不超过15字
- 口语化，符合角色性格
- 重要对话放前面，后面加快节奏
- 角色说话要快一点，不要拖沓

【输出JSON格式 - 顶配爆款版】
{
  "title": "剧名",
  "summary": "4-6字总结",
  "hook": {
    "scene": "大靖皇帝寝宫深夜，烛火昏暗摇曳，奏折狼藉满地，大殿压抑肃杀",
    "cameraMovement": "电影级特写运镜，侧逆光切割面部，强明暗对比，压迫感拉满",
    "action": "皇帝萧衍身着明黄龙袍，暴怒嘶吼着狠狠砸向传国玉玺，衣袖带风",
    "closeup": "碎裂玉玺碎片特写，萧衍眼神阴鸷狠戾，面部狰狞情绪炸裂",
    "style": "影视化写实，高质感古风宫廷，暗黑压抑，史诗氛围感",
    "bgmAtmosphere": "低沉弦乐+急促鼓点，紧张悬疑，帝王暴怒肃杀",
    "duration": 15,
    "shotType": "特写",
    "mood": "压抑肃杀",
    "characters": ["萧衍", "掌事太监"],
    "dialogues": [
      {"speaker": "萧衍", "content": "玉玺丢了！", "emotion": "暴怒"},
      {"speaker": "掌事太监", "content": "北境军反了！", "emotion": "惊恐"},
      {"speaker": "萧衍", "content": "沈砚，你好大的胆子！", "emotion": "愤怒嘶吼"},
      {"speaker": "萧衍", "content": "杀无赦！", "emotion": "暴怒"}
    ],
    "aspectRatio": "9:16"
  },
  "cliffhanger": {
    "scene": "悬崖边狂风呼啸，暴雨如注，生死一线的紧张时刻",
    "cameraMovement": "电影级俯拍特写，从高空急速推近，画面剧烈晃动",
    "action": "女主被逼至悬崖边缘，脚下碎石滚落，她回头望向远方",
    "closeup": "女主眼角泪光与雨水交织特写，眼神从绝望转为决绝",
    "style": "影视化写实，高质感古装仙侠，暴风雨夜景，史诗级画面张力",
    "bgmAtmosphere": "激昂交响乐+悲壮弦乐，心跳加速，命运抉择的紧张氛围",
    "duration": 15,
    "shotType": "特写",
    "mood": "悬念",
    "characters": ["女主", "追兵"],
    "dialogues": [
      {"speaker": "女主", "content": "既然如此...", "emotion": "绝望"},
      {"speaker": "追兵", "content": "抓住她！", "emotion": "凶狠"},
      {"speaker": "女主", "content": "那就一起死吧！", "emotion": "决绝"},
      {"speaker": "旁白", "content": "她的命运，下集揭晓...", "emotion": "悬念"}
    ],
    "aspectRatio": "9:16"
  },
  "storyboards": [...]
}

【开篇钩子(hook)内容规则 - 必须严格遵循】
hook是独立于storyboards的开场钩子，内容必须：
1. 黄金3秒法则：开场画面必须在3秒内抓住观众眼球
2. 视觉冲击：使用特写或大特写，突出关键道具、伤口、眼泪、眼神等
3. 悬念开场：从故事中间切入(in media res)，直接展示冲突或危机时刻
4. 禁止平铺直叙：不要从"平静的早晨"开始，要从"刀架在脖子上"开始
5. 固定时长：12秒，如果有一句台词必须在15字以内
6. 【⚠️避免重复】这是独立镜头，展示最震撼的瞬间，不要与storyboards[0]内容相同
7. 示例场景：主角倒在血泊中、被逼到悬崖边、发现惊天秘密、婚礼现场被闯入等

【结尾悬念(cliffhanger)内容规则 - 必须严格遵循】
cliffhanger是独立于storyboards的结尾悬念，内容必须：
1. 悬念制造：留下一个让观众迫不及待看下一集的悬念
2. 伏笔埋设：暗示下一集会发生的关键事件
3. 情绪高潮：在情绪最紧张时戛然而止
4. 画面定格：在关键画面（如转身、发现、决定）处定格
5. 固定时长：12秒，如果有一句台词必须在15字以内
6. 【⚠️避免重复】这是独立镜头，展示全新的悬念转折，不要与最后一个storyboard内容相同
7. 示例场景：发现背叛、隐藏身份曝光、生死未卜、关键选择、神秘人物出现等

【hook和cliffhanger对象格式规则】
- hook必须包含：visualPrompt、duration(数字)、shotType、cameraMovement、mood、scene、characters、dialogue(可选)
- cliffhanger必须包含：visualPrompt、duration(数字)、shotType、cameraMovement、mood、scene、characters、dialogue(可选)
- dialogue格式：{"speaker":"角色名","content":"台词(≤15字)","emotion":"情绪","speechRate":"快/慢/正常"}

【重要规则 - duration必须是数字】
- duration字段必须是阿拉伯数字，如8、6、10，禁止使用中文数字如"八"、"六"

【⚠️ 禁止输出格式 - 必须遵守】
- 禁止在字段中输出文件路径，如 "File: [assets/image.png]"
- 禁止在字段中输出URL链接，如 "URL: [https://...]"
- 禁止在字段中输出任何Markdown语法，如 \`\`\`、**、[]等
- 所有字段必须是纯文本描述，如场景描述应该是"大靖皇帝寝宫深夜"，而不是文件路径或链接`;
}

// 生成用户提示词
function generateUserPrompt(
  genre: string,
  conflict: string,
  characters: CharacterLock[],
  total: number
): string {
  const charInfo = characters.map(c => 
    `${c.name}(${c.gender === 'male' ? '男' : '女'}，${c.age}岁，${c.appearance.clothing}，${c.personality.join('、')})`
  ).join('；');
  
  return `题材：${genre}
核心冲突：${conflict}
角色：${charInfo}

【必须】恰好生成${total}个分镜，每镜固定12秒。
【必须】对话精简，每句不超过15字。
【必须】角色说话要快，不要拖沓。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { genre, conflict, characters, model, solution, provider, style: customStyle, scenes: customScenes } = body;

    if (!genre || !conflict || !characters || characters.length === 0) {
      return NextResponse.json(
        { error: '请先生成角色档案' },
        { status: 400 }
      );
    }

    // 确定方案
    const solutionType: SolutionType = solution || 'zhipu';
    const solutionPreset = SOLUTION_PRESETS[solutionType];

    // 确定模型
    const modelId = model || getDefaultLLMBySolution(solutionType);
    const modelConfig = LLM_MODELS[modelId as keyof typeof LLM_MODELS];

    // 确定提供商
    const providerType = provider || modelConfig?.provider || solutionPreset.provider;

    console.log(`[剧本生成-智谱] 方案: ${solutionType}, 提供商: ${providerType}, 模型: ${modelId}`);

    // 1. 匹配视觉风格
    const style = customStyle || matchVisualStyle(genre);
    console.log(`[剧本生成-智谱] 风格: ${style.type}`);

    // 2. 匹配场景
    const scenes = customScenes || matchScenes(genre);
    console.log(`[剧本生成-智谱] 场景: ${scenes.map((s: SceneDefinition) => s.name).join(', ')}`);

    // 3. 构建角色锁定
    const characterLocks: CharacterLock[] = characters.map((char: {
      name: string;
      gender: string;
      age: number;
      clothing: string;
      temperament: string;
      hairstyle?: string;
      hairColor?: string;
      accessories?: string[];
      referenceImageUrl?: string;
    }) => ({
      characterId: `char_${char.name}`,
      name: char.name,
      gender: char.gender,
      age: char.age,
      appearance: {
        hairstyle: char.hairstyle || '短发',
        hairColor: char.hairColor || '黑色',
        clothing: char.clothing,
        accessories: char.accessories || [],
        makeup: char.gender === 'female' ? '精致妆容' : '清爽',
      },
      personality: [char.temperament],
      keyFeatures: `${char.temperament}气质`,
      referenceImageUrl: char.referenceImageUrl,
    }));

    // 4. 计算分镜数量
    const storyboardCount = Math.max(
      STORYBOARD_COUNT_RULES.minCount,
      Math.min(STORYBOARD_COUNT_RULES.maxCount, STORYBOARD_COUNT_RULES.calculateCount(135))
    );
    console.log(`[剧本生成-智谱] 分镜数量: ${storyboardCount}`);

    // 5. 生成提示词
    const systemPrompt = generateSystemPrompt(storyboardCount, style, scenes);
    const userPrompt = generateUserPrompt(genre, conflict, characterLocks, storyboardCount);

    // 6. 根据提供商调用
    let responseContent: string;

    if (providerType === 'zhipu') {
      const userId = request.headers.get('x-user-id') || 'dev-user';
      const configured = await isZhipuConfiguredForUser(userId);
      
      if (!configured) {
        return NextResponse.json(
          { error: '智谱API未配置，请在方案设置中配置 API Key' },
          { status: 400 }
        );
      }

      const client = await getZhipuClientAsync(userId);
      const response = await client.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: modelId,
        temperature: 0.5,
        max_tokens: 8192,
      });

      responseContent = response.choices[0]?.message?.content || '';
    } else {
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new LLMClient(config, customHeaders);

      const response = await client.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: modelId,
        temperature: 0.5,
      });

      responseContent = response.content;
    }

    // 7. 解析JSON
    let result;
    try {
      const content = responseContent.trim();
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonStr = content.slice(firstBrace, lastBrace + 1);
        jsonStr = jsonStr.replace(/[""]/g, '"');
        jsonStr = jsonStr.replace(/'/g, '"');
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (char) => {
          if (char === '\n' || char === '\t' || char === '\r') return char;
          return '';
        });
        
        try {
          result = JSON.parse(jsonStr);
        } catch {
          jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
          result = JSON.parse(jsonStr);
        }
      } else {
        throw new Error('无法提取JSON');
      }
    } catch (parseError) {
      console.error('[剧本生成-智谱] JSON解析失败:', parseError);
      return NextResponse.json(
        { error: '剧本生成失败：无法解析响应', rawContent: responseContent.substring(0, 500) },
        { status: 500 }
      );
    }

    // 7.5 清理错误格式：过滤 File: 和 URL: 格式
    function cleanFieldValue(value: unknown): unknown {
      if (typeof value === 'string') {
        // 移除 File: [xxx] 格式
        let cleaned = value.replace(/File:\s*\[[^\]]*\]/gi, '').trim();
        // 移除 URL: [xxx] 格式
        cleaned = cleaned.replace(/URL:\s*\[[^\]]*\]/gi, '').trim();
        // 移除多余的空白和标点
        cleaned = cleaned.replace(/^[,，、;；\s]+|[,，、;；\s]+$/g, '').trim();
        return cleaned;
      }
      if (Array.isArray(value)) {
        return value.map(cleanFieldValue);
      }
      if (typeof value === 'object' && value !== null) {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          cleaned[k] = cleanFieldValue(v);
        }
        return cleaned;
      }
      return value;
    }
    
    result = cleanFieldValue(result) as Record<string, unknown>;
    console.log('[剧本生成-智谱] 已清理错误格式');

    // 8. 确保storyboards存在
    if (!result.storyboards || !Array.isArray(result.storyboards)) {
      result.storyboards = [];
    }

    // 9. 验证并补全分镜
    const storyboardsArray = result.storyboards as Array<Record<string, unknown>>;
    if (storyboardsArray.length > 0) {
      result.storyboards = storyboardsArray.map((sb, index) => {
        const seq = typeof sb.seq === 'number' ? sb.seq : index + 1;
        const shotType = sb.shotType as string || getShotTypeByStage(getStageBySeq(seq, storyboardCount), seq);
        const stage = getStageBySeq(seq, storyboardCount);
        const sceneId = sb.sceneId as string || scenes[seq % scenes.length].sceneId;
        const scene = scenes.find((s: SceneDefinition) => s.sceneId === sceneId) || scenes[0];
        
        // 时长控制
        let duration = typeof sb.duration === 'number' ? sb.duration : getDurationByShot(shotType);
        duration = Math.min(duration, SHOT_DURATION_RULES.maxDuration);
        duration = Math.max(duration, SHOT_DURATION_RULES.minDuration);
        
        // 角色处理
        const charNames = sb.characters as string[] || [];
        const relatedChars = characterLocks.filter(c => charNames.includes(c.name));
        
        // 对话处理
        const dialogue = sb.dialogue as { speaker?: string; content?: string; emotion?: string } | null;
        
        // 构建统一提示词
        const videoPrompt = buildUnifiedPrompt({
          style,
          character: relatedChars[0] || characterLocks[0],
          scene,
          action: sb.action as string || '',
          dialogue: dialogue?.content,
          shotType,
          emotion: sb.emotion as string,
        });
        
        return {
          id: `sb-${seq}`,
          sequence: seq,
          name: `${genre}短剧第${seq}镜`,
          duration,
          shotType,
          stage,
          sceneId,
          scene,
          characterIds: relatedChars.map(c => c.characterId),
          characters: relatedChars,
          description: sb.action as string || '',
          action: sb.action as string || '',
          dialogue: dialogue,
          narration: sb.narration as string || null,
          emotion: sb.emotion as string,
          tension: getTensionByStage(stage),
          videoPrompt,
          isKeyframe: sb.isKeyframe as boolean || false,
        };
      });
    }

    // 10. 计算总时长
    const finalStoryboards = result.storyboards as Array<{ duration?: number; isKeyframe?: boolean; sequence?: number; sceneId?: string; videoPrompt?: string }>;
    const totalDuration = finalStoryboards.reduce(
      (sum, sb) => sum + (sb.duration || 8), 
      0
    );

    // 11. 生成关键帧列表
    const keyframes: KeyframeGuide[] = finalStoryboards
      .filter((sb) => sb.isKeyframe)
      .map((sb, idx) => ({
        keyframeId: `kf-${idx + 1}`,
        sceneId: sb.sceneId || '',
        shotSequence: sb.sequence || idx + 1,
        type: 'scene_opening' as const,
        prompt: sb.videoPrompt || '',
        importance: 'high' as const,
      }));

    // 12. 添加统一性配置
    result.unity = {
      style,
      characterLocks,
      sceneDefinitions: scenes,
      mainScenes: scenes.slice(0, 2).map((s: SceneDefinition) => s.sceneId),
      styleTags: [style.description, style.colorTone, style.atmosphere],
    };

    // 13. 添加元数据
    result.llmModel = modelId;
    result.llmProvider = providerType;
    result.totalDuration = totalDuration;
    result.storyboardCount = finalStoryboards.length;
    result.keyframes = keyframes;

    return NextResponse.json(result);
  } catch (error) {
    console.error('[剧本生成-智谱] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '剧本生成失败' },
      { status: 500 }
    );
  }
}
