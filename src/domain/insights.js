const VERSION = 'insights-2.0.0'

function average(values) {
  const usable = values.map(Number).filter(Number.isFinite)
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null
}

function confidence(sampleSize) {
  return Math.round(Math.min(0.95, 0.45 + sampleSize / 30) * 100) / 100
}

function dateBounds(entries) {
  const dates = entries.map((entry) => entry.date).filter(Boolean).sort()
  const today = new Date().toISOString().slice(0, 10)
  return { windowStart: dates[0] ?? today, windowEnd: dates.at(-1) ?? today }
}

export function getAthleteInsights({ history = [], checkouts = [], painReports = [], recoveryCompletions = [] } = {}) {
  const insights = []
  const datedHistory = history.filter((entry) => entry.date).slice(0, 84)
  const lowSleep = datedHistory.filter((entry) => Number(entry.sleep) < 7 && Number.isFinite(Number(entry.score)))
  const rested = datedHistory.filter((entry) => Number(entry.sleep) >= 8 && Number.isFinite(Number(entry.score)))

  if (lowSleep.length >= 3 && rested.length >= 3) {
    const difference = average(rested.map((entry) => entry.score)) - average(lowSleep.map((entry) => entry.score))
    if (difference >= 8) {
      const sampleSize = lowSleep.length + rested.length
      const bounds = dateBounds([...lowSleep, ...rested])
      insights.push({
        id: 'sleep-readiness-association',
        title: 'Sleep and readiness are moving together',
        summary: `Your reported readiness has averaged ${Math.round(difference)} points higher after 8+ hours of sleep than after nights below 7 hours. This is an association in your logs, not proof of cause.`,
        sampleSize,
        confidence: confidence(sampleSize),
        window: 'Last 12 weeks',
        ...bounds,
        version: VERSION,
      })
    }
  }

  const sorenessEntries = datedHistory.filter((entry) => Number.isFinite(Number(entry.soreness)))
  if (sorenessEntries.length >= 8) {
    const recent = average(sorenessEntries.slice(0, 4).map((entry) => entry.soreness))
    const prior = average(sorenessEntries.slice(4, 8).map((entry) => entry.soreness))
    if (recent - prior >= 1) {
      const bounds = dateBounds(sorenessEntries.slice(0, 8))
      insights.push({
        id: 'recent-soreness-rise',
        title: 'Recent soreness is above your prior pattern',
        summary: `Your last four check-ins averaged ${recent.toFixed(1)}/5 soreness versus ${prior.toFixed(1)}/5 in the four before them. This may be worth watching alongside upcoming load.`,
        sampleSize: 8,
        confidence: confidence(8),
        window: 'Last 8 check-ins',
        ...bounds,
        version: VERSION,
      })
    }
  }

  const comparable = checkouts.filter((entry) => Number(entry.actualMinutes) > 0 && Number(entry.difficulty) > 0).slice(0, 12)
  if (comparable.length >= 4) {
    const highResponses = comparable.filter((entry) => Number(entry.difficulty) >= 8 && Number(entry.postFatigue) >= 4)
    if (highResponses.length >= 3) {
      const bounds = dateBounds(comparable)
      insights.push({
        id: 'high-effort-fatigue-response',
        title: 'Hard sessions often finish with high fatigue',
        summary: `${highResponses.length} of your last ${comparable.length} logged sessions combined an effort of 8/10 or higher with fatigue of 4/5 or higher. Consider protecting recovery time after similar sessions.`,
        sampleSize: comparable.length,
        confidence: confidence(comparable.length),
        window: `Last ${comparable.length} checkouts`,
        ...bounds,
        version: VERSION,
      })
    }
  }

  const plannedActual = checkouts.filter((entry) => Number(entry.plannedMinutes) > 0 && Number(entry.actualMinutes) > 0).slice(0, 12)
  if (plannedActual.length >= 4) {
    const ratios = plannedActual.map((entry) => Number(entry.actualMinutes) / Number(entry.plannedMinutes))
    const meanRatio = average(ratios)
    if (meanRatio >= 1.2 || meanRatio <= 0.8) {
      const bounds = dateBounds(plannedActual)
      insights.push({
        id: 'planned-actual-duration',
        title: meanRatio >= 1.2 ? 'Recent sessions are running longer than planned' : 'Recent sessions are finishing shorter than planned',
        summary: `Your recent actual duration has averaged ${Math.round(meanRatio * 100)}% of planned duration across comparable sessions. Your recent data suggests reviewing event estimates; it does not identify a cause.`,
        sampleSize: plannedActual.length,
        confidence: confidence(plannedActual.length),
        window: `Last ${plannedActual.length} comparable checkouts`,
        ...bounds,
        version: VERSION,
      })
    }
  }

  const recoveryResponses = recoveryCompletions.filter((entry) => ['Better', 'Same', 'Worse'].includes(entry.details?.plan?.feedback?.feeling)).slice(0, 12)
  if (recoveryResponses.length >= 4) {
    const better = recoveryResponses.filter((entry) => entry.details.plan.feedback.feeling === 'Better').length
    if (better / recoveryResponses.length >= 0.65) {
      const bounds = dateBounds(recoveryResponses.map((entry) => ({ date: String(entry.completedAt ?? '').slice(0, 10) })))
      insights.push({
        id: 'recovery-positive-response',
        title: 'Recent recovery routines often ended with a better response',
        summary: `${better} of your last ${recoveryResponses.length} recorded routines ended with “Better.” Your recent data suggests these routines may feel useful immediately, without proving a lasting effect.`,
        sampleSize: recoveryResponses.length,
        confidence: confidence(recoveryResponses.length),
        window: `Last ${recoveryResponses.length} recovery responses`,
        ...bounds,
        version: VERSION,
      })
    }
  }

  const recurringAreas = new Map()
  painReports.filter((report) => Number(report.severity) > 0).forEach((report) => {
    const key = `${report.bodyPart}:${report.side ?? 'center'}`
    recurringAreas.set(key, [...(recurringAreas.get(key) ?? []), report])
  })
  const recurring = [...recurringAreas.values()].sort((first, second) => second.length - first.length)[0]
  if (recurring?.length >= 3) {
    const bounds = dateBounds(recurring)
    insights.push({
      id: `recurring-pain-${recurring[0].bodyPart}-${recurring[0].side ?? 'center'}`,
      title: 'The same area has appeared in several pain reports',
      summary: `${recurring.length} recent reports involve ${recurring[0].bodyPart}. Your data suggests tracking the activity relationship and functional effect; this is not a diagnosis.`,
      sampleSize: recurring.length,
      confidence: confidence(recurring.length),
      window: 'Recent pain reports',
      ...bounds,
      version: VERSION,
    })
  }

  return insights.slice(0, 3)
}
