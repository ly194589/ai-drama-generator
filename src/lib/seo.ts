import { Metadata } from 'next';

const siteUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://aiduanju.coze.site';

// 页面 SEO 配置类型
export interface PageSEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
}

// 生成页面 metadata
export function generatePageMetadata(config: PageSEOConfig): Metadata {
  const { title, description, keywords, ogImage, noIndex } = config;
  
  return {
    title,
    description,
    keywords: keywords?.join(', '),
    openGraph: {
      title: `${title} | AI短剧生成器`,
      description,
      url: siteUrl,
      siteName: 'AI短剧生成器',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AI短剧生成器`,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}

// 各页面 SEO 配置
export const pageSEOConfigs: Record<string, PageSEOConfig> = {
  drama: {
    title: 'AI剧本生成',
    description: '一键生成抖音风格短剧剧本，AI智能分析剧情走向，自动生成人物对话、场景描述，支持多种题材风格。',
    keywords: ['AI剧本', '剧本生成', '短剧剧本', '抖音剧本', 'AI写作', '剧本创作'],
  },
  editor: {
    title: '视频剪辑工具',
    description: 'AI智能视频剪辑工具，支持分镜剪辑、AI合成、一键输出成片。自动化视频制作流程，提升创作效率。',
    keywords: ['视频剪辑', 'AI剪辑', '视频合成', '分镜剪辑', '自动剪辑', '短视频制作'],
  },
  images: {
    title: 'AI图片生成',
    description: 'AI图片生成与管理，一键生成海报、宣传图、角色图，支持人物一致性，保持角色形象统一。',
    keywords: ['AI图片', '图片生成', 'AI海报', '宣传图', '角色图', 'AI绘画'],
  },
  audio: {
    title: 'AI音乐音效',
    description: 'AI音乐与音效生成平台，自动生成配乐、BGM、音效，支持多种音乐风格，为短剧增添专业音频。',
    keywords: ['AI音乐', 'BGM生成', '音效生成', 'AI配音', '背景音乐', '音乐创作'],
  },
  videos: {
    title: '视频素材管理',
    description: '视频素材管理与AI视频生成，支持视频上传、整理、AI生成视频片段，打造个人视频素材库。',
    keywords: ['视频素材', 'AI视频', '视频管理', '视频生成', '素材库', '短视频'],
  },
  workflow: {
    title: '自动化工作流',
    description: 'AI短剧自动化工作流，一键执行剧本生成、图片生成、视频合成全流程，实现短视频量产。',
    keywords: ['自动化工作流', 'AI工作流', '短剧量产', '视频自动化', '批量生成'],
  },
  config: {
    title: '配置工具',
    description: '角色档案与分镜剧本配置工具，管理角色信息、设定剧情走向，为AI生成提供精准指导。',
    keywords: ['配置工具', '角色档案', '分镜配置', '剧本配置', '角色设定'],
  },
  prompts: {
    title: 'AI提示词库',
    description: 'AI提示词管理与复用平台，精选优质提示词模板，提升AI生成效果，助力高效创作。',
    keywords: ['提示词', 'AI提示词', 'Prompt', '提示词库', 'AI模板'],
  },
  chat: {
    title: 'AI创作顾问',
    description: '专业AI短剧创作顾问，提供剧本优化建议、创作灵感、技术指导，助力打造爆款短剧。',
    keywords: ['AI顾问', '创作顾问', '剧本优化', '创作建议', 'AI助手'],
  },
  docs: {
    title: '使用文档',
    description: 'AI短剧生成器使用文档，详细功能说明、操作指南、最佳实践，快速上手AI短剧创作。',
    keywords: ['使用文档', '帮助文档', '操作指南', '使用教程'],
  },
  'help-center': {
    title: '帮助中心',
    description: 'AI短剧生成器帮助中心，常见问题解答、技术支持、使用技巧，解决您的创作难题。',
    keywords: ['帮助中心', '常见问题', '技术支持', 'FAQ'],
  },
  solution: {
    title: '解决方案',
    description: 'AI短剧创作解决方案，为MCN机构、内容创作者、广告主提供定制化短剧生产服务。灵活定价，满足不同规模需求。',
    keywords: ['解决方案', '短剧解决方案', 'MCN', '内容创作', '短视频营销'],
  },
  pricing: {
    title: '定价方案',
    description: 'AI短剧生成器透明定价，免费版、专业版、企业版多种方案可选。免费体验，无需信用卡，按需付费。',
    keywords: ['定价', '会员套餐', '订阅', '价格', '免费试用'],
  },
  about: {
    title: '关于我们',
    description: 'AI短剧生成器团队致力于用AI技术赋能每一位创作者，降低短剧创作门槛，提升创作效率，让每个人都能成为内容创作者。',
    keywords: ['关于我们', '团队介绍', '使命愿景', 'AI短剧'],
  },
};

// 获取页面 SEO 配置
export function getPageSEO(pageKey: string): Metadata {
  const config = pageSEOConfigs[pageKey];
  if (!config) {
    return generatePageMetadata({
      title: 'AI短剧生成器',
      description: '专业AI短剧创作平台',
    });
  }
  return generatePageMetadata(config);
}
