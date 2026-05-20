'use client';

// Backward-compat re-export — all consumers (maker page, etc.) keep working.
// The wallet store is now the single source of truth.
export { useWallet } from '@/store/walletStore';
