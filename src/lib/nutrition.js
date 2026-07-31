const activityMultipliers = {
  'Mostly individual': 1.52,
  'Mostly team training': 1.66,
  'Team and individual': 1.72,
}

const goalAdjustments = {
  'Gain weight': 250,
  'Gain muscle': 200,
  'Lose weight': -250,
  'Improve conditioning': 80,
  'Improve speed': 100,
  'Improve strength': 150,
  'Sport performance': 150,
}

export const mealOptions = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Custom']

export function getNutritionTargets(profile = {}, schedule = [], date = getLocalDate()) {
  profile = profile ?? {}
  const weightLbs = Number(profile.weightLbs)
  const heightInches = Number(profile.heightInches)
  const age = Number(profile.age)

  if (!weightLbs || !heightInches || !age) {
    return { calories: null, carbohydrates: null, fats: null, protein: null, isEstimate: true, reason: 'Add age, height, and weight in your profile to estimate daily targets.' }
  }

  const weightKg = weightLbs * 0.453592
  const heightCm = heightInches * 2.54
  const sexOffset = profile.genderIdentity === 'Male' ? 5 : profile.genderIdentity === 'Female' ? -161 : -78
  const baseline = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexOffset
  const activity = activityMultipliers[profile.trainingStyle] ?? 1.6
  const dayEvents = schedule.filter((event) => event.date === date)
  const plannedMinutes = dayEvents.reduce((total, event) => total + Number(event.expectedDuration ?? event.plannedMinutes ?? 0), 0)
  const trainingAdjustment = Math.min(650, Math.round(plannedMinutes * 4.5))
  const selectedGoals = (profile.goals ?? []).map((goal, index) => ({ name: goal.name ?? goal, priority: goal.priority === 'primary' ? 2 : 1, index })).filter((goal) => goalAdjustments[goal.name] !== undefined)
  const calorieGoal = selectedGoals.sort((first, second) => second.priority - first.priority || first.index - second.index)[0]?.name
  const goalAdjustment = goalAdjustments[calorieGoal] ?? 0
  const calories = Math.max(1400, Math.round((baseline * activity) + trainingAdjustment + goalAdjustment))
  const proteinGoal = selectedGoals.some((goal) => ['Gain muscle', 'Improve strength'].includes(goal.name))
  const protein = Math.round(weightKg * (proteinGoal ? 1.8 : 1.5))
  const fats = Math.round((calories * 0.28) / 9)
  const carbohydrates = Math.round(Math.max(0, (calories - (protein * 4) - (fats * 9)) / 4))

  return { calories, carbohydrates, fats, protein, isEstimate: true, reason: 'Estimated from the profile, goals, planned activity, and selected training style.' }
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
  profile = profile ?? {}
  const weightLbs = Number(profile.weightLbs)
  const baseline = weightLbs ? Math.round(weightLbs * 0.55) : 80
  const eventMinutes = schedule.filter((event) => event.date === date).reduce((total, event) => total + Number(event.expectedDuration ?? event.plannedMinutes ?? 0), 0)
  return Math.max(64, Math.min(180, baseline + Math.round(eventMinutes * 0.25)))
}
