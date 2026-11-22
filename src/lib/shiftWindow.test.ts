import { describe, expect, it } from 'vitest'
import {
  PRICE_CURVES,
  findOptimalWindow,
  formatEur,
  formatHour,
  formatWindowRange,
} from './shiftWindow'

describe('PRICE_CURVES', () => {
  it('defines 24 hourly prices for Sunny Weekday with a negative midday dip', () => {
    const curve = PRICE_CURVES['sunny-weekday']
    expect(curve.prices).toHaveLength(24)
    expect(Math.min(...curve.prices)).toBeLessThan(0)
    expect(curve.prices[13]).toBeLessThan(0)
  })

  it('defines 24 hourly prices for Winter Peak with cheap night and expensive peaks', () => {
    const curve = PRICE_CURVES['winter-peak']
    expect(curve.prices).toHaveLength(24)
    const nightAvg = (curve.prices[1] + curve.prices[2] + curve.prices[3] + curve.prices[4]) / 4
    const morningAvg = (curve.prices[7] + curve.prices[8] + curve.prices[9]) / 3
    const eveningAvg = (curve.prices[17] + curve.prices[18] + curve.prices[19]) / 3
    expect(nightAvg).toBeLessThan(morningAvg)
    expect(nightAvg).toBeLessThan(eveningAvg)
  })
})

describe('findOptimalWindow', () => {
  it('finds the negative midday block on Sunny Weekday for default 4h / 5MW', () => {
    const result = findOptimalWindow(PRICE_CURVES['sunny-weekday'].prices, 4, 5)
    expect(result.startHour).toBe(12)
    expect(result.endHour).toBe(16)
    // (-12 - 28 - 24 - 6) * 5 = -350
    expect(result.totalCostEur).toBe(-350)
    // baseline 09:00-13:00: (96 + 62 + 18 - 12) * 5 = 820
    expect(result.baselineCostEur).toBe(820)
    expect(result.savingsEur).toBe(1170)
    expect(result.savingsPercent).toBeCloseTo((1170 / 820) * 100, 5)
  })

  it('finds the overnight block on Winter Peak for default 4h / 5MW', () => {
    const result = findOptimalWindow(PRICE_CURVES['winter-peak'].prices, 4, 5)
    expect(result.startHour).toBe(1)
    expect(result.endHour).toBe(5)
    // (48 + 44 + 42 + 46) * 5 = 900
    expect(result.totalCostEur).toBe(900)
    // baseline 09:00-13:00: (168 + 152 + 142 + 136) * 5 = 2990
    expect(result.baselineCostEur).toBe(2990)
    expect(result.savingsEur).toBe(2090)
    expect(result.savingsPercent).toBeCloseTo((2090 / 2990) * 100, 5)
  })

  it('handles 1-hour and 8-hour boundary durations', () => {
    const oneHour = findOptimalWindow(PRICE_CURVES['sunny-weekday'].prices, 1, 1)
    expect(oneHour.startHour).toBe(13)
    expect(oneHour.endHour).toBe(14)
    expect(oneHour.totalCostEur).toBe(-28)

    const eightHours = findOptimalWindow(PRICE_CURVES['winter-peak'].prices, 8, 10)
    expect(eightHours.startHour).toBe(0)
    expect(eightHours.endHour).toBe(8)
    expect(eightHours.endHour - eightHours.startHour).toBe(8)
  })

  it('allows a window reaching the end of the day (20:00 - 24:00)', () => {
    const prices = Array.from({ length: 24 }, (_, h) => (h >= 20 ? 10 : 100))
    const result = findOptimalWindow(prices, 4, 2)
    expect(result.startHour).toBe(20)
    expect(result.endHour).toBe(24)
    expect(result.totalCostEur).toBe(80)
  })

  it('breaks ties by selecting the earliest start hour', () => {
    const flatPrices = Array(24).fill(50)
    const result = findOptimalWindow(flatPrices, 4, 5)
    expect(result.startHour).toBe(0)
    expect(result.endHour).toBe(4)
    expect(result.savingsEur).toBe(0)
    expect(result.savingsPercent).toBe(0)
  })

  it('returns null savingsPercent when 09:00 baseline cost is zero or negative', () => {
    const zeroPrices = Array(24).fill(0)
    const zeroResult = findOptimalWindow(zeroPrices, 4, 5)
    expect(zeroResult.savingsEur).toBe(0)
    expect(zeroResult.savingsPercent).toBeNull()

    const negativePrices = Array(24).fill(-20)
    const negResult = findOptimalWindow(negativePrices, 4, 5)
    expect(negResult.savingsEur).toBe(0)
    expect(negResult.savingsPercent).toBeNull()
  })

  it('scales total cost and savings linearly with power draw', () => {
    const at1Mw = findOptimalWindow(PRICE_CURVES['winter-peak'].prices, 3, 1)
    const at7Mw = findOptimalWindow(PRICE_CURVES['winter-peak'].prices, 3, 7)
    expect(at7Mw.startHour).toBe(at1Mw.startHour)
    expect(at7Mw.totalCostEur).toBeCloseTo(at1Mw.totalCostEur * 7, 5)
    expect(at7Mw.savingsEur).toBeCloseTo(at1Mw.savingsEur * 7, 5)
    expect(at7Mw.savingsPercent).toBeCloseTo(at1Mw.savingsPercent!, 5)
  })

  it('throws on invalid inputs', () => {
    const prices = PRICE_CURVES['sunny-weekday'].prices
    expect(() => findOptimalWindow(prices, 0, 5)).toThrow()
    expect(() => findOptimalWindow(prices, 25, 5)).toThrow()
    expect(() => findOptimalWindow(prices, 4, 0)).toThrow()
    expect(() => findOptimalWindow([10, 20], 4, 5)).toThrow()
  })
})

describe('formatting helpers', () => {
  it('formats hours and window ranges with leading zeros', () => {
    expect(formatHour(0)).toBe('00:00')
    expect(formatHour(9)).toBe('09:00')
    expect(formatHour(24)).toBe('24:00')
    expect(formatWindowRange(12, 16)).toBe('12:00 - 16:00')
    expect(formatWindowRange(1, 5)).toBe('01:00 - 05:00')
  })

  it('formats positive, negative, and zero Euro values cleanly', () => {
    expect(formatEur(1420)).toBe('€1,420')
    expect(formatEur(-350)).toBe('-€350')
    expect(formatEur(0)).toBe('€0')
    expect(formatEur(-0)).toBe('€0')
  })
})
