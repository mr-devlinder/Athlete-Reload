export function shouldShowStartupLoader({ isAppUnlocked, isStartupComplete }) {
  return Boolean(isAppUnlocked && !isStartupComplete)
}
