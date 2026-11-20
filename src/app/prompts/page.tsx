'use client';

import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Search, Tag, Star, Heart, Clock, Download, Filter, Bookmark, BookmarkCheck, ExternalLink, FileText, BookOpen, Sparkles, Settings as SettingsIcon, User, Video, Mic, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import { promptsData, promptCategories, type Prompt } from '@/lib/prompts-data';

// 分类视觉元数据：图标 + 渐变（与全站工具页风格统一）
const CATEGORY_META: Record<string, { icon: typeof FileText; gradient: string }> = {
  all: { icon: Sparkles, gradient: 'from-violet-500 to-purple-500' },
  system: { icon: SettingsIcon, gradient: 'from-slate-500 to-gray-600' },
  character: { icon: User, gradient: 'from-fuchsia-500 to-pink-500' },
  script: { icon: FileText, gradient: 'from-sky-500 to-blue-500' },
  video: { icon: Video, gradient: 'from-amber-500 to-orange-500' },
  voice: { icon: Mic, gradient: 'from-emerald-500 to-teal-500' },
  editing: { icon: Scissors, gradient: 'from-rose-500 to-red-500' },
};

const getCategoryMeta = (category: string) => CATEGORY_META[category] || CATEGORY_META.all;

const getCategoryLabel = (category: string) => {
  const cat = promptCategories.find(c => c.id === category);
  return cat?.label || category;
};

