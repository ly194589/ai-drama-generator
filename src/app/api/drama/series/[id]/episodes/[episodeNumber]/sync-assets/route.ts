import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { Config, HeaderUtils, ImageGenerationClient, S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

export const maxDuration = 300;

/**
 * 分镜素材同步 API
 * 
 * 支持两种模式：
 * 1. 全量同步：同步该集所有分镜的角色和场景素材
 * 2. 单个分镜同步：只同步指定分镜的角色和场景素材
 * 
 * 参数：
 * - storyboardIndex: 分镜索引（-1=hook, -2=cliffhanger, 0+=storyboard）
 *   不传则同步所有分镜
 */

// 带重试的图片生成
async function generateImageWithRetry(
  imageClient: ImageGenerationClient,
  params: { prompt: string; size: string },
  maxRetries: number = 3
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 每次尝试前等待一段时间（限流保护）
      if (attempt > 0) {
        const delay = Math.min(30000 * Math.pow(2, attempt - 1), 180000); // 30s, 60s, 120s
        console.log(`[图片生成] 第${attempt + 1}次重试，等待 ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await imageClient.generate(params);
      const helper = imageClient.getResponseHelper(response);
      
      if (helper.success && helper.imageUrls.length > 0) {
        return { success: true, imageUrl: helper.imageUrls[0] };
      }
      
      // 检查helper中的错误
      const errorMsg = helper.errorMessages.join('; ');
      if (errorMsg.includes('403') || errorMsg.includes('rate') || errorMsg.includes('limit')) {
        console.log(`[图片生成] 限流错误: ${errorMsg}`);
        continue; // 继续重试
      }
      
      return { success: false, error: errorMsg };
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      const errMsg = err.message || 'Unknown error';
      const isRateLimit = err.statusCode === 403 || 
                          errMsg.includes('403') || 
                          errMsg.includes('rate') ||
                          errMsg.includes('limit');
      
      if (isRateLimit && attempt < maxRetries - 1) {
        console.log(`[图片生成] 限流异常: ${errMsg}`);
        continue;
      }
      return { success: false, error: errMsg };
    }
  }
  return { success: false, error: '重试次数已用尽，请稍后再试' };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; episodeNumber: string }> }
) {
  const { id, episodeNumber } = await params;
  const supabase = getSupabaseClient();
  
  // 解析请求体，获取可选的 storyboardIndex
  let storyboardIndex: number | undefined;
  try {
    const body = await request.json();
    storyboardIndex = body?.storyboardIndex;
  } catch {
    // 没有请求体，同步所有
  }
  
  const modeDesc = storyboardIndex !== undefined 
    ? (storyboardIndex === -1 ? '开篇钩子' : storyboardIndex === -2 ? '结尾悬念' : `分镜${storyboardIndex + 1}`)
    : '所有分镜';
  console.log(`[素材同步] 开始同步剧集 ${episodeNumber} ${modeDesc} 的素材...`);

  // 获取剧本信息
  const { data: series, error: seriesError } = await supabase
    .from('drama_series')
    .select('*')
    .eq('id', id)
    .single();

  if (seriesError || !series) {
    return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
  }

  // 获取该集剧集信息
  const { data: episode, error: episodeError } = await supabase
    .from('drama_episodes')
    .select('*')
    .eq('series_id', id)
    .eq('episode_number', parseInt(episodeNumber))
    .single();

  if (episodeError || !episode) {
    return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
  }

  // 解析分镜数据
  const storyboards = episode.storyboards || [];
  const hook = episode.hook;
  const cliffhanger = episode.cliffhanger;

  // 收集所有分镜中的角色和场景
  const allCharacters = new Map<string, { name: string; count: number; scenes: string[] }>();
  const allScenes = new Map<string, { location: string; count: number; description: string }>();

  // 辅助函数：添加角色
  const addCharacter = (name: string, scene: string) => {
    if (!name || name === '旁白') return;
    const existing = allCharacters.get(name);
    if (existing) {
      existing.count++;
      if (scene && !existing.scenes.includes(scene)) {
        existing.scenes.push(scene);
      }
    } else {
      allCharacters.set(name, { name, count: 1, scenes: scene ? [scene] : [] });
    }
  };

  // 辅助函数：添加场景
  const addScene = (location: string, description: string) => {
    if (!location) return;
    const existing = allScenes.get(location);
    if (existing) {
      existing.count++;
    } else {
      allScenes.set(location, { location, count: 1, description: description || '' });
    }
  };

  // 辅助函数：从分镜数据提取角色和场景
  const extractFromShot = (shotData: Record<string, unknown>) => {
    const shotScene = shotData.scene as Record<string, unknown> | undefined;
    const shotLocation = shotScene?.location as string || '';
    const shotSceneDesc = shotScene?.description as string || '';
    addScene(shotLocation, shotSceneDesc);
    
    // 从 characters 字段提取（字符串数组格式）
    if (Array.isArray(shotData.characters)) {
      const firstChar = shotData.characters[0];
      if (typeof firstChar === 'string') {
        shotData.characters.forEach(c => addCharacter(c as string, shotLocation));
      } else if (typeof firstChar === 'object' && firstChar !== null) {
        // 对象数组格式
        (shotData.characters as Array<{ name: string }>).forEach(c => addCharacter(c.name, shotLocation));
      }
    }
    
    // 从 dialogues 提取说话人
    const shotDialogues = (shotData.dialogues as Array<{ speaker?: string }>) || [];
    shotDialogues.forEach(d => addCharacter(d.speaker || '', shotLocation));
  };

  // 根据模式提取角色和场景
  if (storyboardIndex === undefined) {
    // 全量同步：提取所有分镜
    // 1. 从 hook 提取
    if (hook) {
      let hookData: Record<string, unknown> = {};
      if (typeof hook === 'string') {
        try { hookData = JSON.parse(hook); } catch { hookData = { scene: { description: hook } }; }
      } else {
        hookData = hook as Record<string, unknown>;
      }
      extractFromShot(hookData);
    }

    // 2. 从 storyboards 提取
    for (const shot of storyboards) {
      extractFromShot(shot as Record<string, unknown>);
    }

    // 3. 从 cliffhanger 提取
    if (cliffhanger) {
      let cliffhangerData: Record<string, unknown> = {};
      if (typeof cliffhanger === 'string') {
        try { cliffhangerData = JSON.parse(cliffhanger); } catch { cliffhangerData = { scene: { description: cliffhanger } }; }
      } else {
        cliffhangerData = cliffhanger as Record<string, unknown>;
      }
      extractFromShot(cliffhangerData);
    }
  } else if (storyboardIndex === -1) {
    // 只同步开篇钩子
    if (hook) {
      let hookData: Record<string, unknown> = {};
      if (typeof hook === 'string') {
        try { hookData = JSON.parse(hook); } catch { hookData = { scene: { description: hook } }; }
      } else {
        hookData = hook as Record<string, unknown>;
      }
      extractFromShot(hookData);
    }
  } else if (storyboardIndex === -2) {
    // 只同步结尾悬念
    if (cliffhanger) {
      let cliffhangerData: Record<string, unknown> = {};
      if (typeof cliffhanger === 'string') {
        try { cliffhangerData = JSON.parse(cliffhanger); } catch { cliffhangerData = { scene: { description: cliffhanger } }; }
      } else {
        cliffhangerData = cliffhanger as Record<string, unknown>;
      }
      extractFromShot(cliffhangerData);
    }
  } else if (storyboardIndex >= 0 && storyboardIndex < storyboards.length) {
    // 同步指定分镜
    extractFromShot(storyboards[storyboardIndex] as Record<string, unknown>);
  }

  console.log(`[素材同步] 提取到 ${allCharacters.size} 个角色, ${allScenes.size} 个场景`);

  // 获取现有的角色立绘和场景图片
  const { data: existingArtworks } = await supabase
    .from('character_artworks')
    .select('*')
    .eq('series_id', id);

  const { data: existingScenes } = await supabase
    .from('scene_images')
    .select('*')
    .eq('series_id', id);

  // 构建已有素材的映射
  const existingCharacterArt = new Map<string, Set<string>>();
  (existingArtworks || []).forEach((art: Record<string, unknown>) => {
    const name = art.character_name as string;
    const purpose = art.purpose as string || '';
    if (!existingCharacterArt.has(name)) {
      existingCharacterArt.set(name, new Set());
    }
    existingCharacterArt.get(name)!.add(purpose);
  });

  const existingSceneImages = new Set<string>();
  (existingScenes || []).forEach((scene: Record<string, unknown>) => {
    const title = scene.title as string;
    existingSceneImages.add(title);
  });

  // 找出需要生成的角色和场景
  const charactersToGenerate: string[] = [];
  const scenesToGenerate: string[] = [];

  allCharacters.forEach((info, name) => {
    const existing = existingCharacterArt.get(name);
    if (!existing || !existing.has('角色正面照')) {
      charactersToGenerate.push(name);
    }
  });

  allScenes.forEach((info, location) => {
    if (!existingSceneImages.has(location)) {
      scenesToGenerate.push(location);
    }
  });

  console.log(`[素材同步] 需要生成 ${charactersToGenerate.length} 个角色立绘, ${scenesToGenerate.length} 个场景图片`);

  // 如果没有需要生成的素材，直接返回
  if (charactersToGenerate.length === 0 && scenesToGenerate.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        totalCharacters: allCharacters.size,
        totalScenes: allScenes.size,
        generatedCharacters: 0,
        generatedScenes: 0,
        failedCharacters: [],
        failedScenes: [],
      },
      generated: {
        characters: [],
        scenes: [],
      },
      message: '素材已完整，无需生成',
    });
  }

  // 初始化图片生成客户端
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const imageClient = new ImageGenerationClient(config, customHeaders);

  // 判断是否为宠物风
  const isPetGenre = (series.genre as string)?.includes('宠物') || 
                     (series.genre as string)?.includes('萌宠') || 
                     (series.genre as string)?.includes('动物');

  const genreStyle = isPetGenre ? '可爱宠物风格' : '古风古装风格';

  // 生成缺失的角色立绘
  const generatedCharacters: string[] = [];
  const failedCharacters: string[] = [];

  // 获取剧本中的角色配置
  const seriesCharacters = (series.characters as Array<Record<string, unknown>>) || [];
  const characterConfigMap = new Map<string, Record<string, unknown>>();
  seriesCharacters.forEach(c => {
    const name = c.name as string;
    if (name) characterConfigMap.set(name, c);
  });

  for (const charName of charactersToGenerate) {
    console.log(`[素材同步] 生成角色立绘: ${charName}`);
    
    // 获取角色配置
    const charConfig = characterConfigMap.get(charName);
    
    // 构建角色描述
    let characterDesc = '';
    if (charConfig) {
      const parts: string[] = [];
      if (charConfig.gender) parts.push(`性别：${charConfig.gender}`);
      if (charConfig.age) parts.push(`年龄：${charConfig.age}`);
      if (charConfig.hairstyle) parts.push(`发型：${charConfig.hairstyle}`);
      if (charConfig.clothing) parts.push(`服装：${charConfig.clothing}`);
      if (charConfig.skinTone) parts.push(`肤色：${charConfig.skinTone}`);
      if (charConfig.temperament) parts.push(`气质：${charConfig.temperament}`);
      if (charConfig.characteristic) parts.push(`特征：${charConfig.characteristic}`);
      characterDesc = parts.join('，');
    }
    
    // 如果没有配置，使用默认描述
    if (!characterDesc) {
      characterDesc = `角色名：${charName}，风格：${genreStyle}`;
    }
    
    // 生成正面立绘
    const frontPrompt = isPetGenre
      ? `一只名叫"${charName}"的宠物，${characterDesc}，全身立绘，正面视角，可爱风格，高清画质，背景简洁`
      : `中国古风短剧角色"${charName}"，${characterDesc}，全身立绘，正面视角，${genreStyle}，高清画质，背景简洁`;

    const result = await generateImageWithRetry(imageClient, {
      prompt: frontPrompt,
      size: '1024x1024',
    });

    if (result.success && result.imageUrl) {
      try {
        // 下载图片
        const imageResponse = await fetch(result.imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        
        // 上传到存储
        const safeName = charName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const fileKey = await storage.uploadFile({
          fileContent: imageBuffer,
          fileName: `images/character/${Date.now()}-${safeName}-front.jpg`,
          contentType: 'image/jpeg',
        });
        
        // 获取访问URL
        const storageUrl = await storage.generatePresignedUrl({ key: fileKey });
        
        // 保存到数据库
        await supabase.from('character_artworks').insert({
          series_id: id,
          character_name: charName,
          character_id: charName, // 使用名字作为ID
          image_url: storageUrl,
          purpose: '角色正面照',
          generation_prompt: frontPrompt,
          description: characterDesc,
        });
        
        generatedCharacters.push(charName);
        console.log(`[素材同步] 角色立绘生成成功: ${charName}`);
      } catch (e) {
        console.error(`[素材同步] 保存角色立绘失败: ${charName}`, e);
        failedCharacters.push(charName);
      }
    } else {
      console.error(`[素材同步] 生成角色立绘失败: ${charName}`, result.error);
      failedCharacters.push(charName);
    }

    // 延迟避免限流（10秒）
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // 生成缺失的场景图片
  const generatedScenes: string[] = [];
  const failedScenes: string[] = [];

  for (const sceneLocation of scenesToGenerate) {
    console.log(`[素材同步] 生成场景图片: ${sceneLocation}`);
    
    const sceneInfo = allScenes.get(sceneLocation);
    const sceneDesc = sceneInfo?.description || '';
    
    const scenePrompt = isPetGenre
      ? `宠物短剧场景"${sceneLocation}"，${sceneDesc}，可爱温馨风格，全景视角，高清画质`
      : `中国古风短剧场景"${sceneLocation}"，${sceneDesc}，${genreStyle}，全景视角，高清画质，氛围感强`;

    const result = await generateImageWithRetry(imageClient, {
      prompt: scenePrompt,
      size: '1920x1080',
    });

    if (result.success && result.imageUrl) {
      try {
        const imageResponse = await fetch(result.imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        
        const safeName = sceneLocation.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const fileKey = await storage.uploadFile({
          fileContent: imageBuffer,
          fileName: `images/scene/${Date.now()}-${safeName}.jpg`,
          contentType: 'image/jpeg',
        });
        
        const storageUrl = await storage.generatePresignedUrl({ key: fileKey });
        
        await supabase.from('scene_images').insert({
          series_id: id,
          title: sceneLocation,
          image_url: storageUrl,
          description: sceneDesc,
        });
        
        generatedScenes.push(sceneLocation);
        console.log(`[素材同步] 场景图片生成成功: ${sceneLocation}`);
      } catch (e) {
        console.error(`[素材同步] 保存场景图片失败: ${sceneLocation}`, e);
        failedScenes.push(sceneLocation);
      }
    } else {
      console.error(`[素材同步] 生成场景图片失败: ${sceneLocation}`, result.error);
      failedScenes.push(sceneLocation);
    }

    // 延迟避免限流（10秒）
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log(`[素材同步] 完成！生成角色: ${generatedCharacters.length}, 场景: ${generatedScenes.length}`);

  return NextResponse.json({
    success: true,
    summary: {
      totalCharacters: allCharacters.size,
      totalScenes: allScenes.size,
      generatedCharacters: generatedCharacters.length,
      generatedScenes: generatedScenes.length,
      failedCharacters,
      failedScenes,
    },
    generated: {
      characters: generatedCharacters,
      scenes: generatedScenes,
    },
  });
}
