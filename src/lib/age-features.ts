/**
 * 年龄特征配置
 * 用于人物立绘生成、语音选择、剧本创作的年龄适配
 * 
 * 年龄分段：
 * - child: 幼年 (0-12岁)
 * - youth: 少年 (13-25岁)
 * - adult: 中年 (26-55岁)
 * - elderly: 老年 (56岁以上)
 */

/**
 * 年龄分组类型
 */
export type AgeGroup = 'child' | 'youth' | 'adult' | 'elderly';

/**
 * 年龄分组边界
 */
export const AGE_GROUP_BOUNDARIES = {
  child: { min: 0, max: 12, label: '幼年' },
  youth: { min: 13, max: 25, label: '少年' },
  adult: { min: 26, max: 55, label: '中年' },
  elderly: { min: 56, max: 100, label: '老年' },
} as const;

/**
 * 根据具体年龄获取年龄分组
 */
export function getAgeGroup(age: number): AgeGroup {
  if (age <= 12) return 'child';
  if (age <= 25) return 'youth';
  if (age <= 55) return 'adult';
  return 'elderly';
}

/**
 * 根据年龄分组获取年龄范围描述
 */
export function getAgeRangeDescription(ageGroup: AgeGroup, exactAge?: number): string {
  if (exactAge !== undefined) {
    return `${exactAge}岁`;
  }
  
  const boundary = AGE_GROUP_BOUNDARIES[ageGroup];
  if (boundary.min === 0) {
    return `${boundary.max}岁以下`;
  }
  if (boundary.max >= 100) {
    return `${boundary.min}岁以上`;
  }
  return `${boundary.min}-${boundary.max}岁`;
}

// ==================== 容貌特征配置 ====================

/**
 * 面部特征配置
 */
export interface FacialFeatures {
  faceShape: string[];        // 脸型
  skinTexture: string[];      // 皮肤质感
  eyeCharacteristics: string[]; // 眼部特征
  wrinkles: string[];         // 皱纹特征
  jawline: string[];          // 下颌线
}

/**
 * 年龄对应的面部特征
 */
export const AGE_FACIAL_FEATURES: Record<AgeGroup, FacialFeatures> = {
  child: {
    faceShape: ['圆润的脸型', '婴儿肥', '饱满的脸颊', '小巧精致的五官'],
    skinTexture: ['细腻光滑的皮肤', '充满胶原蛋白', '水润有弹性', '无瑕疵的肌肤'],
    eyeCharacteristics: ['大大的眼睛', '清澈明亮的眼神', '稚嫩纯真的目光', '圆润的眼形'],
    wrinkles: ['无皱纹', '光滑平整', '饱满紧致'],
    jawline: ['柔和的下颌线', '圆润的下巴', '稚嫩的轮廓'],
  },
  youth: {
    faceShape: ['线条流畅的脸型', '轮廓分明', '青春朝气', '充满活力'],
    skinTexture: ['光滑细腻的皮肤', '健康有光泽', '青春痘可能残留的痕迹', '弹性十足'],
    eyeCharacteristics: ['明亮有神的眼睛', '充满活力的眼神', '清澈的目光', '坚定的眼眸'],
    wrinkles: ['基本无皱纹', '眼角可能有小细纹', '皮肤紧致'],
    jawline: ['清晰的下颌线', '立体的轮廓', '青春的线条'],
  },
  adult: {
    faceShape: ['成熟稳重的脸型', '轮廓分明', '有棱有角', '成熟韵味'],
    skinTexture: ['正常肤质', '可能有细纹', '略显疲惫的痕迹', '成熟肌肤'],
    eyeCharacteristics: ['深邃的眼睛', '沉稳的眼神', '有故事的眼眸', '成熟睿智的目光'],
    wrinkles: ['眼角细纹', '额头可能有抬头纹', '法令纹开始显现', '岁月痕迹'],
    jawline: ['清晰硬朗的下颌线', '成熟的轮廓', '有力量感的线条'],
  },
  elderly: {
    faceShape: ['沧桑的脸型', '皱纹遍布', '岁月痕迹明显', '慈祥的面容'],
    skinTexture: ['松弛的皮肤', '皱纹明显', '老年斑', '皮肤干燥'],
    eyeCharacteristics: ['慈祥的眼睛', '浑浊但温和的眼神', '眼角下垂', '岁月沉淀的目光'],
    wrinkles: ['深深的皱纹', '额头皱纹', '眼角鱼尾纹', '法令纹深刻', '颈部皱纹'],
    jawline: ['下垂的下颌线', '轮廓不再分明', '松弛的线条'],
  },
};

