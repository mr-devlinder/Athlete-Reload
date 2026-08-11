import { supabase, supabasePublishableKey, supabaseUrl } from './supabaseClient'
import { friendlyFeatureError, recordOperationalEvent } from './operationalEvents'

async function callRecommendationFunction(payload, { signal } = {}) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Please sign in again before generating your guidance.')
  }

  const requestBody = sanitizeRecommendationPayload(payload)
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
    await recordOperationalEvent('ai', `RECOMMENDATION_${response.status}`)
    throw new Error(friendlyFeatureError('ai'))
  }

  return data
}

export function sanitizeRecommendationPayload(payload = {}) {
  const safeProfile = payload.athleteProfile ? {
    age: payload.athleteProfile.age,
    dietaryPreferences: payload.athleteProfile.dietaryPreferences,
    goals: payload.athleteProfile.goals,
    position: payload.athleteProfile.position,
    sport: payload.athleteProfile.sport,
    trainingStyle: payload.athleteProfile.trainingStyle,
    weightKg: payload.athleteProfile.weightKg,
  } : undefined
  return {
    ...payload,
    ...(safeProfile ? { athleteProfile: safeProfile } : {}),
  }
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
  const currentRequest = Object.fromEntries(Object.entries(payload).filter(([key]) => !personalizationFields.includes(key)))
  if (payload.athleteContext) {
    currentRequest.athleteContext = {
      ...payload.athleteContext,
      athlete: {},
      recent: {},
    }
  }
  return currentRequest
}

export async function generateAiRecommendation(payload, { personalize = true } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error('Recommendation request timed out')), 60000)

  try {
    const data = await callRecommendationFunction(
      personalize ? payload : withoutPersonalization(payload),
      { signal: controller.signal },
    )

    if (!data?.recommendation || !['gemini', 'openrouter'].includes(data?.source)) {
      await recordOperationalEvent('ai', 'INVALID_RECOMMENDATION_RESPONSE')
      throw new Error(friendlyFeatureError('ai'))
    }

    return { ...data.recommendation, _source: data.provider === 'gemini' ? 'gemini' : data.source }
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
