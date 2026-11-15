/**
 * 配额管理服务
 * 用于管理用户配额的扣减、退还和查询
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { MemberTier } from './member-limits';

// 配额类型
export type QuotaType = 'scripts' | 'videos' | 'images' | 'music';

// 配额信息
export interface QuotaInfo {
  total: number;
  used: number;
}

// 用户配额
export interface UserQuotas {
  scripts: QuotaInfo;
  videos: QuotaInfo;
  images: QuotaInfo;
  music: QuotaInfo;
}

// 管理员用户ID列表
const ADMIN_USER_IDS = [
  'admin',
  'dev_user',
  'demo-user',
  'coze_7462288027250219042',
];

// 套餐配额配置
const PLAN_QUOTAS: Record<string, { scripts: number; videos: number; images: number; music: number }> = {
  trial: { scripts: 1, videos: 5, images: 20, music: 5 },
  monthly: { scripts: 5, videos: 300, images: 500, music: 300 },
  quarterly: { scripts: 20, videos: 1350, images: 2000, music: 1350 },
  yearly: { scripts: 125, videos: 6950, images: 10000, music: 6950 },
  admin: { scripts: 999999, videos: 999999, images: 999999, music: 999999 },
};

/**
 * 获取用户配额信息
 */
export async function getUserQuotas(userId: string): Promise<UserQuotas | null> {
  // 管理员返回无限配额
  if (ADMIN_USER_IDS.includes(userId)) {
    return {
      scripts: { total: 999999, used: 0 },
      videos: { total: 999999, used: 0 },
      images: { total: 999999, used: 0 },
      music: { total: 999999, used: 0 },
    };
  }

  const supabase = getSupabaseClient();

  // 查询用户的卡密记录
  const { data: cardRecord, error } = await supabase
    .from('card_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'used')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !cardRecord) {
    // 新用户返回体验卡配额
    const trialQuotas = PLAN_QUOTAS.trial;
    return {
      scripts: { total: trialQuotas.scripts, used: 0 },
      videos: { total: trialQuotas.videos, used: 0 },
      images: { total: trialQuotas.images, used: 0 },
      music: { total: trialQuotas.music, used: 0 },
    };
  }

  // 检查是否过期
  const now = new Date();
  const expiresAt = new Date(cardRecord.expires_at);
  if (now > expiresAt) {
    return null; // 已过期
  }

  // 获取套餐类型
  const planType = cardRecord.plan_type || (
    cardRecord.duration_days >= 365 ? 'yearly' : 
    cardRecord.duration_days >= 90 ? 'quarterly' : 'monthly'
  );

  // 获取套餐基础配额
  const planQuotas = PLAN_QUOTAS[planType] || PLAN_QUOTAS.trial;

  // 获取 metadata 中的配额使用情况和额外配额
  const metadata = (cardRecord.metadata as Record<string, unknown>) || {};
  const storedQuotas = (metadata.quotas as Record<string, QuotaInfo>) || {};

  // 合并基础配额和额外购买的配额
  return {
    scripts: {
      total: planQuotas.scripts + (storedQuotas.scripts?.total || 0),
      used: storedQuotas.scripts?.used || 0,
    },
    videos: {
      total: planQuotas.videos + (storedQuotas.videos?.total || 0),
      used: storedQuotas.videos?.used || 0,
    },
    images: {
      total: planQuotas.images + (storedQuotas.images?.total || 0),
      used: storedQuotas.images?.used || 0,
    },
    music: {
      total: planQuotas.music + (storedQuotas.music?.total || 0),
      used: storedQuotas.music?.used || 0,
    },
  };
}

/**
 * 检查用户是否有足够的配额
 */
export async function checkQuota(
  userId: string,
  type: QuotaType,
  count: number = 1
): Promise<{ hasQuota: boolean; remaining: number; total: number }> {
  const quotas = await getUserQuotas(userId);
  
  if (!quotas) {
    return { hasQuota: false, remaining: 0, total: 0 };
  }

  const quota = quotas[type];
  const remaining = quota.total - quota.used;
  
  return {
    hasQuota: remaining >= count,
    remaining,
    total: quota.total,
  };
}

/**
 * 扣减配额
 */
