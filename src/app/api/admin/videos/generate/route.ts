import { NextResponse } from 'next/server';

/**
 * 管理员视频生成 API（已废弃）
 * 
 * 火山引擎 API 已移除，所有视频生成统一使用扣子 SDK（Seedance 2.0）
 * 请使用 /api/videos/generate 接口
 */

export async function POST() {
  return NextResponse.json(
    { 
      error: '此接口已废弃，请使用 /api/videos/generate 接口（统一使用扣子 SDK Seedance 2.0）',
      deprecated: true,
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { 
      error: '此接口已废弃，请使用 /api/videos/generate 接口（统一使用扣子 SDK Seedance 2.0）',
      deprecated: true,
    },
    { status: 410 }
  );
}
