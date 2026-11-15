#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
# Vercel 等平台以 NODE_ENV=production 运行构建命令，pnpm 在该环境下会跳过
# 并清除 devDependencies（typescript/tailwindcss/@types/*），导致 next build
# 转译 next.config.ts 时报 Cannot find module 'typescript'。
# 安装阶段强制 development；构建阶段仍由 next build 自行设为 production。
NODE_ENV=development pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building the project..."
pnpm next build

echo "Build completed successfully!"
