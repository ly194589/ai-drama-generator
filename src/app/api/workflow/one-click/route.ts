import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, ImageGenerationClient, TTSClient, VideoGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import {
  SHOT_DURATION_RULES,
  STAGE_RATIOS,
  STORYBOARD_COUNT_RULES,
  PRESET_STYLES,
  PRESET_SCENES,
  buildUnifiedPrompt,
  type VisualStyle,
  type CharacterLock,
  type SceneDefinition,
} from '@/lib/script-types';

/**
 * 一键生成工作流API
 * 实现从剧本到视频的全流程自动化
 * 
 * 核心规则：
 * - 分镜数量：30-40个（最少30个）
 * - 每镜时长：固定12秒
 * - 总时长：300秒
 */

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 工作流步骤
const WORKFLOW_STEPS = [
  { id: 'script', name: '剧本生成', weight: 20 },
  { id: 'characters', name: '角色立绘', weight: 15 },
  { id: 'scenes', name: '场景图', weight: 10 },
  { id: 'storyboards', name: '分镜图', weight: 15 },
  { id: 'voices', name: '配音生成', weight: 15 },
  { id: 'videos', name: '视频生成', weight: 25 },
];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    seriesId,
    episodeNumber,
    options = {
      generateScript: true,
      generateCharacters: true,
      generateScenes: true,
      generateVoices: true,
      generateVideos: true,
    }
  } = body;

  const encoder = new TextEncoder();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (step: string, progress: number, message: string, data?: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          step,
          progress,
          message,
          data,
        })}\n\n`));
      };

      const sendError = (step: string, error: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          step,
          error,
        })}\n\n`));
      };

      const sendComplete = (result: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          result,
        })}\n\n`));
      };

      try {
        const supabase = getSupabaseClient();
        
        // 获取剧本信息
        const { data: series } = await supabase
          .from('drama_series')
          .select('*')
          .eq('id', seriesId)
          .single();

        if (!series) {
          sendError('init', '剧本不存在');
          controller.close();
          return;
        }

        sendProgress('init', 0, '开始一键生成流程...');

        // ============ 1. 剧本生成 ============
        if (options.generateScript) {
          sendProgress('script', 0, '正在生成分镜剧本...');
          
          const llmClient = new LLMClient(config, customHeaders);
          
          // 匹配视觉风格（支持部分匹配）
          const genreStr = series.genre as string;
          let style: VisualStyle;
          if (genreStr?.includes('古装') || genreStr?.includes('古风')) {
            style = PRESET_STYLES['ancient_beauty'];
          } else if (genreStr?.includes('仙侠') || genreStr?.includes('玄幻')) {
            style = PRESET_STYLES['fantasy_fairy'];
          } else if (genreStr?.includes('悬疑') || genreStr?.includes('推理')) {
            style = PRESET_STYLES['suspense_dark'];
          } else if (genreStr?.includes('甜宠') || genreStr?.includes('恋爱') || genreStr?.includes('言情')) {
            style = PRESET_STYLES['sweet_romance'];
          } else if (genreStr?.includes('都市') || genreStr?.includes('现代')) {
            style = PRESET_STYLES['urban_modern'];
          } else if (genreStr?.includes('职场') || genreStr?.includes('商战')) {
            style = PRESET_STYLES['workplace_elite'];
          } else {
            style = PRESET_STYLES['ancient_beauty']; // 默认：古风唯美
          }
          
          // 计算分镜数量（30-40个）
          const storyboardCount = Math.max(
            STORYBOARD_COUNT_RULES.minCount,
            Math.min(STORYBOARD_COUNT_RULES.maxCount, STORYBOARD_COUNT_RULES.calculateCount(135))
          );
          
          sendProgress('script', 10, `计划生成 ${storyboardCount} 个分镜...`);
          
          // 宠物风特殊规则
          const isPetGenre = (series.genre as string)?.includes('宠物') || (series.genre as string)?.includes('萌宠') || (series.genre as string)?.includes('动物');
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
          
          // 剧本生成提示词 - 使用新规则
          const scriptPrompt = `为短剧《${series.title}》生成第${episodeNumber}集的分镜剧本。
