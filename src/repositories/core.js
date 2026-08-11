export const RepositoryErrorCode = Object.freeze({
  ABORTED: 'ABORTED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  CONFLICT: 'CONFLICT',
  NETWORK: 'NETWORK',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN',
  VALIDATION: 'VALIDATION',
})

const pendingRequests = new Map()

function wait(delayMs, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('The request was cancelled.', 'AbortError'))
    }, { once: true })
  })
}

export function normalizeRepositoryError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? 0)
  const sourceCode = String(error?.code ?? '')
  const message = String(error?.message ?? 'An unexpected data error occurred.')
  let code = RepositoryErrorCode.UNKNOWN

  if (error?.name === 'AbortError') code = RepositoryErrorCode.ABORTED
  else if (status === 401 || sourceCode === 'PGRST301') code = RepositoryErrorCode.AUTH_REQUIRED
  else if (status === 403 || sourceCode === '42501') code = RepositoryErrorCode.PERMISSION_DENIED
  else if (status === 404 || sourceCode === 'PGRST116') code = RepositoryErrorCode.NOT_FOUND
  else if (status === 409 || sourceCode === '23505') code = RepositoryErrorCode.CONFLICT
  else if (status === 422 || sourceCode.startsWith('22') || sourceCode === '23514') code = RepositoryErrorCode.VALIDATION
  else if (status === 429) code = RepositoryErrorCode.RATE_LIMITED
  else if (status >= 500) code = RepositoryErrorCode.SERVER
  else if (!status && /fetch|network|connection|offline/i.test(message)) code = RepositoryErrorCode.NETWORK

  return {
    code,
    message,
    retryable: [RepositoryErrorCode.NETWORK, RepositoryErrorCode.RATE_LIMITED, RepositoryErrorCode.SERVER].includes(code),
    sourceCode: sourceCode || null,
    status: status || null,
  }
}

export async function runRepositoryOperation({ key, operation, retries = 2, retryDelayMs = 180, signal } = {}) {
  if (signal?.aborted) return { ok: false, error: normalizeRepositoryError(new DOMException('The request was cancelled.', 'AbortError')) }
  if (key && pendingRequests.has(key)) return pendingRequests.get(key)

  const request = (async () => {
    let attempt = 0
    while (attempt <= retries) {
      try {
        const data = await operation({ attempt, signal })
        if (signal?.aborted) throw new DOMException('The request was cancelled.', 'AbortError')
        return { ok: true, data }
      } catch (cause) {
        const error = normalizeRepositoryError(cause)
        if (!error.retryable || attempt === retries || signal?.aborted) return { ok: false, error }
        await wait(retryDelayMs * (2 ** attempt), signal)
        attempt += 1
      }
    }
    return { ok: false, error: normalizeRepositoryError(new Error('Retry limit exceeded.')) }
  })().finally(() => {
    if (key) pendingRequests.delete(key)
  })

  if (key) pendingRequests.set(key, request)
  return request
}

export function createOptimisticMutation({ apply, commit, rollback }) {
  return async (value, options = {}) => {
    const rollbackValue = apply(value)
    const result = await runRepositoryOperation({ ...options, operation: () => commit(value, options) })
    if (!result.ok) rollback(rollbackValue, result.error)
    return result
  }
}

export function clearRepositoryRequestCache() {
  pendingRequests.clear()
}
