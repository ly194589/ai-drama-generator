import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-v1';
import { SKILLS } from '@/lib/skill-catalog';
import { listSkillLicenses } from '@/lib/skill-license-store';

/** GET /api/v1/skills - Skill 目录（不含 Prompt 正文） */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const licensedIds = new Set((await listSkillLicenses(auth.userId)).map(item => item.skillId));

  return NextResponse.json({
    success: true,
    data: SKILLS.map(skill => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      access: skill.access,
      summary: skill.summary,
      tags: skill.tags,
      licensed: licensedIds.has(skill.id),
      /** 调用 render 前需先通过 POST /api/v1/skills/{id}/license 领取授权 */
      requiresLicense: true,
      params: skill.params,
    })),
  });
}
