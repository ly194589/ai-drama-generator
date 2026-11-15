import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 获取视频详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 先从 videos 表查找
    let video = null;
    let fromVideosTable = false;
    
    const { data: videoFromVideos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (videoFromVideos && !videosError) {
      video = videoFromVideos;
      fromVideosTable = true;
    } else {
      // 如果 videos 表没有，再从 video_materials 表查找
      const { data: videoFromMaterials, error: materialsError } = await supabase
        .from('video_materials')
        .select('*')
        .eq('id', id)
        .single();
      
      if (videoFromMaterials && !materialsError) {
        video = videoFromMaterials;
      }
    }

    if (!video) {
      return NextResponse.json(
        { error: '视频不存在' },
        { status: 404 }
      );
    }

    // 生成访问URL
    let videoUrl: string;
    const fileKey = fromVideosTable ? video.video_url : video.file_key;
    
    if (fileKey && (fileKey.startsWith('http://') || fileKey.startsWith('https://'))) {
      videoUrl = fileKey;
    } else if (fileKey) {
      videoUrl = await storage.generatePresignedUrl({ 
        key: fileKey, 
        expireTime: 86400 
      });
    } else {
      videoUrl = '';
    }
    
    let thumbnailUrl = null;
    const thumbnailKey = fromVideosTable ? video.last_frame_url : video.thumbnail_key;
    if (thumbnailKey) {
      if (thumbnailKey.startsWith('http://') || thumbnailKey.startsWith('https://')) {
        thumbnailUrl = thumbnailKey;
      } else {
        thumbnailUrl = await storage.generatePresignedUrl({ 
          key: thumbnailKey, 
          expireTime: 86400 
        });
      }
    }

    return NextResponse.json({
      success: true,
      video: {
        ...video,
        videoUrl,
        thumbnailUrl,
        _fromVideosTable: fromVideosTable,
      },
    });
  } catch (error) {
    console.error('获取视频详情失败:', error);
    return NextResponse.json(
      { error: '获取视频详情失败' },
      { status: 500 }
    );
  }
}

// 删除视频
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // 先从 videos 表查找
    let video = null;
    let fromVideosTable = false;
    
    const { data: videoFromVideos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (videoFromVideos && !videosError) {
      video = videoFromVideos;
      fromVideosTable = true;
    } else {
      // 如果 videos 表没有，再从 video_materials 表查找
      const { data: videoFromMaterials, error: materialsError } = await supabase
        .from('video_materials')
        .select('*')
        .eq('id', id)
        .single();
      
      if (videoFromMaterials && !materialsError) {
        video = videoFromMaterials;
      }
    }

    if (!video) {
      return NextResponse.json(
        { error: '视频不存在' },
        { status: 404 }
      );
    }

    // 获取文件key
    const fileKey = fromVideosTable ? video.video_url : video.file_key;
    
    // 删除对象存储中的文件（仅当file_key是S3 key而非完整URL时）
    if (fileKey && !fileKey.startsWith('http://') && !fileKey.startsWith('https://')) {
      try {
        await storage.deleteFile({ fileKey });
      } catch (e) {
        console.warn('删除存储文件失败（可忽略）:', e);
      }
    }
    
    // 删除缩略图/尾帧图（如果有，且不是完整URL）
    const thumbnailKey = fromVideosTable ? video.last_frame_url : video.thumbnail_key;
    if (thumbnailKey) {
      if (!thumbnailKey.startsWith('http://') && !thumbnailKey.startsWith('https://')) {
        try {
          await storage.deleteFile({ fileKey: thumbnailKey });
        } catch (e) {
          console.warn('删除缩略图失败（可忽略）:', e);
        }
      }
    }

    // 删除数据库记录
    if (fromVideosTable) {
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('删除videos记录错误:', deleteError);
        return NextResponse.json(
          { error: '删除视频失败' },
          { status: 500 }
        );
      }
    } else {
      const { error: deleteError } = await supabase
        .from('video_materials')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('删除video_materials记录错误:', deleteError);
        return NextResponse.json(
          { error: '删除视频失败' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '视频已删除',
    });
  } catch (error) {
    console.error('删除视频失败:', error);
    return NextResponse.json(
      { error: '删除视频失败' },
      { status: 500 }
    );
  }
}

// 更新视频信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, tags } = body;
    const supabase = getSupabaseClient();

    // 先从 videos 表查找
    let fromVideosTable = false;
    
    const { data: videoFromVideos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('id', id)
      .single();
    
    if (videoFromVideos && !videosError) {
      fromVideosTable = true;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    // videos 表使用 prompt 字段作为描述
    if (fromVideosTable) {
      if (title) updateData.prompt = title;  // videos 表没有 title 字段，用 prompt 替代
      // videos 表没有 tags 字段
    } else {
      // video_materials 表
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (tags) updateData.tags = tags;
    }

    const tableName = fromVideosTable ? 'videos' : 'video_materials';
    const { data: video, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !video) {
      return NextResponse.json(
        { error: '视频不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      video,
    });
  } catch (error) {
    console.error('更新视频失败:', error);
    return NextResponse.json(
      { error: '更新视频失败' },
      { status: 500 }
    );
  }
}
