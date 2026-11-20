'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  created_at?: string;
  coze_user_id?: string;
}

interface Subscription {
  planType: string;
  planName: string;
  activatedAt: string;
  expiresAt: string;
  remainingDays: number;
  durationDays: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  oauthProvider?: string | null;
  subscription: Subscription | null;
  isAdmin: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    authenticated: false,
    oauthProvider: null,
    subscription: null,
    isAdmin: false,
  });

  // 获取当前用户信息
  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const oauthProvider = localStorage.getItem('oauth_provider');
      
      if (!token && oauthProvider !== 'card_key' && oauthProvider !== 'password') {
        setState({ 
          user: null, 
          loading: false, 
          authenticated: false, 
          oauthProvider: null,
          subscription: null,
          isAdmin: false,
        });
        return;
      }

      // 卡密用户
      if (oauthProvider === 'card_key' || oauthProvider === 'password') {
        const userStr = localStorage.getItem('user');
        const subscriptionStr = localStorage.getItem('subscription');
        
        if (userStr) {
          const user = JSON.parse(userStr);
          const subscription = subscriptionStr ? JSON.parse(subscriptionStr) : null;
          
          // 检查是否是管理员（通过user.id或user.isAdmin字段）
          const adminUsers = ['dev_user', 'admin', 'demo-user'];
          const isAdmin = user.isAdmin === true || adminUsers.includes(user.id);
          
          setState({
            user,
            loading: false,
            authenticated: true,
            oauthProvider: oauthProvider,
            subscription,
            isAdmin,
          });

          // 如果不是管理员，刷新订阅信息
          if (!isAdmin) {
            refreshSubscription(user.id);
          }
          return;
        }
      }

      // 如果是扣子 OAuth 用户，从本地存储获取用户信息
      if (oauthProvider === 'coze') {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setState({
            user,
            loading: false,
            authenticated: true,
            oauthProvider: 'coze',
            subscription: null,
            isAdmin: false,
          });
          return;
        }
      }

      // Supabase Auth 用户，从 API 获取
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setState({
          user: data.user,
          loading: false,
          authenticated: true,
          oauthProvider: null,
          subscription: null,
          isAdmin: false,
        });
      } else {
        // Token 无效，尝试刷新
        await refreshAccessToken();
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      setState({ 
        user: null, 
        loading: false, 
        authenticated: false, 
        oauthProvider: null,
        subscription: null,
        isAdmin: false,
      });
    }
  }, []);

  // 刷新订阅信息
  const refreshSubscription = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/subscription?userId=${userId}`);
      const data = await response.json();

      if (data.authorized && data.subscription) {
        localStorage.setItem('subscription', JSON.stringify(data.subscription));
        setState(prev => ({
          ...prev,
          subscription: data.subscription,
        }));
      }
    } catch (error) {
      console.error('刷新订阅信息失败:', error);
    }
  }, []);

  // 刷新 Access Token
  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        setState({ 
          user: null, 
          loading: false, 
          authenticated: false,
          subscription: null,
          isAdmin: false,
        });
        return;
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('access_token', data.session.access_token);
        localStorage.setItem('refresh_token', data.session.refresh_token);
        setState({
          user: data.user,
          loading: false,
          authenticated: true,
          subscription: null,
          isAdmin: false,
        });
      } else {
        // 刷新失败，清除登录状态
        logout();
      }
    } catch (error) {
      console.error('刷新 Token 失败:', error);
      logout();
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      // 清理所有认证相关的存储
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('oauth_provider');
      localStorage.removeItem('session');
      localStorage.removeItem('subscription');
      setState({ 
        user: null, 
        loading: false, 
        authenticated: false, 
        oauthProvider: null,
        subscription: null,
        isAdmin: false,
      });
      router.push('/login');
    }
  }, [router]);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('access_token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setState({
        user: data.user,
        loading: false,
        authenticated: true,
        subscription: null,
        isAdmin: false,
      });
      return { success: true };
    }

    return { success: false, error: data.error };
  }, []);

  // 注册
  const register = useCallback(async (email: string, password: string, name?: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();

    if (data.success) {
      // 如果有 session（邮箱验证已关闭），直接登录
      if (data.session) {
        localStorage.setItem('access_token', data.session.access_token);
        localStorage.setItem('refresh_token', data.session.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setState({
          user: data.user,
          loading: false,
          authenticated: true,
          subscription: null,
          isAdmin: false,
        });
      }
      return { success: true, needsVerification: !data.session };
    }

    return { success: false, error: data.error };
  }, []);

  // 获取带认证的请求头
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // 发送带认证的请求
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = getAuthHeaders();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...headers,
      },
    });
  }, [getAuthHeaders]);

  // 初始化时获取用户信息
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    ...state,
    login,
    register,
    logout,
    refreshAccessToken,
    refreshSubscription,
    getAuthHeaders,
    authFetch,
    // 检查是否是扣子 OAuth 用户
    isCozeUser: state.oauthProvider === 'coze',
    // 检查是否是卡密用户
    isCardKeyUser: state.oauthProvider === 'card_key' || state.oauthProvider === 'password',
  };
}
