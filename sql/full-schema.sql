-- ============================================================================
-- AI 短剧生成器 · Supabase 完整建表脚本（一次性执行）
-- ----------------------------------------------------------------------------
-- 用途：在【空的】Supabase 项目 SQL Editor 中整份执行，建立服务端代码实际读写的
--       全部 38 张表 + 1 个兼容视图、索引与唯一约束。
-- 依据：src/storage/database/shared/schema.ts + sql/ 四个增量脚本 + 全源码
--       列使用提取（check-report/extract-table-columns.mjs → table-columns.json）
--       与逐路由人工核对（含变量形式 insert/update 的载荷）。
-- 幂等：全部 CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS，可重复执行。
-- 旧库：若数据库已按旧增量脚本建过表，执行本脚本后再执行文末「旧库兼容补列」。
-- 权限：服务端优先使用 COZE_SUPABASE_SERVICE_ROLE_KEY（绕过 RLS）。
--       新建表默认不启用 RLS；如需启用见文末可选段（仅 anon key 时勿启用）。
-- ============================================================================

-- ---------------------------------------------------------------- 基础 / 会话
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- session_id 外键为 PostgREST 嵌套查询 select('*, messages(*)') 所必需
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  session_id VARCHAR(36) PRIMARY KEY,
  preferences JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_advisor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_advisor_sessions_user_id ON ai_advisor_sessions(user_id);

CREATE TABLE IF NOT EXISTS ai_advisor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_advisor_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_advisor_messages_session_id ON ai_advisor_messages(session_id);

-- ---------------------------------------------------------------- 授权 / 计费
CREATE TABLE IF NOT EXISTS card_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'unused',   -- unused / used / expired / disabled
  plan_type VARCHAR(50),
  plan_name VARCHAR(50),
  price NUMERIC(10,2),
  duration_days INTEGER,
  user_id VARCHAR(255),
  order_id VARCHAR(64),
  metadata JSONB,                                 -- username / email / passwordHash 等
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_card_keys_user_id ON card_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_card_keys_status ON card_keys(status);

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) NOT NULL UNIQUE,
  plan_type VARCHAR(50),
  amount NUMERIC(10,2),
  duration_days INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / paid / failed
  payment_method VARCHAR(20),
  card_key VARCHAR(64),
  paid_at TIMESTAMPTZ,
  metadata JSONB,                                 -- { userId }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,                      -- video / image / audio / chat
  count INTEGER DEFAULT 1,
  duration INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_type ON api_usage(type);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  cost NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'success',
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(created_at);

-- ---------------------------------------------------------------- 用户配置
CREATE TABLE IF NOT EXISTS user_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  coze_api_key TEXT,
  coze_user_id VARCHAR(255) UNIQUE,
  coze_access_token TEXT,
  coze_refresh_token TEXT,
  coze_token_expires_at TIMESTAMPTZ,
  -- 模型选择
  video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
  video_resolution VARCHAR(20) DEFAULT '720p',
  audio_model VARCHAR(100) DEFAULT 'default',
  image_model VARCHAR(100) DEFAULT 'default',
  image_size VARCHAR(20) DEFAULT '2K',
  solution_preset VARCHAR(50) DEFAULT 'seedance-1-5-pro',
  llm_model VARCHAR(100) DEFAULT 'doubao-seed-2-0-pro-260215',
  tts_speaker VARCHAR(100) DEFAULT 'zh_female_mizai_saturn_bigtts',
  llm_provider VARCHAR(50) DEFAULT 'coze',
  image_provider VARCHAR(50) DEFAULT 'coze',
  video_provider VARCHAR(50) DEFAULT 'coze',
  tts_provider VARCHAR(50) DEFAULT 'coze',
  -- 第三方提供商密钥（AES-256-GCM 加密落库）与端点
  zhipu_api_key TEXT,        zhipu_base_url TEXT,        zhipu_api_key_set_at TIMESTAMPTZ,
  qwen_api_key TEXT,         qwen_base_url TEXT,         qwen_api_key_set_at TIMESTAMPTZ,
  volcengine_api_key TEXT,   volcengine_base_url TEXT,   volcengine_api_key_set_at TIMESTAMPTZ,
  minimax_api_key TEXT,      minimax_base_url TEXT,      minimax_api_key_set_at TIMESTAMPTZ,
  moonshot_api_key TEXT,     moonshot_base_url TEXT,     moonshot_api_key_set_at TIMESTAMPTZ,
  deepseek_api_key TEXT,     deepseek_base_url TEXT,     deepseek_api_key_set_at TIMESTAMPTZ,
  wenxin_api_key TEXT,       wenxin_base_url TEXT,       wenxin_api_key_set_at TIMESTAMPTZ,
  hunyuan_api_key TEXT,      hunyuan_base_url TEXT,      hunyuan_api_key_set_at TIMESTAMPTZ,
  nvidia_api_key TEXT,       nvidia_base_url TEXT,       nvidia_api_key_set_at TIMESTAMPTZ,
  custom_api_key TEXT,       custom_base_url TEXT,       custom_api_key_set_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_config_user_id ON user_config(user_id);
