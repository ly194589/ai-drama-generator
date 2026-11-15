import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getZhipuClientAsync, isZhipuConfiguredForUser } from '@/lib/zhipu-client';
import { LLM_MODELS, SOLUTION_PRESETS, SolutionType, getDefaultLLMBySolution } from '@/lib/config';
import { getScriptPromptProfile } from '@/lib/model-prompt-profiles';

/**
 * Seedance 1.5 Pro 剧本优化 API
 * 100%适配Seedance 1.5 Pro视频生成模型
 * 
 * 核心特点：
 * - 一个10秒视频包含多段对话、多个场景切换
 * - 对话直接嵌入视觉描述中，格式：角色说："台词"
 * - 全中文提示词，贴合模型语义逻辑
 * - 内置核心前缀和负面提示词
 */

// Seedance 1.5 Pro 风格配置
const SEEDANCE_STYLES = {
  comedy: {
    name: '搞笑反转版',
    prefix: '高清1080P画质，画面稳定不抖动，人物表情夸张生动，动作流畅自然不违和，节奏紧凑，喜剧氛围感拉满，反转感强，无人物变形，无画面崩坏',
    suffix: '表情夸张到位，动作流畅，反转搞笑感拉满，画面稳定不崩坏',
    negativePrompt: '表情僵硬，动作违和，节奏拖沓，画面模糊，人物变形，笑点不足，穿帮违和，肢体扭曲，画面抖动',
    description: '反转拉满、表情夸张、喜剧感强',
  },
  
  horror: {
    name: '中式恐怖版',
    prefix: '超清1080P画质，画面稳定，暗调氛围感光影，压抑悬疑氛围，镜头运镜舒缓有压迫感，细节细腻，情绪到位，无画面闪烁，无突兀跳脱',
    suffix: '画面昏暗压抑，惊悚氛围感拉满，镜头有压迫感，动作流畅',
    negativePrompt: '画面过亮，氛围违和，恐怖感廉价，画面闪烁，人物变形，动作卡顿，穿帮违和，色彩杂乱，过度曝光',
    description: '光影氛围、惊悚压抑、细节细腻',
  },
  
  ancient: {
    name: '唯美古风版',
    prefix: '超清1080P画质，电影级古风光影，新中式美学，画面细腻通透，意境氛围感拉满，运镜舒缓流畅，人物造型精致，动作轻柔自然，色彩雅致，无画面崩坏，无人物变形',
    suffix: '画面唯美治愈，古风氛围感拉满，光影柔和，运镜舒缓',
    negativePrompt: '画面脏乱，色彩艳俗，人物变形，动作僵硬，画面抖动，意境不足，穿帮违和，画质模糊，现代元素乱入',
    description: '电影级光影、新中式美学、意境拉满',
  },
  
  conflict: {
    name: '短剧强冲突版',
    prefix: '高清1080P画质，画面稳定，节奏紧凑不拖沓，人物情绪饱满张力拉满，动作流畅，对峙感强，镜头有冲击力，无画面崩坏，无动作卡顿',
    suffix: '张力拉满，动作流畅，节奏紧凑，镜头有冲击力',
    negativePrompt: '节奏拖沓，情绪不到位，动作卡顿，画面模糊，人物变形，张力不足，画面抖动，穿帮违和',
    description: '节奏紧凑、情绪张力、镜头冲击力',
  },
};

type StyleType = keyof typeof SEEDANCE_STYLES;

