# AGENTS.md

## 项目概览
AI 短剧生成器 —— 基于 Next.js 16 (App Router) 的 AI 短剧创作平台，支持剧本、分镜、人物立绘、场景图、配音与视频的一站式生成。

- **框架**: Next.js 16 + React 19 + TypeScript 5
- **样式**: Tailwind CSS 4 + shadcn/ui (Radix UI)
- **数据库**: Supabase (PostgreSQL)
- **AI 能力**: coze-coding-dev-sdk（LLM / 图像 / 视频 / 音频）
- **存储**: S3 兼容对象存储

## 目录结构
```
src/
├── app/                    # 页面与 API 路由
│   ├── page.tsx            # 首页
│   ├── drama/              # 剧集创作（核心，页面较大）
│   ├── images/ videos/ audio/   # 素材库
│   ├── admin/ settings/ profile/
│   └── api/                # Route Handlers
├── components/
│   ├── ui/                 # shadcn/ui 组件
│   ├── layout/             # 布局组件
│   ├── fonts.tsx           # 非阻塞字体加载
│   └── seo/                # 结构化数据
└── lib/                    # 工具库（含 video-prompt-enhancer）
```

## 构建与运行
- 开发: `pnpm run dev`（HMR，端口读 `DEPLOY_RUN_PORT`）
- 构建: `pnpm run build`
- 启动: `pnpm run start`
- 端口一律从环境变量 `DEPLOY_RUN_PORT` 读取，禁止硬编码。

## 检查命令
- 类型检查: `pnpm ts-check`
- Lint: `pnpm lint --quiet`
- 交付前使用 test_run 同时跑静态检查与接口冒烟测试。

## 关键约定
- 包管理器仅用 pnpm。
- 所有数据按 `user_id` 严格隔离；未登录访问数据 API 返回 401，页面不展示任何用户数据。
- 颜色/圆角使用主题语义变量（bg-card、rounded-lg 等），禁止硬编码 hex 或 Tailwind 原生色盘。
- 涉及 LLM 的功能默认走 SSE 流式输出。
- 图片标签使用 `loading="lazy" decoding="async"`；视频 `preload="metadata"`。
- 错误边界：app/error.tsx、global-error.tsx、not-found.tsx 已配置。

## 数据表
- image_materials / video_materials / audio_materials：素材（均含 user_id）
- drama_series / drama_episodes：剧集与分镜
- videos / video_collections：视频与合集
- card_keys：用户卡密
