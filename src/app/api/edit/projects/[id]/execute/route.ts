import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoEditClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 执行视频剪辑项目API
 * 使用扣子平台 VideoEditClient 进行云端视频处理
 * 
 * 功能：
 * - 视频裁剪 (trim)
 * - 视频拼接 (concat)
 * - 添加字幕 (subtitles)
 * - 音视频合成 (audio compile)
 * - 提取音频 (extract audio)
 */

interface EditProject {
  id: string;
  title: string;
  status: string;
  config: {
    storyboards?: Array<{
      id: string;
      sequence: number;
      duration: number;
      videoUrl?: string;
      audioUrl?: string;
      dialogue?: { speaker: string; content: string };
      transition?: string;
      assetId?: string;
      asset_id?: string;
    }>;
    subtitleStyle?: {
      font: string;
      color: string;
      position: string;
      animation: string;
    };
    outputFormat?: {
      resolution: '720p' | '1080p' | '4K';
      aspectRatio: '16:9' | '9:16' | '1:1';
      fps: number;
    };
    bgmUrl?: string;
    bgmVolume?: number;
    composePlan?: {
      timeline: Array<{
        id: string;
        source?: string;
        startTime: number;
        endTime: number;
        transition?: string;
        subtitle?: { text: string; start: number; end: number } | null;
      }>;
      audioTracks?: Array<{
        type: string;
        url?: string;
        volume: number;
        fadeIn?: number;
        fadeOut?: number;
      }>;
    };
  };
  edit_assets?: Array<{
    id: string;
    project_id: string;
    file_key?: string;
    file_url?: string;
    file_name?: string;
    type: string;
    order: number;
  }>;
}

// 转场效果ID映射（扣子SDK支持的转场）
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

// 执行剪辑任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  try {
    // 获取项目信息
    const { data: project, error: fetchError } = await supabase
      .from('edit_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // 获取素材关联
    const { data: assets } = await supabase
      .from('edit_assets')
      .select('*')
      .eq('project_id', id)
      .order('order', { ascending: true });

    const projectWithAssets: EditProject = { 
      ...project, 
      config: project.config as EditProject['config'],
      edit_assets: assets || [] 
    };

    // 更新状态为处理中
    await supabase
      .from('edit_projects')
      .update({ status: 'processing', progress: 0 })
      .eq('id', id);

    // 创建扣子SDK客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const videoClient = new VideoEditClient(config, customHeaders);

    // 执行剪辑
    const result = await executeEdit(videoClient, projectWithAssets, async (progress) => {
      await supabase
        .from('edit_projects')
        .update({ progress })
        .eq('id', id);
    });

    if (result.success && result.outputUrl) {
      // 更新项目
      const { data: updatedProject } = await supabase
        .from('edit_projects')
        .update({
          status: 'completed',
          progress: 100,
          output_file_url: result.outputUrl,
          output_file_name: `${project.title}.mp4`,
          duration: result.duration,
        })
        .eq('id', id)
        .select()
        .single();

      return NextResponse.json({
        success: true,
        project: { ...updatedProject, outputUrl: result.outputUrl },
      });
    } else {
      await supabase
        .from('edit_projects')
        .update({
          status: 'error',
          error_message: result.error,
        })
        .eq('id', id);

      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('剪辑执行失败:', error);
    
    await supabase
      .from('edit_projects')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : '未知错误',
      })
      .eq('id', id);

    return NextResponse.json(
      { error: '剪辑执行失败' },
      { status: 500 }
    );
  }
}

