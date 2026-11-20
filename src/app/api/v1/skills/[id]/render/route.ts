import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, apiError } from '@/lib/api-v1';
import { resolvePlanType } from '@/lib/user-plan';
import { canUseProSkill, getSkillById } from '@/lib/skill-catalog';
import { fillTemplate, getSkillContent } from '@/lib/skill-content';
import { getSkillLicense } from '@/lib/skill-license-store';

/**
 * POST /api/v1/skills/{id}/render
 * Body: { params?: Record<string, string | number> }
 * 用参数渲染 Skill 的 Prompt、分镜规则与套用数据。
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const skill = getSkillById(id);
  if (!skill) {
    return apiError(404, 'SKILL_NOT_FOUND', 'Skill 不存在');
  }

  if (skill.access === 'pro') {
    const planType = await resolvePlanType(auth.userId);
    if (!canUseProSkill(planType)) {
      return apiError(403, 'PLAN_REQUIRED', '该 Skill 需要年卡、终身卡或管理员权限');
    }
  }

  // 与页面规则保持一致：必须先在 Skill 市场领取授权
  const license = await getSkillLicense(auth.userId, skill.id);
  if (!license) {
    return apiError(403, 'LICENSE_REQUIRED', '请先调用 POST /api/v1/skills/{id}/license 领取授权');
  }

  const content = getSkillContent(skill.id);
  if (!content) {
    return apiError(500, 'SKILL_CONTENT_MISSING', 'Skill 内容缺失，请联系管理员');
  }

  let input: Record<string, string | number> = {};
  try {
    const body = (await request.json()) as { params?: Record<string, string | number> };
    if (body?.params && typeof body.params === 'object') input = body.params;
  } catch {
    // 允许空请求体，使用默认参数
  }

  const merged: Record<string, string | number> = {};
  for (const param of skill.params) {
    const value = input[param.key];
    merged[param.key] = value === undefined || value === null || value === '' ? (param.defaultValue ?? '') : value;
  }

  return NextResponse.json({
    success: true,
    data: {
      skill: { id: skill.id, name: skill.name, access: skill.access },
      params: merged,
      prompt: fillTemplate(content.promptTemplate, merged),
      storyboardRules: content.storyboardRules,
      series: skill.apply(merged),
    },
    license: { licenseKey: license.licenseKey, claimedAt: license.claimedAt },
  });
}
