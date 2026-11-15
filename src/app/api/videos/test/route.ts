import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationClient, Config, HeaderUtils, APIError } from 'coze-coding-dev-sdk';
import { DEFAULT_MODELS, VIDEO_MODELS } from '@/lib/config';

// 获取视频模型列表
const VIDEO_MODELS_LIST = Object.values(VIDEO_MODELS);

/**
 * 视频生成API测试接口
 * 
 * GET - 检查API配置状态
 * POST - 测试视频生成（生成最简单的测试视频）
 */

export async function GET(request: NextRequest) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 返回配置状态
    return NextResponse.json({
      success: true,
      status: {
        configLoaded: true,
        hasCustomHeaders: Object.keys(customHeaders).length > 0,
        currentModel: DEFAULT_MODELS.video,
        availableModels: VIDEO_MODELS_LIST,
        timestamp: new Date().toISOString(),
        message: 'API配置已加载，可以尝试测试生成',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '配置加载失败',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[视频测试] 开始测试视频生成...');
    
    const body = await request.json().catch(() => ({}));
    const { model: requestedModel } = body;
    
    // 使用请求中指定的模型，或默认模型
    const videoModel = requestedModel || DEFAULT_MODELS.video;
    
    // 检查模型是否可用
    const modelInfo = VIDEO_MODELS[videoModel as keyof typeof VIDEO_MODELS];
    if (!modelInfo || !modelInfo.available) {
      return NextResponse.json({
        success: false,
        error: `模型 ${videoModel} 当前不可用`,
        availableModels: VIDEO_MODELS_LIST.filter(m => m.available),
      }, { status: 400 });
    }
    
    // 创建 SDK 配置（扣子平台通过转发头自动处理认证）
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new VideoGenerationClient(config, customHeaders);

    // 使用最简单的提示词测试
    const content = [{
      type: 'text' as const,
      text: 'A simple test video: a blue sky with white clouds',
    }];

    console.log('[视频测试] 调用API...', { model: videoModel });
    
    const response = await client.videoGeneration(content, {
      model: videoModel,
      duration: 4, // 最短时长
      ratio: '16:9',
      resolution: '480p', // 最低分辨率
      generateAudio: false, // 不生成音频
      maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
    });

    console.log('[视频测试] API响应:', {
      hasVideoUrl: !!response.videoUrl,
      status: response.response?.status,
      taskId: response.response?.id,
    });

    if (response.videoUrl) {
      return NextResponse.json({
        success: true,
        videoUrl: response.videoUrl,
        taskId: response.response?.id,
        status: response.response?.status,
        model: videoModel,
        message: '测试视频生成成功！API配置正常。',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'API未返回视频URL',
        response: {
          status: response.response?.status,
          errorMessage: response.response?.error_message,
          taskId: response.response?.id,
        },
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[视频测试] 错误:', error);
    
    if (error instanceof APIError) {
      return NextResponse.json({
        success: false,
        error: `API错误 [${error.statusCode}]: ${error.message}`,
        statusCode: error.statusCode,
        details: {
          message: error.message,
          statusCode: error.statusCode,
          response: error.response,
        },
        suggestion: getErrorSuggestion(error.statusCode),
      }, { status: error.statusCode || 500 });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

// 根据错误码提供建议
function getErrorSuggestion(statusCode: number | undefined): string {
  switch (statusCode) {
    case 400:
      return '请求参数错误。可能是模型名称不正确或参数格式有误。';
    case 401:
      return '认证失败。扣子平台通过转发头自动处理认证，请确保在扣子编程环境中运行。';
    case 403:
      return 'API访问被拒绝。可能原因：\n1. 服务未开通\n2. 账户配额已用完\n3. 权限不足\n请联系管理员或检查账户状态。';
    case 404:
      return '模型未找到。请确认使用的模型ID正确。';
    case 429:
      return '请求频率超限。请稍后重试。';
    case 500:
      return '服务器内部错误。请稍后重试。';
    default:
      return '请检查API配置或联系技术支持。';
  }
}
