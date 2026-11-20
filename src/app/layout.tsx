import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import HomePageSchema from '@/components/seo/json-ld';
import { Toaster } from '@/components/ui/sonner';

// 自托管字体：构建期下载并生成本地 CSS，避免运行时 media 改写造成的属性差异
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

// 网站基础配置
const siteUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://aiduanju.coze.site';
const siteName = 'AI短剧生成器';
const siteDescription = '专业AI短剧创作平台，一键生成抖音风格短剧剧本、分镜、视频。支持人物一致性、画面一致性、声音一致性，全自动量产短视频内容。';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  // 基础信息
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} - 抖音短剧AI创作平台`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  keywords: [
    'AI短剧',
    '短剧生成',
    '抖音短剧',
    'AI视频',
    '剧本生成',
    '分镜脚本',
    'AI剪辑',
    '短视频制作',
    'AI创作',
    '自动化视频',
    '人物一致性',
    'AI配音',
  ],
  
  // 语言和地区
  alternates: {
    canonical: '/',
    languages: {
      'zh-CN': '/',
    },
  },
  
  // 作者和版权
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  
  // 机器人配置
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: siteUrl,
    siteName,
    title: `${siteName} - 抖音短剧AI创作平台`,
    description: siteDescription,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} - 抖音短剧AI创作平台`,
    description: siteDescription,
    images: ['/og-image.png'],
    creator: '@aiduanju',
  },
  
  // 其他
  category: 'technology',
  classification: 'AI创作工具',
  
  // 应用相关
  applicationName: siteName,
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  
  // 其他 meta
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'baidu-site-verification': 'codeva-KooX3W28Cg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={plusJakarta.variable}>
      <body className="font-sans">
        <HomePageSchema />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
