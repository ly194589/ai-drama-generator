import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 设置最大执行时间为8分钟
export const maxDuration = 480;

// 生成剧本大纲
export async function POST(
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
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    const totalEpisodes = series.total_episodes || 80;
    
    // 根据总集数计算大纲阶段数：每阶段约5-10集，最少1个阶段
    const stageCount = Math.max(1, Math.ceil(totalEpisodes / 8));
    const episodesPerStage = Math.ceil(totalEpisodes / stageCount);

    // 更新状态为生成中
    await supabase
      .from('drama_series')
      .update({ status: 'outlining' })
      .eq('id', id);

    // 初始化LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 第一步：生成故事概要信息（主角、故事类型、故事概要、故事背景、故事设定）
    const storyInfoPrompt = `你是一个专业的短剧编剧。请为以下短剧生成故事概要信息。

【剧本信息】
标题：${series.title}
题材：${series.genre}
风格：${series.style || '甜宠'}
总集数：${totalEpisodes}集
核心冲突：${series.core_conflict || '未指定'}
目标受众：${series.target_audience || '年轻女性观众'}

【要求】
请生成以下信息：

1. 主角：主要角色姓名和简介（1-2个主角）
2. 故事类型：如"重生复仇"、"身份互换"、"先婚后爱"、"霸道总裁"等
3. 故事概要：整体故事走向概述（100-150字）
4. 故事背景：故事发生的时代背景和主要场景（如：大靖王朝新帝登基初期，皇宫（御书房、大殿）、暗阁密室、边境（山谷、帅帐）、刑场）
5. 故事设定：故事中的特殊设定或规则（如：云初卦师能通过卦象预知吉凶祸福，其卦象具有警示作用，如"若见血必有灾""三日边境十万百姓全死"）

【输出格式】（JSON）
{
  "protagonist": "主角姓名及简介",
  "storyType": "故事类型",
  "storySummary": "故事概要",
  "storyBackground": "故事背景",
  "storySetting": "故事设定"
}

只输出JSON，不要有其他内容。`;

    let storyInfo = {
      protagonist: '',
      storyType: '',
      storySummary: '',
      storyBackground: '',
      storySetting: '',
    };

    try {
      const storyInfoResponse = await llmClient.invoke([
        { role: 'user', content: storyInfoPrompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.8,
      });

      if (storyInfoResponse?.content) {
        const content = storyInfoResponse.content.trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          storyInfo = { ...storyInfo, ...JSON.parse(jsonMatch[0]) };
        }
      }
    } catch (e) {
      console.error('生成故事概要信息失败:', e);
    }

    // 第二步：生成故事阶段大纲
    // 生成大纲提示词 - 根据实际集数动态调整
    const outlinePrompt = `你是一个专业的短剧编剧。请为以下短剧生成完整的故事大纲。

【剧本信息】
标题：${series.title}
题材：${series.genre}
风格：${series.style || '甜宠'}
总集数：${totalEpisodes}集
每集时长：300秒
核心冲突：${series.core_conflict || '未指定'}
目标受众：${series.target_audience || '年轻女性观众'}
${storyInfo.protagonist ? `主角：${storyInfo.protagonist}` : ''}
${storyInfo.storyType ? `故事类型：${storyInfo.storyType}` : ''}
${storyInfo.storySummary ? `故事概要：${storyInfo.storySummary}` : ''}
${storyInfo.storyBackground ? `故事背景：${storyInfo.storyBackground}` : ''}
${storyInfo.storySetting ? `故事设定：${storyInfo.storySetting}` : ''}

【要求】
1. 将全剧分为${stageCount}个故事阶段（每阶段约${episodesPerStage}集）
2. 每个阶段包含：
   - 阶段标题
   - 集数范围（必须严格按照${totalEpisodes}集总数分配）
   - 情节概要（100-150字）
   - 关键事件（3-5个）
   - 情感弧线
   - 高潮点
   - 角色发展

【格式要求】
请以JSON数组格式输出，必须恰好${stageCount}个阶段：
[
  {
    "episodeRange": "1-${Math.min(episodesPerStage, totalEpisodes)}",
    "title": "阶段标题",
    "summary": "情节概要",
    "keyEvents": ["事件1", "事件2", "事件3"],
    "emotionalArc": "情感弧线描述",
    "climaxPoint": "高潮点描述",
    "characterDevelopment": "角色发展描述"
  }
]

注意：
- 集数范围必须连续且覆盖1-${totalEpisodes}集
- 确保情节紧凑，每集都有钩子和悬念
- 符合抖音短剧节奏特点
- 主线清晰，支线不喧宾夺主
- 情感共鸣，符合目标受众喜好`;

    // 调用LLM生成大纲
    const response = await llmClient.invoke([
      { role: 'user', content: outlinePrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.8,
    });

    let outlines = [];
    
    if (response?.content) {
      const content = response.content.trim();
      try {
        // 尝试提取JSON数组
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          outlines = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('解析大纲JSON失败:', e);
        // 如果解析失败，尝试生成默认大纲
        outlines = generateDefaultOutlines(totalEpisodes);
      }
    }

    // 如果没有生成大纲，使用默认
    if (!outlines || outlines.length === 0) {
      outlines = generateDefaultOutlines(totalEpisodes);
    }

    // 清除旧大纲
    await supabase
      .from('drama_outlines')
      .delete()
      .eq('series_id', id);

    // 保存新大纲
    const outlinesData = outlines.map((outline: Record<string, unknown>, index: number) => ({
      series_id: id,
      episode_range: outline.episodeRange || `${index * 10 + 1}-${(index + 1) * 10}`,
      title: outline.title || `第${index + 1}阶段`,
      summary: outline.summary || '',
      key_events: outline.keyEvents || [],
      emotional_arc: outline.emotionalArc || '',
      climax_point: outline.climaxPoint || '',
      character_development: outline.characterDevelopment || '',
      order: index,
    }));

    const { data: savedOutlines, error: saveError } = await supabase
      .from('drama_outlines')
      .insert(outlinesData)
      .select();

    if (saveError) {
      console.error('保存大纲失败:', saveError);
    }

    // 更新剧本状态，并存储故事概要信息到 metadata
    const existingMetadata = (series.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      storyInfo: {
        protagonist: storyInfo.protagonist,
        storyType: storyInfo.storyType,
        storySummary: storyInfo.storySummary,
        storyBackground: storyInfo.storyBackground,
        storySetting: storyInfo.storySetting,
      }
    };

    await supabase
      .from('drama_series')
      .update({ 
        status: 'outlining',
        progress: 20,
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      outlines: savedOutlines || outlines,
      storyInfo,
    });
  } catch (error) {
    console.error('生成大纲失败:', error);
    
    // 更新状态为错误
    const { id } = await params;
    const supabase = getSupabaseClient();
    await supabase
      .from('drama_series')
      .update({ status: 'draft' })
      .eq('id', id);

    return NextResponse.json(
      { error: '生成大纲失败' },
      { status: 500 }
    );
  }
}

// 生成默认大纲 - 根据实际集数生成
function generateDefaultOutlines(totalEpisodes: number) {
  const stageCount = Math.max(1, Math.ceil(totalEpisodes / 8));
  const outlines = [];
  
  for (let i = 0; i < stageCount; i++) {
    const startEp = i * Math.ceil(totalEpisodes / stageCount) + 1;
    const endEp = Math.min((i + 1) * Math.ceil(totalEpisodes / stageCount), totalEpisodes);
    
    outlines.push({
      episodeRange: `${startEp}-${endEp}`,
      title: `第${i + 1}阶段`,
      summary: `第${startEp}至${endEp}集的故事发展`,
      keyEvents: [],
      emotionalArc: '',
      climaxPoint: '',
      characterDevelopment: '',
    });
  }
  
  return outlines;
}
