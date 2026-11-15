import { NextRequest, NextResponse } from 'next/server';

/**
 * 开发者登录接口
 * 使用预设密码登录，跳过 OAuth
 * 仅用于开发环境或开发者自用
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // 从环境变量获取开发者密码
    const devPassword = process.env.DEV_LOGIN_PASSWORD;

    if (!devPassword) {
      return NextResponse.json(
        { error: '开发者登录未配置' },
        { status: 500 }
      );
    }

    // 验证密码
    if (password !== devPassword) {
      return NextResponse.json(
        { error: '密码错误' },
        { status: 401 }
      );
    }

    // 创建开发者 session
    const sessionData = {
      user_id: 'dev_user',
      email: 'dev@local.dev',
      name: '开发者',
      avatar: null,
      role: 'developer',
      login_time: Date.now(),
    };

    // 返回成功响应
    return NextResponse.json({
      success: true,
      user: {
        id: sessionData.user_id,
        email: sessionData.email,
        name: sessionData.name,
        avatar: sessionData.avatar,
        role: sessionData.role,
      },
    });
  } catch (error) {
    console.error('开发者登录失败:', error);
    return NextResponse.json(
      { error: '登录失败' },
      { status: 500 }
    );
  }
}
