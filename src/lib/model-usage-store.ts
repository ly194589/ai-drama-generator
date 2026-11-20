/**
 * 按模型统计调用次数（仅统计，不参与计费或额度扣减）
 *
 * - 优先写入 Supabase（model_usage 表，见 sql/create_open_platform_tables.sql）
 * - 未配置数据库或表不存在时回退到 .data/model-usage.json（仅开发环境可用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig } from '@/lib/server-config-store';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'model-usage.json');

export interface ModelUsageEntry {
  provider: string;
  model: string;
  count: number;
  lastUsedAt: string;
}

interface ModelUsageRow {
  provider: string;
  model: string;
  count: number;
  last_used_at: string;
}

type StoreShape = Record<string, ModelUsageEntry[]>;

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
    console.warn('[用量统计] 写入失败:', error);
  }
}

/** 记录一次成功调用（按 用户 + 厂商 + 模型 累加） */
export async function recordModelUsage(userId: string, provider: string, model: string): Promise<void> {
  if (!userId) return;
  const modelName = model || 'default';
  const now = new Date().toISOString();

  if (hasDatabaseConfig()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('model_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('model', modelName)
      .maybeSingle();

    if (!error) {
      const current = (data as { count: number } | null)?.count;
      if (typeof current === 'number') {
        await supabase
          .from('model_usage')
          .update({ count: current + 1, last_used_at: now })
          .eq('user_id', userId)
          .eq('provider', provider)
          .eq('model', modelName);
      } else {
        const { error: insertError } = await supabase.from('model_usage').insert({
          user_id: userId,
          provider,
          model: modelName,
          count: 1,
          last_used_at: now,
        });
        if (insertError && insertError.code !== '23505') {
          console.warn('[用量统计] 写入失败:', insertError.message);
        }
      }
      return;
    }
    if (!isTableMissing(error)) {
      console.warn('[用量统计] 写入失败:', error.message);
      return;
    }
    console.warn('[用量统计] model_usage 表不存在，回退本地存储');
  }

  const store = readLocal();
  const list = store[userId] || [];
  const entry = list.find(item => item.provider === provider && item.model === modelName);
  if (entry) {
    entry.count += 1;
    entry.lastUsedAt = now;
  } else {
    list.push({ provider, model: modelName, count: 1, lastUsedAt: now });
  }
  store[userId] = list;
  writeLocal(store);
}

/** 读取用户的按模型用量，按调用次数倒序 */
export async function getModelUsage(userId: string): Promise<ModelUsageEntry[]> {
  if (!userId) return [];

  if (hasDatabaseConfig()) {
    const { data, error } = await getSupabaseClient()
      .from('model_usage')
      .select('provider,model,count,last_used_at')
      .eq('user_id', userId)
      .order('count', { ascending: false })
      .limit(100);
    if (!error) {
      return ((data || []) as ModelUsageRow[]).map(row => ({
        provider: row.provider,
        model: row.model,
        count: row.count,
        lastUsedAt: row.last_used_at,
      }));
    }
    if (!isTableMissing(error)) {
      console.error('[用量统计] 查询失败:', error);
      return [];
    }
    console.warn('[用量统计] model_usage 表不存在，回退本地存储');
  }

  const list = readLocal()[userId] || [];
  return [...list].sort((a, b) => b.count - a.count);
}
