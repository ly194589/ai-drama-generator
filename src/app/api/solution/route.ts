import { NextRequest, NextResponse } from 'next/server';
import { SOLUTION_PRESETS, getAvailableSolutions, SolutionType } from '@/lib/config';
import { isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { isQwenConfiguredForUser } from '@/lib/qwen-client';

/**
 * 方案管理API
 *
 * GET: 获取所有可用方案
 * POST: 切换方案（需检查配置）
 */

/**
 * 各提供商在 user_config 表中的 API Key 字段
 * 与 /api/providers/config 的 PROVIDER_META keyField 保持一致
 */
const PROVIDER_KEY_FIELDS: Record<string, string> = {
  zhipu: 'zhipu_api_key',
  qwen: 'qwen_api_key',
  volcengine: 'volcengine_api_key',
  minimax: 'minimax_api_key',
  moonshot: 'moonshot_api_key',
  deepseek: 'deepseek_api_key',
  wenxin: 'wenxin_api_key',
  hunyuan: 'hunyuan_api_key',
  custom: 'custom_api_key',
};

/**
 * 获取用户各提供商 Key 配置状态
 */
async function getProviderKeyStatus(userId: string): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {};
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    const fields = Object.values(PROVIDER_KEY_FIELDS);
    const { data } = await supabase
      .from('user_config')
      .select(fields.join(','))
      .eq('user_id', userId)
      .single();

    for (const [provider, field] of Object.entries(PROVIDER_KEY_FIELDS)) {
      const value = data ? (data as unknown as Record<string, unknown>)[field] : null;
      status[provider] = typeof value === 'string' && value.trim().length > 0;
    }
  } catch (error) {
    console.error('[方案] 获取提供商 Key 状态失败:', error);
    for (const provider of Object.keys(PROVIDER_KEY_FIELDS)) {
      status[provider] = false;
    }
  }
  return status;
}

/**
 * 获取所有可用方案及其状态
 * 默认使用扣子方案，其余方案需要配置对应 API Key
 */
export async function GET(request: NextRequest) {
  // 获取用户ID（使用与 /api/zhipu/config 和 /api/qwen/config 相同的方式）
  const userId = request.headers.get('x-user-id') || 'dev-user';

  // 检查智谱是否配置（环境变量或用户配置）
  const zhipuConfigured = await isZhipuConfiguredForUser(userId);

  // 检查千问是否配置（环境变量或用户配置）
  const qwenConfigured = await isQwenConfiguredForUser(userId);

  // 其他提供商：检查用户 Key 配置
  const keyStatus = await getProviderKeyStatus(userId);

  // 获取用户当前选择的方案，默认为 standard（扣子方案）
  let userSolution = 'standard';
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_config')
      .select('solution_preset')
      .eq('user_id', userId)
      .single();

    if (data?.solution_preset) {
      userSolution = data.solution_preset;
    }
  } catch (error) {
    console.error('[方案] 获取用户配置失败:', error);
  }

  const solutions = getAvailableSolutions().map(solution => ({
    id: solution.id,
    name: solution.name,
    description: solution.description,
    provider: solution.provider,
    available: solution.available,
    configured:
      solution.id === 'zhipu' ? zhipuConfigured
      : solution.id === 'qwen' ? qwenConfigured
      : keyStatus[solution.id] ?? true,
    models: {
      llm: solution.models.llm,
      llmDescription: solution.models.llmDescription,
      llmAlternative: 'llmAlternative' in solution.models ? solution.models.llmAlternative : undefined,
      llmAlternativeDescription: 'llmAlternativeDescription' in solution.models ? solution.models.llmAlternativeDescription : undefined,
      image: 'image' in solution.models ? solution.models.image : undefined,
      imageDescription: 'imageDescription' in solution.models ? solution.models.imageDescription : undefined,
      imageSize: 'imageSize' in solution.models ? solution.models.imageSize : undefined,
      imageSizeDescription: 'imageSizeDescription' in solution.models ? solution.models.imageSizeDescription : undefined,
      video: solution.models.video,
      videoDescription: solution.models.videoDescription,
      tts: 'tts' in solution.models ? solution.models.tts : undefined,
      ttsDescription: 'ttsDescription' in solution.models ? solution.models.ttsDescription : undefined,
    },
    features: solution.features,
    useCase: solution.useCase,
    requiresApiKey: 'requiresApiKey' in solution ? solution.requiresApiKey : false,
    apiKeyEnvVar: 'apiKeyEnvVar' in solution ? solution.apiKeyEnvVar : undefined,
  }));

  return NextResponse.json({
    solutions,
    defaultSolution: userSolution,
  });
}

/**
 * 切换方案
 * 扣子方案：直接切换
 * 其他方案：需要先配置对应 API Key
 */
