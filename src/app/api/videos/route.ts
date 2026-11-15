import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { desc } from 'drizzle-orm';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 获取视频列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const seriesId = searchParams.get('seriesId');
    const episodeNumber = searchParams.get('episodeNumber');
    const collectionId = searchParams.get('collectionId');
    const groupByCollection = searchParams.get('groupByCollection') === 'true';

    // 获取当前用户ID
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false, videos: [] },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    
    // 如果需要按合集分组
    if (groupByCollection) {
      // 获取所有合集（按用户过滤）
      const { data: collections, error: collectionError } = await supabase
        .from('video_collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (collectionError) {
        console.error('查询合集失败:', collectionError);
        return NextResponse.json(
          { error: '获取合集列表失败' },
          { status: 500 }
        );
      }
      
      // 为每个合集获取视频
      const groupedVideos = await Promise.all(
        (collections || []).map(async (collection) => {
          const { data: videos, count } = await supabase
            .from('video_materials')
            .select('*', { count: 'exact' })
            .eq('collection_id', collection.id)
            .order('created_at', { ascending: false })
            .limit(5); // 每个合集只取前5个视频预览
          
          // 为视频生成URL
          const videosWithUrls = await Promise.all(
            (videos || []).map(async (video: Record<string, unknown>) => {
              const fileKey = video.file_key as string;
              let videoUrl: string;
              
              if (fileKey && (fileKey.startsWith('http://') || fileKey.startsWith('https://'))) {
                videoUrl = fileKey;
              } else {
                videoUrl = await storage.generatePresignedUrl({ 
                  key: fileKey, 
                  expireTime: 86400 
                });
              }
              
              return {
                id: video.id,
                title: video.title,
                videoUrl,
                duration: video.duration,
                createdAt: video.created_at,
              };
            })
          );
          
          return {
            collection: {
              id: collection.id,
              title: collection.title,
              description: collection.description,
              seriesId: collection.series_id,
              coverImageUrl: collection.cover_image_url,
              videoCount: count || 0,
              createdAt: collection.created_at,
            },
            videos: videosWithUrls,
          };
        })
      );
      
      return NextResponse.json({
        success: true,
        grouped: true,
        collections: groupedVideos,
      });
    }
    
    // 构建查询 - 从 videos 表查询（AI生成的视频保存在这里）
    // 按 sort_order 升序排序，确保视频按正确顺序显示
    // 如果 sort_order 为空，则按 created_at 降序
    let query = supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    
    // 如果指定了剧集编号，优先按剧集编号过滤（这样可以包含没有 collection_id 的合并视频）
    if (episodeNumber) {
      query = query.eq('episode_number', parseInt(episodeNumber, 10));
    } else if (seriesId) {
      // 如果指定了剧本ID但没有剧集编号，需要通过 collection 关联查询
      // videos 表没有直接的 series_id，通过 collection_id 关联
      // 注意：这会过滤掉没有 collection_id 的合并视频
      const { data: collections } = await supabase
        .from('video_collections')
        .select('id')
        .eq('series_id', seriesId);
      
      const collectionIds = (collections || []).map(c => c.id);
      if (collectionIds.length > 0) {
        query = query.in('collection_id', collectionIds);
      } else {
        // 没有匹配的集合，返回空结果
        return NextResponse.json({
          success: true,
          videos: [],
        });
      }
    }
    
    // 如果指定了合集ID，添加过滤条件
    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }
    
    // 应用分页
    query = query.range(offset, offset + limit - 1);
    
    const { data: videos, error } = await query;

    if (error) {
      console.error('数据库查询错误:', error);
      return NextResponse.json(
        { error: '获取视频列表失败' },
        { status: 500 }
      );
    }

    // 获取所有剧本信息，用于显示剧本名称
    const { data: seriesList } = await supabase
      .from('drama_series')
      .select('id, title');
    
    // 获取所有视频合集信息，用于关联剧本
    const { data: collections } = await supabase
      .from('video_collections')
      .select('id, series_id, title');
    
    // 构建 collection_id -> series 的映射
    const collectionToSeries = new Map(
      (collections || []).map(c => [c.id, { seriesId: c.series_id, title: c.title }])
    );
    
    // 构建 episode_number -> series 的映射（通过其他视频推断）
    const episodeToSeries = new Map<number, { seriesId: string; title: string }>();
    for (const video of (videos || [])) {
      if (video.collection_id && !video.hook_type?.includes('merged')) {
        const info = collectionToSeries.get(video.collection_id as string);
        if (info && video.episode_number) {
          episodeToSeries.set(video.episode_number as number, info);
        }
      }
    }

    // 为每个视频生成访问URL
    const videosWithUrls = await Promise.all(
      (videos || []).map(async (video: Record<string, unknown>) => {
        // 记录视频信息用于调试
        console.log('[视频列表] 视频ID:', video.id, 'episode:', video.episode_number, 'sort_order:', video.sort_order);
        
        // videos 表使用 video_url 字段
        const videoUrlValue = video.video_url as string;
        let videoUrl: string;
        
        if (videoUrlValue && (videoUrlValue.startsWith('http://') || videoUrlValue.startsWith('https://'))) {
          // 已经是完整URL，直接使用
          videoUrl = videoUrlValue;
        } else if (videoUrlValue) {
          // S3 key，需要生成预签名URL
          videoUrl = await storage.generatePresignedUrl({ 
            key: videoUrlValue, 
            expireTime: 86400 
          });
        } else {
          videoUrl = '';
        }
        
        // 获取最后一帧图片URL
        const lastFrameUrl = video.last_frame_url as string | null;
        
        // 获取剧本信息
        let seriesInfo: { seriesId: string | null; seriesTitle: string | null } = { seriesId: null, seriesTitle: null };
        if (video.collection_id) {
          const info = collectionToSeries.get(video.collection_id as string);
          if (info) {
            seriesInfo = { seriesId: info.seriesId, seriesTitle: info.title };
          }
        } else if (video.episode_number) {
          // merged 视频没有 collection_id，通过 episode_number 推断
          const info = episodeToSeries.get(video.episode_number as number);
          if (info) {
            seriesInfo = { seriesId: info.seriesId, seriesTitle: info.title };
          }
        }
        
        return {
          id: video.id,
          title: video.title || `第${video.episode_number || 1}集视频`,  // 优先使用数据库中的标题
          description: video.prompt,
          fileName: `video-${video.id}.mp4`,
          fileSize: video.file_size,
          duration: video.duration,
          ratio: video.ratio || '16:9', // 视频比例，默认16:9
          status: video.status,
          metadata: video.metadata,
          tags: [],
          createdAt: video.created_at,
          videoUrl,
          thumbnailUrl: lastFrameUrl,
          seriesId: seriesInfo.seriesId,
          seriesTitle: seriesInfo.seriesTitle,
          collectionId: video.collection_id,
          episodeNumber: video.episode_number,
          hookType: video.hook_type || 'storyboard', // 视频类型
          sortOrder: video.sort_order, // 视频排序顺序
          createdAtDate: new Date(video.created_at as string), // 用于去重排序
        };
      })
    );

    // 去重：同一个分镜只保留最新的视频记录
    // 这样可以避免因为重复生成导致的状态恢复问题
    const deduplicatedVideos = (() => {
      const videoMap = new Map<string, typeof videosWithUrls[0]>();
      
      for (const video of videosWithUrls) {
        // 对于分镜视频，使用 sort_order 作为唯一标识
        // 如果 sort_order 为空，从标题中提取分镜编号作为后备
        let videoSortOrder = video.sortOrder as number | undefined;
        if (videoSortOrder === undefined || videoSortOrder === null) {
          const title = (video.title as string) || '';
          const match = title.match(/分镜(\d+)/);
          videoSortOrder = match ? parseInt(match[1], 10) - 1 : 0; // 转为0-based
        }
        const key = video.hookType === 'storyboard' 
          ? `${video.episodeNumber}-${videoSortOrder}`
          : `${video.episodeNumber}-${video.hookType}`;
        
        const existing = videoMap.get(key);
        if (!existing || video.createdAtDate > existing.createdAtDate) {
          videoMap.set(key, video);
        }
      }
      
      // 返回去重后的列表，并移除临时字段
      return Array.from(videoMap.values())
        .sort((a, b) => {
          // merged 视频排在最前面
          if (a.hookType === 'merged') return -1;
          if (b.hookType === 'merged') return 1;
          
          // hook 排在 merged 之后
          if (a.hookType === 'hook') return -1;
          if (b.hookType === 'hook') return 1;
          
          // cliffhanger 排在最后
          if (a.hookType === 'cliffhanger') return 1;
          if (b.hookType === 'cliffhanger') return -1;
          
          // storyboard 按 sort_order 排序
          if (a.hookType === 'storyboard' && b.hookType === 'storyboard') {
            const aSort = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
            const bSort = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
            return aSort - bSort;
          }
          return b.createdAtDate.getTime() - a.createdAtDate.getTime();
        })
        .map(({ createdAtDate, ...rest }) => rest);
    })();

    return NextResponse.json({
      success: true,
      videos: deduplicatedVideos,
    });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    return NextResponse.json(
      { error: '获取视频列表失败' },
      { status: 500 }
    );
  }
}

// 上传视频
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('video/')) {
      return NextResponse.json(
        { error: '请上传视频文件' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `videos/${Date.now()}_${file.name}`;

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName,
      contentType: file.type,
    });

    // 保存到数据库
    const supabase = getSupabaseClient();
    const { data: video, error } = await supabase
      .from('video_materials')
      .insert({
        title: title || file.name,
        description,
        file_key: fileKey,
        file_name: file.name,
        file_size: file.size,
        status: 'uploaded',
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      console.error('数据库插入错误:', error);
      return NextResponse.json(
        { error: '保存视频信息失败' },
        { status: 500 }
      );
    }

    // 生成访问URL
    const videoUrl = await storage.generatePresignedUrl({ 
      key: fileKey, 
      expireTime: 86400 
    });

    return NextResponse.json({
      success: true,
      video: {
        ...video,
        videoUrl,
      },
    });
  } catch (error) {
    console.error('上传视频失败:', error);
    return NextResponse.json(
      { error: '上传视频失败' },
      { status: 500 }
    );
  }
}
