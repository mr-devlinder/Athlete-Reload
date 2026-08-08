import { describe, expect, it } from 'vitest'
import {
  centimetersToInches,
  fluidOuncesToMilliliters,
  inchesToCentimeters,
  kilogramsToPounds,
  millilitersToFluidOunces,
  poundsToKilograms,
  workloadInputToCanonical,
} from './units'

describe('canonical unit conversion', () => {
  it.each([
    [poundsToKilograms, kilogramsToPounds, 185],
    [inchesToCentimeters, centimetersToInches, 72],
    [fluidOuncesToMilliliters, millilitersToFluidOunces, 64],
  ])('round-trips measurements', (toCanonical, fromCanonical, value) => {
    expect(fromCanonical(toCanonical(value))).toBeCloseTo(value, 8)
  })

  it('normalizes imperial workload distance to meters', () => {
    expect(workloadInputToCanonical({ measurement: 'distance' }, 1, 'imperial')).toBeCloseTo(1609.344)
  })
})
