'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Bot,
  User,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { apiClient } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────

interface Surrogate {
  id: string;
  roleTitle: string;
  domain: string;
  jurisdiction: string;
  status: string;
}

interface Conversation {
  id: string;
  surrogateId: string;
  userId: string;
  title: string | null;
  status: string;
  surrogateName?: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  surrogateId: string;
  userId: string;
  title: string | null;
  status: string;
  surrogate: {
    id: string;
    roleTitle: string;
    domain: string;
    jurisdiction: string;
  };
  messages: Message[];
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Component ────────────────────────────────────────────────────────

export default function ChatPage() {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [surrogates, setSurrogates] = useState<Surrogate[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Data Fetching ──────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<Conversation>>(
        '/chat/conversations?pageSize=50',
      );
      if (res.success && res.data) {
        setConversations(res.data.data);
      }
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSurrogates = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<Surrogate>>(
        '/surrogates?pageSize=100',
      );
      if (res.success && res.data) {
        setSurrogates(res.data.data.filter((s) => s.status !== 'ARCHIVED'));
      }
    } catch {
      // API may not be running
    }
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const res = await apiClient.get<ConversationDetail>(
        `/chat/conversations/${conversationId}`,
      );
      if (res.success && res.data) {
        setActiveConversation(res.data);
      }
    } catch {
      // Handle error
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchSurrogates();
  }, [fetchConversations, fetchSurrogates]);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Focus input when conversation loads
  useEffect(() => {
    if (activeConversation) {
      inputRef.current?.focus();
    }
  }, [activeConversation?.id]);

  // ── Actions ────────────────────────────────────────────────────────

  const createConversation = async (surrogateId: string) => {
    setCreatingConversation(true);
    try {
      const res = await apiClient.post<Conversation>('/chat/conversations', {
        surrogateId,
      });
      if (res.success && res.data) {
        setShowNewChat(false);
        await fetchConversations();
        await loadConversation(res.data.id);
      }
    } catch {
      // Handle error
    } finally {
      setCreatingConversation(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeConversation || sending) return;

    const content = messageInput.trim();
    setMessageInput('');
    setSending(true);

    // Optimistic update: add user message immediately
    const optimisticUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversation.id,
      role: 'user',
      content,
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    setActiveConversation((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimisticUserMsg] }
        : prev,
    );

    try {
      const res = await apiClient.post<{
        userMessage: Message;
        assistantMessage: Message;
      }>(`/chat/conversations/${activeConversation.id}/messages`, { content });

      if (res.success && res.data) {
        // Replace optimistic message with real ones
        setActiveConversation((prev) => {
          if (!prev) return prev;
          const messagesWithoutOptimistic = prev.messages.filter(
            (m) => m.id !== optimisticUserMsg.id,
          );
          return {
            ...prev,
            messages: [
              ...messagesWithoutOptimistic,
              res.data!.userMessage,
              res.data!.assistantMessage,
            ],
          };
        });
        // Refresh conversation list for updated title/preview
        fetchConversations();
      }
    } catch {
      // Remove optimistic message on error
      setActiveConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== optimisticUserMsg.id),
        };
      });
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await apiClient.delete(`/chat/conversations/${conversationId}`);
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
      }
      fetchConversations();
    } catch {
      // Handle error
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render Helpers ─────────────────────────────────────────────────

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left Panel — Conversation List */}
      <div className="flex w-80 flex-shrink-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Conversations
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNewChat(!showNewChat)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* New Chat Dropdown */}
        {showNewChat && (
          <div className="border-b border-[var(--color-border)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
              Select a surrogate to chat with:
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {surrogates.length === 0 ? (
                <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">
                  No surrogates available. Create one first.
                </p>
              ) : (
                surrogates.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => createConversation(s.id)}
                    disabled={creatingConversation}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
                  >
                    <Bot className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--color-text-primary)]">
                        {s.roleTitle}
                      </p>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {s.domain} &middot; {s.jurisdiction}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <MessageSquare className="mb-3 h-8 w-8 text-[var(--color-text-muted)]" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                No conversations yet
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Start a new chat with a surrogate
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="group relative"
                >
                  <button
                    onClick={() => loadConversation(conv.id)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      activeConversation?.id === conv.id
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'hover:bg-[var(--color-bg-elevated)]'
                    }`}
                  >
                    <Bot
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        activeConversation?.id === conv.id
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-text-muted)]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {conv.surrogateName ?? 'Surrogate'}
                        </p>
                        <span className="flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">
                          {formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                        {conv.lastMessage ?? conv.title ?? 'New conversation'}
                      </p>
                    </div>
                  </button>
                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="absolute right-2 top-2 hidden rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Active Chat */}
      <div className="flex flex-1 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        {!activeConversation ? (
          // Empty state
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-bg-elevated)]">
              <MessageSquare className="h-8 w-8 text-[var(--color-text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Start a conversation
            </h3>
            <p className="mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">
              Select an existing conversation or start a new one by clicking the + button and choosing a surrogate.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                <Bot className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {activeConversation.surrogate.roleTitle}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {activeConversation.surrogate.domain} &middot;{' '}
                  {activeConversation.surrogate.jurisdiction}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {activeConversation.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Bot className="mb-3 h-10 w-10 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Start the conversation by typing a message below.
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {activeConversation.surrogate.roleTitle} is ready to help.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                          msg.role === 'user'
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {msg.content}
                        </p>
                        <p
                          className={`mt-1 text-[10px] ${
                            msg.role === 'user'
                              ? 'text-white/60'
                              : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {sending && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-xl bg-[var(--color-bg-elevated)] px-4 py-3">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: '0ms' }} />
                          <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: '150ms' }} />
                          <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-[var(--color-border)] px-5 py-3">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeConversation.surrogate.roleTitle}...`}
                  rows={1}
                  className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  style={{
                    height: 'auto',
                    minHeight: '40px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || sending}
                  size="md"
                  className="flex-shrink-0 rounded-xl px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
