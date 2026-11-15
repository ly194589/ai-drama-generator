import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 题材类型映射
const GENRE_MAP: Record<string, { label: string; desc: string }> = {
  // 女性向题材
  'ba-zong-tian-chong': { label: '霸总甜宠', desc: '高富帅与平凡女主的甜蜜爱情' },
  'chong-sheng-ni-xi': { label: '重生逆袭', desc: '重生复仇、打脸上位' },
  'nue-lian-zhui-qi': { label: '虐恋追妻', desc: '前期虐心、后期追妻火葬场' },
  'hao-men-zhen-jia': { label: '豪门真假千金', desc: '身份逆转、智斗上位' },
  'meng-bao-zhu-gong': { label: '萌宝助攻', desc: '萌娃神助攻父母感情线' },
  // 男性向题材
  'zhan-shen-long-wang': { label: '战神/龙王', desc: '隐世强者一朝曝光震惊全场' },
  'zhui-xu-ni-xi': { label: '赘婿逆袭', desc: '入赘受辱后逆袭翻盘' },
  'xiu-xian-xi-tong': { label: '修仙/系统流', desc: '绑定系统一路打怪升级' },
  'du-shi-chuang-ye': { label: '都市创业', desc: '重生回到过去白手起家' },
  // 现实题材
  'jia-ting-lun-li': { label: '家庭伦理', desc: '婆媳矛盾、财产纷争、养老育儿' },
  'zhi-chang-sheng-cun': { label: '职场生存', desc: '打工人逆袭、裁员反击' },
  'yin-fa-ai-qing': { label: '银发爱情', desc: '中老年情感题材' },
  // 悬疑脑洞
  'xuan-yi-tan-an': { label: '悬疑探案', desc: '层层解谜、关键反转' },
  'ke-huan-mo-shi': { label: '科幻/末世', desc: '人机恋、末世生存' },
  'gu-zhuang-xian-xia': { label: '古装仙侠', desc: '仙侠世界、玄幻冒险' },
  // 特殊题材
  'meng-chong-feng': { label: '萌宠风', desc: '宠物拟人化、反差萌、治愈暖心' },
};

// 风格类型映射
const STYLE_MAP: Record<string, { label: string; desc: string }> = {
  'tian-chong': { label: '甜宠', desc: '宠溺感强，情感代偿' },
  'shuang-ju': { label: '爽剧', desc: '打脸复仇，逆袭翻盘' },
  'nue-lian': { label: '虐恋', desc: '情感张力，催泪治愈' },
  'gao-xiao': { label: '搞笑', desc: '轻松幽默，笑点密集' },
  'xuan-yi': { label: '悬疑', desc: '悬念钩子，层层反转' },
  'wen-xin': { label: '温馨', desc: '治愈暖心，情感共鸣' },
};

// 获取题材标签
function getGenreLabel(genreId: string): string {
  return GENRE_MAP[genreId]?.label || genreId;
}

// 获取风格标签
function getStyleLabel(styleId: string): string {
  if (!styleId || styleId === '__none__') return '甜宠';
  return STYLE_MAP[styleId]?.label || styleId;
}

// 获取剧本列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    // 获取当前用户ID
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false, series: [] },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('drama_series')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: series, error } = await query;

    if (error) {
      console.error('数据库查询错误:', error);
      return NextResponse.json(
        { error: '获取剧本列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      series,
    });
  } catch (error) {
    console.error('获取剧本列表失败:', error);
    return NextResponse.json(
      { error: '获取剧本列表失败' },
      { status: 500 }
    );
  }
}

