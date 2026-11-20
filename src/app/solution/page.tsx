'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
  Infinity,
  Building2,
  ArrowRight,
  Play,
  Users,
  Film,
  Clock,
  TrendingUp,
  Star,
  MessageSquare,
  Video,
  Image,
  Music,
  Bot,
  Shield,
  HeadphonesIcon,
  Rocket,
  Target,
  Award,
  Heart,
  ChevronRight,
  Lightbulb,
  Mail,
  MapPin,
  FileText,
  Gift,
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
  CheckCircle2,
  Menu,
  X as XIcon,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  Tag,
  Wallet,
} from 'lucide-react';
import { 
  pricingPlans, 
  useCases, 
  testimonials, 
  advantages,
  siteConfig,
  contactInfo,
  featureComparison,
  pricingFaqs,
} from '@/lib/site-config';

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Image,
  Music,
  Zap,
  Shield,
  HeadphonesIcon,
  Film,
  Target,
  Award,
  Sparkles,
  Crown,
  Bot,
  Lightbulb,
  Heart,
  Star,
  Gift,
  FileText,
  Video,
  Infinity,
};

const getIcon = (iconName: string) => iconMap[iconName] || Sparkles;

export default function SolutionPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedFeature, setCopiedFeature] = useState<string | null>(null);

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MainLayout>
      <div className="space-y-12 pb-12">
        {/* Hero Section */}
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
              专业级AI短剧解决方案
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              让AI成为你的短剧创作团队
            </h1>
            <p className="text-white/80 text-lg mb-6 max-w-2xl">
              从剧本创作到视频生成，AI全流程自动化。人物、画面、声音三一致，打造专业级短剧内容。
              支持接入你自己的模型 API Key，9 家主流平台任选，不卖 token、不限次数。
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-white text-violet-600 hover:bg-white/90" asChild onClick={scrollToPricing}>
                <Link href="#pricing">
                  <Play className="h-5 w-5 mr-2" />
                  免费体验
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                <Link href="#pricing">
                  查看定价
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
            
            {/* 信任指标 */}
            <div className="mt-8 flex flex-wrap gap-6 md:gap-10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">无需信用卡</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">7天免费试用</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">自带模型 Key</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">随时取消</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">数据安全</span>
              </div>
            </div>
          </div>
        </section>

        {/* 核心优势 */}
        <section className="px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">为什么选择我们</h2>
            <p className="text-muted-foreground">行业领先的AI短剧生成技术，三一致核心优势</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {advantages.map((item) => {
              const IconComponent = getIcon(item.icon);
              return (
                <Card key={item.title} className="group hover:shadow-lg transition-all hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 w-fit mb-4">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 模型接入 BYOK */}
        <section className="px-4">
          <div className="max-w-5xl mx-auto rounded-2xl border border-border bg-gradient-to-br from-violet-500/5 to-pink-500/5 p-6 md:p-8">
            <div className="text-center mb-6">
              <Badge variant="secondary" className="mb-3">
                <Bot className="h-3 w-3 mr-1" />
                模型自由
              </Badge>
              <h2 className="text-2xl font-bold mb-2">接自己的 Key，用你想用的模型</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
                别的平台只开一两个专用模型、按次元扣费，模型选不了、成本也算不清。我们把模型层完全开放：
                你带自己的 API Key，模型费用直接按厂商实价结算，平台只收软件使用费。
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/80">
                <CardContent className="p-5">
                  <Bot className="h-5 w-5 text-primary mb-3" />
                  <h3 className="font-semibold mb-1">9 家主流平台 + 自定义</h3>
                  <p className="text-sm text-muted-foreground">
                    智谱、通义千问、火山引擎（豆包）、MiniMax、Moonshot、DeepSeek、文心一言、腾讯混元、NVIDIA，也支持任意 OpenAI 兼容地址。
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80">
                <CardContent className="p-5">
                  <Zap className="h-5 w-5 text-emerald-500 mb-3" />
                  <h3 className="font-semibold mb-1">不限生成次数</h3>
                  <p className="text-sm text-muted-foreground">
                    套餐有效期内，剧本、分镜、人物、场景、配音、视频不限次数生成，模型费按你 Key 的实际用量走，平台不抽成。
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80">
                <CardContent className="p-5">
                  <Shield className="h-5 w-5 text-amber-500 mb-3" />
                  <h3 className="font-semibold mb-1">Key 加密存储</h3>
                  <p className="text-sm text-muted-foreground">
                    Key 仅服务端调用、加密存储、日志脱敏，随时可在设置页替换或删除。不想配 Key 也可用平台内置模型（代运行服务单独计费）。
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {['智谱', '通义千问', '火山引擎', 'MiniMax', 'Moonshot', 'DeepSeek', '文心一言', '腾讯混元', 'NVIDIA', '自定义接口'].map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Button variant="outline" asChild>
                <Link href="/settings">
                  <Wallet className="h-4 w-4 mr-2" />
                  去配置模型 Key
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 功能对比表 */}
        <section className="px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">功能对比</h2>
              <p className="text-muted-foreground">查看各套餐包含的功能差异</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">功能</th>
                    <th className="text-center p-4 font-medium">体验卡</th>
                    <th className="text-center p-4 font-medium">月卡</th>
                    <th className="text-center p-4 font-medium">季卡</th>
                    <th className="text-center p-4 font-medium">年卡</th>
                    <th className="text-center p-4 font-medium">终身卡</th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, idx) => (
                    <tr key={row.feature} className={cn("border-b border-border/50", idx % 2 === 0 && "bg-muted/30")}>
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="text-center p-4 text-sm text-muted-foreground">{row.trial === false ? '✕' : row.trial === true ? '✓' : row.trial}</td>
                      <td className="text-center p-4 text-sm text-muted-foreground">{row.monthly === false ? '✕' : row.monthly === true ? '✓' : row.monthly}</td>
                      <td className="text-center p-4 text-sm text-muted-foreground">{row.quarterly === false ? '✕' : row.quarterly === true ? '✓' : row.quarterly}</td>
                      <td className="text-center p-4 text-sm">{row.yearly === false ? '✕' : row.yearly === true ? '✓' : row.yearly}</td>
                      <td className="text-center p-4 text-sm">{row.lifetime === false ? '✕' : row.lifetime === true ? '✓' : row.lifetime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 定价方案 */}
        <section id="pricing" className="px-4 scroll-mt-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">选择适合你的方案</h2>
            <p className="text-muted-foreground">
              不卖 token、不限次数，只收网站使用费，套餐有效期内随便用
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {pricingPlans.map((plan) => {
              const IconComponent = getIcon(plan.icon);
              const highlighted = plan.badge !== null;
              const savings = plan.originalPrice
                ? Math.round((1 - plan.price / plan.originalPrice) * 100)
                : null;
              
              return (
                <Card 
                  key={plan.id}
                  className={cn(
                    'relative overflow-hidden transition-all hover:shadow-lg flex flex-col',
                    highlighted ? 'border-primary shadow-lg z-10' : ''
                  )}
                >
                  {plan.badge && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-xs text-center py-1 font-medium">
                      {plan.badge}
                    </div>
                  )}
                  <CardHeader className={cn(plan.badge && 'pt-8')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', plan.color)}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <CardTitle>{plan.name}</CardTitle>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{plan.price === 0 ? '免费' : `¥${plan.price}`}</span>
                      {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                    </div>
                    {plan.originalPrice && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through text-muted-foreground">¥{plan.originalPrice}</span>
                        {savings && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">省{savings}%</Badge>}
                      </div>
                    )}

                    {/* 商业模式：不限次数 */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        不限生成次数
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.durationDays >= 36500 ? '一次买断，长期有效' : `有效期 ${plan.durationDays} 天`}
                        {' · '}模型费走自己的 Key
                      </p>
                    </div>

                    <ul className="space-y-2 flex-1">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          {feature.included ? (
                            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          )}
                          <span className={cn(!feature.included && 'text-muted-foreground')}>{feature.text}</span>
                        </li>
                      ))}
                    </ul>

                    <Button 
                      className={cn('w-full', highlighted && 'bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600')} 
                      variant={highlighted ? 'default' : 'outline'}
                      asChild
                    >
                      <Link href={plan.href}>
                        {plan.cta}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 使用案例 */}
        <section className="px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">适用场景</h2>
            <p className="text-muted-foreground">为不同类型的创作者量身定制</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((useCase) => {
              const IconComponent = getIcon(useCase.icon);
              return (
                <Card key={useCase.title} className="group hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                    <IconComponent className="h-12 w-12 text-primary/50 group-hover:scale-110 transition-transform" />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-1">{useCase.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{useCase.description}</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                      <TrendingUp className="h-4 w-4" />
                      {useCase.stats}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {useCase.features.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 客户评价 */}
        <section className="px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">用户评价</h2>
            <p className="text-muted-foreground">听听他们怎么说</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((item, idx) => (
              <Card key={idx} className="hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${['from-violet-500 to-purple-500', 'from-fuchsia-500 to-pink-500', 'from-sky-500 to-blue-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-red-500'][idx % 6]} text-white font-bold flex items-center justify-center shadow-sm`}>
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: item.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 常见问题 */}
        <section className="px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">常见问题</h2>
            <p className="text-muted-foreground">关于定价和订阅的常见疑问</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {pricingFaqs.map((faq, idx) => (
                <AccordionItem key={idx} value={String(idx)} className="border border-border">
                  <AccordionTrigger className="text-left px-4 py-3 hover:no-underline hover:bg-muted/30">
                    <div className="font-medium text-sm">{faq.question}</div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4">
          <Card className="bg-gradient-to-r from-violet-500 to-pink-500 border-0 overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                开始你的AI短剧创作之旅
              </h2>
              <p className="text-white/80 mb-6 max-w-xl mx-auto">
                免费体验，无需信用卡。立即注册，开启高效创作。
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" className="bg-white text-violet-600 hover:bg-white/90" asChild>
                  <Link href="/drama">
                    <Rocket className="h-5 w-5 mr-2" />
                    立即开始
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                  <Link href="/help-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    联系我们
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}