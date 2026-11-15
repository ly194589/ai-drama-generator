import { NextRequest, NextResponse } from 'next/server';

/**
 * 千问 API Key 管理接口
 * 
 * GET: 获取千问配置状态
 * POST: 保存千问 API Key
 * DELETE: 删除千问 API Key
 */

function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '****';
  return `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 8, 20))}${apiKey.slice(-4)}`;
}

function validateApiKeyFormat(apiKey: string): boolean {
  // 千问 API Key 格式: sk- 开头，长度约 40-50 字符
  return apiKey.length >= 20 && (apiKey.startsWith('sk-') || /^[a-zA-Z0-9._-]+$/.test(apiKey));
}

async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json();
    return {
      valid: false,
      error: data.message || 'API Key 无效',
    };
  } catch (error) {
    return {
      valid: false,
      error: '验证请求失败，请检查网络连接',
    };
  }
}

/**
 * GET 获取千问配置状态
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'dev-user';

  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_config')
      .select('qwen_api_key, qwen_api_key_set_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[千问配置] 获取配置失败:', error);
    }

    const hasApiKey = !!(data?.qwen_api_key);
    const maskedKey = hasApiKey ? maskApiKey(data.qwen_api_key) : null;

    return NextResponse.json({
      configured: hasApiKey,
      maskedApiKey: maskedKey,
      setAt: data?.qwen_api_key_set_at || null,
    });
  } catch (error) {
    console.error('[千问配置] 获取失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST 保存千问 API Key
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'dev-user';

  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }

    if (!validateApiKeyFormat(apiKey)) {
      return NextResponse.json(
        { error: 'API Key 格式不正确，请检查' },
        { status: 400 }
      );
    }

    // 验证 API Key 有效性
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `API Key 验证失败: ${validation.error}` },
        { status: 400 }
      );
    }

    // 保存到数据库
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();

    const { error: upsertError } = await supabase
      .from('user_config')
      .upsert({
        user_id: userId,
        qwen_api_key: apiKey,
        qwen_api_key_set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('[千问配置] 保存失败:', upsertError);
      return NextResponse.json(
        { error: '保存失败' },
        { status: 500 }
      );
    }

    console.log(`[千问配置] API Key 已保存: ${maskApiKey(apiKey)}`);

    // 清除缓存
    const { clearQwenCache } = await import('@/lib/qwen-client');
    clearQwenCache(userId);

    return NextResponse.json({
      success: true,
      message: 'API Key 配置成功',
      maskedApiKey: maskApiKey(apiKey),
    });
  } catch (error) {
    console.error('[千问配置] 保存失败:', error);
    return NextResponse.json(
      { error: '保存失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE 删除千问 API Key
 */
export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'dev-user';

  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('user_config')
      .update({
        qwen_api_key: null,
        qwen_api_key_set_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[千问配置] 删除失败:', error);
      return NextResponse.json(
        { error: '删除失败' },
        { status: 500 }
      );
    }

    console.log(`[千问配置] 用户 ${userId} 已删除 API Key`);

    // 清除缓存
    const { clearQwenCache } = await import('@/lib/qwen-client');
    clearQwenCache(userId);

    return NextResponse.json({
      success: true,
      message: 'API Key 已删除',
    });
  } catch (error) {
    console.error('[千问配置] 删除失败:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}