${petRules}
【核心规则 - 必须遵守】
- 分镜数量：恰好${storyboardCount}个，不能多也不能少
- 总时长：300秒
- 每镜时长：固定12秒
- 开篇钩子、核心分镜、结尾悬念：统一12秒

【题材信息】
题材：${series.genre}
风格：${series.style}
核心冲突：${series.core_conflict}
角色：${(series.characters as Array<Record<string, unknown>>)?.map(c => c.name).join('、') || '未设定'}

【统一性控制】
- 风格：${style.description}，${style.lighting}，${style.colorTone}色调
- 角色：外观必须保持一致，服装发型不变

【节奏分配】
- 钩子(8%)：快速抓住观众，特写/快切
- 冲突(17%)：引入矛盾，中景/近景
- 升温(25%)：矛盾升级，对话为主
- 高潮(25%)：冲突爆发，快切为主
- 反转(15%)：意外转折，特写/慢推
- 收尾(10%)：悬念结尾，中景/慢推

【对话规则】
- 每句对话不超过15字
- 口语化，符合角色性格
- 角色说话要快，不要拖沓

【每个分镜格式 - 顶配爆款版】
{
  "sequence": 1,
  "duration": 15,
  "scene": "大靖皇帝寝宫深夜，烛火昏暗摇曳，奏折狼藉满地，大殿压抑肃杀",
  "cameraMovement": "电影级特写运镜，侧逆光切割面部，强明暗对比，压迫感拉满",
  "action": "皇帝萧衍身着明黄龙袍，暴怒嘶吼着狠狠砸向传国玉玺，衣袖带风",
  "closeup": "碎裂玉玺碎片特写，萧衍眼神阴鸷狠戾，面部狰狞情绪炸裂",
  "style": "影视化写实，高质感古风宫廷，暗黑压抑，史诗氛围感",
  "bgmAtmosphere": "低沉弦乐+急促鼓点，紧张悬疑，帝王暴怒肃杀",
  "shotType": "特写",
  "stage": "钩子",
  "location": "皇帝寝宫",
  "characters": ["萧衍", "掌事太监"],
  "dialogues": [
    {"speaker": "萧衍", "content": "玉玺丢了！", "emotion": "暴怒"},
    {"speaker": "掌事太监", "content": "北境军反了！", "emotion": "惊恐"},
    {"speaker": "萧衍", "content": "沈砚，你好大的胆子！", "emotion": "愤怒嘶吼"},
    {"speaker": "萧衍", "content": "杀无赦！", "emotion": "暴怒"}
  ],
  "mood": "压抑肃杀",
  "emotion": "暴怒",
  "aspectRatio": "9:16",
  "isKeyframe": true
}

