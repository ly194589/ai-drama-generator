'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Play,
  RotateCcw,
  Zap,
  Sparkles,
  FileText,
  Users,
  Film,
  Scissors,
  Shield,
  Download,
  Copy,
  Check,
  Video,
  Volume2,
  ArrowRight,
  Image,
  Heart,
  Swords,
  UsersRound,
  BookOpen,
  ImageIcon as ImageIconLucide,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// 可折叠的信息卡片组件
function CollapsibleInfoCard({ 
  title, 
  data,
  defaultShowCount = 2 
}: { 
  title: string; 
  data: Array<{ label: string; value: string | undefined }>;
  defaultShowCount?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = data.filter(d => d.value).length > defaultShowCount;
  const visibleData = isExpanded ? data : data.slice(0, defaultShowCount);

  return (
    <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
      <div 
        className="p-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => hasMore && setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        {hasMore && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
            {isExpanded ? (
              <>收起 <ChevronUp className="h-3 w-3 ml-1" /></>
            ) : (
              <>展开 <ChevronDown className="h-3 w-3 ml-1" /></>
            )}
          </Button>
        )}
      </div>
      <div className="p-4 space-y-2 text-sm">
        {visibleData.filter(d => d.value).map((item, idx) => (
          <div key={idx} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-right max-w-[60%] truncate">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 可折叠的文本卡片组件
function CollapsibleTextCard({ 
  title, 
  content, 
  maxLines = 2 
}: { 
  title: string; 
  content: string;
  maxLines?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lineClampClass = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
  }[maxLines] || 'line-clamp-2';

  // 判断内容是否超过指定行数（大约每行30个字符）
  const isLongContent = content.length > maxLines * 30;

  return (
    <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
      <div 
        className="p-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => isLongContent && setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        {isLongContent && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
            {isExpanded ? (
              <>收起 <ChevronUp className="h-3 w-3 ml-1" /></>
            ) : (
              <>展开全部 <ChevronDown className="h-3 w-3 ml-1" /></>
            )}
          </Button>
        )}
      </div>
      <div className="p-4">
        <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap", !isExpanded && lineClampClass)}>
          {content}
        </p>
      </div>
    </div>
  );
}

// 可折叠的冲突描述输入组件
function ConflictDescriptionInput({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewLength = 50;
  const isLongContent = value.length > previewLength;
  
  // 有内容时默认收起显示预览，无内容时默认展开显示输入框
  const showPreview = value.length > 0 && !isExpanded;
  const previewText = isLongContent ? value.slice(0, previewLength) + '...' : value;

  return (
    <div className="relative">
      {showPreview ? (
        // 预览模式
        <div 
          className="min-h-[60px] p-3 rounded-md border border-white/30 bg-white/30 cursor-pointer hover:bg-white/40 transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <p className="text-sm text-foreground whitespace-pre-wrap">{previewText}</p>
          {isLongContent && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground mt-1 -ml-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
            >
              点击查看/编辑全部
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      ) : (
        // 编辑模式
        <div className="relative">
          <Textarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className="text-sm leading-relaxed resize-none pr-16"
            autoFocus={value.length > 0}
          />
          {value.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-2 right-2 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(false)}
            >
              收起
              <ChevronUp className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// 剧集完整性状态卡片组件
interface CompletionModule {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  required: number;
  status: 'complete' | 'partial' | 'empty';
  action: string;
  description: string;
}

function DramaCompletionStatus({ 
  seriesId, 
  totalEpisodes,
  charactersCount,
  storyboardsCount,
  onNavigateToDrama 
}: { 
  seriesId: string;
  totalEpisodes: number;
  charactersCount: number;
  storyboardsCount: number;
  onNavigateToDrama: () => void;
}) {
  const [episodesData, setEpisodesData] = useState<Array<{
    episodeNumber: number;
    hasStoryboards: boolean;
    storyboardsCount: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEpisodesStatus = async () => {
      try {
        const response = await fetch(`/api/drama/series/${seriesId}`, {
          headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        });
        const data = await response.json();
        if (data.success && data.episodes) {
          setEpisodesData(data.episodes.map((ep: { episode_number: number; storyboards?: unknown[] }) => ({
            episodeNumber: ep.episode_number,
            hasStoryboards: ep.storyboards && ep.storyboards.length > 0,
            storyboardsCount: ep.storyboards?.length || 0,
          })));
        }
      } catch (error) {
        console.error('获取剧集状态失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (seriesId) {
      fetchEpisodesStatus();
    }
  }, [seriesId]);

  // 计算各模块状态
  const modules: CompletionModule[] = useMemo(() => {
    const completedEpisodes = episodesData.filter(ep => ep.hasStoryboards).length;
    
    return [
      {
        id: 'characters',
        name: '角色档案',
        icon: Users,
        count: charactersCount,
        required: 2,
        status: charactersCount >= 2 ? 'complete' : charactersCount > 0 ? 'partial' : 'empty',
        action: '生成角色',
        description: charactersCount >= 2 ? '角色已完整' : '需要至少2个角色',
      },
      {
        id: 'storyboards',
        name: '分镜剧本',
        icon: Film,
        count: completedEpisodes,
        required: totalEpisodes,
        status: completedEpisodes >= totalEpisodes ? 'complete' : completedEpisodes > 0 ? 'partial' : 'empty',
        action: '生成分镜',
        description: `已生成 ${completedEpisodes}/${totalEpisodes} 集`,
      },
      {
        id: 'scenes',
        name: '场景配置',
        icon: Image,
        count: 0, // 需要从API获取
        required: 3,
        status: 'empty', // 默认状态，需要从API获取实际状态
        action: '生成场景',
        description: '需要至少3个场景',
      },
      {
        id: 'videos',
        name: '视频生成',
        icon: Video,
        count: 0,
        required: completedEpisodes * 30, // 假设每集30个分镜
        status: 'empty',
        action: '生成视频',
        description: '尚未开始生成',
      },
    ];
  }, [charactersCount, episodesData, totalEpisodes]);

  if (loading) {
    return (
      <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">正在检查剧集完整性...</span>
        </div>
      </div>
    );
  }

  const hasIncomplete = modules.some(m => m.status !== 'complete');

  return (
    <div className={cn(
      "glass-card rounded-xl border backdrop-blur-xl overflow-hidden",
      hasIncomplete ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"
    )}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasIncomplete ? (
            <>
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <h3 className="text-sm font-semibold">剧集配置状态</h3>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-semibold">剧集配置完整</h3>
            </>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onNavigateToDrama}
          className="border-white/20 bg-white/10 hover:bg-white/20"
        >
          前往短剧管理
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {modules.map((module) => (
          <div 
            key={module.id}
            className={cn(
              "p-3 rounded-lg border transition-all",
              module.status === 'complete' && "bg-green-500/10 border-green-500/20",
              module.status === 'partial' && "bg-orange-500/10 border-orange-500/20",
              module.status === 'empty' && "bg-white/5 border-white/10"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <module.icon className={cn(
                  "h-4 w-4",
                  module.status === 'complete' && "text-green-500",
                  module.status === 'partial' && "text-orange-500",
                  module.status === 'empty' && "text-muted-foreground"
                )} />
                <span className="text-sm font-medium">{module.name}</span>
              </div>
              {module.status === 'complete' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : module.status === 'partial' ? (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{module.description}</span>
              {module.status !== 'complete' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onNavigateToDrama}
                  className="h-6 px-2 text-xs text-teal-600 hover:text-teal-700"
                >
                  {module.action}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
  output?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  // 预估时间（秒）
  estimatedTime?: number;
  // 友好的状态消息
  statusMessages?: {
    pending?: string;
    inProgress?: string;
    completed?: string;
    error?: string;
  };
  // 导航配置
  navigateTo?: {
    path: string;
    tab?: string;
    label: string;
  };
  // 前置条件检查
  prerequisites?: {
    stepId: string;
    check: (completedData: Record<string, unknown>) => boolean;
    errorMessage: string;
    navigateTo?: {
      path: string;
      tab?: string;
      label: string;
    };
  }[];
}

interface FinalConfig {
  title: string;
  genre: string;
  duration: string;
  aspectRatio: string;
  resolution: string;
  coreConflict: string;
  characters: Array<{
    id: string;
    name: string;
    gender: string;
    age: number;
    faceShape: string;
    hairstyle: string;
    clothing: string;
    skinTone: string;
    temperament: string;
    microActions: string[];
    emotionRules: {
      calm: number;
      happy: number;
      aggrieved: number;
      angry: number;
    };
  }>;
  storyboards: Array<{
    id: string;
    sequence: number;
    time: string;
    shotType: string;
    characters: string[];
    emotion: string;
    visualDescription: string;
    dialogue: {
      content: string;
      emotion: string;
      speaker: string;
      speechRate: string;
      isOffScreen: boolean;
    } | string; // 支持对象和字符串两种格式
    dialogues?: Array<{
      content: string;
      emotion: string;
      speaker: string;
      speechRate?: string;
      isOffScreen?: boolean;
    }>; // 新格式：多句对话数组
    soundEffects: string;
    bgm: string;
  }>;
  // 全剧集分镜数据
  allEpisodesStoryboards?: Array<{
    episodeNumber: number;
    title: string;
    storyboards: unknown[];
  }>;
  // 场景照数据
  sceneImages?: unknown[];
  consistencyRules: {
    character: { description: string; rules: string[] };
    visual: { description: string; rules: string[] };
    audio: { description: string; rules: string[] };
  };
  rhythmAnchors: Array<{ time: string; event: string }>;
  generatedAt: string;
  platform: string;
}

// 题材分类配置
const GENRE_CATEGORIES = {
  romance: {
    label: '情感与恋爱类',
    genres: [
      { id: 'ba-zong-tian-chong', label: '霸总甜宠', desc: '高富帅与平凡女主' },
      { id: 'nue-lian-zhui-qi', label: '虐恋追妻', desc: '前期虐心后期追妻' },
      { id: 'xian-hou-lian-ai', label: '先婚后爱', desc: '契约婚姻真香定律' },
    ],
  },
  counterattack: {
    label: '逆袭与成长类',
    genres: [
      { id: 'chong-sheng-ni-xi', label: '重生逆袭', desc: '重生复仇、打脸上位' },
      { id: 'zui-xu-ni-xi', label: '赘婿逆袭', desc: '入赘受辱逆袭翻盘' },
      { id: 'zhi-chang-ni-xi', label: '职场逆袭', desc: '打工人反击上位' },
    ],
  },
  power: {
    label: '爽感与权谋类',
    genres: [
      { id: 'zhan-shen-long-wang', label: '战神/龙王', desc: '隐世强者曝光震惊' },
      { id: 'shen-fen-cuo-wei', label: '身份错位', desc: '真假千金身份逆转' },
    ],
  },
  suspense: {
    label: '悬疑与脑洞类',
    genres: [
      { id: 'xuan-yi-tan-an', label: '悬疑探案', desc: '层层解谜、关键反转' },
      { id: 'gu-zhuang-xian-xia', label: '古装仙侠', desc: '仙侠世界、玄幻冒险' },
    ],
  },
  special: {
    label: '特殊题材',
    genres: [
      { id: 'meng-chong-feng', label: '萌宠风', desc: '宠物拟人化、反差萌' },
      { id: 'jia-ting-lun-li', label: '家庭伦理', desc: '婆媳矛盾、财产纷争' },
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

const initialSteps: WorkflowStep[] = [
  {
    id: 'input',
    name: '用户输入',
    description: '接收题材、核心冲突、人物数量',
    icon: FileText,
    status: 'pending',
    progress: 0,
    estimatedTime: 5,
    statusMessages: {
      pending: '等待填写基本信息',
      inProgress: '正在验证输入...',
      completed: '基本信息已设置',
      error: '输入验证失败',
    },
    navigateTo: {
      path: '/drama',
      tab: 'overview',
      label: '剧本大纲',
    },
  },
  {
    id: 'character',
    name: '生成角色档案',
    description: '创建角色档案和多角度立绘（正面、侧面、动作）',
    icon: Users,
    status: 'pending',
    progress: 0,
    estimatedTime: 90,
    statusMessages: {
      pending: '等待生成角色档案',
      inProgress: '正在生成角色档案和立绘图片，预计需要1-2分钟...',
      completed: '角色档案和立绘已生成',
      error: '角色生成失败，请重试',
    },
    navigateTo: {
      path: '/drama',
      tab: 'artwork',
      label: '人物立绘',
    },
    prerequisites: [
      {
        stepId: 'input',
        check: (data) => !!(data.genre || data.title || data.conflict),
        errorMessage: '请先完成用户输入，设置题材和核心冲突',
        navigateTo: {
          path: '/drama',
          tab: 'overview',
          label: '剧本大纲',
        },
      },
    ],
  },
  {
    id: 'scene',
    name: '生成场景照',
    description: '生成固定场景图片（皇宫、公司、家等）',
    icon: Image,
    status: 'pending',
    progress: 0,
    estimatedTime: 60,
    statusMessages: {
      pending: '等待生成场景照',
      inProgress: '正在生成场景图片，预计需要1分钟左右...',
      completed: '场景照已生成',
      error: '场景照生成失败，请检查题材配置',
    },
    navigateTo: {
      path: '/drama',
      tab: 'artwork',
      label: '人物立绘',
    },
    prerequisites: [
      {
        stepId: 'input',
        check: (data) => !!(data.genre || data.title || data.conflict),
        errorMessage: '请先完成用户输入，设置题材和核心冲突后再生成场景照。点击下方按钮前往剧本大纲页面完善信息。',
        navigateTo: {
          path: '/drama',
          tab: 'overview',
          label: '剧本大纲',
        },
      },
    ],
  },
  {
    id: 'script',
    name: '生成剧本分镜',
    description: '生成分镜剧本',
    icon: Film,
    status: 'pending',
    progress: 0,
    estimatedTime: 60,
    statusMessages: {
      pending: '等待生成分镜剧本',
      inProgress: '正在生成剧本分镜，预计需要1分钟左右...',
      completed: '剧本分镜已生成',
      error: '剧本生成失败，请重试',
    },
    navigateTo: {
      path: '/drama',
      tab: 'episodes',
      label: '剧集管理',
    },
    prerequisites: [
      {
        stepId: 'character',
        check: (data) => {
          const characters = data.characters as Array<unknown> | undefined;
          return !!(characters && characters.length > 0);
        },
        errorMessage: '请先生成角色档案',
        navigateTo: {
          path: '/drama',
          tab: 'artwork',
          label: '人物立绘',
        },
      },
    ],
  },
  {
    id: 'reference',
    name: '生成参考图描述',
    description: '为角色生成参考图像描述（自动获取人物立绘和场景照提示词）',
    icon: Sparkles,
    status: 'pending',
    progress: 0,
    estimatedTime: 30,
    statusMessages: {
      pending: '等待生成参考图描述',
      inProgress: '正在生成参考图描述...',
      completed: '参考图描述已生成',
      error: '参考图生成失败，请重试',
    },
    navigateTo: {
      path: '/images',
      tab: undefined,
      label: '参考图片',
    },
    prerequisites: [
      {
        stepId: 'character',
        check: (data) => {
          const characters = data.characters as Array<unknown> | undefined;
          return !!(characters && characters.length > 0);
        },
        errorMessage: '请先生成角色档案',
        navigateTo: {
          path: '/drama',
          tab: 'artwork',
          label: '人物立绘',
        },
      },
      {
        stepId: 'scene',
        check: (data) => {
          const sceneImages = data.sceneImages as Array<unknown> | Record<string, unknown> | undefined;
          if (!sceneImages) return false;
          if (Array.isArray(sceneImages)) return sceneImages.length > 0;
          return Object.keys(sceneImages).length > 0;
        },
        errorMessage: '请先生成场景照',
        navigateTo: {
          path: '/drama',
          tab: 'artwork',
          label: '人物立绘',
        },
      },
    ],
  },
  {
    id: 'video',
    name: '生成视频片段',
    description: '生成分镜视频描述（自动获取每集分镜的视频提示词）',
    icon: Video,
    status: 'pending',
    progress: 0,
    estimatedTime: 45,
    statusMessages: {
      pending: '等待生成视频描述',
      inProgress: '正在生成视频描述，预计需要45秒左右...',
      completed: '视频描述已生成',
      error: '视频描述生成失败，请重试',
    },
    navigateTo: {
      path: '/videos',
      tab: undefined,
      label: '视频管理',
    },
    prerequisites: [
      {
        stepId: 'script',
        check: (data) => {
          const storyboards = data.storyboards as Array<unknown> | undefined;
          return !!(storyboards && storyboards.length > 0);
        },
        errorMessage: '请先生成剧本分镜',
        navigateTo: {
          path: '/drama',
          tab: 'episodes',
          label: '剧集管理',
        },
      },
    ],
  },
  {
    id: 'voice_config',
    name: '生成配音配置',
    description: '为每个角色生成直接配音提示词',
    icon: Volume2,
    status: 'pending',
    progress: 0,
    estimatedTime: 30,
    statusMessages: {
      pending: '等待生成配音配置',
      inProgress: '正在生成配音配置...',
      completed: '配音配置已生成',
      error: '配音配置生成失败，请重试',
    },
    navigateTo: {
      path: '/audio',
      tab: undefined,
      label: '配音配置',
    },
    prerequisites: [
      {
        stepId: 'character',
        check: (data) => {
          const characters = data.characters as Array<unknown> | undefined;
          return !!(characters && characters.length > 0);
        },
        errorMessage: '请先生成角色档案',
        navigateTo: {
          path: '/drama',
          tab: 'artwork',
          label: '人物立绘',
        },
      },
    ],
  },
  {
    id: 'audio',
    name: '生成音频素材',
    description: '为人物和场景生成最佳的音频、BGM、环境音提示词',
    icon: Volume2,
    status: 'pending',
    progress: 0,
    estimatedTime: 40,
    statusMessages: {
      pending: '等待生成音频素材',
      inProgress: '正在生成音频素材描述...',
      completed: '音频素材描述已生成',
      error: '音频素材生成失败，请重试',
    },
    navigateTo: {
      path: '/audio',
      tab: undefined,
      label: '音频素材',
    },
    prerequisites: [
      {
        stepId: 'script',
        check: (data) => {
          const storyboards = data.storyboards as Array<unknown> | undefined;
          return !!(storyboards && storyboards.length > 0);
        },
        errorMessage: '请先生成剧本分镜',
        navigateTo: {
          path: '/drama',
          tab: 'episodes',
          label: '剧集管理',
        },
      },
    ],
  },
  {
    id: 'edit',
    name: '剪辑合成方案',
    description: '生成最佳视频合成提示和配置优化',
    icon: Scissors,
    status: 'pending',
    progress: 0,
    estimatedTime: 20,
    statusMessages: {
      pending: '等待生成剪辑方案',
      inProgress: '正在生成剪辑合成方案...',
      completed: '剪辑合成方案已生成',
      error: '剪辑方案生成失败，请重试',
    },
    navigateTo: {
      path: '/editor',
      tab: undefined,
      label: '剪辑合成',
    },
    prerequisites: [
      {
        stepId: 'video',
        check: (data) => {
          // 检查是否有视频相关数据
          return !!(data.storyboards || data.videoPrompts);
        },
        errorMessage: '请先生成视频片段描述',
        navigateTo: {
          path: '/videos',
          tab: undefined,
          label: '视频管理',
        },
      },
    ],
  },
  {
    id: 'quality',
    name: '质量自检',
    description: '检查一致性',
    icon: Shield,
    status: 'pending',
    progress: 0,
    estimatedTime: 15,
    statusMessages: {
      pending: '等待进行质量检查',
      inProgress: '正在进行一致性检查...',
      completed: '质量检查通过',
      error: '质量检查发现问题，请检查配置',
    },
    navigateTo: {
      path: '/config',
      tab: undefined,
      label: '质量检查',
    },
    prerequisites: [
      {
        stepId: 'script',
        check: (data) => {
          const storyboards = data.storyboards as Array<unknown> | undefined;
          return !!(storyboards && storyboards.length > 0);
        },
        errorMessage: '请先生成剧本分镜',
        navigateTo: {
          path: '/drama',
          tab: 'episodes',
          label: '剧集管理',
        },
      },
    ],
  },
  {
    id: 'output',
    name: '输出最终配置',
    description: '汇总生成完整配置',
    icon: Download,
    status: 'pending',
    progress: 0,
    estimatedTime: 10,
    statusMessages: {
      pending: '等待输出最终配置',
      inProgress: '正在汇总配置...',
      completed: '配置已生成完毕',
      error: '配置输出失败，请重试',
    },
    navigateTo: {
      path: '/drama',
      tab: 'overview',
      label: '剧本大纲',
    },
    prerequisites: [
      {
        stepId: 'character',
        check: (data) => {
          const characters = data.characters as Array<unknown> | undefined;
          return !!(characters && characters.length > 0);
        },
        errorMessage: '请先完成角色档案生成',
        navigateTo: {
          path: '/drama',
          tab: 'artwork',
          label: '人物立绘',
        },
      },
      {
        stepId: 'script',
        check: (data) => {
          const storyboards = data.storyboards as Array<unknown> | undefined;
          return !!(storyboards && storyboards.length > 0);
        },
        errorMessage: '请先完成剧本分镜生成',
        navigateTo: {
          path: '/drama',
          tab: 'episodes',
          label: '剧集管理',
        },
      },
    ],
  },
];

export default function WorkflowPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [totalProgress, setTotalProgress] = useState(0);
  const [completedData, setCompletedData] = useState<Record<string, unknown>>({});
  const [finalConfig, setFinalConfig] = useState<FinalConfig | null>(null);

  // 短剧选择
  const [seriesList, setSeriesList] = useState<Array<{
    id: string;
    title: string;
    genre: string;
    style: string;
    core_conflict: string;
    description: string;
    total_episodes: number;
  }>>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  
  // 步骤详情展开状态
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  
  // 步骤输出数据存储（用于点击查看详情）
  const [stepOutputs, setStepOutputs] = useState<Record<string, { output: string; data: unknown; completedAt: Date }>>({});
  
  // 工作流历史
  const [workflowHistory, setWorkflowHistory] = useState<Array<{
    id: string;
    executedAt: string;
    title: string;
    input: Record<string, unknown>;
    result: Record<string, unknown>;
  }>>([]);

  // 删除工作流历史记录
  const deleteHistoryEntry = async (historyId: string) => {
    if (!selectedSeriesId) return;
    
    try {
      // 从数据库删除历史记录
      const response = await fetch(`/api/workflow/history/${selectedSeriesId}/${historyId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      
      if (response.ok) {
        // 从本地状态中移除
        setWorkflowHistory(prev => prev.filter(h => h.id !== historyId));
      }
    } catch (error) {
      console.error('删除历史记录失败:', error);
    }
  };

  // 用户输入
  const [userInput, setUserInput] = useState({
    title: '',
    genre: 'ba-zong-tian-chong',
    conflict: '',
    style: '',
    totalEpisodes: 1,
    characterCount: 0, // 0表示AI自动决定
    coreConflictTypes: [] as CoreConflictTypeId[],
  });
  const [showInputForm, setShowInputForm] = useState(true);
  const [copied, setCopied] = useState(false);

  // 加载短剧列表
  const loadSeriesList = useCallback(async () => {
    setLoadingSeries(true);
    try {
      const response = await fetch('/api/drama/series?limit=50', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setSeriesList(data.series);
      }
    } catch (error) {
      console.error('加载短剧列表失败:', error);
    } finally {
      setLoadingSeries(false);
    }
  }, []);

  useEffect(() => {
    loadSeriesList();
  }, [loadSeriesList]);

  // 选择短剧后自动填充配置
  const handleSeriesSelect = async (seriesId: string) => {
    setSelectedSeriesId(seriesId);
    
    if (seriesId === '') {
      // 清空选择，重置表单和已完成数据
      setUserInput({
        title: '',
        genre: 'ba-zong-tian-chong',
        conflict: '',
        style: '',
        totalEpisodes: 1,
        characterCount: 0,
        coreConflictTypes: [],
      });
      setCompletedData({});
      setConfigLoaded(false);
      // 重置步骤状态
      setSteps(initialSteps);
      return;
    }
    
    const selected = seriesList.find(s => s.id === seriesId);
    if (selected) {
      // 通过中文 label 反向查找 genre id
      const genreFromDb = selected.genre || '';
      const matchedGenre = ALL_GENRES.find(g => g.label === genreFromDb);
      const genreId = matchedGenre?.id || 'ba-zong-tian-chong';
      
      // 通过中文 label 反向查找 style id
      const styleFromDb = selected.style || '';
      const matchedStyle = STYLE_OPTIONS.find(s => s.label === styleFromDb);
      const styleId = matchedStyle?.id || '';
      
      setUserInput({
        title: selected.title || '',
        genre: genreId,
        conflict: selected.core_conflict || '',
        style: styleId,
        totalEpisodes: selected.total_episodes || 1,
        characterCount: 0, // 将在加载配置后更新
        coreConflictTypes: [], // 将在加载配置后更新
      });
      
      // 获取完整配置
      setLoadingConfig(true);
      try {
        const response = await fetch(`/api/workflow/config/${seriesId}`, {
          headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        });
        const data = await response.json();
        
        if (data.success && data.config) {
          const config = data.config;
          setConfigLoaded(true);
          
          // 加载工作流历史
          if (config.workflowHistory && Array.isArray(config.workflowHistory)) {
            setWorkflowHistory(config.workflowHistory);
          }
          
          // 更新角色数量 - 匹配选项值 [0, 2, 3, 4, 5, 6]
          const charCount = config.characters?.length || 0;
          let displayCharCount = 0;
          if (charCount >= 6) {
            displayCharCount = 6; // "6人+"
          } else if (charCount >= 5) {
            displayCharCount = 5;
          } else if (charCount >= 4) {
            displayCharCount = 4;
          } else if (charCount >= 3) {
            displayCharCount = 3;
          } else if (charCount >= 2) {
            displayCharCount = 2;
          }
          
          // 直接使用数据库存储的冲突类型数组
          const conflictTypes = config.coreConflictTypes || [];
          
          setUserInput(prev => ({
            ...prev,
            characterCount: displayCharCount,
            coreConflictTypes: conflictTypes as CoreConflictTypeId[],
          }));
          
          // 填充已完成数据
          const newCompletedData: Record<string, unknown> = {};
          
          if (config.characters && config.characters.length > 0) {
            newCompletedData.characters = config.characters;
          }
          
          if (config.sceneImages && config.sceneImages.length > 0) {
            newCompletedData.sceneImages = config.sceneImages;
          }
          
          if (config.episodesWithStoryboards && config.episodesWithStoryboards.length > 0) {
            // 取第一个有剧本的剧集
            newCompletedData.storyboards = config.episodesWithStoryboards[0].storyboards;
            newCompletedData.title = config.title;
          }
          
          setCompletedData(newCompletedData);
          
          // 更新步骤状态 - 标记已完成的步骤
          // 只要有数据就标记为完成，不需要检查图片
          setSteps(prev => prev.map(step => {
            // 角色步骤：有角色数据就标记完成
            if (step.id === 'character' && config.workflowStatus.hasCharacters) {
              const imageCount = config.charactersWithImagesCount || 0;
              return { 
                ...step, 
                status: 'completed' as const, 
                progress: 100, 
                output: `已加载 ${config.characters.length} 个角色${imageCount > 0 ? `，${imageCount}个有立绘` : ''}` 
              };
            }
            // 场景步骤：有场景图片就标记完成
            if (step.id === 'scene' && config.workflowStatus.hasSceneImages) {
              return { 
                ...step, 
                status: 'completed' as const, 
                progress: 100, 
                output: `已加载 ${config.sceneImagesCount} 个场景照` 
              };
            }
            if (step.id === 'script' && config.workflowStatus.hasStoryboards) {
              const completedEpisodes = config.workflowStatus.completedEpisodes || 0;
              const totalEpisodes = config.workflowStatus.totalEpisodes || 1;
              const isAllCompleted = completedEpisodes >= totalEpisodes;
              return { 
                ...step, 
                status: isAllCompleted ? 'completed' as const : 'pending' as const,
                progress: isAllCompleted ? 100 : Math.round((completedEpisodes / totalEpisodes) * 100), 
                output: isAllCompleted 
                  ? `已加载全部 ${totalEpisodes} 集剧本`
                  : `已加载 ${completedEpisodes}/${totalEpisodes} 集剧本（需继续生成）`
              };
            }
            return step;
          }));
        }
      } catch (error) {
        console.error('获取短剧配置失败:', error);
        setConfigLoaded(false);
      } finally {
        setLoadingConfig(false);
      }
    }
  };

  // 执行单个步骤
  const executeStep = useCallback(async (stepIndex: number) => {
    const step = steps[stepIndex];
    
    // 前置条件检查
    if (step.prerequisites && step.prerequisites.length > 0) {
      for (const prereq of step.prerequisites) {
        if (!prereq.check(completedData)) {
          // 显示错误提示
          toast.error(prereq.errorMessage, {
            action: prereq.navigateTo ? {
              label: `前往${prereq.navigateTo.label}`,
              onClick: () => {
                const url = selectedSeriesId 
                  ? `${prereq.navigateTo!.path}?seriesId=${selectedSeriesId}${prereq.navigateTo!.tab ? `&tab=${prereq.navigateTo!.tab}` : ''}`
                  : prereq.navigateTo!.path;
                router.push(url);
              }
            } : undefined,
            duration: 5000,
          });
          
          // 标记步骤为错误状态
          setSteps(prev => prev.map((s, i) => 
            i === stepIndex 
              ? { ...s, status: 'error' as const, error: prereq.errorMessage }
              : s
          ));
          return false;
        }
      }
    }
    
    setSteps(prev => prev.map((s, i) => 
      i === stepIndex 
        ? { ...s, status: 'in_progress' as const, startedAt: new Date(), progress: 0 }
        : s
    ));

    try {
      const progressInterval = setInterval(() => {
        setSteps(prev => prev.map((s, i) => 
          i === stepIndex 
            ? { ...s, progress: Math.min(s.progress + Math.random() * 15 + 5, 95) }
            : s
        ));
      }, 800);

      let output = '';
      let stepData: unknown = null; // 用于保存步骤数据，避免状态更新时序问题
      
      // 获取选中的短剧信息
      const selectedSeries = selectedSeriesId ? seriesList.find(s => s.id === selectedSeriesId) : null;
      
      // 获取题材中文名称
      const genreLabel = ALL_GENRES.find(g => g.id === userInput.genre)?.label || userInput.genre;
      const styleLabel = STYLE_OPTIONS.find(s => s.id === userInput.style)?.label || userInput.style;

      // 辅助函数：检查API响应是否有错误
      const checkApiResponse = (data: Record<string, unknown>, response: Response) => {
        if (!response.ok) {
          const errorMsg = typeof data.error === 'string' ? data.error : `请求失败: ${response.status}`;
          throw new Error(errorMsg);
        }
        if (data.error) {
          const errorMsg = typeof data.error === 'string' ? data.error : '未知错误';
          throw new Error(errorMsg);
        }
      };

      if (step.id === 'character') {
        const response = await fetch('/api/generate-characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
          body: JSON.stringify({
            genre: genreLabel,
            conflict: userInput.conflict,
            characterCount: userInput.characterCount,
            coreConflictTypes: userInput.coreConflictTypes,
            seriesId: selectedSeriesId || undefined,
            seriesTitle: selectedSeries?.title || userInput.title,
            generateImages: true,
            style: styleLabel || '现代'
          })
        });
        const data = await response.json();
        checkApiResponse(data, response);
        // 显示更有意义的输出信息
        const charCount = data.characters?.length || 0;
        const imagesCount = data.characters?.reduce((sum: number, c: { referenceImages?: unknown[] }) => 
          sum + (c.referenceImages ? Object.keys(c.referenceImages).length : 0), 0) || 0;
        output = `成功生成 ${charCount} 个角色档案${imagesCount > 0 ? `，共 ${imagesCount} 张立绘` : ''}`;
        stepData = data.characters; // 直接使用 API 返回的数据
        setCompletedData(prev => ({ ...prev, characters: data.characters }));
      } else if (step.id === 'scene') {
        // 场景照生成 - 添加超时处理和更好的进度反馈
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分钟超时
        
        // 更新步骤状态，显示具体进度
        setSteps(prev => prev.map((s, i) => 
          i === stepIndex 
            ? { ...s, status: 'in_progress' as const, progress: 10, output: '正在分析题材和风格，准备生成场景...' }
            : s
        ));
        
        try {
          // 模拟进度更新（因为API不支持流式返回）
          const progressInterval = setInterval(() => {
            setSteps(prev => prev.map((s, i) => {
              if (i === stepIndex && s.progress < 90) {
                const messages = [
                  '正在分析题材和风格...',
                  '正在匹配预设场景模板...',
                  '正在生成场景图片...',
                  '正在上传图片到存储...',
                  '正在保存场景配置...'
                ];
                const msgIndex = Math.min(Math.floor(s.progress / 20), messages.length - 1);
                return { ...s, progress: Math.min(s.progress + 8, 90), output: messages[msgIndex] };
              }
              return s;
            }));
          }, 2000);
          
          const response = await fetch('/api/scenes/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
            body: JSON.stringify({
              seriesId: selectedSeriesId || undefined,
              genre: genreLabel,
              style: styleLabel || '现代',
            }),
            signal: controller.signal,
          });
          
          clearInterval(progressInterval);
          clearTimeout(timeoutId);
          
          const data = await response.json();
          checkApiResponse(data, response);
          
          // 检查是否有场景生成成功
          const sceneCount = Object.keys(data.sceneImages || {}).length;
          
          if (sceneCount === 0) {
            // 如果没有生成任何场景，提示用户完善场景信息
            throw new Error('场景照生成失败，请前往剧本大纲页面完善场景信息后再试');
          }
          
          output = `成功生成 ${sceneCount} 个场景照`;
          stepData = data.sceneImages;
          setCompletedData(prev => ({ ...prev, sceneImages: data.sceneImages }));
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('场景照生成超时（超过3分钟），请稍后重试或前往剧本大纲页面手动配置场景');
          }
          throw fetchError;
        }
      } else if (step.id === 'script') {
        const response = await fetch('/api/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
          body: JSON.stringify({ 
            genre: genreLabel,
            conflict: userInput.conflict,
            style: styleLabel,
            totalEpisodes: userInput.totalEpisodes,
            coreConflictTypes: userInput.coreConflictTypes,
            characters: completedData.characters || [],
            seriesId: selectedSeriesId || undefined,
            seriesTitle: selectedSeries?.title || userInput.title
          })
        });
        const data = await response.json();
        checkApiResponse(data, response);
        // 显示更有意义的输出信息
        const storyboardCount = data.storyboards?.length || 0;
        const totalDuration = data.storyboards?.reduce((sum: number, sb: { duration?: number }) => 
          sum + (sb.duration || 8), 0) || 0;
        const title = data.title || '未命名';
        output = `《${title}》-${storyboardCount}个分镜，总时长${totalDuration}秒`;
        stepData = data.storyboards; // 直接使用 API 返回的数据
        setCompletedData(prev => ({ ...prev, storyboards: data.storyboards, title: data.title }));
      } else if (step.id === 'input') {
        output = `题材: ${genreLabel}，风格: ${styleLabel || '默认'}，${userInput.totalEpisodes}集`;
        stepData = userInput;
      } else if (step.id === 'output') {
        // 最终步骤：生成完整配置
        const response = await fetch('/api/workflow/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
          body: JSON.stringify({ 
            input: userInput, 
            context: completedData,
            seriesId: selectedSeriesId || undefined,
            seriesTitle: selectedSeries?.title
          })
        });
        const data = await response.json();
        // 显示更有意义的输出信息
        const config = data.config;
        output = `配置已保存：${config?.characters?.length || 0}个角色，${config?.storyboards?.length || 0}个分镜`;
        stepData = data.config; // 直接使用 API 返回的数据
        if (data.config) {
          setFinalConfig(data.config);
        }
      } else {
        const response = await fetch('/api/workflow/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
          body: JSON.stringify({ 
            step: step.id, 
            input: userInput,
            context: completedData,
            seriesId: selectedSeriesId || undefined,
            seriesTitle: selectedSeries?.title
          })
        });
        const data = await response.json();
        if (typeof data.output === 'string') {
          output = data.output;
        } else if (data.output) {
          output = JSON.stringify(data.output, null, 2);
        } else {
          output = JSON.stringify(data, null, 2);
        }
        stepData = data.output || data;
      }

      clearInterval(progressInterval);

      // 保存步骤输出数据（使用变量 stepData，避免状态更新时序问题）
      setStepOutputs(prev => ({
        ...prev,
        [steps[stepIndex].id]: {
          output,
          data: stepData,
          completedAt: new Date()
        }
      }));

      setSteps(prev => prev.map((s, i) => 
        i === stepIndex 
          ? { ...s, status: 'completed' as const, progress: 100, completedAt: new Date(), output }
          : s
      ));

      setTotalProgress(((stepIndex + 1) / steps.length) * 100);

      return true;
    } catch (error) {
      setSteps(prev => prev.map((s, i) => 
        i === stepIndex 
          ? { 
              ...s, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : '执行失败' 
            }
          : s
      ));
      return false;
    }
  }, [steps.length, userInput, completedData, selectedSeriesId, seriesList]);

  // 开始工作流
  const startWorkflow = async () => {
    // 至少需要题材类型
    if (!userInput.genre) {
      alert('请选择题材类型');
      return;
    }
    
    setIsRunning(true);
    setShowInputForm(false);
    
    // 找到第一个未完成的步骤
    const firstPendingIndex = steps.findIndex(s => s.status === 'pending');
    if (firstPendingIndex >= 0) {
      setCurrentStepIndex(firstPendingIndex);
    } else {
      // 所有步骤都已完成
      setIsRunning(false);
      setTotalProgress(100);
    }
  };

  // 监听步骤变化
  useEffect(() => {
    if (!isRunning || currentStepIndex < 0 || currentStepIndex >= steps.length) {
      return;
    }

    const currentStep = steps[currentStepIndex];
    
    if (currentStep.status === 'completed') {
      setTimeout(() => {
        if (currentStepIndex + 1 < steps.length) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
          setIsRunning(false);
          // 工作流完成，清除sessionStorage
          sessionStorage.removeItem('workflow_state');
        }
      }, 500);
      return;
    }

    if (currentStep.status === 'pending') {
      executeStep(currentStepIndex);
    }
  }, [isRunning, currentStepIndex, steps, executeStep]);

  // 保存工作流状态到 sessionStorage（用于跳转后恢复）
  useEffect(() => {
    if (!showInputForm && isRunning) {
      const state = {
        selectedSeriesId,
        userInput,
        steps: steps.map(s => ({
          id: s.id,
          status: s.status,
          progress: s.progress,
          output: s.output,
          error: s.error,
        })),
        currentStepIndex,
        totalProgress,
        completedData,
      };
      sessionStorage.setItem('workflow_state', JSON.stringify(state));
    }
  }, [showInputForm, isRunning, steps, currentStepIndex, totalProgress, completedData, selectedSeriesId, userInput]);

  // 恢复工作流状态
  useEffect(() => {
    const savedState = sessionStorage.getItem('workflow_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.selectedSeriesId) {
          setSelectedSeriesId(state.selectedSeriesId);
        }
        if (state.userInput) {
          setUserInput(state.userInput);
        }
        if (state.steps && Array.isArray(state.steps)) {
          setSteps(prev => prev.map((s, i) => {
            const saved = state.steps[i];
            if (saved) {
              return {
                ...s,
                status: saved.status,
                progress: saved.progress,
                output: saved.output,
                error: saved.error,
              };
            }
            return s;
          }));
        }
        if (state.completedData) {
          setCompletedData(state.completedData);
        }
        // 如果有正在进行的步骤，继续执行
        const inProgressStep = state.steps?.findIndex((s: { status: string }) => s.status === 'in_progress');
        if (inProgressStep >= 0) {
          setShowInputForm(false);
          setIsRunning(true);
          setCurrentStepIndex(inProgressStep);
        } else if (state.currentStepIndex >= 0) {
          setShowInputForm(false);
          setCurrentStepIndex(state.currentStepIndex);
        }
        
        // 清除已保存的状态
        if (!state.isRunning) {
          sessionStorage.removeItem('workflow_state');
        }
      } catch (e) {
        console.error('恢复工作流状态失败:', e);
      }
    }
  }, []); // 仅在组件挂载时执行一次

  // 重试失败的步骤
  const retryStep = (stepIndex: number) => {
    // 重置步骤状态为 pending
    setSteps(prev => prev.map((s, i) => 
      i === stepIndex 
        ? { ...s, status: 'pending' as const, progress: 0, error: undefined }
        : s
    ));
    
    // 如果当前没有在运行，开始运行
    if (!isRunning) {
      setIsRunning(true);
      setCurrentStepIndex(stepIndex);
    }
  };

  // 重置工作流
  const resetWorkflow = () => {
    setIsRunning(false);
    setCurrentStepIndex(-1);
    setTotalProgress(0);
    setSteps(initialSteps);
    setCompletedData({});
    setFinalConfig(null);
    setShowInputForm(true);
    setSelectedSeriesId('');
    setUserInput({
      title: '',
      genre: 'ba-zong-tian-chong',
      conflict: '',
      style: '',
      totalEpisodes: 1,
      characterCount: 0,
      coreConflictTypes: [],
    });
  };

  // 生成中文剧本配置文档（Markdown格式）
  const generateChineseConfigDocument = (): string => {
    if (!finalConfig) return '';

    const genreLabel = ALL_GENRES.find(g => g.id === userInput.genre)?.label || userInput.genre;
    const styleLabel = STYLE_OPTIONS.find(s => s.id === userInput.style)?.label || userInput.style;
    const totalEpisodes = userInput.totalEpisodes || 1;

    let doc = `# 《${finalConfig.title}》短剧配置方案

> 生成时间：${new Date().toLocaleString('zh-CN')}
> 生成平台：扣子(Coze) AI应用开发平台

---

## 一、剧本基础信息

### 1.1 基本信息

| 项目 | 内容 |
|------|------|
| 短剧名称 | ${finalConfig.title} |
| 题材类型 | ${genreLabel} |
| 剧情风格 | ${styleLabel || '未设定'} |
| 集数 | ${totalEpisodes}集 |
| 视频时长 | ${finalConfig.duration || '300秒'}/集 |
| 总时长 | 约${(parseInt(finalConfig.duration || '300') * totalEpisodes / 60).toFixed(0)}分钟 |
| 画幅比例 | ${finalConfig.aspectRatio || '9:16'} |
| 分辨率 | ${finalConfig.resolution || '1080P'} |
| 目标平台 | 抖音/快手/视频号 |

### 1.2 核心冲突

**冲突类型：** ${userInput.coreConflictTypes?.map((id: string) => {
  const conflict = CORE_CONFLICT_TYPES.find(c => c.id === id);
  return conflict?.label || id;
}).join('、') || '未设定'}

**核心冲突描述：**
${finalConfig.coreConflict || userInput.conflict || '未设定'}

### 1.3 故事概要

**题材风格：** ${genreLabel}${styleLabel ? ` - ${styleLabel}` : ''}

**故事定位：** 面向短视频平台用户，节奏紧凑，情绪张力强，适合碎片化观看。

---

## 二、角色档案与立绘提示词

`;

    // 角色档案 - 包含完整的立绘提示词
    const characters = completedData.characters || finalConfig.characters || [];
    if (characters && Array.isArray(characters) && characters.length > 0) {
      characters.forEach((char: Record<string, unknown>, index: number) => {
        const gender = char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : (char.gender as string) || '未设定';
        
        doc += `### 2.${index + 1} 角色：${char.name || '未命名'}\n\n`;
        
        // 基本信息表格
        doc += `#### 基本信息\n\n`;
        doc += `| 属性 | 描述 |\n|------|------|\n`;
        doc += `| 角色定位 | ${char.role || (index === 0 ? '主角' : index === 1 ? '反派' : '配角')} |\n`;
        doc += `| 性别 | ${gender} |\n`;
        doc += `| 年龄 | ${char.age || '未设定'}岁 |\n`;
        doc += `| 身份背景 | ${char.background || char.identity || '未设定'} |\n`;
        doc += `| 性格特点 | ${char.personality || char.temperament || '未设定'} |\n`;
        
        doc += `\n#### 外貌特征\n\n`;
        doc += `| 属性 | 描述 |\n|------|------|\n`;
        doc += `| 脸型 | ${char.faceShape || '标准脸型'} |\n`;
        doc += `| 发型 | ${char.hairstyle || '未设定'} |\n`;
        doc += `| 发色 | ${char.hairColor || '黑色'} |\n`;
        doc += `| 眼睛 | ${char.eyes || '深色眼眸'} |\n`;
        doc += `| 肤色 | ${char.skinTone || '健康肤色'} |\n`;
        doc += `| 身材 | ${char.bodyType || '匀称'} |\n`;
        
        doc += `\n#### 服装造型\n\n`;
        doc += `| 属性 | 描述 |\n|------|------|\n`;
        doc += `| 主要服装 | ${char.clothing || '未设定'} |\n`;
        doc += `| 服装颜色 | ${char.clothingColor || '与角色气质相符'} |\n`;
        doc += `| 配饰 | ${char.accessories || '简约配饰'} |\n`;
        
        doc += `\n#### 角色性格与习惯\n\n`;
        doc += `**气质特点：** ${char.temperament || '未设定'}\n\n`;
        
        if (char.microActions && Array.isArray(char.microActions)) {
          doc += `**微动作习惯：**\n`;
          char.microActions.forEach((action: string) => {
            doc += `- ${action}\n`;
          });
          doc += `\n`;
        }
        
        if (char.signaturePose) {
          doc += `**标志性动作：** ${char.signaturePose}\n\n`;
        }
        
        if (char.emotionRules) {
          const rules = char.emotionRules as Record<string, number>;
          doc += `**情绪表达规则：**\n\n`;
          doc += `| 情绪 | 强度 | 表现方式 |\n|------|------|----------|\n`;
          doc += `| 平静 | ${rules.calm || 30}% | 表情自然，眼神平和 |\n`;
          doc += `| 开心 | ${rules.happy || 50}% | 嘴角上扬，眼神明亮 |\n`;
          doc += `| 委屈 | ${rules.aggrieved || 45}% | 眼眶微红，嘴角下垂 |\n`;
          doc += `| 生气 | ${rules.angry || 65}% | 眉头紧锁，眼神锐利 |\n`;
          doc += `\n`;
        }
        
        // 人物立绘提示词（核心内容）
        doc += `#### 🔥 人物立绘生成提示词\n\n`;
        doc += `> 以下提示词可直接用于AI生图工具生成角色立绘\n\n`;
        
        // 基础风格前缀
        const baseStyle = `【风格要求】写实风格，真实人物摄影效果，真实皮肤质感，真实服装材质，真实光影效果，禁止动漫风格、漫画风格、二次元风格、卡通风格`;
        const qualitySuffix = `，2K高清画质，电影级光影效果，专业摄影构图`;
        
        // 正面照提示词
        doc += `**① 正面全身照提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `${baseStyle}，高质量人物肖像摄影，一位${char.age || '25'}岁${gender}角色，名叫${char.name || '角色'}，`;
        if (char.faceShape) doc += `脸型${char.faceShape}，`;
        if (char.hairstyle) doc += `发型${char.hairstyle}，`;
        if (char.clothing) doc += `穿着${char.clothing}，`;
        if (char.temperament) doc += `${char.temperament}气质，`;
        doc += `正面全身照，面向镜头，清晰展示面部特征和服装细节`;
        doc += `${qualitySuffix}\n`;
        doc += `\`\`\`\n\n`;
        
        // 背面照提示词
        doc += `**② 背面全身照提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `${baseStyle}，高质量人物肖像摄影，一位${char.age || '25'}岁${gender}角色，名叫${char.name || '角色'}，`;
        if (char.hairstyle) doc += `发型${char.hairstyle}，`;
        if (char.clothing) doc += `穿着${char.clothing}，`;
        doc += `背面全身照，背对镜头，展示发型背面和服装背部细节`;
        doc += `${qualitySuffix}\n`;
        doc += `\`\`\`\n\n`;
        
        // 侧面照提示词
        doc += `**③ 侧面全身照提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `${baseStyle}，高质量人物肖像摄影，一位${char.age || '25'}岁${gender}角色，名叫${char.name || '角色'}，`;
        if (char.faceShape) doc += `脸型${char.faceShape}，`;
        if (char.hairstyle) doc += `发型${char.hairstyle}，`;
        if (char.clothing) doc += `穿着${char.clothing}，`;
        if (char.temperament) doc += `${char.temperament}气质，`;
        doc += `侧面全身照，侧身站立，展示侧脸轮廓和身材曲线`;
        doc += `${qualitySuffix}\n`;
        doc += `\`\`\`\n\n`;
        
        // 动作形象提示词
        doc += `**④ 标志性动作形象提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `${baseStyle}，高质量人物肖像摄影，一位${char.age || '25'}岁${gender}角色，名叫${char.name || '角色'}，`;
        if (char.clothing) doc += `穿着${char.clothing}，`;
        if (char.signaturePose) {
          doc += `${char.signaturePose}，`;
        } else {
          doc += `展示标志性动作，`;
        }
        if (char.temperament) doc += `${char.temperament}气质，`;
        doc += `动态姿势，表情生动，画面有张力`;
        doc += `${qualitySuffix}\n`;
        doc += `\`\`\`\n\n`;
        
        // 表情特写提示词
        doc += `**⑤ 表情特写提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `${baseStyle}，高质量人物肖像特写，一位${char.age || '25'}岁${gender}角色，名叫${char.name || '角色'}，`;
        if (char.faceShape) doc += `脸型${char.faceShape}，`;
        if (char.hairstyle) doc += `发型${char.hairstyle}，`;
        doc += `面部特写，展示细腻的面部表情和眼神，肤质真实细腻`;
        doc += `${qualitySuffix}\n`;
        doc += `\`\`\`\n\n`;
        
        doc += `---\n\n`;
      });
    } else {
      doc += `*暂无角色档案*\n\n---\n\n`;
    }

    // 场景配置 - 包含完整的场景提示词
    doc += `## 三、场景配置与场景图提示词\n\n`;
    
    // 优先使用 finalConfig 中的场景照数据（包含完整提示词）
    const sceneImages = finalConfig.sceneImages || completedData.sceneImages || [];
    if (sceneImages && Array.isArray(sceneImages) && sceneImages.length > 0) {
      // 如果是数组格式
      sceneImages.forEach((scene: Record<string, unknown>, index: number) => {
        const sceneName = scene.name || scene.sceneName || scene.title || `场景${index + 1}`;
        doc += `### 3.${index + 1} 场景：${sceneName}\n\n`;
        
        doc += `#### 场景信息\n\n`;
        doc += `| 属性 | 描述 |\n|------|------|\n`;
        doc += `| 场景名称 | ${sceneName} |\n`;
        doc += `| 场景类型 | ${scene.type || scene.sceneType || '室内'} |\n`;
        if (scene.description || scene.sceneDescription) {
          doc += `| 场景描述 | ${scene.description || scene.sceneDescription} |\n`;
        }
        if (scene.time) {
          doc += `| 时间设定 | ${scene.time} |\n`;
        }
        if (scene.weather) {
          doc += `| 天气氛围 | ${scene.weather} |\n`;
        }
        if (scene.location) {
          doc += `| 地点 | ${scene.location} |\n`;
        }
        
        // 场景图提示词
        doc += `\n#### 🔥 场景图生成提示词\n\n`;
        doc += `> 以下提示词可直接用于AI生图工具生成场景图\n\n`;
        doc += `\`\`\`\n`;
        doc += `【风格要求】写实风格，真实场景摄影效果，电影级画质\n`;
        
        // 优先使用完整提示词
        if (scene.prompt) {
          doc += `【场景内容】${scene.prompt}\n`;
        } else if (scene.visualPrompt) {
          doc += `【场景内容】${scene.visualPrompt}\n`;
        } else if (scene.description || scene.sceneDescription) {
          doc += `【场景内容】${scene.description || scene.sceneDescription}\n`;
        }
        
        // 添加运镜和构图
        if (scene.cameraMovement) {
          doc += `【运镜】${scene.cameraMovement}\n`;
        }
        
        doc += `【画质】9:16竖屏构图，2K高清画质，专业摄影，电影级光影效果\n`;
        doc += `\`\`\`\n\n`;
        
        // 如果有参考图URL
        if (scene.presignedUrl || scene.url || scene.imageUrl) {
          doc += `**参考图：** [查看参考图](${scene.presignedUrl || scene.url || scene.imageUrl})\n\n`;
        }
        
        doc += `---\n\n`;
      });
    } else if (sceneImages && typeof sceneImages === 'object' && !Array.isArray(sceneImages)) {
      // 如果是对象格式（key-value）
      Object.entries(sceneImages).forEach(([key, scene], index) => {
        const sceneData = scene as Record<string, unknown>;
        const sceneName = sceneData.name || sceneData.sceneName || sceneData.title || key;
        doc += `### 3.${index + 1} 场景：${sceneName}\n\n`;
        
        doc += `#### 场景信息\n\n`;
        doc += `| 属性 | 描述 |\n|------|------|\n`;
        doc += `| 场景名称 | ${sceneName} |\n`;
        doc += `| 场景类型 | ${sceneData.type || sceneData.sceneType || '室内'} |\n`;
        if (sceneData.description || sceneData.sceneDescription) {
          doc += `| 场景描述 | ${sceneData.description || sceneData.sceneDescription} |\n`;
        }
        if (sceneData.location) {
          doc += `| 地点 | ${sceneData.location} |\n`;
        }
        
        // 场景图提示词
        doc += `\n#### 🔥 场景图生成提示词\n\n`;
        doc += `> 以下提示词可直接用于AI生图工具生成场景图\n\n`;
        doc += `\`\`\`\n`;
        doc += `【风格要求】写实风格，真实场景摄影效果，电影级画质\n`;
        
        // 优先使用完整提示词
        if (sceneData.prompt) {
          doc += `【场景内容】${sceneData.prompt}\n`;
        } else if (sceneData.visualPrompt) {
          doc += `【场景内容】${sceneData.visualPrompt}\n`;
        } else if (sceneData.description || sceneData.sceneDescription) {
          doc += `【场景内容】${sceneData.description || sceneData.sceneDescription}\n`;
        }
        
        doc += `【画质】9:16竖屏构图，2K高清画质，专业摄影，电影级光影效果\n`;
        doc += `\`\`\`\n\n`;
        
        // 如果有参考图URL
        if (sceneData.presignedUrl || sceneData.url || sceneData.imageUrl) {
          doc += `**参考图：** [查看参考图](${sceneData.presignedUrl || sceneData.url || sceneData.imageUrl})\n\n`;
        }
        
        doc += `---\n\n`;
      });
    } else {
      // 默认场景建议
      doc += `### 3.1 默认场景配置\n\n`;
      doc += `根据${genreLabel}题材，建议配置以下核心场景：\n\n`;
      doc += `| 序号 | 场景名称 | 场景类型 | 用途说明 |\n|------|----------|----------|----------|\n`;
      doc += `| 1 | 主角住所 | 室内 | 主角日常生活场景 |\n`;
      doc += `| 2 | 豪华办公室 | 室内 | 商务/权谋场景 |\n`;
      doc += `| 3 | 高端餐厅 | 室内 | 社交/约会场景 |\n`;
      doc += `| 4 | 城市街道 | 室外 | 外景/转场 |\n`;
      doc += `| 5 | 公司大门 | 室外 | 出入/对峙场景 |\n`;
      doc += `\n---\n\n`;
    }

    // 分镜剧本 - 全剧集
    doc += `## 四、分镜剧本（全${totalEpisodes}集）\n\n`;
    
    // 优先使用全剧集分镜数据（从数据库获取）
    const allEpisodesStoryboards = finalConfig.allEpisodesStoryboards as Array<{
      episodeNumber: number;
      title: string;
      storyboards: Record<string, unknown>[];
    }> | undefined;
    
    const storyboards = completedData.storyboards || finalConfig.storyboards || [];
    
    if (allEpisodesStoryboards && allEpisodesStoryboards.length > 0) {
      // 使用全剧集分镜数据
      allEpisodesStoryboards.forEach((episode) => {
        doc += `### 第${episode.episodeNumber}集：${episode.title || '未命名'}\n\n`;
        doc += `> 本集共 ${episode.storyboards?.length || 0} 个分镜\n\n`;
        
        if (episode.storyboards && Array.isArray(episode.storyboards)) {
          episode.storyboards.forEach((sb, index) => {
            const sequence = (sb.sequence as number) || index + 1;
            
            doc += `#### 分镜 ${sequence} (${sb.time || sb.duration ? `${sb.duration || 8}秒` : `${(index + 1) * 8}秒`})\n\n`;
            
            doc += `| 属性 | 内容 |\n|------|------|\n`;
            doc += `| 分镜序号 | #${sequence} |\n`;
            doc += `| 时长 | ${sb.duration ? `${sb.duration}秒` : sb.time || '8秒'} |\n`;
            doc += `| 镜头类型 | ${sb.shotType || '中景'} |\n`;
            doc += `| 拍摄角度 | ${sb.cameraAngle || '平视'} |\n`;
            doc += `| 运镜方式 | ${sb.cameraMovement || '固定'} |\n`;
            doc += `| 情绪基调 | ${sb.emotion || sb.mood || '平静'} |\n`;
            
            // 画面描述
            doc += `\n**画面描述：**\n`;
            const visualDesc = sb.visualDescription || sb.description || sb.scene || sb.visualPrompt || '暂无描述';
            doc += `${visualDesc}\n\n`;
            
            // 台词内容
            if (sb.dialogues && Array.isArray(sb.dialogues) && sb.dialogues.length > 0) {
              doc += `**台词内容：**\n\n`;
              doc += `| 角色 | 台词 | 情绪 | 语速 |\n|------|------|------|------|\n`;
              sb.dialogues.forEach((d: Record<string, unknown>) => {
                doc += `| ${d.speaker || '角色'} | ${d.content || ''} | ${d.emotion || '自然'} | ${d.speechRate || '正常'} |\n`;
              });
              doc += `\n`;
            } else if (sb.dialogue) {
              const dialogue = sb.dialogue as Record<string, unknown>;
              doc += `**台词内容：**\n`;
              doc += `- **${dialogue.speaker || '角色'}**：${dialogue.content || (typeof sb.dialogue === 'string' ? sb.dialogue : '')}`;
              if (dialogue.emotion) doc += ` *（${dialogue.emotion}）*`;
              doc += `\n\n`;
            }
            
            // 音效提示
            if (sb.soundEffect || sb.bgmAtmosphere) {
              doc += `**音效/氛围：** ${sb.soundEffect || sb.bgmAtmosphere}\n\n`;
            }
            
            // 转场提示
            if (sb.transition) {
              doc += `**转场方式：** ${sb.transition}\n\n`;
            }
            
            doc += `---\n\n`;
          });
        }
      });
    } else if (storyboards && Array.isArray(storyboards) && storyboards.length > 0) {
      // 按集数分组
      const episodes: Record<number, typeof storyboards> = {};
      storyboards.forEach((sb: Record<string, unknown>) => {
        const ep = (sb.episode as number) || 1;
        if (!episodes[ep]) episodes[ep] = [];
        episodes[ep].push(sb);
      });
      
      // 遍历每一集
      Object.keys(episodes).sort((a, b) => Number(a) - Number(b)).forEach((ep) => {
        const epNum = parseInt(ep);
        const epStoryboards = episodes[epNum];
        
        doc += `### 第${epNum}集 分镜剧本\n\n`;
        doc += `> 本集共 ${epStoryboards.length} 个分镜\n\n`;
        
        epStoryboards.forEach((sb: Record<string, unknown>, index: number) => {
          const sequence = (sb.sequence as number) || index + 1;
          
          doc += `#### 分镜 ${sequence} (${sb.time || `${(index + 1) * 8}秒`})\n\n`;
          
          doc += `| 属性 | 内容 |\n|------|------|\n`;
          doc += `| 分镜序号 | #${sequence} |\n`;
          doc += `| 时长 | ${sb.duration ? `${sb.duration}秒` : sb.time || '8秒'} |\n`;
          doc += `| 镜头类型 | ${sb.shotType || '中景'} |\n`;
          doc += `| 拍摄角度 | ${sb.cameraAngle || '平视'} |\n`;
          doc += `| 运镜方式 | ${sb.cameraMovement || '固定'} |\n`;
          doc += `| 情绪基调 | ${sb.emotion || sb.mood || '平静'} |\n`;
          
          // 画面描述
          doc += `\n**画面描述：**\n`;
          const visualDesc = sb.visualDescription || sb.description || sb.scene || sb.visualPrompt || '暂无描述';
          doc += `${visualDesc}\n\n`;
          
          // 台词内容
          if (sb.dialogues && Array.isArray(sb.dialogues) && sb.dialogues.length > 0) {
            doc += `**台词内容：**\n\n`;
            doc += `| 角色 | 台词 | 情绪 | 语速 |\n|------|------|------|------|\n`;
            sb.dialogues.forEach((d: Record<string, unknown>) => {
              doc += `| ${d.speaker || '角色'} | ${d.content || ''} | ${d.emotion || '自然'} | ${d.speechRate || '正常'} |\n`;
            });
            doc += `\n`;
          } else if (sb.dialogue) {
            const dialogue = sb.dialogue as Record<string, unknown>;
            doc += `**台词内容：**\n`;
            doc += `- **${dialogue.speaker || '角色'}**：${dialogue.content || (typeof sb.dialogue === 'string' ? sb.dialogue : '')}`;
            if (dialogue.emotion) doc += ` *（${dialogue.emotion}）*`;
            doc += `\n\n`;
          }
          
          // 音效提示
          if (sb.soundEffect || sb.bgmAtmosphere) {
            doc += `**音效/氛围：** ${sb.soundEffect || sb.bgmAtmosphere}\n\n`;
          }
          
          // 转场提示
          if (sb.transition) {
            doc += `**转场方式：** ${sb.transition}\n\n`;
          }
          
          doc += `---\n\n`;
        });
      });
    } else {
      doc += `*暂无分镜剧本数据，请先执行工作流生成剧本*\n\n---\n\n`;
    }

    // 视频片段生成提示词
    doc += `## 五、视频片段生成提示词\n\n`;
    doc += `> 以下提示词可直接用于AI视频生成工具\n\n`;
    
    if (storyboards && Array.isArray(storyboards) && storyboards.length > 0) {
      storyboards.forEach((sb: Record<string, unknown>, index: number) => {
        const sequence = (sb.sequence as number) || index + 1;
        const episode = (sb.episode as number) || 1;
        
        doc += `### 5.${index + 1} 第${episode}集-分镜${sequence} 视频提示词\n\n`;
        
        doc += `**基本信息：**\n`;
        doc += `- 时长：${sb.duration || 8}秒\n`;
        doc += `- 镜头：${sb.shotType || '中景'}\n`;
        doc += `- 情绪：${sb.emotion || '平静'}\n\n`;
        
        doc += `**视频生成提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `【视频风格】写实风格，真人电影质感，流畅自然动作`;
        if (sb.visualDescription) {
          doc += `\n【画面内容】${sb.visualDescription}`;
        }
        if (sb.dialogues && Array.isArray(sb.dialogues) && sb.dialogues.length > 0) {
          doc += `\n【角色动作】`;
          const speakers = sb.dialogues.map((d: Record<string, unknown>) => d.speaker).join('、');
          doc += `${speakers}在场`;
          if (sb.emotion) {
            doc += `，${sb.emotion}氛围`;
          }
        }
        doc += `\n【运镜】${sb.cameraMovement || '固定机位'}，${sb.shotType || '中景'}构图`;
        doc += `\n【画质】9:16竖屏，1080P，流畅30fps\n`;
        doc += `\`\`\`\n\n`;
        
        doc += `---\n\n`;
      });
    } else {
      doc += `*暂无视频提示词数据*\n\n---\n\n`;
    }

    // 配音配置
    doc += `## 六、配音配置与提示词\n\n`;
    
    if (characters && Array.isArray(characters) && characters.length > 0) {
      doc += `### 6.1 角色配音方案\n\n`;
      
      characters.forEach((char: Record<string, unknown>, index: number) => {
        const gender = char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '未知';
        
        doc += `#### ${char.name || `角色${index + 1}`} 配音\n\n`;
        
        doc += `**配音要求：**\n`;
        doc += `- 角色性别：${gender}\n`;
        doc += `- 年龄感：${char.age || '25'}岁\n`;
        doc += `- 气质特点：${char.temperament || '自然'}\n\n`;
        
        doc += `**音色描述提示词：**\n`;
        doc += `\`\`\`\n`;
        doc += `${gender}声线，${char.age || '青年'}音色`;
        const temperament = String(char.temperament || '');
        if (temperament.includes('冷') || temperament.includes('酷')) {
          doc += `，声音冷峻有力，语调平稳`;
        } else if (temperament.includes('温') || temperament.includes('柔')) {
          doc += `，声音温柔细腻，语调柔和`;
        } else if (temperament.includes('霸') || temperament.includes('强')) {
          doc += `，声音霸气沉稳，语调有力`;
        } else {
          doc += `，声音自然亲切，语调适中`;
        }
        doc += `，情绪表达自然流畅，适合短剧配音\n`;
        doc += `\`\`\`\n\n`;
        
        doc += `---\n\n`;
      });
    }

    // 音频素材配置
    doc += `### 6.2 背景音乐与音效配置\n\n`;
    
    doc += `#### 背景音乐建议\n\n`;
    doc += `| 场景/情绪 | 音乐风格 | 节奏建议 |\n|-----------|----------|----------|\n`;
    doc += `| 开场/钩子 | 悬疑/紧张 | 快节奏，鼓点明显 |\n`;
    doc += `| 甜蜜场景 | 轻快/浪漫 | 中速，钢琴或弦乐 |\n`;
    doc += `| 冲突/对峙 | 紧张/压迫 | 快节奏，低音加重 |\n`;
    doc += `| 反转/高潮 | 激昂/震撼 | 渐强节奏，气势磅礴 |\n`;
    doc += `| 结尾/留悬念 | 悬疑/余韵 | 缓慢，留白 |\n\n`;
    
    doc += `#### 音效配置\n\n`;
    doc += `| 音效类型 | 使用场景 | 音量建议 |\n|----------|----------|----------|\n`;
    doc += `| 脚步声 | 人物走动 | -20dB |\n`;
    doc += `| 开门声 | 进出场合 | -18dB |\n`;
    doc += `| 手机铃声 | 接打电话 | -15dB |\n`;
    doc += `| 汽车声 | 室外场景 | -22dB |\n`;
    doc += `| 环境音 | 背景氛围 | -25dB |\n\n`;
    
    doc += `**音量控制标准：**\n`;
    doc += `- 人声：-16 LUFS\n`;
    doc += `- BGM：-24 LUFS\n`;
    doc += `- 音效：-18~-22 LUFS\n`;
    doc += `- 室内混响：15%\n`;
    doc += `- 室外混响：0%\n\n`;
    
    doc += `---\n\n`;

    // 剪辑合成方案
    doc += `## 七、剪辑合成方案\n\n`;
    
    doc += `### 7.1 画面风格\n\n`;
    doc += `| 属性 | 配置 |\n|------|------|\n`;
    doc += `| 画面风格 | 超写实真人电影风 |\n`;
    doc += `| 色调 | 暖白光4500K |\n`;
    doc += `| 对比度 | 中高对比，层次分明 |\n`;
    doc += `| 饱和度 | 自然饱和，略偏暖 |\n`;
    doc += `| 锐度 | 中等锐化，细节清晰 |\n\n`;
    
    doc += `### 7.2 运镜方案\n\n`;
    doc += `| 运镜类型 | 占比 | 使用场景 |\n|----------|------|----------|\n`;
    doc += `| 固定镜头 | 90% | 对话、日常场景 |\n`;
    doc += `| 推镜头 | 8% | 情绪强调、关键表情 |\n`;
    doc += `| 平移镜头 | 2% | 场景展示、转场 |\n\n`;
    
    doc += `### 7.3 转场方案\n\n`;
    doc += `| 转场类型 | 使用场景 | 时长 |\n|----------|----------|------|\n`;
    doc += `| 硬切 | 正常切换 | 0秒 |\n`;
    doc += `| 淡入淡出 | 时间流逝、情绪转换 | 0.5秒 |\n`;
    doc += `| 黑场 | 回忆、转场 | 0.3秒 |\n`;
    doc += `| 白场 | 幻想、转折 | 0.3秒 |\n\n`;
    
    doc += `### 7.4 字幕规范\n\n`;
    doc += `| 属性 | 配置 |\n|------|------|\n`;
    doc += `| 字体 | 黑体/思源黑体 |\n`;
    doc += `| 字号 | 根据字数动态调整 |\n`;
    doc += `| 颜色 | 白色，黑色描边 |\n`;
    doc += `| 位置 | 画面下方居中 |\n`;
    doc += `| 动画 | 淡入淡出，0.2秒 |\n\n`;
    
    doc += `---\n\n`;

    // 一致性规则
    doc += `## 八、一致性规则\n\n`;
    
    doc += `### 8.1 人物一致性\n\n`;
    doc += `**核心要求：** 人物全程一致\n\n`;
    doc += `- 不换脸、不变装、不换发型\n`;
    doc += `- 表情统一：平静微严肃、开心浅笑、生气皱眉、委屈垂眼\n`;
    doc += `- 微动作统一：思考摸下巴、紧张扣手指\n`;
    doc += `- 站位统一：主角在画面黄金分割点\n`;
    doc += `- 眼神方向：始终朝向对话对象或镜头\n\n`;
    
    doc += `### 8.2 画面一致性\n\n`;
    doc += `**核心要求：** 画面全程一致\n\n`;
    doc += `- 比例：9:16竖屏\n`;
    doc += `- 风格：超写实真人电影风\n`;
    doc += `- 色调：暖白光4500K\n`;
    doc += `- 运镜：90%静止，8%推进，2%平移\n`;
    doc += `- 光线：主光源统一方向\n\n`;
    
    doc += `### 8.3 声音一致性\n\n`;
    doc += `**核心要求：** 声音全程一致\n\n`;
    doc += `- 每个角色绑定唯一音色\n`;
    doc += `- 人声：-16 LUFS\n`;
    doc += `- BGM：-24 LUFS\n`;
    doc += `- 室内混响15%，室外无混响\n`;
    doc += `- 音色特征保持稳定\n\n`;
    
    doc += `---\n\n`;

    // 节奏锚点
    doc += `## 九、节奏锚点\n\n`;
    doc += `> 短剧节奏设计参考\n\n`;
    
    if (finalConfig.rhythmAnchors && finalConfig.rhythmAnchors.length > 0) {
      doc += `| 时间节点 | 剧情事件 | 情绪强度 | 观众心理 |\n|----------|----------|----------|----------|\n`;
      finalConfig.rhythmAnchors.forEach((anchor: { time: string; event: string }) => {
        const intensity = anchor.time.includes('0-3') ? '⭐⭐⭐⭐⭐' : 
                          anchor.time.includes('150') || anchor.time.includes('210') ? '⭐⭐⭐⭐' : '⭐⭐⭐';
        const psychology = anchor.time.includes('0-3') ? '强烈好奇' :
                          anchor.time.includes('30') ? '初步投入' :
                          anchor.time.includes('90') ? '情绪波动' :
                          anchor.time.includes('150') ? '高潮体验' :
                          anchor.time.includes('210') ? '意外震惊' : '意犹未尽';
        doc += `| ${anchor.time} | ${anchor.event} | ${intensity} | ${psychology} |\n`;
      });
    } else {
      doc += `| 时间节点 | 剧情事件 | 情绪强度 |\n|----------|----------|----------|\n`;
      doc += `| 0-3秒 | 强钩子开场 | ⭐⭐⭐⭐⭐ |\n`;
      doc += `| 30秒 | 第一次冲突 | ⭐⭐⭐ |\n`;
      doc += `| 90秒 | 第一次反转 | ⭐⭐⭐⭐ |\n`;
      doc += `| 150秒 | 情绪最高点 | ⭐⭐⭐⭐⭐ |\n`;
      doc += `| 210秒 | 第二次反转 | ⭐⭐⭐⭐ |\n`;
      doc += `| 270-300秒 | 强结尾+留悬念 | ⭐⭐⭐⭐⭐ |\n`;
    }
    doc += `\n---\n\n`;

    // 制作流程指南
    doc += `## 十、制作流程指南\n\n`;
    
    doc += `### 10.1 前期准备\n\n`;
    doc += `1. **角色准备**\n`;
    doc += `   - 使用人物立绘提示词生成角色参考图\n`;
    doc += `   - 确保每个角色有正面、侧面、背面、动作四张图\n`;
    doc += `   - 保存角色特征用于后续一致性\n\n`;
    doc += `2. **场景准备**\n`;
    doc += `   - 使用场景图提示词生成场景参考图\n`;
    doc += `   - 确保场景风格统一\n\n`;
    
    doc += `### 10.2 中期制作\n\n`;
    doc += `1. **视频生成**\n`;
    doc += `   - 使用视频片段提示词逐个生成分镜视频\n`;
    doc += `   - 注意保持角色一致性\n\n`;
    doc += `2. **配音制作**\n`;
    doc += `   - 根据配音配置选择合适音色\n`;
    doc += `   - 注意情绪表达与画面匹配\n\n`;
    
    doc += `### 10.3 后期合成\n\n`;
    doc += `1. **剪辑合成**\n`;
    doc += `   - 按分镜顺序组接视频\n`;
    doc += `   - 添加转场效果\n`;
    doc += `   - 调整画面色调\n\n`;
    doc += `2. **音频合成**\n`;
    doc += `   - 添加配音\n`;
    doc += `   - 添加BGM和音效\n`;
    doc += `   - 调整音量平衡\n\n`;
    
    doc += `### 10.4 质量检查\n\n`;
    doc += `- 人物一致性检查\n`;
    doc += `- 画面一致性检查\n`;
    doc += `- 声音一致性检查\n`;
    doc += `- 节奏锚点检查\n\n`;
    
    doc += `---\n\n`;
    
    doc += `## 附录：关键提示词汇总\n\n`;
    doc += `> 以下是本文档中所有核心提示词的快速索引\n\n`;
    
    doc += `### A. 角色立绘提示词索引\n\n`;
    if (characters && Array.isArray(characters)) {
      characters.forEach((char: Record<string, unknown>, index: number) => {
        doc += `- ${char.name || `角色${index + 1}`}：见 2.${index + 1} 章节\n`;
      });
    }
    doc += `\n`;
    
    doc += `### B. 场景图提示词索引\n\n`;
    if (sceneImages && Array.isArray(sceneImages)) {
      sceneImages.forEach((scene: Record<string, unknown>, index: number) => {
        doc += `- ${scene.name || scene.sceneName || `场景${index + 1}`}：见 3.${index + 1} 章节\n`;
      });
    } else if (sceneImages && typeof sceneImages === 'object') {
      Object.keys(sceneImages).forEach((key, index) => {
        doc += `- ${key}：见 3.${index + 1} 章节\n`;
      });
    }
    doc += `\n`;
    
    doc += `### C. 视频片段提示词索引\n\n`;
    doc += `- 全部分镜视频提示词：见 第五章\n\n`;
    
    doc += `---\n\n`;
    doc += `*本配置由扣子(Coze) AI应用开发平台自动生成*\n`;
    doc += `*生成时间：${new Date().toLocaleString('zh-CN')}*\n`;

    return doc;
  };

  // 导出配置（Markdown格式）
  const exportConfig = () => {
    if (!finalConfig) return;
    
    // 生成中文Markdown文档
    const markdownContent = generateChineseConfigDocument();
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `《${finalConfig.title}》短剧配置方案.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导出JSON配置（保留原功能）
  const exportConfigJSON = () => {
    if (!finalConfig) return;
    const blob = new Blob([JSON.stringify(finalConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `short-drama-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 复制配置
  const copyConfig = () => {
    if (!finalConfig) return;
    navigator.clipboard.writeText(JSON.stringify(finalConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 下载步骤配置
  const downloadStepConfig = (stepId: string, stepOutput: { output: string; data: unknown; completedAt: Date }) => {
    const step = steps.find(s => s.id === stepId);
    const stepName = step?.name || stepId;
    
    // 构建步骤配置对象
    const config = {
      stepId,
      stepName,
      completedAt: stepOutput.completedAt.toISOString(),
      input: userInput,
      output: typeof stepOutput.data === 'object' ? stepOutput.data : stepOutput.output,
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stepId}-${stepName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 下载历史记录配置
  const downloadHistoryConfig = (entry: { id: string; executedAt: string; title: string; input: Record<string, unknown>; result: Record<string, unknown>; config?: unknown }) => {
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-history-${entry.title}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 统计 - 使用 useMemo 缓存计算结果
  const completedCount = useMemo(() => steps.filter(s => s.status === 'completed').length, [steps]);
  const inProgressCount = useMemo(() => steps.filter(s => s.status === 'in_progress').length, [steps]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Header with Aurora Gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 p-8 mb-2">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-teal-300/30 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">工作流执行器</h1>
              <p className="text-white/80 text-base">
                一键生成完整的短剧配置方案
              </p>
            </div>
            {!showInputForm && (
              <Button onClick={resetWorkflow} variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <RotateCcw className="h-4 w-4 mr-2" />
                重新开始
              </Button>
            )}
          </div>
        </div>

        {/* User Input Form */}
        {showInputForm && (
          <TooltipProvider>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：基本信息 */}
            <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
              <div className="p-5 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-teal-500/10">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/30 to-teal-500/30">
                    <FileText className="h-4 w-4 text-teal-600" />
                  </div>
                  基本信息
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* 短剧选择 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">选择已有短剧</Label>
                    {selectedSeriesId && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSeriesSelect('')}
                        className="h-6 text-xs"
                      >
                        清除
                      </Button>
                    )}
                  </div>
                  <Select 
                    value={selectedSeriesId || "__manual__"} 
                    onValueChange={(v) => handleSeriesSelect(v === "__manual__" ? "" : v)}
                    disabled={loadingSeries}
                  >
                    <SelectTrigger className="bg-white/50 border-white/30 h-9">
                      <SelectValue placeholder={loadingSeries ? "加载中..." : "可选，直接配置新短剧"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">手动配置参数</SelectItem>
                      {seriesList.map((series) => (
                        <SelectItem key={series.id} value={series.id}>
                          {series.title} - {ALL_GENRES.find(g => g.id === series.genre)?.label || series.genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* 配置加载状态提示 */}
                  {loadingConfig && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>正在加载配置...</span>
                    </div>
                  )}
                  
                  {/* 工作流历史 */}
                  {workflowHistory.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700">执行历史</span>
                        <Badge variant="secondary" className="text-xs">
                          {workflowHistory.length} 次执行
                        </Badge>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {workflowHistory.slice(0, 5).map((entry, index) => (
                          <div 
                            key={entry.id || index}
                            className="flex items-center justify-between text-xs p-2 rounded bg-white/30 hover:bg-white/50 transition-colors group"
                          >
                            <div 
                              className="flex items-center gap-2 cursor-pointer flex-1"
                              onClick={() => {
                                // 点击历史记录可以查看详情
                                const outputText = JSON.stringify(entry, null, 2);
                                setStepOutputs(prev => ({
                                  ...prev,
                                  [`history_${index}`]: {
                                    output: outputText,
                                    data: entry,
                                    completedAt: new Date(entry.executedAt)
                                  }
                                }));
                                setExpandedStep(`history_${index}`);
                              }}
                            >
                              <Clock className="h-3 w-3 text-purple-500" />
                              <span className="text-muted-foreground">
                                {new Date(entry.executedAt).toLocaleString('zh-CN', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="text-purple-600">{entry.title}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {entry.result && (
                                <>
                                  {((entry.result as Record<string, number>).charactersCount || 0) > 0 && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      {(entry.result as Record<string, number>).charactersCount}角色
                                    </Badge>
                                  )}
                                  {((entry.result as Record<string, number>).storyboardsCount || 0) > 0 && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      {(entry.result as Record<string, number>).storyboardsCount}分镜
                                    </Badge>
                                  )}
                                </>
                              )}
                              {/* 删除按钮 */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('确定要删除这条执行历史吗？')) {
                                    deleteHistoryEntry(entry.id);
                                  }
                                }}
                              >
                                <X className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* 历史记录详情展示 */}
                      {expandedStep?.startsWith('history_') && stepOutputs[expandedStep] && (
                        <div className="mt-3 p-3 rounded-lg bg-white/50 border border-purple-500/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-purple-700">执行详情</span>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const outputText = typeof stepOutputs[expandedStep].output === 'string' 
                                    ? stepOutputs[expandedStep].output 
                                    : JSON.stringify(stepOutputs[expandedStep].output, null, 2);
                                  navigator.clipboard.writeText(outputText);
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                复制
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 获取历史记录数据
                                  const historyData = stepOutputs[expandedStep].data as { id: string; executedAt: string; title: string; input: Record<string, unknown>; result: Record<string, unknown>; config?: unknown };
                                  downloadHistoryConfig(historyData);
                                }}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                下载
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setExpandedStep(null)}
                              >
                                收起
                              </Button>
                            </div>
                          </div>
                          <ScrollArea className="h-[200px] rounded bg-white/30 p-2">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                              {stepOutputs[expandedStep].output}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 短剧标题 */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" />
                    短剧标题
                  </Label>
                  <Input
                    placeholder="如：重生之逆袭女王"
                    value={userInput.title}
                    onChange={(e) => setUserInput(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-white/50 border-white/30 h-9"
                  />
                </div>

                {/* 题材类型 */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Film className="h-3 w-3" />
                    题材类型
                  </Label>
                  <Select
                    value={userInput.genre}
                    onValueChange={(v) => setUserInput(prev => ({ ...prev, genre: v }))}
                  >
                    <SelectTrigger className="bg-white/50 border-white/30 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {Object.entries(GENRE_CATEGORIES).map(([key, category]) => (
                        <div key={key}>
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{category.label}</div>
                          {category.genres.map((genre) => (
                            <SelectItem key={genre.id} value={genre.id}>
                              <span>{genre.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">{genre.desc}</span>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 风格和集数 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">风格</Label>
                    <Select
                      value={userInput.style}
                      onValueChange={(v) => setUserInput(prev => ({ ...prev, style: v }))}
                    >
                      <SelectTrigger className="bg-white/50 border-white/30 h-9">
                        <SelectValue placeholder="可选" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">不选择</SelectItem>
                        {STYLE_OPTIONS.map(style => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">生成集数</Label>
                    <Input
                      type="number"
                      value={userInput.totalEpisodes}
                      onChange={(e) => setUserInput(prev => ({ ...prev, totalEpisodes: parseInt(e.target.value) || 1 }))}
                      min={1}
                      max={100}
                      className="bg-white/50 border-white/30 h-9"
                    />
                  </div>
                </div>

                {/* 人物数量 */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
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
                    ].map((option) => (
                      <Badge
                        key={option.value}
                        variant={userInput.characterCount === option.value ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-all text-xs px-3 py-1",
                          userInput.characterCount === option.value 
                            ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white border-0" 
                            : "hover:bg-muted bg-white/30"
                        )}
                        onClick={() => setUserInput(prev => ({ ...prev, characterCount: option.value }))}
                      >
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：核心冲突配置 */}
            <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
              <div className="p-5 border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-rose-500/10">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500/30 to-rose-500/30">
                    <Zap className="h-4 w-4 text-rose-600" />
                  </div>
                  核心冲突配置
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* 核心冲突类型 - 紧凑标签式 */}
                <div className="space-y-2">
                  <Label className="text-sm">冲突类型（可多选）</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CORE_CONFLICT_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = userInput.coreConflictTypes.includes(type.id);
                      return (
                        <Tooltip key={type.id} delayDuration={200}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={isSelected ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer transition-all text-xs px-3 py-1.5 flex items-center gap-1.5",
                                isSelected 
                                  ? `${type.bgColor} ${type.borderColor} ${type.color}` 
                                  : "hover:bg-muted bg-white/30"
                              )}
                              onClick={() => {
                                const newTypes = isSelected
                                  ? userInput.coreConflictTypes.filter(t => t !== type.id)
                                  : [...userInput.coreConflictTypes, type.id];
                                setUserInput(prev => ({ ...prev, coreConflictTypes: newTypes as CoreConflictTypeId[] }));
                              }}
                            >
                              <Icon className="h-3 w-3" />
                              {type.label}
                              {isSelected && <CheckCircle2 className="h-3 w-3" />}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs p-3">
                            <p className="font-medium text-sm">{type.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                            <p className="text-xs text-primary mt-1">示例：{type.example}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* 详细冲突描述 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">详细冲突描述</Label>
                    <span className="text-xs text-muted-foreground">
                      {userInput.conflict.length}字
                    </span>
                  </div>
                  <ConflictDescriptionInput
                    value={userInput.conflict}
                    onChange={(value) => setUserInput(prev => ({ ...prev, conflict: value }))}
                    placeholder="描述开篇钩子、阵营对立、人物关系等...&#10;&#10;例如：&#10;【开篇钩子】女主被按在斩仙台上...&#10;【阵营对立】魔教、正道、皇室..."
                  />
                </div>

                {/* 配置预览 */}
                <div className="p-3 rounded-lg bg-muted/30 border border-white/10">
                  <p className="text-xs text-muted-foreground mb-2">当前配置</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="secondary" className="text-xs">
                      {ALL_GENRES.find(g => g.id === userInput.genre)?.label || '未选择'}
                    </Badge>
                    {userInput.style && userInput.style !== '__none__' && (
                      <Badge variant="secondary" className="text-xs">
                        {STYLE_OPTIONS.find(s => s.id === userInput.style)?.label}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {userInput.totalEpisodes}集
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {userInput.characterCount === 0 ? 'AI定角色' : `${userInput.characterCount}人`}
                    </Badge>
                    {userInput.coreConflictTypes.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {userInput.coreConflictTypes.length}种冲突
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 开始按钮 */}
                <Button 
                  onClick={startWorkflow} 
                  className="w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-600 hover:via-teal-600 hover:to-emerald-600 h-11 text-base font-medium shadow-lg shadow-teal-500/20" 
                  size="lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  开始生成短剧配置
                </Button>
              </div>
            </div>
          </div>
          </TooltipProvider>
        )}

        {/* Progress Section */}
        {!showInputForm && !finalConfig && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="glass-card p-4 rounded-xl border border-white/20 bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{completedCount}</p>
                    <p className="text-xs text-muted-foreground">已完成</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl border border-white/20 bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20">
                    <Loader2 className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">{inProgressCount}</p>
                    <p className="text-xs text-muted-foreground">进行中</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl border border-white/20 bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{Math.round(totalProgress)}%</p>
                    <p className="text-xs text-muted-foreground">总进度</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl border border-white/20 bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
                    <Film className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">300秒</p>
                    <p className="text-xs text-muted-foreground">视频时长</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="glass-card rounded-xl border border-white/20 bg-white/10 p-4">
              <Progress value={totalProgress} className="h-2" />
            </div>

            {/* Steps Grid - Enhanced Design */}
            <div className="relative">
              {/* Progress connection line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border hidden sm:block" style={{ left: '1.25rem' }} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isExpanded = expandedStep === step.id;
                  const stepOutput = stepOutputs[step.id];
                  const hasOutput = step.status === 'completed' && (stepOutput || step.output);
                  
                  return (
                    <div 
                      key={step.id}
                      className={cn(
                        'glass-card rounded-xl border bg-white/10',
                        hasOutput && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-transform',
                        !hasOutput && 'cursor-default',
                        step.status === 'completed' && 'border-green-500/30',
                        step.status === 'in_progress' && 'border-teal-500/50 shadow-lg shadow-teal-500/10',
                        step.status === 'error' && 'border-destructive/50',
                        isExpanded && 'ring-2 ring-teal-500/50'
                      )}
                      onClick={() => {
                        if (hasOutput) {
                          setExpandedStep(isExpanded ? null : step.id);
                        }
                      }}
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {/* Step number circle */}
                            <div className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm',
                              step.status === 'completed' 
                                ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                                : step.status === 'in_progress'
                                ? 'bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-teal-500/30'
                                : 'bg-muted text-muted-foreground'
                            )}>
                              {step.status === 'completed' 
                                ? <CheckCircle2 className="h-5 w-5" /> 
                                : step.status === 'in_progress'
                                ? <Loader2 className="h-5 w-5 animate-spin" />
                                : <Icon className="h-5 w-5" />
                              }
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{step.name}</span>
                                {hasOutput && (
                                  <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-600">
                                    点击查看
                                  </Badge>
                                )}
                              </div>
                              {step.status === 'completed' && (
                                <Badge variant="secondary" className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-500/20 shrink-0">
                                  完成
                                </Badge>
                              )}
                              {step.status === 'error' && (
                                <Badge variant="destructive" className="shrink-0">
                                  失败
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                            
                            {/* 预估时间显示 */}
                            {step.status === 'pending' && step.estimatedTime && (
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                预计需要 {step.estimatedTime < 60 ? `${step.estimatedTime}秒` : `${Math.round(step.estimatedTime / 60)}分钟`}
                              </p>
                            )}
                            
                            {step.status === 'in_progress' && (
                              <div className="mt-2 space-y-1.5">
                                <Progress value={step.progress} className="h-1.5" />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-teal-600 font-medium">
                                    {step.statusMessages?.inProgress || '正在处理...'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{Math.round(step.progress)}%</p>
                                </div>
                                {step.estimatedTime && step.startedAt && (
                                  <p className="text-xs text-muted-foreground/70">
                                    已用时 {Math.round((Date.now() - step.startedAt.getTime()) / 1000)}秒 / 预计 {step.estimatedTime < 60 ? `${step.estimatedTime}秒` : `${Math.round(step.estimatedTime / 60)}分钟`}
                                  </p>
                                )}
                              </div>
                            )}
                            {/* 显示错误信息 */}
                            {step.status === 'error' && step.error && (
                              <div className="mt-2 space-y-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-xs text-red-600 font-medium">{step.statusMessages?.error || '执行失败'}</p>
                                    <p className="text-xs text-red-500/80 mt-0.5">{step.error}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retryStep(index);
                                    }}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    重试
                                  </Button>
                                  {/* 如果有前置条件的导航信息，显示跳转按钮 */}
                                  {step.prerequisites && step.prerequisites.length > 0 && step.navigateTo && selectedSeriesId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const url = `${step.navigateTo!.path}?seriesId=${selectedSeriesId}${step.navigateTo!.tab ? `&tab=${step.navigateTo!.tab}` : ''}`;
                                        router.push(url);
                                      }}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      前往完善
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                            {step.output && step.status === 'completed' && !isExpanded && (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <p className="text-xs text-green-600">{step.statusMessages?.completed || step.output}</p>
                              </div>
                            )}
                            
                            {/* 等待状态的友好提示 */}
                            {step.status === 'pending' && step.prerequisites && step.prerequisites.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                <p className="text-xs text-muted-foreground/60 italic">
                                  {step.statusMessages?.pending || '等待前置步骤完成'}
                                </p>
                                {/* 显示前置步骤状态 */}
                                <div className="flex flex-wrap gap-1">
                                  {step.prerequisites.map((prereq, pIdx) => {
                                    const prereqStep = steps.find(s => s.id === prereq.stepId);
                                    const isPrereqCompleted = prereqStep?.status === 'completed';
                                    return (
                                      <Tooltip key={pIdx}>
                                        <TooltipTrigger asChild>
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-[10px] h-4 px-1 cursor-help",
                                              isPrereqCompleted 
                                                ? "border-green-500/30 text-green-600" 
                                                : "border-orange-500/30 text-orange-600"
                                            )}
                                          >
                                            {isPrereqCompleted ? (
                                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                            ) : (
                                              <Circle className="h-2.5 w-2.5 mr-0.5" />
                                            )}
                                            {prereqStep?.name || prereq.stepId}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-xs p-2">
                                          <p className="text-xs">{prereq.errorMessage}</p>
                                          {prereq.navigateTo && (
                                            <Button
                                              variant="link"
                                              size="sm"
                                              className="h-5 text-xs p-0 mt-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const url = selectedSeriesId 
                                                  ? `${prereq.navigateTo!.path}?seriesId=${selectedSeriesId}${prereq.navigateTo!.tab ? `&tab=${prereq.navigateTo!.tab}` : ''}`
                                                  : prereq.navigateTo!.path;
                                                router.push(url);
                                              }}
                                            >
                                              前往 {prereq.navigateTo.label}
                                            </Button>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* 步骤状态和导航按钮 */}
                          <div className="flex flex-col items-end gap-1 ml-2">
                            {step.status === 'completed' && step.navigateTo && selectedSeriesId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-teal-600 hover:bg-teal-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = `${step.navigateTo!.path}?seriesId=${selectedSeriesId}${step.navigateTo!.tab ? `&tab=${step.navigateTo!.tab}` : ''}`;
                                  router.push(url);
                                }}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                查看
                              </Button>
                            )}
                            {hasOutput && (
                              <div>
                                {isExpanded ? (
                                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90 transition-transform" />
                                ) : (
                                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 展开的详情面板 */}
                        {isExpanded && stepOutput && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-teal-600">步骤输出详情</span>
                              <div className="flex items-center gap-2">
                                {/* 步骤跳转按钮 - 使用步骤配置的 navigateTo */}
                                {step.navigateTo && selectedSeriesId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs border-teal-500/30 text-teal-600 hover:bg-teal-500/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = `${step.navigateTo!.path}?seriesId=${selectedSeriesId}${step.navigateTo!.tab ? `&tab=${step.navigateTo!.tab}` : ''}`;
                                      router.push(url);
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    {step.navigateTo.label}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const outputText = typeof stepOutput.output === 'string' 
                                      ? stepOutput.output 
                                      : JSON.stringify(stepOutput.output, null, 2);
                                    navigator.clipboard.writeText(outputText);
                                  }}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  复制
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadStepConfig(step.id, stepOutput);
                                  }}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  下载
                                </Button>
                              </div>
                            </div>
                            <ScrollArea className="h-[200px] rounded-lg bg-white/5 p-3">
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                                {typeof stepOutput.output === 'string' 
                                  ? stepOutput.output 
                                  : JSON.stringify(stepOutput.output, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Final Output Section */}
        {finalConfig && (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="glass-card rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">短剧配置生成完成!</h2>
                    <p className="text-muted-foreground mt-1">
                      短视频完整配置方案已生成，包含 {finalConfig.characters.length} 个角色和 {finalConfig.storyboards.length} 个分镜
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyConfig} className="border-white/20 bg-white/10 hover:bg-white/20">
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? '已复制' : '复制配置'}
                  </Button>
                  <Button onClick={exportConfig} className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600">
                    <Download className="h-4 w-4 mr-2" />
                    下载剧本配置
                  </Button>
                  <Button variant="outline" onClick={exportConfigJSON} className="border-white/20 bg-white/10 hover:bg-white/20">
                    <Download className="h-4 w-4 mr-2" />
                    导出JSON
                  </Button>
                </div>
              </div>
            </div>

            {/* Config Details */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5 bg-white/10 backdrop-blur-xl border border-white/20">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="characters">角色档案</TabsTrigger>
                <TabsTrigger value="storyboards">分镜剧本</TabsTrigger>
                <TabsTrigger value="rules">一致性规则</TabsTrigger>
                <TabsTrigger value="rhythm">节奏锚点</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="space-y-4">
                  {/* 剧集完整性状态 */}
                  {selectedSeriesId && (
                    <DramaCompletionStatus
                      seriesId={selectedSeriesId}
                      totalEpisodes={userInput.totalEpisodes}
                      charactersCount={finalConfig.characters.length}
                      storyboardsCount={finalConfig.storyboards.length}
                      onNavigateToDrama={() => router.push(`/drama?seriesId=${selectedSeriesId}`)}
                    />
                  )}
                  
                  {/* 基本信息 */}
                  <CollapsibleInfoCard
                    title="基本信息"
                    data={[
                      { label: '标题', value: finalConfig.title },
                      { label: '题材', value: ALL_GENRES.find(g => g.id === finalConfig.genre)?.label || finalConfig.genre },
                      { label: '时长', value: finalConfig.duration },
                      { label: '画幅', value: finalConfig.aspectRatio },
                      { label: '分辨率', value: finalConfig.resolution },
                      { label: '平台', value: finalConfig.platform },
                    ]}
                  />
                  
                  {/* 核心冲突 */}
                  <CollapsibleTextCard
                    title="核心冲突"
                    content={finalConfig.coreConflict}
                    maxLines={2}
                  />
                  
                  {/* 统计信息 */}
                  <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                      <h3 className="text-sm font-semibold">统计信息</h3>
                    </div>
                    <div className="p-4 grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-teal-500/10">
                          <Users className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{finalConfig.characters.length}</p>
                          <p className="text-xs text-muted-foreground">个角色</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-cyan-500/10">
                          <Film className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{finalConfig.storyboards.length}</p>
                          <p className="text-xs text-muted-foreground">个分镜</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Clock className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{finalConfig.rhythmAnchors.length}</p>
                          <p className="text-xs text-muted-foreground">个节奏锚点</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Characters Tab */}
              <TabsContent value="characters">
                {/* 角色管理入口 */}
                {selectedSeriesId && (
                  <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-teal-600" />
                      <span className="text-sm">已生成 {finalConfig.characters.length} 个角色</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/drama?seriesId=${selectedSeriesId}&tab=artwork`)}
                      className="border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600"
                    >
                      前往角色立绘
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {finalConfig.characters.map((char, index) => (
                    <div key={char.id || index} className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
                      <div className="p-4 border-b border-white/10">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Badge className={char.gender === 'male' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gradient-to-r from-pink-500 to-rose-500'}>
                            {char.gender === 'male' ? '男' : '女'}
                          </Badge>
                          {char.name}
                        </h3>
                      </div>
                      <div className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-muted-foreground">年龄：</span>{char.age}岁</div>
                          <div><span className="text-muted-foreground">脸型：</span>{char.faceShape}</div>
                        </div>
                        <div><span className="text-muted-foreground">发型：</span>{char.hairstyle}</div>
                        <div><span className="text-muted-foreground">服装：</span>{char.clothing}</div>
                        <div><span className="text-muted-foreground">气质：</span>{char.temperament}</div>
                        {char.microActions && (
                          <div><span className="text-muted-foreground">微动作：</span>{char.microActions.join('、')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Storyboards Tab */}
              <TabsContent value="storyboards">
                {/* 分镜管理入口 */}
                {selectedSeriesId && (
                  <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-cyan-600" />
                      <span className="text-sm">已生成 {finalConfig.storyboards.length} 个分镜</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/drama?seriesId=${selectedSeriesId}&tab=episodes`)}
                      className="border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600"
                    >
                      前往分镜管理
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
                <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-4">
                    {finalConfig.storyboards.map((sb) => {
                      // 优先使用新的 dialogues 数组格式
                      const hasDialogues = sb.dialogues && sb.dialogues.length > 0;
                      
                      return (
                        <div key={sb.id} className="p-3 rounded-lg border border-white/20 bg-gradient-to-r from-cyan-500/5 to-teal-500/5">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-gradient-to-r from-cyan-500 to-teal-500">#{sb.sequence}</Badge>
                            <Badge variant="secondary" className="bg-white/10">{sb.time}</Badge>
                            <Badge variant="outline" className="border-white/20">{sb.shotType}</Badge>
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">{sb.emotion}</Badge>
                          </div>
                          <p className="text-sm mb-1"><span className="text-muted-foreground">画面：</span>{sb.visualDescription}</p>
                          
                          {/* 显示多句对话 */}
                          {hasDialogues && (
                            <div className="text-sm space-y-1 mt-2">
                              <span className="text-muted-foreground">台词：</span>
                              <div className="pl-2 space-y-1 border-l-2 border-teal-500/30">
                                {sb.dialogues!.map((d, idx) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span className="text-teal-600 font-medium shrink-0">{d.speaker}：</span>
                                    <span>{d.content}</span>
                                    {d.emotion && <span className="text-orange-500 text-xs">({d.emotion}{d.speechRate ? `，${d.speechRate}` : ''})</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 兼容旧的单句对话格式 */}
                          {!hasDialogues && sb.dialogue && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">台词：</span>
                              {typeof sb.dialogue === 'object' && sb.dialogue.speaker && (
                                <span className="text-teal-600 font-medium">{sb.dialogue.speaker}：</span>
                              )}
                              {typeof sb.dialogue === 'string' ? sb.dialogue : sb.dialogue?.content}
                              {typeof sb.dialogue === 'object' && sb.dialogue?.emotion && (
                                <span className="text-orange-500 text-xs ml-2">({sb.dialogue.emotion}{sb.dialogue.speechRate ? `，${sb.dialogue.speechRate}` : ''})</span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

              {/* Rules Tab */}
              <TabsContent value="rules">
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(finalConfig.consistencyRules).map(([key, rule]) => (
                    <div key={key} className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
                      <div className="p-4 border-b border-white/10">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          {key === 'character' && <Users className="h-4 w-4 text-teal-600" />}
                          {key === 'visual' && <Film className="h-4 w-4 text-teal-600" />}
                          {key === 'audio' && <Volume2 className="h-4 w-4 text-teal-600" />}
                          {rule.description}
                        </h3>
                      </div>
                      <div className="p-4">
                        <ul className="space-y-1 text-sm">
                          {rule.rules.map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                              <span className="text-muted-foreground">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Rhythm Tab */}
              <TabsContent value="rhythm">
                <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl p-4">
                    <div className="space-y-3">
                      {finalConfig.rhythmAnchors.map((anchor, index) => (
                        <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-cyan-500/5 to-teal-500/5 border border-white/10">
                          <div className="w-20 font-mono text-sm bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">{anchor.time}</div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="font-medium">{anchor.event}</div>
                        </div>
                      ))}
                    </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <Button variant="outline" size="lg" onClick={resetWorkflow} className="border-white/20 bg-white/10 hover:bg-white/20">
                创建新短剧
              </Button>
              <Button size="lg" onClick={exportConfig} className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600">
                <Download className="h-4 w-4 mr-2" />
                下载剧本配置
              </Button>
              <Button variant="outline" size="lg" onClick={exportConfigJSON} className="border-white/20 bg-white/10 hover:bg-white/20">
                <Download className="h-4 w-4 mr-2" />
                导出JSON
              </Button>
              {selectedSeriesId && (
                <Button 
                  size="lg" 
                  onClick={() => router.push(`/drama?seriesId=${selectedSeriesId}`)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  前往短剧管理
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
