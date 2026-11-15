import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 删除工作流历史记录 API
 * DELETE /api/workflow/history/[seriesId]/[historyId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; historyId: string }> }
) {
  try {
    const { seriesId, historyId } = await params;
    const supabase = getSupabaseClient();

    // 获取当前短剧的 metadata
    const { data: series, error: fetchError } = await supabase
      .from('drama_series')
      .select('metadata')
      .eq('id', seriesId)
      .single();

    if (fetchError || !series) {
      return NextResponse.json(
        { error: '短剧不存在' },
        { status: 404 }
      );
    }

    const currentMetadata = (series.metadata as Record<string, unknown>) || {};
    const currentHistory = Array.isArray(currentMetadata.workflow_history) 
      ? currentMetadata.workflow_history as Array<{ id?: string }>
      : [];

    // 过滤掉要删除的历史记录
    const updatedHistory = currentHistory.filter((entry) => 
      entry.id !== historyId
    );

    // 更新 metadata
    const { error: updateError } = await supabase
      .from('drama_series')
      .update({
        metadata: {
          ...currentMetadata,
          workflow_history: updatedHistory,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', seriesId);

    if (updateError) {
      return NextResponse.json(
        { error: '删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '历史记录已删除',
    });
  } catch (error) {
    console.error('删除工作流历史失败:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}
