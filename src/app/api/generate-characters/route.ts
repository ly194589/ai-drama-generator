import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, ImageGenerationClient, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 角度配置：每个角色至少3个形象
const CHARACTER_ANGLES = [
  {
    type: 'front',      // 正面照
    name: '正面照',
    description: '正面全身照，清晰展示角色正面形象',
    promptSuffix: '正面全身照，面向镜头，清晰展示面部特征和服装细节，专业摄影构图',
  },
  {
    type: 'back',       // 背面照
    name: '背面照',
    description: '背面全身照，展示角色背影和服装背面',
    promptSuffix: '背面全身照，背对镜头，展示发型背面和服装背部细节，专业摄影构图',
  },
  {
    type: 'side',       // 侧面照
    name: '侧面照',
    description: '侧面全身照，展示角色侧面轮廓',
    promptSuffix: '侧面全身照，侧身站立，展示侧脸轮廓和身材曲线，专业摄影构图',
  },
  {
    type: 'action',     // 动作形象
    name: '动作形象',
    description: '角色标志性动作或表情特写',
    promptSuffix: '动态姿势，展示角色标志性动作，表情生动，画面有张力，专业摄影构图',
  },
];

const SYSTEM_PROMPT = `你是专业的AI短剧角色设计师，根据用户提供的题材、核心冲突和人物数量，生成详细的角色档案。

【重要规则 - 必须严格遵守】
- 用户指定的人物数量是硬性要求，必须恰好生成指定数量的角色，不能多也不能少
- 如果核心冲突中提到的角色数量与用户指定不一致，优先按用户指定数量生成
- 每个角色必须有独立的姓名、性别、年龄、外貌特征和性格

输出格式要求（严格的JSON格式，不要包含任何其他文字）：
{
  "characters": [
    {
      "name": "角色姓名",
      "gender": "male或female",
      "age": 年龄数字,
      "faceShape": "脸型描述",
      "hairstyle": "发型描述",
      "clothing": "服装描述（全程不变）",
      "skinTone": "肤色",
      "temperament": "气质描述",
      "microActions": ["微动作1", "微动作2"],
      "signaturePose": "标志性动作或姿态描述",
      "emotionRules": {
        "calm": 30,
        "happy": 50,
        "aggrieved": 45,
        "angry": 65
      }
    }
  ],
  "relationships": "角色关系描述"
}

注意：
1. 角色要符合题材风格
2. 服装描述要具体，确保全程一致
3. 微动作要自然、符合人物性格
4. signaturePose是角色的标志性动作，用于生成动作形象
5. 情绪强度是百分比数值(0-100)
6. 只输出JSON，不要有其他内容
7. 【关键】characters数组中的角色数量必须等于用户指定的人数！`;

// 根据题材获取风格提示词
function getStylePrompt(style: string): string {
  // 写实风格基础前缀（强制）
  const realisticPrefix = '写实风格，真实人物摄影，';
  // 写实风格基础后缀（强制）
  const realisticSuffix = '，禁止动漫风格、漫画风格、二次元风格、卡通风格、Q版风格';
  
  const styleMap: Record<string, string> = {
    '古风': '中国古代背景，古典服饰，唯美古风风格，水墨意境',
    '科幻': '未来科幻背景，赛博朋克风格，霓虹光影',
    '现代': '现代都市背景，时尚摄影风格，柔和自然光',
    '唯美': '梦幻唯美风格，柔和光影，艺术感',
    '暗黑': '暗黑风格，戏剧性光影，神秘氛围',
    '宠物': '可爱宠物风格，温馨家居环境，柔和光线',
    '萌宠': '可爱宠物风格，温馨家居环境，柔和光线',
  };
  
  const matchedStyle = styleMap[style] || '专业摄影风格，高清质感';
  return realisticPrefix + matchedStyle + realisticSuffix;
}

// 根据题材判断是否为宠物风
function isPetGenre(genre: string): boolean {
  return genre.includes('宠物') || genre.includes('萌宠') || genre.includes('动物');
}

