import { describe, expect, it } from 'vitest'
import { getAthleteInsights } from './insights'

describe('athlete insights', () => {
  it('suppresses insights without enough evidence', () => {
    expect(getAthleteInsights({ history: [{ date: '2026-08-01', sleep: 5, score: 50 }] })).toEqual([])
  })

  it('reports an association with sample context', () => {
    const history = [
      ...Array.from({ length: 3 }, (_, index) => ({ date: `2026-08-0${index + 1}`, sleep: 6, score: 60 })),
      ...Array.from({ length: 3 }, (_, index) => ({ date: `2026-08-0${index + 4}`, sleep: 8, score: 82 })),
    ]
    const [insight] = getAthleteInsights({ history })
    expect(insight.sampleSize).toBe(6)
    expect(insight.summary).toContain('not proof of cause')
  })

  it('qualifies a repeated planned-versus-actual difference', () => {
    const checkouts = Array.from({ length: 4 }, (_, index) => ({ date: `2026-08-0${index + 1}`, plannedMinutes: 60, actualMinutes: 90, difficulty: 5 }))
    const [insight] = getAthleteInsights({ checkouts })
    expect(insight.id).toBe('planned-actual-duration')
    expect(insight.sampleSize).toBe(4)
    expect(insight.summary).toContain('does not identify a cause')
  })
})
