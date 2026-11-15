/**
 * 视频生成提示词优化模块
 *
 * 目标：把剧本的分镜时间点描述（timeDescriptions）转换为
 * 视频生成模型（Seedance 等）最容易理解的「纯画面」电影语言提示词。
 *
 * 优化要点：
 * 1. 只保留视觉信息：剔除对话台词、配音/音色描述、字幕、图片引用
 * 2. 保留角色立绘引用标记（@角色名），让视频模型从首帧图获取角色外观
 * 3. 结合角色外观描述（发型/服装），强化角色视觉一致性
 * 4. 结合场景图氛围描述，让画面与场景图风格统一
 * 5. 电影语言重组：场景环境 → 有序的景别+动作/表情/光影
 * 6. 镜头衔接词：帮助模型在单条视频内理解多个镜头的时间顺序
 * 7. 统一的质感后缀：真人短剧、影视布光、无字幕水印
 */

import { getVideoPromptProfile } from './model-prompt-profiles';

export interface VideoShotInput {
  timeRange?: string;
  shotType: string;
  visualDescription: string;
}

/** 角色信息（用于结合立绘图片增强提示词） */
export interface CharacterInfo {
  name: string;
  /** 外观描述（发型、服装等，从立绘 generation_prompt 提取） */
  appearance?: string;
}

/** 场景信息（用于结合场景图增强提示词） */
export interface SceneInfo {
  location: string;
  /** 场景氛围描述（光线、色调、环境细节） */
  atmosphere?: string;
  /** 时间段（日/夜/黄昏等） */
  timeOfDay?: string;
}

/** 景别归一化映射（各种写法 → 模型友好的镜头语言） */
const SHOT_TYPE_MAP: Array<{ keys: string[]; label: string }> = [
  { keys: ['大远景', '超远景', '航拍远景'], label: '大远景镜头' },
  { keys: ['远景', '全景远景'], label: '远景镜头' },
  { keys: ['大全景', '全景'], label: '全景镜头' },
  { keys: ['全身', '全身景'], label: '全景镜头' },
  { keys: ['中远景', '膝上景', '牛仔'], label: '中远景镜头' },
  { keys: ['中景'], label: '中景镜头' },
  { keys: ['中近景', '半身'], label: '中近景镜头' },
  { keys: ['近景'], label: '近景镜头' },
  { keys: ['过肩', '肩后'], label: '过肩镜头' },
  { keys: ['主观视角', '主观镜头', '第一人称', 'POV', 'pov'], label: '主观视角镜头' },
  { keys: ['大特写', '极度特写', '极致特写'], label: '大特写镜头' },
  { keys: ['特写'], label: '特写镜头' },
  { keys: ['俯拍', '俯视', '高角度', '上帝视角'], label: '高角度俯拍镜头' },
  { keys: ['仰拍', '仰视', '低角度'], label: '低角度仰拍镜头' },
  { keys: ['荷兰角', '倾斜构图', '斜角'], label: '倾斜构图镜头' },
];

/** 镜头之间的衔接词（按顺序使用，让模型理解镜头推进关系） */
const SHOT_CONNECTORS = ['开场为', '随后切至', '接着切至', '镜头再转至', '紧接着是', '最后以'];

/** 统一的画面质感后缀（默认；调用方传入 videoModel 时会按模型覆盖） */
const STYLE_SUFFIX =
  '真人实拍短剧风格，电影感构图，专业影视布光，色彩自然通透，人物服装造型精致一致，表情细腻，动作连贯流畅，超高清画质，画面中无字幕、无水印、无文字';

/**
 * 将剧本分镜结构构建为视频生成模型可用的电影语言提示词
 *
 * @param shots 分镜时间点列表
 * @param location 场景位置名称
 * @param options 可选的角色和场景增强信息
 */
