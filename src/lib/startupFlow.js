export function shouldShowStartupLoader({ isAppUnlocked, isStartupComplete }) {
  return Boolean(isAppUnlocked && !isStartupComplete)
}

export function shouldRestartStartupForAuthEvent({ event, hasEnteredAuthenticatedApp }) {
  return !hasEnteredAuthenticatedApp && ['INITIAL_SESSION', 'SIGNED_IN'].includes(event)
}
