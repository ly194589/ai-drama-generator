import type { NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'ai_drama_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function isAuthSessionConfigured(): boolean {
  const secret = process.env.AUTH_SESSION_SECRET;
  return Boolean(secret && secret.length >= 32 && !/[<>]/.test(secret));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!isAuthSessionConfigured() || !secret) {
    throw new Error('AUTH_SESSION_SECRET must be configured with at least 32 characters');
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSessionToken(userId: string, expiresAt?: string | Date): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const subscriptionExpiry = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : now + SESSION_MAX_AGE_SECONDS;
  const exp = Math.min(now + SESSION_MAX_AGE_SECONDS, subscriptionExpiry);
  if (!Number.isFinite(exp) || exp <= now) throw new Error('Cannot create a session for an expired account');
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({
    sub: userId,
    iat: now,
    exp,
  })));
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function signAuthState(payload: Record<string, unknown>): Promise<string> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!isAuthSessionConfigured() || !secret) throw new Error('OAuth state signing is not configured');
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function verifyAuthState<T extends Record<string, unknown>>(token: string): Promise<T | null> {
  const [version, ivText, ciphertextText, extra] = token.split('.');
  if (version !== 'v1' || !ivText || !ciphertextText || extra) return null;
  try {
    const secret = process.env.AUTH_SESSION_SECRET;
    if (!isAuthSessionConfigured() || !secret) return null;
    const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64Url(ivText)) }, key, toArrayBuffer(fromBase64Url(ciphertextText)),
    );
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as T;
    const now = Date.now();
    if (typeof decoded.timestamp !== 'number' || decoded.timestamp > now + 60_000 || now - decoded.timestamp > 10 * 60 * 1000) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getSigningKey(),
      toArrayBuffer(fromBase64Url(signature)),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { sub?: unknown; exp?: unknown };
    if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) {
      return null;
    }
    return claims.sub;
  } catch {
    return null;
  }
}

export async function setSessionCookie(response: NextResponse, userId: string, expiresAt?: string | Date): Promise<NextResponse> {
  const maxAge = expiresAt
    ? Math.min(SESSION_MAX_AGE_SECONDS, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : SESSION_MAX_AGE_SECONDS;
  response.cookies.set(AUTH_COOKIE_NAME, await createSessionToken(userId, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
