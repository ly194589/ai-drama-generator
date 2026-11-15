# 剧本生成规则文档

## 一、核心规则

### 1. 时长控制
- **总时长**：300秒不变
- **每镜最大**：10秒（硬性限制）
- **每镜最小**：5秒
- **每镜默认**：8秒

### 2. 分镜数量
- **最少分镜**：30个
- **最多分镜**：40个
- **默认分镜**：35个
- **计算公式**：分镜数 = 总时长(300秒) / 平均时长(8秒) ≈ 37个

### 3. 镜头时长规则
| 镜头类型 | 最小(秒) | 最大(秒) | 默认(秒) | 使用场景 |
|----------|----------|----------|----------|----------|
| 特写 | 5 | 8 | 6 | 表情、情绪 |
| 近景 | 6 | 10 | 8 | 对话、互动 |
| 中景 | 6 | 10 | 8 | 标准、基准 |
| 全景 | 8 | 10 | 8 | 环境、场景 |
| 快切 | 3 | 5 | 4 | 高潮、紧张 |
| 慢推 | 8 | 10 | 10 | 悬念、揭示 |

---

## 二、统一性控制（三维度）

### 1. 风格维度
确保全剧视觉风格一致，自动根据题材匹配：

| 题材 | 风格类型 | 光影 | 色调 | 运镜 |
|------|----------|------|------|------|
| 都市/现代 | urban_modern | 明亮柔和 | 暖冷、高级灰 | 稳定中景 |
| 古装/古风 | ancient_beauty | 柔和自然 | 淡雅水墨 | 缓慢意境 |
| 悬疑/推理 | suspense_dark | 低调对比 | 冷暗蓝灰 | 快切特写 |
| 甜宠/恋爱 | sweet_romance | 柔和暖光 | 暖粉色调 | 浪漫柔焦 |
| 职场/商战 | workplace_elite | 明亮办公 | 冷蓝灰白 | 稳定对称 |
| 仙侠/玄幻 | fantasy_fairy | 神秘仙气 | 梦幻紫蓝 | 飘逸大全景 |

### 2. 主体维度
确保角色在全剧中外观一致：

```typescript
interface CharacterLock {
  characterId: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  appearance: {
    hairstyle: string;      // 发型（固定）
    hairColor: string;      // 发色（固定）
    clothing: string;       // 服装（风格统一）
    accessories: string[];  // 配饰（固定）
    makeup: string;         // 妆容（固定）
  };
  personality: string[];    // 性格标签
  keyFeatures: string;      // 关键特征
  referenceImageUrl?: string; // 参考图（立绘）
}
```

### 3. 场景维度
确保场景切换合理，同一场景视觉一致：

| 场景ID | 名称 | 类型 | 描述 |
|--------|------|------|------|
| luxury_living_room | 豪宅客厅 | indoor | 欧式装修、真皮沙发 |
| ceo_office | 总裁办公室 | indoor | 落地窗、城市天际线 |
| coffee_shop | 咖啡厅 | indoor | 木质桌椅、温馨氛围 |
| bedroom | 卧室 | indoor | 温馨私密、床头灯 |
| city_street | 城市街道 | outdoor | 霓虹灯光、繁华都市 |

---

## 三、节奏分配

### 1. 六阶段节奏表

| 阶段 | 比例 | 时长 | 分镜数 | 镜头类型 | 内容要求 |
|------|------|------|--------|----------|----------|
| 钩子 | 8% | 24秒 | 3个 | 特写/快切 | 快速抓住观众 |
| 冲突 | 17% | 51秒 | 5个 | 中景/近景 | 引入矛盾 |
| 升温 | 25% | 75秒 | 8个 | 中景/近景 | 矛盾升级，对话为主 |
| 高潮 | 25% | 75秒 | 8个 | 快切/特写 | 冲突爆发 |
| 反转 | 15% | 45秒 | 4个 | 特写/慢推 | 意外转折 |
| 收尾 | 10% | 30秒 | 4个 | 中景/慢推 | 悬念结尾 |

### 2. 紧张度曲线
```
10 |                    ●●●
 9 | ●                        ●
 8 |                              ●
 7 |       ●●●●●●
 6 |    ●●
   | ──────────────────────────────
     钩子 冲突 升温 高潮 反转 收尾
```

---

## 四、技术手段

### 1. 关键帧引导
为重要镜头生成关键帧参考：

```typescript
interface KeyframeGuide {
  keyframeId: string;
  sceneId: string;
  shotSequence: number;
  type: 'scene_opening' | 'scene_closing' | 'emotion_peak' | 'action_key' | 'transition';
  prompt: string;
  referenceImageUrl?: string;
  importance: 'critical' | 'high' | 'normal';
}
```