【输出JSON - 顶配爆款版】
{"title":"标题","summary":"4-6字总结","hook":{"scene":"大靖皇帝寝宫深夜，烛火昏暗摇曳，奏折狼藉满地，大殿压抑肃杀","cameraMovement":"电影级特写运镜，侧逆光切割面部，强明暗对比，压迫感拉满","action":"皇帝萧衍身着明黄龙袍，暴怒嘶吼着狠狠砸向传国玉玺，衣袖带风","closeup":"碎裂玉玺碎片特写，萧衍眼神阴鸷狠戾，面部狰狞情绪炸裂","style":"影视化写实，高质感古风宫廷，暗黑压抑，史诗氛围感","bgmAtmosphere":"低沉弦乐+急促鼓点，紧张悬疑，帝王暴怒肃杀","duration":15,"shotType":"特写","mood":"压抑肃杀","characters":["萧衍","掌事太监"],"dialogues":[{"speaker":"萧衍","content":"玉玺丢了！","emotion":"暴怒"},{"speaker":"掌事太监","content":"北境军反了！","emotion":"惊恐"},{"speaker":"萧衍","content":"沈砚，你好大的胆子！","emotion":"愤怒嘶吼"},{"speaker":"萧衍","content":"杀无赦！","emotion":"暴怒"}],"aspectRatio":"9:16"},"cliffhanger":{"scene":"悬崖边狂风呼啸，暴雨如注，生死一线的紧张时刻","cameraMovement":"电影级俯拍特写，从高空急速推近，画面剧烈晃动","action":"女主被逼至悬崖边缘，脚下碎石滚落，她回头望向远方","closeup":"女主眼角泪光与雨水交织特写，眼神从绝望转为决绝","style":"影视化写实，高质感古装仙侠，暴风雨夜景，史诗级画面张力","bgmAtmosphere":"激昂交响乐+悲壮弦乐，心跳加速，命运抉择的紧张氛围","duration":15,"shotType":"特写","mood":"悬念","characters":["女主","追兵"],"dialogues":[{"speaker":"女主","content":"既然如此...","emotion":"绝望"},{"speaker":"追兵","content":"抓住她！","emotion":"凶狠"},{"speaker":"女主","content":"那就一起死吧！","emotion":"决绝"},{"speaker":"旁白","content":"她的命运，下集揭晓...","emotion":"悬念"}],"aspectRatio":"9:16"},"storyboards":[...恰好${storyboardCount}个分镜...]}

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
- duration字段必须是阿拉伯数字15，禁止使用中文数字如"十二"`;

          const response = await llmClient.invoke([
            { 
              role: 'system', 
              content: `你是专业短剧编剧，必须严格按照规则生成剧本。

【必须遵守】
- 分镜数量：恰好${storyboardCount}个，不能多也不能少
- 每镜时长：固定12秒
- 对话：每句不超过15字

【顶配爆款版字段要求 - 必须生成】
每个分镜必须包含以下字段：
- scene: 完整场景描述（如"大靖皇帝寝宫深夜，烛火昏暗摇曳，奏折狼藉满地"）
- cameraMovement: 电影级运镜（如"电影级特写运镜，侧逆光切割面部，强明暗对比"）
- action: 详细动作描述（如"暴怒嘶吼着狠狠砸向传国玉玺，衣袖带风"）
- closeup: 特写细节（如"碎裂玉玺碎片特写，眼神阴鸷狠戾，面部狰狞"）
- style: 视觉风格（如"影视化写实，高质感古风宫廷，暗黑压抑"）
- bgmAtmosphere: BGM氛围（如"低沉弦乐+急促鼓点，紧张悬疑"）
- dialogues: 对话数组，每个分镜至少4句对话
- duration: 固定15
- aspectRatio: 固定"9:16"

