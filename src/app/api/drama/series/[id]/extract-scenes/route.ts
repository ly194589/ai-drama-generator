import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 从大纲提取场景信息 API
 * 
 * 用于在生成大纲后，提取剧本中的主要场景
 * 为后续生成场景照做准备
 * 
 * 场景类型：
 * - fixed: 固定场景（剧中反复出现的主要场景，如主角家、公司等）
 * - common: 常见场景（非固定但常见的场景类型，如咖啡馆、医院、酒店等）
 * - special: 特殊场景（特定剧情需要的独特场景，如密室、古墓等）
 * - transition: 过渡场景（用于转场的场景，如街道、车内等）
 */export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      console.error('查询剧本失败:', seriesError);
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    // 分开查询大纲
    const { data: outlines, error: outlinesError } = await supabase
      .from('drama_outlines')
      .select('*')
      .eq('series_id', id)
      .order('order', { ascending: true });

    if (outlinesError) {
      console.error('查询大纲失败:', outlinesError);
    }

    // 获取大纲内容
    const outlinesList = outlines || [];
    if (outlinesList.length === 0) {
      return NextResponse.json(
        { error: '请先生成大纲' },
        { status: 400 }
      );
    }

    // 构建大纲摘要
    const outlineSummary = outlinesList.map((o: Record<string, unknown>) => {
      const events = Array.isArray(o.key_events) ? o.key_events.join('、') : '';
      return `【${o.episode_range}集：${o.title}】${o.summary || ''}。关键事件：${events}`;
    }).join('\n');

    // 初始化LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 判断是否为宠物风
    const isPetGenre = (series.genre as string)?.includes('宠物') || 
                       (series.genre as string)?.includes('萌宠') || 
                       (series.genre as string)?.includes('动物');

    // 根据题材调整场景数量
    const genreContext = getGenreContext(series.genre as string);

    // 生成场景提示词
    const scenePrompt = `你是一个专业的短剧场景设计师。根据以下剧本大纲，设计丰富多样的场景。

【剧本信息】
标题：${series.title}
题材：${series.genre}
风格：${series.style || '现代'}
${genreContext ? `题材特点：${genreContext}` : ''}

【大纲内容】
${outlineSummary}

【场景数量要求】（总计约12-18个场景）
- 固定场景（fixed）: 3-5个 - 剧中反复出现的主要场景，如主角家、公司、常去的餐厅等
- 常见场景（common）: 4-6个 - 非固定但常见的场景类型，如医院、酒店、商场、咖啡馆等
- 特殊场景（special）: 2-4个 - 特定剧情需要的独特场景，如密室、古墓、宴会厅等
- 过渡场景（transition）: 2-3个 - 用于转场的场景，如街道、车内、走廊等

【场景设计要求】
1. 每个场景要有明确的名称和详细描述
2. 场景要符合题材和风格
3. 固定场景要能承载多场戏
4. 特殊场景要有视觉冲击力
5. 每个场景标注适用的情绪/剧情类型
${isPetGenre ? '6. 场景可以是宠物视角的场景（宠物医院、宠物公园、宠物店等）' : ''}

【输出格式】（JSON）
{
  "scenes": [
    {
      "name": "场景名称（如：主角的豪华公寓客厅）",
      "sceneType": "fixed/common/special/transition",
      "type": "indoor/outdoor",
      "description": "详细场景描述（包含空间布局、装饰风格、光线特点）",
      "atmosphere": "氛围描述（如：温馨、阴冷、奢华、神秘）",
      "keyElements": ["关键元素1", "关键元素2"],
      "suitableFor": ["适合的剧情类型：如争吵、表白、密谋"],
      "timeOfDay": "适合的时间：白天/夜晚/全天",
      "weather": "适合的天气：晴天/雨天/雪天/不限"
    }
  ],
  "worldSetting": "整体世界观设定描述"
}

只输出JSON，不要有其他内容。`;

    // 调用LLM生成场景
    const response = await llmClient.invoke([
      { role: 'user', content: scenePrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    let scenes = [];
    
    if (response?.content) {
      const content = response.content.trim();
      try {
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          scenes = parsed.scenes || [];
        }
      } catch (e) {
        console.error('解析场景JSON失败:', e);
      }
    }

    // 为每个场景添加ID和默认类型
    scenes = scenes.map((scene: Record<string, unknown>, index: number) => ({
      ...scene,
      id: `scene-${Date.now()}-${index}`,
      sceneType: scene.sceneType || 'common',
    }));

    // 统计各类场景数量
    const typeCount = {
      fixed: scenes.filter((s: Record<string, unknown>) => s.sceneType === 'fixed').length,
      common: scenes.filter((s: Record<string, unknown>) => s.sceneType === 'common').length,
      special: scenes.filter((s: Record<string, unknown>) => s.sceneType === 'special').length,
      transition: scenes.filter((s: Record<string, unknown>) => s.sceneType === 'transition').length,
    };

    console.log(`[场景提取] 生成场景统计: 固定${typeCount.fixed}个, 常见${typeCount.common}个, 特殊${typeCount.special}个, 过渡${typeCount.transition}个`);

    // 获取已有的场景定义（保留场景图片等数据）
    const currentMetadata = (series.metadata as Record<string, unknown>) || {};
    const existingSceneDefinitions = (currentMetadata.sceneDefinitions as Record<string, Record<string, unknown>>) || {};
    
    // 建立名称到现有场景的映射
    const existingSceneMap = new Map<string, Record<string, unknown>>();
    for (const [_key, scene] of Object.entries(existingSceneDefinitions)) {
      const name = (scene.name as string)?.trim();
      if (name) {
        existingSceneMap.set(name, scene);
      }
    }

    // 构建场景定义，保留已有场景的图片信息
    const sceneDefinitions: Record<string, typeof scenes[0]> = {};
    let preservedCount = 0;
    
    scenes.forEach((scene: typeof scenes[0]) => {
      const sceneName = (scene.name as string)?.trim();
      const existing = existingSceneMap.get(sceneName);
      
      if (existing) {
        // 保留已有场景的信息
        preservedCount++;
        sceneDefinitions[existing.id as string] = {
          ...scene,
          id: existing.id, // 保留原有ID
          sceneId: existing.id,
          imageUrl: existing.imageUrl, // 保留场景图片URL
          fileKey: existing.fileKey, // 保留文件key
        };
      } else {
        // 新场景
        const sceneId = scene.id as string;
        sceneDefinitions[sceneId] = {
          ...scene,
          sceneId,
        };
      }
    });

    console.log(`[场景提取] 合并完成，新场景${scenes.length - preservedCount}个，保留场景${preservedCount}个`);

    await supabase
      .from('drama_series')
      .update({ 
        metadata: {
          ...currentMetadata,
          sceneDefinitions,
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      scenes,
      typeCount,
      sceneDefinitions,
      message: `成功提取 ${scenes.length} 个场景（固定${typeCount.fixed}个、常见${typeCount.common}个、特殊${typeCount.special}个、过渡${typeCount.transition}个）`,
    });
  } catch (error) {
    console.error('提取场景失败:', error);
    return NextResponse.json(
      { error: '提取场景失败' },
      { status: 500 }
    );
  }
}

// 根据题材获取上下文
function getGenreContext(genre: string): string {
  const contexts: Record<string, string> = {
    '古装': '古代建筑风格，包括宫殿、府邸、街市、园林等',
    '仙侠': '仙气飘飘的场景，包括仙山、洞府、仙宫等',
    '都市': '现代都市场景，包括写字楼、商场、公寓等',
    '职场': '职场相关场景，包括办公室、会议室、茶水间等',
    '悬疑': '神秘氛围场景，包括案发现场、密室、审讯室等',
    '甜宠': '浪漫温馨场景，包括咖啡馆、公园、海边等',
    '霸总': '奢华场景，包括总裁办公室、豪宅、私人飞机等',
    '豪门': '富贵场景，包括庄园、宴会厅、高尔夫球场等',
    '宠物': '宠物友好场景，包括宠物医院、宠物公园、宠物店等',
    '萌宠': '宠物友好场景，包括宠物医院、宠物公园、宠物店等',
  };

  for (const [key, value] of Object.entries(contexts)) {
    if (genre.includes(key)) {
      return value;
    }
  }
  return '';
}
