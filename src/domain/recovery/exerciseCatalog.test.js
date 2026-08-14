import { describe, expect, it } from 'vitest'
import { MOBILITY_MOVEMENTS, estimateExerciseSeconds, getMovementById } from './exerciseCatalog'
import {
  buildDeterministicMobilityRoutine,
  expandUnilateralMovement,
  filterMovementCatalog,
  replaySavedMobilityRoutine,
  validateGeneratedRoutine,
} from './routineBuilder'

describe('canonical mobility catalog', () => {
  it('contains one structured canonical record per stable ID', () => {
    expect(MOBILITY_MOVEMENTS.length).toBeGreaterThanOrEqual(320)
    expect(new Set(MOBILITY_MOVEMENTS.map((movement) => movement.id)).size).toBe(MOBILITY_MOVEMENTS.length)
    expect(getMovementById('hip_90_90_switch')?.instructions).toContain('Lower both knees')
    for (const movement of MOBILITY_MOVEMENTS) {
      expect(movement.name).toBeTruthy()
      expect(movement.categories.length).toBeGreaterThan(0)
      expect(movement.routineTypes.length).toBeGreaterThan(0)
      expect(movement.bodyRegions.length).toBeGreaterThan(0)
      expect(movement.instructions.length).toBeGreaterThan(20)
      expect(movement.instructions).not.toMatch(/stand or set up securely|set up securely for/i)
      expect(movement.instructions.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBeLessThanOrEqual(2)
      expect(movement.shouldFeel.length).toBeGreaterThan(0)
      expect(movement.avoid.length).toBeGreaterThan(0)
    }
  })

  it('keeps no-equipment floor movements eligible and adds band work only when selected', () => {
    const none = filterMovementCatalog({ routineType: 'full_body', equipmentAvailable: [] })
    const noneIds = new Set(none.map((movement) => movement.id))
    expect(noneIds.has('glute_bridge')).toBe(true)
    expect(noneIds.has('dead_bug')).toBe(true)
    expect(noneIds.has('open_book')).toBe(true)
    expect(none.some((movement) => movement.equipment.includes('resistance_band'))).toBe(false)

    const withBand = filterMovementCatalog({ routineType: 'full_body', equipmentAvailable: ['resistance_band'] })
    expect(withBand.some((movement) => movement.equipment.includes('resistance_band'))).toBe(true)
    expect(withBand.some((movement) => movement.id === 'glute_bridge')).toBe(true)
  })

  it('counts unilateral sides and repetition tempo', () => {
    const unilateral = getMovementById('open_book')
    const bilateral = getMovementById('cat_cow')
    expect(unilateral.unilateral).toBe(true)
    expect(estimateExerciseSeconds(unilateral, 0)).toBeGreaterThan(estimateExerciseSeconds(bilateral, 0))
  })

  it('expands unilateral work into distinct left and right routine steps', () => {
    const steps = expandUnilateralMovement(getMovementById('open_book'))
    expect(steps.map((movement) => movement.side)).toEqual(['Left', 'Right'])
    expect(steps.map((movement) => `${movement.id}:${movement.side.toLowerCase()}`)).toEqual(['open_book:left', 'open_book:right'])
  })

  it('rejects an unknown movement ID instead of trusting generated content', () => {
    const result = validateGeneratedRoutine({ routine: { exercises: [{ movementId: 'invented_movement' }] } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('unknown_movement:invented_movement')
  })
})

describe('mobility routine rules', () => {
  it.each([5, 10])('fits a %i-minute routine within ten percent', (minutes) => {
    const target = minutes * 60
    const routine = buildDeterministicMobilityRoutine({ routineType: 'full_body', requestedDurationSeconds: target })
    expect(routine.estimatedDurationSeconds).toBeGreaterThanOrEqual(target * 0.9)
    expect(routine.estimatedDurationSeconds).toBeLessThanOrEqual(target * 1.1)
  })

  it('keeps warm-up dynamic, light recovery non-plyometric, and lower body focused', () => {
    const warmUp = buildDeterministicMobilityRoutine({ routineType: 'warm_up', requestedDurationSeconds: 600 })
    const staticHolds = warmUp.exercises.filter((movement) => movement.prescriptionType === 'time' && movement.prescription.durationSeconds >= 30)
    expect(staticHolds.length).toBeLessThanOrEqual(Math.floor(warmUp.exercises.length / 3))

    const light = buildDeterministicMobilityRoutine({ routineType: 'light_recovery', requestedDurationSeconds: 600 })
    expect(light.exercises.every((movement) => !movement.categories.includes('plyometrics'))).toBe(true)
    expect(light.exercises.some((movement) => movement.prescriptionType === 'time')).toBe(true)

    const lower = buildDeterministicMobilityRoutine({ routineType: 'lower_body', requestedDurationSeconds: 600 })
    expect(lower.exercises.filter((movement) => movement.routineTypes.includes('lower_body')).length / lower.exercises.length).toBeGreaterThanOrEqual(0.65)
    expect(lower.exercises.some((movement) => movement.prescriptionType === 'time')).toBe(true)
  })

  it('excludes pain-sensitive regions', () => {
    const eligible = filterMovementCatalog({ routineType: 'lower_body', painSensitiveRegions: ['hamstrings'] })
    expect(eligible.every((movement) => !movement.painSensitiveRegions.includes('hamstrings'))).toBe(true)
  })

  it('replays a saved routine without regenerating or changing prescriptions', () => {
    const saved = { id: 'saved-1', routine: { routineName: 'Exact replay', exercises: [{ movementId: 'cat_cow', prescription: { type: 'reps', reps: 7, sets: 1, restSeconds: 0 } }, { movementId: 'open_book', prescription: { type: 'reps', reps: 4, sets: 1, restSeconds: 0 } }] } }
    const replay = replaySavedMobilityRoutine(saved)
    expect(replay).toEqual(saved.routine)
    expect(replay).not.toBe(saved.routine)
  })
})
