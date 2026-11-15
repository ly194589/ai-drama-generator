import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 保存消息
export async function POST(request: NextRequest) {
  const { sessionId, role, content } = await request.json();
  const client = getSupabaseClient();

  // 保存消息
  const { data, error } = await client
    .from('chat_messages')
    .insert({ session_id: sessionId, role, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 更新会话的 updated_at
  await client
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return NextResponse.json({ message: data });
}
