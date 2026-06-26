Add a MakerEngine plugin system to the HyperDEX
maker SDK. This allows advanced makers to provide
their own pricing logic. The built-in oracle and
spread system stays as the default for beginners.

=======================================================
WHAT TO BUILD
=======================================================

1. Define the MakerEngine interface
2. Update ws-client.ts to call the engine
   instead of example-pricer.ts directly
3. Update server.ts to load a custom engine
   if --engine flag is passed
4. Update price-levels.ts to use engine
5. Keep existing behavior as default engine
6. Write documentation

=======================================================
STEP 1 — Define the MakerEngine interface
=======================================================

FILE: maker-sdk/src/types/MakerEngine.ts

export interface RfqContext {
  rfqId:         string
  takerAddress:  string
  tokenIn:       string    // C... address
  tokenOut:      string    // C... address
  tokenInSymbol: string    // 'USDC' or 'EURC'
  tokenOutSymbol:string    // 'USDC' or 'EURC'
  amountIn:      string    // stroops as string
  amountInHuman: number    // human readable e.g. 10.5
  feesBps:       number    // protocol fee e.g. 10
  requestedAt:   number    // unix ms
}

export interface PriceLevel {
  quantity: string   // stroops as string
  price:    string   // rate as decimal string e.g. "0.85900000"
}

export interface PriceLevels {
  sellLevels: PriceLevel[]  // maker sells tokenOut
  buyLevels:  PriceLevel[]  // maker buys tokenOut
}

export interface MakerEngine {

  // Called every 3 seconds to get price levels
  // Return empty arrays to go offline gracefully
  getLevels(): Promise<PriceLevels>

  // Called when RFQ arrives
  // Return amountOut in stroops as string
  // Return null to NOT participate in this quote
  getQuote(ctx: RfqContext): Promise<string | null>

  // Optional: called when a trade confirms on-chain
  // Use this to update inventory, trigger hedging etc
  onTradeConfirmed?: (trade: {
    quoteId:      string
    amountIn:     string
    amountOut:    string
    tokenIn:      string
    tokenOut:     string
    txHash:       string
    confirmedAt:  string
  }) => Promise<void>

}

export type MakerEngineFactory = () => MakerEngine

=======================================================
STEP 2 — Create the default engine
=======================================================

FILE: maker-sdk/src/engines/default-engine.ts

This is exactly what the SDK does today.
Wrapped into the MakerEngine interface.

import { MakerEngine, RfqContext, PriceLevels } from '../types/MakerEngine'
import { priceOracle } from '../oracle'
import { inventoryChecker } from '../inventory-checker'
import { TARGET_SPREAD_BPS } from '../server'

export function createDefaultEngine(): MakerEngine {
  return {

    async getLevels(): Promise<PriceLevels> {
      const midRate  = priceOracle.getMidRate()
      const balance  = inventoryChecker.getCachedBalance()
      const spread   = TARGET_SPREAD_BPS

      const sellRate = midRate * (1 - spread / 10000)
      const buyRate  = (1 / midRate) * (1 - spread / 10000)

      const maxSell = balance.eurc * 0.8
      const maxBuy  = balance.usdc * 0.8

      const USDC = process.env.USDC_CONTRACT || ''
      const EURC = process.env.EURC_CONTRACT || ''

      function buildTiers(
        rate: number,
        maxLiquidity: number
      ): { quantity: string; price: string }[] {
        if (maxLiquidity <= 0 || rate <= 0) return []
        const tiers = [10, 100, 500, 5000]
        const levels = []
        let cumulative = 0
        for (const maxAmount of tiers) {
          const size = Math.min(
            maxAmount - cumulative,
            maxLiquidity - cumulative
          )
          if (size <= 0) break
          levels.push({
            quantity: Math.floor(size * 1e7).toString(),
            price:    rate.toFixed(8)
          })
          cumulative += size
          if (cumulative >= maxLiquidity) break
        }
        return levels
      }

      return {
        sellLevels: buildTiers(sellRate, maxSell),
        buyLevels:  buildTiers(buyRate, maxBuy)
      }
    },

    async getQuote(ctx: RfqContext): Promise<string | null> {
      if (priceOracle.isStale()) return null

      const midRate = priceOracle.getMidRate()
      const spread  = TARGET_SPREAD_BPS

      let rate: number
      if (ctx.tokenInSymbol === 'USDC') {
        rate = midRate
      } else {
        rate = 1 / midRate
      }

      // Size adjustment
      let finalSpread = spread
      if (ctx.amountInHuman > 100)  finalSpread += 5
      if (ctx.amountInHuman > 500)  finalSpread += 10
      if (ctx.amountInHuman > 1000) finalSpread += 20

      // Volatility adjustment
      const vol = priceOracle.getVolatility()
      if (vol > 0.005) finalSpread += 10
      if (vol > 0.02)  finalSpread += 25

      const effectiveRate = rate
        * (1 - finalSpread / 10000)
        * (1 - ctx.feesBps * 0.0001)

      const amountOut = Math.floor(
        ctx.amountInHuman * effectiveRate * 1e7
      )

      if (amountOut <= 0) return null

      // Inventory check
      const check = await inventoryChecker.canFill(
        ctx.tokenOut, amountOut
      )
      if (!check.canFill) return null

      return amountOut.toString()
    },

    async onTradeConfirmed(trade) {
      inventoryChecker.invalidateCache()
    }
  }
}

