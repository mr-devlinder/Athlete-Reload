const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

export function calculateSweatRate({ preSessionWeightKg, postSessionWeightKg, fluidConsumedMl, durationMinutes } = {}) {
  const pre = Number(preSessionWeightKg)
  const post = Number(postSessionWeightKg)
  const fluid = Number(fluidConsumedMl)
  const duration = Number(durationMinutes)
  if (!(pre > 0 && post > 0 && fluid >= 0 && duration >= 20 && pre >= post)) return null
  return Math.round((((pre - post) * 1000) + fluid) / (duration / 60))
}

export function getHydrationResult({ profile = {}, schedule = [], date, currentLoggedMl = null, hasLogs = false, sweatRateMeasurement } = {}) {
  profile = profile ?? {}
  schedule = Array.isArray(schedule) ? schedule : []
  const weightKg = Number(profile.weightKg)
  const baselineMidpoint = weightKg ? weightKg * 35 : 2350
  const baselineSpread = Math.max(250, baselineMidpoint * 0.12)
  const baselineRangeMl = { low: Math.round(clamp(baselineMidpoint - baselineSpread, 1500, 5500)), high: Math.round(clamp(baselineMidpoint + baselineSpread, 1750, 6000)) }
  const minutes = schedule.filter((event) => !date || event.date === date).reduce((sum, event) => sum + Number(event.expectedDuration ?? event.plannedMinutes ?? 0), 0)
  const measuredSweatRateMlPerHour = calculateSweatRate(sweatRateMeasurement)
  const eventMidpoint = measuredSweatRateMlPerHour ? measuredSweatRateMlPerHour * minutes / 60 : minutes * 7.4
  const eventAdjustmentRangeMl = minutes > 0 ? { low: Math.round(eventMidpoint * 0.8), high: Math.round(eventMidpoint * 1.2) } : { low: 0, high: 0 }
  const targetLow = baselineRangeMl.low + eventAdjustmentRangeMl.low
  const targetHigh = baselineRangeMl.high + eventAdjustmentRangeMl.high
  const logged = hasLogs && Number.isFinite(Number(currentLoggedMl)) ? Math.max(0, Number(currentLoggedMl)) : null
  const progress = logged === null ? null : logged / ((targetLow + targetHigh) / 2)
  return {
    baselineRangeMl,
    eventAdjustmentRangeMl,
    currentLoggedMl: logged,
    status: progress === null ? 'unknown' : progress >= 0.9 ? 'on_track' : progress >= 0.5 ? 'building' : 'below_context',
    reasons: [weightKg ? 'Baseline uses body size.' : 'Baseline uses a broad population range.', minutes ? `Includes ${minutes} planned activity minutes.` : 'No event adjustment is applied.'],
    confidence: measuredSweatRateMlPerHour ? 'high' : weightKg ? 'medium' : 'low',
    measuredSweatRateMlPerHour,
  }
}
