import type { WorkflowStep } from './types';

export const workflowSteps: WorkflowStep[] = [
  {
    id: 'input',
    name: '用户输入',
    description: '接收题材、核心冲突、人物数量',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'character',
    name: '生成角色档案',
    description: '创建固定角色档案并存入全局变量',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'script',
    name: '生成剧本分镜',
    description: '生成短剧剧本和分镜脚本',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'reference',
    name: '生成角色参考图',
    description: '为每个角色生成一致的参考图像',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'video',
    name: '生成视频片段',
    description: '根据分镜生成视频片段',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'voice',
    name: '生成角色配音',
    description: '为每个角色生成配音',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'audio',
    name: '生成音频素材',
    description: '生成BGM、环境音、音效',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'edit',
    name: '自动剪辑合成',
    description: '自动剪辑合成视频',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'quality',
    name: '质量自检',
    description: '检查人物一致性、画面崩坏、声音错位等',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'output',
    name: '输出最终短剧',
    description: '输出最终短剧成品',
    status: 'pending',
    progress: 0,
  },
];
