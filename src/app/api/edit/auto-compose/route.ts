import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, VideoEditClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { DEFAULT_MODELS } from '@/lib/config';

/**
 * 一键成片API
 * 使用扣子平台SDK进行云端视频合成
 * 
 * 流程：
 * 1. 加载分镜和素材
 * 2. 调用LLM生成合成方案
 * 3. 使用VideoEditClient进行视频拼接、字幕、音频合成
 * 4. 返回合成结果
 */

interface ComposeConfig {
  storyboards: Array<{
    id: string;
    sequence: number;
    duration: number;
    videoUrl?: string;
    dialogue?: { speaker: string; content: string };
    transition?: string;
  }>;
  subtitleStyle: {
    font: string;
    color: string;
    position: string;
    animation: string;
  };
  bgmUrl?: string;
  bgmVolume?: number;
  outputFormat: {
    resolution: '720p' | '1080p' | '4K';
    aspectRatio: '16:9' | '9:16' | '1:1';
    fps: number;
  };
}

interface Storyboard {
  id: string;
  sequence: number;
  duration: number;
  shotType: string;
  scene: { location: string; description: string } | string;
  characters: Array<{ name: string; action: string; expression: string }>;
  dialogue?: { speaker: string; content: string; emotion: string } | string;
  atmosphere: { mood: string; tension: number };
  audio: { bgm: string; soundEffects: string[] };
  videoUrl?: string;
}

// 转场效果ID映射
const TRANSITION_MAP: Record<string, string> = {
  'fade': '1182355',       // 叶片翻转
  'fade-in': '1182356',    // 百叶窗
  'fade-out': '1182356',
  'dissolve': '1182357',   // 风吹
  'wipe': '1182371',       // 对角擦除
  'zoom': '1182360',       // 旋转放大
  'slide': '1182359',      // 交替出场
  'circle': '1182376',     // 圆形打开
  'heart': '1182366',      // 心型打开
  'glitch': '1182367',     // 故障转换
  'cube': '1182373',       // 立方转换
};

// 字体ID映射
const FONT_MAP: Record<string, string> = {
  '思源黑体': 'SY_Black',
  '方正兰亭黑': '1234271',
  '站酷酷黑体': '1187219',
  '阿里巴巴普惠体': 'ALi_PuHui',
};

