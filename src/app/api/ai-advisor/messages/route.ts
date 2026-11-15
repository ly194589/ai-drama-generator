import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, getLocalSession, appendLocalMessage } from '@/lib/server-config-store';

const TABLE = 'ai_advisor_messages';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const { sessionId, role, content } = await request.json();

    if (!hasDatabaseConfig()) {
      // 未配置数据库：本地兜底存储
      if (!getLocalSession(userId, sessionId)) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });
      }
      const message = appendLocalMessage(sessionId, role, content);
      return NextResponse.json({ message });
    }

    const supabase = getSupabaseClient();

    // 验证会话归属
    const { data: session, error: sessionError } = await supabase
      .from('ai_advisor_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        session_id: sessionId,
        role,
        content,
      })
      .select()
      .single();

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('ai_advisor_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error('[AI Advisor] POST message error:', error);
    return NextResponse.json({ error: '保存消息失败' }, { status: 500 });
  }
}