'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Target,
  Sparkles,
  Shield,
  Globe,
  Mail,
  Award,
  Clock,
  Zap,
  Heart,
  Rocket,
  Layers,
  Lightbulb,
  Brain,
  Palette,
  Settings,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Video,
  Music,
  Image as ImageIcon,
} from 'lucide-react';
import { siteConfig, contactInfo } from '@/lib/site-config';

const stats = [
  { icon: Users, label: '活跃用户', value: '10,000+' },
  { icon: Sparkles, label: '生成短剧', value: '50,000+' },
  { icon: Clock, label: '节省时间', value: '90%' },
  { icon: Award, label: '用户满意度', value: '4.9/5' },
];

const features = [
  {
    icon: Brain,
    title: 'AI 智能创作',
    desc: '基于先进大语言模型，一键生成剧本、分镜、人物立绘、场景图、配音与视频',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: Palette,
    title: '全流程可视化',
    desc: '从创意到成片，所见即所得的编辑器，实时预览每个环节的生成效果',
    gradient: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: Zap,
    title: '极速生成',
    desc: '并行化 AI 生成管线，分钟级产出完整短剧，支持批量生成与后台任务',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Layers,
    title: '多模态融合',
    desc: '文本、图像、视频、音频四大模态无缝衔接，打造沉浸式短剧体验',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Settings,
    title: '高度可定制',
    desc: '支持自定义提示词、模型参数、风格预设，满足专业创作者个性化需求',
    gradient: 'from-sky-500 to-blue-500',
  },
  {
    icon: Shield,
    title: '数据安全隔离',
    desc: '用户级数据隔离，支持私有部署，企业级权限管理与审计日志',
    gradient: 'from-rose-500 to-red-500',
  },
];

const team = [
  { name: '张伟', role: '创始人 & CEO', bio: '前字节跳动 AI Lab 技术专家，10+ 年 AI 产品经验', gradient: 'from-violet-500 to-purple-500' },
  { name: '李娜', role: '联合创始人 & CTO', bio: '清华计算机博士，曾主导多个千万级用户 AI 产品落地', gradient: 'from-fuchsia-500 to-pink-500' },
  { name: '王强', role: 'AI 算法总监', bio: '发表多篇顶会论文，擅长多模态生成与大模型微调', gradient: 'from-sky-500 to-blue-500' },
  { name: '陈静', role: '产品总监', bio: '资深短视频产品专家，深耕内容创作工具 8 年', gradient: 'from-emerald-500 to-teal-500' },
];

const values = [
  { icon: Lightbulb, title: '创新驱动', desc: '持续探索 AI 创作边界，让技术服务于创意', gradient: 'from-amber-500 to-orange-500' },
  { icon: Heart, title: '用户至上', desc: '每个功能都源于真实创作者的痛点与需求', gradient: 'from-rose-500 to-pink-500' },
  { icon: Target, title: '极致体验', desc: '追求毫秒级响应，像素级还原，零学习成本', gradient: 'from-violet-500 to-purple-500' },
  { icon: Globe, title: '开放共创', desc: '拥抱开源生态，与开发者共建 AI 创作未来', gradient: 'from-emerald-500 to-teal-500' },
];

const techStack = [
  {
    icon: Brain,
    title: '文本生成',
    desc: '大语言模型驱动剧本、分镜与台词创作，内置节奏锚点与一致性约束',
    gradient: 'from-violet-500 to-purple-500',
    tags: ['剧本生成', '分镜拆解', 'SSE 流式'],
  },
  {
    icon: ImageIcon,
    title: '图像生成',
    desc: '角色立绘与场景图批量产出，参考图锁定风格，跨镜头不换脸不变装',
    gradient: 'from-fuchsia-500 to-pink-500',
    tags: ['角色立绘', '场景图', '风格锁定'],
  },
  {
    icon: Video,
    title: '视频生成',
    desc: '文生/图生视频双模式，对话镜头带配音口型同步，9:16 竖屏电影质感',
    gradient: 'from-sky-500 to-blue-500',
    tags: ['图生视频', '口型同步', '智能运镜'],
  },
  {
    icon: Music,
    title: '音频合成',
    desc: '智能配音匹配音色库，情绪参数化调节，BGM 自动 ducking 混音',
    gradient: 'from-emerald-500 to-teal-500',
    tags: ['智能 TTS', '情绪配音', 'BGM 匹配'],
  },
];

const partners = [
  '扣子 Coze', 'NVIDIA Nemotron', '智谱 AI', '阿里云千问', '火山引擎',
  'MiniMax', '月之暗面', 'DeepSeek', '百度文心', '腾讯混元',
];

const contactIconMap: Record<string, typeof Mail> = { Mail, Clock, MapPin };

