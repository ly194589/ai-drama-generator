'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Percent,
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
  resourcePacks,
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
};

const getIcon = (iconName: string) => iconMap[iconName] || Sparkles;

export default function SolutionPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedFeature, setCopiedFeature] = useState<string | null>(null);

  // 计算价格
  const getDisplayPrice = (plan: typeof pricingPlans[0]) => {
    if (plan.price === 0) return '免费';
    if (billingPeriod === 'yearly' && plan.originalPrice) {
      return `¥${Math.round(plan.price * 0.8)}`;
    }
    return `¥${plan.price}`;
  };

  const getOriginalPrice = (plan: typeof pricingPlans[0]) => {
    if (billingPeriod === 'yearly' && plan.originalPrice) {
      return `¥${Math.round(plan.originalPrice * 0.8)}`;
    }
    return null;
  };

  const getSavings = (plan: typeof pricingPlans[0]) => {
    if (billingPeriod === 'yearly' && plan.originalPrice) {
      const monthlyTotal = plan.price * 12;
      const yearlyTotal = Math.round(plan.price * 0.8);
      const savings = Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
      return `省${savings}%`;
    }
    return null;
  };

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

        {/* 功能对比表 */}
        <section className="px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">功能对比</h2>
              <p className="text-muted-foreground">查看各套餐包含的功能差异</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">功能</th>
                    <th className="text-center p-4 font-medium">体验卡</th>
                    <th className="text-center p-4 font-medium">月卡</th>
                    <th className="text-center p-4 font-medium">季卡</th>
                    <th className="text-center p-4 font-medium">年卡</th>
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
            <p className="text-muted-foreground">灵活的定价，满足不同规模的需求</p>
          </div>
          
          <div className="flex justify-center mb-8">
            <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as 'monthly' | 'yearly')} className="w-fit">
              <TabsList className="bg-muted">
                <TabsTrigger value="monthly">月付</TabsTrigger>
                <TabsTrigger value="yearly">
                  年付 <Percent className="h-3 w-3 ml-1" /> <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">省20%</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => {
              const IconComponent = getIcon(plan.icon);
              const displayPrice = getDisplayPrice(plan);
              const originalPrice = getOriginalPrice(plan);
              const savings = getSavings(plan);
              
              return (
                <Card 
                  key={plan.id}
                  className={cn(
                    'relative overflow-hidden transition-all hover:shadow-lg',
                    plan.badge === '推荐' || plan.badge === '超值' ? 'border-primary shadow-lg scale-105 z-10' : ''
                  )}
                >
                  {(plan.badge === '推荐' || plan.badge === '超值') && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-xs text-center py-1 font-medium">
                      {plan.badge}
                    </div>
                  )}
                  <CardHeader className={cn((plan.badge === '推荐' || plan.badge === '超值') && 'pt-8')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', plan.color)}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <CardTitle>{plan.name}</CardTitle>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{displayPrice}</span>
                      {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                    </div>
                    {originalPrice && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through text-muted-foreground">{originalPrice}</span>
                        {savings && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">{savings}</Badge>}
                      </div>
                    )}
                    
                    {/* 配额展示 */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">包含额度</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span>剧本: {plan.quotas.scripts}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Video className="h-3 w-3 text-muted-foreground" />
                          <span>视频: {plan.quotas.videos}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Image className="h-3 w-3 text-muted-foreground" />
                          <span>图片: {plan.quotas.images}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Music className="h-3 w-3 text-muted-foreground" />
                          <span>音乐: {plan.quotas.music}</span>
                        </div>
                      </div>
                    </div>
                    
                    <ul className="space-y-2">
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
                      className={cn('w-full', (plan.badge === '推荐' || plan.badge === '超值') && 'bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600')} 
                      variant={(plan.badge === '推荐' || plan.badge === '超值') ? 'default' : 'outline'}
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

        {/* 资源包 */}
        <section className="px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">单独购买资源包</h2>
            <p className="text-muted-foreground">按需购买，灵活补充额度</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {resourcePacks.map((pack) => {
              const IconComponent = getIcon(pack.icon);
              return (
                <Card key={pack.id} className={cn('hover:shadow-lg transition-all', pack.popular && 'border-primary')}>
                  {pack.popular && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-primary text-primary-foreground">热门</Badge>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-pink-500/10">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{pack.name}</h3>
                        {pack.originalPrice && (
                          <p className="text-sm line-through text-muted-foreground">原价 ¥{pack.originalPrice}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{pack.description}</p>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-2xl font-bold">¥{pack.price}</span>
                    </div>
                    <Button className="w-full" variant={pack.popular ? 'default' : 'outline'}>
                      购买
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