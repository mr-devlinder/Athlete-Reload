const storageKey = 'athlete-reload-state'

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
