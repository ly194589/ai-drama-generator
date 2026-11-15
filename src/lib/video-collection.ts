import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 为剧本获取或创建视频合集
 * 每个剧本对应一个合集
 */
export async function getOrCreateCollectionForSeries(
  seriesId: string,
  seriesTitle: string
): Promise<{ id: string; title: string } | null> {
  const supabase = getSupabaseClient();

  try {
    // 1. 查找是否已存在该剧本的合集
    const { data: existingCollection } = await supabase
      .from('video_collections')
      .select('id, title')
      .eq('series_id', seriesId)
      .single();

    if (existingCollection) {
      console.log(`[合集] 找到现有合集: ${existingCollection.title}`);
      return existingCollection;
    }

    // 2. 创建新合集
    const collectionTitle = `${seriesTitle} - 视频合集`;
    const { data: newCollection, error } = await supabase
      .from('video_collections')
      .insert({
        title: collectionTitle,
        description: `《${seriesTitle}》的所有生成视频`,
        series_id: seriesId,
        video_count: 0,
        metadata: { autoCreated: true },
      })
      .select('id, title')
      .single();

    if (error) {
      console.error('[合集] 创建合集失败:', error);
      return null;
    }

    console.log(`[合集] 创建新合集: ${newCollection.title}`);
    return newCollection;
  } catch (error) {
    console.error('[合集] 获取或创建合集失败:', error);
    return null;
  }
}

/**
 * 更新合集视频数量
 */
export async function updateCollectionVideoCount(collectionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // 统计视频数量
    const { count } = await supabase
      .from('video_materials')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);

    // 更新合集
    await supabase
      .from('video_collections')
      .update({ video_count: count || 0 })
      .eq('id', collectionId);

    console.log(`[合集] 更新合集视频数量: ${count}`);
  } catch (error) {
    console.error('[合集] 更新视频数量失败:', error);
  }
}
