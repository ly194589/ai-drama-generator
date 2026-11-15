import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 获取单个音频
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: audio, error } = await supabase
      .from('audio_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !audio) {
      return NextResponse.json(
        { error: '音频不存在' },
        { status: 404 }
      );
    }

    // 获取音频URL
    const audioUrl = await storage.generatePresignedUrl({ key: audio.file_key });

    return NextResponse.json({
      success: true,
      audio: {
        ...audio,
        audioUrl,
      },
    });
  } catch (error) {
    console.error('获取音频失败:', error);
    return NextResponse.json(
      { error: '获取音频失败' },
      { status: 500 }
    );
  }
}

// 删除音频
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 获取音频信息
    const { data: audio, error: fetchError } = await supabase
      .from('audio_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !audio) {
      return NextResponse.json(
        { error: '音频不存在' },
        { status: 404 }
      );
    }

    // 删除对象存储中的文件（仅当file_key是S3 key而非完整URL时）
    const fileKey = audio.file_key as string;
    if (fileKey && !fileKey.startsWith('http://') && !fileKey.startsWith('https://')) {
      try {
        await storage.deleteFile({ fileKey });
      } catch (e) {
        console.warn('删除存储文件失败（可忽略）:', e);
      }
    }

    // 删除数据库记录
    const { error: deleteError } = await supabase
      .from('audio_materials')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: '音频删除成功',
    });
  } catch (error) {
    console.error('删除音频失败:', error);
    return NextResponse.json(
      { error: '删除音频失败' },
      { status: 500 }
    );
  }
}
