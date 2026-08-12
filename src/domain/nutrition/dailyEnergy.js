import { getNutritionSafetyContext } from './nutritionSafety'

const activityMultipliers = { 'Mostly individual': 1.52, 'Mostly team training': 1.66, 'Team and individual': 1.72 }
const goalAdjustments = { 'Gain weight': 250, 'Gain muscle': 200, 'Lose weight': -250, 'Improve conditioning': 80, 'Improve speed': 100, 'Improve strength': 150, 'Sport performance': 150 }

export function calculateDailyEnergyContext(profile = {}, schedule = [], date) {
  const weightKg = Number(profile.weightKg)
  const heightCm = Number(profile.heightCm)
  const age = Number(profile.age ?? profile.ageYears)
  if (!weightKg || !heightCm || !age) return { rangeKcal: null, midpointKcal: null, reason: 'Add age, height, and weight to estimate a broad daily fueling range.', safety: getNutritionSafetyContext(profile) }

  const physiologySex = String(profile.physiologySex ?? '').toLowerCase()
  const offset = physiologySex === 'male' ? 5 : physiologySex === 'female' ? -161 : -78
  const baseline = 10 * weightKg + 6.25 * heightCm - 5 * age + offset
  const minutes = schedule.filter((event) => event.date === date).reduce((sum, event) => sum + Number(event.expectedDuration ?? event.plannedMinutes ?? 0), 0)
  const safety = getNutritionSafetyContext(profile)
  const selectedGoal = (profile.goals ?? []).map((goal) => goal?.name ?? goal).find((goal) => goalAdjustments[goal] !== undefined)
  const adjustment = !safety.allowAutomatedDeficit && goalAdjustments[selectedGoal] < 0 ? 0 : goalAdjustments[selectedGoal] ?? 0
  const midpointKcal = Math.round((baseline * (activityMultipliers[profile.trainingStyle] ?? 1.6)) + Math.min(650, minutes * 4.5) + adjustment)
  const spread = Math.max(150, Math.round(midpointKcal * 0.08 / 50) * 50)
  return {
    rangeKcal: { low: Math.max(0, midpointKcal - spread), high: midpointKcal + spread },
    midpointKcal,
    physiologyAssumption: physiologySex || 'neutral_estimate',
    reason: 'Broad planning estimate from body size, age, planned activity, and training style; it is not a medical prescription.',
    safety,
  }
}
