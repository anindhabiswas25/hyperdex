Rebuild the HyperDEX maker SDK so that:

1. On startup, maker types their ghost price ONCE
2. Every RFQ is automatically bid at that ghost price
3. No manual approval per trade — fully automatic
4. Multiple makers compete simultaneously
5. Best ghost price wins the auction
6. No --auto flag needed — this IS the only mode

=======================================================
WHAT GHOST PRICE MEANS
=======================================================

Ghost price = the rate the maker commits to offer
for EVERY trade until they restart the SDK.

Example:
  Live market rate: 1 USDC = 0.8612 EURC
  Maker sets ghost: 1 USDC = 0.87 EURC

  Ghost price is BETTER than market for the trader.
  Maker earns less spread but wins more bids.

  OR:
  Maker sets ghost: 1 USDC = 0.85 EURC
  Ghost price is WORSE than market for the trader.
  Maker earns more spread but may lose to other makers.

The maker sets this once based on their strategy.
The system uses it for every trade automatically.

Ghost price is per unit of tokenIn.
For USDC→EURC: ghost price = EURC per USDC
For EURC→USDC: ghost price = USDC per EURC
  (SDK calculates inverse automatically)

=======================================================
PART 1 — SDK STARTUP FLOW
=======================================================

FILE: maker-sdk/src/server.ts

ON STARTUP, after loading credentials and before
connecting to backend:

  1. Show the live dashboard header
  2. Show current oracle rate
  3. Prompt maker to enter ghost price
  4. Accept input — validate it
  5. Store ghost price
  6. Connect to backend and go live

IMPLEMENTATION:

async function promptGhostPrice(): Promise<number>

  const midRate = priceOracle.getMidRate()

  console.log()
  console.log(chalk.hex('#7c3aed')(
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ))
  console.log(chalk.white.bold('  Set Your Ghost Price'))
  console.log(chalk.hex('#7c3aed')(
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ))
  console.log()
  console.log(
    chalk.gray('  Live market rate: ') +
    chalk.cyan(`1 USDC = ${midRate.toFixed(6)} EURC`)
  )
  console.log()
  console.log(
    chalk.gray('  Your ghost price is the EURC amount you') 
  )
  console.log(
    chalk.gray('  will offer per 1 USDC on every trade.')
  )
  console.log(
    chalk.gray('  Higher = better for trader = more likely to win.')
  )
  console.log()

  // Use prompts library for clean input
  const { value } = await prompts({
    type:    'text',
    name:    'value',
    message: 'Ghost price (EURC per USDC):',
    initial: midRate.toFixed(6),  // default = market rate
    validate: (v: string) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) {
        return 'Enter a valid positive number'
      }
      if (n > midRate * 1.5) {
        return `Too high (max ${(midRate * 1.5).toFixed(4)})`
      }
      if (n < midRate * 0.5) {
        return `Too low (min ${(midRate * 0.5).toFixed(4)})`
      }
      return true
    }
  })

  const ghostPrice = parseFloat(value)

  // Show confirmation
  console.log()
  const diff = ((ghostPrice - midRate) / midRate * 100)
  const diffStr = diff >= 0
    ? chalk.green(`+${diff.toFixed(3)}%`)
    : chalk.red(`${diff.toFixed(3)}%`)
  const vsMarket = diff >= 0
    ? chalk.green('better than market')
    : chalk.yellow('below market')

  console.log(
    chalk.green('  ✓ Ghost price set: ') +
    chalk.white.bold(`1 USDC = ${ghostPrice.toFixed(6)} EURC`) +
    chalk.gray(` (${diffStr} vs market, ${vsMarket})`)
  )
  console.log()

  return ghostPrice

Store ghost price globally:
  export let GHOST_PRICE_USDC_TO_EURC: number = 0
  export let GHOST_PRICE_EURC_TO_USDC: number = 0

After getting input:
  GHOST_PRICE_USDC_TO_EURC = ghostPrice
  GHOST_PRICE_EURC_TO_USDC = 1 / ghostPrice

