import { describe, expect, it } from 'vitest'
import { canRemoveAuthMethod, resolveAuthMethods, unlinkAuthIdentity } from './authMethods'

describe('authentication methods', () => {
  it('does not treat an OAuth contact email as a password method', () => {
    expect(resolveAuthMethods([{ provider: 'google' }], { email: 'athlete@example.com', app_metadata: { providers: ['google'] } })).toEqual(['google'])
  })

  it('allows Google removal when GitHub remains', () => {
    expect(canRemoveAuthMethod('google', [{ identity_id: 'google-1', provider: 'google' }, { identity_id: 'github-1', provider: 'github' }])).toBe(true)
  })

  it('allows Google removal when password email remains', () => {
    expect(canRemoveAuthMethod('google', [{ identity_id: 'google-1', provider: 'google' }, { identity_id: 'email-1', provider: 'email' }])).toBe(true)
  })

  it('protects the final sign-in method', () => {
    expect(canRemoveAuthMethod('google', [{ identity_id: 'google-1', provider: 'google' }])).toBe(false)
  })

  it('does not trust stale provider metadata as a removable identity', () => {
    expect(canRemoveAuthMethod('google', [{ identity_id: 'google-1', provider: 'google' }], { app_metadata: { providers: ['email', 'google'] } })).toBe(false)
  })

  it('unlinks, refreshes the session, and returns live identities', async () => {
    const auth = {
      getUserIdentities: async () => ({ data: { identities: [{ identity_id: 'email-1', provider: 'email' }] }, error: null }),
      refreshSession: async () => ({ data: {}, error: null }),
      unlinkIdentity: async () => ({ data: {}, error: null }),
    }

    await expect(unlinkAuthIdentity(auth, { identity_id: 'google-1', provider: 'google' })).resolves.toEqual({
      identities: [{ identity_id: 'email-1', provider: 'email' }],
      syncError: null,
    })
  })
})
