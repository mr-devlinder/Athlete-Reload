function average(values) {
  const usable = values.filter((value) => Number.isFinite(Number(value))).map(Number)
  if (usable.length === 0) return null
  return Math.round(usable.reduce((total, value) => total + value, 0) / usable.length)
}

export function getPersonalBaseline(history = [], event) {
  const eventType = event?.type ?? ''
  const relevant = history
    .filter((entry) => entry.date && (!eventType || entry.session === eventType || entry.eventTitle === eventType))
    .slice(0, 28)

  const fallback = history.filter((entry) => entry.date).slice(0, 28)
  const entries = relevant.length >= 7 ? relevant : fallback
  const sampleSize = entries.length
  const confidence = sampleSize >= 14 ? 'Established' : sampleSize >= 7 ? 'Building' : 'Not ready'

  return {
    confidence,
    eventType: relevant.length >= 7 ? eventType : 'All events',
    sampleSize,
    values: {
      energy: average(entries.map((entry) => entry.energy)),
      fatigue: average(entries.map((entry) => entry.fatigue)),
      readiness: average(entries.map((entry) => entry.score)),
      sleep: average(entries.map((entry) => entry.sleep)),
      soreness: average(entries.map((entry) => entry.soreness)),
    },
  }
}

export function getBaselineComparison(entry, baseline) {
  if (baseline?.confidence === 'Not ready') return []

  const comparisons = [
    ['Energy', Number(entry.energy) - baseline.values.energy, 'higher', 'lower'],
    ['Fatigue', Number(entry.fatigue) - baseline.values.fatigue, 'higher', 'lower'],
    ['Sleep', Number(entry.sleep) - baseline.values.sleep, 'higher', 'lower'],
    ['Soreness', Number(entry.soreness) - baseline.values.soreness, 'higher', 'lower'],
  ]

  return comparisons
    .filter(([, delta]) => Math.abs(delta) >= 1)
    .map(([label, delta, higher, lower]) => `${label} is ${delta > 0 ? higher : lower} than your usual ${baseline.eventType.toLowerCase()} check-ins.`)
}
