'use client';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  Image as ImageIcon,
  Upload,
  Trash2,
  Loader2,
  Sparkles,
  Download,
  Wand2,
  X,
  Grid3X3,
  LayoutList,
  ExternalLink,
  FolderOpen,
  Users,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageMaterial {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  file_name: string;
  width: number;
  height: number;
  file_size: number;
  format: string;
  character_name: string;
  purpose: string;
  style: string;
  mood: string;
  platform: string;
  dimensions: string;
  is_ai_generated: boolean;
  generation_prompt: string;
  tags: string[];
  imageUrl: string;
  thumbnailUrl: string;
  created_at: string;
  series_id?: string;
  episode_id?: string;
  character_id?: string;
}

const platforms = [
  { value: '抖音', label: '抖音' },
  { value: '快手', label: '快手' },
  { value: '微信视频号', label: '微信视频号' },
  { value: '小红书', label: '小红书' },
  { value: '微博', label: '微博' },
  { value: 'B站', label: 'B站' },
];

const imageTypes = [
  { value: 'poster', label: '海报' },
  { value: 'promotional', label: '宣传图' },
  { value: 'character', label: '角色图' },
  { value: 'scene', label: '场景图' },
  { value: 'storyboard', label: '分镜图' },
];

const purposes = [
  { value: '封面', label: '封面' },
  { value: '海报', label: '海报' },
  { value: 'Banner', label: 'Banner' },
  { value: '分享图', label: '分享图' },
  { value: '头像', label: '头像' },
];

const styles = [
  { value: '现代', label: '现代' },
  { value: '古风', label: '古风' },
  { value: '科幻', label: '科幻' },
  { value: '唯美', label: '唯美' },
  { value: '暗黑', label: '暗黑' },
  { value: '动漫', label: '动漫' },
  { value: '写实', label: '写实' },
];

const moods = [
  { value: '浪漫', label: '浪漫' },
  { value: '紧张', label: '紧张' },
  { value: '温馨', label: '温馨' },
  { value: '悲伤', label: '悲伤' },
  { value: '热血', label: '热血' },
  { value: '悬疑', label: '悬疑' },
  { value: '搞笑', label: '搞笑' },
];

const dimensions = [
  { value: '9:16', label: '9:16 (竖屏-抖音/快手)' },
  { value: '3:4', label: '3:4 (竖屏-小红书)' },
  { value: '1:1', label: '1:1 (方形)' },
  { value: '16:9', label: '16:9 (横屏-B站)' },
  { value: '4:3', label: '4:3 (横屏)' },
];