/**
 * 发型特征配置
 */
export interface HairstyleFeatures {
  commonStyles: string[];     // 常见发型
  hairColor: string[];        // 常见发色
  hairTexture: string[];      // 发质特点
}

/**
 * 年龄对应的发型特征
 */
export const AGE_HAIRSTYLE_FEATURES: Record<AgeGroup, HairstyleFeatures> = {
  child: {
    commonStyles: ['短发', '双马尾', '齐刘海', '可爱的发型', '简单的发型'],
    hairColor: ['乌黑的头发', '自然的发色', '柔顺的黑发'],
    hairTexture: ['柔软的发质', '细软的头发', '充满光泽'],
  },
  youth: {
    commonStyles: ['时尚发型', '染发造型', '各种潮流发型', '利落短发', '飘逸长发'],
    hairColor: ['各种发色', '挑染', '自然黑发', '棕色系'],
    hairTexture: ['浓密的头发', '有弹性的发质', '健康光泽'],
  },
  adult: {
    commonStyles: ['成熟稳重的发型', '职业发型', '大背头', '干练短发', '优雅长发'],
    hairColor: ['自然发色', '可能开始有白发', '深色系', '成熟色调'],
    hairTexture: ['正常发质', '可能略显稀疏', '保养得当'],
  },
  elderly: {
    commonStyles: ['简洁的发型', '白发造型', '传统的发型', '稀疏的头发'],
    hairColor: ['花白的头发', '银白色的头发', '灰白色', '稀疏的白发'],
    hairTexture: ['稀疏的头发', '变细的发质', '银色光泽'],
  },
};

/**
 * 体型特征配置
 */
export interface BodyFeatures {
  bodyType: string[];         // 体型
  posture: string[];          // 体态
  height: string[];           // 身高特点
}

/**
 * 年龄对应的体型特征
 */
export const AGE_BODY_FEATURES: Record<AgeGroup, BodyFeatures> = {
  child: {
    bodyType: ['娇小的身材', '纤细的四肢', '圆润可爱', '正在发育'],
    posture: ['活泼好动', '蹦蹦跳跳', '精力充沛', '天真烂漫'],
    height: ['身材矮小', '可爱的小个子', '成长中'],
  },
  youth: {
    bodyType: ['匀称的身材', '修长的四肢', '青春健美', '活力四射'],
    posture: ['挺拔的身姿', '朝气蓬勃', '充满活力', '运动健硕'],
    height: ['标准身高', '身材高挑', '发育完成'],
  },
  adult: {
    bodyType: ['成熟的身材', '可能略显发福', '稳重厚实', '中年身材'],
    posture: ['沉稳站姿', '成熟稳重', '职场精英范', '略显疲惫'],
    height: ['标准成人身高', '稳定身高'],
  },
  elderly: {
    bodyType: ['略显佝偻', '消瘦或发福', '身体机能下降', '行动迟缓'],
    posture: ['微微弯腰', '拄拐杖', '行动缓慢', '慈祥稳重'],
    height: ['身高可能缩水', '略显矮小'],
  },
};

/**
 * 服装风格配置
 */
export interface ClothingStyle {
  modern: string[];           // 现代风格
  ancient: string[];          // 古风风格
  formal: string[];           // 正式风格
  casual: string[];           // 休闲风格
}

/**
 * 年龄对应的服装风格
 */
