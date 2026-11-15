import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS, getUserConfig } from '@/lib/config';
import {
  SHOT_DURATION_RULES,
  ADMIN_SHOT_DURATION_RULES,
  STAGE_RATIOS,
  STORYBOARD_COUNT_RULES,
  PRESET_STYLES,
  type VisualStyle,
} from '@/lib/script-types';
import { getScriptPromptProfile } from '@/lib/model-prompt-profiles';

// 设置最大执行时间为8分钟（Next.js API路由最大值）
export const maxDuration = 480;

/**
 * 剧集剧本生成 API
 * 
 * 核心规则：
 * - 分镜数量：8-10个
 * - 每镜时长：固定12秒
 * - 每镜对话：4句及以上
 * - 总时长：96-120秒
 * - 使用智谱模型
 */

// 根据题材匹配视觉风格（支持部分匹配）
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

// 根据阶段获取type
function getTypeByStage(stage: string): string {
  const typeMap: Record<string, string> = {
    '钩子': 'opening',
    '冲突': 'action',
    '升温': 'dialogue',
    '高潮': 'action',
    '反转': 'dialogue',
    '收尾': 'ending',
  };
  return typeMap[stage] || 'action';
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
function getDurationByShot(shotType: string, isAdmin: boolean = false): number {
  const rules = isAdmin ? ADMIN_SHOT_DURATION_RULES : SHOT_DURATION_RULES;
  const shotTypeDurations = rules.shotTypeDurations[shotType as keyof typeof rules.shotTypeDurations];
  if (shotTypeDurations) {
    return shotTypeDurations.default;
  }
  return rules.defaultDuration;
}

// 根据视频模型获取最大时长
// Seedance 2.0 (doubao-seedance-2-0-260128)：最大支持 15 秒（已全量启用）
// Seedance 1.5 Pro (doubao-seedance-2-0-260128)：最大支持 12 秒
function getVideoModelMaxDuration(videoModel: string | undefined): number {
  if (videoModel === 'doubao-seedance-2-0-260128') {
    return 15;
  }
  if (videoModel === 'doubao-seedance-2-0-260128') {
    return 12;
  }
  return 15; // 默认15秒（Seedance 2.0 已全量启用）
}

// 根据情绪获取语速描述
function getSpeechRate(emotion: string | undefined): string {
  if (!emotion || emotion === '平静') return '';
  
  const rateMap: Record<string, string> = {
    // 快速类（愤怒、紧张、兴奋）
    '愤怒': '语速急促',
    '愤怒嘶吼': '语速极快、音量高亢',
    '怒斥': '语速快、有力',
    '暴怒': '语速极快、声嘶力竭',
    '紧张': '语速略快',
    '焦虑': '语速快、略带颤抖',
    '兴奋': '语速快、声音上扬',
    '激动': '语速快、情绪高昂',
    '震惊': '语速骤停',
    '惊恐': '语速急促',
    '恐惧': '语速快、声音颤抖',
    
    // 慢速类（悲伤、温柔、坚定）
    '悲伤': '语速缓慢、声音低沉',
    '哭泣': '语速慢、断断续续',
    '哽咽': '语速极慢、声音颤抖',
    '绝望': '语速极慢、语气空洞',
    '温柔': '语速缓慢、声音柔和',
    '轻声': '语速极慢、声音轻柔',
    '坚定': '语速稳慢、语气有力',
    '决绝': '语速慢、一字一顿',
    '郑重': '语速缓慢、语气庄重',
    '关切': '语速略慢、语气柔和',
    '冷漠': '语速平慢、语气冷淡',
    '冰冷': '语速慢、语气冷硬',
    '嘲讽': '语速慢、语气玩味',
    '威胁': '语速极慢、语气阴沉',
    '阴冷': '语速慢、语气冰冷',
    '低沉': '语速缓慢',
    '压抑': '语速慢、语气沉重',
    '虚弱': '语速极慢、声音微弱',
    '疲惫': '语速慢、声音低沉',
    
    // 中速类（惊讶、疑惑）
    '惊讶': '语速略停顿',
    '疑惑': '语速略慢、语气疑问',
    '错愕': '语速骤停、短暂停顿',
    '无奈': '语速略慢',
    '叹息': '语速慢、长叹',
  };
  
  return rateMap[emotion] || '';
}

// 根据语速类型获取详细描述（用于视频提示词）
function getSpeechRateDescription(speechRate: string | undefined): string {
  if (!speechRate || speechRate === '正常') return '';
  
  const descMap: Record<string, string> = {
    '快': '语速急促',
    '慢': '语速缓慢',
    '骤停': '语速突然停顿',
    '急促': '语速急促',
    '缓慢': '语速缓慢',
  };
  
  return descMap[speechRate] || '';
}

// 情感描述映射 - 为台词添加丰富的情感表达
function getEmotionDescription(emotion: string | undefined): string {
  if (!emotion || emotion === '平静') return '';
  
  const emotionMap: Record<string, string> = {
    // 愤怒类
    '愤怒': '愤怒地',
    '愤怒嘶吼': '愤怒嘶吼',
    '怒斥': '怒斥',
    '暴怒': '暴怒地',
    '气愤': '气愤地',
    '阴狠': '阴狠地',
    
    // 悲伤类
    '悲伤': '悲伤地',
    '哭泣': '哭泣着',
    '哽咽': '哽咽着',
    '绝望': '绝望地',
    '崩溃': '崩溃地',
    '痛苦': '痛苦地',
    '低声抽泣': '低声抽泣',
    
    // 恐惧类
    '恐惧': '恐惧地',
    '惊恐': '惊恐地',
    '颤抖': '颤抖着',
    '害怕': '害怕地',
    
    // 欢喜类
    '欢喜': '欢喜地',
    '兴奋': '兴奋地',
    '开心': '开心地',
    '大笑': '大笑',
    '激动': '激动地',
    
    // 惊讶类
    '震惊': '震惊地',
    '惊讶': '惊讶地',
    '错愕': '错愕地',
    '难以置信': '难以置信地',
    
    // 冷漠类
    '冷漠': '冷漠地',
    '冰冷': '冰冷地',
    '冷笑': '冷笑着',
    '嘲讽': '嘲讽地',
    
    // 威胁类
    '威胁': '威胁地',
    '阴冷': '阴冷地',
    '邪魅': '邪魅地',
    
    // 坚定类
    '坚定': '坚定地',
    '决绝': '决绝地',
    '郑重': '郑重地',
    
    // 温柔类
    '温柔': '温柔地',
    '轻声': '轻声',
    '关切': '关切地',
    
    // 其他
    '紧张': '紧张地',
    '焦虑': '焦虑地',
    '疑惑': '疑惑地',
    '无奈': '无奈地',
    '叹息': '叹息着',
    '低沉': '低沉地',
    '压抑': '压抑地',
    '虚弱': '虚弱地',
    '疲惫': '疲惫地',
    '诡异地笑': '诡异地笑',
  };
  
  return emotionMap[emotion] || emotion;
}

// 面部表情映射 - 为视频生成添加丰富的面部表情描述
function getFacialExpression(emotion: string | undefined): string {
  if (!emotion || emotion === '平静') return '';
  
  const facialMap: Record<string, string> = {
    // 愤怒类
    '愤怒': '眉头紧锁、眼神凌厉',
    '愤怒嘶吼': '眉头紧锁、双眼圆睁、咬牙切齿',
    '怒斥': '眉头紧皱、眼神如刀',
    '暴怒': '青筋暴起、双目充血、咬牙切齿',
    '气愤': '眉头微皱、嘴唇紧抿',
    '阴狠': '眼神阴冷、嘴角微撇',
    
    // 悲伤类
    '悲伤': '眼眶泛红、眉头微蹙',
    '哭泣': '泪流满面、眉头紧锁',
    '哽咽': '眼眶含泪、嘴唇颤抖',
    '绝望': '眼神空洞、面如死灰',
    '崩溃': '泪如雨下、表情扭曲',
    '痛苦': '眉头紧皱、面露痛苦',
    '低声抽泣': '眼眶泛红、默默流泪',
    
    // 恐惧类
    '恐惧': '瞳孔放大、面色苍白',
    '惊恐': '双眼圆睁、瞳孔收缩',
    '颤抖': '眼神惊恐、嘴唇发抖',
    '害怕': '眼神躲闪、面色紧张',
    
    // 欢喜类
    '欢喜': '眉开眼笑、嘴角上扬',
    '兴奋': '双眼放光、笑容灿烂',
    '开心': '笑逐颜开、眼神明亮',
    '大笑': '开怀大笑、眼睛眯成月牙',
    '激动': '眼中含泪、笑容绽放',
    
    // 惊讶类
    '震惊': '瞳孔放大、嘴巴微张',
    '惊讶': '眉毛上扬、眼睛睁大',
    '错愕': '表情僵硬、眼神呆滞',
    '难以置信': '双眼圆睁、嘴巴微张',
    
    // 冷漠类
    '冷漠': '面无表情、眼神冷淡',
    '冰冷': '眼神如冰、表情冷酷',
    '冷笑': '嘴角微扬、眼神冰冷',
    '嘲讽': '嘴角上扬、眼神轻蔑',
    
    // 威胁类
    '威胁': '眼神凶狠、嘴角微勾',
    '阴冷': '眼神阴沉、面露杀气',
    '邪魅': '嘴角上扬、眼神玩味',
    
    // 坚定类
    '坚定': '眼神坚毅、表情刚毅',
    '决绝': '眼神坚定、神情决然',
    '郑重': '表情严肃、目光沉稳',
    
    // 温柔类
    '温柔': '眼神柔和、嘴角带笑',
    '轻声': '目光温柔、表情柔和',
    '关切': '眉头微蹙、眼神担忧',
    
    // 其他
    '紧张': '眉头紧锁、眼神焦虑',
    '焦虑': '眉头紧皱、眼神飘忽',
    '疑惑': '眉头微皱、眼神困惑',
    '无奈': '苦笑、眼神无奈',
    '叹息': '眉头微蹙、轻轻摇头',
    '低沉': '眼神低垂、表情凝重',
    '压抑': '面无表情、眼神深沉',
    '虚弱': '面色苍白、眼神涣散',
    '疲惫': '眼睑低垂、面露倦容',
    '诡异地笑': '嘴角诡异上扬、眼神阴森',
  };
  
  return facialMap[emotion] || '';
}

// 解析 JSON 的辅助函数
function parseJsonContent(content: string): Record<string, unknown> | null {
  try {
    let jsonStr = content.trim();
    
    // 提取 JSON
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      console.log('[parseJsonContent] 未找到 JSON 括号，内容前100字符:', jsonStr.substring(0, 100));
      return null;
    }
    
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    
    // JSON 修复
    jsonStr = jsonStr.replace(/[""]/g, '"');
    jsonStr = jsonStr.replace(/：/g, ':');
    jsonStr = jsonStr.replace(/，/g, ',');
    jsonStr = jsonStr.replace(/【/g, '[');
    jsonStr = jsonStr.replace(/】/g, ']');
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    jsonStr = jsonStr.replace(/"([^"]+)"::/g, '"$1":');
    jsonStr = jsonStr.replace(/"(\w+)"\s*:\s*:/g, '"$1":');
    
    const result = JSON.parse(jsonStr);
    return result;
  } catch (error) {
    console.log('[parseJsonContent] JSON 解析失败，错误:', error instanceof Error ? error.message : String(error));
    console.log('[parseJsonContent] 修复后的内容前200字符:', content.substring(0, 200));
    return null;
  }
}

