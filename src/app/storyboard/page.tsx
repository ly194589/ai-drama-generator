'use client';

import { useState, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Upload,
  Image as ImageIconLucide,
  Video,
  Music,
  Clock,
  Play,
  Download,
  Copy,
  Check,
  X,
  Film,
  Sparkles,
  ImagePlus,
  Volume,
  Palette,
  Layers,
  User,
  Map,
  Type,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// 素材类型定义
type MaterialType = 'character' | 'scene' | 'audio';

interface Material {
  id: string;
  type: MaterialType;
  name: string;
  url: string;
  uploadedAt: Date;
}

// 分镜片段定义
interface StoryboardShot {
  id: string;
  startTime: number;
  endTime: number;
  description: string;
  cameraMovement: string;
  characterAction: string;
  audio?: string;
  references: {
    images: string[];
    audio?: string;
  };
}

export default function StoryboardPage() {
  // 素材管理
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<MaterialType>('character');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 分镜片段管理
  const [shots, setShots] = useState<StoryboardShot[]>([
    {
      id: '1',
      startTime: 0,
      endTime: 3,
      description: '开篇镜头',
      cameraMovement: '转镜',
      characterAction: '女主转身坐下，转镜，女主下了一步棋子，并说"你输了"',
      references: {
        images: [],
        audio: undefined,
      },
    },
    {
      id: '2',
      startTime: 3,
      endTime: 4,
      description: '快速摇镜头',
      cameraMovement: '快速摇镜头',
      characterAction: '转向对面特写，男人面部，男人说"怎么会！"',
      references: {
        images: [],
        audio: undefined,
      },
    },
    {
      id: '3',
      startTime: 4,
      endTime: 6,
      description: '切镜头俯拍',
      cameraMovement: '切镜头，俯拍',
      characterAction: '女人下了一步棋，对面的人们惊叹',
      references: {
        images: [],
        audio: undefined,
      },
    },
    {
      id: '4',
      startTime: 6,
      endTime: 8,
      description: '黑屏转场',
      cameraMovement: '镜头迅速向下摇，画面黑屏转场，后画面渐亮',
      characterAction: '昏暗室内，女人看着窗外月色静静地说"我们走着瞧"',
      references: {
        images: [],
        audio: undefined,
      },
    },
  ]);

  const [totalDuration, setTotalDuration] = useState(8);
  const [currentShotId, setCurrentShotId] = useState<string>('1');
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // 上传素材
  const handleUploadFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];

      // 上传到服务器
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上传失败');
      }

      const data = await response.json();
      const url = data.url;

      const newMaterial: Material = {
        id: `${uploadType}-${Date.now()}`,
        type: uploadType,
        name: file.name,
        url,
        uploadedAt: new Date(),
      };

      setMaterials(prev => [...prev, newMaterial]);
      toast.success('素材上传成功');
      setUploadDialogOpen(false);
    } catch (error) {
      console.error('上传失败:', error);
      toast.error(error instanceof Error ? error.message : '上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 添加新的分镜片段
  const addShot = () => {
    const lastShot = shots[shots.length - 1];
    const newShot: StoryboardShot = {
      id: `${Date.now()}`,
      startTime: lastShot?.endTime || 0,
      endTime: (lastShot?.endTime || 0) + 2,
      description: '新镜头',
      cameraMovement: '',
      characterAction: '',
      references: {
        images: [],
        audio: undefined,
      },
    };
    setShots(prev => [...prev, newShot]);
    setCurrentShotId(newShot.id);
    toast.success('已添加新镜头');
  };

  // 删除分镜片段
  const deleteShot = (id: string) => {
    if (shots.length <= 1) {
      toast.error('至少需要保留一个镜头');
      return;
    }
    setShots(prev => prev.filter(s => s.id !== id));
    if (currentShotId === id) {
      setCurrentShotId(shots[0].id);
    }
    toast.success('已删除镜头');
  };

  // 更新分镜片段
  const updateShot = (id: string, updates: Partial<StoryboardShot>) => {
    setShots(prev => prev.map(s =>
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  // 插入素材标记
  const insertMaterialTag = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    const tag = material.type === 'audio'
      ? `@音频${materials.filter(m => m.type === 'audio').indexOf(material) + 1}`
      : `@图像${materials.filter(m => m.type !== 'audio').indexOf(material) + 1}`;

    const currentShot = shots.find(s => s.id === currentShotId);
    if (!currentShot) return;

    // 插入到描述中
    updateShot(currentShotId, {
      description: currentShot.description + (currentShot.description ? '，' : '') + tag,
    });
  };

  // 获取素材标记文本
  const getMaterialTagText = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return '';

    const index = material.type === 'audio'
      ? materials.filter(m => m.type === 'audio').indexOf(material) + 1
      : materials.filter(m => m.type !== 'audio').indexOf(material) + 1;

    return material.type === 'audio'
      ? `@音频${index}`
      : `@图像${index}`;
  };

  // 生成最终 Prompt
  const generatePrompt = () => {
    let prompt = `Prompt: ${totalDuration}秒智性博弈式战斗动漫片段，贴合复仇主题。\n\n`;

    shots.forEach((shot, index) => {
      prompt += `${shot.startTime}-${shot.endTime}秒：`;
      prompt += shot.description;

      // 添加参考素材
      const shotMaterials = shot.references.images.map(imgId => {
        const material = materials.find(m => m.id === imgId);
        return material ? getMaterialTagText(material.id) : '';
      }).filter(Boolean);

      if (shot.references.audio) {
        const audioMaterial = materials.find(m => m.id === shot.references.audio);
        if (audioMaterial) {
          shotMaterials.push(getMaterialTagText(audioMaterial.id));
        }
      }

      if (shotMaterials.length > 0) {
        prompt += ` ${shotMaterials.join('，')}`;
      }

      prompt += '\n\n';
    });

    setGeneratedPrompt(prompt);
    toast.success('分镜 Prompt 已生成');
  };

  // 复制 Prompt
  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast.success('已复制到剪贴板');
  };

  // 当前正在编辑的镜头
  const currentShot = shots.find(s => s.id === currentShotId);

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Film className="h-8 w-8 text-primary" />
              分镜编辑器
            </h1>
            <p className="text-muted-foreground mt-1">
              上传立绘和场景照，创建专业的分镜描述
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={generatePrompt}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              生成 Prompt
            </Button>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  上传素材
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>上传素材</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>素材类型</Label>
                    <Select value={uploadType} onValueChange={(v: MaterialType) => setUploadType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="character">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            立绘（角色）
                          </div>
                        </SelectItem>
                        <SelectItem value="scene">
                          <div className="flex items-center gap-2">
                            <Map className="h-4 w-4" />
                            场景照（背景）
                          </div>
                        </SelectItem>
                        <SelectItem value="audio">
                          <div className="flex items-center gap-2">
                            <Volume className="h-4 w-4" />
                            音频（配音）
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>选择文件</Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        点击或拖拽文件到此处上传
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept={uploadType === 'audio' ? 'audio/*' : 'image/*'}
                        onChange={(e) => handleUploadFile(e.target.files)}
                      />
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：素材库 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                素材库
              </CardTitle>
              <CardDescription>
                立绘、场景照、音频
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {materials.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImagePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无素材</p>
                    <p className="text-sm">点击上方0026quot;上传素材0026quot;开始添加</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 立绘 */}
                    {materials.filter(m => m.type === 'character').length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          立绘
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {materials
                            .filter(m => m.type === 'character')
                            .map(material => (
                              <div
                                key={material.id}
                                className="relative group cursor-pointer rounded-lg overflow-hidden border"
                                onClick={() => insertMaterialTag(material.id)}
                              >
                                <img
                                  src={material.url}
                                  alt={material.name}
                                  className="w-full h-20 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Plus className="h-6 w-6 text-white" />
                                </div>
                                <Badge className="absolute top-1 right-1 h-5 px-1.5 text-[10px]">
                                  {getMaterialTagText(material.id)}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 场景 */}
                    {materials.filter(m => m.type === 'scene').length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Map className="h-4 w-4" />
                          场景
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {materials
                            .filter(m => m.type === 'scene')
                            .map(material => (
                              <div
                                key={material.id}
                                className="relative group cursor-pointer rounded-lg overflow-hidden border"
                                onClick={() => insertMaterialTag(material.id)}
                              >
                                <img
                                  src={material.url}
                                  alt={material.name}
                                  className="w-full h-20 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Plus className="h-6 w-6 text-white" />
                                </div>
                                <Badge className="absolute top-1 right-1 h-5 px-1.5 text-[10px]">
                                  {getMaterialTagText(material.id)}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 音频 */}
                    {materials.filter(m => m.type === 'audio').length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Volume className="h-4 w-4" />
                          音频
                        </h4>
                        <div className="space-y-2">
                          {materials
                            .filter(m => m.type === 'audio')
                            .map(material => (
                              <div
                                key={material.id}
                                className="flex items-center justify-between p-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => insertMaterialTag(material.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <Music className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm truncate max-w-[120px]">{material.name}</span>
                                </div>
                                <Badge className="h-5 px-1.5 text-[10px]">
                                  {getMaterialTagText(material.id)}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 中间：时间轴和编辑器 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    时间轴
                  </CardTitle>
                  <CardDescription>
                    总时长: {totalDuration} 秒 | {shots.length} 个镜头
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addShot}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  添加镜头
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 时间轴可视化 */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="space-y-2">
                  {shots.map((shot, index) => (
                    <div
                      key={shot.id}
                      className={cn(
                        "relative rounded-lg border-2 cursor-pointer transition-all",
                        currentShotId === shot.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setCurrentShotId(shot.id)}
                      style={{
                        marginLeft: `${(shot.startTime / totalDuration) * 100}%`,
                        width: `${((shot.endTime - shot.startTime) / totalDuration) * 100}%`,
                      }}
                    >
                      <div className="p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {index + 1}
                            </Badge>
                            <span className="text-xs font-medium">
                              {shot.startTime}s - {shot.endTime}s
                            </span>
                          </div>
                          {currentShotId === shot.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteShot(shot.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 时间刻度 */}
                <div className="flex justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <span>0s</span>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i}>{i + 1}s</span>
                  ))}
                </div>
              </div>

              {/* 镜头编辑器 */}
              {currentShot && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">编辑镜头 #{shots.indexOf(currentShot) + 1}</h3>
                    <Badge variant="outline">
                      {currentShot.startTime}s - {currentShot.endTime}s
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>开始时间（秒）</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max={totalDuration}
                        value={currentShot.startTime}
                        onChange={(e) =>
                          updateShot(currentShot.id, {
                            startTime: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>结束时间（秒）</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max={totalDuration}
                        value={currentShot.endTime}
                        onChange={(e) =>
                          updateShot(currentShot.id, {
                            endTime: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>镜头描述</Label>
                    <Textarea
                      value={currentShot.description}
                      onChange={(e) =>
                        updateShot(currentShot.id, { description: e.target.value })
                      }
                      rows={3}
                      placeholder="描述镜头的内容..."
                    />
                    <p className="text-xs text-muted-foreground">
                      点击左侧素材可插入标记，如 @图像1、@音频1
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>镜头运动</Label>
                    <Input
                      value={currentShot.cameraMovement}
                      onChange={(e) =>
                        updateShot(currentShot.id, { cameraMovement: e.target.value })
                      }
                      placeholder="例如：转镜、快速摇镜头、切镜头俯拍"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>角色动作/对白</Label>
                    <Textarea
                      value={currentShot.characterAction}
                      onChange={(e) =>
                        updateShot(currentShot.id, { characterAction: e.target.value })
                      }
                      rows={3}
                      placeholder="描述角色的动作和对白..."
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 生成的 Prompt */}
        {generatedPrompt && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    生成的分镜 Prompt
                  </CardTitle>
                  <CardDescription>
                    复制到视频生成接口使用
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPrompt}
                    className="gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGeneratedPrompt('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={generatedPrompt}
                readOnly
                rows={12}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
