export function resolveAuthMethods(identities = [], user = {}) {
  const declaredProviders = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []
  const methods = new Set(declaredProviders)
  identities.forEach((identity) => identity?.provider && methods.add(identity.provider))
  return [...methods].filter(Boolean)
}

export function canRemoveAuthMethod(provider, identities = [], user = {}) {
  return resolveAuthMethods(identities, user).filter((method) => method !== provider).length > 0
}

export function getUnlinkMessage(error) {
  const message = String(error?.message ?? '').toLowerCase()
  if (message.includes('last') || message.includes('only') || message.includes('identity')) return 'Add another sign-in method before removing this connection.'
  if (message.includes('reauth') || message.includes('recent')) return 'Please sign in again before changing connected accounts.'
  if (message.includes('manual linking') || message.includes('disabled')) return 'Connected-account changes are not enabled for this provider right now.'
  return 'That connection could not be removed right now. Please try again.'
}
