import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Eye,
  Send,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Flame,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { copyToClipboard } from '../lib/utils.ts';
import { Paste, StoredPasteMeta } from '../types.ts';

interface CreatePasteViewProps {
  onPasteCreated: (paste: Paste) => void;
  onOpenPaste: (slug: string) => void;
}

const TTL_PRESETS = [
  { label: 'Never', value: null },
  { label: '10 min', value: 600 },
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: 'Custom', value: 'custom' },
];

const MAX_VIEWS_PRESETS = [
  { label: 'Unlimited', value: null, icon: null },
  { label: '1 View (Burn)', value: 1, icon: Flame },
  { label: '5 Views', value: 5, icon: null },
  { label: '10 Views', value: 10, icon: null },
  { label: 'Custom', value: 'custom', icon: null },
];

export const CreatePasteView: React.FC<CreatePasteViewProps> = ({
  onPasteCreated,
  onOpenPaste,
}) => {
  const [content, setContent] = useState('');
  const [selectedTtl, setSelectedTtl] = useState<number | string | null>(null);
  const [customTtlSeconds, setCustomTtlSeconds] = useState<string>('300');
  const [selectedMaxViews, setSelectedMaxViews] = useState<number | string | null>(null);
  const [customMaxViews, setCustomMaxViews] = useState<string>('3');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdPaste, setCreatedPaste] = useState<Paste | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Line numbers calculation
  const linesCount = content ? content.split('\n').length : 1;
  const charsCount = content.length;

  // Handle Tab key inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      setContent((prev) => prev.substring(0, start) + '  ' + prev.substring(end));

      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setErrorMessage('Please enter some text content for your paste.');
      textareaRef.current?.focus();
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    let ttl: number | null = null;
    if (selectedTtl === 'custom') {
      const parsed = parseInt(customTtlSeconds, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setErrorMessage('Custom TTL must be a positive integer in seconds.');
        setIsLoading(false);
        return;
      }
      ttl = parsed;
    } else if (typeof selectedTtl === 'number') {
      ttl = selectedTtl;
    }

    let maxViews: number | null = null;
    if (selectedMaxViews === 'custom') {
      const parsed = parseInt(customMaxViews, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setErrorMessage('Custom Maximum Views must be an integer greater than 0.');
        setIsLoading(false);
        return;
      }
      maxViews = parsed;
    } else if (typeof selectedMaxViews === 'number') {
      maxViews = selectedMaxViews;
    }

    try {
      const res = await fetch('/api/pastes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          ttl_seconds: ttl,
          max_views: maxViews,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create paste.');
      }

      setCreatedPaste(data);
      onPasteCreated(data);

      // Save to local history
      try {
        const stored: StoredPasteMeta[] = JSON.parse(
          localStorage.getItem('pastebin_recent_pastes') || '[]'
        );
        const newEntry: StoredPasteMeta = {
          slug: data.slug,
          url: data.url,
          snippet: content.slice(0, 100),
          created_at: data.created_at,
          expires_at: data.expires_at,
          max_views: data.max_views,
        };
        const updated = [newEntry, ...stored.filter((p) => p.slug !== data.slug)].slice(0, 20);
        localStorage.setItem('pastebin_recent_pastes', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save to localStorage', e);
      }
    } catch (err: any) {
      console.error('Create error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!createdPaste?.url) return;
    const ok = await copyToClipboard(createdPaste.url);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleCopyCurl = async () => {
    if (!createdPaste) return;
    const curlCommand = `curl -s ${window.location.origin}/api/pastes/${createdPaste.slug}/raw`;
    const ok = await copyToClipboard(curlCommand);
    if (ok) {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  const handleReset = () => {
    setContent('');
    setCreatedPaste(null);
    setErrorMessage(null);
    setCopiedUrl(false);
    setSelectedTtl(null);
    setSelectedMaxViews(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="space-y-6">
      {/* Creation Success Modal / Banner */}
      {createdPaste ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 shadow-sm transition-all animate-in fade-in zoom-in-95">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  Paste created successfully!
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono font-normal">
                    /{createdPaste.slug}
                  </span>
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Your paste is stored in PostgreSQL and accessible via the unique shareable URL
                  below.
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Paste
            </button>
          </div>

          {/* Shareable URL input and action */}
          <div className="mt-5 space-y-3">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-mono">
              Shareable URL
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={createdPaste.url}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm font-mono bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyUrl}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy URL
                    </>
                  )}
                </button>

                <button
                  onClick={() => onOpenPaste(createdPaste.slug)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Paste
                </button>
              </div>
            </div>

            {/* Quick CLI command */}
            <div className="mt-3 p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 overflow-hidden text-zinc-600 dark:text-zinc-400">
                <Terminal className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">
                  curl -s {window.location.origin}/api/pastes/{createdPaste.slug}/raw
                </span>
              </div>
              <button
                onClick={handleCopyCurl}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 ml-2 shrink-0 flex items-center gap-1"
                title="Copy curl command"
              >
                {copiedCurl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="text-[11px]">{copiedCurl ? 'Copied' : 'cURL'}</span>
              </button>
            </div>

            {/* Expiration badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-zinc-200/60 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60">
                TTL:{' '}
                {createdPaste.expires_at
                  ? new Date(createdPaste.expires_at).toLocaleString()
                  : 'Never expires'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-200/60 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60">
                View Limit:{' '}
                {createdPaste.max_views !== null
                  ? `${createdPaste.max_views} max views`
                  : 'Unlimited views'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                Status: Active
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Editor Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-colors">
        {/* Editor Top Bar */}
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              New Paste
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="text-zinc-500 font-mono">Plain Text / Code</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-zinc-500 dark:text-zinc-400">
            <span>{linesCount} lines</span>
            <span>{charsCount} chars</span>
            {content && (
              <button
                onClick={() => setContent('')}
                className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-1"
                title="Clear content"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Textarea with Line Numbers */}
        <div className="relative flex min-h-[340px] bg-white dark:bg-zinc-900 font-mono text-sm leading-6">
          {/* Line Numbers Gutter */}
          <div
            className="w-12 select-none py-3 text-right pr-3 text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-950/60 border-r border-zinc-200 dark:border-zinc-800/80 font-mono text-xs overflow-hidden"
            aria-hidden="true"
          >
            {Array.from({ length: Math.max(1, linesCount) }).map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Actual Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste or type your code, logs, notes, or plain text here... (Ctrl+Enter to create)"
            className="flex-1 p-3 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none resize-y min-h-[340px] font-mono text-sm leading-6 whitespace-pre"
            spellCheck={false}
          />
        </div>

        {/* Expiration & Limits Control Panel */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TTL Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Time-to-Live (TTL Expiration)
              </label>

              <div className="flex flex-wrap gap-1.5">
                {TTL_PRESETS.map((p) => {
                  const isSelected = selectedTtl === p.value;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSelectedTtl(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/60'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {selectedTtl === 'custom' && (
                <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                  <input
                    type="number"
                    min="1"
                    value={customTtlSeconds}
                    onChange={(e) => setCustomTtlSeconds(e.target.value)}
                    placeholder="Seconds (e.g. 300)"
                    className="w-36 px-3 py-1.5 rounded-lg text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-zinc-500 font-mono">
                    seconds (≈ {Math.round(parseInt(customTtlSeconds || '0', 10) / 60)} min)
                  </span>
                </div>
              )}
            </div>

            {/* Max Views Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Maximum Views (Self-Destruct Limit)
              </label>

              <div className="flex flex-wrap gap-1.5">
                {MAX_VIEWS_PRESETS.map((p) => {
                  const isSelected = selectedMaxViews === p.value;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSelectedMaxViews(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/60'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3 text-amber-300" />}
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {selectedMaxViews === 'custom' && (
                <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                  <input
                    type="number"
                    min="1"
                    value={customMaxViews}
                    onChange={(e) => setCustomMaxViews(e.target.value)}
                    placeholder="Max views (e.g. 5)"
                    className="w-36 px-3 py-1.5 rounded-lg text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-zinc-500 font-mono">views allowed</span>
                </div>
              )}
            </div>
          </div>

          {/* Validation Error Alert */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-400 font-mono animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Atomic race-condition safe view counter</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !content.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/30"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Storing in DB...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Create Paste</span>
                    <span className="hidden sm:inline-block text-[11px] font-normal px-1.5 py-0.5 rounded bg-emerald-700/80 text-emerald-100">
                      Ctrl+Enter
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
