/**
 * AI运镜动作提示词库 v3.0
 * 
 * 基于38+种AI运镜手法整理，强化冲击感与电影感
 * 根据场景类型、情绪、镜头类型等自动生成专业的电影级运镜描述
 */

// ============================================
// 运镜类型定义
// ============================================

// 基础运镜类型
export type BasicCameraMovementType = 
  | 'static'        // 固定镜头
  | 'push'          // 推镜头
  | 'pull'          // 拉镜头
  | 'pan'           // 摇镜头（水平）
  | 'tilt'          // 俯仰镜头（垂直）
  | 'dolly'         // 移动镜头（轨道）
  | 'crane'         // 升降镜头
  | 'zoom'          // 变焦镜头
  | 'tracking'      // 跟踪镜头
  | 'handheld'      // 手持镜头
  | 'steadicam';    // 稳定器镜头

// 高级运镜类型
export type AdvancedCameraMovementType = 
  | 'dolly_zoom'    // 希区柯克变焦/滑动变焦
  | 'orbit'         // 环绕镜头
  | 'arc'           // 弧形运动
  | 'spiral'        // 螺旋运动
  | 'whip'          // 甩镜头
  | 'drone'         // 航拍镜头
  | 'slow_motion'   // 慢门运镜
  | 'time_lapse'    // 延时摄影
  | 'parallax'      // 视差运镜
  | 'reveal'        // 揭示运镜
  | 'dutch_angle'   // 荷兰角/倾斜构图
  | 'over_shoulder' // 过肩镜头
  | 'pov'           // 主观视角
  | 'low_angle'     // 低角度
  | 'high_angle'    // 高角度
  | 'god_eye';      // 上帝视角

// 特效运镜类型 - 冲击感与电影感专用
export type EffectCameraMovementType = 
  | 'bullet_time'      // 子弹时间（时间冻结）
  | 'impact_push'      // 冲击式推进
  | 'breathing_push'   // 呼吸感推进
  | 'explosive_zoom'   // 爆破式变焦
  | 'snap_zoom'        // 瞬间变焦
  | 'crash_zoom'       // 撞击变焦
  | 'whip_pan'         // 暴力甩镜
  | 'vertigo'          // 眩晕效果
  | 'freeze_frame'     // 定格画面
  | 'flash_cut'        // 闪电剪辑
  | 'hyper_speed'      // 超高速运镜
  | 'morph'            // 变形运镜
  | 'glitch_move'      // 故障风运镜
  | 'shake_impact'     // 震撼冲击
  | 'punch_in';        // 拳击式切入

// 组合运镜类型
export type ComboCameraMovementType = 
  | 'push_zoom'         // 推+变焦
  | 'pull_zoom'         // 拉+变焦
  | 'track_orbit'       // 跟拍+环绕
  | 'crane_pan'         // 升降+横摇
  | 'tilt_pan'          // 俯仰+横摇
  | 'dolly_arc'         // 移动+弧形
  | 'handheld_push'     // 手持+推进
  | 'steadicam_orbit'   // 稳定器+环绕
  | 'breathing_orbit'   // 呼吸感+环绕
  | 'impact_pull'       // 冲击式拉远
  | 'slow_motion_push'  // 慢动作+推进
  | 'whip_reveal'       // 甩镜+揭示
  | 'dolly_dutch'       // 移动+荷兰角
  | 'orbit_dutch'       // 环绕+荷兰角
  | 'crane_orbit';      // 升降+环绕

// 所有运镜类型
export type CameraMovementType = BasicCameraMovementType | AdvancedCameraMovementType | EffectCameraMovementType | ComboCameraMovementType;

// 运镜速度
export type CameraSpeed = 'very_slow' | 'slow' | 'medium' | 'fast' | 'very_fast' | 'hyper';

// 运镜节奏
export type CameraRhythm = 'continuous' | 'intermittent' | 'breathing' | 'staccato' | 'explosive';

// ============================================
// 镜头类型定义
// ============================================

export type ShotType = 
  | 'extreme_close_up'  // 大特写
  | 'close_up'          // 特写
  | 'medium_close_up'   // 中近景
  | 'medium_shot'       // 中景
  | 'medium_long_shot'  // 中远景
  | 'long_shot'         // 远景
  | 'extreme_long_shot' // 大远景
  | 'full_shot'         // 全景
  | 'cowboy_shot';      // 牛仔镜头（膝盖以上）

// ============================================
// 情绪类型定义
// ============================================

export type MoodType = 
  | 'tension'       // 紧张
  | 'suspense'      // 悬疑
  | 'romantic'      // 浪漫
  | 'happy'         // 开心
  | 'sad'           // 悲伤
  | 'angry'         // 愤怒
  | 'fear'          // 恐惧
  | 'surprise'      // 惊讶
  | 'calm'          // 平静
  | 'epic'          // 史诗
  | 'horror'        // 恐怖
  | 'excitement'    // 兴奋
  | 'mysterious'    // 神秘
  | 'melancholy'    // 忧郁
  | 'hopeful'       // 希望
  | 'shock'         // 震撼
  | 'intense'       // 激烈
  | 'dramatic';     // 戏剧性

// ============================================
// 场景类型定义
// ============================================

export type SceneType = 
  | 'indoor'        // 室内
  | 'outdoor'       // 室外
  | 'action'        // 动作场景
  | 'dialogue'      // 对话场景
  | 'emotional'     // 情感场景
  | 'reveal'        // 揭示场景
  | 'chase'         // 追逐场景
  | 'confrontation' // 对峙场景
  | 'introspective' // 内省场景
  | 'transition';   // 转场场景

// ============================================
// 运镜提示词配置接口
// ============================================

interface CameraMovementPrompt {
  type: CameraMovementType;
  name: string;
  category: 'basic' | 'advanced' | 'combo' | 'effect';
  description: string;
  technicalTerms: string[];
  suitableShots: ShotType[];
  suitableMoods: MoodType[];
  speed: CameraSpeed;
  examples: string[];
  promptTemplates: string[];
}

// ============================================
// 运镜提示词库（完整版）
// ============================================

