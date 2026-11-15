'use client';

import { useState, useEffect, Suspense } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  User,
  BarChart2,
  Video,
  Image as ImageIcon,
  Music,
  MessageSquare,
  TrendingUp,
  Clock,
  Loader2,
  Link2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Unlink,
  Crown,
  Star,
  Gift,
  Sparkles,
  FileText,
  Film,
  Zap,
  ShoppingCart,
  CreditCard,
  Package,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pricingPlans, resourcePacks } from '@/lib/site-config';
import { toast } from 'sonner';

interface CozeStatus {
  bound: boolean;
  cozeUserId?: string;
  tokenExpired?: boolean;
}

interface QuotaInfo {
  total: number;
  used: number;
}

interface UserInfo {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  avatar?: string;
  created_at?: string;
  coze_user_id?: string;
}

interface SubscriptionInfo {
  planType: string;
  planName: string;
  activatedAt: string;
  expiresAt: string;
  remainingDays: number;
  durationDays: number;
  quotas?: {
    scripts: QuotaInfo;
    videos: QuotaInfo;
    images: QuotaInfo;
    music?: QuotaInfo;
  };
  failedCount?: number; // 生成失败退换次数
}

// 消耗记录
interface UsageRecord {
  id: string;
  type: 'script' | 'video' | 'image' | 'music';
  action: string;
  cost: number;
  status: 'success' | 'failed' | 'refunded';
  createdAt: string;
  detail?: string;
}

