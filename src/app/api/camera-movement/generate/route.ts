/**
 * AI运镜动作提示词生成API
 * 
 * 根据场景信息智能生成专业的电影级运镜描述
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCameraMovementPrompt,
  enhanceCameraMovementPrompt,
  getAvailableCameraMovementTypes,
  type CameraMovementType,
} from '@/lib/camera-movement-prompts';

// 请求参数接口
interface GenerateCameraMovementRequest {
  shotType?: string;          // 镜头类型：特写、中景、远景等
  mood?: string;              // 情绪：紧张、浪漫、悬疑等
  sceneType?: string;         // 场景类型：室内、室外、动作等
  action?: string;            // 动作描述
  emotion?: string;           // 情绪描述
  existingPrompt?: string;    // 已有运镜描述（用于增强）
  mode?: 'generate' | 'enhance' | 'list'; // 模式：生成、增强、列表
}

// 响应接口
interface GenerateCameraMovementResponse {
  success: boolean;
  data?: {
    cameraMovement: string;
    type?: CameraMovementType;
    description?: string;
  };
  types?: Array<{
    type: CameraMovementType;
    name: string;
    description: string;
  }>;
  error?: string;
}

/**
 * POST /api/camera-movement/generate
 * 生成或增强运镜提示词
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateCameraMovementResponse>> {
  try {
    const body: GenerateCameraMovementRequest = await request.json();
    const {
      shotType,
      mood,
      sceneType,
      action,
      emotion,
      existingPrompt,
      mode = 'generate',
    } = body;

    // 列表模式：返回所有可用运镜类型
    if (mode === 'list') {
      return NextResponse.json({
        success: true,
        types: getAvailableCameraMovementTypes(),
      });
    }

    // 增强模式：在现有提示词基础上增强
    if (mode === 'enhance' && existingPrompt) {
      const enhancedPrompt = enhanceCameraMovementPrompt(existingPrompt, {
        shotType,
        mood: mood || emotion,
        action,
      });

      return NextResponse.json({
        success: true,
        data: {
          cameraMovement: enhancedPrompt,
        },
      });
    }

    // 生成模式：根据参数智能生成
    const cameraMovement = generateCameraMovementPrompt({
      shotType,
      mood,
      sceneType,
      action,
      emotion,
      customDescription: existingPrompt,
    });

    return NextResponse.json({
      success: true,
      data: {
        cameraMovement,
      },
    });
  } catch (error) {
    console.error('运镜提示词生成失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成运镜提示词失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/camera-movement/generate
 * 获取所有可用的运镜类型
 */
export async function GET(): Promise<NextResponse<GenerateCameraMovementResponse>> {
  try {
    return NextResponse.json({
      success: true,
      types: getAvailableCameraMovementTypes(),
    });
  } catch (error) {
    console.error('获取运镜类型失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取运镜类型失败',
      },
      { status: 500 }
    );
  }
}
