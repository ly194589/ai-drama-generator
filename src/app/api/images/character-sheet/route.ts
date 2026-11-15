import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils, Content } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS } from '@/lib/config';

/**
 * 人物立绘生成 API
 * 生成包含正面照、侧面照、背面照的完整立绘图
 *
 * 特点：
 * - 一张图包含三个视角（左：正面，中：侧面，右：背面）
 * - 背景透明（PNG 格式）
 * - 16:9 比例
 * - 一致的服装和造型
 */

interface CharacterSheetRequest {
  characterName: string;       // 角色名称
  description: string;        // 角色描述
  outfit: string;             // 服装描述
  style?: string;             // 风格（可选）
  quality?: 'standard' | 'high';  // 质量等级
}

/**
 * 生成人物立绘的 Prompt 模板
 */
function buildCharacterPrompt(params: CharacterSheetRequest): string {
  const {
    characterName,
    description,
    outfit,
    style = '二次元插画风格',
  } = params;

  return `人物立绘设计图，${style}，高质量，精细细节。

【角色信息】
角色名称：${characterName}
角色特征：${description}
服装造型：${outfit}

【画面布局】
水平三栏式布局，16:9 宽高比：
- 左侧：角色正面照（占 30% 画面），标准站姿，全身立绘
- 中间：角色侧面照（占 35% 画面），45 度角侧身，展示服装层次
- 右侧：角色背面照（占 30% 画面），背身站姿，展示背部设计

【技术要求】
- 背景完全透明（PNG 透明背景）
- 三个视角使用相同的角色造型和服装
- 保持比例一致
- 线条清晰，色彩鲜明
- 光照均匀，无阴影干扰

【风格特征】
${style}，专业角色设计图，游戏角色立绘标准，高完成度
`;
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'dev-user';
    const body: CharacterSheetRequest = await request.json();

    const {
      characterName,
      description,
      outfit,
      style = '二次元插画风格',
      quality = 'standard',
    } = body;

    // 验证必填参数
    if (!characterName || !description || !outfit) {
      return NextResponse.json(
        {
          error: '缺少必填参数',
          required: ['characterName', 'description', 'outfit'],
        },
        { status: 400 }
      );
    }

    console.log(`[人物立绘] 生成请求:`, {
      userId,
      characterName,
      style,
      quality,
    });

    // 构建提示词
    const prompt = buildCharacterPrompt({ characterName, description, outfit, style });

    // 根据质量选择尺寸
    const size = quality === 'high' ? '4096x2304' : '2560x1440'; // 16:9 比例

    // 初始化图片生成客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // 生成图片
    const response = await client.generate({
      prompt: prompt,
      size: size,
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (!helper.success || helper.imageUrls.length === 0) {
      throw new Error(helper.errorMessages.join(', ') || '图片生成失败');
    }

    const imageUrl = helper.imageUrls[0];

    console.log(`[人物立绘] 生成成功:`, {
      userId,
      characterName,
      size,
      imageUrl,
    });

    return NextResponse.json({
      success: true,
      characterSheet: {
        url: imageUrl,
        prompt: prompt,
        size: size,
        model: DEFAULT_MODELS.image,
        format: 'png', // PNG 格式支持透明背景
        characterName: characterName,
        description: description,
        outfit: outfit,
      },
    });

  } catch (error) {
    console.error('[人物立绘] 生成失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '人物立绘生成失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取人物立绘生成的使用说明
 */
export async function GET() {
  return NextResponse.json({
    name: '人物立绘生成 API',
    description: '生成包含正面照、侧面照、背面照的完整立绘图',
    version: '1.0.0',

    endpoint: 'POST /api/images/character-sheet',

    request: {
      characterName: {
        type: 'string',
        required: true,
        description: '角色名称',
        example: '艾琳公主',
      },
      description: {
        type: 'string',
        required: true,
        description: '角色描述（外貌、发型、性格等）',
        example: '金色长发，碧绿色眼睛，优雅的公主气质，温柔善良，面带微笑',
      },
      outfit: {
        type: 'string',
        required: true,
        description: '服装描述',
        example: '白色宫廷长裙，淡蓝色披风，头戴皇冠',
      },
      style: {
        type: 'string',
        required: false,
        description: '插画风格',
        default: '二次元插画风格',
        example: '二次元插画风格',
      },
      quality: {
        type: 'string',
        required: false,
        description: '质量等级',
        enum: ['standard', 'high'],
        default: 'standard',
      },
    },

    response: {
      success: true,
      characterSheet: {
        data: 'base64 encoded PNG image',
        prompt: '生成的提示词',
        size: '2560x1440 or 4096x2304',
        model: 'doubao-seedream-5-0-260128',
        format: 'png',
      },
    },

    example: {
      request: {
        characterName: '艾琳公主',
        description: '金色长发，碧绿色眼睛，优雅的公主气质，温柔善良',
        outfit: '白色宫廷长裙，淡蓝色披风，头戴皇冠',
        style: '二次元插画风格',
        quality: 'standard',
      },
      response: {
        success: true,
        characterSheet: {
          data: 'iVBORw0KGgoAAAANSUhEUg...',
          size: '2560x1440',
          model: 'doubao-seedream-5-0-260128',
          format: 'png',
        },
      },
    },

    notes: [
      '生成的图片为 PNG 格式，支持透明背景',
      '16:9 宽高比，三个视角水平排列',
      '建议使用详细的角色描述以获得更好的效果',
      '可以在前端将 base64 数据转换为图片显示',
    ],
  });
}
