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

function round(value) {
  return Math.round(value * 10) / 10
}