=======================================================
PART 2 — STARTUP SEQUENCE
=======================================================

FILE: maker-sdk/src/server.ts

FULL STARTUP ORDER:

async function main() {

  // 1. Load credential file
  loadCredentials(credentialName)

  // 2. Validate required env vars
  validateEnvVars()

  // 3. Start price oracle
  await priceOracle.start()
  // Wait for first price fetch
  await waitForOracleReady()

  // 4. Load initial inventory
  await inventoryChecker.getBalance()

  // 5. Print startup header
  printStartupHeader()

  // 6. Prompt for ghost price
  GHOST_PRICE_USDC_TO_EURC = await promptGhostPrice()
  GHOST_PRICE_EURC_TO_USDC = 1 / GHOST_PRICE_USDC_TO_EURC

  // 7. Print live dashboard
  printLiveDashboard()

  // 8. Connect to backend WebSocket
  await wsClient.connect()

  // 9. Start price level streaming
  startPriceLevelStreaming()

  // 10. Start HTTP health server
  startHealthServer()

}

main()

=======================================================
PART 3 — LIVE DASHBOARD (updates every 3 seconds)
=======================================================

FILE: maker-sdk/src/server.ts

After ghost price is set, the terminal shows a
live dashboard that updates every 3 seconds.

function printLiveDashboard(): void
  // Clear screen
  process.stdout.write('\x1B[2J\x1B[H')

  const midRate    = priceOracle.getMidRate()
  const volatility = priceOracle.getVolatility()
  const balance    = inventoryChecker.getCachedBalance()

  console.log(chalk.hex('#7c3aed')(
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ))
  console.log(
    chalk.white.bold('  HyperDEX Maker SDK') +
    '  ' + chalk.green('●') + chalk.green(' LIVE')
  )
  console.log(chalk.hex('#7c3aed')(
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ))
  console.log(
    chalk.gray('  Maker:       ') +
    chalk.white(MAKER_NAME)
  )
  console.log(
    chalk.gray('  Pool:        ') +
    chalk.cyan(POOL_ADDRESS.slice(0, 8) + '...')
  )
  console.log(chalk.hex('#7c3aed')(
    '  ─────────────────────────────────────────'
  ))
  console.log(
    chalk.gray('  Live rate:   ') +
    chalk.cyan(`1 USDC = ${midRate.toFixed(6)} EURC`)
  )
  console.log(
    chalk.gray('  Ghost price: ') +
    chalk.yellow(
      `1 USDC = ${GHOST_PRICE_USDC_TO_EURC.toFixed(6)} EURC`
    ) +
    chalk.gray(' ← your bid rate')
  )
  console.log(
    chalk.gray('  Volatility:  ') +
    chalk.white((volatility * 100).toFixed(3) + '%')
  )
  console.log(chalk.hex('#7c3aed')(
    '  ─────────────────────────────────────────'
  ))
  console.log(
    chalk.gray('  Pool USDC:   ') +
    chalk.white(balance.usdc.toFixed(4))
  )
  console.log(
    chalk.gray('  Pool EURC:   ') +
    chalk.white(balance.eurc.toFixed(4))
  )
  console.log(chalk.hex('#7c3aed')(
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ))
  console.log(
    chalk.gray('  Auto-bidding at ghost price on all RFQs...')
  )
  console.log(
    chalk.gray(
      '  Press Ctrl+C to disconnect | ' +
      'Ctrl+R to update ghost price'
    )
  )
  console.log()

// Update every 3 seconds
setInterval(printLiveDashboard, 3000)

ADD Ctrl+R to update ghost price without restart:

process.stdin.on('keypress', async (str, key) => {
  if (key.ctrl && key.name === 'c') {
    // graceful shutdown
    await gracefulShutdown()
    process.exit(0)
  }

  if (key.ctrl && key.name === 'r') {
    // Update ghost price
    console.log()
    console.log(chalk.yellow('  Updating ghost price...'))
    const newPrice = await promptGhostPrice()
    GHOST_PRICE_USDC_TO_EURC = newPrice
    GHOST_PRICE_EURC_TO_USDC = 1 / newPrice
    printLiveDashboard()
  }
})

