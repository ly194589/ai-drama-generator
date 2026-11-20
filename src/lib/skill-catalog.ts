/**
 * 短剧 Skill 目录
 *
 * 把经过验证的短剧生产流程封装为可复用的 Skill：
 * 每个 Skill 提供 prompt 模板、分镜规则和创作参数，套用后直接写入新建剧本表单。
 */

export type SkillCategory = '题材模板' | '节奏结构' | '人物设定' | '出海与商业化';

export type SkillAccess = 'free' | 'pro';

export interface SkillParamOption {
  value: string;
  label: string;
}

export interface SkillParam {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: SkillParamOption[];
  placeholder?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
}

/** 套用到创作时写入新建剧本表单的数据 */
export interface SkillApplyResult {
  title: string;
  description: string;
  genre: string;
  style: string;
  imageStyle: string;
  totalEpisodes: number;
  coreConflict: string;
  /** 是否强制覆盖题材：仅强绑定题材的 Skill 置 true，其余沿用用户当前选择 */
  genreFixed?: boolean;
  /** 推荐的核心冲突类型 id（对应创作页 CORE_CONFLICT_TYPES） */
  conflictType?: string;
}

export type SkillInput = Record<string, string | number>;

export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  summary: string;
  description: string;
  tags: string[];
  /** 封面渐变（仅使用主题语义色） */
  cover: string;
  /** 卡片图标（lucide 名称，由页面映射） */
  icon: string;
  access: SkillAccess;
  params: SkillParam[];
  /** 套用到创作时的字段映射（Prompt 与分镜规则见服务端 skill-content.ts） */
  apply: (input: SkillInput) => SkillApplyResult;
}

const str = (input: SkillInput, key: string, fallback = ''): string => {
  const value = input[key];
  return value === undefined || value === null || value === '' ? fallback : String(value);
};

