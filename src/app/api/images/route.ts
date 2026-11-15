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

// 获取图片列表
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const seriesId = searchParams.get('seriesId');
    
    // 获取当前用户ID
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false, images: [] },
        { status: 401 }
      );
    }

    let query = supabase
      .from('image_materials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }
    if (seriesId) {
      query = query.eq('series_id', seriesId);
    }

    const { data: images, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: '获取图片列表失败' },
        { status: 500 }
      );
    }

    // 获取图片URL
    const imagesWithUrls = await Promise.all(
      (images || []).map(async (img) => {
        try {
          const imageUrl = await storage.generatePresignedUrl({ key: img.file_key });
          let thumbnailUrl = imageUrl;
          if (img.thumbnail_key) {
            thumbnailUrl = await storage.generatePresignedUrl({ key: img.thumbnail_key });
          }
          return {
            ...img,
            imageUrl,
            thumbnailUrl,
          };
        } catch {
          return {
            ...img,
            imageUrl: '',
            thumbnailUrl: '',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      images: imagesWithUrls,
    });
  } catch (error) {
    console.error('获取图片列表失败:', error);
    return NextResponse.json(
      { error: '获取图片列表失败' },
      { status: 500 }
    );
  }
}

// 批量删除图片
export async function DELETE(request: NextRequest) {
  try {
    // 方式1: 从URL参数获取 (更可靠)
    const urlIds = request.nextUrl.searchParams.get('ids');
    if (urlIds) {
      try {
        const imageIds = JSON.parse(urlIds);
        if (Array.isArray(imageIds) && imageIds.length > 0) {
          return await deleteImages(imageIds);
        }
      } catch {
        // 继续尝试请求体方式
      }
    }
    
    // 方式2: 从请求体获取
    const rawText = await request.text();
    
    // 空请求体处理
    if (!rawText || rawText.trim() === '') {
      return NextResponse.json(
        { error: '请求体为空，请使用URL参数传递ids' },
        { status: 400 }
      );
    }
    
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: '请求体不是有效的JSON格式' },
        { status: 400 }
      );
    }
    
    const { imageIds } = body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的图片ID列表' },
        { status: 400 }
      );
    }

    return await deleteImages(imageIds);
  } catch (error) {
    console.error('批量删除图片失败:', error);
    return NextResponse.json(
      { error: '批量删除图片失败' },
      { status: 500 }
    );
  }
}

// 抽取删除逻辑为独立函数
async function deleteImages(imageIds: string[]) {
  const supabase = getSupabaseClient();

  // 获取要删除的图片信息
  const { data: images, error: fetchError } = await supabase
    .from('image_materials')
    .select('*')
    .in('id', imageIds);

  if (fetchError) {
    console.error('获取图片信息失败:', fetchError);
    return NextResponse.json(
      { error: '获取图片信息失败' },
      { status: 500 }
    );
  }

  if (!images || images.length === 0) {
    return NextResponse.json(
      { error: '未找到要删除的图片' },
      { status: 404 }
    );
  }

  // 删除对象存储中的文件
  const deletePromises: Promise<unknown>[] = [];
  for (const image of images) {
    deletePromises.push(
      storage.deleteFile({ fileKey: image.file_key }).catch((e) => {
        console.error(`删除存储文件失败: ${image.file_key}`, e);
      })
    );
    if (image.thumbnail_key && image.thumbnail_key !== image.file_key) {
      deletePromises.push(
        storage.deleteFile({ fileKey: image.thumbnail_key }).catch((e) => {
          console.error(`删除缩略图失败: ${image.thumbnail_key}`, e);
        })
      );
    }
  }
  await Promise.all(deletePromises);

  // 批量删除数据库记录
  const { error: deleteError } = await supabase
    .from('image_materials')
    .delete()
    .in('id', imageIds);

  if (deleteError) {
    console.error('删除图片记录失败:', deleteError);
    return NextResponse.json(
      { error: '删除图片记录失败' },
      { status: 500 }
    );
  }

  console.log(`[图片删除] 成功删除 ${images.length} 张图片`);

  return NextResponse.json({
    success: true,
    message: `成功删除 ${images.length} 张图片`,
    deletedCount: images.length,
    deletedIds: imageIds,
  });
}

// 上传图片
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string || 'scene';
    const category = formData.get('category') as string;
    const seriesId = formData.get('seriesId') as string;
    const episodeId = formData.get('episodeId') as string;
    const characterId = formData.get('characterId') as string;
    const characterName = formData.get('characterName') as string;
    const purpose = formData.get('purpose') as string;
    const style = formData.get('style') as string;
    const mood = formData.get('mood') as string;
    const platform = formData.get('platform') as string;
    const tagsStr = formData.get('tags') as string;

    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的图片' },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '只能上传图片文件' },
        { status: 400 }
      );
    }

    // 上传到对象存储
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName: `images/${type}/${Date.now()}-${file.name}`,
      contentType: file.type,
    });

    // 生成缩略图（简化处理，使用原图）
    const thumbnailKey = fileKey;
    
    // 解析标签
    let tags: string[] = [];
    if (tagsStr) {
      try {
        tags = JSON.parse(tagsStr);
      } catch {
        tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    // 保存到数据库
    const supabase = getSupabaseClient();
    const { data: image, error } = await supabase
      .from('image_materials')
      .insert({
        title: title || file.name,
        description,
        type,
        category,
        file_key: fileKey,
        file_name: file.name,
        file_size: file.size,
        width: 1024, // 默认尺寸
        height: 1024,
        format: file.name.split('.').pop() || 'jpg',
        thumbnail_key: thumbnailKey,
        series_id: seriesId || null,
        episode_id: episodeId || null,
        character_id: characterId || null,
        character_name: characterName || null,
        purpose,
        style,
        mood,
        platform,
        is_ai_generated: false,
        tags,
      })
      .select()
      .single();

    if (error) {
      console.error('保存图片信息失败:', error);
      return NextResponse.json(
        { error: '保存图片信息失败' },
        { status: 500 }
      );
    }

    // 获取图片URL
    const imageUrl = await storage.generatePresignedUrl({ key: fileKey });
    const thumbnailUrl = await storage.generatePresignedUrl({ key: thumbnailKey });

    return NextResponse.json({
      success: true,
      image: {
        ...image,
        imageUrl,
        thumbnailUrl,
      },
    });
  } catch (error) {
    console.error('上传图片失败:', error);
    return NextResponse.json(
      { error: '上传图片失败' },
      { status: 500 }
    );
  }
}
