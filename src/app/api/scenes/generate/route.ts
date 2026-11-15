import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 场景照生成 API
 * 
 * 根据剧本题材和场景类型生成固定场景图片
 * 
 * 场景类型包括：
 * - 皇宫、山寨、阵营、城池、公司、家等固定场景
 * - 场景照用于全剧使用，确保场景一致性
 */

// 预设场景类型
const SCENE_TYPES = {
  // 古代场景
  ancient: {
    '皇宫': '宏伟的古代皇宫，金碧辉煌的大殿，龙椅高耸，雕梁画栋，气势恢宏，中国古代建筑风格',
    '王府': '气派的王府府邸，雕花门窗，红木家具，古典庭院，雅致高贵',
    '山寨': '险峻的山寨营地，木质寨门，篝火堆，兵器架，江湖草莽气息',
    '城池': '古代城池全景，城墙高耸，城楼巍峨，城门大开，人来人往',
    '客栈': '古代客栈大堂，木质桌椅，灯笼高挂，江湖气息浓厚',
    '花园': '古典园林，假山流水，亭台楼阁，花木扶疏，诗意盎然',
    '战场': '古战场全景，旌旗飘扬，战鼓擂动，沙尘漫天，肃杀之气',
    '宫殿': '华丽的宫殿内景，珠帘锦帐，金玉满堂，皇族气派',
  },
  // 现代场景
  modern: {
    '公司': '现代都市办公楼，玻璃幕墙，开放式办公区，商务精英氛围',
    '别墅': '豪华别墅客厅，落地窗，真皮沙发，现代简约装修',
    '公寓': '温馨公寓，开放式厨房，舒适沙发，都市生活气息',
    '餐厅': '高档餐厅，水晶吊灯，精致餐具，浪漫氛围',
    '医院': '现代医院走廊，白墙白灯，医疗设备，消毒水气息',
    '酒店': '豪华酒店大堂，大理石地面，水晶吊灯，奢华氛围',
    '咖啡厅': '文艺咖啡厅，木质桌椅，绿植点缀，温暖灯光',
    '商场': '现代购物中心，琳琅满目的商品，人流如织',
  },
  // 宠物场景
  pet: {
    '宠物客厅': '温馨的宠物客厅，柔软的沙发，宠物玩具散落，阳光透过窗户',
    '宠物卧室': '舒适的宠物卧室，柔软的小床，毛绒玩具，温馨可爱',
    '宠物公园': '宠物公园全景，绿草地，宠物游乐设施，阳光明媚',
    '宠物医院': '宠物诊所内部，干净的诊疗台，宠物用品架，温馨环境',
    '宠物店': '宠物用品店，货架上的宠物食品和玩具，明亮整洁',
  },
  // 科幻场景
  scifi: {
    '飞船': '未来飞船驾驶舱，全息显示屏，控制面板，科技感十足',
    '基地': '太空基地内部，金属墙壁，荧光灯带，未来科技风格',
    '城市': '未来城市全景，悬浮建筑，霓虹灯光，赛博朋克风格',
    '实验室': '高科技实验室，精密仪器，全息投影，科研氛围',
  },
  // 悬疑场景
  suspense: {
    '密室': '阴暗的密室，昏暗灯光，神秘符号，诡异氛围',
    '地下室': '潮湿的地下室，昏暗灯光，蛛网密布，阴森可怖',
    '老宅': '废弃老宅，破旧家具，尘埃飞扬，诡异气氛',
    '警察局': '警察局内部，审讯室，案件白板，严肃氛围',
  },
};

// 根据题材获取场景类型
function getSceneCategory(genre: string): string {
  if (genre.includes('古风') || genre.includes('古装') || genre.includes('宫廷') || genre.includes('武侠')) {
    return 'ancient';
  }
  if (genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物')) {
    return 'pet';
  }
  if (genre.includes('科幻') || genre.includes('未来')) {
    return 'scifi';
  }
  if (genre.includes('悬疑') || genre.includes('惊悚') || genre.includes('推理')) {
    return 'suspense';
  }
  return 'modern';
}

// 根据风格获取风格提示词（优化版）
function getStylePrompt(style: string, imageStyle: string = 'realistic'): string {
  // 判断是否为漫画风格
  const isComicStyle = imageStyle === 'comic';

  if (isComicStyle) {
    // 漫画风格
    return '【核心风格】精致漫画风格，高质量二次元插画，精美细腻的动漫场景。风格特征：精致线条、鲜艳色彩、动漫场景特征、梦幻氛围。禁止Q版、简笔画、儿童画风格。';
  } else {
    // 写实风格 - 增强版
    return '【核心风格】超写实摄影风格，真实场景摄影，照片级真实感，专业相机实拍。风格特征：真实材质纹理、真实光影效果、真实环境氛围、专业摄影质感。禁止：动漫风格、漫画风格、二次元风格、卡通风格、Q版风格、插画风格、手绘风格、游戏CG风格';
  }
}

