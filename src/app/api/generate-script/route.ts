import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS } from '@/lib/config';
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
 * 剧本生成 API
 * 
 * 核心规则：
 * - 总时长：300秒
 * - 每镜固定：12秒
 * - 最少分镜：30个
 * - 统一性控制：风格、主体、场景
 * 
 * 技术手段：
 * - 关键帧引导：每个场景首帧、情绪高峰镜头
 * - 参考图锁定：角色立绘、场景参考图
 * - 提示词工程：结构化提示词确保一致性
 */

// ===========================================
// 根据题材自动匹配视觉风格
// ===========================================
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

// ===========================================
// 根据题材匹配场景
// ===========================================
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

// ===========================================
// 根据分镜序号和总数获取阶段
// ===========================================
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

// ===========================================
// 根据阶段获取镜头类型建议
// ===========================================
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

// ===========================================
// 根据阶段获取紧张度
// ===========================================
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

// ===========================================
// 根据镜头类型获取时长
// ===========================================
function getDurationByShot(shotType: string): number {
  const rules = SHOT_DURATION_RULES.shotTypeDurations[shotType as keyof typeof SHOT_DURATION_RULES.shotTypeDurations];
  if (rules) {
    return rules.default;
  }
  return SHOT_DURATION_RULES.defaultDuration;
}

// ===========================================
// 生成系统提示词 - 统一性控制版本
// ===========================================
function generateSystemPrompt(
  total: number,
  style: VisualStyle,
  scenes: SceneDefinition[],
  genre?: string
): string {
  const totalDuration = 300; // 总时长
  
  // 场景描述
  const sceneDescriptions = scenes.map(s => `${s.name}(${s.description})`).join('、');
  
  // 宠物风特殊规则
  const isPetGenre = genre?.includes('宠物') || genre?.includes('萌宠') || genre?.includes('动物');
  const petRules = isPetGenre ? `
【宠物风特殊规则 - 必须严格遵守】
1. 角色全部是宠物（猫、狗、仓鼠、兔子等），绝不能出现人类
2. 画面中禁止出现人的任何部位：不要出现人手、人脚、人脸、人影
3. 所有动作由宠物完成：宠物用爪子拿东西、宠物用嘴叼东西、宠物之间互动
4. 场景完全宠物化：宠物客厅、宠物卧室、宠物医院、宠物公园等
5. 对话是正常人的语言：宠物之间用人类的语言交流，但画面中只有宠物
6. 视觉描述只描写宠物：如"橘猫抬头望着窗外"、"小狗摇着尾巴走过来"
7. 禁止人类介入：不要出现"主人喂食"、"主人抚摸"、"主人的手"等描述
8. 宠物表情丰富：通过耳朵、尾巴、眼睛表达情绪，如"耳朵耷拉下来"、"尾巴兴奋地摇摆"
` : '';
  
  return `你是专业的抖音短剧编剧，必须严格按规则生成剧本。
${petRules}
【核心规则 - 必须遵守】
- 分镜数量：恰好${total}个，不能多也不能少
- 总时长：${totalDuration}秒
- 每镜时长：固定12秒
- 开篇钩子、核心分镜、结尾悬念：统一12秒

【统一性控制 - 三维度】
1. 风格：${style.description}，${style.lighting}，${style.colorTone}色调
2. 场景：仅使用以下场景，**场景名称必须完全一致不能修改**：${sceneDescriptions}
   **重要**：scene字段中引用的场景名必须使用上述列表中的**完全一致**的名称，不能用谐音字或同义词替代！
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

【注意】hook和cliffhanger的台词可以是旁白形式，speaker可设为"旁白"

【开篇钩子(hook)内容规则 - 必须严格遵循】
hook是独立于storyboards的开场钩子，必须有独特的台词，不能重复任何分镜内容：
1. 【台词定位】hook的台词是"全剧钩子总结"，用一句话概括本集核心冲突或悬念
2. 【台词风格】类似预告片旁白，充满悬念感和吸引力
3. 【示例台词】：
   - "他没想到，这个决定会改变他的一生..."
   - "一切，都从那个雨夜开始..."
   - "如果时光能倒流，她绝不会踏入那扇门..."
   - "谁能想到，真相竟是这样..."
4. 【视觉要求】黄金3秒法则，使用特写/大特写，突出关键道具、眼神、伤痕等
5. 【时长】12秒，仅一句台词(≤20字)
6. 【禁止重复】hook台词必须独特，绝不能与任何storyboard的对话内容相同或相似
7. 【角色限制】hook中的characters通常是画外音角色，或者是镜头中出现但沉默的角色

【结尾悬念(cliffhanger)内容规则 - 必须严格遵循】
cliffhanger是独立于storyboards的结尾悬念，必须有独特的台词，作为下一集引子：
1. 【台词定位】cliffhanger的台词是"下一集引子"，暗示接下来的剧情走向
2. 【台词风格】制造强烈悬念，让观众迫不及待想看下一集
3. 【示例台词】：
   - "真正的游戏，现在才刚刚开始..."
   - "他不知道，最大的背叛者就在身边..."
   - "下一集：真相大白"
   - "然而她不知道，这一切都是圈套..."
4. 【视觉要求】在关键时刻定格，如转身瞬间、发现真相的表情、神秘人物出现等
5. 【时长】12秒，仅一句台词(≤20字)
6. 【禁止重复】cliffhanger台词必须独特，绝不能与任何storyboard的对话内容相同或相似
7. 【角色限制】cliffhanger中的characters可以是镜头中的角色，也可以是画外音

【hook和cliffhanger台词去重规则 - 极其重要】
- hook台词 ≈ 全集总结+悬念钩子（预告片风格）
- cliffhanger台词 ≈ 下集预告+悬念引子（留白风格）
- 绝对禁止：hook/cliffhanger台词与storyboards中任何对话重复
- 绝对禁止：hook/cliffhanger台词是普通对话形式（如"你好"、"我回来了"等）
- 建议：hook和cliffhanger使用画外音(旁白)形式

【hook和cliffhanger对象格式规则】
- hook必须包含：visualPrompt、duration(数字)、shotType、cameraMovement、mood、scene、characters、dialogue(可选)
- cliffhanger必须包含：visualPrompt、duration(数字)、shotType、cameraMovement、mood、scene、characters、dialogue(可选)
- dialogue格式：{"speaker":"角色名","content":"台词(≤15字)","emotion":"情绪","speechRate":"快/慢/正常"}

【重要规则 - duration必须是数字】
- duration字段必须是阿拉伯数字，如8、6、10，禁止使用中文数字如"八"、"六"`;
}

