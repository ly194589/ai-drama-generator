'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Image, 
  Video, 
  Music, 
  FolderOpen, 
  Search, 
  AlertCircle,
  Inbox,
  Plus,
} from 'lucide-react';

interface EmptyStateProps {
  type: 'images' | 'videos' | 'audios' | 'documents' | 'projects' | 'search' | 'error' | 'default';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const configMap = {
  images: {
    icon: Image,
    title: '暂无图片素材',
    description: '上传或AI生成图片素材，用于海报、角色立绘等',
    bgColor: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
  },
  videos: {
    icon: Video,
    title: '暂无视频素材',
    description: '上传或AI生成视频素材，开始创作你的短剧',
    bgColor: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
  },
  audios: {
    icon: Music,
    title: '暂无音频素材',
    description: '上传或AI生成配乐、BGM、音效素材',
    bgColor: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
  },
  documents: {
    icon: FileText,
    title: '暂无文档',
    description: '创建你的第一个短剧剧本项目',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  projects: {
    icon: FolderOpen,
    title: '暂无项目',
    description: '创建新项目，开始你的短剧创作之旅',
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-500',
  },
  search: {
    icon: Search,
    title: '未找到结果',
    description: '尝试使用其他关键词搜索',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
  error: {
    icon: AlertCircle,
    title: '加载失败',
    description: '数据加载出错，请稍后重试',
    bgColor: 'bg-red-500/10',
    iconColor: 'text-red-500',
  },
  default: {
    icon: Inbox,
    title: '暂无数据',
    description: '这里还没有任何内容',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
};

export function EmptyState({ 
  type, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  const config = configMap[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
        config.bgColor
      )}>
        <Icon className={cn("w-8 h-8", config.iconColor)} />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {title || config.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {description || config.description}
      </p>
      {action && (
        <Button onClick={action.onClick} className="gap-2">
          {type !== 'search' && type !== 'error' && <Plus className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

// 带边框的空状态
export function EmptyStateCard(props: EmptyStateProps) {
  return (
    <div className="border-2 border-dashed rounded-xl">
      <EmptyState {...props} />
    </div>
  );
}
