# TTS 配音方案对比与应用指南

## 一、扣子 TTS vs 智谱 GLM-TTS 对比

### 扣子 TTS

**技术特点：**
- 传统语音合成框架
- 基于音色库的固定配音
- 支持参数：语速、音量
- **支持SSML**：可通过SSML标签实现精细情感控制
- 多种预设音色可选

**情感表达能力：**
- ❌ 不支持上下文智能预判
- ❌ 无情感自动识别
- ⚠️ 需手动调整参数实现情感变化
- ✅ **支持SSML增强**：可通过SSML标签精确控制语速、音调、停顿、强调

**优势：**
- ✅ 音色丰富（20+预设音色）
- ✅ 稳定性高
- ✅ 无需配置API Key
- ✅ 适合标准场景
- ✅ **SSML精确控制**：可自定义情感表达细节

**适用场景：**
- 旁白解说
- 新闻播报
- 标准角色配音
- 不需要复杂情感的场景
- 需要精确控制语速、停顿的场景

---

### 扣子TTS SSML增强方案

通过SSML标签，扣子TTS可以实现更精细的情感控制：

```typescript
// SSML情感模板
const ssml = `
<speak>
  <prosody rate="fast" pitch="+10%" volume="loud">
    <emphasis level="strong">你竟然背叛我！</emphasis>
  </prosody>
</speak>
`;

// 调用TTS
const response = await client.synthesize({
  uid: 'user123',
  ssml: ssml,  // 使用SSML而非text
  speaker: 'zh_male_dayi_saturn_bigtts',
});
```

**支持的SSML标签：**

| 标签 | 说明 | 示例 |
|------|------|------|
| `<prosody>` | 控制语速、音调、音量 | `<prosody rate="fast" pitch="+5%">` |
| `<break>` | 插入停顿 | `<break time="500ms"/>` |
| `<emphasis>` | 强调 | `<emphasis level="strong">重要</emphasis>` |

**情感SSML模板：**

```typescript
// 开心
`<speak><prosody rate="fast" pitch="+5%">${text}</prosody></speak>`

// 悲伤
`<speak><prosody rate="slow" pitch="-5%" volume="soft">${text}</prosody></speak>`

// 愤怒
`<speak><prosody rate="fast" pitch="+10%" volume="x-loud"><emphasis level="strong">${text}</emphasis></prosody></speak>`

// 悬疑
`<speak><prosody rate="slow" pitch="-10%" volume="soft">${text}</prosody></speak>`
```

**智能SSML生成：**
系统会根据情感类型自动生成SSML，并根据标点符号添加智能停顿：

```typescript
// 输入
text: "你竟然背叛我！我那么信任你..."
emotion: "愤怒"

// 生成的SSML
<speak>
  <prosody rate="fast" pitch="+10%" volume="x-loud">
    <emphasis level="strong">你竟然背叛我</emphasis>
    <break time="200ms"/>
    我那么信任你
    <break time="500ms"/>
  </prosody>
</speak>
```

---

### 智谱 GLM-TTS

**技术特点：**
- 新一代智谱语音大模型
- 两阶段生成架构
- GRPO强化学习方案
- 字错误率和情感表达开源SOTA

**情感表达能力：**
- ✅ 上下文智能预判文本情绪与语调
- ✅ 显著提升语音自然度与表现力
- ✅ 合成语音具备真实情感与生命力
- ✅ 自动识别并表达情感

**优势：**
- ✅ 超情感表达能力
- ✅ 上下文智能理解
- ✅ 真实情感与生命力
- ✅ 开源SOTA表现
- ✅ 支持音色克隆（GLM-TTS-Clone）

**适用场景：**
- **角色对话配音**（强烈推荐）
- **情感丰富的剧情**
- **复杂人物性格**
- **需要真实感的短剧**

---

## 二、GLM-TTS 在视频后期配音中的应用方案

### 方案1：角色对话配音（推荐）

**场景：** 为剧集中的角色对话配音

**优势：**
- 根据对话内容自动识别情感
- 上下文智能调整语调
- 真实情感表达，增强沉浸感

**实现流程：**

```typescript
// 1. 根据用户方案选择TTS
const solution = await getUserSolution(userId);

// 2. 如果是智谱方案，使用GLM-TTS
if (solution === 'zhipu') {
  const client = await getZhipuClientAsync(userId);
  
  // GLM-TTS会自动预判情感
  const audioBuffer = await client.textToSpeech(dialogue, {
    voice: 'nova',  // 活力女声，适合角色配音
    speed: 1.1,
  });
  
  // GLM-TTS会根据文本内容自动调整情感：
  // - "你竟然背叛我！" → 愤怒语调
  // - "我...我真的好想你" → 悲伤语调
  // - "哈哈，太棒了！" → 开心语调
}
```

**效果对比：**

| 场景 | 扣子TTS | GLM-TTS |
|------|---------|---------|
| "你竟然背叛我！" | 平淡朗读 | 愤怒、颤抖语调 |
| "我...我真的好想你" | 标准配音 | 哽咽、深情语调 |
| "哈哈，太棒了！" | 普通配音 | 真实笑声、开心语调 |

---

### 方案2：旁白配音

**场景：** 为剧情旁白配音

**实现：**

