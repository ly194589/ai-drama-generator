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

// 获取单个图片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data: image, error } = await supabase
      .from('image_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !image) {
      return NextResponse.json(
        { error: '图片不存在' },
        { status: 404 }
      );
    }

    // 获取图片URL
    const imageUrl = await storage.generatePresignedUrl({ key: image.file_key });
    let thumbnailUrl = imageUrl;
    if (image.thumbnail_key) {
      thumbnailUrl = await storage.generatePresignedUrl({ key: image.thumbnail_key });
    }

    return NextResponse.json({
      success: true,
      image: {
        ...image,
        imageUrl,
        thumbnailUrl,
      },
    });
  } catch (error) {
    console.error('获取图片失败:', error);
    return NextResponse.json(
      { error: '获取图片失败' },
      { status: 500 }
    );
  }
}

// 删除图片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 获取图片信息
    const { data: image, error: fetchError } = await supabase
      .from('image_materials')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json(
        { error: '图片不存在' },
        { status: 404 }
      );
    }

    // 删除对象存储中的文件
    try {
      await storage.deleteFile({ fileKey: image.file_key });
      if (image.thumbnail_key && image.thumbnail_key !== image.file_key) {
        await storage.deleteFile({ fileKey: image.thumbnail_key });
      }
    } catch (e) {
      console.error('删除存储文件失败:', e);
    }

    // 删除数据库记录
    const { error: deleteError } = await supabase
      .from('image_materials')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: '删除图片记录失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '图片已删除',
    });
  } catch (error) {
    console.error('删除图片失败:', error);
    return NextResponse.json(
      { error: '删除图片失败' },
      { status: 500 }
    );
  }
}

// 更新图片信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseClient();

    const { data: image, error } = await supabase
      .from('image_materials')
      .update({
        title: body.title,
        description: body.description,
        tags: body.tags,
        mood: body.mood,
        style: body.style,
        purpose: body.purpose,
        platform: body.platform,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: '更新图片信息失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error('更新图片信息失败:', error);
    return NextResponse.json(
      { error: '更新图片信息失败' },
      { status: 500 }
    );
  }
}
