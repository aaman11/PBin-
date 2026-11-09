import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Terminal,
  Clock,
  Eye,
  AlertTriangle,
  ArrowLeft,
  Share2,
  WrapText,
  FileCode,
  ShieldAlert,
} from 'lucide-react';
import { copyToClipboard, downloadText, formatRemainingTime, formatTimeAgo } from '../lib/utils.ts';
import { Paste } from '../types.ts';

interface ViewPasteViewProps {
  slug: string;
  onNavigateHome: () => void;
}

export const ViewPasteView: React.FC<ViewPasteViewProps> = ({ slug, onNavigateHome }) => {
  const [paste, setPaste] = useState<Paste | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<{
    code: number;
    message: string;
    reason?: string;
  } | null>(null);

  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [remainingTimeInfo, setRemainingTimeInfo] = useState<{ text: string; isExpired: boolean }>({
    text: '',
    isExpired: false,
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorStatus(null);

    fetch(`/api/pastes/${slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok) {
          setErrorStatus({
            code: res.status,
            message: data.error || 'Paste not found or has expired.',
            reason: data.reason,
          });
          setPaste(null);
        } else {
          setPaste(data);
          setErrorStatus(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorStatus({
          code: 500,
          message: 'Failed to fetch paste. Please check your network connection.',
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Live timer tick for remaining time
  useEffect(() => {
    if (!paste?.expires_at) return;

    const updateTimer = () => {
      setRemainingTimeInfo(formatRemainingTime(paste.expires_at));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [paste?.expires_at]);

  const handleCopyContent = async () => {
    if (!paste) return;
    const ok = await copyToClipboard(paste.content);
    if (ok) {
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  const handleCopyUrl = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!paste) return;
    downloadText(`paste-${paste.slug}.txt`, paste.content);
  };

  // Loading State
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm space-y-4 animate-pulse">
        <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
        <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-1/4"></div>
        <div className="h-64 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg"></div>
      </div>
    );
  }

  // Error / Unavailable State
  if (errorStatus) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          {errorStatus.reason === 'view_limit_exceeded' ? (
            <ShieldAlert className="w-8 h-8" />
          ) : errorStatus.reason === 'expired' ? (
            <Clock className="w-8 h-8" />
          ) : (
            <AlertTriangle className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-2">
          <div className="inline-block px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            HTTP 404 • {errorStatus.reason ? errorStatus.reason.replace(/_/g, ' ') : 'NOT FOUND'}
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {errorStatus.reason === 'view_limit_exceeded'
              ? 'Paste View Limit Reached'
              : errorStatus.reason === 'expired'
              ? 'Paste Has Expired'
              : 'Paste Unavailable'}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {errorStatus.message}
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Create a New Paste
          </button>
        </div>
      </div>
    );
  }

  if (!paste) return null;

  const lines = paste.content.split('\n');

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Paste Info */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onNavigateHome}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors mr-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Home
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700/60">
                {paste.slug}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Created {formatTimeAgo(paste.created_at)}
              </span>
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {/* TTL pill */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                  paste.expires_at
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60'
                }`}
                title={paste.expires_at ? `Expires at ${new Date(paste.expires_at).toUTCString()}` : 'Never expires'}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{paste.expires_at ? remainingTimeInfo.text : 'No Expiry'}</span>
              </div>

              {/* Views pill */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                  paste.max_views !== null
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>
                  {paste.max_views !== null
                    ? `View ${paste.view_count} of ${paste.max_views} (${paste.remaining_views ?? 0} remaining)`
                    : `${paste.view_count} views (Unlimited)`}
                </span>
              </div>

              {/* Lines & size */}
              <span className="text-zinc-400 dark:text-zinc-600 hidden sm:inline">•</span>
              <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                {lines.length} lines • {paste.content.length} chars
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800">
            {/* Wrap text toggle */}
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                wordWrap
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
              title="Toggle Word Wrap"
            >
              <WrapText className="w-4 h-4" />
            </button>

            {/* Copy Content */}
            <button
              onClick={handleCopyContent}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              {copiedContent ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Content</span>
                </>
              )}
            </button>

            {/* Copy Share URL */}
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors"
              title="Download text file"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Raw Link */}
            <a
              href={`/api/pastes/${paste.slug}/raw`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Raw</span>
            </a>
          </div>
        </div>
      </div>

      {/* Content Display Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex font-mono text-sm leading-6">
          {/* Line Numbers Gutter */}
          <div
            className="w-12 select-none py-4 text-right pr-3 text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-950/60 border-r border-zinc-200 dark:border-zinc-800/80 font-mono text-xs overflow-hidden shrink-0"
            aria-hidden="true"
          >
            {lines.map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Stored Content */}
          <div className="flex-1 p-4 overflow-x-auto">
            <pre
              className={`font-mono text-zinc-900 dark:text-zinc-100 leading-6 ${
                wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
              }`}
            >
              {paste.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
