export function getNutritionSafetyContext(profile = {}) {
  const age = Number(profile.age ?? profile.ageYears)
  const isYouth = Number.isFinite(age) && age >= 16 && age < 18
  const goals = (profile.goals ?? []).map((goal) => goal?.name ?? goal)
  const requestsBodyComposition = goals.some((goal) => /lose weight|body composition|cut/i.test(String(goal)))
  return {
    isYouth,
    allowAutomatedDeficit: !isYouth,
    message: isYouth && requestsBodyComposition
      ? 'For athletes 16–17, prioritize regular fueling, growth, recovery, and training demand. Discuss body-composition goals with a parent or guardian and a qualified sports-health professional.'
      : null,
  }
}
