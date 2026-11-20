/**
 * 网站全局配置
 * 统一管理定价、公司信息等，确保各页面一致性
 */

// 网站基本信息
export const siteConfig = {
  name: 'AI短剧生成器',
  description: '专业AI短剧创作平台，一键生成抖音风格短剧剧本、分镜、视频',
  url: process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://aiduanju.coze.site',
  email: 'contact@aidrama.com',
  location: '中国·北京',
  serviceTime: '7x24小时',
};

// 公司里程碑
export const companyMilestones = [
  { year: '2023', title: '项目启动', description: '开始研发AI短剧生成技术' },
  { year: '2024', title: '产品上线', description: '首个版本正式发布，服务首批用户' },
  { year: '2024.06', title: '技术突破', description: '实现人物、画面、声音三一致' },
  { year: '2025', title: '规模化', description: '服务超过10000名创作者' },
];

// 核心价值观
export const companyValues = [
  { icon: 'Target', title: '用户至上', description: '以用户需求为核心，持续优化产品体验' },
  { icon: 'Shield', title: '技术创新', description: '持续投入AI研发，保持技术领先' },
  { icon: 'Heart', title: '内容安全', description: '严格遵守内容规范，确保生成内容合规' },
  { icon: 'Users', title: '开放合作', description: '与创作者共同成长，构建生态' },
];

// 定价方案（统一配置）
// 商业模式：不售卖 token / 生成次数，只收网站使用费，套餐有效期内不限生成次数
export const pricingPlans = [
  {
    id: 'trial',
    name: '7天体验卡',
    price: 0,
    period: '',
    description: '注册即用，先体验再付费',
    icon: 'Sparkles',
    color: 'from-slate-500 to-slate-700',
    badge: null,
    durationDays: 7,
    features: [
      { text: '7天内不限次数生成', included: true },
      { text: '剧本 / 分镜 / 人物 / 场景全流程', included: true },
      { text: '480P视频导出', included: true },
      { text: '基础配音音色', included: true },
      { text: '社区技术支持', included: true },
      { text: '批量生成功能', included: false },
      { text: 'API接口调用', included: false },
    ],
    cta: '免费体验7天',
    href: '/login?mode=register',
  },
  {
    id: 'monthly',
    name: '月卡',
    price: 19.9,
    period: '/月',
    description: '轻度创作首选，一杯奶茶的价格',
    icon: 'Star',
    color: 'from-blue-500 to-cyan-600',
    badge: null,
    durationDays: 30,
    features: [
      { text: '30天内不限次数生成', included: true },
      { text: '1080P高清导出', included: true },
      { text: '全部配音音色库', included: true },
      { text: '批量生成功能', included: true },
      { text: '优先技术支持', included: true },
      { text: 'API接口调用', included: false },
      { text: '专属客户经理', included: false },
    ],
    cta: '开通月卡',
    href: '/login?plan=monthly',
  },
  {
    id: 'quarterly',
    name: '季卡',
    price: 39.9,
    originalPrice: 59.7,
    period: '/季',
    description: '平均每月13.3元，省33%',
    icon: 'Gift',
    color: 'from-violet-500 to-purple-600',
    badge: '推荐',
    durationDays: 90,
    features: [
      { text: '90天内不限次数生成', included: true },
      { text: '1080P高清导出', included: true },
      { text: '全部配音音色库', included: true },
      { text: '批量生成功能', included: true },
      { text: '优先技术支持', included: true },
      { text: 'API接口调用', included: false },
      { text: '专属客户经理', included: false },
    ],
    cta: '开通季卡',
    href: '/login?plan=quarterly',
  },
  {
    id: 'yearly',
    name: '年卡',
    price: 109,
    originalPrice: 238.8,
    period: '/年',
    description: '平均每月9.1元，省54%',
    icon: 'Crown',
    color: 'from-amber-500 to-orange-600',
    badge: '超值',
    durationDays: 365,
    features: [
      { text: '365天内不限次数生成', included: true },
      { text: '4K超清导出', included: true },
      { text: '定制配音音色', included: true },
      { text: '批量生成功能', included: true },
      { text: '专属客户经理', included: true },
      { text: 'API接口调用', included: true },
    ],
    cta: '开通年卡',
    href: '/login?plan=yearly',
  },
  {
    id: 'lifetime',
    name: '终身卡',
    price: 298,
    period: '/终身',
    description: '一次买断，不再续费',
    icon: 'Infinity',
    color: 'from-rose-500 to-pink-600',
    badge: '终身',
    durationDays: 36500,
    features: [
      { text: '长期有效，不限次数生成', included: true },
      { text: '4K超清导出', included: true },
      { text: '定制配音音色', included: true },
      { text: '批量生成功能', included: true },
      { text: '专属客户经理', included: true },
      { text: 'API接口调用', included: true },
    ],
    cta: '一次买断',
    href: '/login?plan=lifetime',
  },
];

