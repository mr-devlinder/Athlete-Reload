export function calculateSessionLoad(minutes, perceivedIntensity) {
  const duration = Math.max(0, Number(minutes) || 0)
  const intensity = Math.max(0, Math.min(10, Number(perceivedIntensity) || 0))
  return Math.round(duration * intensity)
}

export function summarizeRecentLoad(checkouts = [], referenceDate = new Date()) {
  const dated = checkouts.map((entry) => ({
    ...entry,
    parsedDate: new Date(`${entry.date ?? entry.sessionDate ?? entry.eventDate ?? ''}T12:00:00`),
  })).filter((entry) => !Number.isNaN(entry.parsedDate.getTime()))
  const inWindow = (days) => dated.filter((entry) => {
    const ageDays = (referenceDate.getTime() - entry.parsedDate.getTime()) / 86400000
    return ageDays >= 0 && ageDays < days
  })
  const total = (items) => items.reduce((sum, entry) => sum + Number(entry.sessionLoad ?? calculateSessionLoad(entry.actualMinutes, entry.difficulty)), 0)
  const sevenDay = inWindow(7)
  const twentyEightDay = inWindow(28)
  const weeklyBaseline = twentyEightDay.length ? total(twentyEightDay) / 4 : null
  const sevenDayLoad = total(sevenDay)
  return {
    sevenDayLoad,
    twentyEightDayLoad: total(twentyEightDay),
    weeklyBaseline: weeklyBaseline == null ? null : Math.round(weeklyBaseline),
    loadRatio: weeklyBaseline ? Math.round((sevenDayLoad / weeklyBaseline) * 100) / 100 : null,
    sampleSize: twentyEightDay.length,
  }
}

export function getScheduleDensity(events = [], date) {
  const dayEvents = events.filter((event) => event.date === date && !/rest/i.test(event.type ?? ''))
  const plannedMinutes = dayEvents.reduce((sum, event) => sum + Number(event.plannedMinutes ?? event.expectedDuration ?? 0), 0)
  return { eventCount: dayEvents.length, plannedMinutes, multipleEvents: dayEvents.length > 1 }
}
