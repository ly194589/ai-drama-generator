import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoEditClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';

// 初始化存储客户端
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 下载视频并上传到我们的存储桶
async function downloadAndUploadToStorage(url: string, filename: string): Promise<string> {
  console.log(`[视频合成] 下载视频: ${url.substring(0, 80)}...`);
  
  // 下载视频
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载视频失败: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  console.log(`[视频合成] 视频大小: ${buffer.length} bytes`);
  
  // 上传到我们的存储桶
  const fileKey = await storage.uploadFile({
    fileContent: buffer,
    fileName: `videos/merged/${filename}`,
    contentType: 'video/mp4',
  });
  
  console.log(`[视频合成] 上传成功: ${fileKey}`);
  
  return fileKey;
}

interface VideoMergeRequest {
  seriesId: string;
  episodeNumber: number;
}

/**
 * 视频合成API
 * 将多个分镜视频合成一个完整的剧集视频
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as VideoMergeRequest;
    const { seriesId, episodeNumber } = body;

    console.log('[视频合成] 收到请求:', { seriesId, episodeNumber });

    if (!seriesId || !episodeNumber) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. 从 videos 表获取该集的所有分镜视频
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('episode_number', episodeNumber)
      .eq('hook_type', 'storyboard')
      .order('sort_order', { ascending: true });

    if (videosError) {
      console.error('[视频合成] 查询视频失败:', videosError);
      return NextResponse.json({ error: '查询视频失败' }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: '没有找到分镜视频' }, { status: 400 });
    }

    console.log(`[视频合成] 找到 ${videos.length} 个分镜视频`);

    // 2. 去重：同一个sort_order只保留最新的视频
    const videoMap = new Map<number, typeof videos[0]>();
    for (const video of videos) {
      const sortOrder = video.sort_order as number;
      const existing = videoMap.get(sortOrder);
      if (!existing || new Date(video.created_at) > new Date(existing.created_at)) {
        videoMap.set(sortOrder, video);
      }
    }

    // 按sort_order排序获取视频URL
    const sortedVideos = Array.from(videoMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, video]) => video);

    const videoUrls = sortedVideos
      .map(v => v.video_url as string)
      .filter(url => url);

    console.log(`[视频合成] 去重后 ${videoUrls.length} 个视频URL`);

    if (videoUrls.length === 0) {
      return NextResponse.json({ error: '没有找到有效的视频URL' }, { status: 400 });
    }

    // 3. 获取hook和cliffhanger视频
    const { data: hookVideos } = await supabase
      .from('videos')
      .select('*')
      .eq('episode_number', episodeNumber)
      .eq('hook_type', 'hook')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: cliffhangerVideos } = await supabase
      .from('videos')
      .select('*')
      .eq('episode_number', episodeNumber)
      .eq('hook_type', 'cliffhanger')
      .order('created_at', { ascending: false })
      .limit(1);

    // 4. 组装完整的视频列表：hook + storyboards + cliffhanger
    const allVideoUrls: string[] = [];
    
    if (hookVideos && hookVideos.length > 0 && hookVideos[0].video_url) {
      allVideoUrls.push(hookVideos[0].video_url as string);
      console.log('[视频合成] 添加开篇钩子视频');
    }
    
    allVideoUrls.push(...videoUrls);
    
    if (cliffhangerVideos && cliffhangerVideos.length > 0 && cliffhangerVideos[0].video_url) {
      allVideoUrls.push(cliffhangerVideos[0].video_url as string);
      console.log('[视频合成] 添加结尾悬念视频');
    }

    console.log(`[视频合成] 共 ${allVideoUrls.length} 个视频待合成`);

    // 5. 将相对路径转换为完整的 HTTP URL
    const fullVideoUrls: string[] = [];
    for (const url of allVideoUrls) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        fullVideoUrls.push(url);
      } else {
        // 是相对路径，生成预签名 URL
        try {
          const signedUrl = await storage.generatePresignedUrl({ 
            key: url, 
            expireTime: 86400 // 24小时有效
          });
          fullVideoUrls.push(signedUrl);
          console.log(`[视频合成] 转换URL: ${url} -> ${signedUrl.substring(0, 80)}...`);
        } catch (e) {
          console.error(`[视频合成] 生成预签名URL失败: ${url}`, e);
        }
      }
    }

    if (fullVideoUrls.length === 0) {
      return NextResponse.json({ error: '没有有效的视频URL可合成' }, { status: 400 });
    }

    // 6. 如果只有一个视频，直接返回
    if (fullVideoUrls.length === 1) {
      return NextResponse.json({ 
        success: true, 
        mergedVideoUrl: fullVideoUrls[0],
        message: '只有一个视频，无需合成'
      });
    }

    // 7. 调用视频合成服务
    const mergeResult = await callVideoMergeService(fullVideoUrls, seriesId, episodeNumber, request.headers);

    if (mergeResult.error) {
      return NextResponse.json({ 
        error: mergeResult.error 
      }, { status: 500 });
    }

    // 8. 将合成后的视频下载并上传到我们的存储桶
    const mergedVideoUrl = mergeResult.url!;
    const videoDuration = Math.round(mergeResult.duration || 0); // 转换为整数
    
    // 生成文件名
    const timestamp = Date.now();
    const filename = `${episodeNumber}_${timestamp}.mp4`;
    
    // 下载并上传到我们的存储桶
    let videoKey: string;
    try {
      videoKey = await downloadAndUploadToStorage(mergedVideoUrl, filename);
      console.log('[视频合成] 准备保存到数据库, videoKey:', videoKey, 'duration:', videoDuration);
    } catch (downloadError) {
      console.error('[视频合成] 下载上传失败:', downloadError);
      // 如果下载失败，直接使用原始 URL（有效期7天）
      videoKey = mergedVideoUrl;
    }
    
    // 检查是否已存在合成视频，如果存在则更新
    const { data: existingMerged, error: queryError } = await supabase
      .from('videos')
      .select('*')
      .eq('episode_number', episodeNumber)
      .eq('hook_type', 'merged')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (queryError) {
      console.error('[视频合成] 查询现有记录失败:', queryError);
    }

    console.log('[视频合成] 现有记录查询结果:', existingMerged?.length || 0);

    if (existingMerged && existingMerged.length > 0) {
      // 更新现有记录
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          video_url: videoKey, // 保存文件 key 或完整 URL
          duration: videoDuration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMerged[0].id);
      
      if (updateError) {
        console.error('[视频合成] 更新数据库失败:', updateError);
      } else {
        console.log('[视频合成] 更新合成视频记录成功, id:', existingMerged[0].id);
      }
    } else {
      // 创建新记录
      const insertData = {
        title: `第${episodeNumber}集合成视频`,
        prompt: `合成视频：hook + ${videoUrls.length}个分镜 + cliffhanger`,
        video_url: videoKey, // 保存文件 key 或完整 URL
        duration: videoDuration,
        ratio: '16:9',
        resolution: '720p',
        file_size: 0,
        model: 'video-merge',
        status: 'completed',
        hook_type: 'merged',
        episode_number: episodeNumber,
        sort_order: 999,
      };
      
      console.log('[视频合成] 准备插入记录:', JSON.stringify(insertData, null, 2));
      
      const { data: insertResult, error: insertError } = await supabase
        .from('videos')
        .insert(insertData)
        .select();
      
      if (insertError) {
        console.error('[视频合成] 插入数据库失败:', insertError);
      } else {
        console.log('[视频合成] 保存合成视频记录成功:', insertResult);
      }
    }

    return NextResponse.json({ 
      success: true, 
      mergedVideoUrl: mergedVideoUrl,
      videoCount: allVideoUrls.length,
      duration: videoDuration,
    });

  } catch (error) {
    console.error('[视频合成] 失败:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '视频合成失败' 
    }, { status: 500 });
  }
}

/**
 * 调用视频合成服务
 * 使用 coze-coding-dev-sdk 的 VideoEditClient.concatVideos 实现
 */
