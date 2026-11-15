'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SubscriptionInfo {
  planType: string;
  planName?: string;
  activatedAt: string;
  expiresAt: string;
  remainingDays: number;
  durationDays: number;
}

interface AuthState {
  isAuthorized: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  subscription: SubscriptionInfo | null;
  error: string | null;
  expired: boolean;
}

/**
 * 用户授权验证 Hook
 * 
 * 检查用户是否已授权使用系统
 * - 未授权或过期自动跳转到登录页
 * - 管理员账号直接放行
 */
export function useSubscription(required: boolean = true): AuthState & { checkAuth: () => Promise<void> } {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    isAuthorized: false,
    isAdmin: false,
    isLoading: false, // 初始为 false，避免 SSR 时的加载状态
    subscription: null,
    error: null,
    expired: false,
  });
  const [mounted, setMounted] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      // 从 localStorage 获取用户信息
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        setState(prev => ({ ...prev, isLoading: false, isAuthorized: false }));
        if (required) {
          router.push('/login');
        }
        return;
      }

      const user = JSON.parse(userStr);
      const userId = user.id;

      // 检查订阅状态
      const response = await fetch(`/api/auth/subscription?userId=${userId}`);
      const data = await response.json();

      if (!response.ok || !data.authorized) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isAuthorized: false,
          error: data.error || '未授权',
          expired: data.expired || false,
        }));
        
        if (required) {
          // 清除本地存储
          localStorage.removeItem('user');
          localStorage.removeItem('subscription');
          // 跳转到登录页
          router.push('/login?expired=true');
        }
        return;
      }

      // 授权成功
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthorized: true,
        isAdmin: data.isAdmin || false,
        subscription: data.subscription || null,
        error: null,
        expired: false,
      }));

      // 更新本地订阅信息
      if (data.subscription) {
        localStorage.setItem('subscription', JSON.stringify(data.subscription));
      }

    } catch (error) {
      console.error('[授权检查] 失败:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthorized: false,
        error: '检查授权失败',
      }));
      
      if (required) {
        router.push('/login');
      }
    }
  }, [router, required]);

  // 客户端挂载后才检查授权
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    checkAuth();
  }, [checkAuth]);

  return { ...state, checkAuth };
}
