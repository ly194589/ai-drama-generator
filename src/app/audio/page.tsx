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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Music,
  Mic,
  Volume2,
  Upload,
  Play,
  Pause,
  Trash2,
  Loader2,
  Sparkles,
  Download,
  Wand2,
} from 'lucide-react';

interface AudioMaterial {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  file_name: string;
  duration: number;
  character_name: string;
  voice_style: string;
  emotion: string;
  mood: string;
  tempo: string;
  tags: string[];
  audioUrl: string;
  created_at: string;
}

const voiceSpeakers = [
  { value: 'zh_female_xiaohe_uranus_bigtts', label: '小荷 - 通用女声' },
  { value: 'zh_male_m191_uranus_bigtts', label: '云舟 - 通用男声' },
  { value: 'zh_female_vv_uranus_bigtts', label: 'Vivi - 中英双语' },
  { value: 'zh_male_dayi_saturn_bigtts', label: '大义 - 视频配音' },
  { value: 'zh_female_mizai_saturn_bigtts', label: '米仔 - 视频配音' },
  { value: 'zh_female_meilinvyou_saturn_bigtts', label: '魅力女友' },
  { value: 'zh_male_ruyayichen_saturn_bigtts', label: '儒雅男声' },
];

const audioTypes = [
  { value: 'voice', label: '配音' },
  { value: 'bgm', label: '背景音乐' },
  { value: 'sfx', label: '音效' },
];

const moods = [
  { value: '浪漫', label: '浪漫' },
  { value: '紧张', label: '紧张' },
  { value: '温馨', label: '温馨' },
  { value: '悲伤', label: '悲伤' },
  { value: '热血', label: '热血' },
  { value: '悬疑', label: '悬疑' },
];

const tempos = [
  { value: '慢', label: '慢节奏' },
  { value: '中', label: '中节奏' },
  { value: '快', label: '快节奏' },
];

