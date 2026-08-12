import { describe, expect, it } from 'vitest'
import { shouldRestartStartupForAuthEvent, shouldShowStartupLoader } from './startupFlow'

describe('shouldShowStartupLoader', () => {
  it('keeps the loader off for signed-out visitors', () => {
    expect(shouldShowStartupLoader({ isAppUnlocked: false, isStartupComplete: false })).toBe(false)
  })

  it('shows the loader only while entering the authenticated app', () => {
    expect(shouldShowStartupLoader({ isAppUnlocked: true, isStartupComplete: false })).toBe(true)
    expect(shouldShowStartupLoader({ isAppUnlocked: true, isStartupComplete: true })).toBe(false)
  })

  it('does not restart the app shell for background sign-in notifications', () => {
    expect(shouldRestartStartupForAuthEvent({ event: 'SIGNED_IN', hasEnteredAuthenticatedApp: true })).toBe(false)
    expect(shouldRestartStartupForAuthEvent({ event: 'TOKEN_REFRESHED', hasEnteredAuthenticatedApp: true })).toBe(false)
    expect(shouldRestartStartupForAuthEvent({ event: 'INITIAL_SESSION', hasEnteredAuthenticatedApp: false })).toBe(true)
  })
})
