// ─────────────────────────────────────────────────────────────────────────────
// Example custom engine — live EUR/USD pricing from the Binance WebSocket.
//
// This is what a TIER 2 (intermediate) maker would run instead of the built-in
// ghost-price engine. It streams the EURUSDT ticker and quotes off the live
// rate with a fixed spread. Sub-second price updates, no manual ghost price.
//
// Run it (note the `--` separator so npm forwards the flag):
//   npm run dev <your-credential> -- --engine=./examples/binance-engine.ts
// ─────────────────────────────────────────────────────────────────────────────

import { MakerEngine, RfqContext, PriceLevels } from '../src/types/MakerEngine'
import WebSocket from 'ws'

// ── Connect to Binance WebSocket for live EUR/USD ──────────────────────────────
let liveRate = 0.92      // EUR per USD (USDC→EURC rate)
let wsConnected = false

function connectBinance(): void {
  const ws = new WebSocket('wss://stream.binance.com:9443/ws/eurusdt@ticker')

  ws.on('message', (data: Buffer) => {
    try {
      const tick = JSON.parse(data.toString())
      liveRate = parseFloat(tick.c)  // 'c' = current/last price
      wsConnected = true
    } catch {
      /* ignore malformed frames */
    }
  })

  ws.on('close', () => {
    wsConnected = false
    setTimeout(connectBinance, 5000)  // auto-reconnect
  })

  ws.on('error', () => ws.close())
}

connectBinance()

// ── The Engine ─────────────────────────────────────────────────────────────────
const SPREAD_BPS = 15  // maker's target spread, in basis points

const engine: MakerEngine = {
  async getLevels(): Promise<PriceLevels> {
    if (!wsConnected || liveRate <= 0) {
      return { sellLevels: [], buyLevels: [] }  // go offline gracefully
    }

    const sellRate = liveRate * (1 - SPREAD_BPS / 10000)
    const buyRate  = (1 / liveRate) * (1 - SPREAD_BPS / 10000)

    return {
      sellLevels: [
        { quantity: '100000000',  price: sellRate.toFixed(8) },
        { quantity: '1000000000', price: (sellRate * 0.999).toFixed(8) },
      ],
      buyLevels: [
        { quantity: '100000000',  price: buyRate.toFixed(8) },
        { quantity: '1000000000', price: (buyRate * 0.999).toFixed(8) },
      ],
    }
  },

  async getQuote(ctx: RfqContext): Promise<string | null> {
    if (!wsConnected || liveRate <= 0) return null  // no live price → skip

    const rate = ctx.tokenInSymbol === 'USDC' ? liveRate : 1 / liveRate

    const effectiveRate = rate
      * (1 - SPREAD_BPS / 10000)      // maker's spread
      * (1 - ctx.feesBps * 0.0001)    // protocol fee

    const amountOut = Math.floor(ctx.amountInHuman * effectiveRate * 1e7)
    return amountOut > 0 ? amountOut.toString() : null
  },

  async onTradeConfirmed(trade) {
    console.log(`[Binance Engine] Trade confirmed: ${trade.txHash || 'pending'}`)
    // A professional maker would hedge the filled leg on a CEX here.
  },
}

export default engine
