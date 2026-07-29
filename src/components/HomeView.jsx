import { format, parseISO, startOfWeek, subDays } from 'date-fns'
import { bodyPainAreas } from '../data/bodyPainMap'
import { getCheckoutForEvent, hasEventStarted, parseEventDateTime } from '../utils/events'
import { SectionHeading } from './SectionHeading'

export function HomeView({
  checkouts,
  history,
  painReports = [],
  schedule,
  onGoCheckIn,
  onOpenCheckout,
}) {
  const now = new Date()
  const recentHistory = getEntriesSince(history, 6)
  const previousHistory = getEntriesBetween(history, 13, 7)
  const dueCheckout = schedule.find(
    (event) => hasEventStarted(event) && !getCheckoutForEvent(checkouts, event.id),
  )
  const checkInReminder = getCheckInReminder(schedule, history, now)
  const nextEvent = getNextEvent(schedule, now)
  const todayPlan = getTodayPlan(schedule, history, checkouts, now)
  const recovery = getRecoverySummary(recentHistory, previousHistory)
  const workload = getWorkloadSummary(schedule, checkouts)
  const painWatchlist = getPainWatchlist(history, painReports)
  const recentPainEntries = getRecentPainEntries(history, painReports)
  const patterns = getPatterns(history, checkouts, painWatchlist)
  const readinessTrend = history
    .filter((entry) => entry.date)
    .slice(0, 14)
    .reverse()

  return (
    <div className="home-view">
      <section className="home-hero">
        <SectionHeading
          eyebrow="Athlete Reload"
          title="Training dashboard."
        />
        <p>
          A live view of readiness, workload, pain patterns, and today&apos;s
          event flow from your saved check-ins and checkouts.
        </p>
      </section>

      <div className="home-alerts">
        {dueCheckout && (
          <button
            className="checkout-alert"
            onClick={() => onOpenCheckout(dueCheckout)}
            type="button"
          >
            <span>Checkout ready</span>
            <strong>{getEventName(dueCheckout)}</strong>
            <em>Log session</em>
          </button>
        )}

        {checkInReminder && (
          <button
            className="checkout-alert checkin-alert"
            onClick={() => onGoCheckIn(checkInReminder)}
            type="button"
          >
            <span>Check-in available</span>
            <strong>{getEventName(checkInReminder)}</strong>
            <em>Check in</em>
          </button>
        )}
      </div>

      <section className="dashboard-summary">
        <DashboardMetric
          label="7-day readiness"
          value={recovery.readinessAverage}
          detail={formatChange(recovery.readinessChange, 'vs previous 7')}
          tone={getReadinessTone(recovery.readinessAverage)}
        />
        <DashboardMetric
          label="Average sleep"
          value={`${recovery.sleepAverage}h`}
        />
        <DashboardMetric
          label="Average fatigue"
          value={`${recovery.fatigueAverage}/10`}
          detail={recovery.fatigueAverage >= 7 ? 'High fatigue load' : undefined}
          tone={recovery.fatigueAverage >= 7 ? 'warning' : 'neutral'}
        />
        <DashboardMetric
          label="Average weekly minutes"
          value={workload.averageWeeklyMinutes}
          detail="From checkouts"
        />
      </section>

      <section className="home-panels dashboard-main">
        <article className="home-panel today-flow-panel">
          <div className="panel-heading">
            <span>Today</span>
            <strong>{format(now, 'EEE, MMM d')}</strong>
          </div>
          <h3>Today&apos;s events</h3>
          <div className="today-event-list">
            {todayPlan.length === 0 ? (
              <p>No scheduled events today.</p>
            ) : (
              todayPlan.map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{getEventName(event)}</strong>
                    <p>{event.association || 'Personal'}{event.time ? ` at ${formatTimeLabel(event.time)}` : ''}</p>
                  </div>
                  {event.action === 'pre' ? (
                    <button
                      className={`event-status ${event.statusTone}`}
                      onClick={() => onGoCheckIn(event)}
                      type="button"
                    >
                      {event.status}
                    </button>
                  ) : event.action === 'post' ? (
                    <button
                      className={`event-status ${event.statusTone}`}
                      onClick={() => onOpenCheckout(event)}
                      type="button"
                    >
                      {event.status}
                    </button>
                  ) : (
                    <span className={`event-status ${event.statusTone}`}>{event.status}</span>
                  )}
                </article>
              ))
            )}
          </div>
        </article>

        <article className="home-panel next-event-panel">
          <div className="panel-heading">
            <span>Next event</span>
            <strong>{nextEvent ? format(parseISO(nextEvent.date), 'MMM d') : 'Open'}</strong>
          </div>
          {nextEvent ? (
            <>
              <h3>{getEventName(nextEvent)}</h3>
              <p>
                {nextEvent.association || 'Personal'} {nextEvent.time ? `at ${formatTimeLabel(nextEvent.time)}` : ''}
              </p>
              <div className="event-meta-grid">
                <span><strong>Type</strong>{nextEvent.type}</span>
                <span><strong>Planned load</strong>{nextEvent.load}</span>
              </div>
            </>
          ) : (
            <>
              <h3>No future training scheduled.</h3>
              <p>Add an event on the schedule to connect check-ins, checkouts, and workload.</p>
            </>
          )}
        </article>
      </section>

      <section className="home-panels">
        <article className="home-panel">
          <div className="panel-heading">
            <span>Readiness</span>
          </div>
          <h3>Recent readiness trend</h3>
          {readinessTrend.length < 7 ? (
            <div className="chart-empty-state">
              <strong>{7 - readinessTrend.length} more check-in{readinessTrend.length === 6 ? '' : 's'} needed</strong>
              <p>A readiness line graph will appear after at least one week of entries.</p>
            </div>
          ) : (
            <ReadinessLineGraph entries={readinessTrend} />
          )}
        </article>

        <article className="home-panel">
          <div className="panel-heading">
            <span>Workload</span>
          </div>
          <h3>Weekly minutes</h3>
          <p>
            This uses the minutes you log in checkouts. Once you
            have more weeks saved, the average becomes more useful.
          </p>
          <div className="weekly-minutes-card">
            <strong>{workload.averageWeeklyMinutes}</strong>
            <span>average minutes per week</span>
          </div>
          <div className="workload-list compact-workload-list">
            <span>
              <strong>This week</strong>
              <em>{workload.thisWeekMinutes} min logged</em>
            </span>
            <span>
              <strong>Logged weeks</strong>
              <em>{workload.weekCount || 'None yet'}</em>
            </span>
          </div>
        </article>
      </section>

      <section className="home-panels">
        <article className="home-panel">
          <div className="panel-heading">
            <span>Pain timeline</span>
          </div>
          <h3>Recent reports</h3>
          <div className="pain-watch-list">
            {recentPainEntries.length === 0 ? (
              <p>No pain areas have been reported recently.</p>
            ) : (
              recentPainEntries.slice(0, 6).map((entry) => (
                <article key={`${entry.date}-${entry.label}-${entry.source}-${entry.score}`}>
                  <div>
                    <strong>{entry.label}</strong>
                    <p>{entry.dateLabel} - {entry.source}</p>
                  </div>
                  <span>{entry.score}/10</span>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="home-panel">
          <div className="panel-heading">
            <span>Pattern detection</span>
          </div>
          <h3>What stands out</h3>
          <div className="pattern-list">
            {patterns.map((pattern) => (
              <p key={pattern}>{pattern}</p>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function DashboardMetric({ detail, label, tone = 'neutral', value }) {
  return (
    <article className={`stat-card dashboard-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </article>
  )
}

function ReadinessLineGraph({ entries }) {
  const points = entries.map((entry, index) => {
    const x = entries.length === 1 ? 50 : (index / (entries.length - 1)) * 100
    const y = 100 - Number(entry.score)

    return {
      date: format(parseISO(entry.date), 'M/d'),
      id: `${entry.date}-${entry.eventId ?? entry.createdAt ?? index}`,
      score: Number(entry.score),
      x,
      y,
    }
  })
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="readiness-line-chart">
      <svg aria-label="Readiness line graph" preserveAspectRatio="none" viewBox="0 0 100 100">
        <line x1="0" x2="100" y1="20" y2="20" />
        <line x1="0" x2="100" y1="50" y2="50" />
        <line x1="0" x2="100" y1="80" y2="80" />
        <polyline points={polyline} />
        {points.map((point) => (
          <circle cx={point.x} cy={point.y} key={point.id} r="2.4" />
        ))}
      </svg>
      <div className="line-chart-labels">
        {points.map((point) => (
          <span key={point.id}>
            <strong>{point.score}</strong>
            <em>{point.date}</em>
          </span>
        ))}
      </div>
    </div>
  )
}

function formatTimeLabel(value) {
  if (!value) return ''
  if (!/^\d{2}:\d{2}$/.test(value)) return value

  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minuteText} ${suffix}`
}

function getEntriesSince(entries, daysBack) {
  const cutoff = subDays(new Date(), daysBack)
  cutoff.setHours(0, 0, 0, 0)

  return entries.filter((entry) =>
    entry.date && new Date(`${entry.date}T12:00:00`) >= cutoff
  )
}

function getEntriesBetween(entries, startDaysBack, endDaysBack) {
  const start = subDays(new Date(), startDaysBack)
  const end = subDays(new Date(), endDaysBack)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  return entries.filter((entry) => {
    if (!entry.date) return false
    const date = new Date(`${entry.date}T12:00:00`)
    return date >= start && date <= end
  })
}

function getRecoverySummary(recentHistory, previousHistory) {
  const readinessAverage = average(recentHistory.map((entry) => entry.score))
  const previousReadiness = average(previousHistory.map((entry) => entry.score))

  return {
    fatigueAverage: average(recentHistory.map((entry) => entry.fatigue)),
    readinessAverage,
    readinessChange: readinessAverage - previousReadiness,
    sleepAverage: average(recentHistory.map((entry) => Number(entry.sleep)), 1),
  }
}

function getWorkloadSummary(schedule, checkouts) {
  const weekStart = startOfWeek(new Date())
  weekStart.setHours(0, 0, 0, 0)
  const weekCheckouts = checkouts.filter((checkout) =>
    checkout.date && new Date(`${checkout.date}T12:00:00`) >= weekStart
  )
  const thisWeekMinutes = weekCheckouts.reduce((total, checkout) =>
    total + Number(checkout.actualMinutes ?? 0), 0)
  const weeklyMinutes = getWeeklyMinutes(checkouts)

  return {
    averageWeeklyMinutes: average(weeklyMinutes.map((week) => week.minutes)),
    thisWeekMinutes,
    weekCount: weeklyMinutes.length,
  }
}

function getWeeklyMinutes(checkouts) {
  const grouped = new Map()

  checkouts.forEach((checkout) => {
    if (!checkout.date) return
    const week = format(startOfWeek(parseISO(checkout.date)), 'yyyy-MM-dd')
    grouped.set(week, (grouped.get(week) ?? 0) + Number(checkout.actualMinutes ?? 0))
  })

  return [...grouped.entries()].map(([week, minutes]) => ({ minutes, week }))
}

function getTodayPlan(schedule, history, checkouts, now) {
  const todayIso = toIsoDate(now)
  const todayEvents = schedule
    .filter((event) => event.date === todayIso)
    .sort((first, second) => parseEventDateTime(first) - parseEventDateTime(second))
  const activeEvent = todayEvents.find((event) =>
    !checkouts.some((checkout) => checkout.eventId === event.id)
  )

  return todayEvents
    .map((event) => {
      const hasPre = history.some((entry) => entry.eventId === event.id)
      const hasPost = checkouts.some((checkout) => checkout.eventId === event.id)
      const eventStarted = hasEventStarted(event)
      const isActiveEvent = event.id === activeEvent?.id

      if (hasPost) return { ...event, action: null, status: 'Completed', statusTone: 'complete' }
      if (isActiveEvent && eventStarted && hasPre) {
        return { ...event, action: 'post', status: 'Complete Post Check-In', statusTone: 'warning' }
      }
      if (hasPre || !isActiveEvent) return { ...event, action: null, status: 'Not Started', statusTone: 'ready' }

      return { ...event, action: 'pre', status: 'Complete Pre Check-In', statusTone: 'pending' }
    })
}

function getNextEvent(schedule, now) {
  return schedule
    .filter((event) => {
      const eventDate = parseEventDateTime(event)
      return eventDate && eventDate > now
    })
    .sort((first, second) => parseEventDateTime(first) - parseEventDateTime(second))[0]
}

function getCheckInReminder(schedule, history, now) {
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  return schedule.find((event) => {
    const eventDate = parseEventDateTime(event)
    const hasPreCheckIn = history.some((entry) => entry.eventId === event.id)
    const isToday = event.date === toIsoDate(now)

    return isToday && eventDate && eventDate > now && eventDate <= threeHoursFromNow && !hasPreCheckIn
  })
}

function getPainWatchlist(history, painReports) {
  const grouped = new Map()
  const reportSourceIds = new Set(
    painReports
      .filter((report) => report.sourceType === 'check_in' && report.sourceId)
      .map((report) => report.sourceId),
  )

  painReports.forEach((report) => {
    if (Number(report.severity ?? 0) <= 0) return
    addPainGroup(grouped, getPainLabel(report.bodyPart, report.side), Number(report.severity) / 10)
  })

  history.forEach((entry) => {
    if (reportSourceIds.has(entry.id)) return

    bodyPainAreas.forEach((area) => {
      const severity = Number(entry.painMap?.[area.id] ?? 0)
      if (severity > 0) addPainGroup(grouped, area.label, severity / 10)
    })

    if (!entry.painMap && Number(entry.pain ?? 0) > 0) {
      addPainGroup(grouped, entry.location ?? 'Pain area', Number(entry.pain))
    }
  })

  return [...grouped.entries()]
    .map(([label, value]) => ({
      average: Math.round(value.total / value.count),
      count: value.count,
      label,
    }))
    .sort((first, second) => second.average - first.average || second.count - first.count)
}

function getRecentPainEntries(history, painReports) {
  const reportSourceIds = new Set(
    painReports
      .filter((report) => report.sourceType === 'check_in' && report.sourceId)
      .map((report) => report.sourceId),
  )
  const fromPainReports = painReports
    .filter((report) => Number(report.severity ?? 0) > 0)
    .map((report) => ({
      date: report.date,
      dateLabel: formatPainDate(report.date),
      label: getPainLabel(report.bodyPart, report.side),
      score: Math.round(Number(report.severity) / 10),
      source: getPainSourceLabel(report.sourceType),
      sourceId: report.sourceId,
    }))

  const fromHistory = history.flatMap((entry) => {
    if (reportSourceIds.has(entry.id)) return []

    if (entry.painMap) {
      return bodyPainAreas
        .map((area) => {
          const severity = Number(entry.painMap?.[area.id] ?? 0)
          if (severity <= 0) return null

          return {
            date: entry.date,
            dateLabel: formatPainDate(entry.date),
            label: area.label,
            score: Math.round(severity / 10),
            source: 'Check-in',
            sourceId: entry.id,
          }
        })
        .filter(Boolean)
    }

    if (Number(entry.pain ?? 0) <= 0) return []

    return [{
      date: entry.date,
      dateLabel: formatPainDate(entry.date),
      label: entry.location ?? 'Pain area',
      score: Number(entry.pain),
      source: 'Check-in',
      sourceId: entry.id,
    }]
  })

  return dedupePainEntries([...fromPainReports, ...fromHistory])
    .sort((first, second) => new Date(`${second.date}T12:00:00`) - new Date(`${first.date}T12:00:00`))
}

function dedupePainEntries(entries) {
  return entries.reduce((kept, entry) => {
    const duplicateIndex = kept.findIndex((current) => isSamePainReport(current, entry))

    if (duplicateIndex < 0) {
      kept.push(entry)
      return kept
    }

    if (getPainLabelSpecificity(entry.label) > getPainLabelSpecificity(kept[duplicateIndex].label)) {
      kept[duplicateIndex] = entry
    }

    return kept
  }, [])
}

function isSamePainReport(first, second) {
  if (first.date !== second.date) return false
  if (first.source !== second.source) return false
  if (first.score !== second.score) return false
  if (first.sourceId && second.sourceId && first.sourceId !== second.sourceId) return false

  const firstLabel = normalizePainLabel(first.label)
  const secondLabel = normalizePainLabel(second.label)

  return firstLabel === secondLabel ||
    firstLabel.includes(secondLabel) ||
    secondLabel.includes(firstLabel)
}

function getPainLabelSpecificity(label) {
  const normalized = normalizePainLabel(label)
  const sideScore = /\b(left|right|upper|lower)\b/.test(normalized) ? 10 : 0

  return sideScore + normalized.length
}

function normalizePainLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function addPainGroup(grouped, label, score) {
  const current = grouped.get(label) ?? { count: 0, total: 0 }
  grouped.set(label, {
    count: current.count + 1,
    total: current.total + score,
  })
}

function getPatterns(history, checkouts, painWatchlist) {
  const patterns = []
  const recentHistory = getEntriesSince(history, 6)
  const recentCheckouts = getEntriesSince(checkouts, 6)
  const lowSleepDays = recentHistory.filter((entry) => Number(entry.sleep) < 7)
  const highFatigueDays = recentHistory.filter((entry) => Number(entry.fatigue) >= 7)
  const worsePainSessions = recentCheckouts.filter((checkout) =>
    ['Slightly worse', 'Worse'].includes(checkout.painChange),
  )
  const hardSessions = recentCheckouts.filter((checkout) => Number(checkout.difficulty) >= 8)

  if (lowSleepDays.length >= 2) {
    patterns.push(`Low sleep showed up ${lowSleepDays.length} times in the last 7 days.`)
  }

  if (highFatigueDays.length >= 2) {
    patterns.push(`Fatigue reached 7/10 or higher ${highFatigueDays.length} times recently.`)
  }

  if (hardSessions.length >= 2) {
    patterns.push(`${hardSessions.length} high-effort checkouts are stacking into this week.`)
  }

  if (worsePainSessions.length > 0) {
    patterns.push(`${worsePainSessions.length} checkout reported worse pain after training.`)
  }

  if (painWatchlist[0]?.count >= 2) {
    patterns.push(`${painWatchlist[0].label} has appeared ${painWatchlist[0].count} times. Track how it responds after sessions.`)
  }

  if (patterns.length === 0) {
    patterns.push('No strong trend yet. More event-based check-ins and checkouts will sharpen this dashboard.')
  }

  return patterns
}

function getEventName(event) {
  return event.title || event.type || 'Training'
}

function getPainLabel(bodyPart, side) {
  if (!bodyPart) return 'Pain area'
  if (!side || side === 'center') return bodyPart
  if (bodyPart.toLowerCase().startsWith(side.toLowerCase())) return bodyPart

  return `${capitalize(side)} ${bodyPart}`
}

function getPainSourceLabel(sourceType) {
  if (['checkout', 'post_event', 'post_check_in'].includes(sourceType)) {
    return 'Checkout'
  }

  return 'Check-in'
}

function formatPainDate(date) {
  if (!date) return 'No date'

  return format(parseISO(date), 'MMM d')
}

function getReadinessTone(score) {
  if (score >= 80) return 'positive'
  if (score >= 60) return 'neutral'
  if (score > 0) return 'warning'

  return 'neutral'
}

function formatChange(value, label) {
  if (!Number.isFinite(value) || value === 0) return `No change ${label}`
  return `${value > 0 ? '+' : ''}${value} ${label}`
}

function average(values, decimals = 0) {
  const cleanValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  if (cleanValues.length === 0) return decimals > 0 ? '0.0' : 0

  const result = cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length

  return decimals > 0 ? result.toFixed(decimals) : Math.round(result)
}

function capitalize(value) {
  if (!value || value === 'center') return ''

  return `${value[0].toUpperCase()}${value.slice(1)}`
}

function toIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
