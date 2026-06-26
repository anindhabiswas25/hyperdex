// ─────────────────────────────────────────────────────────────────────────────
// Example custom engine — fixed rate, no external feeds.
//
// The simplest possible custom engine. Quotes a hard-coded rate, fee-adjusted,
// and demonstrates how to REFUSE a trade (return null) — here it refuses any
// trade larger than MAX_TRADE units. Handy for testing the --engine flow
// offline without any market data.
//
// Run it (note the `--` separator so npm forwards the flag):
//   npm run dev <your-credential> -- --engine=./examples/fixed-rate-engine.ts
// ─────────────────────────────────────────────────────────────────────────────

import { MakerEngine, RfqContext, PriceLevels } from '../src/types/MakerEngine'

const USDC_TO_EURC = 0.8590  // your fixed bid: EURC per USDC
const MAX_TRADE     = 1000   // refuse trades bigger than this (human units)

const engine: MakerEngine = {
  async getLevels(): Promise<PriceLevels> {
    const sellRate = USDC_TO_EURC
    const buyRate  = 1 / USDC_TO_EURC
    return {
      sellLevels: [{ quantity: '1000000000', price: sellRate.toFixed(8) }],
      buyLevels:  [{ quantity: '1000000000', price: buyRate.toFixed(8) }],
    }
  },

  async getQuote(ctx: RfqContext): Promise<string | null> {
    if (ctx.amountInHuman > MAX_TRADE) return null  // refuse — too big

    const rate   = ctx.tokenInSymbol === 'USDC' ? USDC_TO_EURC : 1 / USDC_TO_EURC
    const feeAdj = 1 - ctx.feesBps * 0.0001
    const out    = Math.floor(ctx.amountInHuman * rate * feeAdj * 1e7)
    return out > 0 ? out.toString() : null
  },
}

export default engine
