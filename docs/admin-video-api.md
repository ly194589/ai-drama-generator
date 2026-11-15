# 管理员 Seedance 2.0 视频生成 API

## 概述

管理员专用的视频生成 API，使用火山引擎 Seedance 2.0 模型 (`doubao-seedance-2-0-260128`)。

## API 端点

- **创建任务**: `POST /api/admin/videos/generate`
- **查询状态**: `GET /api/admin/videos/generate?taskId=xxx`

## 权限要求

- 仅管理员账号（`admin`）可使用
- 需要在请求头中提供 `x-user-id: admin`

## 环境变量配置

在 `.env.local` 中配置：

```bash
# 火山引擎 API Key
VOLCANO_ADMIN_API_KEY=9cbc62aa-4038-4067-aba2-54074e59e445
```

## 创建任务 (POST)

### 请求示例

```bash
curl -X POST http://localhost:5000/api/admin/videos/generate \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "content": [
      {
        "type": "text",
        "text": "全程使用视频1的第一视角构图，全程使用音频1作为背景音乐。第一人称视角果茶宣传广告，seedance牌「苹苹安安」苹果果茶限定款；首帧为图片1，你的手摘下一颗带晨露的阿克苏红苹果，轻脆的苹果碰撞声；2-4 秒：快速切镜，你的手将苹果块投入雪克杯，加入冰块与茶底，用力摇晃，冰块碰撞声与摇晃声卡点轻快鼓点，背景音：「鲜切现摇」；4-6 秒：第一人称成品特写，分层果茶倒入透明杯，你的手轻挤奶盖在顶部铺展，在杯身贴上粉红包标，镜头拉近看奶盖与果茶的分层纹理；6-8 秒：第一人称手持举杯，你将图片2中的果茶举到镜头前（模拟递到观众面前的视角），杯身标签清晰可见，背景音「来一口鲜爽」，尾帧定格为图片2。背景声音统一为女生音色。"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic1.jpg"
        },
        "role": "reference_image"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic2.jpg"
        },
        "role": "reference_image"
      },
      {
        "type": "video_url",
        "video_url": {
          "url": "https://ark-project.tos-cn-beijing.volces.com/doc_video/r2v_tea_video1.mp4"
        },
        "role": "reference_video"
      },
      {
        "type": "audio_url",
        "audio_url": {
          "url": "https://ark-project.tos-cn-beijing.volces.com/doc_audio/r2v_tea_audio1.mp3"
        },
        "role": "reference_audio"
      }
    ],
    "generate_audio": true,
    "ratio": "16:9",
    "duration": 11,
    "watermark": false
  }'
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 否 | 模型ID，默认 `doubao-seedance-2-0-260128` |
| content | array | 是 | 内容数组，包含文本、图片、视频、音频 |
| generate_audio | boolean | 否 | 是否生成音频，默认 `true` |
| ratio | string | 否 | 宽高比，默认 `16:9` |
| duration | number | 否 | 视频时长（秒），默认 `8` |
| watermark | boolean | 否 | 是否添加水印，默认 `false` |

### content 参数说明

| type | 说明 | 必填字段 | 可选字段 |
|------|------|----------|----------|
| text | 文本描述 | text | - |
| image_url | 图片URL | image_url.url | role (reference_image) |
| video_url | 视频URL | video_url.url | role (reference_video) |
| audio_url | 音频URL | audio_url.url | role (reference_audio) |

### 响应示例

```json
{
  "success": true,
  "taskId": "task_xxx",
  "model": "doubao-seedance-2-0-260128",
  "status": "PENDING",
  "message": "任务已创建，正在处理中"
}
```

## 查询状态 (GET)

### 请求示例

```bash
curl -X GET "http://localhost:5000/api/admin/videos/generate?taskId=task_xxx" \
  -H "x-user-id: admin"
```

### 响应示例（处理中）

```json
{
  "success": true,
  "taskId": "task_xxx",
  "status": "PENDING"
}
```

### 响应示例（完成）

```json
{
  "success": true,
  "taskId": "task_xxx",
  "status": "SUCCEED",
  "result": {
    "video_url": "https://xxx.mp4",
    "cover_url": "https://xxx.jpg",
    "duration": 11
  }
}
```

## 任务状态

| 状态 | 说明 |
|------|------|
| PENDING | 任务已创建，等待处理 |
| PROCESSING | 任务处理中 |
| SUCCEED | 任务完成 |
| FAILED | 任务失败 |

## 错误处理

### 403 Forbidden

```json
{
  "error": "仅管理员可用此接口"
}
```

### 500 Internal Server Error

```json
{
  "error": "未配置火山引擎 API Key"
}
```

或

```json
{
  "error": "视频生成失败: [火山引擎错误信息]"
}
```

## 使用建议

1. **轮询查询**: 创建任务后，建议每隔 5-10 秒查询一次任务状态
2. **超时处理**: 如果任务超过 5 分钟仍未完成，建议取消或重新创建
3. **错误重试**: 如果返回错误，可以重试最多 3 次
4. **资源清理**: 视频生成完成后，及时保存到对象存储，避免火山引擎链接过期

## 前端集成示例

```typescript
// 创建视频生成任务
async function createAdminVideo(prompt: string, images: string[]) {
  const response = await fetch('/api/admin/videos/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'admin',
    },
    body: JSON.stringify({
      content: [
        { type: 'text', text: prompt },
        ...images.map(url => ({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image'
        }))
      ],
      generate_audio: true,
      ratio: '16:9',
      duration: 8,
      watermark: false,
    }),
  });

  const data = await response.json();
  return data.taskId;
}

// 轮询查询任务状态
async function pollVideoStatus(taskId: string): Promise<string> {
  const maxAttempts = 60; // 最多查询 60 次
  const interval = 5000; // 每 5 秒查询一次

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/admin/videos/generate?taskId=${taskId}`, {
      headers: { 'x-user-id': 'admin' },
    });

    const data = await response.json();

    if (data.status === 'SUCCEED') {
      return data.result.video_url;
    } else if (data.status === 'FAILED') {
      throw new Error('视频生成失败');
    }

    // 等待后继续查询
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('视频生成超时');
}
```

## 注意事项

1. **权限控制**: 此 API 仅管理员可用，前端需要验证用户权限
2. **API Key**: 确保 `VOLCANO_ADMIN_API_KEY` 已正确配置
3. **资源限制**: 火山引擎可能有并发限制，注意控制同时处理的任务数量
4. **链接有效期**: 火山引擎返回的视频链接可能有时效限制，建议及时下载或转存
5. **费用**: 视频生成会产生费用，请注意监控使用量

## 相关文档

- [火山引擎视频生成 API 文档](https://www.volcengine.com/docs/82379/1263482)
- [Seedance 2.0 模型说明](https://www.volcengine.com/docs/82379/1263482#Model)
- [火山引擎控制台](https://console.volcengine.com/ark)