export const AGE_CLOTHING_STYLES: Record<AgeGroup, ClothingStyle> = {
  child: {
    modern: ['可爱的童装', '卡通图案T恤', '背带裤', '小裙子', '运动鞋'],
    ancient: ['古代童装', '小汉服', '虎头鞋', '长命锁', '肚兜'],
    formal: ['小西装', '公主裙', '花童礼服', '儿童演出服'],
    casual: ['舒适的休闲装', '运动服', '可爱的睡衣', '日常童装'],
  },
  youth: {
    modern: ['时尚潮流服饰', '个性穿搭', '流行元素', '街头风格', '品牌运动装'],
    ancient: ['古装汉服', '武侠风', '仙侠风格', '飘逸长袍', '精致的古代服饰'],
    formal: ['职业正装', '西装革履', '商务休闲', '学生制服'],
    casual: ['休闲时尚', '卫衣牛仔裤', '运动休闲', '潮流穿搭'],
  },
  adult: {
    modern: ['职业装', '成熟时尚', '品牌服饰', '商务正装', '成熟优雅'],
    ancient: ['成熟古装', '官服', '华贵的古代服饰', '典雅汉服', '丝绸长袍'],
    formal: ['正装西装', '商务礼服', '职业套装', '成熟正式'],
    casual: ['成熟休闲', 'Polo衫', '休闲西装', '商务休闲'],
  },
  elderly: {
    modern: ['舒适宽松的衣服', '老年装', '保暖服饰', '朴素的穿着', '传统服饰'],
    ancient: ['古代老年服饰', '素雅古装', '慈祥的长者装扮', '传统服饰'],
    formal: ['中式礼服', '老年正装', '传统服装', '庄重的服饰'],
    casual: ['舒适家居服', '宽松休闲', '老年运动装', '朴素的日常装'],
  },
};

// ==================== 声音特征配置 ====================

/**
 * 声音特征配置
 */
export interface VoiceFeatures {
  tone: string[];             // 音调
  speed: string[];            // 语速
  characteristics: string[];  // 特点
  recommendedSpeakerTypes: string[]; // 推荐音色类型
}

/**
 * 年龄对应的声音特征
 */
export const AGE_VOICE_FEATURES: Record<AgeGroup, VoiceFeatures> = {
  child: {
    tone: ['稚嫩的童声', '清脆的声音', '高亢的语调', '奶声奶气'],
    speed: ['活泼快速的语速', '天真无邪的语气', '断断续续'],
    characteristics: ['可爱的语气', '天真的表达', '活泼开朗', '纯真无邪'],
    recommendedSpeakerTypes: ['child', 'cute'],
  },
  youth: {
    tone: ['清亮的声音', '充满活力的语调', '朝气蓬勃', '明亮清澈'],
    speed: ['轻快的语速', '充满活力', '语速适中'],
    characteristics: ['青春气息', '热情洋溢', '直率坦诚', '富有激情'],
    recommendedSpeakerTypes: ['young', 'energetic', 'bright'],
  },
  adult: {
    tone: ['沉稳的声音', '成熟的语调', '低沉有力', '富有磁性'],
    speed: ['适中的语速', '稳重从容', '不紧不慢'],
    characteristics: ['成熟稳重', '从容淡定', '有阅历感', '沉稳有力'],
    recommendedSpeakerTypes: ['adult', 'mature', 'professional'],
  },
  elderly: {
    tone: ['苍老的声音', '低沉缓慢的语调', '沙哑的嗓音', '慈祥温和'],
    speed: ['缓慢的语速', '语速较慢', '慢慢道来'],
    characteristics: ['慈祥温和', '历经沧桑', '语重心长', '睿智深沉'],
    recommendedSpeakerTypes: ['elderly', 'wise', 'gentle'],
  },
};

// ==================== 行为特征配置 ====================

/**
 * 行为特征配置
 */
export interface BehaviorFeatures {
  personality: string[];      // 性格特点
  mannerism: string[];        // 行为举止
  speechPattern: string[];    // 语言风格
  commonActions: string[];    // 常见行为
  emotionalExpression: string[]; // 情感表达
}

/**
 * 年龄对应的行为特征
 */
