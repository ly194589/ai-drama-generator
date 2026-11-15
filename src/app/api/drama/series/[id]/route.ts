import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个剧本详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 获取剧本详情
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

    // 获取大纲列表
    const { data: outlines } = await supabase
      .from('drama_outlines')
      .select('*')
      .eq('series_id', id)
      .order('order', { ascending: true });

    // 获取已生成的集数
    const { data: episodes } = await supabase
      .from('drama_episodes')
      .select('*')
      .eq('series_id', id)
      .order('episode_number', { ascending: true });

    return NextResponse.json({
      success: true,
      series: {
        ...series,
        outlines: outlines || [],
        episodes: episodes || [],
      },
    });
  } catch (error) {
    console.error('获取剧本详情失败:', error);
    return NextResponse.json(
      { error: '获取剧本详情失败' },
      { status: 500 }
    );
  }
}

// 更新剧本
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // 可更新字段
    const fields = ['title', 'description', 'genre', 'theme', 'core_conflict', 
                    'target_audience', 'total_episodes', 'style', 'characters', 
                    'world_view', 'status', 'progress', 'metadata'];
    
    for (const field of fields) {
      if (body[field] !== undefined) {
        // 驼峰转下划线
        const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updateData[dbField] = body[field];
      }
    }

    const { data: series, error } = await supabase
      .from('drama_series')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !series) {
      return NextResponse.json(
        { error: '更新剧本失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      series,
    });
  } catch (error) {
    console.error('更新剧本失败:', error);
    return NextResponse.json(
      { error: '更新剧本失败' },
      { status: 500 }
    );
  }
}

