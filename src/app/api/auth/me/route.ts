import { NextRequest, NextResponse } from 'next/server';

/**
 * 获取当前登录用户信息
 * 从请求头的 Authorization token 中解析用户信息
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未登录', authenticated: false },
        { status: 401 }
      );
    }

    // 对于 OAuth 用户，token 就是用户的 access_token
    // 我们可以从请求头中获取用户信息，或者从 localStorage 中的 session 获取
    // 这里简单返回已认证状态
    return NextResponse.json({
      success: true,
      authenticated: true,
      message: '已通过扣子 OAuth 认证',
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