// ===========================================
// 生成用户提示词
// ===========================================
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
【必须】普通分镜对话精简，每句不超过15字。
【必须】角色说话要快，不要拖沓。
【必须】hook台词是全剧钩子总结（预告片风格），≤20字，禁止重复任何分镜。
【必须】cliffhanger台词是下一集引子（悬念风格），≤20字，禁止重复任何分镜。
【必须】hook和cliffhanger建议使用画外音/旁白形式。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { genre, conflict, characters, style: customStyle, scenes: customScenes } = body;

    if (!genre || !conflict || !characters || characters.length === 0) {
      return NextResponse.json(
        { error: '请先生成角色档案' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);
    
    console.log(`[剧本生成] LLM: ${DEFAULT_MODELS.llm}, 视频: ${DEFAULT_MODELS.video}`);

    // 1. 匹配视觉风格
    const style = customStyle || matchVisualStyle(genre);
    console.log(`[剧本生成] 风格: ${style.type}`);

    // 2. 匹配场景
    const scenes = customScenes || matchScenes(genre);
    console.log(`[剧本生成] 场景: ${scenes.map((s: SceneDefinition) => s.name).join(', ')}`);

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

    // 4. 计算分镜数量（30-40个）
    const storyboardCount = Math.max(
      STORYBOARD_COUNT_RULES.minCount,
      Math.min(STORYBOARD_COUNT_RULES.maxCount, STORYBOARD_COUNT_RULES.calculateCount(135))
    );
    console.log(`[剧本生成] 分镜数量: ${storyboardCount}`);

    // 5. 生成提示词
    const systemPrompt = generateSystemPrompt(storyboardCount, style, scenes, genre);
    const userPrompt = generateUserPrompt(genre, conflict, characterLocks, storyboardCount);

    // 6. 调用LLM
    const response = await client.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: DEFAULT_MODELS.llm,
      temperature: 0.5,
    });

    // 7. 解析JSON
    let result;
    try {
      const content = response.content.trim();
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
      console.error('[剧本生成] JSON解析失败:', parseError);
      return NextResponse.json(
        { error: '剧本生成失败：无法解析响应', rawContent: response.content.substring(0, 500) },
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
    console.log('[剧本生成] 已清理错误格式');

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
        
        // 时长控制：固定12秒
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
    result.llmModel = DEFAULT_MODELS.llm;
    result.videoModel = DEFAULT_MODELS.video;
    result.totalDuration = totalDuration;
    result.storyboardCount = finalStoryboards.length;
    result.keyframes = keyframes;

    return NextResponse.json(result);
  } catch (error) {
    console.error('[剧本生成] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '剧本生成失败' },
      { status: 500 }
    );
  }
}