if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
}

=======================================================
PART 4 — AUTOMATIC BIDDING USING GHOST PRICE
=======================================================

FILE: maker-sdk/src/example-pricer.ts

REPLACE the entire pricing logic with ghost price:

export async function makePricingDecision(
  ctx: RfqContext
): Promise<PricingDecision>

  // ── STEP 1: Basic validation ──
  if (GHOST_PRICE_USDC_TO_EURC <= 0) {
    console.warn('[Pricer] Ghost price not set')
    return { shouldQuote: false, reason: 'market_conditions' }
  }

  // ── STEP 2: Check oracle not completely dead ──
  if (priceOracle.isStale()) {
    return { shouldQuote: false, reason: 'market_conditions' }
  }

  // ── STEP 3: Determine ghost price for this direction ──
  const USDC = process.env.USDC_CONTRACT || ''
  const EURC = process.env.EURC_CONTRACT || ''

  let ghostRatePerUnit: number

  if (ctx.tokenIn === USDC && ctx.tokenOut === EURC) {
    // USDC → EURC: how much EURC per USDC
    ghostRatePerUnit = GHOST_PRICE_USDC_TO_EURC
  } else if (ctx.tokenIn === EURC && ctx.tokenOut === USDC) {
    // EURC → USDC: how much USDC per EURC
    ghostRatePerUnit = GHOST_PRICE_EURC_TO_USDC
  } else {
    return { shouldQuote: false, reason: 'pair_not_supported' }
  }

  // ── STEP 4: Calculate amountOut ──
  const amountInHuman = Number(ctx.amountIn) / 1e7

  // Apply fee adjustment (feesBps from backend)
  const feeMultiplier = 1 - (ctx.feesBps * 0.0001)
  const amountOutHuman = amountInHuman * ghostRatePerUnit
    * feeMultiplier
  const amountOutStroops = Math.floor(amountOutHuman * 1e7)

  if (amountOutStroops <= 0) {
    return { shouldQuote: false, reason: 'calculation_error' }
  }

  // ── STEP 5: Check inventory ──
  const inventoryCheck = await inventoryChecker.canFill(
    ctx.tokenOut,
    amountOutStroops
  )

  if (!inventoryCheck.canFill) {
    console.log(
      chalk.yellow(
        `[Pricer] Skipping: insufficient inventory` +
        ` (need ${amountOutHuman.toFixed(4)},` +
        ` have ${inventoryCheck.balance.toFixed(4)})`
      )
    )
    return {
      shouldQuote: false,
      reason: 'insufficient_liquidity'
    }
  }

  // ── STEP 6: Log and return ──
  console.log(
    chalk.gray('[Pricer] Ghost: ') +
    chalk.yellow(`${ghostRatePerUnit.toFixed(6)}`) +
    chalk.gray(` × ${amountInHuman.toFixed(4)}`) +
    chalk.gray(` × fee(${ctx.feesBps}bps)`) +
    chalk.gray(` = `) +
    chalk.green(`${amountOutHuman.toFixed(6)} ${getSymbol(ctx.tokenOut)}`)
  )

  return {
    shouldQuote: true,
    amountOut:   amountOutStroops.toString(),
    spread:      0  // ghost price has no spread concept
  }

=======================================================
PART 5 — PRICE LEVELS USE GHOST PRICE
=======================================================

FILE: maker-sdk/src/price-levels.ts

Price levels broadcast to backend should reflect
the ghost price, not the oracle rate with spread.

UPDATE buildPriceLevels():

