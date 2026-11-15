import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const WORKFLOW_SYSTEM_PROMPT = `你是AI短剧制作工作流执行器。根据用户的输入和当前步骤，执行相应的任务。

工作流步骤：
1. 用户输入 - 接收题材、冲突、人物数量
2. 生成角色档案 - 创建固定角色档案
3. 生成剧本分镜 - 生成剧本
4. 生成角色参考图 - 为角色生成参考图像描述
5. 生成视频片段 - 生成分镜视频描述
6. 生成角色配音 - 生成配音配置
7. 生成音频素材 - BGM、环境音、音效
8. 自动剪辑合成 - 剪辑方案
9. 质量自检 - 检查一致性
10. 输出最终短剧 - 输出配置

返回JSON格式，output字段必须是字符串：
{
  "step": "步骤名称",
  "result": "执行结果描述",
  "output": "具体的输出内容（字符串格式）"
}`;

// 默认配置
const DEFAULT_CONFIG = {
  llmModel: 'doubao-seed-2-0-pro-260215',
};

export async function POST(request: NextRequest) {
  try {
    const { step, input, context, seriesId, seriesTitle } = await request.json();

    // 使用默认配置
    const llmModel = DEFAULT_CONFIG.llmModel;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 如果有短剧标题，添加到上下文中
    const seriesContext = seriesTitle ? `\n\n当前短剧项目：${seriesTitle}` : '';

    const messages = [
      { role: 'system' as const, content: WORKFLOW_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `当前步骤：${step}${seriesContext}
用户输入：${JSON.stringify(input)}
上下文：${JSON.stringify(context)}

请执行当前步骤并返回结果。output字段必须是纯文本字符串，不要是对象。如果提供了短剧项目名称，请在生成内容中引用它。`
      }
    ];

    console.log(`[Workflow] 步骤: ${step}, 模型: ${llmModel}`);

    const response = await client.invoke(messages, {
      model: llmModel,
      temperature: 0.7
    });

    let result;
    try {
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          step,
          result: response.content,
          output: response.content
        };
      }
    } catch {
      result = {
        step,
        result: response.content,
        output: response.content
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Workflow] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '工作流执行失败' },
      { status: 500 }
    );
  }
}
