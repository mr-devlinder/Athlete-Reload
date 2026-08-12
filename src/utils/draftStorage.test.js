import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAccountDrafts, clearDraft, getDraftKey, loadDraft, saveDraft } from './draftStorage'

describe('scoped draft persistence', () => {
  beforeEach(() => vi.stubGlobal('window', { sessionStorage: createStorage() }))

  it('keeps feature drafts isolated by account and scope', () => {
    const first = { accountId: 'athlete-a', feature: 'nutrition', scope: 'lunch' }
    const second = { accountId: 'athlete-b', feature: 'nutrition', scope: 'lunch' }
    saveDraft(first, { name: 'Rice bowl' })
    saveDraft(second, { name: 'Pasta' })
    expect(loadDraft(first)).toEqual({ name: 'Rice bowl' })
    expect(loadDraft(second)).toEqual({ name: 'Pasta' })
    clearDraft(first)
    expect(loadDraft(first)).toBeNull()
    expect(loadDraft(second)).toEqual({ name: 'Pasta' })
  })

  it('clears only the account that signs out', () => {
    saveDraft({ accountId: 'athlete-a', feature: 'checkin', scope: 'event-1' }, { energy: 3 })
    saveDraft({ accountId: 'athlete-b', feature: 'checkin', scope: 'event-1' }, { energy: 4 })
    clearAccountDrafts('athlete-a')
    expect(window.sessionStorage.getItem(getDraftKey({ accountId: 'athlete-a', feature: 'checkin', scope: 'event-1' }))).toBeNull()
    expect(loadDraft({ accountId: 'athlete-b', feature: 'checkin', scope: 'event-1' })).toEqual({ energy: 4 })
  })
})

function createStorage() {
  const values = new Map()
  const api = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); delete api[key] },
    setItem: (key, value) => { values.set(key, String(value)); api[key] = String(value) },
  }
  return api
}
