import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 智谱 API Key 配置管理 API
 * 
 * GET: 获取用户的智谱配置状态
 * POST: 保存/验证 API Key
 * DELETE: 删除 API Key
 */

// 掩码 API Key，只显示前4位和后4位
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '****';
  return `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 8, 20))}${apiKey.slice(-4)}`;
}

// 验证 API Key 格式
function validateApiKeyFormat(apiKey: string): boolean {
  // 智谱 API Key 格式: 通常以 zhipuai 开头，长度约 40-50 字符
  return apiKey.length >= 20 && /^[a-zA-Z0-9._-]+$/.test(apiKey);
}

// 验证 API Key 是否有效（调用智谱 API）
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json().catch(() => ({}));
    const errorMessage = error.error?.message || '验证失败';
    
    return { valid: false, error: errorMessage };
  } catch (error) {
    return { valid: false, error: '网络错误，请检查网络连接' };
  }
}

/**
 * 获取用户的智谱配置状态
 */
export async function GET(request: NextRequest) {
  try {
    // 从请求中获取用户ID（开发环境使用默认用户）
    const userId = request.headers.get('x-user-id') || 'dev-user';
    
    const supabase = getSupabaseClient();
    
    // 查询用户的智谱配置
    const { data, error } = await supabase
      .from('user_config')
      .select('zhipu_api_key, zhipu_api_key_set_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[智谱配置] 查询失败:', error);
    }

    const hasApiKey = !!(data?.zhipu_api_key);
    const maskedKey = hasApiKey ? maskApiKey(data.zhipu_api_key) : null;

    return NextResponse.json({
      configured: hasApiKey,
      maskedApiKey: maskedKey,
      setAt: data?.zhipu_api_key_set_at || null,
    });

  } catch (error) {
    console.error('[智谱配置] 获取状态失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * 保存并验证 API Key
 */
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }

    // 验证格式
    if (!validateApiKeyFormat(apiKey)) {
      return NextResponse.json(
        { error: 'API Key 格式无效，请检查是否正确复制' },
        { status: 400 }
      );
    }

    // 验证 API Key 是否有效
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `API Key 验证失败: ${validation.error}` },
        { status: 400 }
      );
    }

    // 获取用户ID
    const userId = request.headers.get('x-user-id') || 'dev-user';
    
    const supabase = getSupabaseClient();
    
    // 保存到数据库（upsert）
    const { error } = await supabase
      .from('user_config')
      .upsert({
        user_id: userId,
        zhipu_api_key: apiKey,
        zhipu_api_key_set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('[智谱配置] 保存失败:', error);
      return NextResponse.json(
        { error: '保存失败，请稍后重试' },
        { status: 500 }
      );
    }

    console.log(`[智谱配置] API Key 已保存: ${maskApiKey(apiKey)}`);

    return NextResponse.json({
      success: true,
      message: 'API Key 配置成功',
      maskedApiKey: maskApiKey(apiKey),
    });

  } catch (error) {
    console.error('[智谱配置] 保存失败:', error);
    return NextResponse.json(
      { error: '配置保存失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除 API Key
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('user_config')
      .update({
        zhipu_api_key: null,
        zhipu_api_key_set_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[智谱配置] 删除失败:', error);
      return NextResponse.json(
        { error: '删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API Key 已删除',
    });

  } catch (error) {
    console.error('[智谱配置] 删除失败:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}
