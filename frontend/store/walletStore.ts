'use client';

import { create } from 'zustand';
import { ADMIN_WALLET_ADDRESS, TESTNET_PASSPHRASE } from '@/lib/constants/wallet';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isAdmin: boolean;
  isMaker: boolean;
  isWrongNetwork: boolean;
  showFreighterModal: boolean;
  xlmBalance: string | null;
  error: string | null;

  connect: () => Promise<{ address: string; isAdmin: boolean }>;
  disconnect: () => void;
  checkIfMaker: (address: string) => Promise<boolean>;
  fetchXlmBalance: (address: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  dismissFreighterModal: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  isConnected: false,
  isConnecting: false,
  isAdmin: false,
  isMaker: false,
  isWrongNetwork: false,
  showFreighterModal: false,
  xlmBalance: null,
  error: null,

  connect: async () => {
    set({ isConnecting: true, error: null, isWrongNetwork: false, showFreighterModal: false });

    try {
      const {
        isConnected: freighterIsConnected,
        setAllowed,
        getNetworkDetails,
      } = await import('@stellar/freighter-api');

      // Detect if Freighter is installed
      let installed = false;
      try {
        await freighterIsConnected();
        installed = true;
      } catch {
        installed = false;
      }

      if (!installed) {
        set({ isConnecting: false, showFreighterModal: true });
        throw new Error('freighter_not_installed');
      }

      // Request permission — opens Freighter popup
      await setAllowed();

      // Use getPublicKey (more reliable than getAddress in v1.7.1)
      const { getPublicKey } = await import('@stellar/freighter-api');
      let address: string;
      try {
        address = await getPublicKey();
      } catch (e: unknown) {
        // User cancelled
        set({ isConnecting: false });
        throw new Error('user_cancelled');
      }

      if (!address) {
        set({ isConnecting: false });
        throw new Error('user_cancelled');
      }

      // Network check
      try {
        const networkDetails = await getNetworkDetails();
        if (networkDetails.networkPassphrase !== TESTNET_PASSPHRASE) {
          set({ isConnecting: false, isWrongNetwork: true });
          throw new Error('wrong_network');
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'wrong_network') throw e;
        // getNetworkDetails failed — non-fatal, continue
      }

      const isAdmin = address === ADMIN_WALLET_ADDRESS;

      // Check if maker (skip for admin)
      let isMaker = false;
      if (!isAdmin) {
        isMaker = await get().checkIfMaker(address);
      }

      // Fetch XLM balance in background (non-blocking)
      get().fetchXlmBalance(address);

      set({
        address,
        isConnected: true,
        isConnecting: false,
        isAdmin,
        isMaker,
        error: null,
      });

      return { address, isAdmin };

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to connect';
      const silent = ['user_cancelled', 'wrong_network', 'freighter_not_installed'].includes(msg);
      if (!silent) {
        set({ isConnecting: false, error: msg });
      }
      throw error;
    }
  },

  disconnect: () => {
    set({
      address: null,
      isConnected: false,
      isAdmin: false,
      isMaker: false,
      isWrongNetwork: false,
      xlmBalance: null,
      error: null,
    });
  },

  checkIfMaker: async (address: string): Promise<boolean> => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
      const res = await fetch(`${backendUrl}/api/makers/${address}/status`);
      if (res.status === 404) return false;
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  },

  fetchXlmBalance: async (address: string) => {
    try {
      const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
      if (!res.ok) { set({ xlmBalance: '0.00' }); return; }
      const data = await res.json();
      const xlmEntry = data.balances?.find((b: { asset_type: string; balance: string }) => b.asset_type === 'native');
      set({ xlmBalance: xlmEntry ? parseFloat(xlmEntry.balance).toFixed(2) : '0.00' });
    } catch {
      set({ xlmBalance: '0.00' });
    }
  },

  restoreSession: async () => {
    if (typeof window === 'undefined') return;
    try {
      const { isAllowed, getPublicKey, getNetworkDetails } = await import('@stellar/freighter-api');
      const allowed = await isAllowed();
      if (!allowed) return;

      const address = await getPublicKey();
      if (!address) return;

      // Network check
      try {
        const networkDetails = await getNetworkDetails();
        if (networkDetails.networkPassphrase !== TESTNET_PASSPHRASE) {
          set({ isWrongNetwork: true });
          return;
        }
      } catch {
        // non-fatal
      }

      const isAdmin = address === ADMIN_WALLET_ADDRESS;
      const isMaker = !isAdmin
        ? await useWalletStore.getState().checkIfMaker(address)
        : false;
      useWalletStore.getState().fetchXlmBalance(address);

      set({ address, isConnected: true, isAdmin, isMaker, isWrongNetwork: false });
    } catch {
      // Not connected — fine
    }
  },

  dismissFreighterModal: () => set({ showFreighterModal: false }),
}));

// Convenience selectors — drop-in replacements for old hooks
export const useWallet = () => useWalletStore();
export const useIsAdmin = () => useWalletStore(s => s.isAdmin);
export const useIsMaker = () => useWalletStore(s => s.isMaker);