// 重新生成剧本标题
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[PUT /api/drama/series/[id]] 开始处理重新生成标题请求');
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    console.log('[PUT] 请求参数', { id, action });

    // 只有重新生成标题的动作
    if (action !== 'regenerateTitle') {
      console.log('[PUT] 不支持的操作', action);
      return NextResponse.json(
        { error: '不支持的操作' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      console.error('[PUT] 剧本不存在', { id, seriesError });
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    console.log('[PUT] 找到剧本', { title: series.title, genre: series.genre });

    const { LLMClient, Config, HeaderUtils } = await import('coze-coding-dev-sdk');

    // 爆款剧本名示例库 - 按AI短剧爆款公式分类（10-14字）
    const VIRAL_TITLES_BY_GENRE: Record<string, string[]> = {
      '霸总甜宠': [
        '假死归来，顾总跪求复婚',
        '被退婚，我嫁千亿大佬',
        '前夫跪求，前妻不回头',
        '一夜成孕，顾总悔青',
        '亮出首富身份，前夫跪'
      ],
      '重生逆袭': [
        '重生后，我成渣男叔宠',
        '废女逆袭，全京城跪舔',
        '假死归来，我杀穿豪门',
        '被退婚，首富来求亲',
        '重生打脸，前任全家悔'
      ],
      '虐恋追妻': [
        '追妻火葬场，前夫别来',
        '前妻假死，前夫疯了',
        '前夫跪求，前妻不回头',
        '追妻之路，前夫跪烂',
        '蚀骨深爱，前夫跪求'
      ],
      '豪门真假千金': [
        '真千金归来，假千金悔',
        '亮出身份，全豪门跪舔',
        '真假千金，假千金悔',
        '真千金大佬，假千金跪',
        '团宠真千金，杀穿假千'
      ],
      '萌宝助攻': [
        '萌宝曝光，总裁爹地跪',
        '萌宝归来，爹地妈咪和',
        '一胎三宝，总裁悔青',
        '萌宝神助攻，渣男跪求',
        '假死归来，萌宝曝光我'
      ],
      '战神/龙王': [
        '龙王归来，全场跪舔',
        '废婿亮出身份，丈母娘悔',
        '被逐军营，全军悔青',
        '假死归来，我杀穿敌国',
        '龙王令下，四方臣服'
      ],
      '赘婿逆袭': [
        '废婿崛起，开局被退婚',
        '亮出身份，全家跪舔',
        '被赶出家，我掀翻豪门',
        '假死归来，丈母娘跪',
        '赘婿当道，我让全跪'
      ],
      '修仙/系统流': [
        '斩仙台不死，归来即天道',
        '假死归来，我杀穿仙界',
        '全宗门要杀我，我是天道',
        '被逐师门，全宗门悔青',
        '魔尊归来，一剑斩伪君'
      ],
      '都市创业': [
        '重生1993，开局被裁员',
        '被开除，我掀翻商圈',
        '假死归来，前公司跪求',
        '废柴逆袭，我让全跪舔',
        '重生首富，我杀穿股市'
      ],
      '悬疑探案': [
        '都是凶手，真凶是局长',
        '假死归来，揭开大阴谋',
        '他们杀我，只为掩真相',
        '真相大白，全骗了我',
        '死局，我只是一棋子'
      ],
      '古装仙侠': [
        '斩仙台替罪，我杀疯了',
        '假死归来，掀翻正道',
        '全天下想我死，那就死',
        '正道皆伪，我以魔镇乾',
        '斩仙刀不死，归即天道'
      ],
      '萌宠风': [
        '萌宠归来，一爪拍绿茶',
        '假死归来，萌宝亮身份',
        '全城嫌弃，它是神兽',
        '萌宠逆袭，我让全悔青',
        '萌宝助攻，主人跪求'
      ],
      '家庭伦理': [
        '婆婆看不起，我亮首富',
        '假死归来，全家人跪求',
        '被赶出家，我让全悔青',
        '偏心婆婆，我让她跪求',
        '家庭真相，只女儿亲生'
      ],
      '职场生存': [
        '被裁员，我掀翻行业',
        '假死归来，前公司跪求',
        '职场逆袭，我让全悔青',
        '废柴逆袭，我成老板',
        '杀穿职场，我让全跪'
      ],
      '银发爱情': [
        '老伴看不起，我亮首富',
        '黄昏恋，假死归来悔',
        '被赶出家，我让子女跪',
        '晚年逆袭，我杀穿社区',
        '夕阳红，我让全跪舔'
      ],
      '科幻/末世': [
        '末日被推出去送死，我活',
        '假死归来，我杀穿末世',
        '全人类杀我，我是救世',
        '被逐基地，全基地悔青',
        '末世逆袭，我让全跪舔'
      ],
    };

    const genreLabel = series.genre as string || '';
    const styleLabel = series.style as string || '';
    const coreConflict = series.core_conflict as string || '';
    const description = series.description as string || '';

    // 获取当前题材的爆款示例
    const genreViralTitles = VIRAL_TITLES_BY_GENRE[genreLabel] || VIRAL_TITLES_BY_GENRE['霸总甜宠'];
    const titleExamples = genreViralTitles.slice(0, 5).join('、');

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const prompt = `你是一个AI短剧爆款标题专家。请根据以下信息，使用"短剧爆款标题4大万能公式"，生成一个最能钩住人的爆款标题（只输出标题，不要其他内容）：

【剧本信息】
题材：${genreLabel}
风格：${styleLabel}
${description ? `剧情简介：${description}` : ''}
${coreConflict ? `核心冲突：${coreConflict}` : ''}
当前标题（不要重复）：${series.title}

【AI短剧爆款标题4大万能公式】
1. **身份反转 + 打脸**
   公式：被谁看不起 + 我真实身份是…
   示例：大婚当日，我亮出魔尊身份，全场吓跪
   示例：斩仙台上，没人知道我是天界帝君

2. **开局暴击 + 绝境**
   公式：最惨开局 + 谁都想杀我
   示例：刚穿越，就被推上斩仙台
   示例：全宗门都要杀我，可我是天道亲传

3. **复仇爽点 + 结果**
   公式：我被谁害 + 归来后怎样
   示例：假死归来，我杀穿整个正道
   示例：被师姐陷害后，我让她永世不得翻身

4. **悬念钩子 + 真相**
   公式：大家以为… + 其实…
   示例：人人说我是魔女，可真正的魔是掌门
   示例：她偷了魔教至宝？不，是替罪！

【标题必加3个词（流量翻倍）】
- **归来/假死/逆袭**：制造反转期待
- **杀穿/掀翻/悔青**：强化爽感冲击
- **真相/秘事/反转**：增加悬念钩子

【爆款标题示例】
${titleExamples}

【生成要求】
1. 一定要根据短剧简介生成，不能凭空捏造
2. 必须使用4大万能公式之一来构建标题
3. 必须包含必加词汇中的至少1个（归来/假死/逆袭/杀穿/掀翻/悔青/真相/秘事/反转）
4. **标题长度必须控制在10-14个字之间，这是最佳长度**
5. 标题要包含：被谁看不起/害 + 我真实身份/归来后怎样/真相是什么
6. 标题要简洁有力，让人一眼就能看懂
7. 必须生成一个与"${series.title}"完全不同的新标题

【输出要求】
只输出一个最能钩住人的爆款标题，不要任何解释或说明。标题长度10-14个字。`;

    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.9
    });

    console.log('[PUT] LLM响应', { content: response.content });

    let newTitle = response.content.trim().replace(/["""''「」【】]/g, '').substring(0, 20);

    // 如果AI生成失败，使用默认标题
    if (!newTitle) {
      newTitle = `未命名${genreLabel}短剧`;
    }

    console.log('[PUT] 生成的新标题', { newTitle });

    // 更新剧本标题
    const { data: updatedSeries, error: updateError } = await supabase
      .from('drama_series')
      .update({
        title: newTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    console.log('[PUT] 更新数据库结果', { updateError, updatedTitle: updatedSeries?.title });

    if (updateError || !updatedSeries) {
      console.error('[PUT] 更新标题失败', { updateError });
      return NextResponse.json(
        { error: '更新标题失败' },
        { status: 500 }
      );
    }

    console.log('[PUT] 成功返回新标题', { newTitle });
    return NextResponse.json({
      success: true,
      series: updatedSeries,
      newTitle,
    });
  } catch (error) {
    console.error('重新生成标题失败:', error);
    return NextResponse.json(
      { error: '重新生成标题失败' },
      { status: 500 }
    );
  }
}

// 删除剧本
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 删除关联的大纲
    await supabase
      .from('drama_outlines')
      .delete()
      .eq('series_id', id);

    // 删除关联的集数
    await supabase
      .from('drama_episodes')
      .delete()
      .eq('series_id', id);

    // 删除剧本
    const { error } = await supabase
      .from('drama_series')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: '删除剧本失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '剧本已删除',
    });
  } catch (error) {
    console.error('删除剧本失败:', error);
    return NextResponse.json(
      { error: '删除剧本失败' },
      { status: 500 }
    );
  }
}
