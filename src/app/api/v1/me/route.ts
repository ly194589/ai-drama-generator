import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-v1';
import { resolvePlanType } from '@/lib/user-plan';
import { listSkillLicenses } from '@/lib/skill-license-store';
import { listApiKeys } from '@/lib/api-key-store';
import { SKILLS } from '@/lib/skill-catalog';

/** GET /api/v1/me - 当前 API Key 对应的账号信息 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const planType = await resolvePlanType(auth.userId);
  const licenses = await listSkillLicenses(auth.userId);
  const maskedKey =
    (await listApiKeys(auth.userId)).find(item => item.id === auth.keyId)?.maskedKey ?? null;

  return NextResponse.json({
    success: true,
    account: { userId: auth.userId, planType },
    skills: { total: SKILLS.length, licensed: licenses.length },
    apiKey: maskedKey,
    rateLimit: { limit: 60, windowSeconds: 60, remaining: auth.remaining },
  });
}