=======================================================
STEP 3 — Update server.ts to load custom engine
=======================================================

FILE: maker-sdk/src/server.ts

DETECT --engine flag:

  const engineFlag = process.argv.find(
    a => a.startsWith('--engine=')
  )
  const enginePath = engineFlag
    ? engineFlag.replace('--engine=', '')
    : null

LOAD ENGINE:

  async function loadEngine(): Promise<MakerEngine> {
    if (enginePath) {
      try {
        // Resolve path relative to where user ran the command
        const fullPath = path.resolve(process.cwd(), enginePath)

        console.log(chalk.cyan(
          `  Loading custom engine: ${fullPath}`
        ))

        // Dynamic import
        const mod = await import(fullPath)
        const engine = mod.default || mod.engine

        if (!engine) {
          throw new Error(
            'Engine file must export a default MakerEngine object'
          )
        }

        // Validate interface
        if (typeof engine.getLevels !== 'function') {
          throw new Error('Engine must have getLevels() function')
        }
        if (typeof engine.getQuote !== 'function') {
          throw new Error('Engine must have getQuote() function')
        }

        console.log(chalk.green(
          '  ✓ Custom engine loaded successfully'
        ))
        return engine

      } catch (err: any) {
        console.error(chalk.red(
          `  ✗ Failed to load engine: ${err.message}`
        ))
        console.log(chalk.yellow(
          '  Falling back to default engine...'
        ))
        return createDefaultEngine()
      }
    }

    // No custom engine — use default
    return createDefaultEngine()
  }

  // Load engine before starting
  const makerEngine = await loadEngine()
  export { makerEngine }

UPDATE startup banner:

  console.log(
    chalk.gray('  Engine:      ') +
    (enginePath
      ? chalk.cyan(path.basename(enginePath) + ' [custom]')
      : chalk.gray('Built-in (spread-based)'))
  )

=======================================================
STEP 4 — Update ws-client.ts to use engine
=======================================================

FILE: maker-sdk/src/ws-client.ts

REPLACE the direct call to makePricingDecision()
and buildPriceLevels() with engine calls:

Import:
  import { makerEngine } from './server'

UPDATE handleRfq():

  async function handleRfq(rfq: RfqMessage) {
    const startTime = Date.now()

    const ctx: RfqContext = {
      rfqId:          rfq.rfqId,
      takerAddress:   rfq.takerAddress,
      tokenIn:        rfq.tokenIn,
      tokenOut:       rfq.tokenOut,
      tokenInSymbol:  getSymbol(rfq.tokenIn),
      tokenOutSymbol: getSymbol(rfq.tokenOut),
      amountIn:       rfq.amountIn,
      amountInHuman:  Number(rfq.amountIn) / 1e7,
      feesBps:        rfq.feesBps || 10,
      requestedAt:    rfq.requestedAt
    }

    try {
      // CALL THE ENGINE — default or custom
      const amountOut = await makerEngine.getQuote(ctx)

      if (!amountOut) {
        // Engine returned null = do not participate
        ws.send(JSON.stringify({
          type: 'rfqError',
          message: {
            rfqId:  rfq.rfqId,
            reason: 'market_conditions'
          }
        }))
        console.log(chalk.gray(
          `[RFQ] Skipped  rfqId=${rfq.rfqId.slice(0,8)}...`
        ))
        return
      }

      // Build and sign quote
      const quoteId   = generateQuoteId()
      const salt      = generateSalt()
      const expiry    = Math.floor(Date.now() / 1000) + 180

      const quote = {
        quote_id:   quoteId,
        maker:      MAKER_ADDRESS,
        taker:      rfq.takerAddress,
        token_in:   rfq.tokenIn,
        token_out:  rfq.tokenOut,
        amount_in:  rfq.amountIn,
        amount_out: amountOut,
        expiry,
        salt
      }

      const signature = quoteSigner.signQuote(quote)

      ws.send(JSON.stringify({
        type: 'rfqQuote',
        message: {
          rfqId:           rfq.rfqId,
          quoteId,
          makerAddress:    MAKER_ADDRESS,
          takerAddress:    rfq.takerAddress,
          tokenIn:         rfq.tokenIn,
          tokenOut:        rfq.tokenOut,
          amountIn:        rfq.amountIn,
          amountOut,
          expiryTimestamp: expiry,
          salt,
          signature
        }
      }))

      console.log(
        chalk.green(`[RFQ] Quoted   `) +
        chalk.gray(`rfqId=${rfq.rfqId.slice(0,8)}...`) +
        chalk.gray(`  out=${(Number(amountOut)/1e7).toFixed(6)}`) +
        chalk.gray(`  latency=${Date.now()-startTime}ms`)
      )

    } catch (err: any) {
      console.error('[RFQ] Engine error:', err.message)
      ws.send(JSON.stringify({
        type: 'rfqError',
        message: { rfqId: rfq.rfqId, reason: 'internal_error' }
      }))
    }
  }

