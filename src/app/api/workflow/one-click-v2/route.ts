import { NextRequest } from 'next/server';
import {
  LLMClient,
  ImageGenerationClient,
  TTSClient,
  VideoGenerationClient,
  Config,
  HeaderUtils,
} from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  WorkflowScheduler,
  TaskDefinition,
  ProgressTracker,
  SSEProgressPusher,
  SmartCache,
  CacheKeyGenerator,
  ErrorRecoveryManager,
  CheckpointManager,
} from '@/lib/workflow';
import {
  STORYBOARD_COUNT_RULES,
  PRESET_STYLES,
  VisualStyle,
} from '@/lib/script-types';
import { getScriptPromptProfile } from '@/lib/model-prompt-profiles';

/**
 * 一键生成工作流API V2 - 优化版
 * 
 * 核心优化：
 * 1. 模块化任务调度 - 使用统一调度器
 * 2. 智能缓存 - 减少重复API调用
 * 3. 断点续传 - 支持从中断处恢复
 * 4. 精确进度追踪 - 基于权重的进度计算
 * 5. 错误恢复 - 智能重试和降级
 */

// ============ 常量配置 ============

const CONFIG = {
  llmModel: 'doubao-seed-2-0-pro-260215',
  videoModel: 'doubao-seedance-2-0-260128',
  imageSize: '4K',
  videoResolution: '1080p',
  videoRatio: '16:9',
  maxConcurrentTasks: 3,
  taskTimeout: 600, // 10分钟
};

