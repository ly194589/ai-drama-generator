/**
 * Skill 授权记录
 *
 * - 优先写入 Supabase（skill_licenses 表，见 sql/create_open_platform_tables.sql）
 * - 未配置数据库或表不存在时回退到 .data/skill-licenses.json（仅开发环境可用）
 *
 * licenseKey 由「用户 + Skill」哈希生成，用于导出内容水印和后续校验。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig } from '@/lib/server-config-store';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'skill-licenses.json');

export interface SkillLicense {
  skillId: string;
  licenseKey: string;
  claimedAt: string;
  planType: string;
}

interface SkillLicenseRow {
  skill_id: string;
  license_key: string;
  claimed_at: string;
  plan_type: string;
}

type StoreShape = Record<string, SkillLicense[]>;

function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
}

function readLocal(): StoreShape {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as StoreShape;
  } catch {
    return {};
  }
}

function writeLocal(store: StoreShape): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[Skill 授权] 写入失败:', error);
  }
}

/** 生成稳定短哈希：同一用户 + 同一 Skill 始终得到同一个授权编号 */
function buildLicenseKey(userId: string, skillId: string): string {
  const digest = createHash('sha256').update(`${userId}:${skillId}`).digest('hex').toUpperCase();
  return `SK-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
}

function toLicense(row: SkillLicenseRow): SkillLicense {
  return {
    skillId: row.skill_id,
    licenseKey: row.license_key,
    claimedAt: row.claimed_at,
    planType: row.plan_type,
  };
}

/** 用户的全部授权 */
export async function listSkillLicenses(userId: string): Promise<SkillLicense[]> {
  if (!userId) return [];

  if (hasDatabaseConfig()) {
    const { data, error } = await getSupabaseClient()
      .from('skill_licenses')
      .select('skill_id,license_key,claimed_at,plan_type')
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });
    if (!error) return ((data || []) as SkillLicenseRow[]).map(toLicense);
    if (!isTableMissing(error)) {
      console.error('[Skill 授权] 查询失败:', error);
      return [];
    }
    console.warn('[Skill 授权] skill_licenses 表不存在，回退本地存储');
  }

  return readLocal()[userId] || [];
}

/** 读取单个 Skill 授权 */
export async function getSkillLicense(userId: string, skillId: string): Promise<SkillLicense | undefined> {
  if (!userId) return undefined;

  if (hasDatabaseConfig()) {
    const { data, error } = await getSupabaseClient()
      .from('skill_licenses')
      .select('skill_id,license_key,claimed_at,plan_type')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .maybeSingle();
    if (!error) return data ? toLicense(data as SkillLicenseRow) : undefined;
    if (!isTableMissing(error)) {
      console.error('[Skill 授权] 查询失败:', error);
      return undefined;
    }
    console.warn('[Skill 授权] skill_licenses 表不存在，回退本地存储');
  }

  return (readLocal()[userId] || []).find(item => item.skillId === skillId);
}

/** 领取授权（幂等：已领取则直接返回原记录） */
export async function claimSkillLicense(
  userId: string,
  skillId: string,
  planType: string
): Promise<SkillLicense> {
  const existing = await getSkillLicense(userId, skillId);
  if (existing) return existing;

  const license: SkillLicense = {
    skillId,
    licenseKey: buildLicenseKey(userId, skillId),
    claimedAt: new Date().toISOString(),
    planType,
  };

  if (hasDatabaseConfig()) {
    const { error } = await getSupabaseClient().from('skill_licenses').insert({
      user_id: userId,
      skill_id: skillId,
      license_key: license.licenseKey,
      plan_type: planType,
      claimed_at: license.claimedAt,
    });
    if (!error) return license;
    // 并发领取时唯一约束冲突，回读已存在记录
    if (error.code === '23505') {
      const raced = await getSkillLicense(userId, skillId);
      if (raced) return raced;
    }
    if (!isTableMissing(error)) {
      console.error('[Skill 授权] 写入失败:', error);
      throw new Error('授权保存失败，请稍后重试');
    }
    console.warn('[Skill 授权] skill_licenses 表不存在，回退本地存储');
  }

  const store = readLocal();
  const list = store[userId] || [];
  list.push(license);
  store[userId] = list;
  writeLocal(store);
  return license;
}
