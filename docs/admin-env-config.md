# 环境变量配置说明

## 管理员配置

### 必需环境变量

```bash
# 火山引擎管理员 API Key（管理员视频生成专用）
VOLCANO_ADMIN_API_KEY=9cbc62aa-4038-4067-aba2-54074e59e445

# 管理员密钥（用于 API 权限验证）
ADMIN_SECRET_KEY=your-secure-admin-secret-key-here
```

### 可选环境变量

```bash
# 管理员用户ID列表（逗号分隔，用于数据库权限检查）
ADMIN_USER_IDS=admin-user-id-1,admin-user-id-2
```

---

## 使用说明

### 1. 创建 `.env.local` 文件

在项目根目录创建 `.env.local` 文件：

```bash
# 管理员配置
VOLCANO_ADMIN_API_KEY=9cbc62aa-4038-4067-aba2-54074e59e445
ADMIN_SECRET_KEY=your-secure-admin-secret-key
```

### 2. 重启服务

```bash
# 如果服务正在运行，需要重启以加载环境变量
coze dev
```

### 3. 使用管理员 API

```bash
# 设置管理员密钥
export ADMIN_SECRET_KEY="your-secure-admin-secret-key"

# 创建视频生成任务
curl -X POST http://localhost:5000/api/admin/videos/generate \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_SECRET_KEY" \
  -d '{
    "prompt": "第一人称视角果茶宣传广告",
    "duration": 11,
    "ratio": "16:9",
    "generateAudio": true
  }'
```

---

## 安全建议

1. **不要提交到版本控制**: `.env.local` 文件包含敏感信息，已在 `.gitignore` 中
2. **使用强密码**: `ADMIN_SECRET_KEY` 应该使用随机生成的强密码
3. **定期更换**: 定期更换 API Key 和密钥以保证安全
4. **访问控制**: 只将管理员密钥分发给授权人员

---

## 生产环境配置

在生产环境中，应通过部署平台的环境变量配置功能设置这些值，而不是使用 `.env.local` 文件。

例如在 Coze 平台部署时：
1. 进入项目设置
2. 添加环境变量
3. 设置 `VOLCANO_ADMIN_API_KEY` 和 `ADMIN_SECRET_KEY`
