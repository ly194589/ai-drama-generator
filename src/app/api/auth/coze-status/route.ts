import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 检查用户扣子账号绑定状态
 * 
 * GET: 返回用户的扣子账号绑定状态
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({
        bound: false,
        error: '未登录',
      });
    }
    
    const supabase = getSupabaseClient();
    
    // 查询用户的扣子账号信息
    const { data, error } = await supabase
      .from('user_config')
      .select('coze_user_id, coze_token_expires_at')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return NextResponse.json({
        bound: false,
      });
    }
    
    // 检查Token是否过期
    const tokenExpired = data.coze_token_expires_at 
      ? new Date(data.coze_token_expires_at) < new Date()
      : true;
    
    return NextResponse.json({
      bound: !!data.coze_user_id,
      cozeUserId: data.coze_user_id,
      tokenExpired,
    });
  } catch (error) {
    console.error('[Coze Status] 检查失败:', error);
    return NextResponse.json({
      bound: false,
      error: '检查失败',
    });
  }
}

/**
 * 解绑扣子账号
 * 
 * DELETE: 清除用户的扣子账号绑定
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const supabase = getSupabaseClient();
    
    // 清除用户的扣子账号信息
    const { error } = await supabase
      .from('user_config')
      .update({
        coze_user_id: null,
        coze_access_token: null,
        coze_refresh_token: null,
        coze_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      message: '已解绑扣子账号',
    });
  } catch (error) {
    console.error('[Coze Status] 解绑失败:', error);
    return NextResponse.json({
      error: '解绑失败',
    }, { status: 500 });
  }
}
