import { NextResponse } from 'next/server';

/** 服务健康检查（公开，用于外部监控） */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ai-drama',
    time: new Date().toISOString(),
  });
}
