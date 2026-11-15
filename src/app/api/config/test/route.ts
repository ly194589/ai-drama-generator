import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { SOLUTION_PRESETS } from '@/lib/config';

/**
 * 平台连接测试 API
 * 
 * GET - 获取平台配置状态
 * POST - 测试平台连接
 */

interface TestResult {
  service: string;
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * 获取平台配置状态
 */
export async function GET(request: NextRequest) {
  try {
    const preset = SOLUTION_PRESETS['standard'];
    
    // 扣子平台通过转发头自动处理认证
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const hasAuth = Object.keys(customHeaders).length > 0;
    
    return NextResponse.json({
      success: true,
      currentPlatform: 'coze',
      currentPreset: {
        id: preset.id,
        name: preset.name,
      },
      configStatus: {
        coze: {
          authenticated: hasAuth,
          message: hasAuth ? '扣子平台认证已就绪' : '扣子平台认证中（转发头自动处理）',
        },
      },
      services: {
        llm: {
          available: true,
          model: preset.models.llm,
          description: preset.models.llmDescription,
        },
        video: {
          available: true,
          model: preset.models.video,
        },
        image: {
          available: true,
          model: (preset.models as Record<string, unknown>).image as string | undefined,
          defaultSize: (preset.models as Record<string, unknown>).imageSize as string | undefined,
        },
        tts: {
          available: true,
          model: (preset.models as Record<string, unknown>).tts as string | undefined || (preset.models as Record<string, unknown>).ttsSpeaker as string | undefined,
          description: (preset.models as Record<string, unknown>).ttsDescription as string | undefined,
        },
      },
    });
  } catch (error) {
    console.error('[配置测试] 获取配置状态失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * 测试平台连接
 */
export async function POST(request: NextRequest) {
  const results: TestResult[] = [];
  
  try {
    const body = await request.json().catch(() => ({}));
    const { service: requestedService } = body;
    
    console.log(`[配置测试] 开始测试服务: ${requestedService || 'all'}`);
    
    // 测试 LLM 连接
    if (!requestedService || requestedService === 'llm') {
      const llmResult = await testCozeLLM(request);
      results.push(llmResult);
    }
    
    // 汇总结果
    const allSuccess = results.every(r => r.success);
    
    return NextResponse.json({
      success: allSuccess,
      platform: 'coze',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
      message: allSuccess 
        ? '所有服务连接正常' 
        : `部分服务连接失败: ${results.filter(r => !r.success).map(r => r.service).join(', ')}`,
    });
    
  } catch (error) {
    console.error('[配置测试] 测试失败:', error);
    return NextResponse.json({
      success: false,
      results: [{
        service: 'unknown',
        success: false,
        message: '测试过程发生错误',
        error: error instanceof Error ? error.message : '未知错误',
      }],
    }, { status: 500 });
  }
}

/**
 * 测试扣子平台 LLM 连接
 */
async function testCozeLLM(request: NextRequest): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = new LLMClient(config, customHeaders);
    
    // 发送一个简单的测试请求
    let response = '';
    for await (const chunk of client.stream([
      { role: 'user', content: '你好，这是一个连接测试，请回复"测试成功"' }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.1,
    })) {
      if (chunk.content) {
        response += chunk.content.toString();
      }
    }
    
    const latency = Date.now() - startTime;
    
    return {
      service: 'llm',
      success: true,
      message: 'LLM 服务连接正常',
      latency,
      details: {
        response: response.substring(0, 100),
        model: 'doubao-seed-2-0-pro-260215',
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    return {
      service: 'llm',
      success: false,
      message: 'LLM 服务连接失败',
      error: error instanceof Error ? error.message : '未知错误',
      latency,
    };
  }
}
