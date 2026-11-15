import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import { parseQualityLevel, getTTSQuality } from '@/lib/quality-config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 智能配音生成API
 * 
 * 支持两种方案：
 * 1. 扣子方案：使用扣子TTS，支持多种预设音色，稳定性高
 * 2. 智谱方案：使用GLM-TTS，支持超情感表达，上下文智能预判情绪语调
 * 
 * 根据角色特征自动匹配最佳speaker，支持情感调节
 */

// Speaker映射表 - 根据性别、年龄、性格特征匹配
const SPEAKER_MAP: Record<string, Record<string, string>> = {
  male: {
    // 年轻男性
    young_cute: 'saturn_zh_male_tiancaitongzhuo_tob', // 天才同桌 - 年轻聪明
    young_cheerful: 'saturn_zh_male_shuanglangshaonian_tob', // 爽朗少年
    // 成年男性
    adult_general: 'zh_male_m191_uranus_bigtts', // 云舟 - 通用男声
    adult_elegant: 'zh_male_ruyayichen_saturn_bigtts', // 儒雅一尘 - 儒雅男声
    adult_narrator: 'zh_male_dayi_saturn_bigtts', // 大义 - 旁白/解说
    // 成熟男性
    mature: 'zh_male_taocheng_uranus_bigtts', // 小天 - 沉稳男声
  },
  female: {
    // 年轻女性
    young_cute: 'saturn_zh_female_keainvsheng_tob', // 可爱女生
    young_playful: 'saturn_zh_female_tiaopigongzhu_tob', // 调皮公主
    // 成年女性
    adult_general: 'zh_female_xiaohe_uranus_bigtts', // 小何 - 通用女声
    adult_charming: 'zh_female_meilinvyou_saturn_bigtts', // 魅力女友
    adult_smooth: 'zh_female_santongyongns_saturn_bigtts', // 三通 - 温柔女声
    // 特殊风格
    intellectual: 'saturn_zh_female_cancan_tob', // 灿灿 - 知性女声
    motivational: 'zh_female_jitangnv_saturn_bigtts', // 鸡汤女 - 励志女声
    // 儿童读物
    child_book: 'zh_female_xueayi_saturn_bigtts', // 儿童读物女声
  },
  general: {
    bilingual: 'zh_female_vv_uranus_bigtts', // Vivi - 中英双语
  }
};

// 情感到语速/音量的映射
const EMOTION_TO_PARAMS: Record<string, { speechRate: number; loudnessRate: number }> = {
  '平静': { speechRate: 0, loudnessRate: 0 },
  '开心': { speechRate: 10, loudnessRate: 10 },
  '兴奋': { speechRate: 20, loudnessRate: 15 },
  '悲伤': { speechRate: -10, loudnessRate: -5 },
  '愤怒': { speechRate: 15, loudnessRate: 20 },
  '恐惧': { speechRate: -5, loudnessRate: -10 },
  '紧张': { speechRate: 5, loudnessRate: 5 },
  '温柔': { speechRate: -5, loudnessRate: -5 },
  '坚定': { speechRate: 0, loudnessRate: 10 },
  '悬疑': { speechRate: -15, loudnessRate: -10 },
};

// GLM-TTS 音色映射表（智谱方案）
const GLM_TTS_VOICE_MAP: Record<string, Record<string, string>> = {
  male: {
    young: 'echo',        // 男声，适合旁白解说
    adult: 'onyx',        // 深沉男声，适合严肃内容
    mature: 'onyx',       // 深沉男声
  },
  female: {
    young: 'nova',        // 活力女声，适合角色配音
    adult: 'shimmer',     // 温柔女声，适合情感内容
    intellectual: 'fable', // 女声，适合故事讲述
  },
  general: {
    neutral: 'alloy',     // 中性音色，适合通用场景
  }
};

/**
 * 根据角色特征智能匹配speaker（扣子方案）
 */
