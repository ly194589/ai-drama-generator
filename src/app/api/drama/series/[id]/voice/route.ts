import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 获取剧本下所有角色的配音配置
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: voices, error } = await supabase
      .from('character_voices')
      .select('*')
      .eq('series_id', id);

    if (error) {
      console.error('获取配音配置失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      voices: voices || [],
    });
  } catch (error) {
    console.error('获取配音配置失败:', error);
    return NextResponse.json(
      { error: '获取配音配置失败' },
      { status: 500 }
    );
  }
}

// 为角色生成配音配置
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { characterId, characterName, voiceId, voiceName, voiceStyle } = body;

    if (!characterId || !characterName) {
      return NextResponse.json(
        { error: '请提供角色ID和名称' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 检查是否已有配置
    const { data: existing } = await supabase
      .from('character_voices')
      .select('*')
      .eq('series_id', id)
      .eq('character_id', characterId)
      .single();

    let voice;
    
    if (existing) {
      // 更新现有配置
      const { data, error } = await supabase
        .from('character_voices')
        .update({
          voice_id: voiceId,
          voice_name: voiceName || voiceId,
          voice_style: voiceStyle || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('更新配音配置失败:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }
      voice = data;
    } else {
      // 创建新配置
      const { data, error } = await supabase
        .from('character_voices')
        .insert({
          series_id: id,
          character_id: characterId,
          character_name: characterName,
          voice_id: voiceId,
          voice_name: voiceName || voiceId,
          voice_style: voiceStyle || '',
        })
        .select()
        .single();

      if (error) {
        console.error('保存配音配置失败:', error);
        return NextResponse.json({ error: '保存失败' }, { status: 500 });
      }
      voice = data;
    }

    return NextResponse.json({
      success: true,
      voice,
    });
  } catch (error) {
    console.error('保存配音配置失败:', error);
    return NextResponse.json(
      { error: '保存配音配置失败' },
      { status: 500 }
    );
  }
}

// 生成BGM推荐
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sceneDescription, emotion, duration } = body;

    const supabase = getSupabaseClient();

    // 获取剧本信息
    const { data: series } = await supabase
      .from('drama_series')
      .select('*')
      .eq('id', id)
      .single();

    // 初始化LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 生成BGM推荐
    const bgmPrompt = `你是一个专业的音乐制作人。请为以下短剧场景推荐背景音乐。

【剧本信息】
题材：${series?.genre || ''}
风格：${series?.style || ''}

【场景需求】
场景描述：${sceneDescription || '未指定'}
情绪基调：${emotion || '未指定'}
时长：${duration || 30}秒

【要求】
请提供BGM创作建议，包括：
1. 音乐风格
2. 节奏（快/中/慢）
3. 主要乐器
4. 情绪变化
5. 音量建议（相对于人声）

请以JSON格式输出：
{
  "style": "音乐风格",
  "tempo": "节奏",
  "instruments": ["乐器1", "乐器2"],
  "emotionCurve": "情绪变化描述",
  "volume": "-24 LUFS",
  "description": "音乐描述"
}`;

    const response = await llmClient.invoke([
      { role: 'user', content: bgmPrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    let bgmConfig = {};
    
    if (response?.content) {
      const content = response.content.trim();
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          bgmConfig = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('解析BGM配置失败:', e);
      }
    }

    return NextResponse.json({
      success: true,
      bgm: bgmConfig,
    });
  } catch (error) {
    console.error('生成BGM推荐失败:', error);
    return NextResponse.json(
      { error: '生成BGM推荐失败' },
      { status: 500 }
    );
  }
}