export async function decrementQuota(
  userId: string,
  type: QuotaType,
  count: number = 1
): Promise<{ success: boolean; error?: string; quotas?: UserQuotas }> {
  // 管理员无需扣减
  if (ADMIN_USER_IDS.includes(userId)) {
    const quotas = await getUserQuotas(userId);
    return { success: true, quotas: quotas || undefined };
  }

  const supabase = getSupabaseClient();

  // 查询用户的卡密记录
  const { data: cardRecord, error: queryError } = await supabase
    .from('card_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'used')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  if (queryError || !cardRecord) {
    return { success: false, error: '未找到用户订阅记录' };
  }

  // 获取当前配额
  const currentQuotas = await getUserQuotas(userId);
  if (!currentQuotas) {
    return { success: false, error: '配额信息获取失败' };
  }

  const quota = currentQuotas[type];
  const remaining = quota.total - quota.used;

  if (remaining < count) {
    return { success: false, error: `${type}配额不足，剩余${remaining}次` };
  }

  // 更新配额使用量
  const metadata = (cardRecord.metadata as Record<string, unknown>) || {};
  const storedQuotas = (metadata.quotas as Record<string, QuotaInfo>) || {
    scripts: { total: 0, used: 0 },
    videos: { total: 0, used: 0 },
    images: { total: 0, used: 0 },
    music: { total: 0, used: 0 },
  };

  // 确保 type 存在
  if (!storedQuotas[type]) {
    storedQuotas[type] = { total: 0, used: 0 };
  }

  storedQuotas[type].used = (storedQuotas[type].used || 0) + count;

  // 更新数据库
  const { error: updateError } = await supabase
    .from('card_keys')
    .update({
      metadata: {
        ...metadata,
        quotas: storedQuotas,
        lastQuotaUpdate: new Date().toISOString(),
      },
    })
    .eq('id', cardRecord.id);

  if (updateError) {
    console.error('[配额扣减] 更新失败:', updateError);
    return { success: false, error: '配额更新失败' };
  }

  // 返回更新后的配额
  const updatedQuotas = await getUserQuotas(userId);
  return { success: true, quotas: updatedQuotas || undefined };
}

/**
 * 退还配额（生成失败时调用）
 */
export async function refundQuota(
  userId: string,
  type: QuotaType,
  count: number = 1
): Promise<{ success: boolean; error?: string; quotas?: UserQuotas }> {
  // 管理员无需退还
  if (ADMIN_USER_IDS.includes(userId)) {
    const quotas = await getUserQuotas(userId);
    return { success: true, quotas: quotas || undefined };
  }

  const supabase = getSupabaseClient();

  // 查询用户的卡密记录
  const { data: cardRecord, error: queryError } = await supabase
    .from('card_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'used')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  if (queryError || !cardRecord) {
    return { success: false, error: '未找到用户订阅记录' };
  }

  // 更新配额使用量（减少 used）
  const metadata = (cardRecord.metadata as Record<string, unknown>) || {};
  const storedQuotas = (metadata.quotas as Record<string, QuotaInfo>) || {
    scripts: { total: 0, used: 0 },
    videos: { total: 0, used: 0 },
    images: { total: 0, used: 0 },
    music: { total: 0, used: 0 },
  };

  // 确保 type 存在
  if (!storedQuotas[type]) {
    storedQuotas[type] = { total: 0, used: 0 };
  }

  // 退还配额（减少 used，但不能小于 0）
  storedQuotas[type].used = Math.max(0, (storedQuotas[type].used || 0) - count);

  // 更新数据库
  const { error: updateError } = await supabase
    .from('card_keys')
    .update({
      metadata: {
        ...metadata,
        quotas: storedQuotas,
        lastQuotaUpdate: new Date().toISOString(),
      },
    })
    .eq('id', cardRecord.id);

  if (updateError) {
    console.error('[配额退还] 更新失败:', updateError);
    return { success: false, error: '配额退还失败' };
  }

  // 返回更新后的配额
  const updatedQuotas = await getUserQuotas(userId);
  return { success: true, quotas: updatedQuotas || undefined };
}

/**
 * 记录使用记录
 */
export async function recordUsage(
  userId: string,
  type: QuotaType,
  action: string,
  cost: number,
  status: 'success' | 'failed' | 'refunded' = 'success',
  detail?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('usage_records').insert({
      user_id: userId,
      type,
      action,
      cost,
      status,
      detail,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[使用记录] 记录失败:', error);
    // 记录失败不影响主流程
  }
}

/**
 * 获取用户会员等级
 * 返回用户的会员等级，用于限制生成参数
 */
export async function getUserMemberTier(userId: string): Promise<MemberTier> {
  // 管理员
  if (ADMIN_USER_IDS.includes(userId)) {
    return 'admin';
  }

  const supabase = getSupabaseClient();

  // 查询用户的卡密记录
  const { data: cardRecord } = await supabase
    .from('card_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'used')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  // 没有订阅记录，返回体验卡等级
  if (!cardRecord) {
    return 'trial';
  }

  // 检查是否过期
  const now = new Date();
  const expiresAt = new Date(cardRecord.expires_at);
  if (now > expiresAt) {
    return 'trial'; // 已过期，降级为体验卡
  }

  // 返回套餐类型
  return (cardRecord.plan_type || (
    cardRecord.duration_days >= 365 ? 'yearly' : 
    cardRecord.duration_days >= 90 ? 'quarterly' : 'monthly'
  )) as MemberTier;
}