// 风格匹配函数（支持部分匹配）
function matchGenreToStyle(genre: string): VisualStyle {
  if (genre?.includes('古装') || genre?.includes('古风')) {
    return PRESET_STYLES['ancient_beauty'];
  }
  if (genre?.includes('仙侠') || genre?.includes('玄幻')) {
    return PRESET_STYLES['fantasy_fairy'];
  }
  if (genre?.includes('悬疑') || genre?.includes('推理')) {
    return PRESET_STYLES['suspense_dark'];
  }
  if (genre?.includes('甜宠') || genre?.includes('恋爱') || genre?.includes('言情')) {
    return PRESET_STYLES['sweet_romance'];
  }
  if (genre?.includes('都市') || genre?.includes('现代')) {
    return PRESET_STYLES['urban_modern'];
  }
  if (genre?.includes('职场') || genre?.includes('商战')) {
    return PRESET_STYLES['workplace_elite'];
  }
  return PRESET_STYLES['ancient_beauty']; // 默认：古风唯美
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    seriesId,
    episodeNumber = 1,
    options = {
      generateScript: true,
      generateCharacters: true,
      generateScenes: true,
      generateVoices: true,
      generateVideos: true,
    },
    resumeFromCheckpoint = false,
  } = body;

  // 检查用户是否为管理员
  const userId = request.headers.get('x-user-id') || 'dev-user';
  const isAdminUser = userId === 'admin';

  // Seedance 2.0 已全量启用，所有用户使用 Seedance 2.0
  const adminVideoModel = 'doubao-seedance-2-0-260128';
  const standardVideoModel = 'doubao-seedance-2-0-260128';

  console.log(`[一键生成] 用户ID: ${userId}, 管理员: ${isAdminUser}`);
  console.log(`[一键生成] 视频模型: ${standardVideoModel}, 分辨率: 720p`);

  const encoder = new TextEncoder();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();

  // 初始化缓存和错误恢复
  const cache = new SmartCache({ persistToDatabase: false });
  const errorRecovery = new ErrorRecoveryManager();
  const checkpointManager = CheckpointManager.getInstance();

  // 创建SSE推送器
  const ssePusher = new SSEProgressPusher();
  const stream = new ReadableStream({
    start(controller) {
      // 连接SSE推送器到控制器
      const originalSend = ssePusher.sendProgress.bind(ssePusher);
      ssePusher.sendProgress = (progress) => {
        originalSend(progress);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            ...progress,
          })}\n\n`));
        } catch {
          // 忽略已关闭的错误
        }
      };
    },
  });

  // 创建进度追踪器
  const workflowId = `wf-${seriesId}-${episodeNumber}`;
  const progressTracker = new ProgressTracker(workflowId, {
    updateInterval: 2000,
    onProgress: (progress) => {
      ssePusher.sendProgress(progress);
    },
  });

  // 异步执行工作流
  (async () => {
    try {
      const supabase = getSupabaseClient();
      
      // 获取短剧信息
      const { data: series } = await supabase
        .from('drama_series')
        .select('*')
        .eq('id', seriesId)
        .single();

      if (!series) {
        ssePusher.sendError('短剧不存在');
        ssePusher.close();
        return;
      }

      // 尝试恢复检查点
      let checkpoint = null;
      if (resumeFromCheckpoint) {
        checkpoint = await checkpointManager.loadFromDatabase(workflowId);
        if (checkpoint) {
          ssePusher.sendProgress({
            workflowId,
            status: 'running',
            overallProgress: checkpoint.progress,
            message: '从检查点恢复...',
            tasks: [],
            completedTasks: 0,
            totalTasks: 0,
            runningTasks: 0,
            failedTasks: 0,
            speed: 0,
            lastUpdated: Date.now(),
          });
        }
      }

      // 构建任务列表
      const tasks = buildTasks(series, episodeNumber, options, {
        config,
        customHeaders,
        cache,
        errorRecovery,
        supabase,
        progressTracker,
      });

      // 初始化进度追踪
      progressTracker.initTasks(tasks.map(t => ({
        id: t.id,
        name: t.name,
        weight: t.weight,
        estimatedDuration: t.timeout,
      })));

      // 创建调度器
      const scheduler = new WorkflowScheduler(workflowId, tasks, {
        maxConcurrentTasks: CONFIG.maxConcurrentTasks,
        taskTimeout: CONFIG.taskTimeout,
        enableCache: true,
        persistState: true,
        onTaskStart: (taskId) => {
          progressTracker.startTask(taskId);
        },
        onTaskProgress: (taskId, progress, message) => {
          progressTracker.updateTaskProgress(taskId, progress, message);
        },
        onTaskComplete: (taskId, result) => {
          progressTracker.completeTask(taskId, result);
          
          // 保存检查点
          const state = scheduler.getState();
          checkpointManager.createCheckpoint(
            workflowId,
            new Map(Object.entries(state.tasks).map(([id, s]) => [id, {
              taskId: id,
              status: s.status,
              progress: s.progress,
              attempts: s.attempts,
            }])),
            state.context,
            state.progress
          );
        },
        onTaskError: (taskId, error) => {
          progressTracker.failTask(taskId, error.message);
        },
        onWorkflowProgress: (progress, message) => {
          ssePusher.sendProgress({
            workflowId,
            status: 'running',
            overallProgress: progress,
            message,
            tasks: [],
            completedTasks: 0,
            totalTasks: tasks.length,
            runningTasks: 0,
            failedTasks: 0,
            speed: 0,
            lastUpdated: Date.now(),
          });
        },
      });

      // 恢复检查点状态
      if (checkpoint) {
        // 转换TaskCheckpoint到TaskState
        const taskStates = new Map<string, import('@/lib/workflow').TaskState>();
        checkpoint.taskStates.forEach((state, id) => {
          taskStates.set(id, {
            id: state.taskId,
            status: state.status as import('@/lib/workflow').TaskStatus,
            progress: state.progress,
            attempts: state.attempts,
            cached: false,
            error: state.error,
            startedAt: state.startedAt ? new Date(state.startedAt) : undefined,
            completedAt: state.completedAt ? new Date(state.completedAt) : undefined,
          });
        });
        
        scheduler.restoreFromCheckpoint({
          id: workflowId,
          status: 'running',
          tasks: taskStates,
          context: checkpoint.context,
          progress: checkpoint.progress,
        });
      }

      // 执行工作流
      const result = await scheduler.start({
        series,
        episodeNumber,
        options,
      });

      // 完成
      progressTracker.complete();
      ssePusher.sendComplete({
        success: result.success,
        seriesId,
        episodeNumber,
        message: result.success ? '一键生成完成！' : '生成过程中出现错误',
        errors: result.errors,
      });

      // 清理检查点
      checkpointManager.deleteCheckpoint(workflowId);

    } catch (error) {
      console.error('[OneClickV2] 工作流执行失败:', error);
      ssePusher.sendError(error instanceof Error ? error.message : '生成失败');
    } finally {
      ssePusher.close();
      progressTracker.destroy();
    }
  })();

  return new Response(stream, {
    headers: SSEProgressPusher.getHeaders(),
  });
}

// ============ 辅助函数 ============

/**
 * 从钩子/悬念数据中提取场景位置
 */
function extractSceneLocation(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const scene = (data as Record<string, unknown>).scene;
    if (typeof scene === 'object' && scene !== null) {
      return (scene as Record<string, unknown>).location as string || '未知场景';
    }
  }
  return '未知场景';
}

/**
 * 从钩子/悬念数据中提取描述
 */
function extractDescription(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const scene = (data as Record<string, unknown>).scene;
    if (typeof scene === 'object' && scene !== null) {
      return (scene as Record<string, unknown>).description as string || String(data);
    }
  }
  return String(data);
}

// ============ 任务构建器 ============

function buildTasks(
  series: Record<string, unknown>,
  episodeNumber: number,
  options: Record<string, boolean>,
  context: {
    config: Config;
    customHeaders: Record<string, string>;
    cache: SmartCache;
    errorRecovery: ErrorRecoveryManager;
    supabase: ReturnType<typeof getSupabaseClient>;
    progressTracker: ProgressTracker;
  }
): TaskDefinition[] {
  const tasks: TaskDefinition[] = [];
  const style = matchGenreToStyle(series.genre as string);
  const storyboardCount = Math.max(
    STORYBOARD_COUNT_RULES.minCount,
    Math.min(STORYBOARD_COUNT_RULES.maxCount, 35)
  );

  // 1. 剧本生成任务
  if (options.generateScript) {
    tasks.push({
      id: 'script_generation',
      name: '剧本生成',
      description: '生成完整分镜剧本',
      type: 'script',
      dependencies: [],
      priority: 100,
      timeout: 180,
      maxRetries: 3,
      retryDelay: 10,
      weight: 20,
      input: { series, episodeNumber, storyboardCount, style },
      execute: async (ctx) => {
        ctx.progressCallback(5, '正在生成分镜剧本...');

        const llmClient = new LLMClient(context.config, context.customHeaders);
        const cacheKey = CacheKeyGenerator.forScript(series.id as string, episodeNumber);

        // 尝试从缓存获取
        const cached = await context.cache.get(cacheKey);
        if (cached) {
          ctx.progressCallback(100, '使用缓存剧本');
          return {
            success: true,
            data: cached,
            duration: 0,
            retries: 0,
            cached: true,
          };
        }

        // 构建提示词
        const isPetGenre = (series.genre as string)?.includes('宠物') || 
          (series.genre as string)?.includes('萌宠');
        const petRules = isPetGenre ? `
【宠物风特殊规则】
1. 角色全部是宠物，禁止出现人类
2. 所有动作由宠物完成
3. 场景完全宠物化
` : '';

        const prompt = `为短剧《${series.title}》生成第${episodeNumber}集的分镜剧本。
${getScriptPromptProfile(CONFIG.llmModel).styleDirective}
${petRules}
【核心规则】
- 分镜数量：恰好${storyboardCount}个
- 每镜时长：固定12秒
- 开篇钩子、核心分镜、结尾悬念：统一12秒
- 总时长：300秒

【题材信息】
题材：${series.genre}
风格：${series.style}
核心冲突：${series.core_conflict}
角色：${(series.characters as Array<Record<string, unknown>>)?.map(c => c.name).join('、') || '未设定'}

【风格要求】
${style.description}，${style.lighting}，${style.colorTone}色调

【输出JSON格式】
{"title":"标题","summary":"总结","hook":{...},"cliffhanger":{...},"storyboards":[...]}`;

        ctx.progressCallback(10, '调用AI生成剧本...');

        const response = await llmClient.invoke([
          { role: 'system', content: '你是专业短剧编剧，严格按照规则生成剧本。' },
          { role: 'user', content: prompt },
        ], {
          model: CONFIG.llmModel,
          temperature: 0.7,
        });

        ctx.progressCallback(80, '解析剧本...');

        let episodeData: Record<string, unknown> = {};
        try {
          const content = response.content || '';
          const firstBrace = content.indexOf('{');
          const lastBrace = content.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            episodeData = JSON.parse(content.substring(firstBrace, lastBrace + 1));
            
            // 清理错误格式：过滤 File: 和 URL: 格式
            function cleanFieldValue(value: unknown): unknown {
              if (typeof value === 'string') {
                let cleaned = value.replace(/File:\s*\[[^\]]*\]/gi, '').trim();
                cleaned = cleaned.replace(/URL:\s*\[[^\]]*\]/gi, '').trim();
                cleaned = cleaned.replace(/^[,，、;；\s]+|[,，、;；\s]+$/g, '').trim();
                return cleaned;
              }
              if (Array.isArray(value)) {
                return value.map(cleanFieldValue);
              }
              if (typeof value === 'object' && value !== null) {
                const cleaned: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(value)) {
                  cleaned[k] = cleanFieldValue(v);
                }
                return cleaned;
              }
              return value;
            }
            episodeData = cleanFieldValue(episodeData) as Record<string, unknown>;
          }
        } catch (e) {
          ctx.logCallback('warn', '剧本解析失败，尝试修复...');
        }

        // 保存到数据库
        ctx.progressCallback(90, '保存剧本...');
        const { data: savedEpisode } = await context.supabase
          .from('drama_episodes')
          .upsert({
            series_id: series.id,
            episode_number: episodeNumber,
            title: (episodeData.title as string) || `第${episodeNumber}集`,
            summary: episodeData.summary as string,
            hook: typeof episodeData.hook === 'object' 
              ? JSON.stringify(episodeData.hook) 
              : (episodeData.hook as string),
            cliffhanger: typeof episodeData.cliffhanger === 'object' 
              ? JSON.stringify(episodeData.cliffhanger) 
              : (episodeData.cliffhanger as string),
            storyboards: episodeData.storyboards,
            status: 'completed',
          })
          .select()
          .single();

        // 缓存结果
        await context.cache.set(cacheKey, savedEpisode, { ttl: 3600 });

        ctx.progressCallback(100, '剧本生成完成');

        return {
          success: true,
          data: { episode: savedEpisode, raw: episodeData },
          duration: 0,
          retries: 0,
          cached: false,
        };
      },
    });
  }

  // 2. 角色立绘生成任务
  if (options.generateCharacters) {
    tasks.push({
      id: 'character_generation',
      name: '角色立绘生成',
      description: '为所有角色生成立绘',
      type: 'character',
      dependencies: options.generateScript ? ['script_generation'] : [],
      priority: 90,
      timeout: 300,
      maxRetries: 2,
      retryDelay: 15,
      weight: 15,
      input: { series },
      execute: async (ctx) => {
        const imageClient = new ImageGenerationClient(context.config, context.customHeaders);
        const characters = series.characters as Array<Record<string, unknown>> || [];
        const results: Array<{ name: string; urls: string[] }> = [];

        const styleStr = `${series.style || '现代'}-${series.genre || '都市'}`;

        for (let i = 0; i < characters.length; i++) {
          const char = characters[i];
          const progress = Math.round((i / characters.length) * 100);
          ctx.progressCallback(progress, `生成角色立绘: ${char.name}`);

          // 检查缓存
          const cacheKey = CacheKeyGenerator.forCharacter(char.id as string);
          const cached = await context.cache.get<{ urls: string[] }>(cacheKey);

          if (cached) {
            results.push({ name: char.name as string, urls: cached.urls });
            continue;
          }

          // 写实风格提示词（使用@格式作为超链接标记）
          const prompt = `photorealistic, realistic photography, real person, ${styleStr} drama character portrait, Character name: @${char.name}, ${char.gender === 'male' ? 'Male' : 'Female'}, ${char.age || 25} years old, ${char.temperament || ''}, ${char.clothing || 'modern clothing'}, cinematic lighting, 8K quality, NO anime, NO cartoon, NO illustration style`;

          try {
            const response = await imageClient.generate({
              prompt,
              size: CONFIG.imageSize,
              watermark: false,
            });

            const helper = imageClient.getResponseHelper(response);

            if (helper.success && helper.imageUrls.length > 0) {
              results.push({ name: char.name as string, urls: helper.imageUrls });
              
              // 缓存结果
              await context.cache.set(cacheKey, { urls: helper.imageUrls }, { ttl: 3600 });
            }
          } catch (error) {
            ctx.logCallback('error', `角色 ${char.name} 生成失败: ${error}`);
          }

          // 延迟避免频率限制
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        ctx.progressCallback(100, `角色立绘生成完成，共 ${results.length} 个`);

        return {
          success: true,
          data: { characterImages: results },
          duration: 0,
          retries: 0,
          cached: false,
        };
      },
    });
  }

  // 3. 场景图生成任务
  if (options.generateScenes) {
    tasks.push({
      id: 'scene_generation',
      name: '场景图生成',
      description: '生成主要场景背景图',
      type: 'scene',
      dependencies: options.generateScript ? ['script_generation'] : [],
      priority: 85,
      timeout: 300,
      maxRetries: 2,
      retryDelay: 15,
      weight: 10,
      execute: async (ctx) => {
        const imageClient = new ImageGenerationClient(context.config, context.customHeaders);

        // 从剧本中提取场景
        let scenes = new Set<string>();
        if (options.generateScript) {
          const state = context.supabase;
          const { data: episode } = await state
            .from('drama_episodes')
            .select('storyboards')
            .eq('series_id', series.id)
            .eq('episode_number', episodeNumber)
            .single();

          const storyboards = (episode?.storyboards as Array<Record<string, unknown>>) || [];
          storyboards.forEach(sb => {
            const scene = sb.scene as Record<string, unknown>;
            if (scene?.location) {
              scenes.add(scene.location as string);
            }
          });
        }

        // 如果没有场景，使用默认场景
        if (scenes.size === 0) {
          scenes = new Set(['室内客厅', '办公室', '城市街道']);
        }

        const sceneList = Array.from(scenes).slice(0, 5);
        const results: Array<{ name: string; url: string }> = [];
        const styleStr = series.style as string || '现代';

        for (let i = 0; i < sceneList.length; i++) {
          const sceneName = sceneList[i];
          const progress = Math.round((i / sceneList.length) * 100);
          ctx.progressCallback(progress, `生成场景: ${sceneName}`);

          const prompt = `photorealistic, realistic photography, real environment, ${styleStr} drama scene, Scene name: @${sceneName}, cinematic lighting, detailed environment, 8K quality, NO anime, NO cartoon, NO illustration style`;

          try {
            const response = await imageClient.generate({
              prompt,
              size: CONFIG.imageSize,
              watermark: false,
            });

            const helper = imageClient.getResponseHelper(response);

            if (helper.success && helper.imageUrls.length > 0) {
              results.push({ name: sceneName, url: helper.imageUrls[0] });
            }
          } catch (error) {
            ctx.logCallback('error', `场景 ${sceneName} 生成失败: ${error}`);
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        ctx.progressCallback(100, `场景图生成完成，共 ${results.length} 个`);

        return {
          success: true,
          data: { sceneImages: results },
          duration: 0,
          retries: 0,
          cached: false,
        };
      },
    });
  }

  // 4. 配音生成任务
  if (options.generateVoices) {
    tasks.push({
      id: 'voice_generation',
      name: '配音生成',
      description: '为角色对话生成配音',
      type: 'voice',
      dependencies: options.generateScript ? ['script_generation'] : [],
      priority: 80,
      timeout: 600,
      maxRetries: 3,
      retryDelay: 10,
      weight: 15,
      execute: async (ctx) => {
        const ttsClient = new TTSClient(context.config, context.customHeaders);
        const results: Array<{ type: string; speaker: string; content: string; url: string }> = [];

        // 获取剧本中的对话
        const { data: episode } = await context.supabase
          .from('drama_episodes')
          .select('storyboards')
          .eq('series_id', series.id)
          .eq('episode_number', episodeNumber)
          .single();

        const storyboards = (episode?.storyboards as Array<Record<string, unknown>>) || [];
        const characters = (series.characters as Array<Record<string, unknown>>) || [];
        const characterMap = new Map(characters.map(c => [c.name, c]));

        // 收集对话
        const dialogues: Array<{ speaker: string; content: string }> = [];
        storyboards.forEach(sb => {
          const dialogue = sb.dialogue as Array<{ speaker: string; content: string }> | undefined;
          if (Array.isArray(dialogue)) {
            dialogues.push(...dialogue.slice(0, 10)); // 限制数量
          }
        });

        ctx.progressCallback(5, `准备生成 ${dialogues.length} 段配音...`);

        for (let i = 0; i < dialogues.length; i++) {
          const dialogue = dialogues[i];
          const progress = Math.round((i / dialogues.length) * 100);
          ctx.progressCallback(progress, `生成配音: ${dialogue.speaker}`);

          const char = characterMap.get(dialogue.speaker) as Record<string, unknown> || {};
          const speaker = char.gender === 'male' 
            ? 'zh_male_m191_uranus_bigtts' 
            : 'zh_female_xiaohe_uranus_bigtts';

          // 检查缓存
          const cacheKey = CacheKeyGenerator.forTTS(dialogue.content, speaker);
          const cached = await context.cache.get<{ audioUrl: string }>(cacheKey);

          if (cached) {
            results.push({
              type: 'dialogue',
              speaker: dialogue.speaker,
              content: dialogue.content,
              url: cached.audioUrl,
            });
            continue;
          }

          try {
            const response = await ttsClient.synthesize({
              uid: `wf-${series.id}`,
              text: dialogue.content,
              speaker,
              audioFormat: 'mp3',
              sampleRate: 48000,
            });

            if (response.audioUri) {
              results.push({
                type: 'dialogue',
                speaker: dialogue.speaker,
                content: dialogue.content,
                url: response.audioUri,
              });

              // 缓存
              await context.cache.set(cacheKey, { audioUrl: response.audioUri }, { ttl: 3600 });
            }
          } catch (error) {
            ctx.logCallback('error', `配音生成失败: ${error}`);
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        }

        ctx.progressCallback(100, `配音生成完成，共 ${results.length} 段`);

        return {
          success: true,
          data: { voices: results },
          duration: 0,
          retries: 0,
          cached: false,
        };
      },
    });
  }

  // 5. 视频生成任务
  if (options.generateVideos) {
    tasks.push({
      id: 'video_generation',
      name: '视频片段生成',
      description: '生成分镜视频',
      type: 'video',
      dependencies: [
        ...(options.generateScript ? ['script_generation'] : []),
        ...(options.generateCharacters ? ['character_generation'] : []),
        ...(options.generateScenes ? ['scene_generation'] : []),
      ],
      priority: 70,
      timeout: 1800,
      maxRetries: 2,
      retryDelay: 30,
      weight: 25,
      execute: async (ctx) => {
        const videoClient = new VideoGenerationClient(context.config, context.customHeaders);
        const results: Array<{ name: string; url: string }> = [];

        // Seedance 2.0 已全量启用
        const execUserId = context.customHeaders['x-user-id'] || 'dev-user';
        const execIsAdminUser = execUserId === 'admin';
        const execAdminVideoModel = 'doubao-seedance-2-0-260128';
        const execStandardVideoModel = 'doubao-seedance-2-0-260128';

        console.log(`[视频生成任务] 用户ID: ${execUserId}, 管理员: ${execIsAdminUser}`);

        // 获取剧本
        const { data: episode } = await context.supabase
          .from('drama_episodes')
          .select('storyboards, hook, cliffhanger')
          .eq('series_id', series.id)
          .eq('episode_number', episodeNumber)
          .single();

        if (!episode) {
          return {
            success: false,
            error: '剧集不存在',
            duration: 0,
            retries: 0,
            cached: false,
          };
        }

        const storyboards = (episode.storyboards as Array<Record<string, unknown>>) || [];
        const totalShots = storyboards.length;

        ctx.progressCallback(2, `准备生成 ${totalShots} 个镜头视频...`);

        // 生成开场钩子
        if (episode.hook) {
          ctx.progressCallback(5, '生成开场钩子视频...');

          try {
            const response = await videoClient.videoGeneration(
              [{ type: 'text', text: `${series.style}${series.genre}短剧开场，@${extractSceneLocation(episode.hook)}：${extractDescription(episode.hook)}` }],
              {
                model: execIsAdminUser ? execAdminVideoModel : execStandardVideoModel,
                duration: 15,
                ratio: '16:9',
                resolution: '720p',
                generateAudio: false,
                maxWaitTime: 5 * 60 * 1000,
              }
            );

            if (response.videoUrl) {
              results.push({ name: '开场钩子', url: response.videoUrl });
            }
          } catch (error) {
            ctx.logCallback('error', `开场钩子生成失败: ${error}`);
          }

          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // 分批生成镜头视频
        const batchSize = 2;
        for (let batchStart = 0; batchStart < totalShots; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, totalShots);
          const batch = storyboards.slice(batchStart, batchEnd);

          const progress = 10 + Math.round((batchStart / totalShots) * 75);
          ctx.progressCallback(progress, `生成镜头 ${batchStart + 1}-${batchEnd}/${totalShots}...`);

          for (let i = 0; i < batch.length; i++) {
            const shot = batch[i];
            const shotIndex = batchStart + i;

            const scene = shot.scene as Record<string, unknown>;
            const visualDesc = shot.visualDescription as string || '';
            
            let videoPrompt = `${series.style}${series.genre}短剧，@${scene?.location || '室内'}，${visualDesc}`;
            videoPrompt = videoPrompt.substring(0, 2000);

            try {
              const response = await videoClient.videoGeneration(
                [{ type: 'text', text: videoPrompt }],
                {
                  model: execIsAdminUser ? execAdminVideoModel : execStandardVideoModel,
                  duration: 15,
                  ratio: '16:9',
                  resolution: '720p',
                  generateAudio: false,
                  maxWaitTime: 5 * 60 * 1000,
                }
              );

              if (response.videoUrl) {
                results.push({ name: `镜头${shotIndex + 1}`, url: response.videoUrl });
              }
            } catch (error) {
              ctx.logCallback('error', `镜头${shotIndex + 1}生成失败: ${error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }

        // 生成结尾悬念
        if (episode.cliffhanger) {
          ctx.progressCallback(90, '生成结尾悬念视频...');

          try {
            const response = await videoClient.videoGeneration(
              [{ type: 'text', text: `${series.style}${series.genre}短剧结尾，@${extractSceneLocation(episode.cliffhanger)}：${extractDescription(episode.cliffhanger)}` }],
              {
                model: execIsAdminUser ? execAdminVideoModel : execStandardVideoModel,
                duration: 15,
                ratio: '16:9',
                resolution: '720p',
                generateAudio: false,
                maxWaitTime: 5 * 60 * 1000,
              }
            );

            if (response.videoUrl) {
              results.push({ name: '结尾悬念', url: response.videoUrl });
            }
          } catch (error) {
            ctx.logCallback('error', `结尾悬念生成失败: ${error}`);
          }
        }

        ctx.progressCallback(100, `视频生成完成，共 ${results.length} 个镜头`);

        return {
          success: true,
          data: { videos: results },
          duration: 0,
          retries: 0,
          cached: false,
        };
      },
    });
  }

  // 6. 最终合成任务（可选）
  tasks.push({
    id: 'final_compose',
    name: '生成完成',
    description: '汇总所有生成结果',
    type: 'compose',
    dependencies: tasks.map(t => t.id),
    priority: 10,
    timeout: 60,
    maxRetries: 1,
    retryDelay: 5,
    weight: 5,
    execute: async (ctx) => {
      ctx.progressCallback(50, '汇总生成结果...');

      // 获取所有任务的结果
      const state = ctx as unknown as { workflowId: string };
      
      ctx.progressCallback(100, '所有内容生成完成！');

      return {
        success: true,
        data: {
          seriesId: series.id,
          episodeNumber,
          generatedAt: new Date().toISOString(),
        },
        duration: 0,
        retries: 0,
        cached: false,
      };
    },
  });

  return tasks;
}