const COMPOSE_PROMPT = `你是视频剪辑合成专家。根据以下信息生成合成方案：

【分镜列表】
{storyboards}

【字幕样式】
{subtitleStyle}

【输出格式】
- 分辨率：{resolution}
- 比例：{aspectRatio}
- 帧率：{fps}fps

【输出要求】
生成一个完整的合成方案JSON：
{
  "timeline": [
    {
      "id": "clip-1",
      "source": "视频URL或分镜ID",
      "startTime": 0,
      "endTime": 5,
      "transition": "fade",
      "subtitle": { "text": "台词", "start": 0.5, "end": 4.5 }
    }
  ],
  "audioTracks": [
    {
      "type": "bgm",
      "url": "BGM URL",
      "volume": 0.3,
      "fadeIn": 1,
      "fadeOut": 2
    }
  ],
  "outputConfig": {
    "resolution": "1080x1920",
    "codec": "h264",
    "bitrate": "8M"
  },
  "estimatedDuration": 300
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      projectId, 
      seriesId, 
      episodeId,
      config: customConfig,
      execute = false // 是否立即执行合成
    } = body;

    const supabase = getSupabaseClient();

    // 加载项目配置
    let config: ComposeConfig;
    let storyboards: Storyboard[] = [];
    
    if (customConfig) {
      config = customConfig;
      storyboards = customConfig.storyboards || [];
    } else if (projectId) {
      const { data: project } = await supabase
        .from('edit_projects')
        .select('config')
        .eq('id', projectId)
        .single();
      
      if (!project?.config) {
        return NextResponse.json({ error: '项目配置不存在' }, { status: 404 });
      }
      config = project.config as ComposeConfig;
      storyboards = (project.config as Record<string, unknown>).storyboards as Storyboard[] || [];
    } else if (seriesId && episodeId) {
      // 从剧集加载
      const { data: episode } = await supabase
        .from('drama_episodes')
        .select('storyboards')
        .eq('id', episodeId)
        .single();
      
      if (!episode?.storyboards) {
        return NextResponse.json({ error: '剧集分镜不存在' }, { status: 404 });
      }
      
      storyboards = episode.storyboards as Storyboard[];
      config = {
        storyboards: storyboards.map((sb, index) => ({
          id: sb.id,
          sequence: index + 1,
          duration: sb.duration || 5,
          videoUrl: sb.videoUrl,
          dialogue: typeof sb.dialogue === 'string' 
            ? { speaker: '', content: sb.dialogue } 
            : sb.dialogue,
        })),
        subtitleStyle: {
          font: '思源黑体',
          color: '白色+灰边',
          position: '底部居中',
          animation: '淡入'
        },
        outputFormat: {
          resolution: '1080p',
          aspectRatio: '9:16',
          fps: 30
        }
      };
    } else {
      return NextResponse.json({ error: '请提供项目ID或配置' }, { status: 400 });
    }

    // 提取转发头用于SDK认证
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const sdkConfig = new Config();

    // 调用LLM生成合成方案
    const llmClient = new LLMClient(sdkConfig, customHeaders);

    const storyboardsText = config.storyboards.map((sb, index) => 
      `分镜${index + 1}：时长${sb.duration}s，${sb.transition || '无转场'}，台词：${sb.dialogue?.content || '无'}`
    ).join('\n');

    const prompt = COMPOSE_PROMPT
      .replace('{storyboards}', storyboardsText)
      .replace('{subtitleStyle}', JSON.stringify(config.subtitleStyle))
      .replace('{resolution}', config.outputFormat.resolution)
      .replace('{aspectRatio}', config.outputFormat.aspectRatio)
      .replace('{fps}', String(config.outputFormat.fps));

    const response = await llmClient.invoke([
      { role: 'system', content: '你是视频合成专家，精通视频剪辑和编码。输出必须是严格的JSON格式。' },
      { role: 'user', content: prompt }
    ], {
      model: DEFAULT_MODELS.llm,
      temperature: 0.2
    });

    // 解析合成方案
    let composePlan: Record<string, unknown>;
    try {
      const content = response.content;
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        composePlan = JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } else {
        throw new Error('未找到有效JSON');
      }
    } catch (e) {
      console.error('解析合成方案失败:', e);
      // 生成默认方案
      composePlan = generateDefaultComposePlan(config);
    }

    // 检查是否有视频素材需要生成
    const missingVideos = config.storyboards.filter(sb => !sb.videoUrl);
    
    if (missingVideos.length > 0) {
      composePlan = {
        ...composePlan,
        needsVideoGeneration: true,
        missingVideos: missingVideos.map(sb => sb.id)
      };
    }

    // 保存合成计划
    if (projectId) {
      await supabase
        .from('edit_projects')
        .update({
          config: {
            ...config,
            composePlan,
            status: 'ready'
          }
        })
        .eq('id', projectId);
    }

    // 如果请求立即执行且有视频素材
    let executeResult = null;
    if (execute && missingVideos.length === 0) {
      executeResult = await executeCompose(sdkConfig, customHeaders, config, composePlan);
    }

    return NextResponse.json({
      success: true,
      composePlan,
      summary: {
        totalClips: config.storyboards.length,
        estimatedDuration: (composePlan.estimatedDuration as number) || config.storyboards.reduce((sum, sb) => sum + sb.duration, 0),
        hasSubtitles: config.storyboards.some(sb => sb.dialogue),
        needsVideoGeneration: missingVideos.length > 0,
        missingVideoCount: missingVideos.length
      },
      executeResult
    });

  } catch (error) {
    console.error('生成合成方案失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}

// 执行合成（使用扣子SDK）
async function executeCompose(
  config: Config,
  customHeaders: Record<string, string>,
  composeConfig: ComposeConfig,
  composePlan: Record<string, unknown>
): Promise<{ success: boolean; outputUrl?: string; error?: string }> {
  try {
    const videoClient = new VideoEditClient(config, customHeaders);
    
    const { storyboards, subtitleStyle, bgmUrl } = composeConfig;
    const timeline = composePlan.timeline as Array<{
      id: string;
      source?: string;
      startTime: number;
      endTime: number;
      transition?: string;
      subtitle?: { text: string; start: number; end: number } | null;
    }> || [];

    // 收集视频URL
    const videoUrls: string[] = [];
    const transitions: string[] = [];

    for (let i = 0; i < storyboards.length; i++) {
      const sb = storyboards[i];
      if (sb.videoUrl) {
        videoUrls.push(sb.videoUrl);
        
        // 转场效果
        if (i > 0 && sb.transition) {
          const transitionId = TRANSITION_MAP[sb.transition.toLowerCase()] || TRANSITION_MAP['fade'];
          transitions.push(transitionId);
        }
      }
    }

    if (videoUrls.length === 0) {
      return { success: false, error: '没有可用的视频素材' };
    }

    // 步骤1: 视频拼接
    let resultUrl: string;
    
    if (videoUrls.length > 1) {
      const concatResponse = await videoClient.concatVideos(videoUrls, {
        transitions: transitions.length > 0 ? transitions : undefined,
      });
      resultUrl = concatResponse.url;
    } else {
      resultUrl = videoUrls[0];
    }

    // 步骤2: 添加字幕
    const subtitleItems = timeline
      .filter(t => t.subtitle)
      .map(t => ({
        start_time: t.subtitle!.start,
        end_time: t.subtitle!.end,
        text: t.subtitle!.text,
      }));

    if (subtitleItems.length > 0) {
      const subtitleConfig = {
        font_pos_config: {
          pos_x: '0',
          pos_y: '90%',
          width: '100%',
          height: '10%',
        },
        font_size: 36,
        font_color: subtitleStyle.color?.includes('白') ? '#FFFFFFFF' : '#FFFFFFFF',
        font_type: FONT_MAP[subtitleStyle.font] || 'SY_Black',
        background_color: '#00000000',
        border_width: 1,
        border_color: '#00000088',
      };

      const subtitleResponse = await videoClient.addSubtitles(resultUrl, subtitleConfig, {
        textList: subtitleItems,
      });
      resultUrl = subtitleResponse.url;
    }

    // 步骤3: 添加BGM
    if (bgmUrl) {
      const audioResponse = await videoClient.compileVideoAudio(resultUrl, bgmUrl, {
        isAudioReserve: true,
      });
      resultUrl = audioResponse.url;
    }

    return { success: true, outputUrl: resultUrl };
  } catch (error) {
    console.error('执行合成失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '合成失败' 
    };
  }
}

// 生成默认合成方案
function generateDefaultComposePlan(config: ComposeConfig): Record<string, unknown> {
  const totalDuration = config.storyboards.reduce((sum, sb) => sum + sb.duration, 0);
  
  let currentTime = 0;
  const timeline = config.storyboards.map((sb, index) => {
    const clip = {
      id: `clip-${index + 1}`,
      source: sb.videoUrl || sb.id,
      startTime: currentTime,
      endTime: currentTime + sb.duration,
      transition: sb.transition || 'fade',
      subtitle: sb.dialogue ? {
        text: sb.dialogue.content,
        start: currentTime + 0.5,
        end: currentTime + sb.duration - 0.5
      } : null
    };
    currentTime += sb.duration;
    return clip;
  });

  return {
    timeline,
    audioTracks: [{
      type: 'bgm',
      volume: config.bgmVolume || 0.3,
      fadeIn: 1,
      fadeOut: 2
    }],
    outputConfig: {
      resolution: config.outputFormat.aspectRatio === '9:16' ? '1080x1920' : '1920x1080',
      codec: 'h264',
      bitrate: '8M'
    },
    estimatedDuration: totalDuration
  };
}
