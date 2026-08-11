function average(values) {
  const usable = values.filter((value) => Number.isFinite(Number(value))).map(Number)
  if (usable.length === 0) return null
  return Math.round(usable.reduce((total, value) => total + value, 0) / usable.length)
}

function confidenceScore(sampleSize) {
  return Math.round(Math.min(1, sampleSize / 14) * 100) / 100
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
    confidenceScore: confidenceScore(sampleSize),
    eventType: eventType && relevant.length >= 7 ? eventType : 'All events',
    sampleSize,
    windowDays: 28,
    calculationVersion: 'baseline-2.0.0',
    values: {
      energy: average(entries.map((entry) => entry.energy)),
      fatigue: average(entries.map((entry) => entry.fatigue)),
      readiness: average(entries.map((entry) => entry.score)),
      sleep: average(entries.map((entry) => entry.sleep)),
      soreness: average(entries.map((entry) => entry.soreness)),
    },
  }
}

export function getBaselineRecords(history = [], event) {
  const baseline = getPersonalBaseline(history, event)
  return Object.entries(baseline.values).map(([metricKey, value]) => ({
    metricKey,
    value,
    sampleSize: baseline.sampleSize,
    confidence: baseline.confidenceScore,
    cohortKey: baseline.eventType || 'All events',
    windowDays: baseline.windowDays,
    calculationVersion: baseline.calculationVersion,
  }))
}

export function getRollingBaselineRecords({ checkouts = [], event, history = [], painReports = [], recoveryCompletions = [], windows = [7, 28, 84] } = {}) {
  const cohortKey = event?.type || 'All events'
  const sources = {
    sleep: history.map((entry) => entry.sleep),
    fatigue: history.map((entry) => entry.fatigue),
    soreness: history.map((entry) => entry.soreness),
    readiness: history.map((entry) => entry.score),
    session_load: checkouts.map((entry) => entry.sessionLoad ?? Number(entry.actualMinutes ?? 0) * Number(entry.difficulty ?? 0)),
    rpe: checkouts.map((entry) => entry.difficulty),
    pain_response: painReports.map((entry) => entry.severity),
    recovery_response: recoveryCompletions.map((entry) => ({ Better: 1, Same: 0, Worse: -1 }[entry.details?.feeling])),
  }

  return windows.flatMap((windowDays) => Object.entries(sources).map(([metricKey, values]) => {
    const usable = values.slice(0, windowDays).filter((value) => Number.isFinite(Number(value))).map(Number)
    return {
      metricKey,
      value: average(usable),
      sampleSize: usable.length,
      confidence: confidenceScore(usable.length),
      cohortKey,
      windowDays,
      calculationVersion: 'baseline-3.0.0',
    }
  }))
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