function getSmartSpeaker(character: {
  gender?: string;
  age?: number;
  temperament?: string;
}): string {
  const { gender = 'female', age = 25, temperament = '' } = character;
  const genderKey = gender === 'male' ? 'male' : 'female';
  
  // 根据性格特征匹配
  const temperamentLower = temperament.toLowerCase();
  
  if (genderKey === 'female') {
    if (temperamentLower.includes('可爱') || temperamentLower.includes('软萌')) {
      return SPEAKER_MAP.female.young_cute;
    }
    if (temperamentLower.includes('调皮') || temperamentLower.includes('活泼')) {
      return SPEAKER_MAP.female.young_playful;
    }
    if (temperamentLower.includes('知性') || temperamentLower.includes('聪明')) {
      return SPEAKER_MAP.female.intellectual;
    }
    if (temperamentLower.includes('温柔') || temperamentLower.includes('善良')) {
      return SPEAKER_MAP.female.adult_smooth;
    }
    if (temperamentLower.includes('性感') || temperamentLower.includes('魅力')) {
      return SPEAKER_MAP.female.adult_charming;
    }
    if (temperamentLower.includes('冷艳') || temperamentLower.includes('高冷')) {
      return SPEAKER_MAP.female.adult_general;
    }
    // 根据年龄
    if (age < 20) {
      return SPEAKER_MAP.female.young_cute;
    }
    return SPEAKER_MAP.female.adult_general;
  } else {
    if (temperamentLower.includes('天才') || temperamentLower.includes('聪明')) {
      return SPEAKER_MAP.male.young_cute;
    }
    if (temperamentLower.includes('开朗') || temperamentLower.includes('阳光')) {
      return SPEAKER_MAP.male.young_cheerful;
    }
    if (temperamentLower.includes('儒雅') || temperamentLower.includes('温柔')) {
      return SPEAKER_MAP.male.adult_elegant;
    }
    if (temperamentLower.includes('沉稳') || temperamentLower.includes('成熟')) {
      return SPEAKER_MAP.male.mature;
    }
    // 根据年龄
    if (age < 25) {
      return SPEAKER_MAP.male.young_cheerful;
    }
    if (age > 40) {
      return SPEAKER_MAP.male.mature;
    }
    return SPEAKER_MAP.male.adult_general;
  }
}

/**
 * 根据情感获取语速和音量参数
 */
function getEmotionParams(emotion: string): { speechRate: number; loudnessRate: number } {
  return EMOTION_TO_PARAMS[emotion] || EMOTION_TO_PARAMS['平静'];
}

/**
 * 情感到SSML模板的映射
 * 扣子TTS支持SSML，通过SSML可以实现更精细的情感控制
 */
const EMOTION_SSML_TEMPLATES: Record<string, (text: string) => string> = {
  '平静': (text) => `<speak>${text}</speak>`,
  
  '开心': (text) => `<speak><prosody rate="fast" pitch="+5%">${text}</prosody></speak>`,
  
  '兴奋': (text) => `<speak><prosody rate="fast" pitch="+10%" volume="loud">${text}</prosody></speak>`,
  
  '悲伤': (text) => `<speak><prosody rate="slow" pitch="-5%" volume="soft">${text}</prosody></speak>`,
  
  '愤怒': (text) => `<speak><prosody rate="fast" pitch="+10%" volume="x-loud"><emphasis level="strong">${text}</emphasis></prosody></speak>`,
  
  '恐惧': (text) => `<speak><prosody rate="slow" pitch="-10%" volume="x-soft">${text}</prosody></speak>`,
  
  '紧张': (text) => `<speak><prosody rate="fast" pitch="+5%">${text}</prosody></speak>`,
  
  '温柔': (text) => `<speak><prosody rate="slow" pitch="-5%" volume="soft">${text}</prosody></speak>`,
  
  '坚定': (text) => `<speak><prosody rate="medium" volume="loud"><emphasis level="strong">${text}</emphasis></prosody></speak>`,
  
  '悬疑': (text) => `<speak><prosody rate="slow" pitch="-10%" volume="soft">${text}</prosody></speak>`,
};

