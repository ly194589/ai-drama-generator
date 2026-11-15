import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS, SOLUTION_PRESETS, SolutionType } from '@/lib/config';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { getOrCreateCollectionForSeries, updateCollectionVideoCount } from '@/lib/video-collection';

// 本地接口定义，避免使用 any/unknown 导致类型安全问题
interface VideoGenParams {
  prompt?: string;
  disableLastFrame?: boolean;
  firstFrameUrl?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
}

interface StoryboardItem {
  id?: string;
  type?: string;
  sequence?: number;
  scene?: {
    description?: string;
  };
  videoGeneration?: VideoGenParams;
  prompt?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
}

interface ContentItem {
  type: 'image_url' | 'text';
  image_url?: { url: string };
  role?: string;
  text?: string;
}

interface BackgroundTaskData {
  id: string;
  series_id?: string;
  episode_number?: number;
  progress?: number;
  current_item?: string;
  total?: number;
  status?: string;
  updated_at?: string;
  result?: {
    storyboards?: StoryboardItem[];
    results?: unknown[];
    failedIndices?: number[];
  };
}

interface ZhipuVideoResponse {
  id?: string;
  task_id?: string;
  task_status?: string;
  status?: string;
  video_result?: Array<{ url?: string; cover_image_url?: string }>;
}

interface TaskResponseData {
  id?: string;
  task_id?: string;
  task_status?: string;
  status?: string;
  video_result?: Array<{ url?: string; cover_image_url?: string }>;
}

/**
 * 获取用户的方案选择
 */
async function getUserSolution(userId: string): Promise<SolutionType> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('user_config')
    .select('solution_preset')
    .eq('user_id', userId)
    .single();
  
  // 兼容旧数据：seedance-1-5-pro -> standard
  const preset = data?.solution_preset;
  if (preset === 'seedance-1-5-pro' || preset === 'standard' || !preset) {
    return 'standard';
  }
  return preset as SolutionType;
}

