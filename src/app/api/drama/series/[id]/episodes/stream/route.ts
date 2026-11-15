import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import {
  STORYBOARD_COUNT_RULES,
  PRESET_STYLES,
  VisualStyle,
} from '@/lib/script-types';

/**
 * 流式剧集生成API
 * 使用thinking模式进行深度创作，实时输出进度
 * 
 * 核心规则：
 * - 分镜数量：30-40个（最少30个）
 * - 每镜时长：固定12秒
 * - 总时长：300秒
 */

// 计算分镜数量
function calculateStoryboardCount(): number {
  return Math.max(
    STORYBOARD_COUNT_RULES.minCount,
    Math.min(STORYBOARD_COUNT_RULES.maxCount, STORYBOARD_COUNT_RULES.calculateCount(135))
  );
}

// 简化的创作提示词模板
function generateEpisodePrompt(
  title: string,
  genre: string,
  style: string,
  coreConflict: string,
  charactersDesc: string,
  previousEpisodeContext: string,
  episodeNumber: number
): string {
  const storyboardCount = calculateStoryboardCount();
  
  // 匹配视觉风格（支持部分匹配）
  let visualStyle: VisualStyle;
  if (genre?.includes('古装') || genre?.includes('古风')) {
    visualStyle = PRESET_STYLES['ancient_beauty'];
  } else if (genre?.includes('仙侠') || genre?.includes('玄幻')) {
    visualStyle = PRESET_STYLES['fantasy_fairy'];
  } else if (genre?.includes('悬疑') || genre?.includes('推理')) {
    visualStyle = PRESET_STYLES['suspense_dark'];
  } else if (genre?.includes('甜宠') || genre?.includes('恋爱') || genre?.includes('言情')) {
    visualStyle = PRESET_STYLES['sweet_romance'];
  } else if (genre?.includes('都市') || genre?.includes('现代')) {
    visualStyle = PRESET_STYLES['urban_modern'];
  } else if (genre?.includes('职场') || genre?.includes('商战')) {
    visualStyle = PRESET_STYLES['workplace_elite'];
  } else {
    visualStyle = PRESET_STYLES['ancient_beauty']; // 默认：古风唯美
  }
  
  // 宠物风特殊规则
  const isPetGenre = genre?.includes('宠物') || genre?.includes('萌宠') || genre?.includes('动物');
  const petRules = isPetGenre ? `
【宠物风特殊规则 - 必须严格遵守】
1. 角色全部是宠物（猫、狗、仓鼠、兔子等），绝不能出现人类
2. 画面中禁止出现人的任何部位：不要出现人手、人脚、人脸、人影
3. 所有动作由宠物完成：宠物用爪子拿东西、宠物用嘴叼东西、宠物之间互动
4. 场景完全宠物化：宠物客厅、宠物卧室、宠物医院、宠物公园等
5. 对话是正常人的语言：宠物之间用人类的语言交流，但画面中只有宠物
6. 视觉描述只描写宠物：如"橘猫抬头望着窗外"、"小狗摇着尾巴走过来"
7. 禁止人类介入：不要出现"主人喂食"、"主人抚摸"、"主人的手"等描述
8. 宠物表情丰富：通过耳朵、尾巴、眼睛表达情绪，如"耳朵耷拉下来"、"尾巴兴奋地摇摆"
` : '';
  
  return `你是专业的抖音短剧编剧。请为以下剧本生成第${episodeNumber}集的完整分镜剧本。
${petRules}
【核心规则 - 必须遵守】
- 分镜数量：恰好${storyboardCount}个，不能多也不能少
- 总时长：300秒
- 每镜时长：固定12秒
- 开篇钩子、核心分镜、结尾悬念：统一12秒

【剧本信息】
- 标题：${title}
- 题材：${genre}
- 风格：${style}
- 核心冲突：${coreConflict}

【统一性控制】
- 视觉风格：${visualStyle.description}，${visualStyle.lighting}，${visualStyle.colorTone}色调
- 角色：外观必须保持一致，服装发型不变

【角色档案】
${charactersDesc}

${previousEpisodeContext}

【节奏分配】
- 钩子(8%, ~3个分镜)：快速抓住观众，特写/快切
- 冲突(17%, ~5个分镜)：引入矛盾，中景/近景
- 升温(25%, ~8个分镜)：矛盾升级，对话为主
- 高潮(25%, ~8个分镜)：冲突爆发，快切为主
- 反转(15%, ~4个分镜)：意外转折，特写/慢推
- 收尾(10%, ~4个分镜)：悬念结尾，中景/慢推

【对话规则】
- 每句对话不超过15字
- 口语化，符合角色性格
- 角色说话要快，不要拖沓

【输出格式 - 顶配爆款版】
严格输出JSON格式：
{
  "title": "本集标题",
  "summary": "4-6字总结",
  "hook": {
    "scene": "大靖皇帝寝宫深夜，烛火昏暗摇曳，奏折狼藉满地，大殿压抑肃杀",
    "cameraMovement": "电影级特写运镜，侧逆光切割面部，强明暗对比，压迫感拉满",
    "action": "皇帝萧衍身着明黄龙袍，暴怒嘶吼着狠狠砸向传国玉玺，衣袖带风",
    "closeup": "碎裂玉玺碎片特写，萧衍眼神阴鸷狠戾，面部狰狞情绪炸裂",
    "style": "影视化写实，高质感古风宫廷，暗黑压抑，史诗氛围感",
    "bgmAtmosphere": "低沉弦乐+急促鼓点，紧张悬疑，帝王暴怒肃杀",
    "duration": 15,
    "shotType": "特写",
    "mood": "压抑肃杀",
    "characters": ["萧衍", "掌事太监"],
    "dialogues": [
      {"speaker": "萧衍", "content": "玉玺丢了！", "emotion": "暴怒"},
      {"speaker": "掌事太监", "content": "北境军反了！", "emotion": "惊恐"},
      {"speaker": "萧衍", "content": "沈砚，你好大的胆子！", "emotion": "愤怒嘶吼"},
      {"speaker": "萧衍", "content": "杀无赦！", "emotion": "暴怒"}
    ],
    "aspectRatio": "9:16"
  },
  "cliffhanger": {
    "scene": "悬崖边狂风呼啸，暴雨如注，生死一线的紧张时刻",
    "cameraMovement": "电影级俯拍特写，从高空急速推近，画面剧烈晃动",
    "action": "女主被逼至悬崖边缘，脚下碎石滚落，她回头望向远方",
    "closeup": "女主眼角泪光与雨水交织特写，眼神从绝望转为决绝",
    "style": "影视化写实，高质感古装仙侠，暴风雨夜景，史诗级画面张力",
    "bgmAtmosphere": "激昂交响乐+悲壮弦乐，心跳加速，命运抉择的紧张氛围",
    "duration": 15,
    "shotType": "特写",
    "mood": "悬念",
    "characters": ["女主", "追兵"],
    "dialogues": [
      {"speaker": "女主", "content": "既然如此...", "emotion": "绝望"},
      {"speaker": "追兵", "content": "抓住她！", "emotion": "凶狠"},
      {"speaker": "女主", "content": "那就一起死吧！", "emotion": "决绝"},
      {"speaker": "旁白", "content": "她的命运，下集揭晓...", "emotion": "悬念"}
    ],
    "aspectRatio": "9:16"
  },
  "storyboards": [...]
}

【开篇钩子(hook)内容规则 - 必须严格遵循】
hook是独立于storyboards的开场钩子，内容必须：
1. 黄金3秒法则：开场画面必须在3秒内抓住观众眼球
2. 视觉冲击：使用特写或大特写，突出关键道具、伤口、眼泪、眼神等
3. 悬念开场：从故事中间切入(in media res)，直接展示冲突或危机时刻
4. 禁止平铺直叙：不要从"平静的早晨"开始，要从"刀架在脖子上"开始
5. 固定时长：12秒，如果有一句台词必须在15字以内
6. 【⚠️避免重复】这是独立镜头，展示最震撼的瞬间，不要与storyboards[0]内容相同
7. 示例场景：主角倒在血泊中、被逼到悬崖边、发现惊天秘密、婚礼现场被闯入等

【结尾悬念(cliffhanger)内容规则 - 必须严格遵循】
cliffhanger是独立于storyboards的结尾悬念，内容必须：
1. 悬念制造：留下一个让观众迫不及待看下一集的悬念
2. 伏笔埋设：暗示下一集会发生的关键事件
3. 情绪高潮：在情绪最紧张时戛然而止
4. 画面定格：在关键画面（如转身、发现、决定）处定格
5. 固定时长：12秒，如果有一句台词必须在15字以内
6. 【⚠️避免重复】这是独立镜头，展示全新的悬念转折，不要与最后一个storyboard内容相同
7. 示例场景：发现背叛、隐藏身份曝光、生死未卜、关键选择、神秘人物出现等

【hook和cliffhanger对象格式规则 - 顶配爆款版】
- hook必须包含：scene, cameraMovement, action, closeup, style, bgmAtmosphere, duration(数字15), shotType, mood, characters, dialogues(数组), aspectRatio
- cliffhanger必须包含：scene, cameraMovement, action, closeup, style, bgmAtmosphere, duration(数字15), shotType, mood, characters, dialogues(数组), aspectRatio
- dialogues格式：[{"speaker":"角色名","content":"台词(≤15字)","emotion":"情绪"}]，每个分镜至少4句对话
- scene: 完整场景描述（时间+地点+环境+氛围）
- cameraMovement: 电影级运镜描述
- action: 详细动作描述
- closeup: 特写细节和情绪爆发点
- style: 视觉风格描述
- bgmAtmosphere: BGM氛围描述

【重要规则 - duration必须是数字】
- duration字段必须是阿拉伯数字，如8、6、10，禁止使用中文数字如"八"、"六"`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { episodeNumber } = body;

  // 获取剧本信息
  const supabase = getSupabaseClient();
  const { data: series } = await supabase
    .from('drama_series')
    .select('*')
    .eq('id', id)
    .single();

  if (!series) {
    return new Response(JSON.stringify({ error: '剧本不存在' }), { status: 404 });
  }

  // 获取上一集信息
  let previousEpisodeContext = '';
  if (episodeNumber > 1) {
    const { data: prevEpisode } = await supabase
      .from('drama_episodes')
      .select('title, summary, cliffhanger')
      .eq('series_id', id)
      .eq('episode_number', episodeNumber - 1)
      .single();
    
    if (prevEpisode) {
      previousEpisodeContext = `【上一集回顾】
标题：${prevEpisode.title}
概要：${prevEpisode.summary}
结尾悬念：${prevEpisode.cliffhanger}

本集开场必须承接上一集的结尾悬念！`;
    }
  }

  // 构建角色描述
  const charactersDesc = (series.characters as Array<Record<string, unknown>> || [])
    .map(char => `- ${char.name}：${char.gender === 'male' ? '男' : '女'}，${char.age || '未知'}岁，${char.temperament || ''}`)
    .join('\n');

  // 构建提示词
  const prompt = generateEpisodePrompt(
    series.title || '未命名剧本',
    series.genre || '都市情感',
    series.style || '现代',
    series.core_conflict || '未指定',
    charactersDesc || '暂无角色',
    previousEpisodeContext,
    episodeNumber
  );

  // 创建流式响应
  const encoder = new TextEncoder();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const llmClient = new LLMClient(config, customHeaders);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 发送开始信号
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', message: '开始生成剧本...' })}\n\n`));

        // 使用流式生成
        const storyboardCount = calculateStoryboardCount();
        const genre = series.genre || '都市情感';
        const isPetGenre = genre?.includes('宠物') || genre?.includes('萌宠') || genre?.includes('动物');
        const petSystemRules = isPetGenre ? `
【宠物风规则】角色全是宠物，禁止出现人类。对话用人类语言，画面只有宠物。` : '';
        
        const llmStream = llmClient.stream([
          { 
            role: 'system', 
            content: `你是专业的抖音短剧编剧，精通AI短剧创作。
${petSystemRules}
【必须遵守】
- 分镜数量：恰好${storyboardCount}个，不能多也不能少
- 每镜时长：固定12秒
- 对话：每句不超过15字
- 输出必须是严格的JSON格式` 
          },
          { role: 'user', content: prompt }
        ], {
          model: 'doubao-seed-2-0-pro-260215', // 使用旗舰模型
          temperature: 0.7,
          thinking: 'enabled', // 启用thinking模式进行深度创作
        });

        let fullContent = '';
        
        for await (const chunk of llmStream) {
          if (chunk.content) {
            const text = chunk.content.toString();
            fullContent += text;
            
            // 发送进度
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'chunk', 
              content: text,
              length: fullContent.length 
            })}\n\n`));
          }
        }

        // 解析JSON
        let episodeData: Record<string, unknown> = {};
        try {
          const firstBrace = fullContent.indexOf('{');
          const lastBrace = fullContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            const jsonStr = fullContent.substring(firstBrace, lastBrace + 1);
            episodeData = JSON.parse(jsonStr);
            
            // 清理错误格式：过滤 File: 和 URL: 格式
            function cleanFieldValue(value: unknown): unknown {
              if (typeof value === 'string') {
                let cleaned = value.replace(/File:\s*\[[^\]]*\]/gi, '').trim();
                cleaned = cleaned.replace(/URL:\s*\[[^\]]*\]/gi, '').trim();
                cleaned = cleaned.replace(/^[,，、;；\s]+|[,，、;；\s]+$/g, '').trim();
                return cleaned;
              }
              if (Array.isArray(value)) {
                return value.map(cleanFieldValue);
              }
              if (typeof value === 'object' && value !== null) {
                const cleaned: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(value)) {
                  cleaned[k] = cleanFieldValue(v);
                }
                return cleaned;
              }
              return value;
            }
            episodeData = cleanFieldValue(episodeData) as Record<string, unknown>;
          }
        } catch (e) {
          console.error('JSON解析失败:', e);
          episodeData = { rawContent: fullContent };
        }

        // 保存到数据库
        const { data: savedEpisode, error } = await supabase
          .from('drama_episodes')
          .insert({
            series_id: id,
            episode_number: episodeNumber,
            title: (episodeData.title as string) || `第${episodeNumber}集`,
            summary: episodeData.summary as string,
            hook: typeof episodeData.hook === 'object' ? JSON.stringify(episodeData.hook) : (episodeData.hook as string),
            cliffhanger: typeof episodeData.cliffhanger === 'object' ? JSON.stringify(episodeData.cliffhanger) : (episodeData.cliffhanger as string),
            storyboards: episodeData.storyboards,
            dialogues: episodeData.dialogues,
            scenes: episodeData.scenes,
            status: 'completed',
          })
          .select()
          .single();

        if (error) {
          console.error('保存剧集失败:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: '保存失败' })}\n\n`));
        } else {
          // 发送完成信号
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete', 
            episode: savedEpisode,
            message: '剧本生成完成！'
          })}\n\n`));
        }

      } catch (error) {
        console.error('生成失败:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : '生成失败' 
        })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
