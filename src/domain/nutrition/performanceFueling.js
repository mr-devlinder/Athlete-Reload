export function getPerformanceFueling({ durationMinutes = 0, hoursUntilEvent = null, demand = 'moderate' } = {}) {
  const duration = Math.max(0, Number(durationMinutes) || 0)
  const highDemand = demand === 'high' || duration >= 90
  return {
    carbohydrateRangeGramsPerHour: duration >= 60 ? (duration >= 150 ? { low: 60, high: 90 } : { low: 30, high: 60 }) : null,
    timing: Number(hoursUntilEvent) >= 2 ? 'Use a familiar carbohydrate-rich meal 2–3 hours before, then a small familiar top-up if useful.' : 'Choose a small, familiar, easy-to-digest carbohydrate source if you need fuel close to the event.',
    context: highDemand ? 'Longer or higher-demand events benefit from deliberate pre-event and during-event fueling.' : 'For shorter sessions, regular meals and a familiar pre-event snack are usually the main priorities.',
    isEstimate: true,
  }
}
