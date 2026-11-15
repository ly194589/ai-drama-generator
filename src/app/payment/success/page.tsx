'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Loader2, Zap, Copy, Key, Gift } from 'lucide-react';
import { toast } from 'sonner';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNo = searchParams.get('orderNo');
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');
  const [durationDays, setDurationDays] = useState<number>(0);
  const [cardKey, setCardKey] = useState<string>('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (!orderNo) {
      setStatus('failed');
      setMessage('订单号不存在');
      return;
    }

    let mounted = true;
    let checkCount = 0;
    const maxChecks = 15;

    const checkStatus = async () => {
      if (!mounted) return;
      checkCount++;

      try {
        const response = await fetch(`/api/payment/confirm?orderNo=${orderNo}`);
        const data = await response.json();
        
        if (data.order?.status === 'paid') {
          if (mounted) {
            setStatus('success');
            setMessage('支付成功！');
            setDurationDays(data.order.durationDays || 1);
            setCardKey(data.order.cardKey || '');
          }
          return;
        }
        
        if (data.order?.status === 'failed') {
          if (mounted) {
            setStatus('failed');
            setMessage('支付失败，请重试');
          }
          return;
        }

        if (checkCount < maxChecks && mounted) {
          setTimeout(checkStatus, 2000);
        } else if (mounted) {
          setStatus('failed');
          setMessage('支付结果确认中，请稍后在个人中心查看');
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
        if (checkCount < maxChecks && mounted) {
          setTimeout(checkStatus, 3000);
        }
      }
    };

    checkStatus();

    return () => {
      mounted = false;
    };
  }, [orderNo]);

  // 复制卡密
  const handleCopyKey = () => {
    navigator.clipboard.writeText(cardKey);
    toast.success('卡密已复制');
  };

  // 激活卡密
  const handleActivate = async () => {
    if (!cardKey) {
      toast.error('卡密不存在');
      return;
    }

    setIsActivating(true);
    try {
      const response = await fetch('/api/auth/card-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || '激活失败');
        return;
      }

      toast.success('激活成功！');
      
      // 保存会员信息到 localStorage
      if (data.subscription?.expiresAt) {
        localStorage.setItem('memberExpiresAt', data.subscription.expiresAt);
        localStorage.setItem('memberPlanName', data.subscription.planName || '会员');
      }
      
      // 跳转到首页
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (error) {
      console.error('激活失败:', error);
      toast.error('激活失败，请稍后重试');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 mx-auto text-blue-400 animate-spin mb-4" />
              <CardTitle className="text-xl text-white">正在确认支付结果...</CardTitle>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="relative">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-400 mb-4" />
                <Gift className="h-6 w-6 absolute top-0 right-1/4 text-pink-400 animate-bounce" />
              </div>
              <CardTitle className="text-xl text-white">支付成功！</CardTitle>
            </>
          )}
          {status === 'failed' && (
            <>
              <XCircle className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
              <CardTitle className="text-xl text-white">支付处理中</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'success' ? (
            <>
              <p className="text-green-300">{message}</p>
              <p className="text-slate-400">会员时长：<span className="text-white font-bold">{durationDays}天</span></p>
              
              {/* 卡密显示和激活 */}
              {cardKey && (
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-3 border border-slate-600">
                  <div className="flex items-center justify-center gap-2 text-slate-300">
                    <Key className="h-4 w-4" />
                    <span className="text-sm">您的专属卡密</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={cardKey}
                      readOnly
                      className="bg-slate-800 border-slate-600 text-center text-lg font-mono tracking-wider text-green-400"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyKey}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button
                    onClick={handleActivate}
                    disabled={isActivating}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-6 text-lg"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        激活中...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        点击激活会员
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {orderNo && (
                <p className="text-slate-500 text-xs">订单号: {orderNo}</p>
              )}
              
              <Button
                variant="ghost"
                onClick={() => router.push('/login')}
                className="w-full text-slate-400 hover:text-white"
              >
                返回登录页
              </Button>
            </>
          ) : status === 'failed' ? (
            <>
              <p className="text-yellow-300">{message}</p>
              {orderNo && (
                <p className="text-slate-500 text-sm">订单号: {orderNo}</p>
              )}
              <div className="pt-4 space-y-3">
                <Button
                  onClick={() => router.push('/')}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  进入首页
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/login')}
                  className="w-full"
                >
                  返回登录
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-300">{message}</p>
              {orderNo && (
                <p className="text-slate-500 text-sm">订单号: {orderNo}</p>
              )}
              <Button
                variant="outline"
                onClick={() => router.push('/login')}
                className="w-full mt-4"
              >
                返回登录
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
