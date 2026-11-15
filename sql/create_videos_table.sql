-- 创建视频合集表
CREATE TABLE IF NOT EXISTS video_collections (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  series_id VARCHAR(36),
  cover_image_url VARCHAR(1000),
  video_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建AI生成的视频表
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  video_url VARCHAR(1000) NOT NULL,
  last_frame_url VARCHAR(1000),
  duration INTEGER DEFAULT 5,
  ratio VARCHAR(20) DEFAULT '16:9',
  resolution VARCHAR(20) DEFAULT '720p',
  file_size INTEGER,
  model VARCHAR(100),
  collection_id VARCHAR(36),
  episode_number INTEGER,
  status VARCHAR(20) DEFAULT 'completed' NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_collection FOREIGN KEY (collection_id) REFERENCES video_collections(id) ON DELETE SET NULL
);

-- 创建视频生成任务表
CREATE TABLE IF NOT EXISTS video_generation_tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id VARCHAR(36) NOT NULL,
  episode_number INTEGER,
  task_type VARCHAR(20) DEFAULT 'episode',
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 1,
  current_item TEXT,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_videos_collection_id ON videos(collection_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_video_collections_series_id ON video_collections(series_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_tasks_series_id ON video_generation_tasks(series_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_tasks_status ON video_generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_video_generation_tasks_created_at ON video_generation_tasks(created_at);

-- 添加注释
COMMENT ON TABLE videos IS 'AI生成的视频记录';
COMMENT ON TABLE video_collections IS '视频合集';
COMMENT ON TABLE video_generation_tasks IS '视频生成后台任务表';

COMMENT ON COLUMN videos.prompt IS '生成提示词';
COMMENT ON COLUMN videos.video_url IS '视频URL';
COMMENT ON COLUMN videos.last_frame_url IS '尾帧URL';
COMMENT ON COLUMN videos.duration IS '时长（秒）';
COMMENT ON COLUMN videos.ratio IS '比例';
COMMENT ON COLUMN videos.resolution IS '分辨率';
COMMENT ON COLUMN videos.file_size IS '文件大小（字节）';
COMMENT ON COLUMN videos.model IS '使用的模型';
COMMENT ON COLUMN videos.collection_id IS '关联合集';
COMMENT ON COLUMN videos.episode_number IS '集数';
COMMENT ON COLUMN videos.status IS '状态：pending, processing, completed, error';

COMMENT ON COLUMN video_generation_tasks.series_id IS '关联剧本ID';
COMMENT ON COLUMN video_generation_tasks.episode_number IS '集数';
COMMENT ON COLUMN video_generation_tasks.task_type IS '任务类型：single, episode, batch';
COMMENT ON COLUMN video_generation_tasks.status IS '状态：pending, running, completed, cancelled';
COMMENT ON COLUMN video_generation_tasks.progress IS '当前进度';
COMMENT ON COLUMN video_generation_tasks.total IS '总数';
COMMENT ON COLUMN video_generation_tasks.current_item IS '当前处理项描述';
COMMENT ON COLUMN video_generation_tasks.result IS '任务结果（JSON）';
