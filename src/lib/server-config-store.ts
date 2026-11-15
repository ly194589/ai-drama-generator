/**
 * 本地配置存储（未配置数据库时的兜底持久化）
 *
 * 当 COZE_SUPABASE_URL / COZE_SUPABASE_ANON_KEY 缺失时，
 * 用户配置（user_config 同构字段）与 AI 顾问会话/消息
 * 持久化到项目根目录 .data/server-config.json，
 * 保证模型设置、自定义模型、API 密钥、AI 顾问在本地/开发环境可正常使用。
 * 配置了数据库后，所有路由仍走 Supabase，行为不变。
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'server-config.json');

export interface LocalAdvisorSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface LocalAdvisorMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface StoreShape {
  userConfig: Record<string, Record<string, unknown>>;
  advisorSessions: LocalAdvisorSession[];
  advisorMessages: LocalAdvisorMessage[];
}

/** 是否已配置 Supabase 数据库（Next.js 会自动加载 .env） */
export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY);
}

function readStore(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      userConfig: parsed.userConfig || {},
      advisorSessions: parsed.advisorSessions || [],
      advisorMessages: parsed.advisorMessages || [],
    };
  } catch {
    return { userConfig: {}, advisorSessions: [], advisorMessages: [] };
  }
}

function writeStore(store: StoreShape): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== 用户配置 ====================

/** 读取本地用户配置行（与 user_config 表字段同构） */
export function getLocalUserConfig(userId: string): Record<string, unknown> {
  return readStore().userConfig[userId] || {};
}

/** 合并写入本地用户配置，返回完整行 */
export function saveLocalUserConfig(userId: string, patch: Record<string, unknown>): Record<string, unknown> {
  const store = readStore();
  const row: Record<string, unknown> = {
    ...(store.userConfig[userId] || {}),
    ...patch,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  store.userConfig[userId] = row;
  writeStore(store);
  return row;
}

// ==================== AI 顾问会话 ====================

export function listLocalSessions(userId: string): LocalAdvisorSession[] {
  return readStore()
    .advisorSessions
    .filter(s => s.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function createLocalSession(userId: string, title: string): LocalAdvisorSession {
  const store = readStore();
  const now = new Date().toISOString();
  const session: LocalAdvisorSession = {
    id: randomId('session'),
    user_id: userId,
    title: title || '新咨询',
    created_at: now,
    updated_at: now,
  };
  store.advisorSessions.unshift(session);
  writeStore(store);
  return session;
}

export function getLocalSession(userId: string, sessionId: string): LocalAdvisorSession | null {
  return readStore().advisorSessions.find(s => s.id === sessionId && s.user_id === userId) || null;
}

export function deleteLocalSession(userId: string, sessionId: string): void {
  const store = readStore();
  store.advisorSessions = store.advisorSessions.filter(s => !(s.id === sessionId && s.user_id === userId));
  store.advisorMessages = store.advisorMessages.filter(m => m.session_id !== sessionId);
  writeStore(store);
}

// ==================== AI 顾问消息 ====================

export function listLocalMessages(sessionId: string): LocalAdvisorMessage[] {
  return readStore()
    .advisorMessages
    .filter(m => m.session_id === sessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function appendLocalMessage(sessionId: string, role: string, content: string): LocalAdvisorMessage {
  const store = readStore();
  const message: LocalAdvisorMessage = {
    id: randomId('msg'),
    session_id: sessionId,
    role,
    content,
    created_at: new Date().toISOString(),
  };
  store.advisorMessages.push(message);
  const session = store.advisorSessions.find(s => s.id === sessionId);
  if (session) session.updated_at = message.created_at;
  writeStore(store);
  return message;
}