// 生成单个场景图片（优化版提示词）
async function generateSceneImage(
  sceneName: string,
  sceneDescription: string,
  style: string,
  genre: string,
  seriesId: string | null,
  imageClient: ImageGenerationClient,
  supabase: ReturnType<typeof getSupabaseClient>,
  imageStyle: string = 'realistic' // 图片风格：realistic(真人风) / comic(漫画风)
): Promise<{ sceneName: string; fileKey: string; imageId: string; presignedUrl: string } | null> {
  try {
    const stylePrompt = getStylePrompt(style, imageStyle);

    // 判断是否为宠物风
    const isPet = genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物');
    const noHumanRule = isPet ? '，禁止出现人类或人类任何部位' : '';

    // 判断是否为漫画风格
    const isComicStyle = imageStyle === 'comic';

    // 场景质量标准
    const qualityStandard = isComicStyle
      ? '【质量标准】2K高清画质（1792x1024），动漫场景特征，线条精细，色彩鲜艳，层次分明，低噪点，画面干净整洁'
      : '【质量标准】2K超高清照片画质（1792x1024），电影级真实光影效果，真实材质纹理，自然光照，专业摄影质感，低噪点，画面干净整洁';

    // 场景构图要求
    const compositionRequirement = `
【构图要求】
- 视角：全景或中景，展示场景整体空间布局
- 构图：专业摄影构图，黄金分割比例，视觉平衡
- 景深：适当景深控制，主景清晰，背景虚化自然
- 透视：正确的透视关系，空间感强
- 对称性：根据场景特点选择对称或不对称构图`;

    // 材质细节强化
    const materialDetailRequirement = `
【材质细节强化】
- 建筑材质：真实砖石、木材、金属等材质纹理
- 家具质感：沙发、桌椅等家具的布料、木材质感
- 装饰品：装饰品、艺术品等细节精细可见
- 地面材质：地板、地毯、地砖等材质真实感
- 墙面材质：墙纸、涂料、石材等墙面质感`;

    // 光影效果强化
    const lightingDetailRequirement = isComicStyle
      ? `【光影效果】柔和均匀的漫射光，阴影层次分明，高光自然柔和，增强立体感，梦幻氛围`
      : `【光影效果】真实自然光照，主光填充光轮廓光配合，明暗层次分明，阴影柔和自然，高光点准确，真实环境光反射，电影级光影效果`;

    // 氛围营造
    const atmosphereRequirement = `
【氛围营造】
- 空间感：场景空间层次分明，远近关系清晰
- 氛围感：符合场景特征的氛围营造
- 色彩氛围：色调和谐统一，冷暖对比自然
- 情绪感：场景传递的情绪氛围准确`;

    const prompt = `${stylePrompt}，高质量场景摄影。

【场景信息】
场景名称：${sceneName}
场景描述：${sceneDescription}
风格基调：${style}

${compositionRequirement}

${materialDetailRequirement}

${lightingDetailRequirement}

${atmosphereRequirement}

${qualityStandard}

【禁止元素】
- 禁止人物、动物、人形物等${noHumanRule}
- 禁止水印、文字、标志等
- 禁止模糊、失焦、噪点等质量问题

【构图建议】
根据场景特点选择最佳视角：室内场景建议中景展示空间，室外场景建议全景展示环境，特殊场景建议特色视角增强视觉冲击力`;

    console.log(`[场景照生成] 生成 ${sceneName}...`);

    // 生成图片
    const imageResponse = await imageClient.generate({
      prompt,
      size: '1792x1024', // 16:9横版，适合场景
    });

    const helper = imageClient.getResponseHelper(imageResponse);

    // 检查是否生成成功
    if (!helper.success) {
      console.error(`[场景照生成] ${sceneName} 生成失败:`, helper.errorMessages.join(', '));
      return null;
    }

    if (helper.imageUrls.length === 0) {
      console.error(`[场景照生成] ${sceneName} 没有返回图片URL`);
      return null;
    }

    const imageUrl = helper.imageUrls[0];

    // 下载并上传到对象存储
    const downloadResponse = await fetch(imageUrl);
    if (!downloadResponse.ok) {
      console.error(`[场景照生成] ${sceneName} 下载图片失败: ${downloadResponse.status}`);
      return null;
    }

    const imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());

    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName: `images/scene/${Date.now()}-${sceneName}.jpg`,
      contentType: 'image/jpeg',
    });

    // 保存到图片素材库
    const { data: savedImage } = await supabase
      .from('image_materials')
      .insert({
        title: sceneName,
        description: sceneDescription,
        type: 'scene',
        category: '场景图',
        file_key: fileKey,
        file_name: `${sceneName}.jpg`,
        file_size: imageBuffer.length,
        width: 2560,  // 16:9横版
        height: 1440,
        format: 'jpg',
        thumbnail_key: fileKey,
        series_id: seriesId || null,
        purpose: '场景定妆照',
        style,
        is_ai_generated: true,
        generation_prompt: prompt,
        tags: ['场景图', sceneName, style, 'AI生成'],
      })
      .select()
      .single();

    // 生成预签名URL
    const presignedUrl = await storage.generatePresignedUrl({ key: fileKey });

    console.log(`[场景照生成] ${sceneName} 生成成功`);

    return {
      sceneName,
      fileKey,
      imageId: savedImage?.id || '',
      presignedUrl,
    };
  } catch (error) {
    console.error(`生成场景 ${sceneName} 失败:`, error);
    // 返回null而不是抛出错误，让其他场景继续生成
    return null;
  }
}