export function buildCinematicVideoPrompt(
  shots: VideoShotInput[],
  location: string,
  options?: {
    characters?: CharacterInfo[];
    scene?: SceneInfo;
    /** 目标视频生成模型 ID，用于按模型偏好调整语序与质感后缀 */
    videoModel?: string;
  }
): string {
  if (!shots || shots.length === 0) return '';

  const validShots = shots.filter((s) => s && s.visualDescription && s.visualDescription.trim());
  if (validShots.length === 0) return '';

  const parts: string[] = [];
  const { characters, scene } = options || {};

  // 1. 场景环境开头（结合场景图氛围）
  const cleanLocation = sanitizeText(location);
  if (cleanLocation) {
    let sceneDesc = `场景：${cleanLocation}`;
    if (scene?.atmosphere) {
      sceneDesc += `，${sanitizeText(scene.atmosphere)}`;
    }
    if (scene?.timeOfDay) {
      sceneDesc += `，${scene.timeOfDay}`;
    }
    sceneDesc += '，环境氛围与时代背景贴合剧情';
    parts.push(sceneDesc);
  }

  // 2. 角色外观描述（结合立绘图片，强化视觉一致性）
  if (characters && characters.length > 0) {
    const charDescs: string[] = [];
    for (const char of characters) {
      if (char.appearance) {
        // 使用 @角色名 标记，让视频模型从首帧图获取角色外观
        charDescs.push(`@${char.name}：${sanitizeText(char.appearance)}`);
      }
    }
    if (charDescs.length > 0) {
      parts.push(`角色外观（与首帧参考图保持一致）：${charDescs.join('；')}`);
    }
  }

  // 3. 逐镜头组装：景别 + 纯画面描述
  validShots.forEach((shot, index) => {
    const shotLabel = normalizeShotType(shot.shotType);
    const visual = cleanVisualDescription(shot.visualDescription);
    if (!visual) return;

    const connector = SHOT_CONNECTORS[Math.min(index, SHOT_CONNECTORS.length - 1)];
    parts.push(`${connector}${shotLabel}，${visual}`);
  });

  // 4. 质感后缀（按目标视频模型调整）
  parts.push(options?.videoModel ? getVideoPromptProfile(options.videoModel).qualitySuffix : STYLE_SUFFIX);

  return parts.join('；') + '。';
}

/**
 * 归一化景别名称
 */
function normalizeShotType(rawType: string): string {
  const type = (rawType || '').trim();
  for (const { keys, label } of SHOT_TYPE_MAP) {
    if (keys.some((k) => type.includes(k))) {
      return label;
    }
  }
  // 未命中但有内容（如“环绕”“特写运镜”等），直接清洗后使用
  const cleaned = type.replace(/[【】\[\]（）()]/g, '').trim();
  return cleaned ? `${cleaned}镜头` : '中景镜头';
}

/**
 * 清洗单条画面描述：
 * - 去掉 @ 标记（保留角色名）
 * - 去掉台词引号内容
 * - 去掉配音/音色说明
 * - 去掉图片/场景引用标记
 * - 去掉“对XX说/说道：”这类指向台词的残句
 */
function cleanVisualDescription(raw: string): string {
  let text = sanitizeText(raw);

  // 1. 去掉图片引用：[图片1]、[人物立绘]、[场景照]、Image: [...]
  text = text.replace(/\[?(?:图片\s*\d+|人物立绘|场景照)\]?/g, '');
  text = text.replace(/Image\s*:\s*\[[^\]]*\]/gi, '');

  // 2. 去掉配音/音色/旁白说明（中英文括号内）
  text = text.replace(/[（(][^（）()]*?(?:音色|音调|发音|声线|男声|女声|旁白|配音|口吻)[^（）()]*?[）)]/g, '');

  // 3. 去掉台词内容：中文引号 “...” 「...」 和英文引号 "..." 内的内容
  text = text.replace(/[“「『"][^“”「」『』"]*[”」』"]/g, '');
  text = text.replace(/"[^"]*"/g, '');

  // 4. 保留 @角色名 标记（让视频模型从首帧图获取角色外观一致性）
  // 不删除 @ 符号，视频模型通过 @角色名 关联首帧参考图中的角色形象

  // 5. 去掉指向台词的残句：
  //    如 “对沈天豪说：” “转头说道：” “，沉声开口” 等结尾说话动作
  text = text.replace(
    /[，,、\s]*[对向与]?[^，,。；;：:]{0,12}?(?:对[^，,。；;：:]{1,10}?)?(?:说|道|开口|问道|回道|答道|喊道|低声道|沉声道|冷声道|说道|说着|质问|回答)[道]?[：:]?\s*$/g,
    ''
  );
  // 去掉句中残留的 “说：” “说道：” 等
  text = text.replace(/[，,、]?\s*(?:说|道|说道|开口道|说罢|说完)[：:]?/g, '，');

  // 6. 收尾标点整理
  text = text
    .replace(/[，,、；;：:\s]+([。！？]|$)/g, '$1')
    .replace(/[，,、；;]{2,}/g, '，')
    .replace(/^[，,、；;：:\s]+/, '')
    .replace(/[，,、；;：:\s]+$/, '')
    .trim();

  return text;
}

/**
 * 基础文本清洗：统一标点、去除杂讯
 */
function sanitizeText(raw: string): string {
  if (!raw) return '';
  let text = String(raw);

  // 去掉镜头标记括号（景别单独处理，描述里不再保留【】）
  text = text.replace(/[【】]/g, '');

  // 全角空格、换行压平
  text = text.replace(/[\r\n\t]+/g, '，').replace(/\u3000/g, ' ');

  // 多空格压缩
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}