export const CAMERA_MOVEMENT_PROMPTS: CameraMovementPrompt[] = [
  // ============ 基础运镜 ============
  
  // 固定镜头
  {
    type: 'static',
    name: '固定镜头',
    category: 'basic',
    description: '镜头完全静止，强调画面构图和演员表演，适合展现细腻的情感变化',
    technicalTerms: ['固定机位', '静止构图', '静态画面', '稳定帧'],
    suitableShots: ['extreme_close_up', 'close_up', 'medium_shot'],
    suitableMoods: ['calm', 'sad', 'melancholy', 'tension'],
    speed: 'very_slow',
    examples: [
      '固定镜头，画面静止，聚焦人物内心戏',
      '静态构图，强调演员表情细节',
      '固定机位，让观众沉浸于当下时刻',
    ],
    promptTemplates: [
      '固定镜头，画面静止，{custom}',
      '静态构图，聚焦{subject}，{custom}',
    ],
  },
  
  // 推镜头
  {
    type: 'push',
    name: '推镜头',
    category: 'basic',
    description: '镜头缓慢向前推进，增强主体存在感，营造压迫感或亲密感，是情绪递进的核心技法',
    technicalTerms: ['缓慢推进', '渐进式推近', '电影级推镜头', '景深收窄', '推进特写'],
    suitableShots: ['medium_shot', 'close_up', 'extreme_close_up'],
    suitableMoods: ['tension', 'suspense', 'romantic', 'fear', 'angry'],
    speed: 'slow',
    examples: [
      '电影级缓慢推镜头，景深逐渐收窄，聚焦人物情绪变化',
      '渐进式推近特写，压迫感递增，目光如炬',
      '推镜头配合侧逆光，光影层次丰富，情绪张力拉满',
      '缓慢推进，从全景过渡到特写，情绪逐渐放大',
    ],
    promptTemplates: [
      '电影级缓慢推镜头，景深收窄，聚焦{subject}，{custom}',
      '渐进式推进，从{startShot}过渡到{endShot}，{custom}',
      '推镜头，{speed}推进，{custom}',
    ],
  },
  
  // 拉镜头
  {
    type: 'pull',
    name: '拉镜头',
    category: 'basic',
    description: '镜头向后拉远，展示环境全貌，揭示人物处境，常用于场景交代或情绪转折',
    technicalTerms: ['缓慢拉远', '全景揭示', '环境交代', '后拉展开', '景深扩大'],
    suitableShots: ['long_shot', 'extreme_long_shot', 'full_shot'],
    suitableMoods: ['surprise', 'sad', 'epic', 'calm', 'melancholy'],
    speed: 'slow',
    examples: [
      '电影级缓慢拉远，环境全貌逐渐展开，人物渺小感',
      '拉镜头揭示环境，背景与人物关系交代清晰',
      '后拉镜头配合广角，史诗级场景展开',
      '从特写拉远到全景，揭示人物孤独处境',
    ],
    promptTemplates: [
      '电影级缓慢拉远，从{startShot}过渡到{endShot}，{custom}',
      '拉镜头揭示环境，{custom}',
      '后拉展开，全景揭示，{custom}',
    ],
  },
  
  // 摇镜头
  {
    type: 'pan',
    name: '摇镜头',
    category: 'basic',
    description: '镜头水平方向转动，展示空间或跟踪运动，是空间叙事的基础技法',
    technicalTerms: ['水平摇摄', '跟摇', '甩摇', '缓慢横摇', '快速横移'],
    suitableShots: ['medium_shot', 'long_shot', 'full_shot', 'extreme_long_shot'],
    suitableMoods: ['tension', 'excitement', 'suspense', 'epic'],
    speed: 'medium',
    examples: [
      '缓慢横摇，场景空间感增强，人物关系交代',
      '快速甩摇，紧张节奏感，转场流畅',
      '跟摇镜头，人物运动轨迹清晰，动态感强',
      '水平摇摄，展示全景环境，空间叙事',
    ],
    promptTemplates: [
      '{speed}横摇，{custom}',
      '跟摇镜头，跟随{subject}运动，{custom}',
      '水平摇摄，展示全景，{custom}',
    ],
  },
  
  // 俯仰镜头
  {
    type: 'tilt',
    name: '俯仰镜头',
    category: 'basic',
    description: '镜头垂直方向转动，展示高度或人物视角，用于强调权力关系或空间纵深',
    technicalTerms: ['俯拍', '仰拍', '垂直摇摄', '鸟瞰视角', '低角度仰视'],
    suitableShots: ['full_shot', 'long_shot', 'extreme_long_shot'],
    suitableMoods: ['epic', 'fear', 'surprise', 'tension', 'angry'],
    speed: 'medium',
    examples: [
      '电影级俯拍，上帝视角，全局掌控感',
      '仰拍镜头，人物高大威严，气势磅礴',
      '俯仰转换，空间纵深感强烈',
      '低角度仰视，英雄感与压迫感并存',
    ],
    promptTemplates: [
      '电影级{angle}，{custom}',
      '俯仰镜头，从上向下俯拍，{custom}',
      '低角度仰视，{subject}高大威严，{custom}',
    ],
  },
  
  // 移动镜头
  {
    type: 'dolly',
    name: '移动镜头',
    category: 'basic',
    description: '镜头沿轨道移动，平滑流畅的动态效果，是电影感的核心技法',
    technicalTerms: ['轨道移动', '平滑推轨', '侧向移动', '环绕移动', '前后移动'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['romantic', 'epic', 'excitement', 'calm'],
    speed: 'medium',
    examples: [
      '轨道平滑移动，画面流畅优雅，电影质感',
      '侧向移动镜头，人物与环境互动自然',
      '环绕移动，主体突出，立体感强',
      '推轨镜头，平滑推进，专业电影感',
    ],
    promptTemplates: [
      '轨道{direction}移动，{custom}',
      '推轨镜头，平滑{action}，{custom}',
      '移动镜头，{speed}平移，{custom}',
    ],
  },
  
  // 升降镜头
  {
    type: 'crane',
    name: '升降镜头',
    category: 'basic',
    description: '镜头垂直升降，创造戏剧性的视角变化，用于史诗级场景或情绪转折',
    technicalTerms: ['升降臂', '垂直升腾', '下降镜头', '高角度俯瞰', '低角度升起'],
    suitableShots: ['full_shot', 'long_shot', 'extreme_long_shot'],
    suitableMoods: ['epic', 'surprise', 'calm', 'sad', 'hopeful'],
    speed: 'medium',
    examples: [
      '升降臂上升，城市天际线展现，史诗感',
      '从高处下降，聚焦关键人物，戏剧性强',
      '高角度俯瞰升降，空间纵深感拉满',
      '缓缓升起，脱离地面视角，史诗级叙事',
    ],
    promptTemplates: [
      '升降镜头，{direction}，{custom}',
      '升降臂{action}，{custom}',
      '垂直{direction}，{custom}',
    ],
  },
  
  // 变焦镜头
  {
    type: 'zoom',
    name: '变焦镜头',
    category: 'basic',
    description: '改变焦距实现放大或缩小效果，快速变焦产生强烈视觉冲击',
    technicalTerms: ['推焦', '拉焦', '变焦转换', '焦点变换', '快速推焦'],
    suitableShots: ['close_up', 'extreme_close_up', 'medium_shot'],
    suitableMoods: ['tension', 'suspense', 'surprise', 'fear', 'angry'],
    speed: 'fast',
    examples: [
      '快速推焦，聚焦人物惊愕表情，冲击力强',
      '缓慢变焦，情绪逐渐收紧，张力递增',
      '焦点变换，注意力转移，叙事层次丰富',
      '推焦特写，瞬间聚焦，戏剧性强',
    ],
    promptTemplates: [
      '{speed}推焦，聚焦{subject}，{custom}',
      '变焦镜头，{action}，{custom}',
      '焦点变换，从{subject1}到{subject2}，{custom}',
    ],
  },
  
  // 跟踪镜头
  {
    type: 'tracking',
    name: '跟踪镜头',
    category: 'basic',
    description: '镜头跟随主体移动，保持主体在画面中的位置，增强代入感',
    technicalTerms: ['跟随拍摄', '前后跟随', '侧向跟随', '稳定跟随', '跟拍'],
    suitableShots: ['full_shot', 'medium_shot', 'long_shot'],
    suitableMoods: ['excitement', 'tension', 'fear', 'surprise'],
    speed: 'medium',
    examples: [
      '稳定跟随拍摄，人物行走自然流畅',
      '前后跟随，代入感强，第一人称视角',
      '侧向跟踪，人物动态清晰，运动感强',
      '跟拍运动镜头，动感十足',
    ],
    promptTemplates: [
      '跟踪镜头，{direction}跟随{subject}，{custom}',
      '跟拍，{speed}跟随，{custom}',
      '稳定跟随，{custom}',
    ],
  },
  
  // 手持镜头
  {
    type: 'handheld',
    name: '手持镜头',
    category: 'basic',
    description: '模拟真实感的晃动效果，增加临场感和纪实感，适合紧张或恐怖场景',
    technicalTerms: ['手持晃动', '呼吸感', '纪实风格', '临场感', '自然晃动'],
    suitableShots: ['close_up', 'medium_shot', 'full_shot'],
    suitableMoods: ['fear', 'tension', 'horror', 'excitement'],
    speed: 'medium',
    examples: [
      '手持晃动镜头，纪实风格，真实感强烈',
      '呼吸感手持，情绪紧张，临场代入',
      '轻微晃动，动态感强，不稳定性营造紧张',
      '手持跟拍，纪实电影感',
    ],
    promptTemplates: [
      '手持镜头，{intensity}晃动，{custom}',
      '呼吸感手持，{custom}',
      '纪实风格手持，{custom}',
    ],
  },
  
  // 稳定器镜头
  {
    type: 'steadicam',
    name: '稳定器镜头',
    category: 'basic',
    description: '平滑稳定的运动镜头，兼具流动感和稳定感，适合长镜头和流畅叙事',
    technicalTerms: ['稳定器跟拍', '平滑流畅', '丝滑运动', '专业稳定', '斯坦尼康'],
    suitableShots: ['full_shot', 'medium_shot', 'long_shot'],
    suitableMoods: ['romantic', 'epic', 'calm', 'excitement'],
    speed: 'medium',
    examples: [
      '稳定器丝滑跟拍，画面流畅如水，电影质感',
      '专业稳定运动，人物动态清晰，画面稳定',
      '长镜头稳定拍摄，一镜到底，流畅叙事',
      '斯坦尼康跟拍，专业电影级稳定',
    ],
    promptTemplates: [
      '稳定器镜头，丝滑{action}，{custom}',
      '斯坦尼康，{custom}',
      '长镜头稳定拍摄，{custom}',
    ],
  },
  
  // ============ 高级运镜 ============
  
  // 希区柯克变焦
  {
    type: 'dolly_zoom',
    name: '希区柯克变焦',
    category: 'advanced',
    description: '镜头移动与变焦反向操作，产生独特的视觉眩晕感，是电影史经典技法',
    technicalTerms: ['希区柯克变焦', '滑动变焦', 'Dolly Zoom', '眩晕效果', '推拉变焦'],
    suitableShots: ['medium_shot', 'long_shot', 'full_shot'],
    suitableMoods: ['fear', 'surprise', 'tension', 'horror', 'suspense'],
    speed: 'medium',
    examples: [
      '希区柯克变焦，镜头推进同时变焦拉远，产生眩晕感',
      '滑动变焦，背景压缩前景放大，强烈视觉冲击',
      'Dolly Zoom效果，情绪爆发时刻，戏剧张力拉满',
      '推拉变焦，空间扭曲感，不安情绪放大',
    ],
    promptTemplates: [
      '希区柯克变焦，{custom}',
      '滑动变焦，镜头{dolly}同时变焦{zoom}，{custom}',
      'Dolly Zoom效果，眩晕感，{custom}',
    ],
  },
  
  // 环绕镜头
  {
    type: 'orbit',
    name: '环绕镜头',
    category: 'advanced',
    description: '镜头围绕主体旋转运动，全方位展示人物或物体，增强立体感和戏剧性',
    technicalTerms: ['环绕拍摄', '360度旋转', '圆形运动', '环绕主体', '包围镜头'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['epic', 'romantic', 'tension', 'excitement'],
    speed: 'medium',
    examples: [
      '环绕镜头，360度围绕主体旋转，全方位展示',
      '圆形运动镜头，人物成为焦点，立体感强',
      '环绕拍摄，情绪高潮时刻，戏剧性拉满',
      '包围镜头，围绕人物旋转，史诗感',
    ],
    promptTemplates: [
      '环绕镜头，{speed}围绕{subject}旋转，{custom}',
      '360度环绕，{custom}',
      '圆形运动，围绕主体，{custom}',
    ],
  },
  
  // 弧形运动
  {
    type: 'arc',
    name: '弧形运动',
    category: 'advanced',
    description: '镜头沿弧线运动，优雅地改变视角，保持主体构图的同时展示环境',
    technicalTerms: ['弧形移动', '弧线运动', '曲线运镜', '优雅弧线', '弧形推拉'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['romantic', 'epic', 'calm', 'mysterious'],
    speed: 'slow',
    examples: [
      '弧形运动镜头，优雅改变视角，电影感十足',
      '弧线运镜，人物与环境互动自然',
      '曲线运动，平滑过渡，叙事流畅',
      '弧形推拉，视角转换优雅',
    ],
    promptTemplates: [
      '弧形运动，{direction}弧线，{custom}',
      '弧线运镜，{custom}',
      '曲线移动，{custom}',
    ],
  },
  
  // 螺旋运动
  {
    type: 'spiral',
    name: '螺旋运动',
    category: 'advanced',
    description: '镜头螺旋上升或下降，产生强烈的视觉冲击和心理暗示',
    technicalTerms: ['螺旋上升', '螺旋下降', '旋转运动', '螺旋推近', '旋涡效果'],
    suitableShots: ['long_shot', 'extreme_long_shot', 'full_shot'],
    suitableMoods: ['tension', 'fear', 'suspense', 'horror', 'mysterious'],
    speed: 'medium',
    examples: [
      '螺旋下降镜头，俯视旋转下降，眩晕感',
      '螺旋上升，从主体升起旋转，史诗感',
      '旋涡效果，情绪逐渐收紧',
      '螺旋推近，聚焦核心，戏剧性强',
    ],
    promptTemplates: [
      '螺旋{direction}，{custom}',
      '旋转运动，{speed}螺旋，{custom}',
      '旋涡效果，{custom}',
    ],
  },
  
  // 甩镜头
  {
    type: 'whip',
    name: '甩镜头',
    category: 'advanced',
    description: '快速甩动镜头，产生强烈的运动模糊效果，常用于转场或情绪突变',
    technicalTerms: ['快速甩镜', '甩拍', '快速转场', '甩动模糊', '急速甩摇'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['tension', 'excitement', 'surprise', 'fear'],
    speed: 'very_fast',
    examples: [
      '快速甩镜头，运动模糊，瞬间转场',
      '甩拍转场，节奏紧凑，动感强烈',
      '急速甩摇，情绪突变，冲击力强',
      '甩动模糊，快速切换视角',
    ],
    promptTemplates: [
      '甩镜头，{speed}甩向{direction}，{custom}',
      '甩拍转场，{custom}',
      '快速甩镜，运动模糊，{custom}',
    ],
  },
  
  // 航拍镜头
  {
    type: 'drone',
    name: '航拍镜头',
    category: 'advanced',
    description: '无人机高空拍摄，展现宏大的空间环境，史诗级的开场或场景交代',
    technicalTerms: ['航拍', '无人机拍摄', '鸟瞰航拍', '高空俯瞰', '飞越镜头'],
    suitableShots: ['long_shot', 'extreme_long_shot'],
    suitableMoods: ['epic', 'calm', 'hopeful', 'surprise'],
    speed: 'medium',
    examples: [
      '航拍镜头，飞越城市天际线，史诗感',
      '无人机高空俯瞰，全景展现，宏大叙事',
      '鸟瞰航拍，山川河流尽收眼底',
      '飞越镜头，从高空掠过，电影级开场',
    ],
    promptTemplates: [
      '航拍镜头，{action}，{custom}',
      '无人机{direction}飞行，{custom}',
      '高空俯瞰，{custom}',
    ],
  },
  
  // 慢门运镜
  {
    type: 'slow_motion',
    name: '慢门运镜',
    category: 'advanced',
    description: '通过动态模糊展现时间维度，产生梦幻、回忆或超现实的效果',
    technicalTerms: ['慢门效果', '动态模糊', '时间拉伸', '梦幻模糊', '长曝光运镜'],
    suitableShots: ['medium_shot', 'long_shot', 'full_shot'],
    suitableMoods: ['romantic', 'sad', 'melancholy', 'calm', 'mysterious'],
    speed: 'very_slow',
    examples: [
      '慢门运镜，动态模糊，时间流逝感',
      '长曝光效果，梦幻模糊，回忆质感',
      '动态模糊，人物与背景融合，艺术感强',
      '时间拉伸，情绪慢动作，戏剧性',
    ],
    promptTemplates: [
      '慢门运镜，动态模糊，{custom}',
      '长曝光效果，{custom}',
      '时间拉伸，慢动作，{custom}',
    ],
  },
  
  // 延时摄影
  {
    type: 'time_lapse',
    name: '延时摄影',
    category: 'advanced',
    description: '加速时间流逝，展现日出日落、云卷云舒等时间变化',
    technicalTerms: ['延时摄影', '时间压缩', '快进效果', '日夜变化', '时间流逝'],
    suitableShots: ['long_shot', 'extreme_long_shot'],
    suitableMoods: ['epic', 'calm', 'hopeful'],
    speed: 'very_fast',
    examples: [
      '延时摄影，日出日落，时间流逝',
      '时间压缩，云卷云舒，自然之美',
      '快进效果，城市车水马龙',
      '日夜变化，光影流转，史诗感',
    ],
    promptTemplates: [
      '延时摄影，{subject}变化，{custom}',
      '时间压缩，{custom}',
      '快进效果，时间流逝，{custom}',
    ],
  },
  
  // 视差运镜
  {
    type: 'parallax',
    name: '视差运镜',
    category: 'advanced',
    description: '前景与背景以不同速度移动，产生强烈的立体感和纵深感',
    technicalTerms: ['视差效果', '景深感', '前后分层', '立体纵深', '视差滚动'],
    suitableShots: ['medium_shot', 'long_shot', 'full_shot'],
    suitableMoods: ['epic', 'tension', 'excitement'],
    speed: 'medium',
    examples: [
      '视差运镜，前景快速后景缓慢，立体纵深',
      '前后分层移动，景深感强烈',
      '视差效果，画面层次丰富，电影感',
      '立体纵深，空间感拉满',
    ],
    promptTemplates: [
      '视差运镜，前景{speed1}后景{speed2}，{custom}',
      '前后分层，{custom}',
      '立体纵深，{custom}',
    ],
  },
  
  // 揭示运镜
  {
    type: 'reveal',
    name: '揭示运镜',
    category: 'advanced',
    description: '通过镜头运动逐步揭示隐藏的信息，制造悬念和惊喜',
    technicalTerms: ['揭示镜头', '悬念揭示', '遮挡揭示', '转场揭示', '逐步展示'],
    suitableShots: ['medium_shot', 'long_shot', 'full_shot'],
    suitableMoods: ['suspense', 'surprise', 'mysterious', 'tension'],
    speed: 'slow',
    examples: [
      '揭示运镜，从遮挡物后移出，展示主体',
      '悬念揭示，镜头移动露出关键人物',
      '转场揭示，走过门框后场景切换',
      '逐步展示，镜头运动揭开谜底',
    ],
    promptTemplates: [
      '揭示运镜，从{from}到{to}，{custom}',
      '悬念揭示，{custom}',
      '遮挡揭示，{custom}',
    ],
  },
  
  // 荷兰角
  {
    type: 'dutch_angle',
    name: '荷兰角',
    category: 'advanced',
    description: '镜头倾斜构图，产生不安、混乱或疯狂的心理暗示',
    technicalTerms: ['荷兰角', '倾斜构图', '歪斜镜头', '不安构图', '倾斜视角'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['tension', 'fear', 'horror', 'angry', 'mysterious'],
    speed: 'slow',
    examples: [
      '荷兰角构图，倾斜视角，不安感',
      '歪斜镜头，混乱与疯狂的心理暗示',
      '倾斜构图，营造紧张氛围',
      '不安构图，倾斜角度，戏剧性',
    ],
    promptTemplates: [
      '荷兰角，倾斜{angle}度，{custom}',
      '倾斜构图，{custom}',
      '歪斜镜头，不安感，{custom}',
    ],
  },
  
  // 过肩镜头
  {
    type: 'over_shoulder',
    name: '过肩镜头',
    category: 'advanced',
    description: '从一人肩部拍摄另一人，经典对话场景构图，建立人物关系',
    technicalTerms: ['过肩镜头', '肩上构图', '对话构图', '双人构图', '关系镜头'],
    suitableShots: ['medium_close_up', 'medium_shot', 'close_up'],
    suitableMoods: ['tension', 'romantic', 'calm', 'suspense'],
    speed: 'slow',
    examples: [
      '过肩镜头，从A肩部拍摄B，对话场景',
      '肩上构图，建立人物对视关系',
      '双人构图，对话双方情绪对比',
      '关系镜头，人物互动自然',
    ],
    promptTemplates: [
      '过肩镜头，从{person1}拍摄{person2}，{custom}',
      '肩上构图，{custom}',
      '对话构图，{custom}',
    ],
  },
  
  // 主观视角
  {
    type: 'pov',
    name: '主观视角',
    category: 'advanced',
    description: '模拟角色第一人称视角，强烈的代入感和沉浸感',
    technicalTerms: ['主观镜头', '第一人称视角', 'POV', '代入视角', '角色视角'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['fear', 'tension', 'excitement', 'surprise'],
    speed: 'medium',
    examples: [
      '主观视角，模拟角色眼中的世界',
      '第一人称镜头，强烈的代入感',
      'POV视角，沉浸式体验',
      '角色视角，跟随人物视线',
    ],
    promptTemplates: [
      '主观视角，{character}视角，{custom}',
      '第一人称镜头，{custom}',
      'POV，{custom}',
    ],
  },
  
  // 低角度
  {
    type: 'low_angle',
    name: '低角度',
    category: 'advanced',
    description: '从低处向上拍摄，使主体显得高大威严，增强权力感',
    technicalTerms: ['低角度仰拍', '仰视构图', '低机位', '仰角拍摄', '英雄视角'],
    suitableShots: ['full_shot', 'long_shot', 'medium_shot'],
    suitableMoods: ['epic', 'tension', 'angry', 'fear'],
    speed: 'medium',
    examples: [
      '低角度仰拍，人物高大威严',
      '仰视构图，英雄视角，气势磅礴',
      '低机位拍摄，增强权力感',
      '仰角构图，压迫感与敬畏感并存',
    ],
    promptTemplates: [
      '低角度仰拍，{subject}高大威严，{custom}',
      '仰视构图，{custom}',
      '英雄视角，{custom}',
    ],
  },
  
  // 高角度
  {
    type: 'high_angle',
    name: '高角度',
    category: 'advanced',
    description: '从高处向下拍摄，使主体显得渺小，增强无助感或掌控感',
    technicalTerms: ['高角度俯拍', '俯视构图', '高机位', '俯角拍摄', '俯瞰视角'],
    suitableShots: ['full_shot', 'long_shot', 'extreme_long_shot'],
    suitableMoods: ['sad', 'fear', 'calm', 'epic'],
    speed: 'medium',
    examples: [
      '高角度俯拍，人物渺小无助',
      '俯视构图，全局掌控感',
      '高机位拍摄，环境与人物关系',
      '俯角构图，孤立无援感',
    ],
    promptTemplates: [
      '高角度俯拍，{subject}渺小，{custom}',
      '俯视构图，{custom}',
      '高机位，{custom}',
    ],
  },
  
  // 上帝视角
  {
    type: 'god_eye',
    name: '上帝视角',
    category: 'advanced',
    description: '垂直向下拍摄，全景俯瞰，史诗级的场景展示',
    technicalTerms: ['上帝视角', '垂直俯拍', '顶视图', '全景俯瞰', '鸟瞰正上方'],
    suitableShots: ['extreme_long_shot', 'long_shot', 'full_shot'],
    suitableMoods: ['epic', 'calm', 'surprise'],
    speed: 'slow',
    examples: [
      '上帝视角，垂直俯瞰，全景展现',
      '顶视图，建筑布局一览无余',
      '垂直俯拍，史诗级场景',
      '鸟瞰正上方，宏大叙事',
    ],
    promptTemplates: [
      '上帝视角，垂直俯拍，{custom}',
      '顶视图，{custom}',
      '全景俯瞰，{custom}',
    ],
  },
  
  // ============ 组合运镜 ============
  
  // 推+变焦
  {
    type: 'push_zoom',
    name: '推进+变焦',
    category: 'combo',
    description: '镜头推进同时变焦，产生强烈的视觉冲击，经典电影技法',
    technicalTerms: ['推镜变焦', '推进变焦组合', '推焦同步', '推进+推焦'],
    suitableShots: ['medium_shot', 'close_up', 'long_shot'],
    suitableMoods: ['tension', 'surprise', 'fear', 'angry'],
    speed: 'medium',
    examples: [
      '推进+变焦，背景压缩前景放大，强烈冲击',
      '推镜变焦，情绪爆发时刻',
      '推进+推焦，双重视觉变化',
    ],
    promptTemplates: [
      '推进+变焦组合，{custom}',
      '镜头推进同时推焦，{custom}',
    ],
  },
  
  // 拉+变焦
  {
    type: 'pull_zoom',
    name: '拉远+变焦',
    category: 'combo',
    description: '镜头拉远同时变焦，产生空间扩张感',
    technicalTerms: ['拉镜变焦', '拉远变焦组合', '拉焦同步', '拉远+拉焦'],
    suitableShots: ['long_shot', 'full_shot', 'extreme_long_shot'],
    suitableMoods: ['surprise', 'epic', 'calm'],
    speed: 'medium',
    examples: [
      '拉远+变焦，空间扩张感',
      '拉镜变焦，全景揭示',
      '拉远+拉焦，环境交代',
    ],
    promptTemplates: [
      '拉远+变焦组合，{custom}',
      '镜头拉远同时拉焦，{custom}',
    ],
  },
  
  // 跟拍+环绕
  {
    type: 'track_orbit',
    name: '跟拍+环绕',
    category: 'combo',
    description: '跟随主体同时环绕，全方位展示，人物出场的万金油组合',
    technicalTerms: ['跟拍环绕', '跟随旋转', '环绕跟拍', '跟踪环绕组合'],
    suitableShots: ['full_shot', 'medium_shot', 'long_shot'],
    suitableMoods: ['epic', 'excitement', 'romantic'],
    speed: 'medium',
    examples: [
      '跟拍+环绕，人物出场最强万金油',
      '跟随环绕，全方位展示人物',
      '环绕跟拍，动感十足',
    ],
    promptTemplates: [
      '跟拍+环绕组合，{custom}',
      '跟随{subject}同时环绕，{custom}',
    ],
  },
  
  // 升降+横摇
  {
    type: 'crane_pan',
    name: '升降+横摇',
    category: 'combo',
    description: '升降同时横摇，航拍感，宏大开场',
    technicalTerms: ['升降横摇', '升降摇镜', '起落摇拍', '升降+横移'],
    suitableShots: ['long_shot', 'extreme_long_shot', 'full_shot'],
    suitableMoods: ['epic', 'calm', 'hopeful'],
    speed: 'slow',
    examples: [
      '升降+横摇，航拍感宏大开场',
      '升降摇镜，全景展现',
      '起落横移，史诗级场景',
    ],
    promptTemplates: [
      '升降+横摇组合，{custom}',
      '升降同时横摇，{custom}',
    ],
  },
  
  // 手持+推进
  {
    type: 'handheld_push',
    name: '手持+推进',
    category: 'combo',
    description: '手持晃动同时推进，纪实感+紧迫感',
    technicalTerms: ['手持推进', '晃动推进', '手持推近', '纪实推进'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['fear', 'tension', 'horror', 'excitement'],
    speed: 'medium',
    examples: [
      '手持+推进，纪实紧迫感',
      '晃动推进，临场紧张感',
      '手持推近，真实记录感',
    ],
    promptTemplates: [
      '手持+推进组合，{custom}',
      '手持晃动同时推进，{custom}',
    ],
  },
  
  // 稳定器+环绕
  {
    type: 'steadicam_orbit',
    name: '稳定器+环绕',
    category: 'combo',
    description: '稳定器平滑环绕，丝滑流畅的电影感',
    technicalTerms: ['稳定器环绕', '丝滑环绕', '斯坦尼康环绕', '平稳环绕'],
    suitableShots: ['full_shot', 'medium_shot', 'long_shot'],
    suitableMoods: ['romantic', 'epic', 'calm'],
    speed: 'slow',
    examples: [
      '稳定器+环绕，丝滑流畅的电影感',
      '斯坦尼康环绕，专业电影级',
      '平稳环绕，优雅展示',
    ],
    promptTemplates: [
      '稳定器+环绕组合，{custom}',
      '斯坦尼康平滑环绕，{custom}',
    ],
  },
  
  // ============ 特效运镜 - 冲击感与电影感专用 ============
  
  // 子弹时间
  {
    type: 'bullet_time',
    name: '子弹时间',
    category: 'effect',
    description: '时间冻结效果，镜头环绕主体高速旋转，创造超越现实的视觉震撼，经典特效运镜',
    technicalTerms: ['子弹时间', 'Bullet Time', '时间冻结', '环绕定格', '时空停止'],
    suitableShots: ['full_shot', 'medium_shot', 'long_shot'],
    suitableMoods: ['shock', 'epic', 'intense', 'dramatic'],
    speed: 'medium',
    examples: [
      '子弹时间特效，时间冻结，镜头高速环绕主体旋转，震撼视觉',
      'Bullet Time，时间静止，360度环绕拍摄，超越现实的视觉体验',
      '时空停止，主体悬浮静止，镜头极速环绕，史诗级特效',
    ],
    promptTemplates: [
      '子弹时间特效，时间冻结，镜头环绕主体旋转，{custom}',
      'Bullet Time，{subject}定格，镜头高速环绕，{custom}',
    ],
  },
  
  // 冲击式推进
  {
    type: 'impact_push',
    name: '冲击式推进',
    category: 'effect',
    description: '极速推进创造强烈冲击感，瞬间拉近产生视觉爆炸效果',
    technicalTerms: ['冲击推进', '极速推镜', '爆炸式推进', '瞬推', '暴力推进'],
    suitableShots: ['medium_shot', 'close_up', 'extreme_close_up'],
    suitableMoods: ['shock', 'angry', 'intense', 'dramatic'],
    speed: 'very_fast',
    examples: [
      '冲击式推进，极速拉近，视觉冲击力爆表',
      '爆炸式推进，瞬间聚焦，画面冲击感强烈',
      '暴力推进，极速突进，震撼视觉',
    ],
    promptTemplates: [
      '冲击式推进，极速拉近，{custom}',
      '爆炸式推进，瞬间聚焦{subject}，{custom}',
    ],
  },
  
  // 呼吸感推进
  {
    type: 'breathing_push',
    name: '呼吸感推进',
    category: 'effect',
    description: '镜头轻微呼吸感推进，模拟人眼聚焦效果，自然柔和的情绪放大',
    technicalTerms: ['呼吸感推进', '微呼吸', '自然聚焦', '情绪推进', '柔和推进'],
    suitableShots: ['close_up', 'extreme_close_up', 'medium_close_up'],
    suitableMoods: ['romantic', 'sad', 'calm', 'melancholy'],
    speed: 'very_slow',
    examples: [
      '呼吸感推进，轻微呼吸节奏，自然柔和的情绪放大',
      '微呼吸镜头，模拟人眼聚焦，细腻情感表达',
      '自然聚焦推进，呼吸感晃动，真实感强烈',
    ],
    promptTemplates: [
      '呼吸感推进，轻微呼吸节奏，{custom}',
      '微呼吸镜头，自然聚焦{subject}，{custom}',
    ],
  },
  
  // 爆破式变焦
  {
    type: 'explosive_zoom',
    name: '爆破式变焦',
    category: 'effect',
    description: '极速变焦产生爆破感，瞬间放大主体，戏剧性极强',
    technicalTerms: ['爆破变焦', '极速推焦', '爆炸式聚焦', '瞬间放大'],
    suitableShots: ['medium_shot', 'close_up', 'long_shot'],
    suitableMoods: ['shock', 'intense', 'dramatic', 'surprise'],
    speed: 'hyper',
    examples: [
      '爆破式变焦，极速推焦，瞬间放大主体，戏剧性爆表',
      '爆炸式聚焦，瞬间拉近，视觉冲击力拉满',
      '极速变焦，瞬间放大，震撼人心',
    ],
    promptTemplates: [
      '爆破式变焦，极速推焦聚焦{subject}，{custom}',
      '爆炸式聚焦，瞬间放大，{custom}',
    ],
  },
  
  // 瞬间变焦
  {
    type: 'snap_zoom',
    name: '瞬间变焦',
    category: 'effect',
    description: '快速变焦切换焦点，瞬间转移注意力，节奏感强',
    technicalTerms: ['瞬间变焦', '快速切换焦点', 'Snap Zoom', '焦点跳跃'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['surprise', 'tension', 'excitement'],
    speed: 'very_fast',
    examples: [
      '瞬间变焦，快速切换焦点，注意力瞬间转移',
      'Snap Zoom，焦点跳跃，节奏感强烈',
      '快速变焦切换，瞬间聚焦关键人物',
    ],
    promptTemplates: [
      '瞬间变焦，从{subject1}快速切换到{subject2}，{custom}',
      'Snap Zoom，快速焦点切换，{custom}',
    ],
  },
  
  // 撞击变焦
  {
    type: 'crash_zoom',
    name: '撞击变焦',
    category: 'effect',
    description: '变焦配合撞击效果，产生强烈的物理冲击感，动作场景必备',
    technicalTerms: ['撞击变焦', 'Crash Zoom', '冲击聚焦', '暴力变焦'],
    suitableShots: ['close_up', 'medium_shot', 'full_shot'],
    suitableMoods: ['angry', 'intense', 'shock', 'dramatic'],
    speed: 'very_fast',
    examples: [
      '撞击变焦，配合动作冲击，物理冲击感强烈',
      'Crash Zoom，暴力变焦，冲击力爆表',
      '冲击聚焦，变焦配合撞击，震撼视觉',
    ],
    promptTemplates: [
      '撞击变焦，配合{action}冲击，{custom}',
      'Crash Zoom，冲击聚焦，{custom}',
    ],
  },
  
  // 暴力甩镜
  {
    type: 'whip_pan',
    name: '暴力甩镜',
    category: 'effect',
    description: '极速水平甩动，产生强烈运动模糊，暴力转场效果',
    technicalTerms: ['暴力甩镜', '极速横甩', 'Whip Pan', '闪电甩摇'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['intense', 'excitement', 'shock', 'dramatic'],
    speed: 'hyper',
    examples: [
      '暴力甩镜，极速横甩，运动模糊转场',
      'Whip Pan，闪电甩摇，暴力转场效果',
      '极速横甩，强烈运动模糊，冲击感十足',
    ],
    promptTemplates: [
      '暴力甩镜，极速横甩{direction}，{custom}',
      'Whip Pan，闪电甩摇，{custom}',
    ],
  },
  
  // 眩晕效果
  {
    type: 'vertigo',
    name: '眩晕效果',
    category: 'effect',
    description: '制造视觉眩晕感，空间扭曲变形，心理暗示强烈',
    technicalTerms: ['眩晕效果', 'Vertigo', '空间扭曲', '视觉迷幻'],
    suitableShots: ['medium_shot', 'long_shot', 'full_shot'],
    suitableMoods: ['fear', 'horror', 'suspense', 'shock'],
    speed: 'medium',
    examples: [
      '眩晕效果，空间扭曲变形，视觉迷幻感',
      'Vertigo，镜头旋转配合变焦，产生强烈眩晕',
      '空间扭曲，视觉迷幻，心理暗示强烈',
    ],
    promptTemplates: [
      '眩晕效果，空间扭曲，{custom}',
      'Vertigo，视觉迷幻，{custom}',
    ],
  },
  
  // 定格画面
  {
    type: 'freeze_frame',
    name: '定格画面',
    category: 'effect',
    description: '画面瞬间定格，时间凝固效果，强调关键时刻',
    technicalTerms: ['定格画面', 'Freeze Frame', '时间凝固', '画面冻结'],
    suitableShots: ['full_shot', 'medium_shot', 'close_up'],
    suitableMoods: ['surprise', 'shock', 'dramatic', 'epic'],
    speed: 'very_slow',
    examples: [
      '定格画面，时间凝固，强调关键时刻',
      'Freeze Frame，瞬间冻结，戏剧性极强',
      '画面定格，时间停止，强调瞬间',
    ],
    promptTemplates: [
      '定格画面，时间凝固，{custom}',
      'Freeze Frame，瞬间冻结{subject}，{custom}',
    ],
  },
  
  // 闪电剪辑
  {
    type: 'flash_cut',
    name: '闪电剪辑',
    category: 'effect',
    description: '极速切换镜头，闪电般的转场速度，节奏紧凑',
    technicalTerms: ['闪电剪辑', 'Flash Cut', '极速切换', '闪电转场'],
    suitableShots: ['close_up', 'medium_shot', 'full_shot'],
    suitableMoods: ['intense', 'excitement', 'shock', 'dramatic'],
    speed: 'hyper',
    examples: [
      '闪电剪辑，极速切换，节奏紧凑',
      'Flash Cut，闪电转场，快速切换镜头',
      '极速切换，闪电般转场，冲击感强',
    ],
    promptTemplates: [
      '闪电剪辑，极速切换，{custom}',
      'Flash Cut，快速转场，{custom}',
    ],
  },
  
  // 超高速运镜
  {
    type: 'hyper_speed',
    name: '超高速运镜',
    category: 'effect',
    description: '超高速运动镜头，超越常规的速度感，极限冲击',
    technicalTerms: ['超高速运镜', 'Hyper Speed', '极限速度', '极速推进'],
    suitableShots: ['long_shot', 'full_shot', 'extreme_long_shot'],
    suitableMoods: ['excitement', 'intense', 'epic', 'shock'],
    speed: 'hyper',
    examples: [
      '超高速运镜，极限速度推进，冲击感拉满',
      'Hyper Speed，超越常规的速度感，极限冲击',
      '极速推进，超高速运动，震撼视觉',
    ],
    promptTemplates: [
      '超高速运镜，极限速度{action}，{custom}',
      'Hyper Speed，极速推进，{custom}',
    ],
  },
  
  // 变形运镜
  {
    type: 'morph',
    name: '变形运镜',
    category: 'effect',
    description: '画面变形过渡，形态变换效果，科幻感强烈',
    technicalTerms: ['变形运镜', 'Morph', '形态变换', '变形过渡'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['mysterious', 'surprise', 'epic', 'dramatic'],
    speed: 'medium',
    examples: [
      '变形运镜，画面形态变换，科幻感强烈',
      'Morph，变形过渡，形态切换流畅',
      '形态变换，画面扭曲变形，神秘感',
    ],
    promptTemplates: [
      '变形运镜，形态变换，{custom}',
      'Morph，从{from}变形为{to}，{custom}',
    ],
  },
  
  // 故障风运镜
  {
    type: 'glitch_move',
    name: '故障风运镜',
    category: 'effect',
    description: '数字故障效果运镜，赛博朋克风格，科技感与破坏感并存',
    technicalTerms: ['故障风运镜', 'Glitch', '数字故障', '赛博朋克'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['intense', 'dramatic', 'mysterious', 'shock'],
    speed: 'fast',
    examples: [
      '故障风运镜，数字故障效果，赛博朋克感',
      'Glitch，画面故障闪烁，科技感强烈',
      '数字故障，赛博朋克风格，破坏美感',
    ],
    promptTemplates: [
      '故障风运镜，数字故障效果，{custom}',
      'Glitch，赛博朋克风格，{custom}',
    ],
  },
  
  // 震撼冲击
  {
    type: 'shake_impact',
    name: '震撼冲击',
    category: 'effect',
    description: '强烈震动效果，配合冲击动作，物理震撼感',
    technicalTerms: ['震撼冲击', 'Shake Impact', '震动效果', '冲击震动'],
    suitableShots: ['full_shot', 'medium_shot', 'close_up'],
    suitableMoods: ['shock', 'intense', 'dramatic', 'angry'],
    speed: 'very_fast',
    examples: [
      '震撼冲击，强烈震动效果，物理震撼感',
      'Shake Impact，冲击震动，画面剧烈晃动',
      '震动效果，配合冲击动作，震撼视觉',
    ],
    promptTemplates: [
      '震撼冲击，强烈震动，{custom}',
      'Shake Impact，冲击震动，{custom}',
    ],
  },
  
  // 拳击式切入
  {
    type: 'punch_in',
    name: '拳击式切入',
    category: 'effect',
    description: '快速切入特写，如同拳击出击，瞬间放大冲击',
    technicalTerms: ['拳击式切入', 'Punch In', '快速切入', '瞬间特写'],
    suitableShots: ['extreme_close_up', 'close_up', 'medium_shot'],
    suitableMoods: ['angry', 'intense', 'shock', 'dramatic'],
    speed: 'very_fast',
    examples: [
      '拳击式切入，快速切入特写，瞬间冲击',
      'Punch In，瞬间放大特写，如拳击出击',
      '快速切入特写，冲击力十足',
    ],
    promptTemplates: [
      '拳击式切入，快速切入{subject}特写，{custom}',
      'Punch In，瞬间放大，{custom}',
    ],
  },
  
  // ============ 更多组合运镜 ============
  
  // 呼吸感+环绕
  {
    type: 'breathing_orbit',
    name: '呼吸感+环绕',
    category: 'combo',
    description: '呼吸感轻微晃动配合环绕，电影感极强的情绪表达',
    technicalTerms: ['呼吸感环绕', '微呼吸旋转', '柔和环绕'],
    suitableShots: ['close_up', 'medium_shot', 'full_shot'],
    suitableMoods: ['romantic', 'sad', 'calm', 'melancholy'],
    speed: 'slow',
    examples: [
      '呼吸感+环绕，轻微呼吸节奏配合旋转，电影感极强',
      '微呼吸环绕，柔和情绪表达，细腻感人',
      '呼吸感旋转，情绪自然放大',
    ],
    promptTemplates: [
      '呼吸感+环绕，{custom}',
      '微呼吸环绕，{custom}',
    ],
  },
  
  // 冲击式拉远
  {
    type: 'impact_pull',
    name: '冲击式拉远',
    category: 'combo',
    description: '极速拉远创造震撼揭示效果，瞬间展示全景',
    technicalTerms: ['冲击拉远', '极速后拉', '震撼揭示'],
    suitableShots: ['long_shot', 'extreme_long_shot', 'full_shot'],
    suitableMoods: ['shock', 'epic', 'surprise', 'dramatic'],
    speed: 'very_fast',
    examples: [
      '冲击式拉远，极速后拉揭示全景，震撼感',
      '极速拉远，瞬间展示宏大场景',
      '震撼揭示，冲击式后拉',
    ],
    promptTemplates: [
      '冲击式拉远，极速后拉，{custom}',
      '震撼揭示，瞬间展示全景，{custom}',
    ],
  },
  
  // 慢动作+推进
  {
    type: 'slow_motion_push',
    name: '慢动作+推进',
    category: 'combo',
    description: '慢动作配合推进，时间放大的情绪递进',
    technicalTerms: ['慢动作推进', '时间拉伸推镜', '情绪慢推'],
    suitableShots: ['medium_shot', 'close_up', 'full_shot'],
    suitableMoods: ['romantic', 'sad', 'epic', 'dramatic'],
    speed: 'very_slow',
    examples: [
      '慢动作+推进，时间放大的情绪递进',
      '时间拉伸推镜，慢动作推进，情绪细腻',
      '情绪慢推，时间凝固般的美感',
    ],
    promptTemplates: [
      '慢动作+推进，时间拉伸，{custom}',
      '情绪慢推，{custom}',
    ],
  },
  
  // 甩镜+揭示
  {
    type: 'whip_reveal',
    name: '甩镜+揭示',
    category: 'combo',
    description: '甩镜转场配合揭示效果，快速展示新信息',
    technicalTerms: ['甩镜揭示', '快速揭示', '甩摇揭示'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['surprise', 'suspense', 'excitement', 'dramatic'],
    speed: 'fast',
    examples: [
      '甩镜+揭示，快速转场展示新场景',
      '快速揭示，甩镜转场配合揭示',
      '甩摇揭示，节奏感强烈的转场',
    ],
    promptTemplates: [
      '甩镜+揭示，快速转场，{custom}',
      '甩摇揭示，展示{subject}，{custom}',
    ],
  },
  
  // 移动+荷兰角
  {
    type: 'dolly_dutch',
    name: '移动+荷兰角',
    category: 'combo',
    description: '移动镜头配合荷兰角，倾斜移动增强不安感',
    technicalTerms: ['倾斜移动', '荷兰角推拉', '不安移动'],
    suitableShots: ['medium_shot', 'full_shot', 'long_shot'],
    suitableMoods: ['tension', 'fear', 'horror', 'suspense'],
    speed: 'medium',
    examples: [
      '移动+荷兰角，倾斜移动增强不安感',
      '荷兰角推拉，倾斜构图配合移动',
      '不安移动，倾斜视角推拉',
    ],
    promptTemplates: [
      '移动+荷兰角，倾斜移动，{custom}',
      '倾斜视角移动，{custom}',
    ],
  },
  
  // 环绕+荷兰角
  {
    type: 'orbit_dutch',
    name: '环绕+荷兰角',
    category: 'combo',
    description: '环绕配合荷兰角，旋转中产生眩晕不安感',
    technicalTerms: ['倾斜环绕', '荷兰角旋转', '眩晕环绕'],
    suitableShots: ['full_shot', 'medium_shot', 'long_shot'],
    suitableMoods: ['fear', 'horror', 'tension', 'suspense'],
    speed: 'medium',
    examples: [
      '环绕+荷兰角，倾斜旋转产生眩晕感',
      '荷兰角环绕，旋转中不安感强烈',
      '眩晕环绕，倾斜视角旋转',
    ],
    promptTemplates: [
      '环绕+荷兰角，倾斜旋转，{custom}',
      '眩晕环绕，{custom}',
    ],
  },
  
  // 升降+环绕
  {
    type: 'crane_orbit',
    name: '升降+环绕',
    category: 'combo',
    description: '升降配合环绕，史诗级的场景展示，宏大叙事',
    technicalTerms: ['升降环绕', '螺旋升降', '史诗环绕'],
    suitableShots: ['long_shot', 'extreme_long_shot', 'full_shot'],
    suitableMoods: ['epic', 'calm', 'hopeful', 'dramatic'],
    speed: 'medium',
    examples: [
      '升降+环绕，螺旋上升配合环绕，史诗级',
      '史诗环绕，升降旋转，宏大叙事',
      '螺旋升降，史诗级场景展示',
    ],
    promptTemplates: [
      '升降+环绕，史诗级展示，{custom}',
      '螺旋升降环绕，{custom}',
    ],
  },
];

// ============================================
// 情绪对应的运镜风格
// ============================================

export const MOOD_CAMERA_STYLES: Record<MoodType, {
  preferredTypes: CameraMovementType[];
  speed: CameraSpeed;
  intensity: 'subtle' | 'moderate' | 'dramatic';
  description: string;
}> = {
  tension: {
    preferredTypes: ['push', 'dolly_zoom', 'handheld', 'zoom'],
    speed: 'slow',
    intensity: 'dramatic',
    description: '压迫感推镜头，缓慢收紧，情绪张力递增',
  },
  suspense: {
    preferredTypes: ['push', 'tilt', 'pan', 'reveal', 'dolly_zoom'],
    speed: 'slow',
    intensity: 'subtle',
    description: '悬疑式缓慢推进，侧逆光切割，明暗对比强烈',
  },
  romantic: {
    preferredTypes: ['dolly', 'steadicam', 'pull', 'orbit', 'slow_motion'],
    speed: 'slow',
    intensity: 'subtle',
    description: '浪漫柔和的平滑运动，光线温柔，氛围温馨',
  },
  happy: {
    preferredTypes: ['steadicam', 'tracking', 'dolly', 'orbit'],
    speed: 'medium',
    intensity: 'moderate',
    description: '轻快流畅的运动，画面明亮，节奏愉悦',
  },
  sad: {
    preferredTypes: ['pull', 'crane', 'tilt', 'slow_motion', 'high_angle'],
    speed: 'slow',
    intensity: 'subtle',
    description: '缓慢拉远或俯拍，孤寂感，情绪低沉',
  },
  angry: {
    preferredTypes: ['push', 'handheld', 'zoom', 'dutch_angle'],
    speed: 'fast',
    intensity: 'dramatic',
    description: '快速推进或晃动，冲击力强，情绪爆发',
  },
  fear: {
    preferredTypes: ['handheld', 'push', 'tilt', 'dolly_zoom', 'pov'],
    speed: 'medium',
    intensity: 'dramatic',
    description: '不安的手持晃动，俯拍压迫，恐惧感',
  },
  surprise: {
    preferredTypes: ['zoom', 'pull', 'tilt', 'whip', 'reveal'],
    speed: 'fast',
    intensity: 'dramatic',
    description: '快速变焦或拉远，揭示感强，冲击力',
  },
  calm: {
    preferredTypes: ['steadicam', 'dolly', 'static', 'slow_motion'],
    speed: 'slow',
    intensity: 'subtle',
    description: '平稳缓慢的运动，画面宁静，节奏舒缓',
  },
  epic: {
    preferredTypes: ['crane', 'pull', 'steadicam', 'drone', 'orbit', 'god_eye'],
    speed: 'medium',
    intensity: 'dramatic',
    description: '史诗级升降或拉远，宏大叙事，气势磅礴',
  },
  horror: {
    preferredTypes: ['handheld', 'push', 'tilt', 'dolly_zoom', 'dutch_angle', 'pov'],
    speed: 'slow',
    intensity: 'dramatic',
    description: '诡异缓慢推进，不安定感，恐怖氛围',
  },
  excitement: {
    preferredTypes: ['tracking', 'steadicam', 'handheld', 'whip'],
    speed: 'fast',
    intensity: 'dramatic',
    description: '快速动态运动，节奏紧凑，兴奋感强',
  },
  mysterious: {
    preferredTypes: ['reveal', 'pan', 'slow_motion', 'parallax'],
    speed: 'slow',
    intensity: 'subtle',
    description: '神秘感揭示，缓慢展现，悬念层层递进',
  },
  melancholy: {
    preferredTypes: ['pull', 'slow_motion', 'high_angle', 'static'],
    speed: 'slow',
    intensity: 'subtle',
    description: '忧郁缓慢拉远，时间流逝感，伤感氛围',
  },
  hopeful: {
    preferredTypes: ['crane', 'drone', 'pull', 'time_lapse'],
    speed: 'medium',
    intensity: 'moderate',
    description: '升起或拉远，展望未来，希望感',
  },
  shock: {
    preferredTypes: ['bullet_time', 'impact_push', 'explosive_zoom', 'whip_pan', 'shake_impact'],
    speed: 'very_fast',
    intensity: 'dramatic',
    description: '震撼冲击，极速运镜，视觉爆炸',
  },
  intense: {
    preferredTypes: ['impact_push', 'whip_pan', 'crash_zoom', 'hyper_speed', 'punch_in'],
    speed: 'fast',
    intensity: 'dramatic',
    description: '激烈紧张，快速运动，极限冲击',
  },
  dramatic: {
    preferredTypes: ['dolly_zoom', 'slow_motion_push', 'breathing_orbit', 'crane_orbit', 'orbit_dutch'],
    speed: 'medium',
    intensity: 'dramatic',
    description: '戏剧性强，情绪张力，电影级叙事',
  },
};

// ============================================
// 镜头类型对应的运镜建议
// ============================================

export const SHOT_TYPE_CAMERA_MOVEMENTS: Record<ShotType, {
  preferredTypes: CameraMovementType[];
  description: string;
}> = {
  extreme_close_up: {
    preferredTypes: ['static', 'push', 'zoom', 'slow_motion'],
    description: '大特写通常固定或微推，聚焦细节，情绪强烈',
  },
  close_up: {
    preferredTypes: ['push', 'static', 'zoom', 'dolly_zoom'],
    description: '特写适合缓慢推镜头或固定，突出人物表情',
  },
  medium_close_up: {
    preferredTypes: ['push', 'dolly', 'steadicam', 'over_shoulder'],
    description: '中近景适合平滑推镜头，保持人物互动',
  },
  medium_shot: {
    preferredTypes: ['dolly', 'steadicam', 'tracking', 'pan', 'orbit'],
    description: '中景适合多种运动，保持人物和环境平衡',
  },
  medium_long_shot: {
    preferredTypes: ['dolly', 'tracking', 'pan', 'arc'],
    description: '中远景适合移动镜头，展示人物动作和环境',
  },
  long_shot: {
    preferredTypes: ['pull', 'crane', 'pan', 'tilt', 'drone'],
    description: '远景适合拉远或俯仰，展示环境全貌',
  },
  extreme_long_shot: {
    preferredTypes: ['crane', 'pull', 'pan', 'drone', 'god_eye'],
    description: '大远景适合升降或横摇，史诗级场景展示',
  },
  full_shot: {
    preferredTypes: ['tracking', 'dolly', 'steadicam', 'orbit', 'low_angle'],
    description: '全景适合跟随或移动，展示人物全身动作',
  },
  cowboy_shot: {
    preferredTypes: ['tracking', 'steadicam', 'dolly'],
    description: '牛仔镜头适合跟拍，展示人物形象',
  },
};

// ============================================
// 场景类型对应的运镜建议
// ============================================

export const SCENE_TYPE_CAMERA_MOVEMENTS: Record<SceneType, {
  preferredTypes: CameraMovementType[];
  speed: CameraSpeed;
  style: string;
}> = {
  indoor: {
    preferredTypes: ['push', 'pull', 'dolly', 'steadicam', 'over_shoulder'],
    speed: 'slow',
    style: '室内场景适合平稳的推拉移动，营造氛围',
  },
  outdoor: {
    preferredTypes: ['crane', 'tracking', 'steadicam', 'pan', 'drone'],
    speed: 'medium',
    style: '室外场景适合更大范围的运动，展示空间',
  },
  action: {
    preferredTypes: ['handheld', 'tracking', 'steadicam', 'whip'],
    speed: 'fast',
    style: '动作场景适合快速跟踪和手持，动感强烈',
  },
  dialogue: {
    preferredTypes: ['static', 'pan', 'push', 'over_shoulder'],
    speed: 'slow',
    style: '对话场景适合固定或缓慢摇移，保持专注',
  },
  emotional: {
    preferredTypes: ['push', 'pull', 'steadicam', 'slow_motion'],
    speed: 'slow',
    style: '情感场景适合缓慢推拉，情绪渲染',
  },
  reveal: {
    preferredTypes: ['pull', 'pan', 'tilt', 'crane', 'reveal'],
    speed: 'medium',
    style: '揭示场景适合拉远或摇镜，逐步展示',
  },
  chase: {
    preferredTypes: ['tracking', 'handheld', 'steadicam', 'whip'],
    speed: 'fast',
    style: '追逐场景适合快速跟随，紧张刺激',
  },
  confrontation: {
    preferredTypes: ['push', 'pull', 'pan', 'tilt', 'dutch_angle'],
    speed: 'medium',
    style: '对峙场景适合推拉切换，张力对比',
  },
  introspective: {
    preferredTypes: ['static', 'push', 'slow_motion', 'pov'],
    speed: 'slow',
    style: '内省场景适合静止或缓慢推进，内心独白',
  },
  transition: {
    preferredTypes: ['whip', 'pan', 'reveal', 'time_lapse'],
    speed: 'medium',
    style: '转场场景适合快速切换或渐进展示',
  },
};

// ============================================
// 运镜速度描述
// ============================================

export const CAMERA_SPEED_DESCRIPTIONS: Record<CameraSpeed, string> = {
  very_slow: '极缓慢',
  slow: '缓慢',
  medium: '平稳',
  fast: '快速',
  very_fast: '极速',
  hyper: '超高速',
};

// ============================================
// 辅助函数
// ============================================

/**
 * 根据参数生成智能运镜提示词
 */
export function generateCameraMovementPrompt(params: {
  shotType?: string;
  mood?: string;
  sceneType?: string;
  customDescription?: string;
  action?: string;
  emotion?: string;
  speed?: CameraSpeed;
  useCombo?: boolean;
}): string {
  const { shotType, mood, sceneType, customDescription, action, emotion, speed, useCombo = true } = params;
  
  // 解析输入
  const parsedShotType = parseShotType(shotType);
  const parsedMood = parseMood(mood || emotion);
  const parsedSceneType = parseSceneType(sceneType);
  
  // 获取推荐配置
  const moodStyle = MOOD_CAMERA_STYLES[parsedMood];
  const shotStyle = SHOT_TYPE_CAMERA_MOVEMENTS[parsedShotType];
  const sceneStyle = SCENE_TYPE_CAMERA_MOVEMENTS[parsedSceneType];
  
  // 优先级：情绪 > 镜头类型 > 场景类型
  let preferredTypes = moodStyle?.preferredTypes || shotStyle?.preferredTypes || sceneStyle?.preferredTypes || ['push'];
  
  // 如果不使用组合运镜，过滤掉combo类型
  if (!useCombo) {
    preferredTypes = preferredTypes.filter(type => {
      const prompt = CAMERA_MOVEMENT_PROMPTS.find(p => p.type === type);
      return prompt?.category !== 'combo';
    });
  }
  
  // 从推荐类型中随机选择一个
  const selectedType = preferredTypes[Math.floor(Math.random() * preferredTypes.length)];
  const cameraPrompt = CAMERA_MOVEMENT_PROMPTS.find(p => p.type === selectedType);
  
  if (!cameraPrompt) {
    return generateFallbackPrompt(shotType, mood, customDescription);
  }
  
  // 构建运镜提示词
  const actualSpeed = speed || moodStyle?.speed || cameraPrompt.speed;
  const speedDesc = CAMERA_SPEED_DESCRIPTIONS[actualSpeed];
  const intensityDesc = moodStyle?.intensity === 'dramatic' ? '电影级' :
                        moodStyle?.intensity === 'subtle' ? '细腻' : '专业';
  
  // 从示例中选择
  const example = cameraPrompt.examples[Math.floor(Math.random() * cameraPrompt.examples.length)];
  
  // 组合最终提示词
  let finalPrompt = '';
  
  // 根据运镜类型决定提示词格式
  if (cameraPrompt.category === 'combo') {
    // 组合运镜直接使用示例
    finalPrompt = example;
  } else {
    // 基础和高级运镜使用模板
    finalPrompt = `${intensityDesc}${speedDesc}${cameraPrompt.name}`;
    
    // 添加技术术语
    const techTerm = cameraPrompt.technicalTerms[Math.floor(Math.random() * cameraPrompt.technicalTerms.length)];
    finalPrompt += `，${techTerm}`;
    
    // 添加情绪描述
    if (moodStyle) {
      finalPrompt += `，${moodStyle.description}`;
    }
  }
  
  // 添加自定义描述
  if (customDescription) {
    finalPrompt += `，${customDescription}`;
  }
  
  // 添加动作描述
  if (action) {
    finalPrompt += `，配合${action}动作`;
  }
  
  return finalPrompt;
}

/**
 * 解析镜头类型
 */
function parseShotType(shotType?: string): ShotType {
  if (!shotType) return 'medium_shot';
  
  const lowerType = shotType.toLowerCase();
  const mapping: Record<string, ShotType> = {
    '大特写': 'extreme_close_up',
    '特写': 'close_up',
    '中近景': 'medium_close_up',
    '中景': 'medium_shot',
    '中远景': 'medium_long_shot',
    '远景': 'long_shot',
    '大远景': 'extreme_long_shot',
    '全景': 'full_shot',
    '牛仔镜头': 'cowboy_shot',
    'extreme close up': 'extreme_close_up',
    'close up': 'close_up',
    'medium close up': 'medium_close_up',
    'medium shot': 'medium_shot',
    'medium long shot': 'medium_long_shot',
    'long shot': 'long_shot',
    'extreme long shot': 'extreme_long_shot',
    'full shot': 'full_shot',
    'cowboy shot': 'cowboy_shot',
  };
  
  return mapping[lowerType] || mapping[shotType] || 'medium_shot';
}

/**
 * 解析情绪类型
 */
function parseMood(mood?: string): MoodType {
  if (!mood) return 'calm';
  
  const lowerMood = mood.toLowerCase();
  const mapping: Record<string, MoodType> = {
    '紧张': 'tension',
    '悬疑': 'suspense',
    '浪漫': 'romantic',
    '开心': 'happy',
    '快乐': 'happy',
    '悲伤': 'sad',
    '难过': 'sad',
    '愤怒': 'angry',
    '生气': 'angry',
    '恐惧': 'fear',
    '害怕': 'fear',
    '惊讶': 'surprise',
    '吃惊': 'surprise',
    '平静': 'calm',
    '安静': 'calm',
    '史诗': 'epic',
    '宏大': 'epic',
    '恐怖': 'horror',
    '兴奋': 'excitement',
    '激动': 'excitement',
    '神秘': 'mysterious',
    '忧郁': 'melancholy',
    '伤感': 'melancholy',
    '希望': 'hopeful',
    // 冲击感情绪
    '震撼': 'shock',
    '冲击': 'shock',
    '震惊': 'shock',
    '激烈': 'intense',
    '紧张激烈': 'intense',
    '极限': 'intense',
    '戏剧': 'dramatic',
    '戏剧性': 'dramatic',
    '剧情': 'dramatic',
    // 扩展情绪
    '压抑': 'tension',
    '肃杀': 'tension',
    '压迫': 'tension',
    '悬念': 'suspense',
    '温馨': 'romantic',
    '甜蜜': 'romantic',
    '暴怒': 'angry',
    '绝望': 'sad',
    '决绝': 'tension',
    '惊恐': 'fear',
    '凶狠': 'angry',
    '诡异': 'mysterious',
    '凄凉': 'melancholy',
    '爆炸': 'shock',
    '燃': 'intense',
    '燃爆': 'intense',
  };
  
  return mapping[lowerMood] || mapping[mood] || 'calm';
}

/**
 * 解析场景类型
 */
function parseSceneType(sceneType?: string): SceneType {
  if (!sceneType) return 'indoor';
  
  const lowerType = sceneType.toLowerCase();
  const mapping: Record<string, SceneType> = {
    '室内': 'indoor',
    '室外': 'outdoor',
    '动作': 'action',
    '对话': 'dialogue',
    '情感': 'emotional',
    '揭示': 'reveal',
    '追逐': 'chase',
    '对峙': 'confrontation',
    '内省': 'introspective',
    '转场': 'transition',
    'indoor': 'indoor',
    'outdoor': 'outdoor',
    'action': 'action',
    'dialogue': 'dialogue',
    'emotional': 'emotional',
    'reveal': 'reveal',
    'chase': 'chase',
    'confrontation': 'confrontation',
    'introspective': 'introspective',
    'transition': 'transition',
  };
  
  return mapping[lowerType] || mapping[sceneType] || 'indoor';
}

/**
 * 生成兜底提示词
 */
function generateFallbackPrompt(shotType?: string, mood?: string, customDescription?: string): string {
  const parts: string[] = ['电影级运镜'];
  
  if (shotType) {
    parts.push(`${shotType}构图`);
  }
  
  if (mood) {
    parts.push(`${mood}氛围`);
  }
  
  if (customDescription) {
    parts.push(customDescription);
  }
  
  parts.push('专业摄影质感');
  
  return parts.join('，');
}

/**
 * 从文本中提取镜头类型
 */
function extractShotTypeFromText(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  const shotKeywords: Record<string, string[]> = {
    '大特写': ['大特写', '特大大', '超大特写', 'extreme close up'],
    '特写': ['特写', '近景特写', '面部特写', '眼神特写', 'close up'],
    '中近景': ['中近景', '半身', 'medium close up'],
    '中景': ['中景', '腰部以上', 'medium shot'],
    '中远景': ['中远景', '膝上', 'medium long shot'],
    '远景': ['远景', '全身远景', 'long shot'],
    '大远景': ['大远景', '全景远景', 'extreme long shot'],
    '全景': ['全景', '全身', 'full shot'],
    '牛仔镜头': ['牛仔镜头', '膝盖以上', 'cowboy'],
  };
  
  for (const [shotType, keywords] of Object.entries(shotKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return shotType;
    }
  }
  
  return undefined;
}

/**
 * 从文本中提取情绪
 */
function extractMoodFromText(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  const moodKeywords: Record<string, string[]> = {
    '紧张': ['紧张', '压迫', '压迫感', '焦虑', '压抑', '肃杀', 'tension'],
    '悬疑': ['悬疑', '谜团', '未知', '悬念', 'suspense'],
    '浪漫': ['浪漫', '甜蜜', '温馨', '柔和', 'romantic'],
    '开心': ['开心', '快乐', '喜悦', 'happy', 'joy'],
    '悲伤': ['悲伤', '难过', '绝望', '哭泣', 'sad'],
    '愤怒': ['愤怒', '暴怒', '生气', '凶狠', 'angry'],
    '恐惧': ['恐惧', '害怕', '惊恐', '恐惧感', 'fear'],
    '惊讶': ['惊讶', '吃惊', '震惊', 'surprise'],
    '平静': ['平静', '安静', '宁静', 'calm'],
    '史诗': ['史诗', '宏大', '壮阔', '史诗级', 'epic'],
    '恐怖': ['恐怖', '惊悚', '恐怖片', 'horror'],
    '兴奋': ['兴奋', '激动', '热血', 'excitement'],
    '神秘': ['神秘', '诡异', '谜', 'mysterious'],
    '忧郁': ['忧郁', '伤感', '凄凉', 'melancholy'],
    '希望': ['希望', '向往', '憧憬', 'hopeful'],
  };
  
  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return mood;
    }
  }
  
  return undefined;
}

/**
 * 从文本中提取场景类型
 */
function extractSceneTypeFromText(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  const sceneKeywords: Record<string, string[]> = {
    '室内': ['室内', '房间', '宫殿', '寝宫', 'indoor'],
    '室外': ['室外', '户外', '街道', '城市', 'outdoor'],
    '动作': ['动作', '打斗', '战斗', 'action'],
    '对话': ['对话', '交谈', '说话', 'dialogue'],
    '情感': ['情感', '情绪', '心理', 'emotional'],
    '揭示': ['揭示', '发现', '真相', 'reveal'],
    '追逐': ['追逐', '追捕', '逃跑', 'chase'],
    '对峙': ['对峙', '对视', '对望', 'confrontation'],
    '内省': ['内省', '独白', '思考', 'introspective'],
    '转场': ['转场', '过渡', '切换', 'transition'],
  };
  
  for (const [sceneType, keywords] of Object.entries(sceneKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return sceneType;
    }
  }
  
  return undefined;
}

/**
 * 从文本中提取动作描述
 */
function extractActionFromText(text: string): string | undefined {
  const actionPatterns = [
    /走[向进到]/,
    /转身/,
    /回头/,
    /注视/,
    /凝视/,
    /望向/,
    /奔跑/,
    /追逐/,
    /打斗/,
    /挥[动手剑]/,
    /扔[出掷]/,
    /砸[向向]/,
    /哭泣/,
    /微笑/,
    /叹息/,
    /暴怒/,
    /嘶吼/,
    /摔倒/,
    /跳[跃下]/,
    /爬[行上]/,
  ];
  
  for (const pattern of actionPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return undefined;
}

/**
 * 增强现有运镜提示词
 * 如果已有运镜描述，在此基础上增强
 */
export function enhanceCameraMovementPrompt(existingPrompt: string, params: {
  shotType?: string;
  mood?: string;
  action?: string;
}): string {
  // 如果已有运镜描述且足够详细，直接返回
  if (existingPrompt && existingPrompt.length > 20) {
    // 检查是否已经包含运镜关键词
    const cameraKeywords = [
      '推镜头', '拉镜头', '摇镜头', '移动镜头', 
      '俯拍', '仰拍', '特写运镜', '镜头推进', 
      '缓慢推', '快速推', '电影级', '运镜',
      '跟踪镜头', '手持镜头', '稳定器', '希区柯克',
      '环绕', '航拍', '慢门', '延时', '荷兰角',
      '过肩', '主观视角', '上帝视角'
    ];
    const hasCameraMovement = cameraKeywords.some(keyword => existingPrompt.includes(keyword));
    
    if (hasCameraMovement && !existingPrompt.includes('固定')) {
      // 已经有运镜描述，不需要增强
      return existingPrompt;
    }
  }
  
  // 如果是"固定"运镜，生成新的
  if (existingPrompt === '固定' || existingPrompt === '固定镜头') {
    return generateCameraMovementPrompt({
      shotType: params.shotType,
      mood: params.mood,
      action: params.action,
    });
  }
  
  // 从prompt中提取信息
  const extractedShotType = params.shotType || extractShotTypeFromText(existingPrompt);
  const extractedMood = params.mood || extractMoodFromText(existingPrompt);
  const extractedAction = params.action || extractActionFromText(existingPrompt);
  const extractedSceneType = extractSceneTypeFromText(existingPrompt);
  
  // 生成新的运镜提示词
  const newCameraMovement = generateCameraMovementPrompt({
    shotType: extractedShotType,
    mood: extractedMood,
    sceneType: extractedSceneType,
    action: extractedAction,
  });
  
  // 将运镜提示词添加到原prompt前
  return `${newCameraMovement}，${existingPrompt}`;
}

/**
 * 获取运镜类型的详细描述
 */
export function getCameraMovementDescription(type: CameraMovementType): string {
  const prompt = CAMERA_MOVEMENT_PROMPTS.find(p => p.type === type);
  return prompt?.description || '专业运镜';
}

/**
 * 获取所有可用的运镜类型
 */
export function getAvailableCameraMovementTypes(): Array<{
  type: CameraMovementType;
  name: string;
  category: string;
  description: string;
}> {
  return CAMERA_MOVEMENT_PROMPTS.map(p => ({
    type: p.type,
    name: p.name,
    category: p.category,
    description: p.description,
  }));
}

/**
 * 获取指定类别的运镜类型
 */
export function getCameraMovementTypesByCategory(category: 'basic' | 'advanced' | 'combo'): Array<{
  type: CameraMovementType;
  name: string;
  description: string;
}> {
  return CAMERA_MOVEMENT_PROMPTS
    .filter(p => p.category === category)
    .map(p => ({
      type: p.type,
      name: p.name,
      description: p.description,
    }));
}

/**
 * 获取适合特定情绪的运镜类型
 */
export function getCameraMovementTypesByMood(mood: MoodType): CameraMovementType[] {
  return MOOD_CAMERA_STYLES[mood]?.preferredTypes || ['push'];
}

/**
 * 获取适合特定镜头类型的运镜类型
 */
export function getCameraMovementTypesByShot(shot: ShotType): CameraMovementType[] {
  return SHOT_TYPE_CAMERA_MOVEMENTS[shot]?.preferredTypes || ['push'];
}
