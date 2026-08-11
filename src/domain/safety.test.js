import { describe, expect, it } from 'vitest'
import { evaluateSafety, hasStopFinding } from './safety'

describe('safety findings', () => {
  it('stops for concerning neurological symptoms', () => expect(hasStopFinding(evaluateSafety({ painType: 'Numbness' }))).toBe(true))
  it('does not invent findings for a clean report', () => expect(evaluateSafety({ pain: 0, fatigue: 1 })).toEqual([]))
})
