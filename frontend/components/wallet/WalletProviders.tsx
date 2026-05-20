'use client';

import { useEffect } from 'react';
import { useWalletStore } from '@/store/walletStore';
import WrongNetworkBanner from '@/components/wallet/WrongNetworkBanner';
import FreighterNotInstalledModal from '@/components/wallet/FreighterNotInstalledModal';

export default function WalletProviders() {
  const restoreSession = useWalletStore(s => s.restoreSession);

  // Restore Freighter session on every page load
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Re-run restore when the user switches accounts in Freighter
  useEffect(() => {
    const handler = () => restoreSession();
    window.addEventListener('freighterAccountChanged', handler);
    return () => window.removeEventListener('freighterAccountChanged', handler);
  }, [restoreSession]);

  return (
    <>
      <WrongNetworkBanner />
      <FreighterNotInstalledModal />
    </>
  );
}
