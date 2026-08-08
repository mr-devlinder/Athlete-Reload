const storageKey = 'athlete-reload-state'

export function canPersistGuestState({ authReady, hasSupabaseSession, isSigningOut }) {
  return authReady && !hasSupabaseSession && !isSigningOut
}

export function loadSavedState() {
  try {
    const savedState = window.localStorage.getItem(storageKey)
    return savedState ? JSON.parse(savedState) : null
  } catch {
    return null
  }
}

export function saveState(state) {
  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

export function clearSavedState() {
  window.localStorage.removeItem(storageKey)
}

export function clearUserStorage() {
  clearSavedState()
  window.sessionStorage.clear()

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('sb-') || key.startsWith('athlete-reload'))
    .forEach((key) => window.localStorage.removeItem(key))
}
