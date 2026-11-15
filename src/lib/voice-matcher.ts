/**
 * 语音选择工具
 * 根据角色年龄、性别、风格智能匹配合适的音色
 */

import { TTS_SPEAKERS } from './config';
import { getAgeGroup, AGE_GROUP_BOUNDARIES, type AgeGroup } from './age-features';

/**
 * 音色匹配参数
 */
export interface VoiceMatchParams {
  age: number;                    // 具体年龄
  gender: 'male' | 'female';      // 性别
  style?: string[];               // 风格标签（如 ['sweet', 'energetic']）
  roleType?: 'protagonist' | 'supporting' | 'antagonist' | 'narrator'; // 角色类型
  useCase?: string;               // 使用场景（如 '甜宠剧', '古风剧'）
  preferRecommended?: boolean;    // 是否优先推荐音色
}

/**
 * 音色匹配结果
 */
export interface VoiceMatchResult {
  speaker: typeof TTS_SPEAKERS[keyof typeof TTS_SPEAKERS];
  score: number;                  // 匹配分数 (0-100)
  matchReasons: string[];         // 匹配原因
}

/**
 * 年龄分组到 ageGroup 的映射
 */
function mapAgeGroup(age: number): 'child' | 'young' | 'adult' | 'elderly' {
  const group = getAgeGroup(age);
  // TTS_SPEAKERS 中的 ageGroup 使用 'young' 表示少年
  return group === 'youth' ? 'young' : group;
}

/**
 * 根据年龄获取推荐的音色风格
 */
function getRecommendedStylesForAge(age: number, gender: 'male' | 'female'): string[] {
  const ageGroup = getAgeGroup(age);
  
  const styleMap: Record<AgeGroup, Record<'male' | 'female', string[]>> = {
    child: {
      male: ['cute', 'lively', 'innocent', 'energetic'],
      female: ['cute', 'lively', 'innocent', 'sweet'],
    },
    youth: {
      male: ['energetic', 'bright', 'sunny', 'confident', 'cheerful'],
      female: ['sweet', 'gentle', 'romantic', 'lively', 'cute'],
    },
    adult: {
      male: ['mature', 'confident', 'calm', 'professional', 'elegant'],
      female: ['elegant', 'mature', 'professional', 'gentle', 'emotional'],
    },
    elderly: {
      male: ['calm', 'wise', 'gentle', 'mature'],
      female: ['gentle', 'warm', 'wise', 'calm'],
    },
  };
  
  return styleMap[ageGroup][gender];
}

/**
 * 智能匹配音色
 */
export function matchVoice(params: VoiceMatchParams): VoiceMatchResult[] {
  const {
    age,
    gender,
    style = [],
    roleType,
    useCase,
    preferRecommended = true,
  } = params;
  
  const ageGroup = mapAgeGroup(age);
  const ageLabel = AGE_GROUP_BOUNDARIES[getAgeGroup(age)].label;
  const recommendedStyles = getRecommendedStylesForAge(age, gender);
  
  const results: VoiceMatchResult[] = [];
  
  for (const speaker of Object.values(TTS_SPEAKERS)) {
    // 检查音色是否可用
    if ('available' in speaker && speaker.available === false) {
      continue;
    }
    
    let score = 0;
    const matchReasons: string[] = [];
    
    // 1. 性别匹配 (基础分)
    if (speaker.gender === gender) {
      score += 30;
      matchReasons.push(`性别匹配(${gender === 'male' ? '男' : '女'}声)`);
    } else if (speaker.gender === 'neutral') {
      score += 15;
      matchReasons.push('中性音色');
    } else {
      // 性别不匹配，跳过
      continue;
    }
    
    // 2. 年龄匹配 (重要分)
    if (speaker.ageGroup === ageGroup) {
      score += 35;
      matchReasons.push(`年龄匹配(${ageLabel})`);
    } else if (
      (ageGroup === 'young' && speaker.ageGroup === 'adult') ||
      (ageGroup === 'adult' && speaker.ageGroup === 'young')
    ) {
      // 少年和中年之间可以有一定兼容
      score += 15;
      matchReasons.push('年龄相近');
    } else if (ageGroup === 'elderly' && speaker.ageGroup === 'adult') {
      // 老年可以使用成熟的成人音色
      score += 20;
      matchReasons.push('成熟音色适合老年角色');
    }
    
    // 3. 风格匹配
    const speakerStyles: readonly string[] = speaker.style || [];
    const matchedStyles = style.filter(s => speakerStyles.includes(s));
    if (matchedStyles.length > 0) {
      score += 10 * matchedStyles.length;
      matchReasons.push(`风格匹配: ${matchedStyles.join(', ')}`);
    }
    
    // 4. 推荐风格匹配（根据年龄自动推荐的风格）
    const autoMatchedStyles = recommendedStyles.filter(s => speakerStyles.includes(s));
    if (autoMatchedStyles.length > 0) {
      score += 5 * autoMatchedStyles.length;
      matchReasons.push(`适合${ageLabel}角色风格`);
    }
    
    // 5. 角色类型匹配
    if (roleType && 'suitableRoles' in speaker) {
      const suitableRoles = speaker.suitableRoles as readonly string[];
      if (suitableRoles.includes(roleType)) {
        score += 15;
        matchReasons.push(`适合${roleType === 'protagonist' ? '主角' : roleType === 'supporting' ? '配角' : roleType === 'antagonist' ? '反派' : '旁白'}角色`);
      }
    }
    
    // 6. 使用场景匹配
    if (useCase && speaker.useCase) {
      const matchedUseCases = speaker.useCase.filter(uc => 
        useCase.includes(uc) || uc.includes(useCase)
      );
      if (matchedUseCases.length > 0) {
        score += 10;
        matchReasons.push(`场景匹配: ${matchedUseCases.join(', ')}`);
      }
    }
    
    // 7. 推荐音色加分
    if (preferRecommended && speaker.recommended) {
      score += 5;
      matchReasons.push('推荐音色');
    }
    
    results.push({
      speaker,
      score: Math.min(score, 100), // 最高100分
      matchReasons,
    });
  }
  
  // 按分数降序排序
  results.sort((a, b) => b.score - a.score);
  
  return results;
}