UPDATE price level streaming:

  setInterval(async () => {
    try {
      // CALL THE ENGINE for levels
      const levels = await makerEngine.getLevels()

      if (levels.sellLevels.length > 0 ||
          levels.buyLevels.length > 0) {
        ws.send(JSON.stringify({
          type: 'priceLevels',
          message: {
            tokenIn:    USDC_CONTRACT,
            tokenOut:   EURC_CONTRACT,
            sellLevels: levels.sellLevels,
            buyLevels:  levels.buyLevels
          }
        }))
      }
    } catch (err: any) {
      console.error('[Levels] Engine error:', err.message)
    }
  }, 3000)

UPDATE trade notification handler:

  case 'trade':
    // Notify the engine about confirmed trade
    if (makerEngine.onTradeConfirmed) {
      makerEngine.onTradeConfirmed(message.message)
        .catch(err => console.error(
          '[Trade] Engine callback error:', err.message
        ))
    }
    // Send tradeAck
    ws.send(JSON.stringify({
      type: 'tradeAck',
      message: { tradeEventId: message.message.tradeEventId }
    }))
    break

=======================================================
STEP 5 — Update package.json scripts
=======================================================

FILE: maker-sdk/package.json

  "scripts": {
    "dev":      "ts-node src/server.ts",
    "setup":    "ts-node src/setup.ts",
    "activate": "ts-node src/activate.ts",
    "build":    "tsc",
    "start":    "node dist/server.js"
  }

Usage:
  Default engine:
    npm run dev hog

  Custom engine:
    npm run dev hog --engine=./my-engine.ts
    npm run dev hog --engine=/path/to/engine.ts

=======================================================
STEP 6 — Example custom engines for makers
=======================================================

FILE: maker-sdk/examples/binance-engine.ts

A complete working example that fetches
live EUR/USD from Binance WebSocket.
This is what a more advanced maker would use.

import { MakerEngine, RfqContext, PriceLevels }
  from '../src/types/MakerEngine'
import WebSocket from 'ws'

// ── Connect to Binance WebSocket for live EUR/USD ──
let liveRate: number = 0.92
let wsConnected = false

function connectBinance() {
  const ws = new WebSocket(
    'wss://stream.binance.com:9443/ws/eurusdt@ticker'
  )
  ws.on('message', (data: string) => {
    const tick = JSON.parse(data)
    liveRate = parseFloat(tick.c)  // 'c' = current price
    wsConnected = true
  })
  ws.on('close', () => {
    wsConnected = false
    setTimeout(connectBinance, 5000)  // reconnect
  })
  ws.on('error', () => ws.close())
}

connectBinance()

// ── The Engine ──────────────────────────────────
const SPREAD_BPS = 15  // maker's target spread

