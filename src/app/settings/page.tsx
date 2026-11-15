'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Settings,
  Shield,
  Zap,
  Video,
  Image,
  Music,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Brain,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Save,
  ExternalLink,
  KeyRound,
  Cpu,
  Plus,
  X,
} from 'lucide-react';
import { isAdmin } from '@/lib/admin-utils';
import {
  MODEL_PROVIDERS,
  MODEL_TYPE_META,
  getProvidersForType,
  getModelsForType,
  type ModelType,
  type ModelProviderMeta,
  type CatalogModel,
} from '@/lib/model-catalog';

// 配置状态
interface Config {
  solution_preset: string;
  video_model: string;
  video_resolution: string;
  llm_model: string;
  image_size: string;
  tts_speaker: string;
  llm_provider: string;
  image_provider: string;
  video_provider: string;
  tts_provider: string;
}

// 提供商配置
interface ProviderConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  configUrl: string;
  apiKeyEndpoint: string;
  maskedKey: string | null;
  configured: boolean;
  baseUrl: string;
  defaultBaseUrl: string;
}

// 支持的提供商列表（通用配置接口）
const SUPPORTED_PROVIDERS: { id: string; name: string; configUrl: string; color: string }[] = [
  { id: 'zhipu', name: '智谱 AI', configUrl: 'https://open.bigmodel.cn/ai/apikey', color: 'blue' },
  { id: 'nvidia', name: 'NVIDIA', configUrl: 'https://integrate.api.nvidia.com/', color: 'green' },
  { id: 'volcengine', name: '火山引擎', configUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', color: 'rose' },
  { id: 'qwen', name: '千问', configUrl: 'https://bailian.console.aliyun.com/', color: 'orange' },
  { id: 'minimax', name: 'MiniMax', configUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key', color: 'red' },
  { id: 'moonshot', name: '月之暗面', configUrl: 'https://platform.moonshot.cn/console/api-keys', color: 'slate' },
  { id: 'deepseek', name: 'DeepSeek', configUrl: 'https://platform.deepseek.com/api_keys', color: 'indigo' },
  { id: 'wenxin', name: '百度文心', configUrl: 'https://console.bce.baidu.com/iam/#/iam/apikey/list', color: 'cyan' },
  { id: 'hunyuan', name: '腾讯混元', configUrl: 'https://console.cloud.tencent.com/hunyuan/api-key', color: 'sky' },
  { id: 'custom', name: '自定义', configUrl: '', color: 'green' },
];

// 各提供商默认 Base URL
const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  minimax: 'https://api.minimax.chat/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  deepseek: 'https://api.deepseek.com/v1',
  wenxin: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1',
  custom: '',
};

const PROVIDER_ENDPOINT = '/api/providers/config';

// 全局中间件要求非公开 API 携带用户身份（x-user-id）
const userIdHeader = (): Record<string, string> => ({
  'x-user-id': localStorage.getItem('userId') || 'dev-user',
});

// 模型类型图标（与 Tabs 联动）
const MODEL_TYPE_ICONS: Record<ModelType, typeof Brain> = {
  llm: Brain,
  image: Image,
  video: Video,
  tts: Music,
};

// 自定义厂商在各分类下的协议/能力说明（与后端真实分发保持一致）
const CUSTOM_PROVIDER_NOTES: Record<ModelType, { text: string; warn?: boolean }> = {
  llm: { text: '自定义端点走 OpenAI 兼容 /chat/completions 协议，模型名需填端点实际支持的 ID' },
  image: { text: '自定义端点走 OpenAI 兼容 /images/generations 协议，模型名需填端点实际支持的图片模型 ID' },
  video: { text: '各家视频生成协议不统一，自定义端点暂未接入视频生成：可先保存厂商与模型配置，生成视频请暂选扣子内置、智谱或千问', warn: true },
  tts: { text: '自定义端点走 OpenAI 兼容 /audio/speech 协议：填写的音色 ID 作为 voice 参数，语音模型默认 tts-1' },
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  // 所有配置数据
  const [config, setConfig] = useState<Config>({
    solution_preset: 'standard',
    video_model: 'doubao-seedance-2-0-260128',
    video_resolution: '720p',
    llm_model: 'doubao-seed-2-0-pro-260215',
    image_size: '2K',
    tts_speaker: 'zh_female_mizai_saturn_bigtts',
    llm_provider: 'coze',
    image_provider: 'coze',
    video_provider: 'coze',
    tts_provider: 'coze',
  });

  // API Key 配置
  const [showApiKey, setShowApiKey] = useState(false);
  // 模型设置 Tab（按模型类型分组）
  const [activeModelTab, setActiveModelTab] = useState<ModelType>('llm');
  // 各类型正在保存的厂商（防重复提交）
  const [savingModelType, setSavingModelType] = useState<string | null>(null);

  // 提供商配置
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [activeProviderTab, setActiveProviderTab] = useState('zhipu');
  // 各提供商的输入状态（apiKey / baseUrl）
  const [providerInputs, setProviderInputs] = useState<Record<string, { apiKey: string; baseUrl: string }>>({});
  const [providerErrors, setProviderErrors] = useState<Record<string, string | null>>({});
  const [providerSuccess, setProviderSuccess] = useState<Record<string, string | null>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  /** 当前正在添加自定义模型的模型类型 */
  const [customModelType, setCustomModelType] = useState<ModelType | null>(null);
  /** 自定义模型输入草稿 */
  const [customModelDraft, setCustomModelDraft] = useState('');
  /** 各类型已添加的自定义模型清单（保存在本机浏览器） */
  const [customModels, setCustomModels] = useState<Record<ModelType, string[]>>({
    llm: [], image: [], video: [], tts: [],
  });

  // 加载本机保存的自定义模型清单
  useEffect(() => {
    try {
      const raw = localStorage.getItem('custom-models');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<ModelType, string[]>>;
        setCustomModels({
          llm: Array.isArray(parsed.llm) ? parsed.llm : [],
          image: Array.isArray(parsed.image) ? parsed.image : [],
          video: Array.isArray(parsed.video) ? parsed.video : [],
          tts: Array.isArray(parsed.tts) ? parsed.tts : [],
        });
      }
    } catch {
      // 忽略损坏的本地数据
    }
  }, []);

  const persistCustomModels = (next: Record<ModelType, string[]>) => {
    setCustomModels(next);
    try {
      localStorage.setItem('custom-models', JSON.stringify(next));
    } catch {
      // 存储不可用时仅保留内存状态
    }
  };

  // 加载所有数据
  const loadAllData = async () => {
    setRefreshing(true);
    try {
      // 并行加载配置与提供商状态
      const configRes = await fetch('/api/config', {
        headers: { 'x-user-id': localStorage.getItem('userId') || 'dev-user' },
      });
      const configData = await configRes.json();

      // 检查管理员权限
      const adminFlag = isAdmin();

      // 初始化提供商配置（等待完成）
      await initProviderConfigs();

      // 批量应用所有更新
      if (configData.success && configData.config) {
        setConfig(configData.config as Config);
      }
      setIsUserAdmin(adminFlag);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setRefreshing(false);
    }
  };

  const initProviderConfigs = async () => {
    // 通过通用提供商配置接口获取所有提供商状态
    try {
      const res = await fetch(PROVIDER_ENDPOINT, { headers: userIdHeader() });
      const data = await res.json();
      const statusMap = (data.providers || {}) as Record<string, { configured: boolean; maskedApiKey: string | null; baseUrl: string; defaultBaseUrl: string; name: string }>;

      const providers: ProviderConfig[] = SUPPORTED_PROVIDERS.map(sp => {
        const status = statusMap[sp.id];
        return {
          id: sp.id,
          name: sp.name,
          icon: null,
          color: sp.color,
          configUrl: sp.configUrl,
          apiKeyEndpoint: PROVIDER_ENDPOINT,
          maskedKey: status?.maskedApiKey || null,
          configured: status?.configured || false,
          baseUrl: status?.baseUrl || PROVIDER_DEFAULT_BASE_URLS[sp.id] || '',
          defaultBaseUrl: status?.defaultBaseUrl || PROVIDER_DEFAULT_BASE_URLS[sp.id] || '',
        };
      });

      setProviderConfigs(providers);
      // 初始化输入状态（baseUrl 默认值）
      setProviderInputs(prev => {
        const next = { ...prev };
        for (const p of providers) {
          if (next[p.id] === undefined) {
            next[p.id] = { apiKey: '', baseUrl: p.baseUrl || p.defaultBaseUrl };
          }
        }
        return next;
      });
    } catch (error) {
      console.error('获取提供商配置失败:', error);
      // 即使出错也设置基础配置
      const providers: ProviderConfig[] = SUPPORTED_PROVIDERS.map(sp => ({
        id: sp.id,
        name: sp.name,
        icon: null,
        color: sp.color,
        configUrl: sp.configUrl,
        apiKeyEndpoint: PROVIDER_ENDPOINT,
        maskedKey: null,
        configured: false,
        baseUrl: PROVIDER_DEFAULT_BASE_URLS[sp.id] || '',
        defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS[sp.id] || '',
      }));
      setProviderConfigs(providers);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 根据当前方案自动切换 API Key 配置 Tab
  useEffect(() => {
    if (config.solution_preset && config.solution_preset !== 'standard') {
      setActiveProviderTab(config.solution_preset);
    }
    // standard 方案不需要切换 Tab
  }, [config.solution_preset]);

  // 保存配置
  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'dev-user',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        setSaved(true);
        toast.success('配置已保存');
        setTimeout(() => setSaved(false), 2000);
      } else {
        throw new Error(data.error || '保存失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== 模型设置（按类型分组） ====================

  const getProviderStatus = (providerId: string): ProviderConfig | undefined =>
    providerConfigs.find(p => p.id === providerId);

  const getProviderMeta = (providerId: string): ModelProviderMeta | undefined =>
    MODEL_PROVIDERS.find(p => p.id === providerId);

  // 切换某类型下的厂商：立即持久化厂商选择；未配置 Key 时给出提醒；
  // 选中「自定义」且该分类还没有自定义模型时，直接展开添加表单，配置入口即时可见
  const handleSelectModelProvider = async (type: ModelType, providerId: string) => {
    setConfig(prev => ({ ...prev, [`${type}_provider`]: providerId }));
    setCustomModelType(providerId === 'custom' && (customModels[type] || []).length === 0 ? type : null);
    setCustomModelDraft('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userIdHeader() },
        body: JSON.stringify({ [`${type}_provider`]: providerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '保存失败');
    } catch {
      toast.error('厂商选择保存失败，请点击右上角「保存配置」重试');
    }
    if (providerId !== 'coze' && !getProviderStatus(providerId)?.configured) {
      toast.warning(`${getProviderMeta(providerId)?.name || providerId} 尚未配置 API Key，请先在下方配置后才能正常生成`);
    }
  };

  // 选择模型：更新配置并自动保存（厂商+模型一起写入，立即生效）；返回是否保存成功
  const handleSelectModel = async (type: ModelType, model: CatalogModel | { id: string; name?: string; description?: string }): Promise<boolean> => {
    if ('isCustomInput' in model && model.isCustomInput) return false; // custom 输入框单独处理
    const providerId = config[`${type}_provider`];
    const modelField = type === 'tts' ? 'tts_speaker' : `${type}_model`;
    const provider = getProviderStatus(providerId);
    const meta = getProviderMeta(providerId);
    const modelName = model.name || model.id;

    setSavingModelType(type);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'dev-user',
        },
        body: JSON.stringify({
          [`${type}_provider`]: providerId,
          [modelField]: model.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '保存失败');
      }
      setConfig(prev => ({ ...prev, [modelField]: model.id }));
      toast.success(`${meta?.name || providerId} · ${modelName} 已生效`);
      // 未配置 Key 时强提醒
      if (providerId !== 'coze' && provider && !provider.configured) {
        toast.warning(`${meta?.name || providerId} API Key 未配置，生成将失败，请先在下方配置密钥`);
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '模型保存失败');
      return false;
    } finally {
      setSavingModelType(null);
    }
  };

  // 添加自定义模型：保存成功后加入本机清单并立即启用
  const handleAddCustomModel = async (type: ModelType) => {
    const trimmed = customModelDraft.trim();
    if (!trimmed) {
      toast.error('请输入模型名称');
      return;
    }
    const ok = await handleSelectModel(type, { id: trimmed, name: trimmed, description: '' });
    if (!ok) return; // 保存失败时保留输入，便于修改重试
    const list = customModels[type] || [];
    if (!list.includes(trimmed)) {
      persistCustomModels({ ...customModels, [type]: [...list, trimmed] });
    }
    setCustomModelType(null);
    setCustomModelDraft('');
  };

  // 删除自定义模型：从清单移除；若正在使用则回退到清单内第一个模型
  const handleDeleteCustomModel = async (type: ModelType, modelId: string) => {
    const next = { ...customModels, [type]: (customModels[type] || []).filter(id => id !== modelId) };
    persistCustomModels(next);
    const current = type === 'tts'
      ? config.tts_speaker
      : (config as unknown as Record<string, string | undefined>)[`${type}_model`];
    if (current === modelId) {
      const fallback = getModelsForType(type, config[`${type}_provider`] || 'coze').find(m => m.id && !m.isCustomInput)?.id || next[type][0];
      if (fallback) {
        await handleSelectModel(type, { id: fallback, name: fallback });
      }
    }
    toast.success(`自定义模型 ${modelId} 已删除`);
  };

  // 保存 API Key（通用提供商接口，支持自定义 Base URL）
  const handleSaveApiKey = async (provider: ProviderConfig) => {
    const input = providerInputs[provider.id] || { apiKey: '', baseUrl: provider.defaultBaseUrl };
    if (!input.apiKey.trim()) {
      setProviderErrors(prev => ({ ...prev, [provider.id]: '请输入 API Key' }));
      return;
    }

    setSavingProvider(provider.id);
    setProviderErrors(prev => ({ ...prev, [provider.id]: null }));
    setProviderSuccess(prev => ({ ...prev, [provider.id]: null }));

    try {
      const res = await fetch(PROVIDER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'dev-user',
        },
        body: JSON.stringify({
          provider: provider.id,
          apiKey: input.apiKey.trim(),
          baseUrl: input.baseUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProviderErrors(prev => ({ ...prev, [provider.id]: data.error || '保存失败' }));
        return;
      }

      setProviderSuccess(prev => ({ ...prev, [provider.id]: `${provider.name} 配置成功！` }));
      toast.success(`${provider.name} API Key 配置成功！`);
      setProviderInputs(prev => ({ ...prev, [provider.id]: { apiKey: '', baseUrl: input.baseUrl } }));

      // 刷新提供商状态
      const statusRes = await fetch(`${PROVIDER_ENDPOINT}?provider=${provider.id}`, { headers: userIdHeader() });
      const statusData = await statusRes.json();
      setProviderConfigs(prev => prev.map(p =>
        p.id === provider.id
          ? { ...p, configured: statusData.configured, maskedKey: statusData.maskedApiKey, baseUrl: statusData.baseUrl || p.baseUrl }
          : p
      ));
    } catch (error) {
      console.error('保存 API Key 失败:', error);
      setProviderErrors(prev => ({ ...prev, [provider.id]: '保存失败，请重试' }));
    } finally {
      setSavingProvider(null);
    }
  };

  // 删除 API Key
  const handleDeleteApiKey = async (provider: ProviderConfig) => {
    if (!confirm(`确定要删除 ${provider.name} API Key 吗？`)) return;

    setSavingProvider(provider.id);
    try {
      const res = await fetch(`${PROVIDER_ENDPOINT}?provider=${provider.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': localStorage.getItem('userId') || 'dev-user' },
      });
      if (res.ok) {
        toast.success(`${provider.name} API Key 已删除`);
        // 更新提供商配置
        const statusRes = await fetch(`${PROVIDER_ENDPOINT}?provider=${provider.id}`, { headers: userIdHeader() });
        const statusData = await statusRes.json();
        setProviderConfigs(prev => prev.map(p =>
          p.id === provider.id
            ? { ...p, configured: statusData.configured, maskedKey: statusData.maskedApiKey, baseUrl: statusData.baseUrl || p.defaultBaseUrl }
            : p
        ));
        setProviderInputs(prev => ({ ...prev, [provider.id]: { apiKey: '', baseUrl: provider.defaultBaseUrl } }));
      }
    } catch (error) {
      console.error('删除 API Key 失败:', error);
      toast.error('删除失败');
    } finally {
      setSavingProvider(null);
    }
  };

  const getProviderName = (provider: string): string => {
    switch (provider) {
      case 'coze': return '扣子平台';
      case 'nvidia': return 'NVIDIA';
      case 'zhipu': return '智谱AI';
      case 'qwen': return '千问AI';
      case 'volcengine': return '火山引擎';
      case 'minimax': return 'MiniMax';
      case 'moonshot': return '月之暗面';
      case 'deepseek': return 'DeepSeek';
      case 'wenxin': return '百度文心';
      case 'hunyuan': return '腾讯混元';
      case 'custom': return '自定义';
      default: return provider;
    }
  };
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'coze': return <Zap className="h-5 w-5 text-orange-500" />;
      case 'nvidia': return <Cpu className="h-5 w-5 text-green-500" />;
      case 'zhipu': return <Brain className="h-5 w-5 text-blue-500" />;
      case 'qwen': return <Sparkles className="h-5 w-5 text-purple-500" />;
      case 'volcengine': return <Zap className="h-5 w-5 text-rose-500" />;
      case 'minimax': return <Brain className="h-5 w-5 text-red-500" />;
      case 'moonshot': return <Sparkles className="h-5 w-5 text-slate-500" />;
      case 'deepseek': return <Brain className="h-5 w-5 text-indigo-500" />;
      case 'wenxin': return <Sparkles className="h-5 w-5 text-cyan-500" />;
      case 'hunyuan': return <Brain className="h-5 w-5 text-sky-500" />;
      case 'custom': return <Settings className="h-5 w-5 text-green-500" />;
      default: return <Zap className="h-5 w-5" />;
    }
  };

  // 获取某类型当前生效的厂商与模型显示信息
  const getModelDisplay = (type: ModelType): { providerId: string; modelName: string; providerReady: boolean } => {
    const providerId = config[`${type}_provider`] || 'coze';
    const modelId = type === 'tts'
      ? (config.tts_speaker || '')
      : ((config as unknown as Record<string, unknown>)[`${type}_model`] as string) || '';
    const models = getModelsForType(type, providerId);
    const found = models.find(m => m.id === modelId);
    const providerReady = providerId === 'coze' || providerConfigs.find(p => p.id === providerId)?.configured === true;
    return { providerId, modelName: found?.name || modelId || '默认模型', providerReady };
  };

  // 密钥配置表单（模型设置卡内嵌复用）
  const renderKeyForm = (provider: ProviderConfig) => {
    const input = providerInputs[provider.id] || { apiKey: '', baseUrl: provider.baseUrl || provider.defaultBaseUrl };
    const error = providerErrors[provider.id];
    const success = providerSuccess[provider.id];
    const saving = savingProvider === provider.id;
    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            type={showApiKey ? 'text' : 'password'}
            placeholder="sk-..."
            value={input.apiKey}
            onChange={(e) => setProviderInputs(prev => ({ ...prev, [provider.id]: { ...input, apiKey: e.target.value } }))}
            className="pr-10 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Input
          type="text"
          placeholder={provider.defaultBaseUrl || 'https://your-endpoint/v1'}
          value={input.baseUrl}
          onChange={(e) => setProviderInputs(prev => ({ ...prev, [provider.id]: { ...input, baseUrl: e.target.value } }))}
          className="text-xs font-mono"
        />
        <div className="flex items-center justify-between">
          {provider.configUrl ? (
            <a href={provider.configUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> 获取 {provider.name} API Key
            </a>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={() => handleSaveApiKey(provider)} disabled={saving} className="h-8">
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 mr-1.5" />}
            {saving ? '验证中...' : '保存密钥'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
        {success && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{success}</p>}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header - 淡彩 hero，与全站工具页统一 */}
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <Settings className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">模型设置</h1>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  配置 AI 模型和服务参数
                </p>
              </div>
              <Button
                onClick={saveConfig}
                disabled={loading}
                className="min-w-[120px] shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-md shadow-primary/20"
              >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  保存配置
                </>
              )}
            </Button>
            </div>
          </div>
        </div>

        {/* Current Active Models Summary */}
        <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/10">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.keys(MODEL_TYPE_META) as ModelType[]).map(type => {
                const display = getModelDisplay(type);
                return (
                  <div key={type} className="flex items-center gap-2.5 min-w-0">
                    <span className="flex-shrink-0 scale-90">{getProviderIcon(display.providerId)}</span>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{MODEL_TYPE_META[type].label}</div>
                      <div className="text-sm font-medium truncate" title={display.modelName}>
                        {display.modelName}
                      </div>
                      <div className={`text-[10px] ${display.providerReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {getProviderName(display.providerId)}{display.providerReady ? ' · 已就绪' : ' · 需配置 Key'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Model Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Model Settings - 按模型类型分组 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>模型设置</CardTitle>
                    <CardDescription>按模型类型选择厂商与模型，每类均可添加自定义模型；选择后立即生效，未配置 API Key 的厂商会显示提醒</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeModelTab} onValueChange={(v) => setActiveModelTab(v as ModelType)}>
                  <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg">
                    {(Object.keys(MODEL_TYPE_META) as ModelType[]).map(type => {
                      const TypeIcon = MODEL_TYPE_ICONS[type];
                      return (
                        <TabsTrigger
                          key={type}
                          value={type}
                          className="text-xs md:text-sm gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                          {MODEL_TYPE_META[type].label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {(Object.keys(MODEL_TYPE_META) as ModelType[]).map(type => {
                    const providerId = config[`${type}_provider`] || 'coze';
                    const currentModel = type === 'tts'
                      ? config.tts_speaker
                      : (config as unknown as Record<string, string | undefined>)[`${type}_model`];
                    const providers = getProvidersForType(type);
                    const activeMeta = getProviderMeta(providerId);
                    const activeStatus = getProviderStatus(providerId);
                    const models = getModelsForType(type, providerId);
                    const catalogModels = models.filter(m => m.id && !m.isCustomInput);
                    const customList = customModels[type] || [];
                    const hasCatalogModel = currentModel && (catalogModels.some(m => m.id === currentModel) || customList.includes(currentModel));
                    const needsKeySetup = providerId !== 'coze' && activeStatus && !activeStatus.configured;
                    const modelFieldLabel = type === 'tts' ? '配音音色' : '模型';

                    return (
                      <TabsContent key={type} value={type} className="mt-4 space-y-4">
                        {/* 厂商选择 */}
                        <div>
                          <Label className="text-xs text-muted-foreground">生成厂商</Label>
                          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                            {providers.map(p => {
                              const status = getProviderStatus(p.id);
                              const keyOk = !p.needsKey || (status?.configured ?? false);
                              const selected = providerId === p.id;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => handleSelectModelProvider(type, p.id)}
                                  className={`relative p-2.5 rounded-lg border-2 transition-all text-left ${selected ? 'border-primary bg-primary/5' : keyOk ? 'border-border hover:border-primary/50 hover:bg-muted/50' : 'border-yellow-500/40 bg-yellow-500/5 hover:border-yellow-500/70'}`}
                                >
                                  <div className="flex items-center justify-between gap-1 pr-3">
                                    <span className="text-xs font-medium truncate">{p.name}</span>
                                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p.needsKey ? (keyOk ? 'bg-emerald-500' : 'bg-yellow-500') : 'bg-primary'}`} />
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1 truncate">
                                    {p.needsKey ? (keyOk ? '密钥已配置' : '未配置密钥') : '无需配置'}
                                  </div>
                                  {selected && <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Key 状态提醒 / 配置 */}
                        {providerId === 'coze' ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
                            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                            平台内置模型，开箱即用，无需配置密钥
                          </div>
                        ) : needsKeySetup ? (
                          <div className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                              <AlertCircle className="h-4 w-4 flex-shrink-0" />
                              {activeMeta?.name} 尚未配置 API Key，生成将失败，请先完成下方配置
                            </div>
                            {activeStatus && renderKeyForm(activeStatus)}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                            <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                              {activeMeta?.name} 密钥已配置{activeStatus?.maskedKey ? `（${activeStatus.maskedKey}）` : ''}
                            </span>
                            {activeStatus && (
                              <button
                                onClick={() => setActiveProviderTab(providerId)}
                                className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
                              >
                                更换密钥
                              </button>
                            )}
                          </div>
                        )}

                        {/* 自定义厂商：按分类说明协议与能力边界（与后端分发一致） */}
                        {providerId === 'custom' && (
                          <div
                            className={`flex items-start gap-2 p-3 rounded-lg border text-xs leading-relaxed ${
                              CUSTOM_PROVIDER_NOTES[type].warn
                                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                                : 'bg-muted/50 text-muted-foreground'
                            }`}
                          >
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{CUSTOM_PROVIDER_NOTES[type].text}</span>
                          </div>
                        )}

                        {/* 模型选择 */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-muted-foreground">选择{modelFieldLabel}</Label>
                            {currentModel && !hasCatalogModel && (
                              <span className="text-[10px] text-muted-foreground">
                                当前生效：{currentModel}（未在清单中，选择下方模型可覆盖）
                              </span>
                            )}
                          </div>
                          <Select
                            value={currentModel}
                            onValueChange={(value) => {
                              if (value === 'custom-model') {
                                setCustomModelType(type);
                                setCustomModelDraft('');
                                return;
                              }
                              setCustomModelType(null);
                              handleSelectModel(type, { id: value, name: value, description: '' });
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={`选择${modelFieldLabel}`} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {catalogModels.map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium truncate max-w-[200px]">{m.name}</span>
                                    {m.recommended && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">推荐</Badge>}
                                  </div>
                                  <div className="text-xs text-muted-foreground line-clamp-1">{m.description}</div>
                                </SelectItem>
                              ))}
                              {customList.map(id => (
                                <SelectItem key={`custom-${id}`} value={id}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium truncate max-w-[200px] font-mono">{id}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">自定义</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground line-clamp-1">手动添加的{modelFieldLabel}</div>
                                </SelectItem>
                              ))}
                              <SelectItem
                                key="custom-model-option"
                                value="custom-model"
                                className="text-muted-foreground"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate max-w-[200px]">添加自定义{modelFieldLabel}…</span>
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1">手动输入模型名称，适用于未列出的模型</div>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* 已添加的自定义模型清单：点击启用，可删除 */}
                          {customList.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">已添加：</span>
                              {customList.map(id => {
                                const active = currentModel === id;
                                return (
                                  <span
                                    key={id}
                                    className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-xs transition-colors ${active ? 'border-primary/50 bg-primary/10 text-primary' : 'bg-muted/40 hover:border-primary/40'}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleSelectModel(type, { id, name: id })}
                                      className="font-mono max-w-[180px] truncate"
                                      title={`启用 ${id}`}
                                    >
                                      {id}
                                    </button>
                                    {active && <CheckCircle2 className="h-3 w-3 flex-shrink-0" />}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomModel(type, id)}
                                      className="p-0.5 rounded-full text-muted-foreground hover:text-destructive flex-shrink-0"
                                      aria-label={`删除自定义模型 ${id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* 添加自定义模型：每个类型均可手动添加 */}
                          {customModelType === type ? (
                            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  autoFocus
                                  type="text"
                                  value={customModelDraft}
                                  onChange={(e) => setCustomModelDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleAddCustomModel(type); }
                                    if (e.key === 'Escape') { setCustomModelType(null); setCustomModelDraft(''); }
                                  }}
                                  placeholder={type === 'tts' ? '输入音色 ID，如 my_voice' : '输入模型名，如 gpt-4o / my-model'}
                                  className="h-9 text-sm font-mono"
                                />
                                <Button
                                  size="sm"
                                  className="h-9 shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90"
                                  onClick={() => handleAddCustomModel(type)}
                                  disabled={savingModelType === type}
                                >
                                  {savingModelType === type ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                                  添加并启用
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 shrink-0"
                                  onClick={() => { setCustomModelType(null); setCustomModelDraft(''); }}
                                  aria-label="取消添加"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">模型名需与当前厂商端点实际支持的模型一致；添加成功后立即启用，并保存在本机清单中</p>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 h-8 border-dashed text-xs"
                              onClick={() => { setCustomModelType(type); setCustomModelDraft(''); }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> 添加自定义{modelFieldLabel}
                            </Button>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>

            {/* Generation Parameters */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>生成参数</CardTitle>
                    <CardDescription>图片尺寸与视频清晰度等输出参数</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image Size */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm">
                      <Image className="h-3.5 w-3.5" />
                    </span>
                    <Label className="text-sm font-medium">图片生成尺寸</Label>
                    <span className="text-xs text-muted-foreground">- 海报/场景/角色</span>
                  </div>
                  <Select
                    value={config.image_size}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, image_size: value }))}
                  >
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
                    {config.image_size === '2K' ? '标准高清，平衡质量与速度' :
                     config.image_size === '4K' ? '超高清画质，适合精细场景' : '自定义尺寸'}
                  </p>
                </div>

                {/* Video Resolution */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-sm">
                      <Video className="h-3.5 w-3.5" />
                    </span>
                    <Label className="text-sm font-medium">视频清晰度</Label>
                    <span className="text-xs text-muted-foreground">- 分辨率</span>
                  </div>
                  <Select
                    value={config.video_resolution}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, video_resolution: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择视频清晰度" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720P - 高清</SelectItem>
                      <SelectItem value="1080p">1080P - 超高清</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    建议使用 720P 平衡画质与生成速度，1080P 生成时间更长
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Right Column - API Key & Status */}
          <div className="space-y-6">
            {/* Current Config Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  当前配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(Object.keys(MODEL_TYPE_META) as ModelType[]).map(type => {
                  const display = getModelDisplay(type);
                  return (
                    <div key={type} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 scale-75">{getProviderIcon(display.providerId)}</span>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{MODEL_TYPE_META[type].label}</div>
                          <div className="text-sm font-medium truncate">{display.modelName}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-muted-foreground">{getProviderName(display.providerId)}</div>
                        {display.providerReady ? (
                          <Badge variant="secondary" className="text-[10px]">已生效</Badge>
                        ) : (
                          <span className="text-[10px] text-yellow-600 dark:text-yellow-400">需配置 Key</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="pt-1 border-t">
                  <div className="flex items-center justify-between p-2">
                    <span className="text-xs text-muted-foreground">视频分辨率</span>
                    <span className="text-xs font-medium">{config.video_resolution}</span>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="text-xs text-muted-foreground">图片尺寸</span>
                    <span className="text-xs font-medium">{config.image_size}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Keys Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                    <KeyRound className="h-3.5 w-3.5" />
                  </span>
                  API 密钥状态
                </CardTitle>
                <CardDescription>各厂商密钥总览；配置入口在左侧模型设置的对应厂商面板</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {SUPPORTED_PROVIDERS.map(sp => {
                  const status = providerConfigs.find(p => p.id === sp.id);
                  const configured = status?.configured ?? false;
                  return (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${configured ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                        <span className="text-sm truncate">{sp.name}</span>
                        {status?.maskedKey && (
                          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">{status.maskedKey}</code>
                        )}
                      </div>
                      {configured ? (
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">已配置</Badge>
                      ) : (
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-400 flex-shrink-0">未配置</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Auth Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                    <Shield className="h-3.5 w-3.5" />
                  </span>
                  认证方式
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm">扣子内置模型</span>
                  <Badge className="bg-emerald-500/90 text-white">自动认证</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm">第三方厂商</span>
                  <Badge variant="secondary">API Key 认证</Badge>
                </div>
                {(() => {
                  const configuredCount = providerConfigs.filter(p => p.configured && p.id !== 'coze').length;
                  const pendingList = providerConfigs.filter(p => !p.configured && p.id !== 'coze');
                  return (
                    <>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <span className="text-sm">已配置厂商</span>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{configuredCount} 家</span>
                      </div>
                      {pendingList.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          尚未配置：{pendingList.map(p => p.name).join('、')}。选择这些厂商前，请在左侧「模型设置」对应面板配置 API Key。
                        </p>
                      )}
                      {pendingList.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          全部厂商密钥已配置，可自由切换使用。
                        </p>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Help Info */}
        <div className="text-xs text-muted-foreground flex items-start gap-3 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border border-primary/20 p-4 rounded-xl">
          <span className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="space-y-1">
            <p>「扣子内置」无需配置，开箱即用；选择其他厂商后，请在对应面板配置 API Key，未配置时会有提醒。</p>
            <p>模型选择保存后立即生效，各生成功能将按所选厂商与模型调用；此处不再需要切换「方案」。</p>
            <p>每个模型类型都支持「添加自定义模型」：输入端点实际支持的模型名即可启用，清单保存在本机浏览器，可随时切换或删除。</p>
            <p>「自定义」厂商在四个分类下均可配置：填写 API Key 与 OpenAI 兼容端点地址后，按分类添加自定义模型（视频自定义端点的生成暂未接入，面板内有提示）。</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
