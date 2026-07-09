// Single source of truth is NEXT_PUBLIC_ADMIN_ADDRESS (see ../constants.ts) —
// re-exported here so the wallet store and lib/constants.ts can never drift.
export { ADMIN_ADDRESS as ADMIN_WALLET_ADDRESS } from '../constants';

export function truncateAddress(address: string): string {
  if (!address) return '';
  return address.slice(0, 4) + '...' + address.slice(-4);
}
