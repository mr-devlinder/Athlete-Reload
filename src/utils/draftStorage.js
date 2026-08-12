const prefix = 'athlete-reload-draft'

function storage() {
  return typeof window === 'undefined' ? null : window.sessionStorage
}

export function getDraftKey({ accountId = 'guest', feature, scope = 'default' }) {
  return [prefix, accountId || 'guest', feature, scope || 'default'].map(encodeURIComponent).join(':')
}

export function loadDraft(identity) {
  try {
    const value = storage()?.getItem(getDraftKey(identity))
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function saveDraft(identity, value) {
  try {
    storage()?.setItem(getDraftKey(identity), JSON.stringify(value))
  } catch {
    // Draft persistence is a resilience layer; storage denial must not block input.
  }
}

export function clearDraft(identity) {
  try {
    storage()?.removeItem(getDraftKey(identity))
  } catch {
    // Treat an unavailable storage surface as already cleared.
  }
}

export function clearAccountDrafts(accountId = 'guest') {
  const target = `${encodeURIComponent(prefix)}:${encodeURIComponent(accountId || 'guest')}:`
  const targetStorage = storage()
  if (!targetStorage) return

  try {
    Object.keys(targetStorage)
      .filter((key) => key.startsWith(target))
      .forEach((key) => targetStorage.removeItem(key))
  } catch {
    // Best effort during sign-out/account transitions.
  }
}
