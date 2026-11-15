import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { PRESET_STYLES, type VisualStyle } from '@/lib/script-types';
import { DEFAULT_MODELS, getUserConfig } from '@/lib/config';
import { getScriptPromptProfile } from '@/lib/model-prompt-profiles';

export const maxDuration = 120;

// 根据题材匹配视觉风格
function matchVisualStyle(genre: string): VisualStyle {
  if (genre.includes('古装') || genre.includes('古风')) return PRESET_STYLES['ancient_beauty'];
  if (genre.includes('仙侠') || genre.includes('玄幻')) return PRESET_STYLES['fantasy_fairy'];
  if (genre.includes('悬疑') || genre.includes('推理')) return PRESET_STYLES['suspense_dark'];
  if (genre.includes('甜宠') || genre.includes('恋爱') || genre.includes('言情')) return PRESET_STYLES['sweet_romance'];
  if (genre.includes('都市') || genre.includes('现代')) return PRESET_STYLES['urban_modern'];
  if (genre.includes('职场') || genre.includes('商战')) return PRESET_STYLES['workplace_elite'];
  return PRESET_STYLES['ancient_beauty'];
}

function getVideoModelMaxDuration(videoModel: string | undefined): number {
  if (videoModel === 'doubao-seedance-2-0-260128') return 15;
  return 15;
}

