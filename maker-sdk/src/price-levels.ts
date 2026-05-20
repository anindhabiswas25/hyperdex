import { GHOST_PRICE_USDC_TO_EURC, GHOST_PRICE_EURC_TO_USDC } from './ghost-price'

export interface PriceLevelMessage {
  tokenIn:    string
  tokenOut:   string
  buyLevels:  { quantity: string; price: string }[]
  sellLevels: { quantity: string; price: string }[]
}

export function buildPriceLevels(
  baseToken:    string,
  quoteToken:   string,
  vaultBalance: { usdc: number; eurc: number }
): PriceLevelMessage {
  const sellRate = GHOST_PRICE_USDC_TO_EURC  // USDC→EURC: maker sells EURC
  const buyRate  = GHOST_PRICE_EURC_TO_USDC  // EURC→USDC: maker sells USDC

  const maxSellLiquidity = vaultBalance.eurc * 0.8
  const maxBuyLiquidity  = vaultBalance.usdc * 0.8

  const sellLevels = buildTiers(sellRate, maxSellLiquidity)
  const buyLevels  = buildTiers(buyRate,  maxBuyLiquidity)

  return { tokenIn: baseToken, tokenOut: quoteToken, sellLevels, buyLevels }
}

function buildTiers(
  rate:         number,
  maxLiquidity: number
): { quantity: string; price: string }[] {
  if (maxLiquidity <= 0 || rate <= 0) return []

  const tiers = [
    { maxAmount: 10   },
    { maxAmount: 100  },
    { maxAmount: 500  },
    { maxAmount: 5000 },
  ]

  const levels: { quantity: string; price: string }[] = []
  let cumulative = 0

  for (const tier of tiers) {
    const size = Math.min(tier.maxAmount - cumulative, maxLiquidity - cumulative)
    if (size <= 0) break

    levels.push({
      quantity: Math.floor(size * 1e7).toString(),
      price:    rate.toFixed(8),
    })

    cumulative += size
    if (cumulative >= maxLiquidity) break
  }

  return levels
}
