'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Scissors,
  Plus,
  Trash2,
  Play,
  Pause,
  Download,
  Film,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Video,
  Settings2,
  Copy,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Maximize2,
  MoreVertical,
  ImageDown,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Storyboard {
  id: string;
  sequence: number;
  time: string;
  shotType: string;
  description: string;
  duration: number;
  assetId?: string;
  assetUrl?: string;
  transition?: string;
  dialogue?: string;
}

interface VideoAsset {
  id: string;
  title: string;
  fileName: string;
  duration: number;
  videoUrl: string;
  thumbnailUrl?: string;
}

// 预设转场效果
const TRANSITIONS = [
  { value: 'fade', label: '淡入淡出' },
  { value: 'dissolve', label: '溶解' },
  { value: 'wipe', label: '擦除' },
  { value: 'zoom', label: '缩放' },
  { value: 'slide', label: '滑动' },
  { value: 'circle', label: '圆形展开' },
  { value: 'glitch', label: '故障效果' },
];

// 预设景别
const SHOT_TYPES = [
  '特写', '近景', '中景', '全景', '远景', '大远景', '仰拍', '俯拍'
];

export default function EditorPage() {
  // 项目状态
  const [title, setTitle] = useState('未命名项目');
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [selectedStoryboardId, setSelectedStoryboardId] = useState<string | null>(null);
  
  // 项目执行状态
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('draft');
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  
  // 播放器状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // 对话框
  const [scriptDialog, setScriptDialog] = useState<{ open: boolean; script: string; downloadUrl?: string }>({
    open: false,
    script: '',
  });

  // 选中的分镜
  const selectedStoryboard = storyboards.find(sb => sb.id === selectedStoryboardId);

  // 加载视频素材
  const loadAssets = useCallback(async () => {
    try {
      const response = await fetch('/api/videos', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setAssets(data.videos);
      }
    } catch (error) {
      console.error('加载素材失败:', error);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // 添加分镜
  const addStoryboard = () => {
    const newSb: Storyboard = {
      id: `sb-${Date.now()}`,
      sequence: storyboards.length + 1,
      time: `${storyboards.length * 5}-${storyboards.length * 5 + 5}秒`,
      shotType: '中景',
      description: '',
      duration: 5,
      transition: 'fade',
    };
    setStoryboards(prev => [...prev, newSb]);
    setSelectedStoryboardId(newSb.id);
  };

  // 更新分镜
  const updateStoryboard = (id: string, updates: Partial<Storyboard>) => {
    setStoryboards(prev => prev.map(sb => sb.id === id ? { ...sb, ...updates } : sb));
  };

  // 删除分镜
  const removeStoryboard = (id: string) => {
    setStoryboards(prev => {
      const filtered = prev.filter(sb => sb.id !== id);
      return filtered.map((sb, i) => ({ ...sb, sequence: i + 1 }));
    });
    if (selectedStoryboardId === id) {
      setSelectedStoryboardId(null);
    }
  };

  // 移动分镜位置
  const moveStoryboard = (id: string, direction: 'left' | 'right') => {
    const index = storyboards.findIndex(sb => sb.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= storyboards.length) return;
    
    const newStoryboards = [...storyboards];
    [newStoryboards[index], newStoryboards[newIndex]] = [newStoryboards[newIndex], newStoryboards[index]];
    setStoryboards(newStoryboards.map((sb, i) => ({ ...sb, sequence: i + 1 })));
  };

  // 绑定素材到分镜
  const bindAssetToStoryboard = (storyboardId: string, assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      updateStoryboard(storyboardId, {
        assetId: asset.id,
        assetUrl: asset.videoUrl,
        description: asset.title,
        duration: asset.duration || 5,
      });
    }
  };

  // 保存项目
  const saveProject = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/edit/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        body: JSON.stringify({
          title,
          description: '视频剪辑项目',
          config: { storyboards },
          assets: storyboards
            .filter(sb => sb.assetId)
            .map(sb => ({
              type: 'video',
              fileKey: sb.assetId,
              duration: sb.duration,
            })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setProjectId(data.project.id);
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSaving(false);
    }
  };

  // 执行剪辑
  const executeEdit = async () => {
    if (!projectId) {
      await saveProject();
      if (!projectId) return;
    }

    setExecuting(true);
    setStatus('processing');
    setProgress(0);

    try {
      const response = await fetch(`/api/edit/projects/${projectId}/execute`, {
        method: 'POST',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });

      const data = await response.json();

      if (data.success) {
        setStatus('completed');
        setProgress(100);
        if (data.project?.outputUrl) {
          setOutputUrl(data.project.outputUrl);
        }
      } else if (!data.ffmpegAvailable) {
        setScriptDialog({
          open: true,
          script: data.script,
          downloadUrl: data.downloadUrl,
        });
        setStatus('draft');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('执行失败:', error);
      setStatus('error');
    } finally {
      setExecuting(false);
    }
  };

  // 播放控制
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // 计算总时长
  const totalDuration = storyboards.reduce((sum, sb) => sum + sb.duration, 0);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // 时间轴标记
  const timelineMarkers = storyboards.map((sb, index) => {
    const start = storyboards.slice(0, index).reduce((sum, s) => sum + s.duration, 0);
    const width = (sb.duration / totalDuration) * 100;
    return { id: sb.id, start, width, sequence: sb.sequence };
  });

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-48 h-9 text-sm bg-background"
              placeholder="项目名称"
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>总时长: {formatDuration(totalDuration)}</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{storyboards.length} 个镜头</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'completed' && outputUrl && (
              <Button asChild size="sm" variant="default">
                <a href={outputUrl} download={`${title}.mp4`}>
                  <Download className="h-4 w-4 mr-1" />
                  下载视频
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={saveProject} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              保存
            </Button>
            <Button 
              size="sm" 
              onClick={executeEdit} 
              disabled={executing || storyboards.length === 0}
            >
              {executing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Scissors className="h-4 w-4 mr-1" />}
              导出视频
            </Button>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* 左侧：素材库 */}
          <div className="col-span-3 flex flex-col border rounded-lg overflow-hidden bg-card">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Video className="h-4 w-4" />
                素材库
              </span>
              <Badge variant="secondary" className="text-xs">{assets.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {assets.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>暂无素材</p>
                  </div>
                ) : (
                  assets.map(asset => (
                    <div
                      key={asset.id}
                      className="group rounded border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                      onClick={() => {
                        if (selectedStoryboardId) {
                          bindAssetToStoryboard(selectedStoryboardId, asset.id);
                        }
                      }}
                    >
                      <div className="aspect-video bg-black/20 overflow-hidden relative">
                        {asset.videoUrl ? (
                          <video
                            src={asset.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-6 w-6 opacity-50" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                          {formatDuration(asset.duration || 0)}
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-xs truncate">{asset.title}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 中间：预览区 */}
          <div className="col-span-5 flex flex-col border rounded-lg overflow-hidden bg-card">
            {/* 预览窗口 */}
            <div className="flex-1 bg-black relative flex items-center justify-center">
              {selectedStoryboard?.assetUrl ? (
                <video
                  ref={videoRef}
                  src={selectedStoryboard.assetUrl}
                  className="max-h-full max-w-full"
                  onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Film className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">选择分镜预览</p>
                </div>
              )}
            </div>
            
            {/* 播放控制 */}
            <div className="p-2 border-t bg-muted/30">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStoryboard(selectedStoryboardId!, 'left')} disabled={!selectedStoryboardId}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay} disabled={!selectedStoryboard?.assetUrl}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStoryboard(selectedStoryboardId!, 'right')} disabled={!selectedStoryboardId}>
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDuration(currentTime)} / {formatDuration(selectedStoryboard?.duration || 0)}
                </span>
              </div>
            </div>

            {/* 时间轴 */}
            {storyboards.length > 0 && (
              <div className="p-2 border-t bg-muted/20">
                <div className="h-8 bg-muted/50 rounded flex overflow-hidden">
                  {timelineMarkers.map(marker => (
                    <div
                      key={marker.id}
                      className={cn(
                        "h-full flex items-center justify-center text-xs cursor-pointer transition-colors border-r border-background/50 last:border-0",
                        selectedStoryboardId === marker.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted hover:bg-muted/80"
                      )}
                      style={{ width: `${marker.width}%` }}
                      onClick={() => setSelectedStoryboardId(marker.id)}
                    >
                      #{marker.sequence}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：分镜列表 */}
          <div className="col-span-4 flex flex-col border rounded-lg overflow-hidden bg-card">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Film className="h-4 w-4" />
                分镜列表
              </span>
              <Button size="sm" variant="outline" onClick={addStoryboard} className="h-7">
                <Plus className="h-3 w-3 mr-1" />
                添加
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {storyboards.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    <Film className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>点击&ldquo;添加&rdquo;创建分镜</p>
                  </div>
                ) : (
                  storyboards.map(sb => (
                    <div
                      key={sb.id}
                      className={cn(
                        "rounded border cursor-pointer transition-all",
                        selectedStoryboardId === sb.id 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "bg-muted/30 hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedStoryboardId(sb.id)}
                    >
                      <div className="p-2 space-y-2">
                        {/* 头部：序号和操作 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <Badge variant="secondary" className="text-xs">#{sb.sequence}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDuration(sb.duration)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={e => { e.stopPropagation(); moveStoryboard(sb.id, 'left'); }}
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={e => { e.stopPropagation(); moveStoryboard(sb.id, 'right'); }}
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={e => { e.stopPropagation(); removeStoryboard(sb.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* 内容：景别、转场、素材 */}
                        {selectedStoryboardId === sb.id && (
                          <div className="space-y-2 pt-1 border-t">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs text-muted-foreground">景别</Label>
                                <Select value={sb.shotType} onValueChange={v => updateStoryboard(sb.id, { shotType: v })}>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SHOT_TYPES.map(type => (
                                      <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">转场</Label>
                                <Select value={sb.transition || 'fade'} onValueChange={v => updateStoryboard(sb.id, { transition: v })}>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TRANSITIONS.map(t => (
                                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">时长(秒)</Label>
                              <Input 
                                type="number" 
                                value={sb.duration} 
                                onChange={e => updateStoryboard(sb.id, { duration: parseInt(e.target.value) || 5 })}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">绑定素材</Label>
                              <Select value={sb.assetId || ''} onValueChange={v => bindAssetToStoryboard(sb.id, v)}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="选择素材..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {assets.map(a => (
                                    <SelectItem key={a.id} value={a.id || a.title} className="text-xs">{a.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">描述</Label>
                              <Textarea 
                                value={sb.description} 
                                onChange={e => updateStoryboard(sb.id, { description: e.target.value })}
                                rows={2}
                                className="text-xs"
                                placeholder="画面描述..."
                              />
                            </div>
                          </div>
                        )}

                        {/* 素材状态指示 */}
                        {sb.assetId && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-muted-foreground truncate">
                              {assets.find(a => a.id === sb.assetId)?.title}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* 处理状态 */}
        {status === 'processing' && (
          <div className="flex items-center justify-center gap-3 p-4 border rounded-lg bg-card">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">正在处理视频...</p>
              <p className="text-xs text-muted-foreground">进度: {progress}%</p>
            </div>
          </div>
        )}

        {/* 完成状态 */}
        {status === 'completed' && outputUrl && (
          <div className="flex items-center justify-center gap-3 p-4 border border-green-500/30 rounded-lg bg-green-500/10">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium">视频剪辑完成!</p>
            <Button asChild size="sm">
              <a href={outputUrl} download={`${title}.mp4`}>
                <Download className="h-4 w-4 mr-1" />
                下载
              </a>
            </Button>
          </div>
        )}
      </div>

      {/* 脚本对话框 */}
      <Dialog open={scriptDialog.open} onOpenChange={open => setScriptDialog({ ...scriptDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              本地执行脚本
            </DialogTitle>
            <DialogDescription>
              服务器暂不支持视频处理，请下载脚本在本地环境执行
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-96">
                {scriptDialog.script}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(scriptDialog.script)}>
                <Copy className="h-4 w-4 mr-2" />
                复制
              </Button>
              {scriptDialog.downloadUrl && (
                <Button asChild>
                  <a href={scriptDialog.downloadUrl} download="edit_script.sh">
                    <Download className="h-4 w-4 mr-2" />
                    下载脚本
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
