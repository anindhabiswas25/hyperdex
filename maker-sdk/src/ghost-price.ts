export let GHOST_PRICE_USDC_TO_EURC: number = 0
export let GHOST_PRICE_EURC_TO_USDC: number = 0

export function setGhostPrice(usdcToEurc: number): void {
  GHOST_PRICE_USDC_TO_EURC = usdcToEurc
  GHOST_PRICE_EURC_TO_USDC = usdcToEurc > 0 ? 1 / usdcToEurc : 0
}