function parseJsonContent(content: string): Record<string, unknown> | null {
  try {
    let jsonStr = content.trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return null;
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    jsonStr = jsonStr.replace(/[""]/g, '"');
    jsonStr = jsonStr.replace(/：/g, ':');
    jsonStr = jsonStr.replace(/，/g, ',');
    jsonStr = jsonStr.replace(/【/g, '[');
    jsonStr = jsonStr.replace(/】/g, ']');
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    jsonStr = jsonStr.replace(/"([^"]+)"::/g, '"$1":');
    jsonStr = jsonStr.replace(/"(\w+)"\s*:\s*:/g, '"$1":');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function generateCliffhangerPrompt(
  style: VisualStyle,
  characters: string,
  conflict: string,
  episodeNumber: number,
  storySummary: string,
  genre?: string,
  llmModel?: string
): string {
  const isPetGenre = genre?.includes('宠物') || genre?.includes('萌宠') || genre?.includes('动物');
  const petRules = isPetGenre ? `
【宠物风特殊规则】
1. 角色全部是宠物，绝不能出现人类
2. 画面中禁止出现人的任何部位
3. 所有动作由宠物完成
4. 场景完全宠物化
5. 对话是正常人的语言，但画面中只有宠物
` : '';

  const duration = getVideoModelMaxDuration(undefined);
  const timePoints = '0-3s、3-6s、6-9s、9-11s';

  return `【只输出纯JSON文本，禁止任何图片和非JSON内容】
你是专业的抖音短剧编剧，为第${episodeNumber}集创作结尾悬念。
${getScriptPromptProfile(llmModel).styleDirective}
${petRules}
【悬念是下一集预告，不是正片最后一镜】
- 悬念是下一集的预告片，展示即将发生的新危机
- 悬念是彩蛋，在正片结束后出现的惊喜
- 悬念不是正片最后一镜的重复

【核心规则】
1. 下一集预告：展示新的冲突
2. 时间点描述：使用 0-3s、3-6s、6-9s 等时间格式
3. 意想不到：展示观众没想到的转折
4. 时长固定${duration}秒，4个时间点
5. 直接使用角色名，角色名前加@符号
6. 每句台词控制在15字以内
7. 不添加字幕，不添加BGM

【视觉风格】${style.description}，${style.lighting}，${style.colorTone}色调

【剧本背景】
- 核心冲突：${conflict || '未指定'}
- 主要角色：${characters || '未指定'}
- 本集剧情概要：${storySummary || '未指定'}

【输出格式】
{"location":"场景名称","description":"场景描述","characterList":["角色1","角色2"],"timeDescriptions":{"0-3s":"【全景】场景描述...","3-6s":"【中景】...","6-9s":"【近景】...","9-11s":"【特写】..."},"subtitle":false,"bgm":false}

直接输出JSON，不要加任何前缀或后缀文字！`;
}

/**
 * POST /api/drama/series/[id]/episodes/[episodeNumber]/regenerate-cliffhanger
 * 单独重新生成某集的结尾悬念
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; episodeNumber: string }> }
) {
  try {
    const { id, episodeNumber: epNumStr } = await params;
    const episodeNumber = parseInt(epNumStr, 10);

    if (isNaN(episodeNumber)) {
      return NextResponse.json({ error: '无效的集数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
    }

    // 获取现有剧集数据
    const { data: episode, error: episodeError } = await supabase
      .from('drama_episodes')
      .select('*')
      .eq('series_id', id)
      .eq('episode_number', episodeNumber)
      .single();

    if (episodeError || !episode) {
      return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
    }

    // 获取用户视频模型配置
    const userVideoModel = request.headers.get('x-user-video-model') || 'doubao-seedance-2-0-260128';
    const userId = request.headers.get('x-user-id') || '';
    const userConfig = userId ? await getUserConfig(userId) : null;
    const activeLlmModel = userConfig?.llm_model || DEFAULT_MODELS.llm;
    const genre = series.genre as string || '';
    const style = matchVisualStyle(genre);

    // 构建角色描述
    const charactersDesc = ((series.characters as unknown[]) || []).map((char: unknown) => {
      const c = char as Record<string, unknown>;
      return `${c.name}：${c.gender === 'male' ? '男' : '女'}，${c.age || '?'}岁，${c.temperament || ''}，${c.clothing || ''}`;
    }).join('；');

    const cliffhangerPrompt = generateCliffhangerPrompt(
      style,
      charactersDesc,
      series.core_conflict as string || '',
      episodeNumber,
      (episode.summary as string) || '剧情紧张发展',
      genre,
      activeLlmModel
    );

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 最多重试3次
    let cliffhangerData: Record<string, unknown> | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let cliffhangerContent = '';
        console.log(`[补生悬念] 第${attempt + 1}次尝试生成结尾悬念...`);

        const stream = llmClient.stream(
          [{ role: 'user', content: cliffhangerPrompt }],
          {
            model: activeLlmModel,
            temperature: 0.8 + attempt * 0.1,
          }
        );

        for await (const chunk of stream) {
          if (chunk.content) {
            cliffhangerContent += chunk.content.toString();
          }
        }

        console.log(`[补生悬念] LLM返回内容长度: ${cliffhangerContent.length}`);

        cliffhangerData = parseJsonContent(cliffhangerContent);

        if (cliffhangerData) {
          console.log('[补生悬念] 解析成功');
          break;
        } else {
          console.error(`[补生悬念] 第${attempt + 1}次解析失败，原始内容前500字符: ${cliffhangerContent.substring(0, 500)}`);
        }
      } catch (err) {
        console.error(`[补生悬念] 第${attempt + 1}次生成异常:`, err);
      }

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!cliffhangerData) {
      return NextResponse.json({ error: '结尾悬念生成失败，请重试' }, { status: 500 });
    }

    // 处理cliffhanger数据
    const seriesTitle = series.title as string;
    const cliffhangerName = `${seriesTitle}第${episodeNumber}集结尾`;
    const hookCliffhangerDuration = getVideoModelMaxDuration(userVideoModel);

    const finalCliffhanger = {
      ...cliffhangerData,
      name: cliffhangerName,
      duration: hookCliffhangerDuration,
    };

    // 更新数据库
    const { data: updatedEpisode, error: updateError } = await supabase
      .from('drama_episodes')
      .update({
        cliffhanger: JSON.stringify(finalCliffhanger),
        updated_at: new Date().toISOString(),
      })
      .eq('id', episode.id)
      .select()
      .single();

    if (updateError) {
      console.error('[补生悬念] 更新数据库失败:', updateError);
      return NextResponse.json({ error: '保存失败', details: updateError.message }, { status: 500 });
    }

    console.log('[补生悬念] 成功保存结尾悬念到数据库');

    return NextResponse.json({
      success: true,
      message: '结尾悬念生成成功',
      cliffhanger: updatedEpisode?.cliffhanger,
    });
  } catch (error) {
    console.error('[补生悬念] 接口异常:', error);
    return NextResponse.json(
      { error: '生成失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