/**
 * 智能生成带有情感停顿的SSML
 * 根据标点符号自动添加情感停顿
 */
function generateSmartSSML(text: string, emotion: string): string {
  // 情感到停顿时长的映射
  const pauseMap: Record<string, { comma: number; period: number; exclamation: number; question: number }> = {
    '平静': { comma: 200, period: 400, exclamation: 500, question: 500 },
    '开心': { comma: 150, period: 300, exclamation: 400, question: 400 },
    '兴奋': { comma: 100, period: 200, exclamation: 300, question: 300 },
    '悲伤': { comma: 300, period: 600, exclamation: 700, question: 700 },
    '愤怒': { comma: 100, period: 300, exclamation: 200, question: 400 },
    '恐惧': { comma: 400, period: 800, exclamation: 900, question: 900 },
    '紧张': { comma: 150, period: 300, exclamation: 400, question: 400 },
    '温柔': { comma: 250, period: 500, exclamation: 600, question: 600 },
    '坚定': { comma: 150, period: 350, exclamation: 400, question: 450 },
    '悬疑': { comma: 400, period: 800, exclamation: 900, question: 1000 },
  };
  
  const pauses = pauseMap[emotion] || pauseMap['平静'];
  
  // 替换标点符号为带停顿的SSML
  const processedText = text
    .replace(/，/g, `<break time="${pauses.comma}ms"/>`)
    .replace(/。/g, `<break time="${pauses.period}ms"/>`)
    .replace(/！/g, `<break time="${pauses.exclamation}ms"/>`)
    .replace(/？/g, `<break time="${pauses.question}ms"/>`)
    .replace(/……/g, '<break time="500ms"/>')
    .replace(/—/g, '<break time="300ms"/>');
  
  // 应用情感模板
  const template = EMOTION_SSML_TEMPLATES[emotion] || EMOTION_SSML_TEMPLATES['平静'];
  return template(processedText);
}

/**
 * 根据角色特征智能匹配GLM-TTS音色（智谱方案）
 */
function getSmartVoiceGLM(character: {
  gender?: string;
  age?: number;
  temperament?: string;
}): string {
  const { gender = 'female', age = 25, temperament = '' } = character;
  const genderKey = gender === 'male' ? 'male' : 'female';
  const temperamentLower = temperament.toLowerCase();
  
  // 根据性格特征匹配
  if (genderKey === 'female') {
    if (temperamentLower.includes('可爱') || temperamentLower.includes('软萌') || 
        temperamentLower.includes('活泼') || age < 20) {
      return GLM_TTS_VOICE_MAP.female.young; // nova - 活力女声
    }
    if (temperamentLower.includes('温柔') || temperamentLower.includes('善良') ||
        temperamentLower.includes('甜美')) {
      return GLM_TTS_VOICE_MAP.female.adult; // shimmer - 温柔女声
    }
    return GLM_TTS_VOICE_MAP.female.intellectual; // fable - 女声，故事讲述
  } else {
    if (temperamentLower.includes('活力') || temperamentLower.includes('开朗') || age < 25) {
      return GLM_TTS_VOICE_MAP.male.young; // echo - 男声，旁白解说
    }
    return GLM_TTS_VOICE_MAP.male.adult; // onyx - 深沉男声
  }
}

/**
 * 获取用户的方案选择
 */
