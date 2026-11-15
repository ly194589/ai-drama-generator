/**
 * 用户扣子Token管理工具
 * 
 * 用于获取和管理用户的扣子账号Token
 * 每个用户使用自己的扣子账号调用API，实现Token隔离
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { NextRequest } from 'next/server';

/**
 * 用户Token信息
 */
export interface UserTokenInfo {
  userId: string;
  cozeUserId?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  isAdmin: boolean;
}

/**
 * 管理员用户ID列表
 * 这些用户使用系统级别的Token，不受限制
 */
const ADMIN_USER_IDS = [
  'admin',
  'dev_user',
  'demo-user',
  'coze_7462288027250219042', // 扣子管理员账号
];

/**
 * 从请求头获取用户ID
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  // 优先从自定义请求头获取
  const userId = request.headers.get('x-user-id');
  if (userId && userId !== 'dev-user') {
    return userId;
  }
  
  // 尝试从Authorization头获取
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
      return payload.user_id || payload.sub;
    } catch {
      // ignore
    }
  }
  
  return null;
}

/**
 * 从数据库获取用户的扣子Token
 */
export async function getUserCozeToken(userId: string): Promise<UserTokenInfo | null> {
  if (!userId) {
    return null;
  }
  
  const supabase = getSupabaseClient();
  
  // 查询用户配置
  const { data: userConfig, error } = await supabase
    .from('user_config')
    .select('user_id, coze_user_id, coze_access_token, coze_refresh_token, coze_token_expires_at')
    .eq('user_id', userId)
    .single();
  
  if (error || !userConfig) {
    console.error('[UserToken] 获取用户Token失败:', error);
    return null;
  }
  
  // 检查是否是管理员
  const isAdmin = ADMIN_USER_IDS.includes(userId) || 
    ADMIN_USER_IDS.includes(userConfig.coze_user_id || '');
  
  // 如果没有扣子Token，返回null
  if (!userConfig.coze_access_token) {
    console.log('[UserToken] 用户没有扣子Token:', userId);
    return {
      userId,
      cozeUserId: userConfig.coze_user_id,
      accessToken: '',
      isAdmin,
    };
  }
  
  return {
    userId,
    cozeUserId: userConfig.coze_user_id,
    accessToken: userConfig.coze_access_token,
    refreshToken: userConfig.coze_refresh_token || undefined,
    expiresAt: userConfig.coze_token_expires_at 
      ? new Date(userConfig.coze_token_expires_at) 
      : undefined,
    isAdmin,
  };
}

/**
 * 刷新用户的扣子Token
 */
export async function refreshUserCozeToken(
  userId: string, 
  refreshToken: string
): Promise<string | null> {
  try {
    // 获取用户的OAuth配置
    const supabase = getSupabaseClient();
    const { data: userConfig } = await supabase
      .from('user_config')
      .select('coze_user_id')
      .eq('user_id', userId)
      .single();
    
    if (!userConfig) {
      return null;
    }
    
    // 调用扣子OAuth刷新Token
    const response = await fetch('https://api.coze.cn/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });
    
    if (!response.ok) {
      console.error('[UserToken] 刷新Token失败:', await response.text());
      return null;
    }
    
    const tokenData = await response.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    
    // 更新数据库
    await supabase
      .from('user_config')
      .update({
        coze_access_token: access_token,
        coze_refresh_token: refresh_token,
        coze_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    
    return access_token;
  } catch (error) {
    console.error('[UserToken] 刷新Token异常:', error);
    return null;
  }
}

/**
 * 获取有效的用户Token（自动刷新过期的Token）
 */
export async function getValidUserToken(userId: string): Promise<string | null> {
  const tokenInfo = await getUserCozeToken(userId);
  
  if (!tokenInfo) {
    return null;
  }
  
  // 管理员返回空，使用系统默认Token
  if (tokenInfo.isAdmin) {
    return null;
  }
  
  // 检查Token是否存在
  if (!tokenInfo.accessToken) {
    return null;
  }
  
  // 检查Token是否过期
  if (tokenInfo.expiresAt && tokenInfo.expiresAt < new Date()) {
    console.log('[UserToken] Token已过期，尝试刷新:', userId);
    
    if (tokenInfo.refreshToken) {
      const newToken = await refreshUserCozeToken(userId, tokenInfo.refreshToken);
      if (newToken) {
        return newToken;
      }
    }
    
    // 刷新失败，返回null
    return null;
  }
  
  return tokenInfo.accessToken;
}

/**
 * 从请求获取用户Token信息的便捷函数
 */
export async function getUserTokenFromRequest(
  request: NextRequest
): Promise<UserTokenInfo | null> {
  const userId = getUserIdFromRequest(request);
  
  if (!userId) {
    return null;
  }
  
  return getUserCozeToken(userId);
}
