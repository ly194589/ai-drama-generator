import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 角色管理 API
 * 
 * GET: 获取角色列表
 * DELETE: 批量删除角色
 * 
 * 请求体 (DELETE):
 * {
 *   "characterIds": ["char-xxx-1", "char-xxx-2"] // 要删除的角色ID列表
 * }
 */

// 获取角色列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: series, error } = await supabase
      .from('drama_series')
      .select('characters')
      .eq('id', id)
      .single();

    if (error || !series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    const characters = (series.characters as Record<string, unknown>[]) || [];

    // 按类型分组统计
    const typeCount = {
      protagonist: characters.filter(c => c.characterType === 'protagonist').length,
      supporting: characters.filter(c => c.characterType === 'supporting').length,
      mystery: characters.filter(c => c.characterType === 'mystery').length,
      extra: characters.filter(c => c.characterType === 'extra').length,
      sceneNPC: characters.filter(c => c.characterType === 'sceneNPC').length,
    };

    return NextResponse.json({
      success: true,
      characters,
      typeCount,
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json(
      { error: '获取角色列表失败' },
      { status: 500 }
    );
  }
}

// 批量删除角色
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { characterIds } = body;

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的角色ID列表' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 获取当前剧本数据
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('characters')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    const currentCharacters = (series.characters as Record<string, unknown>[]) || [];
    const idSet = new Set(characterIds);

    // 过滤掉要删除的角色
    const remainingCharacters = currentCharacters.filter(
      char => !idSet.has(char.id as string)
    );

    // 获取被删除角色的名称列表（用于删除关联图片）
    const deletedCharacters = currentCharacters.filter(
      char => idSet.has(char.id as string)
    );
    const deletedNames = deletedCharacters.map(c => c.name as string);

    console.log(`[角色删除] 删除 ${deletedCharacters.length} 个角色: ${deletedNames.join(', ')}`);

    // 更新剧本的角色列表
    const { error: updateError } = await supabase
      .from('drama_series')
      .update({
        characters: remainingCharacters,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('更新角色列表失败:', updateError);
      return NextResponse.json(
        { error: '更新角色列表失败' },
        { status: 500 }
      );
    }

    // 删除关联的角色立绘图片
    if (deletedNames.length > 0) {
      const { error: deleteImagesError } = await supabase
        .from('image_materials')
        .delete()
        .eq('series_id', id)
        .eq('type', 'character')
        .in('character_name', deletedNames);

      if (deleteImagesError) {
        console.error('删除角色立绘失败:', deleteImagesError);
        // 不阻断主流程，仅记录错误
      } else {
        console.log(`[角色删除] 已删除关联立绘图片`);
      }
    }

    // 统计删除后的类型数量
    const typeCount = {
      protagonist: remainingCharacters.filter(c => c.characterType === 'protagonist').length,
      supporting: remainingCharacters.filter(c => c.characterType === 'supporting').length,
      mystery: remainingCharacters.filter(c => c.characterType === 'mystery').length,
      extra: remainingCharacters.filter(c => c.characterType === 'extra').length,
      sceneNPC: remainingCharacters.filter(c => c.characterType === 'sceneNPC').length,
    };

    return NextResponse.json({
      success: true,
      message: `成功删除 ${deletedCharacters.length} 个角色`,
      deletedCount: deletedCharacters.length,
      deletedNames,
      remainingCharacters,
      typeCount,
    });
  } catch (error) {
    console.error('批量删除角色失败:', error);
    return NextResponse.json(
      { error: '批量删除角色失败' },
      { status: 500 }
    );
  }
}
