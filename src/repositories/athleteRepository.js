import { loadAthleteData, loadAthleteProfile, loadPrivacyPreferences } from '../lib/athleteData'
import { runRepositoryOperation } from './core'

export function loadAthleteSnapshotResult({ privacyDefaults, signal } = {}) {
  return runRepositoryOperation({
    key: 'athlete-snapshot',
    signal,
    operation: async () => {
      const [data, profile, preferencesResult] = await Promise.all([
        loadAthleteData({ signal }),
        loadAthleteProfile({ signal }),
        loadPrivacyPreferences({ signal }).then((value) => ({ value })).catch((error) => ({ error })),
      ])
      if (preferencesResult.error) console.warn('Privacy preferences could not be loaded.', preferencesResult.error)
      return { data, profile, preferences: preferencesResult.value ?? privacyDefaults }
    },
  })
}
