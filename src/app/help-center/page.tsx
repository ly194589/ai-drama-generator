'use client';

import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HelpCircle,
  Book,
  MessageCircle,
  Search,
  Play,
  FileText,
  Video,
  Image,
  Music,
  Zap,
  CheckCircle2,
  Rocket,
  Film,
  Layers,
  Volume2,
  Wallet,
  Mail,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Headphones,
  ArrowRight,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';

// FAQ数据 - 带分类图标
const faqCategories = [
  {
    category: '快速入门',
    icon: Rocket,
    color: 'from-blue-500 to-cyan-500',
    items: [
      {
        question: '如何创建我的第一个AI短剧项目？',
        answer: '1. 进入"项目管理"页面，点击"新建项目"\n2. 填写项目名称和描述\n3. 选择短剧类型和风格\n4. 进入剧本创作，输入您的故事构思\n5. AI将自动生成完整的剧本和分镜\n6. 一键生成视频素材',
        tags: ['新建项目', '入门'],
      },
      {
        question: '平台支持哪些类型的短剧？',
        answer: '目前支持多种短剧类型：\n• 都市情感剧 - 现代都市背景的爱情故事\n• 古装穿越剧 - 古代背景的穿越题材\n• 悬疑推理剧 - 充满悬念的推理故事\n• 喜剧短剧 - 轻松搞笑的剧情\n• 职场励志剧 - 职场成长和励志故事',
        tags: ['短剧类型', '题材'],
      },
      {
        question: 'AI生成的剧本质量如何？',
        answer: '我们的AI模型经过专业训练，能够生成符合短剧节奏的剧本。主要特点：\n• 符合短剧节奏，每集约1分钟\n• 包含完整的开篇钩子、剧情发展、结尾悬念\n• 角色性格鲜明，对话自然流畅\n• 支持多轮修改和优化',
        tags: ['剧本质量', 'AI'],
      },
    ],
  },
  {
    category: '视频生成',
    icon: Film,
    color: 'from-purple-500 to-pink-500',
    items: [
      {
        question: '视频生成需要多长时间？',
        answer: '单个镜头的视频生成通常需要30-60秒，具体取决于：\n• 视频时长（建议5-10秒）\n• 画面复杂度\n• 当前服务器负载\n\n为了提高效率，建议：\n• 使用批量生成功能\n• 合理设置视频时长\n• 提前准备好角色和场景素材',
        tags: ['生成时间', '效率'],
      },
      {
        question: '如何提高视频生成质量？',
        answer: '以下技巧可以提升视频质量：\n1. 详细描述场景细节和角色动作\n2. 使用高质量的角色立绘和场景图\n3. 保持提示词简洁明确（控制在2000字符内）\n4. 选择合适的视频风格（如真人风、动漫风）\n5. 利用风格参考图保持一致性',
        tags: ['视频质量', '技巧'],
      },
      {
        question: '视频生成失败怎么办？',
        answer: '常见失败原因及解决方案：\n• API频率限制 - 等待几秒后重试\n• 提示词过长 - 精简描述内容\n• 内容违规 - 修改敏感内容\n• 网络问题 - 检查网络连接后重试\n\n如果持续失败，请联系技术支持。',
        tags: ['失败', '故障排除'],
      },
    ],
  },
  {
    category: '素材管理',
    icon: Layers,
    color: 'from-orange-500 to-amber-500',
    items: [
      {
        question: '支持上传哪些格式的素材？',
        answer: '平台支持多种素材格式：\n\n图片素材：\n• JPG/JPEG - 推荐用于照片\n• PNG - 支持透明背景\n• WebP - 高压缩比格式\n\n视频素材：\n• MP4 - 推荐格式\n• WebM - 网页格式\n• MOV - Apple格式\n\n音频素材：\n• MP3 - 通用音频格式\n• WAV - 高质量音频\n• AAC - 压缩音频格式',
        tags: ['素材格式', '上传'],
      },
      {
        question: '如何管理大量素材？',
        answer: '平台提供多种素材管理功能：\n• 按项目分组管理\n• 按类型（角色/场景/道具）分类\n• 标签系统快速检索\n• 批量上传和处理\n• 素材版本管理\n• 重复素材检测',
        tags: ['素材管理', '分类'],
      },
      {
        question: '素材存储有容量限制吗？',
        answer: '素材存储在云端对象存储中，支持：\n• 单文件最大500MB\n• 总存储空间充足\n• 自动生成缩略图\n• 支持CDN加速访问\n\n建议定期清理无用素材，保持项目整洁。',
        tags: ['存储', '容量'],
      },
    ],
  },
  {
    category: '音频配音',
    icon: Volume2,
    color: 'from-green-500 to-emerald-500',
    items: [
      {
        question: '如何选择合适的配音角色？',
        answer: '平台提供智能配音匹配：\n1. 根据角色性别自动匹配声线\n2. 根据年龄选择声音成熟度\n3. 根据性格调整情感参数\n\n也可手动选择：\n• 男声/女声/童声\n• 不同情感基调\n• 语速和音调调节',
        tags: ['配音', '声线'],
      },
      {
        question: '配音生成后可以修改吗？',
        answer: '可以。配音支持以下修改：\n• 重新生成 - 选择不同的配音角色\n• 参数调整 - 修改情感、语速等\n• 局部替换 - 只重新生成部分台词\n• 时间对齐 - 调整配音与画面的同步',
        tags: ['配音修改', '后期'],
      },
    ],
  },
  {
    category: '账户与计费',
    icon: Wallet,
    color: 'from-rose-500 to-red-500',
    items: [
      {
        question: '新用户有什么福利？',
        answer: '新用户注册即可获得7天免费体验卡：\n• 7天内可生成1个剧本\n• 7天内可生成5个视频\n• 7天内可生成20张图片\n• 7天内可生成5个音乐\n\n体验卡到期后可购买月卡、季卡或年卡继续使用。',
        tags: ['体验卡', '新用户'],
      },
      {
        question: '如何订阅付费套餐？',
        answer: '订阅步骤：\n1. 登录后进入"个人中心"页面\n2. 点击"订阅管理"标签\n3. 选择适合您的套餐（月卡/季卡/年卡）\n4. 点击"立即订阅"按钮\n5. 完成支付即可\n\n支付支持微信、支付宝等多种方式。',
        tags: ['订阅', '付费'],
      },
      {
        question: '配额用完了怎么办？',
        answer: '配额用完后有以下选择：\n• 升级套餐 - 获得更多配额\n• 购买资源包 - 单独购买剧本/视频/图片包\n• 等待下个周期 - 套餐配额周期性刷新\n\n建议根据实际使用量选择合适的套餐。',
        tags: ['配额', '升级'],
      },
      {
        question: '如何查看使用量统计？',
        answer: '在首页仪表盘可以查看：\n• 今日/本周/本月生成量\n• 各类型素材统计\n• 存储空间使用情况\n• API调用次数\n\n详细数据可在"个人中心"页面查看。',
        tags: ['使用量', '统计'],
      },
      {
        question: '项目数据存储在哪里？',
        answer: '所有项目数据安全存储：\n• 数据库 - Supabase托管\n• 文件存储 - S3兼容对象存储\n• 支持数据导出和备份\n• 符合数据安全标准',
        tags: ['数据存储', '安全'],
      },
      {
        question: '可以随时取消订阅吗？',
        answer: '可以随时取消订阅：\n• 取消后当前计费周期仍可使用\n• 周期结束后不再扣费\n• 已生成的项目数据会保留\n• 可随时重新订阅恢复服务',
        tags: ['取消订阅', '退款'],
      },
    ],
  },
];