const engine: MakerEngine = {

  async getLevels(): Promise<PriceLevels> {
    if (!wsConnected || liveRate === 0) {
      return { sellLevels: [], buyLevels: [] }
    }

    const sellRate = liveRate * (1 - SPREAD_BPS / 10000)
    const buyRate  = (1/liveRate) * (1 - SPREAD_BPS / 10000)

    return {
      sellLevels: [
        { quantity: '100000000',  price: sellRate.toFixed(8) },
        { quantity: '1000000000', price: (sellRate * 0.999).toFixed(8) }
      ],
      buyLevels: [
        { quantity: '100000000',  price: buyRate.toFixed(8) },
        { quantity: '1000000000', price: (buyRate * 0.999).toFixed(8) }
      ]
    }
  },

  async getQuote(ctx: RfqContext): Promise<string | null> {
    if (!wsConnected || liveRate === 0) return null

    const rate = ctx.tokenInSymbol === 'USDC'
      ? liveRate : 1 / liveRate

    const effectiveRate = rate
      * (1 - SPREAD_BPS / 10000)
      * (1 - ctx.feesBps * 0.0001)

    const amountOut = Math.floor(
      ctx.amountInHuman * effectiveRate * 1e7
    )

    return amountOut > 0 ? amountOut.toString() : null
  },

  async onTradeConfirmed(trade) {
    console.log(
      `[Binance Engine] Trade confirmed: ${trade.txHash}`
    )
    // Could trigger rebalancing here
  }
}

export default engine

// Run with:
// npm run dev hog --engine=./examples/binance-engine.ts

=======================================================
STEP 7 — Documentation
=======================================================

FILE: maker-sdk/CUSTOM_ENGINE.md

# Building a Custom Pricing Engine

HyperDEX supports custom pricing engines.
You write the pricing logic.
The SDK handles WebSocket, signing, and Soroban.

## Quick Start

Create a file my-engine.ts:

\`\`\`typescript
import { MakerEngine } from 'hyperdex-maker-sdk'

const engine: MakerEngine = {

  async getLevels() {
    // Return your price levels
    // Called every 3 seconds
    return {
      sellLevels: [{ quantity: '100000000', price: '0.85900000' }],
      buyLevels:  [{ quantity: '100000000', price: '1.16400000' }]
    }
  },

  async getQuote(ctx) {
    // ctx.amountInHuman = trade amount in human units
    // ctx.tokenInSymbol = 'USDC' or 'EURC'
    // ctx.feesBps = protocol fee (e.g. 10 = 0.10%)
    // Return amountOut in stroops
    // Return null to skip this trade
    
    const myRate = 0.8590
    const feeAdj = 1 - (ctx.feesBps * 0.0001)
    const out = Math.floor(
      ctx.amountInHuman * myRate * feeAdj * 1e7
    )
    return out.toString()
  }
}

export default engine
\`\`\`

Start with your engine:
  npm run dev yourname --engine=./my-engine.ts

## What You Can Do in an Engine

- Connect to any price feed (Binance, Coinbase, your own)
- Use any pricing model (ML model, CEX arbitrage, fixed)
- Refuse specific trades (return null)
- Track your own inventory
- Trigger hedging after confirmed trades
- Apply any spread logic you want

## What the SDK Handles For You

- WebSocket connection to HyperDEX backend
- Authentication with your API key
- ed25519 quote signing
- Soroban transaction building
- Trade confirmation polling

=======================================================
BUILD ORDER
=======================================================

1. Create src/types/MakerEngine.ts
2. Create src/engines/default-engine.ts
   (move existing logic here, same behavior)
3. Update src/server.ts
   (detect --engine flag, load engine, export it)
4. Update src/ws-client.ts
   (call engine.getLevels() and engine.getQuote())
5. Create examples/binance-engine.ts
   (working example with live Binance feed)
6. Create CUSTOM_ENGINE.md
7. Test default mode:
   npm run dev hog
   Verify: same behavior as before, banner shows
   "Engine: Built-in (spread-based)"
8. Test custom engine:
   npm run dev hog --engine=./examples/binance-engine.ts
   Verify: banner shows "Engine: binance-engine.ts [custom]"
   Verify: price levels update with Binance data
9. Test refusal:
   In a custom engine, return null from getQuote()
   Verify: SDK sends rfqError, maker not penalized


## After Building

TIER 1 — Beginners (default engine):
  npm run dev hog
  Set spread number
  Oracle handles everything
  Anyone can do this

TIER 2 — Intermediate (custom engine with Binance):
  npm run dev hog --engine=./binance-engine.ts
  Live prices from Binance WebSocket
  Sub-second price updates
  Any developer can do this

TIER 3 — Professional (full custom engine):
  npm run dev hog --engine=./wintermute-engine.ts
  Multiple CEX feeds aggregated
  Inventory management built in
  Volatility-adjusted spreads
  Automated hedging triggers
  What institutional firms would build   