const num = (input: SkillInput, key: string, fallback: number, min: number, max: number): number => {
  const parsed = Number(input[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

/** 生成套用后的剧本简介（统一带上 Skill 标记，便于回溯） */
function buildBrief(lines: string[]): string {
  return lines.filter(Boolean).join('\n');
}

export const SKILLS: SkillDefinition[] = [
  {
    id: 'ba-zong-tian-chong-30',
    name: '霸总甜宠 · 30集闭环',
    category: '题材模板',
    summary: '30集标准竖屏甜宠结构，身份反差开场 + 每集钩子 + 双反转收尾。',
    description:
      '面向抖音/快手竖屏短剧的成熟甜宠模板。男主强势但不油腻，女主有独立职业线，30 集完成从误会到双向奔赴的闭环，适合批量复制的中腰部项目。',
    tags: ['甜宠', '霸总', '30集', '竖屏'],
    cover: 'from-primary/90 via-primary/60 to-accent',
    icon: 'Crown',
    access: 'free',
    params: [
      {
        key: 'hero',
        label: '男主身份',
        type: 'select',
        defaultValue: '集团总裁',
        options: [
          { value: '集团总裁', label: '集团总裁' },
          { value: '隐藏首富', label: '隐藏首富' },
          { value: '冷面医生', label: '冷面医生' },
          { value: '退役总裁', label: '退役总裁' },
        ],
      },
      { key: 'heroine', label: '女主身份', type: 'text', defaultValue: '实习设计师', placeholder: '如：实习设计师' },
      { key: 'conflict', label: '核心冲突', type: 'text', defaultValue: '一纸契约婚姻', placeholder: '如：一纸契约婚姻' },
      { key: 'twistCount', label: '大反转次数', type: 'number', defaultValue: 3, min: 1, max: 6 },
      { key: 'title', label: '剧名（留空自动生成）', type: 'text', placeholder: '如：契约到期那天' },
    ],
    apply: input => {
      const hero = str(input, 'hero', '集团总裁');
      const heroine = str(input, 'heroine', '实习设计师');
      const conflict = str(input, 'conflict', '一纸契约婚姻');
      return {
        title: str(input, 'title') || `${conflict}·甜宠30集`,
        description: buildBrief([
          '【Skill：霸总甜宠 · 30集闭环】',
          `男主：${hero}；女主：${heroine}`,
          `核心冲突：${conflict}`,
          '节奏：单集60-90秒，共30集；第1集30秒内出现身份反差钩子，每集结尾留悬念，每3集小反转。',
          '要求：女主有独立职业线，误会不超过2集，第29集情感闭环，第30集留开放彩蛋。',
        ]),
        genre: 'ba-zong-tian-chong',
        style: 'tian-chong',
        imageStyle: 'realistic',
        totalEpisodes: 30,
        coreConflict: conflict,
        genreFixed: true,
        conflictType: 'emotion',
      };
    },
  },
  {
    id: 'shuang-ju-hook',
    name: '爽剧开场 · 7秒钩子',
    category: '节奏结构',
    summary: '把最痛的一刻提到第一秒：打压、反转、打脸，三段式开场模板。',
    description:
      '专治开场平淡、完播率低。用「被打压 → 亮底牌 → 当众打脸」的三段式结构重写第一集，确保 7 秒内建立情绪债，30 秒内完成第一次反转。',
    tags: ['爽剧', '开场钩子', '完播率', '逆袭'],
    cover: 'from-accent via-primary/50 to-primary/80',
    icon: 'Zap',
    access: 'free',
    params: [
      {
        key: 'genre',
        label: '题材',
        type: 'select',
        defaultValue: '都市逆袭',
        options: [
          { value: '都市逆袭', label: '都市逆袭' },
          { value: '豪门真假', label: '豪门真假' },
          { value: '职场打脸', label: '职场打脸' },
          { value: '战神归来', label: '战神归来' },
        ],
      },
      { key: 'hero', label: '主角身份', type: 'text', defaultValue: '被辞退的项目经理', placeholder: '如：被辞退的项目经理' },
      { key: 'oppression', label: '被打压方式', type: 'text', defaultValue: '被当众抢走成果并开除', placeholder: '如：被当众抢走成果并开除' },
      { key: 'counter', label: '反击底牌', type: 'text', defaultValue: '真实身份是收购方代表', placeholder: '如：真实身份是收购方代表' },
    ],
    apply: input => {
      const genreLabel = str(input, 'genre', '都市逆袭');
      const hero = str(input, 'hero', '被辞退的项目经理');
      const oppression = str(input, 'oppression', '被当众抢走成果并开除');
      const counter = str(input, 'counter', '真实身份是收购方代表');
      return {
        title: `${genreLabel}·开局反击`,
        description: buildBrief([
          '【Skill：爽剧开场 · 7秒钩子】',
          `题材：${genreLabel}；主角：${hero}`,
          `开场：${oppression}`,
          `反转底牌：${counter}`,
          '节奏：0-7秒抛最痛一刻，26-60秒完成当众打脸，结尾5秒升级悬念。',
        ]),
        genre: 'chong-sheng-ni-xi',
        style: 'shuang-ju',
        imageStyle: 'realistic',
        totalEpisodes: 30,
        coreConflict: oppression,
        genreFixed: false,
        conflictType: 'revenge',
      };
    },
  },
  {
    id: 'chong-sheng-fu-chou-60',
    name: '重生复仇 · 60集长线',
    category: '题材模板',
    summary: '前世虐点 → 重生反杀 → 层层揭底的60集长线复仇结构。',
    description:
      '适合做长线留存的复仇爽剧。用「前世记忆碎片」作为信息差工具，每 10 集解锁一段真相，60 集内完成从个人复仇到家族翻案的升级。',
    tags: ['重生', '复仇', '60集', '长线'],
    cover: 'from-primary/80 via-accent to-primary/40',
    icon: 'Flame',
    access: 'pro',
    params: [
      { key: 'pastIdentity', label: '前世身份', type: 'text', defaultValue: '被夺走家产的嫡女', placeholder: '如：被夺走家产的嫡女' },
      { key: 'enemy', label: '仇人身份', type: 'text', defaultValue: '伪善的继母与养妹', placeholder: '如：伪善的继母与养妹' },
      { key: 'token', label: '复仇关键道具', type: 'text', defaultValue: '母亲留下的账本', placeholder: '如：母亲留下的账本' },
      { key: 'episodes', label: '总集数', type: 'number', defaultValue: 60, min: 30, max: 100 },
    ],
    apply: input => {
      const past = str(input, 'pastIdentity', '被夺走家产的嫡女');
      const enemy = str(input, 'enemy', '伪善的继母与养妹');
      const token = str(input, 'token', '母亲留下的账本');
      const episodes = num(input, 'episodes', 60, 30, 100);
      return {
        title: `重生之${past.slice(0, 8)}复仇记`,
        description: buildBrief([
          '【Skill：重生复仇 · 60集长线】',
          `前世：${past}；仇人：${enemy}`,
          `关键道具：${token}`,
          `结构：共${episodes}集，每10集一个阶段，每阶段解锁一段真相并在低谷后反杀。`,
          '要求：复仇手段合法合理，关键道具贯穿全剧，大结局完成复仇与情感归宿。',
        ]),
        genre: 'chong-sheng-ni-xi',
        style: 'shuang-ju',
        imageStyle: 'realistic',
        totalEpisodes: episodes,
        coreConflict: `重生后向${enemy}复仇`,
        genreFixed: true,
        conflictType: 'rebirth',
      };
    },
  },
  {
    id: 'xuan-yi-fan-zhuan',
    name: '悬疑强反转 · 单元+主线',
    category: '节奏结构',
    summary: '每3集一个单元案，单元案服务于主线真凶，结尾一次性翻盘。',
    description:
      '适合悬疑赛道的中短剧结构。用单元案维持每集信息量，用主线真凶维持长线追看，所有线索在最后 3 集回收，禁止无铺垫的强行反转。',
    tags: ['悬疑', '反转', '单元剧', '烧脑'],
    cover: 'from-primary via-primary/30 to-accent',
    icon: 'Search',
    access: 'pro',
    params: [
      { key: 'trick', label: '核心诡计', type: 'text', defaultValue: '所有人都记错了同一天', placeholder: '如：所有人都记错了同一天' },
      { key: 'hero', label: '主角身份', type: 'text', defaultValue: '被停职的刑警', placeholder: '如：被停职的刑警' },
      { key: 'motive', label: '反派动机', type: 'text', defaultValue: '为掩盖十年前的冤案', placeholder: '如：为掩盖十年前的冤案' },
      { key: 'twistCount', label: '大反转次数', type: 'number', defaultValue: 4, min: 2, max: 8 },
      { key: 'episodes', label: '总集数', type: 'number', defaultValue: 30, min: 12, max: 60 },
    ],
    apply: input => {
      const trick = str(input, 'trick', '所有人都记错了同一天');
      const hero = str(input, 'hero', '被停职的刑警');
      const motive = str(input, 'motive', '为掩盖十年前的冤案');
      const episodes = num(input, 'episodes', 30, 12, 60);
      return {
        title: `${trick.slice(0, 10)}·悬疑`,
        description: buildBrief([
          '【Skill：悬疑强反转 · 单元+主线】',
          `核心诡计：${trick}`,
          `主角：${hero}；反派动机：${motive}`,
          `结构：共${episodes}集，每3集一个单元案，单元案与主线真凶间接关联。`,
          '要求：每集1条新线索+1条误导线索，反转必须有前置铺垫，最后3集回收全部线索。',
        ]),
        genre: 'xuan-yi-tan-an',
        style: 'xuan-yi',
        imageStyle: 'realistic',
        totalEpisodes: episodes,
        coreConflict: trick,
        genreFixed: true,
        conflictType: 'identity',
      };
    },
  },
  {
    id: 'chu-hai-ben-di-hua',
    name: '出海短剧 · 本地化改编',
    category: '出海与商业化',
    summary: '保留爽点骨架，替换文化语境、姓名与价值观冲突，适配海外市场。',
    description:
      '一套素材发行全球的第一步。把国内爽剧的情绪结构保留下来，重写人物姓名、社会身份、家庭关系与冲突动机，避免文化折扣和合规风险。',
    tags: ['出海', '本地化', '多语言', '合规'],
    cover: 'from-accent/90 via-accent/50 to-primary/60',
    icon: 'Globe',
    access: 'pro',
    params: [
      {
        key: 'market',
        label: '目标市场',
        type: 'select',
        defaultValue: '北美',
        options: [
          { value: '北美', label: '北美' },
          { value: '东南亚', label: '东南亚' },
          { value: '中东', label: '中东' },
          { value: '欧洲', label: '欧洲' },
        ],
      },
      {
        key: 'sourceGenre',
        label: '原题材',
        type: 'select',
        defaultValue: '霸总甜宠',
        options: [
          { value: '霸总甜宠', label: '霸总甜宠' },
          { value: '重生复仇', label: '重生复仇' },
          { value: '豪门真假', label: '豪门真假' },
          { value: '职场逆袭', label: '职场逆袭' },
        ],
      },
      { key: 'focus', label: '本地化重点', type: 'text', defaultValue: '家庭关系与阶层表达', placeholder: '如：家庭关系与阶层表达' },
      { key: 'episodes', label: '总集数', type: 'number', defaultValue: 40, min: 20, max: 80 },
    ],
    apply: input => {
      const market = str(input, 'market', '北美');
      const sourceGenre = str(input, 'sourceGenre', '霸总甜宠');
      const focus = str(input, 'focus', '家庭关系与阶层表达');
      const episodes = num(input, 'episodes', 40, 20, 80);
      return {
        title: `${sourceGenre}·${market}版`,
        description: buildBrief([
          `【Skill：出海短剧 · 本地化改编】`,
          `目标市场：${market}；原题材：${sourceGenre}`,
          `本地化重点：${focus}`,
          `结构：共${episodes}集，保留打压-反转-爽点骨架，替换文化符号与人物设定。`,
          '要求：删除当地敏感内容，台词按当地口语重写，单集60-90秒。',
        ]),
        genre: 'ba-zong-tian-chong',
        style: 'tian-chong',
        imageStyle: 'realistic',
        totalEpisodes: episodes,
        coreConflict: `${sourceGenre}情绪的${market}本地化表达`,
        genreFixed: false,
      };
    },
  },
  {
    id: 'ren-wu-xiao-zhuan',
    name: '爆款人物小传',
    category: '人物设定',
    summary: '用欲望、秘密、弧光三件套，一次生成可直接喂给分镜的完整人物档案。',
    description:
      '人物立绘总是"长得像但不像同一个人"，问题往往出在人物档案太薄。这个 Skill 用欲望、恐惧、秘密、弧光四个维度生成可复用的人物小传，直接作为立绘与分镜的一致性锚点。',
    tags: ['人物设定', '小传', '一致性', '立绘'],
    cover: 'from-primary/70 via-accent/70 to-accent',
    icon: 'Users',
    access: 'pro',
    params: [
      { key: 'name', label: '角色名', type: 'text', defaultValue: '沈知意', placeholder: '如：沈知意' },
      { key: 'identity', label: '身份', type: 'text', defaultValue: '28岁建筑设计师', placeholder: '如：28岁建筑设计师' },
      { key: 'desire', label: '核心欲望', type: 'text', defaultValue: '证明自己不靠家族也能成功', placeholder: '如：证明自己不靠家族也能成功' },
      { key: 'secret', label: '隐藏秘密', type: 'text', defaultValue: '当年事故的真正责任人是自己', placeholder: '如：当年事故的真正责任人是自己' },
      {
        key: 'arc',
        label: '人物弧光',
        type: 'select',
        defaultValue: '从逃避到担当',
        options: [
          { value: '从逃避到担当', label: '从逃避到担当' },
          { value: '从善良到黑化', label: '从善良到黑化' },
          { value: '从自卑到自洽', label: '从自卑到自洽' },
          { value: '从复仇到放下', label: '从复仇到放下' },
        ],
      },
    ],
    apply: input => {
      const name = str(input, 'name', '沈知意');
      const identity = str(input, 'identity', '28岁建筑设计师');
      const desire = str(input, 'desire', '证明自己不靠家族也能成功');
      const secret = str(input, 'secret', '当年事故的真正责任人是自己');
      const arc = str(input, 'arc', '从逃避到担当');
      return {
        title: `${name}的人物档案`,
        description: buildBrief([
          '【Skill：爆款人物小传】',
          `角色：${name}，${identity}`,
          `核心欲望：${desire}`,
          `隐藏秘密：${secret}`,
          `人物弧光：${arc}`,
          '要求：外在特征具体到可复现，秘密必须有可视化证据，弧光转变必须有代价。',
        ]),
        genre: 'zhi-chang-sheng-cun',
        style: 'wen-xin',
        imageStyle: 'realistic',
        totalEpisodes: 30,
        coreConflict: desire,
        genreFixed: false,
        conflictType: 'growth',
      };
    },
  },
];

/** 按分类获取 Skill */
export const SKILL_CATEGORIES: SkillCategory[] = ['题材模板', '节奏结构', '人物设定', '出海与商业化'];

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILLS.find(skill => skill.id === id);
}

/** Pro 权限所需套餐（年卡 / 终身卡 / 管理员） */
export const PRO_PLAN_TYPES = ['yearly', 'lifetime', 'admin'];

export function canUseProSkill(planType?: string | null): boolean {
  return !!planType && PRO_PLAN_TYPES.includes(planType);
}
