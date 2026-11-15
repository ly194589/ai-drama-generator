import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // 修复多 lockfile / 单仓 tracing 根目录警告，并避免把上层目录打进产物
  // outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['*.dev.coze.site'],
  turbopack: {},
  // 关闭 X-Powered-By，减少指纹暴露
  poweredByHeader: false,
  // 开启 gzip 压缩（生产由运行时/CDN 亦可处理，这里兜底）
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
  // 统一安全响应头
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
  // Fix: force CJS build for coze-coding-dev-sdk to avoid rslib ESM compatibility issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'coze-coding-dev-sdk': path.resolve(__dirname, 'node_modules/coze-coding-dev-sdk/dist/cjs/index.js'),
      };
    }
    return config;
  },
};

export default nextConfig;