// 生成开篇钩子(hook)的独立提示词
function generateHookPrompt(style: VisualStyle, characters: string, conflict: string, episodeNumber: number, previousCliffhanger?: string, genre?: string, isAdmin: boolean = false, llmModel?: string): string {
  // 宠物风特殊规则
  const isPetGenre = genre?.includes('宠物') || genre?.includes('萌宠') || genre?.includes('动物');
  const petRules = isPetGenre ? `
【宠物风特殊规则 - 必须严格遵守】
1. 角色全部是宠物（猫、狗、仓鼠、兔子等），绝不能出现人类
2. 画面中禁止出现人的任何部位：不要出现人手、人脚、人脸、人影
3. 所有动作由宠物完成：宠物用爪子拿东西、宠物用嘴叼东西
4. 场景完全宠物化：宠物客厅、宠物卧室、宠物公园等
5. 对话是正常人的语言：宠物之间用人类的语言交流
` : '';
  
  // 时长统一12秒，4个时间点（0-3s、3-6s、6-9s、9-11s）
  const duration = getVideoModelMaxDuration(undefined);
  const timePoints = '0-3s、3-6s、6-9s、9-11s';
  
  return `【🚨🚨🚨 最高优先级：只输出纯JSON文本，禁止任何图片 🚨🚨🚨】
🚫 严格禁止输出以下任何内容：
- Image: [...] 格式的图片链接
- https:// 开头的任何URL链接
- 图片、照片、图像等任何图片描述
- markdown代码块（不要用 三个反引号json包裹）
- 任何解释说明文字
- 任何非JSON格式的内容
✅ 正确：{"brief":"4-6字","summary":"30字概要","hook":{...}}
❌ 错误：Image: [https://...] 或 图片 或 三个反引号json 或 这里是钩子...

你是专业的抖音短剧编剧，现在需要为第${episodeNumber}集创作一个**开篇钩子**。
${getScriptPromptProfile(llmModel).styleDirective}
${petRules}
【⚠️⚠️⚠️ 极其重要 - 钩子是预告片风格，不是正片第一镜 ⚠️⚠️⚠️】

钩子是什么：
- 钩子是**预告片的开场**，展示本集最吸引人的高潮片段
- 钩子是**电影海报**，用一帧画面告诉观众"这集有什么看点"
- 钩子是**全剧的钩子总结**，台词要概括本集核心冲突

钩子不是什么：
- ❌ 钩子不是正片第一镜的重复
- ❌ 钩子不是从剧情开头讲起
- ❌ 钩子不是铺垫式介绍

【核心规则】
1. **预告片风格**：钩子是预告片，展示本集最高潮的瞬间
2. **时间点描述**：使用 0-3s、3-6s、6-9s 等时间格式描述镜头
3. **视觉冲击**：使用特写、全景、中景、近景等镜头语言
4. **时长固定**：${duration}秒，4个时间点描述
5. **直接使用角色名**：不要使用[图片X]，直接写角色名
6. **音色描述**：每句台词需标注音色（女声/男声、青年/中年/老年、音调、质感、发音方式、情绪）
7. **不添加字幕！不添加BGM！**

【视觉风格】${style.description}，${style.lighting}，${style.colorTone}色调

【剧本背景】
- 核心冲突：${conflict || '未指定'}
- 主要角色：${characters || '未指定'}
${episodeNumber > 1 ? `- 承接上集悬念：${previousCliffhanger || '无'}` : '- 第一集开场，需要最强的钩子'}

【输出格式 - 必须严格按照以下格式】（注意：角色名前加@符号，如@沈灵月、@苏清鸢）
{"location":"场景名称","description":"场景描述","characterList":["角色1","角色2"],"timeDescriptions":{"时间范围":"【镜头类型】场景和人物描述，...，@角色名是女声/男声，青年/中年音色，音调...，音色质感...，发音方式...，带有...情绪，说：\"对话内容\""},"subtitle":false,"bgm":false}

【timeDescriptions格式详解 - 必须严格遵守】
timeDescriptions是对象格式，包含4个时间点的描述，每个时间点格式：
"时间范围":"【镜头类型】场景和人物描述，...，@角色名是女声/男声，青年/中年/老年音色，音调（尖锐/低沉/清冷/浑厚/柔和等），音色质感（冷厉/清澈/沙哑/温润等），发音方式（刻薄/清晰/颤抖/平稳等），带有（虚伪/狠毒/悲愤/坚韧等）情绪，说：\"对话内容\""

【timeDescriptions格式示例（12秒）】
{"0-3s":"【全景】青云门斩仙台，乌云压顶雷雨交加，四周门派举剑围杀，血水顺着青石板缝隙蜿蜒流淌，气氛肃杀惨烈","3-6s":"【中景】镜头推进，@沈灵月站在@苏清鸢面前，手持长剑，眼神阴狠。@沈灵月是女声，青年音色，音调尖锐，音色质感冷厉，发音方式刻薄，带有虚伪与狠毒，说：\"偷了魔教至宝！\"","6-9s":"【近景】@苏清鸢跪在血泊中，抬头悲愤，泪流满面。@苏清鸢是女声，少女音色，音调清冷，音色质感清澈，发音方式清晰，带有悲愤与坚韧，说：\"这是师娘遗物！\"","9-11s":"【特写】@沈灵月嘴角冷笑，眼中闪烁虚伪的光芒。@沈灵月是女声，青年音色，音调尖锐，音色质感冷厉，发音方式刻薄，带有虚伪与狠毒，说：\"魔女不死，武林必乱！\""}

【⚠️⚠️⚠️ 强制要求 ⚠️⚠️⚠️】
1. timeDescriptions必须包含4个时间点：${timePoints}
2. 不添加字幕（subtitle设为false）
3. 不添加BGM（bgm设为false）
4. 每句台词控制在15字以内
5. duration固定${duration}秒
6. 所有对话要有声音描述（女声/男声、音色、音调等）
7. 角色名前必须加@符号，如@沈灵月、@苏清鸢

【JSON格式注意事项】
- JSON的标点符号必须使用英文标点（冒号:、逗号,、引号"）
- JSON的键名必须用英文引号包裹
- JSON的值可以是中文内容
- 禁止使用中文标点符号作为JSON结构符号
- 禁止输出markdown代码块
- 禁止输出任何图片链接
- 禁止输出任何解释说明文字
- 只输出纯净的JSON对象

【最终输出要求】
直接输出JSON，不要加任何前缀或后缀文字！
正确格式：{"location":"场景","description":"描述","characterList":[...],"timeDescriptions":{...},"subtitle":false,"bgm":false}
错误格式：以下是JSON：... 或 Image: [...] 或 这里是剧本...
`;
}