/**
 * 后台视频生成任务执行接口
 * POST: 开始执行后台任务
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  
  if (!taskId) {
    return NextResponse.json({ error: '缺少taskId' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  try {
    // 获取任务信息
    const { data: task, error: fetchError } = await supabase
      .from('video_generation_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 检查任务状态
    if (task.status === 'running') {
      return NextResponse.json({ 
        success: false, 
        message: '任务正在执行中',
        task 
      });
    }

    if (task.status === 'completed') {
      return NextResponse.json({ 
        success: false, 
        message: '任务已完成',
        task 
      });
    }

    // 更新任务状态为运行中
    await supabase
      .from('video_generation_tasks')
      .update({ 
        status: 'running', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);

    console.log(`[后台任务 ${taskId}] 开始执行`);

    // 获取分镜数据
    const storyboards = (task.result as { storyboards?: unknown[] })?.storyboards || [];
    
    // 获取剧集的hook和cliffhanger
    let hookContent: string | null = null;
    let cliffhangerContent: string | null = null;
    
    // 如果没有分镜数据，从剧集获取（包括hook和cliffhanger）
    if (storyboards.length === 0 && task.series_id) {
      const { data: episode } = await supabase
        .from('drama_episodes')
        .select('storyboards, hook, cliffhanger')
        .eq('series_id', task.series_id)
        .eq('episode_number', task.episode_number || 1)
        .single();
      
      if (episode?.storyboards) {
        storyboards.push(...(episode.storyboards as unknown[]));
      }
      hookContent = episode?.hook || null;
      cliffhangerContent = episode?.cliffhanger || null;
    } else if (task.series_id) {
      // 即使有storyboards，也要获取hook和cliffhanger
      const { data: episode } = await supabase
        .from('drama_episodes')
        .select('hook, cliffhanger')
        .eq('series_id', task.series_id)
        .eq('episode_number', task.episode_number || 1)
        .single();
      
      hookContent = episode?.hook || null;
      cliffhangerContent = episode?.cliffhanger || null;
    }
    
    // 将hook和cliffhanger转换为特殊的分镜对象，添加到列表中
    // hook作为第一个分镜（开篇钩子）
    if (hookContent) {
      // hookContent 可能是对象或字符串，需要正确提取 prompt 和 dialogue
      const hookObj = typeof hookContent === 'object' ? hookContent as Record<string, unknown> : null;
      let hookPrompt = hookObj?.visualPrompt as string || 
                       (hookObj?.scene as Record<string, unknown>)?.description as string ||
                       (typeof hookContent === 'string' ? hookContent : '');
      
      // 如果有对话，添加到提示词中（Seedance 1.5 pro 要求对话用双引号包裹）
      const hookDialogue = hookObj?.dialogue as Record<string, unknown> | null;
      if (hookDialogue?.content) {
        const speaker = hookDialogue.speaker as string || '旁白';
        const content = hookDialogue.content as string;
        hookPrompt += `。${speaker}(画外音)说："${content}"`;
      }
      
      if (hookPrompt) {
        const hookStoryboard = {
          id: 'hook-opening',
          sequence: 0,
          type: 'opening',
          duration: (hookObj?.duration as number) || 8,
          shotType: (hookObj?.shotType as string) || '特写',
          scene: { description: hookPrompt },
          videoGeneration: {
            prompt: hookPrompt,
            duration: (hookObj?.duration as number) || 8,
            ratio: '16:9',
            resolution: '720p',
            generateAudio: true,
          },
        };
        storyboards.unshift(hookStoryboard);
        console.log(`[后台任务 ${taskId}] 添加开篇钩子分镜: ${hookPrompt.substring(0, 50)}...`);
      }
    }
    
    // cliffhanger作为最后一个分镜（结尾悬念）
    if (cliffhangerContent) {
      // cliffhangerContent 可能是对象或字符串，需要正确提取 prompt 和 dialogue
      const cliffhangerObj = typeof cliffhangerContent === 'object' ? cliffhangerContent as Record<string, unknown> : null;
      let cliffhangerPrompt = cliffhangerObj?.visualPrompt as string || 
                              (cliffhangerObj?.scene as Record<string, unknown>)?.description as string ||
                              (typeof cliffhangerContent === 'string' ? cliffhangerContent : '');
      
      // 如果有对话，添加到提示词中（Seedance 1.5 pro 要求对话用双引号包裹）
      const cliffhangerDialogue = cliffhangerObj?.dialogue as Record<string, unknown> | null;
      if (cliffhangerDialogue?.content) {
        const speaker = cliffhangerDialogue.speaker as string || '旁白';
        const content = cliffhangerDialogue.content as string;
        cliffhangerPrompt += `。${speaker}(画外音)说："${content}"`;
      }
      
      if (cliffhangerPrompt) {
        const cliffhangerStoryboard = {
          id: 'cliffhanger-ending',
          sequence: storyboards.length + 1,
          type: 'ending',
          duration: (cliffhangerObj?.duration as number) || 6,
          shotType: (cliffhangerObj?.shotType as string) || '特写',
          scene: { description: cliffhangerPrompt },
          videoGeneration: {
            prompt: cliffhangerPrompt,
            duration: (cliffhangerObj?.duration as number) || 6,
            ratio: '16:9',
            resolution: '720p',
            generateAudio: true,
          },
        };
        storyboards.push(cliffhangerStoryboard);
        console.log(`[后台任务 ${taskId}] 添加结尾悬念分镜: ${cliffhangerPrompt.substring(0, 50)}...`);
      }
    }

    if (storyboards.length === 0) {
      throw new Error('没有找到分镜数据');
    }
    
    // 更新task.result中的storyboards，确保包含hook和cliffhanger
    await supabase
      .from('video_generation_tasks')
      .update({
        total: storyboards.length,
        result: {
          ...task.result,
          storyboards,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    // 提取请求头用于转发认证
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 获取用户ID和方案
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const solution = await getUserSolution(userId);

    // 使用 Promise 启动后台任务，但不等待完成
    // 注意：在 Next.js 中，后台任务可能会在响应返回后被中断
    // 因此需要前端定期轮询并检测任务是否卡住
    const backgroundPromise = executeBackgroundTask(
      taskId,
      task.series_id,
      task.episode_number,
      storyboards as StoryboardItem[],
      customHeaders,
      userId,
      solution
    );
    
    // 防止未处理的 Promise 拒绝
    backgroundPromise.catch(error => {
      console.error(`[后台任务 ${taskId}] 执行异常:`, error);
    });

    // 立即返回，让前端轮询状态
    return NextResponse.json({
      success: true,
      message: '任务已开始执行',
      taskId,
      total: storyboards.length,
    });

  } catch (error) {
    console.error('[后台任务执行] 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 后台任务执行函数
async function executeBackgroundTask(
  taskId: string,
  seriesId: string,
  episodeNumber: number | undefined,
  storyboards: StoryboardItem[],
  headers: Record<string, string>,
  userId: string,
  solution: SolutionType
) {
  const supabase = getSupabaseClient();
  
  // 获取剧名和剧集编号
  const { data: series } = await supabase
    .from('drama_series')
    .select('title')
    .eq('id', seriesId)
    .single();
  const seriesTitle = series?.title || '未知剧名';
  const epNum = episodeNumber || 1;
  
  console.log(`[后台任务 ${taskId}] 用户方案: ${solution}, 剧名: ${seriesTitle}, 集数: ${epNum}`);
  
  // 根据方案选择视频生成方式
  const useZhipu = solution === 'zhipu';
  
  // 智谱方案检查
  if (useZhipu) {
    const zhipuConfigured = await isZhipuConfiguredForUser(userId);
    if (!zhipuConfigured) {
      console.error(`[后台任务 ${taskId}] 智谱API未配置`);
      await supabase
        .from('video_generation_tasks')
        .update({
          status: 'failed',
          current_item: '智谱API未配置，请在方案设置中配置 API Key',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      return;
    }
  }
  
  // 扣子SDK客户端（仅扣子方案使用）
  const config = new Config();
  const videoClient = useZhipu ? null : new VideoGenerationClient(config, headers);
  
  // 获取或创建该剧本的视频合集
  let collectionId: string | null = null;
  if (seriesId) {
    const collection = await getOrCreateCollectionForSeries(seriesId, seriesTitle);
    collectionId = collection?.id || null;
  }
  
  try {
    const results: unknown[] = [];
    let lastFrameUrl: string | null = null;

    // 更新总数
    await supabase
      .from('video_generation_tasks')
      .update({
        total: storyboards.length,
        current_item: `开始生成 ${storyboards.length} 个视频`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    // 逐个生成视频
    for (let i = 0; i < storyboards.length; i++) {
      const storyboard = storyboards[i] as StoryboardItem;
      const videoGen = storyboard.videoGeneration as Record<string, unknown> | undefined;
      
      // 更新进度
      await supabase
        .from('video_generation_tasks')
        .update({
          progress: i,
          current_item: `正在生成第 ${i + 1}/${storyboards.length} 个视频: ${storyboard.scene?.description?.substring(0, 30) || storyboard.id || '未知场景'}...`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      console.log(`[后台任务 ${taskId}] 生成第 ${i + 1}/${storyboards.length} 个视频 (方案: ${solution})`);

      try {
        // 提取视频参数
        const prompt = (videoGen?.prompt as string) || storyboard.scene?.description || storyboard.prompt || '';
        // 关键：默认使用上一镜头的尾帧作为首帧，确保视频连贯性
        // 除非明确设置了 disableLastFrame: true
        const disableLastFrame = videoGen?.disableLastFrame === true;
        const firstFrameUrl = disableLastFrame 
          ? (videoGen?.firstFrameUrl as string) || null
          : (lastFrameUrl && i > 0 ? lastFrameUrl : (videoGen?.firstFrameUrl as string) || null);
        const duration = Math.max(4, Math.min((videoGen?.duration as number) || storyboard.duration || 15, 15));
        const ratio = (videoGen?.ratio as '16:9') || '16:9';
        const resolution = (videoGen?.resolution as '720p') || '720p';
        
        let videoUrl: string | null = null;
        let newLastFrameUrl: string | null = null;

        if (useZhipu) {
          // ===== 智谱方案：使用 CogVideoX-3 =====
          const zhipuClient = await getZhipuClientAsync(userId);
          
          // 创建视频生成任务
          console.log(`[后台任务 ${taskId}] 智谱视频: 创建任务...`);
          const taskResponse = (await zhipuClient.generateVideo(prompt.substring(0, 2000), {
            model: SOLUTION_PRESETS.zhipu.models.video,
            firstFrameImage: firstFrameUrl || undefined,
            generateAudio: videoGen?.generateAudio as boolean ?? true,
          }) as unknown as ZhipuVideoResponse);
          
          // 智谱API可能返回 id 或 task_id
          const zhipuTaskId = taskResponse.id || taskResponse.task_id;
          const taskStatus = taskResponse.task_status || taskResponse.status;
          
          console.log(`[后台任务 ${taskId}] 智谱视频: 创建任务`, {
            zhipuTaskId,
            taskStatus,
            responseKeys: Object.keys(taskResponse),
            hasVideoResult: !!taskResponse.video_result?.length,
          });
          
          // 如果任务立即完成
          if (taskStatus === 'SUCCESS' && taskResponse.video_result?.length) {
            videoUrl = taskResponse.video_result[0]?.url || null;
            // 获取尾帧图用于下一个视频的首帧（保持视频连贯性）
            newLastFrameUrl = taskResponse.video_result[0]?.cover_image_url || null;
            console.log(`[后台任务 ${taskId}] 智谱视频: 立即完成, URL=${videoUrl?.substring(0, 50)}..., 尾帧=${!!newLastFrameUrl}`);
          } else if (!zhipuTaskId) {
            // 如果没有返回任务ID
            console.error(`[后台任务 ${taskId}] 智谱视频: 无任务ID`, {
              response: JSON.stringify(taskResponse).substring(0, 500),
            });
            throw new Error('智谱视频创建失败：未返回任务ID');
          } else {
            // 轮询任务状态（最多等待5分钟）
            // 智谱视频生成通常需要2-5分钟，增加轮询间隔
            console.log(`[后台任务 ${taskId}] 智谱视频: 等待生成，任务ID=${zhipuTaskId}...`);
            const maxWaitTime = 5 * 60 * 1000; // 5分钟
            const pollInterval = 30000; // 30秒（增加间隔避免频繁查询）
            const startTime = Date.now();
            
            // 首次查询前等待更长时间，让智谱有时间处理任务
            console.log(`[后台任务 ${taskId}] 智谱视频: 等待30秒后开始查询...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            while (Date.now() - startTime < maxWaitTime) {
              const statusResponse = (await zhipuClient.getVideoTask(zhipuTaskId)) as unknown as ZhipuVideoResponse;
              const pollStatus = statusResponse.task_status || statusResponse.status;
              const videoResult = statusResponse.video_result || statusResponse.video_result;
              
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              console.log(`[后台任务 ${taskId}] 智谱视频: 查询状态=${pollStatus}, 已等待${elapsed}秒`, {
                hasVideoResult: !!videoResult?.length,
              });
              
              if (pollStatus === 'SUCCESS' && videoResult?.length) {
                videoUrl = videoResult[0].url || null;
                // 获取尾帧图用于下一个视频的首帧（保持视频连贯性）
                newLastFrameUrl = videoResult[0].cover_image_url || null;
                console.log(`[后台任务 ${taskId}] 智谱视频: 生成完成, URL=${videoUrl?.substring(0, 50)}..., 尾帧=${!!newLastFrameUrl}`);
                break;
              } else if (pollStatus === 'FAILED') {
                throw new Error('智谱视频生成任务失败');
              }
              
              // 继续等待
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
            
            if (!videoUrl) {
              throw new Error('智谱视频生成超时（5分钟）');
            }
          }
        } else {
          // ===== 扣子方案：使用 Seedance =====
          // 构建视频生成内容
          const content: ContentItem[] = [];
          
          // 首帧图
          if (firstFrameUrl) {
            content.push({
              type: 'image_url',
              image_url: { url: firstFrameUrl },
              role: 'first_frame',
            });
          }

          // 添加文本描述
          if (prompt) {
            content.push({
              type: 'text',
              text: prompt.substring(0, 2000),
            });
          }

          // 调用视频生成
          const response = await videoClient!.videoGeneration(content as unknown as never, {
            model: DEFAULT_MODELS.video,
            duration,
            ratio,
            resolution,
            generateAudio: videoGen?.generateAudio as boolean ?? true,
            watermark: false,
            maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
          });
          
          videoUrl = response.videoUrl;
          newLastFrameUrl = response.lastFrameUrl || null;
        }

        if (videoUrl) {
          console.log(`[后台任务 ${taskId}] 第 ${i + 1} 个视频生成成功: ${videoUrl.substring(0, 50)}...`);
          
          // 使用与前端一致的 ID 格式：storyboard.id 或 index-${index}
          const storyboardId = storyboard.id || `index-${i}`;
          
          results.push({
            storyboardId,
            videoUrl,
            success: true,
          });
          
          // 更新尾帧URL
          lastFrameUrl = newLastFrameUrl;

          // 构建视频标题，命名规则：
          // - 开篇钩子：剧名+钩子
          // - 结尾悬念：剧名+结尾
          // - 普通分镜：剧名+第X集第X个分镜
          const storyboardType = storyboard.type;
          let videoTitle: string;
          if (storyboardType === 'opening') {
            videoTitle = `${seriesTitle}钩子`;
          } else if (storyboardType === 'ending') {
            videoTitle = `${seriesTitle}结尾`;
          } else {
            // 普通分镜，使用storyboard.sequence或索引
            const seq = storyboard.sequence || (i + 1);
            videoTitle = `${seriesTitle}第${epNum}集第${seq}个分镜`;
          }
          
          // 保存到 video_materials 表
          console.log(`[后台任务 ${taskId}] 保存视频到数据库: ${videoUrl?.substring(0, 50)}...`);
          const { error: insertError } = await supabase
            .from('video_materials')
            .insert({
              title: videoTitle,
              description: prompt.substring(0, 500),
              file_key: videoUrl,
              file_name: `ai-generated-${taskId}-${i + 1}.mp4`,  // 添加必填字段
              file_size: 0,  // AI生成的视频没有文件大小信息，设为0
              duration: duration,
              status: 'uploaded',
              metadata: {
                taskId,
                seriesId,
                episodeNumber,
                storyboardId,
                generatedAt: new Date().toISOString(),
                solution,
                lastFrameUrl: newLastFrameUrl, // 保存尾帧图用于下一个视频的首帧
              },
              series_id: seriesId,
              episode_number: episodeNumber,  // 添加剧集编号，用于视频列表过滤
              collection_id: collectionId,  // 关联合集
            });
          
          if (insertError) {
            console.error(`[后台任务 ${taskId}] 保存视频失败:`, insertError);
          } else {
            console.log(`[后台任务 ${taskId}] 视频保存成功`); 
            // 更新合集视频数量
            if (collectionId) {
              await updateCollectionVideoCount(collectionId);
            }
          }
        } else {
          console.error(`[后台任务 ${taskId}] 第 ${i + 1} 个视频生成失败: 无返回URL`);
          
          // 使用与前端一致的 ID 格式
          const storyboardId = storyboard.id || `index-${i}`;
          
          results.push({
            storyboardId,
            error: '生成失败：无返回URL',
            success: false,
          });
        }

        // 根据方案调整等待时间
        // 智谱: 3 RPM，需要等待20秒以上
        // 扣子: 相对宽松，等待30秒
        if (i < storyboards.length - 1) {
          const waitTime = useZhipu ? 25000 : 30000;
          console.log(`[后台任务 ${taskId}] 等待${waitTime / 1000}秒后继续...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

      } catch (err) {
        console.error(`[后台任务 ${taskId}] 第 ${i + 1} 个视频生成异常:`, err);
        // 使用与前端一致的 ID 格式
        const storyboardId = storyboard.id || `index-${i}`;
        results.push({
          storyboardId,
          error: err instanceof Error ? err.message : '未知错误',
          success: false,
        });
      }
    }

    // 更新任务状态为完成
    const successCount = (results as { success: boolean }[]).filter(r => r.success).length;
    await supabase
      .from('video_generation_tasks')
      .update({
        status: 'completed',
        progress: storyboards.length,
        current_item: `完成: ${successCount}/${storyboards.length} 个视频成功`,
        result: { 
          results, 
          total: storyboards.length, 
          success: successCount 
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    console.log(`[后台任务 ${taskId}] 完成: ${successCount}/${storyboards.length} 成功`);

  } catch (error) {
    console.error(`[后台任务 ${taskId}] 执行失败:`, error);
    
    // 更新任务状态为失败
    await supabase
      .from('video_generation_tasks')
      .update({
        status: 'failed',
        current_item: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }
}
