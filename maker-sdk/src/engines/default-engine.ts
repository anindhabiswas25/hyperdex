// ─────────────────────────────────────────────────────────────────────────────
// Default engine — the built-in pricing brain for beginner makers.
//
// This wraps the SDK's existing ghost-price auto-bid behavior into the
// MakerEngine interface, so `npm run dev <name>` keeps working exactly as
// before. The maker sets a single ghost price; the engine quotes that rate on
// every RFQ, fee-adjusted, subject to an inventory check and a drift guard.
//
//   getLevels()  → resting tiers from buildPriceLevels() at the ghost price
//   getQuote()   → makePricingDecision() (ghost rate × amount × fee), gated by
//                  the drift guard (pause quoting if market moved >3% away)
//   onTradeConfirmed() → invalidate the inventory cache so the next read is live
// ─────────────────────────────────────────────────────────────────────────────

import chalk from 'chalk'
import { MakerEngine, RfqContext, PriceLevels } from '../types/MakerEngine'
import { priceOracle } from '../oracle'
import { inventoryChecker } from '../inventory-checker'
import { buildPriceLevels } from '../price-levels'
import { makePricingDecision, RfqContext as LegacyRfqContext } from '../example-pricer'
import { GHOST_PRICE_USDC_TO_EURC } from '../ghost-price'
import { getDriftStatus } from '../drift-guard'

export function createDefaultEngine(): MakerEngine {
  return {
    async getLevels(): Promise<PriceLevels> {
      // Stop publishing levels if the market has drifted too far from the
      // maker's ghost price — protects them from stale resting orders.
      const drift = getDriftStatus(GHOST_PRICE_USDC_TO_EURC, priceOracle.getMidRate())
      if (drift.level === 'pause') {
        return { sellLevels: [], buyLevels: [] }
      }

      const USDC = process.env.USDC_CONTRACT || process.env.USDC_CONTRACT_ADDRESS || ''
      const EURC = process.env.EURC_CONTRACT || process.env.EURC_CONTRACT_ADDRESS || ''
      const balance = inventoryChecker.getCachedBalance()

      const levels = buildPriceLevels(USDC, EURC, balance)
      return { sellLevels: levels.sellLevels, buyLevels: levels.buyLevels }
    },

    async getQuote(ctx: RfqContext): Promise<string | null> {
      // Drift guard: if the maker's ghost price is >3% away from the live
      // oracle mid, pause quoting so they don't get arbitraged.
      const drift = getDriftStatus(GHOST_PRICE_USDC_TO_EURC, priceOracle.getMidRate())
      if (drift.level === 'pause') {
        console.log(
          chalk.red(
            `[Engine] Paused — ghost price ${drift.absPct.toFixed(2)}% ` +
            `${drift.belowMarket ? 'below' : 'above'} market (>3%). Press Ctrl+R to re-price.`
          )
        )
        return null
      }

      // Reuse the existing ghost-price decision so behavior is identical.
      const legacyCtx: LegacyRfqContext = {
        rfqId:        ctx.rfqId,
        takerAddress: ctx.takerAddress,
        tokenIn:      ctx.tokenIn,
        tokenOut:     ctx.tokenOut,
        amountIn:     ctx.amountIn,
        feesBps:      ctx.feesBps,
        requestedAt:  ctx.requestedAt,
        midRate:      priceOracle.getMidRate(),
        volatility:   priceOracle.getVolatility(),
        vaultBalance: await inventoryChecker.getBalance(),
      }

      const decision = await makePricingDecision(legacyCtx)
      if (!decision.shouldQuote || !decision.amountOut) return null
      return decision.amountOut
    },

    async onTradeConfirmed(_trade): Promise<void> {
      // Force the next inventory read to hit the chain instead of the cache.
      inventoryChecker.invalidateCache()
    },
  }
}