export async function POST(request: NextRequest) {
  try {
    const { solution } = await request.json();

    const allowedSolutions = Object.keys(SOLUTION_PRESETS);
    if (!solution || !allowedSolutions.includes(solution)) {
      return NextResponse.json(
        { error: '无效的方案ID' },
        { status: 400 }
      );
    }

    const solutionType = solution as SolutionType;
    const preset = SOLUTION_PRESETS[solutionType];

    // 获取用户ID（使用与 /api/zhipu/config 和 /api/qwen/config 相同的方式）
    const userId = request.headers.get('x-user-id') || 'dev-user';

    // 智谱方案需要检查 API Key 配置
    if (solutionType === 'zhipu') {
      const zhipuConfigured = await isZhipuConfiguredForUser(userId);
      if (!zhipuConfigured) {
        return NextResponse.json({
          success: false,
          error: '智谱API未配置',
          message: '请先配置智谱 API Key',
          requiredConfig: 'zhipu_api_key',
        }, { status: 400 });
      }
    }

    // 千问方案需要检查 API Key 配置
    if (solutionType === 'qwen') {
      const qwenConfigured = await isQwenConfiguredForUser(userId);
      if (!qwenConfigured) {
        return NextResponse.json({
          success: false,
          error: '千问API未配置',
          message: '请先配置千问 API Key',
          requiredConfig: 'qwen_api_key',
        }, { status: 400 });
      }
    }

    // 其他提供商方案需要检查对应 API Key 配置
    if (['volcengine', 'minimax', 'moonshot', 'deepseek', 'wenxin', 'hunyuan', 'custom'].includes(solutionType)) {
      const keyStatus = await getProviderKeyStatus(userId);
      if (!keyStatus[solutionType]) {
        return NextResponse.json({
          success: false,
          error: `${preset.name.replace('方案', '')}API未配置`,
          message: `请先在下方 API Key 配置中填写${preset.name.replace('方案', '')}的密钥`,
          requiredConfig: PROVIDER_KEY_FIELDS[solutionType],
        }, { status: 400 });
      }
    }

    // 保存方案选择到数据库
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();

    // 获取当前配置
    const { data: currentConfig } = await supabase
      .from('user_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 构建更新数据：使用方案的默认模型配置
    const updateData: Record<string, unknown> = {
      user_id: userId,
      solution_preset: solutionType,
      updated_at: new Date().toISOString(),
    };

    // 如果方案有默认模型配置，更新对应的字段
    // custom 方案不覆盖 llm_model（保留用户自定义模型名）
    if (preset.models && solutionType !== 'custom') {
      if (preset.models.llm) {
        updateData.llm_model = preset.models.llm;
      }
      if (preset.models.video) {
        updateData.video_model = preset.models.video;
      }
      if (preset.models.imageSize) {
        updateData.image_size = preset.models.imageSize;
      }
      if (preset.models.tts) {
        updateData.tts_speaker = preset.models.tts;
      }
    }

    // 同步各类型模型厂商（方案切换 = 一键预设各类型厂商，standard/coze 映射为扣子内置）
    // 该厂商暂不支持的能力回退扣子内置（豆包系模型走平台内置通道），确保切换后立即可用
    const mappedProvider = solutionType === 'standard' ? 'coze' : solutionType;
    const LLM_PROVIDERS = ['coze', 'zhipu', 'qwen', 'volcengine', 'minimax', 'moonshot', 'deepseek', 'wenxin', 'hunyuan', 'custom'];
    const IMAGE_PROVIDERS = ['coze', 'zhipu', 'qwen', 'volcengine', 'custom'];
    const VIDEO_PROVIDERS = ['coze', 'zhipu', 'qwen'];
    const TTS_PROVIDERS = ['coze', 'zhipu', 'qwen'];

    updateData.llm_provider = LLM_PROVIDERS.includes(mappedProvider) ? mappedProvider : 'coze';
    updateData.image_provider = IMAGE_PROVIDERS.includes(mappedProvider) ? mappedProvider : 'coze';
    updateData.video_provider = VIDEO_PROVIDERS.includes(mappedProvider) ? mappedProvider : 'coze';
    updateData.tts_provider = TTS_PROVIDERS.includes(mappedProvider) ? mappedProvider : 'coze';

    const { error: saveError } = await supabase
      .from('user_config')
      .upsert(updateData, {
        onConflict: 'user_id',
      });

    if (saveError) {
      console.error('[方案] 保存失败:', saveError);
      return NextResponse.json({
        success: false,
        error: '方案保存失败',
      }, { status: 500 });
    }

    console.log(`[方案] 用户 ${userId} 切换到 ${solutionType} 方案`);
    console.log(`[方案] 更新数据:`, updateData);

    // 验证是否真的保存成功
    const { data: verifyData } = await supabase
      .from('user_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log(`[方案] 验证保存结果:`, verifyData);

    return NextResponse.json({
      success: true,
      solution: {
        id: preset.id,
        name: preset.name,
        models: preset.models,
      },
      // 返回更新后的配置
      config: verifyData,
    });

  } catch (error) {
    console.error('[方案] 验证错误:', error);
    return NextResponse.json(
      { error: '方案验证失败' },
      { status: 500 }
    );
  }
}
