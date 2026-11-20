'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  Wand2, 
  Users, 
  Film, 
  Copy, 
  Download, 
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Heart,
  Swords,
  Eye,
  Zap,
  Palette,
  Volume2,
  MessageSquare,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import type { Character, Storyboard } from '@/lib/types';

// 题材项类型
interface GenreItem {
  id: string;
  label: string;
  desc: string;
}

// 题材分类类型
interface GenreCategory {
  label: string;
  icon: typeof Heart;
  iconColor: string;
  bgColor: string;
  genres: GenreItem[];
}

// 题材类型配置 - 与 drama 页面同步
const GENRE_CATEGORIES: Record<string, GenreCategory> = {
  female: {
    label: '女性向题材',
    icon: Heart,
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    genres: [
      { id: 'ba-zong-tian-chong', label: '霸总甜宠', desc: '高富帅与平凡女主的甜蜜爱情' },
      { id: 'chong-sheng-ni-xi', label: '重生逆袭', desc: '重生复仇、打脸上位' },
      { id: 'nue-lian-zhui-qi', label: '虐恋追妻', desc: '前期虐心、后期追妻火葬场' },
      { id: 'hao-men-zhen-jia', label: '豪门真假千金', desc: '身份逆转、智斗上位' },
      { id: 'meng-bao-zhu-gong', label: '萌宝助攻', desc: '萌娃神助攻父母感情线' },
    ],
  },
  male: {
    label: '男性向题材',
    icon: Swords,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    genres: [
      { id: 'zhan-shen-long-wang', label: '战神/龙王', desc: '隐世强者一朝曝光震惊全场' },
      { id: 'zhui-xu-ni-xi', label: '赘婿逆袭', desc: '入赘受辱后逆袭翻盘' },
      { id: 'xiu-xian-xi-tong', label: '修仙/系统流', desc: '绑定系统一路打怪升级' },
      { id: 'du-shi-chuang-ye', label: '都市创业', desc: '重生回到过去白手起家' },
    ],
  },
  reality: {
    label: '现实与社会题材',
    icon: Users,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    genres: [
      { id: 'jia-ting-lun-li', label: '家庭伦理', desc: '婆媳矛盾、财产纷争、养老育儿' },
      { id: 'zhi-chang-sheng-cun', label: '职场生存', desc: '打工人逆袭、裁员反击' },
      { id: 'yin-fa-ai-qing', label: '银发爱情', desc: '中老年情感题材' },
    ],
  },
  suspense: {
    label: '悬疑与脑洞类',
    icon: Eye,
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    genres: [
      { id: 'xuan-yi-tan-an', label: '悬疑探案', desc: '层层解谜、关键反转' },
      { id: 'ke-huan-mo-shi', label: '科幻/末世', desc: '人机恋、末世生存' },
      { id: 'gu-zhuang-xian-xia', label: '古装仙侠', desc: '仙侠世界、玄幻冒险' },
    ],
  },
  special: {
    label: '特殊题材',
    icon: Sparkles,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    genres: [
      { 
        id: 'meng-chong-feng', 
        label: '萌宠风', 
        desc: '宠物拟人化、反差萌、治愈暖心',
      },
    ],
  },
};

// 获取所有题材的扁平列表
const ALL_GENRES: GenreItem[] = Object.values(GENRE_CATEGORIES).flatMap(cat => cat.genres);

// 景别映射
const shotTypeMap: Record<string, string> = {
  'close-up': '特写',
  'medium': '中景',
  'long': '远景',
  'full': '全景',
};