**关键帧规则**：
- 每个场景首次出现必须是关键帧
- 情绪高峰镜头标记为关键帧
- 关键帧提示词需要更详细的视觉描述

### 2. 参考图锁定
- 角色立绘：锁定角色外观特征
- 场景参考：锁定场景视觉风格
- 通过 `referenceImageUrl` 字段传递

### 3. 提示词工程
统一提示词结构：

```
[风格层] + [镜头类型] + [场景层] + [角色层] + [情绪层] + [动作层] + [对话层]
```

示例：
```
都市现代风格，明亮柔和的城市光线，暖色调偏冷，高级灰色调，
中景，高层办公室，落地窗俯瞰城市，明亮办公光线，城市天际线，
李墨轩，霸道总裁气质，深蓝色西装，
愤怒的表情，猛地拍桌站起，
说道："你竟敢背叛我！"
```

---

## 五、对话规则

### 1. 精简原则
- 每句对话不超过15字
- 口语化，符合角色性格
- 重要对话放前面，后面加快节奏

### 2. 语速要求
- 角色说话要快一点，不要拖沓
- 高潮阶段对话更短更快
- 配合快切镜头使用

### 3. 对话格式
```json
{
  "speaker": "角色名",
  "content": "对话内容（≤15字）",
  "emotion": "情绪标签"
}
```

---

## 六、输出格式

### 完整剧本结构
```json
{
  "title": "剧名",
  "summary": "4-6字总结",
  "hook": "开场钩子描述",
  "cliffhanger": "结尾悬念",
  
  "unity": {
    "style": { /* 视觉风格 */ },
    "characterLocks": [ /* 角色锁定列表 */ ],
    "sceneDefinitions": [ /* 场景定义列表 */ ],
    "mainScenes": ["scene_001", "scene_002"],
    "styleTags": ["风格标签"]
  },
  
  "storyboards": [
    {
      "id": "sb-1",
      "sequence": 1,
      "name": "都市短剧第1镜",
      "duration": 8,
      "shotType": "特写",
      "stage": "钩子",
      "sceneId": "scene_001",
      "scene": { /* 场景详情 */ },
      "characterIds": ["char_李墨轩"],
      "characters": [ /* 角色详情 */ ],
      "action": "动作描述",
      "dialogue": { "speaker": "李墨轩", "content": "对话", "emotion": "愤怒" },
      "emotion": "愤怒",
      "tension": 9,
      "videoPrompt": "完整提示词",
      "isKeyframe": true
    }
  ],
  
  "keyframes": [ /* 关键帧列表 */ ],
  
  "totalDuration": 300,
  "storyboardCount": 35,
  
  "llmModel": "doubao-seed-2-0-pro-260215",
  "llmProvider": "coze"
}
```

---

## 七、API使用

### 扣子方案
```
POST /api/generate-script
Content-Type: application/json

{
  "genre": "都市",
  "conflict": "霸道总裁发现秘书是商业间谍",
  "characters": [
    {
      "name": "李墨轩",
      "gender": "male",
      "age": 32,
      "clothing": "深蓝色西装",
      "temperament": "霸道"
    }
  ]
}
```

### 智谱方案
```
POST /api/zhipu/script
Content-Type: application/json

{
  "genre": "都市",
  "conflict": "霸道总裁发现秘书是商业间谍",
  "characters": [...],
  "solution": "zhipu",
  "model": "glm-4-plus"
}
```

---

## 八、预设模板

### 题材 → 风格映射
| 题材关键词 | 风格ID |
|------------|--------|
| 都市、现代 | urban_modern |
| 古装、古风 | ancient_beauty |
| 悬疑、推理 | suspense_dark |
| 甜宠、恋爱、言情 | sweet_romance |
| 职场、商战 | workplace_elite |
| 仙侠、玄幻 | fantasy_fairy |

### 题材 → 场景映射
| 题材 | 默认场景 |
|------|----------|
| 都市 | 豪宅客厅、总裁办公室、咖啡厅、城市街道 |
| 古装 | 古代宫殿、古代花园、古代闺房 |
| 悬疑 | 总裁办公室、豪宅客厅、城市街道、暗室 |
| 甜宠 | 咖啡厅、卧室、豪宅客厅 |
| 职场 | 总裁办公室、会议室、咖啡厅 |

---

## 九、最佳实践

### 1. 保持统一性
- 使用预设风格而非自定义
- 角色外观在剧本开始时定义好
- 场景数量控制在3-5个

### 2. 控制节奏
- 高潮阶段使用快切（3-5秒）
- 情感对话使用中景（8秒）
- 悬念揭示使用慢推（10秒）

### 3. 对话精简
- 每句不超过15字
- 高潮阶段更短（5-10字）
- 配合镜头节奏

### 4. 关键帧使用
- 场景首次出现必标记
- 情绪高峰必标记
- 为关键帧准备参考图
