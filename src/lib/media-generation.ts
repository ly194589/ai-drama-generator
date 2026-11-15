/**
 * 媒体生成统一分发 - 按用户所选厂商调用对应图片生成 API
 *
 * 支持: zhipu(智谱) / qwen(千问万相) / volcengine(火山方舟) / custom(OpenAI 兼容端点)
 * coze(扣子内置) 由调用方直接走 coze sdk（ImageGenerationClient），不走本模块。
 */

import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { getQwenMediaConfig, qwenText2Image } from '@/lib/qwen-media-client';
import { getCompatibleProviderConfig, isCompatibleProvider, COMPATIBLE_PROVIDERS } from '@/lib/openai-compatible-client';

export interface ProviderImageRequest {
  userId: string;
  provider: string;
  model: string;
  prompt: string;
  /** 如 2560x1440（x 分隔，内部按厂商协议转换） */
  size: string;
  count?: number;
  /** 参考图（qwen 文生图暂不支持参考图输入，将忽略） */
  referenceImageUrl?: string;
}

export interface ProviderImageResult {
  urls: string[];
  provider: string;
  model: string;
}

/** 厂商 OpenAI 兼容 images 端点支持的尺寸转换（统一 x 格式，不做比例强制） */
function normalizeSizeForOpenAI(size: string): string {
  const [w, h] = size.split(/[x*]/).map(s => parseInt(s, 10));
  if (!w || !h) return '1024x1024';
  return `${w}x${h}`;
}

function normalizeSizeForDashScope(size: string): string {
  const [w, h] = size.split(/[x*]/).map(s => parseInt(s, 10));
  if (!w || !h) return '1024*1024';
  return `${w}*${h}`;
}

/**
 * 按厂商生成图片，返回图片 URL 列表（临时 URL，调用方自行决定是否转存）
 * Key 未配置时抛出带友好提示的错误。
 */
export async function generateImageForProvider(req: ProviderImageRequest): Promise<ProviderImageResult> {
  const { userId, provider, model, prompt, size, count = 1 } = req;

  if (provider === 'zhipu') {
    const configured = await isZhipuConfiguredForUser(userId);
    if (!configured) {
      throw new Error('智谱 API Key 未配置，请前往「模型设置」配置后再使用');
    }
    const client = await getZhipuClientAsync(userId);
    // 智谱支持的尺寸集合：CogView-4 支持更多宽高比（16 的倍数）
    const isCogView = (model || 'glm-image').startsWith('cogview');
    const zhipuSizes = isCogView
      ? ['1024x1024', '864x1152', '1152x864', '1344x768', '768x1344', '1440x720', '720x1440']
      : ['1024x1024', '768x1024', '1024x768'];
    const landscapeSize = isCogView ? '1344x768' : '1024x768';
    const portraitSize = isCogView ? '768x1344' : '768x1024';
    const target = zhipuSizes.includes(size) ? size : (() => {
      const [w, h] = size.split(/[x*]/).map(s => parseInt(s, 10));
      if (!w || !h) return '1024x1024';
      const ratio = w / h;
      if (ratio > 1.2) return landscapeSize;
      if (ratio < 0.8) return portraitSize;
      return '1024x1024';
    })();
    const response = await client.generateImage(prompt, { size: target });
    const urls = (response.data || [])
      .map(item => item.url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
      .slice(0, count);
    if (urls.length === 0) throw new Error('智谱图片生成未返回结果');
    return { urls, provider, model: model || 'glm-image' };
  }

  if (provider === 'qwen') {
    const config = await getQwenMediaConfig(userId);
    if (!config) {
      throw new Error('千问 API Key 未配置，请前往「模型设置」配置后再使用');
    }
    const urls = await qwenText2Image(config, {
      model: model || 'wan2.7-image-pro',
      prompt,
      size: normalizeSizeForDashScope(size),
      n: count,
    });
    return { urls, provider, model };
  }

  if (isCompatibleProvider(provider)) {
    const config = await getCompatibleProviderConfig(userId, provider);
    if (!config) {
      throw new Error(`${COMPATIBLE_PROVIDERS[provider].name} API Key 未配置，请前往「模型设置」配置后再使用`);
    }
    if (!config.baseUrl) {
      throw new Error(`${COMPATIBLE_PROVIDERS[provider].name} 端点地址未配置，请前往「模型设置」填写接口地址`);
    }

    const body: Record<string, unknown> = {
      model: model || 'doubao-seedream-5-0-260128',
      prompt,
      n: Math.min(count, 4),
      size: normalizeSizeForOpenAI(size),
      response_format: 'url',
    };

    const res = await fetch(`${config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const data = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
      message?: string;
    };

    if (!res.ok) {
      const msg = data.error?.message || data.message || `HTTP ${res.status}`;
      console.error(`[媒体分发] ${provider} 图片生成失败:`, msg);
      throw new Error(`${COMPATIBLE_PROVIDERS[provider].name} 图片生成失败: ${msg}`);
    }

    const urls = (data.data || [])
      .map(item => item.url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
      .slice(0, count);

    if (urls.length === 0) throw new Error(`${COMPATIBLE_PROVIDERS[provider].name} 图片生成未返回结果`);
    return { urls, provider, model: body.model as string };
  }

  throw new Error(`厂商 ${provider} 暂不支持图片生成，请选择扣子内置、智谱、千问、火山引擎或自定义端点`);
}
