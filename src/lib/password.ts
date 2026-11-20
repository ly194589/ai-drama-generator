import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 310_000;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: unknown): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (typeof storedHash !== 'string') return { valid: false, needsUpgrade: false };

  if (storedHash.startsWith('pbkdf2$')) {
    const [, iterationsText, saltText, expectedText] = storedHash.split('$');
    const iterations = Number(iterationsText);
    if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !saltText || !expectedText) {
      return { valid: false, needsUpgrade: false };
    }
    try {
      const salt = Buffer.from(saltText, 'base64url');
      const expected = Buffer.from(expectedText, 'base64url');
      const actual = await pbkdf2Async(password, salt, iterations, expected.length, 'sha256');
      return { valid: expected.length === actual.length && timingSafeEqual(expected, actual), needsUpgrade: false };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // Existing accounts used a reversible legacy encoding. Verify it once, then upgrade on login.
  const legacyValue = Buffer.from(password + (process.env.PASSWORD_SALT || 'ai-drama-salt')).toString('base64');
  const legacyBytes = Buffer.from(legacyValue);
  const storedBytes = Buffer.from(storedHash);
  const valid = legacyBytes.length === storedBytes.length && timingSafeEqual(legacyBytes, storedBytes);
  return { valid, needsUpgrade: valid };
}
