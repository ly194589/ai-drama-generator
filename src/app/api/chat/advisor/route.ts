import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * AI专业顾问API（流式）
 * 
 * 特性：
 * 1. 多角色顾问 - 编剧顾问、导演顾问、制作顾问、剪辑顾问
 * 2. 上下文记忆 - 记住用户偏好和历史对话
 * 3. 工作流联动 - 可直接触发工作流操作
 * 4. 学习进化 - 根据用户反馈优化建议
 */

// 顾问角色定义
const ADVISOR_ROLES = {
  // 编剧顾问 - 专注剧本创作
  scriptwriter: {
    name: '编剧顾问',
    avatar: '📝',
    expertise: ['剧情设计', '角色塑造', '冲突设置', '节奏把控', '台词优化'],
    systemPrompt: `你是资深短剧编剧顾问，精通抖音短剧创作。你的专业领域：

【核心能力】
剧情架构：强开篇钩子、密集反转、情绪高潮设计
角色塑造：人设一致性、角色弧光、群像平衡
冲突设计：核心冲突、多线冲突、矛盾升级
节奏把控：黄金节奏锚点、情绪曲线、悬念管理
台词优化：网感台词、情绪表达、金句设计

【回答风格】
专业但通俗，结合具体案例说明
给出可落地的修改建议
关注抖音短剧特性和用户习惯
强调节奏感和情绪体验
文字清爽，避免过多符号装饰`
  },

  // 导演顾问 - 专注视觉表达
  director: {
    name: '导演顾问',
    avatar: '🎬',
    expertise: ['镜头语言', '场景调度', '视觉风格', '表演指导', '氛围营造'],
    systemPrompt: `你是资深短剧导演顾问，精通视觉叙事和镜头语言。你的专业领域：

【核心能力】
镜头语言：景别选择、运镜技巧、画面构图
场景调度：空间利用、人物走位、道具安排
视觉风格：色调统一、光影设计、质感把控
表演指导：情绪表达、微表情、肢体语言
氛围营造：情绪渲染、节奏控制、高潮设计

【回答风格】
注重视觉化和画面感
用专业术语但配通俗解释
结合分镜设计给建议
关注AI生成的可行性
文字清爽，避免过多符号装饰`
  },

  // 制作顾问 - 专注生产流程
  producer: {
    name: '制作顾问',
    avatar: '⚙️',
    expertise: ['工作流优化', '成本控制', '质量标准', '一致性管理', '效率提升'],
    systemPrompt: `你是资深短剧制作顾问，精通AI短剧生产流程。你的专业领域：

【核心能力】
工作流优化：流程设计、任务调度、资源配置
成本控制：Token消耗、API调用优化、时间管理
质量标准：一致性标准、质量检测、问题修复
效率提升：批量生成、并行处理、自动化方案
问题诊断：错误分析、解决方案、预防措施

【回答风格】
实用主义，关注效率和成本
给出具体的操作步骤
提供多种可选方案
关注常见坑点和避坑指南
文字清爽，避免过多符号装饰`
  },

  // 剪辑顾问 - 专注后期制作
  editor: {
    name: '剪辑顾问',
    avatar: '✂️',
    expertise: ['剪辑节奏', '转场设计', '音乐配合', '字幕风格', '特效运用'],
    systemPrompt: `你是资深短剧剪辑顾问，精通视频后期制作。你的专业领域：

【核心能力】
剪辑节奏：节奏感把控、高潮设计、情绪推进
转场设计：自然过渡、情绪衔接、风格统一
音乐配合：BGM选择、节奏对点、情绪烘托
字幕风格：字体选择、动效设计、可读性
特效运用：适度原则、质感提升、观感优化

【回答风格】
注重观感和用户体验
关注抖音平台特性
给出具体的参数建议
平衡艺术性和效率
文字清爽，避免过多符号装饰`
  }
} as const;

type AdvisorRole = keyof typeof ADVISOR_ROLES;

// 用户偏好学习
interface UserPreferences {
  preferredStyle: string;
  preferredLength: 'short' | 'medium' | 'detailed';
  focusAreas: string[];
  pastQuestions: string[];
  feedbackHistory: Array<{ question: string; helpful: boolean }>;
}

