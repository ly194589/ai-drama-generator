import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 从大纲提取角色和场景信息 API
 * 
 * 用于在生成大纲后，提取剧本中的角色和场景信息
 * 为后续生成立绘做准备
 * 
 * 角色类型：
 * - protagonist: 主角（1-2个）
 * - supporting: 配角（2-4个）
 * - mystery: 神秘人/隐藏角色（1-2个）
 * - extra: 路人甲/龙套（2-3个）
 */

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
      console.error('查询剧本失败:', seriesError);
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    // 获取用户指定的人物数量
    const characterCount = series.character_count || 0;
    const hasSpecifiedCount = characterCount > 0;

    // 解析请求体，检查是否强制重新提取
    let forceReExtract = false;
    try {
      const body = await request.json();
      forceReExtract = body?.force === true;
    } catch {
      // 如果没有请求体，忽略
    }

    // 如果已有角色且不为空，且不强制重新提取，则不再生成
    if (!forceReExtract && series.characters && Array.isArray(series.characters) && series.characters.length > 0) {
      return NextResponse.json({
        success: true,
        characters: series.characters,
        message: '角色信息已存在',
      });
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

    // 根据题材获取场景人物示例
    const getSceneNPCExamples = (genre: string): string[] => {
      if (genre.includes('古风') || genre.includes('古装') || genre.includes('仙侠') || genre.includes('玄幻')) {
        return ['宫廷侍卫', '宫女', '太监', '丫鬟', '家丁', '店小二', '马夫', '御医', '暗卫'];
      } else if (genre.includes('现代') || genre.includes('都市') || genre.includes('职场')) {
        return ['前台小姐', '保安', '服务员', '快递员', '保洁阿姨', '司机', '秘书'];
      } else if (genre.includes('霸总') || genre.includes('豪门')) {
        return ['管家', '女佣', '保镖', '司机', '秘书', '前台'];
      } else if (genre.includes('悬疑') || genre.includes('犯罪')) {
        return ['警察', '法医', '保安', '路人', '服务员', '记者'];
      } else if (genre.includes('甜宠') || genre.includes('恋爱')) {
        return ['闺蜜', '同事', '服务员', '快递员', '前台', '室友'];
      } else if (genre.includes('科幻') || genre.includes('未来')) {
        return ['机器人助手', '飞船驾驶员', '科学家', '安保人员', '服务员'];
      } else if (isPetGenre) {
        return ['宠物小兵', '斥候猫', '传信鸽', '军犬', '后勤仓鼠'];
      }
      return ['服务员', '保安', '路人', '前台', '司机']; // 通用默认
    };

    const sceneNPCExamples = getSceneNPCExamples(series.genre as string || '');

    // 计算各类角色数量 - 科学分配，确保每种类型都有合理数量
    // 短剧角色分配原则：
    // - 主角：剧情核心，1-2个（双男主/双女主时可2个）
    // - 配角：推动剧情，占主要角色40-50%
    // - 神秘人：制造悬念，至少1个，最多2个
    // - 路人甲：丰富场景，占主要角色15-25%
    // - 场景人物：额外生成，不占用主要角色名额
    
    let protagonistCount = 1;
    let supportingCount = 2;
    let mysteryCount = 1;
    let extraCount = 2;
    let sceneNPCCount = 3;
    
    if (hasSpecifiedCount) {
      if (characterCount <= 4) {
        // 极少角色：保证核心类型
        protagonistCount = 1;
        supportingCount = Math.max(1, characterCount - 2);
        mysteryCount = characterCount >= 3 ? 1 : 0;
        extraCount = characterCount > 3 ? 1 : 0;
        sceneNPCCount = 2;
      } else if (characterCount <= 6) {
        // 小型阵容：标准配置
        protagonistCount = 1;
        supportingCount = 2;
        mysteryCount = 1;
        extraCount = characterCount - 4;
        sceneNPCCount = 3;
      } else if (characterCount <= 10) {
        // 中型阵容：丰富角色
        protagonistCount = characterCount >= 8 ? 2 : 1;
        supportingCount = Math.floor(characterCount * 0.4);
        mysteryCount = Math.min(2, Math.max(1, Math.floor(characterCount * 0.15)));
        extraCount = characterCount - protagonistCount - supportingCount - mysteryCount;
        sceneNPCCount = 4;
      } else {
        // 大型阵容：群像剧
        protagonistCount = 2;
        supportingCount = Math.floor(characterCount * 0.35);
        mysteryCount = 2;
        extraCount = characterCount - protagonistCount - supportingCount - mysteryCount;
        sceneNPCCount = 5;
      }
      
      // 验证并修正，确保关键类型不为0
      if (mysteryCount === 0 && characterCount >= 4) {
        mysteryCount = 1;
        extraCount = Math.max(0, extraCount - 1);
      }
      if (supportingCount < 2 && characterCount >= 3) {
        supportingCount = 2;
        extraCount = Math.max(0, extraCount - 1);
      }
      
      // 确保总数匹配
      const total = protagonistCount + supportingCount + mysteryCount + extraCount;
      if (total !== characterCount) {
        extraCount = Math.max(0, extraCount + (characterCount - total));
      }
    }
    
    console.log(`[角色提取] 角色分配: 主角${protagonistCount}+配角${supportingCount}+神秘人${mysteryCount}+路人甲${extraCount}+场景人物${sceneNPCCount} = ${protagonistCount + supportingCount + mysteryCount + extraCount}+${sceneNPCCount}`);

    // 生成角色提示词
    const characterPrompt = isPetGenre ? 
`你是一个专业的宠物短剧编剧。根据以下剧本大纲，提取/设计拟人化宠物角色。

【剧本信息】
标题：${series.title}
题材：${series.genre}
核心冲突：${series.core_conflict || '未指定'}

【大纲内容】
${outlineSummary}

【角色数量要求】（总计约${protagonistCount + supportingCount + mysteryCount + extraCount}个主要角色）
- 主角（protagonist）: ${protagonistCount}个 - 剧情核心人物
- 配角（supporting）: ${supportingCount}个 - 重要配角，推动剧情
- 神秘人（mystery）: ${mysteryCount}个 - 身份成谜或后期揭秘的角色
- 路人甲（extra）: ${extraCount}个 - 龙套角色，丰富场景

【额外要求：场景通用人物】
除了主要角色，还需要生成${sceneNPCCount}个场景通用人物（sceneNPC）：
- 适合本题材的示例：${sceneNPCExamples.join('、')} 等
- 这些人物可以在多个场景复用，characterType 设为 "sceneNPC"

【萌宠拟人化设计要点】
1. 风格定位：史诗奇幻+东方古风战甲的拟人化风格
2. 核心角色设计：
   - 以真实宠物为原型（金毛、柴犬、猫咪等）
   - 保留宠物标志性毛色、表情特征
   - 穿戴精致战甲/服饰，形成"温顺宠物×铁血战士"的反差萌
3. 主角要有鲜明的个性标签，配角要有记忆点，神秘人要有神秘感，路人甲要有类型化特征

【输出格式】（JSON）
{
  "characters": [
    {
      "name": "角色名字（如：将军大黄、小柴队长）",
      "characterType": "protagonist/supporting/mystery/extra/sceneNPC",
      "gender": "male或female",
      "petType": "宠物类型（金毛/柴犬/英短猫/布偶猫等）",
      "breed": "具体品种",
      "furColor": "毛色（如：浅金色、橘色、黑白相间）",
      "eyeColor": "眼睛颜色",
      "roleType": "角色定位（将领/亲兵/军师/斥候等）",
      "armorStyle": "战甲风格描述（如：暗金色兽面纹战甲、红色披风）",
      "temperament": "性格描述（如：外表温和内心坚定）",
      "signaturePose": "标志性动作/姿态",
      "signatureLook": "标志性表情（如：凝重中带着悲悯的眼神）",
      "microActions": ["微动作1", "微动作2"],
      "equipment": ["装备1", "装备2"],
      "firstAppearHint": "首次出场提示（神秘人可填'身份成谜'）",
      "suitableScenes": ["适合出现的场景类型，场景通用人物必填"]
    }
  ],
  "teamName": "团队名称（如：战犬军团、御猫卫队）",
  "relationships": "角色关系描述",
  "worldSetting": "世界观设定（如：古代战场、魔法王国）"
}

只输出JSON，不要有其他内容。`
:
`你是一个专业的短剧编剧。根据以下剧本大纲，提取/设计丰富多样的角色。

【剧本信息】
标题：${series.title}
题材：${series.genre}
风格：${series.style || '现代'}
核心冲突：${series.core_conflict || '未指定'}

【大纲内容】
${outlineSummary}

【角色数量要求】（总计约${protagonistCount + supportingCount + mysteryCount + extraCount}个主要角色）
- 主角（protagonist）: ${protagonistCount}个 - 剧情核心人物，戏份最多
- 配角（supporting）: ${supportingCount}个 - 重要配角，推动剧情发展
- 神秘人（mystery）: ${mysteryCount}个 - 身份成谜或后期揭秘的角色，制造悬念
- 路人甲（extra）: ${extraCount}个 - 龙套角色，类型化人物，丰富场景

【额外要求：场景通用人物】
除了主要角色，还需要生成${sceneNPCCount}个场景通用人物（sceneNPC），这些人物会在多个场景中出现：
- 适合本题材的示例：${sceneNPCExamples.join('、')} 等
- 这些人物有类型化的外貌和服装，可以在多个场景复用
- characterType 设为 "sceneNPC"
- 这些人物有类型化的外貌和服装，可以在多个场景复用
- characterType 设为 "sceneNPC"

【角色设计要求】
1. 主角：鲜明的个性标签，让观众快速记住
2. 配角：有记忆点，与主角有明确关系
3. 神秘人：有神秘感，身份模糊或后期揭秘
4. 路人甲：类型化特征（如：八卦的邻居、势利的店员等）
5. 场景通用人物：通用性强，适合多场景出现
6. 每个角色服装描述要具体，确保全程一致
7. 每个角色要有标志性动作

【输出格式】（JSON）
{
  "characters": [
    {
      "name": "角色姓名或类型名（场景通用人物可用类型名如'宫廷侍卫'）",
      "characterType": "protagonist/supporting/mystery/extra/sceneNPC",
      "gender": "male或female",
      "age": 年龄数字,
      "faceShape": "脸型描述",
      "hairstyle": "发型描述",
      "clothing": "服装描述（全程不变）",
      "skinTone": "肤色",
      "temperament": "气质描述",
      "signaturePose": "标志性动作",
      "microActions": ["微动作1", "微动作2"],
      "characteristic": "角色特征标签（如：腹黑、忠犬、疯批等）",
      "firstAppearHint": "首次出场提示（神秘人可填'身份成谜'）",
      "suitableScenes": ["适合出现的场景类型，场景通用人物必填"]
    }
  ],
  "relationships": "角色关系描述"
}

只输出JSON，不要有其他内容。`;

    // 调用LLM生成角色
    const response = await llmClient.invoke([
      { role: 'user', content: characterPrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.8,
    });

    let characters = [];
    
    if (response?.content) {
      const content = response.content.trim();
      try {
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          characters = parsed.characters || [];
        }
      } catch (e) {
        console.error('解析角色JSON失败:', e);
      }
    }

    // 为每个角色添加ID和默认类型
    characters = characters.map((char: Record<string, unknown>, index: number) => ({
      ...char,
      id: `char-${Date.now()}-${index}`,
      characterType: char.characterType || 'supporting', // 默认为配角
    }));

    // 统计各类角色数量
    const typeCount = {
      protagonist: characters.filter((c: Record<string, unknown>) => c.characterType === 'protagonist').length,
      supporting: characters.filter((c: Record<string, unknown>) => c.characterType === 'supporting').length,
      mystery: characters.filter((c: Record<string, unknown>) => c.characterType === 'mystery').length,
      extra: characters.filter((c: Record<string, unknown>) => c.characterType === 'extra').length,
    };

    console.log(`[角色提取] 生成角色统计: 主角${typeCount.protagonist}个, 配角${typeCount.supporting}个, 神秘人${typeCount.mystery}个, 路人甲${typeCount.extra}个`);

    // 获取已有的角色信息（保留立绘等数据）
    const existingCharacters = (series.characters as Record<string, unknown>[]) || [];
    const existingCharMap = new Map<string, Record<string, unknown>>();
    
    // 建立名称到现有角色的映射
    for (const existing of existingCharacters) {
      const name = (existing.name as string)?.trim();
      if (name) {
        existingCharMap.set(name, existing);
      }
    }

    // 合并新旧角色数据，保留已有的立绘信息
    characters = characters.map((char: Record<string, unknown>) => {
      const charName = (char.name as string)?.trim();
      const existing = existingCharMap.get(charName);
      
      if (existing) {
        // 保留已有角色的立绘信息
        console.log(`[角色提取] 保留角色 "${charName}" 的已有立绘`);
        return {
          ...char, // 新的角色信息
          id: existing.id, // 保留原有ID
          referenceImages: existing.referenceImages, // 保留立绘
          imageAngles: existing.imageAngles, // 保留角度信息
          referenceImageUrl: existing.referenceImageUrl, // 保留主图URL
        };
      }
      
      // 新角色，使用新生成的数据
      return char;
    });

    console.log(`[角色提取] 合并完成，新角色${characters.filter((c: Record<string, unknown>) => !existingCharMap.has((c.name as string)?.trim())).length}个，保留角色${characters.filter((c: Record<string, unknown>) => existingCharMap.has((c.name as string)?.trim())).length}个`);

    // 更新剧本的角色信息
    await supabase
      .from('drama_series')
      .update({ 
        characters,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      characters,
      typeCount,
      message: `成功提取 ${characters.length} 个角色（主角${typeCount.protagonist}个、配角${typeCount.supporting}个、神秘人${typeCount.mystery}个、路人甲${typeCount.extra}个）`,
    });
  } catch (error) {
    console.error('提取角色失败:', error);
    return NextResponse.json(
      { error: '提取角色失败' },
      { status: 500 }
    );
  }
}
