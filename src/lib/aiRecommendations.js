import { supabase } from './supabaseClient'

export async function generateAiRecommendation(payload) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  let timeoutId

  try {
    const result = await Promise.race([
      supabase.functions.invoke('generate-recommendation', {
        body: payload,
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Recommendation request timed out'))
        }, 20000)
      }),
    ])

    const { data, error } = result

    if (error) throw error
    if (!data?.recommendation) {
      throw new Error('AI recommendation response was empty')
    }

    return data.recommendation
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function extractVoiceLog(payload) {
  if (!supabase) throw new Error('Supabase is not configured')

  const { data, error } = await supabase.functions.invoke('generate-recommendation', {
    body: { ...payload, requestType: 'voice_extract' },
  })

  if (error) throw error
  if (!data?.extraction) throw new Error('Voice draft could not be understood')
  return data.extraction
}
