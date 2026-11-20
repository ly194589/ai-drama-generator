'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  SKILLS,
  SKILL_CATEGORIES,
  canUseProSkill,
  type SkillCategory,
  type SkillDefinition,
  type SkillInput,
} from '@/lib/skill-catalog';
import {
  Crown,
  Zap,
  Flame,
  Search,
  Globe,
  Users,
  Sparkles,
  Lock,
  Unlock,
  Copy,
  Download,
  Wand2,
  CheckCircle2,
  BadgeCheck,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const SKILL_ICONS: Record<string, typeof Crown> = {
  Crown,
  Zap,
  Flame,
  Search,
  Globe,
  Users,
};

interface LicenseRecord {
  skillId: string;
  licenseKey: string;
  claimedAt: string;
  planType: string;
}

const getUserFromStorage = (): { id: string; isAdmin?: boolean } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as { id: string; isAdmin?: boolean }) : null;
  } catch {
    return null;
  }
};

export default function SkillsPage() {
  const router = useRouter();
  const { isAdmin, subscription } = useSubscription(false);

  const [category, setCategory] = useState<'全部' | SkillCategory>('全部');
  const [activeSkill, setActiveSkill] = useState<SkillDefinition | null>(null);
  const [inputs, setInputs] = useState<SkillInput>({});
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [claiming, setClaiming] = useState(false);
  /** 服务端下发的 Prompt 与分镜规则（授权后才可获取） */
  const [content, setContent] = useState<{ skillId: string; prompt: string; storyboardRules: string[] } | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const [userId, setUserId] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(getUserFromStorage()?.id || '');
  }, []);

  const planType = subscription?.planType || (isAdmin ? 'admin' : '');
  const proAccess = isAdmin || canUseProSkill(planType);

  const loadLicenses = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/skills/licenses', { headers: { 'x-user-id': userId } });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.licenses)) {
        if (res.status === 401) {
          setLicenses([]);
          toast.error('登录状态已失效，请重新登录');
        }
        return;
      }
      setLicenses(data.licenses as LicenseRecord[]);
    } catch (error) {
      console.error('[Skill 市场] 加载授权失败:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadLicenses();
  }, [loadLicenses]);

  /** 从服务端获取已授权 Skill 的正文内容 */
  const requestContent = useCallback(
    async (skill: SkillDefinition, params: SkillInput) => {
      if (!userId) return null;
      try {
        const res = await fetch(`/api/skills/${skill.id}/content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({ params }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          data?: { prompt?: string; storyboardRules?: string[] };
        };
        return {
          skillId: skill.id,
          prompt: String(data.data?.prompt ?? ''),
          storyboardRules: Array.isArray(data.data?.storyboardRules) ? data.data!.storyboardRules! : [],
        };
      } catch (error) {
        console.error('[Skill 市场] 加载 Prompt 失败:', error);
        return null;
      }
    },
    [userId]
  );

  const activeLicense = activeSkill
    ? licenses.find(item => item.skillId === activeSkill.id)
    : undefined;

  // 已授权的 Skill 在参数变化时重新向服务端取内容（防抖）
  useEffect(() => {
    if (!activeSkill || !activeLicense) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setContentLoading(true);
      void requestContent(activeSkill, inputs).then(next => {
        if (cancelled) return;
        setContent(next);
        setContentLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSkill, activeLicense, inputs, requestContent]);

  const list = useMemo(
    () => (category === '全部' ? SKILLS : SKILLS.filter(skill => skill.category === category)),
    [category]
  );

  const licenseOf = (skillId: string) => licenses.find(item => item.skillId === skillId);

  const openSkill = (skill: SkillDefinition) => {
    const defaults: SkillInput = {};
    for (const param of skill.params) {
      defaults[param.key] = param.defaultValue ?? (param.type === 'number' ? 30 : '');
    }
    setInputs(defaults);
    setActiveSkill(skill);
  };

  const setInputValue = (key: string, value: string | number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const claim = async (skill: SkillDefinition): Promise<LicenseRecord | null> => {
    const user = getUserFromStorage();
    if (!user) {
      toast.error('请先登录后再领取 Skill');
      router.push('/login');
      return null;
    }
    if (skill.access === 'pro' && !proAccess) {
      toast.message('该 Skill 需要年卡 / 终身卡权限');
      router.push('/solution');
      return null;
    }

    setClaiming(true);
    try {
      const res = await fetch('/api/skills/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ skillId: skill.id }),
      });
      const data = (await res.json()) as { error?: string; license?: LicenseRecord };
      if (!res.ok || !data.license) {
        toast.error(data.error || '领取失败，请稍后重试');
        return null;
      }
      setLicenses(prev => [...prev.filter(item => item.skillId !== skill.id), data.license as LicenseRecord]);
      toast.success(`已获得「${skill.name}」授权`);
      return data.license;
    } catch (error) {
      console.error('[Skill 市场] 领取失败:', error);
      toast.error('领取失败，请稍后重试');
      return null;
    } finally {
      setClaiming(false);
    }
  };

  /** 导出内容统一追加授权水印，便于追溯；正文由服务端下发 */
  const buildExportText = async (skill: SkillDefinition): Promise<string | null> => {
    const license = licenseOf(skill.id);
    if (!license) {
      toast.error('请先获取该 Skill 授权');
      return null;
    }
    const data = content?.skillId === skill.id ? content : await requestContent(skill, inputs);
    if (!data) {
      toast.error('内容加载失败，请稍后重试');
      return null;
    }
    const stamp = license.claimedAt.slice(0, 10);
    return `# ${skill.name}\n\n## 参数\n${skill.params
      .map(param => `- ${param.label}：${inputs[param.key] ?? '—'}`)
      .join('\n')}\n\n## Prompt\n${data.prompt}\n\n## 分镜规则\n${data.storyboardRules
      .map(rule => `- ${rule}`)
      .join('\n')}\n\n---\nSkill 市场授权编号：${license.licenseKey}｜授权用户：${userId}｜日期：${stamp}\n本内容仅限授权账号使用，请勿外传。`;
  };

  const handleCopy = async (skill: SkillDefinition) => {
    const text = await buildExportText(skill);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制 Prompt 与分镜规则');
    } catch {
      toast.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const handleExport = async (skill: SkillDefinition) => {
    const text = await buildExportText(skill);
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${skill.name}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleApply = (skill: SkillDefinition) => {
    if (!licenseOf(skill.id)) {
      toast.error('请先获取该 Skill 授权');
      return;
    }
    const result = skill.apply(inputs);
    localStorage.setItem(
      'pending-drama-skill',
      JSON.stringify({ ...result, skillId: skill.id, skillName: skill.name })
    );
    toast.success(`已套用「${skill.name}」，正在打开新建剧本`);
    router.push('/drama');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 头部 */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-4">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              SKILL 市场
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">短剧 Skill 市场</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              把经过验证的短剧生产流程打包成可复用的 Skill：用参数生成 Prompt、分镜规则与剧本设定，一键套用到创作。
              免费 Skill 可直接领取，Pro Skill 随年卡 / 终身卡解锁，导出内容自动带授权水印。
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-primary" />
                {SKILLS.length} 个 Skill
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Unlock className="h-4 w-4 text-primary" />
                {SKILLS.filter(item => item.access === 'free').length} 个免费
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Crown className="h-4 w-4 text-primary" />
                {licenses.length} 个已授权
              </span>
            </div>
          </div>
        </section>

        {/* 分类筛选 */}
        <div className="flex flex-wrap gap-2">
          {(['全部', ...SKILL_CATEGORIES] as const).map(item => (
            <Button
              key={item}
              size="sm"
              variant={category === item ? 'default' : 'outline'}
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>

        {/* Skill 列表 */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(skill => {
            const Icon = SKILL_ICONS[skill.icon] || Sparkles;
            const license = licenseOf(skill.id);
            const lockedPro = skill.access === 'pro' && !proAccess;
            return (
              <Card key={skill.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
                <div className={cn('relative flex h-28 items-center justify-between bg-gradient-to-br px-4', skill.cover)}>
                  <Icon className="h-8 w-8 text-primary-foreground" />
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-background/80 text-foreground">
                      {skill.access === 'free' ? '免费' : 'Pro'}
                    </Badge>
                    {license && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                  </div>
                </div>
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold leading-tight">{skill.name}</h3>
                      <span className="shrink-0 text-xs text-muted-foreground">{skill.category}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{skill.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {lockedPro ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      {lockedPro ? '年卡 / 终身卡解锁' : license ? `已授权 ${license.licenseKey}` : '可直接领取'}
                    </span>
                    <Button size="sm" variant={license ? 'outline' : 'default'} onClick={() => openSkill(skill)}>
                      查看
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 我的授权 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">我的授权</h2>
          </div>
          {licenses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              还没有领取任何 Skill。免费 Skill 可直接领取，授权编号会作为水印写入导出的 Prompt。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {licenses.map(license => {
                const skill = SKILLS.find(item => item.id === license.skillId);
                if (!skill) return null;
                return (
                  <div key={license.skillId} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{skill.name}</p>
                      <Badge variant="outline" className="shrink-0">
                        {license.planType === 'admin' ? '管理员' : license.planType}
                      </Badge>
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">{license.licenseKey}</p>
                    <p className="mt-1 text-xs text-muted-foreground">领取于 {license.claimedAt.slice(0, 10)}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 px-0 text-primary"
                      onClick={() => openSkill(skill)}
                    >
                      打开 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Skill 详情 */}
      <Dialog open={!!activeSkill} onOpenChange={open => !open && setActiveSkill(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          {activeSkill && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {activeSkill.name}
                  <Badge variant="secondary">{activeSkill.access === 'free' ? '免费' : 'Pro'}</Badge>
                </DialogTitle>
                <DialogDescription>{activeSkill.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* 参数 */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">创作参数</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeSkill.params.map(param => (
                      <div key={param.key} className="space-y-1.5">
                        <Label htmlFor={`${activeSkill.id}-${param.key}`}>{param.label}</Label>
                        {param.type === 'select' ? (
                          <Select
                            value={String(inputs[param.key] ?? '')}
                            onValueChange={value => setInputValue(param.key, value)}
                          >
                            <SelectTrigger id={`${activeSkill.id}-${param.key}`}>
                              <SelectValue placeholder="请选择" />
                            </SelectTrigger>
                            <SelectContent>
                              {(param.options || []).map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={`${activeSkill.id}-${param.key}`}
                            type={param.type === 'number' ? 'number' : 'text'}
                            min={param.min}
                            max={param.max}
                            placeholder={param.placeholder}
                            value={String(inputs[param.key] ?? '')}
                            onChange={event =>
                              setInputValue(
                                param.key,
                                param.type === 'number'
                                  ? event.target.value === ''
                                    ? ''
                                    : Number(event.target.value)
                                  : event.target.value
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prompt 预览 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Prompt 预览</p>
                    {licenseOf(activeSkill.id) && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {licenseOf(activeSkill.id)?.licenseKey}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <pre
                      className={cn(
                        'max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed',
                        !licenseOf(activeSkill.id) && 'select-none'
                      )}
                    >
                      {licenseOf(activeSkill.id)
                        ? content?.skillId === activeSkill.id
                          ? content.prompt
                          : contentLoading
                            ? '正在从服务端加载 Prompt…'
                            : '内容加载失败，请关闭弹窗重试'
                        : '完整 Prompt 由服务端保管，领取授权后才会下发到本地。'}
                    </pre>
                    {!licenseOf(activeSkill.id) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {activeSkill.access === 'pro' && !proAccess ? '升级年卡 / 终身卡后解锁' : '领取授权后可查看完整 Prompt'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 分镜规则 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">分镜规则</p>
                  <ul className="space-y-1.5 rounded-lg border border-border bg-card p-3">
                    {licenseOf(activeSkill.id) ? (
                      (content?.skillId === activeSkill.id ? content.storyboardRules : []).length > 0 ? (
                        (content?.skillId === activeSkill.id ? content.storyboardRules : []).map(rule => (
                          <li key={rule} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                            {rule}
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-muted-foreground">
                          {contentLoading ? '正在从服务端加载分镜规则…' : '分镜规则加载失败，请重试'}
                        </li>
                      )
                    ) : (
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        领取授权后显示分镜规则
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(activeSkill)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport(activeSkill)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> 导出 .md
                  </Button>
                </div>
                {licenseOf(activeSkill.id) ? (
                  <Button size="sm" onClick={() => handleApply(activeSkill)}>
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" /> 套用到创作
                  </Button>
                ) : (
                  <Button size="sm" disabled={claiming} onClick={() => claim(activeSkill)}>
                    {claiming ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlock className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {!userId
                      ? '登录后领取'
                      : activeSkill.access === 'pro' && !proAccess
                        ? '升级解锁'
                        : '免费领取授权'}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