async function callVideoMergeService(
  videoUrls: string[], 
  seriesId: string, 
  episodeNumber: number,
  requestHeaders: Headers
): Promise<{ url?: string; duration?: number; error?: string }> {
  try {
    console.log('[视频合成] 待合成的视频列表:', videoUrls);
    console.log('[视频合成] 剧集信息:', { seriesId, episodeNumber });

    // 初始化视频编辑客户端
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(requestHeaders);
    const client = new VideoEditClient(config, customHeaders);

    // 调用 concatVideos API 合并视频
    // 使用一些转场效果让视频过渡更自然
    const transitions = ['1182358', '1182376']; // 泛开、圆形打开
    
    console.log(`[视频合成] 开始合并 ${videoUrls.length} 个视频...`);
    
    const response = await client.concatVideos(videoUrls, {
      transitions: transitions,
      urlExpire: 86400 * 7, // 7天有效期
    });

    if (response.url) {
      console.log('[视频合成] 合并成功:', response.url);
      console.log('[视频合成] 视频元信息:', response.video_meta);
      
      return { 
        url: response.url,
        duration: response.video_meta?.duration || 0,
      };
    } else {
      console.error('[视频合成] 响应中没有URL:', response);
      return { error: '视频合成失败：未返回视频URL' };
    }

  } catch (error) {
    console.error('[视频合成] 服务调用失败:', error);
    return { 
      error: error instanceof Error ? error.message : '视频合成服务调用失败' 
    };
  }
}