CREATE INDEX IF NOT EXISTS idx_user_config_coze_user_id ON user_config(coze_user_id);

CREATE TABLE IF NOT EXISTS user_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  voice_id VARCHAR(100) NOT NULL,
  voice_name VARCHAR(100),
  sample_url VARCHAR(500),
  duration INTEGER,
  status VARCHAR(20) DEFAULT 'active',            -- active / deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_voices_user_id ON user_voices(user_id);

-- ---------------------------------------------------------------- 开放平台
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  name TEXT NOT NULL DEFAULT '默认 Key',
  key_hash TEXT NOT NULL UNIQUE,
  masked_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS skill_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  skill_id VARCHAR(100) NOT NULL,
  license_key VARCHAR(64) NOT NULL,
  plan_type VARCHAR(50) NOT NULL DEFAULT '',
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_licenses_user_id ON skill_licenses(user_id);

CREATE TABLE IF NOT EXISTS model_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(120) NOT NULL DEFAULT 'default',
  count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider, model)
);
CREATE INDEX IF NOT EXISTS idx_model_usage_user_id ON model_usage(user_id);

-- ---------------------------------------------------------------- 剧本系统
CREATE TABLE IF NOT EXISTS drama_series (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  genre VARCHAR(50) NOT NULL,
  theme VARCHAR(255),
  core_conflict TEXT,
  core_conflict_types JSONB DEFAULT '[]',
  target_audience VARCHAR(255),
  total_episodes INTEGER NOT NULL DEFAULT 80,
  episode_duration INTEGER NOT NULL DEFAULT 300,
  characters JSONB DEFAULT '[]',
  world_view TEXT,
  style VARCHAR(50),
  image_style VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  progress INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drama_series_user_id ON drama_series(user_id);

CREATE TABLE IF NOT EXISTS drama_outlines (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  series_id VARCHAR(36) NOT NULL,
  episode_range VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  key_events JSONB DEFAULT '[]',
  emotional_arc TEXT,
  climax_point TEXT,
  character_development TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drama_outlines_series_id ON drama_outlines(series_id);

CREATE TABLE IF NOT EXISTS drama_episodes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  series_id VARCHAR(36) NOT NULL,
  outline_id VARCHAR(36),
  episode_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  brief TEXT,
  duration INTEGER DEFAULT 300,
  storyboards JSONB DEFAULT '[]',
  dialogues JSONB DEFAULT '[]',
  characters JSONB DEFAULT '[]',
  scenes JSONB DEFAULT '[]',
  emotions JSONB DEFAULT '[]',
  hook TEXT,
  cliffhanger TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  video_file_key VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drama_episodes_series_id ON drama_episodes(series_id);

-- 旧路由仍按 episodes 表名读取分镜（只读），以视图兼容
CREATE OR REPLACE VIEW episodes AS SELECT * FROM drama_episodes;

CREATE TABLE IF NOT EXISTS drama_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id VARCHAR(36),
  name VARCHAR(100),
  description TEXT,
  image_id VARCHAR(36),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drama_characters_series_id ON drama_characters(series_id);

CREATE TABLE IF NOT EXISTS drama_artwork (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id VARCHAR(36),
  character_id VARCHAR(100),
  character_name VARCHAR(100),
  image_type VARCHAR(50),
  purpose VARCHAR(100),
  purpose_detail TEXT,
  generation_prompt TEXT,
  image_key VARCHAR(500),
  image_url VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drama_artwork_series_id ON drama_artwork(series_id);

CREATE TABLE IF NOT EXISTS character_artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id VARCHAR(36),
  character_id VARCHAR(100),
  character_name VARCHAR(100),
  image_url VARCHAR(1000),
  image_key VARCHAR(500),
  purpose VARCHAR(100),
  generation_prompt TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_character_artworks_series_id ON character_artworks(series_id);

CREATE TABLE IF NOT EXISTS scene_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id VARCHAR(36),
  title VARCHAR(255),
  description TEXT,
  image_url VARCHAR(1000),
  image_key VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scene_images_series_id ON scene_images(series_id);

CREATE TABLE IF NOT EXISTS character_voices (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  series_id VARCHAR(36) NOT NULL,
  character_id VARCHAR(36) NOT NULL,
  character_name VARCHAR(100) NOT NULL,
  voice_id VARCHAR(100),
  voice_name VARCHAR(100),
  voice_provider VARCHAR(50),
  voice_style VARCHAR(100),
  sample_audio_key VARCHAR(500),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_character_voices_series_id ON character_voices(series_id);

-- ---------------------------------------------------------------- 素材系统
CREATE TABLE IF NOT EXISTS image_materials (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  file_key VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  format VARCHAR(20),
  thumbnail_key VARCHAR(500),
  series_id VARCHAR(36),
  episode_id VARCHAR(36),
  character_id VARCHAR(36),
  character_name VARCHAR(100),
  scene_id VARCHAR(36),
  storyboard_id VARCHAR(36),
  purpose VARCHAR(50),
  style VARCHAR(50),
  mood VARCHAR(100),
  platform VARCHAR(50),
  dimensions VARCHAR(50),
  is_ai_generated BOOLEAN DEFAULT FALSE,
  generation_prompt TEXT,
  metadata JSONB,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_image_materials_user_id ON image_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_image_materials_series_id ON image_materials(series_id);

CREATE TABLE IF NOT EXISTS audio_materials (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  file_key VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  format VARCHAR(20),
  bitrate INTEGER,
  sample_rate INTEGER,
  character_id VARCHAR(36),
  character_name VARCHAR(100),
  voice_style VARCHAR(100),
  emotion VARCHAR(50),
  mood VARCHAR(100),
  tempo VARCHAR(20),
  instruments JSONB DEFAULT '[]',
  series_id VARCHAR(36),
  episode_number INTEGER,
  metadata JSONB,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_materials_user_id ON audio_materials(user_id);

CREATE TABLE IF NOT EXISTS video_materials (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_key VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  duration INTEGER,
  thumbnail_key VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  series_id VARCHAR(36),
  collection_id VARCHAR(36),
  episode_number INTEGER,
  metadata JSONB,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_materials_user_id ON video_materials(user_id);

-- ---------------------------------------------------------------- 视频系统
CREATE TABLE IF NOT EXISTS video_collections (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  series_id VARCHAR(36),
  cover_image_url VARCHAR(1000),
  video_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_collections_series_id ON video_collections(series_id);
CREATE INDEX IF NOT EXISTS idx_video_collections_user_id ON video_collections(user_id);

CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255),
  title VARCHAR(255),
  prompt TEXT NOT NULL,
  video_url VARCHAR(1000) NOT NULL,
  last_frame_url VARCHAR(1000),
  duration INTEGER DEFAULT 5,
  ratio VARCHAR(20) DEFAULT '16:9',
  resolution VARCHAR(20) DEFAULT '720p',
  file_size INTEGER,
  model VARCHAR(100),
  collection_id VARCHAR(36) REFERENCES video_collections(id) ON DELETE SET NULL,
  series_id VARCHAR(36),
  episode_number INTEGER,
  hook_type VARCHAR(50),
  sort_order INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_videos_collection_id ON videos(collection_id);
CREATE INDEX IF NOT EXISTS idx_videos_series_id ON videos(series_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

CREATE TABLE IF NOT EXISTS video_generation_tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  series_id VARCHAR(36) NOT NULL,
  episode_number INTEGER,
  task_type VARCHAR(20) DEFAULT 'episode',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 1,
  current_item TEXT,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_generation_tasks_series_id ON video_generation_tasks(series_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_tasks_status ON video_generation_tasks(status);

CREATE TABLE IF NOT EXISTS video_task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50),
  priority INTEGER DEFAULT 5,
  payload JSONB,
  status VARCHAR(20) DEFAULT 'pending',           -- pending / queued / running / completed / failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  series_id VARCHAR(36),
  episode_number INTEGER,
  storyboard_id VARCHAR(36),
  result JSONB,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_task_queue_status ON video_task_queue(status);
CREATE INDEX IF NOT EXISTS idx_video_task_queue_series_id ON video_task_queue(series_id);

CREATE TABLE IF NOT EXISTS video_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(36),
  series_id VARCHAR(36),
  episode_number INTEGER,
  shot_index INTEGER,
  shot_name VARCHAR(255),
  prompt TEXT,
  image_url VARCHAR(1000),
  duration INTEGER DEFAULT 5,
  status VARCHAR(20) DEFAULT 'pending',
  max_retries INTEGER DEFAULT 3,
  retries INTEGER DEFAULT 0,
  error TEXT,
  result JSONB,
  video_url VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_generation_queue_batch_id ON video_generation_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_queue_status ON video_generation_queue(status);

CREATE TABLE IF NOT EXISTS generation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  series_id VARCHAR(36),
  payload JSONB,
  status VARCHAR(20) DEFAULT 'pending',           -- pending / running / completed / failed
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id ON generation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_status ON generation_tasks(status);

-- ---------------------------------------------------------------- 剪辑 / 工作流
CREATE TABLE IF NOT EXISTS edit_projects (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  output_file_key VARCHAR(500),
  output_file_url VARCHAR(1000),
  output_file_name VARCHAR(255),
  output_file_size INTEGER,
  duration INTEGER,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edit_assets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  file_key VARCHAR(500),
  file_name VARCHAR(255),
  source_url VARCHAR(1000),
  duration INTEGER,
  start_time INTEGER,
  end_time INTEGER,
  "order" INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edit_assets_project_id ON edit_assets(project_id);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id VARCHAR(64) PRIMARY KEY,                     -- wf-<ts>-<rand>
  name VARCHAR(255),
  definition JSONB,
  context JSONB,
  current_stage VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  series_id VARCHAR(36),
  episode_id VARCHAR(36),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_series_id ON workflow_instances(series_id);

CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id VARCHAR(64) NOT NULL,
  version INTEGER,
  progress INTEGER,
  context JSONB,
  task_states JSONB,
  "timestamp" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_workflow_id ON workflow_checkpoints(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_cache (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  version INTEGER,
  tags JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  size INTEGER,
  hits INTEGER DEFAULT 0,
  access_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------- 提示词库
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  content TEXT NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1,
  parent_id UUID,
  quality_score NUMERIC(5,2),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);

-- ============================================================================
-- 旧库兼容补列（空库执行无副作用；旧增量脚本建过的库借此补齐代码新增列）
-- ============================================================================
ALTER TABLE videos               ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE videos               ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE videos               ADD COLUMN IF NOT EXISTS series_id VARCHAR(36);
ALTER TABLE videos               ADD COLUMN IF NOT EXISTS hook_type VARCHAR(50);
ALTER TABLE videos               ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE video_collections    ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE video_materials      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE video_materials      ADD COLUMN IF NOT EXISTS series_id VARCHAR(36);
ALTER TABLE video_materials      ADD COLUMN IF NOT EXISTS collection_id VARCHAR(36);
ALTER TABLE video_materials      ADD COLUMN IF NOT EXISTS episode_number INTEGER;
ALTER TABLE image_materials      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE audio_materials      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE audio_materials      ADD COLUMN IF NOT EXISTS series_id VARCHAR(36);
ALTER TABLE audio_materials      ADD COLUMN IF NOT EXISTS episode_number INTEGER;
ALTER TABLE drama_series         ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE drama_series         ADD COLUMN IF NOT EXISTS core_conflict_types JSONB DEFAULT '[]';
ALTER TABLE drama_series         ADD COLUMN IF NOT EXISTS image_style VARCHAR(50);
ALTER TABLE drama_episodes       ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE character_voices     ADD COLUMN IF NOT EXISTS voice_name VARCHAR(100);
ALTER TABLE edit_projects        ADD COLUMN IF NOT EXISTS output_file_url VARCHAR(1000);
ALTER TABLE video_generation_tasks ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS video_resolution VARCHAR(20) DEFAULT '720p';
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(50) DEFAULT 'coze';
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS image_provider VARCHAR(50) DEFAULT 'coze';
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS video_provider VARCHAR(50) DEFAULT 'coze';
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS tts_provider VARCHAR(50) DEFAULT 'coze';
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS zhipu_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS zhipu_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS zhipu_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS qwen_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS qwen_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS qwen_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS volcengine_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS volcengine_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS volcengine_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS minimax_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS minimax_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS minimax_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS moonshot_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS moonshot_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS moonshot_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS deepseek_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS deepseek_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS wenxin_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS wenxin_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS wenxin_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS hunyuan_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS hunyuan_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS hunyuan_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS nvidia_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS nvidia_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS nvidia_api_key_set_at TIMESTAMPTZ;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS custom_api_key TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS custom_base_url TEXT;
ALTER TABLE user_config          ADD COLUMN IF NOT EXISTS custom_api_key_set_at TIMESTAMPTZ;

-- ============================================================================
-- 可选：行级安全（RLS）
-- 服务端使用 service_role key 时绕过 RLS，可安全启用以阻断 anon 直连读写。
-- 【注意】若 Vercel 只配置了 COZE_SUPABASE_ANON_KEY（无 service role），启用后
-- 所有接口将 401/空结果——此时保持默认（不启用）或补齐 service role key。
-- 需要时去掉下面整段注释执行：
-- ============================================================================
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
--   END LOOP;
-- END $$;