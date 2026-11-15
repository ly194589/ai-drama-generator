import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

/**
 * 删除音色
 * 
 * DELETE /api/zhipu/voice-clone/[id]
 * 
 * 流程：
 * 1. 从数据库获取音色信息
 * 2. 删除对象存储中的样本文件
 * 3. 标记数据库记录为已删除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const { id: voiceId } = await params;

    const supabase = getSupabaseClient();

    // 1. 获取音色信息
    const { data: voice, error: fetchError } = await supabase
      .from('user_voices')
      .select('*')
      .eq('id', voiceId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !voice) {
      return NextResponse.json(
        { error: '音色不存在或无权限删除' },
        { status: 404 }
      );
    }

    console.log(`[音色删除] 删除音色: ${voice.voice_name} (${voiceId})`);

    // 2. 删除对象存储中的样本文件
    try {
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      });

      await storage.deleteFile({ fileKey: voice.sample_url });
      console.log(`[音色删除] 样本文件已删除: ${voice.sample_url}`);
    } catch (storageError) {
      console.error('[音色删除] 删除样本文件失败:', storageError);
      // 继续删除数据库记录
    }

    // 3. 标记数据库记录为已删除
    const { error: deleteError } = await supabase
      .from('user_voices')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', voiceId);

    if (deleteError) {
      console.error('[音色删除] 数据库更新失败:', deleteError);
      return NextResponse.json(
        { error: '删除失败' },
        { status: 500 }
      );
    }

    console.log(`[音色删除] 删除成功: ${voiceId}`);

    return NextResponse.json({
      success: true,
      message: '音色已删除',
    });

  } catch (error) {
    console.error('[音色删除] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
