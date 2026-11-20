import { NextRequest, NextResponse } from 'next/server';
import { getSkillById, type SkillInput } from '@/lib/skill-catalog';
import { fillTemplate, getSkillContent } from '@/lib/skill-content';
import { getSkillLicense } from '@/lib/skill-license-store';

/**
 * POST /api/skills/[id]/content
 * 用参数渲染 Skill 的 Prompt 与分镜规则。
 * 仅对已领取授权的账号下发正文，避免付费内容进入前端包。
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;
  const skill = getSkillById(id);
  if (!skill) {
    return NextResponse.json({ error: 'Skill 不存在', code: 'SKILL_NOT_FOUND' }, { status: 404 });
  }

  const license = await getSkillLicense(userId, skill.id);
  if (!license) {
    return NextResponse.json(
      { error: '请先领取该 Skill 授权', code: 'LICENSE_REQUIRED' },
      { status: 403 }
    );
  }

  const content = getSkillContent(skill.id);
  if (!content) {
    return NextResponse.json({ error: 'Skill 内容缺失', code: 'SKILL_CONTENT_MISSING' }, { status: 500 });
  }

  let input: SkillInput = {};
  try {
    const body = (await request.json()) as { params?: SkillInput };
    if (body?.params && typeof body.params === 'object') input = body.params;
  } catch {
    // 允许空请求体，使用参数默认值
  }

  // 只接受 Skill 声明过的参数，并补齐默认值
  const merged: SkillInput = {};
  for (const param of skill.params) {
    const value = input[param.key];
    merged[param.key] = value === undefined || value === null || value === '' ? (param.defaultValue ?? '') : value;
  }

  return NextResponse.json({
    success: true,
    data: {
      prompt: fillTemplate(content.promptTemplate, merged),
      storyboardRules: content.storyboardRules,
      params: merged,
    },
    license: { licenseKey: license.licenseKey, claimedAt: license.claimedAt },
  });
}
