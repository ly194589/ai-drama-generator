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
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false); // 移动端显示会话列表
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
      
      // 如果有会话，默认选择最近的一个
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
      const response = await fetch(`/api/chat/sessions/${sessionId}`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 切换会话时加载消息
  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id);
    } else {
      setMessages([]);
    }
  }, [currentSession, loadMessages]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 创建新会话
  const createSession = async () => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话' })
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
    if (!confirm('确定删除这个对话吗？')) return;
    
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(sessions.find(s => s.id !== sessionId) || null);
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 保存消息
  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!currentSession) return null;
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: currentSession.id, 
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

    // 如果没有当前会话，先创建一个
    let sessionId = currentSession?.id;
    if (!sessionId) {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text.slice(0, 50) }) // 增加到50字符
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

    // 保存用户消息
    const savedUserMessage = await saveMessage('user', text);
    if (savedUserMessage) {
      setMessages(prev => [...prev, savedUserMessage as Message]);
    }

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

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

      // 保存AI回复
      if (assistantContent && sessionId) {
        const savedAssistantMessage = await saveMessage('assistant', assistantContent);
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

      // 更新会话标题（如果是第一条消息）
      if (messages.length === 0 && text) {
        setSessions(prev => 
          prev.map(s => 
            s.id === sessionId 
              ? { ...s, title: text.slice(0, 50) } // 增加到50字符
              : s
          )
        );
      }
    } catch (error) {
      console.error('发送失败:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，发生了错误，请重试。',
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

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Header */}
        {/* Hero Header with Aurora Gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 p-6 mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-pink-300/30 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* 移动端菜单按钮 */}
              <Button
                variant="secondary"
                size="sm"
                className="lg:hidden bg-white/20 hover:bg-white/30 text-white border-white/30"
                onClick={() => setShowSessions(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">AI 短剧顾问</h1>
                <p className="text-white/80 mt-1 text-sm sm:text-base">
                  对话记录自动保存，随时回顾
                </p>
              </div>
            </div>
            <Button onClick={createSession} size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
              <Plus className="h-4 w-4 mr-2" />
              新对话
            </Button>
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* 移动端侧边栏遮罩 */}
          {showSessions && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowSessions(false)}
            />
          )}

          {/* Sessions List */}
          <div className={`
            fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
            w-72 lg:w-64 transform transition-transform duration-300
            ${showSessions ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:block
          `}>
            <div className="glass-card h-full rounded-none lg:rounded-lg border-r lg:border border-white/20 bg-white/10 backdrop-blur-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex flex-row items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-pink-600" />
                  历史对话
                </h2>
                {/* 移动端关闭按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 lg:hidden"
                  onClick={() => setShowSessions(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-12rem)] lg:h-[calc(100%-4.5rem)]">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      暂无对话记录
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-3 rounded-lg cursor-pointer group transition-colors ${
                            currentSession?.id === session.id
                              ? 'bg-gradient-to-r from-pink-500/20 to-fuchsia-500/20 border border-pink-500/30'
                              : 'hover:bg-white/10 border border-transparent'
                          }`}
                          onClick={() => {
                            setCurrentSession(session);
                            setShowSessions(false); // 移动端点击后关闭侧边栏
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2 break-all">
                                {session.title}
                              </p>
                              <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(session.updated_at)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 ${
                                currentSession?.id === session.id
                                  ? 'text-pink-600 hover:text-pink-700'
                                  : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="glass-card flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl">
              <div className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollRef}>
                  {!currentSession && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 min-h-[300px]">
                      <div className="p-4 rounded-full bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20 mb-4">
                        <Bot className="h-8 w-8 text-pink-600" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">AI 短剧顾问已就绪</h3>
                      <p className="text-muted-foreground max-w-md">
                        询问任何关于短剧创作的问题，包括剧本创意、角色设计、
                        分镜技巧、节奏把控、提示词优化等。
                      </p>
                      <Button onClick={createSession} className="mt-4 bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-600 hover:to-fuchsia-600">
                        <Plus className="h-4 w-4 mr-2" />
                        开始新对话
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 min-h-[300px]">
                      <p className="text-muted-foreground">发送消息开始对话</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            'flex gap-3',
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {message.role === 'assistant' && (
                            <div className="p-2 rounded-full bg-primary/10 h-fit flex-shrink-0">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={cn(
                              'max-w-[80%] rounded-lg p-3',
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            <div className="whitespace-pre-wrap text-sm break-words">
                              {message.content || (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                            </div>
                            {message.role === 'assistant' && message.content && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(message.created_at)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => copyMessage(message.content, message.id)}
                                >
                                  {copiedId === message.id ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          {message.role === 'user' && (
                            <div className="p-2 rounded-full bg-secondary h-fit flex-shrink-0">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="输入你的问题..."
                      disabled={isSending}
                      className="flex-1 bg-white/10 border-white/20"
                    />
                    <Button type="submit" disabled={isSending || !input.trim()} className="bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-600 hover:to-fuchsia-600">
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div className="mt-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">快捷提问</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => sendMessage(suggestion)}
                    disabled={isSending}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