export function buildPriceLevels(
  baseToken:    string,
  quoteToken:   string,
  vaultBalance: { usdc: number; eurc: number }
): PriceLevelMessage

  const USDC = process.env.USDC_CONTRACT || ''

  // Use ghost price as the rate for levels
  const sellRate = GHOST_PRICE_USDC_TO_EURC  // USDC→EURC
  const buyRate  = GHOST_PRICE_EURC_TO_USDC  // EURC→USDC

  // SELL levels (maker sells EURC, trader buys EURC)
  const maxSellLiquidity = vaultBalance.eurc * 0.8
  const sellLevels = buildTiers(sellRate, maxSellLiquidity)

  // BUY levels (maker buys EURC, trader sells EURC)
  const maxBuyLiquidity = vaultBalance.usdc * 0.8
  const buyLevels = buildTiers(buyRate, maxBuyLiquidity)

  return {
    tokenIn:    baseToken,
    tokenOut:   quoteToken,
    sellLevels,
    buyLevels
  }

function buildTiers(
  rate: number,
  maxLiquidity: number
): { quantity: string; price: string }[]

  if (maxLiquidity <= 0 || rate <= 0) return []

  const tiers = [
    { maxAmount: 10   },
    { maxAmount: 100  },
    { maxAmount: 500  },
    { maxAmount: 5000 }
  ]

  const levels = []
  let cumulative = 0

  for (const tier of tiers) {
    const size = Math.min(
      tier.maxAmount - cumulative,
      maxLiquidity - cumulative
    )
    if (size <= 0) break

    levels.push({
      quantity: Math.floor(size * 1e7).toString(),
      price:    rate.toFixed(8)
      // All tiers use same ghost rate — no spread tiers
    })

    cumulative += size
    if (cumulative >= maxLiquidity) break
  }

  return levels

=======================================================
PART 6 — REMOVE OLD SPREAD-BASED PRICING
=======================================================

The old spread tier system (15bps, 20bps, 30bps, 50bps)
is completely replaced by the ghost price model.

DELETE or DISABLE from example-pricer.ts:
  - All spreadBps calculations
  - The tier-based spread logic
  - The volatility spread adjustment

The ghost price IS the maker's final offer.
No spread multiplier on top of ghost price.
Just: ghostRate × amountIn × (1 - feesBps) = amountOut

=======================================================
PART 7 — SDK TERMINAL OUTPUT DURING TRADE
=======================================================

When RFQ arrives and is auto-bid:

  [RFQ] Auto-bid  rfqId=c86f6ea2...
        1.0000 USDC → 0.8590 EURC
        Ghost rate: 0.859000 | Fee: 10bps
        Latency: 8ms

When trade is confirmed (trade push notification):

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [TRADE] ✓ CONFIRMED
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sold:     0.8590 EURC
  Received: 1.0000 USDC
  TX: ABC123...
  Pool: USDC 11.00 | EURC 9.14
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

=======================================================
PART 8 — BACKEND: DO NOT COMPLETE AUCTION EARLY
=======================================================

FILE: backend/src/rfq/AuctionStore.ts

CRITICAL: Remove early completion.
Auction ALWAYS runs full 30 seconds.
Best ghost price wins among all who responded.

REMOVE from addQuote():
  if (auction.quotes.length >= auction.makerCount) {
    this.complete(auctionId)
  }

The ONLY completion trigger is the setTimeout
in quote.ts after 30 seconds.

=======================================================
PART 9 — FRONTEND: NEVER SHOW RESULT BEFORE 30s
=======================================================

FILE: hyperdex-frontend/hooks/useAuction.ts

  const MIN_DISPLAY_WAIT_MS = 30_000  // full 30s always

  // In startPolling():
  const auctionStartTime = Date.now()

  pollRef.current = setInterval(async () => {
    const res = await fetch(
      `${BACKEND}/api/quote/result/${auctionId}`
    )
    const data = await res.json()

    // Always update quotes received count
    if (data.quotesReceived !== undefined) {
      setState(s => ({
        ...s, quotesReceived: data.quotesReceived
      }))
    }

    // NEVER show result before 30 seconds
    const elapsed = Date.now() - auctionStartTime
    if (elapsed < MIN_DISPLAY_WAIT_MS) {
      return  // keep showing collecting state
    }

    // 30s passed — now check if we have a result
    if (data.status === 'collecting') {
      // Still collecting at 30s — wait 2 more seconds
      return
    }

    // Show result
    clearInterval(pollRef.current!)
    clearInterval(collectRef.current!)

    if (data.status === 'completed' && data.bestQuote) {
      setState(s => ({
        ...s,
        status:    'completed',
        bestQuote: data.bestQuote,
        collectingSeconds: 0
      }))
      startAcceptCountdown(10)

    } else {
      setState(s => ({
        ...s,
        status: 'no_quotes',
        error:  'Makers are busy right now. Try again.'
      }))
    }

  }, 1000)  // poll every 1 second (not 2)

