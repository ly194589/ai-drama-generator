/**
 * 千问媒体客户端 - 通义万相图片/视频生成（DashScope 原生异步任务协议）
 *
 * 接口文档:
 * - 文生图: POST /api/v1/services/aigc/text2image/image-synthesis (X-DashScope-Async: enable)
 * - 视频:   POST /api/v1/services/aigc/video-generation/generation (X-DashScope-Async: enable)
 * - 任务查询: GET /api/v1/tasks/{task_id}
 *
 * 密钥与端点从 user_config 读取（qwen_api_key / qwen_base_url）。
 * 注意：qwen_base_url 存的是 OpenAI 兼容层（compatible-mode/v1），
 * 原生 AIGC 异步任务需要转换为 https://dashscope.aliyuncs.com/api/v1。
 */

const DEFAULT_DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/api/v1';

export interface QwenMediaConfig {
  apiKey: string;
  baseUrl: string; // 原生 api/v1 基地址
}

export interface QwenImageParams {
  model: string;
  prompt: string;
  negativePrompt?: string;
  /** 如 1024x1024 / 1440x720 */
  size?: string;
  n?: number;
}

export interface QwenVideoParams {
  model: string;
  prompt: string;
  /** 图生视频首帧 URL（公网可访问） */
  imgUrl?: string;
  negativePrompt?: string;
  resolution?: string;
  duration?: number;
}

interface DashScopeTaskOutput {
  task_id?: string;
  task_status?: string;
  results?: Array<{ url?: string; video_url?: string; code?: string; message?: string }>;
  video_url?: string;
  code?: string;
  message?: string;
}

interface DashScopeSubmitResponse {
  output?: DashScopeTaskOutput;
  request_id?: string;
  code?: string;
  message?: string;
}

/**
 * 解析 DashScope 原生 API 基地址
 * 兼容用户在设置中填写的 OpenAI 兼容地址（compatible-mode/v1）
 */
export function resolveDashScopeBase(baseUrl?: string | null): string {
  const raw = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!raw) return DEFAULT_DASHSCOPE_BASE;
  if (raw.includes('compatible-mode/v1')) {
    return 'https://dashscope.aliyuncs.com/api/v1';
  }
  if (raw.endsWith('/api/v1')) return raw;
  // 用户填写了域名根，补齐 api/v1
  try {
    const u = new URL(raw);
    return `${u.origin}/api/v1`;
  } catch {
    return DEFAULT_DASHSCOPE_BASE;
  }
}

/** 从 user_config 读取千问媒体生成配置（key + 原生基地址） */
export async function getQwenMediaConfig(userId: string): Promise<QwenMediaConfig | null> {
  if (!userId) return null;
  try {
    const { decryptSecret } = await import('@/lib/secret-crypto');
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_config')
      .select('qwen_api_key,qwen_base_url')
      .eq('user_id', userId)
      .single();

    const record = (data || {}) as unknown as Record<string, unknown>;
    const apiKey = typeof record.qwen_api_key === 'string' ? decryptSecret(record.qwen_api_key).trim() : '';
    const rawBase = typeof record.qwen_base_url === 'string' ? record.qwen_base_url : '';

    if (!apiKey) {
      // 环境变量兜底
      const envKey = process.env.QWEN_API_KEY;
      if (envKey) {
        return { apiKey: envKey, baseUrl: resolveDashScopeBase(rawBase || null) };
      }
      return null;
    }
    return { apiKey, baseUrl: resolveDashScopeBase(rawBase || null) };
  } catch (error) {
    console.error('[千问媒体] 读取配置失败:', error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 提交异步任务并轮询至完成
 */
async function submitAndPoll(
  config: QwenMediaConfig,
  path: string,
  body: unknown,
  options: { pollIntervalMs: number; maxWaitMs: number; label: string }
): Promise<DashScopeTaskOutput> {
  const submitRes = await fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const submitData = (await submitRes.json()) as DashScopeSubmitResponse;
  if (!submitRes.ok || !submitData.output?.task_id) {
    const msg = submitData.message || `HTTP ${submitRes.status}`;
    console.error(`[千问媒体] ${options.label} 提交失败:`, msg);
    throw new Error(`千问${options.label}提交失败: ${msg}`);
  }

  const taskId = submitData.output.task_id;
  const deadline = Date.now() + options.maxWaitMs;

  while (Date.now() < deadline) {
    await sleep(options.pollIntervalMs);
    const pollRes = await fetch(`${config.baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    const pollData = (await pollRes.json()) as DashScopeSubmitResponse;
    const output = pollData.output || {};
    const status = output.task_status || '';

    if (status === 'SUCCEEDED') return output;
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      const errMsg = output.message || output.code || status;
      console.error(`[千问媒体] ${options.label} 任务失败:`, errMsg);
      throw new Error(`千问${options.label}生成失败: ${errMsg}`);
    }
    // PENDING / RUNNING 继续轮询
  }
  throw new Error(`千问${options.label}生成超时，请稍后在素材库查看`);
}

/**
 * 文生图（返回图片 URL 列表，DashScope 临时 URL，建议调用方转存）
 */
export async function qwenText2Image(config: QwenMediaConfig, params: QwenImageParams): Promise<string[]> {
  const output = await submitAndPoll(
    config,
    '/services/aigc/text2image/image-synthesis',
    {
      model: params.model,
      input: {
        prompt: params.prompt,
        ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
      },
      parameters: {
        size: params.size || '1024*1024',
        n: Math.min(params.n || 1, 4),
      },
    },
    { pollIntervalMs: 3000, maxWaitMs: 300_000, label: '文生图' }
  );

  const urls = (output.results || [])
    .map(r => r.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  if (urls.length === 0) {
    throw new Error('千问文生图未返回图片结果');
  }
  return urls;
}

/**
 * 视频生成（文生视频 / 图生视频），返回视频 URL（临时，建议调用方转存）
 */
export async function qwenVideoGenerate(config: QwenMediaConfig, params: QwenVideoParams): Promise<string> {
  const output = await submitAndPoll(
    config,
    '/services/aigc/video-generation/generation',
    {
      model: params.model,
      input: {
        prompt: params.prompt,
        ...(params.imgUrl ? { img_url: params.imgUrl } : {}),
        ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
      },
      parameters: {
        ...(params.resolution ? { resolution: params.resolution } : {}),
        ...(params.duration ? { duration: params.duration } : {}),
        prompt_extend: true,
      },
    },
    { pollIntervalMs: 8000, maxWaitMs: 270_000, label: '视频' }
  );

  const videoUrl = output.video_url || (output.results || []).map(r => r.video_url || r.url).find(Boolean);
  if (!videoUrl) {
    throw new Error('千问视频生成未返回视频结果');
  }
  return videoUrl;
}
