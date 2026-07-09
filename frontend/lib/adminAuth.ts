'use client';

// Client-side admin key handling.
//
// The admin REST API (/api/admin/* and POST /api/makers/register) is protected
// by a shared secret the backend checks against ADMIN_API_KEY. The browser holds
// that secret in localStorage and sends it as the `x-admin-key` header.
//
// SECURITY: this key must NEVER be baked into the bundle (no NEXT_PUBLIC_*).
// It is entered by the admin at runtime and lives only in their browser.

const STORAGE_KEY = 'hyperdex_admin_key';
export const ADMIN_UNAUTHORIZED_EVENT = 'admin-unauthorized';

export function getAdminKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setAdminKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearAdminKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = getAdminKey();
  return { ...(extra ?? {}), ...(key ? { 'x-admin-key': key } : {}) };
}

/**
 * fetch() wrapper that attaches the admin key. On a 401/403 it clears the stored
 * key and dispatches ADMIN_UNAUTHORIZED_EVENT so the gate re-locks and prompts
 * for a fresh key.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = adminHeaders(init.headers as Record<string, string> | undefined);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    clearAdminKey();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT));
    }
  }
  return res;
}
