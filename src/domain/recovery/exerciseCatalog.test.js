import { describe, expect, it } from 'vitest'
import { estimateExerciseSeconds, getCatalogExercises, RECOVERY_CATEGORIES, RECOVERY_EXERCISES, resolveVettedExerciseSelections } from './exerciseCatalog'
import { buildVettedRoutine } from './routineBuilder'

describe('vetted recovery exercise catalog', () => {
  it('contains at least 120 recognizable, structured canonical movements', () => {
    expect(Object.keys(RECOVERY_EXERCISES).length).toBeGreaterThanOrEqual(120)
    expect(RECOVERY_CATEGORIES.length).toBeGreaterThanOrEqual(20)
    for (const exercise of Object.values(RECOVERY_EXERCISES)) {
      expect(exercise.id).toBeTruthy()
      expect(exercise.name).toBeTruthy()
      expect(exercise.steps.length).toBeGreaterThanOrEqual(2)
      expect(exercise.whatYouShouldFeel.length).toBeGreaterThan(0)
      expect(exercise.thingsToAvoid.length).toBeGreaterThan(0)
      expect(exercise.stopConditions.length).toBeGreaterThan(0)
      expect(['bilateral', 'each-side', 'alternating']).toContain(exercise.laterality)
      expect(['timer', 'reps']).toContain(exercise.dose.model)
      expect(Boolean(exercise.durationSeconds) && Boolean(exercise.reps)).toBe(false)
    }
    expect(new Set(Object.keys(RECOVERY_EXERCISES)).size).toBe(Object.keys(RECOVERY_EXERCISES).length)
  })

  it('rejects invented exercise selections', () => {
    expect(resolveVettedExerciseSelections([{ id: 'invented-by-model' }, { id: 'cat-cow' }]).map((item) => item.id)).toEqual(['cat-cow'])
  })

  it('counts laterality, reps, tempo, sets, rest, and transitions', () => {
    const [exercise] = getCatalogExercises(['open-book'])
    expect(estimateExerciseSeconds(exercise)).toBe(60)
  })

  it('keeps the real routine duration within the selected budget', () => {
    for (const minutes of [5, 10, 15, 20, 30]) {
      const routine = buildVettedRoutine({ availableMinutes: minutes })
      expect(routine.estimatedSeconds).toBeLessThanOrEqual(minutes * 60)
      expect(routine.exercises.length).toBeGreaterThan(0)
    }
    const tenMinuteQuick = buildVettedRoutine({ availableMinutes: 10, mode: 'quick' })
    expect(tenMinuteQuick.estimatedSeconds).toBeGreaterThanOrEqual(8 * 60)
  })

  it('filters equipment, expands laterality, and excludes pain-tagged movements', () => {
    const noEquipment = buildVettedRoutine({ availableMinutes: 10, mode: 'flexibility', availableEquipment: [] })
    expect(noEquipment.exercises.every((item) => item.equipment.every((value) => ['Mat', 'Wall', 'Doorway', 'Stable support', 'Chair or bench'].includes(value)))).toBe(true)
    const targeted = buildVettedRoutine({ availableMinutes: 10, mode: 'targeted', targetBodyParts: ['Hamstrings'], painExclusions: ['hamstring-pain'] })
    expect(targeted.exercises.every((item) => !item.painExclusions.includes('hamstring-pain'))).toBe(true)
    const sided = buildVettedRoutine({ selections: ['open-book'], availableMinutes: 5, availableEquipment: ['Exercise mat'] })
    expect(sided.exercises.filter((item) => item.id === 'open-book').map((item) => item.side)).toEqual(['Left side', 'Right side'])
  })

  it('rejects unsupported model doses and preserves an allowed catalog dose', () => {
    const [resolved] = resolveVettedExerciseSelections([{ id: 'cat-cow', dose: { model: 'reps', reps: 999, sets: 9 } }])
    expect(resolved.dose).toEqual(RECOVERY_EXERCISES['cat-cow'].doseModels[0])
  })
})