// 生成 Seedance 剧本优化系统提示词
function generateSeedanceSystemPrompt(style: StyleType, modelId?: string): string {
  const styleConfig = SEEDANCE_STYLES[style];
  
  return `你是专业的抖音短剧编剧，擅长创作${styleConfig.description}的短视频内容。
${getScriptPromptProfile(modelId).styleDirective}

【核心规则 - 必须遵守】
- 每个分镜（视频）时长：10~12秒
- 一集包含8~10个分镜
- 总时长：80~120秒
- 每个分镜至少4句对话
- 对话多、场景多的分镜用11-12秒

【视觉提示词格式 - 极其重要】
一个视频的visualPrompt是一段完整的描述，包含：
1. 风格前缀（已自动添加）
2. 场景描述和角色动作
3. 多段对话（用"角色说：'台词'"格式嵌入）
4. 场景切换（用"镜头切到"连接）
5. 风格后缀（已自动添加）

【对话创作规则 - 专业剧本格式】
- 对话直接嵌入视觉描述中，格式：角色（动作/表情）说："台词"
- 每个视频必须包含4-6段对话（最少4句）
- 台词用中文双引号包裹："台词内容"
- 台词可达30字，要符合角色身份、性格、当前情境

【台词创作要求】
1. 台词要有情感层次：铺垫→冲突→高潮→反转
2. 角色之间要有互动，对话要呼应、接话
3. 台词要符合角色身份（农夫说话朴实，女子说话冷艳）
4. 台词要推动剧情发展，每句话都有目的
5. 重要台词要有动作和表情配合
6. 允许使用口语化表达（如"卧槽"、"太好了"）

【台词情感标注示例】
- 农夫一脸得意说："这一世我不用布条了，肯定没事了。"
- 女子冷冷地问："你是否在雪山上救过一只狐狸？"
- 农夫激动地喊："你肯定就是那只狐狸来报恩的吧？"
- 农夫惊恐地崩溃大喊："卧槽，又猜错了！"

【对话互动示例】
女子："你是否在雪山上救过一只狐狸？"（提问）
农夫："是啊，难道你是..."（接话+猜测）
女子："我是那瓶药水。"（反转）
农夫："卧槽，又猜错了！"（反应+笑点）

【场景切换规则】
- 用"镜头切到"连接不同场景
- 一个视频可包含2-4个场景
- 每个场景可以有1-2段对话
- 场景多、对话多的视频用11-12秒

【示例视觉提示词】
古代树林里，粗布便服的农夫蹲在地上，给受伤的白狐狸用药水消毒，一脸得意地说："这一世我不用布条了，肯定没事了。"镜头切到农家小屋，漂亮女子找上门，冷冷地问道："你是否在树林里救过一只狐狸？"农夫一脸了然，兴奋地说："你肯定就是那只狐狸来报恩的吧？"女子面无表情，冷笑道："我是那瓶药水。"随后掏出刀捅向农夫，农夫瞬间瞳孔地震，惊恐崩溃大喊："卧槽，又猜错了！"

【输出JSON格式 - 严格遵循】
{
  "title": "剧名",
  "summary": "一句话总结",
  "genre": "题材类型",
  "style": "${style}",
  "totalDuration": 总秒数,
  "characters": [
    {
      "name": "角色名",
      "gender": "male/female",
      "age": 年龄,
      "description": "外观描述（服装、发型、气质、关键特征）"
    }
  ],
  "videos": [
    {
      "id": "video_1",
      "sequence": 1,
      "name": "视频名称（如：救狐遇险）",
      "duration": 10,
      "shotType": "综合运镜",
      "characters": ["角色名"],
      "scenes": ["场景1", "场景2"],
      "dialogueCount": 4,
      "dialogues": [
        {"speaker": "角色", "content": "台词", "emotion": "得意"},
        {"speaker": "角色", "content": "台词", "emotion": "疑惑"},
        {"speaker": "角色", "content": "台词", "emotion": "兴奋"},
        {"speaker": "角色", "content": "台词", "emotion": "惊恐"}
      ],
      "visualPrompt": "完整的视觉描述（包含风格前缀、场景、动作、对话、场景切换、风格后缀）",
      "mood": "氛围"
    }
  ],
  "globalNegativePrompt": "${styleConfig.negativePrompt}"
}

【关键要求】
1. 每个视频的visualPrompt必须是完整可用的提示词
2. 对话要自然嵌入，格式：角色（表情/动作）说："台词"
3. 场景切换要流畅，用"镜头切到"连接
4. 每个视频最少4句对话，时长10~12秒
5. 台词要有情感标注，符合剧本格式
6. 对话要推动剧情，有铺垫、高潮、反转
7. duration必须是阿拉伯数字：10、11、12、13、14、15`;
}

