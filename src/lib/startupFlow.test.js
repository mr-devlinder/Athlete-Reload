import { describe, expect, it } from 'vitest'
import { shouldShowStartupLoader } from './startupFlow'

describe('shouldShowStartupLoader', () => {
  it('keeps the loader off for signed-out visitors', () => {
    expect(shouldShowStartupLoader({ isAppUnlocked: false, isStartupComplete: false })).toBe(false)
  })

  it('shows the loader only while entering the authenticated app', () => {
    expect(shouldShowStartupLoader({ isAppUnlocked: true, isStartupComplete: false })).toBe(true)
    expect(shouldShowStartupLoader({ isAppUnlocked: true, isStartupComplete: true })).toBe(false)
  })
})
