'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Lightbulb,
  Plus,
  MessageSquare,
  Clock,
  Menu,
  X,
  BrainCircuit,
  Zap,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const suggestions = [
  '如何设计更强的开篇钩子？',
  '怎样让角色更立体？',
  '短剧的节奏怎么把控？',
  '如何避免AI生成的人物变脸？',
  'Nemotron 3 Ultra 擅长哪些创作任务？',
  '如何优化分镜提示词？',
  '打脸爽点怎么设计才不拖沓？',
  '短剧内容有哪些合规红线？',
];

// 全局中间件要求非公开 API 携带用户身份（x-user-id）
function authHeaders(withJson = true): Record<string, string> {
  const userId = typeof window !== 'undefined' ? (localStorage.getItem('userId') || 'dev-user') : 'dev-user';
  return withJson
    ? { 'Content-Type': 'application/json', 'x-user-id': userId }
    : { 'x-user-id': userId };
}

export default function AIAdvisorPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-advisor/sessions', { headers: authHeaders(false) });
      const data = await response.json();
      setSessions(data.sessions || []);
      
      if (data.sessions?.length > 0 && !currentSession) {
        setCurrentSession(data.sessions[0]);
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  // 加载消息
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/ai-advisor/sessions/${sessionId}`, { headers: authHeaders(false) });
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id);
    } else {
      setMessages([]);
    }
  }, [currentSession, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 创建新会话
  const createSession = async () => {
    try {
      const response = await fetch('/api/ai-advisor/sessions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: '新咨询' })
      });
      const data = await response.json();
      if (data.session) {
        setSessions(prev => [data.session, ...prev]);
        setCurrentSession(data.session);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
    }
  };

  // 删除会话
  const deleteSession = async (sessionId: string) => {
    if (!confirm('确定删除这个咨询记录吗？')) return;
    
    try {
      await fetch(`/api/ai-advisor/sessions/${sessionId}`, { method: 'DELETE', headers: authHeaders(false) });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(sessions.find(s => s.id !== sessionId) || null);
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 保存消息（sessionIdOverride：新建会话时闭包里的 currentSession 还是旧值，需显式传入）
  const saveMessage = async (role: 'user' | 'assistant', content: string, sessionIdOverride?: string) => {
    const sid = sessionIdOverride || currentSession?.id;
    if (!sid) return null;
    
    try {
      const response = await fetch('/api/ai-advisor/messages', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ 
          sessionId: sid, 
          role, 
          content 
        })
      });
      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('保存消息失败:', error);
      return null;
    }
  };

  // 发送消息
  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isSending) return;

    let sessionId = currentSession?.id;
    if (!sessionId) {
      const response = await fetch('/api/ai-advisor/sessions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: text.slice(0, 50) })
      });
      const data = await response.json();
      if (data.session) {
        sessionId = data.session.id;
        setSessions(prev => [data.session, ...prev]);
        setCurrentSession(data.session);
      }
    }

    setIsSending(true);
    setInput('');

    const savedUserMessage = await saveMessage('user', text, sessionId);
    if (savedUserMessage) {
      setMessages(prev => [...prev, savedUserMessage as Message]);
    }

    try {
      const response = await fetch('/api/ai-advisor/stream', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `请求失败（HTTP ${response.status}）`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let streamError = '';

      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, tempMessage]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                streamError = String(parsed.error);
              }
              if (parsed.content) {
                assistantContent += parsed.content;
                setMessages(prev => 
                  prev.map(m => 
                    m.id === tempMessage.id 
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 流式接口返回了错误事件且没有任何内容：把错误展示在气泡中，而不是静默空白
      if (!assistantContent && streamError) {
        setMessages(prev =>
          prev.map(m =>
            m.id === tempMessage.id
              ? { ...m, content: `模型调用失败：${streamError}` }
              : m
          )
        );
      }

      if (assistantContent && sessionId) {
        const savedAssistantMessage = await saveMessage('assistant', assistantContent, sessionId);
        if (savedAssistantMessage) {
          setMessages(prev => 
            prev.map(m => 
              m.id === tempMessage.id 
                ? savedAssistantMessage as Message
                : m
            )
          );
        }
      }

      if (messages.length === 0 && text) {
        setSessions(prev => 
          prev.map(s => 
            s.id === sessionId 
              ? { ...s, title: text.slice(0, 50) }
              : s
          )
        );
      }
    } catch (error) {
      console.error('发送失败:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，发生了错误：${error instanceof Error ? error.message : '请重试'}`,
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  // 复制消息
  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header - 淡彩 hero，与全站工具页统一 */}
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="relative z-10 p-5 sm:p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm flex-shrink-0">
                <BrainCircuit className="h-6 w-6" />
                <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-400 rounded-full border-2 border-background" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">AI 创作顾问</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">专业短剧创作指导 · 剧本 / 角色 / 分镜 / 节奏</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20 hidden sm:inline-flex">
                <Zap className="h-2.5 w-2.5 mr-1" />
                Nemotron 3 Ultra A55B
              </Badge>
              <Button
                size="sm"
                onClick={createSession}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4 mr-1" />
                新建咨询
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 lg:hidden"
                onClick={() => setShowSessions(v => !v)}
                aria-label="切换咨询历史"
              >
                {showSessions ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Chat 主体 */}
        <Card className="rounded-2xl overflow-hidden p-0 gap-0">
          <div className="flex h-[calc(100vh-20rem)] min-h-[480px] relative overflow-hidden">
            {/* Sidebar - Sessions */}
            <aside className={`border-r bg-card lg:w-64 lg:static lg:block lg:shadow-none transition-all duration-300 ${showSessions ? 'absolute inset-y-0 left-0 z-20 w-64 shadow-xl' : 'hidden'}`}>
              <div className="h-full flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">咨询历史</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setShowSessions(false)} aria-label="关闭咨询历史">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        加载中...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">暂无咨询记录</p>
                        <p className="text-xs mt-1">点击右上角 + 创建新咨询</p>
                      </div>
                    ) : (
                      sessions.map(session => (
                        <button
                          key={session.id}
                          onClick={() => {
                            setCurrentSession(session);
                            setShowSessions(false);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-all ${
                            currentSession?.id === session.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted text-foreground'
                          }`}
                        >
                          <p className="font-medium truncate">{session.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {new Date(session.updated_at).toLocaleString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={createSession}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新建咨询
                  </Button>
                </div>
              </div>
            </aside>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
              <ScrollArea className="flex-1 p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 mb-6">
                      <BrainCircuit className="h-12 w-12 text-primary mx-auto" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">AI 短剧创作顾问</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      基于 NVIDIA Nemotron 3 Ultra 550B A55B 模型，为您提供专业的短剧创作指导。无论是剧本构思、角色塑造、分镜设计还是节奏把控，都能获得专业建议。
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-md">
                      {suggestions.map((s, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          onClick={() => sendMessage(s)}
                          className="h-8"
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'assistant' ? '' : 'flex-row-reverse'}`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium">
                        {message.role === 'assistant' ? (
                          <BrainCircuit className="h-5 w-5 text-primary" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className={`max-w-[70%] ${message.role === 'assistant' ? '' : 'text-right'}`}>
                        <div
                          className={`inline-block px-4 py-2.5 rounded-2xl ${
                            message.role === 'assistant'
                              ? 'bg-muted text-foreground'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 justify-end">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyMessage(message.content, message.id)}
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isSending && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
                      <BrainCircuit className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                    <div className="max-w-[70%]">
                      <div className="inline-block px-4 py-2.5 rounded-2xl bg-muted">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4 bg-background/95 backdrop-blur">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="向 AI 顾问提问... (Enter 发送，Shift+Enter 换行)"
                    className="flex-1 h-10"
                    disabled={isSending}
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={isSending || !input.trim()}
                    className="h-10 px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-md shadow-primary/20"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  模型：nvidia/nemotron-3-ultra-550b-a55b · 数据不上传训练 · 专注短剧创作咨询
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}