export default function PromptsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('prompt-favorites') || '[]');
    }
    return [];
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Persist favorites
  useEffect(() => {
    localStorage.setItem('prompt-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) 
      ? prev.filter(f => f !== id) 
      : [...prev, id]
    );
  };

  const copyPrompt = (prompt: Prompt) => {
    navigator.clipboard.writeText(prompt.content);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadPrompt = (prompt: Prompt) => {
    const content = `# ${prompt.title}\n\n${prompt.description}\n\n## 内容\n\n${prompt.content}\n\n---\n标签: ${prompt.tags.join(', ')}\n分类: ${prompt.category}\n使用次数: ${prompt.usage}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prompt.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredPrompts = useMemo(() => {
    let result = promptsData;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (showOnlyFavorites) {
      result = result.filter(p => favorites.includes(p.id));
    }

    return result;
  }, [searchQuery, selectedCategory, favorites, showOnlyFavorites]);

  const stats = {
    total: promptsData.length,
    totalUsage: promptsData.reduce((acc, p) => acc + p.usage, 0),
    totalTags: new Set(promptsData.flatMap(p => p.tags)).size,
    totalCategories: promptCategories.length - 1,
    favoritesCount: favorites.length,
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-8">
        {/* Header - 淡彩 hero，与全站工具页统一 */}
        <div className="workspace-hero relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">提示词库</h1>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                短剧全流程提示词模板，覆盖系统、角色、剧本、视频、配音与剪辑，复制即用
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowOnlyFavorites(!showOnlyFavorites)} className={cn(showOnlyFavorites && 'bg-primary text-primary-foreground')}>
                <Heart className="h-4 w-4 mr-1 fill-current" />
                收藏 ({stats.favoritesCount})
              </Button>
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1" role="radiogroup">
                <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} aria-label="网格视图">
                  <div className="w-5 h-5 grid grid-cols-2 gap-0.5">
                    <div className="bg-muted-foreground/30 rounded" />
                    <div className="bg-muted-foreground/30 rounded" />
                    <div className="bg-muted-foreground/30 rounded" />
                    <div className="bg-muted-foreground/30 rounded" />
                  </div>
                </Button>
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} aria-label="列表视图">
                  <div className="w-5 h-5 flex flex-col gap-0.5">
                    <div className="bg-muted-foreground/30 h-1 rounded w-full" />
                    <div className="bg-muted-foreground/30 h-1 rounded w-full" />
                    <div className="bg-muted-foreground/30 h-1 rounded w-full" />
                    <div className="bg-muted-foreground/30 h-1 rounded w-full" />
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard title="提示词总数" value={stats.total} icon={<FileText className="h-5 w-5" />} gradient="from-blue-500 to-cyan-500" />
          <StatCard title="总使用次数" value={stats.totalUsage.toLocaleString()} icon={<Clock className="h-5 w-5" />} gradient="from-emerald-500 to-teal-500" />
          <StatCard title="标签数量" value={stats.totalTags} icon={<Tag className="h-5 w-5" />} gradient="from-purple-500 to-fuchsia-500" />
          <StatCard title="分类数量" value={stats.totalCategories} icon={<Bookmark className="h-5 w-5" />} gradient="from-orange-500 to-amber-500" />
          <StatCard title="收藏数量" value={stats.favoritesCount} icon={<Heart className="h-5 w-5 fill-current" />} gradient="from-rose-500 to-pink-500" />
        </div>

        {/* Search and Filter */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 lg:gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索提示词标题、内容、标签... (按 / 聚焦)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.currentTarget.blur(); setSearchQuery(''); }} }
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="w-full overflow-x-auto flex-nowrap bg-muted/50 p-1 rounded-lg">
                  {promptCategories.map(cat => {
                    const meta = getCategoryMeta(cat.id);
                    const CatIcon = meta.icon;
                    return (
                      <TabsTrigger
                        key={cat.id}
                        value={cat.id}
                        className="text-xs whitespace-nowrap gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
                      >
                        <CatIcon className="h-3.5 w-3.5" />
                        {cat.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Prompts List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPrompts.map((prompt) => (
              <PromptCard 
                key={prompt.id} 
                prompt={prompt} 
                isFavorite={favorites.includes(prompt.id)}
                onToggleFavorite={toggleFavorite}
                onCopy={copyPrompt}
                onDownload={downloadPrompt}
                copiedId={copiedId}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPrompts.map((prompt) => (
              <PromptListItem 
                key={prompt.id} 
                prompt={prompt} 
                isFavorite={favorites.includes(prompt.id)}
                onToggleFavorite={toggleFavorite}
                onCopy={copyPrompt}
                onDownload={downloadPrompt}
                copiedId={copiedId}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredPrompts.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">未找到匹配的提示词</p>
            <p className="text-sm mt-1">尝试调整搜索条件、筛选分类或取消收藏筛选</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setShowOnlyFavorites(false); }}>
              重置筛选
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function StatCard({ title, value, icon, gradient }: { title: string; value: string | number; icon: React.ReactNode; gradient: string }) {
  return (
    <div className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </div>
    </div>
  );
}

function PromptCard({ prompt, isFavorite, onToggleFavorite, onCopy, onDownload, copiedId }: { 
  prompt: Prompt; 
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onCopy: (prompt: Prompt) => void;
  onDownload: (prompt: Prompt) => void;
  copiedId: string | null;
}) {
  const meta = getCategoryMeta(prompt.category);
  const CatIcon = meta.icon;
  return (
    <div className="group hover:shadow-md transition-all duration-300 rounded-xl border bg-card hover:border-primary/30 overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className={`p-1.5 rounded-lg bg-gradient-to-br ${meta.gradient} text-white shadow-sm flex-shrink-0`}>
                <CatIcon className="h-4 w-4" />
              </span>
              <span className="truncate">{prompt.title}</span>
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{prompt.description}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onToggleFavorite(prompt.id)} className={cn(isFavorite && 'text-red-500')}>
              {isFavorite ? <Heart className="h-4 w-4 fill-current" /> : <Heart className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDownload(prompt)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onCopy(prompt)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              {copiedId === prompt.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4 pt-0 space-y-3">
        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {prompt.tags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        
        {/* Content Preview */}
        <div className="bg-muted/40 rounded-lg p-3 max-h-40 overflow-hidden relative border border-border">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
            {prompt.content.slice(0, 300)}
            {prompt.content.length > 300 && '...'}
          </pre>
          {prompt.content.length > 300 && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              使用 {prompt.usage} 次
            </span>
            <Badge variant="outline" className="text-xs">{getCategoryLabel(prompt.category)}</Badge>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" size="sm" className="h-auto p-0 text-primary hover:text-primary/80">
                查看完整内容
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}>
                    <CatIcon className="h-4 w-4" />
                  </span>
                  {prompt.title}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{prompt.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono">{prompt.content}</pre>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => onCopy(prompt)} className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90">
                      {copiedId === prompt.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          复制提示词
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => onDownload(prompt)}>
                      <Download className="h-4 w-4 mr-2" />
                      下载
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

function PromptListItem({ prompt, isFavorite, onToggleFavorite, onCopy, onDownload, copiedId }: { 
  prompt: Prompt; 
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onCopy: (prompt: Prompt) => void;
  onDownload: (prompt: Prompt) => void;
  copiedId: string | null;
}) {
  const meta = getCategoryMeta(prompt.category);
  const CatIcon = meta.icon;
  return (
    <div className="group hover:shadow-md transition-all rounded-xl border bg-card hover:border-primary/30 p-4">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.gradient} text-white flex items-center justify-center shrink-0 shadow-sm`}>
          <CatIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{prompt.title}</h3>
            <Badge variant="outline" className="text-xs">{getCategoryLabel(prompt.category)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{prompt.description}</p>
          <div className="flex flex-wrap gap-1">
            {prompt.tags.slice(0, 4).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
            {prompt.tags.length > 4 && <Badge variant="outline" className="text-xs">+{prompt.tags.length - 4}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {prompt.usage}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onToggleFavorite(prompt.id)} className={cn(isFavorite && 'text-red-500')}>
            {isFavorite ? <Heart className="h-4 w-4 fill-current" /> : <Heart className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDownload(prompt)}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onCopy(prompt)}>
            {copiedId === prompt.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
