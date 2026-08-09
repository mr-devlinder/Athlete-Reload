import { supabase } from './supabaseClient'

const safeCode = (value) => String(value || 'UNEXPECTED_ERROR').toUpperCase().replace(/[^A-Z0-9_]+/g, '_').slice(0, 80)
const safeFeature = (value) => String(value || 'app').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 50)

export async function recordOperationalEvent(feature, errorCode, severity = 'error') {
  if (!supabase) return null
  try {
    const { data } = await supabase.rpc('record_operational_event', {
      p_error_code: safeCode(errorCode),
      p_feature: safeFeature(feature),
      p_release_version: import.meta.env.VITE_APP_VERSION || 'dev',
      p_severity: severity,
    })
    return data ?? null
  } catch {
    return null
  }
}

export function friendlyFeatureError(feature) {
  const labels = {
    ai: 'Your personalized guidance could not be generated right now.',
    nutrition: 'Food search is not working right now.',
    save: 'Your changes could not be saved right now.',
    sync: 'Your latest information could not be refreshed right now.',
  }
  return `${labels[feature] ?? 'Something is not working right now'} Please try again.`
}