export default function ImagesPage() {
  const [images, setImages] = useState<ImageMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageMaterial | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 剧本和角色数据
  const [seriesList, setSeriesList] = useState<Array<{ id: string; title: string; style?: string; characters: Array<{ id: string; name: string; gender: string; age: number; faceShape?: string; hairstyle?: string; clothing?: string; skinTone?: string; temperament?: string; imageUrl?: string; imageId?: string }> }>>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<{ id: string; name: string; gender: string; age: number; faceShape?: string; hairstyle?: string; clothing?: string; skinTone?: string; temperament?: string; imageUrl?: string } | null>(null);
  const [characterGenerating, setCharacterGenerating] = useState(false);

  // 上传表单
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    title: '',
    description: '',
    type: 'scene',
    purpose: '',
    style: '',
    mood: '',
    platform: '抖音',
    tags: '',
  });

  // AI生成表单
  const [generateForm, setGenerateForm] = useState({
    type: 'poster',
    purpose: '封面',
    style: '现代',
    mood: '浪漫',
    platform: '抖音',
    dimensions: '9:16',
    customPrompt: '',
  });

  // 按剧集分组的状态
  const [expandedSeriesGroups, setExpandedSeriesGroups] = useState<Set<string>>(new Set());
  
  // 按剧集分组的逻辑
  interface SeriesImageGroup {
    seriesId: string | null;
    seriesTitle: string;
    characterImages: ImageMaterial[];
    sceneImages: ImageMaterial[];
    otherImages: ImageMaterial[];
    totalImages: number;
  }
  
  // 获取图片关联的剧集名称
  const getSeriesTitle = (image: ImageMaterial): string => {
    // 从 seriesList 中查找对应的剧集名称
    const series = seriesList.find(s => s.id === image.series_id);
    return series?.title || '未分类';
  };
  
  // 按剧集分组图片
  const groupImagesBySeries = (): SeriesImageGroup[] => {
    const groups = new Map<string | null, SeriesImageGroup>();
    
    // 先添加所有已知剧集
    seriesList.forEach(series => {
      groups.set(series.id, {
        seriesId: series.id,
        seriesTitle: series.title,
        characterImages: [],
        sceneImages: [],
        otherImages: [],
        totalImages: 0,
      });
    });
    
    // 添加未分类组
    groups.set(null, {
      seriesId: null,
      seriesTitle: '未分类',
      characterImages: [],
      sceneImages: [],
      otherImages: [],
      totalImages: 0,
    });
    
    // 遍历图片，分配到对应组
    images.forEach(image => {
      const groupKey = image.series_id || null;
      const group = groups.get(groupKey);
      if (group) {
        if (image.type === 'character' || image.type === 'character-uid') {
          group.characterImages.push(image);
        } else if (image.type === 'scene') {
          group.sceneImages.push(image);
        } else {
          group.otherImages.push(image);
        }
        group.totalImages++;
      }
    });
    
    // 过滤掉没有图片的剧集，但保留"未分类"
    return Array.from(groups.values()).filter(g => g.totalImages > 0 || g.seriesId === null);
  };
  
  const seriesImageGroups = groupImagesBySeries();

  // 检测重复图片（基于 file_name 或 imageUrl）
  const hasDuplicateImages = (): boolean => {
    const seen = new Set<string>();
    for (const img of images) {
      const key = img.file_name || img.imageUrl;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  };

  // 获取重复图片的 ID（保留首个出现，返回后续重复项）
  const getDuplicateImageIds = (): string[] => {
    const seen = new Map<string, string>(); // key -> firstId
    const duplicateIds: string[] = [];
    for (const img of images) {
      const key = img.file_name || img.imageUrl;
      if (seen.has(key)) {
        duplicateIds.push(img.id);
      } else {
        seen.set(key, img.id);
      }
    }
    return duplicateIds;
  };

  // 清理重复图片
  const cleanupDuplicateImages = async () => {
    const duplicateIds = getDuplicateImageIds();
    if (duplicateIds.length === 0) return;

    const confirmed = window.confirm(
      `检测到 ${duplicateIds.length} 张重复图片（基于文件名/URL去重），确定要删除吗？`
    );
    if (!confirmed) return;

    setBatchDeleting(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch('/api/images?ids=' + encodeURIComponent(JSON.stringify(duplicateIds)), {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setImages(images.filter((img) => !duplicateIds.includes(img.id)));
        alert(`已清理 ${duplicateIds.length} 张重复图片`);
      } else {
        alert(`清理失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('清理重复图片失败:', error);
      alert('网络请求失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  // 加载图片列表
  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch('/api/images', {
        headers: { 'x-user-id': user?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setImages(data.images);
      }
    } catch (error) {
      console.error('加载图片列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载剧本列表（用于角色形象生成）
  const loadSeriesList = useCallback(async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch('/api/drama/series?limit=100', {
        headers: { 'x-user-id': user?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setSeriesList(data.series.filter((s: { characters: unknown }) => s.characters && Array.isArray(s.characters)));
      }
    } catch (error) {
      console.error('加载剧本列表失败:', error);
    }
  }, []);

  useEffect(() => {
    loadImages();
    loadSeriesList();
  }, [loadImages, loadSeriesList]);

  // 生成角色形象
  const generateCharacterImage = async () => {
    if (!selectedCharacter) return;
    
    setCharacterGenerating(true);
    try {
      const selectedSeries = seriesList.find(s => s.id === selectedSeriesId);
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch('/api/characters/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          characterId: selectedCharacter.id,
          characterName: selectedCharacter.name,
          gender: selectedCharacter.gender,
          age: selectedCharacter.age,
          faceShape: selectedCharacter.faceShape,
          hairstyle: selectedCharacter.hairstyle,
          clothing: selectedCharacter.clothing,
          skinTone: selectedCharacter.skinTone,
          temperament: selectedCharacter.temperament,
          style: '现代',
          seriesId: selectedSeriesId,
          saveToLibrary: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadImages();
        setShowCharacterDialog(false);
        setSelectedSeriesId('');
        setSelectedCharacter(null);
      } else {
        alert(data.error || '生成角色形象失败');
      }
    } catch (error) {
      console.error('生成角色形象失败:', error);
      alert('生成角色形象失败');
    } finally {
      setCharacterGenerating(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file, title: uploadForm.title || file.name });
    }
  };

  // 上传图片
  const uploadImage = async () => {
    if (!uploadForm.file) {
      alert('请选择文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('title', uploadForm.title);
    formData.append('description', uploadForm.description);
    formData.append('type', uploadForm.type);
    formData.append('purpose', uploadForm.purpose);
    formData.append('style', uploadForm.style);
    formData.append('mood', uploadForm.mood);
    formData.append('platform', uploadForm.platform);
    formData.append('tags', uploadForm.tags);

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setShowUploadDialog(false);
        loadImages();
      }
    } catch (error) {
      console.error('上传图片失败:', error);
    } finally {
      setUploading(false);
    }
  };

  // AI生成图片
  const generateAIImage = async () => {
    setGenerating(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          prompt: generateForm.customPrompt || generatePromptFromForm(),
          width: getDimensionWidth(),
          height: getDimensionHeight(),
        }),
      });

      const data = await response.json();
      if (data.success && data.images?.[0]?.url) {
        // 下载并保存图片
        const imageResponse = await fetch(data.images[0].url);
        const blob = await imageResponse.blob();
        const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: 'image/png' });

        // 上传保存
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', `AI生成${generateForm.purpose}`);
        formData.append('type', generateForm.type);
        formData.append('purpose', generateForm.purpose);
        formData.append('style', generateForm.style);
        formData.append('mood', generateForm.mood);
        formData.append('platform', generateForm.platform);

        await fetch('/api/images', {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '' },
          body: formData,
        });

        setShowGenerateDialog(false);
        loadImages();
      }
    } catch (error) {
      console.error('AI生成图片失败:', error);
    } finally {
      setGenerating(false);
    }
  };

  // 根据表单生成提示词
  const generatePromptFromForm = () => {
    const parts = [
      generateForm.type === 'poster' ? 'movie poster' : 
      generateForm.type === 'promotional' ? 'promotional image' :
      generateForm.type === 'character' ? 'character portrait' : 'cinematic scene',
      generateForm.style ? `${generateForm.style} style` : '',
      generateForm.mood ? `${generateForm.mood} mood` : '',
      'professional quality',
      'highly detailed',
      '8k resolution',
    ];
    return parts.filter(Boolean).join(', ');
  };

  // 获取尺寸宽高
  const getDimensionWidth = () => {
    switch (generateForm.dimensions) {
      case '9:16': return 768;
      case '16:9': return 1344;
      case '1:1': return 1024;
      case '3:4': return 768;
      case '4:3': return 1024;
      default: return 1024;
    }
  };

  const getDimensionHeight = () => {
    switch (generateForm.dimensions) {
      case '9:16': return 1344;
      case '16:9': return 768;
      case '1:1': return 1024;
      case '3:4': return 1024;
      case '4:3': return 768;
      default: return 1024;
    }
  };

  // 删除图片
  const deleteImage = async (id: string) => {
    if (!confirm('确定要删除这张图片吗？')) return;

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      await fetch(`/api/images/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setImages(images.filter((img) => img.id !== id));
      setSelectedImage(null);
    } catch (error) {
      console.error('删除图片失败:', error);
    }
  };

  // 批量删除图片
  const batchDeleteImages = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 张图片吗？`)) return;

    setBatchDeleting(true);
    const idsArray = Array.from(selectedIds);
    
    try {
      // 使用 URL 参数传递 ID 列表（更可靠）
      const idsParam = encodeURIComponent(JSON.stringify(idsArray));
      const response = await fetch(`/api/images?ids=${idsParam}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        body: JSON.stringify({ imageIds: idsArray }), // 同时发送请求体作为备选
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setImages(images.filter((img) => !selectedIds.has(img.id)));
        setSelectedIds(new Set());
        alert(data.message);
      } else {
        alert(`删除失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('网络请求失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setBatchDeleting(false);
    }
  };

  // 切换单个选择
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 全选/取消全选当前过滤的图片
  const toggleSelectAll = () => {
    const filteredIds = filteredImages.map((img) => img.id);
    setSelectedIds((prev) => {
      const allSelected = filteredIds.every((id) => prev.has(id));
      if (allSelected) {
        // 取消全选
        const newSet = new Set(prev);
        filteredIds.forEach((id) => newSet.delete(id));
        return newSet;
      } else {
        // 全选
        const newSet = new Set(prev);
        filteredIds.forEach((id) => newSet.add(id));
        return newSet;
      }
    });
  };

  // 清除选择
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // 下载图片
  const downloadImage = async (image: ImageMaterial) => {
    const response = await fetch(image.imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = image.file_name || `${image.title}.png`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // 获取类型名称
  const getTypeName = (type: string) => {
    const found = imageTypes.find(t => t.value === type);
    return found?.label || type;
  };

  // 过滤图片
  const filteredImages = images.filter((img) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'ai-generated') return img.is_ai_generated;
    return img.type === activeTab;
  });

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">图片管理</h1>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  管理短剧配图、宣传图、海报等图片素材
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button variant="outline" onClick={() => setShowUploadDialog(true)} size="sm" className="bg-background/50 backdrop-blur-sm">
                  <Upload className="h-4 w-4 mr-2" />
                  上传
                </Button>
                <Button variant="outline" onClick={() => setShowCharacterDialog(true)} size="sm" className="bg-background/50 backdrop-blur-sm">
                  <Users className="h-4 w-4 mr-2" />
                  角色形象
                </Button>
                <Button onClick={() => setShowGenerateDialog(true)} size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25">
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI生成
                </Button>
                {hasDuplicateImages() && (
                  <Button
                    variant="outline"
                    onClick={cleanupDuplicateImages}
                    size="sm"
                    disabled={batchDeleting}
                    className="bg-background/50 backdrop-blur-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    清理重复
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Glassmorphism */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform">
                  <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">{images.length}</p>
                  <p className="text-xs text-muted-foreground">图片总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/10 group-hover:scale-110 transition-transform">
                  <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">
                    {images.filter((i) => i.type === 'poster').length}
                  </p>
                  <p className="text-xs text-muted-foreground">海报</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/10 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">
                    {images.filter((i) => i.is_ai_generated).length}
                  </p>
                  <p className="text-xs text-muted-foreground">AI生成</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform">
                  <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">
                    {images.filter((i) => i.type === 'character').length}
                  </p>
                  <p className="text-xs text-muted-foreground">角色图</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="w-full overflow-x-auto pb-2 sm:pb-0 -mb-2 sm:mb-0">
              <TabsList className="h-9 p-0.5 inline-flex w-max min-w-full">
                <TabsTrigger value="all" className="text-xs px-3 h-8">全部</TabsTrigger>
                <TabsTrigger value="series" className="text-xs px-3 h-8 gap-1">
                  <BookOpen className="h-3 w-3" />
                  按剧集分组
                </TabsTrigger>
                <TabsTrigger value="poster" className="text-xs px-3 h-8">海报</TabsTrigger>
                <TabsTrigger value="promotional" className="text-xs px-3 h-8">宣传图</TabsTrigger>
                <TabsTrigger value="character" className="text-xs px-3 h-8">角色图</TabsTrigger>
                <TabsTrigger value="scene" className="text-xs px-3 h-8">场景图</TabsTrigger>
                <TabsTrigger value="ai-generated" className="text-xs px-3 h-8 gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI生成
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex gap-1 shrink-0 items-center">
              {/* 批量操作工具栏 */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-2 px-2 py-1 bg-destructive/10 rounded-md">
                  <span className="text-sm text-destructive font-medium">
                    已选 {selectedIds.size} 项
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={batchDeleteImages}
                    disabled={batchDeleting}
                    className="h-7"
                  >
                    {batchDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    删除
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-7 text-xs"
                  >
                    取消
                  </Button>
                </div>
              )}
              {/* 全选按钮 */}
              {filteredImages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-8"
                >
                  {filteredImages.every((img) => selectedIds.has(img.id)) ? (
                    <CheckSquare className="h-4 w-4 mr-1" />
                  ) : (
                    <Square className="h-4 w-4 mr-1" />
                  )}
                  全选
                </Button>
              )}
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4">加载中...</p>
                </CardContent>
              </Card>
            ) : filteredImages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>暂无图片素材</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击上方按钮上传或AI生成图片
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-4 gap-4">
                {filteredImages.map((image) => {
                  const isSelected = selectedIds.has(image.id);
                  return (
                    <Card
                      key={image.id}
                      className={cn(
                        "cursor-pointer overflow-hidden group relative",
                        isSelected && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedImage(image)}
                    >
                      {/* 复选框 */}
                      <div
                        className="absolute top-2 left-2 z-10"
                        onClick={(e) => toggleSelect(image.id, e)}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "bg-white/80 border-gray-300 hover:border-primary"
                        )}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="aspect-video relative">
                        <img
                          src={image.thumbnailUrl || image.imageUrl}
                          alt={image.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.img-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'img-fallback absolute inset-0 bg-gray-200 flex items-center justify-center text-gray-400 text-sm';
                              fallback.textContent = '图片加载失败';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); downloadImage(image); }}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteImage(image.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {image.is_ai_generated && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="bg-purple-500 text-white">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="font-medium truncate">{image.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getTypeName(image.type)} · {image.width}x{image.height}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredImages.map((image) => {
                  const isSelected = selectedIds.has(image.id);
                  return (
                    <Card 
                      key={image.id} 
                      className={cn(
                        "cursor-pointer",
                        isSelected && "ring-2 ring-primary"
                      )} 
                      onClick={() => setSelectedImage(image)}
                    >
                      <CardContent className="p-3 flex items-center gap-4">
                        {/* 复选框 */}
                        <div
                          className="shrink-0"
                          onClick={(e) => toggleSelect(image.id, e)}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary border-primary"
                              : "bg-white border-gray-300 hover:border-primary"
                          )}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <img
                          src={image.thumbnailUrl || image.imageUrl}
                          alt={image.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{image.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {getTypeName(image.type)} · {image.width}x{image.height} · {formatFileSize(image.file_size)}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {image.is_ai_generated && (
                              <Badge variant="secondary" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI生成
                              </Badge>
                            )}
                            {image.purpose && (
                              <Badge variant="outline" className="text-xs">{image.purpose}</Badge>
                            )}
                            {image.platform && (
                              <Badge variant="outline" className="text-xs">{image.platform}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); downloadImage(image); }}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteImage(image.id); }}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* 按剧集分组视图 */}
          <TabsContent value="series" className="space-y-4 mt-4">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4">加载中...</p>
                </CardContent>
              </Card>
            ) : images.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>暂无图片素材</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击上方按钮上传或AI生成图片
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {seriesImageGroups.map((group) => (
                  <Collapsible
                    key={group.seriesId || 'uncategorized'}
                    open={expandedSeriesGroups.has(group.seriesId || 'uncategorized')}
                    onOpenChange={() => {
                      const key = group.seriesId || 'uncategorized';
                      setExpandedSeriesGroups(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(key)) {
                          newSet.delete(key);
                        } else {
                          newSet.add(key);
                        }
                        return newSet;
                      });
                    }}
                  >
                    <Card className="bg-card/50 backdrop-blur-sm border-0">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {expandedSeriesGroups.has(group.seriesId || 'uncategorized') ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <BookOpen className="h-5 w-5 text-primary" />
                              <div>
                                <CardTitle className="text-base">{group.seriesTitle}</CardTitle>
                                <CardDescription className="text-xs">
                                  共 {group.totalImages} 张图片
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {group.characterImages.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {group.characterImages.length} 角色立绘
                                </Badge>
                              )}
                              {group.sceneImages.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {group.sceneImages.length} 场景照
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {/* 角色立绘 */}
                          {group.characterImages.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                                角色立绘 ({group.characterImages.length})
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {group.characterImages.map((img) => (
                                  <div 
                                    key={img.id} 
                                    className="group relative aspect-video rounded-lg overflow-hidden border bg-muted cursor-pointer"
                                    onClick={() => setSelectedImage(img)}
                                  >
                                    <img
                                      src={img.imageUrl}
                                      alt={img.title}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-xs text-white truncate">{img.title}</p>
                                        <p className="text-xs text-white/70">{img.character_name || ''}</p>
                                      </div>
                                    </div>
                                    {img.is_ai_generated && (
                                      <div className="absolute top-1 right-1">
                                        <Badge variant="secondary" className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5">
                                          <Sparkles className="h-2 w-2 mr-0.5" />
                                          AI
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 场景照 */}
                          {group.sceneImages.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>
                                场景照 ({group.sceneImages.length})
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {group.sceneImages.map((img) => (
                                  <div 
                                    key={img.id} 
                                    className="group relative aspect-video rounded-lg overflow-hidden border bg-muted cursor-pointer"
                                    onClick={() => setSelectedImage(img)}
                                  >
                                    <img
                                      src={img.imageUrl}
                                      alt={img.title}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-xs text-white truncate">{img.title}</p>
                                      </div>
                                    </div>
                                    {img.is_ai_generated && (
                                      <div className="absolute top-1 right-1">
                                        <Badge variant="secondary" className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5">
                                          <Sparkles className="h-2 w-2 mr-0.5" />
                                          AI
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 其他图片 */}
                          {group.otherImages.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>
                                其他图片 ({group.otherImages.length})
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {group.otherImages.map((img) => (
                                  <div 
                                    key={img.id} 
                                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                                    onClick={() => setSelectedImage(img)}
                                  >
                                    <img
                                      src={img.imageUrl}
                                      alt={img.title}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-xs text-white truncate">{img.title}</p>
                                        <Badge className="text-[10px] mt-1">
                                          {getTypeName(img.type)}
                                        </Badge>
                                      </div>
                                    </div>
                                    {img.is_ai_generated && (
                                      <div className="absolute top-1 right-1">
                                        <Badge variant="secondary" className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5">
                                          <Sparkles className="h-2 w-2 mr-0.5" />
                                          AI
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>上传图片</DialogTitle>
              <DialogDescription>上传短剧配图、宣传图、海报等素材</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>选择图片</Label>
                <Input type="file" accept="image/*" onChange={handleFileSelect} />
              </div>
              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="输入图片标题"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>类型</Label>
                  <Select value={uploadForm.type} onValueChange={(v) => setUploadForm({ ...uploadForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {imageTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>用途</Label>
                  <Select value={uploadForm.purpose} onValueChange={(v) => setUploadForm({ ...uploadForm, purpose: v })}>
                    <SelectTrigger><SelectValue placeholder="选择用途" /></SelectTrigger>
                    <SelectContent>
                      {purposes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>风格</Label>
                  <Select value={uploadForm.style} onValueChange={(v) => setUploadForm({ ...uploadForm, style: v })}>
                    <SelectTrigger><SelectValue placeholder="选择风格" /></SelectTrigger>
                    <SelectContent>
                      {styles.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>情绪</Label>
                  <Select value={uploadForm.mood} onValueChange={(v) => setUploadForm({ ...uploadForm, mood: v })}>
                    <SelectTrigger><SelectValue placeholder="选择情绪" /></SelectTrigger>
                    <SelectContent>
                      {moods.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>平台</Label>
                <Select value={uploadForm.platform} onValueChange={(v) => setUploadForm({ ...uploadForm, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {platforms.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>取消</Button>
                <Button onClick={uploadImage} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  上传
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Generate Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>AI生成图片</DialogTitle>
              <DialogDescription>使用AI自动生成短剧宣传图、海报等</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>图片类型</Label>
                  <Select value={generateForm.type} onValueChange={(v) => setGenerateForm({ ...generateForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {imageTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>用途</Label>
                  <Select value={generateForm.purpose} onValueChange={(v) => setGenerateForm({ ...generateForm, purpose: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {purposes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>风格</Label>
                  <Select value={generateForm.style} onValueChange={(v) => setGenerateForm({ ...generateForm, style: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {styles.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>情绪基调</Label>
                  <Select value={generateForm.mood} onValueChange={(v) => setGenerateForm({ ...generateForm, mood: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {moods.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>平台</Label>
                  <Select value={generateForm.platform} onValueChange={(v) => setGenerateForm({ ...generateForm, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {platforms.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>尺寸比例</Label>
                  <Select value={generateForm.dimensions} onValueChange={(v) => setGenerateForm({ ...generateForm, dimensions: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {dimensions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>自定义提示词（可选）</Label>
                <Textarea
                  value={generateForm.customPrompt}
                  onChange={(e) => setGenerateForm({ ...generateForm, customPrompt: e.target.value })}
                  placeholder="输入自定义的AI绘图提示词，留空则自动生成..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>取消</Button>
                <Button onClick={generateAIImage} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  生成图片
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 角色形象生成弹窗 */}
        <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                生成角色形象
              </DialogTitle>
              <DialogDescription>
                从已有剧本中选择角色，自动生成角色定妆照
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 选择剧本 */}
              <div className="space-y-2">
                <Label>选择剧本</Label>
                <Select value={selectedSeriesId} onValueChange={(v) => {
                  setSelectedSeriesId(v);
                  setSelectedCharacter(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择包含角色的剧本" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesList.map((series) => (
                      <SelectItem key={series.id} value={series.id}>
                        {series.title} ({series.characters?.length || 0}个角色)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 选择角色 */}
              {selectedSeriesId && (
                <div className="space-y-2">
                  <Label>选择角色</Label>
                  <Select 
                    value={selectedCharacter?.id || ''} 
                    onValueChange={(v) => {
                      const series = seriesList.find(s => s.id === selectedSeriesId);
                      const char = series?.characters?.find(c => c.id === v);
                      setSelectedCharacter(char || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择要生成形象的角色" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesList.find(s => s.id === selectedSeriesId)?.characters?.map((char) => (
                        <SelectItem key={char.id} value={char.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant={char.gender === 'male' ? 'default' : 'secondary'} className="text-xs">
                              {char.gender === 'male' ? '男' : '女'}
                            </Badge>
                            {char.name} ({char.age}岁)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 角色信息预览 */}
              {selectedCharacter && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">姓名</span>
                        <span className="font-medium">{selectedCharacter.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">性别/年龄</span>
                        <span>{selectedCharacter.gender === 'male' ? '男' : '女'} / {selectedCharacter.age}岁</span>
                      </div>
                      {selectedCharacter.faceShape && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">脸型</span>
                          <span>{selectedCharacter.faceShape}</span>
                        </div>
                      )}
                      {selectedCharacter.hairstyle && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">发型</span>
                          <span>{selectedCharacter.hairstyle}</span>
                        </div>
                      )}
                      {selectedCharacter.clothing && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">服装</span>
                          <span className="text-right max-w-[200px] truncate">{selectedCharacter.clothing}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 已有形象提示 */}
              {selectedCharacter?.imageUrl && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                  <ImageIcon className="h-4 w-4" />
                  该角色已有形象图片，生成新形象将覆盖旧形象
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowCharacterDialog(false);
                  setSelectedSeriesId('');
                  setSelectedCharacter(null);
                }}>取消</Button>
                <Button 
                  onClick={generateCharacterImage} 
                  disabled={!selectedCharacter || characterGenerating}
                >
                  {characterGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  生成角色形象
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Image Preview */}
        {selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setSelectedImage(null)}>
            <div className="max-w-4xl max-h-[90vh] bg-background rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <img src={selectedImage.imageUrl} alt={selectedImage.title} className="max-h-[70vh] object-contain" />
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-black/50 hover:bg-black/70" onClick={() => setSelectedImage(null)}>
                  <X className="h-4 w-4 text-white" />
                </Button>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedImage.title}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => downloadImage(selectedImage)}>
                      <Download className="h-4 w-4 mr-2" />下载
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteImage(selectedImage.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />删除
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{getTypeName(selectedImage.type)}</Badge>
                  {selectedImage.is_ai_generated && <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />AI生成</Badge>}
                  {selectedImage.platform && <Badge variant="outline">{selectedImage.platform}</Badge>}
                  {selectedImage.style && <Badge variant="outline">{selectedImage.style}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedImage.width} × {selectedImage.height} · {formatFileSize(selectedImage.file_size)} · {selectedImage.format}
                </p>
                {selectedImage.generation_prompt && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                    <p className="font-medium mb-1">AI提示词：</p>
                    <p className="text-muted-foreground">{selectedImage.generation_prompt}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
