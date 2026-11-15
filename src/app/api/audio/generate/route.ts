import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { TTSClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import { parseQualityLevel, getTTSQuality } from '@/lib/quality-config';
import { DEFAULT_MODELS, TTS_SPEAKERS, SOLUTION_PRESETS, SolutionType } from '@/lib/config';
import { getQwenClientAsync, isQwenConfiguredForUser } from '@/lib/qwen-client';
import { getUserMemberTier } from '@/lib/quota-service';
import { enforceAudioSampleRate, getVoiceOptionsLevel, getMemberLimitsDescription } from '@/lib/member-limits';
import { hasDatabaseConfig, getLocalUserConfig } from '@/lib/server-config-store';
import { getCompatibleProviderConfig } from '@/lib/openai-compatible-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 获取用户的方案选择与配音厂商设置
 * 优先使用用户在模型设置中选择的配音厂商（tts_provider），旧数据按方案兜底
 */
async function getUserTtsProvider(userId: string): Promise<'zhipu' | 'qwen' | 'custom' | 'standard'> {
  let data: Record<string, unknown> | null = null;
  if (hasDatabaseConfig()) {
    const supabase = getSupabaseClient();
    const result = await supabase
      .from('user_config')
      .select('solution_preset, tts_provider, tts_speaker')
      .eq('user_id', userId)
      .single();
    data = (result.data as unknown as Record<string, unknown>) || null;
  } else {
    // 未配置数据库：读取本地兜底存储
    data = getLocalUserConfig(userId);
  }

  const preset = data?.solution_preset;
  const provider = data?.tts_provider;

  // 用户显式选择过配音厂商时优先使用
  if (provider === 'zhipu') return 'zhipu';
  if (provider === 'qwen') return 'qwen';
  if (provider === 'custom') return 'custom';
  if (provider === 'coze') return 'standard';

  // 兼容旧数据：按已保存的音色名识别厂商
  const savedSpeaker = data?.tts_speaker as string | undefined;
  if (savedSpeaker === 'glm-tts') return 'zhipu';
  if (savedSpeaker === 'qwen3-tts-vd') return 'qwen';

  if (preset === 'zhipu') return 'zhipu';
  if (preset === 'qwen') return 'qwen';
  return 'standard';
}

/**
 * AI生成配音/语音
 * 根据用户方案选择模型：
 * - standard: 扣子内置 TTS
 * - zhipu: 智谱 TTS（待实现）
 * - qwen: 千问 TTS
 * - custom: 自定义 OpenAI 兼容端点（/audio/speech）
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserTtsProvider(userId);

    // 获取用户会员等级并强制应用限制
    const memberTier = await getUserMemberTier(userId);
    const limitsDescription = getMemberLimitsDescription(memberTier);
    const voiceLevel = getVoiceOptionsLevel(memberTier);

    console.log(`[TTS] 方案: ${solution}, 会员等级: ${memberTier}, 音色等级: ${voiceLevel}`);
    console.log(`[TTS] 限制: ${limitsDescription.audio}`);

    const body = await request.json();
    const {
      text,
      speaker, // 可选，不传则使用默认语音
      audioFormat = 'mp3',
      sampleRate,  // 可选，优先级高于quality
      speechRate = 1.0,
      pitchRate = 1.0,
      title,
      characterName,
      characterId,
      quality,  // 质量等级：test/standard/premium
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: '请提供要合成的文本' },
        { status: 400 }
      );
    }

    // 解析质量等级
    const qualityLevel = parseQualityLevel(quality);
    const qualityConfig = getTTSQuality(qualityLevel);

    // 强制应用会员等级限制
    const requestedSampleRate = sampleRate || qualityConfig.sampleRate;
    const finalSampleRate = enforceAudioSampleRate(memberTier, requestedSampleRate);

    // 根据方案选择 TTS 模型
    const model = solution === 'zhipu'
      ? SOLUTION_PRESETS.zhipu.models.tts
      : solution === 'qwen'
        ? SOLUTION_PRESETS.qwen.models.tts
        : DEFAULT_MODELS.tts;

    // 根据方案调用不同的 TTS 服务
    if (solution === 'custom') {
      // 自定义厂商 - OpenAI 兼容 /audio/speech
      return await generateWithCustom(userId, {
        text,
        speaker,
        audioFormat,
        sampleRate: finalSampleRate,
        speechRate,
        title,
        characterName,
        characterId,
        qualityLevel,
        memberTier,
        voiceLevel,
      });
    } else if (solution === 'qwen') {
      // 千问方案 - 暂时使用扣子 TTS（千问 TTS API 需要特殊配置）
      console.log('[TTS] 千问方案：使用扣子 TTS（千问 TTS API 待配置）');
      return await generateWithCoze(request, {
        text,
        speaker,
        audioFormat,
        sampleRate: finalSampleRate,
        speechRate,
        loudnessRate: pitchRate,
        title: title || '千问方案TTS',
        characterName,
        characterId,
        qualityLevel,
        memberTier,
        voiceLevel,
      });
    } else if (solution === 'zhipu') {
      // 智谱方案 - 待实现
      return NextResponse.json(
        { error: '智谱 TTS 暂未实现，请使用扣子方案或千问方案' },
        { status: 501 }
      );
    } else {
      // 扣子方案 - 使用扣子内置 TTS
      return await generateWithCoze(request, {
        text,
        speaker,
        audioFormat,
        sampleRate: finalSampleRate,
        speechRate,
        loudnessRate: pitchRate,
        title,
        characterName,
        characterId,
        qualityLevel,
        memberTier,
        voiceLevel,
      });
    }

  } catch (error) {
    console.error('[TTS] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI配音生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 使用自定义 OpenAI 兼容端点生成语音（/audio/speech）
 *
 * 用户在「模型设置 → 配音语音模型 → 自定义」中配置 API Key 与端点地址，
 * 添加的自定义音色 ID 作为 voice 参数；语音模型默认 tts-1（OpenAI 兼容标准）。
 */
async function generateWithCustom(
  userId: string,
  params: {
    text: string;
    speaker?: string;
    audioFormat: string;
    sampleRate: number;
    speechRate: number;
    title?: string;
    characterName?: string;
    characterId?: string;
    qualityLevel: string;
    memberTier: string;
    voiceLevel: string;
  }
) {
  const {
    text,
    speaker,
    audioFormat,
    sampleRate,
    speechRate,
    title,
    characterName,
    characterId,
    qualityLevel,
    memberTier,
    voiceLevel,
  } = params;

  const config = await getCompatibleProviderConfig(userId, 'custom');
  if (!config) {
    return NextResponse.json(
      { error: '自定义端点未配置，请在模型设置的配音分类下填写 API Key 与接口地址' },
      { status: 400 }
    );
  }
  if (!config.baseUrl) {
    return NextResponse.json(
      { error: '自定义端点地址未配置，请在模型设置中填写接口地址（如 https://your-endpoint/v1）' },
      { status: 400 }
    );
  }

  // 音色：请求参数 > 用户保存的 tts_speaker > OpenAI 默认音色
  let savedSpeaker: string | undefined;
  if (hasDatabaseConfig()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_config')
      .select('tts_speaker')
      .eq('user_id', userId)
      .single();
    savedSpeaker = (data as unknown as Record<string, unknown> | null)?.tts_speaker as string | undefined;
  } else {
    savedSpeaker = getLocalUserConfig(userId).tts_speaker as string | undefined;
  }
  const voice = speaker || savedSpeaker || 'alloy';
  const model = 'tts-1';

  // OpenAI /audio/speech 支持的输出格式
  const formatMap: Record<string, { fmt: string; mime: string; ext: string }> = {
    mp3: { fmt: 'mp3', mime: 'audio/mpeg', ext: 'mp3' },
    pcm: { fmt: 'pcm', mime: 'audio/pcm', ext: 'pcm' },
    ogg_opus: { fmt: 'opus', mime: 'audio/ogg', ext: 'ogg' },
    wav: { fmt: 'wav', mime: 'audio/wav', ext: 'wav' },
  };
  const output = formatMap[audioFormat] || formatMap.mp3;
  const speed = Math.min(Math.max(speechRate || 1.0, 0.25), 4.0);

  console.log(`[自定义TTS] 端点: ${config.baseUrl}, 模型: ${model}, 音色: ${voice}, 格式: ${output.fmt}, 质量等级: ${qualityLevel}`);

  try {
    const response = await fetch(`${config.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: output.fmt,
        speed,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({} as Record<string, unknown>));
      const errObj = (errData.error || errData) as { message?: string };
      const message = errObj?.message || `HTTP ${response.status}`;
      console.error('[自定义TTS] 合成失败:', message);
      return NextResponse.json(
        { error: `自定义端点语音合成失败: ${message}` },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (audioBuffer.length === 0) {
      return NextResponse.json({ error: '自定义端点未返回音频数据' }, { status: 500 });
    }

    // 转存对象存储；本地/开发环境无对象存储时回退 data URI，保证可直接试听
    let fileKey: string | null = null;
    let audioUrl: string;
    try {
      fileKey = await storage.uploadFile({
        fileContent: audioBuffer,
        fileName: `audio/voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${output.ext}`,
        contentType: output.mime,
      });
      audioUrl = await storage.generatePresignedUrl({ key: fileKey });
    } catch (storageError) {
      console.warn('[自定义TTS] 对象存储不可用，回退 data URI:', storageError);
      audioUrl = `data:${output.mime};base64,${audioBuffer.toString('base64')}`;
    }

    const duration = Math.ceil(text.length / 5);
    let audio: Record<string, unknown> = {
      title: title || `自定义AI配音-${new Date().toLocaleDateString()}`,
      description: text.substring(0, 100),
      type: 'voice',
      category: 'AI配音',
      file_key: fileKey,
      file_name: `custom-tts-${Date.now()}.${output.ext}`,
      file_size: audioBuffer.length,
      duration,
      format: output.fmt,
      character_id: characterId || null,
      character_name: characterName || null,
      voice_style: voice,
      tags: ['AI生成', 'TTS', '自定义'],
    };

    // 保存到数据库（未配置数据库时仅返回结果，不入库）
    if (hasDatabaseConfig()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('audio_materials')
          .insert(audio)
          .select()
          .single();
        if (error) {
          console.error('保存音频信息失败:', error);
        } else if (data) {
          audio = data as unknown as Record<string, unknown>;
        }
      } catch (dbError) {
        console.error('保存音频信息失败:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      audio: {
        ...audio,
        audioUrl,
      },
      speaker: voice,
      speakerName: voice,
      memberTier,
      voiceLevel,
      sampleRate,
      solution: 'custom',
    });
  } catch (error) {
    console.error('[自定义TTS] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '自定义端点语音合成失败' },
      { status: 500 }
    );
  }
}

/**
 * 使用扣子 SDK 生成语音
 */
async function generateWithCoze(
  request: NextRequest,
  params: {
    text: string;
    speaker?: string;
    audioFormat: string;
    sampleRate: number;
    speechRate: number;
    loudnessRate: number;
    title?: string;
    characterName?: string;
    characterId?: string;
    qualityLevel: string;
    memberTier: string;
    voiceLevel: string;
  }
) {
  const {
    text,
    speaker,
    audioFormat,
    sampleRate,
    speechRate,
    loudnessRate,
    title,
    characterName,
    characterId,
    qualityLevel,
    memberTier,
    voiceLevel,
  } = params;

  // 使用指定的语音或默认语音
  const finalSpeaker = speaker || DEFAULT_MODELS.tts;

  console.log(`[扣子TTS] 模型: 扣子内置TTS, 质量等级: ${qualityLevel}, 采样率: ${sampleRate}Hz, 语音: ${finalSpeaker}`);

  // 创建扣子 TTS 客户端
  const config = new Config();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const client = new TTSClient(config, customHeaders);

  // 调用 TTS 服务
  const response = await client.synthesize({
    uid: `user-${Date.now()}`,
    text,
    speaker: finalSpeaker,
    audioFormat: audioFormat as 'mp3' | 'pcm' | 'ogg_opus',
    sampleRate: sampleRate as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000,
    speechRate,
    loudnessRate,
  });

  if (!response.audioUri) {
    return NextResponse.json(
      { error: '语音合成失败' },
      { status: 500 }
    );
  }

  // 下载音频数据
  const audioResponse = await fetch(response.audioUri);
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

  // 上传到对象存储
  const fileKey = await storage.uploadFile({
    fileContent: audioBuffer,
    fileName: `audio/voice/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
    contentType: 'audio/mpeg',
  });

  // 计算音频时长（估算）
  const duration = Math.ceil(text.length / 5);

  // 保存到数据库
  const supabase = getSupabaseClient();
  const { data: audio, error } = await supabase
    .from('audio_materials')
    .insert({
      title: title || `AI配音-${new Date().toLocaleDateString()}`,
      description: text.substring(0, 100),
      type: 'voice',
      category: 'AI配音',
      file_key: fileKey,
      file_name: `tts-${Date.now()}.mp3`,
      file_size: response.audioSize,
      duration,
      format: 'mp3',
      character_id: characterId || null,
      character_name: characterName || null,
      voice_style: getSpeakerName(finalSpeaker),
      tags: ['AI生成', 'TTS'],
    })
    .select()
    .single();

  if (error) {
    console.error('保存音频信息失败:', error);
  }

  // 获取音频URL
  const finalAudioUrl = await storage.generatePresignedUrl({ key: fileKey });

  return NextResponse.json({
    success: true,
    audio: {
      ...audio,
      audioUrl: finalAudioUrl,
    },
    speaker: finalSpeaker,
    speakerName: getSpeakerName(finalSpeaker),
    memberTier,
    voiceLevel,
    sampleRate,
    solution: 'standard',
  });
}

/**
 * 使用千问 SDK 生成语音
 */
async function generateWithQwen(
  userId: string,
  params: {
    text: string;
    model: string;
    audioFormat: string;
    sampleRate: number;
    speechRate: number;
    pitchRate: number;
    title?: string;
    characterName?: string;
    characterId?: string;
    qualityLevel: string;
    memberTier: string;
    voiceLevel: string;
  }
) {
  const {
    text,
    model,
    audioFormat,
    sampleRate,
    speechRate,
    pitchRate,
    title,
    characterName,
    characterId,
    qualityLevel,
    memberTier,
    voiceLevel,
  } = params;

  // 检查千问 API 是否配置
  const configured = await isQwenConfiguredForUser(userId);
  if (!configured) {
    return NextResponse.json(
      { error: '千问API未配置，请在方案设置中配置 API Key' },
      { status: 400 }
    );
  }

  console.log(`[千问TTS] 模型: ${model}, 质量等级: ${qualityLevel}, 采样率: ${sampleRate}Hz`);

  try {
    const client = await getQwenClientAsync(userId);

    // 调用千问 TTS 服务
    const response = await client.textToSpeech({
      text,
      model,
      format: audioFormat,
      sampleRate,
      speechRate,
      pitchRate,
    });

    // 下载音频数据
    const audioResponse = await fetch(response.audioUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `audio/voice/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
      contentType: 'audio/mpeg',
    });

    // 计算音频时长（估算）
    const duration = Math.ceil(text.length / 5);

    // 保存到数据库
    const supabase = getSupabaseClient();
    const { data: audio, error } = await supabase
      .from('audio_materials')
      .insert({
        title: title || `千问AI配音-${new Date().toLocaleDateString()}`,
        description: text.substring(0, 100),
        type: 'voice',
        category: 'AI配音',
        file_key: fileKey,
        file_name: `qwen-tts-${Date.now()}.mp3`,
        file_size: response.audioSize,
        duration,
        format: 'mp3',
        character_id: characterId || null,
        character_name: characterName || null,
        voice_style: getSpeakerName(model),
        tags: ['AI生成', 'TTS', '千问'],
      })
      .select()
      .single();

    if (error) {
      console.error('保存音频信息失败:', error);
    }

    // 获取音频URL
    const finalAudioUrl = await storage.generatePresignedUrl({ key: fileKey });

    return NextResponse.json({
      success: true,
      audio: {
        ...audio,
        audioUrl: finalAudioUrl,
      },
      speaker: model,
      speakerName: getSpeakerName(model),
      memberTier,
      voiceLevel,
      sampleRate,
      solution: 'qwen',
    });

  } catch (error) {
    console.error('[千问TTS] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '千问语音合成失败' },
      { status: 500 }
    );
  }
}

// 获取发音人名称
function getSpeakerName(speakerId: string): string {
  const speaker = TTS_SPEAKERS[speakerId as keyof typeof TTS_SPEAKERS];
  return speaker?.name || speakerId;
}