const milestones = [
  { year: '2024 Q1', title: '项目启动', desc: '组建核心团队，完成技术选型与架构设计' },
  { year: '2024 Q2', title: 'Alpha 版发布', desc: '基础剧本生成、分镜可视化、单模态生成上线' },
  { year: '2024 Q3', title: 'Beta 版发布', desc: '多模态融合管线、后台任务系统、团队协作功能' },
  { year: '2024 Q4', title: '正式版 1.0', desc: '企业级部署、模型市场、插件生态、开放 API' },
  { year: '2025 Q1', title: '全球化扩展', desc: '多语言支持、海外节点部署、合规认证体系' },
  { year: '2025 Q3', title: '插件生态开放', desc: '插件 SDK 与 Webhook 上线，第三方能力即插即用' },
  { year: '2026 Q1', title: 'AI 创作顾问上线', desc: '对话式专业顾问，覆盖选题、节奏、合规全流程建议' },
  { year: '2026 Q3', title: '多模型市场', desc: '十余家模型供应商接入，按场景自由切换与组合' },
];

const footerCols = [
  {
    title: '产品',
    links: [
      { label: '剧集创作', href: '/drama' },
      { label: '分镜设计', href: '/storyboard' },
      { label: '素材库', href: '/images' },
      { label: 'AI 顾问', href: '/ai-advisor' },
      { label: '模型设置', href: '/settings' },
    ],
  },
  {
    title: '资源',
    links: [
      { label: '文档中心', href: '/docs' },
      { label: '提示词库', href: '/prompts' },
      { label: '帮助中心', href: '/help-center' },
      { label: '解决方案', href: '/solution' },
    ],
  },
  {
    title: '公司',
    links: [
      { label: '关于我们', href: '/about' },
      { label: '登录', href: '/login' },
      { label: '联系团队', href: `mailto:${siteConfig.email}` },
    ],
  },
];

