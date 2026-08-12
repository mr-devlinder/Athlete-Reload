import { describe, expect, it } from 'vitest'
import { getEventFormSchema } from './eventFormSchema'

describe('event form schemas', () => {
  it('hides irrelevant surface and position inputs for gym and swimming', () => {
    expect(getEventFormSchema({ type: 'Gym session' }, { sport: 'Soccer', position: 'Midfielder' })).toMatchObject({ showSurface: false, showPosition: false })
    expect(getEventFormSchema({ type: 'Swimming' }, { sport: 'Swimming' })).toMatchObject({ showSurface: false, showPosition: false })
  })

  it('shows structured terrain and subtype choices for running', () => {
    const schema = getEventFormSchema({ type: 'Run' }, { sport: 'Running' })
    expect(schema.showSurface).toBe(true)
    expect(schema.surfaceLabel).toMatch(/terrain/)
    expect(schema.subtypeOptions).toContain('Intervals')
  })

  it('reuses a known field position for team-sport events', () => {
    const schema = getEventFormSchema({ type: 'Team practice' }, { sport: 'Soccer', position: 'Midfielder' })
    expect(schema.showPosition).toBe(true)
    expect(schema.profilePosition).toBe('Midfielder')
  })
})
