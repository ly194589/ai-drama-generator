import { MetadataRoute } from 'next';

const siteUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://aiduanju.coze.site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/static/',
          '/login',
          '/profile',
          '/settings',
          '/payment/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'Baiduspider',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'Baiduspider-image',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'Sogou',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'Sogou web spider',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: '360Spider',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'Bytespider', // 抖音/头条
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'YisouSpider', // 神马
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
      {
        userAgent: 'bingbot',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/', '/login', '/payment/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
