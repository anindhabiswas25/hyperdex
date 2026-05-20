class MakerRateLimiter {
  private limits: Map<string, number> = new Map()
  private requestCounts: Map<string, number[]> = new Map()

  isLimited(takerAddress: string): boolean {
    const expiry = this.limits.get(takerAddress)
    if (!expiry) return false
    if (Date.now() > expiry) {
      this.limits.delete(takerAddress)
      return false
    }
    return true
  }

  setLimit(takerAddress: string, expiryMs: number): void {
    this.limits.set(takerAddress, expiryMs)
  }

  getExpiry(takerAddress: string): number {
    return this.limits.get(takerAddress) ?? Date.now() + 60_000
  }

  trackRequest(takerAddress: string): void {
    const now = Date.now()
    const counts = this.requestCounts.get(takerAddress) ?? []
    const recent = counts.filter(t => t > now - 60_000)
    recent.push(now)
    this.requestCounts.set(takerAddress, recent)

    if (recent.length > 10) {
      const expiry = now + 5 * 60_000
      this.setLimit(takerAddress, expiry)
      console.log(`[RateLimit] Auto-limited ${takerAddress.slice(0, 8)}... for 5 min`)
    }
  }
}

export const rateLimiter = new MakerRateLimiter()
