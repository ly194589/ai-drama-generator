import { NextRequest, NextResponse } from 'next/server';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';

/**
 * 智谱TTS API - 新一代智谱语音大模型
 * 使用 GLM-TTS 或 GLM-TTS-Clone 模型
 * 
 * 文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts
 * 速率限制: GLM-TTS 20 RPM, GLM-TTS-Clone 10 RPM
 * 
 * 核心特性：
 * - 以新一代智谱语音大模型为核心
 * - 突破传统语音合成框架
 * - 上下文智能预判文本情绪与语调
 * - 显著提升语音自然度与表现力
 * - 合成语音具备真实情感与生命力
 * - 两阶段生成架构
 * - GRPO强化学习方案
 * - 字错误率和情感表达开源SOTA
 * 
 * POST /api/zhipu/tts
 * Body: {
 *   text: string,                           // 要转换的文本
 *   voice?: string,                         // 预设音色或自定义音色ID
 *   voiceId?: string,                       // 克隆音色ID（优先级高于voice）
 *   speed?: number,                         // 语速：0.25 ~ 4.0
 *   response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',  // 输出格式
 * }
 * 
 * 预设音色说明：
 * - alloy: 中性音色，适合通用场景
 * - echo: 男声，适合旁白解说
 * - fable: 女声，适合故事讲述
 * - onyx: 深沉男声，适合严肃内容
 * - nova: 活力女声，适合角色配音
 * - shimmer: 温柔女声，适合情感内容
 * 
 * 自定义音色：
 * - 使用 /api/zhipu/voice-clone/create 创建音色
 * - 使用返回的 voiceId 进行语音合成
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const configured = await isZhipuConfiguredForUser(userId);
    
    if (!configured) {
      return NextResponse.json(
        { error: '智谱API未配置，请在方案设置中配置 API Key' },
        { status: 400 }
      );
    }

    const { 
      text, 
      voice = 'alloy',
      voiceId,  // 克隆音色ID（优先级高于voice）
      speed,
      response_format = 'mp3',
    } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'text 参数必填' },
        { status: 400 }
      );
    }

    // 如果提供了 voiceId，使用克隆音色
    if (voiceId) {
      console.log(`[智谱TTS] 使用克隆音色: ${voiceId}`);
      
      const client = await getZhipuClientAsync(userId);
      const audioBuffer = await client.textToSpeechWithClone(text, voiceId, {
        speed,
        response_format,
      });

      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        opus: 'audio/opus',
        aac: 'audio/aac',
        flac: 'audio/flac',
        wav: 'audio/wav',
        pcm: 'audio/pcm',
      };

      return NextResponse.json({
        success: true,
        model: 'glm-tts-clone',
        audioData: audioBase64,
        mimeType: mimeTypes[response_format] || 'audio/mpeg',
        size: audioBuffer.byteLength,
        voiceId,
        speed: speed || 1.0,
        format: response_format,
      });
    }

    // 使用预设音色
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      return NextResponse.json(
        { error: `无效的音色: ${voice}，可选值: ${validVoices.join(', ')}` },
        { status: 400 }
      );
    }

    // 验证语速
    if (speed !== undefined && (speed < 0.25 || speed > 4.0)) {
      return NextResponse.json(
        { error: '语速范围: 0.25 ~ 4.0' },
        { status: 400 }
      );
    }

    const client = await getZhipuClientAsync(userId);
    
    // 获取音频数据（ArrayBuffer）
    const audioBuffer = await client.textToSpeech(text, { 
      voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      speed,
      response_format: response_format as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',
    });
    
    // 转换为Base64
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // 根据格式设置MIME类型
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      opus: 'audio/opus',
      aac: 'audio/aac',
      flac: 'audio/flac',
      wav: 'audio/wav',
      pcm: 'audio/pcm',
    };

    console.log(`[智谱TTS] 合成成功`, {
      textLength: text.length,
      voice,
      speed: speed || 1.0,
      format: response_format,
      audioSize: audioBuffer.byteLength,
    });

    return NextResponse.json({
      success: true,
      model: 'glm-tts',
      audioData: audioBase64,
      mimeType: mimeTypes[response_format] || 'audio/mpeg',
      size: audioBuffer.byteLength,
      voice,
      speed: speed || 1.0,
      format: response_format,
    });

  } catch (error) {
    console.error('[智谱TTS] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '语音合成失败' },
      { status: 500 }
    );
  }
}