// 工作流操作定义
const WORKFLOW_ACTIONS = {
  generate_script: {
    label: '生成剧本',
    endpoint: '/api/drama/series/[id]/episodes/stream',
    description: '根据当前讨论生成完整剧本'
  },
  generate_characters: {
    label: '生成角色',
    endpoint: '/api/generate-characters',
    description: '生成角色档案'
  },
  generate_images: {
    label: '生成图片',
    endpoint: '/api/images/batch-generate',
    description: '批量生成角色/场景图片'
  },
  generate_videos: {
    label: '生成视频',
    endpoint: '/api/videos/generate',
    description: '生成分镜视频'
  },
  start_workflow: {
    label: '启动工作流',
    endpoint: '/api/workflow/engine',
    description: '启动完整工作流'
  }
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { 
    message, 
    sessionId,
    role = 'scriptwriter' as AdvisorRole,
    context = {},
  } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: '请输入问题' }), { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 加载会话历史
  let history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  let preferences: UserPreferences = {
    preferredStyle: 'detailed',
    preferredLength: 'medium',
    focusAreas: [],
    pastQuestions: [],
    feedbackHistory: []
  };

  if (sessionId) {
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*, messages(*)')
      .eq('id', sessionId)
      .single();

    if (session?.messages) {
      history = (session.messages as Array<{ role: string; content: string }>)
        .slice(-10) // 保留最近10条
        .map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }));
    }

    // 加载用户偏好
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (prefs) {
      preferences = prefs.preferences as UserPreferences;
    }
  }

  // 获取顾问角色配置
  const advisorRole = ADVISOR_ROLES[role as keyof typeof ADVISOR_ROLES] || ADVISOR_ROLES.scriptwriter;

  // 构建上下文感知的系统提示
  const contextPrompt = buildContextPrompt(context, preferences);
  
  const systemPrompt = `${advisorRole.systemPrompt}

${contextPrompt}

【交互规则】
1. 根据用户问题提供专业建议
2. 如果涉及具体操作，可以建议触发工作流
3. 记住用户的历史问题和偏好
4. 回答格式清爽简洁，段落分明即可
5. 如果用户问的问题需要其他顾问解答，可以建议切换顾问

【输出格式要求】
- 使用自然段落表达，避免过多的符号装饰
- 重点内容用简洁的方式标示，如"关键点："或"建议："
- 列表使用简单的序号1. 2. 3. 即可
- 避免使用复杂的表格、分割线、星号装饰等
- 保持专业性的同时让文字清爽易读`;

  // 创建流式响应
  const encoder = new TextEncoder();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 发送角色信息
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'role_info',
          role: role,
          name: advisorRole.name,
          avatar: advisorRole.avatar,
          expertise: advisorRole.expertise
        })}\n\n`));

        // 构建消息
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...history,
          { role: 'user' as const, content: message }
        ];

        // 流式生成
        const llmStream = client.stream(messages, {
          model: 'doubao-seed-2-0-pro-260215',
          temperature: 0.7
        });

        let fullContent = '';

        for await (const chunk of llmStream) {
          if (chunk.content) {
            const text = chunk.content.toString();
            fullContent += text;
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'content',
              content: text
            })}\n\n`));
          }
        }

        // 检测是否建议工作流操作
        const suggestedActions = detectWorkflowActions(fullContent, context);
        if (suggestedActions.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'workflow_suggestions',
            actions: suggestedActions.map(a => ({
              ...a,
              ...WORKFLOW_ACTIONS[a.action as keyof typeof WORKFLOW_ACTIONS]
            }))
          })}\n\n`));
        }

        // 检测是否建议切换顾问
        const suggestedRole = detectRoleSwitch(fullContent, role);
        if (suggestedRole) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'role_suggestion',
            suggestedRole,
            roleName: ADVISOR_ROLES[suggestedRole as keyof typeof ADVISOR_ROLES]?.name
          })}\n\n`));
        }

        // 保存消息
        if (sessionId) {
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: message
          });
          
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullContent
          });

          // 更新用户偏好
          await updateUserPreferences(sessionId, message, preferences, supabase);
        }

        // 发送完成信号
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          content: fullContent
        })}\n\n`));

        controller.close();

      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : '生成失败'
        })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// 构建上下文提示
function buildContextPrompt(context: Record<string, unknown>, preferences: UserPreferences): string {
  const parts: string[] = [];

  if (context.seriesTitle) {
    parts.push(`【当前项目】${context.seriesTitle}`);
  }

  if (context.currentEpisode) {
    parts.push(`【当前集数】第${context.currentEpisode}集`);
  }

  if (context.characters && Array.isArray(context.characters)) {
    parts.push(`【角色列表】${(context.characters as Array<Record<string, unknown>>).map((c: Record<string, unknown>) => c.name).join('、')}`);
  }

  if (preferences.focusAreas.length > 0) {
    parts.push(`【用户关注点】${preferences.focusAreas.join('、')}`);
  }

  if (preferences.preferredLength) {
    parts.push(`【回答长度偏好】${preferences.preferredLength === 'short' ? '简洁' : preferences.preferredLength === 'detailed' ? '详细' : '适中'}`);
  }

  return parts.length > 0 ? `\n【上下文信息】\n${parts.join('\n')}` : '';
}

// 检测工作流操作建议
function detectWorkflowActions(content: string, context: Record<string, unknown>): Array<{ action: string; params: Record<string, unknown> }> {
  const actions: Array<{ action: string; params: Record<string, unknown> }> = [];

  const actionPatterns = [
    { pattern: /生成.*剧本|创建.*剧本|写.*剧本/gi, action: 'generate_script' },
    { pattern: /生成.*角色|创建.*角色|设计.*角色/gi, action: 'generate_characters' },
    { pattern: /生成.*图片|创建.*图片|制作.*海报/gi, action: 'generate_images' },
    { pattern: /生成.*视频|创建.*视频|制作.*视频/gi, action: 'generate_videos' },
    { pattern: /启动.*工作流|开始.*流程|一键.*生成/gi, action: 'start_workflow' }
  ];

  for (const { pattern, action } of actionPatterns) {
    if (pattern.test(content)) {
      actions.push({
        action,
        params: {
          seriesId: context.seriesId,
          episodeNumber: context.currentEpisode
        }
      });
    }
  }

  return actions;
}

// 检测是否需要切换顾问
function detectRoleSwitch(content: string, currentRole: string): string | null {
  const roleKeywords: Record<string, string[]> = {
    director: ['镜头', '画面', '视觉', '景别', '构图', '运镜'],
    producer: ['工作流', '效率', '成本', '流程', '批量', '自动化'],
    editor: ['剪辑', '转场', '字幕', 'BGM', '音乐', '特效']
  };

  for (const [role, keywords] of Object.entries(roleKeywords)) {
    if (role !== currentRole) {
      const matchCount = keywords.filter(kw => content.includes(kw)).length;
      if (matchCount >= 2) {
        return role;
      }
    }
  }

  return null;
}

// 更新用户偏好
async function updateUserPreferences(
  sessionId: string, 
  question: string, 
  currentPrefs: UserPreferences,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<void> {
  // 提取关注点
  const focusKeywords = ['节奏', '角色', '冲突', '台词', '画面', '情绪', '反转', '钩子'];
  const newFocusAreas = focusKeywords.filter(kw => question.includes(kw));
  
  const updatedPrefs: UserPreferences = {
    ...currentPrefs,
    focusAreas: [...new Set([...currentPrefs.focusAreas, ...newFocusAreas])].slice(0, 5),
    pastQuestions: [...currentPrefs.pastQuestions.slice(-9), question]
  };

  try {
    await supabase
      .from('user_preferences')
      .upsert({
        session_id: sessionId,
        preferences: updatedPrefs,
        updated_at: new Date().toISOString()
      });
  } catch {
    // 表可能不存在，忽略
  }
}

// 获取顾问列表
export async function GET() {
  const roles = Object.entries(ADVISOR_ROLES).map(([key, value]) => ({
    id: key,
    name: value.name,
    avatar: value.avatar,
    expertise: value.expertise
  }));

  return Response.json({
    success: true,
    roles,
    workflowActions: Object.entries(WORKFLOW_ACTIONS).map(([key, value]) => ({
      id: key,
      ...value
    }))
  });
}
