'use client';

import { useEffect } from 'react';
import type { ToastState } from '@/lib/types';

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
  durationMs?: number;
}

export default function Toast({ toast, onDismiss, durationMs = 5000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [toast, durationMs, onDismiss]);

  if (!toast) return null;

  const colors = {
    success: 'border-cyan-500/40 bg-cyan-500/10',
    error: 'border-red-500/40 bg-red-500/10',
    info: 'border-white/20 bg-white/5',
  };

  const icons = {
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00FFD1" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF4D4D" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0F0F0" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9998] max-w-sm w-full animate-in">
      <div className={`border ${colors[toast.type]} backdrop-blur-sm p-4 flex items-start gap-3`}>
        <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
        <p className="text-sm text-white leading-relaxed flex-1">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="text-muted hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
