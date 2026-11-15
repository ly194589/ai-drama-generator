'use client';

import { useState, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Rocket,
  Code,
  Zap,
  Layers,
  HelpCircle,
  Copy,
  ExternalLink,
  FileText,
  Search,
  Settings as SettingsIcon,
  Star,
  Mail,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { faqData, bestPracticeCases } from '@/lib/docs-data';

// ============================================================================
// 数据：文档章节
// ============================================================================
const practiceCaseItems = bestPracticeCases.map((c) => ({
  title: c.title,
  content: `### 题材\n${c.genre} · ${c.conflict}\n\n### 关键手法\n${c.keyPoints.map((k) => `- ${k}`).join('\n')}\n\n### 数据表现\n| 指标 | 数值 |\n|------|------|\n| 总集数 | ${c.result.totalEpisodes} |\n| 集均播放 | ${c.result.averageViews} |\n| 完播率 | ${c.result.completionRate} |`,
}));

const faqItems = faqData.map((f) => ({
  title: f.question,
  content: `${f.answer}\n\n标签：${f.tags.map((t) => `\`${t}\``).join(' ')}`,
}));

const sections = [
  {
    id: 'getting-started',
    title: '快速开始',
    icon: Rocket,
    description: '从零开始，5 分钟上手 AI 短剧生成器',
    items: [
      { title: '介绍', content: 'AI 短剧生成器是一个基于 AI 的短剧创作平台，支持从剧本生成、分镜设计、人物立绘、场景生成、配音合成到视频生成的全流程自动化创作。\n\n核心特性：\n- 全流程 AI 创作：剧本 → 分镜 → 立绘 → 场景 → 配音 → 视频\n- 多模型支持：兼容 Coze、NVIDIA、智谱、千问等主流模型\n- 可视化编辑：所见即所得的编辑器，实时预览\n- 团队协作：多角色协作，版本管理与回滚' },
      { title: '安装部署', content: '### 环境要求\n- Node.js 18+\n- pnpm 8+\n- PostgreSQL 15+（或 Supabase）\n- 对象存储（S3 兼容）\n\n### 快速安装\n```bash\ngit clone https://github.com/your-org/ai-drama.git\ncd ai-drama\npnpm install\ncp .env.example .env.local\npnpm db:push\npnpm dev\n```\n\n### Docker 部署\n```bash\ndocker compose up -d\n```' },
      { title: '5 分钟上手', content: '### 完整流程\n1. **新建项目**：点击"开始创作" → "新建剧集"\n2. **输入创意**：描述核心故事（如："穿越回古代的程序员用代码思维破解宫廷阴谋"）\n3. **AI 生成**：点击"生成剧本"，1-2 分钟获得完整大纲\n4. **微调剧本**：编辑器中调整情节、角色、台词\n5. **生成分镜**：一键生成分镜脚本\n6. **角色立绘**：为主要角色生成三视图\n7. **场景生成**：为每个分镜生成场景图\n8. **配音合成**：选择音色，批量生成配音\n9. **视频生成**：选择模型，生成并合成成片\n10. **导出分享**：下载或一键发布' },
      { title: '基础配置', content: '### 环境变量\n| 变量名 | 说明 | 必填 |\n|--------|------|------|\n| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ |\n| `SUPABASE_URL` | Supabase 项目 URL | ✅ |\n| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | ✅ |\n| `OSS_ENDPOINT` | 对象存储 Endpoint | ✅ |\n| `OSS_ACCESS_KEY` | 对象存储 Access Key | ✅ |\n| `OSS_SECRET_KEY` | 对象存储 Secret Key | ✅ |\n| `OSS_BUCKET` | 存储桶名称 | ✅ |\n| `COZE_API_KEY` | Coze API Key | ✅ |\n\n### 模型配置\n在"设置 > 模型配置"中配置文本/图像/视频/音频模型参数。' },
      { title: '界面导览', content: '### 布局结构\n- 左侧：全局导航（创作 / 素材库 / 设置）\n- 顶部：项目切换与全局搜索\n- 中部：工作区（剧本 / 分镜 / 素材 / 预览）\n\n### 常用入口\n| 功能 | 路径 |\n|------|------|\n| 剧本生成 | 剧集创作 > 新建剧集 |\n| 分镜设计 | 剧集创作 > 分镜 |\n| 素材库 | 图像 / 视频 / 音频 |\n| 模型设置 | 设置 > 模型设置 |\n| AI 顾问 | 侧边栏 > AI 顾问 |' },
    ],
  },
  {
    id: 'core-concepts',
    title: '核心概念',
    icon: BookOpen,
    description: '理解剧集、分镜、立绘、场景等核心概念',
    items: [
      { title: '剧集管理', content: '### 功能\n- 创建：标题、题材、集数、风格、标签\n- 编辑：剧本、分镜、角色、场景统一管理\n- 版本控制：自动保存历史，支持回滚\n- 协作：邀请成员、分配角色（编剧/导演/审核）\n\n### 状态流转\n`草稿` → `编剧中` → `分镜中` → `生产中` → `审核中` → `已完成`\n\n### 导出格式\nJSON / PDF / Markdown / SRT' },
      { title: '分镜设计', content: '### 分镜结构\n- 镜头序号、场景描述、镜头类型（全景/中景/特写/极特写）\n- 运镜方式（固定/推拉/摇移/跟随/升降/旋转）\n- 时长、台词/旁白、音效提示、AI 提示词\n\n### 批量操作\n- 一键 AI 生成全剧分镜\n- 批量修改镜头类型/运镜\n- 导出分镜表（Excel/PDF）' },
      { title: '人物立绘', content: '### 三视图生成\n- 正面：正脸特写，用于对白场景\n- 侧面：侧脸轮廓，用于侧身镜头\n- 背面：背部造型，用于背影镜头\n\n### 参数控制\n- 风格：写实/动漫/赛博朋克/水彩/油画等\n- 分辨率：512x512 到 2048x2048\n- 一致性种子、ControlNet 姿势控制\n\n### 管理功能\n- 角色标签分类、版本历史对比、批量重新生成' },
      { title: '场景生成', content: '### 场景类型\n- 室内：客厅/卧室/办公室/宫殿/实验室等\n- 室外：街道/公园/森林/沙漠/太空/古城等\n- 特殊：梦境/记忆/虚拟/抽象概念可视化\n\n### 生成参数\n- 时段：白天/黄昏/夜晚/凌晨\n- 天气：晴/雨/雪/雾/阴天\n- 光影：自然光/影棚光/体积光/赛博光效\n- 构图：黄金分割/对称/对角线/框架式\n\n### 批量生成\n按分镜批量生成，自动匹配环境要素。' },
      { title: '配音与音色', content: '### 音色库\n- 按性别/年龄/气质分类：少女/御姐/青年/磁性男/童声\n- 智能匹配：`/api/audio/smart-tts` 按角色档案自动选择\n\n### 一致性规则\n- 每角色固定音色 ID，全剧不变\n- 语速 1.1 倍，情绪按剧本标签\n- 响度：人声 -16 LUFS，BGM -24 LUFS\n\n### 口型同步\n对话镜头必须传 `audioUrl`，使用带配音的视频生成模式。' },
      { title: '视频合成', content: '### 生成模式\n- 文生视频：场景/空镜\n- 图生视频：角色立绘作首帧，保证不换脸\n- 带配音模式：传 audioUrl 实现口型同步\n\n### 参数约束\n| 参数 | 范围 | 说明 |\n|------|------|------|\n| duration | 4-12 秒 | API 硬限制 |\n| prompt | ≤2000 字符 | 超限返回 403 |\n| 调用间隔 | ≥30 秒 | 频控保护 |\n\n### 合成\n生成后按分镜顺序自动合成，叠加字幕/BGM/转场。' },
    ],
  },
  {
    id: 'api-reference',
    title: 'API 参考',
    icon: Code,
    description: '完整的 API 接口文档与调用示例',
    items: [
      { title: '认证授权', content: '### API Key 认证\n```\nAuthorization: Bearer YOUR_API_KEY\n```\n\n### 获取 API Key\n1. 登录控制台 → 设置 → API Key\n2. 点击"生成新 Key"\n3. 复制并妥善保存（仅显示一次）\n\n### 权限范围\n| Key 类型 | 权限 |\n|----------|------|\n| 只读 | GET 所有资源 |\n| 读写 | 所有 CRUD 操作 |\n| 管理员 | 包括用户管理、计费、系统配置 |\n\n### 速率限制\n- 免费版：60 req/min\n- 专业版：300 req/min\n- 企业版：1000 req/min\n\n超限返回 `429`，响应头含 `Retry-After`。' },
      { title: '剧集 API', content: '### 创建剧集\n```http\nPOST /api/v1/dramas\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json\n\n{\n  "title": "剧集标题",\n  "genre": "悬疑",\n  "episodes": 6,\n  "style": "cinematic",\n  "tags": ["AI", "短剧"]\n}\n```\n\n### 获取列表\n`GET /api/v1/dramas?page=1&pageSize=20&status=completed`\n\n### 获取详情\n`GET /api/v1/dramas/{id}`\n\n### 更新\n`PATCH /api/v1/dramas/{id}`\n\n### 删除\n`DELETE /api/v1/dramas/{id}`' },
      { title: '生成任务 API', content: '### 创建任务\n```http\nPOST /api/v1/generation-tasks\nContent-Type: application/json\n\n{\n  "type": "script|storyboard|character|scene|audio|video",\n  "drama_id": "drama-uuid",\n  "params": {}\n}\n```\n\n### 查询状态\n`GET /api/v1/generation-tasks/{id}`\n\n响应示例：\n```json\n{\n  "id": "task-uuid",\n  "type": "video",\n  "status": "completed",\n  "progress": 100,\n  "result": {\n    "video_url": "https://oss.xxx/video.mp4",\n    "duration": 8.5\n  },\n  "created_at": "2024-01-15T10:30:00Z"\n}\n```' },
      { title: '素材 API', content: '### 图片素材\n`GET /api/v1/images?type=character|scene&page=1`\n\n### 批量生成\n```http\nPOST /api/v1/images/batch-generate\n{\n  "characters": ["char-uuid"],\n  "style": "cinematic",\n  "reference_url": "https://oss.xxx/ref.png"\n}\n```\n\n### 视频/音频\n`GET /api/v1/videos` / `GET /api/v1/audios`\n\n所有素材接口按 `user_id` 隔离，未登录返回 401。' },
      { title: '错误码', content: '### 常见错误码\n| 状态码 | 含义 | 处理 |\n|--------|------|------|\n| 401 | 未登录/Key 无效 | 检查 Authorization |\n| 403 | 频控或参数超限 | 间隔≥30s，prompt≤2000 |\n| 404 | 资源不存在 | 检查 id 与权限 |\n| 429 | 速率限制 | 按 Retry-After 重试 |\n| 500 | 服务端错误 | 查看日志并重试 |\n\n### 重试策略\n指数退避：1s → 2s → 4s，最多 3 次；幂等接口可安全重试。' },
    ],
  },
  {
    id: 'integration',
    title: '插件与集成',
    icon: Layers,
    description: '插件系统、第三方集成、贡献指南与更新日志',
    items: [
      { title: '插件系统', content: '### 插件架构\n- 基于事件总线：`onDramaCreated`、`onTaskCompleted` 等钩子\n- 沙箱隔离：WASM / Worker 运行非受信代码\n- 权限模型：声明式权限，最小权限原则\n\n### 插件开发\n```typescript\nimport { registerPlugin } from \'@ai-drama/plugin-sdk\';\n\nregisterPlugin({\n  id: \'my-plugin\',\n  name: \'我的插件\',\n  hooks: {\n    onDramaCreated: async (ctx) => {\n      console.log(\'剧集创建:\', ctx.dramaId);\n    },\n  },\n});\n```' },
      { title: '第三方集成', content: '### 已支持集成\n| 服务 | 用途 | 配置位置 |\n|------|------|----------|\n| Coze | LLM / 工作流 | 设置 > 模型配置 |\n| NVIDIA Nemotron | 文本生成 | 设置 > 模型配置 |\n| 智谱 AI | 多模态 | 设置 > 模型配置 |\n| 阿里云千问 | 文本/视觉 | 设置 > 模型配置 |\n| S3 兼容存储 | 素材存储 | 设置 > 存储配置 |' },
      { title: '贡献指南', content: '### 如何贡献\n1. Fork 本仓库\n2. 创建特性分支 (`git checkout -b feature/xxx`)\n3. 提交更改 (`git commit -m \'feat: xxx\'`)\n4. 推送分支 (`git push origin feature/xxx`)\n5. 打开 Pull Request\n\n### 开发规范\n- 代码风格：ESLint + Prettier\n- 提交信息：Conventional Commits\n- 测试：pnpm test' },
      { title: 'Webhook 通知', content: '### 事件类型\n- `drama.completed`：剧集合成完成\n- `task.failed`：生成任务失败\n- `quota.low`：额度低于 10%\n\n### 配置\n```http\nPOST /api/v1/webhooks\n{\n  "url": "https://your-server/hook",\n  "events": ["drama.completed", "task.failed"],\n  "secret": "whsec_xxx"\n}\n```\n\n### 签名校验\n请求头 `X-Signature` = HMAC-SHA256(body, secret)；失败重试 3 次（1m/5m/30m）。' },
    ],
  },
  {
    id: 'deployment',
    title: '部署运维',
    icon: Zap,
    description: 'Docker 部署、监控告警、性能优化与故障排查',
    items: [
      { title: 'Docker 部署', content: '### docker-compose.yml\n```yaml\nversion: \'3.8\'\nservices:\n  app:\n    image: ai-drama:latest\n    ports:\n      - "5000:5000"\n    environment:\n      - DATABASE_URL=postgresql://...\n      - SUPABASE_URL=...\n      - OSS_ENDPOINT=...\n    volumes:\n      - ./uploads:/app/uploads\n```' },
      { title: '监控告警', content: '### 健康检查\n`GET /api/health` 返回服务状态\n\n### 日志收集\n- 应用日志：`/app/work/logs/bypass//app.log`\n- 错误日志：`/app/work/logs/bypass//dev.log`\n- 控制台日志：`/app/work/logs/bypass//console.log`' },
      { title: '故障排查', content: '### 常见问题\n| 问题 | 原因 | 解决方案 |\n|------|------|----------|\n| 接口 500 | Supabase 嵌套查询失败 | 改为两次查询组装 |\n| 生成卡死 | 任务队列阻塞 | 检查后台任务状态 |\n| 图片不显示 | OSS 配置错误 | 检查 Endpoint 和密钥 |' },
      { title: '性能优化', content: '### 生成侧\n- 角色/场景/配音并行生成，DAG 调度\n- 无对话镜头每 4 个合并生成，减少调用\n- 预览用 480p，定稿再出 1080p\n\n### 前端侧\n- 图片 `loading="lazy" decoding="async"`\n- 视频 `preload="metadata"`\n- LLM 输出走 SSE 流式，首字延迟更低\n- 静态素材走 CDN 缓存' },
      { title: '备份与恢复', content: '### 数据备份\n- Supabase 自动备份，保留 7 天\n- 关键表每日 `pg_dump` + WAL 归档\n- 素材对象存储开启版本控制与跨区域复制\n\n### 恢复目标\n| 指标 | 目标 |\n|------|------|\n| RTO | ≤4 小时 |\n| RPO | ≤24 小时 |\n\n### 演练\n每季度做一次恢复演练，验证备份可用性。' },
    ],
  },
  {
    id: 'best-practices',
    title: '最佳实践',
    icon: Lightbulb,
    description: '爆款案例、节奏方法论与提示词工程技巧',
    items: [
      ...practiceCaseItems,
      { title: '节奏锚点方法论', content: '### 300 秒黄金节奏\n| 时间码 | 事件 | 情绪目标 |\n|--------|------|----------|\n| 0-3s | 强钩子开场 | 好奇 |\n| 30s | 第一次冲突 | 紧张 |\n| 90s | 第一次反转 | 惊喜 |\n| 150s | 情绪最高点 | 爽感 |\n| 210s | 第二次反转 | 揪心 |\n| 270-300s | 强结尾+悬念 | 期待 |\n\n### 达标指标\n- 3 秒留存 ≥65%\n- 完播率 ≥40%\n- 关注转化 ≥3%\n\n低于指标时优先重做开场钩子与打脸兑现节奏。' },
      { title: '提示词工程技巧', content: '### 四段结构\n`[风格前缀] + [场景描述] + [人物动作] + [技术参数]`\n\n### 五个技巧\n1. 量化优先：用"4500K 暖白光"代替"温暖的光"\n2. 给示例：贴一段满意成片描述作参照\n3. 分层锁定：角色卡/服装卡/光影卡分卡管理\n4. 单变量迭代：每次只改一个要素便于归因\n5. 负面约束：显式写"禁止旋转/抖动/换装"\n\n配合提示词库的锁定卡模板使用效果最佳。' },
    ],
  },
  {
    id: 'faq',
    title: '常见问题',
    icon: HelpCircle,
    description: '高频问题与标准解答',
    items: faqItems,
  },
];

