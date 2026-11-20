'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Sparkles, 
  CheckCircle2,
  Loader2,
  Star,
  Crown,
  Gift,
  Infinity,
  AlertCircle,
  Check,
  Copy,
  User,
  Lock,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pricingPlans } from '@/lib/site-config';

type Step = 'select' | 'payment' | 'success' | 'activate';
type AuthMode = 'login' | 'register' | 'select';

// 套餐配置
interface Plan {
  type: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
  popular?: boolean;
}

const defaultPlans: Plan[] = [
  {
    type: 'trial',
    name: '7天体验卡',
    price: 0,
    durationDays: 7,
    description: '免费体验，不限次数',
  },
  {
    type: 'monthly',
    name: '月卡',
    price: 19.9,
    durationDays: 30,
    description: '轻度创作首选',
  },
  {
    type: 'quarterly',
    name: '季卡',
    price: 39.9,
    durationDays: 90,
    description: '平均每月13.3元，省33%',
    popular: true,
  },
  {
    type: 'yearly',
    name: '年卡',
    price: 109,
    durationDays: 365,
    description: '平均每月9.1元，省54%',
  },
  {
    type: 'lifetime',
    name: '终身卡',
    price: 298,
    durationDays: 36500,
    description: '一次买断，不再续费',
  },
];

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<Step>('select');
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cardKey, setCardKey] = useState('');
  const [generatedCardKey, setGeneratedCardKey] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (searchParams.get('oauth_success') !== 'true') return;

    const restoreOAuthSession = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (!response.ok || !data.user?.id) throw new Error('OAuth会话无效，请重新登录');

        const user = { ...data.user, name: 'Coze用户' };
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('oauth_provider', 'coze');
        const subscriptionResponse = await fetch('/api/auth/subscription');
        const subscriptionData = await subscriptionResponse.json();
        if (!subscriptionData.authorized) {
          setErrorMessage('Coze登录成功，但账号没有有效订阅，请先激活卡密或联系管理员。');
          setIsChecking(false);
          return;
        }

        localStorage.setItem('subscription', JSON.stringify(subscriptionData.subscription));
        router.replace('/');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'OAuth登录失败，请重试');
        setIsChecking(false);
      }
    };

    void restoreOAuthSession();
  }, [router, searchParams]);
  
  // 登录/注册表单
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'mock'>('mock');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null);

  // 检查用户是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          setIsChecking(false);
          return;
        }

        const user = JSON.parse(userStr);
        const response = await fetch(`/api/auth/subscription?userId=${user.id}`);
        const data = await response.json();

        if (data.authorized) {
          const requestedPlan = searchParams.get('plan');
          const plan = requestedPlan && plans.find((item) => item.type === requestedPlan);
          if (plan) {
            setIsChecking(false);
            void handleSelectPlan(plan);
            return;
          }
          router.replace('/');
          return;
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
      setIsChecking(false);
    };

    checkAuth();
  }, [router, searchParams, plans]);

  // 处理过期跳转提示
  useEffect(() => {
    const expired = searchParams.get('expired');
    if (expired === 'true') {
      toast.error('您的订阅已过期，请续费');
    }
    
    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [searchParams, pollTimer]);

  // 获取套餐配置
  useEffect(() => {
    fetch('/api/payment/create-order')
      .then(res => res.json())
      .then(data => {
        if (data.plans) {
          setPlans(data.plans.map((p: Plan) => ({
            ...p,
            popular: p.type === 'quarterly',
          })));
        }
        if (data.paymentMethod) {
          setPaymentMethod(data.paymentMethod);
        }
      })
      .catch(() => {});
  }, []);

  // 检测设备类型
  const getDeviceType = (): 'wap' | 'page' => {
    if (typeof window === 'undefined') return 'page';
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    return isMobile ? 'wap' : 'page';
  };

  // 用户名密码登录
  const handleLogin = async () => {
    if (!username.trim()) {
      setErrorMessage('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('请输入密码');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // 普通用户登录
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || '登录失败');
        setIsLoading(false);
        return;
      }

      // 保存用户信息
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('subscription', JSON.stringify(data.subscription));
      localStorage.setItem('oauth_provider', 'password');

      toast.success('登录成功！');
      const requestedPlan = searchParams.get('plan');
      const plan = requestedPlan && plans.find((item) => item.type === requestedPlan);
      if (plan) {
        await handleSelectPlan(plan);
        return;
      }
      router.push('/');
    } catch (error) {
      console.error('登录失败:', error);
      setErrorMessage('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 用户注册
  const handleRegister = async () => {
    if (!username.trim()) {
      setErrorMessage('请输入用户名');
      return;
    }
    if (username.length < 3) {
      setErrorMessage('用户名至少3个字符');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setErrorMessage('用户名只能包含字母、数字、下划线');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('请输入密码');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('密码至少6个字符');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          email: email.trim() || undefined 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || '注册失败');
        setIsLoading(false);
        return;
      }

      // 保存用户信息
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('subscription', JSON.stringify(data.subscription));
      localStorage.setItem('oauth_provider', 'password');

      toast.success('注册成功！已为您开通体验卡');
      const requestedPlan = searchParams.get('plan');
      const plan = requestedPlan && plans.find((item) => item.type === requestedPlan);
      if (plan) {
        await handleSelectPlan(plan);
        return;
      }
      router.push('/');
    } catch (error) {
      console.error('注册失败:', error);
      setErrorMessage('注册失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 选择套餐并创建订单
  const handleSelectPlan = async (plan: Plan) => {
    // 体验卡免费，直接注册
    if (plan.type === 'trial') {
      setAuthMode('register');
      return;
    }

    setSelectedPlan(plan);
    setIsLoading(true);

    const payType = getDeviceType();

    try {
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: plan.type, payType }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || '创建订单失败');
        setIsLoading(false);
        return;
      }

      setOrderNo(data.order.orderNo);
      setPaymentUrl(data.paymentUrl);
      
      if (data.paymentMethod === 'alipay' && data.paymentUrl) {
        startPollingOrderStatus(data.order.orderNo);
        window.location.href = data.paymentUrl;
        return;
      }
      
      setStep('payment');
    } catch (error) {
      console.error('创建订单失败:', error);
      toast.error('创建订单失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 轮询订单状态
  const startPollingOrderStatus = (orderNo: string) => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/payment/confirm?orderNo=${orderNo}`);
        const data = await response.json();
        
        if (data.order?.status === 'paid') {
          clearInterval(timer);
          setGeneratedCardKey(data.order.cardKey);
          setStep('success');
          toast.success('支付成功！');
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    }, 3000);
    
    setPollTimer(timer);
    
    setTimeout(() => {
      clearInterval(timer);
    }, 5 * 60 * 1000);
  };

  // 模拟支付
  const handlePayment = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || '支付失败');
        setIsLoading(false);
        return;
      }

      setGeneratedCardKey(data.cardKey);
      setStep('success');
      toast.success('支付成功！');
    } catch (error) {
      console.error('支付失败:', error);
      toast.error('支付失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 使用生成的卡密激活
  const handleActivateGenerated = async () => {
    if (!generatedCardKey) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/card-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardKey: generatedCardKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || '激活失败');
        return;
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('subscription', JSON.stringify(data.subscription));
      localStorage.setItem('oauth_provider', 'card_key');

      toast.success('激活成功！');
      router.push('/');
    } catch (error) {
      console.error('激活失败:', error);
      toast.error('激活失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 直接使用已有卡密激活
  const handleActivate = async () => {
    if (!cardKey.trim()) {
      setErrorMessage('请输入卡密');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/card-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardKey: cardKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || '卡密验证失败');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('subscription', JSON.stringify(data.subscription));
      localStorage.setItem('oauth_provider', 'card_key');

      toast.success('激活成功！');
      router.push('/');
    } catch (error) {
      console.error('激活失败:', error);
      setErrorMessage('激活失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化卡密输入
  const handleCardKeyChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = cleaned.replace(/(.{4})(?=.)/g, '$1-').substring(0, 19);
    setCardKey(formatted);
  };

  // 复制卡密
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCardKey);
    setCopied(true);
    toast.success('卡密已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  // 检查登录状态中
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-3 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px]" />
      </div>

      <Card className="w-full max-w-md relative backdrop-blur-xl bg-card/80 border-border/50 shadow-xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <CardHeader className="text-center space-y-2 pb-2 pt-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-lg font-bold">AI 短剧生成器</CardTitle>
          <CardDescription className="text-xs">抖音真人风短剧智能创作平台</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-2 pb-4">

          {/* 登录/注册表单 */}
          {(step === 'select' && authMode !== 'select') && (
            <div className="space-y-3">
              {/* 模式切换提示 */}
              <div className="text-center">
                <h3 className="font-semibold text-sm">
                  {authMode === 'login' ? '账号登录' : '注册新账号'}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {authMode === 'login' 
                    ? '登录后即可使用平台功能' 
                    : '注册即送7天体验卡，全功能不限次数'}
                </p>
              </div>

              {/* 用户名输入 */}
              <div className="space-y-1.5">
                <Label className="text-xs">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="h-9 text-xs pl-9 bg-background/50"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 邮箱输入（仅注册） */}
              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">邮箱 <span className="text-muted-foreground">(选填)</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="用于找回密码"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 text-xs pl-9 bg-background/50"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {/* 密码输入 */}
              <div className="space-y-1.5">
                <Label className="text-xs">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={authMode === 'login' ? '请输入密码' : '至少6个字符'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="h-9 text-xs pl-9 bg-background/50"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 错误消息 */}
              {errorMessage && (
                <div className="flex items-center gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 提交按钮 */}
              <Button
                onClick={authMode === 'login' ? handleLogin : handleRegister}
                disabled={isLoading}
                className="w-full h-9 text-sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {authMode === 'login' ? '登录' : '注册并领取体验卡'}
              </Button>

              {/* 切换模式 */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {authMode === 'login' ? '还没有账号？' : '已有账号？'}
                </span>
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setErrorMessage('');
                  }}
                  className="text-primary hover:underline font-medium"
                  disabled={isLoading}
                >
                  {authMode === 'login' ? '立即注册' : '立即登录'}
                </button>
              </div>

              {/* 分隔线 - 仅登录模式显示 */}
              {authMode === 'login' && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-2 text-[10px] text-muted-foreground">其他方式</span>
                    </div>
                  </div>

                  {/* 返回套餐选择 */}
                  <Button
                    variant="outline"
                    onClick={() => setAuthMode('select')}
                    disabled={isLoading}
                    className="w-full h-9 text-sm"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    购买会员卡密
                  </Button>
                </>
              )}
            </div>
          )}

          {/* 套餐选择（默认视图） */}
          {step === 'select' && authMode === 'select' && (
            <div className="space-y-3">
              {/* 主要操作按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setAuthMode('login')}
                  className="h-11 text-sm"
                >
                  登录
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAuthMode('register')}
                  className="h-11 text-sm"
                >
                  免费注册
                </Button>
              </div>

              {/* 分隔线 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-2 text-[10px] text-muted-foreground">购买会员</span>
                </div>
              </div>

              {/* 套餐选择 - 横向2x2布局 */}
              <div className="grid grid-cols-2 gap-2">
                {plans.filter(p => p.price > 0).map((plan) => (
                  <div
                    key={plan.type}
                    onClick={() => !isLoading && handleSelectPlan(plan)}
                    className={cn(
                      "relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 active:scale-[0.98]",
                      "hover:border-primary hover:shadow-sm",
                      plan.popular ? "border-primary bg-primary/5" : "border-border/50 bg-background/50"
                    )}
                  >
                    {plan.popular && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-medium rounded-full">
                        推荐
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                        plan.type === 'lifetime' ? "bg-rose-500/20" :
                        plan.type === 'yearly' ? "bg-amber-500/20" :
                        plan.type === 'quarterly' ? "bg-blue-500/20" : "bg-green-500/20"
                      )}>
                        {plan.type === 'lifetime' ? (
                          <Infinity className="w-3.5 h-3.5 text-rose-600" />
                        ) : plan.type === 'yearly' ? (
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                        ) : plan.type === 'quarterly' ? (
                          <Gift className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Star className="w-3.5 h-3.5 text-green-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs">{plan.name}</p>
                        <p className="font-bold text-sm text-primary">¥{plan.price}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分隔线 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-2 text-[10px] text-muted-foreground">已有卡密</span>
                </div>
              </div>

              {/* 卡密激活 */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    value={cardKey}
                    onChange={(e) => {
                      handleCardKeyChange(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="h-9 text-xs font-mono bg-background/50"
                    disabled={isLoading}
                  />
                  <Button
                    size="sm"
                    onClick={handleActivate}
                    disabled={isLoading || !cardKey.trim()}
                    className="h-9 px-4 shrink-0"
                  >
                    激活
                  </Button>
                </div>
                {errorMessage && authMode === 'select' && (
                  <div className="flex items-center gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 步骤2：支付 */}
          {step === 'payment' && selectedPlan && (
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="font-semibold text-sm">确认订单</h3>
                <p className="text-[10px] text-muted-foreground">订单号：{orderNo}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedPlan.type === 'lifetime' ? (
                      <Infinity className="w-4 h-4 text-rose-600" />
                    ) : selectedPlan.type === 'yearly' ? (
                      <Crown className="w-4 h-4 text-amber-600" />
                    ) : selectedPlan.type === 'quarterly' ? (
                      <Gift className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Star className="w-4 h-4 text-green-600" />
                    )}
                    <span className="font-medium text-sm">{selectedPlan.name}</span>
                  </div>
                  <span className="font-bold text-lg text-primary">¥{selectedPlan.price}</span>
                </div>
              </div>

              {paymentMethod === 'alipay' ? (
                <Button
                  onClick={() => {
                    if (paymentUrl) {
                      startPollingOrderStatus(orderNo);
                      window.location.href = paymentUrl;
                    }
                  }}
                  disabled={isLoading || !paymentUrl}
                  className="w-full h-9 bg-[#1677FF] hover:bg-[#1677FF]/90 text-sm"
                >
                  支付宝支付
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('select')}
                    disabled={isLoading}
                    className="flex-1 h-9 text-sm"
                  >
                    返回
                  </Button>
                  <Button
                    onClick={handlePayment}
                    disabled={isLoading}
                    className="flex-1 h-9 text-sm"
                  >
                    {isLoading ? '支付中...' : '确认支付'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 步骤3：支付成功 */}
          {step === 'success' && (
            <div className="space-y-3">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="font-semibold text-sm text-green-600">支付成功</h3>
              </div>

              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">您的卡密</p>
                    <p className="font-mono text-sm font-bold tracking-wider">{generatedCardKey}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 w-7 p-0 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                <div className="flex gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700">请保管好卡密，激活后立即失效</p>
                </div>
              </div>

              <Button
                onClick={handleActivateGenerated}
                disabled={isLoading}
                className="w-full h-9 text-sm"
              >
                {isLoading ? '激活中...' : '立即激活'}
              </Button>
            </div>
          )}

          {/* 底部提示 */}
          <p className="text-center text-[10px] text-muted-foreground pt-1">
            Powered by Coze AI
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