// 生成宠物角色提示词
function getPetCharacterPrompt(petType: string, characterName: string, temperament: string, angle: typeof CHARACTER_ANGLES[0]): string {
  const petDescriptions: Record<string, string> = {
    '猫': '一只可爱的猫咪，毛茸茸的毛发，灵动的眼睛',
    '狗': '一只忠诚可爱的狗狗，明亮的眼睛，友善的表情',
    '仓鼠': '一只小巧可爱的仓鼠，圆滚滚的身体，呆萌的表情',
    '兔子': '一只可爱的小兔子，长长的耳朵，毛茸茸的身体',
    '鸟': '一只漂亮的小鸟，五彩斑斓的羽毛，灵动的眼睛',
  };
  
  const petDesc = petDescriptions[petType] || '一只可爱的宠物';
  
  // 写实风格强制要求
  const realisticRequirement = '【风格要求】写实风格，必须是真实宠物摄影效果，真实动物毛发纹理，真实光影效果，真实物理场景';
  
  return `${realisticRequirement}，高质量宠物摄影，${petDesc}，名叫${characterName}，${temperament}气质，${angle.promptSuffix}，2K高清画质，电影级光影效果，禁止出现人类，禁止动漫风格、漫画风格、二次元风格、卡通风格。`;
}

// 生成人类角色提示词
function getHumanCharacterPrompt(
  characterName: string,
  gender: string,
  age: number,
  faceShape: string,
  hairstyle: string,
  clothing: string,
  skinTone: string,
  temperament: string,
  signaturePose: string,
  style: string,
  angle: typeof CHARACTER_ANGLES[0]
): string {
  const genderDesc = gender === 'male' ? '男性' : gender === 'female' ? '女性' : '人物';
  const ageDesc = age ? `${age}岁左右` : '';
  
  const characterDescription = [
    `一位${ageDesc}${genderDesc}角色，名叫${characterName}`,
    faceShape ? `脸型：${faceShape}` : '',
    hairstyle ? `发型：${hairstyle}` : '',
    clothing ? `服装：${clothing}` : '',
    skinTone ? `肤色：${skinTone}` : '',
    temperament ? `气质：${temperament}` : '',
    signaturePose && angle.type === 'action' ? `动作：${signaturePose}` : '',
  ].filter(Boolean).join('，');

  const stylePrompt = getStylePrompt(style);

  // 写实风格强制要求
  const realisticRequirement = '【风格要求】写实风格，必须是真实人物摄影效果，真实皮肤质感，真实服装材质，真实光影效果';

  return `${realisticRequirement}，高质量人物肖像摄影，${characterDescription}，${stylePrompt}，${angle.promptSuffix}，2K高清画质，电影级光影效果。`;
}