【区分dialogue和narration】
- dialogue：角色说的话，需要标注说话人
- narration：旁白/画外音，角色不会说这些话
- 不要把旁白写在dialogue里` 
            },
            { role: 'user', content: scriptPrompt }
          ], {
            model: 'doubao-seed-2-0-pro-260215',
            temperature: 0.7,
          });

          let episodeData: Record<string, unknown> = {};
          try {
            const content = response.content || '';
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              episodeData = JSON.parse(content.substring(firstBrace, lastBrace + 1));
              
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
            console.error('剧本解析失败:', e);
          }

          // 保存剧集
          const { data: savedEpisode } = await supabase
            .from('drama_episodes')
            .upsert({
              series_id: seriesId,
              episode_number: episodeNumber,
              title: (episodeData.title as string) || `第${episodeNumber}集`,
              summary: episodeData.summary as string,
              hook: typeof episodeData.hook === 'object' ? JSON.stringify(episodeData.hook) : (episodeData.hook as string),
              cliffhanger: typeof episodeData.cliffhanger === 'object' ? JSON.stringify(episodeData.cliffhanger) : (episodeData.cliffhanger as string),
              storyboards: episodeData.storyboards,
              status: 'completed',
            })
            .select()
            .single();

          sendProgress('script', 100, '剧本生成完成', savedEpisode);
        }

        // ============ 2. 角色立绘生成 ============
        if (options.generateCharacters) {
          sendProgress('characters', 0, '正在生成角色立绘...');
          
          const imageClient = new ImageGenerationClient(config, customHeaders);
          const characters = series.characters as Array<Record<string, unknown>> || [];
          const characterImages: Array<{ name: string; url: string }> = [];

          const style = `${series.style || '现代'}-${series.genre || '都市'}`;
          
          for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const progress = Math.round((i / characters.length) * 100);
            sendProgress('characters', progress, `生成角色立绘: ${char.name}`);

            // 写实风格强制要求（英文）
            const realisticPrefix = 'photorealistic, realistic photography, real person, ';
            const realisticSuffix = ', NO anime, NO cartoon, NO illustration style, professional photography quality';
            
            const prompt = `${realisticPrefix}${style} drama character portrait, ${char.gender === 'male' ? 'Male' : 'Female'}, ${char.age || 25} years old, ${char.temperament || ''}, ${char.clothing || 'modern clothing'}, cinematic lighting, 8K quality${realisticSuffix}`;

            const response = await imageClient.generate({
              prompt,
              size: '4K',
              watermark: false,
            });
            const helper = imageClient.getResponseHelper(response);

            if (helper.success && helper.imageUrls.length > 0) {
              characterImages.push({
                name: char.name as string,
                url: helper.imageUrls[0],
              });
            }
          }

          sendProgress('characters', 100, '角色立绘生成完成', characterImages);
        }

        // ============ 3. 场景图生成 ============
        if (options.generateScenes) {
          sendProgress('scenes', 0, '正在生成场景图...');
          
          const imageClient = new ImageGenerationClient(config, customHeaders);
          const sceneImages: Array<{ name: string; url: string }> = [];

          // 获取剧集的场景列表
          const { data: episode } = await supabase
            .from('drama_episodes')
            .select('storyboards')
            .eq('series_id', seriesId)
            .eq('episode_number', episodeNumber)
            .single();

          const storyboards = (episode?.storyboards as Array<Record<string, unknown>>) || [];
          const scenes = new Set<string>();

          storyboards.forEach(sb => {
            const scene = sb.scene as Record<string, unknown>;
            if (scene?.location) {
              scenes.add(scene.location as string);
            }
          });

          const sceneList = Array.from(scenes).slice(0, 5); // 最多生成5个场景
          const style = `${series.style || '现代'}`;

          for (let i = 0; i < sceneList.length; i++) {
            const sceneName = sceneList[i];
            const progress = Math.round((i / sceneList.length) * 100);
            sendProgress('scenes', progress, `生成场景: ${sceneName}`);

            // 写实风格强制要求（英文）
            const realisticPrefix = 'photorealistic, realistic photography, real environment, ';
            const realisticSuffix = ', NO anime, NO cartoon, NO illustration style, professional photography quality';
            
            const prompt = `${realisticPrefix}${style} drama scene, ${sceneName}, cinematic lighting, detailed environment, 8K quality${realisticSuffix}`;

            const response = await imageClient.generate({
              prompt,
              size: '4K',
              watermark: false,
            });
            const helper = imageClient.getResponseHelper(response);

            if (helper.success && helper.imageUrls.length > 0) {
              sceneImages.push({
                name: sceneName,
                url: helper.imageUrls[0],
              });
            }
          }

          sendProgress('scenes', 100, '场景图生成完成', sceneImages);
        }

        // ============ 4. 配音生成 ============
        if (options.generateVoices) {
          sendProgress('voices', 0, '正在生成配音...');
          
          const ttsClient = new TTSClient(config, customHeaders);
          const dialogueVoices: Array<{ type: 'dialogue'; speaker: string; content: string; url: string }> = [];
          const narrationVoices: Array<{ type: 'narration'; content: string; url: string }> = [];

          // 获取剧集的分镜
          const { data: episode } = await supabase
            .from('drama_episodes')
            .select('storyboards')
            .eq('series_id', seriesId)
            .eq('episode_number', episodeNumber)
            .single();

          const storyboards = (episode?.storyboards as Array<Record<string, unknown>>) || [];
          
          // 收集角色对话
          const dialogues: Array<{ speaker: string; content: string; emotion: string }> = [];
          // 收集旁白
          const narrations: Array<{ content: string }> = [];

          storyboards.forEach(sb => {
            // 处理角色对话（新格式是数组）
            const dialogue = sb.dialogue as Array<{speaker: string; content: string}> | undefined;
            if (Array.isArray(dialogue)) {
              dialogue.forEach(d => {
                dialogues.push({
                  speaker: d.speaker,
                  content: d.content,
                  emotion: '平静',
                });
              });
            }
            
            // 处理旁白
            const narration = sb.narration as string;
            if (narration && narration.trim()) {
              narrations.push({ content: narration.trim() });
            }
          });

          const characters = series.characters as Array<Record<string, unknown>> || [];
          const characterMap = new Map(characters.map(c => [c.name, c]));

          // 生成角色对话配音
          for (let i = 0; i < Math.min(dialogues.length, 10); i++) {
            const dialogue = dialogues[i];
            const progress = Math.round((i / Math.min(dialogues.length, 10)) * 50);
            sendProgress('voices', progress, `生成角色配音: ${dialogue.speaker}`);

            const char = characterMap.get(dialogue.speaker) as Record<string, unknown> || {};
            
            // 根据角色性别选择配音员
            const speaker = char.gender === 'male' 
              ? 'zh_male_m191_uranus_bigtts' 
              : 'zh_female_xiaohe_uranus_bigtts';

            const response = await ttsClient.synthesize({
              uid: `user-${Date.now()}`,
              text: dialogue.content,
              speaker,
              audioFormat: 'mp3',
              sampleRate: 48000, // 最高质量
            });

            if (response.audioUri) {
              dialogueVoices.push({
                type: 'dialogue',
                speaker: dialogue.speaker,
                content: dialogue.content,
                url: response.audioUri,
              });
            }
          }

          // 生成旁白配音（使用专业的旁白配音员）
          const narratorSpeaker = 'zh_male_m191_uranus_bigtts'; // 可配置的旁白配音员
          for (let i = 0; i < Math.min(narrations.length, 10); i++) {
            const narration = narrations[i];
            const progress = 50 + Math.round((i / Math.min(narrations.length, 10)) * 50);
            sendProgress('voices', progress, `生成旁白配音 ${i + 1}/${Math.min(narrations.length, 10)}`);

            const response = await ttsClient.synthesize({
              uid: `user-${Date.now()}`,
              text: narration.content,
              speaker: narratorSpeaker,
              audioFormat: 'mp3',
              sampleRate: 48000, // 最高质量
            });

            if (response.audioUri) {
              narrationVoices.push({
                type: 'narration',
                content: narration.content,
                url: response.audioUri,
              });
            }
          }

          const voices = { dialogues: dialogueVoices, narrations: narrationVoices };

          sendProgress('voices', 100, '配音生成完成', voices);
        }

        // ============ 5. 视频生成 ============
        if (options.generateVideos) {
          sendProgress('videos', 0, '正在生成视频...');
          
          const videoClient = new VideoGenerationClient(config, customHeaders);
          const videos: Array<{ name: string; url: string }> = [];

          // 获取剧集的分镜
          const { data: episode } = await supabase
            .from('drama_episodes')
            .select('storyboards, hook, cliffhanger')
            .eq('series_id', seriesId)
            .eq('episode_number', episodeNumber)
            .single();

          if (!episode) {
            sendError('videos', '剧集不存在');
          } else {
            const storyboards = (episode.storyboards as Array<Record<string, unknown>>) || [];
            const totalShots = storyboards.length;

            // 生成开场钩子视频
            if (episode.hook) {
              sendProgress('videos', 5, '生成开场钩子视频...');
              
              const response = await videoClient.videoGeneration(
                [{ type: 'text', text: `${series.style}${series.genre}短剧开场：${episode.hook}，悬念开场，紧张氛围` }],
                {
                  model: 'doubao-seedance-2-0-260128',
                  duration: 8,
                  ratio: '16:9',
                  resolution: '1080p',
                  generateAudio: true, // 视频生成时带声音
                  maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
                }
              );

              if (response.videoUrl) {
                videos.push({ name: '开场钩子', url: response.videoUrl });
              }
              
              // 延迟避免频率限制
              await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // 生成所有镜头视频（不再限制数量）
            sendProgress('videos', 10, `准备生成 ${totalShots} 个镜头视频...`);

            // 分批处理，每批2个
            const batchSize = 2;
            for (let batchStart = 0; batchStart < totalShots; batchStart += batchSize) {
              const batchEnd = Math.min(batchStart + batchSize, totalShots);
              const batch = storyboards.slice(batchStart, batchEnd);
              
              const progress = 10 + Math.round((batchStart / totalShots) * 75);
              sendProgress('videos', progress, `生成镜头 ${batchStart + 1}-${batchEnd}/${totalShots}...`);

              for (let i = 0; i < batch.length; i++) {
                const shot = batch[i];
                const shotIndex = batchStart + i;

                const scene = shot.scene as Record<string, unknown>;
                const visualDesc = shot.visualDescription as string || '';
                const dialogue = shot.dialogue as Array<{speaker: string; content: string}> | undefined;
                const narration = shot.narration as string || '';
                
                // 构建视频提示词：包含画面描述和对话内容
                // Seedance 1.5 pro 要求：对话内容用双引号包裹以优化音频生成效果
                let videoPrompt = `${series.style}${series.genre}短剧，${scene?.location || '室内'}，${visualDesc}`;
                
                if (dialogue && dialogue.length > 0) {
                  // 直接包含对话内容，让AI生成对应音频
                  // 对话内容用双引号包裹，Seedance 1.5 pro 会自动生成对应的人声和口型
                  const dialogueText = dialogue.map(d => `${d.speaker}说："${d.content}"`).join('，');
                  videoPrompt += `，${dialogueText}`;
                }
                
                if (narration) {
                  // 旁白：明确标注画外音，Seedance 1.5 pro 会生成画外音音频
                  // 镜头人物不会有说话动作
                  videoPrompt += `。旁白(画外音)说："${narration}"`;
                }

                try {
                  const response = await videoClient.videoGeneration(
                    [{ type: 'text', text: videoPrompt.substring(0, 2000) }],
                    {
                      model: 'doubao-seedance-2-0-260128',
                      duration: 5,
                      ratio: '16:9',
                      resolution: '1080p',
                      generateAudio: true, // 视频生成时带声音
                      maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
                    }
                  );

                  if (response.videoUrl) {
                    videos.push({ name: `镜头${shotIndex + 1}`, url: response.videoUrl });
                  }
                } catch (e) {
                  console.error(`镜头${shotIndex + 1}生成失败:`, e);
                  // 继续生成其他镜头
                }

                // 镜头间延迟
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }

            // 生成结尾悬念视频
            if (episode.cliffhanger) {
              sendProgress('videos', 90, '生成结尾悬念视频...');
              
              const response = await videoClient.videoGeneration(
                [{ type: 'text', text: `${series.style}${series.genre}短剧结尾：${episode.cliffhanger}，悬念定格，紧张氛围` }],
                {
                  model: 'doubao-seedance-2-0-260128',
                  duration: 8,
                  ratio: '16:9',
                  resolution: '1080p',
                  generateAudio: false,
                  maxWaitTime: 5 * 60 * 1000, // 设置最大等待时间为5分钟，避免超时
                }
              );

              if (response.videoUrl) {
                videos.push({ name: '结尾悬念', url: response.videoUrl });
              }
            }

            sendProgress('videos', 100, `视频生成完成，共 ${videos.length} 个镜头`, videos);
          }
        }

        // 完成
        sendComplete({
          seriesId,
          episodeNumber,
          message: '一键生成完成！',
        });

      } catch (error) {
        console.error('工作流执行失败:', error);
        sendError('workflow', error instanceof Error ? error.message : '生成失败');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