=======================================================
COMPLETE TIMING
=======================================================

t=0s    User clicks [Get Best Price]
        RFQ dispatched to ALL active makers
        Each maker has ghost price already set
        Backend 30s window starts

t=0-5s  All maker SDKs receive RFQ
        Auto-bid at their ghost price instantly
        SDK terminal:
          [RFQ] Auto-bid rfqId=... 1 USDC → 0.87 EURC
          [RFQ] Auto-bid rfqId=... 1 USDC → 0.86 EURC
          [RFQ] Auto-bid rfqId=... 1 USDC → 0.88 EURC

t=5s    All bids received by backend
        AuctionStore has 3 quotes
        But waits until t=30s before completing

t=30s   Backend completes auction
        Best: 0.88 EURC (highest amountOut)
        Frontend MIN_DISPLAY_WAIT_MS reached
        Best price revealed to user

t=30-40s USER DECISION (10 second window):
        User sees: "1 USDC = 0.88 EURC"
        User clicks [Swap Now]

t=38s   Freighter signs
t=43s   Stellar confirms
t=43s   ✅ Swap complete

=======================================================
BUILD ORDER
=======================================================

SDK (do first):
  1. Add GHOST_PRICE_USDC_TO_EURC global to server.ts
  2. Add promptGhostPrice() function to server.ts
  3. Add Ctrl+R handler for updating ghost price
  4. Update printLiveDashboard() to show ghost price
  5. Update example-pricer.ts to use ghost price
     (remove all old spread logic)
  6. Update price-levels.ts to use ghost price
  7. Remove rfq-input.ts (no longer needed)
  8. Test: npm run dev hog
     → Oracle loads
     → Prompt appears: "Ghost price (EURC per USDC):"
     → Type 0.87 → Enter
     → Dashboard shows ghost price
     → RFQ arrives → auto-bid at 0.87

BACKEND:
  9. Remove early completion from AuctionStore.ts
  10. Verify WINDOW_MS = 30_000
  11. Restart backend

FRONTEND:
  12. Add MIN_DISPLAY_WAIT_MS = 30_000 to useAuction.ts
  13. Change poll check: only show result after 30s
  14. Poll interval: 1000ms (not 2000ms)
  15. Restart frontend

TEST:
  16. Start SDK: npm run dev hog
      Set ghost price: 0.87
  17. Open localhost:3000/swap
      Type 1 → [Get Best Price]
  18. Watch frontend: 30s countdown runs fully
  19. Watch SDK terminal: auto-bid fires instantly
  20. At t=30s: best price revealed to user
  21. User has 10s to approve
  22. Click [Swap Now] → Freighter → confirmed

=======================================================
VERIFY CHECKLIST
=======================================================

SDK:
  □ Startup prompts for ghost price
  □ Ghost price shown in live dashboard
  □ Ctrl+R updates ghost price without restart
  □ RFQ auto-bid fires instantly at ghost price
  □ No manual Y/N prompt per trade
  □ Terminal shows: [RFQ] Auto-bid ... latency=Xms

Backend:
  □ Auction never completes before 30s
  □ Early completion code removed
  □ Best amountOut selected after 30s

Frontend:
  □ 30s countdown always runs to completion
  □ Result NEVER shown before 30s
  □ "Makers are busy" shown when no bids
  □ 10s accept timer after price reveal
  □ Swap button enabled only after best price shown