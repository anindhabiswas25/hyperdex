'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAdminKey,
  setAdminKey,
  clearAdminKey,
  ADMIN_UNAUTHORIZED_EVENT,
} from '@/lib/adminAuth';

/**
 * Wraps admin pages. Renders a lock screen until a valid-looking admin key is
 * entered; the key is stored in localStorage and sent by adminFetch as the
 * `x-admin-key` header. Re-locks automatically when any admin request returns
 * 401/403 (adminFetch dispatches ADMIN_UNAUTHORIZED_EVENT).
 */
export default function AdminKeyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    setUnlocked(!!getAdminKey());
    setReady(true);

    const onUnauthorized = () => {
      setUnlocked(false);
      setRejected(true);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setAdminKey(trimmed);
    setRejected(false);
    setInput('');
    setUnlocked(true);
  }, [input]);

  const lock = useCallback(() => {
    clearAdminKey();
    setUnlocked(false);
  }, []);

  // Avoid a hydration flash before localStorage is read.
  if (!ready) return null;

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-black/10 shadow-2xl p-8 max-w-md w-full space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted mb-1">Admin</p>
            <h1 className="font-display text-2xl font-bold text-ink leading-none">Enter Admin Key</h1>
            <p className="text-ink-muted text-sm mt-2">
              This key is required to manage makers and applications. It is stored only in your
              browser and sent with each admin request.
            </p>
          </div>

          {rejected && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              Admin key was missing or rejected. Enter the correct key to continue.
            </p>
          )}

          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Admin API key"
            autoFocus
            className="w-full bg-cream border border-black/10 px-3 py-3 text-sm text-ink placeholder-ink-muted/40 outline-none focus:border-black/20 rounded-xl font-mono"
          />

          <button
            onClick={submit}
            disabled={!input.trim()}
            className="w-full py-3 font-display text-sm font-bold bg-navy text-white rounded-xl hover:bg-navy-light transition-colors disabled:opacity-50"
          >
            Unlock Admin
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {children}
      <button
        onClick={lock}
        title="Clear the stored admin key from this browser"
        className="fixed bottom-4 right-4 z-40 text-xs font-semibold text-ink-muted bg-white border border-black/12 px-3 py-1.5 rounded-full shadow-sm hover:text-ink hover:border-black/20 transition-colors"
      >
        Lock admin
      </button>
    </>
  );
}
