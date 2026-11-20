/**
 * 平台 API Key 管理
 *
 * - 明文 Key 只在创建时返回一次，服务端仅保存 SHA-256 哈希与掩码
 * - 优先写入 Supabase（api_keys 表，见 sql/create_open_platform_tables.sql）
 * - 未配置数据库或表不存在时回退到 .data/api-keys.json（仅开发环境可用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig } from '@/lib/server-config-store';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'api-keys.json');

/** 单用户最多保留的 Key 数量 */
export const MAX_API_KEYS = 5;

export interface ApiKeyRecord {
  id: string;
  name: string;
  /** 展示用掩码，如 sk_live_ab12****cd34 */
  maskedKey: string;
  /** SHA-256 哈希，用于鉴权比对 */
  hash: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface ApiKeyRow {
  id: string;
  name: string;
  masked_key: string;
  created_at: string;
  last_used_at: string | null;
}

type StoreShape = Record<string, ApiKeyRecord[]>;

/** Supabase 表未创建时用于降级判断 */
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
    console.warn('[API Key] 写入失败:', error);
  }
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function maskKey(key: string): string {
  return `${key.slice(0, 12)}****${key.slice(-4)}`;
}

function toSafeRecord(row: ApiKeyRow): Omit<ApiKeyRecord, 'hash'> {
  return {
    id: row.id,
    name: row.name,
    maskedKey: row.masked_key,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || undefined,
  };
}

/** 用户的 Key 列表（不含明文与哈希） */
export async function listApiKeys(userId: string): Promise<Omit<ApiKeyRecord, 'hash'>[]> {
  if (!userId) return [];

  if (hasDatabaseConfig()) {
    const { data, error } = await getSupabaseClient()
      .from('api_keys')
      .select('id,name,masked_key,created_at,last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error) return ((data || []) as ApiKeyRow[]).map(toSafeRecord);
    if (!isTableMissing(error)) {
      console.error('[API Key] 查询失败:', error);
      return [];
    }
    console.warn('[API Key] api_keys 表不存在，回退本地存储');
  }

  return (readLocal()[userId] || []).map(({ hash: _hash, ...rest }) => rest);
}

/**
 * 创建 Key，返回明文（仅此一次）
 * 超过上限时自动淘汰最早创建的 Key，并通过 evictedCount 告知调用方
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<{ record: Omit<ApiKeyRecord, 'hash'>; plaintext: string; evictedCount: number }> {
  const plaintext = `sk_live_${randomBytes(24).toString('hex')}`;
  const now = new Date().toISOString();
  const record: ApiKeyRecord = {
    id: randomBytes(8).toString('hex'),
    name: name || '默认 Key',
    maskedKey: maskKey(plaintext),
    hash: hashKey(plaintext),
    createdAt: now,
  };

  if (hasDatabaseConfig()) {
    const supabase = getSupabaseClient();
    let evictedCount = 0;

    const { count } = await supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (typeof count === 'number' && count >= MAX_API_KEYS) {
      const overflow = count - MAX_API_KEYS + 1;
      const { data: oldest } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(overflow);
      const ids = ((oldest || []) as { id: string }[]).map(item => item.id);
      if (ids.length) {
        await supabase.from('api_keys').delete().eq('user_id', userId).in('id', ids);
        evictedCount = ids.length;
      }
    }

    const { error } = await supabase.from('api_keys').insert({
      user_id: userId,
      name: record.name,
      key_hash: record.hash,
      masked_key: record.maskedKey,
      created_at: now,
    });
    if (!error) {
      const { hash: _hash, ...safe } = record;
      return { record: safe, plaintext, evictedCount };
    }
    if (!isTableMissing(error)) {
      console.error('[API Key] 创建失败:', error);
      throw new Error('API Key 创建失败，请稍后重试');
    }
    console.warn('[API Key] api_keys 表不存在，回退本地存储');
  }

  const store = readLocal();
  const list = store[userId] || [];
  list.push(record);
  const trimmed = list.slice(-MAX_API_KEYS);
  store[userId] = trimmed;
  writeLocal(store);

  const { hash: _hash, ...safe } = record;
  return { record: safe, plaintext, evictedCount: list.length - trimmed.length };
}

/** 吊销 Key */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  if (hasDatabaseConfig()) {
    const { data, error } = await getSupabaseClient()
      .from('api_keys')
      .delete()
      .eq('user_id', userId)
      .eq('id', keyId)
      .select('id');
    if (!error) return ((data || []) as { id: string }[]).length > 0;
    if (!isTableMissing(error)) {
      console.error('[API Key] 吊销失败:', error);
      return false;
    }
    console.warn('[API Key] api_keys 表不存在，回退本地存储');
  }

  const store = readLocal();
  const list = store[userId] || [];
  const next = list.filter(item => item.id !== keyId);
  if (next.length === list.length) return false;
  store[userId] = next;
  writeLocal(store);
  return true;
}

/** 上次使用时间的写库间隔（避免每次调用都写库） */
const LAST_USED_THROTTLE_MS = 60_000;

/** 用明文 Key 反查用户，并按节流更新最近使用时间 */
export async function resolveApiKey(plaintext: string): Promise<{ userId: string; keyId: string } | null> {
  if (!plaintext) return null;
  const target = hashKey(plaintext);

  if (hasDatabaseConfig()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('id,user_id,last_used_at')
      .eq('key_hash', target)
      .maybeSingle();

    if (!error) {
      const row = data as { id: string; user_id: string; last_used_at: string | null } | null;
      if (!row) return null;
      const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
      if (Date.now() - last > LAST_USED_THROTTLE_MS) {
        await supabase
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', row.id);
      }
      return { userId: row.user_id, keyId: row.id };
    }
    if (!isTableMissing(error)) {
      console.error('[API Key] 鉴权查询失败:', error);
      return null;
    }
    console.warn('[API Key] api_keys 表不存在，回退本地存储');
  }

  const store = readLocal();
  for (const [userId, list] of Object.entries(store)) {
    const hit = list.find(item => item.hash === target);
    if (hit) {
      const last = hit.lastUsedAt ? new Date(hit.lastUsedAt).getTime() : 0;
      if (Date.now() - last > LAST_USED_THROTTLE_MS) {
        hit.lastUsedAt = new Date().toISOString();
        writeLocal(store);
      }
      return { userId, keyId: hit.id };
    }
  }
  return null;
}
