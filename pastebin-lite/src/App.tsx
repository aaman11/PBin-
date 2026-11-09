import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { CreatePasteView } from './components/CreatePasteView.tsx';
import { ViewPasteView } from './components/ViewPasteView.tsx';
import { RecentPastes } from './components/RecentPastes.tsx';
import { ApiDocsModal } from './components/ApiDocsModal.tsx';
import { ApiHealthResponse, Paste } from './types.ts';
import { auth } from './lib/firebase.ts';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  const [health, setHealth] = useState<ApiHealthResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isApiDocsOpen, setIsApiDocsOpen] = useState(false);
  const [refreshRecentTrigger, setRefreshRecentTrigger] = useState(0);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Handle browser popstate navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Monitor Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Check backend & DB health
  useEffect(() => {
    const fetchHealth = () => {
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setHealth(data))
        .catch(() =>
          setHealth({
            status: 'unhealthy',
            database: 'disconnected',
            timestamp: new Date().toISOString(),
          })
        );
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 25000);
    return () => clearInterval(interval);
  }, []);

  // Navigate helper
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePasteCreated = (_paste: Paste) => {
    setRefreshRecentTrigger((prev) => prev + 1);
  };

  // Extract slug from URL if pathname is /p/:slug or /:slug
  const getSlugFromPath = (path: string): string | null => {
    const pMatch = path.match(/^\/p\/([a-zA-Z0-9_-]+)/);
    if (pMatch) return pMatch[1];
    const directMatch = path.match(/^\/([a-zA-Z0-9_-]{6,12})$/);
    if (directMatch && directMatch[1] !== 'api') return directMatch[1];
    return null;
  };

  const currentSlug = getSlugFromPath(currentPath);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        health={health}
        onOpenApiDocs={() => setIsApiDocsOpen(true)}
        onNavigateHome={() => navigateTo('/')}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        {currentSlug ? (
          <ViewPasteView
            slug={currentSlug}
            onNavigateHome={() => navigateTo('/')}
          />
        ) : (
          <>
            {/* Intro Hero banner */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
                Pastebin Lite
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
                Lightweight, privacy-focused pastebin built for the Aganitha Take-Home
                Evaluation. Create plain text pastes with optional TTL expiration, atomic view
                limits, and persistent PostgreSQL storage.
              </p>
            </div>

            {/* Create Paste View */}
            <CreatePasteView
              onPasteCreated={handlePasteCreated}
              onOpenPaste={(slug) => navigateTo(`/p/${slug}`)}
            />

            {/* Recent Pastes in Session */}
            <RecentPastes
              onOpenPaste={(slug) => navigateTo(`/p/${slug}`)}
              refreshTrigger={refreshRecentTrigger}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Pastebin Lite • Aganitha Full Stack Assignment (2026)
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsApiDocsOpen(true)}
              className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              API Reference
            </button>
            <span>•</span>
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              /api/health
            </a>
          </div>
        </div>
      </footer>

      {/* API Documentation Modal */}
      <ApiDocsModal
        isOpen={isApiDocsOpen}
        onClose={() => setIsApiDocsOpen(false)}
      />
    </div>
  );
}
