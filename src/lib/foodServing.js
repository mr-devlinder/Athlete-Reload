export function getCanonicalServing(food = {}) {
  const label = String(food.standardServingSize ?? food.servingSize ?? '100 g').replace(/\s+/g, ' ').trim()
  const weight = Number(food.servingWeight)
  const unit = food.servingWeightUnit ?? 'g'
  const weightLabel = Number.isFinite(weight) && weight > 0 ? `${round(weight)} ${unit}` : ''
  const displayLabel = weightLabel && !label.toLowerCase().includes(weightLabel.toLowerCase())
    ? `${label} (${weightLabel})`
    : label
  return { displayLabel, label, weight, unit }
}

export function getSourceServingOptions(food = {}) {
  const canonical = getCanonicalServing(food)
  const options = [{ label: canonical.label, gramWeight: canonical.weight }]
  for (const option of food.servingOptions ?? []) {
    if (!option?.label || !Number.isFinite(Number(option.gramWeight)) || Number(option.gramWeight) <= 0) continue
    if (!options.some((item) => item.label === option.label)) options.push({ label: option.label, gramWeight: Number(option.gramWeight) })
  }
  return options
}

export function getSourceServingFactor(food, selectedLabel) {
  const canonical = getCanonicalServing(food)
  const selected = getSourceServingOptions(food).find((option) => option.label === selectedLabel)
  if (!canonical.weight || !selected?.gramWeight) return 1
  return selected.gramWeight / canonical.weight
}

export const FOOD_NUTRIENT_FIELDS = [
  'calories', 'protein', 'carbohydrates', 'fats', 'fiber', 'sugar',
  'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'transFat',
  'cholesterol', 'sodium', 'potassium', 'vitaminA', 'vitaminC', 'vitaminD',
  'vitaminE', 'vitaminK', 'calcium', 'iron',
]

/**
 * Scale nutrients from the food's current stored portion to a requested portion.
 * This deliberately reverses the current serving multiplier first, so editing an
 * already-scaled meal never multiplies the nutrients a second time.
 */
export function scaleFoodForServing(food = {}, selectedLabel, servings = 1, currentServing = {}) {
  const currentLabel = currentServing.label ?? food.servingSize ?? getCanonicalServing(food).label
  const currentCount = positiveNumber(currentServing.servings ?? food.servings, 1)
  const requestedCount = Math.max(0, Number(servings) || 0)
  const currentFactor = Math.max(0.000001, getSourceServingFactor(food, currentLabel) * currentCount)
  const requestedFactor = getSourceServingFactor(food, selectedLabel) * requestedCount
  const scaled = {
    ...food,
    servingSize: selectedLabel,
    servings: requestedCount,
  }

  for (const key of FOOD_NUTRIENT_FIELDS) {
    if (food[key] == null || !Number.isFinite(Number(food[key]))) continue
    const value = (Number(food[key]) / currentFactor) * requestedFactor
    scaled[key] = key === 'calories' ? Math.round(value) : round(value)
  }
  return scaled
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function round(value) {
  return Math.round(value * 10) / 10
}