// 套餐配置
const planConfig: Record<string, { icon: typeof Crown; color: string; price: number }> = {
  trial: { icon: Sparkles, color: 'text-gray-500', price: 0 },
  monthly: { icon: Star, color: 'text-blue-500', price: 29.9 },
  quarterly: { icon: Gift, color: 'text-violet-500', price: 79 },
  yearly: { icon: Crown, color: 'text-amber-500', price: 299 },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { authenticated, user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'info';
  
  const [loading, setLoading] = useState(true);
  const [cozeStatus, setCozeStatus] = useState<CozeStatus>({ bound: false });
  const [bindingCoze, setBindingCoze] = useState(false);
  const [unbindingCoze, setUnbindingCoze] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  
  // 用户信息（扩展类型）
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push('/login');
      return;
    }
    
    if (authenticated) {
      // 设置用户信息
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email,
          name: authUser.name,
          username: (authUser as UserInfo).username || authUser.name,
          avatar: authUser.avatar,
        });
      }
      
      const bindSuccess = searchParams.get('bind_success');
      const bindError = searchParams.get('bind_error');
      
      if (bindSuccess === 'true') {
        setMessage({ type: 'success', text: '扣子账号绑定成功！' });
        window.history.replaceState({}, '', '/profile');
      } else if (bindError) {
        setMessage({ type: 'error', text: decodeURIComponent(bindError) });
        window.history.replaceState({}, '', '/profile');
      }
      
      loadData();
    }
  }, [authenticated, authLoading, router, searchParams]);

  const loadData = async () => {
    try {
      const userStr = localStorage.getItem('user');
      
      if (userStr) {
        const user = JSON.parse(userStr);
        
        // 从API获取订阅信息
        const subResponse = await fetch(`/api/auth/subscription?userId=${user.id}`);
        if (subResponse.ok) {
          const subData = await subResponse.json();
          
          // 获取配额数据（新用户也会返回体验卡配额）
          const quotas = subData.subscription?.quotas || {
            scripts: { total: 0, used: 0 },
            videos: { total: 0, used: 0 },
            images: { total: 0, used: 0 },
            music: { total: 0, used: 0 },
          };
          
          // 如果是管理员，设置无限配额
          if (subData.isAdmin) {
            quotas.scripts = { total: 999999, used: 0 };
            quotas.videos = { total: 999999, used: 0 };
            quotas.images = { total: 999999, used: 0 };
            quotas.music = { total: 999999, used: 0 };
          }
          
          // 构建订阅信息
          const subscriptionData: SubscriptionInfo = {
            planType: subData.subscription?.planType || 'trial',
            planName: subData.subscription?.planName || '体验卡',
            activatedAt: subData.subscription?.activatedAt || new Date().toISOString(),
            expiresAt: subData.subscription?.expiresAt || new Date().toISOString(),
            remainingDays: subData.subscription?.remainingDays || 0,
            durationDays: subData.subscription?.durationDays || 0,
            quotas,
            failedCount: subData.subscription?.failedCount,
          };
          
          setSubscription(subscriptionData);
          
          // 同步到 localStorage
          localStorage.setItem('subscription', JSON.stringify(subscriptionData));
        }
        
        // 加载扣子账号状态
        const response = await fetch(`/api/auth/coze-status`, {
          headers: { 'x-user-id': user.id },
        });
        const data = await response.json();
        setCozeStatus(data);
        
        // 加载消耗记录
        loadUsageRecords(user.id);
      } else {
        // 尝试从 localStorage 读取（兼容旧逻辑）
        const subStr = localStorage.getItem('subscription');
        if (subStr) {
          setSubscription(JSON.parse(subStr));
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      // 尝试从 localStorage 读取作为兜底
      const subStr = localStorage.getItem('subscription');
      if (subStr) {
        setSubscription(JSON.parse(subStr));
      }
    }
    setLoading(false);
  };
  
  // 加载消耗记录
  const loadUsageRecords = async (userId: string) => {
    setLoadingRecords(true);
    try {
      const response = await fetch(`/api/user/usage-records?userId=${userId}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setUsageRecords(data.records || []);
      }
    } catch (error) {
      console.error('加载消耗记录失败:', error);
    } finally {
      setLoadingRecords(false);
    }
  };

  // 绑定扣子账号
  const handleBindCoze = () => {
    setBindingCoze(true);
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      alert('请先登录');
      setBindingCoze(false);
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      const stateJson = JSON.stringify({
        current_user_id: user.id,
        mode: 'bind',
        redirect_to: '/profile',
        timestamp: Date.now(),
      });
      const state = btoa(stateJson)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      window.location.href = `/api/auth/oauth/coze?mode=bind&state=${state}`;
    } catch (error) {
      console.error('绑定失败:', error);
      alert('绑定失败，请重试');
      setBindingCoze(false);
    }
  };

  // 解绑扣子账号
  const handleUnbindCoze = async () => {
    if (!confirm('确定要解绑扣子账号吗？')) {
      return;
    }
    
    setUnbindingCoze(true);
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) throw new Error('未登录');
      const user = JSON.parse(userStr);
      
      const response = await fetch('/api/auth/coze-status', {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCozeStatus({ bound: false });
        toast.success('解绑成功');
      } else {
        toast.error(data.error || '解绑失败');
      }
    } catch (error) {
      console.error('解绑失败:', error);
      toast.error('解绑失败');
    } finally {
      setUnbindingCoze(false);
    }
  };

  // 购买资源包
  const handlePurchasePack = async (packId: string) => {
    setPurchasing(packId);
    try {
      const pack = resourcePacks.find(p => p.id === packId);
      if (!pack) return;
      
      // 检测设备类型，PC端使用网页支付，移动端使用手机支付
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const payType = isMobile ? 'wap' : 'page';
      
      // 创建订单
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: packId, payType }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || '创建订单失败');
        return;
      }
      
      // 模拟支付成功后激活
      const confirmResponse = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: data.order.orderNo }),
      });
      
      const confirmData = await confirmResponse.json();
      
      if (confirmResponse.ok) {
        toast.success(`购买成功！已添加${pack.name}`);
        // 刷新订阅信息
        loadData();
      } else {
        toast.error(confirmData.error || '购买失败');
      }
    } catch (error) {
      console.error('购买失败:', error);
      toast.error('购买失败，请重试');
    } finally {
      setPurchasing(null);
    }
  };

  // 升级套餐
  const handleUpgrade = (planId: string) => {
    router.push(`/login?plan=${planId}`);
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!authenticated) {
    return null;
  }

  // 获取当前套餐信息
  const currentPlan = subscription ? planConfig[subscription.planType] || planConfig.trial : planConfig.trial;
  const PlanIcon = currentPlan.icon;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">个人中心</h1>
          <p className="text-muted-foreground mt-2">
            管理您的账户、订阅和用量
          </p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' 
              : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto opacity-70 hover:opacity-100">×</button>
          </div>
        )}

        <Tabs defaultValue={activeTab}>
          <TabsList>
            <TabsTrigger value="info">
              <User className="h-4 w-4 mr-2" />
              账户信息
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <Crown className="h-4 w-4 mr-2" />
              订阅管理
            </TabsTrigger>
            <TabsTrigger value="usage">
              <BarChart2 className="h-4 w-4 mr-2" />
              用量统计
            </TabsTrigger>
          </TabsList>

          {/* 账户信息 */}
          <TabsContent value="info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>账户信息</CardTitle>
                <CardDescription>您的基本账户信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name || '用户'} loading="lazy" decoding="async" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      user?.name?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{user?.name || user?.username || '用户'}</h3>
                      {subscription && (
                        <Badge variant="secondary" className={cn('gap-1', currentPlan.color)}>
                          <PlanIcon className="h-3 w-3" />
                          {subscription.planName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">用户ID</p>
                    <p className="font-mono text-sm">{user?.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">账户类型</p>
                    <p className="text-sm">{subscription?.planName || '体验卡'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 扣子账号绑定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  扣子账号绑定
                </CardTitle>
                <CardDescription>绑定扣子账号使用自己的词元</CardDescription>
              </CardHeader>
              <CardContent>
                {cozeStatus.bound ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">已绑定扣子账号</p>
                          {cozeStatus.cozeUserId && (
                            <p className="text-sm text-green-600 dark:text-green-500">账号ID: {cozeStatus.cozeUserId}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleBindCoze} disabled={bindingCoze}>
                        {bindingCoze ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                        重新绑定
                      </Button>
                      <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleUnbindCoze} disabled={unbindingCoze}>
                        {unbindingCoze ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
                        解绑
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">未绑定扣子账号</p>
                          <p className="text-sm text-muted-foreground">当前使用系统公共资源</p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleBindCoze} disabled={bindingCoze}>
                      {bindingCoze ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                      绑定扣子账号
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 订阅管理 */}
          <TabsContent value="subscription" className="space-y-6">
            {/* 当前订阅状态 */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PlanIcon className={cn('h-5 w-5', currentPlan.color)} />
                    当前套餐
                  </span>
                  {subscription && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      剩余 {subscription.remainingDays} 天
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{subscription.planName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {subscription.activatedAt ? `激活于 ${new Date(subscription.activatedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">到期时间</p>
                      <p className="font-medium">{new Date(subscription.expiresAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>暂无订阅信息</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 套餐升级 */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold">升级套餐</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                {pricingPlans.filter(p => p.id !== 'trial').map((plan) => {
                  const Icon = plan.icon === 'Crown' ? Crown : plan.icon === 'Gift' ? Gift : Star;
                  const isCurrent = subscription?.planType === plan.id;
                  const isRecommended = plan.badge === '推荐';
                  const saving = plan.originalPrice ? plan.originalPrice - plan.price : 0;
                  
                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        'relative rounded-2xl border-2 transition-all duration-300 flex flex-col',
                        isCurrent 
                          ? 'border-primary bg-primary/5' 
                          : isRecommended 
                            ? 'border-primary shadow-lg' 
                            : 'border-border hover:border-primary/50 hover:shadow-md'
                      )}
                    >
                      {plan.badge && (
                        <div className={cn(
                          'absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold shadow',
                          isRecommended ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                        )}>
                          {plan.badge}
                        </div>
                      )}
                      
                      <div className="p-6 flex-1 flex flex-col">
                        {/* 图标 + 名称 */}
                        <div className="flex items-center gap-3 mb-5">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center',
                            plan.id === 'monthly' && 'bg-blue-500',
                            plan.id === 'quarterly' && 'bg-violet-500',
                            plan.id === 'yearly' && 'bg-amber-500'
                          )}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold">{plan.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {plan.description}
                            </p>
                          </div>
                        </div>
                      
                        {/* 价格 */}
                        <div className="mb-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm text-muted-foreground">¥</span>
                            <span className="text-4xl font-bold">{plan.price.toFixed(2)}</span>
                            <span className="text-sm text-muted-foreground">{plan.period}</span>
                          </div>
                          {plan.originalPrice && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-sm text-muted-foreground line-through">
                                ¥{plan.originalPrice.toFixed(2)}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                省¥{saving.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* 配额 */}
                        <div className="space-y-3 mb-6 text-sm border-t pt-5 flex-1">
                          {[
                            { label: '剧本额度', value: plan.quotas.scripts },
                            { label: '视频额度', value: plan.quotas.videos },
                            { label: '图片额度', value: plan.quotas.images },
                            { label: '音乐额度', value: plan.quotas.music },
                          ].map((item) => (
                            <div key={item.label} className="flex justify-between items-center">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-semibold">{item.value.toLocaleString()}/月</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* 按钮 */}
                        {isCurrent ? (
                          <Button disabled className="w-full h-10 font-semibold" variant="outline">
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            当前套餐
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => handleUpgrade(plan.id)} 
                            className="w-full h-10 font-semibold"
                            variant={isRecommended ? 'default' : 'outline'}
                          >
                            立即订阅
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 资源包 */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-semibold">资源包</h3>
                <span className="text-sm text-muted-foreground">— 额度不足？购买资源包补充</span>
              </div>
              
              <div className="grid grid-cols-5 gap-5">
                {resourcePacks.map((pack) => (
                  <div
                    key={pack.id}
                    className={cn(
                      'relative rounded-2xl border-2 bg-card transition-all duration-300 hover:shadow-lg flex flex-col',
                      pack.popular ? 'border-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {pack.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow">
                        热门
                      </div>
                    )}
                    
                    <div className="p-5 text-center flex-1 flex flex-col">
                      {/* 图标 */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center',
                        pack.id.includes('script') && 'bg-blue-500 text-white',
                        pack.id.includes('video') && 'bg-red-500 text-white',
                        pack.id.includes('music') && 'bg-green-500 text-white',
                        pack.id.includes('image') && 'bg-orange-500 text-white'
                      )}>
                        {pack.id.includes('script') && <FileText className="h-5 w-5" />}
                        {pack.id.includes('video') && <Video className="h-5 w-5" />}
                        {pack.id.includes('music') && <Music className="h-5 w-5" />}
                        {pack.id.includes('image') && <ImageIcon className="h-5 w-5" />}
                      </div>
                      
                      <h4 className="font-semibold mb-1">{pack.name}</h4>
                      <p className="text-xs text-muted-foreground mb-4">{pack.description}</p>
                      
                      <div className="text-2xl font-bold mb-4 mt-auto">
                        <span className="text-sm text-muted-foreground mr-0.5">¥</span>
                        {pack.price.toFixed(2)}
                      </div>
                      
                      <Button
                        className="w-full h-9 font-semibold"
                        variant={pack.popular ? 'default' : 'outline'}
                        onClick={() => handlePurchasePack(pack.id)}
                        disabled={purchasing === pack.id}
                      >
                        {purchasing === pack.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          '购买'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 用量统计 */}
          <TabsContent value="usage" className="space-y-6">
            {/* 配额概览 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">剧本生成</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold">{subscription?.quotas?.scripts?.used || 0}</p>
                        <p className="text-sm text-muted-foreground">/ {subscription?.quotas?.scripts?.total || 0}</p>
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={subscription?.quotas?.scripts ? (subscription.quotas.scripts.used / subscription.quotas.scripts.total) * 100 : 0} 
                    className="h-1.5 mt-3" 
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                      <Video className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">视频生成</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold">{subscription?.quotas?.videos?.used || 0}</p>
                        <p className="text-sm text-muted-foreground">/ {subscription?.quotas?.videos?.total || 0}</p>
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={subscription?.quotas?.videos ? (subscription.quotas.videos.used / subscription.quotas.videos.total) * 100 : 0} 
                    className="h-1.5 mt-3" 
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">图片生成</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold">{subscription?.quotas?.images?.used || 0}</p>
                        <p className="text-sm text-muted-foreground">/ {subscription?.quotas?.images?.total || 0}</p>
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={subscription?.quotas?.images ? (subscription.quotas.images.used / subscription.quotas.images.total) * 100 : 0} 
                    className="h-1.5 mt-3" 
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                      <Music className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">音乐生成</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold">{subscription?.quotas?.music?.used || 0}</p>
                        <p className="text-sm text-muted-foreground">/ {subscription?.quotas?.music?.total || 0}</p>
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={subscription?.quotas?.music ? (subscription.quotas.music.used / subscription.quotas.music.total) * 100 : 0} 
                    className="h-1.5 mt-3" 
                  />
                </CardContent>
              </Card>
            </div>

            {/* 快捷操作 */}
            <Card>
              <CardHeader>
                <CardTitle>额度不足？</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline" onClick={() => router.push('/profile?tab=subscription')}>
                    <Crown className="h-4 w-4 mr-2" />
                    升级套餐
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/profile?tab=subscription')}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    购买资源包
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 消耗记录 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    消耗记录
                  </span>
                  {subscription?.failedCount && subscription.failedCount > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      已退换 {subscription.failedCount} 次
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>您的资源消耗明细</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRecords ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : usageRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>暂无消耗记录</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usageRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'p-2 rounded-lg',
                            record.type === 'script' && 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
                            record.type === 'video' && 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
                            record.type === 'image' && 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
                            record.type === 'music' && 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400'
                          )}>
                            {record.type === 'script' && <FileText className="h-4 w-4" />}
                            {record.type === 'video' && <Video className="h-4 w-4" />}
                            {record.type === 'image' && <ImageIcon className="h-4 w-4" />}
                            {record.type === 'music' && <Music className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{record.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(record.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'text-sm font-medium',
                            record.status === 'refunded' && 'text-green-600',
                            record.status === 'failed' && 'text-red-600'
                          )}>
                            {record.status === 'refunded' ? '+' : '-'}{record.cost}
                          </span>
                          {record.status === 'refunded' && (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                              已退回
                            </Badge>
                          )}
                          {record.status === 'failed' && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                              失败
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