// 功能对比表
export const featureComparison = [
  { feature: '计费方式', trial: '软件使用费', monthly: '软件使用费', quarterly: '软件使用费', yearly: '软件使用费', lifetime: '一次买断' },
  { feature: '模型接入', trial: '自带 Key / 内置', monthly: '自带 Key / 内置', quarterly: '自带 Key / 内置', yearly: '自带 Key / 内置', lifetime: '自带 Key / 内置' },
  { feature: '生成次数', trial: '不限', monthly: '不限', quarterly: '不限', yearly: '不限', lifetime: '不限' },
  { feature: '使用时长', trial: '7天', monthly: '30天', quarterly: '90天', yearly: '365天', lifetime: '长期有效' },
  { feature: '视频质量', trial: '480P', monthly: '1080P', quarterly: '1080P', yearly: '4K', lifetime: '4K' },
  { feature: '配音音色', trial: '基础', monthly: '全部', quarterly: '全部', yearly: '定制', lifetime: '定制' },
  { feature: '批量生成', trial: false, monthly: true, quarterly: true, yearly: true, lifetime: true },
  { feature: '优先支持', trial: false, monthly: true, quarterly: true, yearly: true, lifetime: true },
  { feature: '专属客服', trial: false, monthly: false, quarterly: false, yearly: true, lifetime: true },
  { feature: 'API接口', trial: false, monthly: false, quarterly: false, yearly: true, lifetime: true },
  { feature: '续费方式', trial: '到期购买套餐', monthly: '按月续费', quarterly: '按季续费', yearly: '按年续费', lifetime: '无需续费' },
];

// 使用案例
export const useCases = [
  {
    title: '抖音短剧创作者',
    description: '日更短剧内容，提升创作效率10倍',
    icon: 'Film',
    stats: '日均产出3-5集',
    features: ['一键生成剧本', '批量视频生成', '自动配音配乐'],
  },
  {
    title: 'MCN机构',
    description: '批量生产短剧内容，降低制作成本',
    icon: 'Users',
    stats: '制作成本降低80%',
    features: ['多项目管理', '团队协作', '数据统计分析'],
  },
  {
    title: '广告营销公司',
    description: '快速产出创意视频广告',
    icon: 'Target',
    stats: '制作周期缩短90%',
    features: ['创意视频生成', '多风格支持', '快速迭代'],
  },
  {
    title: '教育培训机构',
    description: '制作教学视频和培训内容',
    icon: 'Award',
    stats: '课程制作效率提升5倍',
    features: ['教学内容生成', '角色扮演视频', '多语言支持'],
  },
  {
    title: '网文IP改编方',
    description: '小说IP快速改编为短剧，验证市场再投入',
    icon: 'FileText',
    stats: '改编周期从3个月到1周',
    features: ['原著情节拆解', '名场面还原', '多版本AB测试'],
  },
  {
    title: '出海短剧团队',
    description: '多语言配音与字幕，一套素材发行全球',
    icon: 'Video',
    stats: '本地化成本降低70%',
    features: ['多语言配音', '字幕自动翻译', '多地区合规审核'],
  },
];

// 客户评价
export const testimonials = [
  {
    name: '张导演',
    role: '独立短剧创作者',
    content: '以前拍一集短剧需要3天，现在用AI生成只需要2小时。人物一致性做得很好，画质也很满意。',
    rating: 5,
  },
  {
    name: '李经理',
    role: 'MCN内容总监',
    content: '我们团队现在可以同时运营10个短剧账号，产能提升了5倍。批量生成功能太实用了！',
    rating: 5,
  },
  {
    name: '王编剧',
    role: '自由编剧',
    content: 'AI生成的剧本质量超出预期，节奏把控得很好，我只需要稍作修改就能用。大大提高了创作效率。',
    rating: 5,
  },
  {
    name: '赵制片',
    role: '影视公司制片人',
    content: '先用AI出样片验证市场，再决定真人翻拍投入，项目风险小了很多。三一致技术让样片质感接近成片。',
    rating: 5,
  },
  {
    name: '陈运营',
    role: '出海短剧运营负责人',
    content: '一套素材配8种语言配音和字幕，本地化成本降了七成。海外账号起量速度比预期快一倍。',
    rating: 4,
  },
  {
    name: '刘品牌',
    role: '电商品牌市场负责人',
    content: '品牌定制短剧从创意到上线只用了5天，剧情带货的转化率比硬广高3倍，已经续订年卡。',
    rating: 5,
  },
];

// 核心优势
export const advantages = [
  {
    icon: 'Users',
    title: '人物一致性',
    description: 'AI记住角色特征，不同镜头中人物外貌、服装保持一致，告别换脸尴尬',
  },
  {
    icon: 'Image',
    title: '画面一致性',
    description: '光影、色调、风格自动统一，打造专业级视觉效果',
  },
  {
    icon: 'Music',
    title: '声音一致性',
    description: '智能配音保持音色稳定，情绪表达自然流畅',
  },
  {
    icon: 'Zap',
    title: '全流程自动化',
    description: '从剧本到成片一键完成，创作效率提升10倍',
  },
  {
    icon: 'Shield',
    title: '内容安全',
    description: '智能审核系统，确保生成内容合规安全',
  },
  {
    icon: 'HeadphonesIcon',
    title: '专业支持',
    description: '7x24小时技术支持，专业团队保驾护航',
  },
];

