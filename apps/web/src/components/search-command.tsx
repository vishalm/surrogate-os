'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bot,
  GitBranch,
  Brain,
  X,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────

interface SearchResult {
  entityType: 'surrogate' | 'sop' | 'memory';
  id: string;
  title: string;
  subtitle: string | null;
}

// ── Helpers ────────────────────────────────────────────────

const ENTITY_CONFIG: Record<string, { icon: typeof Bot; label: string; color: string; href: (id: string) => string }> = {
  surrogate: {
    icon: Bot,
    label: 'Surrogate',
    color: 'bg-emerald-500/15 text-emerald-400',
    href: (id) => `/surrogates/${id}`,
  },
  sop: {
    icon: GitBranch,
    label: 'SOP',
    color: 'bg-blue-500/15 text-blue-400',
    href: (id) => `/sops/${id}`,
  },
  memory: {
    icon: Brain,
    label: 'Memory',
    color: 'bg-violet-500/15 text-violet-400',
    href: (id) => `/memory/${id}`,
  },
};

const RECENT_SEARCHES_KEY = 'sos_recent_searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined') return;
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  );
}

// ── Component ──────────────────────────────────────────────

interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
}

export function SearchCommand({ open, onClose }: SearchCommandProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<SearchResult[]>(
        `/activity/search?q=${encodeURIComponent(q.trim())}`,
      );
      if (res.success && res.data) {
        setResults(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  function handleSelect(result: SearchResult) {
    saveRecentSearch(query.trim());
    const config = ENTITY_CONFIG[result.entityType];
    if (config) {
      router.push(config.href(result.id));
    }
    onClose();
  }

  function handleRecentClick(search: string) {
    setQuery(search);
    doSearch(search);
  }

  if (!open) return null;

  // Group results by entity type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.entityType]) acc[r.entityType] = [];
    acc[r.entityType].push(r);
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="h-4.5 w-4.5 flex-shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search surrogates, SOPs, memory..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
          )}

          {/* Results */}
          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && Object.keys(grouped).length > 0 && (
            <div className="py-2">
              {Object.entries(grouped).map(([type, items]) => {
                const config = ENTITY_CONFIG[type];
                if (!config) return null;
                return (
                  <div key={type}>
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {config.label}s
                    </p>
                    {items.map((item) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={`${item.entityType}-${item.id}`}
                          onClick={() => handleSelect(item)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-elevated)]"
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="truncate text-xs text-[var(--color-text-muted)]">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                          <span className="flex-shrink-0 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                            {config.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Searches (shown when empty) */}
          {!loading && query.trim().length === 0 && recentSearches.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Recent Searches
              </p>
              {recentSearches.map((search) => (
                <button
                  key={search}
                  onClick={() => handleRecentClick(search)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-elevated)]"
                >
                  <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {search}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state when no recents and no query */}
          {!loading && query.trim().length === 0 && recentSearches.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              Start typing to search across the platform
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
          <span>
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-1 py-0.5 font-mono">
              Enter
            </kbd>{' '}
            to select
          </span>
          <span>
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-1 py-0.5 font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </>
  );
}
