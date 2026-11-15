// 角色档案类型
export interface Character {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  faceShape: string;
  hairstyle: string;
  clothing: string;
  skinTone: string;
  temperament: string;
  microActions: string[];
  voiceId?: string;
  emotionRules: {
    calm: number;
    happy: number;
    aggrieved: number;
    angry: number;
  };
}

// 分镜剧本类型
export interface Storyboard {
  id: string;
  sequence: number;
  time: string;
  shotType: 'close-up' | 'medium' | 'long' | 'extreme-close' | 'wide';
  characters: string[];
  emotion: string;
  visualDescription: string;
  dialogue: string;
  soundEffects: string;
  bgm: string;
}

// 剧本项目
export interface Script {
  id: string;
  title: string;
  genre: string;
  duration: number;
  characters: Character[];
  storyboards: Storyboard[];
  createdAt: Date;
}

// 工作流步骤类型
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// 提示词类型
export interface Prompt {
  id: string;
  title: string;
  category: 'character' | 'script' | 'video' | 'voice' | 'editing' | 'system';
  content: string;
  description: string;
  tags: string[];
  usage: number;
  createdAt: Date;
  updatedAt: Date;
}
