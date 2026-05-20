class RateLimitStore {
  private limits: Map<string, number> = new Map();

  private key(makerId: string, takerAddress: string): string {
    return `${makerId}:${takerAddress}`;
  }

  setLimit(makerId: string, takerAddress: string, expiryMs: number): void {
    const k = this.key(makerId, takerAddress);
    this.limits.set(k, expiryMs);
    const delay = Math.max(0, expiryMs - Date.now()) + 1000;
    setTimeout(() => this.limits.delete(k), delay);
  }

  isLimited(makerId: string, takerAddress: string): boolean {
    const k = this.key(makerId, takerAddress);
    const expiry = this.limits.get(k);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.limits.delete(k);
      return false;
    }
    return true;
  }

  getExpiry(makerId: string, takerAddress: string): number | null {
    const k = this.key(makerId, takerAddress);
    return this.limits.get(k) ?? null;
  }

  getActiveLimitsForMaker(makerId: string): { takerAddress: string; expiresAt: Date }[] {
    const result: { takerAddress: string; expiresAt: Date }[] = [];
    const now = Date.now();
    for (const [k, expiry] of this.limits.entries()) {
      if (!k.startsWith(`${makerId}:`)) continue;
      if (expiry <= now) continue;
      const takerAddress = k.slice(makerId.length + 1);
      result.push({ takerAddress, expiresAt: new Date(expiry) });
    }
    return result;
  }
}

export const rateLimitStore = new RateLimitStore();
