import { describe, expect, it } from 'vitest'
import { getPerformanceQuote, performanceQuotePools } from './performanceQuotes'

describe('performance quote pools', () => {
  it.each(['home', 'checkIn', 'checkout'])('contains 60 unique %s lines', (surface) => {
    expect(performanceQuotePools[surface]).toHaveLength(60)
    expect(new Set(performanceQuotePools[surface]).size).toBe(60)
  })

  it('selects deterministically for a surface and date', () => {
    expect(getPerformanceQuote('home', '2026-08-09')).toBe(getPerformanceQuote('home', '2026-08-09'))
  })

  it('cycles through each complete pool over 60 days', () => {
    const quotes = Array.from({ length: 60 }, (_, index) => getPerformanceQuote('checkIn', new Date(2026, 0, index + 1)))
    expect(new Set(quotes).size).toBe(60)
  })
})
