import { describe, expect, it } from 'vitest'
import { calculateAge, getAgeAccess } from './age'

describe('age access', () => {
  const today = new Date('2026-08-11T12:00:00')

  it('calculates age around the birthday boundary', () => {
    expect(calculateAge('2010-08-11', today)).toBe(16)
    expect(calculateAge('2010-08-12', today)).toBe(15)
  })

  it('requires confirmation when age is missing', () => {
    expect(getAgeAccess({}, today).status).toBe('confirmation_required')
    expect(getAgeAccess({ age: 20 }, today).status).toBe('confirmation_required')
  })

  it('restricts an athlete below 16', () => {
    expect(getAgeAccess({ dateOfBirth: '2011-01-01' }, today).status).toBe('restricted')
  })
})