const sectionItems: Record<string, { title: string; content: string }[]> = {
  'getting-started': sections.find(s => s.id === 'getting-started')?.items || [],
  'core-concepts': sections.find(s => s.id === 'core-concepts')?.items || [],
  'api-reference': sections.find(s => s.id === 'api-reference')?.items || [],
  'integration': sections.find(s => s.id === 'integration')?.items || [],
  'deployment': sections.find(s => s.id === 'deployment')?.items || [],
  'best-practices': sections.find(s => s.id === 'best-practices')?.items || [],
  'faq': sections.find(s => s.id === 'faq')?.items || [],
};

// ============================================================================
// 轻量 Markdown 渲染（语义主题变量，与其他页面卡片内容风格一致）
// ============================================================================
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={`${keyBase}-${i++}`} className="bg-muted px-1 py-0.5 rounded text-xs text-foreground">
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <strong key={`${keyBase}-${i++}`} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结尾 ```
      blocks.push(
        <pre key={key++} className="bg-muted rounded-lg p-3 text-xs overflow-x-auto text-foreground">
          <code>{buf.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // 标题
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <h4 key={key++} className="font-semibold text-foreground mt-4 mb-2 first:mt-0">
          {renderInline(heading[2], `h-${key}`)}
        </h4>
      );
      i++;
      continue;
    }

    // 表格
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key++} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {head?.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold text-foreground">{renderInline(c, `th-${key}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-t border-border">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-muted-foreground">{renderInline(c, `td-${key}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 无序列表
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 text-muted-foreground">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `ul-${key}-${ii}`)}</li>)}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 space-y-1 text-muted-foreground">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `ol-${key}-${ii}`)}</li>)}
        </ol>
      );
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 段落
    blocks.push(
      <p key={key++} className="text-muted-foreground leading-relaxed">
        {renderInline(line, `p-${key}`)}
      </p>
    );
    i++;
  }

  return <div className="space-y-3 text-sm">{blocks}</div>;
}

// ============================================================================
// 页面
// ============================================================================
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery) return sectionItems[activeSection] || [];
    return (sectionItems[activeSection] || []).filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeSection, searchQuery]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Header - 与 images/videos/audio 页面风格一致 */}
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">文档中心</h1>
                  <Badge variant="secondary" className="text-xs">v1.0</Badge>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  AI 短剧生成器完整使用指南，从安装部署到高级功能
                </p>
              </div>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文档..."
                  className="pl-9 bg-background/50 backdrop-blur-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 内容区域：左侧导航 + 右侧文档 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左侧导航 */}
          <aside className="lg:col-span-3 hidden lg:block space-y-2">
            <Card>
              <CardHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">文档导航</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      onClick={(e) => { e.preventDefault(); setActiveSection(section.id); }}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors cursor-pointer',
                        activeSection === section.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <section.icon className={cn('h-4 w-4 shrink-0', activeSection === section.id ? 'text-primary-foreground' : 'text-muted-foreground')} />
                      <div className="min-w-0">
                        <div className="font-medium">{section.title}</div>
                        <div className={cn('text-xs truncate', activeSection === section.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{section.description}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 快速链接 */}
            <Card className="mt-4">
              <CardHeader className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground text-sm">快速链接</h3>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                    <span>模型设置</span>
                  </Link>
                  <Link href="/prompts" className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>提示词库</span>
                  </Link>
                  <Link href="/help-center" className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span>帮助中心</span>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* 支持我们 */}
            <Card className="mt-4 bg-accent/50 border-accent">
              <CardHeader className="p-4 border-b border-accent/30">
                <h3 className="font-semibold text-accent-foreground text-sm">支持我们</h3>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex gap-3 px-4 py-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open('https://github.com/your-org/ai-drama', '_blank')}>
                    <Star className="h-4 w-4 mr-2" /> GitHub
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open('https://discord.gg/ai-drama', '_blank')}>
                    <Mail className="h-4 w-4 mr-2" /> Discord
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* 右侧文档内容 */}
          <div className="lg:col-span-9">
            {/* 章节 Tab - 与 videos 页面激活态风格一致 */}
            <Tabs value={activeSection} onValueChange={setActiveSection}>
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-8 h-auto bg-muted/50 p-1">
                {sections.map((section) => (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <section.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{section.title}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {sections.map((section) => (
                <TabsContent key={section.id} value={section.id} className="space-y-6">
                  {/* 搜索结果提示 */}
                  {searchQuery && (
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">搜索结果</CardTitle>
                        <CardDescription>
                          找到 <span className="font-semibold text-primary">{filteredItems.length}</span> 条匹配项
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}

                  {/* 文档项目列表 */}
                  <div className="space-y-4">
                    {filteredItems.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="p-8 text-center">
                          <HelpCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-muted-foreground text-sm">
                            {searchQuery ? '未找到相关文档' : '暂无内容'}
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      filteredItems.map((item) => (
                        <Card key={item.title} className="overflow-hidden">
                          <CardHeader className="pb-3 pt-5">
                            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {item.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <MarkdownContent content={item.content} />
                          </CardContent>
                          <div className="px-4 py-2 bg-muted/50 border-t border-border flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-primary"
                              onClick={() => {
                                navigator.clipboard.writeText(item.content);
                                toast('已复制');
                              }}
                            >
                              <Copy className="h-4 w-4 mr-1" /> 复制
                            </Button>
                            <Link
                              href={`#${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> 直达
                            </Link>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}