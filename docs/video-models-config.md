# 视频生成模型配置说明

## 普通用户可用模型

### 1. 扣子方案

| 模型类型 | 模型名称 | 模型ID | 说明 |
|----------|----------|--------|------|
| LLM | Doubao Seed 2.0 Pro | `doubao-seed-2-0-pro-260215` | 旗舰模型，擅长复杂剧本创作 |
| 图片生成 | Doubao Seedream 5.0 Lite | `doubao-seedream-5-0-lite` | 快速高质量图片生成 |
| 视频生成 | Seedance 1.5 Pro | `doubao-seedance-1-5-pro-251215` | 专业视频生成，支持音频生成 |
| 语音合成 | 米子 | `zh_female_mizai_saturn_bigtts` | 专业视频配音 |

### 2. 智谱方案

| 模型类型 | 模型名称 | 模型ID | 说明 |
|----------|----------|--------|------|
| LLM | GLM-4.7 | `glm-4.7` | 智谱最新旗舰模型 |
| 图片生成 | Cogview-3-Flash | `cogview-3-flash` | 快速图片生成 |
| 视频生成 | CogVideoX-3 | `cogvideox-3` | 支持首尾帧控制，画面稳定度大幅提升 |
| 语音合成 | GLM-TTS | `glm-tts` | 新一代语音大模型 |

---

## 管理员专用模型 ⚠️

### 火山引擎 Seedance 2.0

| 模型类型 | 模型名称 | 模型ID | 说明 |
|----------|----------|--------|------|
| 视频生成 | Seedance 2.0 (火山引擎) | `doubao-seedance-2-0-260128` | **仅管理员可用** |

**功能特性:**
- ✅ 文本提示词生成视频
- ✅ 首帧图片参考
- ✅ 尾帧图片参考
- ✅ 视频参考
- ✅ 音频参考
- ✅ 自动音频生成
- ✅ 多种宽高比 (16:9, 9:16, 1:1, 4:3, 3:4, 21:9)
- ✅ 时长范围: 2-11 秒

**使用方式:**
- 管理员 API: `POST /api/admin/videos/generate`
- 需要管理员密钥: `x-admin-key: {ADMIN_SECRET_KEY}`

---

## 权限说明

### 普通用户
- 可以使用扣子方案和智谱方案
- 不能使用火山引擎 Seedance 2.0 模型
- 请求使用管理员专用模型会返回 403 错误

### 管理员
- 可以使用所有模型，包括火山引擎 Seedance 2.0
- 通过管理员 API 专属接口调用火山引擎模型
- 需要配置环境变量:
  - `VOLCANO_ADMIN_API_KEY`
  - `ADMIN_SECRET_KEY`

---

## API 限制

### 普通用户 API
```
POST /api/videos/generate
```
- 自动根据用户方案选择模型
- 不能指定 `doubao-seedance-2-0-260128` 模型
- 返回 403: "该模型仅管理员可用"

### 管理员 API
```
POST /api/admin/videos/generate
GET /api/admin/videos/generate?taskId=xxx
```
- 专门用于火山引擎模型
- 需要管理员密钥验证
- 支持更多高级功能（视频参考、音频参考等）

---

## 环境变量配置

```bash
# 火山引擎管理员配置
VOLCANO_ADMIN_API_KEY=9cbc62aa-4038-4067-aba2-54074e59e445
ADMIN_SECRET_KEY=your-admin-secret-key

# 可选：管理员用户ID列表（逗号分隔）
ADMIN_USER_IDS=admin-user-1,admin-user-2
```

---

## 注意事项

1. **模型隔离**: 普通用户的方案（扣子、智谱）中不包含管理员专用模型
2. **权限验证**: 视频生成 API 会自动验证用户权限
3. **API 专用**: 管理员模型只能通过管理员 API 调用
4. **成本控制**: 火山引擎 API 产生额外费用，请谨慎使用
