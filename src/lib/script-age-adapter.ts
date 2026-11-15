/**
 * 剧本年龄适配工具
 * 根据角色年龄调整剧本中的语言风格、行为特征、对话方式
 */

import {
  getAgeGroup,
  AGE_GROUP_BOUNDARIES,
  AGE_BEHAVIOR_FEATURES,
  AGE_VOICE_FEATURES,
  type AgeGroup,
} from './age-features';

/**
 * 角色信息（用于剧本适配）
 */
export interface CharacterForScript {
  name: string;
  age: number;
  gender: 'male' | 'female';
  type?: 'protagonist' | 'supporting' | 'antagonist';
  personality?: string;
  background?: string;
}

/**
 * 年龄适配的角色描述
 */
export interface AgeAdaptedCharacter {
  name: string;
  age: number;
  ageGroup: AgeGroup;
  ageLabel: string;
  gender: 'male' | 'female';
  
  // 适配后的特征
  personalityTraits: string[];
  speechStyle: string[];
  behaviorPatterns: string[];
  emotionalExpression: string[];
  
  // 对话提示
  dialogueHints: string[];
  
  // 动作提示
  actionHints: string[];
  
  // 完整的角色描述（用于AI）
  characterPrompt: string;
}

/**
 * 适配角色特征
 */
export function adaptCharacterForScript(character: CharacterForScript): AgeAdaptedCharacter {
  const { name, age, gender, type, personality, background } = character;
  const ageGroup = getAgeGroup(age);
  const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;
  const behavior = AGE_BEHAVIOR_FEATURES[ageGroup];
  const voice = AGE_VOICE_FEATURES[ageGroup];
  
  // 根据年龄分组获取特征
  const personalityTraits = behavior.personality.slice(0, 3);
  const speechStyle = behavior.speechPattern.slice(0, 3);
  const behaviorPatterns = behavior.commonActions.slice(0, 3);
  const emotionalExpression = behavior.emotionalExpression.slice(0, 2);
  
  // 生成对话提示
  const dialogueHints = generateDialogueHints(ageGroup, gender, personality);
  
  // 生成动作提示
  const actionHints = generateActionHints(ageGroup, gender);
  
  // 构建完整角色描述
  const characterPrompt = buildCharacterPrompt(name, age, ageGroup, gender, {
    personalityTraits,
    speechStyle,
    behaviorPatterns,
    emotionalExpression,
    type,
    background,
  });
  
  return {
    name,
    age,
    ageGroup,
    ageLabel,
    gender,
    personalityTraits,
    speechStyle,
    behaviorPatterns,
    emotionalExpression,
    dialogueHints,
    actionHints,
    characterPrompt,
  };
}

/**
 * 生成对话提示
 */
function generateDialogueHints(
  ageGroup: AgeGroup,
  gender: 'male' | 'female',
  customPersonality?: string
): string[] {
  const hints: string[] = [];
  const behavior = AGE_BEHAVIOR_FEATURES[ageGroup];
  
  // 基于年龄的对话风格
  const ageDialogueMap: Record<AgeGroup, string[]> = {
    child: [
      '用简单的词汇和短句',
      '经常问"为什么"',
      '说话直接，不拐弯抹角',
      '会撒娇或哭闹',
      '语气天真无邪',
    ],
    youth: [
      '使用流行词汇和网络用语',
      '说话直接、坦率',
      '语气热情或叛逆',
      '喜欢用感叹词',
      '偶尔会有青春期的冲动表达',
    ],
    adult: [
      '说话稳重、有逻辑',
      '用词准确、得体',
      '语气沉稳、自信',
      '善于说服和引导',
      '有时会有成年人特有的幽默',
    ],
    elderly: [
      '说话缓慢、语重心长',
      '喜欢说"想当年"',
      '经常讲道理、传授经验',
      '语气慈祥或有时固执',
      '用词传统、正式',
    ],
  };
  
  hints.push(...ageDialogueMap[ageGroup]);
  
  // 基于性别的对话特点
  if (gender === 'female') {
    if (ageGroup === 'child') {
      hints.push('语气更加软萌可爱');
    } else if (ageGroup === 'youth') {
      hints.push('语气活泼俏皮');
    } else if (ageGroup === 'adult') {
      hints.push('语气温和坚定');
    } else {
      hints.push('语气慈祥温暖');
    }
  } else {
    if (ageGroup === 'child') {
      hints.push('语气活泼调皮');
    } else if (ageGroup === 'youth') {
      hints.push('语气阳光自信');
    } else if (ageGroup === 'adult') {
      hints.push('语气沉稳有力');
    } else {
      hints.push('语气沧桑睿智');
    }
  }
  
  // 自定义性格
  if (customPersonality) {
    hints.push(`性格特点：${customPersonality}`);
  }
  
  return hints;
}

/**
 * 生成动作提示
 */
