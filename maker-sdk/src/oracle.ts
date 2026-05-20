import axios from 'axios'

interface PriceSource {
  name: string
  usdcToEurc: number
  eurcToUsdc: number
  fetchedAt: number
  baseWeight: number
  failed: boolean
}

class PriceOracle {
  private sources: PriceSource[] = [
    { name: 'coingecko',        usdcToEurc: 0.92, eurcToUsdc: 1.087, fetchedAt: 0, baseWeight: 0.4, failed: false },
    { name: 'open-er-api',      usdcToEurc: 0.92, eurcToUsdc: 1.087, fetchedAt: 0, baseWeight: 0.4, failed: false },
    { name: 'exchangerate-api', usdcToEurc: 0.92, eurcToUsdc: 1.087, fetchedAt: 0, baseWeight: 0.2, failed: false },
  ]
  private midRate: number = 0.92
  private volatility: number = 0
  private priceHistory: number[] = []
  private refreshMs = 15_000
  private intervalHandle: NodeJS.Timeout | null = null
  private lastSuccessfulFetch: number = 0

  async start(): Promise<void> {
    await this.fetchAllSources()
    this.intervalHandle = setInterval(() => this.fetchAllSources(), this.refreshMs)
    console.log('[Oracle] Price oracle started')
  }

  stop(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle)
  }

  private async fetchAllSources(): Promise<void> {
    const [cgResult, erResult, eraResult] = await Promise.allSettled([
      this.fetchCoinGecko(),
      this.fetchOpenER(),
      this.fetchExchangeRateAPI(),
    ])

    if (cgResult.status === 'fulfilled') {
      Object.assign(this.sources[0], cgResult.value, { failed: false, fetchedAt: Date.now() })
    } else {
      this.sources[0].failed = true
    }

    if (erResult.status === 'fulfilled') {
      Object.assign(this.sources[1], erResult.value, { failed: false, fetchedAt: Date.now() })
    } else {
      this.sources[1].failed = true
    }

    if (eraResult.status === 'fulfilled') {
      Object.assign(this.sources[2], eraResult.value, { failed: false, fetchedAt: Date.now() })
    } else {
      this.sources[2].failed = true
    }

    if (this.sources.every(s => s.failed)) {
      console.warn('[Oracle] All price sources failed — using stale rate')
      return
    }

    this.lastSuccessfulFetch = Date.now()
    this.calculateMidRate()
  }

  private async fetchCoinGecko(): Promise<{ usdcToEurc: number; eurcToUsdc: number }> {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: 'usd-coin,euro-coin', vs_currencies: 'usd' },
      timeout: 5000,
    })
    const usdcUsd: number = res.data['usd-coin']?.usd
    const eurcUsd: number = res.data['euro-coin']?.usd
    if (!usdcUsd || !eurcUsd) throw new Error('CoinGecko: missing prices')
    return { usdcToEurc: usdcUsd / eurcUsd, eurcToUsdc: eurcUsd / usdcUsd }
  }

  private async fetchOpenER(): Promise<{ usdcToEurc: number; eurcToUsdc: number }> {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 })
    const eurRate: number = res.data.rates?.EUR
    if (!eurRate) throw new Error('Open ER: no EUR rate')
    return { usdcToEurc: eurRate, eurcToUsdc: 1 / eurRate }
  }

  private async fetchExchangeRateAPI(): Promise<{ usdcToEurc: number; eurcToUsdc: number }> {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 5000 })
    const eurRate: number = res.data.rates?.EUR
    if (!eurRate) throw new Error('ExchangeRate-API: no EUR rate')
    return { usdcToEurc: eurRate, eurcToUsdc: 1 / eurRate }
  }

  private calculateMidRate(): void {
    const active = this.sources.filter(s => !s.failed)
    if (active.length === 0) return

    const totalWeight = active.reduce((sum, s) => sum + s.baseWeight, 0)
    const weightedSum = active.reduce((sum, s) => sum + s.usdcToEurc * s.baseWeight, 0)
    this.midRate = weightedSum / totalWeight

    this.priceHistory.push(this.midRate)
    if (this.priceHistory.length > 20) this.priceHistory.shift()

    if (this.priceHistory.length >= 5) {
      const last5 = this.priceHistory.slice(-5)
      const mean = last5.reduce((a, b) => a + b, 0) / last5.length
      const variance = last5.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / last5.length
      this.volatility = Math.sqrt(variance) / mean
    }
  }

  getMidRate(): number {
    return this.midRate
  }

  getVolatility(): number {
    return this.volatility
  }

  isStale(): boolean {
    return this.sources.every(s => s.failed) && Date.now() - this.lastSuccessfulFetch > 120_000
  }

  getStatus(): object {
    return {
      midRate: this.midRate,
      volatility: this.volatility,
      sources: this.sources.map(s => ({
        name: s.name,
        usdcToEurc: s.usdcToEurc,
        failed: s.failed,
        fetchedAt: s.fetchedAt,
      })),
      stale: this.isStale(),
    }
  }
}

export const priceOracle = new PriceOracle()
