import { describe, expect, it } from 'vitest'
import { canRemoveAuthMethod, resolveAuthMethods } from './authMethods'

describe('authentication methods', () => {
  it('does not treat an OAuth contact email as a password method', () => {
    expect(resolveAuthMethods([{ provider: 'google' }], { email: 'athlete@example.com', app_metadata: { providers: ['google'] } })).toEqual(['google'])
  })

  it('allows Google removal when GitHub remains', () => {
    expect(canRemoveAuthMethod('google', [{ provider: 'google' }, { provider: 'github' }], { app_metadata: { providers: ['google', 'github'] } })).toBe(true)
  })

  it('allows Google removal when password email remains', () => {
    expect(canRemoveAuthMethod('google', [{ provider: 'google' }], { app_metadata: { providers: ['email', 'google'] } })).toBe(true)
  })

  it('protects the final sign-in method', () => {
    expect(canRemoveAuthMethod('google', [{ provider: 'google' }], { app_metadata: { providers: ['google'] } })).toBe(false)
  })
})