export const AGE_BEHAVIOR_FEATURES: Record<AgeGroup, BehaviorFeatures> = {
  child: {
    personality: ['天真无邪', '活泼好动', '好奇心强', '容易哭闹', '单纯可爱', '调皮捣蛋'],
    mannerism: ['蹦蹦跳跳', '撒娇', '玩闹', '到处跑动', '拉着大人的手'],
    speechPattern: ['简单的词汇', '奶声奶气的语调', '喜欢问为什么', '天真无邪的问话', '"为什么呀？"', '"我不要！"'],
    commonActions: ['玩玩具', '吃零食', '看动画片', '玩游戏', '撒娇要抱抱', '哭闹'],
    emotionalExpression: ['情绪外露', '喜怒形于色', '容易开心也容易哭', '天真烂漫的笑容'],
  },
  youth: {
    personality: ['热情奔放', '理想主义', '叛逆独立', '充满活力', '追求梦想', '感情丰富'],
    mannerism: ['意气风发', '充满干劲', '有时冲动', '追求刺激', '自我意识强'],
    speechPattern: ['直率坦诚', '流行用语', '表达直接', '有时带点叛逆', '"我才不要"', '"这太酷了！"'],
    commonActions: ['和朋友聚会', '玩手机', '运动健身', '追求爱情', '学习工作', '探索世界'],
    emotionalExpression: ['情绪丰富', '爱憎分明', '热情洋溢', '容易激动', '憧憬未来'],
  },
  adult: {
    personality: ['成熟稳重', '理性务实', '有责任感', '阅历丰富', '处变不惊', '深谋远虑'],
    mannerism: ['举止得体', '稳重从容', '彬彬有礼', '游刃有余', '有威严'],
    speechPattern: ['言辞审慎', '逻辑清晰', '点到即止', '富有哲理', '循循善诱', '"依我看..."'],
    commonActions: ['工作打拼', '照顾家庭', '社交应酬', '规划未来', '处理事务', '承担责任'],
    emotionalExpression: ['情感内敛', '喜怒不形于色', '深思熟虑', '从容淡定', '有城府'],
  },
  elderly: {
    personality: ['慈祥和蔼', '睿智深沉', '与世无争', '阅历丰富', '有时固执', '怀旧念旧'],
    mannerism: ['行动缓慢', '步履蹒跚', '爱唠叨', '喜欢回忆过去', '慈祥微笑'],
    speechPattern: ['语重心长', '絮絮叨叨', '喜欢讲道理', '常提往事', '"想当年..."', '"我年轻的时候..."'],
    commonActions: ['散步遛弯', '晒太阳', '下棋打牌', '带孙子', '回忆往事', '养生保健'],
    emotionalExpression: ['温和慈祥', '情绪平和', '有时感伤', '看淡世事', '智慧通透'],
  },
};

// ==================== 工具函数 ====================

/**
 * 生成年龄相关的容貌描述
 */
export function generateAgeAppearanceDescription(
  ageGroup: AgeGroup,
  gender: 'male' | 'female',
  style: 'modern' | 'ancient' | 'formal' | 'casual' = 'modern'
): string {
  const facial = AGE_FACIAL_FEATURES[ageGroup];
  const hairstyle = AGE_HAIRSTYLE_FEATURES[ageGroup];
  const body = AGE_BODY_FEATURES[ageGroup];
  const clothing = AGE_CLOTHING_STYLES[ageGroup];

  const genderDesc = gender === 'male' ? '男性' : '女性';
  
  const faceShape = facial.faceShape[Math.floor(Math.random() * facial.faceShape.length)];
  const skinTexture = facial.skinTexture[Math.floor(Math.random() * facial.skinTexture.length)];
  const eyes = facial.eyeCharacteristics[Math.floor(Math.random() * facial.eyeCharacteristics.length)];
  const hairStyle = hairstyle.commonStyles[Math.floor(Math.random() * hairstyle.commonStyles.length)];
  const hairColor = hairstyle.hairColor[Math.floor(Math.random() * hairstyle.hairColor.length)];
  const bodyType = body.bodyType[Math.floor(Math.random() * body.bodyType.length)];
  const clothStyle = clothing[style][Math.floor(Math.random() * clothing[style].length)];

  return `${faceShape}，${skinTexture}，${eyes}，${hairColor}${hairStyle}，${bodyType}，穿着${clothStyle}`;
}

