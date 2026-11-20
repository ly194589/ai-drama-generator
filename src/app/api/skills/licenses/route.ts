import { NextRequest, NextResponse } from 'next/server';
import { getSkillById, canUseProSkill } from '@/lib/skill-catalog';
import { claimSkillLicense, listSkillLicenses } from '@/lib/skill-license-store';
import { resolvePlanType } from '@/lib/user-plan';

/** GET /api/skills/licenses - 当前用户的 Skill 授权列表 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    licenses: await listSkillLicenses(userId),
    planType: await resolvePlanType(userId),
  });
}

/** POST /api/skills/licenses - 领取 Skill 授权 { skillId } */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { skillId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误', code: 'INVALID_BODY' }, { status: 400 });
  }

  const skillId = body.skillId;
  if (!skillId) {
    return NextResponse.json({ error: '缺少 skillId', code: 'MISSING_SKILL_ID' }, { status: 400 });
  }

  const skill = getSkillById(skillId);
  if (!skill) {
    return NextResponse.json({ error: 'Skill 不存在', code: 'SKILL_NOT_FOUND' }, { status: 404 });
  }

  const planType = await resolvePlanType(userId);

  if (skill.access === 'pro' && !canUseProSkill(planType)) {
    return NextResponse.json(
      {
        error: '该 Skill 需要年卡、终身卡或管理员权限',
        code: 'PLAN_REQUIRED',
        planType,
      },
      { status: 403 }
    );
  }

  const license = await claimSkillLicense(userId, skillId, planType);
  return NextResponse.json({ success: true, license, planType });
}