export default function AudioPage() {
  const [audios, setAudios] = useState<AudioMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 上传表单
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    title: '',
    type: 'voice',
    characterName: '',
    voiceStyle: '',
    emotion: '',
    mood: '',
    tempo: '中',
  });

  // AI生成配音表单
  const [generateForm, setGenerateForm] = useState({
    text: '',
    title: '',
    speaker: 'zh_female_xiaohe_uranus_bigtts',
    characterName: '',
    speechRate: 0,
  });

  // 加载音频列表
  const loadAudios = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/audio', {
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      const data = await response.json();
      if (data.success) {
        setAudios(data.audios);
      }
    } catch (error) {
      console.error('加载音频列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudios();
  }, [loadAudios]);

  // 播放音频
  const playAudio = (audio: AudioMaterial) => {
    if (playingId === audio.id) {
      setPlayingId(null);
    } else {
      setPlayingId(audio.id);
      const audioEl = new Audio(audio.audioUrl);
      audioEl.play();
      audioEl.onended = () => setPlayingId(null);
    }
  };

  // 删除音频
  const deleteAudio = async (id: string) => {
    if (!confirm('确定要删除这个音频吗？')) return;

    try {
      const response = await fetch(`/api/audio/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
      });
      if (response.ok) {
        setAudios(audios.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error('删除音频失败:', error);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file, title: uploadForm.title || file.name });
    }
  };

  // 上传音频
  const uploadAudio = async () => {
    if (!uploadForm.file) {
      alert('请选择文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('title', uploadForm.title);
    formData.append('type', uploadForm.type);
    formData.append('characterName', uploadForm.characterName);
    formData.append('voiceStyle', uploadForm.voiceStyle);
    formData.append('emotion', uploadForm.emotion);
    formData.append('mood', uploadForm.mood);
    formData.append('tempo', uploadForm.tempo);

    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setShowUploadDialog(false);
        loadAudios();
      }
    } catch (error) {
      console.error('上传音频失败:', error);
    } finally {
      setUploading(false);
    }
  };

  // AI生成配音
  const generateVoice = async () => {
    if (!generateForm.text) {
      alert('请输入要合成的文本');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': JSON.parse(localStorage.getItem('user') || '{}')?.id || '' },
        body: JSON.stringify({
          text: generateForm.text,
          title: generateForm.title,
          speaker: generateForm.speaker,
          characterName: generateForm.characterName,
          speechRate: generateForm.speechRate,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowGenerateDialog(false);
        loadAudios();
      }
    } catch (error) {
      console.error('AI配音生成失败:', error);
    } finally {
      setGenerating(false);
    }
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'voice': return <Mic className="h-4 w-4" />;
      case 'bgm': return <Music className="h-4 w-4" />;
      case 'sfx': return <Volume2 className="h-4 w-4" />;
      default: return <Music className="h-4 w-4" />;
    }
  };

  // 获取类型名称
  const getTypeName = (type: string) => {
    const found = audioTypes.find(t => t.value === type);
    return found?.label || type;
  };

  // 过滤音频
  const filteredAudios = audios.filter((audio) => {
    if (activeTab === 'all') return true;
    return audio.type === activeTab;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                    <Music className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">音乐管理</h1>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  管理配音、背景音乐、音效素材
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button variant="outline" onClick={() => setShowUploadDialog(true)} size="sm" className="bg-background/50 backdrop-blur-sm">
                  <Upload className="h-4 w-4 mr-2" />
                  上传
                </Button>
                <Button onClick={() => setShowGenerateDialog(true)} size="sm" className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/25">
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI配音
                </Button>
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
                  <Music className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">{audios.length}</p>
                  <p className="text-xs text-muted-foreground">音频总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 group-hover:scale-110 transition-transform">
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">
                    {audios.filter((a) => a.type === 'voice').length}
                  </p>
                  <p className="text-xs text-muted-foreground">配音素材</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/10 group-hover:scale-110 transition-transform">
                  <Music className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">
                    {audios.filter((a) => a.type === 'bgm').length}
                  </p>
                  <p className="text-xs text-muted-foreground">背景音乐</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform">
                  <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold truncate">
                    {audios.filter((a) => a.type === 'sfx').length}
                  </p>
                  <p className="text-xs text-muted-foreground">音效素材</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="voice">
              <Mic className="h-4 w-4 mr-2" />
              配音
            </TabsTrigger>
            <TabsTrigger value="bgm">
              <Music className="h-4 w-4 mr-2" />
              BGM
            </TabsTrigger>
            <TabsTrigger value="sfx">
              <Volume2 className="h-4 w-4 mr-2" />
              音效
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4">加载中...</p>
                </CardContent>
              </Card>
            ) : filteredAudios.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>暂无音频素材</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击上方按钮上传或AI生成音频
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredAudios.map((audio) => (
                  <Card key={audio.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full"
                            onClick={() => playAudio(audio)}
                          >
                            {playingId === audio.id ? (
                              <Pause className="h-5 w-5" />
                            ) : (
                              <Play className="h-5 w-5" />
                            )}
                          </Button>
                          <span className="text-xs text-muted-foreground mt-1">
                            {formatDuration(audio.duration)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getTypeIcon(audio.type)}
                            <span className="font-medium">{audio.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {getTypeName(audio.type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {audio.description || audio.file_name}
                          </p>
                          {audio.type === 'voice' && audio.character_name && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary">{audio.character_name}</Badge>
                              {audio.voice_style && (
                                <Badge variant="outline">{audio.voice_style}</Badge>
                              )}
                            </div>
                          )}
                          {audio.type === 'bgm' && (
                            <div className="flex items-center gap-2 mt-2">
                              {audio.mood && (
                                <Badge variant="secondary">{audio.mood}</Badge>
                              )}
                              {audio.tempo && (
                                <Badge variant="outline">{audio.tempo}节奏</Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAudio(audio.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>上传音频</DialogTitle>
              <DialogDescription>上传配音、背景音乐或音效素材</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>选择音频文件</Label>
                <Input type="file" accept="audio/*" onChange={handleFileSelect} />
              </div>
              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="输入标题"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>类型</Label>
                  <Select value={uploadForm.type} onValueChange={(v) => setUploadForm({ ...uploadForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {audioTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>节奏</Label>
                  <Select value={uploadForm.tempo} onValueChange={(v) => setUploadForm({ ...uploadForm, tempo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tempos.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>取消</Button>
                <Button onClick={uploadAudio} disabled={uploading}>
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
              <DialogTitle>AI配音生成</DialogTitle>
              <DialogDescription>使用AI自动生成语音配音</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  value={generateForm.title}
                  onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
                  placeholder="输入标题"
                />
              </div>
              <div className="space-y-2">
                <Label>要合成的文本</Label>
                <Textarea
                  value={generateForm.text}
                  onChange={(e) => setGenerateForm({ ...generateForm, text: e.target.value })}
                  placeholder="输入要转换成语音的文本..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>发音人</Label>
                  <Select value={generateForm.speaker} onValueChange={(v) => setGenerateForm({ ...generateForm, speaker: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {voiceSpeakers.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>角色名称（可选）</Label>
                  <Input
                    value={generateForm.characterName}
                    onChange={(e) => setGenerateForm({ ...generateForm, characterName: e.target.value })}
                    placeholder="关联角色名"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>取消</Button>
                <Button onClick={generateVoice} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  生成配音
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
