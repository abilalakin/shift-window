export type CurveId = 'sunny-weekday' | 'winter-peak'

export interface PriceCurve {
  id: CurveId
  label: string
  description: string
  prices: readonly number[]
}

export interface OptimalWindowResult {
  startHour: number
  endHour: number
  totalCostEur: number
  baselineCostEur: number
  savingsEur: number
  savingsPercent: number | null
}

export const BASELINE_START_HOUR = 9
export const MIN_DURATION_HOURS = 1
export const MAX_DURATION_HOURS = 8
export const DEFAULT_DURATION_HOURS = 4
export const MIN_POWER_MW = 1
export const MAX_POWER_MW = 10
export const DEFAULT_POWER_MW = 5

export const PRICE_CURVES: Record<CurveId, PriceCurve> = {
  'sunny-weekday': {
    id: 'sunny-weekday',
    label: 'Sunny Weekday',
    description: 'High solar generation with negative midday prices',
    prices: [
      68, 62, 58, 55, 57, 65,
      82, 108, 118, 96, 62, 18,
      -12, -28, -24, -6, 28, 76,
      114, 132, 124, 102, 86, 74,
    ],
  },
  'winter-peak': {
    id: 'winter-peak',
    label: 'Winter Peak',
    description: 'Low overnight demand with steep morning and evening peaks',
    prices: [
      54, 48, 44, 42, 46, 58,
      94, 148, 176, 168, 152, 142,
      136, 132, 138, 146, 162, 194,
      212, 198, 166, 134, 102, 76,
    ],
  },
}

function sumWindow(prices: readonly number[], startHour: number, durationHours: number): number {
  let sum = 0
  for (let i = startHour; i < startHour + durationHours; i++) {
    sum += prices[i]
  }
  return sum
}

export function findOptimalWindow(
  prices: readonly number[],
  durationHours: number,
  powerMw: number,
): OptimalWindowResult {
  if (prices.length !== 24) {
    throw new Error('Expected 24 hourly prices')
  }
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > prices.length) {
    throw new Error('Duration must be an integer between 1 and 24 hours')
  }
  if (powerMw <= 0) {
    throw new Error('Power draw must be greater than 0 MW')
  }
  if (BASELINE_START_HOUR + durationHours > prices.length) {
    throw new Error('09:00 baseline window exceeds 24 hours')
  }

  let bestStart = 0
  let bestPriceSum = sumWindow(prices, 0, durationHours)

  for (let start = 1; start <= prices.length - durationHours; start++) {
    const windowSum = sumWindow(prices, start, durationHours)
    // Strict less-than breaks ties in favor of the earliest start hour.
    if (windowSum < bestPriceSum) {
      bestPriceSum = windowSum
      bestStart = start
    }
  }

  const totalCostEur = bestPriceSum * powerMw
  const baselineCostEur = sumWindow(prices, BASELINE_START_HOUR, durationHours) * powerMw
  const savingsEur = baselineCostEur - totalCostEur
  // Percentage savings is only meaningful against a positive baseline cost.
  const savingsPercent = baselineCostEur > 0 ? (savingsEur / baselineCostEur) * 100 : null

  return {
    startHour: bestStart,
    endHour: bestStart + durationHours,
    totalCostEur,
    baselineCostEur,
    savingsEur,
    savingsPercent,
  }
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatWindowRange(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} - ${formatHour(endHour)}`
}

export function formatEur(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return '€0'
  const sign = rounded < 0 ? '-' : ''
  const formatted = Math.abs(rounded).toLocaleString('en-US')
  return `${sign}€${formatted}`
}