/**
 * 生成年龄相关的性格描述
 */
export function generateAgePersonalityDescription(ageGroup: AgeGroup): string {
  const behavior = AGE_BEHAVIOR_FEATURES[ageGroup];
  const personalities = behavior.personality.slice(0, 3).join('、');
  return personalities;
}

/**
 * 生成年龄相关的语言风格示例
 */
export function getAgeSpeechExamples(ageGroup: AgeGroup): string[] {
  return AGE_BEHAVIOR_FEATURES[ageGroup].speechPattern;
}

/**
 * 获取年龄对应的推荐音色类型
 */
export function getRecommendedVoiceTypes(ageGroup: AgeGroup): string[] {
  return AGE_VOICE_FEATURES[ageGroup].recommendedSpeakerTypes;
}

/**
 * 生成完整的人物年龄特征描述（用于AI生成）
 */
export function generateCharacterAgeProfile(
  age: number,
  gender: 'male' | 'female',
  style: 'modern' | 'ancient' | 'formal' | 'casual' = 'modern'
): {
  ageGroup: AgeGroup;
  appearance: string;
  personality: string;
  speechPattern: string[];
  voiceCharacteristics: string[];
  clothingSuggestions: string[];
} {
  const ageGroup = getAgeGroup(age);
  const appearance = generateAgeAppearanceDescription(ageGroup, gender, style);
  const personality = generateAgePersonalityDescription(ageGroup);
  const speechPattern = getAgeSpeechExamples(ageGroup);
  const voiceCharacteristics = AGE_VOICE_FEATURES[ageGroup].characteristics;
  const clothingSuggestions = AGE_CLOTHING_STYLES[ageGroup][style];

  return {
    ageGroup,
    appearance,
    personality,
    speechPattern,
    voiceCharacteristics,
    clothingSuggestions,
  };
}

/**
 * 生成用于图片生成的年龄相关提示词
 */
export function generateAgeImagePrompt(
  age: number,
  gender: 'male' | 'female',
  style: 'modern' | 'ancient' | 'formal' | 'casual' = 'modern'
): string {
  const ageGroup = getAgeGroup(age);
  const facial = AGE_FACIAL_FEATURES[ageGroup];
  const hairstyle = AGE_HAIRSTYLE_FEATURES[ageGroup];
  const body = AGE_BODY_FEATURES[ageGroup];
  
  const genderDesc = gender === 'male' ? '男性' : '女性';
  const ageLabel = AGE_GROUP_BOUNDARIES[ageGroup].label;
  
  // 随机选择特征
  const faceShape = facial.faceShape[0];
  const skin = facial.skinTexture[0];
  const eyes = facial.eyeCharacteristics[0];
  const wrinkles = facial.wrinkles.join('，');
  const hair = `${hairstyle.hairColor[0]}，${hairstyle.commonStyles[0]}`;
  const bodyType = body.bodyType[0];
  
  return `${ageLabel}${genderDesc}角色，${faceShape}，${skin}，${eyes}，${hair}，${bodyType}。${wrinkles !== '无皱纹' ? `面部特征：${wrinkles}。` : ''}真实感的人物肖像摄影风格。`;
}

/**
 * 生成用于剧本创作的年龄相关行为提示
 */
export function generateAgeBehaviorPrompt(age: number): string {
  const ageGroup = getAgeGroup(age);
  const behavior = AGE_BEHAVIOR_FEATURES[ageGroup];
  const voice = AGE_VOICE_FEATURES[ageGroup];
  
  return `【${AGE_GROUP_BOUNDARIES[ageGroup].label}角色特征】
性格：${behavior.personality.join('、')}
语言风格：${behavior.speechPattern.slice(0, 3).join('、')}
常见行为：${behavior.commonActions.slice(0, 3).join('、')}
情感表达：${behavior.emotionalExpression.join('、')}
声音特点：${voice.characteristics.join('、')}`;
}