// 执行剪辑（使用扣子SDK）
async function executeEdit(
  videoClient: VideoEditClient,
  project: EditProject,
  onProgress: (progress: number) => Promise<void>
): Promise<{ 
  success: boolean; 
  outputUrl?: string; 
  duration?: number; 
  error?: string 
}> {
  try {
    const { config, edit_assets } = project;
    const storyboards = config.storyboards || [];
    const composePlan = config.composePlan;
    
    if (storyboards.length === 0) {
      return { success: false, error: '没有可处理的分镜' };
    }

    await onProgress(10);

    // 构建视频URL列表
    const videoUrls: string[] = [];
    const transitions: string[] = [];
    const textItems: Array<{ start_time: number; end_time: number; text: string }> = [];
    
    let currentTime = 0;

    for (let i = 0; i < storyboards.length; i++) {
      const sb = storyboards[i];
      
      // 获取视频URL
      let videoUrl = sb.videoUrl;
      if (!videoUrl) {
        // 从素材中查找
        const assetId = sb.assetId || sb.asset_id;
        const asset = edit_assets?.find(a => a.id === assetId);
        videoUrl = asset?.file_url;
      }
      
      if (!videoUrl) {
        console.warn(`分镜${i + 1}没有视频素材，跳过`);
        continue;
      }

      videoUrls.push(videoUrl);

      // 添加转场效果
      if (i > 0 && sb.transition) {
        const transitionId = TRANSITION_MAP[sb.transition.toLowerCase()] || TRANSITION_MAP['fade'];
        transitions.push(transitionId);
      }

      // 添加字幕文本
      if (sb.dialogue?.content) {
        textItems.push({
          start_time: currentTime + 0.5,
          end_time: currentTime + sb.duration - 0.5,
          text: sb.dialogue.content,
        });
      }

      currentTime += sb.duration;
    }

    await onProgress(30);

    if (videoUrls.length === 0) {
      return { success: false, error: '没有有效的视频素材' };
    }

    let resultUrl: string;

    // 步骤1: 视频拼接（如果有多个视频）
    if (videoUrls.length > 1) {
      console.log(`[视频剪辑] 拼接 ${videoUrls.length} 个视频...`);
      
      const concatResponse = await videoClient.concatVideos(videoUrls, {
        transitions: transitions.length > 0 ? transitions : undefined,
      });
      
      resultUrl = concatResponse.url;
      console.log(`[视频剪辑] 拼接完成: ${resultUrl}`);
    } else {
      resultUrl = videoUrls[0];
    }

    await onProgress(50);

    // 步骤2: 添加字幕（如果有字幕）
    if (textItems.length > 0 && config.subtitleStyle) {
      console.log(`[视频剪辑] 添加 ${textItems.length} 条字幕...`);
      
      const subtitleConfig = {
        font_pos_config: {
          pos_x: '0',
          pos_y: '90%',
          width: '100%',
          height: '10%',
        },
        font_size: 36,
        font_color: config.subtitleStyle.color?.includes('白') ? '#FFFFFFFF' : '#FFFFFFFF',
        font_type: FONT_MAP[config.subtitleStyle.font] || 'SY_Black',
        background_color: '#00000000',
        border_width: 1,
        border_color: '#00000088',
      };

      const subtitleResponse = await videoClient.addSubtitles(resultUrl, subtitleConfig, {
        textList: textItems,
      });
      
      resultUrl = subtitleResponse.url;
      console.log(`[视频剪辑] 字幕添加完成: ${resultUrl}`);
    }

    await onProgress(70);

    // 步骤3: 添加BGM（如果有）
    if (config.bgmUrl || (composePlan?.audioTracks && composePlan.audioTracks.length > 0)) {
      const bgmUrl = config.bgmUrl || composePlan?.audioTracks?.[0]?.url;
      
      if (bgmUrl) {
        console.log(`[视频剪辑] 添加背景音乐...`);
        
        const audioResponse = await videoClient.compileVideoAudio(resultUrl, bgmUrl, {
          isAudioReserve: true, // 保留原视频音轨
        });
        
        resultUrl = audioResponse.url;
        console.log(`[视频剪辑] BGM添加完成: ${resultUrl}`);
      }
    }

    await onProgress(90);

    // 计算总时长
    const totalDuration = storyboards.reduce((sum, sb) => sum + sb.duration, 0);

    return { 
      success: true, 
      outputUrl: resultUrl, 
      duration: totalDuration 
    };
  } catch (error) {
    console.error('[视频剪辑] 处理失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '处理失败',
    };
  }
}

// GET - 获取项目状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: project, error } = await supabase
    .from('edit_projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: '项目不存在' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    project,
  });
}
