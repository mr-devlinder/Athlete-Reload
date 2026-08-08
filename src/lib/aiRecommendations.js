import { supabase, supabasePublishableKey, supabaseUrl } from './supabaseClient'

async function callRecommendationFunction(payload, { signal } = {}) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again before generating a recommendation.')
  }

  const requestBody = payload
  const functionUrl = import.meta.env.DEV
    ? '/local-functions/generate-recommendation'
    : `${supabaseUrl}/functions/v1/generate-recommendation`
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || data?.error || `Edge Function request failed (${response.status})`)
  }

  return data
}

const personalizationFields = [
  'athleteProfile',
  'baseline',
  'dailyWellness',
  'nutritionContext',
  'recentEvents',
  'recentPainReports',
  'recentRoutineExerciseNames',
  'recentRoutineSequences',
  'recoveryCompletions',
  'previousCheckout',
  'previousRecoveryCompletion',
  'weeklyWorkloadContext',
]

function withoutPersonalization(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !personalizationFields.includes(key)))
}

export async function generateAiRecommendation(payload, { personalize = true } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error('Recommendation request timed out')), 60000)

  try {
    const data = await callRecommendationFunction(
      personalize ? payload : withoutPersonalization(payload),
      { signal: controller.signal },
    )

    if (!data?.recommendation || data?.source !== 'openrouter') {
      throw new Error('AI recommendation response was not confirmed')
    }

    return { ...data.recommendation, _source: 'openrouter' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function extractVoiceLog(payload) {
  const data = await callRecommendationFunction({ ...payload, requestType: 'voice_extract' })
  if (!data?.extraction) throw new Error('Voice draft could not be understood')
  return data.extraction
}

export async function transcribeVoiceAudio({ audioBase64, mimeType }) {
  const data = await callRecommendationFunction({ audioBase64, mimeType, requestType: 'voice_transcribe' })
  if (!data?.transcript) throw new Error('The recording could not be transcribed')
  return data.transcript
}