// 技术能力
export const capabilities = [
  { icon: 'Film', title: '剧本生成', desc: '基于大语言模型的专业剧本创作' },
  { icon: 'Image', title: '图像生成', desc: '高质量角色立绘与场景图生成' },
  { icon: 'Video', title: '视频生成', desc: '领先的AI视频生成技术' },
  { icon: 'Music', title: '音频合成', desc: '自然的语音合成与配乐生成' },
];

// 团队介绍
export const team = [
  { name: '技术团队', role: 'AI研发', icon: 'Bot', description: '来自顶尖AI实验室' },
  { name: '产品团队', role: '产品设计', icon: 'Lightbulb', description: '深耕内容创作领域' },
  { name: '运营团队', role: '用户服务', icon: 'Heart', description: '7x24小时在线支持' },
];

// 联系方式
export const contactInfo = [
  { icon: 'Mail', label: '邮箱', value: siteConfig.email, href: `mailto:${siteConfig.email}` },
  { icon: 'Clock', label: '服务时间', value: siteConfig.serviceTime, href: null },
  { icon: 'MapPin', label: '地址', value: siteConfig.location, href: null },
];

// FAQ
export const pricingFaqs = [
  {
    question: '可以免费试用吗？',
    answer: '可以！注册即送 7 天体验卡，全流程功能不限次数使用，无需信用卡，也不用先付费。',
  },
  {
    question: '是按 token 或生成次数收费吗？',
    answer: '不是。我们不售卖 token，也不单独卖生成次数，只收网站使用费。套餐有效期内，剧本、分镜、人物、场景、配音、视频均可不限次数生成。',
  },
  {
    question: '支持哪些 AI 模型？',
    answer:
      '支持智谱、通义千问、火山引擎（豆包）、MiniMax、Moonshot（Kimi）、DeepSeek、文心一言、腾讯混元、NVIDIA 9 家主流平台，另支持任意 OpenAI 兼容接口的自定义接入。在「设置 > 模型接入」填入自己的 API Key 即可切换，模型厂商上新后可第一时间使用。',
  },
  {
    question: '为什么要自带 API Key？',
    answer:
      '平台的费用只覆盖网站功能本身，模型调用成本由你的 Key 直接结算给模型厂商。这样我们不需要按 token 或次数收费，你也不用被抽成，还能自由选择更便宜或更强的模型。不想配置 Key 的话，也可以使用平台内置模型（由平台代运行，按代运行服务单独计费）。',
  },
  {
    question: '平台内置模型和自带 Key 有什么区别？',
    answer:
      '自带 Key：套餐有效期内不限生成次数，模型费用按你与厂商的实际用量结算。平台内置模型：无需配置，由平台代运行，按代运行服务单独计费，适合先跑通流程再决定是否接入自己的 Key。两种方式可随时切换。',
  },
  {
    question: '我的 API Key 安全吗？',
    answer:
      'Key 加密存储、仅服务端调用，不会明文回显或下发到浏览器，日志中做脱敏处理。你可以随时在设置页替换或删除 Key，删除后立即失效。',
  },
  {
    question: '如何选择合适的方案？',
    answer: '月卡 19.9 元适合先试水；季卡 39.9 元平均每月 13.3 元；年卡 109 元平均每月 9.1 元，适合稳定创作；终身卡 298 元一次买断，长期使用不再续费。',
  },
  {
    question: '支持哪些支付方式？',
    answer: '支持支付宝、微信支付，也可通过卡密激活；企业采购支持对公转账。',
  },
  {
    question: '可以随时取消订阅吗？',
    answer: '可以。平台不会自动扣费，到期不续费即自动停止，无需额外操作。',
  },
  {
    question: '套餐到期后，之前生成的内容还在吗？',
    answer: '在。已生成的剧本、分镜、人物、场景、视频等素材都会保留，续费后可继续编辑和导出。',
  },
  {
    question: '终身卡是怎么算的？',
    answer: '终身卡一次付费 298 元，长期有效、不限生成次数，后续平台常规版本升级不再额外收费。',
  },
  {
    question: '支持开发票吗？',
    answer: '支持。个人可开电子普票，企业可开增值税专票。在「个人中心 > 订阅管理 > 发票申请」提交抬头后，1-3 个工作日内开具。',
  },
  {
    question: '不满意可以退款吗？',
    answer: '订阅后 7 天内且未实际产生生成记录，可申请全额退款；已使用的按剩余有效期比例协商退款。',
  },
  {
    question: '数据安全如何保障？',
    answer: '平台默认用户级数据隔离，素材存储于对象存储桶，生成内容不用于模型训练，账号数据仅本人可见。',
  },
];
