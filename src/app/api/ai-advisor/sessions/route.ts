import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hasDatabaseConfig, listLocalSessions, createLocalSession } from '@/lib/server-config-store';

const TABLE = 'ai_advisor_sessions';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';

    if (!hasDatabaseConfig()) {
      return NextResponse.json({ sessions: listLocalSessions(userId) });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ sessions: data || [] });
  } catch (error) {
    console.error('[AI Advisor] GET sessions error:', error);
    return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const { title } = await request.json();

    if (!hasDatabaseConfig()) {
      return NextResponse.json({ session: createLocalSession(userId, title) });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        title: title || '新咨询',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data });
  } catch (error) {
    console.error('[AI Advisor] POST session error:', error);
    return NextResponse.json({ error: '创建会话失败' }, { status: 500 });
  }
}