// 生成结尾悬念(cliffhanger)的独立提示词
function generateCliffhangerPrompt(style: VisualStyle, characters: string, conflict: string, episodeNumber: number, storySummary: string, genre?: string, isAdmin: boolean = false, llmModel?: string): string {
  // 宠物风特殊规则
  const isPetGenre = genre?.includes('宠物') || genre?.includes('萌宠') || genre?.includes('动物');
  const petRules = isPetGenre ? `
【宠物风特殊规则 - 必须严格遵守】
1. 角色全部是宠物（猫、狗、仓鼠、兔子等），绝不能出现人类
2. 画面中禁止出现人的任何部位：不要出现人手、人脚、人脸、人影
3. 所有动作由宠物完成：宠物用爪子拿东西、宠物用嘴叼东西
4. 场景完全宠物化：宠物客厅、宠物卧室、宠物公园等
5. 对话是正常人的语言：宠物之间用人类的语言交流
` : '';
  
  // 时长统一12秒，4个时间点（0-3s、3-6s、6-9s、9-11s）
  const duration = getVideoModelMaxDuration(undefined);
  const timePoints = '0-3s、3-6s、6-9s、9-11s';
  
  return `【🚨🚨🚨 最高优先级：只输出纯JSON文本，禁止任何图片 🚨🚨🚨】
🚫 严格禁止输出以下任何内容：
- Image: [...] 格式的图片链接
- https:// 开头的任何URL链接
- 图片、照片、图像等任何图片描述
- markdown代码块（不要用 三个反引号json包裹）
- 任何解释说明文字
- 任何非JSON格式的内容
✅ 正确：{"brief":"4-6字","summary":"30字概要","cliffhanger":{...}}
❌ 错误：Image: [https://...] 或 图片 或 三个反引号json 或 这里是悬念...

你是专业的抖音短剧编剧，现在需要为第${episodeNumber}集创作一个**结尾悬念**。
${getScriptPromptProfile(llmModel).styleDirective}
${petRules}
【⚠️⚠️⚠️ 极其重要 - 悬念是下一集预告，不是正片最后一镜 ⚠️⚠️⚠️】

悬念是什么：
- 悬念是**下一集的预告片**，展示即将发生的新危机
- 悬念是**彩蛋**，在正片结束后出现的惊喜
- 悬念是**新的故事线引子**，展示观众没想到的转折

悬念不是什么：
- ❌ 悬念不是正片最后一镜的重复
- ❌ 悬念不是本集剧情的延续
- ❌ 悬念不是对已发生事件的总结

【核心规则】
1. **下一集预告**：悬念是下一集的预告，展示新的冲突
2. **时间点描述**：使用 0-3s、3-6s、6-9s 等时间格式描述镜头
3. **意想不到**：悬念要展示观众没想到的转折
4. **时长固定**：${duration}秒，4个时间点描述
5. **直接使用角色名**：不要使用[图片X]，直接写角色名
6. **音色描述**：每句台词需标注音色（女声/男声、青年/中年/老年、音调、质感、发音方式、情绪）
7. **不添加字幕！不添加BGM！**

【视觉风格】${style.description}，${style.lighting}，${style.colorTone}色调

【剧本背景】
- 核心冲突：${conflict || '未指定'}
- 主要角色：${characters || '未指定'}
- 本集剧情概要：${storySummary || '未指定'}

【输出格式 - 必须严格按照以下格式】（注意：角色名前加@符号，如@沈灵月、@苏清鸢）
{"location":"场景名称","description":"场景描述","characterList":["角色1","角色2"],"timeDescriptions":{"时间范围":"【镜头类型】场景和人物描述，...，@角色名是女声/男声，青年/中年音色，音调...，音色质感...，发音方式...，带有...情绪，说：\"对话内容\""},"subtitle":false,"bgm":false}

【timeDescriptions格式详解 - 必须严格遵守】
timeDescriptions是对象格式，包含4个时间点的描述，每个时间点格式：
"时间范围":"【镜头类型】场景和人物描述，...，@角色名是女声/男声，青年/中年/老年音色，音调（尖锐/低沉/清冷/浑厚/柔和等），音色质感（冷厉/清澈/沙哑/温润等），发音方式（刻薄/清晰/颤抖/平稳等），带有（虚伪/狠毒/悲愤/坚韧等）情绪，说：\"对话内容\""

【timeDescriptions格式示例（12秒）】
{"0-3s":"【全景】场景描述...","3-6s":"【中景】...，@角色名是女声/男声，青年/中年音色，音调...，音色质感...，发音方式...，带有...情绪，说：\"对话内容\"","6-9s":"【近景】...","9-11s":"【特写】..."}

【⚠️⚠️⚠️ 强制要求 ⚠️⚠️⚠️】
1. timeDescriptions必须包含4个时间点：${timePoints}
2. 不添加字幕（subtitle设为false）
3. 不添加BGM（bgm设为false）
4. 每句台词控制在15字以内
5. duration固定${duration}秒
6. 所有对话要有声音描述（女声/男声、音色、音调等）
7. 角色名前必须加@符号，如@沈灵月、@苏清鸢

【JSON格式注意事项】
- JSON的标点符号必须使用英文标点（冒号:、逗号,、引号"）
- JSON的键名必须用英文引号包裹
- JSON的值可以是中文内容
- 禁止使用中文标点符号作为JSON结构符号
- 禁止输出markdown代码块
- 禁止输出任何图片链接
- 禁止输出任何解释说明文字
- 只输出纯净的JSON对象

【最终输出要求】
直接输出JSON，不要加任何前缀或后缀文字！
正确格式：{"location":"场景","description":"描述","characterList":[...],"timeDescriptions":{...},"subtitle":false,"bgm":false}
错误格式：以下是JSON：... 或 Image: [...] 或 这里是剧本...
`;
}

