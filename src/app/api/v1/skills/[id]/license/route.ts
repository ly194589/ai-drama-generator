import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, apiError } from '@/lib/api-v1';
import { resolvePlanType } from '@/lib/user-plan';
import { canUseProSkill, getSkillById } from '@/lib/skill-catalog';
import { claimSkillLicense } from '@/lib/skill-license-store';

/**
 * POST /api/v1/skills/{id}/license
 * 通过 API Key 领取 Skill 授权（幂等）
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const skill = getSkillById(id);
  if (!skill) {
    return apiError(404, 'SKILL_NOT_FOUND', 'Skill 不存在');
  }

  const planType = await resolvePlanType(auth.userId);
  if (skill.access === 'pro' && !canUseProSkill(planType)) {
    return apiError(403, 'PLAN_REQUIRED', '该 Skill 需要年卡、终身卡或管理员权限');
  }

  const license = await claimSkillLicense(auth.userId, skill.id, planType);
  return NextResponse.json({ success: true, license });
}
