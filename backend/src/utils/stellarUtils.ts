import * as StellarSdk from '@stellar/stellar-sdk';
import { config, NETWORK_PASSPHRASE } from '../config';

let _server: StellarSdk.rpc.Server | null = null;

// In-memory cache to avoid hammering slow Soroban RPC on every inventory request
const balanceCache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 60s cache for pool/wallet balances

function getCached(key: string): string | null {
  const entry = balanceCache.get(key);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.value;
  return null;
}

function setCached(key: string, value: string): void {
  balanceCache.set(key, { value, fetchedAt: Date.now() });
}

export function getRpcServer(): StellarSdk.rpc.Server {
  if (!_server) {
    _server = new StellarSdk.rpc.Server(config.STELLAR_RPC_URL, { allowHttp: true });
  }
  return _server;
}

export async function getWalletTokenBalance(
  walletAddress: string,
  tokenContractAddress: string,
  skipCache = false
): Promise<string> {
  const cacheKey = `wallet:${walletAddress}:${tokenContractAddress}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached !== null) return cached;
  }

  const server = getRpcServer();
  const contract = new StellarSdk.Contract(tokenContractAddress);
  const walletScVal = new StellarSdk.Address(walletAddress).toScVal();

  const account = await server.getAccount(walletAddress).catch(() => null);
  if (!account) return '0';

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('balance', walletScVal))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (!StellarSdk.rpc.Api.isSimulationSuccess(result) || !result.result) {
    setCached(cacheKey, '0');
    return '0';
  }

  const n = StellarSdk.scValToNative(result.result.retval) as bigint;
  const strVal = n.toString();
  setCached(cacheKey, strVal);
  return strVal;
}

export function invalidateBalanceCache(makerAddress: string, poolAddress?: string): void {
  for (const key of balanceCache.keys()) {
    if (key.includes(makerAddress)) balanceCache.delete(key);
    if (poolAddress && key.includes(poolAddress)) balanceCache.delete(key);
  }
}

// Read maker's pool address from pool_registry contract
export async function getPoolAddressFromRegistry(
  makerAddress: string,
  skipCache = false
): Promise<string | null> {
  const registryAddress = config.POOL_REGISTRY_CONTRACT_ADDRESS;
  if (!registryAddress) return null;

  const cacheKey = `pooladdr:${makerAddress}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached !== null) return cached === 'null' ? null : cached;
  }

  const server = getRpcServer();
  const contract = new StellarSdk.Contract(registryAddress);
  const makerScVal = StellarSdk.nativeToScVal(makerAddress, { type: 'address' });

  const account = await server.getAccount(makerAddress).catch(() => null);
  if (!account) return null;

  try {
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_pool_address', makerScVal))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(result) || !result.result) {
      setCached(cacheKey, 'null');
      return null;
    }

    const addr = StellarSdk.scValToNative(result.result.retval) as string;
    setCached(cacheKey, addr);
    return addr;
  } catch {
    setCached(cacheKey, 'null');
    return null;
  }
}

// Read balance from maker's own pool contract
export async function getMakerPoolBalance(
  poolAddress: string,
  tokenAddress: string,
  skipCache = false
): Promise<bigint> {
  const cacheKey = `pool:${poolAddress}:${tokenAddress}`;
  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached !== null) return BigInt(cached);
  }

  const server = getRpcServer();
  const contract = new StellarSdk.Contract(poolAddress);
  const tokenScVal = StellarSdk.nativeToScVal(tokenAddress, { type: 'address' });

  // Use a dummy account for simulation — just needs any funded account
  const dummyAccount = await server
    .getAccount(config.ADMIN_ADDRESS ?? '')
    .catch(() => null);
  if (!dummyAccount) return 0n;

  try {
    const tx = new StellarSdk.TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_balance', tokenScVal))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(result) || !result.result) {
      setCached(cacheKey, '0');
      return 0n;
    }

    const n = StellarSdk.scValToNative(result.result.retval) as bigint;
    setCached(cacheKey, n.toString());
    return n;
  } catch {
    setCached(cacheKey, '0');
    return 0n;
  }
}
