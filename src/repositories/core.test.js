import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearRepositoryRequestCache, createOptimisticMutation, RepositoryErrorCode, runRepositoryOperation } from './core'

afterEach(() => {
  clearRepositoryRequestCache()
  vi.restoreAllMocks()
})

describe('repository operations', () => {
  it('deduplicates concurrent requests with the same key', async () => {
    const operation = vi.fn(async () => 'loaded')
    const [first, second] = await Promise.all([
      runRepositoryOperation({ key: 'athlete:one', operation }),
      runRepositoryOperation({ key: 'athlete:one', operation }),
    ])
    expect(operation).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ ok: true, data: 'loaded' })
    expect(second).toEqual(first)
  })

  it('returns a normalized abort result', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runRepositoryOperation({ operation: vi.fn(), signal: controller.signal })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(RepositoryErrorCode.ABORTED)
  })

  it('rolls back an optimistic change when persistence fails', async () => {
    const state = []
    const mutate = createOptimisticMutation({
      apply(value) { state.push(value); return value },
      commit: async () => { throw Object.assign(new Error('Denied'), { status: 403 }) },
      rollback(value) { state.splice(state.indexOf(value), 1) },
    })
    const result = await mutate('draft')
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe(RepositoryErrorCode.PERMISSION_DENIED)
    expect(state).toEqual([])
  })
})
