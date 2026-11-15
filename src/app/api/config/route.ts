import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SOLUTION_PRESETS, LLM_MODELS, IMAGE_SIZES, TTS_SPEAKERS, DEFAULT_MODELS } from '@/lib/config';
import { hasDatabaseConfig, getLocalUserConfig, saveLocalUserConfig } from '@/lib/server-config-store';

/** 可返回给客户端的配置字段（不含任何密钥） */
const CONFIG_FIELDS = [
  'solution_preset', 'video_model', 'video_resolution', 'llm_model', 'llm_provider',
  'image_model', 'image_provider', 'video_provider', 'image_size', 'tts_speaker', 'tts_provider',
] as const;

function pickConfigFields(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of CONFIG_FIELDS) {
    if (row && row[field] !== undefined && row[field] !== null) {
      picked[field] = row[field];
    }
  }
  return picked;
}

/** 默认配置 - 使用扣子平台内置模型 */
function defaultConfigFor(userId: string): Record<string, unknown> {
  return {
    user_id: userId,
    solution_preset: 'standard',
    video_model: DEFAULT_MODELS.video,
    video_resolution: '720p',
    llm_model: DEFAULT_MODELS.llm,
    image_size: DEFAULT_MODELS.imageSize,
    tts_speaker: DEFAULT_MODELS.tts,
    llm_provider: 'coze',
    image_provider: 'coze',
    video_provider: 'coze',
    tts_provider: 'coze',
  };
}

/**
 * 从请求中获取用户ID（与 /api/solution 保持一致）
 */
async function getUserId(request: NextRequest): Promise<string> {
  // 使用 x-user-id header，默认值为 dev-user
  return request.headers.get('x-user-id') || 'dev-user';
}

/**
 * 获取用户配置
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    let config: Record<string, unknown> | null = null;
    if (hasDatabaseConfig()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_config')
        .select(CONFIG_FIELDS.join(', '))
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('获取配置失败:', error);
        return NextResponse.json(
          { error: '获取配置失败' },
          { status: 500 }
        );
      }
      config = data as Record<string, unknown> | null;
    } else {
      // 未配置数据库：使用本地文件兜底存储
      config = pickConfigFields(getLocalUserConfig(userId));
    }

    // 默认配置 - 使用扣子平台内置模型
    const defaultConfig = defaultConfigFor(userId);

    // 返回配置和选项
    return NextResponse.json({
      success: true,
      config: {
        ...defaultConfig,
        ...config,
      },
      // 返回可选项
      options: {
        solutionPresets: Object.values(SOLUTION_PRESETS).map(preset => ({
          id: preset.id,
          name: preset.name,
          description: preset.description,
          provider: preset.provider,
          available: preset.available,
          models: preset.models,
          features: preset.features,
        })),
        llmModels: LLM_MODELS,
        imageSizes: IMAGE_SIZES,
        ttsSpeakers: TTS_SPEAKERS,
      },
      // 标识当前是否为登录用户
      authenticated: userId !== 'default',
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * 保存用户配置
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json();
    const {
      solution_preset,
      video_model,
      video_resolution,
      llm_model,
      llm_provider,
      image_model,
      image_provider,
      video_provider,
      image_size,
      tts_speaker,
    } = body;

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // 使用 in 判断，允许显式保存空字符串（如自定义模型名）
    if (solution_preset !== undefined) {
      updateData.solution_preset = solution_preset;
    }

    if (video_model !== undefined) {
      updateData.video_model = video_model;
    }

    if (video_resolution !== undefined) {
      updateData.video_resolution = video_resolution;
    }

    if (llm_model !== undefined) {
      updateData.llm_model = llm_model;
    }

    if (llm_provider !== undefined) {
      updateData.llm_provider = llm_provider;
    }

    if (image_model !== undefined) {
      updateData.image_model = image_model;
    }

    if (image_provider !== undefined) {
      updateData.image_provider = image_provider;
    }

    if (video_provider !== undefined) {
      updateData.video_provider = video_provider;
    }

    if (image_size !== undefined) {
      updateData.image_size = image_size;
    }

    if (tts_speaker !== undefined) {
      updateData.tts_speaker = tts_speaker;
    }

    if (body.tts_provider !== undefined) {
      updateData.tts_provider = body.tts_provider;
    }

    // 未配置数据库：写入本地文件兜底存储，保证自定义模型等配置可保存
    if (!hasDatabaseConfig()) {
      const row = saveLocalUserConfig(userId, updateData);
      return NextResponse.json({
        success: true,
        config: { ...defaultConfigFor(userId), ...pickConfigFields(row) },
      });
    }

    const supabase = getSupabaseClient();

    // 使用 upsert 插入或更新
    const { data: config, error } = await supabase
      .from('user_config')
      .upsert({
        user_id: userId,
        ...updateData,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('保存配置失败:', error);
      return NextResponse.json(
        { error: '保存配置失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    return NextResponse.json(
      { error: '保存配置失败' },
      { status: 500 }
    );
  }
}
