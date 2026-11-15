import { Metadata } from 'next';

const siteUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://aiduanju.coze.site';
const siteName = 'AI短剧生成器';

// 页面 SEO 配置
export const pageMetadata: Record<string, Metadata> = {
  // 首页
  home: {
    title: `${siteName} - 抖音短剧AI创作平台`,
    description: '专业AI短剧创作平台，一键生成抖音风格短剧剧本、分镜、视频。支持人物一致性、画面一致性、声音一致性，全自动量产短视频内容。',
    keywords: ['AI短剧', '短剧生成', '抖音短剧', 'AI视频', '剧本生成'],
    openGraph: {
      title: `${siteName} - 抖音短剧AI创作平台`,
      description: '专业AI短剧创作平台，一键生成抖音风格短剧剧本、分镜、视频。',
      url: siteUrl,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
  },

  // AI剧本生成
  drama: {
    title: 'AI剧本生成 - 智能创作短剧剧本',
    description: 'AI智能生成短剧剧本，支持多种题材风格，一键生成完整剧本大纲、人物设定、分集剧情。专业编剧级别的剧本创作工具。',
    keywords: ['AI剧本', '剧本生成', '短剧剧本', '剧本创作', '编剧工具'],
    openGraph: {
      title: 'AI剧本生成 - 智能创作短剧剧本',
      description: 'AI智能生成短剧剧本，支持多种题材风格，一键生成完整剧本。',
      url: `${siteUrl}/drama`,
    },
  },

  // 视频剪辑
  editor: {
    title: '视频剪辑工具 - AI智能剪辑',
    description: 'AI智能视频剪辑工具，支持自动字幕、智能配音、画面合成、特效添加。一键生成专业级短视频内容。',
    keywords: ['视频剪辑', 'AI剪辑', '短视频剪辑', '视频编辑', '剪辑工具'],
    openGraph: {
      title: '视频剪辑工具 - AI智能剪辑',
      description: 'AI智能视频剪辑工具，一键生成专业级短视频内容。',
      url: `${siteUrl}/editor`,
    },
  },

  // 图片素材
  images: {
    title: 'AI图片生成 - 智能图片素材管理',
    description: 'AI图片生成与管理，支持角色形象生成、场景图片创作、风格一致性保持。为短剧创作提供高质量图片素材。',
    keywords: ['AI图片', '图片生成', 'AI绘画', '图片素材', '角色形象'],
    openGraph: {
      title: 'AI图片生成 - 智能图片素材管理',
      description: 'AI图片生成与管理，为短剧创作提供高质量图片素材。',
      url: `${siteUrl}/images`,
    },
  },

  // 音频素材
  audio: {
    title: 'AI音乐音效 - 智能配音与背景音乐',
    description: 'AI智能配音与背景音乐生成，支持多角色声线、情感配音、BGM生成。为短剧添加专业级音频效果。',
    keywords: ['AI配音', 'AI音乐', '背景音乐', '语音合成', '音效生成'],
    openGraph: {
      title: 'AI音乐音效 - 智能配音与背景音乐',
      description: 'AI智能配音与背景音乐生成，为短剧添加专业级音频效果。',
      url: `${siteUrl}/audio`,
    },
  },

  // 视频管理
  videos: {
    title: '视频素材管理 - 短剧视频库',
    description: '视频素材集中管理，支持视频上传、分类整理、快速检索。高效管理短剧视频素材资源。',
    keywords: ['视频管理', '视频素材', '视频库', '素材管理'],
    openGraph: {
      title: '视频素材管理 - 短剧视频库',
      description: '视频素材集中管理，高效管理短剧视频素材资源。',
      url: `${siteUrl}/videos`,
    },
  },

  // 工作流
  workflow: {
    title: '自动化工作流 - AI短剧量产',
    description: '自动化短剧创作工作流，从剧本到成片一键完成。批量生成短剧内容，提升创作效率。',
    keywords: ['自动化', '工作流', 'AI量产', '短剧批量', '自动化创作'],
    openGraph: {
      title: '自动化工作流 - AI短剧量产',
      description: '自动化短剧创作工作流，从剧本到成片一键完成。',
      url: `${siteUrl}/workflow`,
    },
  },

  // 配置中心
  config: {
    title: '配置中心 - 角色与剧本配置',
    description: '角色形象配置、剧本模板管理、创作参数设置。个性化定制你的AI短剧创作体验。',
    keywords: ['配置', '角色配置', '剧本模板', '创作设置'],
    openGraph: {
      title: '配置中心 - 角色与剧本配置',
      description: '角色形象配置、剧本模板管理、创作参数设置。',
      url: `${siteUrl}/config`,
    },
  },

  // 提示词库
  prompts: {
    title: 'AI提示词库 - 创作灵感模板',
    description: '精选AI提示词模板库，包含剧本、分镜、配音、画面等各类提示词。激发创作灵感，提升生成质量。',
    keywords: ['提示词', 'Prompt', 'AI模板', '创作灵感'],
    openGraph: {
      title: 'AI提示词库 - 创作灵感模板',
      description: '精选AI提示词模板库，激发创作灵感。',
      url: `${siteUrl}/prompts`,
    },
  },

  // AI对话
  chat: {
    title: 'AI创作顾问 - 智能对话助手',
    description: 'AI创作顾问，解答创作问题、提供创意建议、优化剧本内容。你的专属短剧创作助手。',
    keywords: ['AI对话', '创作顾问', 'AI助手', '创作建议'],
    openGraph: {
      title: 'AI创作顾问 - 智能对话助手',
      description: 'AI创作顾问，解答创作问题、提供创意建议。',
      url: `${siteUrl}/chat`,
    },
  },

  // 帮助中心
  'help-center': {
    title: '帮助中心 - 使用指南与常见问题',
    description: 'AI短剧生成器使用指南、常见问题解答、操作教程。帮助你快速上手短剧创作。',
    keywords: ['帮助', '教程', 'FAQ', '使用指南'],
    openGraph: {
      title: '帮助中心 - 使用指南与常见问题',
      description: 'AI短剧生成器使用指南、常见问题解答。',
      url: `${siteUrl}/help-center`,
    },
  },

  // 解决方案
  solution: {
    title: '解决方案 - AI短剧创作方案与定价',
    description: 'AI短剧生成器专业解决方案，从个人创作者到大型企业，提供灵活的定价方案和定制服务。人物画面声音三一致，全流程自动化。',
    keywords: ['解决方案', '定价', '会员套餐', '企业方案', 'AI短剧'],
    openGraph: {
      title: '解决方案 - AI短剧创作方案与定价',
      description: 'AI短剧生成器专业解决方案，灵活定价满足不同需求。',
      url: `${siteUrl}/solution`,
    },
  },

  // 关于我们
  about: {
    title: '关于我们 - AI赋能创作者',
    description: '了解AI短剧生成器团队，我们致力于用AI技术赋能每一位创作者，降低短剧创作门槛，提升创作效率。',
    keywords: ['关于我们', '团队', '使命', '愿景'],
    openGraph: {
      title: '关于我们 - AI赋能创作者',
      description: '了解AI短剧生成器团队，用AI技术赋能创作者。',
      url: `${siteUrl}/about`,
    },
  },

  // 文档
  docs: {
    title: '使用文档 - 完整功能说明',
    description: 'AI短剧生成器完整使用文档，功能详解、API接口、最佳实践。助你充分挖掘平台潜力。',
    keywords: ['文档', 'API', '功能说明', '使用手册'],
    openGraph: {
      title: '使用文档 - 完整功能说明',
      description: 'AI短剧生成器完整使用文档。',
      url: `${siteUrl}/docs`,
    },
  },

  // 登录
  login: {
    title: '登录 - 开启AI短剧创作之旅',
    description: '登录AI短剧生成器，开始你的短剧创作之旅。支持卡密激活、会员登录。',
    keywords: ['登录', '会员', '激活'],
    robots: { index: false, follow: false },
  },

  // 个人中心
  profile: {
    title: '个人中心 - 我的账户',
    description: '查看会员状态、管理个人信息、订阅续费。',
    robots: { index: false, follow: false },
  },

  // 设置
  settings: {
    title: '设置 - 账户设置',
    description: '账户设置与偏好配置。',
    robots: { index: false, follow: false },
  },
};

// 生成页面 metadata 的辅助函数
export function getPageMetadata(pageKey: keyof typeof pageMetadata): Metadata {
  return pageMetadata[pageKey] || pageMetadata.home;
}
