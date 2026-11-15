import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取所有会话
export async function GET() {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}

// 创建新会话
export async function POST(request: NextRequest) {
  const { title } = await request.json();
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('chat_sessions')
    .insert({ title: title || '新对话' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
