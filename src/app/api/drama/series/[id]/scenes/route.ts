import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 场景管理 API
 * 
 * GET: 获取场景列表
 * DELETE: 批量删除场景
 * 
 * 请求体 (DELETE):
 * {
 *   "sceneIds": ["scene-xxx-1", "scene-xxx-2"] // 要删除的场景ID列表
 * }
 */

// 获取场景列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: series, error } = await supabase
      .from('drama_series')
      .select('metadata')
      .eq('id', id)
      .single();

    if (error || !series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    const metadata = (series.metadata as Record<string, unknown>) || {};
    const sceneDefinitions = (metadata.sceneDefinitions as Record<string, Record<string, unknown>>) || {};

    // 转换为数组格式
    const scenes = Object.values(sceneDefinitions);

    // 按类型分组统计
    const typeCount = {
      fixed: scenes.filter(s => s.sceneType === 'fixed').length,
      common: scenes.filter(s => s.sceneType === 'common').length,
      special: scenes.filter(s => s.sceneType === 'special').length,
      transition: scenes.filter(s => s.sceneType === 'transition').length,
    };

    return NextResponse.json({
      success: true,
      scenes,
      sceneDefinitions,
      typeCount,
    });
  } catch (error) {
    console.error('获取场景列表失败:', error);
    return NextResponse.json(
      { error: '获取场景列表失败' },
      { status: 500 }
    );
  }
}

// 批量删除场景
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sceneIds } = body;

    if (!sceneIds || !Array.isArray(sceneIds) || sceneIds.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的场景ID列表' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 获取当前剧本数据
    const { data: series, error: seriesError } = await supabase
      .from('drama_series')
      .select('metadata')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json(
        { error: '剧本不存在' },
        { status: 404 }
      );
    }

    const currentMetadata = (series.metadata as Record<string, unknown>) || {};
    const currentSceneDefinitions = (currentMetadata.sceneDefinitions as Record<string, Record<string, unknown>>) || {};
    const idSet = new Set(sceneIds);

    // 获取被删除场景的信息
    const deletedScenes: Array<{ id: string; name: string }> = [];
    for (const sceneId of sceneIds) {
      const scene = currentSceneDefinitions[sceneId];
      if (scene) {
        deletedScenes.push({
          id: sceneId,
          name: scene.name as string,
        });
      }
    }

    // 过滤掉要删除的场景
    const remainingSceneDefinitions: Record<string, Record<string, unknown>> = {};
    for (const [sceneId, scene] of Object.entries(currentSceneDefinitions)) {
      if (!idSet.has(sceneId)) {
        remainingSceneDefinitions[sceneId] = scene;
      }
    }

    console.log(`[场景删除] 删除 ${deletedScenes.length} 个场景: ${deletedScenes.map(s => s.name).join(', ')}`);

    // 更新剧本的元数据
    const { error: updateError } = await supabase
      .from('drama_series')
      .update({
        metadata: {
          ...currentMetadata,
          sceneDefinitions: remainingSceneDefinitions,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('更新场景列表失败:', updateError);
      return NextResponse.json(
        { error: '更新场景列表失败' },
        { status: 500 }
      );
    }

    // 删除关联的场景图片（从image_materials表）
    if (deletedScenes.length > 0) {
      const deletedNames = deletedScenes.map(s => s.name);
      
      // 根据场景名称删除关联图片
      const { error: deleteImagesError } = await supabase
        .from('image_materials')
        .delete()
        .eq('series_id', id)
        .eq('type', 'scene')
        .in('title', deletedNames);

      if (deleteImagesError) {
        console.error('删除场景图片失败:', deleteImagesError);
        // 不阻断主流程，仅记录错误
      } else {
        console.log(`[场景删除] 已删除关联场景图片`);
      }
    }

    // 统计删除后的类型数量
    const remainingScenes = Object.values(remainingSceneDefinitions);
    const typeCount = {
      fixed: remainingScenes.filter(s => s.sceneType === 'fixed').length,
      common: remainingScenes.filter(s => s.sceneType === 'common').length,
      special: remainingScenes.filter(s => s.sceneType === 'special').length,
      transition: remainingScenes.filter(s => s.sceneType === 'transition').length,
    };

    return NextResponse.json({
      success: true,
      message: `成功删除 ${deletedScenes.length} 个场景`,
      deletedCount: deletedScenes.length,
      deletedNames: deletedScenes.map(s => s.name),
      remainingSceneDefinitions,
      typeCount,
    });
  } catch (error) {
    console.error('批量删除场景失败:', error);
    return NextResponse.json(
      { error: '批量删除场景失败' },
      { status: 500 }
    );
  }
}