// 生成单个角色的单个角度立绘
async function generateCharacterAngleImage(
  char: Record<string, unknown>,
  angle: typeof CHARACTER_ANGLES[0],
  style: string,
  genre: string,
  seriesId: string | null,
  imageClient: ImageGenerationClient,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<{ angleType: string; angleName: string; fileKey: string; imageId: string; presignedUrl: string } | null> {
  try {
    const characterName = char.name as string;
    const temperament = char.temperament as string || '';
    
    let prompt: string;
    
    if (isPetGenre(genre)) {
      // 宠物风：根据角色名或特征判断宠物类型
      const petType = (char.petType as string) || '猫'; // 默认猫
      prompt = getPetCharacterPrompt(petType, characterName, temperament, angle);
    } else {
      // 人类角色
      prompt = getHumanCharacterPrompt(
        characterName,
        char.gender as string,
        char.age as number,
        char.faceShape as string,
        char.hairstyle as string,
        char.clothing as string,
        char.skinTone as string,
        temperament,
        char.signaturePose as string || '',
        style,
        angle
      );
    }

    console.log(`[角色立绘] 生成 ${characterName} - ${angle.name}...`);

    // 生成图片
    const imageResponse = await imageClient.generate({
      prompt,
      size: '1024x1792', // 9:16竖版
    });

    const helper = imageClient.getResponseHelper(imageResponse);

    // 检查是否生成成功
    if (!helper.success) {
      console.error(`[角色立绘] ${characterName} - ${angle.name} 生成失败:`, helper.errorMessages.join(', '));
      return null;
    }

    if (helper.imageUrls.length === 0) {
      console.error(`[角色立绘] ${characterName} - ${angle.name} 没有返回图片URL`);
      return null;
    }

    const imageUrl = helper.imageUrls[0];
    
    // 下载并上传到对象存储
    const downloadResponse = await fetch(imageUrl);
    if (!downloadResponse.ok) {
      console.error(`[角色立绘] ${characterName} - ${angle.name} 下载图片失败: ${downloadResponse.status}`);
      return null;
    }
    
    const imageBuffer = Buffer.from(await downloadResponse.arrayBuffer());
      
      const fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `images/character/${Date.now()}-${characterName}-${angle.type}.jpg`,
        contentType: 'image/jpeg',
      });

      // 保存到图片素材库
      const { data: savedImage } = await supabase
        .from('image_materials')
        .insert({
          title: `${characterName} - ${angle.name}`,
          description: `${characterName}的${angle.name}。${angle.description}`,
          type: 'character',
          category: '角色立绘',
          file_key: fileKey,
          file_name: `${characterName}-${angle.type}.jpg`,
          file_size: imageBuffer.length,
          width: 1024,
          height: 1792,
          format: 'jpg',
          thumbnail_key: fileKey,
          series_id: seriesId || null,
          character_id: char.id as string,
          character_name: characterName,
          purpose: `角色${angle.name}`,
          style,
          is_ai_generated: true,
          generation_prompt: prompt,
          tags: ['角色立绘', characterName, angle.name, style, 'AI生成'],
        })
        .select()
        .single();

      // 生成预签名URL
      const presignedUrl = await storage.generatePresignedUrl({ key: fileKey });

      console.log(`[角色立绘] ${characterName} - ${angle.name} 生成成功`);

      return {
        angleType: angle.type,
        angleName: angle.name,
        fileKey,
        imageId: savedImage?.id || '',
        presignedUrl,
      };
  } catch (error) {
    console.error(`生成角色 ${char.name} - ${angle.name} 失败:`, error);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { genre, conflict, characterCount, seriesId, style = '现代', generateImages = true } = await request.json();

    // characterCount 为 0 或未提供时，让 AI 自动决定角色数量
    if (!genre || !conflict) {
      return NextResponse.json(
        { error: '请提供题材和核心冲突' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 根据题材调整系统提示词
    let systemPrompt = SYSTEM_PROMPT;
    if (isPetGenre(genre)) {
      systemPrompt = `你是专业的AI短剧角色设计师，为宠物题材短剧设计可爱的动物角色。

输出格式要求（严格的JSON格式，不要包含任何其他文字）：
{
  "characters": [
    {
      "name": "宠物名字",
      "gender": "male或female",
      "petType": "宠物类型（猫/狗/仓鼠/兔子/鸟等）",
      "breed": "品种",
      "furColor": "毛色",
      "eyeColor": "眼睛颜色",
      "temperament": "性格描述",
      "signaturePose": "标志性动作或姿态",
      "microActions": ["微动作1", "微动作2"],
      "emotionRules": {
        "calm": 30,
        "happy": 50,
        "sad": 45,
        "angry": 65
      }
    }
  ],
  "relationships": "角色关系描述"
}

注意：
1. 角色全部是宠物，禁止出现人类
2. 每个宠物要有独特的名字和性格
3. signaturePose是宠物的标志性动作
4. 只输出JSON，不要有其他内容`;
    }

    // 如果 characterCount 为 0 或未提供，让 AI 自己决定角色数量
    const autoDecideCount = !characterCount || characterCount <= 0;
    const countInstruction = autoDecideCount 
      ? '请根据题材和核心冲突，自行决定合适的角色数量（通常2-4个主要角色）。'
      : `【重要】必须恰好生成 ${characterCount} 个角色，不能多也不能少！这是一个硬性要求，必须严格执行。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请为以下短剧生成角色档案：

题材：${genre}
核心冲突：${conflict}

${countInstruction}

请确保角色性格鲜明，符合题材风格，并且角色之间有合理的互动关系。只输出JSON。`
      }
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.8
    });

    // 解析AI返回的JSON
    let result;
    try {
      const content = response.content.trim();
      
      try {
        result = JSON.parse(content);
      } catch {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonStr = content.substring(firstBrace, lastBrace + 1);
          result = JSON.parse(jsonStr);
        } else {
          throw new Error('找不到JSON结构');
        }
      }
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      return NextResponse.json({
        error: '解析失败，请重试',
        rawContent: response.content
      });
    }

    // 验证结果结构
    if (!result.characters || !Array.isArray(result.characters)) {
      return NextResponse.json({
        error: 'AI返回数据结构不正确，请重试',
        rawContent: response.content
      });
    }

    // 为每个角色添加ID
    result.characters = result.characters.map((char: Record<string, unknown>, index: number) => ({
      ...char,
      id: `char-${Date.now()}-${index}`
    }));

    // 如果需要生成角色形象图片
    if (generateImages && result.characters.length > 0) {
      const imageClient = new ImageGenerationClient(config, customHeaders);
      const supabase = getSupabaseClient();

      // 为每个角色生成多角度立绘（至少3个）
      // 选择前3个最常用的角度：正面、侧面、动作
      const selectedAngles = CHARACTER_ANGLES.slice(0, 3);

      // 并行生成所有角色的所有角度立绘
      const allImagePromises: Promise<{
        characterId: string;
        result: { angleType: string; angleName: string; fileKey: string; imageId: string; presignedUrl: string } | null;
      }[]>[] = result.characters.map(async (char: Record<string, unknown>) => {
        const characterId = char.id as string;
        
        // 为每个角度生成图片
        const anglePromises = selectedAngles.map(async (angle) => {
          const result = await generateCharacterAngleImage(
            char,
            angle,
            style,
            genre,
            seriesId,
            imageClient,
            supabase
          );
          return { characterId, result };
        });
        
        return Promise.all(anglePromises);
      });

      // 等待所有立绘生成完成
      const allResults = await Promise.all(allImagePromises);

      // 将图片信息附加到角色
      result.characters = result.characters.map((char: Record<string, unknown>) => {
        const characterId = char.id as string;
        const characterResults = allResults.flat().filter(r => r.characterId === characterId && r.result);
        
        // 收集所有角度的立绘信息
        const referenceImages: Record<string, { fileKey: string; imageId: string; presignedUrl: string }> = {};
        
        characterResults.forEach(({ result }) => {
          if (result) {
            referenceImages[result.angleType] = {
              fileKey: result.fileKey,
              imageId: result.imageId,
              presignedUrl: result.presignedUrl,
            };
          }
        });

        // 优先使用正面照作为主图
        const mainImage = referenceImages['front'] || referenceImages['side'] || Object.values(referenceImages)[0];

        return {
          ...char,
          // 主图（用于显示）
          referenceImageUrl: mainImage?.fileKey,
          imageUrl: mainImage?.presignedUrl,
          imageId: mainImage?.imageId,
          // 所有角度的立绘
          referenceImages,
          // 立绘角度列表
          imageAngles: Object.keys(referenceImages),
        };
      });

      // 如果有 seriesId，更新 drama_series 的 characters 字段
      if (seriesId) {
        await supabase
          .from('drama_series')
          .update({ 
            characters: result.characters,
            updated_at: new Date().toISOString()
          })
          .eq('id', seriesId);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('生成角色失败:', error);
    return NextResponse.json(
      { error: '生成角色失败，请重试' },
      { status: 500 }
    );
  }
}
