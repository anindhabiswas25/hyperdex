import { BACKEND_URL } from './constants';
import { adminFetch } from './adminAuth';
import type { BackendQuote, TradeStatus, MakerInventory, HealthStatus, MakerInfo, AdminMakerRecord } from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly reasons?: string[];
  constructor(message: string, code: string, reasons?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.reasons = reasons;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const errObj = data.error;
    if (errObj && typeof errObj === 'object') {
      throw new ApiError(errObj.message ?? `HTTP ${res.status}`, errObj.code ?? 'UNKNOWN', errObj.reasons);
    }
    throw new ApiError(data.message ?? `HTTP ${res.status}`, 'UNKNOWN');
  }
  return data;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`);
  const data = await res.json();
  if (!res.ok) {
    const errObj = data.error;
    if (errObj && typeof errObj === 'object') {
      throw new ApiError(errObj.message ?? `HTTP ${res.status}`, errObj.code ?? 'UNKNOWN');
    }
    throw new ApiError(data.message ?? `HTTP ${res.status}`, 'UNKNOWN');
  }
  return data;
}

export async function fetchQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  takerAddress: string;
}): Promise<BackendQuote> {
  const result = await post<{ success: boolean; quote: BackendQuote }>('/api/quote', params);
  return result.quote;
}

export async function confirmQuote(params: {
  quoteId: string;
  txHash: string;
  takerAddress: string;
}): Promise<void> {
  await post('/api/quote/confirm', params);
}

export async function fetchTradeStatus(quoteId: string): Promise<TradeStatus> {
  return get<TradeStatus>(`/api/trades/${quoteId}/status`);
}

export async function fetchMakerInventory(makerAddress: string): Promise<MakerInventory> {
  return get<MakerInventory>(`/api/makers/${makerAddress}/inventory`);
}

export async function fetchHealth(): Promise<HealthStatus> {
  return get<HealthStatus>('/health');
}

/**
 * Wake the backend if it's asleep (Render free tier sleeps after ~15 min idle).
 * Render wakes on any inbound request, so a single /health GET triggers the
 * cold start; we retry a few times because the first request can take ~20-30s.
 * Fire-and-forget on app load so the instance is warm by the time the user
 * requests a quote. Returns true once the backend responds, false otherwise.
 */
export async function warmupBackend(attempts = 4, timeoutMs = 30_000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // network error or cold-start timeout — wait and retry
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 3_000));
  }
  return false;
}

export async function fetchMakers(): Promise<MakerInfo[]> {
  const result = await get<{ makers: MakerInfo[] }>('/api/makers');
  return result.makers;
}

export async function fetchAdminMakers(): Promise<AdminMakerRecord[]> {
  const res = await adminFetch(`${BACKEND_URL}/api/admin/makers`);
  const data = await res.json();
  if (!res.ok) {
    const errObj = data.error;
    throw new ApiError(
      (errObj && typeof errObj === 'object' ? errObj.message : data.error) ?? `HTTP ${res.status}`,
      (errObj && typeof errObj === 'object' ? errObj.code : undefined) ?? 'UNKNOWN',
    );
  }
  return data.makers;
}

export async function registerMakerInSystem(params: {
  stellarAddress: string;
  name: string;
  signerPublicKey: string;
  supportedPairs: { tokenIn: string; tokenOut: string }[];
}): Promise<{ maker: { id: string; stellarAddress: string; name: string }; apiKey: string }> {
  const res = await adminFetch(`${BACKEND_URL}/api/makers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    const errObj = data.error;
    throw new ApiError(
      (errObj && typeof errObj === 'object' ? errObj.message : data.error) ?? `HTTP ${res.status}`,
      (errObj && typeof errObj === 'object' ? errObj.code : undefined) ?? 'UNKNOWN',
    );
  }
  return data;
}

export async function activateMaker(id: string): Promise<void> {
  await adminFetch(`${BACKEND_URL}/api/admin/makers/${id}/activate`, { method: 'PATCH' });
}

export async function deactivateMaker(id: string): Promise<void> {
  await adminFetch(`${BACKEND_URL}/api/admin/makers/${id}/deactivate`, { method: 'PATCH' });
}

export async function fetchMakerStatus(makerAddress: string) {
  const res = await fetch(`${BACKEND_URL}/api/makers/${makerAddress}/status`);
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function fetchMakerInventoryV2(makerAddress: string) {
  return get<{ success: boolean; vault: { usdc: string; eurc: string }; wallet: { usdc: string; eurc: string; xlm: string } }>(`/api/makers/${makerAddress}/inventory`);
}

export async function fetchTrades(params: { makerAddress?: string; takerAddress?: string; status?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params.makerAddress) q.set('makerAddress', params.makerAddress);
  if (params.takerAddress) q.set('takerAddress', params.takerAddress);
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  return get<{ trades: unknown[]; total: number; hasMore: boolean }>(`/api/trades?${q.toString()}`);
}

export async function pollTradeStatus(
  quoteId: string,
  onUpdate: (status: TradeStatus) => void,
  maxAttempts = 40,
  intervalMs = 3000
): Promise<TradeStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const status = await fetchTradeStatus(quoteId);
    onUpdate(status);
    if (status.status === 'confirmed') return status;
    if (status.status === 'failed') throw new Error('Transaction failed on-chain');
  }
  throw new Error('Trade confirmation timed out');
}
