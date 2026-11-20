-- 开放平台相关表：API Key、Skill 授权、模型用量
-- 说明：表格用于线上（Supabase）持久化；未执行本脚本时服务端自动回退到本地 .data 文件（仅开发环境可用）

-- 平台 API Key（只保存哈希与掩码，明文仅在创建时返回一次）
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name TEXT NOT NULL DEFAULT '默认 Key',
    key_hash TEXT NOT NULL UNIQUE,
    masked_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

COMMENT ON TABLE api_keys IS '平台签发的开放 API Key（仅存哈希）';

-- Skill 授权记录（同一用户 + 同一 Skill 唯一）
CREATE TABLE IF NOT EXISTS skill_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    skill_id VARCHAR(100) NOT NULL,
    license_key VARCHAR(64) NOT NULL,
    plan_type VARCHAR(50) NOT NULL DEFAULT '',
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_licenses_user_id ON skill_licenses(user_id);

COMMENT ON TABLE skill_licenses IS 'Skill 市场授权记录，license_key 用于导出水印与追溯';

-- 按模型统计的调用次数（仅统计，不计费）
CREATE TABLE IF NOT EXISTS model_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(120) NOT NULL DEFAULT 'default',
    count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_model_usage_user_id ON model_usage(user_id);

COMMENT ON TABLE model_usage IS '用户按厂商 + 模型的调用次数统计';