function generateActionHints(
  ageGroup: AgeGroup,
  gender: 'male' | 'female'
): string[] {
  const behavior = AGE_BEHAVIOR_FEATURES[ageGroup];
  const hints: string[] = [];
  
  // 基于年龄的动作特点
  const ageActionMap: Record<AgeGroup, string[]> = {
    child: [
      '喜欢蹦蹦跳跳',
      '经常撒娇',
      '动作活泼',
      '会拉着大人的手',
      '喜欢玩玩具',
    ],
    youth: [
      '动作充满活力',
      '喜欢运动',
      '举止自信',
      '有时冲动',
      '喜欢玩手机',
    ],
    adult: [
      '动作稳重得体',
      '举止专业',
      '做事有条理',
      '行为从容',
      '善于社交',
    ],
    elderly: [
      '动作缓慢',
      '可能拄拐杖',
      '喜欢坐着',
      '行动需要休息',
      '眼神慈祥',
    ],
  };
  
  hints.push(...ageActionMap[ageGroup]);
  
  return hints;
}

/**
 * 构建角色提示词
 */
function buildCharacterPrompt(
  name: string,
  age: number,
  ageGroup: AgeGroup,
  gender: 'male' | 'female',
  options: {
    personalityTraits: string[];
    speechStyle: string[];
    behaviorPatterns: string[];
    emotionalExpression: string[];
    type?: 'protagonist' | 'supporting' | 'antagonist';
    background?: string;
  }
): string {
  const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;
  const genderDesc = gender === 'male' ? '男' : '女';
  const typeDesc = options.type === 'protagonist' ? '主角' : 
                   options.type === 'supporting' ? '配角' : 
                   options.type === 'antagonist' ? '反派' : '';
  
  const lines: string[] = [];
  
  lines.push(`【${name}】${age}岁${ageLabel}${genderDesc}性${typeDesc}`);
  lines.push(`性格：${options.personalityTraits.join('、')}`);
  lines.push(`语言风格：${options.speechStyle.join('、')}`);
  lines.push(`常见行为：${options.behaviorPatterns.join('、')}`);
  lines.push(`情感表达：${options.emotionalExpression.join('、')}`);
  
  if (options.background) {
    lines.push(`背景：${options.background}`);
  }
  
  return lines.join('\n');
}

/**
 * 生成年龄适配的对话示例
 */
export function generateAgeAppropriateDialogue(
  character: CharacterForScript,
  emotion: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' = 'neutral',
  context?: string
): string[] {
  const adapted = adaptCharacterForScript(character);
  const examples: string[] = [];
  
  // 基于年龄和情绪生成对话示例
  const dialogueTemplates: Record<AgeGroup, Record<string, string[]>> = {
    child: {
      happy: ['"太好玩啦！"', '"我好开心呀！"', '"妈妈你看！"'],
      sad: ['"呜呜呜..."', '"我不要..."', '"我要找妈妈..."'],
      angry: ['"哼！不理你了！"', '"我讨厌你！"', '"走开！"'],
      surprised: ['"哇！这是什么？"', '"好神奇呀！"', '"真的吗真的吗？"'],
      neutral: ['"那是什么？"', '"为什么呀？"', '"我在玩呢。"'],
    },
    youth: {
      happy: ['"太棒了！"', '"这也太酷了吧！"', '"终于等到这一天了！"'],
      sad: ['"怎么会这样..."', '"我不甘心..."', '"为什么总是我..."'],
      angry: ['"够了！"', '"别再管我！"', '"我受够了！"'],
      surprised: ['"什么？！"', '"真的假的？"', '"你在开玩笑吧！"'],
      neutral: ['"还行吧。"', '"随便。"', '"我考虑一下。"'],
    },
    adult: {
      happy: ['"事情进展顺利。"', '"这个结果不错。"', '"辛苦了。"'],
      sad: ['"有些遗憾..."', '"世事难料。"', '"人生就是这样。"'],
      angry: ['"这件事到此为止。"', '"我已经忍耐很久了。"', '"请你离开。"'],
      surprised: ['"没想到会这样。"', '"有点意外。"', '"原来如此。"'],
      neutral: ['"依我看，应该这样。"', '"我有个想法。"', '"这件事需要好好考虑。"'],
    },
    elderly: {
      happy: ['"看到你们这样，我很欣慰。"', '"年轻人有前途。"', '"好，好，很好。"'],
      sad: ['"岁月不饶人啊..."', '"老了，什么都做不了了。"', '"想起当年的事..."'],
      angry: ['"现在的年轻人啊..."', '"我活了这么大岁数，没见过这样的事！"', '"太不像话了！"'],
      surprised: ['"哦？还有这种事？"', '"真是稀奇。"', '"这倒是从未听说过。"'],
      neutral: ['"想当年，我们那时候..."', '"年轻人要多听老人言。"', '"慢慢来，不要急。"'],
    },
  };
  
  examples.push(...dialogueTemplates[adapted.ageGroup][emotion]);
  
  return examples;
}