/**
 * 获取最佳匹配音色
 */
export function getBestVoice(params: VoiceMatchParams): VoiceMatchResult | null {
  const results = matchVoice(params);
  return results.length > 0 ? results[0] : null;
}

/**
 * 获取角色配音建议
 */
export function getVoiceSuggestion(
  age: number,
  gender: 'male' | 'female',
  characterName: string,
  characterType?: string
): {
  primary: VoiceMatchResult;
  alternatives: VoiceMatchResult[];
  suggestion: string;
} {
  const ageGroup = getAgeGroup(age);
  const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;
  
  // 匹配音色
  const results = matchVoice({
    age,
    gender,
    roleType: characterType === '主角' ? 'protagonist' : 
              characterType === '配角' ? 'supporting' : 
              characterType === '反派' ? 'antagonist' : undefined,
  });
  
  if (results.length === 0) {
    throw new Error(`未找到适合的音色: ${age}岁${gender === 'male' ? '男' : '女'}声`);
  }
  
  const primary = results[0];
  const alternatives = results.slice(1, 4);
  
  // 生成建议文案
  const suggestion = `【${characterName}配音建议】
角色年龄：${age}岁（${ageLabel}）
推荐音色：${primary.speaker.name}（匹配度: ${primary.score}分）
匹配原因：${primary.matchReasons.join('、')}
音色特点：${primary.speaker.description}
${alternatives.length > 0 ? `\n备选音色：${alternatives.map(a => `${a.speaker.name}(${a.score}分)`).join('、')}` : ''}`;

  return {
    primary,
    alternatives,
    suggestion,
  };
}

/**
 * 获取年龄对应的默认音色
 */
export function getDefaultVoiceForAge(
  age: number,
  gender: 'male' | 'female'
): string {
  const ageGroup = getAgeGroup(age);
  
  // 每个年龄段的默认音色映射
  const defaultVoiceMap: Record<AgeGroup, Record<'male' | 'female', string>> = {
    child: {
      male: 'zh_child_huoli_moon_bigtts',      // 活力童声
      female: 'zh_child_huoli_moon_bigtts',    // 活力童声
    },
    youth: {
      male: 'saturn_zh_male_shuanglangshaonian_tob',  // 爽朗少年
      female: 'saturn_zh_female_keainvsheng_tob',     // 可爱女生
    },
    adult: {
      male: 'zh_male_dayi_saturn_bigtts',       // 大毅
      female: 'zh_female_mizai_saturn_bigtts',  // 米子
    },
    elderly: {
      male: 'zh_male_ruyayichen_saturn_bigtts', // 儒雅男声
      female: 'zh_female_santongyongns_saturn_bigtts', // 温柔女声
    },
  };
  
  return defaultVoiceMap[ageGroup][gender];
}

/**
 * 验证音色ID是否有效
 */
export function isValidVoiceId(voiceId: string): boolean {
  return voiceId in TTS_SPEAKERS;
}

/**
 * 获取音色详情
 */
export function getVoiceById(voiceId: string): typeof TTS_SPEAKERS[keyof typeof TTS_SPEAKERS] | null {
  return TTS_SPEAKERS[voiceId as keyof typeof TTS_SPEAKERS] || null;
}

/**
 * 获取所有可用音色
 */
export function getAvailableVoices(): Array<typeof TTS_SPEAKERS[keyof typeof TTS_SPEAKERS]> {
  return Object.values(TTS_SPEAKERS).filter(
    speaker => !('available' in speaker && speaker.available === false)
  );
}

/**
 * 按年龄分组获取音色
 */
export function getVoicesByAgeGroup(ageGroup: 'child' | 'young' | 'adult' | 'elderly') {
  return Object.values(TTS_SPEAKERS).filter(
    speaker => speaker.ageGroup === ageGroup
  );
}

/**
 * 批量获取角色配音建议
 */
export function batchGetVoiceSuggestions(
  characters: Array<{
    name: string;
    age: number;
    gender: 'male' | 'female';
    type?: string;
  }>
): Map<string, {
  voiceId: string;
  voiceName: string;
  score: number;
  suggestion: string;
}> {
  const result = new Map<string, {
    voiceId: string;
    voiceName: string;
    score: number;
    suggestion: string;
  }>();
  
  for (const char of characters) {
    try {
      const suggestion = getVoiceSuggestion(char.age, char.gender, char.name, char.type);
      result.set(char.name, {
        voiceId: suggestion.primary.speaker.id,
        voiceName: suggestion.primary.speaker.name,
        score: suggestion.primary.score,
        suggestion: suggestion.suggestion,
      });
    } catch (error) {
      // 使用默认音色
      const defaultVoiceId = getDefaultVoiceForAge(char.age, char.gender);
      const defaultVoice = getVoiceById(defaultVoiceId);
      if (defaultVoice) {
        result.set(char.name, {
          voiceId: defaultVoiceId,
          voiceName: defaultVoice.name,
          score: 50,
          suggestion: `${char.name}使用默认${char.gender === 'male' ? '男' : '女'}声: ${defaultVoice.name}`,
        });
      }
    }
  }
  
  return result;
}
