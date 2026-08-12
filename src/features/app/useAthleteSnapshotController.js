import { useEffect, useEffectEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadAthleteSnapshot } from './loadAthleteSnapshot'

function isDeletedSession(user, error) {
  return !user && (!error || [401, 403].includes(error.status) || ['user_not_found', 'invalid_token'].includes(error.code))
}

export function useAthleteSnapshotController({ enabled, onDeletedSession, onFailure, onSnapshot, onStatus, privacyDefaults, reloadKey }) {
  const onDeletedSessionEvent = useEffectEvent(onDeletedSession)
  const onFailureEvent = useEffectEvent(onFailure)
  const onSnapshotEvent = useEffectEvent(onSnapshot)
  const onStatusEvent = useEffectEvent(onStatus)

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    let retryTimer
    let retryAttempt = 0
    onStatusEvent('loading')

    async function load() {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (isDeletedSession(data.user, error)) {
          await onDeletedSessionEvent()
          return
        }
        if (error) throw error
        const snapshot = await loadAthleteSnapshot(privacyDefaults, { signal: controller.signal })
        if (!controller.signal.aborted) {
          retryAttempt = 0
          onSnapshotEvent(snapshot)
        }
      } catch (error) {
        if (controller.signal.aborted || error?.code === 'ABORTED') return
        if (error?.status === 401 || error?.code === 'PGRST301') {
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (!refreshError) {
            const snapshot = await loadAthleteSnapshot(privacyDefaults, { signal: controller.signal })
            if (!controller.signal.aborted) onSnapshotEvent(snapshot)
            return
          }
        }
        console.error(error)
        onFailureEvent(error)
        onStatusEvent(navigator.onLine ? 'error' : 'offline')
        const retryDelay = navigator.onLine
          ? Math.min(2_000 * (2 ** retryAttempt), 30_000)
          : 5_000
        retryAttempt += 1
        retryTimer = window.setTimeout(() => {
          if (controller.signal.aborted) return
          onStatusEvent('loading')
          void load()
        }, retryDelay)
      }
    }

    load()
    return () => {
      controller.abort()
      window.clearTimeout(retryTimer)
    }
  }, [enabled, privacyDefaults, reloadKey])
}