async function getUserSolution(userId: string): Promise<'standard' | 'zhipu'> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('user_config')
    .select('solution_preset')
    .eq('user_id', userId)
    .single();
  
  return (data?.solution_preset as 'standard' | 'zhipu') || 'standard';
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);
    
    const body = await request.json();
    const {
      text,
      character, // 角色信息 { gender, age, temperament }
      speaker, // 手动指定speaker
      voiceId, // 克隆音色ID（智谱方案）
      emotion = '平静', // 情感
      audioFormat = 'mp3',
      sampleRate,  // 可选，优先级高于quality
      title,
      seriesId,
      episodeNumber,
      characterName,
      quality,  // 质量等级：test/standard/premium
      useSSML = true,  // 是否使用SSML增强情感（扣子方案），默认启用
    } = body;

    if (!text) {
      return NextResponse.json({ error: '请提供要合成的文本' }, { status: 400 });
    }

    // 解析质量等级
    const qualityLevel = parseQualityLevel(quality);
    const qualityConfig = getTTSQuality(qualityLevel);
    const finalSampleRate = sampleRate || qualityConfig.sampleRate;

    console.log(`[智能TTS] 用户方案: ${solution}, 质量等级: ${qualityLevel}, 采样率: ${finalSampleRate}Hz`);

    // 根据方案选择TTS引擎
    if (solution === 'zhipu') {
      // ===== 智谱方案：使用GLM-TTS =====
      const configured = await isZhipuConfiguredForUser(userId);
      if (!configured) {
        return NextResponse.json(
          { error: '智谱API未配置，请在方案设置中配置 API Key' },
          { status: 400 }
        );
      }

      const client = await getZhipuClientAsync(userId);
      
      // 智能匹配音色
      const finalVoice = voiceId || speaker || getSmartVoiceGLM(character || {});
      
      console.log(`[智能TTS-智谱] 音色: ${finalVoice}, 使用克隆音色: ${!!voiceId}`);
      
      let audioBuffer: ArrayBuffer;
      
      if (voiceId) {
        // 使用克隆音色
        audioBuffer = await client.textToSpeechWithClone(text, voiceId, {
          speed: 1.0,
          response_format: audioFormat as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',
        });
      } else {
        // 使用预设音色（GLM-TTS会自动预判情感）
        audioBuffer = await client.textToSpeech(text, {
          voice: finalVoice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
          speed: 1.0,
          response_format: audioFormat as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',
        });
      }

      // 上传到对象存储
      const fileKey = await storage.uploadFile({
        fileContent: Buffer.from(audioBuffer),
        fileName: `audio/voice/${seriesId || 'default'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${audioFormat}`,
        contentType: audioFormat === 'mp3' ? 'audio/mpeg' : `audio/${audioFormat}`,
      });

      const duration = Math.ceil(text.length / 5);

      // 保存到数据库
      const supabase = getSupabaseClient();
      const { data: audio, error } = await supabase
        .from('audio_materials')
        .insert({
          title: title || `AI配音-${characterName || '未知角色'}`,
          description: text.substring(0, 100),
          type: 'voice',
          category: 'AI配音',
          file_key: fileKey,
          file_name: `tts-${Date.now()}.${audioFormat}`,
          file_size: audioBuffer.byteLength,
          duration,
          format: audioFormat,
          character_name: characterName,
          voice_style: finalVoice,
          series_id: seriesId,
          episode_number: episodeNumber,
          tags: ['AI生成', 'GLM-TTS', '智谱方案', voiceId ? '音色克隆' : '预设音色'],
        })
        .select()
        .single();

      if (error) {
        console.error('保存音频信息失败:', error);
      }

      const audioUrl = await storage.generatePresignedUrl({ key: fileKey });

      return NextResponse.json({
        success: true,
        solution: 'zhipu',
        model: voiceId ? 'glm-tts-clone' : 'glm-tts',
        audio: {
          ...audio,
          audioUrl,
        },
        voice: finalVoice,
        voiceName: voiceId ? '克隆音色' : getGLMSpeakerName(finalVoice),
        isCloned: !!voiceId,
        emotionAI: true, // GLM-TTS支持超情感表达
        message: 'GLM-TTS已自动预判情感并生成配音',
      });

    } else {
      // ===== 扣子方案：使用扣子TTS =====
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new TTSClient(config, customHeaders);

      // 智能匹配speaker
      const finalSpeaker = speaker || getSmartSpeaker(character || {});
      const emotionParams = getEmotionParams(emotion);

      // 检查是否启用SSML情感增强
      let ssmlText: string | undefined;
      let plainText: string | undefined;

      if (useSSML) {
        // 使用SSML增强情感表达
        ssmlText = generateSmartSSML(text, emotion);
        console.log(`[智能TTS-扣子] 音色: ${finalSpeaker}, 情感: ${emotion}, 使用SSML增强`);
      } else {
        plainText = text;
        console.log(`[智能TTS-扣子] 音色: ${finalSpeaker}, 情感参数: ${JSON.stringify(emotionParams)}`);
      }

      // 调用TTS（支持SSML）
      const response = await client.synthesize({
        uid: `user-${Date.now()}`,
        text: plainText,
        ssml: ssmlText,
        speaker: finalSpeaker,
        audioFormat,
        sampleRate: finalSampleRate,
        speechRate: emotionParams.speechRate,
        loudnessRate: emotionParams.loudnessRate,
      });

      if (!response.audioUri) {
        return NextResponse.json({ error: '语音合成失败' }, { status: 500 });
      }

      // 下载并上传到对象存储
      const audioResponse = await fetch(response.audioUri);
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      const fileKey = await storage.uploadFile({
        fileContent: audioBuffer,
        fileName: `audio/voice/${seriesId || 'default'}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
        contentType: 'audio/mpeg',
      });

      const duration = Math.ceil(text.length / 5);

      // 保存到数据库
      const supabase = getSupabaseClient();
      const { data: audio, error } = await supabase
        .from('audio_materials')
        .insert({
          title: title || `AI配音-${characterName || '未知角色'}`,
          description: text.substring(0, 100),
          type: 'voice',
          category: 'AI配音',
          file_key: fileKey,
          file_name: `tts-${Date.now()}.mp3`,
          file_size: response.audioSize,
          duration,
          format: 'mp3',
          character_name: characterName,
          voice_style: finalSpeaker,
          series_id: seriesId,
          episode_number: episodeNumber,
          tags: ['AI生成', '扣子TTS', emotion],
        })
        .select()
        .single();

      if (error) {
        console.error('保存音频信息失败:', error);
      }

      const audioUrl = await storage.generatePresignedUrl({ key: fileKey });

      return NextResponse.json({
        success: true,
        solution: 'standard',
        model: 'coze-tts',
        audio: {
          ...audio,
          audioUrl,
        },
        speaker: finalSpeaker,
        speakerName: getGLMSpeakerName(finalSpeaker),
        emotion,
        params: emotionParams,
        emotionAI: false, // 扣子TTS不支持自动情感预判
        ssmlEnhanced: useSSML, // 是否使用了SSML增强
        ssmlText: useSSML ? ssmlText : undefined, // 返回SSML文本供调试
        message: useSSML 
          ? '已通过SSML增强情感表达（建议使用智谱方案获得更好的效果）'
          : '扣子TTS基础配音，建议使用智谱方案获得超情感表达',
      });
    }

  } catch (error) {
    console.error('智能配音生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}

// 导出工具函数供其他模块使用
export { getSmartSpeaker, getEmotionParams, SPEAKER_MAP, EMOTION_TO_PARAMS };

/**
 * 获取GLM-TTS音色中文名称
 */
function getGLMSpeakerName(speaker: string): string {
  const nameMap: Record<string, string> = {
    'alloy': '标准男声',
    'echo': '年轻男声',
    'fable': '磁性男声',
    'onyx': '成熟男声',
    'nova': '活力女声',
    'shimmer': '温柔女声',
  };
  return nameMap[speaker] || speaker;
}
