/**
 * 服务端套餐解析
 *
 * 统一从 card_keys 表读取用户当前有效套餐，供 Skill 授权、开放 API 等场景复用。
 */
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { MemberTier } from '@/lib/member-limits';

export const ADMIN_USER_IDS = ['admin', 'dev_user', 'dev-user', 'demo-user', 'coze_7462288027250219042'];

/** 解析用户当前套餐；管理员返回 admin，无有效订阅返回 trial */
export async function resolvePlanType(userId: string): Promise<MemberTier> {
  if (ADMIN_USER_IDS.includes(userId)) return 'admin';

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('card_keys')
      .select('plan_type, duration_days, expires_at')
      .eq('user_id', userId)
      .eq('status', 'used')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return 'trial';
    if (data.expires_at && new Date(data.expires_at) < new Date()) return 'trial';

    if (data.plan_type) return data.plan_type as MemberTier;

    const days = Number(data.duration_days) || 0;
    if (days >= 36500) return 'lifetime';
    if (days >= 365) return 'yearly';
    if (days >= 90) return 'quarterly';
    return 'monthly';
  } catch (error) {
    console.warn('[套餐解析] 查询失败，按体验卡处理:', error);
    return 'trial';
  }
}
