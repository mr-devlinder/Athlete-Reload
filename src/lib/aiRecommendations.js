import { supabase, supabasePublishableKey, supabaseUrl } from './supabaseClient'

async function callRecommendationFunction(payload) {
  if (!supabase || !supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase is not configured')
  }

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again before generating a recommendation.')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-recommendation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = data.detail || data.error || `Request failed (${response.status})`
    throw new Error(detail)
  }

  return data
}

export async function generateAiRecommendation(payload) {
  let timeoutId

  try {
    const data = await Promise.race([
      callRecommendationFunction(payload),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Recommendation request timed out'))
        }, 20000)
      }),
    ])

    if (!data?.recommendation) {
      throw new Error('AI recommendation response was empty')
    }

    return data.recommendation
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function extractVoiceLog(payload) {
  const data = await callRecommendationFunction({ ...payload, requestType: 'voice_extract' })
  if (!data?.extraction) throw new Error('Voice draft could not be understood')
  return data.extraction
}
