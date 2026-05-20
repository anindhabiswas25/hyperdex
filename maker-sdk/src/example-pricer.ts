import chalk from 'chalk'
import { priceOracle } from './oracle'
import { inventoryChecker } from './inventory-checker'
import { GHOST_PRICE_USDC_TO_EURC, GHOST_PRICE_EURC_TO_USDC } from './ghost-price'

export interface RfqContext {
  rfqId: string
  takerAddress: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  feesBps: number
  requestedAt: number
  midRate: number
  volatility: number
  vaultBalance: { usdc: number; eurc: number }
}

export interface PricingDecision {
  shouldQuote: boolean
  amountOut?: string
  spread?: number
  ghostRate?: number
  reason?: string
  expiryTimestampMs?: number
}

export function getTokenSymbol(address: string): string {
  const usdc = process.env.USDC_CONTRACT || process.env.USDC_CONTRACT_ADDRESS || ''
  return address === usdc ? 'USDC' : 'EURC'
}

export function formatAmount(stroops: string, tokenAddress: string): string {
  return `${(Number(stroops) / 1e7).toFixed(7)} ${getTokenSymbol(tokenAddress)}`
}

export async function makePricingDecision(ctx: RfqContext): Promise<PricingDecision> {
  // STEP 1: Ghost price must be set
  if (GHOST_PRICE_USDC_TO_EURC <= 0) {
    console.warn('[Pricer] Ghost price not set')
    return { shouldQuote: false, reason: 'market_conditions' }
  }

  // STEP 2: Oracle must not be completely dead
  if (priceOracle.isStale()) {
    return { shouldQuote: false, reason: 'market_conditions' }
  }

  // STEP 3: Determine ghost rate for this direction
  const USDC = process.env.USDC_CONTRACT || process.env.USDC_CONTRACT_ADDRESS || ''
  const EURC = process.env.EURC_CONTRACT || process.env.EURC_CONTRACT_ADDRESS || ''

  let ghostRatePerUnit: number

  if (ctx.tokenIn === USDC && ctx.tokenOut === EURC) {
    ghostRatePerUnit = GHOST_PRICE_USDC_TO_EURC
  } else if (ctx.tokenIn === EURC && ctx.tokenOut === USDC) {
    ghostRatePerUnit = GHOST_PRICE_EURC_TO_USDC
  } else {
    return { shouldQuote: false, reason: 'pair_not_supported' }
  }

  // STEP 4: Calculate amountOut
  const amountInHuman = Number(ctx.amountIn) / 1e7
  const feeMultiplier = 1 - (ctx.feesBps * 0.0001)
  const amountOutHuman = amountInHuman * ghostRatePerUnit * feeMultiplier
  const amountOutStroops = Math.floor(amountOutHuman * 1e7)

  if (amountOutStroops <= 0) {
    return { shouldQuote: false, reason: 'calculation_error' }
  }

  // STEP 5: Check inventory
  const inventoryCheck = await inventoryChecker.canFill(ctx.tokenOut, amountOutStroops)

  if (!inventoryCheck.canFill) {
    console.log(
      chalk.yellow(
        `[Pricer] Skipping: insufficient inventory` +
        ` (need ${amountOutHuman.toFixed(4)},` +
        ` have ${inventoryCheck.balance.toFixed(4)})`
      )
    )
    return { shouldQuote: false, reason: 'insufficient_liquidity' }
  }

  // STEP 6: Log and return
  console.log(
    chalk.gray('[Pricer] Ghost: ') +
    chalk.yellow(`${ghostRatePerUnit.toFixed(6)}`) +
    chalk.gray(` × ${amountInHuman.toFixed(4)}`) +
    chalk.gray(` × fee(${ctx.feesBps}bps)`) +
    chalk.gray(' = ') +
    chalk.green(`${amountOutHuman.toFixed(6)} ${getTokenSymbol(ctx.tokenOut)}`)
  )

  return {
    shouldQuote: true,
    amountOut:  amountOutStroops.toString(),
    ghostRate:  ghostRatePerUnit,
    spread:     0,
  }
}
