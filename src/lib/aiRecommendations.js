import { supabase } from './supabaseClient'

export async function generateAiRecommendation(payload) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase.functions.invoke('generate-recommendation', {
    body: payload,
  })

  if (error) throw error
  if (!data?.recommendation) {
    throw new Error('AI recommendation response was empty')
  }

  return data.recommendation
}
