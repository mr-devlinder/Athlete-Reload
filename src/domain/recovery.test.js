import { describe, expect, it } from 'vitest'
import { normalizeRecoveryExercise, selectRecoveryPlanType, varyRoutineAgainstHistory } from './recovery'

describe('deterministic recovery', () => {
  it('normalizes the complete exercise contract', () => {
    const exercise = normalizeRecoveryExercise({ name: 'Calf stretch', durationSeconds: 30 })
    expect(exercise).toMatchObject({ equipment: 'None', sets: 1, side: 'Both sides' })
    expect(exercise.setup).toBeTruthy()
    expect(exercise.movement).toBeTruthy()
    expect(exercise.completionCue).toBeTruthy()
    expect(exercise.purpose).toBeTruthy()
    expect(exercise.stopConditions).toContain('Stop')
  })

  it('changes a repeated opening deterministically', () => {
    const routine = ['A', 'B', 'C', 'D'].map((name) => ({ name }))
    const varied = varyRoutineAgainstHistory(routine, [['A', 'B']], 'athlete-event')
    expect(varied.slice(0, 2).map((item) => item.name)).not.toEqual(['A', 'B'])
    expect(varied).toHaveLength(4)
  })

  it('prioritizes symptoms over turnaround', () => {
    expect(selectRecoveryPlanType({ checkout: { newPain: true }, nextEventHours: 4 })).toBe('soreness-management')
  })
})
