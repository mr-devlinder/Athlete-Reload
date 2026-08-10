import { describe, expect, it } from 'vitest'
import { getNavigationDragLensState, getNavigationLensState, getNearestNavigationItem, hasNavigationDragStarted } from './navigationGeometry'

const items = [
  { height: 56, label: 'Home', left: 10, width: 50 },
  { height: 56, label: 'Nutrition', left: 62, width: 70 },
  { height: 56, label: 'Recovery', left: 134, width: 54 },
]

describe('navigation geometry', () => {
  it('starts dragging only after the movement threshold', () => {
    expect(hasNavigationDragStarted(100, 105)).toBe(false)
    expect(hasNavigationDragStarted(100, 94)).toBe(true)
    expect(hasNavigationDragStarted(100, 106)).toBe(true)
  })

  it('selects the nearest tab center', () => {
    expect(getNearestNavigationItem(items, 120).label).toBe('Nutrition')
    expect(getNearestNavigationItem(items, 180).label).toBe('Recovery')
  })

  it('changes destinations only after crossing the midpoint between item centers', () => {
    expect(getNearestNavigationItem(items, 66).label).toBe('Home')
    expect(getNearestNavigationItem(items, 67).label).toBe('Nutrition')
    expect(getNearestNavigationItem(items, 129).label).toBe('Nutrition')
    expect(getNearestNavigationItem(items, 130).label).toBe('Recovery')
  })

  it('snaps the lens to the nearest item center inside the navigation', () => {
    expect(getNavigationLensState({ left: 10, width: 178, height: 64 }, items, -20).left).toBe(25)
    expect(getNavigationLensState({ left: 10, width: 178, height: 64 }, items, 300).left).toBe(151)
    expect(getNavigationLensState({ left: 10, width: 178, height: 64 }, items, 120).left).toBe(87)
  })

  it('moves the drag lens continuously while keeping it inside the navigation', () => {
    const navRect = { left: 10, width: 178, height: 64 }
    expect(getNavigationDragLensState(navRect, items, 80).left).toBe(70)
    expect(getNavigationDragLensState(navRect, items, -20).left).toBe(25)
    expect(getNavigationDragLensState(navRect, items, 300).left).toBe(151)
  })

  it('keeps a fixed drag lens size across differently sized tabs', () => {
    const navRect = { left: 10, width: 178, height: 64 }
    const lensSize = { width: 70, height: 56 }
    expect(getNavigationDragLensState(navRect, items, 30, lensSize).width).toBe(70)
    expect(getNavigationDragLensState(navRect, items, 170, lensSize).width).toBe(70)
    expect(getNavigationDragLensState(navRect, items, -20, lensSize).left).toBe(35)
    expect(getNavigationDragLensState(navRect, items, 300, lensSize).left).toBe(143)
  })

  it('uses cached item dimensions without changing slot widths', () => {
    const navRect = { left: 10, width: 178, height: 64 }
    expect(getNavigationLensState(navRect, items, 70).width).toBe(70)
    expect(getNavigationLensState(navRect, items, 120).width).toBe(70)
    expect(items.map((item) => item.width)).toEqual([50, 70, 54])
  })

  it('returns no state when no tabs are available', () => {
    expect(getNavigationLensState({ left: 0, width: 100, height: 50 }, [], 20)).toBeNull()
  })
})