// 教程数据 - 带完成状态
const tutorials = [
  {
    id: 'quickstart',
    title: '快速入门指南',
    description: '快速了解平台核心功能，轻松上手',
    duration: '快速',
    type: 'video',
    icon: Play,
    level: '入门',
    completed: true,
  },
  {
    id: 'script-tips',
    title: '剧本创作技巧',
    description: '如何写出高质量AI剧本提示词',
    duration: '10分钟',
    type: 'article',
    icon: FileText,
    level: '进阶',
    completed: false,
  },
  {
    id: 'video-best-practices',
    title: '视频生成最佳实践',
    description: '提高视频生成质量和效率的方法',
    duration: '15分钟',
    type: 'video',
    icon: Video,
    level: '进阶',
    completed: false,
  },
  {
    id: 'asset-management',
    title: '素材管理指南',
    description: '高效管理角色、场景等素材',
    duration: '8分钟',
    type: 'article',
    icon: Image,
    level: '入门',
    completed: true,
  },
  {
    id: 'audio-guide',
    title: '音频配音全攻略',
    description: '配音生成和后期处理技巧',
    duration: '12分钟',
    type: 'video',
    icon: Music,
    level: '进阶',
    completed: false,
  },
  {
    id: 'workflow-automation',
    title: '工作流自动化',
    description: '利用工作流引擎提升创作效率',
    duration: '20分钟',
    type: 'article',
    icon: Zap,
    level: '高级',
    completed: false,
  },
];

