'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { VideoUpload } from '@/components/video/video-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Video,
  Upload,
  Trash2,
  Play,
  Sparkles,
  FileText,
  Clock,
  HardDrive,
  AlertCircle,
  Loader2,
  RefreshCw,
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  Film,
  Clapperboard,
  Sparkle,
  Flag,
  FolderOpen,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoMaterial {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  duration: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  createdAt: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  seriesId?: string | null;
  seriesTitle?: string | null;
  collectionId?: string | null;
  episodeNumber?: number | null;
  hookType?: 'merged' | 'hook' | 'cliffhanger' | 'storyboard' | null;
  sortOrder?: number | null;
}

// 图片素材接口
interface ImageMaterial {
  id: string;
  title: string;
  description: string | null;
  type: string; // character, scene, character-uid, poster, promotional
  category: string | null;
  fileName: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  createdAt: string;
  imageUrl: string;
  seriesId?: string | null;
  seriesTitle?: string | null;
  characterId?: string | null;
  characterName?: string | null;
}

// 按剧本分组的图片
interface ImageSeriesGroup {
  seriesId: string | null;
  seriesTitle: string;
  characterImages: ImageMaterial[];
  sceneImages: ImageMaterial[];
  otherImages: ImageMaterial[];
  totalImages: number;
}

// 获取图片类型标签配置
const getImageTypeConfig = (type?: string) => {
  switch (type) {
    case 'character':
      return { label: '角色立绘', color: 'bg-blue-500/90 text-white' };
    case 'scene':
      return { label: '场景照', color: 'bg-green-500/90 text-white' };
    case 'character-uid':
      return { label: '角色设定', color: 'bg-purple-500/90 text-white' };
    case 'poster':
      return { label: '海报', color: 'bg-amber-500/90 text-white' };
    case 'promotional':
      return { label: '宣传图', color: 'bg-pink-500/90 text-white' };
    default:
      return { label: '其他', color: 'bg-gray-500/90 text-white' };
  }
};

// 按剧集分组的视频
interface EpisodeGroup {
  episodeNumber: number;
  videos: VideoMaterial[];
  mergedVideo: VideoMaterial | null;
  hookVideo: VideoMaterial | null;
  cliffhangerVideo: VideoMaterial | null;
  storyboardVideos: VideoMaterial[];
}

// 按剧本分组
interface SeriesGroup {
  seriesId: string | null;
  seriesTitle: string;
  episodes: EpisodeGroup[];
  totalVideos: number;
  mergedCount: number;
}