// 创建新剧本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      title, 
      description, 
      genre, 
      theme, 
      coreConflict,
      coreConflictTypes = [],
      targetAudience,
      totalEpisodes = 80,
      style,
      imageStyle = 'realistic', // 图片风格：realistic(真人风) / comic(漫画风)
      characterCount = 2
    } = body;

    if (!genre) {
      return NextResponse.json(
        { error: '请提供题材类型' },
        { status: 400 }
      );
    }

    // 获取题材和风格的可读标签
    const genreLabel = getGenreLabel(genre);
    const styleLabel = getStyleLabel(style);

    // 获取当前用户ID（数据隔离）
    const currentUserId = request.headers.get('x-user-id');
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    
    // 如果没有提供标题，使用AI生成
    let finalTitle = title;
    if (!finalTitle || finalTitle.trim() === '') {
      try {
        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const config = new Config();
        const client = new LLMClient(config, customHeaders);

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

        // 获取当前题材的爆款示例
        const genreViralTitles = VIRAL_TITLES_BY_GENRE[genreLabel] || VIRAL_TITLES_BY_GENRE['霸总甜宠'];
        const titleExamples = genreViralTitles.slice(0, 5).join('、');

        const prompt = `你是一个AI短剧爆款标题专家。请根据以下信息，使用"短剧爆款标题4大万能公式"，生成一个最能钩住人的爆款标题（只输出标题，不要其他内容）：

【剧本信息】
题材：${genreLabel}
风格：${styleLabel}
${description ? `剧情简介：${description}` : ''}
${coreConflict ? `核心冲突：${coreConflict}` : ''}

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

【输出要求】
只输出一个最能钩住人的爆款标题，不要任何解释或说明。标题长度10-14个字。`;

        const response = await client.invoke([
          { role: 'user', content: prompt }
        ], {
          model: 'doubao-seed-2-0-pro-260215',
          temperature: 0.9 // 提高温度，增加创意
        });

        finalTitle = response.content.trim().replace(/["""''「」【】]/g, '').substring(0, 20);

        // 如果AI生成失败，使用默认标题
        if (!finalTitle) {
          finalTitle = `未命名${genreLabel}短剧`;
        }
      } catch (error) {
        console.error('AI生成标题失败:', error);
        finalTitle = `未命名${genreLabel}短剧`;
      }
    }

    // 创建剧本 - 使用可读标签存储
    const { data: series, error } = await supabase
      .from('drama_series')
      .insert({
        title: finalTitle,
        description: description || '',
        genre: genreLabel,
        theme: theme || '',
        core_conflict: coreConflict || '',
        core_conflict_types: coreConflictTypes,
        target_audience: targetAudience || '',
        total_episodes: totalEpisodes,
        style: styleLabel,
        image_style: imageStyle, // 图片风格
        character_count: characterCount,
        status: 'draft',
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error || !series) {
      console.error('创建剧本错误:', error);
      return NextResponse.json(
        { error: '创建剧本失败' },
        { status: 500 }
      );
    }

    // 异步生成剧情简介（不阻塞响应）
    generateDescriptionInBackground(series.id, finalTitle, genreLabel, styleLabel, coreConflict, coreConflictTypes, request.headers);

    return NextResponse.json({
      success: true,
      series,
      generatedTitle: !title || title.trim() === '' // 标记标题是否为AI生成
    });
  } catch (error) {
    console.error('创建剧本失败:', error);
    return NextResponse.json(
      { error: '创建剧本失败' },
      { status: 500 }
    );
  }
}

// 后台生成剧情简介
async function generateDescriptionInBackground(
  seriesId: string, 
  title: string, 
  genre: string, 
  style: string, 
  coreConflict: string | undefined,
  coreConflictTypes: string[],
  headers: Headers
) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const conflictTypesDesc = coreConflictTypes.length > 0 
      ? `核心冲突类型：${coreConflictTypes.join('、')}` 
      : '';

    const prompt = `请为以下短剧生成一段吸引人的剧情简介（100-200字）：

剧名：${title}
题材：${genre}
风格：${style}
${coreConflict ? `核心冲突：${coreConflict}` : ''}
${conflictTypesDesc}

要求：
1. 简洁明了，突出剧情亮点
2. 设置悬念，吸引观众继续观看
3. 符合抖音短剧风格
4. 只输出简介内容，不要其他说明`;

    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7
    });

    const description = response.content.trim();

    if (description) {
      const supabase = getSupabaseClient();
      await supabase
        .from('drama_series')
        .update({ description })
        .eq('id', seriesId);
      
      console.log(`[剧本简介] 已为 ${title} 生成剧情简介`);
    }
  } catch (error) {
    console.error('[剧本简介] 生成失败:', error);
  }
}