function SectionHeader({ badge, title, accent, desc }: { badge: string; title: string; accent: string; desc: string }) {
  return (
    <div className="text-center mb-8">
      <Badge variant="secondary" className="mb-3">{badge}</Badge>
      <h2 className="text-2xl sm:text-3xl font-bold mb-2">
        {title}
        <span className="text-primary">{accent}</span>
      </h2>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}

export default function AboutPage() {
  const scrollToTeam = () => {
    document.getElementById('team')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MainLayout>
      <div className="space-y-12 pb-12">
        {/* Hero - 与 solution 同款深渐变营销族 */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-600 p-8 md:p-12">
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl" />

          <div className="relative z-10 max-w-3xl">
            <Badge className="bg-white/20 text-white border-white/30 mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              关于我们 · 端到端 AI 短剧创作平台
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              让每个人都能成为短剧导演
            </h1>
            <p className="text-white/80 text-lg mb-6 max-w-2xl">
              从创意构思到成片输出，AI 全流程自动化赋能创作者，让专业级短剧制作像写文档一样简单。
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-white text-violet-600 hover:bg-white/90" asChild>
                <Link href="/login">
                  <Rocket className="h-5 w-5 mr-2" />
                  立即免费体验
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={scrollToTeam}
              >
                <Users className="h-5 w-5 mr-2" />
                认识核心团队
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-6">
              <span className="flex items-center gap-2 text-white/80 text-sm">
                <CheckCircle2 className="h-4 w-4" /> 无需信用卡
              </span>
              <span className="flex items-center gap-2 text-white/80 text-sm">
                <CheckCircle2 className="h-4 w-4" /> 免费额度永久有效
              </span>
              <span className="flex items-center gap-2 text-white/80 text-sm">
                <CheckCircle2 className="h-4 w-4" /> 用户级数据隔离
              </span>
            </div>
          </div>

          {/* 玻璃统计卡 */}
          <div className="relative z-10 mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm p-4 text-center"
              >
                <stat.icon className="h-5 w-5 mx-auto mb-2 text-white/80" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 核心功能 */}
        <section id="features">
          <SectionHeader badge="核心功能" title="AI 全流程赋能，" accent="零门槛创作" desc="六大核心能力，覆盖短剧制作全生命周期" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.gradient} text-white w-fit mb-4 shadow-sm`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 技术架构 */}
        <section id="tech">
          <SectionHeader badge="技术架构" title="四大模态引擎，" accent="一条创作管线" desc="文本、图像、视频、音频协同生成，DAG 调度并行提速" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {techStack.map((tech) => (
              <Card key={tech.title} className="group hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${tech.gradient} text-white w-fit mb-4 shadow-sm`}>
                    <tech.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{tech.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">{tech.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 核心团队 */}
        <section id="team">
          <SectionHeader badge="核心团队" title="汇聚" accent="顶尖 AI 与内容专家" desc="来自字节、清华、头部短视频平台的资深团队" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.map((member) => (
              <Card key={member.name} className="group text-center hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className={`mb-4 mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br ${member.gradient} text-white text-2xl font-bold flex items-center justify-center shadow-md`}>
                    {member.name.charAt(0)}
                  </div>
                  <h3 className="mb-1 text-lg font-semibold">{member.name}</h3>
                  <p className="mb-3 text-sm text-primary font-medium">{member.role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 核心价值观 */}
        <section id="values">
          <SectionHeader badge="核心价值观" title="指引我们前行的" accent="四大信条" desc="每一个决策，都以此为准则" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((value) => (
              <Card key={value.title} className="group hover:shadow-lg transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${value.gradient} text-white w-fit mb-4 shadow-sm`}>
                    <value.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{value.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 生态伙伴 */}
        <section id="partners">
          <SectionHeader badge="生态伙伴" title="携手" accent="顶尖模型与云服务商" desc="多模型市场按场景自由切换，能力互补不锁定" />
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {partners.map((partner) => (
              <div
                key={partner}
                className="px-5 py-3 rounded-xl border bg-card text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:shadow-sm transition-all"
              >
                {partner}
              </div>
            ))}
          </div>
        </section>

        {/* 发展历程 */}
        <section id="milestones">
          <SectionHeader badge="发展历程" title="从 0 到 1，" accent="持续进化" desc="每一步都走得扎实，每一个版本都超越预期" />
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-violet-500 to-fuchsia-500" />
            <div className="space-y-6">
              {milestones.map((milestone) => (
                <div key={milestone.year} className="relative pl-12">
                  <div className="absolute left-0 top-5 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 border-4 border-background z-10" />
                  <Card className="hover:border-primary/40 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-1">
                        <Badge variant="secondary" className="text-xs">{milestone.year}</Badge>
                        <h3 className="font-semibold">{milestone.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{milestone.desc}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 联系我们 */}
        <section id="contact">
          <SectionHeader badge="联系我们" title="随时欢迎" accent="交流与合作" desc="产品咨询、商务合作、私有化部署，我们都在线" />
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {contactInfo.map((item) => {
              const Icon = contactIconMap[item.icon] || Mail;
              const inner = (
                <Card className="h-full text-center hover:shadow-lg hover:border-primary/40 transition-all">
                  <CardContent className="p-6">
                    <div className="mx-auto mb-3 p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white w-fit shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">{item.label}</div>
                    <div className="font-medium text-sm break-all">{item.value}</div>
                  </CardContent>
                </Card>
              );
              return item.href ? (
                <a key={item.label} href={item.href} className="block">{inner}</a>
              ) : (
                <div key={item.label}>{inner}</div>
              );
            })}
          </div>
        </section>

        {/* CTA - 深渐变收尾 */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-600 p-8 md:p-12 text-center">
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/15 rounded-full blur-3xl" />
          <div className="relative z-10">
            <Sparkles className="mx-auto mb-4 w-10 h-10 text-white/80" />
            <h2 className="mb-3 text-2xl sm:text-3xl font-bold text-white">准备好开始您的 AI 短剧之旅了吗？</h2>
            <p className="mb-8 mx-auto max-w-2xl text-white/80">
              加入 10,000+ 创作者，用 AI 将创意变为现实。免费额度永久有效，无需信用卡。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="bg-white text-violet-600 hover:bg-white/90" asChild>
                <Link href="/login">
                  <Rocket className="h-5 w-5 mr-2" />
                  立即免费开始创作
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                <a href={`mailto:${siteConfig.email}`}>
                  <Mail className="h-5 w-5 mr-2" />
                  联系团队
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer - 仅保留真实存在的路由 */}
        <footer className="border-t border-border pt-10 pb-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary mb-3">
                <Sparkles className="w-5 h-5" />
                AI短剧生成器
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                让每个人都能成为短剧导演。AI 全流程赋能创作，从创意到成片，一站式完成。
              </p>
              <a href={`mailto:${siteConfig.email}`} className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Mail className="w-4 h-4" />
                {siteConfig.email}
              </a>
            </div>
            {footerCols.map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold mb-3">{col.title}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('mailto:') ? (
                        <a href={link.href} className="hover:text-primary transition-colors">{link.label}</a>
                      ) : (
                        <Link href={link.href} className="hover:text-primary transition-colors">{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>© 2026 AI短剧生成器. 保留所有权利。</p>
            <p className="flex items-center gap-1">
              AI 全流程赋能，从创意到成片
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </footer>
      </div>
    </MainLayout>
  );
}