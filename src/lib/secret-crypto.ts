/**
 * 用户模型 API Key 的加密存储工具
 *
 * - 写入 user_config 前用 AES-256-GCM 加密，格式 `enc:v1:<iv>.<tag>.<cipher>`
 * - 读取时自动解密；历史明文数据（无前缀）原样返回，保证向下兼容
 * - 主密钥优先取 PROVIDER_KEY_SECRET，其次复用 Supabase 密钥，
 *   最后回落到开发默认值（仅用于本地/预览环境）
 */
import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material =
    process.env.PROVIDER_KEY_SECRET ||
    process.env.COZE_SUPABASE_ANON_KEY ||
    'aidrama-local-dev-secret';
  cachedKey = crypto.createHash('sha256').update(material).digest();
  return cachedKey;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** 加密明文密钥；空值或已加密值直接返回 */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (isEncryptedSecret(plain)) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/** 解密存储值；历史明文原样返回，解密失败返回空串并记录告警 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return '';
  if (!isEncryptedSecret(stored)) return stored;

  try {
    const [ivStr, tagStr, dataStr] = stored.slice(PREFIX.length).split('.');
    if (!ivStr || !tagStr || !dataStr) throw new Error('密文格式不正确');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivStr, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagStr, 'base64url'));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataStr, 'base64url')), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    console.warn('[密钥] 解密失败，请在模型设置中重新填写该 API Key');
    return '';
  }
}