export default function ConfigPage() {
  // 配置输入
  const [selectedGenreId, setSelectedGenreId] = useState('ba-zong-tian-chong');
  const [conflict, setConflict] = useState('');
  const [characterCount, setCharacterCount] = useState<number>(0); // 0表示AI自动决定

  // 生成的角色
  const [characters, setCharacters] = useState<Character[]>([]);
  
  // 生成的分镜
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  
  // 生成的标题
  const [title, setTitle] = useState('');
  
  // 角色关系
  const [relationships, setRelationships] = useState('');

  // 加载状态
  const [isGeneratingCharacters, setIsGeneratingCharacters] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  // 错误状态
  const [error, setError] = useState<string | null>(null);

  // 获取当前选中的题材
  const selectedGenre = ALL_GENRES.find(g => g.id === selectedGenreId) || ALL_GENRES[0];
  
  // 获取当前题材所属分类
  const getCurrentCategory = () => {
    for (const [, category] of Object.entries(GENRE_CATEGORIES)) {
      if (category.genres.some(g => g.id === selectedGenreId)) {
        return category;
      }
    }
    return GENRE_CATEGORIES.female;
  };
  const currentCategory = getCurrentCategory();
  const CategoryIcon = currentCategory.icon;

  // 生成角色档案
  const generateCharacters = async () => {
    if (!conflict.trim()) {
      setError('请输入核心冲突');
      return;
    }

    setIsGeneratingCharacters(true);
    setError(null);
    setProgress(0);
    setProgressText('正在分析核心冲突...');

    // 模拟进度
    const progressSteps = [
      { progress: 20, text: '正在分析核心冲突...' },
      { progress: 40, text: '正在构思角色性格...' },
      { progress: 60, text: '正在设计角色外貌...' },
      { progress: 80, text: '正在建立角色关系...' },
      { progress: 95, text: '正在生成角色档案...' },
    ];
    
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setProgress(progressSteps[stepIndex].progress);
        setProgressText(progressSteps[stepIndex].text);
        stepIndex++;
      }
    }, 800);

    try {
      const response = await fetch('/api/generate-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genre: selectedGenre.label, 
          conflict, 
          characterCount // 0表示AI自动决定，否则按指定数量生成
        })
      });

      clearInterval(progressInterval);
      setProgress(100);
      setProgressText('生成完成！');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      if (data.characters) {
        setCharacters(data.characters);
        setRelationships(data.relationships || '');
      } else if (data.rawContent) {
        throw new Error(data.error || 'AI返回格式异常，请重试');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : '生成角色失败');
    } finally {
      setIsGeneratingCharacters(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText('');
      }, 1000);
    }
  };

  // 生成分镜剧本
  const generateStoryboards = async () => {
    if (characters.length === 0) {
      setError('请先生成角色档案');
      return;
    }

    setIsGeneratingScript(true);
    setError(null);
    setProgress(0);
    setProgressText('正在分析角色关系...');

    const progressSteps = [
      { progress: 15, text: '正在分析角色关系...' },
      { progress: 30, text: '正在规划故事节奏...' },
      { progress: 45, text: '正在设计分镜画面...' },
      { progress: 60, text: '正在编写台词对白...' },
      { progress: 75, text: '正在配置音效BGM...' },
      { progress: 90, text: '正在生成分镜剧本...' },
    ];
    
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setProgress(progressSteps[stepIndex].progress);
        setProgressText(progressSteps[stepIndex].text);
        stepIndex++;
      }
    }, 600);

    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genre: selectedGenre.label, 
          conflict, 
          characters 
        })
      });

      clearInterval(progressInterval);
      setProgress(100);
      setProgressText('生成完成！');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      if (data.storyboards) {
        setStoryboards(data.storyboards);
        setTitle(data.title || `${selectedGenre.label}短剧`);
      } else if (data.rawContent) {
        throw new Error(data.error || 'AI返回格式异常，请重试');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : '生成剧本失败');
    } finally {
      setIsGeneratingScript(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText('');
      }, 1000);
    }
  };

  // 复制内容
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 导出配置
  const exportConfig = () => {
    const config = {
      title,
      genre: selectedGenre.label,
      conflict,
      characters,
      storyboards,
      relationships,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Header with Aurora Gradient */}
        <div className="workspace-hero relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 p-8 mb-2">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-violet-300/30 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-white" />
                </div>
                交互式配置工具
              </h1>
              <p className="text-white/80 mt-2">
                AI 驱动的角色档案和剧本生成
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={exportConfig} 
                disabled={characters.length === 0}
                className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Download className="h-4 w-4" />
                导出配置
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="glass-card rounded-xl border border-destructive/50 bg-destructive/5 animate-fade-in-up p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              关闭
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        {(isGeneratingCharacters || isGeneratingScript) && (
          <div className="glass-card rounded-xl border border-indigo-500/30 bg-indigo-500/5 animate-fade-in-up p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{progressText}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isGeneratingCharacters ? 'AI 正在创作角色档案' : 'AI 正在创作分镜剧本'}
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono bg-gradient-to-r from-indigo-500/10 to-violet-500/10">
                  {progress}%
                </Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Input Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* 基础配置 */}
            <div className="glass-card rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold flex items-center gap-2 text-base">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", currentCategory.bgColor)}>
                    <CategoryIcon className={cn("h-4 w-4", currentCategory.iconColor)} />
                  </div>
                  基础配置
                </h2>
                <p className="text-muted-foreground text-sm mt-1">选择题材并描述核心冲突</p>
              </div>
              <div className="p-4 space-y-4">
                {/* 题材选择 */}
                <div className="space-y-3">
                  <Label className="text-sm flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    题材类型
                  </Label>
                  
                  {/* 分类选择器 */}
                  <div className="space-y-2">
                    {Object.entries(GENRE_CATEGORIES).map(([key, category]) => {
                      const Icon = category.icon;
                      const isCurrentCategory = category.genres.some(g => g.id === selectedGenreId);
                      
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={cn("h-3.5 w-3.5", category.iconColor)} />
                            <span className="text-xs font-medium text-muted-foreground">
                              {category.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {category.genres.map((genre) => (
                              <TooltipProvider key={genre.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant={selectedGenreId === genre.id ? "default" : "outline"}
                                      className={cn(
                                        "cursor-pointer transition-all text-xs",
                                        selectedGenreId === genre.id 
                                          ? "bg-primary text-primary-foreground" 
                                          : "hover:bg-muted"
                                      )}
                                      onClick={() => setSelectedGenreId(genre.id)}
                                    >
                                      {genre.label}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px]">
                                    <p className="text-xs">{genre.desc}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* 人物数量 */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    人物数量
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 0, label: 'AI自动', desc: '根据冲突自动决定' },
                      { value: 2, label: '2人', desc: '双人对手戏' },
                      { value: 3, label: '3人', desc: '三角关系' },
                      { value: 4, label: '4人', desc: '群像剧' },
                      { value: 5, label: '5人', desc: '多线叙事' },
                      { value: 6, label: '6人+', desc: '大型群像' },
                    ].map((option) => (
                      <TooltipProvider key={option.value}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={characterCount === option.value ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer transition-all text-xs",
                                characterCount === option.value 
                                  ? "bg-primary text-primary-foreground" 
                                  : "hover:bg-muted"
                              )}
                              onClick={() => setCharacterCount(option.value)}
                            >
                              {option.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{option.desc}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                  {characterCount === 0 && (
                    <p className="text-xs text-muted-foreground">
                      AI 将根据核心冲突自动决定角色数量
                    </p>
                  )}
                </div>

                <Separator />

                {/* 核心冲突 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      核心冲突 <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {conflict.length}字
                    </span>
                  </div>
                  <Textarea
                    placeholder="详细描述短剧的核心冲突...&#10;&#10;例如：&#10;【开篇钩子】女主被按在斩仙台上...&#10;【阵营对立】魔教、正道、皇室..."
                    value={conflict}
                    onChange={(e) => setConflict(e.target.value)}
                    rows={6}
                    className="min-h-[140px] text-sm leading-relaxed resize-none"
                  />
                </div>

                {/* 操作按钮 */}
                <div className="space-y-2 pt-2">
                  <Button 
                    onClick={generateCharacters} 
                    disabled={isGeneratingCharacters || isGeneratingScript}
                    className="w-full gap-2"
                  >
                    {isGeneratingCharacters ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        AI 生成角色档案
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={generateStoryboards} 
                    variant="secondary"
                    disabled={characters.length === 0 || isGeneratingCharacters || isGeneratingScript}
                    className="w-full gap-2"
                  >
                    {isGeneratingScript ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Film className="h-4 w-4" />
                        AI 生成分镜剧本
                        {characters.length > 0 && <ArrowRight className="h-3.5 w-3.5" />}
                      </>
                    )}
                  </Button>
                </div>

                {/* 状态提示 */}
                {characters.length === 0 && !isGeneratingCharacters && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-r from-indigo-500/5 to-violet-500/5 border border-indigo-500/10">
                    <AlertCircle className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      提示：请先填写核心冲突，点击「生成角色档案」，再生成「分镜剧本」
                    </p>
                  </div>
                )}

                {characters.length > 0 && storyboards.length === 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-green-600">
                      角色档案已生成，点击「生成分镜剧本」继续
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 快捷统计 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{characters.length}</p>
                    <p className="text-xs text-muted-foreground">角色档案</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center">
                    <Film className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{storyboards.length}</p>
                    <p className="text-xs text-muted-foreground">分镜剧本</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Output Section */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="characters" className="space-y-4">
              <TabsList className="w-full overflow-x-auto flex-nowrap justify-start bg-white/10 backdrop-blur-xl border border-white/20 p-1">
                <TabsTrigger value="characters" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-500 data-[state=active]:text-white">
                  <Users className="h-4 w-4" />
                  角色档案
                  {characters.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-white/10">
                      {characters.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="storyboards" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-500 data-[state=active]:text-white">
                  <Film className="h-4 w-4" />
                  分镜剧本
                  {storyboards.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-white/10">
                      {storyboards.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Characters Tab */}
              <TabsContent value="characters" className="m-0">
                {characters.length === 0 ? (
                  <div className="glass-card rounded-xl border border-dashed border-white/20 bg-white/10 backdrop-blur-xl p-8">
                    <EmptyState 
                      type="default"
                      title="暂无角色档案"
                      description='填写核心冲突后，点击「AI 生成角色档案」开始创作'
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 角色关系 */}
                    {relationships && (
                      <div className="glass-card rounded-xl border border-indigo-500/30 bg-indigo-500/5 animate-fade-in-up p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center shrink-0">
                            <Heart className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">角色关系</p>
                            <p className="text-sm text-muted-foreground mt-1">{relationships}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 角色卡片 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {characters.map((char, index) => (
                        <div key={char.id} className="glass-card card-hover animate-fade-in-up rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden" style={{ animationDelay: `${index * 100}ms` }}>
                          <div className="p-4 border-b border-white/10">
                            <div className="flex items-center justify-between">
                              <h3 className="text-base font-semibold flex items-center gap-2">
                                <Badge 
                                  className={char.gender === 'male' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gradient-to-r from-pink-500 to-rose-500'}
                                >
                                  {char.gender === 'male' ? '男' : '女'}
                                </Badge>
                                {char.name}
                              </h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const text = `【角色${index + 1}】
姓名：${char.name}
性别：${char.gender === 'male' ? '男' : '女'}
年龄：${char.age}岁
脸型：${char.faceShape}
发型：${char.hairstyle}
服装：${char.clothing}
肤色气质：${char.skinTone}，${char.temperament}
微动作：${char.microActions?.join('、')}`;
                                  copyToClipboard(text);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="p-4 space-y-3 text-sm">
                            {/* 基本属性 */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">年龄：</span>
                                <span>{char.age}岁</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Palette className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">脸型：</span>
                                <span>{char.faceShape}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Palette className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">发型：</span>
                                <span className="truncate">{char.hairstyle}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Palette className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">服装：</span>
                                <span className="truncate">{char.clothing}</span>
                              </div>
                            </div>

                            <Separator />

                            {/* 气质 */}
                            <div>
                              <span className="text-muted-foreground text-xs">气质：</span>
                              <span className="ml-1">{char.temperament}</span>
                            </div>

                            {/* 微动作 */}
                            {char.microActions && char.microActions.length > 0 && (
                              <div>
                                <span className="text-muted-foreground text-xs">微动作：</span>
                                <span className="ml-1">{char.microActions.join('、')}</span>
                              </div>
                            )}

                            <Separator className="bg-white/10" />

                            {/* 情绪配置 */}
                            <div>
                              <span className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                                <Volume2 className="h-3 w-3" />
                                情绪强度配置
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-xs border-white/20">
                                  平静 {char.emotionRules?.calm || 30}%
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-500/20">
                                  开心 {char.emotionRules?.happy || 50}%
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-500/20">
                                  委屈 {char.emotionRules?.aggrieved || 45}%
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-gradient-to-r from-red-500/10 to-rose-500/10 text-red-600 border-red-500/20">
                                  生气 {char.emotionRules?.angry || 65}%
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Storyboards Tab */}
              <TabsContent value="storyboards" className="m-0">
                {storyboards.length === 0 ? (
                  <div className="glass-card rounded-xl border border-dashed border-white/20 bg-white/10 backdrop-blur-xl p-8">
                    <EmptyState 
                      type="default"
                      title={characters.length === 0 ? "请先生成角色档案" : "暂无分镜剧本"}
                      description={
                        characters.length === 0 
                          ? '角色档案是分镜剧本的基础，请先完成角色创作'
                          : '点击「AI 生成分镜剧本」开始创作'
                      }
                    />
                  </div>
                ) : (
                  <div className="glass-card animate-fade-in-up rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">{title}</h2>
                          <p className="text-muted-foreground text-sm flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              <CategoryIcon className={cn("h-3.5 w-3.5", currentCategory.iconColor)} />
                              {selectedGenre.label}
                            </span>
                            <span className="flex items-center gap-1">
                              <Film className="h-3.5 w-3.5" />
                              {storyboards.length} 个分镜
                            </span>
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const text = storyboards.map(sb => 
                              `【分镜${sb.sequence}】\n时间：${sb.time}\n景别：${shotTypeMap[sb.shotType] || sb.shotType}\n情绪：${sb.emotion}\n画面：${sb.visualDescription}\n台词：${sb.dialogue}`
                            ).join('\n\n');
                            copyToClipboard(text);
                          }}
                          className="gap-2 border-white/20 bg-white/10 hover:bg-white/20"
                        >
                          <Copy className="h-4 w-4" />
                          复制全部
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-3">
                        {storyboards.map((sb, index) => (
                          <div 
                            key={sb.id} 
                            className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors animate-fade-in-up"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            {/* 分镜头部 */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <Badge variant="default" className="font-mono">
                                #{sb.sequence}
                              </Badge>
                              <Badge variant="secondary" className="gap-1">
                                {sb.time}
                              </Badge>
                              <Badge variant="outline">
                                {shotTypeMap[sb.shotType] || sb.shotType}
                              </Badge>
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                                {sb.emotion}
                              </Badge>
                              <div className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const text = `序号：${sb.sequence}
时间：${sb.time}
景别：${shotTypeMap[sb.shotType] || sb.shotType}
人物：${sb.characters?.join('、')}
情绪：${sb.emotion}
画面：${sb.visualDescription}
台词：${sb.dialogue}`;
                                  copyToClipboard(text);
                                }}
                                className="h-7 w-7 p-0"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* 人物和BGM */}
                            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">人物：</span>
                                <span>{sb.characters?.join('、')}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Volume2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">BGM：</span>
                                <span className="truncate">{sb.bgm}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Volume2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">音效：</span>
                                <span className="truncate">{sb.soundEffects}</span>
                              </div>
                            </div>

                            {/* 画面描述 */}
                            <div className="text-sm mb-2">
                              <span className="text-muted-foreground text-xs">画面：</span>
                              <span className="ml-1">{sb.visualDescription}</span>
                            </div>

                            {/* 台词 */}
                            <div className="p-2.5 rounded-lg bg-gradient-to-r from-indigo-500/5 to-violet-500/5 border border-indigo-500/10 text-sm">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                <span>{sb.dialogue}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
