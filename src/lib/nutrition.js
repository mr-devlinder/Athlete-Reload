import { calculateDailyEnergyContext } from '../domain/nutrition/dailyEnergy'
import { getHydrationResult } from '../domain/nutrition/hydration'
import { calculateAge } from '../domain/age'

export const mealOptions = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Custom']

export function getNutritionProgressParts(value, target, showTarget = true) {
  const current = String(Math.round(Number(value) || 0))
  if (!showTarget) return { current, target: null }
  const normalizedTarget = target == null || !Number.isFinite(Number(target)) ? '\u2014' : String(Math.round(Number(target)))
  return { current, target: normalizedTarget }
}

export function formatNutritionProgress(value, target, showTarget = true) {
  const progress = getNutritionProgressParts(value, target, showTarget)
  return progress.target == null ? progress.current : `${progress.current} / ${progress.target}`
}

export function getNutritionTargets(profile = {}, schedule = [], date = getLocalDate()) {
  profile = profile ?? {}
  const weightKg = Number(profile.weightKg)
  const heightCm = Number(profile.heightCm)
  const age = Number(profile.age) || calculateAge(profile.dateOfBirth)

  if (!weightKg || !heightCm || !age) {
    return { calories: null, carbohydrates: null, fats: null, protein: null, isEstimate: true, reason: 'Add age, height, and weight in your profile to estimate daily targets.' }
  }

  const energy = calculateDailyEnergyContext({ ...profile, age }, schedule, date)
  const calories = energy.midpointKcal
  const selectedGoals = (profile.goals ?? []).map((goal) => ({ name: goal.name ?? goal }))
  const proteinGoal = selectedGoals.some((goal) => ['Gain muscle', 'Improve strength'].includes(goal.name))
  const protein = Math.round(weightKg * (proteinGoal ? 1.8 : 1.5))
  const fats = Math.round((calories * 0.28) / 9)
  const carbohydrates = Math.round(Math.max(0, (calories - (protein * 4) - (fats * 9)) / 4))

  return { calories, calorieRange: energy.rangeKcal, carbohydrates, fats, protein, isEstimate: true, reason: energy.safety.message ?? energy.reason }
}

export function getNutritionTotals(entries = []) {
  const nutrientKeys = ['fiber', 'sugar', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'transFat', 'cholesterol', 'sodium', 'potassium', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK', 'calcium', 'iron']
  return entries.reduce((totals, entry) => {
    const next = {
      ...totals,
      calories: totals.calories + Number(entry.calories ?? 0),
      carbohydrates: totals.carbohydrates + Number(entry.carbohydrates ?? 0),
      fats: totals.fats + Number(entry.fats ?? 0),
      protein: totals.protein + Number(entry.protein ?? 0),
    }
    nutrientKeys.forEach((key) => { next[key] = totals[key] + Number(entry[key] ?? 0) })
    return next
  }, { calories: 0, carbohydrates: 0, fats: 0, protein: 0, ...Object.fromEntries(nutrientKeys.map((key) => [key, 0])) })
}

export function getLocalDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function getHydrationTarget(profile = {}, schedule = [], date = getLocalDate()) {
  const result = getHydrationResult({ profile, schedule, date })
  return Math.round((result.baselineRangeMl.low + result.baselineRangeMl.high + result.eventAdjustmentRangeMl.low + result.eventAdjustmentRangeMl.high) / 2)
}

export function getHydrationGuidance(profile = {}, schedule = [], date = getLocalDate()) {
  const result = getHydrationResult({ profile, schedule, date })
  const minimumMl = result.baselineRangeMl.low + result.eventAdjustmentRangeMl.low
  const maximumMl = result.baselineRangeMl.high + result.eventAdjustmentRangeMl.high
  return {
    ...result,
    minimumMl,
    maximumMl,
    midpointMl: Math.round((minimumMl + maximumMl) / 2),
    sessionMinutes: schedule.filter((event) => event.date === date).reduce((sum, event) => sum + Number(event.expectedDuration ?? event.plannedMinutes ?? 0), 0),
    isEstimate: true,
    practicalCue: result.eventAdjustmentRangeMl.high > 0
      ? 'Start hydrated and drink regularly during the session; increase toward the top of the range in heat or with heavy sweating.'
      : 'Drink regularly across the day and use thirst and urine color as practical checks.',
  }
}
