import { describe, expect, it } from 'vitest'
import { isTournamentSummaryVisible } from './tournamentVisibility'

describe('tournament summary visibility', () => {
  const tournament = { startDate: '2026-08-15', endDate: '2026-08-17' }

  it('appears the day before and throughout the tournament', () => {
    expect(isTournamentSummaryVisible(tournament, '2026-08-14')).toBe(true)
    expect(isTournamentSummaryVisible(tournament, '2026-08-17')).toBe(true)
  })

  it('disappears as soon as the tournament date range is over', () => {
    expect(isTournamentSummaryVisible(tournament, '2026-08-18')).toBe(false)
  })
})
