-- 用户配置表 - 添加扣子 OAuth 字段
-- 如果表不存在则创建，存在则添加字段

-- 创建 user_config 表（如果不存在）
CREATE TABLE IF NOT EXISTS user_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- 扣子 API Key（手动配置）
    coze_api_key TEXT,
    
    -- 扣子 OAuth 字段
    coze_user_id VARCHAR(255) UNIQUE,
    coze_access_token TEXT,
    coze_refresh_token TEXT,
    coze_token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 模型配置
    video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
    audio_model VARCHAR(100) DEFAULT 'default',
    image_model VARCHAR(100) DEFAULT 'default',
    solution_preset VARCHAR(50) DEFAULT 'seedance-1-5-pro',
    llm_model VARCHAR(100) DEFAULT 'doubao-seed-2-0-pro-260215',
    image_size VARCHAR(20) DEFAULT '2K',
    tts_speaker VARCHAR(100) DEFAULT 'zh_female_mizai_saturn_bigtts',
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加扣子 OAuth 字段（如果不存在）
DO $$
BEGIN
    -- 添加 coze_user_id 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_config' AND column_name = 'coze_user_id'
    ) THEN
        ALTER TABLE user_config ADD COLUMN coze_user_id VARCHAR(255) UNIQUE;
    END IF;
    
    -- 添加 coze_access_token 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_config' AND column_name = 'coze_access_token'
    ) THEN
        ALTER TABLE user_config ADD COLUMN coze_access_token TEXT;
    END IF;
    
    -- 添加 coze_refresh_token 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_config' AND column_name = 'coze_refresh_token'
    ) THEN
        ALTER TABLE user_config ADD COLUMN coze_refresh_token TEXT;
    END IF;
    
    -- 添加 coze_token_expires_at 字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_config' AND column_name = 'coze_token_expires_at'
    ) THEN
        ALTER TABLE user_config ADD COLUMN coze_token_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_config_user_id ON user_config(user_id);
CREATE INDEX IF NOT EXISTS idx_user_config_coze_user_id ON user_config(coze_user_id);

-- 添加注释
COMMENT ON TABLE user_config IS '用户配置表，存储 API Key、模型选择等配置';
COMMENT ON COLUMN user_config.user_id IS '用户唯一标识（Supabase Auth ID 或 coze_xxx）';
COMMENT ON COLUMN user_config.coze_user_id IS '扣子平台用户 ID';
COMMENT ON COLUMN user_config.coze_access_token IS '扣子 OAuth 访问令牌';
COMMENT ON COLUMN user_config.coze_refresh_token IS '扣子 OAuth 刷新令牌';
COMMENT ON COLUMN user_config.coze_token_expires_at IS '令牌过期时间';
