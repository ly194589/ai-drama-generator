'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, AlertCircle, Zap, Brain, Sparkles, Eye, EyeOff,
  Loader2, Trash2, ExternalLink, KeyRound, ImageIcon as ImageIconLucide, Video, Music, Save
} from 'lucide-react';
import { isAdmin as checkIsAdmin } from '@/lib/admin-utils';

/**
 * 方案配置
 */
interface SolutionModel {
  llm: string;
  llmDescription: string;
  llmAlternative?: string;
  llmAlternativeDescription?: string;
  image?: string;
  imageDescription?: string;
  video: string;
  videoDescription: string;
  tts?: string;
  ttsDescription?: string;
}

interface Solution {
  id: string;
  name: string;
  description: string;
  provider: string;
  available: boolean;
  configured: boolean;
  models: SolutionModel;
  features: string[];
  useCase: string[];
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  configUrl: string;
  apiKeyEndpoint: string;
  maskedKey: string | null;
  configured: boolean;
  baseUrl?: string;
}

/**
 * 模型方案选择器组件
 * 优化为紧凑布局，支持多方案切换
 */
interface SolutionSelectorProps {
  onSolutionChange?: (solutionId: string) => void;
  onConfigChange?: () => void;
}

export function SolutionSelector({ onSolutionChange, onConfigChange }: SolutionSelectorProps) {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<string>('standard');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('zhipu');

  // API Key 配置状态
  const [showApiKey, setShowApiKey] = useState(false);

  // 提供商配置
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  // 各提供商的输入状态（apiKey / baseUrl）
  const [providerInputs, setProviderInputs] = useState<Record<string, { apiKey: string; baseUrl: string }>>({});
  const [providerErrors, setProviderErrors] = useState<Record<string, string | null>>({});
  const [providerSuccess, setProviderSuccess] = useState<Record<string, string | null>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  // 支持的提供商列表（与模型设置页一致）
  const SUPPORTED_PROVIDERS = [
    { id: 'zhipu', name: '智谱 AI', configUrl: 'https://open.bigmodel.cn/ai/apikey' },
    { id: 'volcengine', name: '火山引擎', configUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey' },
    { id: 'qwen', name: '千问', configUrl: 'https://bailian.console.aliyun.com/' },
    { id: 'minimax', name: 'MiniMax', configUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key' },
    { id: 'moonshot', name: '月之暗面', configUrl: 'https://platform.moonshot.cn/console/api-key' },
    { id: 'deepseek', name: 'DeepSeek', configUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'wenxin', name: '百度文心', configUrl: 'https://console.bce.baidu.com/iam/#/iam/apikey/list' },
    { id: 'hunyuan', name: '腾讯混元', configUrl: 'https://console.cloud.tencent.com/hunyuan/api-key' },
    { id: 'custom', name: '自定义', configUrl: '' },
  ];

  // 当前模型配置
  const [modelConfig, setModelConfig] = useState({
    llm: '',
    imageSize: '',
    video: '',
    tts: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // 检查是否是管理员
  const isAdminUser = checkIsAdmin();

  // 获取当前用户ID（与模型设置页保持一致）
  const getUserId = () => {
    if (typeof window === 'undefined') return 'dev-user';
    return localStorage.getItem('userId') || 'dev-user';
  };

  useEffect(() => {
    const fetchSolutions = async () => {
      try {
        const res = await fetch('/api/solution');
        const data = await res.json();
        setSolutions(data.solutions);
        setSelectedSolution(data.defaultSolution);

        // 获取各提供商的 API Key 状态
        await fetchProviderConfigs();

        // 加载用户模型配置
        await fetchUserConfig();
      } catch (error) {
        console.error('获取方案失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSolutions();
  }, []);

  const fetchUserConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success && data.config) {
        setModelConfig({
          llm: data.config.llm_model || '',
          imageSize: data.config.image_size || '2K',
          video: data.config.video_model || '',
          tts: data.config.tts_speaker || '',
        });
        // 同时更新选中的方案
        if (data.config.solution_preset) {
          setSelectedSolution(data.config.solution_preset);
        }
      }
    } catch (error) {
      console.error('获取用户配置失败:', error);
    }
  };

  const fetchProviderConfigs = async () => {
    try {
      const res = await fetch('/api/providers/config', {
        headers: { 'x-user-id': getUserId() },
      });
      const data = await res.json();
      if (data.providers) {
        const providers: ProviderConfig[] = SUPPORTED_PROVIDERS.map(sp => {
          const remote = data.providers[sp.id];
          return {
            id: sp.id,
            name: sp.name,
            icon: <Sparkles className="h-4 w-4" />,
            color: 'blue',
            configUrl: sp.configUrl,
            apiKeyEndpoint: '/api/providers/config',
            maskedKey: remote?.maskedKey || null,
            configured: Boolean(remote?.configured),
            baseUrl: remote?.baseUrl || '',
          };
        });
        setProviderConfigs(providers);
        // 初始化各提供商输入框默认值
        setProviderInputs(prev => {
          const next = { ...prev };
          for (const p of providers) {
            if (!next[p.id]) {
              next[p.id] = { apiKey: '', baseUrl: p.baseUrl || '' };
            }
          }
          return next;
        });
      }
    } catch (error) {
      console.error('获取提供商配置失败:', error);
    }
  };

  const handleSaveApiKey = async (provider: ProviderConfig) => {
    const input = providerInputs[provider.id] || { apiKey: '', baseUrl: provider.baseUrl };
    if (!input.apiKey.trim()) {
      setProviderErrors(prev => ({ ...prev, [provider.id]: '请输入 API Key' }));
      return;
    }
    if (provider.id === 'custom' && !input.baseUrl.trim()) {
      setProviderErrors(prev => ({ ...prev, [provider.id]: '自定义方案必须填写接口端点（Base URL）' }));
      return;
    }

    setSavingProvider(provider.id);
    setProviderErrors(prev => ({ ...prev, [provider.id]: null }));
    setProviderSuccess(prev => ({ ...prev, [provider.id]: null }));

    try {
      const res = await fetch('/api/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': getUserId() },
        body: JSON.stringify({
          provider: provider.id,
          apiKey: input.apiKey.trim(),
          baseUrl: input.baseUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setProviderErrors(prev => ({ ...prev, [provider.id]: data.error || '保存失败' }));
        return;
      }

      setProviderSuccess(prev => ({ ...prev, [provider.id]: `${provider.name} API Key 配置成功！` }));
      setProviderInputs(prev => ({ ...prev, [provider.id]: { apiKey: '', baseUrl: input.baseUrl } }));

      // 更新提供商配置
      await fetchProviderConfigs();

      // 触发全局配置更新事件
      window.dispatchEvent(new CustomEvent('config-updated', {
        detail: { type: 'api-key-saved', provider: provider.id }
      }));
    } catch (error) {
      console.error('保存 API Key 失败:', error);
      setProviderErrors(prev => ({ ...prev, [provider.id]: '保存失败，请重试' }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteApiKey = async (provider: ProviderConfig) => {
    if (!confirm(`确定要删除 ${provider.name} API Key 吗？`)) return;

    setSavingProvider(provider.id);
    try {
      const res = await fetch(`/api/providers/config?provider=${provider.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': getUserId() },
      });
      if (res.ok) {
        await fetchProviderConfigs();
        // 触发全局配置更新事件
        window.dispatchEvent(new CustomEvent('config-updated', {
          detail: { type: 'api-key-deleted', provider: provider.id }
        }));
      }
    } catch (error) {
      console.error('删除 API Key 失败:', error);
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSelectSolution = async (solutionId: string) => {
    const solution = solutions.find(s => s.id === solutionId);
    if (!solution || !solution.configured) return;

    try {
      const res = await fetch('/api/solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solution: solutionId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSelectedSolution(solutionId);
        // 切换方案后更新模型配置
        if (solution.models) {
          setModelConfig({
            llm: solution.models.llm || '',
            imageSize: '2K',
            video: solution.models.video || '',
            tts: solution.models.tts || '',
          });
        }
        // 通知父组件方案已切换
        if (onSolutionChange) {
          onSolutionChange(solutionId);
        }
        // 触发全局配置更新事件
        window.dispatchEvent(new CustomEvent('config-updated', {
          detail: { type: 'solution-changed', solutionId }
        }));
      } else {
        alert(data.error || '切换失败');
      }
    } catch (error) {
      console.error('切换方案失败:', error);
    }
  };

  const handleSaveModelConfig = async () => {
    setSavingConfig(true);
    setConfigSuccess(null);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solution_preset: selectedSolution,
          llm_model: modelConfig.llm,
          image_size: modelConfig.imageSize,
          video_model: modelConfig.video,
          tts_speaker: modelConfig.tts,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setConfigSuccess('模型配置已保存！');
        setTimeout(() => setConfigSuccess(null), 3000);
        // 重新获取配置以同步数据
        await fetchUserConfig();
        // 触发全局配置更新事件
        window.dispatchEvent(new CustomEvent('config-updated', {
          detail: { type: 'config-saved' }
        }));
        // 通知父组件刷新配置
        if (onConfigChange) {
          onConfigChange();
        }
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSavingConfig(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'coze': return <Zap className="h-5 w-5 text-orange-500" />;
      case 'zhipu': return <Brain className="h-5 w-5 text-blue-500" />;
      case 'qwen': return <Sparkles className="h-5 w-5 text-purple-500" />;
      case 'volcengine': return <Zap className="h-5 w-5 text-rose-500" />;
      case 'minimax': return <Brain className="h-5 w-5 text-red-500" />;
      case 'moonshot': return <Sparkles className="h-5 w-5 text-slate-500" />;
      case 'deepseek': return <Brain className="h-5 w-5 text-indigo-500" />;
      case 'wenxin': return <Sparkles className="h-5 w-5 text-cyan-500" />;
      case 'hunyuan': return <Brain className="h-5 w-5 text-sky-500" />;
      case 'custom': return <KeyRound className="h-5 w-5 text-green-500" />;
      default: return <Zap className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">模型方案</h2>
        </div>
        <Badge variant="secondary" className="ml-2">
          {solutions.filter(s => s.configured).length} / {solutions.length} 可用
        </Badge>
      </div>

      {/* 当前方案展示 */}
      <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getProviderIcon(solutions.find(s => s.id === selectedSolution)?.provider || 'coze')}
              <div>
                <div className="text-sm text-muted-foreground">当前方案</div>
                <div className="font-semibold">
                  {solutions.find(s => s.id === selectedSolution)?.name}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/50">
              使用中
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 方案切换 - 紧凑网格 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {solutions.map((solution) => {
          const isCurrent = selectedSolution === solution.id;
          return (
            <button
              key={solution.id}
              onClick={() => handleSelectSolution(solution.id)}
              disabled={!solution.configured}
              className={`
                p-3 rounded-lg border-2 transition-all text-left relative
                ${isCurrent
                  ? 'border-primary bg-primary/5'
                  : solution.configured
                    ? 'border-border hover:border-primary/50 hover:bg-muted/50'
                    : 'border-border opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getProviderIcon(solution.provider)}
                  <span className="font-medium text-sm">{solution.name}</span>
                </div>
                {solution.id === 'standard' && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">推荐</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1">
                {solution.description}
              </div>
              <div className="absolute top-2 right-2">
                {isCurrent && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
                {!isCurrent && !solution.configured && (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 当前方案详细配置 */}
      {selectedSolution && (() => {
        const currentSolution = solutions.find(s => s.id === selectedSolution);
        if (!currentSolution) return null;

        return (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    模型配置
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {currentSolution.name}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleSaveModelConfig}
                  disabled={savingConfig}
                  size="sm"
                  className="h-8"
                >
                  {savingConfig ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      保存配置
                    </>
                  )}
                </Button>
              </div>
              {configSuccess && (
                <div className="text-xs text-green-600 flex items-center gap-1 mt-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {configSuccess}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* LLM 模型 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium">大语言模型 (LLM)</Label>
                  <span className="text-xs text-muted-foreground">- 剧本生成/AI顾问</span>
                  {currentSolution.id === 'standard' && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">推荐</Badge>
                  )}
                </div>
                <Select value={modelConfig.llm} onValueChange={(value) => setModelConfig(prev => ({ ...prev, llm: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 LLM 模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doubao-seed-2-0-pro-260215">
                      Doubao Seed 2.0 Pro（旗舰）
                    </SelectItem>
                    <SelectItem value="doubao-seed-2-0-lite-260215">
                      Doubao Seed 2.0 Lite（性价比）
                    </SelectItem>
                    <SelectItem value="doubao-seed-2-0-mini-260215">
                      Doubao Seed 2.0 Mini（轻量）
                    </SelectItem>
                    {currentSolution.id === 'zhipu' && (
                      <>
                        <SelectItem value="glm-5.3">GLM-5.3（官方最新旗舰，1M上下文）</SelectItem>
                        <SelectItem value="glm-5.3-flash">GLM-5.3-Flash（高性价比多模态）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'qwen' && (
                      <>
                        <SelectItem value="qwen3.8-max">Qwen3.8 Max（官方最新旗舰）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'minimax' && (
                      <>
                        <SelectItem value="MiniMax-M3">MiniMax M3（官方最新旗舰）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'moonshot' && (
                      <>
                        <SelectItem value="kimi-k3">Kimi K3（官方最新旗舰）</SelectItem>
                        <SelectItem value="kimi-k3-turbo">Kimi K3 Turbo（极速版）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'deepseek' && (
                      <>
                        <SelectItem value="deepseek-v4">DeepSeek V4（官方最新旗舰）</SelectItem>
                        <SelectItem value="deepseek-r1">DeepSeek R1（深度推理）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'wenxin' && (
                      <>
                        <SelectItem value="ernie-5.0">文心 5.0（官方最新旗舰）</SelectItem>
                        <SelectItem value="ernie-5.0-turbo">文心 5.0 Turbo（极速版）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'hunyuan' && (
                      <>
                        <SelectItem value="hunyuan-turbos">混元 TurboS（官方最新旗舰）</SelectItem>
                        <SelectItem value="hunyuan-large">混元 Large（满血版）</SelectItem>
                      </>
                    )}
                    {currentSolution.id === 'custom' && (
                      <div className="px-2 py-1.5">
                        <Label className="text-[10px] text-muted-foreground">自定义模型名称</Label>
                        <Input
                          value={modelConfig.llm}
                          onChange={(e) => setModelConfig(prev => ({ ...prev, llm: e.target.value }))}
                          placeholder="例如 my-model / gpt-4o / glm-4-flash"
                          className="h-8 mt-1 text-xs"
                        />
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {currentSolution.models.llmDescription}
                </p>
              </div>

              {/* 图片生成尺寸 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIconLucide className="h-4 w-4 text-green-500" />
                  <Label className="text-sm font-medium">图片生成尺寸</Label>
                  <span className="text-xs text-muted-foreground">- 海报/场景/角色</span>
                  {currentSolution.id === 'standard' && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">推荐</Badge>
                  )}
                </div>
                <Select value={modelConfig.imageSize} onValueChange={(value) => setModelConfig(prev => ({ ...prev, imageSize: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择图片尺寸" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2K">2K (2560×1440) - 标准高清</SelectItem>
                    <SelectItem value="4K">4K (3840×2160) - 超高清</SelectItem>
                    <SelectItem value="1024x1024">1024×1024 - 正方形</SelectItem>
                    <SelectItem value="768x1024">768×1024 - 竖版</SelectItem>
                    <SelectItem value="1024x768">1024×768 - 横版</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {modelConfig.imageSize === '2K' ? '标准高清，平衡质量与速度' : 
                   modelConfig.imageSize === '4K' ? '超高清画质，适合精细场景' : 
                   '自定义尺寸'}
                </p>
              </div>

              {/* 视频生成模型 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-purple-500" />
                  <Label className="text-sm font-medium">视频生成模型</Label>
                  <span className="text-xs text-muted-foreground">- 短剧/剧情</span>
                  {currentSolution.id === 'standard' && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">推荐</Badge>
                  )}
                </div>
                <Select value={modelConfig.video} onValueChange={(value) => setModelConfig(prev => ({ ...prev, video: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择视频模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doubao-seedance-2-0-260128">
                      Seedance 2.0
                    </SelectItem>
                    <SelectItem value="doubao-seedance-2-0-260128">
                      Seedance 1.5 Pro
                    </SelectItem>
                    {currentSolution.id === 'zhipu' && (
                      <SelectItem value="cogvideox-3">CogVideoX-3</SelectItem>
                    )}
                    {currentSolution.id === 'qwen' && (
                      <SelectItem value="wan2.7-i2v">Wan2.7-i2V</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {currentSolution.models.videoDescription}
                </p>
              </div>

              {/* 默认配音语音 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-orange-500" />
                  <Label className="text-sm font-medium">默认配音语音</Label>
                  <span className="text-xs text-muted-foreground">- 旁白/对白</span>
                  {currentSolution.id === 'standard' && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">推荐</Badge>
                  )}
                </div>
                <Select value={modelConfig.tts} onValueChange={(value) => setModelConfig(prev => ({ ...prev, tts: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择配音语音" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh_female_mizai_saturn_bigtts">
                      米子（女）- 专业视频配音
                    </SelectItem>
                    <SelectItem value="zh_female_tianwei_saturn_bigtts">
                      天薇（女）- 温柔知性
                    </SelectItem>
                    <SelectItem value="zh_male_yangxuan_saturn_bigtts">
                      云希（男）- 深沉磁性
                    </SelectItem>
                    <SelectItem value="zh_male_yufan_saturn_bigtts">
                      羽凡（男）- 活力阳光
                    </SelectItem>
                    {currentSolution.id === 'zhipu' && (
                      <SelectItem value="glm-tts">GLM-TTS</SelectItem>
                    )}
                    {currentSolution.id === 'qwen' && (
                      <SelectItem value="qwen-tts-v1">Qwen TTS v1</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {currentSolution.models.ttsDescription || '专业语音合成，情感丰富'}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* API Key 配置 - 标签页 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            API Key 配置
          </CardTitle>
          <CardDescription className="text-xs">
            配置第三方模型的 API Key 以使用对应方案
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 gap-1 h-auto flex-wrap p-1">
              {SUPPORTED_PROVIDERS.map(sp => (
                <TabsTrigger key={sp.id} value={sp.id} className="gap-1.5 text-xs">
                  {getProviderIcon(sp.id)}
                  {sp.name}
                  {providerConfigs.find(p => p.id === sp.id)?.configured && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">已配置</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {providerConfigs.map((provider) => {
              const input = providerInputs[provider.id] || { apiKey: '', baseUrl: provider.baseUrl || '' };
              const error = providerErrors[provider.id];
              const success = providerSuccess[provider.id];
              const saving = savingProvider === provider.id;
              const isCustom = provider.id === 'custom';

              return (
                <TabsContent key={provider.id} value={provider.id} className="space-y-4 mt-4">
                  {/* 配置状态 */}
                  {provider.maskedKey && (
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">
                          已配置 API Key: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{provider.maskedKey}</code>
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteApiKey(provider)}
                        disabled={saving}
                        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* 输入表单 */}
                  <div className="space-y-2">
                    <Label htmlFor={`${provider.id}-api-key`} className="text-sm">
                      {provider.maskedKey ? '更新 API Key' : '输入 API Key'}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`${provider.id}-api-key`}
                          type={showApiKey ? 'text' : 'password'}
                          placeholder={provider.maskedKey ? "输入新的 API Key" : "请粘贴 API Key"}
                          value={input.apiKey}
                          onChange={(e) => {
                            setProviderInputs(prev => ({ ...prev, [provider.id]: { ...input, apiKey: e.target.value } }));
                            setProviderErrors(prev => ({ ...prev, [provider.id]: null }));
                            setProviderSuccess(prev => ({ ...prev, [provider.id]: null }));
                          }}
                          className="h-9 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <Button
                        onClick={() => handleSaveApiKey(provider)}
                        disabled={saving || !input.apiKey.trim()}
                        className="h-9 px-4 text-sm"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            验证中...
                          </>
                        ) : (
                          '保存'
                        )}
                      </Button>
                    </div>

                    {/* 自定义 API 端点 */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        API 端点（协议 Base URL）{!isCustom && ' - 留空使用默认地址'}
                      </Label>
                      <Input
                        type="text"
                        placeholder={isCustom ? '例如 https://your-proxy.com/v1（OpenAI 兼容接口）' : '默认官方端点，可自定义'}
                        value={input.baseUrl}
                        onChange={(e) => {
                          setProviderInputs(prev => ({ ...prev, [provider.id]: { ...input, baseUrl: e.target.value } }));
                          setProviderErrors(prev => ({ ...prev, [provider.id]: null }));
                          setProviderSuccess(prev => ({ ...prev, [provider.id]: null }));
                        }}
                        className="h-8 text-xs font-mono"
                      />
                      {isCustom && (
                        <p className="text-[10px] text-muted-foreground">
                          支持任意 OpenAI 兼容协议的中转/私有化服务，模型名可在上方 LLM 配置中填写
                        </p>
                      )}
                    </div>

                    {/* 获取链接 */}
                    {provider.configUrl && (
                      <a
                        href={provider.configUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        获取 {provider.name} API Key <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {/* 错误提示 */}
                    {error && (
                      <p className="text-xs text-red-600 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </p>
                    )}

                    {/* 成功提示 */}
                    {success && (
                      <p className="text-xs text-green-600 flex items-center gap-1 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                        <CheckCircle2 className="h-3 w-3" />
                        {success}
                      </p>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* 提示信息 */}
      <div className="text-xs text-muted-foreground flex items-start gap-2 bg-muted/30 p-3 rounded-lg">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p>扣子方案无需配置，开箱即用。智谱和千问方案需要先配置对应的 API Key 才能使用。</p>
        <p>配置完成后即可切换方案使用对应的模型服务。</p>
        </div>
      </div>
    </div>
  );
}
