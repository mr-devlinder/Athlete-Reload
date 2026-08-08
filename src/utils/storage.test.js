import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canPersistGuestState, clearUserStorage, loadSavedState, saveState } from './storage'

describe('account storage isolation', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: createStorage(),
      sessionStorage: createStorage(),
    })
  })

  it('never permits persistence during auth startup, a remote session, or sign-out', () => {
    expect(canPersistGuestState({ authReady: false, hasSupabaseSession: false, isSigningOut: false })).toBe(false)
    expect(canPersistGuestState({ authReady: true, hasSupabaseSession: true, isSigningOut: false })).toBe(false)
    expect(canPersistGuestState({ authReady: true, hasSupabaseSession: false, isSigningOut: true })).toBe(false)
    expect(canPersistGuestState({ authReady: true, hasSupabaseSession: false, isSigningOut: false })).toBe(true)
  })

  it('removes app and Supabase data without touching unrelated browser data', () => {
    saveState({ painReports: [{ severity: 80 }] })
    window.localStorage.setItem('sb-project-auth-token', 'secret')
    window.localStorage.setItem('unrelated', 'keep')
    window.sessionStorage.setItem('transient-health-data', 'remove')

    clearUserStorage()

    expect(loadSavedState()).toBeNull()
    expect(window.localStorage.getItem('sb-project-auth-token')).toBeNull()
    expect(window.localStorage.getItem('unrelated')).toBe('keep')
    expect(window.sessionStorage.getItem('transient-health-data')).toBeNull()
  })
})

function createStorage() {
  const values = new Map()
  const storage = {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
    removeItem: (key) => {
      values.delete(key)
      delete storage[key]
    },
    setItem: (key, value) => {
      values.set(key, String(value))
      storage[key] = String(value)
    },
  }
  return storage
}