/**
 * 生成年龄适配的动作描述
 */
export function generateAgeAppropriateAction(
  character: CharacterForScript,
  actionType: 'enter' | 'exit' | 'react' | 'interact' | 'express'
): string[] {
  const adapted = adaptCharacterForScript(character);
  
  const actionTemplates: Record<AgeGroup, Record<string, string[]>> = {
    child: {
      enter: ['蹦蹦跳跳地跑进来', '拉着大人的手走进来', '好奇地探头探脑'],
      exit: ['蹦蹦跳跳地跑出去', '被大人领着走出去', '一步三回头地离开'],
      react: ['瞪大眼睛看着', '拍手叫好', '好奇地凑过去'],
      interact: ['拉着对方的手撒娇', '递过手中的玩具', '歪着头看着对方'],
      express: ['开心地跳起来', '撅起小嘴', '眼眶红红的'],
    },
    youth: {
      enter: ['大步走进来', '自信地推门而入', '低头看着手机走进来'],
      exit: ['大步流星地走出去', '头也不回地离开', '气冲冲地摔门而去'],
      react: ['挑了挑眉', '嘴角上扬', '眼神复杂地看着'],
      interact: ['主动握住对方的手', '拍拍对方的肩膀', '递过手机给对方看'],
      express: ['激动地挥舞手臂', '眼眶微红', '嘴角忍不住上扬'],
    },
    adult: {
      enter: ['沉稳地走进来', '一边看文件一边进来', '微笑着点点头'],
      exit: ['整理好衣服后离开', '简短交代后出去', '沉默地走出去'],
      react: ['微微点头', '若有所思地看着', '嘴角带着淡淡的微笑'],
      interact: ['伸手与对方握手', '递上一杯咖啡', '打开文件夹展示'],
      express: ['深吸一口气', '眉头微皱', '露出会心的微笑'],
    },
    elderly: {
      enter: ['慢慢走进来', '拄着拐杖进来', '在他人搀扶下进来'],
      exit: ['慢慢走出去', '一边叹气一边离开', '回过头看了看'],
      react: ['眯起眼睛看着', '慈祥地笑着', '若有所思地点头'],
      interact: ['拍拍对方的手背', '慈祥地看着对方', '慢慢地讲述着'],
      express: ['眼角露出皱纹的笑', '摇了摇头', '眼中闪着泪光'],
    },
  };
  
  return actionTemplates[adapted.ageGroup][actionType];
}

/**
 * 批量适配角色
 */
export function adaptCharactersForScript(
  characters: CharacterForScript[]
): Map<string, AgeAdaptedCharacter> {
  const result = new Map<string, AgeAdaptedCharacter>();
  
  for (const char of characters) {
    result.set(char.name, adaptCharacterForScript(char));
  }
  
  return result;
}

/**
 * 生成角色档案提示词（用于剧本生成）
 */
export function generateCharacterPromptsForScript(
  characters: CharacterForScript[]
): string {
  const adapted = adaptCharactersForScript(characters);
  
  const lines: string[] = ['【角色档案（已按年龄适配）】'];
  
  for (const [name, char] of adapted) {
    lines.push('');
    lines.push(char.characterPrompt);
    lines.push(`对话提示：${char.dialogueHints.slice(0, 3).join('；')}`);
    lines.push(`动作提示：${char.actionHints.slice(0, 2).join('；')}`);
  }
  
  return lines.join('\n');
}

/**
 * 获取年龄段特定的剧本规则
 */
export function getAgeSpecificScriptRules(characters: CharacterForScript[]): string[] {
  const rules: string[] = [];
  const ageGroups = new Set(characters.map(c => getAgeGroup(c.age)));
  
  if (ageGroups.has('child')) {
    rules.push('【幼年角色规则】');
    rules.push('- 对话要简单，用短句');
    rules.push('- 动作要活泼可爱');
    rules.push('- 情绪表达要直接');
    rules.push('- 经常出现撒娇、哭闹、好奇等行为');
  }
  
  if (ageGroups.has('youth')) {
    rules.push('【少年角色规则】');
    rules.push('- 可以使用网络用语和流行词');
    rules.push('- 对话风格直接、坦率');
    rules.push('- 动作充满活力');
    rules.push('- 经常出现叛逆、热情、冲动等表现');
  }
  
  if (ageGroups.has('adult')) {
    rules.push('【中年角色规则】');
    rules.push('- 对话稳重、有逻辑');
    rules.push('- 动作得体、专业');
    rules.push('- 情感表达内敛');
    rules.push('- 经常出现职场、家庭等成年人的场景');
  }
  
  if (ageGroups.has('elderly')) {
    rules.push('【老年角色规则】');
    rules.push('- 对话语速慢、语重心长');
    rules.push('- 动作缓慢、需要休息');
    rules.push('- 喜欢回忆过去、讲道理');
    rules.push('- 经常出现"想当年"等表述');
  }
  
  return rules;
}
