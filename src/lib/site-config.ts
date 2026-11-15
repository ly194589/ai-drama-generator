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

// 定价方案（统一配置）- 体验卡/月卡/季卡/年卡
export const pricingPlans = [
  {
    id: 'trial',
    name: '体验卡',
    price: 0,
    period: '免费',
    description: '新用户免费体验',
    icon: 'Sparkles',
    color: 'from-gray-500 to-slate-600',
    badge: null,
    durationDays: 7,
    quotas: {
      scripts: 1,      // 剧本
      videos: 5,       // 视频
      images: 20,      // 图片
      music: 5,        // 音乐（与视频一致）
    },
    features: [
      { text: '7天内1个剧本生成', included: true },
      { text: '7天内5个视频生成', included: true },
      { text: '7天内20张图片生成', included: true },
      { text: '7天内5个音乐生成', included: true },
      { text: '基础配音音色', included: true },
      { text: '社区技术支持', included: true },
      { text: '480P视频导出', included: true },
      { text: '批量生成功能', included: false },
      { text: 'API接口调用', included: false },
      { text: '专属客户经理', included: false },
    ],
    cta: '免费注册',
    href: '/login?mode=register',
  },
  {
    id: 'monthly',
    name: '月卡',
    price: 29.9,
    period: '/月',
    description: '适合个人创作者',
    icon: 'Star',
    color: 'from-blue-500 to-cyan-600',
    badge: null,
    durationDays: 30,
    quotas: {
      scripts: 5,
      videos: 300,
      images: 500,
      music: 300,
    },
    features: [
      { text: '每月5个剧本生成', included: true },
      { text: '每月300个视频生成', included: true },
      { text: '每月500张图片生成', included: true },
      { text: '每月300个音乐生成', included: true },
      { text: '全部配音音色库', included: true },
      { text: '优先技术支持', included: true },
      { text: '1080P高清导出', included: true },
      { text: '批量生成功能', included: true },
      { text: 'API接口调用', included: false },
      { text: '专属客户经理', included: false },
    ],
    cta: '立即订阅',
    href: '/profile?tab=subscription',
  },
  {
    id: 'quarterly',
    name: '季卡',
    price: 79,
    originalPrice: 89.7,
    period: '/季',
    description: '超值选择，省11%',
    icon: 'Gift',
    color: 'from-violet-500 to-purple-600',
    badge: '推荐',
    durationDays: 90,
    quotas: {
      scripts: 20,
      videos: 1350,
      images: 2000,
      music: 1350,
    },
    features: [
      { text: '每季20个剧本生成', included: true },
      { text: '每季1350个视频生成', included: true },
      { text: '每季2000张图片生成', included: true },
      { text: '每季1350个音乐生成', included: true },
      { text: '全部配音音色库', included: true },
      { text: '优先技术支持', included: true },
      { text: '1080P高清导出', included: true },
      { text: '批量生成功能', included: true },
      { text: 'API接口调用', included: false },
      { text: '专属客户经理', included: false },
    ],
    cta: '立即订阅',
    href: '/profile?tab=subscription',
  },
  {
    id: 'yearly',
    name: '年卡',
    price: 299,
    originalPrice: 358.8,
    period: '/年',
    description: '最佳性价比，省16%',
    icon: 'Crown',
    color: 'from-amber-500 to-orange-600',
    badge: '超值',
    durationDays: 365,
    quotas: {
      scripts: 125,
      videos: 6950,
      images: 10000,
      music: 6950,
    },
    features: [
      { text: '每年125个剧本生成', included: true },
      { text: '每年6950个视频生成', included: true },
      { text: '每年10000张图片生成', included: true },
      { text: '每年6950个音乐生成', included: true },
      { text: '定制配音音色', included: true },
      { text: '专属客户经理', included: true },
      { text: '4K超清导出', included: true },
      { text: '批量生成功能', included: true },
      { text: 'API接口调用', included: true },
      { text: '私有化部署', included: false },
    ],
    cta: '立即订阅',
    href: '/profile?tab=subscription',
  },
];

