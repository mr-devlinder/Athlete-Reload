import { describe, expect, it } from 'vitest'
import { compareEventsChronologically, EVENT_SEMANTICS, getEventSemanticType } from './eventSemantics'

describe('semantic event behavior', () => {
  it('orders all-day context first, then occurrence time', () => {
    const events = [
      { id: 'evening', date: '2026-08-12', time: '7:15 PM', type: 'Team practice' },
      { id: 'afternoon', date: '2026-08-12', time: '1:00 PM', type: 'Gym session' },
      { id: 'rest', date: '2026-08-12', time: '', type: 'Rest Day', allDay: true },
    ]
    expect(events.sort(compareEventsChronologically).map((event) => event.id)).toEqual(['rest', 'afternoon', 'evening'])
  })

  it('uses one complete semantic mapping', () => {
    expect(getEventSemanticType({ type: 'Game' })).toBe('competition')
    expect(getEventSemanticType({ type: 'Gym session' })).toBe('personal_training')
    expect(Object.keys(EVENT_SEMANTICS)).toEqual(['competition', 'team_training', 'personal_training', 'recovery', 'rest', 'general'])
  })
})
