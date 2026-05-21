export const ADMIN_WALLET_ADDRESS =
  'GCRNVABHFSWAJTON7DYCKNXPQGIFCWFFBXGCHQWF25DMKAXLUGLZF6PI';

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

export function truncateAddress(address: string): string {
  if (!address) return '';
  return address.slice(0, 4) + '...' + address.slice(-4);
}
