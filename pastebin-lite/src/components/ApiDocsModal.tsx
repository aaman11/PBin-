import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Code2, Server } from 'lucide-react';
import { copyToClipboard } from '../lib/utils.ts';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<ApiDocsModalProps> = ({ isOpen, onClose }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const origin = window.location.origin;

  const endpoints = [
    {
      id: 'create',
      method: 'POST',
      path: '/api/pastes',
      desc: 'Create a new paste with optional TTL and maximum views.',
      curl: `curl -X POST ${origin}/api/pastes \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Hello World from cURL!",
    "ttl_seconds": 3600,
    "max_views": 5
  }'`,
      response: `{
  "id": 1,
  "slug": "xK9_mQ2a",
  "url": "${origin}/p/xK9_mQ2a",
  "content": "Hello World from cURL!",
  "created_at": "2026-11-08T21:40:00.000Z",
  "expires_at": "2026-11-08T22:40:00.000Z",
  "max_views": 5,
  "view_count": 0,
  "ttl_seconds": 3600
}`,
    },
    {
      id: 'get',
      method: 'GET',
      path: '/api/pastes/:slug',
      desc: 'Retrieve an existing paste. Atomically increments view count and enforces TTL and view limit.',
      curl: `curl -s ${origin}/api/pastes/xK9_mQ2a`,
      response: `{
  "id": 1,
  "slug": "xK9_mQ2a",
  "content": "Hello World from cURL!",
  "created_at": "2026-11-08T21:40:00.000Z",
  "expires_at": "2026-11-08T22:40:00.000Z",
  "max_views": 5,
  "view_count": 1,
  "remaining_views": 4
}`,
    },
    {
      id: 'raw',
      method: 'GET',
      path: '/api/pastes/:slug/raw',
      desc: 'Retrieve raw text content directly (returns text/plain header).',
      curl: `curl -s ${origin}/api/pastes/xK9_mQ2a/raw`,
      response: `Hello World from cURL!`,
    },
    {
      id: 'health',
      method: 'GET',
      path: '/api/health',
      desc: 'Check API and PostgreSQL connectivity health.',
      curl: `curl -s ${origin}/api/health`,
      response: `{
  "status": "healthy",
  "database": "connected",
  "latency_ms": 12,
  "timestamp": "2026-11-08T21:40:00.000Z"
}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 font-mono text-base">
                REST API Documentation
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Aganitha Full Stack Assignment Evaluation Endpoints
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      ep.method === 'POST'
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {ep.path}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400">{ep.desc}</p>

              {/* cURL Example */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Example cURL Request:</span>
                  <button
                    onClick={() => handleCopy(ep.id + '-curl', ep.curl)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1"
                  >
                    {copiedId === ep.id + '-curl' ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === ep.id + '-curl' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs overflow-x-auto leading-5">
                  {ep.curl}
                </pre>
              </div>

              {/* Response Example */}
              <div className="space-y-1">
                <div className="text-[11px] font-mono text-zinc-500">Response:</div>
                <pre className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 font-mono text-xs overflow-x-auto leading-5">
                  {ep.response}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>PostgreSQL • Atomic Increment • UTC Timestamps</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