// 资源包配置（单独购买）
export const resourcePacks = [
  {
    id: 'script_pack_2',
    name: '剧本包·2次',
    price: 9.9,
    description: '2次剧本生成',
    icon: 'FileText',
    quotas: { scripts: 2 },
    popular: false,
  },
  {
    id: 'video_pack_20',
    name: '视频包·20次',
    price: 19.9,
    description: '20次视频生成',
    icon: 'Video',
    quotas: { videos: 20 },
    popular: true,
  },
  {
    id: 'video_pack_50',
    name: '视频包·50次',
    price: 39.9,
    originalPrice: 49.75,
    description: '50次视频生成，省20%',
    icon: 'Video',
    quotas: { videos: 50 },
    popular: false,
  },
  {
    id: 'music_pack_20',
    name: '音乐包·20次',
    price: 19.9,
    description: '20次音乐生成',
    icon: 'Music',
    quotas: { music: 20 },
    popular: false,
  },
  {
    id: 'image_pack_100',
    name: '图片包·100张',
    price: 19.9,
    description: '100张图片生成',
    icon: 'Image',
    quotas: { images: 100 },
    popular: false,
  },
  {
    id: 'music_pack_50',
    name: '音乐包·50次',
    price: 39.9,
    originalPrice: 49.75,
    description: '50次音乐生成，省20%',
    icon: 'Music',
    quotas: { music: 50 },
    popular: false,
  },
  {
    id: 'script_pack_10',
    name: '剧本包·10次',
    price: 39.9,
    originalPrice: 49.5,
    description: '10次剧本生成，省20%',
    icon: 'FileText',
    quotas: { scripts: 10 },
    popular: false,
  },
];

// 功能对比表
export const featureComparison = [
  { feature: '剧本生成', trial: '1个/7天', monthly: '5个/月', quarterly: '20个/季', yearly: '125个/年' },
  { feature: '视频生成', trial: '5个/7天', monthly: '300个/月', quarterly: '1350个/季', yearly: '6950个/年' },
  { feature: '图片生成', trial: '20张/7天', monthly: '500张/月', quarterly: '2000张/季', yearly: '10000张/年' },
  { feature: '音乐生成', trial: '5个/7天', monthly: '300个/月', quarterly: '1350个/季', yearly: '6950个/年' },
  { feature: '配音音色', trial: '基础', monthly: '全部', quarterly: '全部', yearly: '定制' },
  { feature: '视频质量', trial: '480P', monthly: '1080P', quarterly: '1080P', yearly: '4K' },
  { feature: '批量生成', trial: false, monthly: true, quarterly: true, yearly: true },
  { feature: 'API接口', trial: false, monthly: false, quarterly: false, yearly: true },
  { feature: '专属客服', trial: false, monthly: false, quarterly: false, yearly: true },
  { feature: '优先支持', trial: false, monthly: true, quarterly: true, yearly: true },
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
    answer: '可以！我们提供永久免费版本，包含基础的剧本、视频、图片生成功能，无需信用卡即可开始使用。',
  },
  {
    question: '如何选择合适的方案？',
    answer: '如果您是初次体验，建议从免费版开始。如果您是专业创作者或小团队，专业版性价比最高。如果您有大量生产需求，建议选择企业版。',
  },
  {
    question: '支持哪些支付方式？',
    answer: '我们支持微信支付、支付宝、银行卡等多种支付方式，也支持对公转账。',
  },
  {
    question: '可以随时取消订阅吗？',
    answer: '可以。您可以随时在设置页面取消订阅，取消后当前计费周期结束后不再扣费。',
  },
  {
    question: '企业版支持定制吗？',
    answer: '企业版支持专属音色定制、私有化部署、功能定制等服务，具体请联系我们的商务团队。',
  },
  {
    question: '额度用完了怎么办？',
    answer: '您可以升级套餐获得更多额度，也可以单独购买额度包。专业版和企业版用户享有额度自动续充服务。',
  },
  {
    question: '当月额度没用完可以结转吗？',
    answer: '月卡额度当月有效；季卡与年卡额度在有效期内可结转使用。单独购买的资源包额度永久有效，用完为止。',
  },
  {
    question: '支持开发票吗？',
    answer: '支持。个人可开电子普票，企业可开增值税专票。在「个人中心 > 订阅管理 > 发票申请」提交抬头后，1-3 个工作日内开具。',
  },
  {
    question: '不满意可以退款吗？',
    answer: '订阅后 7 天内且生成额度使用不超过 10%，可申请全额退款；资源包未使用部分支持按比例退款。超出条件可联系客服协商。',
  },
  {
    question: '私有化部署和数据安全如何保障？',
    answer: '年卡及以上支持私有化部署咨询。平台默认用户级数据隔离，素材存储于您的对象存储桶，生成内容不用于模型训练，企业版提供审计日志。',
  },
];

// 增值服务（资源包）
export const addOns = [
  { name: '剧本包·5次', desc: '额外5次剧本生成额度', price: '9.9元', icon: 'FileText' },
  { name: '视频包·20次', desc: '额外20次视频生成额度', price: '19.9元', icon: 'Video' },
  { name: '视频包·50次', desc: '额外50次视频生成额度', price: '39.9元', icon: 'Video' },
  { name: '图片包·100张', desc: '额外100张图片生成额度', price: '19.9元', icon: 'Image' },
];