/**
 * POST: 为剧集生成场景照
 *
 * 请求参数：
 * - seriesId: 剧集ID
 * - genre: 题材
 * - style: 风格
 * - imageStyle: 图片风格（realistic/comic，默认realistic）
 * - scenes: 自定义场景列表（可选）
 */
export async function POST(request: NextRequest) {
  try {
    const { seriesId, genre, style = '现代', imageStyle = 'realistic', scenes: customScenes } = await request.json();

    if (!genre) {
      return NextResponse.json(
        { error: '请提供题材信息' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);
    const supabase = getSupabaseClient();

    // 获取场景类型
    const sceneCategory = getSceneCategory(genre);
    const presetScenes = SCENE_TYPES[sceneCategory as keyof typeof SCENE_TYPES] || SCENE_TYPES.modern;

    // 使用自定义场景或预设场景
    const scenesToGenerate = customScenes || Object.keys(presetScenes).slice(0, 5); // 默认生成5个场景

    console.log(`[场景照生成] 题材: ${genre}, 风格: ${style}, 场景数: ${scenesToGenerate.length}`);

    // 并行生成所有场景图片
    const scenePromises = scenesToGenerate.map(async (sceneName: string) => {
      const sceneDescription = presetScenes[sceneName as keyof typeof presetScenes] || sceneName;
      return generateSceneImage(
        sceneName,
        sceneDescription,
        style,
        genre,
        seriesId,
        imageClient,
        supabase,
        imageStyle
      );
    });

    const results = await Promise.all(scenePromises);

    // 收集成功的场景照
    const sceneImages: Record<string, { fileKey: string; imageId: string; presignedUrl: string }> = {};
    results.forEach((result) => {
      if (result) {
        sceneImages[result.sceneName] = {
          fileKey: result.fileKey,
          imageId: result.imageId,
          presignedUrl: result.presignedUrl,
        };
      }
    });

    // 如果有 seriesId，更新 drama_series 的 scenes 字段
    if (seriesId && Object.keys(sceneImages).length > 0) {
      // 获取当前剧集信息
      const { data: series } = await supabase
        .from('drama_series')
        .select('metadata')
        .eq('id', seriesId)
        .single();

      const currentMetadata = (series?.metadata as Record<string, unknown>) || {};
      const currentScenes = (currentMetadata.scenes as Record<string, unknown>) || {};

      // 合并新场景
      const updatedScenes = { ...currentScenes };
      Object.entries(sceneImages).forEach(([name, data]) => {
        updatedScenes[name] = data.fileKey;
      });

      await supabase
        .from('drama_series')
        .update({
          metadata: {
            ...currentMetadata,
            scenes: updatedScenes,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', seriesId);
    }

    return NextResponse.json({
      success: true,
      sceneImages,
      generatedCount: Object.keys(sceneImages).length,
      message: `成功生成 ${Object.keys(sceneImages).length} 个场景照`,
    });
  } catch (error) {
    console.error('生成场景照失败:', error);
    return NextResponse.json(
      { error: '生成场景照失败，请重试' },
      { status: 500 }
    );
  }
}

/**
 * GET: 获取剧集的场景照列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');

    if (!seriesId) {
      return NextResponse.json(
        { error: '请提供剧集ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 从图片素材库获取场景照
    const { data: images, error } = await supabase
      .from('image_materials')
      .select('*')
      .eq('series_id', seriesId)
      .eq('type', 'scene')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: '获取场景照失败' },
        { status: 500 }
      );
    }

    // 生成预签名URL
    const imagesWithUrls = await Promise.all(
      (images || []).map(async (img) => {
        try {
          const presignedUrl = await storage.generatePresignedUrl({ key: img.file_key });
          return {
            ...img,
            imageUrl: presignedUrl,
          };
        } catch {
          return {
            ...img,
            imageUrl: '',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      scenes: imagesWithUrls,
    });
  } catch (error) {
    console.error('获取场景照失败:', error);
    return NextResponse.json(
      { error: '获取场景照失败' },
      { status: 500 }
    );
  }
}