// 快速入口
const quickLinks = [
  { title: '新建剧本', href: '/drama', icon: FileText, gradient: 'from-violet-500 to-purple-600' },
  { title: '素材管理', href: '/images', icon: Image, gradient: 'from-orange-500 to-amber-500' },
  { title: '视频生成', href: '/videos', icon: Video, gradient: 'from-cyan-500 to-teal-500' },
];

// 更多资源
const resourceLinks = [
  { title: '官方文档', desc: '完整使用指南与 API 参考', href: '/docs', icon: Book },
  { title: '视频教程', desc: '跟随演示快速上手', href: '/help-center#tutorials', icon: Video },
  { title: '提示词库', desc: '高质量提示词管理与复用', href: '/prompts', icon: FileText },
];

// 相关文章映射
const relatedArticles: Record<string, string[]> = {
  '快速入门': ['剧本创作技巧', '素材管理指南'],
  '视频生成': ['视频生成最佳实践', '工作流自动化'],
  '素材管理': ['素材管理指南', '音频配音全攻略'],
  '音频配音': ['音频配音全攻略', '视频生成最佳实践'],
  '账户与计费': ['快速入门指南'],
};

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [view, setView] = useState('faq');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  // 过滤FAQ
  const filteredCategories = useMemo(() => {
    if (!searchQuery && !activeCategory) return faqCategories;

    return faqCategories.filter(cat => {
      if (activeCategory && cat.category !== activeCategory) return false;

      if (searchQuery) {
        const hasMatch = cat.items.some(
          item =>
            item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      return true;
    }).map(cat => ({
      ...cat,
      items: searchQuery ? cat.items.filter(
        item =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      ) : cat.items,
    }));
  }, [searchQuery, activeCategory]);

  // 统计数据
  const stats = {
    totalQuestions: faqCategories.reduce((acc, cat) => acc + cat.items.length, 0),
    completedTutorials: tutorials.filter(t => t.completed).length,
    totalTutorials: tutorials.length,
  };

  const voteHelpful = (question: string, vote: 'up' | 'down') => {
    setHelpfulVotes(prev => ({ ...prev, [question]: prev[question] === vote ? null : vote }));
  };

  const getRelatedTutorials = (category: string) => {
    const titles = relatedArticles[category] || [];
    return tutorials.filter(t => titles.includes(t.title));
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-6">
        {/* Hero Section - 与 docs 同款：左标题右搜索 */}
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">帮助中心</h1>
                  <Badge variant="secondary" className="text-xs">{stats.totalQuestions} 问题 · {stats.totalTutorials} 教程</Badge>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">常见问题与使用教程，快速解决创作中的疑问</p>
              </div>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索问题..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 bg-background/50 backdrop-blur-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="清空搜索"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 快速入口 - 卡片式 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.title}
              onClick={() => window.location.href = link.href}
              className="group flex items-center gap-3 p-3 sm:p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all text-left active:scale-[0.98]"
            >
              <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white shadow-sm shrink-0', link.gradient)}>
                <link.icon className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-medium">{link.title}</span>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        {/* 分类导航 - docs 同款渐变 Tabs */}
        <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-2 bg-muted/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg text-xs sm:text-sm font-medium transition-all',
              !activeCategory
                ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Sparkles className="h-4 w-4" />
            全部
          </button>
          {faqCategories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
              className={cn(
                'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg text-xs sm:text-sm font-medium transition-all',
                activeCategory === cat.category
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <cat.icon className="h-4 w-4" />
              {cat.category}
            </button>
          ))}
        </div>

        <Tabs value={view} onValueChange={setView} className="space-y-4">
          <TabsList className="bg-muted/50 h-9 p-1">
            <TabsTrigger
              value="faq"
              className="h-7 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              常见问题
            </TabsTrigger>
            <TabsTrigger
              value="tutorials"
              className="h-7 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Book className="h-3.5 w-3.5 mr-1.5" />
              使用教程
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab - 按分类卡片分组 */}
          <TabsContent value="faq" className="space-y-4">
            {filteredCategories.map((category) => (
              <Card key={category.category} className="border shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <span className={cn('p-1.5 rounded-lg bg-gradient-to-br text-white shadow-sm', category.color)}>
                      <category.icon className="h-4 w-4" />
                    </span>
                    {category.category}
                    <Badge variant="secondary" className="text-[10px]">{category.items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Accordion type="single" collapsible className="w-full">
                    {category.items.map((item, index) => {
                      const itemKey = `${category.category}-${index}`;
                      const vote = helpfulVotes[item.question];

                      return (
                        <AccordionItem
                          key={itemKey}
                          value={itemKey}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <AccordionTrigger className="text-left px-2 py-3 hover:no-underline hover:bg-muted/30 rounded-lg text-sm font-medium">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="px-2 pb-3">
                            <div className="whitespace-pre-line text-sm text-muted-foreground leading-relaxed">
                              {item.answer}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex flex-wrap gap-1">
                                {item.tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => voteHelpful(item.question, 'up')}
                                  className={cn(
                                    'p-1.5 rounded transition-colors',
                                    vote === 'up' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-green-500'
                                  )}
                                  aria-label="有用"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => voteHelpful(item.question, 'down')}
                                  className={cn(
                                    'p-1.5 rounded transition-colors',
                                    vote === 'down' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:text-red-500'
                                  )}
                                  aria-label="没用"
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {/* 相关教程 */}
                            {getRelatedTutorials(category.category).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-border/60">
                                <p className="text-xs text-muted-foreground mb-2">相关教程：</p>
                                <div className="flex flex-wrap gap-1">
                                  {getRelatedTutorials(category.category).map(t => (
                                    <Button
                                      key={t.id}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-primary hover:text-primary"
                                      onClick={() => setView('tutorials')}
                                    >
                                      {t.title}
                                      <ChevronRight className="h-3 w-3 ml-0.5" />
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            ))}

            {filteredCategories.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-1">
                  {searchQuery ? <>未找到与「{searchQuery}」相关的问题</> : '该分类下暂无问题'}
                </p>
                <p className="text-xs text-muted-foreground/70">换个关键词试试，或浏览全部问题</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {['剧本', '视频生成', '配音', '素材'].map((kw) => (
                    <button
                      key={kw}
                      onClick={() => { setSearchQuery(kw); setActiveCategory(null); }}
                      className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(''); setActiveCategory(null); }}>
                  查看全部
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tutorials Tab - 卡片网格 */}
          <TabsContent value="tutorials" className="space-y-4" id="tutorials">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tutorials.map((tutorial) => (
                <div
                  key={tutorial.id}
                  className="group p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      'p-2 rounded-lg bg-gradient-to-br text-white shadow-sm',
                      tutorial.completed ? 'from-emerald-500 to-green-500' : 'from-violet-500 to-purple-500'
                    )}>
                      <tutorial.icon className="h-4 w-4" />
                    </div>
                    {tutorial.completed ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] hover:bg-emerald-500/10">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        已完成
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{tutorial.level}</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    {tutorial.title}
                    {tutorial.type === 'video' && <Play className="h-3 w-3 text-primary shrink-0" />}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tutorial.description}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {tutorial.duration}
                    <span>·</span>
                    <span>{tutorial.level}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 更多资源 */}
            <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Book className="h-4 w-4" />
                  </span>
                  更多资源
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {resourceLinks.map((link) => (
                    <a
                      key={link.title}
                      href={link.href}
                      className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <span className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                        <link.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs sm:text-sm font-medium">{link.title}</span>
                        <span className="block text-[10px] sm:text-xs text-muted-foreground truncate">{link.desc}</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 联系支持 - 淡彩渐变卡 */}
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white w-fit shadow-lg shadow-primary/20 shrink-0">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">需要更多帮助？</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">工作日 9:00-18:00 在线客服 · 支持邮件与在线咨询</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" asChild>
                <a href="mailto:support@drama.ai">
                  <Mail className="h-4 w-4 mr-1" />
                  邮件支持
                </a>
              </Button>
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-md shadow-primary/20">
                <MessageSquare className="h-4 w-4 mr-1" />
                在线咨询
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}