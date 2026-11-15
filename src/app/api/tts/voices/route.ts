import { NextResponse } from 'next/server';
import { 
  TTS_SPEAKERS, 
  getTTSSpeakersByCategory, 
  getTTSSpeakersByGender,
  getRecommendedFemaleVoices,
  getRecommendedMaleVoices,
  getRecommendedVoicesForRole,
} from '@/lib/config';

/**
 * GET: 获取所有可用的 TTS 音色列表
 * 
 * 查询参数：
 * - category: 按类别筛选 (general | video | roleplay | audiobook | zhipu)
 * - gender: 按性别筛选 (male | female)
 * - roleType: 按角色类型筛选 (protagonist | supporting | mystery | extra)
 * - recommended: 只返回推荐的音色 (true | false)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const gender = searchParams.get('gender') as 'male' | 'female' | null;
  const roleType = searchParams.get('roleType') as 'protagonist' | 'supporting' | 'mystery' | 'extra' | null;
  const recommended = searchParams.get('recommended');

  // 根据参数筛选音色
  let voices;
  
  if (category) {
    voices = getTTSSpeakersByCategory(category);
  } else if (gender) {
    voices = getTTSSpeakersByGender(gender);
  } else if (roleType) {
    voices = getRecommendedVoicesForRole(roleType);
  } else if (recommended === 'true') {
    // 返回所有推荐的音色
    voices = [
      ...getRecommendedFemaleVoices(),
      ...getRecommendedMaleVoices(),
    ];
  } else {
    // 返回所有音色
    voices = Object.values(TTS_SPEAKERS);
  }

  // 过滤掉不可用的音色
  voices = voices.filter(v => {
    const voice = v as Record<string, unknown>;
    if ('available' in voice && voice.available === false) {
      return false;
    }
    return true;
  });

  // 按类别分组
  const groupedVoices = {
    general: voices.filter(v => v.category === 'general'),
    video: voices.filter(v => v.category === 'video'),
    roleplay: voices.filter(v => v.category === 'roleplay'),
    audiobook: voices.filter(v => v.category === 'audiobook'),
    zhipu: voices.filter(v => v.category === 'zhipu'),
    special: voices.filter(v => v.category === 'special'),
  };

  // 推荐音色（快速选择）
  const quickSelect = {
    female: getRecommendedFemaleVoices().filter(v => {
      const voice = v as Record<string, unknown>;
      return !('available' in voice) || voice.available !== false;
    }),
    male: getRecommendedMaleVoices().filter(v => {
      const voice = v as Record<string, unknown>;
      return !('available' in voice) || voice.available !== false;
    }),
  };

  return NextResponse.json({
    success: true,
    voices,
    grouped: groupedVoices,
    quickSelect,
    total: voices.length,
    categories: ['general', 'video', 'roleplay', 'audiobook', 'zhipu', 'special'],
  });
}
