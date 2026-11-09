import React from 'react';
import {
  FileText,
  Activity,
  Code2,
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Terminal,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { ApiHealthResponse } from '../types.ts';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  health: ApiHealthResponse | null;
  onOpenApiDocs: () => void;
  onNavigateHome: () => void;
  currentUser: User | null;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  health,
  onOpenApiDocs,
  onNavigateHome,
  currentUser,
}) => {
  const [authLoading, setAuthLoading] = React.useState(false);

  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
            title="Pastebin Lite Home"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:bg-emerald-500 transition-colors">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
                  Pastebin<span className="text-emerald-600 dark:text-emerald-400">Lite</span>
                </span>
                <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 font-mono">
                  Aganitha 2026
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
                PostgreSQL • Atomic Views • Ephemeral TTL
              </p>
            </div>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Health indicator */}
          <div
            className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono border ${
              isHealthy
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
            }`}
            title={
              isHealthy
                ? `PostgreSQL connected (${health?.latency_ms ?? 0}ms)`
                : 'Checking PostgreSQL status...'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{isHealthy ? `PostgreSQL OK (${health?.latency_ms}ms)` : 'Connecting DB'}</span>
          </div>

          {/* API Docs Button */}
          <button
            onClick={onOpenApiDocs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">REST</span> API
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Sign In / Profile */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-1 border-l border-zinc-200 dark:border-zinc-800">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-zinc-300 dark:border-zinc-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
                  {currentUser.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={authLoading}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>{authLoading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
