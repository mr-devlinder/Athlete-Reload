import { loadAthleteSnapshotResult } from '../../repositories/athleteRepository'

export async function loadAthleteSnapshot(privacyDefaults, options = {}) {
  const result = await loadAthleteSnapshotResult({ privacyDefaults, signal: options.signal })
  if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
  return result.data
}