```typescript
// GLM-TTS会根据旁白内容自动调整语调
const narration = "夜深了，她独自坐在窗前，思念着远方的他...";
const audioBuffer = await client.textToSpeech(narration, {
  voice: 'echo',  // 男声旁白
});
// 自动识别为悲伤氛围，语调低沉缓慢
```

---

### 方案3：角色专属音色（音色克隆）

**场景：** 为重要角色创建专属音色

**流程：**

```typescript
// 1. 上传角色语音样本（至少3秒）
const voiceSample = await uploadVoiceSample(audioFile);

// 2. 创建音色克隆
const cloneResponse = await fetch('/api/zhipu/voice-clone/create', {
  method: 'POST',
  body: JSON.stringify({
    audioData: voiceSample,
    voiceName: '霸道总裁-李墨轩',
    duration: 5,
  }),
});

const { voice } = await cloneResponse.json();

// 3. 使用克隆音色配音
const audioBuffer = await client.textToSpeechWithClone(
  dialogue,
  voice.voiceId,
  { speed: 0.9 }  // 语速稍慢，威严感
);
```

**优势：**
- ✅ 角色音色统一
- ✅ 增强品牌辨识度
- ✅ 只需3秒样本即可克隆

---

## 三、推荐配置

### 智谱方案配置（推荐用于短剧）

```typescript
// 剧集配置
const dramaConfig = {
  // 角色配音方案
  characterVoices: {
    '李墨轩': {  // 霸道总裁
      voiceId: 'cloned_voice_id_001',  // 克隆音色
      style: '低沉冷峻',
      speed: 0.9,
    },
    '林小夕': {  // 甜美女主
      voice: 'nova',  // 活力女声
      style: '温柔甜美',
      speed: 1.0,
    },
    '苏雅': {  // 心机女配
      voice: 'shimmer',  // 温柔女声
      style: '清冷傲气',
      speed: 1.1,
    },
  },
  
  // 旁白配置
  narrator: {
    voice: 'echo',  // 男声
    speed: 1.0,
  },
  
  // 使用GLM-TTS超情感表达
  useEmotionAI: true,
};
```

### 扣子方案配置（适合标准场景）

```typescript
const standardConfig = {
  characterVoices: {
    '李墨轩': {
      speaker: 'zh_male_dayi_saturn_bigtts',  // 大毅 - 视频配音
      speechRate: -10,  // 语速稍慢
    },
    '林小夕': {
      speaker: 'zh_female_mizai_saturn_bigtts',  // 米子 - 视频配音
      speechRate: 10,  // 语速稍快
    },
  },
  
  // 手动调整情感参数
  useEmotionAI: false,
};
```

---

## 四、实施建议

### 短期实施（1-2周）

1. **更新智能配音API**
   - 根据用户方案自动选择TTS
   - 智谱方案 → GLM-TTS
   - 扣子方案 → 扣子TTS

2. **更新前端配音页面**
   - 显示GLM-TTS优势说明
   - 推荐智谱方案用于短剧

3. **更新工作流**
   - 一键生成时根据方案选择TTS
   - 智谱方案自动启用超情感表达

### 中期实施（1-2月）

1. **音色克隆功能**
   - 创建音色克隆API（已完成）
   - 前端音色管理页面
   - 工作流集成音色克隆

2. **角色音色配置**
   - 数据库表已创建（character_voices）
   - 前端配置界面
   - 批量音色克隆

### 长期优化

1. **情感参数微调**
   - 根据剧集类型自动调整
   - 支持情感强度手动控制

2. **音色库建设**
   - 常见角色类型音色库
   - 用户自定义音色库

---

## 五、技术实现路径

### 步骤1：更新智能配音API

```typescript
// src/app/api/audio/smart-tts/route.ts

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'dev-user';
  const solution = await getUserSolution(userId);
  
  if (solution === 'zhipu') {
    // 使用GLM-TTS
    const client = await getZhipuClientAsync(userId);
    const audioBuffer = await client.textToSpeech(text, {
      voice: smartVoice,  // 智能匹配音色
      speed: speechRate,
    });
    
    // GLM-TTS会自动预判情感，无需手动设置
  } else {
    // 使用扣子TTS
    const client = new TTSClient(config, customHeaders);
    const response = await client.synthesize({
      text,
      speaker: smartSpeaker,
      speechRate,
      // 需要手动调整参数
    });
  }
}
```

### 步骤2：更新工作流

```typescript
// src/app/api/workflow/one-click/route.ts

// 在配音生成环节
if (solution === 'zhipu') {
  // 使用GLM-TTS生成配音
  // 自动享受超情感表达
} else {
  // 使用扣子TTS
}
```

---

## 六、总结

### 扣子TTS适用场景
- ✅ 标准旁白解说
- ✅ 新闻播报
- ✅ 不需要复杂情感的配音
- ✅ 快速上手，无需配置

### 智谱GLM-TTS适用场景（强烈推荐用于短剧）
- ✅ **角色对话配音**（核心优势）
- ✅ **情感丰富的剧情**
- ✅ **复杂人物性格**
- ✅ **需要真实感的短剧**
- ✅ **角色专属音色克隆**

### 推荐策略
- **扣子方案**：适合快速预览、标准场景
- **智谱方案**：适合正式短剧、情感表达要求高的场景
