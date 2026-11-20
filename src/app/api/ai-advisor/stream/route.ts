import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, getLocalUserConfig } from '@/lib/server-config-store';
import { decryptSecret } from '@/lib/secret-crypto';

/** AI 顾问固定使用的模型 */
const ADVISOR_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

const SYSTEM_PROMPT = `你是专业的 AI 短剧创作顾问，基于 NVIDIA Nemotron 3 Ultra 550B（${ADVISOR_MODEL}）模型为用户提供专业指导。

你的专业领域包括：
1. **剧本创作**：核心冲突设计、剧情结构、节奏把控、开篇钩子、结尾悬念
2. **角色塑造**：人物小传、性格矛盾、人物弧光、关系网络、台词风格
3. **分镜设计**：景别选择、运镜语言、画面描述、时长分配、转场技巧
4. **提示词优化**：图片/视频生成提示词、风格关键词、参数调优
5. **短剧行业洞察**：抖音/快手/视频号平台特点、爆款套路、避坑指南

回答原则：
- 专业、实用、可落地
- 结合短剧 9:16 竖屏、1-3 分钟/集的特点
- 给出具体可执行的建议，而非泛泛而谈
- 善用结构化输出（要点、步骤、对比表等）
- 语气专业但亲切，像资深导演指导新人`;

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();
    const userId = request.headers.get('x-user-id') || 'dev-user';

    // 获取 NVIDIA 配置：数据库/本地存储中用户保存的密钥优先，其次环境变量兜底
    let storedKey: string | undefined;
    let storedBaseUrl: string | undefined;
    if (hasDatabaseConfig()) {
      try {
        const supabase = getSupabaseClient();
        const { data: config } = await supabase
          .from('user_config')
          .select('nvidia_api_key, nvidia_base_url')
          .eq('user_id', userId)
          .single();
        storedKey = config?.nvidia_api_key;
        storedBaseUrl = config?.nvidia_base_url;
      } catch (error) {
        console.error('[AI Advisor] 读取用户配置失败:', error);
      }
    } else {
      const row = getLocalUserConfig(userId);
      storedKey = typeof row.nvidia_api_key === 'string' ? row.nvidia_api_key : undefined;
      storedBaseUrl = typeof row.nvidia_base_url === 'string' ? row.nvidia_base_url : undefined;
    }

    const apiKey = decryptSecret(storedKey) || process.env.NVIDIA_API_KEY;
    const baseUrl = storedBaseUrl || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: '请先在模型设置中配置 NVIDIA API Key' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...(history || []),
      { role: 'user' as const, content: message }
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const controller2 = new AbortController();
          const timeoutId = setTimeout(() => controller2.abort(), 120000);

          const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: ADVISOR_MODEL,
              messages,
              temperature: 0.7,
              max_tokens: 4096,
              stream: true,
            }),
            signal: controller2.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await response.json().catch(() => ({} as Record<string, unknown>));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No response body');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[AI Advisor] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[AI Advisor] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '对话失败' }),
      { status: 500 }
    );
  }
}