import { describe, expect, it } from 'vitest'
import { estimatePlannedMinutes, isEventActionable, isRestDayEvent } from './events'

describe('event workload boundaries', () => {
  it.each([['Low', 35], ['Medium', 60], ['High', 90]])('maps %s load to planned minutes', (load, minutes) => {
    expect(estimatePlannedMinutes(load)).toBe(minutes)
  })

  it('never treats a rest day as actionable', () => {
    const event = { type: 'Rest day' }
    expect(isRestDayEvent(event)).toBe(true)
    expect(isEventActionable(event)).toBe(false)
  })
})
