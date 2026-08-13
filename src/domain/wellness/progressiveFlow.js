export function getCheckInFlowState(checkIn = {}, { requireSleep = true, requireLegHeaviness = false } = {}) {
  const coreFields = ['energy', 'fatigue', 'soreness', 'stress']
  const missing = coreFields.filter((field) => !isAnswered(checkIn[field]))
  if (requireSleep) {
    if (!isAnswered(checkIn.sleep)) missing.push('sleep')
    if (!isAnswered(checkIn.sleepQuality)) missing.push('sleepQuality')
  }
  if (requireLegHeaviness && !isAnswered(checkIn.legHeaviness)) missing.push('legHeaviness')
  if (typeof checkIn.painConcern !== 'boolean') missing.push('painConcern')
  if (typeof checkIn.symptomConcern !== 'boolean') missing.push('symptomConcern')
  if (checkIn.painConcern && !Object.values(checkIn.painMap ?? {}).some((value) => Number(value) > 0)) missing.push('painLocation')
  if (checkIn.symptomConcern && !(Number(checkIn.illnessSymptoms) > 0)) missing.push('symptomImpact')
  return { complete: missing.length === 0, missing }
}

export function getCheckoutFlowState(checkout = {}, schema = {}) {
  const missing = []
  if (!checkout.participation) missing.push('participation')
  if (!isAnswered(checkout.actualMinutes)) missing.push('actualMinutes')
  if (schema.showRpe !== false && checkout.participation && checkout.participation !== 'Did not participate' && !isAnswered(checkout.difficulty)) missing.push('difficulty')
  if (['Partial', 'Modified', 'Stopped early', 'Did not participate'].includes(checkout.participation) && !String(checkout.completionReason ?? '').trim()) missing.push('completionReason')
  if (!isAnswered(checkout.postFatigue)) missing.push('postFatigue')
  if (!isAnswered(checkout.postSoreness)) missing.push('postSoreness')
  if (typeof checkout.painConcern !== 'boolean') missing.push('painConcern')
  if (typeof checkout.symptomConcern !== 'boolean') missing.push('symptomConcern')
  if (checkout.painConcern && !Object.values(checkout.painMap ?? {}).some((value) => Number(value) > 0)) missing.push('painLocation')
  if (checkout.symptomConcern && !(checkout.heatSymptoms?.length > 0)) missing.push('symptoms')
  if (!checkout.performanceRating) missing.push('performanceRating')
  if (schema.showSessionContent && checkout.participation && checkout.participation !== 'Did not participate' && !(checkout.sessionContent?.length > 0)) missing.push('sessionContent')
  if (checkout.participation !== 'Did not participate' && schema.showHydration && !checkout.hydrationDuring) missing.push('hydrationDuring')
  if (checkout.participation !== 'Did not participate' && schema.showFuel && !checkout.fuelDuring) missing.push('fuelDuring')
  return { complete: missing.length === 0, missing }
}

function isAnswered(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}
