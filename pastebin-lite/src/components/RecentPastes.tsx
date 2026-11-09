import React, { useState, useEffect } from 'react';
import { History, ExternalLink, Trash2, Clock, Eye } from 'lucide-react';
import { StoredPasteMeta } from '../types.ts';
import { formatTimeAgo, formatRemainingTime } from '../lib/utils.ts';

interface RecentPastesProps {
  onOpenPaste: (slug: string) => void;
  refreshTrigger: number;
}

export const RecentPastes: React.FC<RecentPastesProps> = ({
  onOpenPaste,
  refreshTrigger,
}) => {
  const [pastes, setPastes] = useState<StoredPasteMeta[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pastebin_recent_pastes');
      if (stored) {
        setPastes(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not read recent pastes from localStorage', e);
    }
  }, [refreshTrigger]);

  const handleClearHistory = () => {
    localStorage.removeItem('pastebin_recent_pastes');
    setPastes([]);
  };

  if (pastes.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
          <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Recently Created in this Session ({pastes.length})</span>
        </div>
        <button
          onClick={handleClearHistory}
          className="text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 font-mono"
          title="Clear recent history"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pastes.map((p) => {
          const ttlStatus = formatRemainingTime(p.expires_at);

          return (
            <div
              key={p.slug}
              onClick={() => onOpenPaste(p.slug)}
              className="group p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-900 cursor-pointer transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  /{p.slug}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {formatTimeAgo(p.created_at)}
                </span>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 font-mono break-all">
                {p.snippet || '(empty)'}
              </p>

              <div className="flex items-center gap-2 pt-1 text-[10px] text-zinc-500 font-mono border-t border-zinc-200/60 dark:border-zinc-800/60">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {ttlStatus.isExpired ? 'Expired' : p.expires_at ? ttlStatus.text : 'No TTL'}
                </span>
                {p.max_views !== null && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5" />
                    {p.max_views} max
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
