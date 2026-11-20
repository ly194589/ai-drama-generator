'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
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
  Mail,
  Lightbulb,
  KeyRound,
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
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
      { title: '介绍', content: 'AI 短剧生成器是一个基于 AI 的短剧创作平台，支持从剧本生成、分镜设计、人物立绘、场景生成、配音合成到视频生成的全流程自动化创作。\n\n核心特性：\n- 全流程 AI 创作：剧本 → 分镜 → 立绘 → 场景 → 配音 → 视频\n- 模型自由：自带 API Key 接入智谱、通义千问、火山引擎、MiniMax、Moonshot、DeepSeek、文心一言、腾讯混元、NVIDIA 9 家平台，另支持任意 OpenAI 兼容自定义端点\n- 不卖 token：只收网站使用费，套餐有效期内不限生成次数，模型费用走自己的 Key\n- Skill 市场：把成熟短剧流程打包成可复用 Skill，一键套用到创作\n- 开放 API：`/api/v1` 支持外部系统调用 Skill 与读取剧集\n- 可视化编辑：所见即所得的编辑器，实时预览' },
      { title: '账号与套餐', content: '### 注册与体验\n注册账号即获得 7 天体验卡，期内全流程不限次数。\n\n### 套餐\n| 套餐 | 价格 | 有效期 |\n|------|------|--------|\n| 7 天体验卡 | 免费 | 7 天 |\n| 月卡 | ¥19.9 | 30 天 |\n| 季卡 | ¥39.9 | 90 天 |\n| 年卡 | ¥109 | 365 天 |\n| 终身卡 | ¥298 | 长期有效 |\n\n套餐只收网站使用费，有效期内不限生成次数；模型费用由你自己的 API Key 直接结算给厂商。年卡与终身卡额外解锁 Pro Skill 与开放 API。' },
      { title: '5 分钟上手', content: '### 完整流程\n1. **新建项目**：点击"开始创作" → "新建剧集"\n2. **输入创意**：描述核心故事（如："穿越回古代的程序员用代码思维破解宫廷阴谋"）\n3. **AI 生成**：点击"生成剧本"，1-2 分钟获得完整大纲\n4. **微调剧本**：编辑器中调整情节、角色、台词\n5. **生成分镜**：一键生成分镜脚本\n6. **角色立绘**：为主要角色生成三视图\n7. **场景生成**：为每个分镜生成场景图\n8. **配音合成**：选择音色，批量生成配音\n9. **视频生成**：选择模型，生成并合成成片\n10. **导出分享**：下载或一键发布' },
      { title: '模型接入（自带 Key）', content: '### 支持的平台\n智谱、通义千问、火山引擎（豆包）、MiniMax、Moonshot（Kimi）、DeepSeek、文心一言、腾讯混元、NVIDIA，以及任意 OpenAI 兼容的自定义端点。\n\n### 配置步骤\n1. 进入「设置 > 模型接入」\n2. 选择厂商，填入 API Key（自定义端点还需填写 Base URL）\n3. 点击「测试连接」确认可用\n4. 保存后，剧本 / 图片 / 视频 / 配音会按所选厂商与模型调用\n\n### 安全说明\nKey 在服务端加密存储，接口只回显掩码；可随时替换或删除，删除后立即失效。模型调用费用由厂商直接结算，平台不抽成。' },
      { title: '界面导览', content: '### 布局结构\n- 左侧：全局导航（创作 / Skill 市场 / 素材库 / 设置）\n- 中部：工作区（剧本 / 分镜 / 素材 / 预览）\n\n### 常用入口\n| 功能 | 路径 |\n|------|------|\n| 剧本生成 | 剧本创作 > 新建剧本 |\n| 分镜设计 | 剧本创作 > 分镜 |\n| Skill 市场 | 侧边栏 > Skill 市场 |\n| 素材库 | 图片 / 视频 / 音频管理 |\n| 模型接入 | 设置 > 模型接入 |\n| 开放 API | 文档站 > API 参考 |' },
    ],
  },
  {
    id: 'core-concepts',
    title: '核心概念',
    icon: BookOpen,
    description: '理解剧集、分镜、立绘、场景等核心概念',
    items: [
      { title: '剧集管理', content: '### 功能\n- 创建：标题、题材、风格、图片风格、集数、核心冲突\n- 编辑：剧本、分镜、角色、场景统一管理\n- 状态：草稿 → 编剧中 → 分镜中 → 已完成\n\n### 导出\n剧本与分镜支持复制，或导出为文本 / Markdown 使用。' },
      { title: '分镜设计', content: '### 分镜结构\n- 镜头序号、场景描述、镜头类型（全景/中景/特写/极特写）\n- 运镜方式（固定/推拉/摇移/跟随/升降/旋转）\n- 时长、台词/旁白、音效提示、AI 提示词\n\n### 批量操作\n- 一键 AI 生成全剧分镜\n- 批量修改镜头类型/运镜\n- 导出分镜表（Excel/PDF）' },
      { title: '人物立绘', content: '### 风格\n- 真人风：写实摄影质感，适合都市 / 言情题材\n- 漫画风：二次元线条与色彩，适合漫改 / 奇幻题材\n\n### 一致性\n- 角色档案记录外貌、服装与标志性特征\n- 立绘与分镜复用同一套角色描述，减少换脸\n- 支持单角色重新生成，不影响其他角色' },
      { title: '场景生成', content: '### 场景类型\n- 室内：客厅/卧室/办公室/宫殿/实验室等\n- 室外：街道/公园/森林/沙漠/太空/古城等\n- 特殊：梦境/记忆/虚拟/抽象概念可视化\n\n### 生成参数\n- 时段：白天/黄昏/夜晚/凌晨\n- 天气：晴/雨/雪/雾/阴天\n- 光影：自然光/影棚光/体积光/赛博光效\n- 构图：黄金分割/对称/对角线/框架式\n\n### 批量生成\n按分镜批量生成，自动匹配环境要素。' },
      { title: '配音与音色', content: '### 音色库\n- 按性别 / 年龄 / 气质分类：少女 / 御姐 / 青年 / 磁性男 / 童声\n- 智能匹配：`/api/audio/smart-tts` 按角色档案自动选择\n\n### 一致性规则\n- 每角色固定音色 ID，全剧不变\n- 语速 1.1 倍，情绪按剧本标签\n- 响度：人声 -16 LUFS，BGM -24 LUFS' },
      { title: '视频合成', content: '### 生成模式\n- 文生视频：场景 / 空镜\n- 图生视频：以角色立绘或场景图作首帧，保持画面一致\n\n### 说明\n- 生成时长与分辨率由所选模型能力决定\n- 平台内置模型按代运行服务计费；使用自带 Key 时由厂商直接结算\n- 成片可在「视频管理」中预览、下载或再次合成' },
    ],
  },
  {
    id: 'api-reference',
    title: 'API 参考',
    icon: Code,
    description: '开放 API 鉴权、端点、示例与错误码',
    items: [
      {
        title: '认证与 API Key',
        content:
          '### 鉴权方式\n所有 `/api/v1` 接口使用 API Key 鉴权，Key 与账号绑定，数据严格按账号隔离。\n\n```http\nAuthorization: Bearer sk_live_xxxxxxxx\n```\n\n### 获取 API Key\n1. 登录后进入「文档中心 > API 参考」\n2. 在下方「我的 API Key」中点击「创建 Key」\n3. 立即复制保存，明文只显示一次\n\n### 安全建议\n- Key 只放在服务端环境变量中，不要提交到仓库或写进前端代码\n- 泄露后立即在文档中心吊销\n- 不同业务线使用不同 Key，便于追踪与单独吊销',
      },
      {
        title: 'Skill API',
        content:
          '### 获取 Skill 列表\n`GET /api/v1/skills`\n\n返回 id、名称、分类、参数定义、`licensed`（是否已授权）与 `requiresLicense`，不返回 Prompt 正文。\n\n### 领取授权（必须先做）\n```http\nPOST /api/v1/skills/{id}/license\nAuthorization: Bearer sk_live_xxx\n```\n\n幂等接口，重复调用返回同一授权编号。Pro Skill 需要年卡 / 终身卡，否则返回 `403 PLAN_REQUIRED`。\n\n### 渲染 Skill\n```http\nPOST /api/v1/skills/{id}/render\nAuthorization: Bearer sk_live_xxx\nContent-Type: application/json\n\n{\n  "params": { "hero": "集团总裁", "conflict": "一纸契约婚姻" }\n}\n```\n\n响应包含 `prompt`（完整提示词）、`storyboardRules`（分镜规则）与 `series`（可直接写入新建剧本的字段）。未领取授权时返回 `403 LICENSE_REQUIRED`。\n\n### 可用 Skill\n| ID | 名称 | 权限 |\n|----|------|------|\n| `ba-zong-tian-chong-30` | 霸总甜宠 · 30集闭环 | 免费 |\n| `shuang-ju-hook` | 爽剧开场 · 7秒钩子 | 免费 |\n| `chong-sheng-fu-chou-60` | 重生复仇 · 60集长线 | Pro |\n| `xuan-yi-fan-zhuan` | 悬疑强反转 | Pro |\n| `chu-hai-ben-di-hua` | 出海短剧本地化 | Pro |\n| `ren-wu-xiao-zhuan` | 爆款人物小传 | Pro |',
      },
      {
        title: '账号与用量 API',
        content:
          '### 账号信息\n`GET /api/v1/me`\n\n返回当前套餐、Skill 授权数量、Key 掩码与剩余限流额度。\n\n### 按模型用量\n`GET /api/v1/usage`\n\n返回每个模型的调用次数与最近使用时间，仅用于统计，不参与计费。',
      },
      {
        title: '剧集 API',
        content:
          '### 获取剧集列表\n```http\nGET /api/v1/dramas?limit=20&offset=0&status=writing\nAuthorization: Bearer sk_live_xxx\n```\n\n只返回当前账号的剧集。`limit` 最大 50，`status` 可选：`draft` / `outlining` / `writing` / `completed`。',
      },
      {
        title: '调用示例',
        content:
          '### cURL\n```bash\ncurl -X POST https://aiduanju.coze.site/api/v1/skills/shuang-ju-hook/render \\\n  -H "Authorization: Bearer $DRAMA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"params":{"hero":"被辞退的项目经理","counter":"收购方代表"}}\'\n```\n\n### JavaScript\n```js\nconst res = await fetch(\'https://aiduanju.coze.site/api/v1/skills/shuang-ju-hook/render\', {\n  method: \'POST\',\n  headers: {\n    Authorization: `Bearer ${process.env.DRAMA_API_KEY}`,\n    \'Content-Type\': \'application/json\',\n  },\n  body: JSON.stringify({ params: { hero: \'被辞退的项目经理\' } }),\n});\n\nconst { data } = await res.json();\nconsole.log(data.prompt);\n```',
      },
      {
        title: '错误码与限流',
        content:
          '### 错误码\n统一响应体：`{ "error": { "code": "...", "message": "..." } }`\n\n| 状态码 | code | 说明 |\n|--------|------|------|\n| 401 | `MISSING_API_KEY` | 未携带 Authorization 头 |\n| 401 | `INVALID_API_KEY` | Key 无效或已吊销 |\n| 403 | `LICENSE_REQUIRED` | 未领取该 Skill 授权 |\n| 403 | `PLAN_REQUIRED` | Pro Skill 需要年卡 / 终身卡 |\n| 404 | `SKILL_NOT_FOUND` | Skill id 不存在 |\n| 429 | `RATE_LIMITED` | 超出限流，按 Retry-After 重试 |\n| 500 | `INTERNAL_ERROR` | 服务端异常 |\n| 502 | `UPSTREAM_ERROR` | 上游数据读取失败 |\n\n### 限流\n- 每个 API Key 60 次/分钟（令牌桶，平滑补充）\n- 超限返回 `429`，响应头含 `Retry-After`（秒）\n- 达到 429 时应指数退避重试，不要立即重发\n\n### 跨域（CORS）\n`/api/v1` 已允许任意来源的浏览器请求（不使用 Cookie，鉴权只靠 Bearer），并已处理 `OPTIONS` 预检。生产环境仍建议由服务端调用，避免 Key 暴露在前端。',
      },
    ],
  },
  {
    id: 'integration',
    title: '集成与接入',
    icon: Layers,
    description: '开放 API 集成、模型平台与支持渠道',
    items: [
      { title: '集成准备', content: '### 三步接入\n1. 在「我的 API Key」创建一把 Key（明文只显示一次）\n2. 用 `GET /api/v1/me` 确认 Key 有效并查看当前套餐\n3. 按业务调用 `/api/v1/skills`、`/api/v1/skills/{id}/license`、`/api/v1/skills/{id}/render`\n\n### 建议\n- 每个业务线单独一把 Key，便于统计与单独吊销\n- Key 只放服务端环境变量，不要写进前端代码\n- 年卡 / 终身卡才能调用 Pro Skill 与开放 API' },
      { title: '支持的模型平台', content: '### 可在「设置 > 模型接入」中配置\n| 平台 | 覆盖能力 |\n|------|----------|\n| 智谱 AI | 文本 / 图像 / 视频 |\n| 通义千问 | 文本 / 视觉 / 图像 |\n| 火山引擎（豆包） | 文本 / 图像 / 视频 |\n| MiniMax | 文本 / 语音 |\n| Moonshot（Kimi） | 文本 |\n| DeepSeek | 文本 |\n| 文心一言 | 文本 |\n| 腾讯混元 | 文本 |\n| NVIDIA | 文本 |\n| 自定义 | 任意 OpenAI 兼容端点 |\n\n每个厂商独立保存 Key 与 Base URL，互不影响；未配置的厂商自动回退到平台内置模型。' },
      { title: '反馈与支持', content: '### 遇到问题\n- 先查「帮助中心」的常见问题\n- 接口问题请附上请求时间、端点与返回的 `code`，便于定位\n- 套餐与发票问题在「个人中心 > 订阅管理」处理\n\n### 联系渠道\n- 邮箱：contact@aidrama.com\n- 服务时间：7x24 小时\n- 企业采购与定制：邮件说明需求与规模' },
      { title: '外部接入场景', content: '### 可以把平台当作能力层\n- 自有系统调用 `/api/v1/skills/{id}/render` 拿 Prompt 与分镜规则，接入自己的内容流水线\n- 用 `/api/v1/dramas` 拉取账号下的剧集与状态，做数据看板\n- 用 `/api/v1/usage` 监控各模型调用量，评估成本结构\n\n### 模型接入方式\n| 方式 | 说明 |\n|------|------|\n| 自带 Key（BYOK） | 在「设置 > 模型接入」填写厂商 Key，套餐内不限次数，模型费直付厂商 |\n| 平台内置模型 | 无需配置，由平台代运行，按代运行服务单独计费 |\n\n### 接入建议\n1. 先用免费 Skill 跑通链路，再按业务需要开通 Pro Skill\n2. Key 只放服务端，按环境区分（测试 / 生产各一把）\n3. 对 429 做指数退避，对 401 做告警而不是重试' },
    ],
  },
  {
    id: 'deployment',
    title: '服务与支持',
    icon: Zap,
    description: '服务状态、问题排查与数据说明',
    items: [
      { title: '服务状态', content: '### 健康检查\n`GET /api/health` 返回服务状态，可用于外部监控。\n\n### 状态说明\n接口不可用时会返回统一错误体，包含 `code` 与 `message`；持续异常请通过下方渠道反馈。' },
      { title: '常见问题排查', content: '### 接口返回\n| 现象 | 可能原因 | 处理方式 |\n|------|----------|----------|\n| 401 未登录 | 会话过期 | 重新登录 |\n| 401 INVALID_API_KEY | Key 被吊销或复制错误 | 在文档中心重新创建 |\n| 403 PLAN_REQUIRED | 套餐不支持 Pro Skill | 升级年卡 / 终身卡 |\n| 429 RATE_LIMITED | 超过 60 次/分钟 | 按 Retry-After 退避 |\n| 生成失败 | 模型 Key 无效或余额不足 | 在设置中「测试连接」并检查厂商余额 |\n| 图片 / 视频打不开 | 素材仍在生成或链接过期 | 稍后重试或重新生成 |' },
      { title: '数据与隐私', content: '### 存储\n- 账号与项目数据存储在 Supabase\n- 图片 / 视频 / 音频存储在对象存储\n- 模型 API Key 加密存储，仅服务端调用\n\n### 删除\n删除剧集或素材后不可恢复；如需彻底删除账号数据，请通过支持邮箱申请。' },
      { title: '联系我们', content: '### 支持渠道\n- 邮箱：contact@aidrama.com\n- 服务时间：7x24 小时\n- 帮助中心：站内「帮助中心」页面\n\n### 反馈建议\n描述使用场景与期望效果，我们会评估是否纳入产品规划。' },
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
// API Key 管理（开放 API 凭证）
// ============================================================================
interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt?: string;
}

function ApiKeyManager() {
  const [userId, setUserId] = useState('');
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState('');
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const parsed = raw ? (JSON.parse(raw) as { id?: string }) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (parsed?.id) setUserId(parsed.id);
    } catch {
      // 本地数据损坏时按未登录处理
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/keys', { headers: { 'x-user-id': userId } });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.keys)) setKeys(data.keys as ApiKeyItem[]);
      } catch (error) {
        console.error('[文档中心] 加载 API Key 失败:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createKey = async () => {
    if (!userId) {
      toast.error('请先登录');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.key) {
        toast.error(data.error || '创建失败');
        return;
      }
      setKeys(prev => [...prev, data.key as ApiKeyItem]);
      setPlaintext((data.key as ApiKeyItem & { plaintext: string }).plaintext);
      setName('');
      toast.success(
        typeof data.notice === 'string' ? data.notice : '已创建，请立即复制保存'
      );
    } catch (error) {
      console.error('[文档中心] 创建 API Key 失败:', error);
      toast.error('创建失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) {
        toast.error('吊销失败');
        return;
      }
      setKeys(prev => prev.filter(item => item.id !== id));
      toast.success('已吊销');
    } catch (error) {
      console.error('[文档中心] 吊销 API Key 失败:', error);
      toast.error('吊销失败');
    }
  };

  if (!userId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">登录后可创建和管理 API Key。</p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/login">去登录</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 pt-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          我的 API Key
        </CardTitle>
        <CardDescription>每个 Key 每分钟 60 次调用额度，吊销后立即失效。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 max-w-xs"
            placeholder="Key 名称（可选）"
            value={name}
            onChange={event => setName(event.target.value)}
          />
          <Button size="sm" onClick={createKey} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            创建 Key
          </Button>
        </div>

        {plaintext && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              明文仅显示这一次，请立即保存
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1 font-mono text-xs">
                {plaintext}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(plaintext);
                  toast.success('已复制');
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制
              </Button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有创建 Key。</p>
        ) : (
          <div className="space-y-2">
            {keys.map(key => (
              <div key={key.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5">
                <span className="font-mono text-xs text-foreground">{key.maskedKey}</span>
                <span className="text-xs text-muted-foreground">{key.name}</span>
                <span className="text-xs text-muted-foreground">
                  创建于 {key.createdAt.slice(0, 10)}
                  {key.lastUsedAt ? ` · 最近调用 ${key.lastUsedAt.slice(0, 10)}` : ' · 暂未调用'}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => revokeKey(key.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> 吊销
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
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
        <div className="workspace-hero relative overflow-hidden rounded-2xl">
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
                  AI 短剧生成器完整使用指南：快速上手、核心概念与开放 API
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

            {/* 需要帮助 */}
            <Card className="mt-4 bg-accent/50 border-accent">
              <CardHeader className="p-4 border-b border-accent/30">
                <h3 className="font-semibold text-accent-foreground text-sm">需要帮助？</h3>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex gap-3 px-4 py-3">
                  <Link href="/help-center" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <HelpCircle className="h-4 w-4 mr-2" /> 帮助中心
                    </Button>
                  </Link>
                  <a href="mailto:contact@aidrama.com" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Mail className="h-4 w-4 mr-2" /> 联系支持
                    </Button>
                  </a>
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
                  {/* 开放 API 凭证管理 */}
                  {section.id === 'api-reference' && <ApiKeyManager />}

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
