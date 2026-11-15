'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit,
  Play,
  Loader2,
  CheckCircle2,
  FileText,
  Layers,
  Film,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Clock,
  Users,
  Music,
  Swords,
  UsersRound,
  Heart,
  Shield,
  Zap,
  Eye,
  X,
  Minus,
  Maximize2,
  Video,
  Download,
  Image as ImageIcon,
  MapPin,
  User,
  Search,
  Palette,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildCinematicVideoPrompt } from '@/lib/video-prompt-enhancer';

// ==================== 后台生成任务工具 ====================
// 立绘/视频生成走后台任务模式：后端创建任务后立即返回，生成在后端继续执行，
// 切换页面不影响生成进度；前端轮询任务状态直到完成（结果结构与直接调用原 API 完全一致）。

const ACTIVE_TASKS_KEY = 'active_generation_tasks';

interface ActiveTaskRecord {
  taskId: string;
  seriesId: string;
  startedAt: number;
}

function readActiveTasks(): Record<string, ActiveTaskRecord> {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_TASKS_KEY) || '{}');
  } catch {
    return {};
  }
}

function markActiveTask(type: string, taskId: string, seriesId: string): void {
  const tasks = readActiveTasks();
  tasks[type] = { taskId, seriesId, startedAt: Date.now() };
  localStorage.setItem(ACTIVE_TASKS_KEY, JSON.stringify(tasks));
}

function clearActiveTask(type: string): void {
  const tasks = readActiveTasks();
  delete tasks[type];
  localStorage.setItem(ACTIVE_TASKS_KEY, JSON.stringify(tasks));
}

function getCurrentUserId(): string {
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return user?.id || 'dev-user';
  } catch {
    return 'dev-user';
  }
}

/**
 * 后台任务版 fetch：创建任务后轮询至完成，返回与原 API 一致的 Response 结构。
 * 页面切换后轮询停止，但任务在后端继续执行；返回页面后由恢复机制接管。
 */
async function runGenerationTaskFetch(
  type: 'artwork' | 'video',
  seriesId: string,
  init: { body?: string; headers?: Record<string, string>; signal?: AbortSignal },
): Promise<Response> {
  const currentUserId = getCurrentUserId();
  let payload: Record<string, unknown> = {};
  try {
    payload = init.body ? JSON.parse(init.body) : {};
  } catch {
    payload = {};
  }

  // 1. 尝试后台任务模式
  try {
    const res = await fetch('/api/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ type, seriesId, payload }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.taskId) {
        const taskId = data.taskId as string;
        markActiveTask(type, taskId, seriesId);
        const startedAt = Date.now();
        // 轮询任务状态（最长 12 分钟）
        while (Date.now() - startedAt < 12 * 60 * 1000) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          try {
            const poll = await fetch(`/api/generations?ids=${taskId}`, {
              headers: { 'x-user-id': currentUserId },
            });
            const pollData = await poll.json();
            const task = (pollData.tasks as Array<{ status: string; result: Record<string, unknown> | null; error: string | null }>)[0];
            if (!task) continue;
            if (task.status === 'completed') {
              clearActiveTask(type);
              return {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: { get: () => 'application/json' },
                json: async () => (task.result || { success: true }) as Record<string, unknown>,
                text: async () => JSON.stringify(task.result || { success: true }),
              } as unknown as Response;
            }
            if (task.status === 'failed') {
              clearActiveTask(type);
              return {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: { get: () => 'application/json' },
                json: async () => ({ success: false, error: task.error || '生成失败' }),
                text: async () => JSON.stringify({ success: false, error: task.error || '生成失败' }),
              } as unknown as Response;
            }
          } catch {
            // 网络抖动，继续轮询
          }
        }
        // 轮询超时：任务可能仍在后端执行，回退同步调用
        clearActiveTask(type);
      }
    }
  } catch {
    // 后台任务 API 不可用，回退同步调用
  }

  // 2. 同步回退：直接调用原 API（保持旧行为）
  const endpoint = type === 'artwork' ? `/api/drama/series/${seriesId}/artwork` : '/api/videos/generate';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: init.headers || { 'Content-Type': 'application/json' },
    body: init.body,
  });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: { get: (key: string) => response.headers.get(key) },
    json: () => response.json(),
    text: () => response.text(),
  } as unknown as Response;
}

// 视频模型最大时长配置（秒）
const VIDEO_MODEL_MAX_DURATION: Record<string, number> = {
  // Seedance 2.0：最大支持15秒
  'doubao-seedance-2-0-260128': 15,
  // 其他模型默认15秒（Seedance 2.0 已全量启用）
};

// 获取视频模型的最大时长
function getVideoModelMaxDuration(videoModel?: string): number {
  if (!videoModel) return 15; // 默认15秒（Seedance 2.0 已全量启用）
  return VIDEO_MODEL_MAX_DURATION[videoModel] || 15;
}

// 解析 scene 字符串（支持 @场景名,描述 格式）
function parseSceneInfo(sceneData: string | { location?: string; description?: string } | undefined): { location: string; description: string } {
  if (!sceneData) return { location: '', description: '' };
  
  if (typeof sceneData === 'object') {
    return {
      location: sceneData.location || '',
      description: sceneData.description || ''
    };
  }
  
  // 解析 @场景名,描述 格式
  const sceneStr = String(sceneData);
  const atIndex = sceneStr.indexOf('@');
  const commaIndex = sceneStr.indexOf(',');
  
  if (atIndex !== -1 && commaIndex !== -1 && commaIndex > atIndex) {
    // 格式：@场景名,描述
    const location = sceneStr.substring(atIndex + 1, commaIndex).trim();
    const description = sceneStr.substring(commaIndex + 1).trim();
    return { location, description };
  } else if (commaIndex !== -1) {
    // 格式：场景名,描述（无@前缀）
    const location = sceneStr.substring(0, commaIndex).trim();
    const description = sceneStr.substring(commaIndex + 1).trim();
    return { location, description };
  }
  
  // 纯描述字符串
  return { location: '', description: sceneStr };
}

// 时间点分镜描述
interface TimeShot {
  timeRange: string;       // 如 "0-3s"
  shotType: string;       // 如 "全景"、"中景"、"近景"、"特写"
  visualDescription: string; // 画面描述（不含对话）
  dialogue?: {
    speaker: string;
    content: string;
    voicePrompt?: string;  // 音色描述，如"女声，青年音色，音调尖锐"
  };
}

// 解析时间点描述文本，提取分镜信息
// 格式示例：0-3s：【全景】青云门斩仙台，... 沈灵月说："偷了魔教至宝！"
function parseTimeDescriptions(text: string): TimeShot[] {
  if (!text) return [];
  
  const shots: TimeShot[] = [];
  
  // 按行分割时间点描述
  const lines = text.split(/\n/).map(s => s.trim()).filter(s => s);
  
  for (const line of lines) {
    // 匹配时间点和内容：支持 "0-3s：【全景】内容" 或 "0-3s:[特写]内容" 两种格式
    const headerMatch = line.match(/^(\d+-\d+s)[\s：:]*[【\[]([^】\]\s]+)[】\]]?(.*)$/);
    if (!headerMatch) continue;
    
    const timeRange = headerMatch[1];
    const shotType = headerMatch[2];
    const content = headerMatch[3].trim();
    
    let dialogue: TimeShot['dialogue'] | undefined;
    let visualDesc = content;
    
    // 1. 提取对话：支持多种引号格式
    // 匹配 "说：" 或 '说：' 后面的对话内容
    // 支持格式：说："内容"、说：'内容'、说："内容..."
    const dialoguePattern = /(?:[@\u4e00-\u9fa5]+[^，,。.]*)?说[：:]["'"]([^"']+)["']/;
    const dialogueMatch = content.match(dialoguePattern);
    
    if (dialogueMatch) {
      const quoteContent = dialogueMatch[1];
      
      // 找说话人：在"说："之前的内容中找最后一个 @角色
      const sayIndex = content.lastIndexOf('说：');
      const sayIndexAlt = content.lastIndexOf('说:');
      const actualSayIndex = Math.max(sayIndex, sayIndexAlt);
      
      if (actualSayIndex !== -1) {
        const textBeforeSay = content.substring(0, actualSayIndex);
        
        // 匹配 @角色名 格式（新格式，如 @沈灵月）
        const atCharPattern = /@([^\s@，。,…！!?~：:\[\]【】（）(){}、，。,.<>《》]+)/g;
        const atChars: string[] = [];
        let atMatch;
        while ((atMatch = atCharPattern.exec(textBeforeSay)) !== null) {
          atChars.push(atMatch[1]);
        }
        
        // 兼容旧格式：匹配"名字[图片类型]"模式
        const imgCharPattern = /([^\s[\]【】,，。]+)\[(?:图片?\d|人物立绘)\]/g;
        let imgMatch;
        while ((imgMatch = imgCharPattern.exec(textBeforeSay)) !== null) {
          atChars.push(imgMatch[1]);
        }
        
        if (atChars.length > 0) {
          dialogue = { speaker: atChars[atChars.length - 1], content: quoteContent };
        }
      }
      
      // 画面描述：到"说："之前
      if (actualSayIndex !== -1) {
        visualDesc = content.substring(0, actualSayIndex);
      }
    }
    
    // 2. 移除图片标记
    visualDesc = visualDesc.replace(/\[(?:图片?\d|人物立绘|场景照)\]/g, '').trim();
    
    // 3. 移除"名字是女声/男声..."部分
    visualDesc = visualDesc.replace(/[^\s，。]+(?:是女声|是男声)[^。]*(?=$)/g, '').trim();
    
    // 4. 移除末尾标点
    visualDesc = visualDesc.replace(/[,，\s]+$/, '').trim();
    
    if (visualDesc) {
      shots.push({
        timeRange,
        shotType,
        visualDescription: visualDesc,
        dialogue
      });
    }
  }
  
  return shots;
}

// 合并时间点描述为一个视频提示词
function buildPromptFromTimeShots(
  timeShots: TimeShot[],
  location: string,
  options?: {
    characters?: Array<{ name: string; appearance?: string }>;
    sceneAtmosphere?: string;
    timeOfDay?: string;
    videoModel?: string;
  }
): string {
  if (timeShots.length === 0) return '';

  // 使用电影语言优化器：剔除台词/配音/字幕等非画面内容，重组为视频模型友好的纯画面提示词
  // 结合角色立绘外观描述和场景图氛围，让视频模型生成与参考图一致的画面
  const cinematicPrompt = buildCinematicVideoPrompt(
    timeShots.map((shot) => ({
      timeRange: shot.timeRange,
      shotType: shot.shotType,
      visualDescription: shot.visualDescription,
    })),
    location,
    {
      characters: options?.characters,
      scene: {
        location,
        atmosphere: options?.sceneAtmosphere,
        timeOfDay: options?.timeOfDay,
      },
      videoModel: options?.videoModel,
    }
  );

  if (cinematicPrompt) return cinematicPrompt;

  // 兜底：优化器无有效结果时回退到原始拼接
  const promptParts: string[] = [];
  if (location) {
    promptParts.push(`场景：${location}`);
  }
  for (const shot of timeShots) {
    const shotPrompt = `【${shot.shotType}】${shot.visualDescription}`;
    promptParts.push(shotPrompt);
  }
  return promptParts.join('。');
}

// 合并时间点对话为一个配音列表（按时间顺序）
function mergeTimeShotDialogues(timeShots: TimeShot[]): Array<{
  speaker: string;
  content: string;
  voicePrompt?: string;
}> {
  const dialogues: Array<{
    speaker: string;
    content: string;
    voicePrompt?: string;
  }> = [];
  
  for (const shot of timeShots) {
    if (shot.dialogue) {
      dialogues.push(shot.dialogue);
    }
  }
  
  return dialogues;
}

// 数字转中文数字
const numberToChinese = (text: string): string => {
  if (!text) return text;
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const chineseUnits = ['', '十', '百', '千', '万'];
  
  return text.replace(/\d+/g, (match) => {
    const num = parseInt(match, 10);
    if (num === 0) return '零';
    if (num <= 10) return chineseNums[num];
    if (num < 20) return '十' + (num % 10 === 0 ? '' : chineseNums[num % 10]);
    if (num < 100) {
      const tens = Math.floor(num / 10);
      const ones = num % 10;
      return chineseNums[tens] + '十' + (ones === 0 ? '' : chineseNums[ones]);
    }
    if (num < 1000) {
      const hundreds = Math.floor(num / 100);
      const remainder = num % 100;
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      let result = chineseNums[hundreds] + '百';
      if (tens === 0 && ones > 0) result += '零';
      else if (tens > 0) result += chineseNums[tens] + '十';
      if (ones > 0) result += chineseNums[ones];
      return result;
    }
    if (num < 10000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      const hundreds = Math.floor(remainder / 100);
      const tens = Math.floor((remainder % 100) / 10);
      const ones = remainder % 10;
      let result = chineseNums[thousands] + '千';
      if (hundreds === 0 && (tens > 0 || ones > 0)) result += '零';
      else if (hundreds > 0) result += chineseNums[hundreds] + '百';
      if (tens === 0 && ones > 0 && hundreds > 0) result += '零';
      else if (tens > 0) result += chineseNums[tens] + '十';
      if (ones > 0) result += chineseNums[ones];
      return result;
    }
    // 大于等于1万的数字，保留原样
    return match;
  });
};

// 处理文本中的@标记，将@角色名和@场景名转换为可点击的超链接
const renderTextWithLinks = (
  text: string | null | undefined,
  getCharacterImageUrl: (name: string) => string | null,
  getSceneImageUrl: (name: string) => string | null,
  showImagePreviewDialog: (imageUrl: string, title: string) => void
): React.ReactNode => {
  // 确保 text 是字符串类型
  if (!text || typeof text !== 'string') return null;
  
  // 清理所有图片链接格式作为兜底
  const cleanedText = cleanImageLinks(text);

  // 匹配 @角色名 或 @场景名
  const parts = cleanedText.split(/(@[\u4e00-\u9fa5a-zA-Z0-9_]+)/g);

  return parts.map((part, index) => {
    // 跳过空字符串
    if (!part) return null;

    if (part.startsWith('@')) {
      const name = part.substring(1);
      // 优先匹配角色立绘
      const charImageUrl = getCharacterImageUrl(name);
      if (charImageUrl) {
        return (
          <a
            key={index}
            href={charImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5 font-semibold"
            onClick={(e) => {
              e.preventDefault();
              showImagePreviewDialog(charImageUrl, `人物立绘：${name}`);
            }}
          >
            @{numberToChinese(name)}
            <ImageIcon className="h-3 w-3" />
          </a>
        );
      }

      // 其次匹配场景照
      const sceneImageUrl = getSceneImageUrl(name);
      if (sceneImageUrl) {
        return (
          <a
            key={index}
            href={sceneImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
            onClick={(e) => {
              e.preventDefault();
              showImagePreviewDialog(sceneImageUrl, `场景照：${name}`);
            }}
          >
            @{numberToChinese(name)}
            <ImageIcon className="h-3 w-3" />
          </a>
        );
      }

      // 如果都没有匹配，显示普通文本
      return <span key={index}>@{numberToChinese(name)}</span>;
    }

    // 普通文本
    return <span key={index}>{numberToChinese(part)}</span>;
  }).filter(Boolean); // 过滤掉 null
};

// 清理文本中的所有图片链接格式
const cleanImageLinks = (text: string): string => {
  if (!text || typeof text !== 'string') return text || '';
  
  // 移除 Image: [...] 格式的图片链接
  // 包括：Image: [...]、Image:[...]、image: [...] 等各种变体
  let cleaned = text.replace(/Image:\s*\[[^\]]*\]/gi, '');
  
  // 移除独立的 https:// 链接（通常跟在 Image: 后面）
  cleaned = cleaned.replace(/https:\/\/[^\s\)\]"']+/g, '');
  
  // 移除 [图片X] 标记
  cleaned = cleaned.replace(/\[图片\d+\]/g, '');
  
  // 清理多余空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

// 替换文本中的 [图片X] 为 @角色名（用于 timeDescriptions 渲染）
const replaceImagePlaceholders = (
  text: string,
  characters: Array<{ name: string }> | undefined,
  sceneLocation?: string
): string => {
  if (!text || typeof text !== 'string') return text || '';
  
  // 首先清理所有图片链接格式
  const cleanedText = cleanImageLinks(text);
  
  if (!characters || characters.length === 0) {
    // 如果没有角色列表，直接返回清理后的文本
    return cleanedText;
  }
  
  // 创建图片索引到角色名的映射
  // [图片1] = 场景（使用场景名或场景位置）
  // [图片2] = characters[0]
  // [图片3] = characters[1]
  // 以此类推
  const imageToChar: Record<string, string> = {};
  imageToChar['图片1'] = sceneLocation || '场景';
  
  characters.forEach((char, idx) => {
    const charName = String(char.name);
    // characters 数组索引从 0 开始，但图片索引从 2 开始（图片1是场景）
    imageToChar[`图片${idx + 2}`] = charName;
  });
  
  // 替换所有 [图片X] 为 @角色名
  return cleanedText.replace(/\[(图片\d+)\]/g, (match, key) => {
    const charName = imageToChar[key];
    if (charName) {
      return `@${charName}`;
    }
    // 如果没有对应的角色名，移除标记
    return '';
  });
};

// 中文数字转阿拉伯数字（用于兼容LLM生成的中文数字）
const chineseToNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  
  // 中文数字映射
  const chineseNums: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '两': 2, '百': 100, '千': 1000, '万': 10000
  };
  
  // 单个中文数字
  if (chineseNums[str] !== undefined) return chineseNums[str];
  
  // 组合中文数字（如"十八"、"二十"等）
  let result = 0;
  let temp = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const num = chineseNums[char];
    
    if (num === undefined) continue;
    
    if (num >= 10) {
      // 十、百、千、万
      if (temp === 0) temp = 1;
      result += temp * num;
      temp = 0;
    } else {
      // 零到九
      temp = num;
    }
  }
  
  result += temp;
  return result || 0;
};

// 题材类型配置 - 按分类组织（使用Lucide图标代替emoji）
const GENRE_CATEGORIES = {
  female: {
    label: '女性向题材',
    icon: Heart,
    iconColor: 'text-pink-500',
    genres: [
      { id: 'ba-zong-tian-chong', label: '霸总甜宠', desc: '高富帅与平凡女主的甜蜜爱情', recommendedStyles: ['tian-chong', 'shuang-ju', 'nue-lian'] },
      { id: 'chong-sheng-ni-xi', label: '重生逆袭', desc: '重生复仇、打脸上位', recommendedStyles: ['shuang-ju', 'nue-lian', 'tian-chong'] },
      { id: 'nue-lian-zhui-qi', label: '虐恋追妻', desc: '前期虐心、后期追妻火葬场', recommendedStyles: ['nue-lian', 'tian-chong', 'shuang-ju'] },
      { id: 'hao-men-zhen-jia', label: '豪门真假千金', desc: '身份逆转、智斗上位', recommendedStyles: ['shuang-ju', 'nue-lian', 'xuan-yi'] },
      { id: 'meng-bao-zhu-gong', label: '萌宝助攻', desc: '萌娃神助攻父母感情线', recommendedStyles: ['tian-chong', 'wen-xin', 'gao-xiao'] },
    ],
  },
  male: {
    label: '男性向题材',
    icon: Swords,
    iconColor: 'text-blue-500',
    genres: [
      { id: 'zhan-shen-long-wang', label: '战神/龙王', desc: '隐世强者一朝曝光震惊全场', recommendedStyles: ['shuang-ju', 'wen-xin', 'nue-lian'] },
      { id: 'zhui-xu-ni-xi', label: '赘婿逆袭', desc: '入赘受辱后逆袭翻盘', recommendedStyles: ['shuang-ju', 'nue-lian', 'tian-chong'] },
      { id: 'xiu-xian-xi-tong', label: '修仙/系统流', desc: '绑定系统一路打怪升级', recommendedStyles: ['shuang-ju', 'xuan-yi', 'gao-xiao'] },
      { id: 'du-shi-chuang-ye', label: '都市创业', desc: '重生回到过去白手起家', recommendedStyles: ['shuang-ju', 'wen-xin', 'gao-xiao'] },
    ],
  },
  reality: {
    label: '现实与社会题材',
    icon: Users,
    iconColor: 'text-orange-500',
    genres: [
      { id: 'jia-ting-lun-li', label: '家庭伦理', desc: '婆媳矛盾、财产纷争、养老育儿', recommendedStyles: ['nue-lian', 'wen-xin', 'shuang-ju'] },
      { id: 'zhi-chang-sheng-cun', label: '职场生存', desc: '打工人逆袭、裁员反击', recommendedStyles: ['shuang-ju', 'wen-xin', 'gao-xiao'] },
      { id: 'yin-fa-ai-qing', label: '银发爱情', desc: '中老年情感题材', recommendedStyles: ['wen-xin', 'tian-chong', 'nue-lian'] },
    ],
  },
  suspense: {
    label: '悬疑与脑洞类',
    icon: Eye,
    iconColor: 'text-purple-500',
    genres: [
      { id: 'xuan-yi-tan-an', label: '悬疑探案', desc: '层层解谜、关键反转', recommendedStyles: ['xuan-yi', 'shuang-ju', 'nue-lian'] },
      { id: 'ke-huan-mo-shi', label: '科幻/末世', desc: '人机恋、末世生存', recommendedStyles: ['xuan-yi', 'shuang-ju', 'nue-lian'] },
      { id: 'gu-zhuang-xian-xia', label: '古装仙侠', desc: '仙侠世界、玄幻冒险', recommendedStyles: ['shuang-ju', 'xuan-yi', 'tian-chong'] },
    ],
  },
  special: {
    label: '特殊题材',
    icon: Sparkles,
    iconColor: 'text-amber-500',
    genres: [
      { 
        id: 'meng-chong-feng', 
        label: '萌宠风', 
        desc: '宠物拟人化、反差萌、治愈暖心',
        recommendedStyles: ['wen-xin', 'gao-xiao', 'tian-chong'],
        details: {
          style: '史诗奇幻+古风战甲拟人化',
          characters: '金毛、柴犬、猫咪等宠物化身战士',
          features: '温顺宠物×铁血战士的强烈反差',
          mood: '热血、治愈、萌系',
        }
      },
    ],
  },
};

// 获取所有题材的扁平列表
const ALL_GENRES = Object.values(GENRE_CATEGORIES).flatMap(cat => cat.genres);

// 风格选项配置
const STYLE_OPTIONS = [
  { id: 'tian-chong', label: '甜宠', desc: '宠溺感强，情感代偿' },
  { id: 'shuang-ju', label: '爽剧', desc: '打脸复仇，逆袭翻盘' },
  { id: 'nue-lian', label: '虐恋', desc: '情感张力，催泪治愈' },
  { id: 'gao-xiao', label: '搞笑', desc: '轻松幽默，笑点密集' },
  { id: 'xuan-yi', label: '悬疑', desc: '悬念钩子，层层反转' },
  { id: 'wen-xin', label: '温馨', desc: '治愈暖心，情感共鸣' },
];

// 获取题材推荐风格的辅助函数
function getRecommendedStyles(genreId: string): string[] {
  const genre = ALL_GENRES.find(g => g.id === genreId);
  return genre?.recommendedStyles || ['tian-chong', 'shuang-ju', 'nue-lian', 'gao-xiao', 'xuan-yi', 'wen-xin'];
}

// 图片风格选项（对标小云雀）
const IMAGE_STYLE_OPTIONS = [
  { 
    id: 'realistic', 
    label: '真人风', 
    desc: '写实摄影风格，真实人物质感',
    preview: '真实皮肤纹理、自然光影、专业摄影效果'
  },
  { 
    id: 'comic', 
    label: '漫画风', 
    desc: '精致漫画风格，二次元质感',
    preview: '精致线条、鲜艳色彩、动漫人物特征'
  },
];

// 核心冲突类型配置
const CORE_CONFLICT_TYPES = [
  {
    id: 'revenge',
    label: '复仇逆袭',
    icon: Swords,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    description: '弱势方蓄力反杀强权方，形成"压抑-释放"情绪闭环',
    example: '重生后打脸渣男、赘婿觉醒震惊全场',
  },
  {
    id: 'identity',
    label: '身份错位',
    icon: UsersRound,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    description: '表里身份反差制造打脸爽感',
    example: '清洁工实为战神、真假千金身份逆转',
  },
  {
    id: 'emotion',
    label: '情感博弈',
    icon: Heart,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    borderColor: 'border-pink-200 dark:border-pink-800',
    description: '爱欲与关系障碍的撕裂感',
    example: '先婚后爱、替身文学、追妻火葬场',
  },
  {
    id: 'survival',
    label: '生存对抗',
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    description: '物理/心理双重绝境下的极限博弈',
    example: '末世求生、职场反击、限时解谜',
  },
  {
    id: 'rebirth',
    label: '重生/穿越',
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    description: '利用先知优势改变命运轨迹',
    example: '重生复仇、穿越逆袭、回到过去创业',
  },
  {
    id: 'growth',
    label: '成长进阶',
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    description: '从弱小到强大的蜕变历程',
    example: '修仙升级、职场晋升、系统流成长',
  },
] as const;

type CoreConflictTypeId = typeof CORE_CONFLICT_TYPES[number]['id'];

interface DramaSeries {
  id: string;
  title: string;
  description: string;
  genre: string;
  style: string;
  image_style?: string; // 图片风格：realistic(真人风) / comic(漫画风)
  core_conflict: string;
  core_conflict_types?: string[];
  total_episodes: number;
  status: string;
  progress: number;
  character_count?: number;
  characters: Array<{
    id: string;
    name: string;
    gender: string;
    age: number;
  }>;
  scenes?: Array<{
    sceneId: string;
    name: string;
    type: string;
    description: string;
  }>;
  outlines: DramaOutline[];
  episodes: DramaEpisode[];
  created_at: string;
  metadata?: {
    storyInfo?: {
      protagonist?: string;
      storyType?: string;
      storySummary?: string;
      storyBackground?: string;
      storySetting?: string;
    };
    sceneDefinitions?: Record<string, {
      sceneId: string;
      name: string;
      type: string;
      description: string;
    }>;
  };
}

interface DramaOutline {
  id: string;
  episode_range: string;
  title: string;
  summary: string;
  key_events: string[];
  order: number;
}

// 开篇钩子和结尾悬念的数据结构类型
interface HookCliffhangerData {
  visualPrompt?: string;
  duration?: number | string;
  shotType?: string;
  cameraMovement?: string;
  mood?: string;
  scene?: string | {
    location?: string;
    description: string;
  };
  characters?: string[];
  // 新格式支持
  location?: string;  // 新格式：场景名称
  description?: string;  // 新格式：场景描述
  characterList?: string[];  // 新格式：角色列表
  timeDescriptions?: Record<string, string> | string[];  // 新格式：时间点描述（对象格式：{ "0-3s": "..." } 或数组格式：[ "..." ]）
  subtitle?: boolean;  // 新格式：是否添加字幕
  bgm?: boolean;  // 新格式：是否添加BGM
  dialogue?: {
    speaker: string;
    content: string;
    emotion?: string;
    speechRate?: string;
  };
  dialogues?: Array<{
    speaker: string;
    content: string;
    emotion?: string;
    speechRate?: string;
    isOffScreen?: boolean;
  }>;
  // 顶配爆款版字段
  action?: string;
  closeup?: string;
  style?: string;
  bgmAtmosphere?: string;
  aspectRatio?: string;
  // 多场景支持
  scenes?: Array<{
    sceneIndex?: number;
    scene?: {
      location?: string;
      description: string;
    };
    characters?: string[];
    visualPrompt?: string;
    characterAction?: string;
    cinematicShot?: string;
    lightingDesign?: string;
    shotType?: string;
    cameraMovement?: string;
    duration?: string;
    dialogues?: Array<{
      speaker: string;
      content: string;
      emotion?: string;
      isOffScreen?: boolean;
    }>;
  }>;
  name?: string;
  characterAction?: string;
  cinematicShot?: string;
  lightingDesign?: string;
}

interface Storyboard {
  videoGeneration?: {
    prompt?: string;
    firstFrameUrl?: string;
    outputLastFrame?: boolean;
    generateAudio?: boolean;
    resolution?: '480p' | '720p' | '1080p';
    cameraMovement?: string;
  };
}

interface DramaEpisode {
  id: string;
  episode_number: number;
  title: string;
  brief?: string; // 4-6字剧情简介
  summary: string;
  hook: string | {
    visualPrompt?: string;     // 视觉画面描述
    duration?: number;         // 时长（秒）
    shotType?: string;         // 镜头类型
    cameraMovement?: string;   // 摄像机运动
    mood?: string;             // 氛围
    scene?: string | {         // 场景
      location?: string;
      description: string;
    };
    characters?: string[];     // 角色列表
    dialogue?: {               // 对话
      speaker: string;
      content: string;
      emotion?: string;
      speechRate?: string;
    };
    dialogues?: Array<{
      speaker: string;
      content: string;
      emotion?: string;
      speechRate?: string;
      isOffScreen?: boolean;
    }>;
    // 顶配爆款版字段
    action?: string;
    closeup?: string;
    style?: string;
    bgmAtmosphere?: string;
    aspectRatio?: string;
    videoGeneration?: {        // 视频生成配置
      prompt?: string;
      firstFrameUrl?: string;
      outputLastFrame?: boolean;
      generateAudio?: boolean;
      resolution?: '480p' | '720p' | '1080p';
      cameraMovement?: string;
    };
  };
  cliffhanger: string | {
    visualPrompt?: string;     // 视觉画面描述
    duration?: number;         // 时长（秒）
    shotType?: string;         // 镜头类型
    cameraMovement?: string;   // 摄像机运动
    mood?: string;             // 氛围
    scene?: string | {         // 场景
      location?: string;
      description: string;
    };
    characters?: string[];     // 角色列表
    dialogue?: {               // 对话
      speaker: string;
      content: string;
      emotion?: string;
      speechRate?: string;
    };
    dialogues?: Array<{
      speaker: string;
      content: string;
      emotion?: string;
      speechRate?: string;
      isOffScreen?: boolean;
    }>;
    // 顶配爆款版字段
    action?: string;
    closeup?: string;
    style?: string;
    bgmAtmosphere?: string;
    aspectRatio?: string;
    videoGeneration?: {        // 视频生成配置
      prompt?: string;
      firstFrameUrl?: string;
      outputLastFrame?: boolean;
      generateAudio?: boolean;
      resolution?: '480p' | '720p' | '1080p';
      cameraMovement?: string;
    };
  };
  storyboards: Array<{
    id: string;
    sequence: number;
    type?: 'opening' | 'dialogue' | 'action' | 'transition' | 'ending';
    duration: number;
    shotType: string;
    cameraMovement?: string;
    scene: string | {
      location?: string;
      time?: string;
      description: string;
      lighting?: string;
      props?: string[];
    };
    characters?: Array<{
      name: string;
      age?: number;
      appearance?: string;
      costume?: string;
      position?: string;
      action?: string;
      expression?: string;
    }>;
    dialogue?: string | {
      speaker: string;
      content: string;
      emotion?: string;
      duration?: number;
      innerThought?: string;
    };
    dialogues?: Array<{
      speaker: string;
      content: string;
      emotion?: string;
      speechRate?: string;
      isOffScreen?: boolean;
    }>;
    narration?: {
      content: string;
      duration?: number;
    };
    emotion?: string;
    atmosphere?: {
      mood?: string;
      tension?: number;
      rhythm?: string;
    };
    // 新增字段 - 丰富剧本内容
    mood?: string;           // 整体氛围
    action?: string;         // 详细动作描述
    visualPrompt?: string;   // 视觉画面描述
    // 顶配爆款版字段（新增）
    closeup?: string;        // 特写细节
    style?: string;          // 视觉风格
    bgmAtmosphere?: string;  // BGM氛围
    aspectRatio?: string;    // 画面比例
    audio?: {
      bgm?: string;
      soundEffects?: string[];
      ambience?: string;
    };
    // 视频生成配置 (Seedance 1.5 Pro)
    videoGeneration?: {
      prompt?: string;
      firstFrameUrl?: string;
      useLastFrame?: boolean;
      outputLastFrame?: boolean;
      generateAudio?: boolean;
      resolution?: '480p' | '720p' | '1080p';
      ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive';
      cameraMovement?: string;
    };
    // 音频配置（用于后期配音）
    audioConfig?: {
      needsDubbing?: boolean;
      voiceStyle?: string;
      bgm?: string;
      soundEffects?: string[];
      ambience?: string;
    };
    // 剪辑配置
    editing?: {
      transition?: 'fade' | 'cut' | 'dissolve' | 'wipe';
      transitionDuration?: number;
      timelineStart?: number;
      timelineEnd?: number;
      notes?: string;
    };
    // 新格式支持（timeDescriptions 格式）
    location?: string;  // 场景位置名称
    description?: string;  // 场景环境描述
    characterList?: string[];  // 角色列表
    timeDescriptions?: Record<string, string> | string[];  // 时间点描述（对象格式：{ "0-3s": "..." } 或数组格式：[ "..." ]）
  }>;
  dialogues?: Array<{
    id: string;
    character: string;
    line: string;
    emotion: string;
    duration: number;
    timestamp: string;
  }>;
  scenes?: Array<{
    name: string;
    location: string;
    timeOfDay: string;
    atmosphere: string;
  }>;
  emotions?: Array<{
    timeRange: string;
    dominantEmotion: string;
    intensity: number;
    transition: string;
  }>;
  keyMoments?: Array<{
    timestamp: string;
    description: string;
    emotion: string;
    significance: string;
  }>;
  status: string;
}

export default function DramaPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    }>
      <DramaPageContent />
    </Suspense>
  );
}

function DramaPageContent() {
  const searchParams = useSearchParams();
  const [seriesList, setSeriesList] = useState<DramaSeries[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<DramaSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingStoryboardIndex, setGeneratingStoryboardIndex] = useState<number | null>(null); // 正在生成视频的分镜索引
  const [generatedStoryboardIds, setGeneratedStoryboardIds] = useState<Set<string>>(new Set()); // 已成功生成视频的分镜ID
  const [generatedStoryboardIndices, setGeneratedStoryboardIndices] = useState<Set<number>>(new Set()); // 已成功生成视频的分镜索引（从标题解析）
  const [generatingHook, setGeneratingHook] = useState(false); // 正在生成开篇钩子视频
  const [generatingCliffhanger, setGeneratingCliffhanger] = useState(false); // 正在生成结尾悬念视频
  const [hookVideoGenerated, setHookVideoGenerated] = useState(false); // 开篇钩子视频已生成
  const [cliffhangerVideoGenerated, setCliffhangerVideoGenerated] = useState(false); // 结尾悬念视频已生成
  const [mergingVideos, setMergingVideos] = useState(false); // 正在合成视频
  const [syncingAssets, setSyncingAssets] = useState(false); // 正在同步素材
  const [syncingStoryboardIndex, setSyncingStoryboardIndex] = useState<number | null>(null); // 正在同步素材的分镜索引（-1=hook, -2=cliffhanger, 0+=storyboard）
  const [syncingVideos, setSyncingVideos] = useState(false); // 正在同步视频素材
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false); // 简介对话框
  const [activeTab, setActiveTab] = useState('overview');
  const [showFullConflict, setShowFullConflict] = useState(false);
  
  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [generatingCurrentTask, setGeneratingCurrentTask] = useState<string>(''); // 当前正在生成的任务描述
  const [viewingEpisodeId, setViewingEpisodeId] = useState<number | null>(null);
  // 剧集详情弹窗开关：独立控制，关闭时仅关闭弹窗，保留已选剧集，避免与自动选中逻辑形成循环
  const [episodeDialogOpen, setEpisodeDialogOpen] = useState(false);

  // 关闭剧集详情弹窗：中止进行中的视频生成并清理视频列表，但保留 viewingEpisodeId
  const closeEpisodeDialog = useCallback(() => {
    console.log('[closeEpisodeDialog] 关闭弹窗');
    if (videoAbortControllerRef.current) {
      videoAbortControllerRef.current.abort();
      videoAbortControllerRef.current = null;
    }
    setEpisodeDialogOpen(false);
    setEpisodeVideos([]);
  }, []);

  
  // 立绘相关状态
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [artworkCharacters, setArtworkCharacters] = useState<Array<{
    character_name: string;
    character_id: string;
    imageUrl: string;
    purpose: string;
  }>>([]);
  const [artworkScenes, setArtworkScenes] = useState<Array<{
    title: string;
    imageUrl: string;
    description: string;
  }>>([]);
  
  // 立绘生成确认对话框状态
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateType, setRegenerateType] = useState<'character' | 'scene'>('character');
  const [regenerateTarget, setRegenerateTarget] = useState<{ id?: string; name: string }>({ name: '' });
  
  // 配音配置相关状态
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const [selectedCharacterForVoice, setSelectedCharacterForVoice] = useState<{
    id: string;
    name: string;
    gender?: string;
    age?: number;
    characteristic?: string;
  } | null>(null);
  const [characterVoices, setCharacterVoices] = useState<Map<string, {
    voiceId: string;
    voiceName: string;
    voiceStyle?: string;
  }>>(new Map());
  const [availableVoices, setAvailableVoices] = useState<Array<{
    id: string;
    name: string;
    gender: string;
    category: string;
    description?: string;
  }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [savingVoice, setSavingVoice] = useState(false);

  // 图片预览对话框状态
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewImageTitle, setPreviewImageTitle] = useState('');

  // 从 selectedSeries 中派生 viewingEpisode，避免状态不一致导致的闪烁
  const viewingEpisode = useMemo(() => {
    if (viewingEpisodeId === null || !selectedSeries?.episodes) return null;
    return selectedSeries.episodes.find(e => e.episode_number === viewingEpisodeId) || null;
  }, [viewingEpisodeId, selectedSeries?.episodes]);
  
  // 检查所有分镜视频是否已生成完成（用于合成视频按钮的禁用判断）
  const allStoryboardsHaveVideos = useMemo(() => {
    if (!viewingEpisode?.storyboards || viewingEpisode.storyboards.length === 0) return false;
    
    // 检查每个分镜是否都有视频
    const storyboardCount = viewingEpisode.storyboards.length;
    const generatedCount = generatedStoryboardIndices.size;
    
    // 所有分镜都需要有视频
    return generatedCount >= storyboardCount;
  }, [viewingEpisode?.storyboards, generatedStoryboardIndices]);
  
  // 用于取消视频生成的 AbortController
  const videoAbortControllerRef = useRef<AbortController | null>(null);
  
  // 视频生成状态（用于最小化后继续显示进度）
  const [videoGeneratingEpisode, setVideoGeneratingEpisode] = useState<DramaEpisode | null>(null);
  const [videoGeneratingProgress, setVideoGeneratingProgress] = useState(0);
  // 视频生成任务计数（已完成/总数）
  const [videoCompletedTasks, setVideoCompletedTasks] = useState(0);
  const [videoTotalTasks, setVideoTotalTasks] = useState(0);
  
  // 失败视频记录（用于重试）
  const [failedVideoTasks, setFailedVideoTasks] = useState<Array<{
    id: string;           // 唯一标识
    type: 'hook' | 'storyboard' | 'cliffhanger';
    index: number;        // 镜头索引
    prompt: string;
    title: string;
    duration: number;
    firstFrameUrl?: string;
    outputLastFrame: boolean;
    generateAudio: boolean;
    cameraMovement?: string;
    sortOrder: number;    // 用于按顺序排列
  }>>([]);
  
  // 剧集已生成的视频
  const [episodeVideos, setEpisodeVideos] = useState<Array<{
    id: string;
    title: string;
    videoUrl: string;
    duration: number | null;
    createdAt: string;
    hookType?: 'hook' | 'cliffhanger' | 'storyboard' | 'merged'; // 视频类型
    ratio?: string; // 视频比例，如 '9:16' 或 '16:9'
  }>>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  
  // 后台视频生成任务状态
  const [backgroundTasks, setBackgroundTasks] = useState<Array<{
    id: string;
    seriesId: string;
    episodeNumber?: number;
    status: string;
    progress: number;
    total: number;
    currentItem: string;
    createdAt: string;
    successCount?: number;
    failedCount?: number;
    failedVideos?: Array<{
      index: number;
      storyboardId: string;
      description: string;
      error?: string;
      retryCount?: number;
      canRetry?: boolean;
    }>;
  }>>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // 重新生成标题状态
  const [regeneratingTitle, setRegeneratingTitle] = useState(false);

  // SSE 连接引用
  const eventSourceRef = useRef<EventSource | null>(null);

  // 大纲展开状态
  const [expandedOutlines, setExpandedOutlines] = useState<Set<string>>(new Set());

  // 切换大纲展开状态
  const toggleOutline = (outlineId: string) => {
    setExpandedOutlines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outlineId)) {
        newSet.delete(outlineId);
      } else {
        newSet.add(outlineId);
      }
      return newSet;
    });
  };

  // 新建剧本表单
  const [newSeries, setNewSeries] = useState({
    title: '',
    description: '',
    genre: 'ba-zong-tian-chong',
    style: 'tian-chong', // 默认甜宠风格（霸总甜宠的推荐风格）
    imageStyle: 'realistic', // 默认真人风
    coreConflict: '',
    coreConflictTypes: [] as CoreConflictTypeId[],
    totalEpisodes: 30,
    characterCount: 0, // 0表示AI自动决定
  });

  // 加载剧本列表
  const loadSeriesList = useCallback(async () => {
    try {
      setLoading(true);
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch('/api/drama/series', {
        headers: {
          'x-user-id': currentUserId,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSeriesList(data.series);
      }
    } catch (error) {
      console.error('加载剧本列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeriesList();
  }, [loadSeriesList]);

  // 过滤后的项目列表
  const filteredSeriesList = useMemo(() => {
    return seriesList.filter(series => {
      const matchesStatus = filterStatus === 'all' || series.status === filterStatus;
      const matchesSearch = series.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (series.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [seriesList, filterStatus, searchQuery]);

  // 项目统计
  const stats = useMemo(() => ({
    total: seriesList.length,
    draft: seriesList.filter(s => s.status === 'draft').length,
    outlining: seriesList.filter(s => s.status === 'outlining').length,
    writing: seriesList.filter(s => s.status === 'writing').length,
    completed: seriesList.filter(s => s.status === 'completed').length,
  }), [seriesList]);

  // 处理 URL 参数中的 seriesId，自动选中对应的短剧
  useEffect(() => {
    const seriesIdFromUrl = searchParams.get('seriesId');
    const tabFromUrl = searchParams.get('tab');
    
    if (seriesIdFromUrl && seriesList.length > 0 && !selectedSeries) {
      // 检查 seriesIdFromUrl 是否在列表中
      const series = seriesList.find(s => s.id === seriesIdFromUrl);
      if (series) {
        // 使用 selectSeries 函数加载完整的短剧信息（包括 episodes）
        const loadSelectedSeries = async () => {
          try {
            // 获取用户信息
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const currentUserId = user?.id || 'dev-user';

            const response = await fetch(`/api/drama/series/${seriesIdFromUrl}`, {
              headers: {
                'x-user-id': currentUserId,
              },
            });
            const data = await response.json();
            if (data.success) {
              setSelectedSeries(data.series);
              // 如果 URL 中有 tab 参数，设置对应的 Tab
              if (tabFromUrl) {
                const validTabs = ['overview', 'outlines', 'artwork', 'episodes'];
                if (validTabs.includes(tabFromUrl)) {
                  setActiveTab(tabFromUrl);
                }
              }
            }
          } catch (error) {
            console.error('获取剧本详情失败:', error);
          }
        };
        loadSelectedSeries();
      }
    }
  }, [searchParams, seriesList, selectedSeries]);

  // 处理 refresh 参数，重置选中状态回到项目列表
  useEffect(() => {
    const shouldRefresh = searchParams.get('refresh');
    if (shouldRefresh === 'true') {
      setSelectedSeries(null);
      setActiveTab('overview');
      // 清除 URL 中的 refresh 参数
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  // 加载可用音色列表
  const loadAvailableVoices = useCallback(async () => {
    try {
      setLoadingVoices(true);
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch('/api/tts/voices?recommended=true', {
        headers: {
          'x-user-id': currentUserId,
        },
      });
      const data = await response.json();
      if (data.success) {
        // 合并男女音色并添加额外信息
        const allVoices = [
          ...(data.quickSelect?.female || []).map((v: Record<string, unknown>) => ({
            id: v.id,
            name: v.name,
            gender: 'female',
            category: v.category || 'general',
            description: v.description,
          })),
          ...(data.quickSelect?.male || []).map((v: Record<string, unknown>) => ({
            id: v.id,
            name: v.name,
            gender: 'male',
            category: v.category || 'general',
            description: v.description,
          })),
        ];
        setAvailableVoices(allVoices);
      }
    } catch (error) {
      console.error('加载音色列表失败:', error);
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  // 加载角色配音配置
  const loadCharacterVoices = useCallback(async (seriesId: string) => {
    try {
      const response = await fetch(`/api/drama/series/${seriesId}/voice`);
      const data = await response.json();
      if (data.success && data.voices) {
        const voiceMap = new Map<string, { voiceId: string; voiceName: string; voiceStyle?: string }>();
        data.voices.forEach((v: Record<string, unknown>) => {
          if (v.character_id) {
            voiceMap.set(v.character_id as string, {
              voiceId: v.voice_id as string,
              voiceName: (v.voice_name || v.voice_id) as string,
              voiceStyle: v.voice_style as string | undefined,
            });
          }
        });
        setCharacterVoices(voiceMap);
      }
    } catch (error) {
      console.error('加载角色配音配置失败:', error);
    }
  }, []);

  // 打开配音配置弹窗
  const openVoiceDialog = useCallback((char: {
    id: string;
    name: string;
    gender?: string;
    age?: number;
    characteristic?: string;
  }) => {
    setSelectedCharacterForVoice(char);
    // 设置当前选中的音色（如果已有配置）
    const currentVoice = characterVoices.get(char.id);
    setSelectedVoiceId(currentVoice?.voiceId || '');
    setShowVoiceDialog(true);
    // 加载音色列表
    if (availableVoices.length === 0) {
      loadAvailableVoices();
    }
  }, [characterVoices, availableVoices.length, loadAvailableVoices]);

  // 保存配音配置
  const saveVoiceConfig = useCallback(async () => {
    if (!selectedSeries || !selectedCharacterForVoice || !selectedVoiceId) {
      toast.error('请选择音色');
      return;
    }

    try {
      setSavingVoice(true);
      const userStr = localStorage.getItem('user');
      const authUser = userStr ? JSON.parse(userStr) : null;
      const response = await fetch(`/api/drama/series/${selectedSeries.id}/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authUser?.id ? { 'x-user-id': authUser.id } : {}),
        },
        body: JSON.stringify({
          characterId: selectedCharacterForVoice.id,
          characterName: selectedCharacterForVoice.name,
          voiceId: selectedVoiceId,
          voiceName: availableVoices.find(v => v.id === selectedVoiceId)?.name || selectedVoiceId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 更新本地状态
        setCharacterVoices(prev => {
          const next = new Map(prev);
          next.set(selectedCharacterForVoice.id, {
            voiceId: selectedVoiceId,
            voiceName: availableVoices.find(v => v.id === selectedVoiceId)?.name || selectedVoiceId,
          });
          return next;
        });
        toast.success('配音配置保存成功');
        setShowVoiceDialog(false);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配音配置失败:', error);
      toast.error('保存失败');
    } finally {
      setSavingVoice(false);
    }
  }, [selectedSeries, selectedCharacterForVoice, selectedVoiceId, availableVoices]);

  // 当选中剧本时加载配音配置
  useEffect(() => {
    if (selectedSeries?.id) {
      loadCharacterVoices(selectedSeries.id);
    }
  }, [selectedSeries?.id, loadCharacterVoices]);

  // 当 viewingEpisode 变化时自动加载视频，确保视频状态同步
  // 注意：只在弹窗打开时加载，避免与用户点击时的直接调用产生竞态条件
  useEffect(() => {
    if (viewingEpisode && selectedSeries && episodeDialogOpen) {
      loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
    }
  }, [viewingEpisode?.episode_number, selectedSeries?.id, episodeDialogOpen]);

  // 加载剧集已生成的视频
  const loadEpisodeVideos = async (seriesId: string, episodeNumber: number) => {
    try {
      console.log('[loadEpisodeVideos] 开始加载视频', { seriesId, episodeNumber });
      setLoadingVideos(true);
      
      // 切换到新的 episode 时，重置所有生成状态
      // 这确保不同 episode 的生成状态不会互相干扰
      setGeneratedStoryboardIndices(new Set());
      setHookVideoGenerated(false);
      setCliffhangerVideoGenerated(false);
      setGeneratedStoryboardIds(new Set());
      // 注意：不再清空视频列表，避免刷新时视频闪烁（一会能看到一会看不到）
      // 如果是切换到不同剧集，fetch返回后会自动替换为新数据
      
      const userInfo = (() => {
        try {
          const userStr = localStorage.getItem('user');
          return userStr ? JSON.parse(userStr) : null;
        } catch {
          return null;
        }
      })();
      const userId = userInfo?.id;
      
      const response = await fetch(`/api/videos?seriesId=${seriesId}&episodeNumber=${episodeNumber}`, {
        headers: userId ? { 'x-user-id': userId } : undefined,
      });
      const data = await response.json();
      console.log('[loadEpisodeVideos] API 响应', { success: data.success, videoCount: data.videos?.length });
      if (data.success) {
        const videos = data.videos.map((v: Record<string, unknown>) => ({
          id: v.id as string,
          title: v.title as string,
          videoUrl: v.videoUrl as string,
          duration: v.duration as number | null,
          createdAt: v.createdAt as string,
          hookType: v.hookType as 'hook' | 'cliffhanger' | 'storyboard' | 'merged' | undefined,
          sortOrder: v.sortOrder as number | undefined,
          ratio: (v.ratio as string) || '16:9', // 视频比例，默认16:9
        }));
        setEpisodeVideos(videos);
        
        // 从 selectedSeries 中直接获取该剧集的分镜信息（避免依赖 viewingEpisode 的异步状态）
        const episode = selectedSeries?.episodes?.find(e => e.episode_number === episodeNumber);
        const storyboards = episode?.storyboards || [];
        const expectedCount = storyboards.length;
        
        // 检查视频生成进度并恢复正确的状态
        // 这解决了前端状态卡住的问题（如显示 11/15 但实际已全部完成）
        const storyboardVideos = videos.filter((v: { hookType?: string }) => 
          v.hookType === 'storyboard' || (!v.hookType?.includes('hook') && !v.hookType?.includes('cliffhanger'))
        );
        
        // 如果生成的视频数量达到预期，确保重置所有生成状态
        if (storyboardVideos.length >= expectedCount && expectedCount > 0) {
          // 无论当前状态如何，都重置进度状态
          setGenerating(null);
          setGeneratingStoryboardIndex(null);
          setGeneratingHook(false);
          setGeneratingCliffhanger(false);
          setVideoTotalTasks(0);
          setVideoCompletedTasks(0);
          setVideoGeneratingProgress(0);
          setVideoGeneratingEpisode(null);
          console.log(`[状态恢复] 检测到视频已全部生成 (${storyboardVideos.length}/${expectedCount})，重置生成状态`);
        }
        
        // 根据已存在的视频，恢复分镜的已生成状态
        // 这样页面刷新后不会重复生成同一个分镜的视频
        if (storyboards.length > 0) {
          const generatedIds = new Set<string>();
          const generatedIndices = new Set<number>();
          
          videos.forEach((video: { title: string; hookType?: string; sortOrder?: number }) => {
            // 检查是否是开篇钩子视频
            if (video.hookType === 'hook' || video.title.includes('开篇钩子')) {
              setHookVideoGenerated(true);
            }
            // 检查是否是结尾悬念视频
            else if (video.hookType === 'cliffhanger' || video.title.includes('结尾悬念')) {
              setCliffhangerVideoGenerated(true);
            }
            // 普通分镜视频：匹配标题中的镜头编号
            else if (video.hookType === 'storyboard' || !video.hookType) {
              // 方案1：通过 sort_order 判断分镜索引（更可靠）
              // sort_order 是 0-based 的分镜索引，直接使用
              if (video.sortOrder !== undefined && video.sortOrder !== null && video.sortOrder >= 0) {
                const index = video.sortOrder; // 0-based 索引，直接使用
                generatedIndices.add(index);
                const storyboard = storyboards[index];
                if (storyboard?.id) {
                  generatedIds.add(storyboard.id);
                }
              } else {
                // 方案2：通过标题匹配（后备方案）
                const match = video.title.match(/对话镜头(\d+)|分镜(\d+)/);
                if (match) {
                  const index = parseInt(match[1] || match[2], 10) - 1; // 转换为0-based索引
                  generatedIndices.add(index);
                  const storyboard = storyboards[index];
                  if (storyboard?.id) {
                    generatedIds.add(storyboard.id);
                  }
                }
              }
            }
          });
          
          if (generatedIds.size > 0) {
            setGeneratedStoryboardIds(prev => {
              const newSet = new Set(prev);
              generatedIds.forEach(id => newSet.add(id));
              return newSet;
            });
          }
          
          if (generatedIndices.size > 0) {
            setGeneratedStoryboardIndices(prev => {
              const newSet = new Set(prev);
              generatedIndices.forEach(idx => newSet.add(idx));
              return newSet;
            });
            console.log(`[状态恢复] 检测到已生成的分镜索引:`, Array.from(generatedIndices).sort((a, b) => a - b).map(i => i + 1));
          }
        }
      }
    } catch (error) {
      console.error('加载剧集视频失败:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  // 删除视频
  const deleteVideo = async (videoId: string) => {
    if (!confirm('确定要删除这个视频吗？此操作不可恢复。')) {
      return;
    }
    
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('视频删除成功');
        // 从列表中移除
        setEpisodeVideos(prev => prev.filter(v => v.id !== videoId));
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除视频失败:', error);
      toast.error('删除视频失败');
    }
  };

  // 加载后台任务列表
  const loadBackgroundTasks = async (seriesId: string) => {
    try {
      setLoadingTasks(true);
      const response = await fetch(`/api/videos/background-tasks?seriesId=${seriesId}`);
      const data = await response.json();
      if (data.success) {
        setBackgroundTasks(data.tasks.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          seriesId: t.series_id as string,
          episodeNumber: t.episode_number as number | undefined,
          status: t.status as string,
          progress: t.progress as number,
          total: t.total as number,
          currentItem: t.current_item as string,
          createdAt: t.created_at as string,
        })));
      }
    } catch (error) {
      console.error('加载后台任务失败:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  // 查询单个任务状态
  const checkTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/videos/background-tasks?taskId=${taskId}`);
      const data = await response.json();
      if (data.success && data.task) {
        const task = data.task;
        setBackgroundTasks(prev => {
          const existing = prev.find(t => t.id === taskId);
          if (existing) {
            return prev.map(t => t.id === taskId ? {
              id: task.id,
              seriesId: task.series_id,
              episodeNumber: task.episode_number,
              status: task.status,
              progress: task.progress,
              total: task.total,
              currentItem: task.current_item,
              createdAt: task.created_at,
            } : t);
          } else {
            return [...prev, {
              id: task.id,
              seriesId: task.series_id,
              episodeNumber: task.episode_number,
              status: task.status,
              progress: task.progress,
              total: task.total,
              currentItem: task.current_item,
              createdAt: task.created_at,
            }];
          }
        });
        return task;
      }
    } catch (error) {
      console.error('查询任务状态失败:', error);
    }
    return null;
  };

  // 生成单个分镜的视频
  const generateStoryboardVideo = async (storyboardIndex: number) => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    const storyboard = viewingEpisode.storyboards?.[storyboardIndex];
    if (!storyboard) {
      toast.error('分镜不存在');
      return;
    }
    
    // 检查该分镜是否已有视频（防止重复生成）
    if (storyboard.id && generatedStoryboardIds.has(storyboard.id)) {
      if (!confirm('该分镜已有视频，是否要重新生成？')) {
        return;
      }
    }

    // ========== 预检查：获取立绘和场景图片数据 ==========
    let characterArtworks: Array<{
      character_name: string;
      character_id: string;
      imageUrl: string;
      purpose: string;
      generation_prompt?: string;
      description?: string;
    }> = [];
    let sceneImages: Array<{
      title: string;
      imageUrl: string;
      description: string;
    }> = [];
    
    try {
      const userInfo = (() => {
        try {
          const userStr = localStorage.getItem('user');
          return userStr ? JSON.parse(userStr) : null;
        } catch {
          return null;
        }
      })();
      const userId = userInfo?.id;
      
      const artworkResponse = await fetch(`/api/drama/series/${selectedSeries.id}/artwork`, {
        headers: userId ? { 'x-user-id': userId } : undefined,
      });
      if (artworkResponse.ok) {
        const artworkData = await artworkResponse.json();
        if (artworkData.success) {
          characterArtworks = artworkData.characters || [];
          sceneImages = artworkData.scenes || [];
          console.log('[分镜视频] 获取到', characterArtworks.length, '个角色立绘,', sceneImages.length, '个场景图片');
        }
      }
    } catch (e) {
      console.warn('[分镜视频] 获取立绘数据失败:', e);
    }

    // ========== 检查分镜中的角色是否有立绘 ==========
    const rawCharacters = storyboard.characters || [];
    let shotCharacterNames: string[] = [];
    
    if (rawCharacters.length > 0) {
      const firstChar = rawCharacters[0];
      if (typeof firstChar === 'string') {
        shotCharacterNames = rawCharacters as unknown as string[];
      } else if (typeof firstChar === 'object' && firstChar !== null && 'name' in firstChar) {
        shotCharacterNames = (rawCharacters as unknown as Array<{ name: string }>).map(c => c.name);
      }
    }

    // 从对话中提取说话人
    const shotDialogues = (storyboard.dialogues as Array<{ speaker: string; content: string }>) || 
      (storyboard.dialogue ? [storyboard.dialogue as { speaker: string; content: string }] : []);
    
    if (shotDialogues.length > 0) {
      const speakersFromDialogues = shotDialogues
        .map(d => d.speaker)
        .filter((s): s is string => !!s && s !== '旁白');
      shotCharacterNames = [...new Set([...shotCharacterNames, ...speakersFromDialogues])];
    }

    // 检查每个角色是否有立绘
    const missingCharacters: string[] = [];
    for (const charName of shotCharacterNames) {
      const hasArtwork = characterArtworks.some(
        art => art.character_name === charName || art.character_id === charName
      );
      if (!hasArtwork) {
        missingCharacters.push(charName);
      }
    }

    // ========== 检查分镜中的场景是否有场景照 ==========
    const { location: shotLocation } = parseSceneInfo(storyboard.scene);
    
    let hasSceneImage = false;
    if (shotLocation && sceneImages.length > 0) {
      const locationKeywords = shotLocation.replace(/[门口内外前侧后上下]/g, '').trim();
      const keywords = locationKeywords.split(/[，,、\s]+/).filter(k => k.length > 1);
      for (const keyword of keywords) {
        hasSceneImage = sceneImages.some(scene => 
          scene.title.includes(keyword) || 
          scene.description?.includes(keyword)
        );
        if (hasSceneImage) break;
      }
    }

    // ========== 如果缺少素材，提示用户 ==========
    const missingItems: string[] = [];
    if (missingCharacters.length > 0) {
      missingItems.push(`角色立绘: ${missingCharacters.join('、')}`);
    }
    if (shotLocation && !hasSceneImage && sceneImages.length === 0) {
      missingItems.push(`场景照: ${shotLocation}`);
    }

    if (missingItems.length > 0) {
      toast.error(
        <div>
          <p className="font-medium mb-1">缺少素材，请先生成：</p>
          {missingItems.map((item, i) => (
            <p key={i} className="text-sm">• {item}</p>
          ))}
          <p className="text-sm mt-2 text-muted-foreground">请点击&ldquo;立绘&rdquo;标签页生成所需素材</p>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    setGeneratingStoryboardIndex(storyboardIndex);
    toast.info(`正在生成分镜 ${storyboardIndex + 1} 的视频...`, { duration: 2000 });

    try {
    // ========== 辅助函数 ==========
    
    const matchSceneImage = (location: string): string | undefined => {
      if (!location || sceneImages.length === 0) return undefined;
      const locationKeywords = location.replace(/[门口内外前侧后上下]/g, '').trim();
      const keywords = locationKeywords.split(/[，,、\s]+/).filter(k => k.length > 1);
      for (const keyword of keywords) {
        const matched = sceneImages.find(scene => 
          scene.title.includes(keyword) || 
          scene.description?.includes(keyword)
        );
        if (matched) return matched.imageUrl;
      }
      return undefined;
    };

      const extractCharacterAppearance = (characterName: string): string => {
        if (!characterName) return '';
        
        // 方式1：从立绘的 generation_prompt 中提取
        if (characterArtworks.length > 0) {
          const artwork = characterArtworks.find(a => 
            a.character_name === characterName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === characterName);
          
          if (artwork?.generation_prompt) {
            const prompt = artwork.generation_prompt;
            const appearanceParts: string[] = [];
            const hairstyleMatch = prompt.match(/发型[：:]\s*([^，,。；;]+)/);
            if (hairstyleMatch) appearanceParts.push(hairstyleMatch[1].trim());
            const clothingMatch = prompt.match(/服装[：:]\s*([^，,。；;]+)/);
            if (clothingMatch) appearanceParts.push(clothingMatch[1].trim());
            const skinMatch = prompt.match(/肤色[：:]\s*([^，,。；;]+)/);
            if (skinMatch) appearanceParts.push(skinMatch[1].trim());
            const temperamentMatch = prompt.match(/气质[：:]\s*([^，,。；;]+)/);
            if (temperamentMatch) appearanceParts.push(temperamentMatch[1].trim());
            if (appearanceParts.length > 0) {
              return appearanceParts.join('，');
            }
          }
        }
        
        // 方式2：从角色配置中获取（如果没有立绘）
        const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
        if (seriesChar) {
          const char = seriesChar as Record<string, unknown>;
          const appearanceParts: string[] = [];
          // 从角色配置中提取外观信息
          if (char.hairstyle) appearanceParts.push(`发型${char.hairstyle}`);
          if (char.clothing) appearanceParts.push(`服装${char.clothing}`);
          if (char.skinTone) appearanceParts.push(`肤色${char.skinTone}`);
          if (char.temperament) appearanceParts.push(`气质${char.temperament}`);
          if (char.characteristic) appearanceParts.push(`特征${char.characteristic}`);
          if (appearanceParts.length > 0) {
            return appearanceParts.join('，');
          }
        }
        
        return '';
      };

      // 获取角色音色描述
      const getCharacterVoiceDescription = (characterName: string, emotion?: string, speechRate?: string): string => {
        if (!characterName) return '';
        // 从 seriesList 或 selectedSeries 的 characters 中查找
        const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
        if (seriesChar && 'voiceDescription' in seriesChar) {
          const voiceDesc = (seriesChar as { voiceDescription?: string }).voiceDescription || '';
          if (voiceDesc) return voiceDesc;
        }
        // 如果没有预设音色，使用情绪和语速构建音色描述
        if (emotion || speechRate) {
          const voiceParts: string[] = [];
          if (emotion) voiceParts.push(emotion);
          if (speechRate) voiceParts.push(speechRate);
          return voiceParts.join('，');
        }
        return '';
      };

      // 镜头语言指导函数 - 根据镜头类型生成视频模型可理解的运动指令
      const buildShotGuidance = (shotType: string): string => {
        const shotMap: Record<string, string> = {
          '极特写': '【镜头：极特写】距离极近，只拍摄双眼或嘴唇，背景虚化，呼吸感可见',
          '特写': '【镜头：特写】聚焦面部表情和微表情，捕捉眼神变化和嘴角颤动，浅景深',
          '近景': '【镜头：近景】胸部以上，表情清晰可见，呼吸和轻微肢体动作可见',
          '中景': '【镜头：中景】腰部以上，展示手势和上身动作，人物互动关系清晰',
          '全景': '【镜头：全景】全身入画，展示角色与环境的完整关系，动作幅度完整',
          '大远景': '【镜头：大远景】人物渺小，环境宏大，命运感和孤独感',
          '仰拍': '【镜头：仰拍】从低角度拍摄，赋予角色力量感和压迫感',
          '俯拍': '【镜头：俯拍】从高角度拍摄，展现角色脆弱或全局掌控',
          '推镜头': '【镜头：推镜头】镜头缓缓推近，制造压迫感和聚焦感，情绪逐渐收紧',
          '拉镜头': '【镜头：拉镜头】镜头缓缓拉远，展现孤立无援或命运苍凉',
          '环绕镜头': '【镜头：环绕镜头】镜头围绕角色旋转，展现内心天旋地转',
          '手持晃动': '【镜头：手持晃动】轻微抖动增加紧张临场感，如亲临现场',
          '慢动作': '【镜头：慢动作】关键瞬间延时，泪水滑落、发丝飘起',
        };
        // 支持组合镜头如"极特写·手持晃动"
        for (const [key, value] of Object.entries(shotMap)) {
          if (shotType.includes(key)) {
            return value;
          }
        }
        return `【镜头：${shotType}】`;
      };

      // 构建增强的提示词（新格式）
      const buildEnhancedPrompt = (
        basePrompt: string,
        characters: Array<{ name: string }>,
        options?: {
          episodeNumber?: number;
          storyboardIndex?: number;
          duration?: number;
          timeOfDay?: string;
          sceneImageUrl?: string;
          sceneLocation?: string;  // 新增：场景位置名称
          characterImageUrls?: Map<string, string>; // 角色名 -> 立绘图片URL
          dialogues?: Array<{ speaker: string; content: string; emotion?: string; speechRate?: string; isOffScreen?: boolean }>;
          mood?: string;       // 情绪氛围（如：肃杀、温馨、紧张）
          emotion?: string;    // 核心情绪（如：悲愤交加、冷酷决绝）
          shotType?: string;   // 镜头类型（如：特写、全景、推镜头）
          imageStyle?: string; // 图片风格：realistic（真人风）或 comic（漫画风）
        }
      ): string => {
        const opts = options || {};
        const parts: string[] = [];

        // 0. 根据图片风格选择不同的视觉基底提示词
        const imageStyle = opts.imageStyle || 'realistic';
        const cinematicBase = imageStyle === 'comic' ? [
          '精致动漫风格',
          '高质量二次元插画',
          '精美细腻的动漫人物',
          '日系动漫风格',
          '赛璐璐渲染',
          '漫画分镜质感',
          '精美线条',
          '鲜艳色彩',
          '动漫人物特征',
          '大眼睛',
          '精致五官',
          '流畅发丝',
          'IMAX电影质感',
          '动态流畅',
          '运镜丝滑',
          '无字幕',
          '角色双脚稳稳站立在地面上',
          '身体比例正确',
          '不会陷入地面或漂浮在空中',
        ] : [
          '真人实拍摄影风格',
          '专业人像摄影',
          '真实人物质感',
          '真实皮肤纹理',
          '自然毛孔',
          '细腻肤质',
          '真实毛发',
          '自然光影',
          '专业摄影布光',
          '浅景深虚化',
          '胶片质感',
          'IMAX电影质感',
          '35mm镜头',
          'f4光圈',
          '胶片颗粒',
          '电影级光线追踪',
          '电影光影',
          '动态流畅',
          '运镜丝滑',
          '无字幕',
          '无水印',
        ];
        const cinematicGuide = `【基础提示词】${cinematicBase.join('，')}。角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，`;
        parts.push(cinematicGuide);

        // 1. 添加集数和分镜号
        if (opts.episodeNumber !== undefined && opts.storyboardIndex !== undefined) {
          parts.push(`第${opts.episodeNumber}集第${opts.storyboardIndex + 1}分镜`);
        }

        // 2. 添加时长
        if (opts.duration) {
          parts.push(`${opts.duration}s`);
        }

        // 3. 添加时间（日/夜）
        if (opts.timeOfDay) {
          parts.push(`时间：${opts.timeOfDay}`);
        }

        // 4. 添加场景位置（使用@格式作为超链接标记）
        if (opts.sceneLocation) {
          parts.push(`@${opts.sceneLocation}`);
        }

        // 注意：sceneImageUrl 通过 firstFrameUrl 参数传递给视频API，不需要添加到文本中
        // 角色立绘图片通过 firstFrameUrl 参数传递，在文本中添加标记即可

        // 5. 处理基础描述中的角色名，添加立绘标记
        let enhancedBasePrompt = basePrompt;
        const characterNames = characters.map(c => c.name);

        // 为每个角色添加立绘标记（表示有立绘图片作为参考）
        for (const charName of characterNames) {
          const imageUrl = opts.characterImageUrls?.get(charName);
          if (imageUrl) {
            // 在提示词中替换角色名，添加立绘标记
            const regex = new RegExp(charName, 'g');
            enhancedBasePrompt = enhancedBasePrompt.replace(regex, `@${charName}`);
          }
        }

        // 6. 添加角色外观描述 - 强化情绪对应的表情和肢体语言
        const characterDescriptions: string[] = [];
        for (const char of characters) {
          const appearance = extractCharacterAppearance(char.name);

          if (appearance) {
            // 查找该角色在对话中的情绪，用于增强表情描述
            const charDialogue = opts.dialogues?.find(d => d.speaker === char.name);
            const charEmotion = charDialogue?.emotion;
            let appearanceWithEmotion = `@${char.name}：${appearance}`;
            if (charEmotion) {
              appearanceWithEmotion += `，表情${charEmotion}`;
            }
            characterDescriptions.push(appearanceWithEmotion);
          }
        }

        if (characterDescriptions.length > 0) {
          enhancedBasePrompt = `【角色外观与表情】${characterDescriptions.join('；')}。${enhancedBasePrompt}`;
        }

        parts.push(enhancedBasePrompt);

        // 7. 添加情绪氛围指导 - 让视频模型理解画面的情感基调
        if (opts.mood || opts.emotion) {
          const moodParts: string[] = [];
          if (opts.mood) moodParts.push(`氛围${opts.mood}`);
          if (opts.emotion) moodParts.push(`情绪${opts.emotion}`);
          parts.push(`【情绪基调】${moodParts.join('，')}，画面色调与光影配合情绪，角色微表情精准传递内心，双脚稳站地面身体比例自然`);
        }

        // 8. 添加镜头语言指导 - 确保视频模型执行正确的镜头运动
        if (opts.shotType) {
          const shotGuidance = buildShotGuidance(opts.shotType);
          if (shotGuidance) {
            parts.push(shotGuidance);
          }
        }

        // 9. 添加对话内容（带角色立绘标记和音色描述）
        if (opts.dialogues && opts.dialogues.length > 0) {
          const dialogueParts: string[] = [];
          for (const d of opts.dialogues) {
            const speaker = d.speaker || '旁白';
            const content = d.content;
            const isInFrame = characterNames.includes(speaker);

            if (content) {
              if (speaker === '旁白') {
                dialogueParts.push(`旁白：「${content}」`);
              } else if (isInFrame) {
                // 镜头内人物说话，添加立绘标记
                const speakerWithMark = `@${speaker}`;
                let dialogueText = `${speakerWithMark}说：「${content}」`;

                // 添加音色描述
                const voiceDesc = getCharacterVoiceDescription(speaker);
                if (voiceDesc) {
                  dialogueText += `音色：${voiceDesc}`;
                } else if (d.emotion || d.speechRate) {
                  // 如果没有预设音色，使用情绪和语速
                  const voiceParts: string[] = [];
                  if (d.emotion) voiceParts.push(d.emotion);
                  if (d.speechRate) voiceParts.push(d.speechRate);
                  if (voiceParts.length > 0) {
                    dialogueText += `（${voiceParts.join('，')}）`;
                  }
                }

                dialogueParts.push(dialogueText);
              } else {
                // 画外音
                const speakerWithMark = `@${speaker}`;
                dialogueParts.push(`【画外音】${speakerWithMark}说：「${content}」`);
              }
            }
          }
          if (dialogueParts.length > 0) {
            parts.push(dialogueParts.join(' '));
          }
        }

        return parts.join('，');
      };

      // ========== 解析分镜数据 ==========
      const videoGen = storyboard.videoGeneration as Record<string, unknown> | undefined;
      
      // 构建视频提示词 - 优先使用顶配爆款版字段
      let rawPrompt = '';
      let shotDialogues: Array<{ speaker: string; content: string; emotion?: string; speechRate?: string; isOffScreen?: boolean }> = [];
      
      // 获取分镜的场景信息 - 优先使用新格式字段
      const storyboardTimeDescriptions = storyboard.timeDescriptions as Record<string, string> | string[] | undefined;
      const newLocation = storyboard.location as string | undefined;
      const newDescription = storyboard.description as string | undefined;
      
      // 检查 timeDescriptions 字段（新格式：对象 { "0-3s": "...", "3-6s": "..." }）
      const timeShots: TimeShot[] = [];
      if (storyboardTimeDescriptions && typeof storyboardTimeDescriptions === 'object') {
        if (Array.isArray(storyboardTimeDescriptions)) {
          // 数组格式（旧兼容）
          for (const td of storyboardTimeDescriptions) {
            const parsed = parseTimeDescriptions(td as string);
            if (parsed.length > 0) {
              timeShots.push(...parsed);
            }
          }
        } else {
          // 对象格式（新格式）
          const timeDescObj = storyboardTimeDescriptions as Record<string, string>;
          for (const timeRange of Object.keys(timeDescObj)) {
            const descText = timeDescObj[timeRange];
            const parsed = parseTimeDescriptions(`${timeRange}：${descText}`);
            if (parsed.length > 0) {
              timeShots.push(...parsed);
            }
          }
        }
      }
      
      if (timeShots.length > 0) {
        console.log('[分镜视频] 检测到 timeDescriptions 格式，共', timeShots.length, '个分镜');
        
        // 使用时间点描述构建提示词（12s 一个视频，包含多个镜头）
        // 结合角色立绘外观描述，让视频模型生成与参考图一致的画面
        const storyboardChars = (storyboard.characters || []).map((c: string | { name: string }) => 
          typeof c === 'string' ? c : c?.name
        ).filter(Boolean) as string[];
        const charactersWithAppearance = storyboardChars.map(name => ({
          name,
          appearance: extractCharacterAppearance(name),
        }));
        rawPrompt = buildPromptFromTimeShots(timeShots, newLocation || '', {
          characters: charactersWithAppearance,
        });
        
        // 合并时间点中的对话
        const timeShotDialogues = mergeTimeShotDialogues(timeShots);
        if (timeShotDialogues.length > 0) {
          shotDialogues = timeShotDialogues as typeof shotDialogues;
          console.log('[分镜视频] 使用时间点解析出的对话:', shotDialogues);
        }
      } else {
        // 兼容旧格式：从 scene 字段解析
        const { location: shotLocation, description: sceneDesc } = parseSceneInfo(storyboard.scene);
        
        // 检查是否有时间点描述格式（如 "0-3s：【全景】... 3-6s：【中景】..."）
        const legacyTimeShots = parseTimeDescriptions(sceneDesc);
        if (legacyTimeShots.length > 0) {
          console.log('[分镜视频] 检测到时间点描述格式（旧），共', legacyTimeShots.length, '个分镜');
          
          // 使用时间点描述构建提示词（12s 一个视频，包含多个镜头）
          // 结合角色立绘外观描述
          const legacyChars = (storyboard.characters || []).map((c: string | { name: string }) => 
            typeof c === 'string' ? c : c?.name
          ).filter(Boolean) as string[];
          const legacyCharactersWithAppearance = legacyChars.map(name => ({
            name,
            appearance: extractCharacterAppearance(name),
          }));
          rawPrompt = buildPromptFromTimeShots(legacyTimeShots, shotLocation, {
            characters: legacyCharactersWithAppearance,
          });
          
          // 合并时间点中的对话
          const timeShotDialogues = mergeTimeShotDialogues(legacyTimeShots);
          if (timeShotDialogues.length > 0) {
            shotDialogues = timeShotDialogues as typeof shotDialogues;
            console.log('[分镜视频] 使用时间点解析出的对话:', shotDialogues);
          }
        }
        // 优先使用顶配爆款版字段
        const sbScene = storyboard.scene as string | undefined;
        const sbAction = storyboard.action as string | undefined;
        const sbCameraMovement = storyboard.cameraMovement as string | undefined;
        const sbCloseup = storyboard.closeup as string | undefined;
        const sbStyle = storyboard.style as string | undefined;
        const sbBgmAtmosphere = storyboard.bgmAtmosphere as string | undefined;
        
        if (sbScene && sbAction) {
          // 使用顶配爆款版字段构建提示词
          if (sbStyle) rawPrompt += sbStyle;
          rawPrompt += `，${sbScene}`;
          if (sbCameraMovement) rawPrompt += `，${sbCameraMovement}`;
          rawPrompt += `，${sbAction}`;
          if (sbCloseup) rawPrompt += `，${sbCloseup}`;
          if (sbBgmAtmosphere) rawPrompt += `。氛围：${sbBgmAtmosphere}`;
        } else if (videoGen?.prompt) {
          // 兼容：使用 videoGeneration.prompt
          rawPrompt = videoGen.prompt as string;
        } else if (storyboard.visualPrompt) {
          // 兼容：使用 visualPrompt
          rawPrompt = storyboard.visualPrompt as string;
        } else if (typeof storyboard.scene === 'string') {
          // 兼容：使用 scene 字符串
          rawPrompt = storyboard.scene;
        } else if (storyboard.scene && typeof storyboard.scene === 'object') {
          // 兼容：使用 scene.description
          rawPrompt = (storyboard.scene as Record<string, unknown>)?.description as string || '';
        }
        
        // 兼容处理对话
        if (shotDialogues.length === 0) {
          shotDialogues = (storyboard.dialogues as typeof shotDialogues) || 
            (storyboard.dialogue ? [storyboard.dialogue as { speaker: string; content: string }] : []);
        }
      }
      
      if (!rawPrompt) {
        toast.error('分镜缺少描述，无法生成视频');
        return;
      }
      
      // 兼容 characters 的两种格式：字符串数组 ["沈砚", "丫鬟"] 或对象数组 [{ name: "沈砚" }]
      const rawCharacters = storyboard.characters || [];
      let shotCharacterNames: string[] = [];
      let shotCharacters: Array<{ name: string }>;
      
      if (rawCharacters.length > 0) {
        const firstChar = rawCharacters[0];
        if (typeof firstChar === 'string') {
          // 字符串数组格式：["沈砚", "丫鬟"]
          shotCharacterNames = rawCharacters as unknown as string[];
          shotCharacters = shotCharacterNames.map(name => ({ name }));
        } else if (typeof firstChar === 'object' && firstChar !== null && 'name' in firstChar) {
          // 对象数组格式：[{ name: "沈砚" }]
          shotCharacters = rawCharacters as unknown as Array<{ name: string }>;
          shotCharacterNames = shotCharacters.map(c => c.name);
        } else {
          shotCharacters = [];
          shotCharacterNames = [];
        }
      } else {
        shotCharacters = [];
        shotCharacterNames = [];
      }
      
      console.log('[分镜视频] 原始 characters:', rawCharacters);
      console.log('[分镜视频] 解析后的角色名:', shotCharacterNames);
      
      // 在提示词开头明确镜头中的人物
      if (shotCharacterNames.length > 0) {
        rawPrompt = `镜头中有${shotCharacterNames.join('和')}。${rawPrompt}`;
      }
      
      // 如果没有从时间点解析到对话，则使用原有的对话数据
      if (shotDialogues.length === 0) {
        shotDialogues = (storyboard.dialogues as Array<{ speaker: string; content: string }>) || 
          (storyboard.dialogue ? [storyboard.dialogue as { speaker: string; content: string }] : []);
      }
      
      // 从对话中提取说话人，合并到角色列表（确保所有说话人都在镜头角色中）
      if (shotDialogues.length > 0) {
        const speakersFromDialogues = shotDialogues
          .map(d => d.speaker)
          .filter((s): s is string => !!s && s !== '旁白');
        
        // 合并并去重
        const mergedNames = [...new Set([...shotCharacterNames, ...speakersFromDialogues])];
        if (mergedNames.length > shotCharacterNames.length) {
          console.log('[分镜视频] 从对话中补充角色:', speakersFromDialogues.filter(s => !shotCharacterNames.includes(s)));
          shotCharacterNames = mergedNames;
          shotCharacters = mergedNames.map(name => ({ name }));
        }
        
        // 注意：对话内容将在 buildEnhancedPrompt 函数中统一处理，这里不再添加到 rawPrompt
      }
      
      console.log('[分镜视频] 镜头角色:', shotCharacterNames);
      console.log('[分镜视频] 对话数据:', shotDialogues);
      console.log('[分镜视频] 可用立绘列表:', characterArtworks.map(a => ({ name: a.character_name, purpose: a.purpose, hasImage: !!a.imageUrl })));
      
      // 获取场景时间（日/夜）
      const shotTimeOfDay = (storyboard.scene as Record<string, unknown>)?.time as string || '';
      
      // 创建角色立绘图片URL映射
      const characterImageUrls = new Map<string, string>();
      for (const charName of shotCharacterNames) {
        // 1. 先尝试精确匹配
        let artwork = characterArtworks.find(a => 
          a.character_name === charName && 
          (a.purpose?.includes('正面') || a.purpose === '角色正面照')
        ) || characterArtworks.find(a => a.character_name === charName);
        
        // 2. 如果精确匹配失败，尝试模糊匹配（角色名包含关系）
        if (!artwork) {
          artwork = characterArtworks.find(a => 
            (a.character_name.includes(charName) || charName.includes(a.character_name)) &&
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => 
            a.character_name.includes(charName) || charName.includes(a.character_name)
          );
          if (artwork) {
            console.log(`[分镜视频] 角色 "${charName}" 使用模糊匹配找到立绘: "${artwork.character_name}"`);
          }
        }
        
        if (artwork?.imageUrl) {
          characterImageUrls.set(charName, artwork.imageUrl);
          console.log(`[分镜视频] 角色 "${charName}" 找到立绘图片`);
        } else {
          console.log(`[分镜视频] 角色 "${charName}" 未找到立绘图片`);
        }
      }
      
      console.log('[分镜视频] 角色立绘映射:', Object.fromEntries(characterImageUrls));
      
      // 匹配场景图片
      const sceneImageUrl = matchSceneImage(shotLocation);
      
      // 确定首帧图片策略：
      // 重要：始终优先使用场景图片作为首帧，避免角色立绘无地面导致人物陷进地下
      // 角色立绘仅作为参考图传递，不作为首帧
      let shotFirstFrameUrl: string | undefined = undefined;
      let shotCharacterImageUrl: string | undefined = undefined;
      
      // 收集所有出场角色的立绘URL
      const shotCharArtworks: string[] = [];
      for (const charName of shotCharacterNames) {
        const artwork = characterImageUrls.get(charName);
        if (artwork) {
          shotCharArtworks.push(artwork);
        }
      }
      
      // 首帧策略：优先使用场景图片（含地面和环境），角色立绘作为参考
      if (sceneImageUrl) {
        shotFirstFrameUrl = sceneImageUrl;
        // 第一个角色的立绘作为参考图
        if (shotCharArtworks.length > 0) {
          shotCharacterImageUrl = shotCharArtworks[0];
        }
        console.log(`[分镜视频] 使用场景图片作为首帧${shotCharArtworks.length > 0 ? '，角色立绘作为参考' : ''}`);
      } else if (shotCharArtworks.length > 0) {
        // 没有场景图片时，不使用角色立绘作为首帧（会导致人物陷进地下）
        // 仅将角色立绘作为参考图传递，让模型根据提示词自由生成场景
        shotFirstFrameUrl = undefined;
        shotCharacterImageUrl = shotCharArtworks[0];
        console.log(`[分镜视频] 无场景图片，不使用首帧，角色立绘仅作为参考图`);
      } else {
        console.log(`[分镜视频] 无首帧图片可用`);
      }
      
      // 检查是否为管理员
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const isAdminUser = user?.id === 'admin' || user?.isAdmin === true;
      const currentUserId = user?.id || 'dev-user';

      // 获取用户视频模型和画质配置
      const userVideoModel = user?.video_model || 'doubao-seedance-2-0-260128';
      const userVideoQuality = user?.video_quality || '720p'; // 默认720p
      
      // 视频时长：根据视频模型决定
      // Seedance 2.0 最大支持15秒（仅管理员可用）
      // Seedance 1.5 Pro 最大支持12秒
      // 不再依赖分镜数据中的 duration 字段
      const baseDuration = getVideoModelMaxDuration(userVideoModel);

      // 构建增强的提示词（新格式，包含角色立绘标记和超链接）
      const enhancedPrompt = buildEnhancedPrompt(rawPrompt as string, shotCharacters, {
        episodeNumber: viewingEpisode.episode_number,
        storyboardIndex: storyboardIndex,
        duration: baseDuration,
        timeOfDay: shotTimeOfDay,
        sceneImageUrl: shotFirstFrameUrl,
        sceneLocation: shotLocation,  // 添加场景位置
        characterImageUrls: characterImageUrls,
        dialogues: shotDialogues,
        // 电影感增强：传递镜头类型、情绪氛围
        shotType: storyboard.cameraMovement as string || storyboard.closeup as string || '',
        mood: storyboard.bgmAtmosphere as string || (storyboard.style as string) || '',
        emotion: (storyboard as Record<string, unknown>).emotion as string || '',
        imageStyle: selectedSeries?.image_style || 'realistic',
      });
      
      console.log('[分镜视频] 增强提示词:', enhancedPrompt);
      console.log('[分镜视频] 角色立绘URL:', shotCharacterImageUrl);
      console.log('[分镜视频] 场景图片URL:', sceneImageUrl);
      console.log('[分镜视频] 最终首帧URL:', shotFirstFrameUrl);
      console.log('[分镜视频] 管理员:', isAdminUser, '用户ID:', currentUserId, '视频模型:', userVideoModel, '画质:', userVideoQuality);

      // 添加重试机制处理504超时
      const maxRetries = 2;
      let lastError: Error | null = null;
      
      for (let retry = 0; retry <= maxRetries; retry++) {
        if (retry > 0) {
          console.log(`[分镜视频] 重试 ${retry}/${maxRetries}，等待 ${retry * 3} 秒...`);
          await new Promise(resolve => setTimeout(resolve, retry * 3000));
        }
        
        try {
          // 后台任务模式：切换页面不影响生成进度
          const response = await runGenerationTaskFetch('video', selectedSeries.id, {
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': currentUserId,
              'x-user-video-model': userVideoModel, // 传递用户视频模型
            },
            body: JSON.stringify({
              prompt: enhancedPrompt,
              duration: baseDuration,  // 传递原始时长，后端根据模型调整（普通用户12s，管理员2.0模型15s）
              ratio: '16:9',
              resolution: userVideoQuality, // 使用用户选择的画质
              generateAudio: true,
              title: `${selectedSeries.title}-第${viewingEpisode.episode_number}集-分镜${storyboardIndex + 1}`,
              seriesId: selectedSeries.id,
              episodeNumber: viewingEpisode.episode_number,
              storyboardId: storyboard.id,
              hookType: 'storyboard',
              sortOrder: storyboardIndex,
              cameraMovement: videoGen?.cameraMovement || storyboard.cameraMovement,
              firstFrameUrl: shotFirstFrameUrl,
              referenceImageUrls: shotCharArtworks,
              model: userVideoModel, // 显式传递模型
            }),
          });

          // 检查响应状态
          if (!response.ok) {
            const text = await response.text();
            console.error(`[分镜视频] 请求失败 (尝试 ${retry + 1}):`, response.status, text.substring(0, 500));
            
            // 如果是504超时且还有重试次数，继续重试
            if (response.status === 504 && retry < maxRetries) {
              lastError = new Error(`请求超时 (504): ${retry + 1}/${maxRetries}`);
              continue;
            }
            
            throw new Error(`请求失败: ${response.status}`);
          }

          const data = await response.json();
          
          // 异步任务：智谱，需要轮询查询状态
          if (data.taskId && data.solution === 'zhipu') {
            console.log(`[分镜视频] 智谱异步任务创建: ${data.taskId}`);
            
            // 构建查询URL，传递保存参数（包含prompt用于视频描述）
            const queryParams = new URLSearchParams({
              save: 'true',
              title: `${selectedSeries.title}-第${viewingEpisode.episode_number}集-分镜${storyboardIndex + 1}`,
              prompt: enhancedPrompt.substring(0, 500),
              seriesId: selectedSeries.id,
              episodeNumber: String(viewingEpisode.episode_number),
              solution: 'zhipu',
              hookType: 'storyboard',
              sortOrder: String(storyboardIndex),
              ...(storyboard.id && { storyboardId: storyboard.id }),
            });
            
            // 轮询查询任务状态，最多等待15分钟
            const maxPollTime = 15 * 60 * 1000;
            const pollInterval = 5000;
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxPollTime) {
              try {
                const statusResponse = await fetch(`/api/videos/task/${data.taskId}?${queryParams.toString()}`);
                const statusData = await statusResponse.json();
                
                console.log(`[分镜视频] 任务状态: ${statusData.status}`, statusData.saved ? '(已保存)' : '');
                
                // 智谱成功状态
                if (statusData.status === 'SUCCESS' && statusData.videoUrl) {
                  toast.success(`分镜 ${storyboardIndex + 1} 视频生成成功！`);
                  
                  // 标记此分镜视频已生成成功
                  if (storyboard.id) {
                    setGeneratedStoryboardIds(prev => new Set(prev).add(storyboard.id));
                  }
                  
                  // 刷新视频列表
                  loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
                  break;
                }
                
                // 失败状态
                if (statusData.status === 'FAILED') {
                  toast.error(`分镜 ${storyboardIndex + 1} 视频生成失败`);
                  break;
                }
                
                // 继续等待
                await new Promise(resolve => setTimeout(resolve, pollInterval));
              } catch (pollError) {
                console.error('[分镜视频] 查询状态失败:', pollError);
                // 继续尝试查询
                await new Promise(resolve => setTimeout(resolve, pollInterval));
              }
            }
            
            // while 循环结束后检查是否超时
            toast.error(`分镜 ${storyboardIndex + 1} 视频生成超时，请稍后刷新查看`);
          } else if (data.videoUrl) {
            // 即时任务，直接获取视频URL
            toast.success(`分镜 ${storyboardIndex + 1} 视频生成成功！`);
            
            // 标记此分镜视频已生成成功
            if (storyboard.id) {
              setGeneratedStoryboardIds(prev => new Set(prev).add(storyboard.id));
            }
            
            // 刷新视频列表
            loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
          } else {
            // 其他情况（可能不支持的地区等）
            console.warn('[分镜视频] 意外的响应格式:', data);
            toast.warning('视频生成接口暂不支持当前地区，请联系管理员');
          }
        } catch (videoError) {
          console.error('[分镜视频] 视频生成异常:', videoError);
          // 如果还有重试次数，继续重试
          if (retry < maxRetries) {
            lastError = videoError instanceof Error ? videoError : new Error(String(videoError));
            continue;
          }
          toast.error('视频生成失败');
        }
        
        // 如果成功，break退出重试循环
        break;
      } // 结束重试循环
      
      // 所有重试都失败
      if (lastError) {
        console.error('[分镜视频] 所有重试都失败:', lastError);
        toast.error(`分镜 ${storyboardIndex + 1} 视频生成失败，请稍后重试`);
      }
    } catch (error) {
      console.error('生成视频失败:', error);
      toast.error('生成视频失败');
    } finally {
      setGeneratingStoryboardIndex(null);
    }
  };

  // 生成开篇钩子视频
  const generateHookVideo = async () => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    if (!viewingEpisode.hook) {
      toast.error('开篇钩子内容不存在，请先生成');
      return;
    }

    // 检查是否已有开篇钩子视频（防止重复生成）
    if (hookVideoGenerated) {
      if (!confirm('开篇钩子视频已存在，是否要重新生成？')) {
        return;
      }
    }

    setGeneratingHook(true);
    setVideoTotalTasks(1);
    setVideoCompletedTasks(0);
    setVideoGeneratingProgress(10);
    toast.info('正在生成开篇钩子视频...', { duration: 2000 });

    try {
      // ========== 获取立绘和场景图片数据（用于视频生成参考） ==========
      let characterArtworks: Array<{
        character_name: string;
        character_id: string;
        imageUrl: string;
        purpose: string;
        generation_prompt?: string;
        description?: string;
      }> = [];
      let sceneImages: Array<{
        title: string;
        imageUrl: string;
        description: string;
      }> = [];
      
      try {
        const userInfo = (() => {
          try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
          } catch {
            return null;
          }
        })();
        const userId = userInfo?.id;
        
        const artworkResponse = await fetch(`/api/drama/series/${selectedSeries.id}/artwork`, {
          headers: userId ? { 'x-user-id': userId } : undefined,
        });
        if (artworkResponse.ok) {
          const artworkData = await artworkResponse.json();
          if (artworkData.success) {
            characterArtworks = artworkData.characters || [];
            sceneImages = artworkData.scenes || [];
            console.log(`[开篇钩子视频] 获取到 ${characterArtworks.length} 个角色立绘, ${sceneImages.length} 个场景图片`);
          }
        }
      } catch (e) {
        console.warn('[开篇钩子视频] 获取立绘数据失败，将使用纯文本提示词:', e);
      }

      // ========== 解析 hook 数据 ==========
      const matchSceneImage = (location: string): string | undefined => {
        if (!location || sceneImages.length === 0) return undefined;
        const locationKeywords = location.replace(/[门口内外前侧后上下]/g, '').trim();
        const keywords = locationKeywords.split(/[，,、\s]+/).filter(k => k.length > 1);
        for (const keyword of keywords) {
          const matched = sceneImages.find(scene => 
            scene.title.includes(keyword) || 
            scene.description?.includes(keyword)
          );
          if (matched) return matched.imageUrl;
        }
        return undefined;
      };

      const extractCharacterAppearance = (characterName: string): string => {
        if (!characterName) return '';
        
        // 方式1：从立绘的 generation_prompt 中提取
        if (characterArtworks.length > 0) {
          const artwork = characterArtworks.find(a => 
            a.character_name === characterName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === characterName);
          
          if (artwork?.generation_prompt) {
            const prompt = artwork.generation_prompt;
            const appearanceParts: string[] = [];
            const hairstyleMatch = prompt.match(/发型[：:]\s*([^，,。；;]+)/);
            if (hairstyleMatch) appearanceParts.push(hairstyleMatch[1].trim());
            const clothingMatch = prompt.match(/服装[：:]\s*([^，,。；;]+)/);
            if (clothingMatch) appearanceParts.push(clothingMatch[1].trim());
            const skinMatch = prompt.match(/肤色[：:]\s*([^，,。；;]+)/);
            if (skinMatch) appearanceParts.push(skinMatch[1].trim());
            const temperamentMatch = prompt.match(/气质[：:]\s*([^，,。；;]+)/);
            if (temperamentMatch) appearanceParts.push(temperamentMatch[1].trim());
            if (appearanceParts.length > 0) {
              return appearanceParts.join('，');
            }
          }
        }
        
        // 方式2：从角色配置中获取（如果没有立绘）
        const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
        if (seriesChar) {
          const char = seriesChar as Record<string, unknown>;
          const appearanceParts: string[] = [];
          if (char.hairstyle) appearanceParts.push(`发型${char.hairstyle}`);
          if (char.clothing) appearanceParts.push(`服装${char.clothing}`);
          if (char.skinTone) appearanceParts.push(`肤色${char.skinTone}`);
          if (char.temperament) appearanceParts.push(`气质${char.temperament}`);
          if (char.characteristic) appearanceParts.push(`特征${char.characteristic}`);
          if (appearanceParts.length > 0) {
            return appearanceParts.join('，');
          }
        }
        
        return '';
      };

      // 获取角色音色描述
      const getCharacterVoiceDescription = (characterName: string, emotion?: string, speechRate?: string): string => {
        if (!characterName) return '';
        // 从 selectedSeries 的 characters 中查找
        const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
        if (seriesChar && 'voiceDescription' in seriesChar) {
          const voiceDesc = (seriesChar as { voiceDescription?: string }).voiceDescription || '';
          if (voiceDesc) return voiceDesc;
        }
        // 如果没有预设音色，使用情绪和语速构建音色描述
        if (emotion || speechRate) {
          const voiceParts: string[] = [];
          if (emotion) voiceParts.push(emotion);
          if (speechRate) voiceParts.push(speechRate);
          return voiceParts.join('，');
        }
        return '';
      };

      /**
       * 构建视频生成提示词（新格式）
       * 格式：第x集第x分镜: 10s，时间：日，场景图片：链接。角色名"角色立绘"说：「台词」音色：音色描述
       */
      const buildEnhancedPrompt = (
        basePrompt: string,
        characters: Array<{ name: string }>,
        options?: {
          episodeNumber?: number;
          storyboardIndex?: number;
          duration?: number;
          timeOfDay?: string;
          sceneImageUrl?: string;
          sceneLocation?: string;  // 新增：场景位置名称
          characterImageUrls?: Map<string, string>;
          dialogues?: Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>;
          mood?: string;       // 情绪氛围
          emotion?: string;    // 核心情绪
          shotType?: string;   // 镜头类型
          imageStyle?: string; // 图片风格：realistic（真人风）或 comic（漫画风）
        }
      ): string => {
        // 1. 构建基础信息行
        const parts: string[] = [];

        // 根据图片风格选择不同的视觉基底提示词
        const imageStyle = options?.imageStyle || selectedSeries?.image_style || 'realistic';
        if (imageStyle === 'comic') {
          // 漫画风：动漫风格
          parts.push('精致动漫风格，高质量二次元插画，精美细腻的动漫人物，日系动漫风格，赛璐璐渲染，漫画分镜质感，精美线条，鲜艳色彩，动漫人物特征，大眼睛，精致五官，流畅发丝，IMAX电影质感，动态流畅，运镜丝滑，无字幕，角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，');
        } else {
          // 真人风：真人实拍摄影风格
          parts.push('真人实拍摄影风格，专业人像摄影，真实人物质感，真实皮肤纹理，自然毛孔，细腻肤质，真实毛发，自然光影，专业摄影布光，浅景深虚化，胶片质感，IMAX电影质感，35mm镜头，f4光圈，动态流畅，运镜丝滑，无字幕，角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，');
        }

        // 集数和分镜号
        if (options?.episodeNumber !== undefined) {
          const storyboardLabel = options.storyboardIndex === -1 ? '开篇钩子' :
                                  options.storyboardIndex === -2 ? '结尾悬念' :
                                  `${options.storyboardIndex}`;
          parts.push(`第${options.episodeNumber}集第${storyboardLabel}分镜`);
        }

        // 时长
        if (options?.duration) {
          parts.push(`${options.duration}s`);
        }

        // 时间
        if (options?.timeOfDay) {
          parts.push(`时间：${options.timeOfDay}`);
        }

        // 场景位置（使用@格式作为超链接标记）
        if (options?.sceneLocation) {
          parts.push(`@${options.sceneLocation}`);
        }

        // 注意：sceneImageUrl 通过 firstFrameUrl 参数传递给视频API，不需要添加到文本中

        // 2. 构建角色外观描述
        const characterDescriptions: string[] = [];
        for (const char of characters) {
          const appearance = extractCharacterAppearance(char.name);

          if (appearance) {
            characterDescriptions.push(`@${char.name}：${appearance}`);
          }
        }

        // 3. 构建对话部分（新格式，使用@格式作为超链接标记）
        const dialogueParts: string[] = [];
        if (options?.dialogues && options.dialogues.length > 0) {
          for (const d of options.dialogues) {
            const speaker = d.speaker;
            const content = d.content;

            // 构建角色名部分（使用@格式作为超链接标记）
            const speakerLabel = `@${speaker}`;

            // 获取音色描述
            const voiceDesc = getCharacterVoiceDescription(speaker, d.emotion, d.speechRate);

            // 构建完整对话行
            dialogueParts.push(`${speakerLabel}说：「${content}」音色：${voiceDesc}`);
          }
        }

        // 4. 组装最终提示词
        const result: string[] = [];

        // 第一行：基础信息
        if (parts.length > 0) {
          result.push(parts.join('，') + '。');
        }

        // 角色外观描述（作为背景信息）
        if (characterDescriptions.length > 0) {
          result.push(`【角色外观】${characterDescriptions.join('；')}。`);
        }

        // 修复：无论是否有对话，都要输出 basePrompt（场景描述）
        if (basePrompt) {
          result.push(basePrompt);
        }
        // 对话部分（如果有对话，添加在场景描述之后）
        if (dialogueParts.length > 0) {
          result.push(`【对话】${dialogueParts.join(' ')}`);
        }

        // 电影镜头与情绪引导（增强视频模型对情感和镜头的理解）
        if (options?.mood || options?.emotion || options?.shotType) {
          const guidanceParts: string[] = [];
          if (options.shotType) guidanceParts.push(`镜头：${options.shotType}`);
          if (options.mood) guidanceParts.push(`氛围：${options.mood}`);
          if (options.emotion) guidanceParts.push(`情绪：${options.emotion}`);
          if (guidanceParts.length > 0) {
            result.push(`【导演指导】${guidanceParts.join('，')}，演员表情细腻真实，微表情传达内心活动。角色双脚站稳地面，身体比例协调，不陷地不悬浮。`);
          }
        }

        return result.join('\n');
      };

      // ========== 解析 hook 数据 ==========
      let hookData: HookCliffhangerData;
      if (typeof viewingEpisode.hook === 'string') {
        try {
          const parsed = JSON.parse(viewingEpisode.hook);
          hookData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
        } catch {
          hookData = { scene: { description: viewingEpisode.hook } };
        }
      } else {
        hookData = viewingEpisode.hook;
      }

      // ========== 获取用户信息 ==========
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // ========== 检查是否有多场景开篇钩子 ==========
      const hookScenes = hookData.scenes as Array<{
        sceneIndex?: number;
        scene?: { location: string; description: string };
        characters?: string[];
        visualPrompt?: string;
        characterAction?: string;
        cinematicShot?: string;
        lightingDesign?: string;
        shotType?: string;
        cameraMovement?: string;
        duration?: string;
        dialogues?: Array<{ speaker: string; content: string; emotion?: string; isOffScreen?: boolean }>;
      }> | undefined;

      // ========== 获取用户视频模型配置（用于视频时长决定） ==========
      // 注意：这个变量需要在 if/else 分支之前定义，确保所有分支都能访问
      const userVideoModel = user?.video_model || 'doubao-seedance-2-0-260128';
      
      // 视频时长：根据视频模型决定
      // Seedance 2.0 最大支持15秒（仅管理员可用）
      // Seedance 1.5 Pro 最大支持12秒
      const baseHookDuration = getVideoModelMaxDuration(userVideoModel);
      
      console.log('[开篇钩子视频] 用户ID:', currentUserId, '视频模型:', userVideoModel, '基础时长:', baseHookDuration);

      // 开篇钩子只生成1个视频
      // 准备变量：无论多场景还是单场景，最终都生成1个视频
      const hookDuration = baseHookDuration;
      let hookPrompt: string;
      let hookDialogues: Array<{ speaker?: string; content?: string; emotion?: string; speechRate?: string; isOffScreen?: boolean }>;
      let hookLocation: string;
      const hookSceneImageUrl: string | undefined = (() => {
        const loc = hookScenes?.[0]?.scene?.location || hookData.location || '';
        return matchSceneImage(loc);
      })();
      const hookCharacterImageUrls = new Map<string, string>();
      let hookCharacters: string[] = [];
      let hookFirstFrameUrl: string | undefined = undefined;
      
      if (hookScenes && hookScenes.length > 0) {
        // ========== 多场景合并：所有场景信息合并为一个提示词 ==========
        console.log(`[开篇钩子视频] 检测到多场景开篇钩子(${hookScenes.length}个)，合并为1个视频`);
        
        hookCharacters = [...new Set(hookScenes.flatMap(s => [
          ...(s.characters || []) as string[],
          ...(s.dialogues || []).filter((d: { isOffScreen?: boolean; speaker?: string }) => !d.isOffScreen && d.speaker && d.speaker !== '旁白').map((d: { speaker: string }) => d.speaker)
        ]))];
        hookDialogues = hookScenes.flatMap(s => s.dialogues || []);
        hookLocation = hookScenes[0]?.scene?.location || '';
        hookPrompt = hookScenes.map(s => s.visualPrompt || s.scene?.description || '').filter(Boolean).join('。');
        
        // 匹配角色立绘
        for (const charName of hookCharacters) {
          let artwork = characterArtworks.find(a => 
            a.character_name === charName && (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          if (!artwork) {
            artwork = characterArtworks.find(a => 
              (a.character_name.includes(charName) || charName.includes(a.character_name)) && (a.purpose?.includes('正面') || a.purpose === '角色正面照')
            ) || characterArtworks.find(a => a.character_name.includes(charName) || charName.includes(a.character_name));
          }
          if (artwork?.imageUrl) hookCharacterImageUrls.set(charName, artwork.imageUrl);
        }
        
        // 确定首帧
        if (hookCharacters.length === 1) {
          hookFirstFrameUrl = hookCharacterImageUrls.get(hookCharacters[0]) || hookSceneImageUrl;
        } else {
          hookFirstFrameUrl = hookSceneImageUrl;
        }
      } else {
        // ========== 单场景开篇钩子（原有逻辑） ==========
        hookPrompt = hookData.visualPrompt || (typeof hookData.scene === 'object' ? hookData.scene?.description : hookData.scene) || '';
        hookDialogues = hookData.dialogues || (hookData.dialogue ? [hookData.dialogue] : []);
        
        // 提取角色列表
        const hookCharList = hookData.characterList as string[] | undefined;
        const hookCharsFromData = hookCharList || (hookData.characters as string[] || []);
        const hookSpeakersFromDialogues = hookDialogues
          .map((d: { speaker?: string }) => d.speaker)
          .filter((s: string | undefined): s is string => !!s && s !== '旁白');
        hookCharacters = [...new Set([...hookCharsFromData, ...hookSpeakersFromDialogues])];
        
        let hookSceneDesc = '';
        if (hookData.location) {
          hookLocation = hookData.location;
          hookSceneDesc = hookData.description || '';
        } else if (typeof hookData.scene === 'object' && hookData.scene !== null) {
          const parsed = parseSceneInfo(hookData.scene);
          hookLocation = parsed.location;
          hookSceneDesc = parsed.description;
        } else {
          const parsed = parseSceneInfo(hookData.scene);
          hookLocation = parsed.location;
          hookSceneDesc = parsed.description;
        }
        
        // 检查 timeDescriptions
        const hookTimeDescriptions = hookData.timeDescriptions as Record<string, string> | string[] | undefined;
        let timeShots: TimeShot[] = [];
        if (hookTimeDescriptions && typeof hookTimeDescriptions === 'object') {
          if (Array.isArray(hookTimeDescriptions)) {
            for (const td of hookTimeDescriptions) {
              const parsed = parseTimeDescriptions(td);
              if (parsed.length > 0) timeShots.push(...parsed);
            }
          } else {
            const timeDescObj = hookTimeDescriptions as Record<string, string>;
            for (const timeRange of Object.keys(timeDescObj)) {
              const descText = timeDescObj[timeRange];
              const parsed = parseTimeDescriptions(`${timeRange}：${descText}`);
              if (parsed.length > 0) timeShots.push(...parsed);
            }
          }
        } else {
          timeShots = parseTimeDescriptions(hookSceneDesc);
        }
        
        if (timeShots.length > 0) {
          // 结合角色立绘外观描述，让视频模型生成与参考图一致的画面
          const hookCharactersWithAppearance = hookCharacters.map(name => ({
            name,
            appearance: extractCharacterAppearance(name),
          }));
          hookPrompt = buildPromptFromTimeShots(timeShots, hookLocation, {
            characters: hookCharactersWithAppearance,
            sceneAtmosphere: hookSceneDesc,
          });
          const timeShotDialogues = mergeTimeShotDialogues(timeShots);
          if (timeShotDialogues.length > 0) {
            hookDialogues = timeShotDialogues as typeof hookDialogues;
          }
        }
        
        // 提取角色
        const speakersFromDialogues = hookDialogues
          .map((d: { speaker?: string; content?: string }) => d.speaker)
          .filter((s): s is string => !!s && s !== '旁白');
        const hookCharacterList = hookData.characterList as string[] | undefined;
        const hookCharactersFromData = hookCharacterList || (hookData.characters as string[] || []);
        hookCharacters = [...new Set([...hookCharactersFromData, ...speakersFromDialogues])];
        
        // 匹配角色立绘
        for (const charName of hookCharacters) {
          let artwork = characterArtworks.find(a => 
            a.character_name === charName && (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          if (!artwork) {
            artwork = characterArtworks.find(a => 
              (a.character_name.includes(charName) || charName.includes(a.character_name)) && (a.purpose?.includes('正面') || a.purpose === '角色正面照')
            ) || characterArtworks.find(a => a.character_name.includes(charName) || charName.includes(a.character_name));
          }
          if (artwork?.imageUrl) hookCharacterImageUrls.set(charName, artwork.imageUrl);
        }
        
        // 确定首帧
        if (hookCharacters.length === 1) {
          hookFirstFrameUrl = hookCharacterImageUrls.get(hookCharacters[0]) || hookSceneImageUrl;
        } else if (hookSceneImageUrl) {
          hookFirstFrameUrl = hookSceneImageUrl;
        }
      }
      
      // 在提示词开头明确镜头中的人物
      if (hookCharacters.length > 0 && !hookPrompt.includes('镜头中有')) {
        hookPrompt = `镜头中有${hookCharacters.join('和')}。${hookPrompt}`;
      }
      
      console.log('[开篇钩子视频] 角色:', hookCharacters, '首帧:', hookFirstFrameUrl ? '有' : '无', '时长:', hookDuration);
      
      const hookCharObjects = hookCharacters.map(name => ({ name }));
      const enhancedPrompt = buildEnhancedPrompt(hookPrompt, hookCharObjects, {
        episodeNumber: viewingEpisode.episode_number,
        storyboardIndex: -1, // 开篇钩子用 -1 表示
        duration: hookDuration,
        sceneImageUrl: hookFirstFrameUrl,
        sceneLocation: hookLocation,
        characterImageUrls: hookCharacterImageUrls,
        dialogues: hookDialogues as Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>,
        // 开篇钩子电影感增强
        shotType: '推镜头',
        mood: '悬疑紧张，命运开场',
        emotion: '震撼',
        imageStyle: selectedSeries?.image_style || 'realistic',
      });
      
      console.log('[开篇钩子视频] 增强提示词:', enhancedPrompt);
      console.log('[开篇钩子视频] 最终首帧URL:', hookFirstFrameUrl);

      // 后台任务模式：切换页面不影响生成进度
      let response;
      try {
        response = await runGenerationTaskFetch('video', selectedSeries.id, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUserId,
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            duration: hookDuration,
            ratio: '16:9',
            resolution: '720p',
            generateAudio: true,
            title: `${selectedSeries.title}-开篇钩子`,
            seriesId: selectedSeries.id,
            episodeNumber: viewingEpisode.episode_number,
            hookType: 'hook',
            sortOrder: -1,
            firstFrameUrl: hookFirstFrameUrl,
            referenceImageUrls: [...new Set([...hookCharacterImageUrls.values()])],
          }),
        });
      } catch (fetchError: unknown) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : '请求失败';
        toast.error(`视频生成请求失败: ${errorMsg}`);
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
        return;
      }

      // 检查响应状态
      if (!response.ok) {
        const text = await response.text();
        console.error('[开篇钩子视频] 请求失败:', response.status, text.substring(0, 500));
        
        // 504 网关超时特殊处理
        if (response.status === 504) {
          toast.error('视频生成超时（服务器处理时间过长），请稍后刷新页面查看结果');
        } else {
          toast.error(`视频生成失败: ${response.status}`);
        }
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
        return;
      }

      const data = await response.json();
      
      // 异步任务：智谱
      if (data.taskId && data.solution === 'zhipu') {
        console.log(`[开篇钩子视频] 智谱异步任务创建: ${data.taskId}`);
        
        const queryParams = new URLSearchParams({
          save: 'true',
          title: `${selectedSeries.title}-开篇钩子`,
          prompt: enhancedPrompt.substring(0, 500),
          seriesId: selectedSeries.id,
          episodeNumber: String(viewingEpisode.episode_number),
          hookType: 'hook',
          sortOrder: '-1',
          solution: 'zhipu',
        });
        
        // 轮询查询任务状态，最多等待15分钟
        const maxPollTime = 15 * 60 * 1000;
        const pollInterval = 5000;
        const startTime = Date.now();
        let pollCount = 0;
        
        while (Date.now() - startTime < maxPollTime) {
          try {
            pollCount++;
            // 更新进度（10% - 90%）
            const progress = Math.min(90, 10 + pollCount * 5);
            setVideoGeneratingProgress(progress);
            
            const statusResponse = await fetch(`/api/videos/task/${data.taskId}?${queryParams.toString()}`);
            const statusData = await statusResponse.json();
            
            // 智谱成功状态
            if (statusData.status === 'SUCCESS' && statusData.videoUrl) {
              setVideoGeneratingProgress(100);
              setVideoCompletedTasks(1);
              toast.success('开篇钩子视频生成成功！');
              setHookVideoGenerated(true);
              loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
              setTimeout(() => {
                setVideoTotalTasks(0);
                setVideoCompletedTasks(0);
                setVideoGeneratingProgress(0);
              }, 2000);
              return;
            }
            
            // 失败状态
            if (statusData.status === 'FAILED') {
              toast.error('开篇钩子视频生成失败');
              setVideoTotalTasks(0);
              setVideoCompletedTasks(0);
              setVideoGeneratingProgress(0);
              return;
            }
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          } catch (pollError) {
            console.error('[开篇钩子视频] 查询状态失败:', pollError);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }
        
        toast.error('开篇钩子视频生成超时，请稍后刷新查看');
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
        return;
      }
      
      // 扣子方案
      if (data.success || data.video) {
        setVideoGeneratingProgress(100);
        setVideoCompletedTasks(1);
        toast.success('开篇钩子视频生成成功！');
        setHookVideoGenerated(true);
        loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
        setTimeout(() => {
          setVideoTotalTasks(0);
          setVideoCompletedTasks(0);
          setVideoGeneratingProgress(0);
        }, 2000);
      } else {
        toast.error(data.error || '视频生成失败');
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
      }
    } catch (error) {
      console.error('生成开篇钩子视频失败:', error);
      toast.error('生成开篇钩子视频失败');
      setVideoTotalTasks(0);
      setVideoCompletedTasks(0);
      setVideoGeneratingProgress(0);
    } finally {
      setGeneratingHook(false);
    }
  };

  // 重新生成结尾悬念剧本
  const [regeneratingCliffhanger, setRegeneratingCliffhanger] = useState(false);
  const regenerateCliffhangerScript = async () => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    setRegeneratingCliffhanger(true);
    toast.info('正在重新生成结尾悬念...', { duration: 2000 });

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch(`/api/drama/series/${selectedSeries.id}/episodes/${viewingEpisode.episode_number}/regenerate-cliffhanger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-user-id': user.id } : {}),
          ...(user?.video_model ? { 'x-user-video-model': user.video_model } : {}),
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '生成失败');
      }

      toast.success('结尾悬念生成成功！');
      // 刷新剧集列表以更新数据
      await loadSeriesList();
    } catch (error) {
      console.error('重新生成结尾悬念失败:', error);
      toast.error(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setRegeneratingCliffhanger(false);
    }
  };

  // 生成结尾悬念视频
  const generateCliffhangerVideo = async () => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    if (!viewingEpisode.cliffhanger) {
      toast.error('结尾悬念内容不存在，请先生成');
      return;
    }

    // 检查是否已有结尾悬念视频（防止重复生成）
    if (cliffhangerVideoGenerated) {
      if (!confirm('结尾悬念视频已存在，是否要重新生成？')) {
        return;
      }
    }

    // 检查是否为管理员
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdminUser = user?.id === 'admin' || user?.isAdmin === true;
    const currentUserId = user?.id || 'dev-user';

    setGeneratingCliffhanger(true);
    setVideoTotalTasks(1);
    setVideoCompletedTasks(0);
    setVideoGeneratingProgress(10);
    toast.info('正在生成结尾悬念视频...', { duration: 2000 });

    console.log('[结尾悬念视频] 管理员:', isAdminUser, '用户ID:', currentUserId);

    try {
      // ========== 获取立绘和场景图片数据（用于视频生成参考） ==========
      let characterArtworks: Array<{
        character_name: string;
        character_id: string;
        imageUrl: string;
        purpose: string;
        generation_prompt?: string;
        description?: string;
      }> = [];
      let sceneImages: Array<{
        title: string;
        imageUrl: string;
        description: string;
      }> = [];
      
      try {
        const userInfo = (() => {
          try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
          } catch {
            return null;
          }
        })();
        const userId = userInfo?.id;
        
        const artworkResponse = await fetch(`/api/drama/series/${selectedSeries.id}/artwork`, {
          headers: userId ? { 'x-user-id': userId } : undefined,
        });
        if (artworkResponse.ok) {
          const artworkData = await artworkResponse.json();
          if (artworkData.success) {
            characterArtworks = artworkData.characters || [];
            sceneImages = artworkData.scenes || [];
            console.log(`[结尾悬念视频] 获取到 ${characterArtworks.length} 个角色立绘, ${sceneImages.length} 个场景图片`);
          }
        }
      } catch (e) {
        console.warn('[结尾悬念视频] 获取立绘数据失败，将使用纯文本提示词:', e);
      }

      // ========== 辅助函数 ==========
      const matchSceneImage = (location: string): string | undefined => {
        if (!location || sceneImages.length === 0) return undefined;
        const locationKeywords = location.replace(/[门口内外前侧后上下]/g, '').trim();
        const keywords = locationKeywords.split(/[，,、\s]+/).filter(k => k.length > 1);
        for (const keyword of keywords) {
          const matched = sceneImages.find(scene => 
            scene.title.includes(keyword) || 
            scene.description?.includes(keyword)
          );
          if (matched) return matched.imageUrl;
        }
        return undefined;
      };

      const extractCharacterAppearance = (characterName: string): string => {
        if (!characterName) return '';
        
        // 方式1：从立绘的 generation_prompt 中提取
        if (characterArtworks.length > 0) {
          const artwork = characterArtworks.find(a => 
            a.character_name === characterName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === characterName);
          
          if (artwork?.generation_prompt) {
            const prompt = artwork.generation_prompt;
            const appearanceParts: string[] = [];
            const hairstyleMatch = prompt.match(/发型[：:]\s*([^，,。；;]+)/);
            if (hairstyleMatch) appearanceParts.push(hairstyleMatch[1].trim());
            const clothingMatch = prompt.match(/服装[：:]\s*([^，,。；;]+)/);
            if (clothingMatch) appearanceParts.push(clothingMatch[1].trim());
            const skinMatch = prompt.match(/肤色[：:]\s*([^，,。；;]+)/);
            if (skinMatch) appearanceParts.push(skinMatch[1].trim());
            const temperamentMatch = prompt.match(/气质[：:]\s*([^，,。；;]+)/);
            if (temperamentMatch) appearanceParts.push(temperamentMatch[1].trim());
            if (appearanceParts.length > 0) {
              return appearanceParts.join('，');
            }
          }
        }
        
        // 方式2：从角色配置中获取（如果没有立绘）
        const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
        if (seriesChar) {
          const char = seriesChar as Record<string, unknown>;
          const appearanceParts: string[] = [];
          if (char.hairstyle) appearanceParts.push(`发型${char.hairstyle}`);
          if (char.clothing) appearanceParts.push(`服装${char.clothing}`);
          if (char.skinTone) appearanceParts.push(`肤色${char.skinTone}`);
          if (char.temperament) appearanceParts.push(`气质${char.temperament}`);
          if (char.characteristic) appearanceParts.push(`特征${char.characteristic}`);
          if (appearanceParts.length > 0) {
            return appearanceParts.join('，');
          }
        }
        
        return '';
      };

      // 获取角色音色描述
      const getCharacterVoiceDescription = (characterName: string, emotion?: string, speechRate?: string): string => {
        if (!characterName) return '';
        const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
        if (seriesChar && 'voiceDescription' in seriesChar) {
          const voiceDesc = (seriesChar as { voiceDescription?: string }).voiceDescription || '';
          if (voiceDesc) return voiceDesc;
        }
        if (emotion || speechRate) {
          const voiceParts: string[] = [];
          if (emotion) voiceParts.push(emotion);
          if (speechRate) voiceParts.push(speechRate);
          return voiceParts.join('，');
        }
        return '';
      };

      /**
       * 构建视频生成提示词（新格式）
       */
      const buildEnhancedPrompt = (
        basePrompt: string,
        characters: Array<{ name: string }>,
        options?: {
          episodeNumber?: number;
          storyboardIndex?: number;
          duration?: number;
          timeOfDay?: string;
          sceneImageUrl?: string;
          sceneLocation?: string;  // 新增：场景位置名称
          characterImageUrls?: Map<string, string>;
          dialogues?: Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>;
          mood?: string;       // 情绪氛围
          emotion?: string;    // 核心情绪
          shotType?: string;   // 镜头类型
          imageStyle?: string; // 图片风格：realistic（真人风）或 comic（漫画风）
        }
      ): string => {
        const opts = options || {};
        const parts: string[] = [];

        // 根据图片风格选择不同的视觉基底提示词
        const imageStyle = opts.imageStyle || 'realistic';
        if (imageStyle === 'comic') {
          // 漫画风：动漫风格
          parts.push('精致动漫风格，高质量二次元插画，精美细腻的动漫人物，日系动漫风格，赛璐璐渲染，漫画分镜质感，精美线条，鲜艳色彩，动漫人物特征，大眼睛，精致五官，流畅发丝，IMAX电影质感，动态流畅，运镜丝滑，无字幕，角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，');
        } else {
          // 真人风：真人实拍摄影风格
          parts.push('真人实拍摄影风格，专业人像摄影，真实人物质感，真实皮肤纹理，自然毛孔，细腻肤质，真实毛发，自然光影，专业摄影布光，浅景深虚化，胶片质感，IMAX电影质感，35mm镜头，f4光圈，动态流畅，运镜丝滑，无字幕，角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，');
        }

        // 集数和分镜号
        if (opts.episodeNumber !== undefined) {
          const storyboardLabel = opts.storyboardIndex === -1 ? '开篇钩子' :
                                  opts.storyboardIndex === -2 ? '结尾悬念' :
                                  `${opts.storyboardIndex}`;
          parts.push(`第${opts.episodeNumber}集第${storyboardLabel}分镜`);
        }

        if (opts.duration) {
          parts.push(`${opts.duration}s`);
        }

        // 时间
        if (opts.timeOfDay) {
          parts.push(`时间：${opts.timeOfDay}`);
        }

        // 场景位置（使用@格式作为超链接标记）
        if (opts.sceneLocation) {
          parts.push(`@${opts.sceneLocation}`);
        }

        // 角色外观描述
        const characterDescriptions: string[] = [];
        for (const char of characters) {
          const appearance = extractCharacterAppearance(char.name);

          if (appearance) {
            characterDescriptions.push(`@${char.name}：${appearance}`);
          }
        }

        // 对话部分（使用@格式作为超链接标记）
        const dialogueParts: string[] = [];
        if (opts.dialogues && opts.dialogues.length > 0) {
          for (const d of opts.dialogues) {
            const speaker = d.speaker;
            const content = d.content;

            const speakerLabel = `@${speaker}`;
            const voiceDesc = getCharacterVoiceDescription(speaker, d.emotion, d.speechRate);
            dialogueParts.push(`${speakerLabel}说：「${content}」音色：${voiceDesc}`);
          }
        }

        // 组装
        const result: string[] = [];
        if (parts.length > 0) {
          result.push(parts.join('，') + '。');
        }
        if (characterDescriptions.length > 0) {
          result.push(`【角色外观】${characterDescriptions.join('；')}。`);
        }
        // 修复：无论是否有对话，都要输出 basePrompt（场景描述）
        if (basePrompt) {
          result.push(basePrompt);
        }
        // 对话部分（如果有对话，添加在场景描述之后）
        if (dialogueParts.length > 0) {
          result.push(`【对话】${dialogueParts.join(' ')}`);
        }

        // 电影镜头与情绪引导
        if (opts.mood || opts.emotion || opts.shotType) {
          const guidanceParts: string[] = [];
          if (opts.shotType) guidanceParts.push(`镜头：${opts.shotType}`);
          if (opts.mood) guidanceParts.push(`氛围：${opts.mood}`);
          if (opts.emotion) guidanceParts.push(`情绪：${opts.emotion}`);
          if (guidanceParts.length > 0) {
            result.push(`【导演指导】${guidanceParts.join('，')}，演员表情细腻真实，微表情传达内心活动。角色双脚站稳地面，身体比例协调，不陷地不悬浮。`);
          }
        }

        return result.join('\n');
      };

      // ========== 解析 cliffhanger 数据 ==========
      let cliffhangerData: HookCliffhangerData;
      if (typeof viewingEpisode.cliffhanger === 'string') {
        try {
          const parsed = JSON.parse(viewingEpisode.cliffhanger);
          cliffhangerData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
        } catch {
          cliffhangerData = { scene: { description: viewingEpisode.cliffhanger } };
        }
      } else {
        cliffhangerData = viewingEpisode.cliffhanger;
      }

      // 获取 cliffhanger 的视频提示词
      let cliffhangerPrompt = cliffhangerData.visualPrompt || '';
      
      // 获取用户视频模型配置
      const userVideoModel = user?.video_model || 'doubao-seedance-2-0-260128';
      
      // 视频时长：根据视频模型决定
      // Seedance 2.0 最大支持15秒（仅管理员可用）
      // Seedance 1.5 Pro 最大支持12秒
      // 不再依赖 cliffhangerData 中的 duration 字段
      const cliffhangerDuration = getVideoModelMaxDuration(userVideoModel);
      
      console.log('[结尾悬念视频] 视频模型:', userVideoModel, '时长:', cliffhangerDuration);
      
      // 获取 cliffhanger 的场景信息（新格式使用 location 和 description 字段）
      let cliffhangerLocation = '';
      let cliffhangerSceneDesc = '';
      
      // 检查是否为新格式（包含 location 和 description 字段）
      if (cliffhangerData.location) {
        cliffhangerLocation = cliffhangerData.location;
        cliffhangerSceneDesc = cliffhangerData.description || '';
      } else if (typeof cliffhangerData.scene === 'object' && cliffhangerData.scene !== null) {
        // 旧格式兼容
        const parsed = parseSceneInfo(cliffhangerData.scene);
        cliffhangerLocation = parsed.location;
        cliffhangerSceneDesc = parsed.description;
      } else {
        const parsed = parseSceneInfo(cliffhangerData.scene);
        cliffhangerLocation = parsed.location;
        cliffhangerSceneDesc = parsed.description;
      }
      
      // 检查是否有 timeDescriptions 字段（新格式：可能是对象或数组）
      const cliffhangerTimeDescriptions = cliffhangerData.timeDescriptions as Record<string, string> | string[] | undefined;
      
      // 处理对话（优先使用 dialogues 数组，兼容旧的单 dialogue 字段）
      let cliffhangerDialogues = cliffhangerData.dialogues || (cliffhangerData.dialogue ? [cliffhangerData.dialogue] : []);
      
      // 检查是否有时间点描述
      let cliffhangerTimeShots: TimeShot[] = [];
      if (cliffhangerTimeDescriptions && typeof cliffhangerTimeDescriptions === 'object') {
        if (Array.isArray(cliffhangerTimeDescriptions)) {
          // 数组格式（旧兼容）
          console.log('[结尾悬念视频] 检测到 timeDescriptions 数组格式，共', cliffhangerTimeDescriptions.length, '个时间点');
          for (const td of cliffhangerTimeDescriptions) {
            const parsed = parseTimeDescriptions(td);
            if (parsed.length > 0) {
              cliffhangerTimeShots.push(...parsed);
            }
          }
        } else {
          // 对象格式（新格式）
          const timeDescObj = cliffhangerTimeDescriptions as Record<string, string>;
          console.log('[结尾悬念视频] 检测到 timeDescriptions 对象格式，共', Object.keys(timeDescObj).length, '个时间点');
          for (const timeRange of Object.keys(timeDescObj)) {
            const descText = timeDescObj[timeRange];
            const parsed = parseTimeDescriptions(`${timeRange}：${descText}`);
            if (parsed.length > 0) {
              cliffhangerTimeShots.push(...parsed);
            }
          }
        }
      } else if (!cliffhangerPrompt) {
        // 从 scene 字段解析（旧格式兼容）
        cliffhangerTimeShots = parseTimeDescriptions(cliffhangerSceneDesc);
      }
      
      if (cliffhangerTimeShots.length > 0) {
        console.log('[结尾悬念视频] 检测到时间点描述格式，共', cliffhangerTimeShots.length, '个分镜');
        
        // 使用时间点描述构建提示词
        // 结合角色立绘外观描述，让视频模型生成与参考图一致的画面
        const cliffhangerCharactersForPrompt = (cliffhangerData.characterList as string[] || []).map(name => ({
          name,
          appearance: extractCharacterAppearance(name),
        }));
        cliffhangerPrompt = buildPromptFromTimeShots(cliffhangerTimeShots, cliffhangerLocation, {
          characters: cliffhangerCharactersForPrompt,
          sceneAtmosphere: cliffhangerSceneDesc,
        });
        
        // 合并时间点中的对话
        const timeShotDialogues = mergeTimeShotDialogues(cliffhangerTimeShots);
        if (timeShotDialogues.length > 0) {
          cliffhangerDialogues = timeShotDialogues as typeof cliffhangerDialogues;
          console.log('[结尾悬念视频] 使用时间点解析出的对话:', cliffhangerDialogues);
        }
      } else if (!cliffhangerPrompt) {
        // 如果没有时间点描述且没有 visualPrompt，使用 scene description
        cliffhangerPrompt = cliffhangerSceneDesc;
      }
      
      // 从对话中提取所有说话人，自动补充到镜头人物列表
      const speakersFromDialogues = cliffhangerDialogues
        .map((d: { speaker?: string; content?: string }) => d.speaker)
        .filter((s): s is string => !!s && s !== '旁白'); // 过滤掉旁白
      
      // 合并 characterList 字段（新格式）、characters 字段（旧格式）和从对话中提取的角色（去重）
      const cliffhangerCharacterList = cliffhangerData.characterList as string[] | undefined;
      const cliffhangerCharactersFromData = cliffhangerCharacterList || (cliffhangerData.characters as string[] || []);
      const cliffhangerCharacters = [...new Set([...cliffhangerCharactersFromData, ...speakersFromDialogues])];
      
      console.log('[结尾悬念视频] 原始 characters:', cliffhangerCharactersFromData);
      console.log('[结尾悬念视频] 从对话提取的角色:', speakersFromDialogues);
      console.log('[结尾悬念视频] 合并后的镜头人物:', cliffhangerCharacters);
      
      const cliffhangerCharObjects = cliffhangerCharacters.map(name => ({ name }));
      
      // 在提示词开头明确镜头中的人物
      if (cliffhangerCharacters.length > 0 && !cliffhangerPrompt.includes('镜头中有')) {
        cliffhangerPrompt = `镜头中有${cliffhangerCharacters.join('和')}。${cliffhangerPrompt}`;
      }
      
      // 注意：对话内容将在 buildEnhancedPrompt 函数中统一处理，这里不再添加到 cliffhangerPrompt
      
      console.log('[结尾悬念视频] 镜头角色:', cliffhangerCharacters);
      console.log('[结尾悬念视频] 对话数据:', cliffhangerDialogues);
      
      // 获取 cliffhanger 的场景信息，匹配场景图片作为首帧
      const cliffhangerSceneImageUrl = matchSceneImage(cliffhangerLocation);
      
      // 创建角色立绘图片URL映射
      const cliffhangerCharacterImageUrls = new Map<string, string>();
      
      console.log('[结尾悬念视频] 可用立绘列表:', characterArtworks.map(a => ({ name: a.character_name, purpose: a.purpose, hasImage: !!a.imageUrl })));
      
      // 获取镜头中所有角色的立绘图片
      if (cliffhangerCharacters.length > 0 && characterArtworks.length > 0) {
        for (const charName of cliffhangerCharacters) {
          // 1. 先尝试精确匹配
          let artwork = characterArtworks.find(a => 
            a.character_name === charName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          
          // 2. 如果精确匹配失败，尝试模糊匹配（角色名包含关系）
          if (!artwork) {
            artwork = characterArtworks.find(a => 
              (a.character_name.includes(charName) || charName.includes(a.character_name)) &&
              (a.purpose?.includes('正面') || a.purpose === '角色正面照')
            ) || characterArtworks.find(a => 
              a.character_name.includes(charName) || charName.includes(a.character_name)
            );
            if (artwork) {
              console.log(`[结尾悬念视频] 角色 "${charName}" 使用模糊匹配找到立绘: "${artwork.character_name}"`);
            }
          }
          
          if (artwork?.imageUrl) {
            cliffhangerCharacterImageUrls.set(charName, artwork.imageUrl);
            console.log(`[结尾悬念视频] 角色 "${charName}" 找到立绘图片`);
          } else {
            console.log(`[结尾悬念视频] 角色 "${charName}" 未找到立绘图片`);
          }
        }
      }
      
      console.log('[结尾悬念视频] 角色立绘映射:', Object.fromEntries(cliffhangerCharacterImageUrls));
      
      // 确定首帧图片策略：
      // - 优先使用场景图片作为首帧（避免角色立绘导致人物陷进地下）
      // - 角色立绘仅作为参考图，不作为首帧
      let cliffhangerFirstFrameUrl: string | undefined = undefined;
      let cliffhangerCharacterImageUrl: string | undefined = undefined;
      
      if (cliffhangerSceneImageUrl) {
        // 优先场景图片
        cliffhangerFirstFrameUrl = cliffhangerSceneImageUrl;
        if (cliffhangerCharacters.length === 1) {
          cliffhangerCharacterImageUrl = cliffhangerCharacterImageUrls.get(cliffhangerCharacters[0]);
        }
        console.log(`[结尾悬念视频] 使用场景图片作为首帧，角色立绘作为参考`);
      } else if (cliffhangerCharacters.length === 1) {
        // 无场景图时不使用首帧，角色立绘仅作参考
        cliffhangerCharacterImageUrl = cliffhangerCharacterImageUrls.get(cliffhangerCharacters[0]);
        console.log(`[结尾悬念视频] 无场景图片，不使用首帧，角色立绘仅作为参考图`);
      } else {
        console.log(`[结尾悬念视频] 无首帧图片可用`);
      }
      
      // 构建增强的提示词（新格式，包含角色立绘标记和音色描述）
      const enhancedPrompt = buildEnhancedPrompt(cliffhangerPrompt, cliffhangerCharObjects, {
        episodeNumber: viewingEpisode.episode_number,
        storyboardIndex: -2, // 结尾悬念用 -2 表示
        duration: cliffhangerDuration,
        sceneImageUrl: cliffhangerFirstFrameUrl,
        sceneLocation: cliffhangerLocation,
        characterImageUrls: cliffhangerCharacterImageUrls,
        dialogues: cliffhangerDialogues as Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>,
        // 结尾悬念电影感增强
        shotType: '拉镜头',
        mood: '悬念留白，命运未卜',
        emotion: '紧张',
        imageStyle: selectedSeries?.image_style || 'realistic',
      });
      
      console.log('[结尾悬念视频] 增强提示词:', enhancedPrompt);
      console.log('[结尾悬念视频] 角色立绘URL:', cliffhangerCharacterImageUrl);
      console.log('[结尾悬念视频] 场景图片URL:', cliffhangerSceneImageUrl);
      console.log('[结尾悬念视频] 最终首帧URL:', cliffhangerFirstFrameUrl);

      // 后台任务模式：切换页面不影响生成进度
      let response;
      try {
        response = await runGenerationTaskFetch('video', selectedSeries.id, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUserId,
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            duration: cliffhangerDuration,
            ratio: '16:9',
            resolution: '720p',
            generateAudio: true,
            title: `${selectedSeries.title}-结尾悬念`,
            seriesId: selectedSeries.id,
            episodeNumber: viewingEpisode.episode_number,
            hookType: 'cliffhanger',
            sortOrder: 9999,
            firstFrameUrl: cliffhangerFirstFrameUrl,
            referenceImageUrls: [...new Set([...cliffhangerCharacterImageUrls.values()])],
          }),
        });
      } catch (fetchError: unknown) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : '请求失败';
        toast.error(`视频生成请求失败: ${errorMsg}`);
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
        setGeneratingCliffhanger(false);
        return;
      }

      // 检查响应状态
      if (!response.ok) {
        const text = await response.text();
        console.error('[结尾悬念视频] 请求失败:', response.status, text.substring(0, 500));
        
        // 504 网关超时特殊处理
        if (response.status === 504) {
          toast.error('视频生成超时（服务器处理时间过长），请稍后刷新页面查看结果');
        } else {
          toast.error(`视频生成失败: ${response.status}`);
        }
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
        setGeneratingCliffhanger(false);
        return;
      }

      const data = await response.json();
      
      // 异步任务：智谱
      if (data.taskId && data.solution === 'zhipu') {
        console.log(`[结尾悬念视频] 智谱异步任务创建: ${data.taskId}`);
        
        const queryParams = new URLSearchParams({
          save: 'true',
          title: `${selectedSeries.title}-结尾悬念`,
          prompt: enhancedPrompt.substring(0, 500),
          seriesId: selectedSeries.id,
          episodeNumber: String(viewingEpisode.episode_number),
          hookType: 'cliffhanger',
          sortOrder: '9999',
          solution: 'zhipu',
        });
        
        // 轮询查询任务状态，最多等待15分钟
        const maxPollTime = 15 * 60 * 1000;
        const pollInterval = 5000;
        const startTime = Date.now();
        let pollCount = 0;
        
        while (Date.now() - startTime < maxPollTime) {
          try {
            pollCount++;
            // 更新进度（10% - 90%）
            const progress = Math.min(90, 10 + pollCount * 5);
            setVideoGeneratingProgress(progress);
            
            const statusResponse = await fetch(`/api/videos/task/${data.taskId}?${queryParams.toString()}`);
            const statusData = await statusResponse.json();
            
            // 智谱成功状态
            if (statusData.status === 'SUCCESS' && statusData.videoUrl) {
              setVideoGeneratingProgress(100);
              setVideoCompletedTasks(1);
              toast.success('结尾悬念视频生成成功！');
              setCliffhangerVideoGenerated(true);
              loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
              setTimeout(() => {
                setVideoTotalTasks(0);
                setVideoCompletedTasks(0);
                setVideoGeneratingProgress(0);
              }, 2000);
              return;
            }
            
            // 失败状态
            if (statusData.status === 'FAILED') {
              toast.error('结尾悬念视频生成失败');
              setVideoTotalTasks(0);
              setVideoCompletedTasks(0);
              setVideoGeneratingProgress(0);
              return;
            }
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          } catch (pollError) {
            console.error('[结尾悬念视频] 查询状态失败:', pollError);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }
        
        toast.error('结尾悬念视频生成超时，请稍后刷新查看');
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
        return;
      }
      
      // 扣子方案
      if (data.success || data.video) {
        setVideoGeneratingProgress(100);
        setVideoCompletedTasks(1);
        toast.success('结尾悬念视频生成成功！');
        setCliffhangerVideoGenerated(true);
        loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
        setTimeout(() => {
          setVideoTotalTasks(0);
          setVideoCompletedTasks(0);
          setVideoGeneratingProgress(0);
        }, 2000);
      } else {
        toast.error(data.error || '视频生成失败');
        setVideoTotalTasks(0);
        setVideoCompletedTasks(0);
        setVideoGeneratingProgress(0);
      }
    } catch (error) {
      console.error('生成结尾悬念视频失败:', error);
      toast.error('生成结尾悬念视频失败');
      setVideoTotalTasks(0);
      setVideoCompletedTasks(0);
      setVideoGeneratingProgress(0);
    } finally {
      setGeneratingCliffhanger(false);
    }
  };

  // 后台生成视频（不阻塞用户操作）
  const generateEpisodeVideoBackground = async (episode: DramaEpisode) => {
    if (!selectedSeries) {
      toast.error('请先选择剧本');
      return;
    }

    const storyboards = episode.storyboards || [];
    if (storyboards.length === 0 && !episode.hook && !episode.cliffhanger) {
      toast.error('该剧集暂无内容，无法生成视频');
      return;
    }

    // 显示提示
    toast.info('正在创建后台任务...', { duration: 2000 });

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 创建后台任务记录
      const createResponse = await fetch('/api/videos/background-tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          seriesId: selectedSeries.id,
          episodeNumber: episode.episode_number,
          storyboards: storyboards,
          taskType: 'episode',
        }),
      });

      const createData = await createResponse.json();
      if (!createData.success) {
        toast.error(createData.error || '创建任务失败');
        return;
      }

      const taskId = createData.taskId;
      
      // 调用后端执行接口启动任务
      const executeResponse = await fetch(`/api/videos/background-tasks/${taskId}/execute`, {
        method: 'POST',
      });
      
      const executeData = await executeResponse.json();
      if (executeData.success) {
        toast.success('后台任务已启动，视频正在后台生成中...', { duration: 3000 });
        
        // 添加到任务列表
        setBackgroundTasks(prev => [{
          id: taskId,
          seriesId: selectedSeries.id,
          episodeNumber: episode.episode_number,
          status: 'running',
          progress: 0,
          total: storyboards.length || 1,
          currentItem: '正在初始化...',
          createdAt: new Date().toISOString(),
          successCount: 0,
          failedCount: 0,
        }, ...prev]);
        
        // 使用 SSE 实时订阅进度（替代轮询）
        subscribeToTaskProgress(taskId, selectedSeries.id, episode.episode_number);
        
        // 同时启动单步执行轮询（作为备用）
        pollTaskStatus(taskId, selectedSeries.id, episode.episode_number);
      } else {
        toast.error(executeData.message || '启动任务失败');
      }
      
    } catch (error) {
      console.error('创建后台任务失败:', error);
      toast.error('创建后台任务失败');
    }
  };

  // 轮询任务状态并执行单步生成
  const pollTaskStatus = async (taskId: string, seriesId: string, episodeNumber: number) => {
    let pollCount = 0;
    const maxPolls = 300; // 最多轮询300次（约25分钟，每5秒一次）
    
    const poll = async () => {
      try {
        // 先调用单步执行接口，生成一个视频
        const stepResponse = await fetch(`/api/videos/background-tasks/${taskId}/step`, {
          method: 'POST',
        });
        const stepData = await stepResponse.json();
        
        if (stepData.done) {
          // 任务完成
          setBackgroundTasks(prev => prev.map(t => 
            t.id === taskId ? {
              ...t,
              status: 'completed',
              progress: stepData.progress,
              total: stepData.total,
              currentItem: '所有视频生成完成',
            } : t
          ));
          
          // 清除正在生成的状态
          setGeneratingStoryboardIndex(null);
          
          toast.success(`视频生成完成！成功 ${stepData.progress}/${stepData.total} 个`);
          loadEpisodeVideos(seriesId, episodeNumber);
          return;
        }
        
        if (stepData.success) {
          // 更新进度
          setBackgroundTasks(prev => prev.map(t => 
            t.id === taskId ? {
              ...t,
              status: 'running',
              progress: stepData.progress,
              total: stepData.total,
              currentItem: stepData.message,
            } : t
          ));
          
          // 同步更新分镜按钮状态
          // 设置当前正在生成的分镜索引（progress 是下一个要生成的索引）
          if (stepData.progress !== undefined && stepData.progress < stepData.total) {
            setGeneratingStoryboardIndex(stepData.progress);
          } else {
            setGeneratingStoryboardIndex(null);
          }
          
          // 如果有成功的视频，使用后端返回的 storyboardId 添加到已完成集合
          if (stepData.videoUrl && stepData.storyboardId) {
            setGeneratedStoryboardIds(prev => new Set(prev).add(stepData.storyboardId));
          }
          
          // 检测是否是限流错误
          const isRateLimited = stepData.error?.includes('限流') || 
                                 stepData.error?.includes('TooManyRequests') ||
                                 stepData.error?.includes('429');
          
          // 等待后继续（限流时等待更长）
          const waitTime = isRateLimited ? 60000 : 30000;
          pollCount++;
          if (pollCount < maxPolls) {
            if (isRateLimited) {
              toast.warning('API限流，等待60秒后继续...', { duration: 3000 });
            }
            setTimeout(poll, waitTime);
          } else {
            toast.warning('任务执行超时，请稍后刷新查看结果');
          }
        } else {
          // 生成失败
          console.error('单步执行失败:', stepData.message, stepData.error);
          
          // 检测是否是限流错误
          const isRateLimited = stepData.error?.includes('限流') || 
                                 stepData.error?.includes('TooManyRequests') ||
                                 stepData.error?.includes('429');
          
          pollCount++;
          if (pollCount < maxPolls) {
            const waitTime = isRateLimited ? 60000 : 10000;
            if (isRateLimited) {
              toast.warning('API限流，等待60秒后重试...', { duration: 3000 });
            }
            setTimeout(poll, waitTime);
          }
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000);
        }
      }
    };
    
    poll();
  };

  // SSE 实时进度订阅（替代轮询）
  const subscribeToTaskProgress = (taskId: string, seriesId: string, episodeNumber: number) => {
    // 关闭现有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/videos/background-tasks/${taskId}/events`;
    console.log('[SSE] 正在连接:', url);
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] 连接已打开');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('[SSE] 已连接:', data.taskId);
          return;
        }
        
        if (data.type === 'progress') {
          // 更新进度
          setBackgroundTasks(prev => prev.map(t => 
            t.id === taskId ? {
              ...t,
              status: data.status,
              progress: data.progress,
              total: data.total,
              currentItem: data.currentItem,
              successCount: data.successCount,
              failedCount: data.failedCount,
            } : t
          ));
          
          // 同步更新分镜按钮状态
          // 1. 设置当前正在生成的分镜索引
          if (data.currentStoryboardIndex !== undefined && data.currentStoryboardIndex !== null) {
            setGeneratingStoryboardIndex(data.currentStoryboardIndex);
          } else {
            setGeneratingStoryboardIndex(null);
          }
          
          // 2. 添加已成功生成的分镜ID
          if (data.completedStoryboardIds && data.completedStoryboardIds.length > 0) {
            setGeneratedStoryboardIds(prev => {
              const newSet = new Set(prev);
              data.completedStoryboardIds.forEach((id: string) => {
                if (id) newSet.add(id);
              });
              return newSet;
            });
          }
        }
        
        if (data.type === 'complete') {
          // 任务完成
          console.log('[SSE] 任务完成:', data.status);
          eventSource.close();
          eventSourceRef.current = null;
          
          // 清除正在生成的状态
          setGeneratingStoryboardIndex(null);
          
          if (data.status === 'completed') {
            toast.success('视频生成完成！');
            loadEpisodeVideos(seriesId, episodeNumber);
          } else if (data.status === 'failed') {
            toast.error('视频生成失败');
          }
          
          // 获取失败视频列表
          loadFailedVideos(taskId);
        }
        
        if (data.type === 'error') {
          console.error('[SSE] 错误:', data.error);
        }
      } catch (err) {
        console.error('[SSE] 解析错误:', err);
      }
    };

    eventSource.onerror = () => {
      const readyState = eventSource.readyState;
      
      // 根据连接状态处理错误
      if (readyState === EventSource.CLOSED) {
        // 连接已正常关闭（任务完成或服务端主动关闭）
        // 静默处理，不显示错误
        eventSource.close();
        eventSourceRef.current = null;
      } else if (readyState === EventSource.CONNECTING) {
        // 正在重连中，静默等待浏览器自动重试
        // 不需要额外处理
      } else {
        // 其他错误状态（如网络错误等）
        // 关闭连接，但不显示错误提示（用户操作不受影响）
        eventSource.close();
        eventSourceRef.current = null;
      }
    };
  };

  // 加载失败视频列表
  const loadFailedVideos = async (taskId: string) => {
    try {
      const response = await fetch(`/api/videos/background-tasks/${taskId}/retry`);
      const data = await response.json();
      
      if (data.success && data.failedVideos && data.failedVideos.length > 0) {
        // 更新任务状态，添加失败视频信息
        setBackgroundTasks(prev => prev.map(t => 
          t.id === taskId ? {
            ...t,
            failedVideos: data.failedVideos,
          } : t
        ));
      }
    } catch (error) {
      console.error('加载失败视频列表失败:', error);
    }
  };

  // 重试后台任务中失败的视频
  const retryBackgroundTaskVideos = async (taskId: string, retryAll: boolean = true, index?: number) => {
    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/videos/background-tasks/${taskId}/retry`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ retryAll, index }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`重试完成: ${data.retryResults?.filter((r: { success: boolean }) => r.success).length || 0}/${data.retryResults?.length || 0} 成功`);
        
        // 更新任务状态
        if (data.done) {
          setBackgroundTasks(prev => prev.map(t => 
            t.id === taskId ? {
              ...t,
              status: 'completed',
              failedVideos: [],
            } : t
          ));
        } else {
          // 重新加载失败列表
          loadFailedVideos(taskId);
        }
      } else {
        toast.error(data.error || '重试失败');
      }
    } catch (error) {
      console.error('重试失败视频出错:', error);
      toast.error('重试失败');
    }
  };

  // 选择剧本查看详情
  const selectSeries = async (seriesId: string) => {
    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${seriesId}`, {
        headers: {
          'x-user-id': currentUserId,
        },
      });
      const data = await response.json();
      if (data.success) {
        console.log('[selectSeries] 加载剧本详情:', {
          id: data.series.id,
          title: data.series.title,
          outlinesCount: data.series.outlines?.length || 0
        });
        setSelectedSeries(data.series);
      }
    } catch (error) {
      console.error('获取剧本详情失败:', error);
    }
  };

  // 创建新剧本
  const createSeries = async () => {
    if (!newSeries.genre) {
      alert('请选择题材类型');
      return;
    }

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch('/api/drama/series', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify(newSeries),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateDialog(false);
        
        // 如果标题是AI生成的，显示提示
        if (data.generatedTitle) {
          toast.success(`AI已为您的剧本生成标题：「${data.series.title}」`, {
            description: '您可以在剧本详情中修改标题'
          });
        }
        
        setNewSeries({
          title: '',
          description: '',
          genre: 'ba-zong-tian-chong',
          style: 'tian-chong',
          imageStyle: 'realistic',
          coreConflict: '',
          coreConflictTypes: [],
          totalEpisodes: 30,
          characterCount: 0,
        });
        await loadSeriesList();
        await selectSeries(data.series.id);
        toast.success('剧本创建成功，可以开始生成大纲了');
      } else {
        toast.error(data.error || '创建剧本失败');
      }
    } catch (error) {
      console.error('创建剧本失败:', error);
      toast.error('创建剧本失败');
    }
  };

  // 生成大纲
  const generateOutlines = async () => {
    if (!selectedSeries?.id) {
      toast.error('请先选择一个剧本');
      return;
    }
    
    setGenerating('outlines');
    setGeneratingProgress(0);
    
    // 模拟进度（因为LLM调用是阻塞的，所以用定时器模拟）
    const progressInterval = setInterval(() => {
      setGeneratingProgress(prev => {
        if (prev >= 95) return 95; // 停在95%，等待实际完成
        return Math.min(95, prev + Math.random() * 3 + 1);
      });
    }, 1000);

    // 设置480秒超时（8分钟），LLM生成分镜需要较长时间（每分镜4句对话）
    let timeoutId: NodeJS.Timeout | null = null;
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException('请求超时', 'TimeoutError'));
    }, 480000);

    try {
      const response = await fetch(`/api/drama/series/${selectedSeries.id}/outlines`, {
        method: 'POST',
        signal: controller.signal,
      });
      
      const data = await response.json();
      if (data.success) {
        setGeneratingProgress(100);
        toast.success('大纲生成成功！');
        setActiveTab('outlines'); // 自动切换到大纲Tab
        await selectSeries(selectedSeries.id); // 等待数据更新完成
      } else {
        toast.error(data.error || '生成大纲失败');
      }
    } catch (error) {
      console.error('生成大纲失败:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          toast.error('生成超时，请重试');
        } else {
          toast.error(`生成失败: ${error.message}`);
        }
      } else {
        toast.error('生成大纲失败，请重试');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setGenerating(null);
      setGeneratingProgress(0);
      setVideoGeneratingEpisode(null);
      setVideoGeneratingProgress(0);
    }
  };

  // 重新生成剧本标题
  const regenerateTitle = async () => {
    console.log('[重新生成标题] 开始执行', { selectedSeriesId: selectedSeries?.id });
    if (!selectedSeries) {
      console.error('[重新生成标题] 没有选中剧本');
      return;
    }

    setRegeneratingTitle(true);

    try {
      console.log('[重新生成标题] 发送请求', { seriesId: selectedSeries.id });
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${selectedSeries.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ action: 'regenerateTitle' }),
      });

      console.log('[重新生成标题] 收到响应', { status: response.status });
      const data = await response.json();
      console.log('[重新生成标题] 响应数据', data);

      if (data.success) {
        toast.success(`标题已更新：「${data.newTitle}」`);
        setSelectedSeries(data.series);
      } else {
        toast.error(data.error || '生成标题失败');
      }
    } catch (error) {
      console.error('[重新生成标题] 请求失败:', error);
      toast.error('生成标题失败');
    } finally {
      setRegeneratingTitle(false);
    }
  };

  // 提取角色和场景信息
  const extractCharactersAndScenes = async () => {
    console.log('[提取角色和场景] 开始执行, selectedSeries:', selectedSeries?.id);
    
    if (!selectedSeries) {
      toast.error('请先选择剧本');
      return;
    }
    
    setGenerating('extract');
    setGeneratingProgress(0);
    
    const progressInterval = setInterval(() => {
      setGeneratingProgress(prev => Math.min(95, prev + Math.random() * 5 + 2));
    }, 500);

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 判断是否需要强制重新提取（如果已有角色，则强制重新提取）
      const hasExistingCharacters = selectedSeries.characters && selectedSeries.characters.length > 0;
      const hasExistingScenes = selectedSeries.scenes && selectedSeries.scenes.length > 0;
      
      console.log('[提取角色] 发送请求...', { hasExistingCharacters });
      // 1. 提取角色
      const charResponse = await fetch(`/api/drama/series/${selectedSeries.id}/extract-characters`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ force: hasExistingCharacters }),
      });
      const charData = await charResponse.json();
      console.log('[提取角色] 响应:', charData);
      
      console.log('[提取场景] 发送请求...', { hasExistingScenes });
      // 2. 提取场景
      const sceneResponse = await fetch(`/api/drama/series/${selectedSeries.id}/extract-scenes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ force: hasExistingScenes }),
      });
      const sceneData = await sceneResponse.json();
      console.log('[提取场景] 响应:', sceneData);
      
      if (charData.success || sceneData.success) {
        setGeneratingProgress(100);
        toast.success(`提取完成：${charData.characters?.length || 0}个角色，${sceneData.scenes?.length || 0}个场景`);
        // 刷新数据
        const seriesResponse = await fetch(`/api/drama/series/${selectedSeries.id}`, {
          headers: {
            'x-user-id': currentUserId,
          },
        });
        const seriesData = await seriesResponse.json();
        if (seriesData.success) {
          setSelectedSeries(seriesData.series);
        }
      } else {
        // 显示具体错误信息
        const errorMsg = charData.error || sceneData.error || '提取失败';
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('提取失败:', error);
      toast.error('提取角色和场景失败');
    } finally {
      clearInterval(progressInterval);
      setGenerating(null);
      setGeneratingProgress(0);
    }
  };

  // 生成立绘
  const generateArtwork = async () => {
    if (!selectedSeries) return;
    
    setGenerating('artwork');
    setGeneratingProgress(0);
    setArtworkLoading(true);
    
    const progressInterval = setInterval(() => {
      setGeneratingProgress(prev => Math.min(95, prev + Math.random() * 3 + 1));
    }, 1000);

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 后台任务模式：切换页面不影响生成进度
      const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          generateCharacters: true,
          generateScenes: true,
        }),
      });

      // 检查响应状态，避免解析非JSON响应
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          toast.error(errorData.error || `服务器错误 (${response.status})`);
        } else {
          // HTML 错误页面或其他非 JSON 响应
          toast.error(`服务器错误 (${response.status})，请稍后重试`);
          console.error('[立绘生成] 非JSON响应:', response.status, response.statusText);
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setGeneratingProgress(100);
        toast.success(data.message);
        // 刷新立绘列表
        await loadArtwork();
        // 刷新剧本数据
        const seriesResponse = await fetch(`/api/drama/series/${selectedSeries.id}`, {
          headers: {
            'x-user-id': currentUserId,
          },
        });
        const seriesData = await seriesResponse.json();
        if (seriesData.success) {
          setSelectedSeries(seriesData.series);
        }
      } else {
        toast.error(data.error || '生成立绘失败');
      }
    } catch (error) {
      console.error('生成立绘失败:', error);
      toast.error('生成立绘失败');
    } finally {
      clearInterval(progressInterval);
      setGenerating(null);
      setGeneratingProgress(0);
      setArtworkLoading(false);
    }
  };

  

  // 生成人物立绘（正面半身照 - 三栏式：正面、侧面、背面）
  const generateCharacterSheet = async (characterId: string, characterName: string) => {
    if (!selectedSeries) return;

    setGenerating(`character-sheet-${characterId}`);

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 后台任务模式：使用 artwork API 的 characterSheet 参数
      const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          generateCharacters: true,
          generateScenes: false,
          characterId,
          characterSheet: true, // 生成三栏式立绘
        }),
      });

      // 检查响应状态
      if (!response.ok) {
        toast.error(`生成 ${characterName} 人物立绘失败`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        toast.success(`${characterName} 人物立绘生成成功`);
        // 刷新立绘列表
        await loadArtwork();
        // 刷新剧本数据
        const seriesResponse = await fetch(`/api/drama/series/${selectedSeries.id}`, {
          headers: {
            'x-user-id': currentUserId,
          },
        });
        const seriesData = await seriesResponse.json();
        if (seriesData.success) {
          setSelectedSeries(seriesData.series);
        }
      } else {
        toast.error(data.error || `生成 ${characterName} 人物立绘失败`);
      }
    } catch (error) {
      console.error('生成人物立绘失败:', error);
      toast.error(`生成 ${characterName} 人物立绘失败`);
    } finally {
      setGenerating(null);
    }
  };

  // 生成单个角度的立绘
  const generateSingleAngleArtwork = async (characterId: string, characterName: string, angleType: string) => {
    if (!selectedSeries) return;
    
    setGenerating(`character-${characterId}-${angleType}`);
    
    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 后台任务模式：切换页面不影响生成进度
      const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          generateCharacters: true,
          generateScenes: false,
          characterId,
          angleType, // 指定只生成特定角度
        }),
      });
      
      if (!response.ok) {
        toast.error(`生成 ${characterName} 立绘失败`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        const angleNames: Record<string, string> = { front: '正面照' };
        toast.success(`${characterName} ${angleNames[angleType] || angleType} 生成成功`);
        // 刷新立绘列表
        await loadArtwork();
        // 刷新剧本数据
        const seriesResponse = await fetch(`/api/drama/series/${selectedSeries.id}`, {
          headers: {
            'x-user-id': currentUserId,
          },
        });
        const seriesData = await seriesResponse.json();
        if (seriesData.success) {
          setSelectedSeries(seriesData.series);
        }
      } else {
        toast.error(data.error || `生成 ${characterName} 立绘失败`);
      }
    } catch (error) {
      console.error('生成单角度立绘失败:', error);
      toast.error(`生成 ${characterName} 立绘失败`);
    } finally {
      setGenerating(null);
    }
  };

  // 批量生成所有角色立绘
  const generateAllCharacterArtworks = async () => {
    if (!selectedSeries) return;

    // 先加载已有的立绘数据
    await loadArtwork();

    const characters = selectedSeries.characters || [];
    if (characters.length === 0) {
      toast.error('没有角色数据，请先提取角色');
      return;
    }

    // 获取已生成立绘的角色ID集合（包含角色ID和purpose的组合）
    const existingCharacterKeys = new Set(
      artworkCharacters.map(art => `${art.character_id}-${art.purpose}`)
    );

    // 筛选出需要生成的角色（检查每个角色是否有立绘）
    const charactersToGenerate = characters.filter(char => {
      // 检查该角色是否已有任何立绘
      const hasArtwork = artworkCharacters.some(
        art => art.character_id === char.id || art.character_name === char.name
      );
      return !hasArtwork;
    });

    if (charactersToGenerate.length === 0) {
      toast.info('所有角色立绘已生成完成，无需重复生成');
      return;
    }

    toast.info(`将生成 ${charactersToGenerate.length} 个角色的立绘`);

    setGenerating('all-characters');
    setGeneratingProgress(0);
    setGeneratingCurrentTask('准备生成...');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < charactersToGenerate.length; i++) {
      const char = charactersToGenerate[i];
      const progress = Math.round((i / charactersToGenerate.length) * 100);
      setGeneratingProgress(progress);
      setGeneratingCurrentTask(`正在生成 ${char.name} 的立绘... (${i + 1}/${charactersToGenerate.length})`);

      try {
        // 获取用户信息
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const currentUserId = user?.id || 'dev-user';

        // 后台任务模式：切换页面不影响生成进度
        const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': currentUserId,
          },
          body: JSON.stringify({
            generateCharacters: true,
            generateScenes: false,
            characterId: char.id,
            angleType: 'front', // 只生成正面照
          }),
        });

        if (response.ok) {
          successCount++;
          toast.success(`${char.name} 立绘生成完成`);
        } else {
          failCount++;
          toast.error(`${char.name} 立绘生成失败`);
        }
      } catch (error) {
        failCount++;
        console.error(`生成 ${char.name} 立绘失败:`, error);
      }

      // 每个角色之间等待一段时间，避免API限流
      if (i < charactersToGenerate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 更新最终进度
    setGeneratingProgress(100);
    setGeneratingCurrentTask('批量生成完成');

    setTimeout(() => {
      setGenerating(null);
      setGeneratingProgress(0);
      setGeneratingCurrentTask('');
    }, 2000);

    // 刷新数据
    await loadArtwork();
    const seriesResponse = await fetch(`/api/drama/series/${selectedSeries.id}`, {
      headers: {
        'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '',
      },
    });
    const seriesData = await seriesResponse.json();
    if (seriesData.success) {
      setSelectedSeries(seriesData.series);
    }

    toast.success(`批量生成完成！成功 ${successCount} 个，失败 ${failCount} 个`);
  };

  // 批量生成所有场景照
  const generateAllSceneArtworks = async () => {
    if (!selectedSeries) return;
    
    // 先加载已有的场景图数据
    await loadArtwork();
    
    const metadata = selectedSeries.metadata as Record<string, unknown> || {};
    const sceneDefinitions = metadata.sceneDefinitions as Record<string, Record<string, unknown>> || {};
    const sceneKeys = Object.keys(sceneDefinitions);
    
    if (sceneKeys.length === 0) {
      toast.error('没有场景数据，请先提取场景');
      return;
    }
    
    // 筛选出需要生成的场景（排除已有图片的场景）
    const scenesToGenerate = sceneKeys.filter(sceneKey => {
      const sceneData = sceneDefinitions[sceneKey] as { name?: string } | undefined;
      const sceneName = sceneData?.name || sceneKey;
      // 检查该场景是否已有图片
      const hasImage = artworkScenes.some(
        scene => scene.title?.includes(sceneName) || scene.title?.includes(sceneKey)
      );
      return !hasImage;
    });
    
    if (scenesToGenerate.length === 0) {
      toast.info('所有场景照已生成完成，无需重复生成');
      return;
    }
    
    toast.info(`将生成 ${scenesToGenerate.length} 个场景的图片`);
    
    setGenerating('all-scenes');
    setGeneratingProgress(0);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < scenesToGenerate.length; i++) {
      const sceneKey = scenesToGenerate[i];
      const sceneData = sceneDefinitions[sceneKey] as { name?: string } | undefined;
      const displayName = sceneData?.name || sceneKey; // 优先使用场景名称，否则使用 key
      
      setGeneratingProgress(Math.round((i / scenesToGenerate.length) * 100));
      
      try {
        // 获取用户信息
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const currentUserId = user?.id || 'dev-user';

        // 后台任务模式：切换页面不影响生成进度
        const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': currentUserId,
          },
          body: JSON.stringify({
            generateCharacters: false,
            generateScenes: true,
            sceneName: sceneKey, // 传递场景 key，API 会同时支持 key 和 name 匹配
          }),
        });
        
        if (response.ok) {
          successCount++;
          toast.success(`${displayName} 场景照生成完成`);
        } else {
          failCount++;
          const errorData = await response.json().catch(() => ({}));
          toast.error(`${displayName} 场景照生成失败: ${errorData.error || '未知错误'}`);
        }
      } catch (error) {
        failCount++;
        console.error(`生成 ${displayName} 场景照失败:`, error);
        toast.error(`${displayName} 场景照生成失败`);
      }
      
      // 每个场景之间等待一段时间，避免API限流
      if (i < scenesToGenerate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 更新最终进度
    setGeneratingProgress(100);
    setGeneratingCurrentTask('批量生成完成');

    setTimeout(() => {
      setGenerating(null);
      setGeneratingProgress(0);
      setGeneratingCurrentTask('');
    }, 2000);
    
    // 刷新数据
    await loadArtwork();
    
    toast.success(`批量生成完成！成功 ${successCount} 个，失败 ${failCount} 个`);
  };

  // 生成单个场景的图片（带确认）
  const confirmAndGenerateSceneArtwork = async (sceneName: string) => {
    if (!selectedSeries) return;
    
    // 检查是否已有场景图片
    const existingImage = artworkScenes.find(
      img => img.title?.includes(sceneName)
    );
    
    if (existingImage?.imageUrl) {
      // 已有场景图片，弹出确认对话框
      setRegenerateType('scene');
      setRegenerateTarget({ name: sceneName });
      setShowRegenerateDialog(true);
      return;
    }
    
    // 没有场景图片，直接生成
    await doGenerateSceneArtwork(sceneName);
  };

  // 执行场景图片生成
  const doGenerateSceneArtwork = async (sceneName: string) => {
    if (!selectedSeries) return;
    
    setGenerating(`scene-${sceneName}`);
    
    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 后台任务模式：切换页面不影响生成进度
      const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          generateCharacters: false,
          generateScenes: true,
          sceneName,
        }),
      });
      
      // 检查响应状态
      if (!response.ok) {
        toast.error(`生成 ${sceneName} 场景图失败`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`${sceneName} 场景图生成成功`);
        // 刷新立绘列表
        await loadArtwork();
      } else {
        toast.error(data.error || `生成 ${sceneName} 场景图失败`);
      }
    } catch (error) {
      console.error('生成场景图失败:', error);
      toast.error(`生成 ${sceneName} 场景图失败`);
    } finally {
      setGenerating(null);
    }
  };

  // 执行场景图片重新生成（删除旧记录后重新生成）
  const doRegenerateSceneArtwork = async (sceneName: string) => {
    if (!selectedSeries) return;
    
    setGenerating(`scene-${sceneName}`);
    
    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      // 后台任务模式：切换页面不影响生成进度
      const response = await runGenerationTaskFetch('artwork', selectedSeries.id, {
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          generateCharacters: false,
          generateScenes: true,
          sceneName,
          regenerateScene: true, // 重新生成模式
        }),
      });
      
      // 检查响应状态
      if (!response.ok) {
        toast.error(`重新生成 ${sceneName} 场景图失败`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`${sceneName} 场景图重新生成成功`);
        // 刷新立绘列表
        await loadArtwork();
      } else {
        toast.error(data.error || `重新生成 ${sceneName} 场景图失败`);
      }
    } catch (error) {
      console.error('重新生成场景图失败:', error);
      toast.error(`重新生成 ${sceneName} 场景图失败`);
    } finally {
      setGenerating(null);
    }
  };

  // 确认重新生成
  const handleConfirmRegenerate = async () => {
    setShowRegenerateDialog(false);
    
    if (regenerateType === 'character' && regenerateTarget.id) {
      await generateCharacterSheet(regenerateTarget.id, regenerateTarget.name);
    } else if (regenerateType === 'scene') {
      await doRegenerateSceneArtwork(regenerateTarget.name);
    }
  };

  // 加载立绘
  const loadArtwork = async () => {
    if (!selectedSeries) return;
    
    setArtworkLoading(true);
    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${selectedSeries.id}/artwork`, {
        headers: {
          'x-user-id': currentUserId,
        },
      });
      
      // 检查响应状态
      if (!response.ok) {
        console.error('[加载立绘] 服务器错误:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setArtworkCharacters(data.characters || []);
        setArtworkScenes(data.scenes || []);
      }
    } catch (error) {
      console.error('加载立绘失败:', error);
    } finally {
      setArtworkLoading(false);
    }
  };

  // 通过 ref 转发最新 loadArtwork，供后台任务恢复回调使用（避免闭包旧值）
  const loadArtworkRef = useRef(loadArtwork);
  loadArtworkRef.current = loadArtwork;

  // 页面切换恢复：挂载时检查 localStorage 中的活跃生成任务，继续轮询直到完成
  // 立绘/视频生成为后台任务，切换页面不影响生成进度
  useEffect(() => {
    let cancelled = false;
    const activeTasks = readActiveTasks();

    for (const [taskType, task] of Object.entries(activeTasks)) {
      // 跳过超过 20 分钟的过期任务（清理残留记录）
      if (Date.now() - task.startedAt > 20 * 60 * 1000) {
        clearActiveTask(taskType);
        continue;
      }

      const pollTask = async () => {
        while (!cancelled) {
          try {
            const userStr = localStorage.getItem('user');
            const uid = userStr ? (JSON.parse(userStr)?.id || 'dev-user') : 'dev-user';
            const res = await fetch(`/api/generations?ids=${task.taskId}`, {
              headers: { 'x-user-id': uid },
            });
            if (!res.ok) {
              await new Promise((resolve) => setTimeout(resolve, 3000));
              continue;
            }
            const data = await res.json();
            const tasks: Array<{ id: string; status: string; error?: string; result?: Record<string, unknown> }> = data.tasks || [];
            const t = tasks.find((item) => item.id === task.taskId);
            if (t?.status === 'completed') {
              clearActiveTask(taskType);
              if (cancelled) return;
              if (taskType === 'artwork') {
                toast.success('立绘生成已完成');
                loadArtworkRef.current();
              } else {
                toast.success('视频生成已完成，请在剧集播放列表查看');
              }
              return;
            }
            if (t?.status === 'failed') {
              clearActiveTask(taskType);
              if (!cancelled) {
                toast.error(t.error || (taskType === 'artwork' ? '立绘生成失败' : '视频生成失败'));
              }
              return;
            }
          } catch {
            // 网络抖动，继续轮询
          }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      };
      pollTask();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // 加载立绘数据（角色立绘和场景照），在选中剧集后就加载，不限于 artwork 标签页
  useEffect(() => {
    if (selectedSeries) {
      loadArtwork();
    }
  }, [selectedSeries?.id]);

  // 生成单集剧本
  const generateEpisode = async (episodeNumber: number, outlineId?: string) => {
    if (!selectedSeries) return;
    
    // 检查是否为管理员
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdminUser = user?.id === 'admin' || user?.isAdmin === true;
    const currentUserId = user?.id || 'dev-user';
    
    console.log('[生成剧本] 管理员:', isAdminUser, '用户ID:', currentUserId);
    
    setGenerating(`episode-${episodeNumber}`);
    setGeneratingProgress(0);
    
    const progressInterval = setInterval(() => {
      setGeneratingProgress(prev => {
        if (prev >= 95) return 95; // 停在95%，等待实际完成
        return Math.min(95, prev + Math.random() * 5 + 2);
      });
    }, 500);

    // 设置480秒超时（8分钟），LLM生成需要较长时间（每分镜4句对话）
    let timeoutId: NodeJS.Timeout | null = null;
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException('请求超时', 'TimeoutError'));
    }, 480000);

    try {
      // 获取用户视频模型配置
      const userVideoModel = user?.video_model || 'doubao-seedance-2-0-260128';
      
      const response = await fetch(`/api/drama/series/${selectedSeries.id}/episodes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
          'x-user-video-model': userVideoModel,
        },
        body: JSON.stringify({ episodeNumber, outlineId }),
        signal: controller.signal,
      });
      
      const data = await response.json();
      if (data.success) {
        setGeneratingProgress(100);
        toast.success(`第${episodeNumber}集剧本生成成功！`);
        // 刷新数据（viewingEpisode 会自动从 selectedSeries 中派生更新）
        const seriesResponse = await fetch(`/api/drama/series/${selectedSeries.id}`, {
          headers: {
            'x-user-id': currentUserId,
          },
        });
        const seriesData = await seriesResponse.json();
        if (seriesData.success) {
          setSelectedSeries(seriesData.series);
          // viewingEpisode 会自动通过 useMemo 从 selectedSeries 中派生
        }
      } else {
        toast.error(data.error || '生成单集失败');
      }
    } catch (error) {
      console.error('生成单集失败:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          toast.error('生成超时，请重试');
        } else {
          toast.error(`生成失败: ${error.message}`);
        }
      } else {
        toast.error('生成单集失败，请重试');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setGenerating(null);
      setGeneratingProgress(0);
    }
  };

  // 批量生成剧本
  const generateAllEpisodes = async () => {
    if (!selectedSeries) return;
    
    const seriesId = selectedSeries.id;
    const totalCount = Math.min(10, selectedSeries.total_episodes);
    
    // 获取已生成的剧本编号
    const existingEpisodeNumbers = new Set(
      (selectedSeries.episodes || []).map(ep => ep.episode_number)
    );
    
    // 找出需要生成的剧本编号
    const episodesToGenerate = [];
    for (let i = 1; i <= totalCount; i++) {
      if (!existingEpisodeNumbers.has(i)) {
        episodesToGenerate.push(i);
      }
    }
    
    if (episodesToGenerate.length === 0) {
      toast.info('所有剧本已生成完成，无需重复生成');
      return;
    }
    
    toast.info(`将生成第 ${episodesToGenerate[0]} 至 ${episodesToGenerate[episodesToGenerate.length - 1]} 集，共 ${episodesToGenerate.length} 集`);
    
    for (const episodeNumber of episodesToGenerate) {
      setGenerating(`episode-${episodeNumber}`);
      setGeneratingProgress(0);
      
      const progressInterval = setInterval(() => {
        setGeneratingProgress(prev => {
          if (prev >= 95) return 95;
          return Math.min(95, prev + Math.random() * 5 + 2);
        });
      }, 500);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new DOMException('请求超时', 'TimeoutError'));
      }, 480000); // 8分钟超时

      try {
        // 获取用户信息
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const currentUserId = user?.id || 'dev-user';

        const response = await fetch(`/api/drama/series/${seriesId}/episodes`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': currentUserId,
          },
          body: JSON.stringify({ episodeNumber }),
          signal: controller.signal,
        });
        
        const data = await response.json();
        if (data.success) {
          setGeneratingProgress(100);
          toast.success(`第${episodeNumber}集剧本生成成功！`);
        } else {
          toast.error(`第${episodeNumber}集生成失败: ${data.error || '未知错误'}`);
        }
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
          toast.error(`第${episodeNumber}集生成超时`);
        } else {
          toast.error(`第${episodeNumber}集生成失败`);
        }
      } finally {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        setGeneratingProgress(0);
      }
    }
    
    // 全部完成后刷新数据
    setGenerating(null);
    selectSeries(seriesId);
    toast.success('批量生成完成！');
  };

  // 生成单集视频（优化策略：分离对话镜头和无对话镜头）
  const generateEpisodeVideo = async (episode: DramaEpisode, storyboardIndex?: number) => {
    if (!selectedSeries) {
      toast.error('请先选择剧本');
      return;
    }

    const storyboards = episode.storyboards || [];
    if (storyboards.length === 0 && !episode.hook && !episode.cliffhanger) {
      toast.error('该剧集暂无内容，无法生成视频');
      return;
    }

    // 检查是否为管理员
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdminUser = user?.id === 'admin' || user?.isAdmin === true;
    const currentUserId = user?.id || 'dev-user';
    
    // 管理员：时长15秒；普通用户：时长12秒
    const adminDuration = isAdminUser ? 15 : 12;
    
    console.log('[视频生成] 管理员:', isAdminUser, '用户ID:', currentUserId, '默认时长:', adminDuration);

    // ========== 预检查：获取立绘和场景图片数据 ==========
    let characterArtworks: Array<{
      character_name: string;
      character_id: string;
      imageUrl: string;
      purpose: string;
      generation_prompt?: string;
      description?: string;
    }> = [];
    let sceneImages: Array<{
      title: string;
      imageUrl: string;
      description: string;
    }> = [];
    
    try {
      const userInfo = (() => {
        try {
          const userStr = localStorage.getItem('user');
          return userStr ? JSON.parse(userStr) : null;
        } catch {
          return null;
        }
      })();
      const userId = userInfo?.id;
      
      const artworkResponse = await fetch(`/api/drama/series/${selectedSeries.id}/artwork`, {
        headers: userId ? { 'x-user-id': userId } : undefined,
      });
      if (artworkResponse.ok) {
        const artworkData = await artworkResponse.json();
        if (artworkData.success) {
          characterArtworks = artworkData.characters || [];
          sceneImages = artworkData.scenes || [];
          console.log('[视频生成] 获取到', characterArtworks.length, '个角色立绘,', sceneImages.length, '个场景图片');
        }
      }
    } catch (e) {
      console.warn('[视频生成] 获取立绘数据失败:', e);
    }

    // ========== 检查所有分镜中的角色和场景 ==========
    const allCharacterNames = new Set<string>();
    const allLocations = new Set<string>();
    
    // 收集开篇钩子的角色和场景
    if (episode.hook && typeof episode.hook === 'object') {
      const hookData = episode.hook as Record<string, unknown>;
      const hookCharacters = (hookData.characters || []) as Array<unknown>;
      if (hookCharacters.length > 0) {
        const firstChar = hookCharacters[0];
        if (typeof firstChar === 'string') {
          hookCharacters.forEach(c => allCharacterNames.add(c as string));
        } else if (typeof firstChar === 'object' && firstChar !== null && 'name' in firstChar) {
          (hookCharacters as Array<{ name: string }>).forEach(c => allCharacterNames.add(c.name));
        }
      }
      const { location: hookLocation } = parseSceneInfo(hookData.scene as string | { location?: string; description?: string } | undefined);
      if (hookLocation) allLocations.add(hookLocation);
      
      // 从对话中提取角色
      const hookDialogues = (hookData.dialogues || []) as Array<{ speaker: string }>;
      hookDialogues.forEach((d) => {
        if (d.speaker && d.speaker !== '旁白') allCharacterNames.add(d.speaker);
      });
    }
    
    // 收集分镜中的角色和场景
    for (const sb of storyboards) {
      // 跳过字符串类型的分镜
      if (typeof sb === 'string') continue;
      
      const sbCharacters = (sb as Record<string, unknown>).characters as Array<unknown> || [];
      if (sbCharacters.length > 0) {
        const firstChar = sbCharacters[0];
        if (typeof firstChar === 'string') {
          sbCharacters.forEach(c => allCharacterNames.add(c as string));
        } else if (typeof firstChar === 'object' && firstChar !== null && 'name' in firstChar) {
          (sbCharacters as Array<{ name: string }>).forEach(c => allCharacterNames.add(c.name));
        }
      }
      
      const sbScene = (sb as Record<string, unknown>).scene;
      const sbLocation = (sbScene as Record<string, unknown>)?.location as string || 
                         (typeof sbScene === 'string' ? sbScene : '');
      if (sbLocation) allLocations.add(sbLocation);
      
      // 从对话中提取角色
      const sbDialogues = ((sb as Record<string, unknown>).dialogues as Array<{ speaker: string }>) || [];
      sbDialogues.forEach((d) => {
        if (d.speaker && d.speaker !== '旁白') allCharacterNames.add(d.speaker);
      });
    }
    
    // 收集结尾悬念的角色和场景
    if (episode.cliffhanger && typeof episode.cliffhanger === 'object') {
      const cliffData = episode.cliffhanger as Record<string, unknown>;
      const cliffCharacters = (cliffData.characters || []) as Array<unknown>;
      if (cliffCharacters.length > 0) {
        const firstChar = cliffCharacters[0];
        if (typeof firstChar === 'string') {
          cliffCharacters.forEach(c => allCharacterNames.add(c as string));
        } else if (typeof firstChar === 'object' && firstChar !== null && 'name' in firstChar) {
          (cliffCharacters as Array<{ name: string }>).forEach(c => allCharacterNames.add(c.name));
        }
      }
      const cliffScene = cliffData.scene as Record<string, unknown> | undefined;
      const cliffLocation = cliffScene?.location as string;
      if (cliffLocation) allLocations.add(cliffLocation);
      
      // 从对话中提取角色
      const cliffDialogues = (cliffData.dialogues || []) as Array<{ speaker: string }>;
      cliffDialogues.forEach((d) => {
        if (d.speaker && d.speaker !== '旁白') allCharacterNames.add(d.speaker);
      });
    }

    // 检查缺少的角色立绘
    const missingCharacters: string[] = [];
    for (const charName of allCharacterNames) {
      const hasArtwork = characterArtworks.some(
        art => art.character_name === charName || art.character_id === charName
      );
      if (!hasArtwork) {
        missingCharacters.push(charName);
      }
    }

    // 检查缺少的场景照
    const missingScenes: string[] = [];
    for (const location of allLocations) {
      if (!location || sceneImages.length === 0) {
        if (location) missingScenes.push(location);
        continue;
      }
      const locationKeywords = location.replace(/[门口内外前侧后上下]/g, '').trim();
      const keywords = locationKeywords.split(/[，,、\s]+/).filter(k => k.length > 1);
      let hasMatch = false;
      for (const keyword of keywords) {
        hasMatch = sceneImages.some(scene => 
          scene.title.includes(keyword) || 
          scene.description?.includes(keyword)
        );
        if (hasMatch) break;
      }
      if (!hasMatch) {
        missingScenes.push(location);
      }
    }

    // 如果缺少素材，提示用户
    if (missingCharacters.length > 0 || (missingScenes.length > 0 && sceneImages.length === 0)) {
      const missingItems: string[] = [];
      if (missingCharacters.length > 0) {
        missingItems.push(`角色立绘: ${missingCharacters.slice(0, 5).join('、')}${missingCharacters.length > 5 ? ` 等${missingCharacters.length}个` : ''}`);
      }
      if (missingScenes.length > 0 && sceneImages.length === 0) {
        missingItems.push(`场景照: ${missingScenes.slice(0, 3).join('、')}${missingScenes.length > 3 ? ` 等${missingScenes.length}个` : ''}`);
      }
      
      toast.error(
        <div>
          <p className="font-medium mb-1">缺少素材，请先生成：</p>
          {missingItems.map((item, i) => (
            <p key={i} className="text-sm">• {item}</p>
          ))}
          <p className="text-sm mt-2 text-muted-foreground">请点击&ldquo;立绘&rdquo;标签页生成所需素材</p>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    setGenerating(`video-${episode.episode_number}`);
    setGeneratingProgress(0);
    setVideoGeneratingEpisode(episode);
    setVideoGeneratingProgress(0);

    // 保存 AbortController 到 ref，用于取消
    const mainController = new AbortController();
    videoAbortControllerRef.current = mainController;

    // 延迟函数，避免API频率限制
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // ========== 场景匹配函数：根据 location 匹配场景图片 ==========
    const matchSceneImage = (location: string): string | undefined => {
      if (!location || sceneImages.length === 0) return undefined;
      
      // 提取关键词（如 "御书房" -> 匹配 "大靖御书房"）
      const locationKeywords = location.replace(/[门口内外前侧后上下]/g, '').trim();
      const keywords = locationKeywords.split(/[，,、\s]+/).filter(k => k.length > 1);
      
      // 按关键词匹配场景
      for (const keyword of keywords) {
        const matched = sceneImages.find(scene => 
          scene.title.includes(keyword) || 
          scene.description?.includes(keyword)
        );
        if (matched) {
          console.log(`[场景匹配] "${location}" -> "${matched.title}"`);
          return matched.imageUrl;
        }
      }
      
      return undefined;
    };

    // ========== 角色特征提取函数：从立绘提示词或角色配置中提取外观描述 ==========
    const extractCharacterAppearance = (characterName: string): string => {
      if (!characterName) return '';
      
      // 方式1：从立绘的 generation_prompt 中提取
      if (characterArtworks.length > 0) {
        // 查找该角色的立绘（优先正面照，因为描述最完整）
        const artwork = characterArtworks.find(a => 
          a.character_name === characterName && 
          (a.purpose?.includes('正面') || a.purpose === '角色正面照')
        ) || characterArtworks.find(a => a.character_name === characterName);
        
        if (artwork?.generation_prompt) {
          // 从 generation_prompt 中提取关键外观信息
          const prompt = artwork.generation_prompt;
          const appearanceParts: string[] = [];
          
          // 提取发型
          const hairstyleMatch = prompt.match(/发型[：:]\s*([^，,。；;]+)/);
          if (hairstyleMatch) appearanceParts.push(hairstyleMatch[1].trim());
          
          // 提取服装
          const clothingMatch = prompt.match(/服装[：:]\s*([^，,。；;]+)/);
          if (clothingMatch) appearanceParts.push(clothingMatch[1].trim());
          
          // 提取肤色
          const skinMatch = prompt.match(/肤色[：:]\s*([^，,。；;]+)/);
          if (skinMatch) appearanceParts.push(skinMatch[1].trim());
          
          // 提取气质
          const temperamentMatch = prompt.match(/气质[：:]\s*([^，,。；;]+)/);
          if (temperamentMatch) appearanceParts.push(temperamentMatch[1].trim());
          
          if (appearanceParts.length > 0) {
            console.log(`[角色特征] ${characterName}: ${appearanceParts.join('，')}`);
            return appearanceParts.join('，');
          }
        }
      }
      
      // 方式2：从角色配置中获取（如果没有立绘）
      const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
      if (seriesChar) {
        const char = seriesChar as Record<string, unknown>;
        const appearanceParts: string[] = [];
        if (char.hairstyle) appearanceParts.push(`发型${char.hairstyle}`);
        if (char.clothing) appearanceParts.push(`服装${char.clothing}`);
        if (char.skinTone) appearanceParts.push(`肤色${char.skinTone}`);
        if (char.temperament) appearanceParts.push(`气质${char.temperament}`);
        if (char.characteristic) appearanceParts.push(`特征${char.characteristic}`);
        if (appearanceParts.length > 0) {
          console.log(`[角色特征-配置] ${characterName}: ${appearanceParts.join('，')}`);
          return appearanceParts.join('，');
        }
      }
      
      return '';
    };

    // ========== 获取角色音色描述 ==========
    const getCharacterVoiceDescription = (characterName: string, emotion?: string, speechRate?: string): string => {
      if (!characterName) return '';
      const seriesChar = selectedSeries?.characters?.find((c: { name: string }) => c.name === characterName);
      if (seriesChar && 'voiceDescription' in seriesChar) {
        const voiceDesc = (seriesChar as { voiceDescription?: string }).voiceDescription || '';
        if (voiceDesc) return voiceDesc;
      }
      if (emotion || speechRate) {
        const voiceParts: string[] = [];
        if (emotion) voiceParts.push(emotion);
        if (speechRate) voiceParts.push(speechRate);
        return voiceParts.join('，');
      }
      return '';
    };

    // ========== 构建增强的视频提示词 ==========
    const buildEnhancedPrompt = (
      basePrompt: string,
      characters: Array<{ name: string }>,
      options?: {
        episodeNumber?: number;
        storyboardIndex?: number;
        duration?: number;
        timeOfDay?: string;
        sceneImageUrl?: string;
        sceneLocation?: string;  // 新增：场景位置名称
        characterImageUrls?: Map<string, string>;
        dialogues?: Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>;
        mood?: string;       // 情绪氛围
        emotion?: string;    // 核心情绪
        shotType?: string;   // 镜头类型
        imageStyle?: string; // 图片风格：realistic（真人风）或 comic（漫画风）
      }
    ): string => {
      const opts = options || {};
      const parts: string[] = [];

      // 根据图片风格选择不同的视觉基底提示词
      const imageStyle = opts.imageStyle || 'realistic';
      if (imageStyle === 'comic') {
        // 漫画风：动漫风格
        parts.push('精致动漫风格，高质量二次元插画，精美细腻的动漫人物，日系动漫风格，赛璐璐渲染，漫画分镜质感，精美线条，鲜艳色彩，动漫人物特征，大眼睛，精致五官，流畅发丝，IMAX电影质感，动态流畅，运镜丝滑，无字幕，角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，');
      } else {
        // 真人风：真人实拍摄影风格
        parts.push('真人实拍摄影风格，专业人像摄影，真实人物质感，真实皮肤纹理，自然毛孔，细腻肤质，真实毛发，自然光影，专业摄影布光，浅景深虚化，胶片质感，IMAX电影质感，35mm镜头，f4光圈，动态流畅，运镜丝滑，无字幕，角色双脚稳稳站立在地面上，身体比例正确，不会陷入地面或漂浮在空中，');
      }

      // 集数和分镜号
      if (opts.episodeNumber !== undefined) {
        const storyboardLabel = opts.storyboardIndex === -1 ? '开篇钩子' :
                                opts.storyboardIndex === -2 ? '结尾悬念' :
                                `${opts.storyboardIndex}`;
        parts.push(`第${opts.episodeNumber}集第${storyboardLabel}分镜`);
      }

      if (opts.duration) {
        parts.push(`${opts.duration}s`);
      }

      // 时间
      if (opts.timeOfDay) {
        parts.push(`时间：${opts.timeOfDay}`);
      }

      // 场景位置（使用@格式作为超链接标记）
      if (opts.sceneLocation) {
        parts.push(`@${opts.sceneLocation}`);
      }

      // 角色外观描述
      const characterDescriptions: string[] = [];
      for (const char of characters) {
        const appearance = extractCharacterAppearance(char.name);

        if (appearance) {
          characterDescriptions.push(`@${char.name}：${appearance}`);
        }
      }

      // 对话部分（使用@格式作为超链接标记）
      const dialogueParts: string[] = [];
      if (opts.dialogues && opts.dialogues.length > 0) {
        for (const d of opts.dialogues) {
          const speaker = d.speaker;
          const content = d.content;

          const speakerLabel = `@${speaker}`;
          const voiceDesc = getCharacterVoiceDescription(speaker, d.emotion, d.speechRate);
          dialogueParts.push(`${speakerLabel}说：「${content}」音色：${voiceDesc}`);
        }
      }

      // 组装
      const result: string[] = [];
      if (parts.length > 0) {
        result.push(parts.join('，') + '。');
      }
      if (characterDescriptions.length > 0) {
        result.push(`【角色外观】${characterDescriptions.join('；')}。`);
      }
      // 修复：无论是否有对话，都要输出 basePrompt（场景描述）
      if (basePrompt) {
        result.push(basePrompt);
      }
      // 对话部分（如果有对话，添加在场景描述之后）
      if (dialogueParts.length > 0) {
        result.push(`【对话】${dialogueParts.join(' ')}`);
      }

      // 电影镜头与情绪引导
      if (opts.mood || opts.emotion || opts.shotType) {
        const guidanceParts: string[] = [];
        if (opts.shotType) guidanceParts.push(`镜头：${opts.shotType}`);
        if (opts.mood) guidanceParts.push(`氛围：${opts.mood}`);
        if (opts.emotion) guidanceParts.push(`情绪：${opts.emotion}`);
        if (guidanceParts.length > 0) {
          result.push(`【导演指导】${guidanceParts.join('，')}，演员表情细腻真实，微表情传达内心活动。`);
        }
      }

      return result.join('\n');
    };

    // ========== 视频生成策略：按分镜原始顺序生成 ==========
    const hookEnabled = !!episode.hook;
    const cliffhangerEnabled = !!episode.cliffhanger;
    
    // 总任务数 = 分镜数 + 开篇钩子(1) + 结尾悬念(1)
    const totalTasks = storyboards.length + (hookEnabled ? 1 : 0) + (cliffhangerEnabled ? 1 : 0);
    
    setVideoTotalTasks(totalTasks);
    setVideoCompletedTasks(0);
    
    let completedTasks = 0;
    let failedTasks = 0;
    
    setFailedVideoTasks([]);
    
    const failedTasksList: Array<{
      id: string;
      type: 'hook' | 'storyboard' | 'cliffhanger';
      index: number;
      prompt: string;
      title: string;
      duration: number;
      firstFrameUrl?: string;
      referenceImageUrls?: string[];
      outputLastFrame: boolean;
      generateAudio: boolean;
      cameraMovement?: string;
      sortOrder: number;
    }> = [];
    
    let sortOrderCounter = 0;

    const generateSingleVideo = async (
      prompt: string, 
      title: string, 
      duration: number,
      taskName: string,
      options?: {
        firstFrameUrl?: string;
        referenceImageUrls?: string[];
        outputLastFrame?: boolean;
        generateAudio?: boolean;
        cameraMovement?: string;
        hookType?: 'hook' | 'cliffhanger' | 'storyboard';
        sortOrder?: number;
      },
      maxRetries: number = 5
    ): Promise<{ success: boolean; lastFrameUrl?: string }> => {
      if (mainController.signal.aborted) return { success: false };

      console.log(`[视频生成] 开始生成: ${taskName}`, options);
      const seriesTitle = selectedSeries?.title?.trim() || '未命名剧集';
      const finalTitle = `${seriesTitle} 第${episode.episode_number}集 ${taskName}`;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (mainController.signal.aborted) return { success: false };
        
        try {
          if (attempt > 1) {
            const waitTime = attempt * 60000;
            console.log(`[视频生成] 等待 ${waitTime/1000}秒 后重试...`);
            toast.info(`第${attempt}次重试，等待 ${waitTime/1000}秒...`);
            await delay(waitTime);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort(new DOMException('视频生成超时', 'TimeoutError'));
          }, 600000);

          const safeDuration = duration || 12;  // 传递原始时长，后端根据模型调整
          const safePrompt = prompt ? (prompt.length > 2000 ? prompt.substring(0, 2000) + '...' : prompt) : '';

          const response = await fetch('/api/videos/generate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-id': currentUserId,
            },
            body: JSON.stringify({
              prompt: safePrompt,
              duration: safeDuration,
              ratio: '16:9',
              resolution: '720p',
              generateAudio: options?.generateAudio ?? false,
              title: finalTitle,
              seriesId: selectedSeries.id,
              episodeNumber: episode.episode_number,
              firstFrameUrl: options?.firstFrameUrl,
              referenceImageUrls: options?.referenceImageUrls,
              outputLastFrame: options?.outputLastFrame,
              cameraMovement: options?.cameraMovement,
              hookType: options?.hookType || 'storyboard',
              sortOrder: options?.sortOrder,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorData: Record<string, unknown> = {};
            try {
              const text = await response.text();
              errorData = JSON.parse(text);
            } catch {}
            
            const isRateLimited = errorData.isRateLimited as boolean || response.status === 429;
            if (isRateLimited && attempt < maxRetries) {
              continue;
            }
            toast.error(`${taskName}生成失败: ${(errorData.error as string) || '未知错误'}`);
            return { success: false };
          }

          const data = await response.json();
          
          // 处理异步任务（智谱）
          if (data.taskId && data.solution === 'zhipu') {
            console.log(`[一键生成] 智谱异步任务: ${data.taskId}`);
            
            const queryParams = new URLSearchParams({
              save: 'true',
              title: finalTitle,
              prompt: safePrompt,
              seriesId: selectedSeries.id,
              episodeNumber: String(episode.episode_number),
              hookType: options?.hookType || 'storyboard',
              solution: 'zhipu',
              ...(options?.sortOrder !== undefined && { sortOrder: String(options.sortOrder) }),
            });
            
            const maxPollTime = 15 * 60 * 1000; // 15分钟
            const pollInterval = 5000;
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxPollTime) {
              if (mainController.signal.aborted) return { success: false };
              
              try {
                const statusResponse = await fetch(`/api/videos/task/${data.taskId}?${queryParams.toString()}`);
                const statusData = await statusResponse.json();
                
                if (statusData.status === 'SUCCESS') {
                  if (statusData.videoUrl) {
                    console.log(`[视频生成] 成功: ${taskName}`);
                    toast.success(`${taskName}生成成功`);
                    return { success: true, lastFrameUrl: statusData.coverUrl || statusData.lastFrameUrl };
                  }
                }
                
                if (statusData.status === 'FAILED') {
                  return { success: false };
                }
                
                await delay(pollInterval);
              } catch {
                await delay(pollInterval);
              }
            }
            
            return { success: false };
          }
          
          // 同步任务成功
          if (data && (data.success || data.video)) {
            console.log(`[视频生成] 成功: ${taskName}`);
            toast.success(`${taskName}生成成功`);
            return { success: true, lastFrameUrl: data.lastFrameUrl };
          }

          if (attempt < maxRetries) continue;
          toast.error(`${taskName}生成失败`);
          return { success: false };
        } catch (error) {
          if (attempt < maxRetries) continue;
          toast.error(`${taskName}生成异常: ${error instanceof Error ? error.message : '未知错误'}`);
          return { success: false };
        }
      }
      return { success: false };
    };

    /**
     * 获取视频生成提示词（仅使用新格式）
     */
    const getVideoPrompt = (shot: typeof storyboards[0]): string | undefined => {
      const videoGen = shot.videoGeneration as Record<string, unknown> | undefined;
      return videoGen?.prompt as string | undefined;
    };

    // 存储上一镜头的尾帧URL，用于连续镜头（确保视频连贯性）
    let lastFrameUrl: string | undefined = undefined;
    
    // 记录当前场景，用于判断是否需要使用场景图片作为首帧
    let currentScene = '';

    // 1. 生成开篇钩子视频 (8-10秒，纯氛围镜头+旁白)
    if (hookEnabled && !mainController.signal.aborted) {
      // 检查开篇钩子是否已生成
      if (hookVideoGenerated) {
        console.log('[视频生成] 开篇钩子已有视频，跳过生成');
      } else {
        // 解析 hook 数据（可能是 JSON 字符串或对象）
        let hookData: HookCliffhangerData;
        if (typeof episode.hook === 'string') {
          try {
            const parsed = JSON.parse(episode.hook);
            hookData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
          } catch {
            // 如果不是 JSON，直接使用字符串作为场景描述
            hookData = { scene: { description: episode.hook } };
          }
        } else {
          hookData = episode.hook;
        }
      
      // 获取 hook 的视频提示词
      // 优先使用顶配爆款版字段：scene + cameraMovement + action + closeup + style + bgmAtmosphere
      let hookPrompt = '';
      
      // 顶配爆款版格式
      if (hookData.scene && hookData.action) {
        // 使用顶配爆款版字段构建提示词
        if (hookData.style) hookPrompt += hookData.style;
        hookPrompt += `，${hookData.scene}`;
        if (hookData.cameraMovement) hookPrompt += `，${hookData.cameraMovement}`;
        hookPrompt += `，${hookData.action}`;
        if (hookData.closeup) hookPrompt += `，${hookData.closeup}`;
        if (hookData.bgmAtmosphere) hookPrompt += `。氛围：${hookData.bgmAtmosphere}`;
      } else if (hookData.visualPrompt) {
        // 兼容旧格式：visualPrompt
        hookPrompt = hookData.visualPrompt;
      } else {
        // 降级：使用 scene.description 或 scene 字符串
        hookPrompt = (typeof hookData.scene === 'object' ? hookData.scene?.description : hookData.scene) || '';
      }
      
      // 视频时长：根据用户类型决定（管理员15秒，普通用户12秒）
      const hookDuration = isAdminUser ? 15 : 12;
      
      // 处理对话（优先使用 dialogues 数组，兼容旧的单 dialogue 字段）
      const hookDialogues = hookData.dialogues || (hookData.dialogue ? [hookData.dialogue] : []);
      
      // 从对话中提取所有说话人，自动补充到镜头人物列表
      const speakersFromDialogues = hookDialogues
        .map((d: { speaker?: string; content?: string }) => d.speaker)
        .filter((s): s is string => !!s && s !== '旁白'); // 过滤掉旁白
      
      // 合并 characters 字段和从对话中提取的角色（去重）
      const hookCharactersFromData = (hookData.characters || []) as string[];
      const hookCharacters = [...new Set([...hookCharactersFromData, ...speakersFromDialogues])];
      
      console.log('[批量生成-开篇钩子] 原始 characters:', hookCharactersFromData);
      console.log('[批量生成-开篇钩子] 从对话提取的角色:', speakersFromDialogues);
      console.log('[批量生成-开篇钩子] 合并后的镜头人物:', hookCharacters);
      
      const hookCharObjects = hookCharacters.map(name => ({ name }));
      
      // 在提示词开头明确镜头中的人物
      if (hookCharacters.length > 0) {
        hookPrompt = `镜头中有${hookCharacters.join('和')}。${hookPrompt}`;
      }
      
      // 注意：对话内容将在 buildEnhancedPrompt 函数中统一处理，这里不再添加到 hookPrompt
      
      console.log('[批量生成-开篇钩子] 镜头角色:', hookCharacters);
      console.log('[批量生成-开篇钩子] 对话数据:', hookDialogues);
      
      // 获取 hook 的场景信息，匹配场景图片
      const { location: hookLocation } = parseSceneInfo(hookData.scene as string | { location?: string; description?: string } | undefined);
      const hookSceneImageUrl = matchSceneImage(hookLocation);
      
      // 创建角色立绘图片URL映射
      const hookCharacterImageUrls = new Map<string, string>();
      
      console.log('[批量生成-开篇钩子] 可用立绘列表:', characterArtworks.map(a => ({ name: a.character_name, purpose: a.purpose, hasImage: !!a.imageUrl })));
      
      // 获取镜头中所有角色的立绘图片
      if (hookCharacters.length > 0 && characterArtworks.length > 0) {
        for (const charName of hookCharacters) {
          // 1. 先尝试精确匹配
          let artwork = characterArtworks.find(a => 
            a.character_name === charName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          
          // 2. 如果精确匹配失败，尝试模糊匹配（角色名包含关系）
          if (!artwork) {
            artwork = characterArtworks.find(a => 
              (a.character_name.includes(charName) || charName.includes(a.character_name)) &&
              (a.purpose?.includes('正面') || a.purpose === '角色正面照')
            ) || characterArtworks.find(a => 
              a.character_name.includes(charName) || charName.includes(a.character_name)
            );
            if (artwork) {
              console.log(`[批量生成-开篇钩子] 角色 "${charName}" 使用模糊匹配找到立绘: "${artwork.character_name}"`);
            }
          }
          
          if (artwork?.imageUrl) {
            hookCharacterImageUrls.set(charName, artwork.imageUrl);
            console.log(`[批量生成-开篇钩子] 角色 "${charName}" 找到立绘图片`);
          } else {
            console.log(`[批量生成-开篇钩子] 角色 "${charName}" 未找到立绘图片`);
          }
        }
      }
      
      console.log('[批量生成-开篇钩子] 角色立绘映射:', Object.fromEntries(hookCharacterImageUrls));
      // 获取镜头中所有角色的立绘图片
      if (hookCharacters.length > 0 && characterArtworks.length > 0) {
        for (const charName of hookCharacters) {
          const artwork = characterArtworks.find(a => 
            a.character_name === charName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          
          if (artwork?.imageUrl) {
            hookCharacterImageUrls.set(charName, artwork.imageUrl);
            console.log(`[批量生成-开篇钩子] 找到角色 ${charName} 的立绘图片`);
          }
        }
      }
      
      // 确定首帧图片策略：
      // - 优先使用场景图片作为首帧（避免角色立绘导致人物陷进地下）
      // - 角色立绘仅作为参考图，不作为首帧
      let hookFirstFrameUrl: string | undefined = undefined;
      
      if (hookSceneImageUrl) {
        hookFirstFrameUrl = hookSceneImageUrl;
        console.log(`[批量生成-开篇钩子] 使用场景图片作为首帧`);
      } else {
        hookFirstFrameUrl = undefined;
        console.log(`[批量生成-开篇钩子] 无场景图片，不使用首帧`);
      }
      
      // 构建增强的提示词（新格式，包含角色立绘标记和音色描述）
      const enhancedHookPrompt = buildEnhancedPrompt(hookPrompt, hookCharObjects, {
        episodeNumber: episode.episode_number,
        storyboardIndex: -1, // 开篇钩子用 -1 表示
        duration: hookDuration,
        sceneImageUrl: hookFirstFrameUrl,
        sceneLocation: hookLocation,  // 添加场景位置（使用@格式作为超链接标记）
        characterImageUrls: hookCharacterImageUrls,
        dialogues: hookDialogues as Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>,
        // 开篇钩子电影感增强
        shotType: '推镜头',
        mood: '悬疑紧张，命运开场',
        emotion: '震撼',
        imageStyle: selectedSeries?.image_style || 'realistic',
      });
      
      // 如果有prompt，生成视频
      if (hookPrompt) {
        // 记录当前场景
        currentScene = hookLocation;
        
        const result = await generateSingleVideo(
          enhancedHookPrompt,
          `${selectedSeries.title} 第${episode.episode_number}集 开篇钩子`,
          hookDuration,
          '开篇钩子',
          {
            firstFrameUrl: hookFirstFrameUrl, // 优先使用角色立绘，否则使用场景图片
            referenceImageUrls: [...new Set([...hookCharacterImageUrls.values()])],
            outputLastFrame: true,  // 必须输出尾帧，用于下一个视频
            generateAudio: true,
            cameraMovement: hookData.cameraMovement,
            hookType: 'hook',
            sortOrder: sortOrderCounter,
          }
        );
        
        // 保存尾帧URL用于下一个镜头（关键：确保视频连贯性）
        if (result.lastFrameUrl) {
          lastFrameUrl = result.lastFrameUrl;
          console.log('[视频生成] 开篇钩子尾帧已保存，用于下一个镜头');
        }
        
        if (result.success) {
          completedTasks++;
          setVideoCompletedTasks(completedTasks);
          setHookVideoGenerated(true);
        } else {
          failedTasks++;
          // 记录失败的视频任务（用于重试）
          failedTasksList.push({
            id: `hook-0-${Date.now()}`,
            type: 'hook',
            index: 0,
            prompt: enhancedHookPrompt, // 使用增强后的提示词
            title: `${selectedSeries.title} 第${episode.episode_number}集 开篇钩子`,
            duration: hookDuration,
            firstFrameUrl: hookSceneImageUrl, // 场景图片首帧
            outputLastFrame: true,
            generateAudio: true,
            cameraMovement: hookData.cameraMovement,
            sortOrder: sortOrderCounter,
          });
        }
        sortOrderCounter++;
      } else {
        console.warn('[视频生成] 开篇钩子缺少 visualPrompt，跳过。');
      }
      }
    }

    // 2. 按分镜原始顺序生成视频（不再区分有对话/无对话）
    // 关键：必须按顺序生成，不能跳过前面的分镜
    for (let index = 0; index < storyboards.length; index++) {
      if (mainController.signal.aborted) break;

      const shot = storyboards[index];
      const taskName = `分镜${index + 1}`;
      
      // 检查该分镜是否已有视频
      if (generatedStoryboardIndices.has(index)) {
        console.log(`[视频生成] ${taskName} 已有视频，跳过生成`);
        continue;
      }
      
      // 【顺序生成检查】确保前面的分镜都有视频
      // 如果前面的分镜没有视频，不能生成后面的，必须等待前面的先生成
      let missingPreviousIndex = -1;
      for (let prevIndex = 0; prevIndex < index; prevIndex++) {
        if (!generatedStoryboardIndices.has(prevIndex)) {
          missingPreviousIndex = prevIndex;
          break;
        }
      }
      
      if (missingPreviousIndex >= 0) {
        console.error(`[视频生成] 分镜${index + 1} 不能生成，因为分镜${missingPreviousIndex + 1} 还没有视频`);
        toast.error(`分镜${index + 1} 不能生成，请先生成分镜${missingPreviousIndex + 1}`);
        failedTasks++;
        failedTasksList.push({
          id: `storyboard-${index}-${Date.now()}`,
          type: 'storyboard',
          index: index,
          prompt: '【顺序生成错误】前面的分镜未生成',
          title: `${selectedSeries.title} 第${episode.episode_number}集 ${taskName}`,
          duration: 0,
          firstFrameUrl: undefined,
          outputLastFrame: false,
          generateAudio: false,
          sortOrder: sortOrderCounter,
        });
        continue; // 跳过这个分镜，继续检查下一个
      }
      
      // 获取prompt（必须包含 videoGeneration.prompt）
      const videoGen = shot.videoGeneration as Record<string, unknown> | undefined;
      let shotPrompt = getVideoPrompt(shot);
      
      // 如果没有prompt，跳过此镜头
      if (!shotPrompt) {
        console.warn(`[视频生成] 分镜${index + 1}缺少 videoGeneration.prompt，跳过。`);
        continue;
      }

      // 获取分镜的场景信息和角色信息
      const { location: shotLocation, description: shotSceneDesc } = parseSceneInfo(shot.scene);
      const shotTimeOfDay = (shot.scene as Record<string, unknown>)?.time as string || '';
      // 视频时长：根据用户类型决定（管理员15秒，普通用户12秒）
      const shotDuration = isAdminUser ? 15 : 12;
      
      // 兼容 characters 的两种格式：字符串数组 ["沈砚", "丫鬟"] 或对象数组 [{ name: "沈砚" }]
      const rawShotCharacters = shot.characters || [];
      let shotCharacterNames: string[] = [];
      let shotCharactersList: Array<{ name: string }>;
      
      if (rawShotCharacters.length > 0) {
        const firstChar = rawShotCharacters[0];
        if (typeof firstChar === 'string') {
          // 字符串数组格式：["沈砚", "丫鬟"]
          shotCharacterNames = rawShotCharacters as unknown as string[];
          shotCharactersList = shotCharacterNames.map(name => ({ name }));
        } else if (typeof firstChar === 'object' && firstChar !== null && 'name' in firstChar) {
          // 对象数组格式：[{ name: "沈砚" }]
          shotCharactersList = rawShotCharacters as unknown as Array<{ name: string }>;
          shotCharacterNames = shotCharactersList.map(c => c.name);
        } else {
          shotCharactersList = [];
          shotCharacterNames = [];
        }
      } else {
        shotCharactersList = [];
        shotCharacterNames = [];
      }
      
      console.log(`[批量生成-分镜${index + 1}] 原始 characters:`, rawShotCharacters);
      console.log(`[批量生成-分镜${index + 1}] 解析后的角色名:`, shotCharacterNames);
      
      // 处理对话（优先使用 dialogues 数组，兼容旧的单 dialogue 字段）
      const shotDialogues = (shot.dialogues as Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>) || 
        (shot.dialogue ? [shot.dialogue as { speaker: string; content: string; emotion?: string; speechRate?: string }] : []);
      
      // 从对话中提取说话人，合并到角色列表（确保所有说话人都在镜头角色中）
      if (shotDialogues.length > 0) {
        const speakersFromDialogues = shotDialogues
          .map(d => d.speaker)
          .filter((s): s is string => !!s && s !== '旁白');
        
        // 合并并去重
        const mergedNames = [...new Set([...shotCharacterNames, ...speakersFromDialogues])];
        if (mergedNames.length > shotCharacterNames.length) {
          console.log(`[批量生成-分镜${index + 1}] 从对话中补充角色:`, speakersFromDialogues.filter(s => !shotCharacterNames.includes(s)));
          shotCharacterNames = mergedNames;
          shotCharactersList = mergedNames.map(name => ({ name }));
        }
      }
      
      // 在提示词开头明确镜头中的人物
      if (shotCharacterNames.length > 0) {
        shotPrompt = `镜头中有${shotCharacterNames.join('和')}。${shotPrompt}`;
      }
      
      // 注意：对话内容将在 buildEnhancedPrompt 函数中统一处理，这里不再添加到 shotPrompt
      
      console.log(`[批量生成-分镜${index + 1}] 镜头角色:`, shotCharacterNames);
      console.log(`[批量生成-分镜${index + 1}] 对话数据:`, shotDialogues);
      console.log(`[批量生成-分镜${index + 1}] 可用立绘列表:`, characterArtworks.map(a => ({ name: a.character_name, purpose: a.purpose, hasImage: !!a.imageUrl })));
      
      // 创建角色立绘图片URL映射
      const shotCharacterImageUrls = new Map<string, string>();
      
      // 预先为镜头中的角色查找立绘图片
      if (shotCharacterNames.length > 0 && characterArtworks.length > 0) {
        for (const charName of shotCharacterNames) {
          // 1. 先尝试精确匹配
          let artwork = characterArtworks.find(a => 
            a.character_name === charName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          
          // 2. 如果精确匹配失败，尝试模糊匹配（角色名包含关系）
          if (!artwork) {
            artwork = characterArtworks.find(a => 
              (a.character_name.includes(charName) || charName.includes(a.character_name)) &&
              (a.purpose?.includes('正面') || a.purpose === '角色正面照')
            ) || characterArtworks.find(a => 
              a.character_name.includes(charName) || charName.includes(a.character_name)
            );
            if (artwork) {
              console.log(`[批量生成-分镜${index + 1}] 角色 "${charName}" 使用模糊匹配找到立绘: "${artwork.character_name}"`);
            }
          }
          
          if (artwork?.imageUrl) {
            shotCharacterImageUrls.set(charName, artwork.imageUrl);
            console.log(`[批量生成-分镜${index + 1}] 角色 "${charName}" 找到立绘图片`);
          } else {
            console.log(`[批量生成-分镜${index + 1}] 角色 "${charName}" 未找到立绘图片`);
          }
        }
      }
      
      console.log(`[批量生成-分镜${index + 1}] 角色立绘映射:`, Object.fromEntries(shotCharacterImageUrls));
      
      // 构建增强的提示词（新格式，包含角色立绘标记和音色描述）
      const enhancedPrompt = buildEnhancedPrompt(shotPrompt, shotCharactersList, {
        episodeNumber: episode.episode_number,
        storyboardIndex: index + 1,
        duration: shotDuration,
        timeOfDay: shotTimeOfDay,
        sceneImageUrl: undefined, // 稍后在首帧逻辑中确定
        characterImageUrls: shotCharacterImageUrls,
        dialogues: shotDialogues,
        // 电影感增强
        shotType: (shot as Record<string, unknown>).cameraMovement as string || (shot as Record<string, unknown>).closeup as string || '',
        mood: (shot as Record<string, unknown>).bgmAtmosphere as string || (shot as Record<string, unknown>).style as string || '',
        emotion: (shot as Record<string, unknown>).emotion as string || '',
        imageStyle: selectedSeries?.image_style || 'realistic',
      });

      // 判断是否有对话（用于提示词构建，不影响音频生成）
      const hasDialogue = shot.dialogue && (shot.dialogue as Record<string, unknown>)?.content;
      // 视频生成时始终带声音（AI会根据提示词中的对话内容生成对应音频）
      const shouldGenerateAudio = true;
      
      // 决定首帧图片：
      // 1. 如果有上一镜头的尾帧，优先使用尾帧（保持连贯性）
      // 2. 如果没有尾帧：
      //    - 单角色镜头：使用角色立绘作为首帧
      //    - 多角色镜头：使用场景图片作为首帧（让模型根据文本描述生成多角色）
      const sceneChanged = shotLocation && shotLocation !== currentScene && !lastFrameUrl;
      let shotFirstFrame: string | undefined = undefined;
      
      // 优先使用上一镜头的尾帧
      if (lastFrameUrl) {
        shotFirstFrame = lastFrameUrl;
        console.log(`[视频生成] ${taskName} 使用上一镜头尾帧作为首帧`);
      } else {
        // 没有尾帧时，根据角色数量决定首帧策略
        if (shotCharacterNames.length === 1) {
          // 单角色镜头：使用角色立绘作为首帧
          const firstCharName = shotCharacterNames[0];
          const firstCharArtwork = shotCharacterImageUrls.get(firstCharName);
          if (firstCharArtwork) {
            shotFirstFrame = firstCharArtwork;
            console.log(`[视频生成] ${taskName} 单角色镜头，使用角色 ${firstCharName} 的立绘作为首帧`);
          } else {
            // 没有立绘，使用场景图片
            const sceneImageUrl = matchSceneImage(shotLocation);
            if (sceneImageUrl) {
              shotFirstFrame = sceneImageUrl;
              console.log(`[视频生成] ${taskName} 单角色镜头但无立绘，使用场景图片作为首帧`);
            }
          }
        } else if (shotCharacterNames.length > 1) {
          // 多角色镜头：使用场景图片作为首帧
          const sceneImageUrl = matchSceneImage(shotLocation);
          if (sceneImageUrl) {
            shotFirstFrame = sceneImageUrl;
            console.log(`[视频生成] ${taskName} 多角色镜头(${shotCharacterNames.length}人)，使用场景图片作为首帧`);
          } else {
            console.log(`[视频生成] ${taskName} 多角色镜头但无场景图片，让模型根据文本描述生成`);
          }
        } else {
          // 无角色镜头：使用场景图片
          const sceneImageUrl = matchSceneImage(shotLocation);
          if (sceneImageUrl) {
            shotFirstFrame = sceneImageUrl;
            console.log(`[视频生成] ${taskName} 无角色镜头，使用场景图片作为首帧`);
          }
        }
      }
      
      // 更新当前场景
      currentScene = shotLocation;

      const result = await generateSingleVideo(
        enhancedPrompt,
        `${selectedSeries.title} 第${episode.episode_number}集 ${taskName}`,
        Math.min(adminDuration, 15),
        taskName,
        {
          firstFrameUrl: shotFirstFrame,
          referenceImageUrls: [...new Set([...shotCharacterImageUrls.values()])],
          outputLastFrame: true,  // 必须输出尾帧，用于下一个视频
          generateAudio: shouldGenerateAudio,
          cameraMovement: typeof videoGen?.cameraMovement === 'string' ? videoGen.cameraMovement : undefined,
          hookType: 'storyboard',
          sortOrder: sortOrderCounter,
        }
      );
      
      // 保存尾帧URL用于下一个镜头（关键：确保视频连贯性）
      if (result.lastFrameUrl) {
        lastFrameUrl = result.lastFrameUrl;
        console.log(`[视频生成] ${taskName}尾帧已保存，用于下一个镜头`);
      }
      
      if (result.success) {
        completedTasks++;
        setVideoCompletedTasks(completedTasks);
        // 标记该分镜索引已生成
        setGeneratedStoryboardIndices(prev => new Set(prev).add(index));
      } else {
        failedTasks++;
        // 记录失败的视频任务（用于重试）
        failedTasksList.push({
          id: `storyboard-${index}-${Date.now()}`,
          type: 'storyboard',
          index: index,
          prompt: enhancedPrompt, // 使用增强后的提示词
          title: `${selectedSeries.title} 第${episode.episode_number}集 ${taskName}`,
          duration: Math.max(12, Math.min((videoGen?.duration as number) || shot.duration || adminDuration, 15)),
          firstFrameUrl: shotFirstFrame,
          outputLastFrame: true,
          generateAudio: shouldGenerateAudio,
          cameraMovement: typeof videoGen?.cameraMovement === 'string' ? videoGen.cameraMovement : undefined,
          sortOrder: sortOrderCounter,
        });
      }
      sortOrderCounter++;
      
      const progress = Math.min(100, (completedTasks / totalTasks) * 100);
      setGeneratingProgress(progress);
      setVideoGeneratingProgress(progress);
      
      await delay(30000); // 30秒间隔，避免API限流
    }

    // 3. 生成结尾悬念视频 (6-8秒)
    if (cliffhangerEnabled && !mainController.signal.aborted) {
      // 检查结尾悬念是否已生成
      if (cliffhangerVideoGenerated) {
        console.log('[视频生成] 结尾悬念已有视频，跳过生成');
      } else {
        await delay(30000); // 30秒间隔，避免API限流
        
        // 解析 cliffhanger 数据（可能是 JSON 字符串或对象）
        let cliffhangerData: HookCliffhangerData;
        if (typeof episode.cliffhanger === 'string') {
          try {
            const parsed = JSON.parse(episode.cliffhanger);
            cliffhangerData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
          } catch {
            // 如果不是 JSON，直接使用字符串作为场景描述
            cliffhangerData = { scene: { description: episode.cliffhanger } };
          }
        } else {
          cliffhangerData = episode.cliffhanger;
        }
      
      // 获取 cliffhanger 的视频提示词
      // 优先使用顶配爆款版字段：scene + cameraMovement + action + closeup + style + bgmAtmosphere
      let cliffhangerPrompt = '';
      
      // 顶配爆款版格式
      if (cliffhangerData.scene && cliffhangerData.action) {
        // 使用顶配爆款版字段构建提示词
        if (cliffhangerData.style) cliffhangerPrompt += cliffhangerData.style;
        cliffhangerPrompt += `，${cliffhangerData.scene}`;
        if (cliffhangerData.cameraMovement) cliffhangerPrompt += `，${cliffhangerData.cameraMovement}`;
        cliffhangerPrompt += `，${cliffhangerData.action}`;
        if (cliffhangerData.closeup) cliffhangerPrompt += `，${cliffhangerData.closeup}`;
        if (cliffhangerData.bgmAtmosphere) cliffhangerPrompt += `。氛围：${cliffhangerData.bgmAtmosphere}`;
      } else if (cliffhangerData.visualPrompt) {
        // 兼容旧格式：visualPrompt
        cliffhangerPrompt = cliffhangerData.visualPrompt;
      } else {
        // 降级：使用 scene.description 或 scene 字符串
        cliffhangerPrompt = (typeof cliffhangerData.scene === 'object' ? cliffhangerData.scene?.description : cliffhangerData.scene) || '';
      }
      
      // 视频时长：根据用户类型决定（管理员15秒，普通用户12秒）
      const cliffhangerDuration = isAdminUser ? 15 : 12;
      
      // 处理对话（优先使用 dialogues 数组，兼容旧的单 dialogue 字段）
      const cliffhangerDialogues = cliffhangerData.dialogues || (cliffhangerData.dialogue ? [cliffhangerData.dialogue] : []);
      
      // 从对话中提取所有说话人，自动补充到镜头人物列表
      const speakersFromDialogues = cliffhangerDialogues
        .map((d: { speaker?: string; content?: string }) => d.speaker)
        .filter((s): s is string => !!s && s !== '旁白'); // 过滤掉旁白
      
      // 合并 characters 字段和从对话中提取的角色（去重）
      const cliffhangerCharactersFromData = (cliffhangerData.characters || []) as string[];
      const cliffhangerCharacters = [...new Set([...cliffhangerCharactersFromData, ...speakersFromDialogues])];
      
      console.log('[批量生成-结尾悬念] 原始 characters:', cliffhangerCharactersFromData);
      console.log('[批量生成-结尾悬念] 从对话提取的角色:', speakersFromDialogues);
      console.log('[批量生成-结尾悬念] 合并后的镜头人物:', cliffhangerCharacters);
      
      const cliffhangerCharObjects = cliffhangerCharacters.map(name => ({ name }));
      
      // 在提示词开头明确镜头中的人物
      if (cliffhangerCharacters.length > 0) {
        cliffhangerPrompt = `镜头中有${cliffhangerCharacters.join('和')}。${cliffhangerPrompt}`;
      }
      
      // 注意：对话内容将在 buildEnhancedPrompt 函数中统一处理，这里不再添加到 cliffhangerPrompt
      
      console.log('[批量生成-结尾悬念] 镜头角色:', cliffhangerCharacters);
      console.log('[批量生成-结尾悬念] 对话数据:', cliffhangerDialogues);
      
      // 获取 cliffhanger 的场景信息
      const { location: cliffhangerLocation } = parseSceneInfo(cliffhangerData.scene);
      const cliffhangerSceneImageUrl = matchSceneImage(cliffhangerLocation);
      
      // 创建角色立绘图片URL映射
      const cliffhangerCharacterImageUrls = new Map<string, string>();
      
      console.log('[批量生成-结尾悬念] 可用立绘列表:', characterArtworks.map(a => ({ name: a.character_name, purpose: a.purpose, hasImage: !!a.imageUrl })));
      
      // 获取镜头中所有角色的立绘图片
      if (cliffhangerCharacters.length > 0 && characterArtworks.length > 0) {
        for (const charName of cliffhangerCharacters) {
          // 1. 先尝试精确匹配
          let artwork = characterArtworks.find(a => 
            a.character_name === charName && 
            (a.purpose?.includes('正面') || a.purpose === '角色正面照')
          ) || characterArtworks.find(a => a.character_name === charName);
          
          // 2. 如果精确匹配失败，尝试模糊匹配（角色名包含关系）
          if (!artwork) {
            artwork = characterArtworks.find(a => 
              (a.character_name.includes(charName) || charName.includes(a.character_name)) &&
              (a.purpose?.includes('正面') || a.purpose === '角色正面照')
            ) || characterArtworks.find(a => 
              a.character_name.includes(charName) || charName.includes(a.character_name)
            );
            if (artwork) {
              console.log(`[批量生成-结尾悬念] 角色 "${charName}" 使用模糊匹配找到立绘: "${artwork.character_name}"`);
            }
          }
          
          if (artwork?.imageUrl) {
            cliffhangerCharacterImageUrls.set(charName, artwork.imageUrl);
            console.log(`[批量生成-结尾悬念] 角色 "${charName}" 找到立绘图片`);
          } else {
            console.log(`[批量生成-结尾悬念] 角色 "${charName}" 未找到立绘图片`);
          }
        }
      }
      
      console.log('[批量生成-结尾悬念] 角色立绘映射:', Object.fromEntries(cliffhangerCharacterImageUrls));
      
      // 确定首帧图片策略：
      // - 如果有上一镜头的尾帧，优先使用尾帧（保持连贯性）
      // - 优先使用场景图片作为首帧（避免角色立绘导致人物陷进地下）
      // - 角色立绘仅作为参考图，不作为首帧
      let cliffhangerFirstFrameUrl: string | undefined = lastFrameUrl || undefined;
      
      if (!lastFrameUrl) {
        if (cliffhangerSceneImageUrl) {
          cliffhangerFirstFrameUrl = cliffhangerSceneImageUrl;
          console.log(`[批量生成-结尾悬念] 使用场景图片作为首帧`);
        } else {
          cliffhangerFirstFrameUrl = undefined;
          console.log(`[批量生成-结尾悬念] 无场景图片，不使用首帧`);
        }
      } else {
        console.log(`[批量生成-结尾悬念] 使用上一镜头尾帧作为首帧`);
      }
      
      // 构建增强的提示词（新格式，包含角色立绘标记和音色描述）
      const enhancedCliffhangerPrompt = buildEnhancedPrompt(cliffhangerPrompt, cliffhangerCharObjects, {
        episodeNumber: episode.episode_number,
        storyboardIndex: -2, // 结尾悬念用 -2 表示
        duration: cliffhangerDuration,
        sceneImageUrl: cliffhangerFirstFrameUrl,
        sceneLocation: cliffhangerLocation,  // 添加场景位置（使用@格式作为超链接标记）
        characterImageUrls: cliffhangerCharacterImageUrls,
        dialogues: cliffhangerDialogues as Array<{ speaker: string; content: string; emotion?: string; speechRate?: string }>,
        // 结尾悬念电影感增强
        shotType: '拉镜头',
        mood: '悬念留白，命运未卜',
        emotion: '紧张',
        imageStyle: selectedSeries?.image_style || 'realistic',
      });
      
      // 如果有prompt，生成视频
      if (cliffhangerPrompt) {
        const result = await generateSingleVideo(
          enhancedCliffhangerPrompt,
          `${selectedSeries.title} 第${episode.episode_number}集 结尾悬念`,
          cliffhangerDuration,
          '结尾悬念',
          {
            firstFrameUrl: cliffhangerFirstFrameUrl, // 优先使用尾帧，其次角色立绘，最后场景图片
            referenceImageUrls: [...new Set([...cliffhangerCharacterImageUrls.values()])],
            outputLastFrame: false, // 结尾不需要输出尾帧
            generateAudio: true,
            cameraMovement: cliffhangerData.cameraMovement,
            hookType: 'cliffhanger',
            sortOrder: sortOrderCounter,
          }
        );
        
        if (result.success) {
          completedTasks++;
          setVideoCompletedTasks(completedTasks);
          setCliffhangerVideoGenerated(true);
        } else {
          failedTasks++;
          // 记录失败的视频任务（用于重试）
          failedTasksList.push({
            id: `cliffhanger-${storyboards.length}-${Date.now()}`,
            type: 'cliffhanger',
            index: storyboards.length,
            prompt: enhancedCliffhangerPrompt, // 使用增强后的提示词
            title: `${selectedSeries.title} 第${episode.episode_number}集 结尾悬念`,
            duration: cliffhangerDuration,
            firstFrameUrl: lastFrameUrl,
            outputLastFrame: false,
            generateAudio: true,
            cameraMovement: cliffhangerData.cameraMovement,
            sortOrder: sortOrderCounter,
          });
        }
        sortOrderCounter++;
        
        const progress = Math.min(100, (completedTasks / totalTasks) * 100);
        setGeneratingProgress(progress);
        setVideoGeneratingProgress(progress);
      } else {
        console.warn('[视频生成] 结尾悬念缺少 visualPrompt，跳过。');
      }
      }
    }

    // 最终状态更新
    setGenerating(null);
    setGeneratingProgress(0);
    videoAbortControllerRef.current = null;

    // 保存失败视频记录（按顺序排序）
    if (failedTasksList.length > 0) {
      failedTasksList.sort((a, b) => a.sortOrder - b.sortOrder);
      setFailedVideoTasks([...failedTasksList]);
      console.log(`[视频生成] 记录失败视频: ${failedTasksList.length}个`, failedTasksList.map(t => t.type));
    }

    // 刷新视频列表
    loadEpisodeVideos(selectedSeries.id, episode.episode_number);

    // 显示最终结果
    if (completedTasks === totalTasks) {
      toast.success(`第${episode.episode_number}集视频全部生成完成！共${totalTasks}个视频`);
      setVideoGeneratingEpisode(null);
      setVideoGeneratingProgress(0);
      // 重置任务计数（在所有操作完成后）
      setVideoCompletedTasks(0);
      setVideoTotalTasks(0);
      setFailedVideoTasks([]); // 清空失败记录
    } else if (completedTasks > 0) {
      toast.info(`第${episode.episode_number}集已生成${completedTasks}/${totalTasks}个视频，失败${failedTasks}个`, {
        description: '可以点击"重试失败视频"按钮补充生成失败的视频',
        duration: 10000,
      });
      // 保持视频生成状态，让用户可以重新生成
      // 保持进度显示，不重置计数
    } else {
      toast.error(`第${episode.episode_number}集视频生成失败，请点击"重试失败视频"重试`);
      // 保持视频生成状态，让用户可以重新生成
      // 重置计数，因为没有成功的
      setVideoCompletedTasks(0);
      setVideoTotalTasks(0);
    }
  };

  // 同步素材：为分镜中的角色和场景自动生成缺失的立绘和场景图片
  const syncEpisodeAssets = async () => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    setSyncingAssets(true);
    toast.info('正在同步素材，分析分镜中的角色和场景...');

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${selectedSeries.id}/episodes/${viewingEpisode.episode_number}/sync-assets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || '同步素材失败');
        return;
      }

      const { summary, generated } = result;
      
      if (summary.generatedCharacters === 0 && summary.generatedScenes === 0) {
        toast.success('素材已完整，无需生成新素材');
      } else {
        toast.success(`同步完成！生成角色立绘 ${summary.generatedCharacters} 个，场景图片 ${summary.generatedScenes} 个`, {
          description: `角色: ${generated.characters.join('、') || '无'}；场景: ${generated.scenes.join('、') || '无'}`,
          duration: 5000,
        });
        
        // 刷新立绘列表
        loadArtwork();
      }

      // 显示失败信息
      if (summary.failedCharacters.length > 0 || summary.failedScenes.length > 0) {
        toast.warning(`部分素材生成失败：角色 ${summary.failedCharacters.length} 个，场景 ${summary.failedScenes.length} 个`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('同步素材失败:', error);
      toast.error('同步素材失败，请稍后重试');
    } finally {
      setSyncingAssets(false);
    }
  };

  // 同步视频素材：为分镜自动生成缺失的视频素材
  const syncEpisodeVideos = async () => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    setSyncingVideos(true);
    toast.info('正在同步视频素材，分析分镜中的视频需求...');

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${selectedSeries.id}/episodes/${viewingEpisode.episode_number}/sync-videos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || '同步视频素材失败');
        return;
      }

      const { summary, generated } = result;

      if (summary.generatedVideos === 0) {
        toast.success('视频素材已完整，无需生成新视频', {
          description: `已跳过 ${summary.skippedVideos} 个已有的视频`,
          duration: 5000,
        });
      } else {
        toast.success(`同步完成！生成视频 ${summary.generatedVideos} 个`, {
          description: generated.map((v: { title: string }) => v.title).join('、'),
          duration: 5000,
        });

        // 刷新视频列表
        loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
      }

      // 显示失败信息
      if (summary.failedVideos > 0) {
        toast.warning(`${summary.failedVideos} 个视频生成失败`, {
          description: result.failed.map((f: { error: string }) => f.error).join('; '),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('同步视频素材失败:', error);
      toast.error('同步视频素材失败，请稍后重试');
    } finally {
      setSyncingVideos(false);
    }
  };

  // 显示图片预览
  const showImagePreviewDialog = (imageUrl: string, title: string) => {
    setPreviewImageUrl(imageUrl);
    setPreviewImageTitle(title);
    setShowImagePreview(true);
  };

  // 计算编辑距离（Levenshtein Distance）
  const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  };

  // 计算相似度（0-1之间，1表示完全相同）
  const similarity = (a: string, b: string): number => {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshteinDistance(a, b) / maxLen;
  };

  // 获取场景照URL
  const getSceneImageUrl = (sceneLocation: string): string | null => {
    if (!sceneLocation) return null;
    
    // 规范化场景名称：去除常见后缀
    const normalizeSceneName = (name: string) => {
      return name.replace(/\s*[-－]\s*场景照\s*$/, '').trim();
    };
    
    const normalizedInput = normalizeSceneName(sceneLocation);
    
    // 查找匹配的场景 - 按优先级排序
    let bestMatch: typeof artworkScenes[0] | null = null;
    let bestScore = 0;
    
    for (const s of artworkScenes) {
      const normalizedTitle = normalizeSceneName(s.title || '');
      
      // 1. 精确匹配（最高优先级）
      if (normalizedTitle === normalizedInput) {
        bestMatch = s;
        bestScore = 1;
        break; // 精确匹配，直接跳出
      }
      
      // 2. 包含匹配（双向）
      if (normalizedInput.includes(normalizedTitle) || normalizedTitle.includes(normalizedInput)) {
        const score = Math.min(normalizedTitle.length, normalizedInput.length) / Math.max(normalizedTitle.length, normalizedInput.length);
        if (score > bestScore) {
          bestMatch = s;
          bestScore = score;
        }
      }
      
      // 3. 编辑距离匹配（兜底）- 允许最多2个字符的差异
      const score = similarity(normalizedInput, normalizedTitle);
      if (score >= 0.75 && score > bestScore) { // 相似度 >= 75%
        bestMatch = s;
        bestScore = score;
      }
    }
    
    // 调试日志（生产环境可移除）
    if (normalizedInput && !bestMatch && artworkScenes.length > 0) {
      console.log(`[场景匹配失败] 输入: "${normalizedInput}", 可用场景:`, artworkScenes.map(s => s.title));
    }
    
    return bestMatch?.imageUrl || null;
  };

  // 获取角色立绘URL
  const getCharacterImageUrl = (characterName: string): string | null => {
    if (!characterName) return null;
    
    // 规范化角色名称
    const normalizeCharName = (name: string) => {
      return name.replace(/\s*[-－]\s*(主角|配角|神秘人|路人|立绘).*$/, '').trim();
    };
    
    const normalizedInput = normalizeCharName(characterName);
    
    // 查找匹配的角色 - 按优先级排序
    let bestMatch: typeof artworkCharacters[0] | null = null;
    let bestScore = 0;
    
    for (const c of artworkCharacters) {
      const normalizedCharName = normalizeCharName(c.character_name || '');
      
      // 1. 精确匹配（最高优先级）
      if (normalizedCharName === normalizedInput) {
        bestMatch = c;
        bestScore = 1;
        break; // 精确匹配，直接跳出
      }
      
      // 2. 包含匹配（双向）
      if (normalizedInput.includes(normalizedCharName) || normalizedCharName.includes(normalizedInput)) {
        const score = Math.min(normalizedCharName.length, normalizedInput.length) / Math.max(normalizedCharName.length, normalizedInput.length);
        if (score > bestScore) {
          bestMatch = c;
          bestScore = score;
        }
      }
      
      // 3. 编辑距离匹配（兜底）- 允许最多2个字符的差异
      const score = similarity(normalizedInput, normalizedCharName);
      if (score >= 0.75 && score > bestScore) { // 相似度 >= 75%
        bestMatch = c;
        bestScore = score;
      }
    }
    
    // 调试日志（生产环境可移除）
    if (normalizedInput && !bestMatch && artworkCharacters.length > 0) {
      console.log(`[角色匹配失败] 输入: "${normalizedInput}", 可用角色:`, artworkCharacters.map(c => c.character_name));
    }
    
    return bestMatch?.imageUrl || null;
  };

  // 下载剧集剧本
  const downloadEpisodeScript = () => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    // 构建剧本内容
    const lines: string[] = [];
    
    // 标题
    lines.push(`《${selectedSeries.title}》第${viewingEpisode.episode_number}集`);
    lines.push('='.repeat(30));
    lines.push('');

    // 开篇钩子
    if (viewingEpisode.hook) {
      let hookData: HookCliffhangerData;
      if (typeof viewingEpisode.hook === 'string') {
        try {
          const parsed = JSON.parse(viewingEpisode.hook);
          hookData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
        } catch {
          hookData = { scene: { description: viewingEpisode.hook } };
        }
      } else {
        hookData = viewingEpisode.hook;
      }

      lines.push('【开篇钩子】');
      lines.push('-'.repeat(20));
      
      // 单镜头开篇钩子格式
      const { location: hookSceneLocation, description: hookSceneDesc } = parseSceneInfo(hookData.scene);
      if (hookSceneLocation) lines.push(`场景：${hookSceneLocation}`);
      if (hookSceneDesc) lines.push(`描述：${hookSceneDesc}`);
      
      // 角色和对话
      const hookCharacters = hookData.characters || [];
      const hookDialogues = hookData.dialogues || [];
      if (hookCharacters.length > 0) {
        lines.push(`角色：${hookCharacters.join('、')}`);
      }
      if (hookDialogues.length > 0) {
        lines.push('对话：');
        hookDialogues.forEach(d => {
          const isOffScreen = (d as { isOffScreen?: boolean }).isOffScreen;
          const offScreenMark = isOffScreen ? '(画外音)' : '';
          lines.push(`  ${d.speaker}${offScreenMark}：${d.content}${d.emotion ? `（${d.emotion}）` : ''}`);
        });
      }
      
      // 镜头信息
      if (hookData.shotType) lines.push(`镜头：${hookData.shotType}`);
      if (hookData.duration) lines.push(`时长：${hookData.duration}`);
      if (hookData.visualPrompt) lines.push(`视觉提示：${hookData.visualPrompt}`);
      lines.push('');
    }

    // 分镜列表
    if (viewingEpisode.storyboards && viewingEpisode.storyboards.length > 0) {
      lines.push('【分镜剧本】');
      lines.push('-'.repeat(20));

      viewingEpisode.storyboards.forEach((storyboard, index) => {
        const sequence = viewingEpisode?.hook ? index + 2 : index + 1;
        lines.push(`\n--- 分镜 ${sequence} ---`);

        const sceneDesc = typeof storyboard.scene === 'string' 
          ? storyboard.scene 
          : String((storyboard.scene as Record<string, unknown>)?.description || '未设置');
        const sceneLocation = typeof storyboard.scene === 'object' 
          ? String((storyboard.scene as Record<string, unknown>)?.location || '')
          : '';
        const characters = storyboard.characters as Array<Record<string, unknown>> | undefined;
        const dialogues = storyboard.dialogues as Array<Record<string, unknown>> | undefined;

        if (sceneLocation) lines.push(`场景：${sceneLocation}`);
        if (sceneDesc) lines.push(`描述：${sceneDesc}`);
        
        if (characters && characters.length > 0) {
          const charNames = characters.map(c => String(c.name)).join('、');
          lines.push(`角色：${charNames}`);
        }

        if (dialogues && dialogues.length > 0) {
          lines.push('对话：');
          dialogues.forEach(d => {
            const speaker = String((d as Record<string, unknown>).speaker || '');
            const content = String((d as Record<string, unknown>).content || '');
            const emotion = String((d as Record<string, unknown>).emotion || '');
            lines.push(`  ${speaker}：${content}${emotion ? `（${emotion}）` : ''}`);
          });
        }

        if (storyboard.shotType) lines.push(`镜头：${storyboard.shotType}`);
        if (storyboard.duration) lines.push(`时长：${storyboard.duration}`);
        if (storyboard.visualPrompt) lines.push(`视觉提示：${storyboard.visualPrompt}`);
      });
      lines.push('');
    }

    // 结尾悬念
    if (viewingEpisode.cliffhanger) {
      let cliffhangerData: HookCliffhangerData;
      if (typeof viewingEpisode.cliffhanger === 'string') {
        try {
          const parsed = JSON.parse(viewingEpisode.cliffhanger);
          cliffhangerData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
        } catch {
          cliffhangerData = { scene: { description: viewingEpisode.cliffhanger } };
        }
      } else {
        cliffhangerData = viewingEpisode.cliffhanger;
      }

      lines.push('【结尾悬念】');
      lines.push('-'.repeat(20));
      
      const { location: cliffhangerSceneLocation, description: cliffhangerSceneDesc } = parseSceneInfo(cliffhangerData.scene);
      if (cliffhangerSceneLocation) lines.push(`场景：${cliffhangerSceneLocation}`);
      if (cliffhangerSceneDesc) lines.push(`描述：${cliffhangerSceneDesc}`);
      
      const cliffhangerCharacters = cliffhangerData.characters || [];
      const cliffhangerDialogues = cliffhangerData.dialogues || [];
      if (cliffhangerCharacters.length > 0) {
        lines.push(`角色：${cliffhangerCharacters.join('、')}`);
      }
      if (cliffhangerDialogues.length > 0) {
        lines.push('对话：');
        cliffhangerDialogues.forEach(d => {
          lines.push(`  ${d.speaker}：${d.content}${d.emotion ? `（${d.emotion}）` : ''}`);
        });
      }
      
      if (cliffhangerData.shotType) lines.push(`镜头：${cliffhangerData.shotType}`);
      if (cliffhangerData.duration) lines.push(`时长：${cliffhangerData.duration}`);
      if (cliffhangerData.visualPrompt) lines.push(`视觉提示：${cliffhangerData.visualPrompt}`);
      lines.push('');
    }

    // 创建并下载文件
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSeries.title}_第${viewingEpisode.episode_number}集_剧本.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('剧本下载成功');
  };

  // 同步单个分镜的素材
  // storyboardIndex: -1=开篇钩子, -2=结尾悬念, 0+=分镜索引
  const syncSingleStoryboardAssets = async (storyboardIndex: number) => {
    if (!selectedSeries || !viewingEpisode) {
      toast.error('请先选择剧集');
      return;
    }

    const indexDesc = storyboardIndex === -1 ? '开篇钩子' : 
                      storyboardIndex === -2 ? '结尾悬念' : 
                      `分镜${storyboardIndex + 1}`;
    
    setSyncingStoryboardIndex(storyboardIndex);
    toast.info(`正在同步${indexDesc}的素材...`);

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${selectedSeries.id}/episodes/${viewingEpisode.episode_number}/sync-assets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({ storyboardIndex }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || '同步素材失败');
        return;
      }

      const { summary, generated, message } = result;
      
      if (message) {
        toast.success(message);
      } else if (summary.generatedCharacters === 0 && summary.generatedScenes === 0) {
        toast.success(`${indexDesc}素材已完整，无需生成`);
      } else {
        toast.success(`${indexDesc}同步完成！角色 ${summary.generatedCharacters} 个，场景 ${summary.generatedScenes} 个`, {
          description: `角色: ${generated.characters.join('、') || '无'}；场景: ${generated.scenes.join('、') || '无'}`,
          duration: 5000,
        });
        
        // 刷新立绘列表
        loadArtwork();
      }

      // 显示失败信息
      if (summary.failedCharacters.length > 0 || summary.failedScenes.length > 0) {
        toast.warning(`部分素材生成失败`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('同步素材失败:', error);
      toast.error('同步素材失败，请稍后重试');
    } finally {
      setSyncingStoryboardIndex(null);
    }
  };

  // 合成视频：将所有分镜视频合并为一个完整视频
  const mergeEpisodeVideos = async (episode: DramaEpisode) => {
    if (!selectedSeries) {
      toast.error('请先选择剧本');
      return;
    }

    // 检查是否所有分镜都有视频
    if (!allStoryboardsHaveVideos) {
      toast.error('请先生成所有分镜视频');
      return;
    }

    setMergingVideos(true);

    try {
      // 获取用户信息
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?.id || 'dev-user';

      const response = await fetch(`/api/drama/series/${selectedSeries.id}/merge-videos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          seriesId: selectedSeries.id,
          episodeNumber: episode.episode_number,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        toast.error(result.error || '视频合成失败');
        return;
      }

      toast.success(result.message || `视频合成成功！共合并 ${result.videoCount} 个视频`);
      
      // 刷新视频列表 - 添加延迟确保数据库已写入
      if (selectedSeries) {
        setTimeout(() => {
          loadEpisodeVideos(selectedSeries.id, episode.episode_number);
        }, 500);
      }

    } catch (error) {
      console.error('视频合成失败:', error);
      toast.error('视频合成失败，请稍后重试');
    } finally {
      setMergingVideos(false);
    }
  };

  // 重试失败的视频（按顺序一个一个生成）
  const retryFailedVideos = async () => {
    if (!selectedSeries || failedVideoTasks.length === 0) {
      toast.error('没有失败的视频需要重试');
      return;
    }

    // 获取用户信息
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const currentUserId = user?.id || 'dev-user';

    // 延迟函数，避免API频率限制
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 按顺序排序失败的视频
    const sortedFailedTasks = [...failedVideoTasks].sort((a, b) => a.sortOrder - b.sortOrder);
    
    setGenerating(`retry-videos`);
    setGeneratingProgress(0);
    setVideoGeneratingEpisode(viewingEpisode);
    setVideoTotalTasks(sortedFailedTasks.length);
    setVideoCompletedTasks(0);

    // 保存 AbortController 到 ref，用于取消
    const mainController = new AbortController();
    videoAbortControllerRef.current = mainController;

    let completedTasks = 0;
    const stillFailedTasks: typeof failedVideoTasks = [];
    let lastFrameUrl: string | undefined = undefined;

    // 辅助函数：生成单个视频（带重试机制）
    const generateSingleVideo = async (
      prompt: string, 
      title: string, 
      duration: number,
      taskName: string,
      options?: {
        firstFrameUrl?: string;
        referenceImageUrls?: string[];
        outputLastFrame?: boolean;
        generateAudio?: boolean;
        cameraMovement?: string;
        hookType?: 'hook' | 'cliffhanger' | 'storyboard';
        sortOrder?: number;
      },
      maxRetries: number = 5
    ): Promise<{ success: boolean; lastFrameUrl?: string }> => {
      if (mainController.signal.aborted) return { success: false };

      let lastError: string = '';
      let lastStatusCode: number = 0;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (mainController.signal.aborted) return { success: false };
        
        try {
          if (attempt > 1) {
            const waitTime = attempt * 60000;
            console.log(`[重试视频] 等待 ${waitTime/1000}秒 后重试...`);
            toast.info(`第${attempt}次重试，等待 ${waitTime/1000}秒...`);
            await delay(waitTime);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort(new DOMException('视频生成超时，请重试', 'TimeoutError'));
          }, 600000);

          const safeDuration = duration || 12;  // 传递原始时长，后端根据模型调整
          const safePrompt = prompt ? (prompt.length > 2000 ? prompt.substring(0, 2000) + '...' : prompt) : '';

          const response = await fetch('/api/videos/generate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-id': currentUserId,
            },
            body: JSON.stringify({
              prompt: safePrompt,
              firstFrameUrl: options?.firstFrameUrl || (lastFrameUrl ? lastFrameUrl : undefined),
              referenceImageUrls: options?.referenceImageUrls,
              duration: safeDuration,
              ratio: '16:9',
              generateAudio: options?.generateAudio ?? true,
              title,
              seriesId: selectedSeries.id,
              episodeNumber: viewingEpisode?.episode_number,
              hookType: options?.hookType || 'storyboard',
              sortOrder: options?.sortOrder,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorData: Record<string, unknown> = {};
            try {
              const text = await response.text();
              errorData = JSON.parse(text);
            } catch {}
            
            const errorCode = errorData.errorCode as string || '';
            const isRateLimited = errorData.isRateLimited as boolean || 
              response.status === 429 || 
              errorCode === 'ErrTooManyRequests';
            
            if (isRateLimited) {
              console.warn(`[重试视频] ${taskName} API限流，等待重试...`);
              if (attempt < maxRetries) {
                const waitTime = 60000 * attempt;
                toast.warning(`${taskName}: API限流，等待${waitTime/1000}秒后重试 (${attempt}/${maxRetries})...`);
                await delay(waitTime);
                continue;
              }
              toast.error(`API限流：${(errorData.suggestion as string) || '请稍后重试'}`);
              return { success: false };
            }
            
            lastError = (errorData.error as string) || `请求失败: ${response.status}`;
            lastStatusCode = response.status;
            
            if (attempt < maxRetries) {
              toast.warning(`${taskName}生成失败，准备重试 (${attempt}/${maxRetries})...`);
              continue;
            }
            
            toast.error(`${taskName}生成失败: ${lastError}`);
            return { success: false };
          }

          const data = await response.json();
          
          if (data && (data.success || data.video)) {
            console.log(`[重试视频] 成功: ${taskName}`);
            toast.success(`${taskName}生成成功`);
            return { 
              success: true, 
              lastFrameUrl: data.lastFrameUrl 
            };
          }
          
          lastError = data.error || '视频生成失败';
          lastStatusCode = data.statusCode;
          
          if (data.isRateLimited || data.isPlatformRateLimit) {
            if (attempt < maxRetries) {
              const waitTime = data.retryAfter ? data.retryAfter * 1000 : 60000 * attempt;
              toast.warning(`${taskName}: API限流，等待${Math.ceil(waitTime/1000)}秒后重试 (${attempt}/${maxRetries})...`);
              await delay(waitTime);
              continue;
            }
            return { success: false };
          }
          
          if (attempt < maxRetries) {
            toast.warning(`${taskName}生成失败，准备重试 (${attempt}/${maxRetries})...`);
            continue;
          }
          
          console.error(`[重试视频] 最终失败: ${taskName} - ${lastError}`);
          toast.error(`${taskName}生成失败: ${lastError}`);
          return { success: false };
          
        } catch (error) {
          console.error(`[重试视频] 异常: ${taskName}`, error);
          lastError = error instanceof Error ? error.message : '未知错误';
          
          if (attempt < maxRetries) {
            toast.warning(`${taskName}生成异常，重试中...`);
            continue;
          }
          
          toast.error(`${taskName}生成失败: ${lastError}`);
          return { success: false };
        }
      }
      
      return { success: false };
    };

    // 按顺序重试失败的视频
    for (let i = 0; i < sortedFailedTasks.length; i++) {
      if (mainController.signal.aborted) break;

      const task = sortedFailedTasks[i];
      
      const result = await generateSingleVideo(
        task.prompt,
        task.title,
        task.duration,
        task.type === 'hook' ? '开篇钩子' : 
        task.type === 'storyboard' ? `分镜${task.index + 1}` : '结尾悬念',
        {
          firstFrameUrl: task.firstFrameUrl,
          outputLastFrame: task.outputLastFrame,
          generateAudio: task.generateAudio,
          cameraMovement: task.cameraMovement,
          hookType: task.type === 'hook' ? 'hook' : task.type === 'cliffhanger' ? 'cliffhanger' : 'storyboard',
          sortOrder: task.sortOrder,
        }
      );
      
      // 保存尾帧URL用于下一个镜头
      if (result.lastFrameUrl) {
        lastFrameUrl = result.lastFrameUrl;
      }
      
      if (result.success) {
        completedTasks++;
        setVideoCompletedTasks(completedTasks);
      } else {
        // 仍然失败，保留记录
        stillFailedTasks.push(task);
      }
      
      const progress = Math.min(100, (completedTasks / sortedFailedTasks.length) * 100);
      setGeneratingProgress(progress);
      setVideoGeneratingProgress(progress);
      
      // 每个视频之间等待30秒
      if (i < sortedFailedTasks.length - 1) {
        await delay(30000);
      }
    }

    // 最终状态更新
    setGenerating(null);
    setGeneratingProgress(0);
    videoAbortControllerRef.current = null;

    // 更新失败记录
    setFailedVideoTasks(stillFailedTasks);

    // 刷新视频列表
    if (selectedSeries && viewingEpisode) {
      loadEpisodeVideos(selectedSeries.id, viewingEpisode.episode_number);
    }

    // 显示结果
    if (completedTasks === sortedFailedTasks.length) {
      toast.success(`所有失败视频已成功重试！共${completedTasks}个视频`);
      setVideoGeneratingEpisode(null);
      setVideoGeneratingProgress(0);
      setVideoCompletedTasks(0);
      setVideoTotalTasks(0);
    } else if (completedTasks > 0) {
      toast.info(`成功重试${completedTasks}/${sortedFailedTasks.length}个视频，仍有${stillFailedTasks.length}个失败`, {
        description: '可以继续点击"重试失败视频"按钮',
        duration: 10000,
      });
    } else {
      toast.error('重试失败，请稍后再试');
    }
  };

  // 删除剧本
  const deleteSeries = async (id: string) => {
    if (!confirm('确定要删除这个剧本吗？所有大纲和剧集都会被删除。')) return;

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const resp = await fetch(`/api/drama/series/${id}`, {
        method: 'DELETE',
        headers: {
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || '删除失败');
      }
      setSeriesList(seriesList.filter((s) => s.id !== id));
      if (selectedSeries?.id === id) {
        setSelectedSeries(null);
      }
    } catch (error) {
      console.error('删除剧本失败:', error);
    }
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: '草稿', variant: 'secondary' },
      outlining: { label: '大纲中', variant: 'default' },
      writing: { label: '创作中', variant: 'default' },
      completed: { label: '已完成', variant: 'default' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <MainLayout>
        <div className="max-w-7xl mx-auto space-y-6 py-6">
        {/* Hero Header with Aurora Gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 p-8 mb-2">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-300/30 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">短剧创作</h1>
              <p className="text-white/80 text-sm sm:text-base mt-1">AI驱动的短剧剧本生成平台</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {selectedSeries ? (
          <div className="space-y-6">
            {/* Series Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-2xl font-semibold">{selectedSeries.title}</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-primary"
                        onClick={regenerateTitle}
                        disabled={regeneratingTitle}
                        title="重新生成爆款标题"
                      >
                        {regeneratingTitle ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        换个标题
                      </Button>
                      {getStatusBadge(selectedSeries.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        {ALL_GENRES.find(g => g.id === selectedSeries.genre)?.label || selectedSeries.genre}
                      </span>
                      {selectedSeries.image_style && (
                        <span className="flex items-center gap-1.5">
                          <Palette className="h-4 w-4" />
                          {IMAGE_STYLE_OPTIONS.find(s => s.id === selectedSeries.image_style)?.label || selectedSeries.image_style}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Film className="h-4 w-4" />
                        {selectedSeries.total_episodes}集
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {selectedSeries.character_count || selectedSeries.characters?.length || 0}个角色
                      </span>
                    </div>
                    {/* 剧情简介 */}
                    {selectedSeries.description && (
                      <div 
                        className="mt-3 cursor-pointer group"
                        onClick={() => setShowDescriptionDialog(true)}
                      >
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed group-hover:text-foreground transition-colors">
                          {selectedSeries.description}
                        </p>
                        <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1 inline-block">
                          点击查看完整简介
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-start shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const exportData = {
                          series: selectedSeries,
                          episodes: selectedSeries?.episodes || [],
                          characters: selectedSeries?.characters || [],
                          scenes: selectedSeries?.scenes || [],
                          exportedAt: new Date().toISOString(),
                        };
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedSeries.title || '剧本'}-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('导出成功');
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      导出
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => deleteSeries(selectedSeries.id)}
                      disabled={generating === 'outlines'}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </Button>
                    <Button size="sm" onClick={generateOutlines} disabled={generating === 'outlines'}>
                      {generating === 'outlines' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {generating === 'outlines' ? '生成中...' : '生成大纲'}
                    </Button>
                    {generating === 'outlines' && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Progress value={generatingProgress} className="h-2 w-20" />
                        <span>{Math.round(generatingProgress)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 h-11">
                <TabsTrigger value="overview" className="text-sm">概览</TabsTrigger>
                <TabsTrigger value="outlines" className="text-sm">大纲 ({selectedSeries.outlines?.length || 0})</TabsTrigger>
                <TabsTrigger value="artwork" className="text-sm">立绘</TabsTrigger>
                <TabsTrigger value="episodes" className="text-sm">剧集 ({selectedSeries.episodes?.length || 0}/{selectedSeries.total_episodes})</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 mt-6">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                    <CardContent className="pt-6">
                      <div className="text-sm font-medium text-muted-foreground mb-2">创作进度</div>
                      <div className="text-3xl font-bold text-primary">{selectedSeries.progress}%</div>
                      <Progress value={selectedSeries.progress} className="mt-3 h-2" />
                      <p className="text-xs text-muted-foreground mt-3">
                        已生成 {selectedSeries.episodes?.length || 0} / {selectedSeries.total_episodes} 集
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10">
                    <CardContent className="pt-6">
                      <div className="text-sm font-medium text-muted-foreground mb-2">故事阶段</div>
                      <div className="text-3xl font-bold text-blue-600">{selectedSeries.outlines?.length || 0}</div>
                      <p className="text-xs text-muted-foreground mt-3">个大纲阶段</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10">
                    <CardContent className="pt-6">
                      <div className="text-sm font-medium text-muted-foreground mb-2">角色设定</div>
                      <div className="text-3xl font-bold text-emerald-600">{selectedSeries.character_count || selectedSeries.characters?.length || 0}</div>
                      <p className="text-xs text-muted-foreground mt-3">个主要角色</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* 核心冲突卡片 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">核心冲突</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedSeries.core_conflict_types && selectedSeries.core_conflict_types.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedSeries.core_conflict_types.map((typeId: string) => {
                          const type = CORE_CONFLICT_TYPES.find(t => t.id === typeId);
                          if (!type) return null;
                          const Icon = type.icon;
                          return (
                            <Badge key={typeId} variant="secondary" className="gap-1.5 font-normal px-3 py-1">
                              <Icon className="h-3.5 w-3.5" />
                              {type.label}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    {selectedSeries.core_conflict ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedSeries.core_conflict}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        暂未设置核心冲突，可在创建剧本时填写
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Outlines Tab */}
              <TabsContent value="outlines" className="space-y-4 mt-6">
                {selectedSeries.outlines?.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                        <Layers className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium">暂无大纲</p>
                      <div className="flex flex-col items-center gap-2 mt-4">
                        <Button onClick={generateOutlines} disabled={generating === 'outlines'}>
                          {generating === 'outlines' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          {generating === 'outlines' ? 'AI正在生成大纲...' : '生成大纲'}
                        </Button>
                        {generating === 'outlines' && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Progress value={generatingProgress} className="h-2 w-40" />
                            <span>{Math.round(generatingProgress)}%</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* 故事概要信息卡片 */}
                    {selectedSeries?.metadata?.storyInfo && (
                      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedSeries.metadata.storyInfo.protagonist && (
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  主角
                                </span>
                                <p className="text-sm font-medium">{selectedSeries.metadata.storyInfo.protagonist}</p>
                              </div>
                            )}
                            {selectedSeries.metadata.storyInfo.storyType && (
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">故事类型</span>
                                <div><Badge variant="secondary">{selectedSeries.metadata.storyInfo.storyType}</Badge></div>
                              </div>
                            )}
                          </div>
                          
                          {selectedSeries.metadata.storyInfo.storySummary && (
                            <div className="mt-4 space-y-1">
                              <span className="text-xs text-muted-foreground">故事概要</span>
                              <p className="text-sm text-foreground/80 leading-relaxed">
                                {selectedSeries.metadata.storyInfo.storySummary}
                              </p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {selectedSeries.metadata.storyInfo.storyBackground && (
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  故事背景
                                </span>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  {selectedSeries.metadata.storyInfo.storyBackground}
                                </p>
                              </div>
                            )}
                            {selectedSeries.metadata.storyInfo.storySetting && (
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  故事设定
                                </span>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  {selectedSeries.metadata.storyInfo.storySetting}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 大纲阶段列表 */}
                    <div className="space-y-2">
                    {selectedSeries.outlines?.map((outline, index) => {
                      const isExpanded = expandedOutlines.has(outline.id);
                      
                      return (
                        <Card 
                          key={outline.id} 
                          className={cn(
                            "overflow-hidden transition-all",
                            isExpanded ? "shadow-md border-primary/20" : "hover:shadow-sm"
                          )}
                        >
                          {/* 折叠头部 */}
                          <div 
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                            onClick={() => toggleOutline(outline.id)}
                          >
                            {/* 序号 */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">{index + 1}</span>
                            </div>
                            
                            {/* 集数范围 */}
                            <Badge variant="outline" className="flex-shrink-0 text-xs">
                              {outline.episode_range}集
                            </Badge>
                            
                            {/* 标题 */}
                            <h3 className="flex-1 font-medium text-sm truncate">{outline.title}</h3>
                            
                            {/* 关键事件数量 */}
                            {outline.key_events?.length > 0 && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {outline.key_events.length}个事件
                              </span>
                            )}
                            
                            {/* 展开/收起图标 */}
                            <ChevronRight 
                              className={cn(
                                "h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                                isExpanded && "rotate-90"
                              )} 
                            />
                          </div>
                          
                          {/* 展开内容 */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t">
                              {/* 概要 */}
                              <div className="mb-3 mt-2">
                                <p className="text-xs text-muted-foreground mb-1">概要</p>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  {outline.summary}
                                </p>
                              </div>
                              
                              {/* 关键事件 */}
                              {outline.key_events?.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2">关键事件</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {outline.key_events.map((event, i) => (
                                      <Badge 
                                        key={i} 
                                        variant="secondary" 
                                        className="text-xs font-normal"
                                      >
                                        {event}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Artwork Tab - 立绘 */}
              <TabsContent value="artwork" className="space-y-4 mt-6">
                {/* 创作流程提示 */}
                {(selectedSeries.outlines?.length || 0) === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                        <ImageIcon className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium">请先生成大纲</p>
                      <p className="text-sm text-muted-foreground mt-2">立绘生成需要基于大纲提取角色和场景信息</p>
                      <Button 
                        className="mt-4" 
                        onClick={() => setActiveTab('outlines')}
                      >
                        前往生成大纲
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* 操作按钮 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {(selectedSeries.characters?.length || 0)} 个角色
                        </Badge>
                        <Badge variant="outline">
                          {artworkCharacters.length} 张角色立绘
                        </Badge>
                        <Badge variant="outline">
                          {artworkScenes.length} 张场景照
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={extractCharactersAndScenes}
                          disabled={generating === 'extract'}
                        >
                          {generating === 'extract' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Users className="h-4 w-4 mr-2" />
                          )}
                          {selectedSeries.characters?.length ? '重新提取角色和场景' : '提取角色和场景'}
                        </Button>
                      </div>
                    </div>

                    {/* 角色立绘区域 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              角色立绘
                            </CardTitle>
                            <CardDescription>
                              点击每个角色右侧的生成按钮，为该角色生成正面半身照
                            </CardDescription>
                          </div>
                          {selectedSeries.characters?.length ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`将批量生成 ${selectedSeries.characters?.length || 0} 个角色的立绘，可能需要较长时间，确定继续吗？`)) {
                                    generateAllCharacterArtworks();
                                  }
                                }}
                                disabled={!!generating}
                              >
                                {generating === 'all-characters' ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    生成中 {generatingProgress}%
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    批量生成角色立绘
                                  </>
                                )}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {generating === 'all-characters' && generatingProgress > 0 && (
                          <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-primary">{generatingCurrentTask}</span>
                              <span className="text-xs text-muted-foreground">{generatingProgress}%</span>
                            </div>
                            <Progress value={generatingProgress} className="h-2" />
                          </div>
                        )}
                        {!(selectedSeries.characters?.length) ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">暂无角色数据，请先点击上方&ldquo;提取角色和场景&rdquo;</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {/* 按角色名去重，避免重复渲染 */}
                            {Array.from(
                              new Map(
                                selectedSeries.characters.map(char => [char.name, char])
                              ).values()
                            ).map((char) => {
                              // 查找该角色的立绘
                              const charImages = artworkCharacters.filter(
                                img => img.character_name === char.name || img.character_id === char.id
                              );
                              const hasImages = charImages.length > 0;
                              const isGenerating = generating === `character-${char.id}`;
                              
                              return (
                                <div key={char.id} className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium">{char.name}</p>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => generateCharacterSheet(char.id, char.name)}
                                        disabled={!!generating}
                                        title="生成人物立绘（正面半身照）"
                                      >
                                        {generating === `character-sheet-${char.id}` ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Palette className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => generateCharacterSheet(char.id, char.name)}
                                        disabled={!!generating}
                                        title="生成三栏立绘"
                                      >
                                        {isGenerating ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : hasImages ? (
                                          <RefreshCw className="h-3 w-3" />
                                        ) : (
                                          <Sparkles className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {/* 人物立绘展示区域（三栏式：正面/侧面/背面） */}
                                    {['正面照'].map((purpose, idx) => {
                                      const img = charImages.find(i => i.purpose?.includes('正面'));
                                      const angleType = 'front';
                                      const isAngleGenerating = generating === `character-${char.id}-${angleType}`;
                                      return (
                                        <div key={idx} className="space-y-1">
                                          <div className="aspect-video rounded-lg overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative group">
                                            {img?.imageUrl ? (
                                              <img
                                                src={img.imageUrl}
                                                alt={img.purpose || `${char.name}立绘`}
                                                className="w-full h-full object-contain"
                                              />
                                            ) : (
                                              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 text-sm px-3"
                                                  onClick={() => generateSingleAngleArtwork(char.id, char.name, angleType)}
                                                  disabled={!!generating}
                                                >
                                                  {isAngleGenerating ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                  ) : (
                                                    <Sparkles className="h-4 w-4 mr-1" />
                                                  )}
                                                  生成正面全身照
                                                </Button>
                                              </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                              <p className="text-sm text-white">正面全身照</p>
                                              {img?.imageUrl && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 text-xs px-2 text-white hover:text-white hover:bg-white/20"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    generateSingleAngleArtwork(char.id, char.name, angleType);
                                                  }}
                                                  disabled={!!generating}
                                                >
                                                  {isAngleGenerating ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                  ) : (
                                                    <RefreshCw className="h-3 w-3" />
                                                  )}
                                                  重新生成
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 场景照区域 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              场景照
                            </CardTitle>
                            <CardDescription>
                              点击场景卡片上的生成按钮，单独生成该场景的图片
                            </CardDescription>
                          </div>
                          {selectedSeries.metadata?.sceneDefinitions && Object.keys(selectedSeries.metadata.sceneDefinitions).length > 0 && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                const sceneCount = Object.keys(selectedSeries.metadata?.sceneDefinitions || {}).length;
                                if (confirm(`将批量生成 ${sceneCount} 个场景的图片，可能需要较长时间，确定继续吗？`)) {
                                  generateAllSceneArtworks();
                                }
                              }}
                              disabled={!!generating}
                            >
                              {generating === 'all-scenes' ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  生成中 {generatingProgress}%
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  批量生成场景照
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {generating === 'all-scenes' && generatingProgress > 0 && (
                          <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-primary">{generatingCurrentTask}</span>
                              <span className="text-xs text-muted-foreground">{generatingProgress}%</span>
                            </div>
                            <Progress value={generatingProgress} className="h-2" />
                          </div>
                        )}
                        {!(selectedSeries.metadata?.sceneDefinitions && Object.keys(selectedSeries.metadata.sceneDefinitions).length > 0) ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <MapPin className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">暂无场景数据，请先点击上方&ldquo;提取角色和场景&rdquo;</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Object.entries(selectedSeries.metadata.sceneDefinitions).map(([sceneId, scene]) => {
                              const sceneData = scene as { name: string; type?: string; description?: string };
                              // 查找该场景的图片
                              const sceneImage = artworkScenes.find(
                                img => img.title?.includes(sceneData.name)
                              );
                              const hasImage = !!sceneImage?.imageUrl;
                              const isGenerating = generating === `scene-${sceneData.name}`;
                              
                              return (
                                <div key={sceneId} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium truncate">{sceneData.name}</p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      onClick={() => confirmAndGenerateSceneArtwork(sceneData.name)}
                                      disabled={!!generating}
                                    >
                                      {isGenerating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : hasImage ? (
                                        <RefreshCw className="h-3 w-3" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="aspect-video rounded-lg overflow-hidden bg-muted relative group">
                                    {hasImage ? (
                                      <img 
                                        src={sceneImage.imageUrl}
                                        alt={sceneData.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                                      </div>
                                    )}
                                    {sceneData.description && (
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                        <p className="text-xs text-white line-clamp-2">{sceneData.description}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Episodes Tab */}
              <TabsContent value="episodes" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    已生成 <span className="font-semibold text-foreground">{selectedSeries.episodes?.length || 0}</span> / {selectedSeries.total_episodes} 集
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('将批量生成前10集剧本，确定继续吗？')) {
                          generateAllEpisodes();
                        }
                      }} 
                      disabled={!!generating || (selectedSeries.episodes?.length || 0) >= selectedSeries.total_episodes}
                    >
                      批量生成
                    </Button>
                    {(selectedSeries.episodes?.length || 0) < selectedSeries.total_episodes && (
                      <Button 
                        size="sm"
                        onClick={() => generateEpisode((selectedSeries.episodes?.length || 0) + 1)} 
                        disabled={!!generating}
                      >
                        {generating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        生成下一集
                      </Button>
                    )}
                  </div>
                </div>

                {/* 剧集网格 - 小卡片 */}
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-2">
                  {Array.from({ length: selectedSeries.total_episodes }, (_, i) => i + 1).map((epNum) => {
                    const episode = selectedSeries.episodes?.find((e) => e.episode_number === epNum);
                    const isGenerating = generating === `episode-${epNum}`;
                    const hasStoryboards = episode?.storyboards && episode.storyboards.length > 0;
                    const storyboardCount = episode?.storyboards?.length || 0;
                    const totalDuration = episode?.storyboards?.reduce((sum: number, s: { duration?: number }) => sum + (s.duration || 6), 0) || 0;
                    const isGenerated = !!episode;
                    
                    // 获取显示标题 - 优先使用brief（4-6字简介），更简洁
                    const getDisplayTitle = () => {
                      if (!episode) return `第${epNum}集`;
                      
                      const isDefaultTitle = episode.title && (
                        episode.title === `第${epNum}集` || 
                        episode.title === `第${epNum}话` ||
                        episode.title.match(/^第\s*\d+\s*[集话]$/)
                      );
                      
                      // 优先使用brief（简洁的4-6字简介）
                      if (episode.brief) {
                        return `第${epNum}集：${episode.brief}`;
                      }
                      
                      // 其次使用title，但要处理包含冒号的情况
                      if (episode.title && !isDefaultTitle) {
                        const titleParts = episode.title.split(/[:：]/);
                        const cleanTitle = titleParts[0].trim();
                        return `第${epNum}集：${cleanTitle}`;
                      }
                      
                      return `第${epNum}集`;
                    };
                    
                    return (
                      <Tooltip key={epNum}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "w-full group relative cursor-pointer transition-all duration-200 rounded-lg border",
                              // 生成中：环绕进度条
                              isGenerating && "episode-card-progress",
                              // 已生成：紫色渐变背景
                              isGenerated && !isGenerating && "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/40 hover:border-primary hover:shadow-md hover:shadow-primary/20",
                              // 未生成：灰色背景
                              !isGenerated && !isGenerating && "bg-muted/30 border-border/50 hover:border-primary/30 hover:bg-muted/50"
                            )}
                            onClick={() => {
                              if (episode) {
                                setViewingEpisodeId(episode.episode_number);
                                setEpisodeDialogOpen(true);
                                // loadEpisodeVideos 由 useEffect 在 episodeDialogOpen 变化时自动调用
                              } else if (!generating) {
                                generateEpisode(epNum);
                              }
                            }}
                          >
                            <div className="p-2 text-center">
                              <span className={cn(
                                "text-sm font-bold",
                                isGenerated ? "text-primary" : "text-muted-foreground"
                              )}>{epNum}</span>
                              
                              <div className="mt-1 flex justify-center items-center min-h-[14px]">
                                {isGenerating ? (
                                  <span className="text-[10px] text-primary">生成中</span>
                                ) : isGenerated ? (
                                  hasStoryboards ? (
                                    <span className="text-[10px] font-medium text-primary bg-primary/20 px-1.5 py-0.5 rounded-full">
                                      {storyboardCount}镜
                                    </span>
                                  ) : (
                                    <FileText className="h-3 w-3 text-primary/60" />
                                  )
                                ) : (
                                  <Plus className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </div>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-center" sideOffset={8}>
                          <p className="text-xs font-semibold">{getDisplayTitle()}</p>
                          {isGenerated && (
                            <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                              {hasStoryboards ? (
                                <>
                                  <span>{storyboardCount}镜</span>
                                  <span>{totalDuration}s</span>
                                </>
                              ) : (
                                <span className="text-amber-600">待生成分镜</span>
                              )}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                
                {/* 剧集详情Dialog */}
                {(() => {
                  // 获取用户信息用于计算视频时长
                  const userInfo = typeof window !== 'undefined' ? (() => {
                    const userStr = localStorage.getItem('user');
                    return userStr ? JSON.parse(userStr) : null;
                  })() : null;
                  // 根据视频模型计算总时长
                  const storyboardUserVideoModel = userInfo?.video_model || 'doubao-seedance-2-0-260128';
                  const storyboardBaseDuration = getVideoModelMaxDuration(storyboardUserVideoModel);
                  const totalStoryboardDuration = (viewingEpisode?.storyboards?.length || 0) * storyboardBaseDuration;
                  return (
                <Dialog open={episodeDialogOpen} onOpenChange={(open) => {
                  if (!open) {
                    closeEpisodeDialog();
                  }
                }}>
                  <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden" showCloseButton={false}>
                    <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0 overflow-hidden relative">
                      <DialogTitle className="text-lg truncate pr-8">第{viewingEpisode?.episode_number}集：{viewingEpisode?.title}</DialogTitle>
                      <DialogDescription className="truncate">
                        {viewingEpisode?.storyboards?.length || 0} 个分镜 · 约 {totalStoryboardDuration} 秒
                      </DialogDescription>
                      <DialogClose
                        onClick={() => {
                          closeEpisodeDialog();
                        }}
                        className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
                        aria-label="关闭"
                      >
                        <X className="h-4 w-4" />
                      </DialogClose>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto min-h-0 overflow-x-hidden">
                      <div className="p-6 space-y-5 min-w-0">
                        {/* 剧集信息 */}
                        <div className="grid grid-cols-1 gap-4">
                          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 overflow-hidden">
                            <CardHeader className="pb-2 pt-4">
                              <CardTitle className="text-xs font-semibold text-primary uppercase tracking-wide">剧情概要</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4 overflow-hidden">
                              <p className="text-sm leading-relaxed text-foreground/80 break-words">{numberToChinese(viewingEpisode?.summary || '暂无')}</p>
                            </CardContent>
                          </Card>
                        </div>

                        {/* 已生成视频 */}
                        <Card className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">已生成视频 <span className="text-muted-foreground font-normal">({episodeVideos.length})</span></CardTitle>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={syncEpisodeVideos}
                                disabled={syncingVideos}
                              >
                                {syncingVideos ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    同步中...
                                  </>
                                ) : (
                                  <>
                                    <Video className="h-3 w-3 mr-1" />
                                    同步视频
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {loadingVideos ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                            ) : episodeVideos.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {episodeVideos.map((video) => (
                                  <div 
                                    key={video.id} 
                                    className="group relative rounded-lg border overflow-hidden bg-muted/50 hover:shadow-lg transition-shadow"
                                  >
                                    <div className="relative">
                                      <video 
                                        src={video.videoUrl} 
                                        className={cn(
                                          "w-full bg-black",
                                          // 根据视频比例动态设置样式
                                          video.ratio === '9:16' 
                                            ? "h-auto max-h-[280px] mx-auto" // 竖屏视频居中显示
                                            : "aspect-video object-cover" // 横屏视频填充
                                        )}
                                        controls
                                        preload="metadata"
                                        style={video.ratio === '9:16' ? { aspectRatio: '9/16', maxHeight: '280px' } : undefined}
                                      />
                                      {/* 视频类型标签 */}
                                      {video.hookType && video.hookType !== 'storyboard' && (
                                        <div className={cn(
                                          "absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium",
                                          video.hookType === 'hook' 
                                            ? "bg-amber-500/90 text-white" 
                                            : video.hookType === 'merged'
                                            ? "bg-green-500/90 text-white"
                                            : "bg-purple-500/90 text-white"
                                        )}>
                                          {video.hookType === 'hook' 
                                            ? '开篇钩子' 
                                            : video.hookType === 'merged'
                                            ? '完整剧集'
                                            : '结尾悬念'}
                                        </div>
                                      )}
                                    </div>
                                    <div className="p-2.5 bg-card">
                                      <p className="text-xs font-medium truncate">{video.title}</p>
                                      <div className="flex items-center justify-between mt-1.5">
                                        <span className="text-xs text-muted-foreground">
                                          {video.duration ? `${video.duration}秒` : ''}
                                        </span>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                            onClick={() => window.open(video.videoUrl, '_blank')}
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive hover:text-destructive"
                                            onClick={() => deleteVideo(video.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 bg-muted/30 rounded-lg">
                                <p className="text-sm text-muted-foreground">暂无已生成的视频</p>
                                <p className="text-xs text-muted-foreground mt-1">点击底部&ldquo;生成视频&rdquo;按钮开始生成</p>
                              </div>
                            )}
                            
                            {/* 失败视频列表和重试按钮 */}
                            {(() => {
                              const currentTask = backgroundTasks.find(t => 
                                t.episodeNumber === viewingEpisode?.episode_number && 
                                t.status === 'completed' && 
                                t.failedVideos && t.failedVideos.length > 0
                              );
                              
                              if (!currentTask) return null;
                              
                              return (
                                <div className="mt-4 p-4 border border-orange-500/30 bg-orange-500/5 rounded-lg">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                      <RefreshCw className="h-4 w-4" />
                                      <span className="font-medium text-sm">
                                        {currentTask.failedVideos!.length} 个视频生成失败
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-orange-600 border-orange-500/50 hover:bg-orange-500/10"
                                      onClick={() => retryBackgroundTaskVideos(currentTask.id, true)}
                                    >
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      全部重试
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    {currentTask.failedVideos!.map((failed) => (
                                      <div 
                                        key={failed.index}
                                        className="flex items-center justify-between p-2 bg-background rounded border"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">
                                            分镜 {failed.index + 1}: {failed.description}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {failed.error || '生成失败'}
                                            {failed.retryCount && failed.retryCount > 0 && ` (已重试${failed.retryCount}次)`}
                                          </p>
                                        </div>
                                        {failed.canRetry && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-orange-600 hover:bg-orange-500/10"
                                            onClick={() => retryBackgroundTaskVideos(currentTask.id, false, failed.index)}
                                          >
                                            重试
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </CardContent>
                        </Card>
                        
                        {/* 分镜剧本列表 */}
                        <Card className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">
                                分镜剧本 
                                <span className="text-muted-foreground font-normal">
                                  ({(viewingEpisode?.hook ? 1 : 0) + (viewingEpisode?.storyboards?.length || 0) + (viewingEpisode?.cliffhanger ? 1 : 0)}个镜头)
                                </span>
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={downloadEpisodeScript}
                                  title="下载剧本文本文件"
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  下载剧本
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs relative"
                                  onClick={syncEpisodeAssets}
                                  disabled={syncingAssets}
                                  title="为分镜中的角色和场景自动生成缺失的立绘和场景图片"
                                >
                                  {syncingAssets ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      同步中...
                                    </>
                                  ) : (
                                    <>
                                      <ImageIcon className="h-3 w-3 mr-1" />
                                      <span className="pr-5">同步素材</span>
                                      <span className="absolute top-0 right-1 translate-y-[-4px] text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded-full font-medium">
                                        优先
                                      </span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="overflow-x-hidden">
                            <div className="space-y-3 min-w-0">
                              {/* 开篇钩子 - 作为第一个分镜 */}
                              {viewingEpisode?.hook && (() => {
                                // 兼容字符串和对象两种格式
                                let hookData: HookCliffhangerData;
                                if (typeof viewingEpisode.hook === 'string') {
                                  try {
                                    const parsed = JSON.parse(viewingEpisode.hook);
                                    hookData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
                                  } catch {
                                    hookData = { scene: { description: viewingEpisode.hook } };
                                  }
                                } else {
                                  hookData = viewingEpisode.hook;
                                }
                                
                                const hookVisualPrompt = typeof hookData.visualPrompt === 'string' ? hookData.visualPrompt : '';
                                // 时长：根据视频模型决定，不再依赖后端返回的 duration 字段
                                const userStr = localStorage.getItem('user');
                                const user = userStr ? JSON.parse(userStr) : null;
                                const userVideoModel = user?.video_model || 'doubao-seedance-2-0-260128';
                                const hookDuration = getVideoModelMaxDuration(userVideoModel);
                                const hookShotType = hookData.shotType || '氛围镜头';
                                const hookCameraMovement = hookData.cameraMovement || '';
                                const hookMood = hookData.mood || '';
                                const { location: hookSceneLocation, description: hookSceneDesc } = parseSceneInfo(hookData.scene);
                                // 从对话中提取所有说话人，自动补充到镜头人物列表
                                const hookSpeakersFromDialogues = (hookData.dialogues || [])
                                  .map((d: { speaker?: string }) => d.speaker)
                                  .filter((s: string | undefined): s is string => !!s && s !== '旁白');
                                // 处理 characters 可能是对象数组或字符串数组的情况
                                const hookCharactersRaw = hookData.characters || [];
                                const hookCharactersFromData = hookCharactersRaw.map((c: string | { name: string }) => 
                                  typeof c === 'string' ? c : c?.name
                                ).filter(Boolean);
                                const hookCharacters = [...new Set([...hookCharactersFromData, ...hookSpeakersFromDialogues])];
                                const hookDialogue = hookData.dialogue;
                                const hookDialogues = hookData.dialogues;
                                
                                // 从旧格式 scene 对象中提取 location（复用已有的 hookSceneLocation）
                                // parseSceneInfo 已经在上面解析过了，这里直接使用 hookSceneLocation
                                
                                // 顶配爆款版字段（需要先定义，因为新格式字段会引用）
                                // 修复：当 scene 是对象时，需要提取其中的 description
                                const hookSceneObj = hookData.scene;
                                const hookScene = typeof hookSceneObj === 'string' 
                                  ? hookSceneObj 
                                  : (hookSceneObj && typeof hookSceneObj === 'object' && 'description' in hookSceneObj)
                                    ? String((hookSceneObj as { description?: unknown }).description || '')
                                    : '';
                                
                                // 新格式字段（优先使用，兼容旧格式）
                                const hookNewLocation = hookData.location || hookSceneLocation;
                                const hookNewDescription = hookData.description || hookScene;
                                const hookNewCharacterList = hookData.characterList as string[] | undefined;
                                const hookNewTimeDescriptions = hookData.timeDescriptions as Record<string, string> | string[] | undefined;
                                
                                const hookAction = hookData.action || '';
                                const hookCloseup = hookData.closeup || '';
                                const hookStyle = hookData.style || '';
                                const hookBgmAtmosphere = hookData.bgmAtmosphere || '';
                                // 判断是否是新格式（优先）或顶配爆款版格式或有旧 scene
                                // 修复：添加 *Scene 字段作为兜底条件，确保内容能显示
                                const hookIsNewFormat = hookNewLocation || hookNewDescription || hookNewTimeDescriptions;
                                const hookIsProFormat = hookIsNewFormat || hookAction || hookCloseup || hookStyle || hookBgmAtmosphere || hookScene || hookSceneLocation || hookNewLocation;
                                // 构建用于 [图片X] 替换的角色数组
                                const hookTimeDescCharacters = hookNewCharacterList 
                                  ? hookNewCharacterList.map(name => ({ name })) 
                                  : undefined;
                                
                                return (
                                  <div className="p-4 rounded-lg border bg-gradient-to-r from-card to-muted/20 hover:shadow-md hover:border-primary/20 transition-all overflow-hidden">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                      <div className="flex-1 min-w-0">
                                        {/* 第一行：序号 + 镜头类型 + 角色名 */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 text-white text-xs font-bold shadow-sm shrink-0">
                                            钩
                                          </span>
                                          <Badge variant="secondary" className="text-xs font-medium shrink-0">{hookShotType}</Badge>
                                          {hookCharacters && hookCharacters.length > 0 && hookCharacters.slice(0, 3).map((char, idx) => (
                                            getCharacterImageUrl(char) ? (
                                              <a
                                                key={idx}
                                                href={getCharacterImageUrl(char)!}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  showImagePreviewDialog(getCharacterImageUrl(char)!, `人物立绘：${char}`);
                                                }}
                                              >
                                                <Badge variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0 cursor-pointer">
                                                  @{char}
                                                  <ImageIcon className="h-3 w-3 ml-1" />
                                                </Badge>
                                              </a>
                                            ) : (
                                              <Badge key={idx} variant="outline" className="text-xs border-primary/30 text-primary shrink-0">{char}</Badge>
                                            )
                                          ))}
                                          {hookCharacters && hookCharacters.length > 3 && (
                                            <span className="text-xs text-muted-foreground">+{hookCharacters.length - 3}</span>
                                          )}
                                        </div>
                                        {/* 第二行：运镜（单独显示） */}
                                        {hookCameraMovement && hookCameraMovement !== '固定' && (
                                          <div className="mt-1.5 text-xs text-muted-foreground truncate" title={hookCameraMovement}>
                                            运镜：{hookCameraMovement}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-muted-foreground font-medium">{hookDuration}秒</span>
                                        <button
                                          className={cn(
                                            "inline-flex items-center justify-center rounded-md text-xs font-bold transition-all shadow-sm",
                                            "h-7 px-2.5",
                                            syncingStoryboardIndex === -1
                                              ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-purple-500/30"
                                              : "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
                                          )}
                                          onClick={() => syncSingleStoryboardAssets(-1)}
                                          disabled={syncingStoryboardIndex !== null}
                                          title="生成分镜素材（角色立绘和场景图片）"
                                        >
                                          {syncingStoryboardIndex === -1 ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            "绘"
                                          )}
                                        </button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className={cn(
                                            "h-7 px-2 transition-all",
                                            generatingHook 
                                              ? "bg-red-500 text-white hover:bg-red-600" 
                                              : hookVideoGenerated
                                                ? "bg-green-500 text-white hover:bg-green-600"
                                                : "text-primary hover:bg-primary/10"
                                          )}
                                          onClick={() => generateHookVideo()}
                                          disabled={generatingHook}
                                          title={
                                            generatingHook 
                                              ? "正在生成视频..." 
                                              : hookVideoGenerated
                                                ? "视频已生成"
                                                : "生成开篇钩子视频"
                                          }
                                        >
                                          {generatingHook ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : hookVideoGenerated ? (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          ) : (
                                            <Video className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    {/* 顶配爆款版格式显示 */}
                                    {hookIsProFormat ? (
                                      <div className="space-y-1.5 min-w-0">
                                        {/* 新格式优先显示 */}
                                        {hookIsNewFormat && (
                                          <>
                                            {/* 场景位置（带超链接） */}
                                            {hookNewLocation && (
                                              <div className="text-xs text-muted-foreground">
                                                场景位置：{getSceneImageUrl(hookNewLocation) ? (
                                                  <a
                                                    href={getSceneImageUrl(hookNewLocation)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      showImagePreviewDialog(getSceneImageUrl(hookNewLocation)!, `场景照：${hookNewLocation}`);
                                                    }}
                                                  >
                                                    @{hookNewLocation}
                                                    <ImageIcon className="h-3 w-3" />
                                                  </a>
                                                ) : (
                                                  <span className="text-muted-foreground/60">@{hookNewLocation}</span>
                                                )}
                                              </div>
                                            )}
                                            {/* 场景描述 */}
                                            {hookNewDescription && (
                                              <p className="text-sm leading-relaxed break-words">
                                                {renderTextWithLinks(hookNewDescription, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                              </p>
                                            )}
                                            {/* 时间点描述（timeDescriptions） */}
                                            {hookNewTimeDescriptions && (
                                              <div className="space-y-1 mt-1 pl-2 border-l-2 border-primary/20">
                                                {Array.isArray(hookNewTimeDescriptions) 
                                                  ? hookNewTimeDescriptions.map((item: string, idx: number) => {
                                                      const processedText = replaceImagePlaceholders(item, hookTimeDescCharacters, hookNewLocation);
                                                      return (
                                                        <div key={idx} className="text-xs text-muted-foreground/80">
                                                          {renderTextWithLinks(processedText, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                        </div>
                                                      );
                                                    })
                                                  : Object.entries(hookNewTimeDescriptions).map(([timeRange, description]) => {
                                                      const processedText = typeof description === 'string' 
                                                        ? replaceImagePlaceholders(description, hookTimeDescCharacters, hookNewLocation)
                                                        : '';
                                                      return (
                                                        <div key={timeRange} className="text-xs">
                                                          <span className="text-muted-foreground font-medium">[{timeRange}]</span>
                                                          <span className="text-muted-foreground/80 ml-1">
                                                            {renderTextWithLinks(processedText, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                          </span>
                                                        </div>
                                                      );
                                                    })
                                                }
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {/* 旧格式：完整场景描述 */}
                                        {!hookIsNewFormat && hookScene && (
                                          <div className="overflow-hidden">
                                            <span className="text-xs text-muted-foreground font-medium">场景：</span>
                                            <p className="text-sm leading-relaxed break-words mt-0.5">
                                              {renderTextWithLinks(hookScene, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                            </p>
                                          </div>
                                        )}
                                        {/* 场景位置 + 氛围（带超链接） - 横向排列 */}
                                        {(hookSceneLocation || hookMood) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {hookSceneLocation && (
                                              <span>
                                                场景：
                                                {getSceneImageUrl(hookSceneLocation) ? (
                                                  <a
                                                    href={getSceneImageUrl(hookSceneLocation)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      showImagePreviewDialog(getSceneImageUrl(hookSceneLocation)!, `场景照：${hookSceneLocation}`);
                                                    }}
                                                  >
                                                    @{numberToChinese(hookSceneLocation)}
                                                    <ImageIcon className="h-3 w-3" />
                                                  </a>
                                                ) : (
                                                  <span className="ml-0.5">{numberToChinese(hookSceneLocation)}</span>
                                                )}
                                              </span>
                                            )}
                                            {hookMood && <span>氛围：{numberToChinese(hookMood)}</span>}
                                          </div>
                                        )}
                                        {/* 运镜 + 动作 + 特写 - 横向排列 */}
                                        {(hookCameraMovement || hookAction || hookCloseup) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {hookCameraMovement && <span>运镜：{numberToChinese(hookCameraMovement)}</span>}
                                            {hookAction && <span>动作：{numberToChinese(hookAction)}</span>}
                                            {hookCloseup && <span>特写：{numberToChinese(hookCloseup)}</span>}
                                          </div>
                                        )}
                                        {/* 风格 + BGM - 横向排列 */}
                                        {(hookStyle || hookBgmAtmosphere) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {hookStyle && <span>风格：{numberToChinese(hookStyle)}</span>}
                                            {hookBgmAtmosphere && <span>BGM：{numberToChinese(hookBgmAtmosphere)}</span>}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        {/* 视觉提示词 */}
                                        {hookVisualPrompt && (
                                          <div className="mb-2">
                                            <p className="text-sm leading-relaxed break-words">
                                              {renderTextWithLinks(hookVisualPrompt, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                            </p>
                                          </div>
                                        )}

                                        {/* 降级：场景描述 */}
                                        {!hookVisualPrompt && hookSceneDesc && (
                                          <p className="text-sm leading-relaxed text-foreground/80 break-words">
                                            {renderTextWithLinks(hookSceneDesc, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                          </p>
                                        )}

                                        {/* 场景位置 + 氛围（带超链接） */}
                                        {(hookSceneLocation || hookMood) && (
                                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
                                            {hookSceneLocation && (
                                              <span>
                                                场景：
                                                {getSceneImageUrl(hookSceneLocation) ? (
                                                  <a
                                                    href={getSceneImageUrl(hookSceneLocation)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      showImagePreviewDialog(getSceneImageUrl(hookSceneLocation)!, `场景照：${hookSceneLocation}`);
                                                    }}
                                                  >
                                                    @{numberToChinese(hookSceneLocation)}
                                                    <ImageIcon className="h-3 w-3" />
                                                  </a>
                                                ) : (
                                                  <span className="ml-1">{numberToChinese(hookSceneLocation)}</span>
                                                )}
                                              </span>
                                            )}
                                            {hookMood && <span>氛围：{numberToChinese(hookMood)}</span>}
                                          </div>
                                        )}
                                      </>
                                    )}

                                    
                                    {/* 对话 */}
                                    {hookDialogues && hookDialogues.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-dashed">
                                        <div className="space-y-2">
                                          {hookDialogues.map((d: Record<string, unknown>, idx: number) => {
                                            const dSpeaker = String(d.speaker || '');
                                            const dContent = String(d.content || '');
                                            const dEmotion = String(d.emotion || '');
                                            const dIsOffScreen = Boolean((d as { isOffScreen?: boolean }).isOffScreen);
                                            
                                            return (
                                              <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                  {dEmotion && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                                      {numberToChinese(dEmotion)}
                                                    </span>
                                                  )}
                                                </div>
                                                <p className="text-sm break-words">
                                                  {getCharacterImageUrl(dSpeaker) ? (
                                                    <a
                                                      href={getCharacterImageUrl(dSpeaker)!}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        showImagePreviewDialog(getCharacterImageUrl(dSpeaker)!, `人物立绘：${dSpeaker}`);
                                                      }}
                                                    >
                                                      @{numberToChinese(dSpeaker)}
                                                      <ImageIcon className="h-3 w-3" />
                                                    </a>
                                                  ) : (
                                                    <span className="font-semibold text-primary">{numberToChinese(dSpeaker)}{dIsOffScreen && <span className="text-xs text-muted-foreground">(画外音)</span>}：</span>
                                                  )}
                                                  <span className="text-foreground/80">&ldquo;{renderTextWithLinks(dContent, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}&rdquo;</span>
                                                </p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* 兼容旧格式：单句对话 */}
                                    {!hookDialogues?.length && hookDialogue && String(hookDialogue.content || '') && (
                                      <div className="mt-3 pt-3 border-t border-dashed">
                                        <p className="text-sm break-words">
                                          {getCharacterImageUrl(String(hookDialogue.speaker || '')) ? (
                                            <a
                                              href={getCharacterImageUrl(String(hookDialogue.speaker || ''))!}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                showImagePreviewDialog(
                                                  getCharacterImageUrl(String(hookDialogue.speaker || ''))!,
                                                  `人物立绘：${String(hookDialogue.speaker || '')}`
                                                );
                                              }}
                                            >
                                              @{numberToChinese(String(hookDialogue.speaker || ''))}
                                              <ImageIcon className="h-3 w-3" />
                                            </a>
                                          ) : (
                                            <span className="font-semibold text-primary">{numberToChinese(String(hookDialogue.speaker || ''))}：</span>
                                          )}
                                          <span className="text-foreground/80">&ldquo;{renderTextWithLinks(String(hookDialogue.content || ''), getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}&rdquo;</span>
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              
                              {/* 普通分镜列表 */}
                              {viewingEpisode?.storyboards && viewingEpisode.storyboards.length > 0 && viewingEpisode.storyboards.map((storyboard, index) => {
                                  // 兼容新旧两种数据格式
                                  const sceneDesc = typeof storyboard.scene === 'string' 
                                    ? storyboard.scene 
                                    : String((storyboard.scene as Record<string, unknown>)?.description || '未设置');
                                  const sceneLocation = typeof storyboard.scene === 'object' 
                                    ? String((storyboard.scene as Record<string, unknown>)?.location || '')
                                    : '';
                                  const characters = storyboard.characters as Array<Record<string, unknown>> | undefined;
                                  const dialogue = storyboard.dialogue as Record<string, unknown> | undefined;
                                  // 新格式：多句对话数组
                                  const dialogues = storyboard.dialogues as Array<Record<string, unknown>> | undefined;
                                  // 序号：如果有开篇钩子，从1开始；否则从0开始
                                  const sequence = storyboard.sequence ?? (viewingEpisode?.hook ? index + 2 : index + 1);
                                  // 时长：根据视频模型决定，不再依赖后端返回的 duration 字段
                                  const sbUserVideoModel = typeof window !== 'undefined' ? (() => {
                                    const userStr = localStorage.getItem('user');
                                    const u = userStr ? JSON.parse(userStr) : null;
                                    return u?.video_model || 'doubao-seedance-2-0-260128';
                                  })() : 'doubao-seedance-2-0-260128';
                                  const duration = getVideoModelMaxDuration(sbUserVideoModel);
                                  const shotType = storyboard.shotType || '中景';
                                  
                                  // 新增字段 - 确保是字符串类型
                                  const visualPrompt = typeof storyboard.visualPrompt === 'string' ? storyboard.visualPrompt : '';
                                  const cameraMovement = storyboard.cameraMovement as string || '';
                                  const mood = storyboard.mood as string || '';
                                  
                                  // 顶配爆款版字段 - 处理 scene 可能是对象的情况
                                  const rawScene = storyboard.scene;
                                  const sbScene = typeof rawScene === 'string' ? rawScene : 
                                                  (rawScene && typeof rawScene === 'object' && 'description' in rawScene) 
                                                    ? String((rawScene as { description?: string }).description || '') : '';
                                  // 从旧格式 scene 对象中提取 location 和 description
                                  const sbSceneLocation = typeof rawScene === 'object' && rawScene !== null 
                                    ? String((rawScene as Record<string, unknown>).location || '') 
                                    : '';
                                  // 新格式字段（优先使用，兼容旧格式）
                                  const sbNewLocation = storyboard.location || sbSceneLocation;
                                  const sbNewDescription = storyboard.description || sbScene;
                                  const sbNewCharacterList = storyboard.characterList as string[] | undefined;
                                  const sbNewTimeDescriptions = storyboard.timeDescriptions as Record<string, string> | string[] | undefined;
                                  const sbAction = storyboard.action as string || '';
                                  const sbCloseup = storyboard.closeup as string || '';
                                  const sbStyle = storyboard.style as string || '';
                                  const sbBgmAtmosphere = storyboard.bgmAtmosphere as string || '';
                                  // 判断是否是新格式（优先）或顶配爆款版格式或有旧 scene
                                  // 修复：添加 *Scene 字段作为兜底条件，确保内容能显示
                                  const isNewFormat = sbNewLocation || sbNewDescription || sbNewTimeDescriptions;
                                  const isProFormat = isNewFormat || sbAction || sbCloseup || sbStyle || sbBgmAtmosphere || sbScene || sbSceneLocation || sbNewLocation;
                                  
                                  // 构建用于 [图片X] 替换的角色数组
                                  // [图片1] = 场景（使用 sbNewLocation），[图片2] = characterList[0]，依此类推
                                  const timeDescCharacters = sbNewCharacterList 
                                    ? sbNewCharacterList.map(name => ({ name })) 
                                    : undefined;
                                  
                                  return (
                                    <div 
                                      key={storyboard.id || index}
                                      className="p-4 rounded-lg border bg-gradient-to-r from-card to-muted/20 hover:shadow-md hover:border-primary/20 transition-all overflow-hidden"
                                    >
                                      {/* 头部：序号 + 镜头信息 */}
                                      <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                          {/* 第一行：序号 + 镜头类型 + 角色名 */}
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm shrink-0">
                                              {sequence}
                                            </span>
                                            <Badge variant="secondary" className="text-xs font-medium shrink-0">{shotType}</Badge>
                                            {characters && characters.length > 0 && characters.slice(0, 3).map((char, idx) => {
                                              const charName = String(char.name);
                                              return getCharacterImageUrl(charName) ? (
                                                <a
                                                  key={idx}
                                                  href={getCharacterImageUrl(charName)!}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    showImagePreviewDialog(getCharacterImageUrl(charName)!, `人物立绘：${charName}`);
                                                  }}
                                                >
                                                  <Badge variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0 cursor-pointer">
                                                    @{charName}
                                                    <ImageIcon className="h-3 w-3 ml-1" />
                                                  </Badge>
                                                </a>
                                              ) : (
                                                <Badge key={idx} variant="outline" className="text-xs border-primary/30 text-primary shrink-0">{charName}</Badge>
                                              );
                                            })}
                                            {characters && characters.length > 3 && (
                                              <span className="text-xs text-muted-foreground">+{characters.length - 3}</span>
                                            )}
                                          </div>
                                          {/* 第二行：运镜（单独显示） */}
                                          {cameraMovement && cameraMovement !== '固定' && (
                                            <div className="mt-1.5 text-xs text-muted-foreground truncate" title={cameraMovement}>
                                              运镜：{cameraMovement}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-xs text-muted-foreground font-medium">{duration}秒</span>
                                          <button
                                            className={cn(
                                              "inline-flex items-center justify-center rounded-md text-xs font-bold transition-all shadow-sm",
                                              "h-7 px-2.5",
                                              syncingStoryboardIndex === index
                                                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-purple-500/30"
                                                : "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              syncSingleStoryboardAssets(index);
                                            }}
                                            disabled={syncingStoryboardIndex !== null}
                                            title="生成分镜素材（角色立绘和场景图片）"
                                          >
                                            {syncingStoryboardIndex === index ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              "绘"
                                            )}
                                          </button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className={cn(
                                              "h-7 px-2 transition-all",
                                              generatingStoryboardIndex === index 
                                                ? "bg-red-500 text-white hover:bg-red-600" 
                                                : (generatedStoryboardIds.has(storyboard.id || `index-${index}`) || generatedStoryboardIndices.has(index))
                                                  ? "bg-green-500 text-white hover:bg-green-600"
                                                  : "text-primary hover:bg-primary/10"
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              generateStoryboardVideo(index);
                                            }}
                                            disabled={generatingStoryboardIndex === index}
                                            title={
                                              generatingStoryboardIndex === index 
                                                ? "正在生成视频..." 
                                                : (generatedStoryboardIds.has(storyboard.id || `index-${index}`) || generatedStoryboardIndices.has(index))
                                                  ? "视频已生成"
                                                  : "生成此分镜视频"
                                            }
                                          >
                                            {generatingStoryboardIndex === index ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (generatedStoryboardIds.has(storyboard.id || `index-${index}`) || generatedStoryboardIndices.has(index)) ? (
                                              <CheckCircle2 className="h-3.5 w-3.5" />
                                            ) : (
                                              <Video className="h-3.5 w-3.5" />
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {/* 顶配爆款版格式显示 */}
                                      {isProFormat ? (
                                        <div className="space-y-1.5 min-w-0">
                                          {/* 新格式优先显示 */}
                                          {isNewFormat && (
                                            <>
                                              {/* 场景位置（带超链接） */}
                                              {sbNewLocation && (
                                                <div className="text-xs text-muted-foreground">
                                                  场景位置：{getSceneImageUrl(sbNewLocation) ? (
                                                    <a
                                                      href={getSceneImageUrl(sbNewLocation)!}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        showImagePreviewDialog(getSceneImageUrl(sbNewLocation)!, `场景照：${sbNewLocation}`);
                                                      }}
                                                    >
                                                      @{sbNewLocation}
                                                      <ImageIcon className="h-3 w-3" />
                                                    </a>
                                                  ) : (
                                                    <span className="text-muted-foreground/60">@{sbNewLocation}</span>
                                                  )}
                                                </div>
                                              )}
                                              {/* 场景描述 */}
                                              {sbNewDescription && (
                                                <p className="text-sm leading-relaxed break-words">
                                                  {renderTextWithLinks(sbNewDescription, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                </p>
                                              )}
                                              {/* 时间点描述（timeDescriptions） */}
                                              {sbNewTimeDescriptions && (
                                                <div className="space-y-1 mt-1 pl-2 border-l-2 border-primary/20">
                                                  {Array.isArray(sbNewTimeDescriptions) 
                                                    ? sbNewTimeDescriptions.map((item: string, idx: number) => {
                                                        const processedText = replaceImagePlaceholders(item, timeDescCharacters, sbNewLocation);
                                                        return (
                                                          <div key={idx} className="text-xs text-muted-foreground/80">
                                                            {renderTextWithLinks(processedText, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                          </div>
                                                        );
                                                      })
                                                    : Object.entries(sbNewTimeDescriptions).map(([timeRange, description]) => {
                                                        const processedText = typeof description === 'string' 
                                                          ? replaceImagePlaceholders(description, timeDescCharacters, sbNewLocation)
                                                          : '';
                                                        return (
                                                          <div key={timeRange} className="text-xs">
                                                            <span className="text-muted-foreground font-medium">[{timeRange}]</span>
                                                            <span className="text-muted-foreground/80 ml-1">
                                                              {renderTextWithLinks(processedText, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                            </span>
                                                          </div>
                                                        );
                                                      })
                                                  }
                                                </div>
                                              )}
                                            </>
                                          )}
                                          {/* 旧格式：完整场景描述 */}
                                          {!isNewFormat && sbScene && (
                                            <div className="overflow-hidden">
                                              <span className="text-xs text-muted-foreground font-medium">场景：</span>
                                              <p className="text-sm leading-relaxed break-words mt-0.5">
                                                {renderTextWithLinks(sbScene, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                              </p>
                                            </div>
                                          )}
                                          {/* 场景位置 + 氛围（带超链接） - 横向排列 */}
                                          {(sceneLocation || mood) && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                              {sceneLocation && (
                                                <span>
                                                  场景：
                                                  {getSceneImageUrl(sceneLocation) ? (
                                                    <a
                                                      href={getSceneImageUrl(sceneLocation)!}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        showImagePreviewDialog(getSceneImageUrl(sceneLocation)!, `场景照：${sceneLocation}`);
                                                      }}
                                                    >
                                                      @{numberToChinese(sceneLocation)}
                                                      <ImageIcon className="h-3 w-3" />
                                                    </a>
                                                  ) : (
                                                    <span className="ml-0.5">{numberToChinese(sceneLocation)}</span>
                                                  )}
                                                </span>
                                              )}
                                              {mood && <span>氛围：{numberToChinese(mood)}</span>}
                                            </div>
                                          )}
                                          {/* 运镜 + 动作 + 特写 - 横向排列 */}
                                          {(cameraMovement || sbAction || sbCloseup) && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                              {cameraMovement && <span>运镜：{numberToChinese(cameraMovement)}</span>}
                                              {sbAction && <span>动作：{numberToChinese(sbAction)}</span>}
                                              {sbCloseup && <span>特写：{numberToChinese(sbCloseup)}</span>}
                                            </div>
                                          )}
                                          {/* 风格 + BGM - 横向排列 */}
                                          {(sbStyle || sbBgmAtmosphere) && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                              {sbStyle && <span>风格：{numberToChinese(sbStyle)}</span>}
                                              {sbBgmAtmosphere && <span>BGM：{numberToChinese(sbBgmAtmosphere)}</span>}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <>
                                          {/* 视觉提示词（优先显示） */}
                                          {visualPrompt && (
                                            <div className="mb-2">
                                              <p className="text-sm leading-relaxed break-words">
                                                {renderTextWithLinks(visualPrompt, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                              </p>
                                            </div>
                                          )}

                                          {/* 降级：场景描述 */}
                                          {!visualPrompt && sceneDesc && (
                                            <p className="text-sm text-muted-foreground leading-relaxed break-words mb-2">
                                              {renderTextWithLinks(sceneDesc, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                            </p>
                                          )}
                                          
                                          {/* 场景位置 + 氛围 */}
                                          {(sceneLocation || mood) && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                                              {sceneLocation && (
                                                <span>
                                                  场景：
                                                  {getSceneImageUrl(sceneLocation) ? (
                                                    <a
                                                      href={getSceneImageUrl(sceneLocation)!}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        showImagePreviewDialog(getSceneImageUrl(sceneLocation)!, `场景照：${sceneLocation}`);
                                                      }}
                                                    >
                                                      @{numberToChinese(sceneLocation)}
                                                      <ImageIcon className="h-3 w-3" />
                                                    </a>
                                                  ) : (
                                                    <span className="ml-0.5">{numberToChinese(sceneLocation)}</span>
                                                  )}
                                                </span>
                                              )}
                                              {mood && <span>氛围：{numberToChinese(mood)}</span>}
                                            </div>
                                          )}
                                        </>
                                      )}
                                      
                                    </div>
                                  );
                                })}
                              
                              {/* 结尾悬念 - 作为最后一个分镜 */}
                              {viewingEpisode?.cliffhanger && (() => {
                                // 兼容字符串和对象两种格式
                                // 先尝试解析 JSON 字符串，如果失败则作为普通描述文本
                                let cliffhangerData: HookCliffhangerData;
                                if (typeof viewingEpisode.cliffhanger === 'string') {
                                  try {
                                    // 尝试解析 JSON 字符串
                                    const parsed = JSON.parse(viewingEpisode.cliffhanger);
                                    cliffhangerData = typeof parsed === 'object' && parsed !== null ? parsed : { scene: { description: String(parsed) } };
                                  } catch {
                                    // 解析失败，作为普通描述文本
                                    cliffhangerData = { scene: { description: viewingEpisode.cliffhanger } };
                                  }
                                } else {
                                  cliffhangerData = viewingEpisode.cliffhanger;
                                }
                                const cliffhangerVisualPrompt = typeof cliffhangerData.visualPrompt === 'string' ? cliffhangerData.visualPrompt : '';
                                // 时长：根据视频模型决定，不再依赖后端返回的 duration 字段
                                const userStr = localStorage.getItem('user');
                                const user = userStr ? JSON.parse(userStr) : null;
                                const cliffhangerVideoModel = user?.video_model || 'doubao-seedance-2-0-260128';
                                const cliffhangerDuration = getVideoModelMaxDuration(cliffhangerVideoModel);
                                const cliffhangerShotType = cliffhangerData.shotType || '氛围镜头';
                                const cliffhangerCameraMovement = cliffhangerData.cameraMovement || '';
                                const cliffhangerMood = cliffhangerData.mood || '';
                                const { location: cliffhangerSceneLocation, description: cliffhangerSceneDesc } = parseSceneInfo(cliffhangerData.scene);
                                // 从对话中提取所有说话人，自动补充到镜头人物列表
                                const cliffhangerSpeakersFromDialogues = (cliffhangerData.dialogues || [])
                                  .map((d: { speaker?: string }) => d.speaker)
                                  .filter((s: string | undefined): s is string => !!s && s !== '旁白');
                                // 处理 characters 可能是对象数组或字符串数组的情况
                                const cliffhangerCharactersRaw = cliffhangerData.characters || [];
                                const cliffhangerCharactersFromData = cliffhangerCharactersRaw.map((c: string | { name: string }) => 
                                  typeof c === 'string' ? c : c?.name
                                ).filter(Boolean);
                                const cliffhangerCharacters = [...new Set([...cliffhangerCharactersFromData, ...cliffhangerSpeakersFromDialogues])];
                                const cliffhangerDialogue = cliffhangerData.dialogue;
                                // 新格式：多句对话数组
                                const cliffhangerDialogues = cliffhangerData.dialogues;
                                // 计算序号：开篇钩子=1, 分镜=2~N+1, 结尾悬念=N+2
                                const cliffhangerSequence = (viewingEpisode?.storyboards?.length || 0) + (viewingEpisode?.hook ? 2 : 1);
                                
                                // 从旧格式 scene 对象中提取 location（复用已有的 cliffhangerSceneLocation）
                                // parseSceneInfo 已经在上面解析过了，这里直接使用 cliffhangerSceneLocation
                                
                                // 顶配爆款版字段（需要先定义，因为新格式字段会引用）
                                // 修复：当 scene 是对象时，需要提取其中的 description
                                const cliffhangerSceneObj = cliffhangerData.scene;
                                const cliffhangerScene = typeof cliffhangerSceneObj === 'string' 
                                  ? cliffhangerSceneObj 
                                  : (cliffhangerSceneObj && typeof cliffhangerSceneObj === 'object' && 'description' in cliffhangerSceneObj)
                                    ? String((cliffhangerSceneObj as { description?: unknown }).description || '')
                                    : '';
                                
                                // 新格式字段（优先使用，兼容旧格式）
                                const cliffhangerNewLocation = cliffhangerData.location || cliffhangerSceneLocation;
                                const cliffhangerNewDescription = cliffhangerData.description || cliffhangerScene;
                                const cliffhangerNewCharacterList = cliffhangerData.characterList as string[] | undefined;
                                const cliffhangerNewTimeDescriptions = cliffhangerData.timeDescriptions as Record<string, string> | string[] | undefined;
                                
                                const cliffhangerAction = cliffhangerData.action || '';
                                const cliffhangerCloseup = cliffhangerData.closeup || '';
                                const cliffhangerStyle = cliffhangerData.style || '';
                                const cliffhangerBgmAtmosphere = cliffhangerData.bgmAtmosphere || '';
                                // 判断是否是新格式（优先）或顶配爆款版格式或有旧 scene
                                // 修复：添加 *Scene 字段作为兜底条件，确保内容能显示
                                const cliffhangerIsNewFormat = cliffhangerNewLocation || cliffhangerNewDescription || cliffhangerNewTimeDescriptions;
                                const cliffhangerIsProFormat = cliffhangerIsNewFormat || cliffhangerAction || cliffhangerCloseup || cliffhangerStyle || cliffhangerBgmAtmosphere || cliffhangerScene || cliffhangerSceneLocation || cliffhangerNewLocation;
                                // 构建用于 [图片X] 替换的角色数组
                                const cliffhangerTimeDescCharacters = cliffhangerNewCharacterList 
                                  ? cliffhangerNewCharacterList.map(name => ({ name })) 
                                  : undefined;
                                
                                return (
                                  <div className="p-4 rounded-lg border bg-gradient-to-r from-card to-muted/20 hover:shadow-md hover:border-primary/20 transition-all overflow-hidden">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                      <div className="flex-1 min-w-0">
                                        {/* 第一行：序号 + 镜头类型 + 角色名 */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500 text-white text-xs font-bold shadow-sm shrink-0">
                                            尾
                                          </span>
                                          <Badge variant="secondary" className="text-xs font-medium shrink-0">{cliffhangerShotType}</Badge>
                                          {cliffhangerCharacters && cliffhangerCharacters.length > 0 && cliffhangerCharacters.slice(0, 3).map((char, idx) => (
                                            getCharacterImageUrl(char) ? (
                                              <a
                                                key={idx}
                                                href={getCharacterImageUrl(char)!}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  showImagePreviewDialog(getCharacterImageUrl(char)!, `人物立绘：${char}`);
                                                }}
                                              >
                                                <Badge variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0 cursor-pointer">
                                                  @{char}
                                                  <ImageIcon className="h-3 w-3 ml-1" />
                                                </Badge>
                                              </a>
                                            ) : (
                                              <Badge key={idx} variant="outline" className="text-xs border-primary/30 text-primary shrink-0">{char}</Badge>
                                            )
                                          ))}
                                          {cliffhangerCharacters && cliffhangerCharacters.length > 3 && (
                                            <span className="text-xs text-muted-foreground">+{cliffhangerCharacters.length - 3}</span>
                                          )}
                                        </div>
                                        {/* 第二行：运镜（单独显示） */}
                                        {cliffhangerCameraMovement && cliffhangerCameraMovement !== '固定' && (
                                          <div className="mt-1.5 text-xs text-muted-foreground truncate" title={cliffhangerCameraMovement}>
                                            运镜：{cliffhangerCameraMovement}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-muted-foreground font-medium">{cliffhangerDuration}秒</span>
                                        <button
                                          className={cn(
                                            "inline-flex items-center justify-center rounded-md text-xs font-bold transition-all shadow-sm",
                                            "h-7 px-2.5",
                                            syncingStoryboardIndex === -2
                                              ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-purple-500/30"
                                              : "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105"
                                          )}
                                          onClick={() => syncSingleStoryboardAssets(-2)}
                                          disabled={syncingStoryboardIndex !== null}
                                          title="生成分镜素材（角色立绘和场景图片）"
                                        >
                                          {syncingStoryboardIndex === -2 ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            "绘"
                                          )}
                                        </button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className={cn(
                                            "h-7 px-2 transition-all",
                                            generatingCliffhanger 
                                              ? "bg-red-500 text-white hover:bg-red-600" 
                                              : cliffhangerVideoGenerated
                                                ? "bg-green-500 text-white hover:bg-green-600"
                                                : "text-primary hover:bg-primary/10"
                                          )}
                                          onClick={() => generateCliffhangerVideo()}
                                          disabled={generatingCliffhanger}
                                          title={
                                            generatingCliffhanger 
                                              ? "正在生成视频..." 
                                              : cliffhangerVideoGenerated
                                                ? "视频已生成"
                                                : "生成结尾悬念视频"
                                          }
                                        >
                                          {generatingCliffhanger ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : cliffhangerVideoGenerated ? (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          ) : (
                                            <Video className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    {/* 顶配爆款版格式显示 */}
                                    {cliffhangerIsProFormat ? (
                                      <div className="space-y-1.5 min-w-0">
                                        {/* 新格式优先显示 */}
                                        {cliffhangerIsNewFormat && (
                                          <>
                                            {/* 场景位置（带超链接） */}
                                            {cliffhangerNewLocation && (
                                              <div className="text-xs text-muted-foreground">
                                                场景位置：{getSceneImageUrl(cliffhangerNewLocation) ? (
                                                  <a
                                                    href={getSceneImageUrl(cliffhangerNewLocation)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      showImagePreviewDialog(getSceneImageUrl(cliffhangerNewLocation)!, `场景照：${cliffhangerNewLocation}`);
                                                    }}
                                                  >
                                                    @{cliffhangerNewLocation}
                                                    <ImageIcon className="h-3 w-3" />
                                                  </a>
                                                ) : (
                                                  <span className="text-muted-foreground/60">@{cliffhangerNewLocation}</span>
                                                )}
                                              </div>
                                            )}
                                            {/* 场景描述 */}
                                            {cliffhangerNewDescription && (
                                              <p className="text-sm leading-relaxed break-words">
                                                {renderTextWithLinks(cliffhangerNewDescription, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                              </p>
                                            )}
                                            {/* 时间点描述（timeDescriptions） */}
                                            {cliffhangerNewTimeDescriptions && (
                                              <div className="space-y-1 mt-1 pl-2 border-l-2 border-primary/20">
                                                {Array.isArray(cliffhangerNewTimeDescriptions) 
                                                  ? cliffhangerNewTimeDescriptions.map((item: string, idx: number) => {
                                                      const processedText = replaceImagePlaceholders(item, cliffhangerTimeDescCharacters, cliffhangerNewLocation);
                                                      return (
                                                        <div key={idx} className="text-xs text-muted-foreground/80">
                                                          {renderTextWithLinks(processedText, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                        </div>
                                                      );
                                                    })
                                                  : Object.entries(cliffhangerNewTimeDescriptions).map(([timeRange, description]) => {
                                                      const processedText = typeof description === 'string' 
                                                        ? replaceImagePlaceholders(description, cliffhangerTimeDescCharacters, cliffhangerNewLocation)
                                                        : '';
                                                      return (
                                                        <div key={timeRange} className="text-xs">
                                                          <span className="text-muted-foreground font-medium">[{timeRange}]</span>
                                                          <span className="text-muted-foreground/80 ml-1">
                                                            {renderTextWithLinks(processedText, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                                          </span>
                                                        </div>
                                                      );
                                                    })
                                                }
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {/* 旧格式：完整场景描述 */}
                                        {!cliffhangerIsNewFormat && cliffhangerScene && (
                                          <div className="overflow-hidden">
                                            <span className="text-xs text-muted-foreground font-medium">场景：</span>
                                            <p className="text-sm leading-relaxed break-words mt-0.5">
                                              {renderTextWithLinks(cliffhangerScene, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                            </p>
                                          </div>
                                        )}
                                        {/* 场景位置 + 氛围（带超链接） - 横向排列 */}
                                        {(cliffhangerSceneLocation || cliffhangerMood) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {cliffhangerSceneLocation && (
                                              <span>
                                                场景：
                                                {getSceneImageUrl(cliffhangerSceneLocation) ? (
                                                  <a
                                                    href={getSceneImageUrl(cliffhangerSceneLocation)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      showImagePreviewDialog(getSceneImageUrl(cliffhangerSceneLocation)!, `场景照：${cliffhangerSceneLocation}`);
                                                    }}
                                                  >
                                                    @{numberToChinese(cliffhangerSceneLocation)}
                                                    <ImageIcon className="h-3 w-3" />
                                                  </a>
                                                ) : (
                                                  <span className="ml-0.5">{numberToChinese(cliffhangerSceneLocation)}</span>
                                                )}
                                              </span>
                                            )}
                                            {cliffhangerMood && <span>氛围：{numberToChinese(cliffhangerMood)}</span>}
                                          </div>
                                        )}
                                        {/* 运镜 + 动作 + 特写 - 横向排列 */}
                                        {(cliffhangerCameraMovement || cliffhangerAction || cliffhangerCloseup) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {cliffhangerCameraMovement && <span>运镜：{numberToChinese(cliffhangerCameraMovement)}</span>}
                                            {cliffhangerAction && <span>动作：{numberToChinese(cliffhangerAction)}</span>}
                                            {cliffhangerCloseup && <span>特写：{numberToChinese(cliffhangerCloseup)}</span>}
                                          </div>
                                        )}
                                        {/* 风格 + BGM - 横向排列 */}
                                        {(cliffhangerStyle || cliffhangerBgmAtmosphere) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {cliffhangerStyle && <span>风格：{numberToChinese(cliffhangerStyle)}</span>}
                                            {cliffhangerBgmAtmosphere && <span>BGM：{numberToChinese(cliffhangerBgmAtmosphere)}</span>}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        {/* 视觉提示词（优先显示） */}
                                        {cliffhangerVisualPrompt && (
                                          <div className="mb-2">
                                            <p className="text-sm leading-relaxed break-words">
                                              {renderTextWithLinks(cliffhangerVisualPrompt, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                            </p>
                                          </div>
                                        )}

                                        {/* 降级：场景描述 */}
                                        {!cliffhangerVisualPrompt && cliffhangerSceneDesc && (
                                          <p className="text-sm leading-relaxed text-foreground/80 break-words">
                                            {renderTextWithLinks(cliffhangerSceneDesc, getCharacterImageUrl, getSceneImageUrl, showImagePreviewDialog)}
                                          </p>
                                        )}

                                        {/* 场景位置 + 氛围（带超链接） */}
                                        {(cliffhangerSceneLocation || cliffhangerMood) && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                            {cliffhangerSceneLocation && (
                                              <span>
                                                场景：
                                                {getSceneImageUrl(cliffhangerSceneLocation) ? (
                                                  <a
                                                    href={getSceneImageUrl(cliffhangerSceneLocation)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      showImagePreviewDialog(getSceneImageUrl(cliffhangerSceneLocation)!, `场景照：${cliffhangerSceneLocation}`);
                                                    }}
                                                  >
                                                    @{numberToChinese(cliffhangerSceneLocation)}
                                                    <ImageIcon className="h-3 w-3" />
                                                  </a>
                                                ) : (
                                                  <span className="ml-0.5">{numberToChinese(cliffhangerSceneLocation)}</span>
                                                )}
                                              </span>
                                            )}
                                            {cliffhangerMood && <span>氛围：{numberToChinese(cliffhangerMood)}</span>}
                                          </div>
                                        )}
                                      </>
                                    )}
                                    
                                  </div>
                                );
                              })()}
                              
                              {/* 结尾悬念缺失 - 提供重新生成按钮 */}
                              {!viewingEpisode?.cliffhanger && viewingEpisode?.storyboards && viewingEpisode.storyboards.length > 0 && (
                                <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    <span className="text-sm text-amber-700 dark:text-amber-300">结尾悬念剧本缺失</span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={regenerateCliffhangerScript}
                                    disabled={regeneratingCliffhanger}
                                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                  >
                                    {regeneratingCliffhanger ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        生成中...
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCcw className="h-3 w-3 mr-1" />
                                        重新生成
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                              
                              {/* 无内容提示 */}
                              {(!viewingEpisode?.storyboards || viewingEpisode.storyboards.length === 0) && !viewingEpisode?.hook && !viewingEpisode?.cliffhanger && (
                                <div className="text-center py-8 bg-muted/30 rounded-lg">
                                  <p className="text-sm text-muted-foreground">暂无分镜剧本</p>
                                  <p className="text-xs text-muted-foreground mt-1">请先生成剧本内容</p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                    
                    {/* 视频生成进度 - 显示当前剧集视频生成进度 */}
                    {(generating === `video-${viewingEpisode?.episode_number}` || generatingHook || generatingCliffhanger || generating === 'retry-videos') && videoTotalTasks > 0 && (
                      <div className="px-6 py-3 bg-muted/50 border-t flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                {generatingHook ? '正在生成开篇钩子视频...' : 
                                 generatingCliffhanger ? '正在生成结尾悬念视频...' : 
                                 generating === 'retry-videos' ? '正在重试失败视频...' : 
                                 '正在生成视频...'}
                              </span>
                              <span className="text-sm text-muted-foreground">{videoCompletedTasks}/{videoTotalTasks}</span>
                            </div>
                            <Progress value={videoGeneratingProgress} className="h-2" />
                          </div>
                          <span className="text-xs text-muted-foreground">预计1-2分钟</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-2 px-6 py-3 border-t bg-background flex-shrink-0">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          // 如果正在生成视频，终止生成
                          if (generating || generatingHook || generatingCliffhanger) {
                            // 取消视频生成任务
                            if (videoAbortControllerRef.current) {
                              videoAbortControllerRef.current.abort();
                              videoAbortControllerRef.current = null;
                            }
                            // 重置所有生成状态
                            setGenerating(null);
                            setGeneratingHook(false);
                            setGeneratingCliffhanger(false);
                            setVideoTotalTasks(0);
                            setVideoCompletedTasks(0);
                            setVideoGeneratingProgress(0);
                            toast.info('已终止视频生成');
                          }
                          closeEpisodeDialog();
                        }}
                      >
                        {generating || generatingHook || generatingCliffhanger ? '终止并关闭' : '关闭'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          if (viewingEpisode && selectedSeries) {
                            const epNum = viewingEpisode.episode_number;
                            generateEpisode(epNum);
                          }
                        }}
                        disabled={!!generating}
                      >
                        {generating === `episode-${viewingEpisode?.episode_number}` ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          '重新生成剧本'
                        )}
                      </Button>
                      <Button 
                        onClick={() => viewingEpisode && mergeEpisodeVideos(viewingEpisode)}
                        disabled={mergingVideos || !allStoryboardsHaveVideos}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!allStoryboardsHaveVideos ? "请先生成所有分镜视频" : "将所有分镜视频合成为完整剧集"}
                      >
                        {mergingVideos ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            合成中...
                          </>
                        ) : (
                          <>
                            <Film className="h-4 w-4 mr-2" />
                            合成视频
                          </>
                        )}
                      </Button>
                      {!allStoryboardsHaveVideos && viewingEpisode?.storyboards && (
                        <span className="text-xs text-muted-foreground">
                          已生成 {generatedStoryboardIndices.size}/{viewingEpisode.storyboards.length} 个分镜
                        </span>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                );
                })()}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // Series List
          <div className="space-y-4">
            {/* 搜索和筛选栏 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索剧本..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="outlining">大纲中</SelectItem>
                  <SelectItem value="writing">创作中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                创建新剧本
              </Button>
            </div>
            
            {/* 统计信息 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>共 {stats.total} 个剧本</span>
              <Separator orientation="vertical" className="h-4" />
              <span>草稿 {stats.draft}</span>
              <span>大纲中 {stats.outlining}</span>
              <span>创作中 {stats.writing}</span>
              <span>已完成 {stats.completed}</span>
            </div>

            {/* 项目列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <Card className="col-span-full">
                  <CardContent className="p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground mt-4">加载中...</p>
                  </CardContent>
                </Card>
              ) : filteredSeriesList.length === 0 ? (
                <Card className="col-span-full border-dashed bg-gradient-to-b from-muted/30 to-transparent">
                <CardContent className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                    {searchQuery || filterStatus !== 'all' ? (
                      <Search className="h-8 w-8 text-primary" />
                    ) : (
                      <Plus className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <p className="text-lg font-semibold">
                    {searchQuery || filterStatus !== 'all' ? '没有找到匹配的剧本' : '还没有剧本'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    {searchQuery || filterStatus !== 'all' 
                      ? '尝试调整搜索条件或筛选器' 
                      : '创建你的第一个剧本，AI将为你生成完整的短剧内容'}
                  </p>
                  {!searchQuery && filterStatus === 'all' && (
                    <Button 
                      className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      创建新剧本
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredSeriesList.map((series) => (
                <Card
                  key={series.id}
                  className="cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/30 group"
                  onClick={() => selectSeries(series.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{series.title}</h3>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(series.status)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSeries(series.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-xs">{ALL_GENRES.find(g => g.id === series.genre)?.label || series.genre}</span>
                        {series.image_style && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                            {IMAGE_STYLE_OPTIONS.find(s => s.id === series.image_style)?.label || series.image_style}
                          </span>
                        )}
                        <span>{series.total_episodes}集</span>
                        {(series.character_count || series.characters?.length) && (
                          <span>{series.character_count || series.characters?.length}个角色</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={series.progress} className="w-14 h-1.5" />
                        <span className="text-xs text-muted-foreground font-medium">{series.progress}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 视频生成浮动状态栏 */}
      {videoGeneratingEpisode && !episodeDialogOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-4 min-w-[240px] cursor-pointer"
          onClick={() => {
            setViewingEpisodeId(videoGeneratingEpisode.episode_number);
            setEpisodeDialogOpen(true);
            // loadEpisodeVideos 由 useEffect 在 episodeDialogOpen 变化时自动调用
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">第{videoGeneratingEpisode.episode_number}集生成中</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                if (videoAbortControllerRef.current) {
                  videoAbortControllerRef.current.abort();
                  videoAbortControllerRef.current = null;
                }
                setVideoGeneratingEpisode(null);
                setVideoGeneratingProgress(0);
                setVideoCompletedTasks(0);
                setVideoTotalTasks(0);
                toast.info('已取消');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={videoGeneratingProgress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground">{videoCompletedTasks}/{videoTotalTasks}</span>
          </div>
        </div>
      )}
      
      {/* 失败视频重试状态栏 */}
      {!videoGeneratingEpisode && failedVideoTasks.length > 0 && viewingEpisode && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-4 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">{failedVideoTasks.length}个视频生成失败</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setFailedVideoTasks([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => retryFailedVideos()}
              disabled={!!generating}
            >
              {generating === 'retry-videos' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  重试中...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重试失败视频
                </>
              )}
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            按顺序重试: {failedVideoTasks.map(t => 
              t.type === 'hook' ? '开篇' :
              t.type === 'storyboard' ? `分镜${t.index + 1}` : '结尾'
            ).join(' → ')}
          </div>
        </div>
      )}

      {/* 简介详情对话框 */}
      <Dialog open={showDescriptionDialog} onOpenChange={setShowDescriptionDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {selectedSeries?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">题材</span>
                <p className="text-sm font-medium">{ALL_GENRES.find(g => g.id === selectedSeries?.genre)?.label || selectedSeries?.genre || '未设定'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">风格</span>
                <p className="text-sm font-medium">{STYLE_OPTIONS.find(s => s.id === selectedSeries?.style)?.label || selectedSeries?.style || '未设定'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">集数</span>
                <p className="text-sm font-medium">{selectedSeries?.total_episodes}集</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">状态</span>
                <p className="text-sm font-medium">{getStatusBadge(selectedSeries?.status || 'draft')}</p>
              </div>
            </div>

            {/* 剧情简介 */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">剧情简介</span>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {selectedSeries?.description || '暂无简介'}
              </p>
            </div>

            {/* 核心冲突 */}
            {selectedSeries?.core_conflict && (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">核心冲突</span>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {selectedSeries.core_conflict}
                </p>
              </div>
            )}

            {/* 故事概要信息 - 从 metadata 中获取 */}
            {selectedSeries?.metadata?.storyInfo && (
              <>
                {selectedSeries.metadata.storyInfo.protagonist && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      主角
                    </span>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {selectedSeries.metadata.storyInfo.protagonist}
                    </p>
                  </div>
                )}

                {selectedSeries.metadata.storyInfo.storyType && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">故事类型</span>
                    <Badge variant="secondary">{selectedSeries.metadata.storyInfo.storyType}</Badge>
                  </div>
                )}

                {selectedSeries.metadata.storyInfo.storySummary && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">故事概要</span>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {selectedSeries.metadata.storyInfo.storySummary}
                    </p>
                  </div>
                )}

                {selectedSeries.metadata.storyInfo.storyBackground && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      故事背景
                    </span>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {selectedSeries.metadata.storyInfo.storyBackground}
                    </p>
                  </div>
                )}

                {selectedSeries.metadata.storyInfo.storySetting && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      故事设定
                    </span>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {selectedSeries.metadata.storyInfo.storySetting}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDescriptionDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配音配置弹窗 */}
      <Dialog open={showVoiceDialog} onOpenChange={setShowVoiceDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              配音配置
            </DialogTitle>
            <DialogDescription>
              为角色 <span className="font-medium text-foreground">{selectedCharacterForVoice?.name}</span> 选择合适的音色
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {loadingVoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">加载音色列表...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 角色信息提示 */}
                {selectedCharacterForVoice && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Badge variant={selectedCharacterForVoice.gender === 'male' ? 'default' : 'secondary'}>
                      {selectedCharacterForVoice.gender === 'male' ? '男' : '女'}
                    </Badge>
                    <span className="font-medium">{selectedCharacterForVoice.name}</span>
                    <span className="text-sm text-muted-foreground">{selectedCharacterForVoice.age}岁</span>
                    {selectedCharacterForVoice.characteristic && (
                      <span className="text-sm text-muted-foreground">
                        · {selectedCharacterForVoice.characteristic}
                      </span>
                    )}
                  </div>
                )}

                {/* 音色选择 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">选择音色</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {availableVoices
                      .filter(v => !selectedCharacterForVoice?.gender || v.gender === selectedCharacterForVoice.gender)
                      .map((voice) => (
                        <div
                          key={voice.id}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all",
                            selectedVoiceId === voice.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50 hover:bg-muted/30"
                          )}
                          onClick={() => setSelectedVoiceId(voice.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-sm">{voice.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {voice.gender === 'male' ? '男声' : '女声'}
                              </Badge>
                            </div>
                            {selectedVoiceId === voice.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          {voice.description && (
                            <p className="text-xs text-muted-foreground mt-1">{voice.description}</p>
                          )}
                        </div>
                      ))}
                  </div>
                  
                  {availableVoices.filter(v => !selectedCharacterForVoice?.gender || v.gender === selectedCharacterForVoice.gender).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无匹配的音色
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowVoiceDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={saveVoiceConfig}
              disabled={!selectedVoiceId || savingVoice}
            >
              {savingVoice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  保存配置
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重新生成确认对话框 */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-500" />
              确认重新生成
            </DialogTitle>
            <DialogDescription>
              {regenerateType === 'character' ? (
                <span>
                  角色 <strong className="text-foreground">{regenerateTarget.name}</strong> 已有立绘图片。
                  重新生成将覆盖现有图片，是否继续？
                </span>
              ) : (
                <span>
                  场景 <strong className="text-foreground">{regenerateTarget.name}</strong> 已有场景图片。
                  重新生成将覆盖现有图片，是否继续？
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowRegenerateDialog(false)}
            >
              取消
            </Button>
            <Button 
              onClick={handleConfirmRegenerate}
              className="bg-amber-500 hover:bg-amber-600"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              确认重新生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览对话框 */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewImageTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/50 rounded-lg p-4 min-h-[400px]">
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={previewImageTitle}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>无法加载图片</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImagePreview(false)}>
              关闭
            </Button>
            {previewImageUrl && (
              <Button
                onClick={() => {
                  window.open(previewImageUrl, '_blank');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                在新窗口打开
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建新剧本弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>创建新剧本</DialogTitle>
            <DialogDescription>创建一个新的短剧剧本，AI将为你生成完整内容</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4 pb-4">
              {/* 标题 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>剧本标题</Label>
                  <span className="text-xs text-muted-foreground">不填写将由AI自动生成</span>
                </div>
                <Input
                  value={newSeries.title}
                  onChange={(e) => setNewSeries({ ...newSeries, title: e.target.value })}
                  placeholder="AI将根据剧情简介自动生成标题..."
                />
              </div>

              {/* 题材类型 */}
              <div className="space-y-2">
                <Label>题材类型 *</Label>
                <Select
                  value={newSeries.genre}
                  onValueChange={(v) => {
                    // 切换题材时，自动选择该题材的第一个推荐风格
                    const recommendedStyles = getRecommendedStyles(v);
                    setNewSeries({ 
                      ...newSeries, 
                      genre: v, 
                      style: newSeries.style && recommendedStyles.includes(newSeries.style) 
                        ? newSeries.style 
                        : recommendedStyles[0] 
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择题材">
                      {Object.values(GENRE_CATEGORIES).flatMap(cat => cat.genres).find(g => g.id === newSeries.genre)?.label || '请选择题材'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {Object.entries(GENRE_CATEGORIES).map(([catKey, cat]) => {
                      const CatIcon = cat.icon;
                      return (
                        <div key={catKey}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <CatIcon className={cn("h-3.5 w-3.5", cat.iconColor)} />
                            {cat.label}
                          </div>
                          {cat.genres.map(genre => (
                            <SelectItem key={genre.id} value={genre.id || genre.label}>
                              <div className="flex flex-col">
                                <span>{genre.label}</span>
                                <span className="text-xs text-muted-foreground">{genre.desc}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 题材风格 - 根据题材动态显示 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>题材风格</Label>
                  <span className="text-xs text-muted-foreground">
                    {ALL_GENRES.find(g => g.id === newSeries.genre)?.label || ''}推荐风格
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const recommendedStyles = getRecommendedStyles(newSeries.genre);
                    return STYLE_OPTIONS.filter(s => recommendedStyles.includes(s.id)).map((style) => (
                      <div
                        key={style.id}
                        onClick={() => setNewSeries({ ...newSeries, style: style.id })}
                        className={cn(
                          "flex-1 min-w-[80px] p-2.5 rounded-lg border-2 cursor-pointer transition-all text-center",
                          newSeries.style === style.id 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        <p className="font-medium text-sm">{style.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{style.desc}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* 图片风格 */}
              <div className="space-y-2">
                <Label>图片风格</Label>
                <div className="flex gap-2">
                  {IMAGE_STYLE_OPTIONS.map((style) => (
                    <div
                      key={style.id}
                      onClick={() => setNewSeries({ ...newSeries, imageStyle: style.id })}
                      className={cn(
                        "flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center",
                        newSeries.imageStyle === style.id 
                          ? "border-primary bg-primary/5" 
                          : "border-muted hover:border-primary/50"
                      )}
                    >
                      <p className="font-medium text-sm">{style.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{style.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 集数和人物 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>总集数</Label>
                  <Input
                    type="number"
                    value={newSeries.totalEpisodes || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setNewSeries({ ...newSeries, totalEpisodes: 0 });
                      } else {
                        const parsed = parseInt(value);
                        if (!isNaN(parsed)) {
                          setNewSeries({ ...newSeries, totalEpisodes: Math.max(1, Math.min(500, parsed)) });
                        }
                      }
                    }}
                    min={1}
                    max={500}
                    placeholder="输入集数"
                  />
                  <p className="text-xs text-muted-foreground">建议范围：10-100集</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    人物数量
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 0, label: 'AI自动' },
                      { value: 2, label: '2人' },
                      { value: 3, label: '3人' },
                      { value: 4, label: '4人' },
                      { value: 5, label: '5人' },
                      { value: 6, label: '6人+' },
                    ].map((option) => {
                      const isSelected = newSeries.characterCount === option.value;
                      return (
                        <Badge
                          key={option.value}
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-all text-xs",
                            isSelected 
                              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent" 
                              : "hover:bg-muted"
                          )}
                          onClick={() => setNewSeries({ ...newSeries, characterCount: option.value })}
                        >
                          {option.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 核心冲突类型 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>核心冲突类型</Label>
                  <span className="text-xs text-muted-foreground">可多选</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {CORE_CONFLICT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = newSeries.coreConflictTypes.includes(type.id);
                    return (
                      <div
                        key={type.id}
                        onClick={() => {
                          const newTypes = isSelected
                            ? newSeries.coreConflictTypes.filter(t => t !== type.id)
                            : [...newSeries.coreConflictTypes, type.id];
                          setNewSeries({ ...newSeries, coreConflictTypes: newTypes });
                        }}
                        className={cn(
                          "p-3 rounded-xl border-2 cursor-pointer transition-all duration-200",
                          "hover:shadow-md",
                          isSelected && "shadow-md",
                          type.id === 'revenge' && (isSelected ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700" : "border-gray-200 dark:border-gray-700 hover:border-red-300"),
                          type.id === 'identity' && (isSelected ? "bg-purple-50 border-purple-300 dark:bg-purple-950/30 dark:border-purple-700" : "border-gray-200 dark:border-gray-700 hover:border-purple-300"),
                          type.id === 'emotion' && (isSelected ? "bg-pink-50 border-pink-300 dark:bg-pink-950/30 dark:border-pink-700" : "border-gray-200 dark:border-gray-700 hover:border-pink-300"),
                          type.id === 'survival' && (isSelected ? "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700" : "border-gray-200 dark:border-gray-700 hover:border-orange-300"),
                          type.id === 'rebirth' && (isSelected ? "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-700" : "border-gray-200 dark:border-gray-700 hover:border-yellow-300"),
                          type.id === 'growth' && (isSelected ? "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700" : "border-gray-200 dark:border-gray-700 hover:border-blue-300")
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                            isSelected ? "bg-primary/20" : "bg-muted"
                          )}>
                            <Icon className={cn(
                              "h-4 w-4",
                              type.id === 'revenge' && "text-red-500",
                              type.id === 'identity' && "text-purple-500",
                              type.id === 'emotion' && "text-pink-500",
                              type.id === 'survival' && "text-orange-500",
                              type.id === 'rebirth' && "text-yellow-500",
                              type.id === 'growth' && "text-blue-500"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{type.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 核心冲突描述 */}
              <div className="space-y-2">
                <Label>核心冲突描述</Label>
                <Textarea
                  value={newSeries.coreConflict}
                  onChange={(e) => setNewSeries({ ...newSeries, coreConflict: e.target.value })}
                  placeholder="描述故事的核心矛盾和冲突点，如：重生复仇 vs 权谋爱情..."
                  rows={2}
                />
              </div>

              {/* 剧情简介 */}
              <div className="space-y-2">
                <Label>剧情简介</Label>
                <Textarea
                  value={newSeries.description}
                  onChange={(e) => setNewSeries({ ...newSeries, description: e.target.value })}
                  placeholder="简单描述故事背景和主线剧情..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
          <div className="p-6 pt-4 border-t flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={createSeries} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              创建剧本
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  </TooltipProvider>
  );
}

