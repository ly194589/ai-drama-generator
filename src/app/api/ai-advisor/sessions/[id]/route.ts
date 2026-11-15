import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, getLocalSession, listLocalMessages, deleteLocalSession } from '@/lib/server-config-store';

const SESSIONS_TABLE = 'ai_advisor_sessions';
const MESSAGES_TABLE = 'ai_advisor_messages';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id') || 'dev-user';

    if (!hasDatabaseConfig()) {
      // 未配置数据库：本地兜底存储
      if (!getLocalSession(userId, id)) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });
      }
      return NextResponse.json({ messages: listLocalMessages(id) });
    }

    const supabase = getSupabaseClient();

    // 验证会话归属
    const { data: session, error: sessionError } = await supabase
      .from(SESSIONS_TABLE)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from(MESSAGES_TABLE)
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error('[AI Advisor] GET messages error:', error);
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id') || 'dev-user';

    if (!hasDatabaseConfig()) {
      // 未配置数据库：本地兜底存储
      if (!getLocalSession(userId, id)) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });
      }
      deleteLocalSession(userId, id);
      return NextResponse.json({ success: true });
    }

    const supabase = getSupabaseClient();

    // 验证会话归属
    const { data: session, error: sessionError } = await supabase
      .from(SESSIONS_TABLE)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 删除消息
    await supabase.from(MESSAGES_TABLE).delete().eq('session_id', id);
    // 删除会话
    const { error } = await supabase.from(SESSIONS_TABLE).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI Advisor] DELETE session error:', error);
    return NextResponse.json({ error: '删除会话失败' }, { status: 500 });
  }
}