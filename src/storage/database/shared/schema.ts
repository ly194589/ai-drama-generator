import { pgTable, serial, timestamp, text, varchar, boolean, integer, jsonb, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 对话会话表
export const chatSessions = pgTable("chat_sessions", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 对话消息表
export const chatMessages = pgTable("chat_messages", {
	id: serial().notNull().primaryKey(),
	sessionId: varchar("session_id", { length: 36 }).notNull(),
	role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant'
	content: text("content").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
});

// AI生成的视频表
export const videos = pgTable("videos", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	prompt: text("prompt").notNull(), // 生成提示词
	video_url: varchar("video_url", { length: 1000 }).notNull(), // 视频URL
	last_frame_url: varchar("last_frame_url", { length: 1000 }), // 尾帧URL
	duration: integer("duration").default(5), // 时长（秒）
	ratio: varchar("ratio", { length: 20 }).default('16:9'), // 比例
	resolution: varchar("resolution", { length: 20 }).default('720p'), // 分辨率
	file_size: integer("file_size"), // 文件大小（字节）
	model: varchar("model", { length: 100 }), // 使用的模型
	collection_id: varchar("collection_id", { length: 36 }), // 关联合集
	episode_number: integer("episode_number"), // 集数
	status: varchar("status", { length: 20 }).default('completed').notNull(), // pending, processing, completed, error
	metadata: jsonb("metadata"), // 额外元数据
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 视频合集表
export const videoCollections = pgTable("video_collections", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	series_id: varchar("series_id", { length: 36 }), // 关联剧集
	cover_image_url: varchar("cover_image_url", { length: 1000 }),
	video_count: integer("video_count").default(0),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 视频生成任务表
export const videoGenerationTasks = pgTable("video_generation_tasks", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	series_id: varchar("series_id", { length: 36 }).notNull(),
	episode_number: integer("episode_number"),
	task_type: varchar("task_type", { length: 20 }).default('episode'), // single, episode, batch
	status: varchar("status", { length: 20 }).default('pending').notNull(), // pending, running, completed, cancelled
	progress: integer("progress").default(0),
	total: integer("total").default(1),
	current_item: text("current_item"),
	result: jsonb("result"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 视频素材表
export const videoMaterials = pgTable("video_materials", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	fileKey: varchar("file_key", { length: 500 }).notNull(), // 对象存储key
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileSize: integer("file_size").notNull(), // 字节
	duration: integer("duration"), // 秒
	thumbnailKey: varchar("thumbnail_key", { length: 500 }), // 缩略图key
	status: varchar("status", { length: 20 }).default('uploaded').notNull(), // uploaded, processing, analyzed, error
	metadata: jsonb("metadata"), // AI分析结果、视频信息等
	tags: jsonb("tags").default([]), // 标签数组
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 视频剪辑项目表
export const editProjects = pgTable("edit_projects", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	config: jsonb("config").notNull(), // 剪辑配置（分镜、转场、字幕等）
	status: varchar("status", { length: 20 }).default('draft').notNull(), // draft, processing, completed, error
	outputFileKey: varchar("output_file_key", { length: 500 }), // 输出视频key
	outputFileName: varchar("output_file_name", { length: 255 }),
	outputFileSize: integer("output_file_size"),
	duration: integer("duration"), // 输出视频时长（秒）
	progress: integer("progress").default(0), // 处理进度 0-100
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 剪辑素材关联表
export const editAssets = pgTable("edit_assets", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	projectId: varchar("project_id", { length: 36 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(), // video, audio, image, text
	fileKey: varchar("file_key", { length: 500 }), // 对象存储key
	fileName: varchar("file_name", { length: 255 }),
	sourceUrl: varchar("source_url", { length: 1000 }), // 外部URL
	duration: integer("duration"), // 时长（秒）
	startTime: integer("start_time"), // 在源文件中的开始时间
	endTime: integer("end_time"), // 在源文件中的结束时间
	order: integer("order").default(0), // 排序
	metadata: jsonb("metadata"), // 额外配置
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
});

// ======== 剧本系统 ========

// 全剧剧本表
export const dramaSeries = pgTable("drama_series", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	genre: varchar("genre", { length: 50 }).notNull(), // 题材类型
	theme: varchar("theme", { length: 255 }), // 主题
	coreConflict: text("core_conflict"), // 核心冲突
	targetAudience: varchar("target_audience", { length: 255 }), // 目标受众
	totalEpisodes: integer("total_episodes").default(80).notNull(), // 总集数
	episodeDuration: integer("episode_duration").default(300).notNull(), // 每集时长（秒）
	characters: jsonb("characters").default([]), // 角色列表
	worldView: text("world_view"), // 世界观设定
	style: varchar("style", { length: 50 }), // 风格：甜宠、虐恋、爽剧等
	status: varchar("status", { length: 20 }).default('draft').notNull(), // draft, outlining, writing, completed
	progress: integer("progress").default(0), // 创作进度
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 剧本大纲表
export const dramaOutlines = pgTable("drama_outlines", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	seriesId: varchar("series_id", { length: 36 }).notNull(), // 关联全剧
	episodeRange: varchar("episode_range", { length: 50 }).notNull(), // 集数范围：1-10
	title: varchar("title", { length: 255 }).notNull(), // 大纲标题
	summary: text("summary").notNull(), // 情节概要
	keyEvents: jsonb("key_events").default([]), // 关键事件
	emotionalArc: text("emotional_arc"), // 情感弧线
	climaxPoint: text("climax_point"), // 高潮点
	characterDevelopment: text("character_development"), // 角色发展
	order: integer("order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 单集剧本表
export const dramaEpisodes = pgTable("drama_episodes", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	seriesId: varchar("series_id", { length: 36 }).notNull(), // 关联全剧
	outlineId: varchar("outline_id", { length: 36 }), // 关联大纲
	episodeNumber: integer("episode_number").notNull(), // 集数
	title: varchar("title", { length: 255 }).notNull(), // 本集标题
	summary: text("summary"), // 本集概要
	duration: integer("duration").default(300), // 时长（秒）
	storyboards: jsonb("storyboards").default([]), // 分镜剧本
	dialogues: jsonb("dialogues").default([]), // 对话脚本
	characters: jsonb("characters").default([]), // 出场角色
	scenes: jsonb("scenes").default([]), // 场景列表
	emotions: jsonb("emotions").default([]), // 情绪曲线
	hook: text("hook"), // 开头钩子
	cliffhanger: text("cliffhanger"), // 结尾悬念
	status: varchar("status", { length: 20 }).default('draft').notNull(), // draft, reviewed, finalized
	videoFileKey: varchar("video_file_key", { length: 500 }), // 生成的视频key
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// ======== 音频系统 ========

// 音频素材表
export const audioMaterials = pgTable("audio_materials", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	type: varchar("type", { length: 20 }).notNull(), // voice, bgm, sfx
	category: varchar("category", { length: 50 }), // 分类：男声、女声、悲伤BGM等
	fileKey: varchar("file_key", { length: 500 }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileSize: integer("file_size").notNull(),
	duration: integer("duration").notNull(), // 时长（秒）
	format: varchar("format", { length: 20 }), // mp3, wav, etc
	bitrate: integer("bitrate"), // 比特率
	sampleRate: integer("sample_rate"), // 采样率
	// 配音专用字段
	characterId: varchar("character_id", { length: 36 }), // 关联角色
	characterName: varchar("character_name", { length: 100 }), // 角色名称
	voiceStyle: varchar("voice_style", { length: 100 }), // 声音风格
	emotion: varchar("emotion", { length: 50 }), // 情绪：平静、激动、悲伤等
	// BGM专用字段
	mood: varchar("mood", { length: 100 }), // 情绪基调
	tempo: varchar("tempo", { length: 20 }), // 节奏：快、中、慢
	instruments: jsonb("instruments").default([]), // 乐器
	metadata: jsonb("metadata"),
	tags: jsonb("tags").default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// 角色配音配置表
export const characterVoices = pgTable("character_voices", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	seriesId: varchar("series_id", { length: 36 }).notNull(),
	characterId: varchar("character_id", { length: 36 }).notNull(),
	characterName: varchar("character_name", { length: 100 }).notNull(),
	voiceId: varchar("voice_id", { length: 100 }), // AI语音ID
	voiceProvider: varchar("voice_provider", { length: 50 }), // 语音提供商
	voiceStyle: varchar("voice_style", { length: 100 }), // 声音风格描述
	sampleAudioKey: varchar("sample_audio_key", { length: 500 }), // 示例音频
	settings: jsonb("settings").default({}), // 语音设置：语速、音调等
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});

// ======== 图片系统 ========

// 图片素材表
export const imageMaterials = pgTable("image_materials", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	type: varchar("type", { length: 20 }).notNull(), // poster, promotional, character, scene, storyboard
	category: varchar("category", { length: 50 }), // 分类：海报、宣传图、角色图、场景图、分镜图
	fileKey: varchar("file_key", { length: 500 }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileSize: integer("file_size").notNull(),
	width: integer("width").notNull(),
	height: integer("height").notNull(),
	format: varchar("format", { length: 20 }), // jpg, png, webp
	thumbnailKey: varchar("thumbnail_key", { length: 500 }), // 缩略图key
	// 关联字段
	seriesId: varchar("series_id", { length: 36 }), // 关联剧本
	episodeId: varchar("episode_id", { length: 36 }), // 关联单集
	characterId: varchar("character_id", { length: 36 }), // 关联角色
	characterName: varchar("character_name", { length: 100 }), // 角色名称
	sceneId: varchar("scene_id", { length: 36 }), // 关联场景
	storyboardId: varchar("storyboard_id", { length: 36 }), // 关联分镜
	// 宣传图/海报专用字段
	purpose: varchar("purpose", { length: 50 }), // 用途：封面、海报、Banner、分享图
	style: varchar("style", { length: 50 }), // 风格：现代、古风、科幻等
	mood: varchar("mood", { length: 100 }), // 情绪基调
	platform: varchar("platform", { length: 50 }), // 平台：抖音、快手、微信等
	dimensions: varchar("dimensions", { length: 50 }), // 尺寸规格：9:16、1:1、16:9
	// AI生成相关
	isAiGenerated: boolean("is_ai_generated").default(false),
	generationPrompt: text("generation_prompt"), // AI生成提示词
	// 元数据
	metadata: jsonb("metadata"), // AI分析结果等
	tags: jsonb("tags").default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
		.defaultNow(),
});
