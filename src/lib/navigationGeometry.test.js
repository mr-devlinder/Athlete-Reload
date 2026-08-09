import { describe, expect, it } from 'vitest'
import { getNavigationLensState, getNearestNavigationItem } from './navigationGeometry'

const items = [
  { height: 56, label: 'Home', left: 10, width: 50 },
  { height: 56, label: 'Nutrition', left: 62, width: 70 },
  { height: 56, label: 'Recovery', left: 134, width: 54 },
]

describe('navigation geometry', () => {
  it('selects the nearest tab center', () => {
    expect(getNearestNavigationItem(items, 120).label).toBe('Nutrition')
    expect(getNearestNavigationItem(items, 180).label).toBe('Recovery')
  })

  it('keeps the lens inside the navigation bounds', () => {
    expect(getNavigationLensState({ left: 10, width: 178, height: 64 }, items, -20).left).toBe(25)
    expect(getNavigationLensState({ left: 10, width: 178, height: 64 }, items, 300).left).toBe(151)
  })

  it('returns no state when no tabs are available', () => {
    expect(getNavigationLensState({ left: 0, width: 100, height: 50 }, [], 20)).toBeNull()
  })
})
