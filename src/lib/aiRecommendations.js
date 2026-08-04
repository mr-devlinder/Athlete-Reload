import { supabase, supabasePublishableKey, supabaseUrl } from './supabaseClient'

async function callRecommendationFunction(payload) {
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
  let timeoutId

  try {
    const data = await Promise.race([
      callRecommendationFunction(personalize ? payload : withoutPersonalization(payload)),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Recommendation request timed out'))
        }, 60000)
      }),
    ])

    if (!data?.recommendation || data?.source !== 'gemini') {
      throw new Error('Gemini recommendation response was not confirmed')
    }

    return { ...data.recommendation, _source: 'gemini' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function extractVoiceLog(payload) {
  const data = await callRecommendationFunction({ ...payload, requestType: 'voice_extract' })
  if (!data?.extraction) throw new Error('Voice draft could not be understood')
  return data.extraction
}