// 获取视频类型标签配置
const getVideoTypeConfig = (hookType?: string | null) => {
  switch (hookType) {
    case 'merged':
      return { label: '完整剧集', color: 'bg-green-500/90 text-white', icon: Film };
    case 'hook':
      return { label: '开篇钩子', color: 'bg-amber-500/90 text-white', icon: Sparkle };
    case 'cliffhanger':
      return { label: '结尾悬念', color: 'bg-purple-500/90 text-white', icon: Flag };
    default:
      return { label: '分镜视频', color: 'bg-blue-500/90 text-white', icon: Clapperboard };
  }
};

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 图片管理状态
  const [images, setImages] = useState<ImageMaterial[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [expandedImageSeries, setExpandedImageSeries] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  
  const [selectedVideo, setSelectedVideo] = useState<VideoMaterial | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [renaming, setRenaming] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());
  // 批量选择状态
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // 选择该集所有视频
  const selectEpisodeVideos = useCallback((videos: VideoMaterial[], event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发折叠
    const videoIds = videos.map(v => v.id);
    setSelectedVideoIds(prev => {
      const newSet = new Set(prev);
      const allSelected = videoIds.every(id => newSet.has(id));
      if (allSelected) {
        // 如果全选了，则取消选择
        videoIds.forEach(id => newSet.delete(id));
      } else {
        // 否则选择所有
        videoIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }, []);

  // 选择该剧本所有视频
  const selectSeriesVideos = useCallback((series: SeriesGroup, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发折叠
    const videoIds = series.episodes.flatMap(e => e.videos.map(v => v.id));
    setSelectedVideoIds(prev => {
      const newSet = new Set(prev);
      const allSelected = videoIds.every(id => newSet.has(id));
      if (allSelected) {
        // 如果全选了，则取消选择
        videoIds.forEach(id => newSet.delete(id));
      } else {
        // 否则选择所有
        videoIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }, []);

  // 全选
  const selectAll = useCallback(() => {
    setSelectedVideoIds(new Set(videos.map(v => v.id)));
  }, [videos]);

  // 反选
  const invertSelection = useCallback(() => {
    setSelectedVideoIds(prev => {
      const newSet = new Set<string>();
      videos.forEach(v => {
        if (!prev.has(v.id)) {
          newSet.add(v.id);
        }
      });
      return newSet;
    });
  }, [videos]);

  // 取消选择
  const clearSelection = useCallback(() => {
    setSelectedVideoIds(new Set());
  }, []);

  // 加载视频列表
  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/videos?limit=500', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setVideos(data.videos);
        // 默认展开有合成视频的剧本和剧集
        const mergedSeries = new Set<string>();
        const mergedEpisodes = new Set<string>();
        data.videos.forEach((v: VideoMaterial) => {
          if (v.hookType === 'merged' && v.seriesId) {
            mergedSeries.add(v.seriesId);
            if (v.episodeNumber) {
              mergedEpisodes.add(`${v.seriesId}-${v.episodeNumber}`);
            }
          }
        });
        setExpandedSeries(mergedSeries);
        setExpandedEpisodes(mergedEpisodes);
      }
    } catch (error) {
      console.error('加载视频列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // 加载图片列表
  const loadImages = useCallback(async () => {
    try {
      setImagesLoading(true);
      const response = await fetch('/api/images?limit=500', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setImages(data.images);
        // 默认展开有图片的剧本
        const seriesWithImages = new Set<string>();
        data.images.forEach((img: ImageMaterial) => {
          if (img.seriesId) {
            seriesWithImages.add(img.seriesId);
          }
        });
        setExpandedImageSeries(seriesWithImages);
      }
    } catch (error) {
      console.error('加载图片列表失败:', error);
    } finally {
      setImagesLoading(false);
    }
  }, []);

  // 当切换到图片 Tab 时加载图片
  useEffect(() => {
    if (activeTab === 'images' && images.length === 0) {
      loadImages();
    }
  }, [activeTab, images.length, loadImages]);

  // 按剧本分组图片
  const imageSeriesGroups = useMemo(() => {
    const groups = new Map<string | null, ImageSeriesGroup>();
    
    // 先处理有 seriesId 的图片
    images.forEach(img => {
      const key = img.seriesId || null;
      if (!groups.has(key)) {
        groups.set(key, {
          seriesId: key,
          seriesTitle: img.seriesTitle || '未分类',
          characterImages: [],
          sceneImages: [],
          otherImages: [],
          totalImages: 0,
        });
      }
      const group = groups.get(key)!;
      group.totalImages++;
      
      if (img.type === 'character' || img.type === 'character-uid') {
        group.characterImages.push(img);
      } else if (img.type === 'scene') {
        group.sceneImages.push(img);
      } else {
        group.otherImages.push(img);
      }
    });
    
    // 按图片数量排序
    return Array.from(groups.values()).sort((a, b) => b.totalImages - a.totalImages);
  }, [images]);

  // 按剧本分组
  const seriesGroups = useMemo(() => {
    const groups = new Map<string | null, SeriesGroup>();
    
    for (const video of videos) {
      const seriesKey = video.seriesId || 'other';
      const seriesTitle = video.seriesTitle || '其他视频';
      
      if (!groups.has(seriesKey)) {
        groups.set(seriesKey, {
          seriesId: video.seriesId ?? null,
          seriesTitle,
          episodes: [],
          totalVideos: 0,
          mergedCount: 0,
        });
      }
      
      const group = groups.get(seriesKey)!;
      group.totalVideos++;
      
      if (video.hookType === 'merged') {
        group.mergedCount++;
      }
      
      // 按剧集分组
      const episodeNum = video.episodeNumber || 0;
      let episode = group.episodes.find(e => e.episodeNumber === episodeNum);
      
      if (!episode) {
        episode = {
          episodeNumber: episodeNum,
          videos: [],
          mergedVideo: null,
          hookVideo: null,
          cliffhangerVideo: null,
          storyboardVideos: [],
        };
        group.episodes.push(episode);
      }
      
      episode.videos.push(video);
      
      if (video.hookType === 'merged') {
        episode.mergedVideo = video;
      } else if (video.hookType === 'hook') {
        episode.hookVideo = video;
      } else if (video.hookType === 'cliffhanger') {
        episode.cliffhangerVideo = video;
      } else {
        episode.storyboardVideos.push(video);
      }
    }
    
    // 对每个剧本的剧集排序
    groups.forEach(group => {
      group.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    });
    
    // 按剧本名称排序，有合并视频的排前面
    return Array.from(groups.values())
      .sort((a, b) => {
        if (a.mergedCount !== b.mergedCount) {
          return b.mergedCount - a.mergedCount;
        }
        return a.seriesTitle.localeCompare(b.seriesTitle);
      });
  }, [videos]);

  // 上传完成回调
  const handleUploadComplete = () => {
    loadVideos();
    setActiveTab('list');
  };

  // 删除视频
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个视频吗？')) return;

    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });

      if (response.ok) {
        setVideos(videos.filter((v) => v.id !== id));
        if (selectedVideo?.id === id) {
          setShowDetail(false);
          setSelectedVideo(null);
        }
        toast.success('视频删除成功');
      }
    } catch (error) {
      console.error('删除视频失败:', error);
      toast.error('删除失败');
    }
  };

  // 批量删除视频
  const handleBatchDelete = async () => {
    if (selectedVideoIds.size === 0) {
      toast.error('请先选择要删除的视频');
      return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedVideoIds.size} 个视频吗？此操作不可恢复。`)) return;

    setIsDeleting(true);
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const videoId of selectedVideoIds) {
        try {
          const response = await fetch(`/api/videos/${videoId}`, {
            method: 'DELETE',
            headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      
      // 更新本地状态
      setVideos(videos.filter((v) => !selectedVideoIds.has(v.id)));
      setSelectedVideoIds(new Set());
      
      if (successCount > 0 && failCount === 0) {
        toast.success(`成功删除 ${successCount} 个视频`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`成功删除 ${successCount} 个视频，${failCount} 个失败`);
      } else {
        toast.error('删除失败');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // 切换单个视频选择
  const toggleVideoSelection = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发详情弹窗
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  // 重命名视频
  const handleRename = async (id: string, title: string) => {
    try {
      setRenaming(true);
      const response = await fetch(`/api/videos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        body: JSON.stringify({ title }),
      });
      const data = await response.json();
      if (data.success) {
        setVideos(
          videos.map((v) =>
            v.id === id ? { ...v, title } : v
          )
        );
        if (selectedVideo?.id === id) {
          setSelectedVideo({ ...selectedVideo, title });
        }
        setEditingVideoId(null);
        setEditingTitle('');
        toast.success('重命名成功');
      }
    } catch (error) {
      console.error('重命名失败:', error);
      toast.error('重命名失败');
    } finally {
      setRenaming(false);
    }
  };

  // 分析视频
  const handleAnalyze = async (video: VideoMaterial) => {
    setAnalyzing(video.id);
    try {
      const response = await fetch(`/api/videos/${video.id}/analyze`, {
        method: 'POST',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setVideos(
          videos.map((v) =>
            v.id === video.id
              ? { ...v, status: 'analyzed', metadata: data.video.metadata }
              : v
          )
        );
        if (selectedVideo?.id === video.id) {
          setSelectedVideo({
            ...selectedVideo,
            status: 'analyzed',
            metadata: data.video.metadata,
          });
        }
        toast.success('分析完成');
      }
    } catch (error) {
      console.error('分析视频失败:', error);
      toast.error('分析失败');
    } finally {
      setAnalyzing(null);
    }
  };

  // 生成配置
  const handleGenerateConfig = async (video: VideoMaterial) => {
    setGenerating(video.id);
    try {
      const response = await fetch(`/api/videos/${video.id}/generate-config`, {
        method: 'POST',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success && data.config) {
        const blob = new Blob([JSON.stringify(data.config, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `short-drama-${video.title}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('配置已下载');
      }
    } catch (error) {
      console.error('生成配置失败:', error);
      toast.error('生成配置失败');
    } finally {
      setGenerating(null);
    }
  };

  // 查看详情
  const handleViewDetail = (video: VideoMaterial) => {
    setSelectedVideo(video);
    setShowDetail(true);
  };

  // 切换剧本展开状态
  const toggleSeries = (seriesId: string | null) => {
    const key = seriesId || 'other';
    setExpandedSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 切换剧集展开状态
  const toggleEpisode = (seriesId: string | null, episodeNumber: number) => {
    const key = `${seriesId || 'other'}-${episodeNumber}`;
    setExpandedEpisodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 格式化时长
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      uploaded: { label: '已上传', className: 'bg-secondary text-secondary-foreground' },
      processing: { label: '处理中', className: 'bg-primary text-primary-foreground' },
      analyzed: { label: '已分析', className: 'bg-green-500/90 text-white' },
      completed: { label: '已完成', className: 'bg-green-500/90 text-white' },
      error: { label: '错误', className: 'bg-destructive text-destructive-foreground' },
    };
    const config = statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // 渲染视频卡片
  const renderVideoCard = (video: VideoMaterial) => {
    const typeConfig = getVideoTypeConfig(video.hookType);
    const TypeIcon = typeConfig.icon;
    const isSelected = selectedVideoIds.has(video.id);
    
    return (
      <Card
        key={video.id}
        className={cn(
          "cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all bg-card/30 backdrop-blur-sm border-0 relative",
          isSelected && "ring-2 ring-primary ring-offset-2"
        )}
        onClick={() => handleViewDetail(video)}
      >
        <CardContent className="p-2.5">
          {/* 选择复选框 */}
          <div
            className="absolute top-2 right-2 z-10"
            onClick={(e) => toggleVideoSelection(video.id, e)}
          >
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer",
              isSelected 
                ? "bg-primary border-primary" 
                : "bg-white/80 border-gray-300 hover:border-primary"
            )}>
              {isSelected && (
                <Check className="h-3 w-3 text-white" />
              )}
            </div>
          </div>
          
          {/* 视频预览 */}
          <div className="aspect-video bg-muted rounded-lg mb-2 overflow-hidden relative group">
            {video.videoUrl ? (
              <>
                <video
                  src={video.videoUrl}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Play className="h-5 w-5 text-primary ml-0.5" />
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            {/* 类型标签 */}
            <div className="absolute top-1.5 left-1.5">
              <Badge className={cn('text-[10px] px-1.5 py-0', typeConfig.color)}>
                <TypeIcon className="h-3 w-3 mr-0.5" />
                {typeConfig.label}
              </Badge>
            </div>
            {/* 时长 */}
            {video.duration && (
              <div className="absolute bottom-1.5 right-1.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-black/70 text-white">
                  {formatDuration(video.duration)}
                </Badge>
              </div>
            )}
          </div>

          {/* 视频信息 */}
          <div className="space-y-0.5">
            <h3 className="font-medium text-xs truncate" title={video.title}>
              {video.title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {video.fileSize > 0 && (
                <span>{formatFileSize(video.fileSize)}</span>
              )}
              <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Header */}
        <div className="workspace-hero relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                    <Video className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">视频素材管理</h1>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  按剧本分组管理视频，支持查看完整剧集
                </p>
              </div>
              <Button onClick={loadVideos} variant="outline" disabled={loading} size="sm" className="shrink-0 bg-background/50 backdrop-blur-sm">
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                刷新
              </Button>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card/50 backdrop-blur-sm border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <BookOpen className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">剧本数</p>
                  <p className="text-lg font-bold">{seriesGroups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Film className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">完整剧集</p>
                  <p className="text-lg font-bold">
                    {videos.filter(v => v.hookType === 'merged').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clapperboard className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">分镜视频</p>
                  <p className="text-lg font-bold">
                    {videos.filter(v => v.hookType === 'storyboard' || !v.hookType).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Sparkle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">钩子/悬念</p>
                  <p className="text-lg font-bold">
                    {videos.filter(v => v.hookType === 'hook' || v.hookType === 'cliffhanger').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="w-full overflow-x-auto pb-2 -mb-2">
            <TabsList className="h-9 p-0.5 inline-flex w-max min-w-full bg-card/50 backdrop-blur-sm">
              <TabsTrigger value="list" className="text-xs sm:text-sm px-3 h-8 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                <Video className="h-4 w-4" />
                按剧本分组 ({seriesGroups.length})
              </TabsTrigger>
              <TabsTrigger value="upload" className="text-xs sm:text-sm px-3 h-8 gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                <Upload className="h-4 w-4" />
                上传视频
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 视频列表 - 按剧本分组 */}
          <TabsContent value="list" className="space-y-4">
            {/* 批量操作工具栏 */}
            {videos.length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm border-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedVideoIds.size > 0 ? (
                          <>已选择 <span className="font-medium text-primary">{selectedVideoIds.size}</span> 个视频</>
                        ) : (
                          '点击视频右上角选择'
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedVideoIds.size === 0 ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={selectAll}
                            className="h-8"
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            全选
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={clearSelection}
                            className="h-8"
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            取消选择
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={invertSelection}
                            className="h-8"
                          >
                            反选
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleBatchDelete}
                            disabled={isDeleting}
                            className="h-8"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            删除选中 ({selectedVideoIds.size})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {loading ? (
              <Card className="bg-card/50 backdrop-blur-sm border-0">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4">加载中...</p>
                </CardContent>
              </Card>
            ) : seriesGroups.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-0">
                <CardContent className="p-8 text-center">
                  <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                    <Video className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">暂无视频素材</p>
                  <Button
                    className="mt-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
                    onClick={() => setActiveTab('upload')}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    上传第一个视频
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* 剧本分组 */}
                {seriesGroups.map((series) => (
                  <Collapsible
                    key={series.seriesId || 'other'}
                    open={expandedSeries.has(series.seriesId || 'other')}
                    onOpenChange={() => toggleSeries(series.seriesId)}
                  >
                    <Card className="bg-card/50 backdrop-blur-sm border-0">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                                <BookOpen className="h-4 w-4" />
                              </div>
                              <div>
                                <CardTitle className="text-base">
                                  {series.seriesTitle}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {series.episodes.length} 集 · {series.totalVideos} 个视频
                                  {series.mergedCount > 0 && (
                                    <span className="text-green-500 ml-2">
                                      · {series.mergedCount} 个完整剧集
                                    </span>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* 选择该剧本所有视频 */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs px-2"
                                onClick={(e) => selectSeriesVideos(series, e)}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                选择全部
                              </Button>
                              {/* 快速状态指示 */}
                              <div className="flex gap-1">
                                {series.mergedCount > 0 && (
                                  <Badge className="bg-green-500/90 text-white text-xs">
                                    <Film className="h-3 w-3 mr-1" />
                                    {series.mergedCount}
                                  </Badge>
                                )}
                              </div>
                              {expandedSeries.has(series.seriesId || 'other') ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          {/* 每集视频 */}
                          {series.episodes.map((episode) => {
                            const episodeKey = `${series.seriesId || 'other'}-${episode.episodeNumber}`;
                            const isExpanded = expandedEpisodes.has(episodeKey);
                            
                            return (
                              <Collapsible
                                key={episodeKey}
                                open={isExpanded}
                                onOpenChange={() => toggleEpisode(series.seriesId, episode.episodeNumber)}
                              >
                                <div className="border rounded-lg overflow-hidden">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                                      <div className="flex items-center gap-2">
                                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium text-sm">
                                          第 {episode.episodeNumber} 集
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          ({episode.videos.length} 个视频)
                                        </span>
                                        {episode.mergedVideo && (
                                          <Badge className="bg-green-500/90 text-white text-xs">
                                            <Film className="h-3 w-3 mr-1" />
                                            完整剧集
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {/* 选择该集所有视频 */}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs px-2"
                                          onClick={(e) => selectEpisodeVideos(episode.videos, e)}
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          选择全部
                                        </Button>
                                        {/* 快速预览视频类型 */}
                                        <div className="flex gap-1">
                                          {episode.hookVideo && (
                                            <Badge className="bg-amber-500/90 text-white text-[10px] px-1">
                                              钩子
                                            </Badge>
                                          )}
                                          {episode.storyboardVideos.length > 0 && (
                                            <Badge className="bg-blue-500/90 text-white text-[10px] px-1">
                                              {episode.storyboardVideos.length}分镜
                                            </Badge>
                                          )}
                                          {episode.cliffhangerVideo && (
                                            <Badge className="bg-purple-500/90 text-white text-[10px] px-1">
                                              悬念
                                            </Badge>
                                          )}
                                        </div>
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="p-3 space-y-3 bg-card/30">
                                      {/* 完整剧集 - 突出显示 */}
                                      {episode.mergedVideo && (
                                        <div>
                                          <h4 className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1.5">
                                            <Film className="h-3.5 w-3.5" />
                                            完整剧集
                                          </h4>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {renderVideoCard(episode.mergedVideo)}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 开篇钩子和结尾悬念 */}
                                      {(episode.hookVideo || episode.cliffhangerVideo) && (
                                        <div>
                                          <h4 className="text-xs font-medium text-muted-foreground mb-2">
                                            特殊片段
                                          </h4>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {episode.hookVideo && renderVideoCard(episode.hookVideo)}
                                            {episode.cliffhangerVideo && renderVideoCard(episode.cliffhangerVideo)}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* 分镜视频 */}
                                      {episode.storyboardVideos.length > 0 && (
                                        <div>
                                          <h4 className="text-xs font-medium text-muted-foreground mb-2">
                                            分镜视频 ({episode.storyboardVideos.length})
                                          </h4>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                            {episode.storyboardVideos
                                              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                              .map(video => renderVideoCard(video))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            );
                          })}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="upload">
            <VideoUpload onUploadComplete={handleUploadComplete} />
          </TabsContent>
        </Tabs>

        {/* 视频详情弹窗 */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selectedVideo && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    {editingVideoId === selectedVideo.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1"
                          placeholder="输入视频标题"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRename(selectedVideo.id, editingTitle)}
                          disabled={renaming || !editingTitle.trim()}
                        >
                          {renaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingVideoId(null)}
                          disabled={renaming}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {selectedVideo.title}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingVideoId(selectedVideo.id);
                            setEditingTitle(selectedVideo.title);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedVideo.seriesTitle && (
                      <span className="text-primary">{selectedVideo.seriesTitle}</span>
                    )}
                    {selectedVideo.episodeNumber && (
                      <span> · 第{selectedVideo.episodeNumber}集</span>
                    )}
                    {selectedVideo.description && (
                      <span> · {selectedVideo.description}</span>
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* 视频播放器 */}
                  <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                    {selectedVideo.videoUrl ? (
                      <video
                        src={selectedVideo.videoUrl}
                        className="w-full h-full"
                        controls
                        autoPlay
                        onError={async (e) => {
                          const video = e.currentTarget;
                          const error = video.error;
                          
                          // 详细错误信息
                          let errorDetail = '未知错误';
                          if (error) {
                            switch (error.code) {
                              case error.MEDIA_ERR_ABORTED:
                                errorDetail = '视频加载被中止';
                                break;
                              case error.MEDIA_ERR_NETWORK:
                                errorDetail = '网络错误，视频下载失败';
                                break;
                              case error.MEDIA_ERR_DECODE:
                                errorDetail = '视频解码失败，文件可能已损坏';
                                break;
                              case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                errorDetail = '视频格式不支持或URL无效';
                                break;
                              default:
                                errorDetail = error.message || `错误代码: ${error.code}`;
                            }
                          }
                          
                          console.error('视频加载失败:', {
                            code: error?.code,
                            message: error?.message,
                            detail: errorDetail,
                            src: video.src?.substring(0, 100) + '...',
                            networkState: video.networkState,
                            readyState: video.readyState,
                          });
                          
                          // 如果是网络错误，尝试刷新 URL（签名可能过期）
                          if (error?.code === MediaError.MEDIA_ERR_NETWORK || !error) {
                            console.log('[视频] 尝试刷新视频URL...');
                            toast.warning('视频加载失败，正在尝试刷新...');
                            
                            try {
                              // 重新获取视频列表以获取新的签名URL
                              const response = await fetch('/api/videos?limit=500', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
                              const data = await response.json();
                              if (data.success) {
                                const refreshedVideo = data.videos.find((v: VideoMaterial) => v.id === selectedVideo.id);
                                if (refreshedVideo?.videoUrl) {
                                  console.log('[视频] 获取到新的URL，重新加载...');
                                  video.src = refreshedVideo.videoUrl;
                                  video.load();
                                }
                              }
                            } catch (refreshError) {
                              console.error('[视频] 刷新URL失败:', refreshError);
                              toast.error('视频加载失败，请刷新页面重试');
                            }
                          } else {
                            toast.error(`视频加载失败: ${errorDetail}`);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <div className="text-center">
                          <AlertCircle className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-muted-foreground">视频加载失败</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 视频信息 */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">文件大小</p>
                            <p className="font-medium">
                              {formatFileSize(selectedVideo.fileSize)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">时长</p>
                            <p className="font-medium">
                              {formatDuration(selectedVideo.duration) || '未知'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">类型</p>
                            <Badge className={getVideoTypeConfig(selectedVideo.hookType).color}>
                              {getVideoTypeConfig(selectedVideo.hookType).label}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 分析结果 */}
                  {selectedVideo.metadata && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          AI 分析结果
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {JSON.stringify(selectedVideo.metadata, null, 2)}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleAnalyze(selectedVideo)}
                      disabled={
                        analyzing === selectedVideo.id ||
                        selectedVideo.status === 'analyzed'
                      }
                    >
                      {analyzing === selectedVideo.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {selectedVideo.status === 'analyzed' ? '已分析' : 'AI分析'}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleGenerateConfig(selectedVideo)}
                      disabled={
                        generating === selectedVideo.id ||
                        selectedVideo.status !== 'analyzed'
                      }
                    >
                      {generating === selectedVideo.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      生成短剧配置
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleDelete(selectedVideo.id);
                        setShowDetail(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