// 生成用户提示词
function generateSeedanceUserPrompt(storySummary: string, style: StyleType, additionalRequirements?: string): string {
  const styleConfig = SEEDANCE_STYLES[style];
  
  let prompt = `请根据以下故事概要，创作${styleConfig.description}的短视频剧本：

【故事概要】
${storySummary}

【创作要求】
1. 一集包含8~10个分镜（视频）
2. 每个分镜时长10~12秒
3. 每个分镜必须包含4-6句对话（最少4句！），对话嵌入视觉描述中
4. 分镜可包含多个场景，用"镜头切到"连接
5. 台词要符合剧本格式，有情感标注（得意/疑惑/兴奋/惊恐等）
6. 对话格式：角色（表情/动作）说："台词"
7. 充分展示${styleConfig.name}的特点
8. duration字段必须是阿拉伯数字：10、11、12、13、14、15

【台词要求】
- 台词要符合角色身份（农夫朴实憨厚，女子冷艳神秘）
- 台词之间要有互动和呼应，推动剧情发展
- 台词要有情感层次：铺垫→冲突→高潮→反转
- 情感标注示例：得意、疑惑、兴奋、惊恐、冷笑、崩溃、期待`;

  if (additionalRequirements) {
    prompt += `\n\n【额外要求】\n${additionalRequirements}`;
  }

  prompt += `\n\n【输出格式】
输出JSON，videos数组中每个元素包含完整的visualPrompt。
visualPrompt格式示例：
古代树林里，农夫蹲在地上给狐狸消毒，一脸得意说："这一世我不用布条了，肯定没事了。"镜头切到农家小屋，漂亮女子冷冷地问道："你是否在树林里救过一只狐狸？"农夫一脸了然笑着说："你肯定就是那只狐狸来报恩的吧？"女子面无表情冷冷说："我是那瓶药水。"随后掏出刀刺向农夫，农夫瞬间瞳孔地震，惊恐崩溃大喊："卧槽，又猜错了！"`;

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      storySummary, 
      style = 'comedy',
      additionalRequirements,
      model, 
      solution, 
      provider 
    } = body;

    if (!storySummary) {
      return NextResponse.json(
        { error: '请提供故事概要' },
        { status: 400 }
      );
    }

    // 验证风格
    const styleType = style as StyleType;
    if (!SEEDANCE_STYLES[styleType]) {
      return NextResponse.json(
        { error: `不支持的风格: ${style}。支持的风格: ${Object.keys(SEEDANCE_STYLES).join(', ')}` },
        { status: 400 }
      );
    }

    const styleConfig = SEEDANCE_STYLES[styleType];

    // 确定方案
    const solutionType: SolutionType = solution || 'zhipu';
    const solutionPreset = SOLUTION_PRESETS[solutionType];

    // 确定模型
    const modelId = model || getDefaultLLMBySolution(solutionType);
    const modelConfig = LLM_MODELS[modelId as keyof typeof LLM_MODELS];

    // 确定提供商
    const providerType = provider || modelConfig?.provider || solutionPreset.provider;

    console.log(`[Seedance剧本优化] 方案: ${solutionType}, 提供商: ${providerType}, 模型: ${modelId}, 风格: ${styleConfig.name}`);

    // 生成提示词
    const systemPrompt = generateSeedanceSystemPrompt(styleType, modelId);
    const userPrompt = generateSeedanceUserPrompt(storySummary, styleType, additionalRequirements);

    // 根据提供商调用
    let responseContent: string;

    if (providerType === 'zhipu') {
      const userId = request.headers.get('x-user-id') || 'dev-user';
      const configured = await isZhipuConfiguredForUser(userId);
      
      if (!configured) {
        return NextResponse.json(
          { error: '智谱API未配置，请在方案设置中配置 API Key' },
          { status: 400 }
        );
      }

      const client = await getZhipuClientAsync(userId);
      const response = await client.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: modelId,
        temperature: 0.8,
        max_tokens: 8192,
      });

      responseContent = response.choices[0]?.message?.content || '';
    } else {
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new LLMClient(config, customHeaders);

      const response = await client.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: modelId,
        temperature: 0.8,
      });

      responseContent = response.content;
    }

    // 解析JSON
    let result;
    try {
      let content = responseContent.trim();
      
      // 移除markdown代码块标记
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        let jsonStr = content.slice(firstBrace, lastBrace + 1);
        jsonStr = jsonStr.replace(/[""]/g, '"');
        jsonStr = jsonStr.replace(/'/g, '"');
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (char) => {
          if (char === '\n' || char === '\t' || char === '\r') return char;
          return '';
        });
        
        try {
          result = JSON.parse(jsonStr);
        } catch {
          jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
          result = JSON.parse(jsonStr);
        }
      } else {
        throw new Error('无法提取JSON');
      }
    } catch (parseError) {
      console.error('[Seedance剧本优化] JSON解析失败:', parseError);
      return NextResponse.json(
        { error: '剧本生成失败：无法解析响应', rawContent: responseContent.substring(0, 500) },
        { status: 500 }
      );
    }

    // 验证并补全结构
    if (!result.videos || !Array.isArray(result.videos)) {
      result.videos = [];
    }

    // 补全videos
    if (result.videos.length > 0) {
      result.videos = result.videos.map((video: Record<string, unknown>, index: number) => {
        const dialogues = video.dialogues as Array<{ speaker: string; content: string }> || [];
        
        // 验证并限制duration在10-15秒范围内
        let duration = typeof video.duration === 'number' ? video.duration : 10;
        duration = Math.max(10, Math.min(15, Math.round(duration)));
        
        // 如果visualPrompt没有前缀，添加前缀和后缀
        let visualPrompt = video.visualPrompt as string || '';
        if (visualPrompt && !visualPrompt.startsWith(styleConfig.prefix)) {
          visualPrompt = `${styleConfig.prefix}，${visualPrompt}`;
          if (!visualPrompt.includes(styleConfig.suffix)) {
            visualPrompt = `${visualPrompt}，${styleConfig.suffix}`;
          }
        }
        
        return {
          id: `video_${index + 1}`,
          sequence: index + 1,
          name: video.name || `视频${index + 1}`,
          duration: duration,
          shotType: video.shotType || '综合运镜',
          characters: video.characters || [],
          scenes: video.scenes || [],
          dialogueCount: dialogues.length,
          dialogues: dialogues,
          visualPrompt: visualPrompt,
          mood: video.mood || '中性',
        };
      });
    }

    // 计算总时长（累加每个视频的实际时长）
    const totalDuration = result.videos.reduce(
      (sum: number, v: { duration: number }) => sum + (v.duration || 10), 
      0
    );
    result.totalDuration = totalDuration;
    result.videoCount = result.videos.length;

    // 统计总对话数
    const totalDialogues = result.videos.reduce(
      (sum: number, v: { dialogueCount?: number }) => sum + (v.dialogueCount || 0), 
      0
    );
    result.totalDialogues = totalDialogues;

    // 添加风格信息
    result.style = styleType;
    result.styleName = styleConfig.name;
    result.stylePrefix = styleConfig.prefix;
    result.styleSuffix = styleConfig.suffix;
    result.globalNegativePrompt = styleConfig.negativePrompt;

    // 添加模型信息
    result.llmModel = modelId;
    result.llmProvider = providerType;

    // 添加优化标记
    result.optimized = true;
    result.optimizedFor = 'seedance-1.5-pro-fast';

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Seedance剧本优化] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '剧本优化失败' },
      { status: 500 }
    );
  }
}
