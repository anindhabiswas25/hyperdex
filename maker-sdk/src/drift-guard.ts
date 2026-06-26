// ─────────────────────────────────────────────────────────────────────────────
// Drift guard — protects a ghost-price maker from being arbitraged when the
// live market moves away from the price they set.
//
//   |drift| > 1%  → WARN  (dashboard banner, keep quoting)
//   |drift| > 3%  → PAUSE (stop quoting until the maker hits Ctrl+R to re-price)
//
// "drift" = how far the maker's ghost price sits from the current oracle mid.
// ─────────────────────────────────────────────────────────────────────────────

export const DRIFT_WARN_PCT  = 1  // warn when |drift| exceeds this (%)
export const DRIFT_PAUSE_PCT  = 3  // pause quoting when |drift| exceeds this (%)

export type DriftLevel = 'ok' | 'warn' | 'pause'

export interface DriftStatus {
  driftPct:    number   // signed %, +ve = ghost above market, -ve = below market
  absPct:      number   // |driftPct|
  level:       DriftLevel
  belowMarket: boolean
}

export function getDriftStatus(ghostPrice: number, midRate: number): DriftStatus {
  if (!ghostPrice || !midRate || midRate <= 0) {
    return { driftPct: 0, absPct: 0, level: 'ok', belowMarket: false }
  }
  const driftPct = ((ghostPrice - midRate) / midRate) * 100
  const absPct   = Math.abs(driftPct)
  let level: DriftLevel = 'ok'
  if (absPct > DRIFT_PAUSE_PCT)     level = 'pause'
  else if (absPct > DRIFT_WARN_PCT) level = 'warn'
  return { driftPct, absPct, level, belowMarket: driftPct < 0 }
}
