import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 智能剪辑分析API
 * 分析素材，自动生成剪辑方案
 * 
 * 功能：
 * 1. 情绪节奏分析 - 分析视频情绪曲线，识别高潮点
 * 2. 智能转场推荐 - 根据场景变化推荐最佳转场
 * 3. 音乐节拍同步 - 分析BGM节拍，自动对齐剪辑点
 * 4. 字幕样式匹配 - 根据情绪推荐字幕样式
 * 5. 一键成片方案 - 自动生成完整剪辑方案
 */

interface Storyboard {
  id: string;
  sequence: number;
  duration: number;
  shotType: string;
  scene: { location: string; description: string };
  characters: Array<{ name: string; action: string; expression: string }>;
  dialogue?: { speaker: string; content: string; emotion: string };
  atmosphere: { mood: string; tension: number };
  audio: { bgm: string; soundEffects: string[] };
  videoUrl?: string;
}

interface EditingAnalysis {
  emotionalArc: Array<{ time: number; emotion: string; intensity: number }>;
  rhythmPoints: Array<{ time: number; type: string; description: string }>;
  transitionSuggestions: Array<{ from: string; to: string; type: string; reason: string }>;
  subtitleStyle: { font: string; color: string; position: string; animation: string };
  musicSync: Array<{ time: number; beat: number; action: string }>;
  recommendedCuts: Array<{ time: number; reason: string; priority: 'high' | 'medium' | 'low' }>;
}

const EDITING_ANALYSIS_PROMPT = `你是专业的视频剪辑师，擅长分析短剧素材并生成最佳剪辑方案。

【分析任务】
分析以下分镜素材，生成专业的剪辑建议：

{storyboards}

【分析维度】
1. 情绪节奏曲线：分析每个分镜的情绪强度，标记高潮点
2. 节奏锚点：识别需要强调的关键时刻
3. 转场建议：根据场景和情绪变化推荐转场类型
4. 字幕样式：根据情绪基调推荐字幕风格
5. 音乐同步：建议BGM切换点

【输出格式】严格JSON：
{
  "emotionalArc": [
    { "time": 0, "emotion": "平静", "intensity": 3 },
    { "time": 15, "emotion": "紧张", "intensity": 7 }
  ],
  "rhythmPoints": [
    { "time": 5, "type": "hook", "description": "开场钩子" },
    { "time": 90, "type": "climax", "description": "情绪高潮" }
  ],
  "transitionSuggestions": [
    { "from": "分镜1", "to": "分镜2", "type": "淡入淡出", "reason": "场景切换" }
  ],
  "subtitleStyle": {
    "font": "思源黑体",
    "color": "白色+灰边",
    "position": "底部居中",
    "animation": "淡入"
  },
  "musicSync": [
    { "time": 0, "beat": 1, "action": "音乐渐起" }
  ],
  "recommendedCuts": [
    { "time": 25, "reason": "情绪转换点", "priority": "high" }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storyboards, projectId } = body as {
      storyboards: Storyboard[];
      projectId?: string;
    };

    if (!storyboards || storyboards.length === 0) {
      return NextResponse.json({ error: '请提供分镜素材' }, { status: 400 });
    }

    // 格式化分镜数据
    const storyboardsText = storyboards.map((sb, index) => {
      const scene = typeof sb.scene === 'string' ? sb.scene : sb.scene?.description || '未知场景';
      const characters = sb.characters?.map(c => c.name).join(', ') || '无';
      const dialogue = sb.dialogue 
        ? (typeof sb.dialogue === 'string' ? sb.dialogue : `${sb.dialogue.speaker}: ${sb.dialogue.content}`)
        : '无台词';
      const mood = sb.atmosphere?.mood || '未知';
      const tension = sb.atmosphere?.tension || 5;
      
      return `【分镜${index + 1}】时长${sb.duration}s | ${sb.shotType}
场景：${scene}
人物：${characters}
台词：${dialogue}
氛围：${mood}（紧张度${tension}/10）
BGM：${sb.audio?.bgm || '无'}`;
    }).join('\n\n');

    // 调用LLM分析
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const prompt = EDITING_ANALYSIS_PROMPT.replace('{storyboards}', storyboardsText);

    const response = await client.invoke([
      { role: 'system', content: '你是专业的视频剪辑分析师，精通短剧剪辑艺术。输出必须是严格的JSON格式。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.3, // 低温度确保分析稳定
    });

    // 解析结果
    let analysis: EditingAnalysis;
    try {
      const content = response.content;
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        analysis = JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } else {
        throw new Error('未找到有效JSON');
      }
    } catch (e) {
      console.error('解析剪辑分析结果失败:', e);
      // 返回默认分析
      analysis = generateDefaultAnalysis(storyboards);
    }

    // 保存分析结果
    const supabase = getSupabaseClient();
    
    if (projectId) {
      await supabase
        .from('edit_projects')
        .update({
          config: {
            analysis,
            storyboards,
            analyzedAt: new Date().toISOString()
          }
        })
        .eq('id', projectId);
    }

    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        totalDuration: storyboards.reduce((sum, sb) => sum + (sb.duration || 5), 0),
        storyboardCount: storyboards.length,
        peakEmotion: analysis.emotionalArc?.reduce((max, p) => 
          p.intensity > max.intensity ? p : max, analysis.emotionalArc[0] || { intensity: 0, emotion: '未知' }
        ),
        highPriorityCuts: analysis.recommendedCuts?.filter(c => c.priority === 'high').length || 0
      }
    });

  } catch (error) {
    console.error('剪辑分析失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 }
    );
  }
}

// 生成默认分析结果
function generateDefaultAnalysis(storyboards: Storyboard[]): EditingAnalysis {
  const totalDuration = storyboards.reduce((sum, sb) => sum + (sb.duration || 5), 0);
  
  return {
    emotionalArc: storyboards.map((sb, index) => ({
      time: index * 5,
      emotion: sb.atmosphere?.mood || '平静',
      intensity: sb.atmosphere?.tension || 5
    })),
    rhythmPoints: [
      { time: 0, type: 'hook', description: '开场钩子' },
      { time: Math.floor(totalDuration * 0.3), type: 'conflict', description: '第一次冲突' },
      { time: Math.floor(totalDuration * 0.6), type: 'climax', description: '情绪高潮' },
      { time: totalDuration - 10, type: 'cliffhanger', description: '结尾悬念' }
    ],
    transitionSuggestions: storyboards.slice(0, -1).map((sb, index) => ({
      from: `分镜${index + 1}`,
      to: `分镜${index + 2}`,
      type: '淡入淡出',
      reason: '平滑过渡'
    })),
    subtitleStyle: {
      font: '思源黑体',
      color: '白色+灰边',
      position: '底部居中',
      animation: '淡入'
    },
    musicSync: [],
    recommendedCuts: []
  };
}
