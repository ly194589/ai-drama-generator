/**
 * 开放 API 限流（内存令牌桶）
 *
 * 每个 API Key 独立计数，默认 60 次/分钟，进程重启后重置。
 * 单实例部署足够；多实例部署时应替换为 Redis 等共享存储。
 */
const CAPACITY = 60;
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 5000;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function consumeRateLimit(keyId: string): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [id, bucket] of buckets) {
      if (now - bucket.updatedAt > WINDOW_MS) buckets.delete(id);
    }
  }

  const bucket = buckets.get(keyId) ?? { tokens: CAPACITY, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / WINDOW_MS) * CAPACITY;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + refill);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(keyId, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((1 - bucket.tokens) * (WINDOW_MS / 1000) / CAPACITY)),
    };
  }

  bucket.tokens -= 1;
  buckets.set(keyId, bucket);
  return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
}
