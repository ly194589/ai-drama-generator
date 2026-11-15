-- API 用量记录表
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- video, image, audio, chat
    count INTEGER DEFAULT 1,
    duration INTEGER, -- 时长（秒）
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_type ON api_usage(type);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- 添加注释
COMMENT ON TABLE api_usage IS 'API 用量记录表';
COMMENT ON COLUMN api_usage.user_id IS '用户ID';
COMMENT ON COLUMN api_usage.type IS 'API类型：video/image/audio/chat';
COMMENT ON COLUMN api_usage.count IS '调用次数';
COMMENT ON COLUMN api_usage.duration IS '时长（秒），用于视频和音频';
COMMENT ON COLUMN api_usage.metadata IS '额外元数据';