// 生成分镜剧本的系统提示词（不含hook和cliffhanger）
function generateStoryboardsSystemPrompt(total: number, style: VisualStyle, genre?: string, isAdmin: boolean = false, llmModel?: string): string {
  // 根据总分镜数动态分配各阶段（注意：开篇钩子和结尾悬念是独立生成的）
  const introEnd = Math.max(1, Math.floor(total * 0.15)); // 15% 开场引入
  const conflictEnd = Math.floor(total * 0.35); // 20% 冲突发展
  const risingEnd = Math.floor(total * 0.6); // 25% 情绪升温
  const climaxEnd = Math.floor(total * 0.85); // 25% 高潮
  const resolutionEnd = total; // 15% 收束（注意：结尾悬念独立生成，这里只到剧情收束）
  
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
  
  // 根据视频模型动态获取时长（Seedance 2.0 已全量启用）
  const duration = getVideoModelMaxDuration(undefined); // 默认15秒（Seedance 2.0）
  const totalSeconds = total * duration;
  const timePoints = `0-${Math.floor(duration/4)}s、${Math.floor(duration/4)}-${Math.floor(duration/2)}s、${Math.floor(duration/2)}-${Math.floor(duration*3/4)}s、${Math.floor(duration*3/4)}-${duration-1}s`;
  
  // timeDescriptions格式模板（统一4个时间点，每个时间点都要包含台词，角色名前加@符号）
  // 格式：@角色1面前，对@角色2说："台词"（声音描述）
  const timeDescFormat = '"0-3s":"【全景】场景描述，...","3-6s":"【中景】@角色1在@角色2面前，对@角色2说："台词内容"（女声/男声，青年/中年音色，音调...，音色质感...，发音方式...，带有...情绪）","6-9s":"【近景】...，@角色3对@角色1说："台词内容"（女声/男声，...情绪）","9-11s":"【特写】...，@角色1对@角色2说："台词内容"（女声/男声，...情绪）"';
  
  return `【🚨🚨🚨 最高优先级：只输出纯JSON文本，禁止任何图片 🚨🚨🚨】
🚫 严格禁止输出以下任何内容：
- Image: [...] 格式的图片链接
- https:// 开头的任何URL链接
- 图片、照片、图像等任何图片描述
- markdown代码块（不要用 三个反引号json包裹）
- 任何解释说明文字
- 任何非JSON格式的内容
✅ 正确：{"brief":"4-6字","summary":"30字概要","storyboards":[...]}
❌ 错误：Image: [https://...] 或 图片 或 三个反引号json 或 这里是剧本...

你是顶级电影导演兼编剧，精通影视化叙事，擅长用镜头语言和情绪节奏创作有电影质感的分镜剧本。每一镜都要像院线大片一样有视觉冲击力和情感穿透力。
${getScriptPromptProfile(llmModel).styleDirective}
${petRules}
【⚠️ 最高优先级规则 - 必须严格遵守】
**你必须只输出JSON格式的剧本数据，禁止输出任何其他内容！**
**每个分镜的dialogues必须是数组格式，包含至少4句对话！**
**不添加字幕！不添加BGM！**
**timeDescriptions中绝对禁止包含任何图片链接！**

【⚠️ 重要说明 - 开篇钩子和结尾悬念已独立生成】
- **开篇钩子(hook)**已经独立生成，你的分镜从正片第一镜开始，不要重复钩子的内容
- **结尾悬念(cliffhanger)**会独立生成，你的最后一个分镜应该是剧情收束，不要制造悬念
- 你只需要生成正片的${total}个分镜

【分镜规则 - 电影叙事节奏】
- 恰好生成${total}个分镜（正片内容，不含钩子和悬念）
- 第1-${introEnd}镜：开场引入（用留白和氛围感建立世界，慢镜头铺陈，眼神交代关系）
- 第${introEnd+1}-${conflictEnd}镜：冲突发展（用交错剪辑制造矛盾张力，表情从隐忍到爆发）
- 第${conflictEnd+1}-${risingEnd}镜：情绪升温（特写放大微表情，呼吸感渐强，肢体语言从克制到失控）
- 第${risingEnd+1}-${climaxEnd}镜：高潮（急促剪辑+特写交替，泪水/怒火/绝望爆发，情绪达到顶点）
- 第${climaxEnd+1}-${resolutionEnd}镜：收束（长镜头留白，情绪余韵，为结尾悬念铺垫但不要制造悬念）

【时长】总${totalSeconds}-${totalSeconds}秒，每镜固定${duration}秒

【视觉风格】${style.description}，${style.lighting}，${style.colorTone}色调

【🎬 电影感核心法则 - 必须严格遵守】
1. **情绪先行**：每镜的timeDescriptions必须先描述情绪氛围，再描述动作和台词。情绪是画面的灵魂
2. **微表情叙事**：不要只写"愤怒""悲伤"，要写出具体的微表情——"嘴角颤抖""瞳孔骤缩""喉结滚动""眼眶泛红但强忍不落泪"
3. **肢体语言**：手部动作（攥拳、指节发白、颤抖地伸出手）、身体姿态（佝偻、挺直、踉跄后退）比台词更能传递情感
4. **环境映射情绪**：场景细节要映射角色内心——"烛火摇曳如她颤抖的肩膀""雨点砸在石板上如她心碎的声音"
5. **眼神是核心**：每个时间点至少有一个角色的眼神描述——"眼中映着火光""瞳孔中倒映着对方的背影""目光如刀锋般锐利"
6. **留白与沉默**：不是每秒都要有台词，沉默比台词更有力量——"长久的沉默，只有风声""她张了张嘴，却什么也没说出来"

【镜头语言 - 电影级运用】
- 【极特写】：双眼、嘴唇、一滴泪——只用于最强烈的情绪瞬间
- 【特写】：面部表情、手部动作——放大情绪，让观众感同身受
- 【近景】：胸部以上——对话场景的标准景别，捕捉表情和语气
- 【中景】：腰部以上——展示人物互动关系和手势
- 【全景】：全身+环境——建立场景氛围和空间关系
- 【大远景】：人物渺小——展现命运感、孤独感、压迫感
- 【仰拍】：从低角度拍摄——赋予角色力量感、威严感
- 【俯拍】：从高角度拍摄——展现角色脆弱、无助、被审视
- 【推镜头】：缓缓推近——制造压迫感、逼近真相
- 【拉镜头】：缓缓拉远——展现孤立无援、命运的苍凉
- 【环绕镜头】：围绕角色旋转——展现人物内心天旋地转
- 【手持晃动】：轻微抖动——增加紧张感和临场感
- 【慢动作】：关键瞬间的延时——泪水滑落、拳风掠过、发丝飘起

【转场规则 - 分镜之间的自然过渡】
- **动势衔接**：上一镜角色转头，下一镜切到角色视线方向
- **情绪延续**：上一镜的情绪在下一镜通过另一个角色反应延续
- **景别递进**：全景→中景→近景→特写，制造情绪聚焦
- **对比剪辑**：愤怒的面孔直接切到哭泣的面孔，强化冲突

【台词规则 - 电影级对白】
- dialogues只包含主要角色对话（主角和反派），不要包含群演台词
- dialogues从timeDescriptions中提取核心台词，每镜2-4句
- 不要生成额外对话（如行刑弟子、群众等群演台词）
- 每句台词控制在15字以内，口语化，像真实人会说的
- 只包含戏份重要的角色对话
- **台词要有潜台词**：表面说的话和内心真实想法形成反差，如笑着说狠话、平静地说出绝望的话

【语速控制规则】
根据情绪自动调整台词语速：
- 快速：愤怒、紧张、兴奋、惊恐、暴怒、激动 → 语速急促，可能带喘息
- 慢速：悲伤、温柔、绝望、坚定、冷漠、威胁 → 语速缓慢，字字沉重
- 中速：平静、疑惑、无奈 → 语速正常
- 骤停：震惊、错愕 → 语速突然停顿，空气凝固

【不添加字幕，不添加BGM】
- 重要提示：剧本中不添加任何字幕相关描述
- 重要提示：剧本中不添加任何BGM相关描述
- bgmAtmosphere字段设为空字符串或"无"

【人物对话 - 必须生成】
- 每个分镜必须包含 dialogues 数组，至少2条对话
- dialogues 格式：[{"speaker":"角色名","content":"台词内容","emotion":"情绪状态"}]
- 对话必须体现角色性格和情绪，不能是空洞的描述
- 对话内容要与剧情紧密相关，推动故事发展
- 示例：[{"speaker":"沈灵月","content":"你偷了魔教至宝！","emotion":"阴狠伪善"},{"speaker":"苏清鸢","content":"这是师娘遗物！","emotion":"悲愤不屈"}]

【输出JSON格式 - 必须严格按照以下格式】（注意：角色名前加@符号，如@沈灵月、@苏清鸢）
- timeDescriptions格式：@角色1面前，对@角色2说："台词"（声音描述）
{"brief":"4-6字","summary":"30字概要","storyboards":[{"seq":1,"location":"青云门斩仙台","description":"乌云压顶雷雨交加，四周门派举剑围杀，血水顺着青石板缝隙蜿蜒流淌，气氛肃杀惨烈","characterList":["苏清鸢","沈灵月"],"timeDescriptions":{"0-3s":"【大远景·俯拍】青云门斩仙台，乌云如墨翻涌，雷蛇撕裂天际，暴雨倾盆，数千弟子持剑围成铁壁，血水沿青石板蜿蜒——如末世审判","3-6s":"【推镜头·近景】@沈灵月持剑缓步逼近，每一步踏碎一地雨水，嘴角噙着冷笑，眼底却是疯狂的占有欲，对@苏清鸢说："你偷了魔教至宝！"（女声，青年音色，音调尖锐如针，音色质感冷厉似冰，发音方式一字一顿，带有虚伪关切下藏着的狠毒）","6-9s":"【极特写·手持晃动】@苏清鸢跪在血泊中，雨水混着泪痕淌过苍白的脸，嘴唇颤抖却咬紧牙关，瞳孔中倒映着@沈灵月的剑锋，对@沈灵月说："这是师娘遗物！"（女声，少女音色，音调清冷却颤抖，音色质感清澈如碎冰，发音方式从哽咽到坚定，带有悲愤与不屈）","9-11s":"【环绕镜头·中景】@沈灵月缓缓举剑，雷光映照她扭曲的笑容，眼中闪烁着伪善的悲悯，对围观众人说："魔女不死，武林必乱！"（女声，青年音色，音调拔高，音色质感冷厉，发音方式刻薄如刀，带有以正义之名行恶的虚伪与狠毒）"},"dialogues":[{"speaker":"沈灵月","content":"你偷了魔教至宝！","emotion":"阴狠伪善"},{"speaker":"苏清鸢","content":"这是师娘遗物！","emotion":"悲愤不屈"},{"speaker":"沈灵月","content":"魔女不死，武林必乱！","emotion":"虚伪狠毒"}],"shotType":"大远景","stage":"正片","mood":"肃杀","emotion":"悲愤交加","aspectRatio":"9:16","isKeyframe":true}]}
错误格式：以下是JSON：{"brief":"...","summary":"...","storyboards":[...]} 或 Image: [...] 或 这里是剧本...
`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { episodeNumber } = body;
    
    // 检查是否为管理员
    const userId = request.headers.get('x-user-id') || '';
    const isAdmin = userId === 'admin';
    console.log(`[剧集生成] 用户ID: ${userId}, 是否管理员: ${isAdmin}`);

    // 读取用户实际选择的 LLM 模型（未配置则回退默认）
    const userConfig = userId ? await getUserConfig(userId) : null;
    const activeLlmModel = userConfig?.llm_model || DEFAULT_MODELS.llm;
    console.log(`[剧集生成] 使用 LLM 模型: ${activeLlmModel}`);

    if (!episodeNumber) {
      return NextResponse.json({ error: '请提供集数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
    }

    // 获取上一集信息（确保连续性）
    let previousEpisode = null;
    if (episodeNumber > 1) {
      const { data } = await supabase
        .from('drama_episodes')
        .select('episode_number, title, summary, cliffhanger')
        .eq('series_id', id)
        .eq('episode_number', episodeNumber - 1)
        .single();
      previousEpisode = data;
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 构建角色描述
    const charactersDesc = ((series.characters as unknown[]) || []).map((char: unknown) => {
      const c = char as Record<string, unknown>;
      return `${c.name}：${c.gender === 'male' ? '男' : '女'}，${c.age || '?'}岁，${c.temperament || ''}，${c.clothing || ''}`;
    }).join('；');

    const stylePrefix = `${series.style || '现代'}${series.genre || ''}短剧`;
    const seriesTitle = series.title || '短剧';

    // 匹配视觉风格
    const style = matchVisualStyle(series.genre as string);
    console.log(`[剧集生成] 风格: ${style.type}`);

    // 计算分镜数量（管理员15秒每镜约8-10个分镜，普通用户12秒每镜约10-12个分镜）
    // 目标总时长：管理员约180秒（15秒×12个），普通用户约144秒（12秒×12个）
    const targetTotalDuration = isAdmin ? 180 : 144;
    const storyboardCount = Math.max(
      STORYBOARD_COUNT_RULES.minCount,
      Math.min(STORYBOARD_COUNT_RULES.maxCount, STORYBOARD_COUNT_RULES.calculateCount(targetTotalDuration))
    );
    console.log(`[剧集生成] 用户类型: ${isAdmin ? '管理员' : '普通用户'}, 目标总时长: ${targetTotalDuration}秒, 分镜数量: ${storyboardCount}`);

    // 生成系统提示词（仅用于分镜，不包含hook和cliffhanger）
    const storyboardsSystemPrompt = generateStoryboardsSystemPrompt(storyboardCount, style, series.genre as string, isAdmin, activeLlmModel);

    // 用户提示词（仅用于分镜）
    const storyboardsUserPrompt = `第${episodeNumber}集分镜剧本生成

【⚠️ 关键提醒 - 避免内容重复】
- **开篇钩子(hook)已独立生成**：第1镜不要重复开篇钩子的内容和台词，应承接钩子氛围展开剧情
- **结尾悬念(cliffhanger)会独立生成**：最后一镜不要制造悬念，应让剧情暂时收束

【剧情背景】
${episodeNumber > 1 ? `承接上集悬念，开篇钩子已展示悬念场景` : '开篇钩子已展示开场冲突，这里从剧情展开开始'}

【剧本信息】
- 题材：${series.genre}
- 核心冲突：${series.core_conflict || '未指定'}
- 主要角色：${charactersDesc || '未指定'}

【输出要求】
1. 恰好${storyboardCount}个分镜（正片内容）
2. 每个分镜必须有visualPrompt（画面描述）
3. action要详细，包含表情动作
4. location要具体场景名
5. 只输出storyboards数组，hook和cliffhanger已独立生成，不要包含`;

    // ==================== 三步生成 ====================
    console.log('[剧集生成] 开始三步生成...');
    
    // 初始化结果
    let hookData: Record<string, unknown> | null = null;
    let storyboardsData: Record<string, unknown> | null = null;
    let cliffhangerData: Record<string, unknown> | null = null;
    let briefTitle = '';
    let episodeSummary = '';

    // ===== 第一步：生成开篇钩子(hook) =====
    console.log('[剧集生成] 步骤1：生成开篇钩子...');
    const hookPrompt = generateHookPrompt(
      style, 
      charactersDesc, 
      series.core_conflict as string || '', 
      episodeNumber,
      previousEpisode?.cliffhanger as string | undefined,
      series.genre as string | undefined,
      isAdmin,
      activeLlmModel
    );
    
    try {
      let hookContent = '';
      const hookStream = llmClient.stream([
        { role: 'user', content: hookPrompt }
      ], {
        model: activeLlmModel,
        temperature: 0.8, // 更高的温度增加创意
      });

      for await (const chunk of hookStream) {
        if (chunk.content) {
          hookContent += chunk.content.toString();
        }
      }
      
      hookData = parseJsonContent(hookContent);
      console.log('[剧集生成] 开篇钩子生成完成:', hookData ? '成功' : '失败');
    } catch (hookError) {
      console.error('[剧集生成] 开篇钩子生成失败:', hookError);
    }

    // ===== 第二步：生成分镜剧本(storyboards) =====
    console.log('[剧集生成] 步骤2：生成分镜剧本...');
    let fullContent = '';
    
    try {
      const stream = llmClient.stream([
        { role: 'system', content: storyboardsSystemPrompt },
        { role: 'user', content: storyboardsUserPrompt }
      ], {
        model: activeLlmModel,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        if (chunk.content) {
          fullContent += chunk.content.toString();
        }
      }
      console.log('[剧集生成] 分镜剧本生成完成，内容长度:', fullContent.length);
      
      storyboardsData = parseJsonContent(fullContent);
      if (storyboardsData) {
        briefTitle = storyboardsData.brief as string || '精彩剧情';
        episodeSummary = storyboardsData.summary as string || '';
      }
    } catch (streamError) {
      console.error('[剧集生成] 分镜剧本生成失败:', streamError);
      return NextResponse.json({ 
        error: '剧本生成失败：AI服务异常，请重试',
        details: streamError instanceof Error ? streamError.message : '未知错误'
      }, { status: 500 });
    }

    // ===== 第三步：生成结尾悬念(cliffhanger) =====
    console.log('[剧集生成] 步骤3：生成结尾悬念...');
    const cliffhangerPrompt = generateCliffhangerPrompt(
      style,
      charactersDesc,
      series.core_conflict as string || '',
      episodeNumber,
      episodeSummary || '剧情紧张发展',
      series.genre as string | undefined,
      isAdmin,
      activeLlmModel
    );
    
    const maxCliffhangerRetries = 2;
    for (let cliffRetry = 0; cliffRetry <= maxCliffhangerRetries; cliffRetry++) {
      try {
        let cliffhangerContent = '';
        console.log(`[剧集生成] 开始调用 LLM 生成结尾悬念... (第${cliffRetry + 1}次尝试)`);
        const cliffhangerStream = llmClient.stream([
          { role: 'user', content: cliffhangerPrompt }
        ], {
          model: activeLlmModel,
          temperature: 0.8 + cliffRetry * 0.1, // 重试时提高温度增加创意多样性
        });

        for await (const chunk of cliffhangerStream) {
          if (chunk.content) {
            cliffhangerContent += chunk.content.toString();
          }
        }
        
        console.log('[剧集生成] LLM 返回内容长度:', cliffhangerContent.length);
        console.log('[剧集生成] LLM 返回内容前200字符:', cliffhangerContent.substring(0, 200));
        
        cliffhangerData = parseJsonContent(cliffhangerContent);
        console.log('[剧集生成] 结尾悬念生成完成:', cliffhangerData ? '成功' : '失败');
        if (!cliffhangerData) {
          console.error('[剧集生成] parseJsonContent 返回 null，原始内容:', cliffhangerContent.substring(0, 500));
        }
        
        if (cliffhangerData) {
          break; // 成功则跳出重试循环
        }
        
        if (cliffRetry < maxCliffhangerRetries) {
          console.log(`[剧集生成] 结尾悬念解析失败，${2}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (cliffhangerError) {
        console.error(`[剧集生成] 结尾悬念生成失败 (第${cliffRetry + 1}次):`, cliffhangerError);
        if (cliffRetry < maxCliffhangerRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!cliffhangerData) {
      console.error('[剧集生成] 结尾悬念经过3次尝试仍然失败，将保存为null');
    }

    // ==================== 合并结果 ====================
    let episodeData: Record<string, unknown> = {
      title: `第${episodeNumber}集`,
      brief: briefTitle,
      summary: episodeSummary,
      hook: hookData || '',
      cliffhanger: cliffhangerData || '',
      storyboards: (storyboardsData?.storyboards as unknown[]) || [],
    };
    
    // 默认标题，确保后续解析失败时也有值
    const defaultTitle = `第${episodeNumber}集`;
    
    if (fullContent) {
      try {
        const content = fullContent.trim();
        console.log('[剧集生成] AI返回内容长度:', content.length);
        console.log('[剧集生成] AI返回内容前500字符:', content.substring(0, 500));
        console.log('[剧集生成] AI返回内容后200字符:', content.substring(content.length - 200));
        
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
          let jsonStr = content.slice(firstBrace, lastBrace + 1);
          console.log('[剧集生成] 提取JSON长度:', jsonStr.length);
          
          // JSON修复增强版 - 处理更复杂的情况
          // 1. 修复中文引号
          jsonStr = jsonStr.replace(/[""]/g, '"');
          // 2. 修复中文冒号（这是最常见的问题）
          jsonStr = jsonStr.replace(/：/g, ':');
          // 3. 修复中文逗号
          jsonStr = jsonStr.replace(/，/g, ',');
          // 4. 修复中文括号
          jsonStr = jsonStr.replace(/【/g, '[');
          jsonStr = jsonStr.replace(/】/g, ']');
          // 5. 修复尾部逗号（JSON标准不允许）
          jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
          // 6. 修复多余的冒号（如 "mood"：： → "mood":）
          jsonStr = jsonStr.replace(/"([^"]+)"::/g, '"$1":');
          // 7. 修复键名后的双冒号
          jsonStr = jsonStr.replace(/"(\w+)"\s*:\s*:/g, '"$1":');
          // 8. 修复字符串值中未转义的双引号（在冒号后面的字符串值内）
          // 这种情况下，需要找到每个 "key":"value" 模式，并转义 value 中未转义的双引号
          // 使用更安全的正则：检测字符串值内部的双引号（不在开头的）
          // 匹配 "key":"value" 模式，value 中的 " 需要转义为 \"
          jsonStr = jsonStr.replace(/"([^"]+)":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, key, value) => {
            // 如果 value 中有不配对的双引号，需要转义
            // 检查 value 是否已经以 " 开头且以 " 结尾（已经是正确的JSON字符串）
            // 这里简单处理：如果 value 中有未转义的双引号，进行转义
            const escapedValue = value.replace(/(?<!\\)"(?!")/g, '\\"');
            return `"${key}": "${escapedValue}"`;
          });
          
          console.log('[剧集生成] JSON增强修复后前200字符:', jsonStr.substring(0, 200));
          
          // 尝试直接解析
          try {
            episodeData = JSON.parse(jsonStr);
            console.log('[剧集生成] JSON解析成功');
          } catch (firstError) {
            console.error('[剧集生成] 首次JSON解析失败:', firstError);
            console.log('[剧集生成] 失败位置附近内容:', jsonStr.substring(Math.max(0, 11800), 12100));
            
            // 尝试修复：移除注释和多余空白
            jsonStr = jsonStr.replace(/\/\/.*$/gm, ''); // 移除单行注释
            jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释
            
            try {
              episodeData = JSON.parse(jsonStr);
              console.log('[剧集生成] JSON解析成功（移除注释后）');
            } catch (_secondError) {
              console.error('[剧集生成] 二次JSON解析失败，尝试提取storyboards');
              
              // 最后尝试：提取storyboards数组
              try {
                const storyboardsMatch = jsonStr.match(/"storyboards"\s*:\s*\[/);
                if (storyboardsMatch) {
                  const sbStart = jsonStr.indexOf('"storyboards"');
                  const arrStart = jsonStr.indexOf('[', sbStart);
                  let depth = 0;
                  let arrEnd = arrStart;
                  let inString = false;
                  let escape = false;
                  
                  for (let i = arrStart; i < jsonStr.length; i++) {
                    const char = jsonStr[i];
                    
                    if (escape) {
                      escape = false;
                      continue;
                    }
                    
                    if (char === '\\') {
                      escape = true;
                      continue;
                    }
                    
                    if (char === '"') {
                      inString = !inString;
                      continue;
                    }
                    
                    if (!inString) {
                      if (char === '[') depth++;
                      if (char === ']') {
                        depth--;
                        if (depth === 0) {
                          arrEnd = i + 1;
                          break;
                        }
                      }
                    }
                  }
                  
                  let storyboardsStr = jsonStr.substring(arrStart, arrEnd);
                  
                  // 对提取的storyboards字符串也应用JSON修复
                  storyboardsStr = storyboardsStr.replace(/[""]/g, '"');
                  storyboardsStr = storyboardsStr.replace(/：/g, ':');
                  storyboardsStr = storyboardsStr.replace(/，/g, ',');
                  storyboardsStr = storyboardsStr.replace(/【/g, '[');
                  storyboardsStr = storyboardsStr.replace(/】/g, ']');
                  storyboardsStr = storyboardsStr.replace(/,(\s*[}\]])/g, '$1');
                  storyboardsStr = storyboardsStr.replace(/"(\w+)"\s*:\s*:/g, '"$1":');
                  
                  // 对 storyboardsStr 中的字符串值也进行引号转义
                  storyboardsStr = storyboardsStr.replace(/"([^"]+)":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, key, value) => {
                    const escapedValue = value.replace(/(?<!\\)"(?!")/g, '\\"');
                    return `"${key}": "${escapedValue}"`;
                  });
                  
                  const parsedStoryboards = JSON.parse(storyboardsStr) as unknown[];
                  episodeData.storyboards = parsedStoryboards;
                  console.log('[剧集生成] 成功提取storyboards:', parsedStoryboards.length, '个分镜');
                  
                  // 尝试提取其他字段
                  const briefMatch = jsonStr.match(/"brief"\s*:\s*"([^"]+)"/);
                  if (briefMatch) episodeData.brief = briefMatch[1];
                  
                  const summaryMatch = jsonStr.match(/"summary"\s*:\s*"([^"]+)"/);
                  if (summaryMatch) episodeData.summary = summaryMatch[1];
                  
                  const hookMatch = jsonStr.match(/"hook"\s*:\s*"([^"]+)"/);
                  if (hookMatch) episodeData.hook = hookMatch[1];
                  
                  const cliffhangerMatch = jsonStr.match(/"cliffhanger"\s*:\s*"([^"]+)"/);
                  if (cliffhangerMatch) episodeData.cliffhanger = cliffhangerMatch[1];
                }
              } catch (extractError) {
                console.error('[剧集生成] storyboards提取失败:', extractError);
                // 返回错误让前端知道需要重试
                return NextResponse.json({ 
                  error: '剧本生成失败：AI返回格式异常，请重试',
                  details: 'JSON解析失败'
                }, { status: 500 });
              }
            }
          }
        }
      } catch (e) {
        console.error('[剧集生成] JSON处理异常:', e);
        return NextResponse.json({ 
          error: '剧本生成失败：处理异常',
          details: e instanceof Error ? e.message : '未知错误'
        }, { status: 500 });
      }
    }

    // 清理错误格式：过滤 File: 和 URL: 格式
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
    
    episodeData = cleanFieldValue(episodeData) as Record<string, unknown>;
    console.log('[剧集生成] 已清理错误格式');

    // 确保title字段有值
    if (!episodeData.title || typeof episodeData.title !== 'string' || episodeData.title.trim() === '') {
      episodeData.title = defaultTitle;
    }

    // 验证brief字段
    const briefValue = episodeData.brief as string;
    if (!briefValue || briefValue.trim().length < 2) {
      const summaryText = (episodeData.summary as string) || '';
      episodeData.brief = summaryText.replace(/^[第0-9]+集[,，]?/, '').slice(0, 6) || '精彩剧情';
    } else {
      episodeData.brief = briefValue.trim().slice(0, 6);
    }

    // 确保storyboards存在
    if (!episodeData.storyboards || !Array.isArray(episodeData.storyboards)) {
      episodeData.storyboards = [];
    }

    // 获取当前用户的时长规则
    const modelMaxDuration = getVideoModelMaxDuration(undefined);
    
    // 验证并补全每个分镜
    const validatedStoryboards = (episodeData.storyboards as Array<Record<string, unknown>>).map((sb, index) => {
      const seq = typeof sb.seq === 'number' ? sb.seq : (typeof sb.sequence === 'number' ? sb.sequence : index + 1);
      const shotType = typeof sb.shotType === 'string' ? sb.shotType : (typeof sb.shot === 'string' ? sb.shot : '中景');
      const stage = sb.stage as string || getStageBySeq(seq as number, storyboardCount);
      
      // 时长控制：根据视频模型动态决定（Seedance 2.0 全量启用后统一15秒）
      let duration = typeof sb.duration === 'number' ? sb.duration : (typeof sb.dur === 'number' ? sb.dur : 0);
      duration = Math.min(duration, modelMaxDuration);
      if (duration < 4) {
        duration = getDurationByShot(shotType as string, modelMaxDuration >= 15);
      }
      
      // 新格式字段 - 保留原始数据
      const newLocation = typeof sb.location === 'string' ? sb.location : '';
      const newDescription = typeof sb.description === 'string' ? sb.description : '';
      const newCharacterList = Array.isArray(sb.characterList) ? sb.characterList as string[] : undefined;
      const newTimeDescriptions = sb.timeDescriptions as Record<string, string> | string[] | undefined;

      const location = newLocation || typeof sb.location === 'string' ? sb.location : ((sb.scene as Record<string, unknown>)?.location as string) || '室内';
      const charAction = typeof sb.action === 'string' ? sb.action : (typeof sb.char === 'string' ? sb.char : '');
      
      // 处理对话数据 - 支持两种格式：
      // 1. 新格式：dialogues数组（多句对话）
      // 2. 旧格式：dialogue对象（单句对话）
      let dialogues: Array<{ speaker: string; content: string; emotion: string; speechRate?: string }> = [];
      
      // 优先使用新的dialogues数组格式
      const rawDialogues = sb.dialogues as Array<{ speaker?: string; content?: string; emotion?: string; speechRate?: string }> | null;
      if (Array.isArray(rawDialogues) && rawDialogues.length > 0) {
        dialogues = rawDialogues.map(d => ({
          speaker: d.speaker || '角色',
          content: d.content || '',
          emotion: d.emotion || '平静',
          speechRate: d.speechRate || getSpeechRate(d.emotion),
        }));
      } else {
        // 兼容旧的dialogue格式
        const rawDialogue = sb.dialogue as { speaker?: string; content?: string; emotion?: string; speechRate?: string } | null;
        if (rawDialogue && (rawDialogue.content || rawDialogue.speaker)) {
          dialogues = [{
            speaker: rawDialogue.speaker || '角色',
            content: rawDialogue.content || '',
            emotion: rawDialogue.emotion || '平静',
            speechRate: rawDialogue.speechRate || getSpeechRate(rawDialogue.emotion),
          }];
        }
      }
      
      // 为了向后兼容，也保留单个dialogue字段
      const dialogue = dialogues.length > 0 ? dialogues[0] : null;
      
      const narration = sb.narration as string | null;
      const emotion = sb.emotion as string || '平静';
      
      // 顶配爆款版字段
      const scene = sb.scene as string || '';
      const action = sb.action as string || '';
      const closeup = sb.closeup as string || '';
      const style = sb.style as string || '';
      const bgmAtmosphere = sb.bgmAtmosphere as string || '';
      const aspectRatio = sb.aspectRatio as string || '9:16';
      
      // 兼容旧字段
      const visualPrompt = sb.visualPrompt as string || '';
      const cameraMovement = sb.cameraMovement as string || '固定';
      const mood = sb.mood as string || '平静';
      
      // 转换characters格式：字符串数组 -> 对象数组
      let characters: Array<{ name: string }> = [];
      if (Array.isArray(sb.characters)) {
        characters = sb.characters.map((char: unknown) => {
          if (typeof char === 'string') {
            return { name: char };
          }
          if (typeof char === 'object' && char !== null) {
            return { name: String((char as Record<string, unknown>).name || '未知角色') };
          }
          return { name: '未知角色' };
        });
      }
      
      // 检查对话归属：speaker是否在镜头人物中
      let isOffScreenDialogue = false; // 是否为画外音
      if (dialogue?.speaker) {
        const speakerInScene = characters.some(c => c.name === dialogue.speaker);
        if (!speakerInScene) {
          // speaker不在镜头中，标记为画外音
          isOffScreenDialogue = true;
          console.log(`[分镜${seq}] 对话归属警告: "${dialogue.speaker}"不在镜头人物[${characters.map(c => c.name).join(', ')}]中，标记为画外音`);
        }
      }
      
      // 构建镜头人物描述 - 明确指出镜头中有谁
      const charactersInShot = characters.map(c => c.name).join('和');
      const charactersDesc = characters.length > 0 ? `镜头中有${charactersInShot}` : '';
      
      // 构建视频提示词 - 优先使用顶配爆款版字段
      let videoPrompt = '';
      
      // 优先使用顶配爆款版字段
      if (scene && action) {
        // 顶配爆款版格式：scene + cameraMovement + action + closeup + style
        videoPrompt = `${stylePrefix}`;
        if (style) {
          videoPrompt += `，${style}`;
        }
        videoPrompt += `，${shotType}，${scene}`;
        if (cameraMovement) {
          videoPrompt += `，${cameraMovement}`;
        }
        videoPrompt += `，${action}`;
        if (closeup) {
          videoPrompt += `，${closeup}`;
        }
        if (bgmAtmosphere) {
          videoPrompt += `。氛围：${bgmAtmosphere}`;
        }
      } else if (visualPrompt && visualPrompt.length > 10) {
        // 兼容旧格式：使用AI生成的visualPrompt
        videoPrompt = `${stylePrefix}，${shotType}，${charactersDesc}。${visualPrompt}`;
        if (charAction) {
          videoPrompt += `，${charAction}`;
        }
      } else {
        // 降级：自动构建提示词
        videoPrompt = `${stylePrefix}，${shotType}，${charactersDesc}。${location}，${charAction}`;
        if (mood && mood !== '平静') {
          videoPrompt += `，${mood}氛围`;
        }
      }
      
      // 添加镜头运动提示
      if (cameraMovement && cameraMovement !== '固定') {
        videoPrompt += `，镜头${cameraMovement}`;
      }
      
      // 添加面部表情描述（如果有对话或情感）
      // 面部表情应该在对话之前展示，让观众看到人物的情感状态
      if (dialogue?.emotion && !isOffScreenDialogue) {
        const facialExpr = getFacialExpression(dialogue.emotion);
        if (facialExpr) {
          videoPrompt += `，${dialogue.speaker}${facialExpr}`;
        }
      } else if (emotion && emotion !== '平静' && characters.length > 0) {
        // 如果没有对话但有情感标签，为主要人物添加表情
        const facialExpr = getFacialExpression(emotion);
        if (facialExpr) {
          const mainChar = characters[0].name;
          videoPrompt += `，${mainChar}${facialExpr}`;
        }
      }
      
      // 添加对话（如果有）- 支持多句对话
      // 关键：旁白（画外音）时人物不说话，只有镜头内对话才有人物说话动作
      // Seedance 1.5 pro 要求：对话内容用双引号包裹以优化音频生成效果
      if (dialogues.length > 0) {
        // 分离画外音和镜头内对话
        const offScreenDialogues: Array<{ speaker: string; content: string; emotion: string; speechRate?: string }> = [];
        const onScreenDialogues: Array<{ speaker: string; content: string; emotion: string; speechRate?: string }> = [];
        
        dialogues.forEach(d => {
          const currentSpeakerInScene = characters.some(c => c.name === d.speaker);
          if (currentSpeakerInScene) {
            onScreenDialogues.push(d);
          } else {
            offScreenDialogues.push(d);
          }
        });
        
        // 先添加镜头内对话（镜头中的人物说话）
        if (onScreenDialogues.length > 0) {
          onScreenDialogues.forEach(d => {
            const emotionDesc = getEmotionDescription(d.emotion);
            const speechRateDesc = d.speechRate ? getSpeechRateDescription(d.speechRate) : '';
            videoPrompt += `，${d.speaker}${emotionDesc}${speechRateDesc}说："${d.content}"`;
          });
        }
        
        // 再添加画外音（镜头外的人说话或旁白）
        if (offScreenDialogues.length > 0) {
          videoPrompt += `。`;
          offScreenDialogues.forEach((d, idx) => {
            const emotionDesc = getEmotionDescription(d.emotion);
            if (idx === 0) {
              videoPrompt += `【画外音】${d.speaker}${emotionDesc}说："${d.content}"`;
            } else {
              videoPrompt += `。【画外音】${d.speaker}${emotionDesc}说："${d.content}"`;
            }
          });
        }
      } else if (dialogue?.content) {
        // 兼容旧的单句对话格式
        const emotionDesc = getEmotionDescription(dialogue.emotion);
        const speechRateDesc = dialogue.speechRate ? getSpeechRateDescription(dialogue.speechRate) : '';
        
        if (isOffScreenDialogue) {
          videoPrompt += `。【画外音】${dialogue.speaker}${emotionDesc}说："${dialogue.content}"`;
        } else {
          videoPrompt += `，${dialogue.speaker}${emotionDesc}${speechRateDesc}说："${dialogue.content}"`;
        }
      }
      
      const storyboardName = `${seriesTitle}第${episodeNumber}集第${seq}镜`;
      
      return {
        id: `sb-${episodeNumber}-${seq}`,
        name: storyboardName,
        sequence: seq,
        stage,
        type: getTypeByStage(stage),
        duration,
        shotType,
        // 新格式字段（优先使用）
        ...(newLocation && { location: newLocation }),
        ...(newDescription && { description: newDescription }),
        ...(newCharacterList && { characterList: newCharacterList }),
        ...(newTimeDescriptions && { timeDescriptions: newTimeDescriptions }),
        // 场景信息：优先使用顶配爆款版 scene 字符串，否则使用旧的对象格式
        scene: scene || { 
          location, 
          description: charAction || visualPrompt || location 
        },
        characters,
        // 动作描述：优先使用顶配爆款版 action，否则使用 charAction
        action: action || charAction,
        dialogue: dialogue ? {
          ...dialogue,
          isOffScreen: isOffScreenDialogue, // 标记是否为画外音
        } : null,
        dialogues: dialogues.length > 0 ? dialogues.map(d => ({
          ...d,
          isOffScreen: !characters.some(c => c.name === d.speaker), // 标记是否为画外音
        })) : null,
        narration,
        emotion,
        // 顶配爆款版字段
        cameraMovement,
        closeup,
        style,
        bgmAtmosphere,
        aspectRatio,
        // 兼容旧字段
        visualPrompt,
        mood,
        videoGeneration: {
          prompt: videoPrompt,
          duration,
          ratio: '9:16',
          resolution: '1080p',
        },
        atmosphere: { tension: getTensionByStage(stage) },
        isKeyframe: sb.isKeyframe as boolean || false,
      };
    });

    episodeData.storyboards = validatedStoryboards;

    // 处理hook和cliffhanger
    // 重要：hook和cliffhanger应该是独立的JSON对象，不要fallback到分镜内容
    const hookName = `${seriesTitle}第${episodeNumber}集开场`;
    const cliffhangerName = `${seriesTitle}第${episodeNumber}集结尾`;
    
    // 从请求头获取用户视频模型配置（默认 Seedance 2.0）
    const userVideoModel = request.headers.get('x-user-video-model') || 'doubao-seedance-2-0-260128';
    
    // 视频时长：根据视频模型决定
    // Seedance 2.0 最大支持15秒（已全量启用）
    // Seedance 1.5 Pro 最大支持12秒
    const hookCliffhangerDuration = getVideoModelMaxDuration(userVideoModel);
    console.log(`[剧集生成] 视频模型: ${userVideoModel}, 开篇钩子/结尾悬念时长: ${hookCliffhangerDuration}秒`);
    
    // 确保hook是正确的格式，并强制设置正确的duration
    if (hookData && typeof hookData === 'object') {
      // AI成功生成了hook，确保格式正确，并强制设置duration
      episodeData.hook = {
        ...hookData,
        name: hookName,
        duration: hookCliffhangerDuration, // 强制覆盖为正确的时长
      };
    } else {
      // hook生成失败，记录警告，不要使用分镜内容
      console.warn('[剧集生成] 开篇钩子生成失败，将在后续生成');
      episodeData.hook = null;
    }
    
    // 确保cliffhanger是正确的格式，并强制设置正确的duration
    if (cliffhangerData && typeof cliffhangerData === 'object') {
      // AI成功生成了cliffhanger，确保格式正确，并强制设置duration
      episodeData.cliffhanger = {
        ...cliffhangerData,
        name: cliffhangerName,
        duration: hookCliffhangerDuration, // 强制覆盖为正确的时长
      };
    } else {
      // cliffhanger生成失败，记录警告，不要使用分镜内容
      console.warn('[剧集生成] 结尾悬念生成失败，将在后续生成');
      episodeData.cliffhanger = null;
    }

    if (!episodeData.summary) {
      episodeData.summary = `精彩剧情，共${validatedStoryboards.length}个镜头。`;
    }

    // 保存到数据库
    const { data: existingEpisode } = await supabase
      .from('drama_episodes')
      .select('id')
      .eq('series_id', id)
      .eq('episode_number', episodeNumber)
      .single();

    let savedEpisode = null;
    
    if (existingEpisode) {
      console.log('[剧集生成] 准备更新现有剧集，cliffhanger 数据:', episodeData.cliffhanger ? '有数据' : '无数据');
      const { data, error: updateError } = await supabase
        .from('drama_episodes')
        .update({
          title: episodeData.title as string,
          brief: (episodeData.brief as string)?.slice(0, 6) || '精彩剧情',
          summary: episodeData.summary as string,
          hook: episodeData.hook ? JSON.stringify(episodeData.hook) : null,
          cliffhanger: episodeData.cliffhanger ? JSON.stringify(episodeData.cliffhanger) : null,
          storyboards: episodeData.storyboards,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingEpisode.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('[剧集生成] 更新剧集失败:', updateError);
      } else {
        console.log('[剧集生成] 更新剧集成功，cliffhanger 已保存:', data?.cliffhanger ? '是' : '否');
        if (!updateError) savedEpisode = data;
      }
    } else {
      console.log('[剧集生成] 准备插入新剧集，cliffhanger 数据:', episodeData.cliffhanger ? '有数据' : '无数据');
      console.log('[剧集生成] cliffhanger 类型:', typeof episodeData.cliffhanger);
      console.log('[剧集生成] cliffhanger 值:', JSON.stringify(episodeData.cliffhanger)?.substring(0, 200));
      
      const { data, error: insertError } = await supabase
        .from('drama_episodes')
        .insert({
          series_id: id,
          episode_number: episodeNumber,
          title: episodeData.title as string,
          brief: (episodeData.brief as string)?.slice(0, 6) || '精彩剧情',
          summary: episodeData.summary as string,
          hook: episodeData.hook ? JSON.stringify(episodeData.hook) : null,
          cliffhanger: episodeData.cliffhanger ? JSON.stringify(episodeData.cliffhanger) : null,
          storyboards: episodeData.storyboards,
          status: 'completed',
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('[剧集生成] 插入剧集失败:', insertError);
      } else {
        console.log('[剧集生成] 插入剧集成功，cliffhanger 已保存:', data?.cliffhanger ? '是' : '否');
      }
      
      if (!insertError) savedEpisode = data;
    }

    // 检查分镜数量是否达标
    const actualCount = validatedStoryboards.length;
    const minCount = STORYBOARD_COUNT_RULES.minCount;
    const warning = actualCount < minCount 
      ? `⚠️ 分镜数量不足：AI生成了${actualCount}个分镜，要求至少${minCount}个。建议重新生成。`
      : undefined;

    return NextResponse.json({
      success: true,
      episode: savedEpisode || episodeData,
      metadata: {
        llmModel: activeLlmModel,
        videoModel: userConfig?.video_model || DEFAULT_MODELS.video,
        storyboardCount: actualCount,
        expectedCount: storyboardCount,
        totalDuration: validatedStoryboards.reduce((sum, sb) => sum + (sb.duration || 8), 0),
      },
      warning,
    });

  } catch (error) {
    console.error('[剧集生成] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '剧集生成失败' },
      { status: 500 }
    );
  }
}

// GET - 获取剧集列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: episodes, error } = await supabase
    .from('drama_episodes')
    .select('*')
    .eq('series_id', id)
    .order('episode_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: '获取剧集失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true, episodes: episodes || [] });
}
