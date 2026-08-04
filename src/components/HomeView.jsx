import { differenceInCalendarDays, format, parseISO, startOfWeek, subDays } from 'date-fns'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { bodyPainAreas } from '../data/bodyPainMap'
import { getCheckoutForEvent, hasEventStarted, isAllDayEvent, isEventActionable, isRestDayEvent, parseEventDateTime } from '../utils/events'
import { SectionHeading } from './SectionHeading'
import { PainShareModal } from './PainShareModal'

const athleteQuotes = [
  { quote: 'Set your goals high, and do not stop until you get there.', athlete: 'Bo Jackson' },
  { quote: 'Champions keep playing until they get it right.', athlete: 'Billie Jean King' },
  { quote: 'You have to expect things of yourself before you can do them.', athlete: 'Michael Jordan' },
  { quote: 'The only way to prove that you are a good sport is to lose.', athlete: 'Ernie Banks' },
  { quote: 'Never let your head hang down. Never give up and sit down and grieve.', athlete: 'Satchel Paige' },
]

export function HomeView({
  athleteProfile,
  checkouts,
  history,
  painIssues = [],
  painReports = [],
  schedule,
  onGoCheckIn,
  onOpenCheckout,
  onSavePainIssue,
  onSharePainIssue,
}) {
  const now = new Date()
  const recentHistory = getEntriesSince(history, 6)
  const previousHistory = getEntriesBetween(history, 13, 7)
  const dueCheckout = schedule.find(
    (event) => hasEventStarted(event)
      && history.some((entry) => entry.eventId === event.id && entry.checkInType !== 'post_event')
      && !getCheckoutForEvent(checkouts, event.id),
  )
  const checkInReminder = getCheckInReminder(schedule, history, now)
  const nextEvent = getNextEvent(schedule, now)
  const todayPlan = getTodayPlan(schedule, history, checkouts, now)
  const recovery = getRecoverySummary(recentHistory, previousHistory)
  const workload = getWorkloadSummary(schedule, checkouts)
  const painWatchlist = getPainWatchlist(history, painReports)
  const painTimelines = getPainTimelines(history, painReports)
  const athleteQuote = athleteQuotes[Math.abs(differenceInCalendarDays(now, new Date(2020, 0, 1))) % athleteQuotes.length]
  const weeklySignals = getWeeklySignals(history)

  return (
    <div className="home-view" data-tour="home-page">
      <section className="home-hero" data-tour="home-intro">
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
          label="Next event"
          value={nextEvent ? getEventCountdown(nextEvent, now) : 'Open'}
          detail={nextEvent ? getEventName(nextEvent) : 'Nothing scheduled'}
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
            <strong>{nextEvent ? format(parseISO(nextEvent.date), 'EEE, MMM d') : 'Open'}</strong>
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
        <article className="home-panel weekly-signals-panel">
          <div className="panel-heading">
            <span>Weekly signals</span>
            <strong>Last 7 days</strong>
          </div>
          <h3>Readiness, sleep, fatigue, and soreness</h3>
          {weeklySignals.length < 4 ? (
            <p>Keep checking in. This view begins after four entries so a single day never looks like a trend.</p>
          ) : (
            <ResponsiveContainer height={180} width="100%">
              <AreaChart accessibilityLayer={false} data={weeklySignals} margin={{ bottom: 2, left: -20, right: 6, top: 8 }}>
                <CartesianGrid horizontal stroke="rgba(77, 83, 93, 0.12)" strokeDasharray="3 5" vertical={false} />
                <XAxis axisLine={false} dataKey="date" tick={{ fill: '#737984', fontSize: 11, fontWeight: 700 }} tickLine={false} />
                <YAxis axisLine={false} domain={[0, 100]} hide />
                <Tooltip content={<SignalTooltip />} cursor={{ stroke: 'rgba(32, 38, 47, 0.18)' }} />
                <Area animationDuration={650} dataKey="readiness" fill="rgba(38, 185, 126, 0.12)" fillOpacity={1} stroke="#26b97e" strokeWidth={2.4} type="monotone" />
                <Area animationDuration={720} dataKey="sleep" fill="transparent" stroke="#2f8cff" strokeWidth={2} type="monotone" />
                <Area animationDuration={790} dataKey="fatigue" fill="transparent" stroke="#f3b43f" strokeDasharray="5 4" strokeWidth={2} type="monotone" />
                <Area animationDuration={860} dataKey="soreness" fill="transparent" stroke="#ff6f61" strokeDasharray="2 4" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="signal-legend"><span className="readiness">Readiness</span><span className="sleep">Sleep</span><span className="fatigue">Fatigue</span><span className="soreness">Soreness</span></div>
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

        <PainIssuesCard issues={painIssues} painReports={painReports} onSaveIssue={onSavePainIssue} onShareIssue={onSharePainIssue} />
      </section>

      <section className="home-panels">
        <article className="home-panel">
          <div className="panel-heading">
            <span>Pain timeline</span>
          </div>
          <h3>Pain by body area</h3>
          <div className="pain-timeline-list">
            {painTimelines.length === 0 ? (
              <p>Report the same pain area on two different days to see its timeline here.</p>
            ) : (
              painTimelines.map((timeline) => <PainTimelineChart key={timeline.label} timeline={timeline} />)
            )}
          </div>
        </article>

        <article className="home-panel">
          <div className="panel-heading">
            <span>Daily encouragement</span>
          </div>
          <h3>&ldquo;{athleteQuote.quote}&rdquo;</h3>
          <p className="pattern-disclaimer">{athleteQuote.athlete}</p>
        </article>
      </section>
    </div>
  )
}

function getWeeklySignals(history) {
  const latestByDate = new Map()

  history.forEach((entry) => {
    if (!entry.date || latestByDate.has(entry.date)) return
    latestByDate.set(entry.date, entry)
  })

  return [...latestByDate.values()]
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(-7)
    .map((entry) => ({
      date: format(parseISO(entry.date), 'M/d'),
      fatigue: Number(entry.fatigue ?? 0) * 20,
      readiness: Number(entry.score ?? 0),
      sleep: Math.min(100, (Number(entry.sleep ?? 0) / 10) * 100),
      soreness: Number(entry.soreness ?? 0) * 20,
    }))
}

function PainIssuesCard({ issues, painReports, onSaveIssue, onShareIssue }) {
  const reportGroups = getPainIssueSummaries(painReports)
  const [shareTarget, setShareTarget] = useState(null)

  return (
    <article className="home-panel pain-issues-panel">
      <div className="panel-heading">
        <span>Pain reports</span>
        <strong>{reportGroups.length ? `${reportGroups.length} area${reportGroups.length === 1 ? '' : 's'}` : 'Clear'}</strong>
      </div>
      <h3>Track active issues</h3>
      {reportGroups.length === 0 ? (
        <p>No reported pain areas to track right now.</p>
      ) : (
        <div className="pain-issue-list">
          {reportGroups.slice(0, 4).map((summary) => {
            const issue = issues.find((item) => item.bodyPart === summary.bodyPart && item.side === summary.side)
            const draft = issue ?? {
              bodyPart: summary.bodyPart,
              firstReportedDate: summary.firstReportedDate,
              side: summary.side,
              status: 'active',
            }

            return (
              <article className="pain-issue-row" key={summary.key}>
                <div>
                  <strong>{summary.label}</strong>
                  <p>Now {summary.currentSeverity}/10 · Peak {summary.peakSeverity}/10 · First reported {summary.firstReportedDate}</p>
                  {summary.trigger && <small>Trigger: {summary.trigger}</small>}
                </div>
                <div className="pain-issue-controls">
                  <select value={draft.status} onChange={(event) => onSaveIssue?.({ ...draft, status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="evaluated">Evaluated</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  {!issue && <button className="secondary-button compact-action" onClick={() => onSaveIssue?.(draft)} type="button">Track</button>}
                </div>
                {issue && <PainIssueNotes issue={issue} onSave={onSaveIssue} />}
                <button className="text-button pain-share-button" onClick={() => setShareTarget({ issue, summary })} type="button">Create shareable report</button>
              </article>
            )
          })}
        </div>
      )}
      {shareTarget && <PainShareModal issue={shareTarget.issue} summary={shareTarget.summary} onClose={() => setShareTarget(null)} onConfirm={onShareIssue} />}
    </article>
  )
}

function PainIssueNotes({ issue, onSave }) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(issue)

  function saveNotes() {
    onSave?.({ ...draft, id: issue.id })
    setIsOpen(false)
  }

  return (
    <div className="pain-issue-notes">
      <button className="text-button" onClick={() => setIsOpen((current) => !current)} type="button">{isOpen ? 'Hide notes' : 'Add notes'}</button>
      {isOpen && (
        <div>
          <label>Athlete notes<textarea value={draft.athleteNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, athleteNotes: event.target.value }))} /></label>
          <label>Trainer notes<textarea value={draft.trainerNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, trainerNotes: event.target.value }))} /></label>
          <label>Clinician notes<textarea value={draft.clinicianNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, clinicianNotes: event.target.value }))} /></label>
          <button className="secondary-button compact-action" onClick={saveNotes} type="button">Save notes</button>
        </div>
      )}
    </div>
  )
}

function getPainIssueSummaries(painReports) {
  const summaries = new Map()

  for (const report of [...painReports].sort((first, second) => `${first.date}:${first.createdAt ?? ''}`.localeCompare(`${second.date}:${second.createdAt ?? ''}`))) {
    const key = `${report.bodyPart}:${report.side ?? 'center'}`
    const current = summaries.get(key)
    const label = formatPainAreaLabel(report)
    const severity = normalizePainSeverity(report.severity)

    if (!current) {
      summaries.set(key, {
        bodyPart: report.bodyPart,
        currentSeverity: severity,
        firstReportedDate: report.date,
        key,
        label,
        latestDate: report.date,
        peakSeverity: severity,
        side: report.side ?? 'center',
        trigger: report.triggerMovement,
      })
      continue
    }

    current.firstReportedDate = current.firstReportedDate < report.date ? current.firstReportedDate : report.date
    current.peakSeverity = Math.max(current.peakSeverity, severity)
    if (report.date >= current.latestDate) {
      current.currentSeverity = severity
      current.latestDate = report.date
      current.trigger = report.triggerMovement
    }
  }

  return [...summaries.values()]
    .filter((summary) => summary.currentSeverity > 0)
    .sort((first, second) => second.latestDate.localeCompare(first.latestDate))
}

function formatPainAreaLabel(report) {
  const side = report.side && report.side !== 'center' && !String(report.bodyPart).toLowerCase().startsWith(report.side.toLowerCase())
    ? `${report.side} `
    : ''
  return `${side}${report.bodyPart}`.replace(/\b\w/g, (character) => character.toUpperCase())
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

function PainTimelineChart({ timeline }) {
  const gradientId = `pain-fill-${timeline.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <article className="pain-timeline-chart">
      <div className="pain-timeline-chart-heading">
        <strong>{timeline.label}</strong>
        <span>{timeline.points.length} days tracked</span>
      </div>
      <div className="pain-recharts-canvas" role="img" aria-label={`${timeline.label} pain over time`}>
        <ResponsiveContainer height={188} width="100%">
          <AreaChart accessibilityLayer={false} data={timeline.points} margin={{ bottom: 2, left: -12, right: 12, top: 10 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff6f61" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#ff6f61" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal stroke="rgba(77, 83, 93, 0.14)" strokeDasharray="3 5" vertical={false} />
            <XAxis axisLine={false} dataKey="dateLabel" interval={0} minTickGap={0} tick={{ fill: '#737984', fontSize: 11, fontWeight: 700 }} tickLine={false} />
            <YAxis allowDecimals={false} axisLine={false} domain={[0, 10]} tick={{ fill: '#737984', fontSize: 11, fontWeight: 800 }} tickLine={false} ticks={[0, 5, 10]} width={30} />
            <Tooltip content={<PainTooltip />} cursor={{ stroke: 'rgba(233, 88, 74, 0.2)' }} />
            <Area animationDuration={700} dataKey="score" dot={{ fill: '#ffffff', r: 4, stroke: '#e9584a', strokeWidth: 2 }} fill={`url(#${gradientId})`} fillOpacity={1} stroke="#e9584a" strokeWidth={3} type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
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
    isEventActionable(event) && !checkouts.some((checkout) => checkout.eventId === event.id)
  )

  return todayEvents
    .map((event) => {
      if (isAllDayEvent(event)) return { ...event, action: null, status: `${isRestDayEvent(event) ? 'Planned rest' : 'Planned recovery'} · All day`, statusTone: 'complete' }
      const hasPre = history.some((entry) => entry.eventId === event.id)
      const hasPost = checkouts.some((checkout) => checkout.eventId === event.id)
      const eventStarted = hasEventStarted(event)
      const isActiveEvent = event.id === activeEvent?.id

      if (hasPost) return { ...event, action: null, status: 'Completed', statusTone: 'complete' }
      if (isActiveEvent && eventStarted && hasPre) {
        return { ...event, action: 'post', status: 'Complete Checkout', statusTone: 'warning' }
      }
      if (hasPre || !isActiveEvent) return { ...event, action: null, status: 'Not Started', statusTone: 'ready' }

      return { ...event, action: 'pre', status: 'Complete Check-in', statusTone: 'pending' }
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
    if (!isEventActionable(event)) return false
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

  const latestReportByArea = new Map()
  painReports.forEach((report) => {
    const label = getPainLabel(report.bodyPart, report.side)
    const current = latestReportByArea.get(label)
    if (!current || `${report.date}:${report.createdAt ?? ''}` > `${current.date}:${current.createdAt ?? ''}`) latestReportByArea.set(label, report)
  })
  latestReportByArea.forEach((report, label) => {
    if (Number(report.severity ?? 0) > 0) addPainGroup(grouped, label, normalizePainSeverity(report.severity))
  })

  history.forEach((entry) => {
    if (reportSourceIds.has(entry.id)) return

    bodyPainAreas.forEach((area) => {
      const severity = Number(entry.painMap?.[area.id] ?? 0)
      if (severity > 0) addPainGroup(grouped, area.label, normalizePainSeverity(severity))
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
    .map((report) => ({
      createdAt: report.createdAt,
      date: report.date,
      dateLabel: formatPainDate(report.date),
      label: getPainLabel(report.bodyPart, report.side),
      areaKey: `${normalizePainLabel(report.bodyPart)}:${String(report.side ?? 'center').toLowerCase()}`,
      score: normalizePainSeverity(report.severity),
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
            createdAt: entry.createdAt,
            date: entry.date,
            dateLabel: formatPainDate(entry.date),
            label: area.label,
            areaKey: `${normalizePainLabel(area.recommendationLocation ?? area.label)}:${area.side}`,
            score: normalizePainSeverity(severity),
            source: 'Check-in',
            sourceId: entry.id,
          }
        })
        .filter(Boolean)
    }

    if (Number(entry.pain ?? 0) <= 0) return []

    return [{
      createdAt: entry.createdAt,
      date: entry.date,
      dateLabel: formatPainDate(entry.date),
      label: entry.location ?? 'Pain area',
      areaKey: `${normalizePainLabel(entry.location ?? 'Pain area')}:center`,
      score: Number(entry.pain),
      source: 'Check-in',
      sourceId: entry.id,
    }]
  })

  return dedupePainEntries([...fromPainReports, ...fromHistory])
    .sort((first, second) => new Date(`${second.date}T12:00:00`) - new Date(`${first.date}T12:00:00`))
}

function getPainTimelines(history, painReports) {
  const byArea = new Map()

  getRecentPainEntries(history, painReports).forEach((entry) => {
    const areaKey = entry.areaKey ?? normalizePainLabel(entry.label)
    const area = byArea.get(areaKey) ?? { dayEntries: new Map(), label: entry.label }
    const dayEntries = area.dayEntries
    const current = dayEntries.get(entry.date)

    const entryTime = `${entry.date}:${entry.createdAt ?? ''}`
    const currentTime = `${current?.date ?? ''}:${current?.createdAt ?? ''}`
    if (!current || entryTime > currentTime || (entryTime === currentTime && entry.score > current.score)) {
      dayEntries.set(entry.date, entry)
    }
    byArea.set(areaKey, area)
  })

  return [...byArea.values()]
    .map(({ label, dayEntries }) => {
      const reportedPoints = [...dayEntries.values()]
        .sort((first, second) => first.date.localeCompare(second.date))
        .slice(-6)
      const latestPoint = reportedPoints[reportedPoints.length - 1]
      const resolvedForMoreThanTwoDays = latestPoint?.score === 0
        && differenceInCalendarDays(new Date(), parseISO(latestPoint.date)) > 2
      return {
        label,
        points: reportedPoints,
        resolvedForMoreThanTwoDays,
      }
    })
    .filter((timeline) => timeline.points.length >= 1 && !timeline.resolvedForMoreThanTwoDays)
    .sort((first, second) => second.points[second.points.length - 1].date.localeCompare(first.points[first.points.length - 1].date))
    .slice(0, 4)
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
  const datedRecords = [...history, ...checkouts]
    .filter((entry) => entry.date)
    .sort((first, second) => first.date.localeCompare(second.date))

  if (datedRecords.length === 0) {
    return ['Save check-ins and checkouts to begin building your personal baseline.']
  }

  const activeDays = new Set(datedRecords.map((entry) => entry.date))
  const firstDate = parseISO(datedRecords[0].date)
    const lastDate = parseISO(datedRecords[datedRecords.length - 1].date)
  const hasBaseline = differenceInCalendarDays(lastDate, firstDate) >= 13 && activeDays.size >= 8

  if (!hasBaseline) {
    const daysLeft = Math.max(0, 14 - (differenceInCalendarDays(new Date(), firstDate) + 1))
    return [
      daysLeft > 0
        ? `Keep logging events for about ${daysLeft} more day${daysLeft === 1 ? '' : 's'} to establish your personal baseline.`
        : 'Keep logging a few more events to establish a reliable personal baseline.',
    ]
  }

  const patterns = [
    getPracticeEffortPattern(checkouts),
    getSprintPainPattern(checkouts),
    getSleepReadinessPattern(history),
    getPersistentSorenessPattern(history),
    getPlannedVsActualPattern(checkouts),
    getHighEffortStackPattern(checkouts),
    getConsecutivePainPattern(checkouts),
    getGameFatiguePattern(checkouts),
    getStressSleepPerformancePattern(history, checkouts),
    getPainWatchlistPattern(painWatchlist),
  ].filter(Boolean)

  return patterns.slice(0, 5).length > 0
    ? patterns.slice(0, 5)
    : ['Your recent event records do not show a repeated pattern yet. Keep using check-ins and checkouts to sharpen the comparison.']
}

function getPracticeEffortPattern(checkouts) {
  const practices = checkouts
    .filter((entry) => isPractice(entry) && Number.isFinite(Number(entry.difficulty)))
    .sort((first, second) => first.date.localeCompare(second.date))

  if (practices.length < 5) return null

  const recent = averageNumber(practices.slice(-3).map((entry) => entry.difficulty))
  const baseline = averageNumber(practices.slice(0, -3).map((entry) => entry.difficulty))

  return recent >= baseline + 1
    ? 'Your last three practices felt harder than your usual practices.'
    : null
}

function getSprintPainPattern(checkouts) {
  const groups = new Map()

  checkouts
    .filter((entry) => entry.sessionContent?.includes('Sprinting'))
    .forEach((entry) => {
      getCheckoutPainAreas(entry).forEach((area) => {
        const current = groups.get(area.label) ?? 0
        groups.set(area.label, current + 1)
      })
    })

  const [area, count] = [...groups.entries()].sort((first, second) => second[1] - first[1])[0] ?? []

  return count >= 3
    ? `${area} discomfort has appeared after sprint-heavy sessions ${count} times.`
    : null
}

function getSleepReadinessPattern(history) {
  const valid = history.filter((entry) => Number.isFinite(Number(entry.sleep)) && Number.isFinite(Number(entry.score)))
  const shortSleep = valid.filter((entry) => Number(entry.sleep) < 7)
  const rested = valid.filter((entry) => Number(entry.sleep) >= 7)

  if (shortSleep.length < 3 || rested.length < 3) return null

  const shortSleepReadiness = averageNumber(shortSleep.map((entry) => entry.score))
  const restedReadiness = averageNumber(rested.map((entry) => entry.score))

  return restedReadiness - shortSleepReadiness >= 8
    ? 'You report lower readiness on days after fewer than seven hours of sleep.'
    : null
}

function getPersistentSorenessPattern(history) {
  const dailyEntries = getLatestEntryPerDay(history)
  if (dailyEntries.length < 3) return null

  const lastThree = dailyEntries.slice(-3)
  const baseline = averageNumber(dailyEntries.slice(0, -2).map((entry) => entry.soreness))
  const elevatedForTwoDays = Number(lastThree[lastThree.length - 1]?.soreness) >= baseline + 1.5 && Number(lastThree[lastThree.length - 2]?.soreness) >= baseline + 1.5

  return elevatedForTwoDays
    ? 'Your soreness usually settles sooner, but it has remained elevated across the last 48 hours.'
    : null
}

function getPlannedVsActualPattern(checkouts) {
  const recent = getEntriesSince(checkouts, 6).filter((entry) => Number.isFinite(Number(entry.difficulty)))
  if (recent.length < 3) return null

  const actual = averageNumber(recent.map((entry) => entry.difficulty))
  const planned = averageNumber(recent.map((entry) => plannedDifficulty(entry.plannedLoad)))

  return actual >= planned + 1
    ? 'Your actual session effort has been higher than the planned intensity this week.'
    : null
}

function getHighEffortStackPattern(checkouts) {
  const recent = getEntriesSince(checkouts, 5)
  const highEffort = recent.filter((entry) => Number(entry.difficulty) >= 8)

  return highEffort.length >= 4
    ? `You have completed ${highEffort.length} high-effort events in the last six days.`
    : null
}

function getConsecutivePainPattern(checkouts) {
  const ordered = [...checkouts].filter((entry) => entry.date).sort((first, second) => first.date.localeCompare(second.date))
  const recentCheckouts = ordered.slice(-3)
  if (recentCheckouts.length < 3) return null

  for (const area of bodyPainAreas) {
    const scores = recentCheckouts.map((entry) => normalizePainSeverity(entry.painMap?.[area.id]))
    if (scores.every((score) => score > 0) && scores[0] <= scores[1] && scores[1] <= scores[2] && scores[2] > scores[0]) {
      return `${area.label} discomfort has increased across three consecutive checkouts.`
    }
  }

  return null
}

function getGameFatiguePattern(checkouts) {
  const games = checkouts.filter((entry) => isGame(entry) && Number.isFinite(Number(entry.postFatigue)))
  const practices = checkouts.filter((entry) => isPractice(entry) && Number.isFinite(Number(entry.postFatigue)))
  if (games.length < 3 || practices.length < 3) return null

  const gameMinutes = averageNumber(games.map((entry) => entry.actualMinutes))
  const practiceMinutes = averageNumber(practices.map((entry) => entry.actualMinutes))
  const gameFatigue = averageNumber(games.map((entry) => entry.postFatigue))
  const practiceFatigue = averageNumber(practices.map((entry) => entry.postFatigue))

  return Math.abs(gameMinutes - practiceMinutes) <= 25 && gameFatigue >= practiceFatigue + 0.75
    ? 'Games produce more post-event fatigue than practices of similar length.'
    : null
}

function getStressSleepPerformancePattern(history, checkouts) {
  const checkInByEvent = new Map(history.filter((entry) => entry.eventId).map((entry) => [entry.eventId, entry]))
  const paired = checkouts
    .map((checkout) => ({ checkIn: checkInByEvent.get(checkout.eventId), checkout }))
    .filter(({ checkIn, checkout }) => checkIn && Number.isFinite(Number(checkout.performanceRating && performanceScore(checkout.performanceRating))))
  const strained = paired.filter(({ checkIn }) => Number(checkIn.sleep) < 7 && stressScore(checkIn.stress) >= 4)
  const other = paired.filter(({ checkIn }) => !(Number(checkIn.sleep) < 7 && stressScore(checkIn.stress) >= 4))

  if (strained.length < 3 || other.length < 3) return null

  return averageNumber(other.map(({ checkout }) => performanceScore(checkout.performanceRating))) - averageNumber(strained.map(({ checkout }) => performanceScore(checkout.performanceRating))) >= 0.75
    ? 'Your performance ratings are usually lower when stress and sleep are both poor.'
    : null
}

function getPainWatchlistPattern(painWatchlist) {
  return painWatchlist[0]?.count >= 3
    ? `${painWatchlist[0].label} has appeared in several recent reports. Track how it responds after specific session types.`
    : null
}

function getCheckoutPainAreas(entry) {
  return bodyPainAreas
    .map((area) => ({ label: area.label, score: normalizePainSeverity(entry.painMap?.[area.id]) }))
    .filter((area) => area.score > 0)
}

function getLatestEntryPerDay(entries) {
  const byDay = new Map()
  entries.filter((entry) => entry.date).forEach((entry) => byDay.set(entry.date, entry))

  return [...byDay.values()].sort((first, second) => first.date.localeCompare(second.date))
}

function isGame(entry) {
  return /game|match|tournament|competition/i.test(`${entry.plannedType ?? ''} ${entry.title ?? ''}`)
}

function isPractice(entry) {
  return /practice|training|team/i.test(`${entry.plannedType ?? ''} ${entry.title ?? ''}`) && !isGame(entry)
}

function plannedDifficulty(load) {
  if (load === 'High') return 8
  if (load === 'Low') return 3

  return 6
}

function performanceScore(value) {
  return ({ Worse: 1, 'Slightly worse': 2, Normal: 3, Better: 4, 'Much better': 5 })[value] ?? NaN
}

function stressScore(value) {
  const numeric = Number(String(value).match(/^\d/)?.[0])
  if (Number.isFinite(numeric)) return numeric
  if (value === 'High') return 5
  if (value === 'Medium') return 3

  return 1
}

function averageNumber(values) {
  const valid = values.map(Number).filter(Number.isFinite)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0
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

function normalizePainSeverity(value) {
  const severity = Number(value) || 0
  return Math.max(0, Math.min(10, Math.round(severity > 10 ? severity / 10 : severity)))
}

function getEventCountdown(event, now) {
  const eventDate = parseEventDateTime(event)
  if (!eventDate) return 'Scheduled'

  const minutes = Math.max(0, Math.round((eventDate.getTime() - now.getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.ceil(minutes / 1440)}d`
}

function getSportInsight(profile, nextEvent, checkouts, painWatchlist) {
  const sport = profile?.sport || 'your sport'
  const position = profile?.position ? ` as a ${profile.position}` : ''
  const recentLoad = checkouts.slice(0, 3).reduce((total, entry) => total + Number(entry.actualMinutes ?? 0) * Number(entry.difficulty ?? 0), 0)
  const pain = painWatchlist[0]

  if (pain && nextEvent) {
    return {
      title: `Protect ${pain.label.toLowerCase()} in the next session.`,
      detail: `For ${getEventName(nextEvent)}, use a gradual ${sport}-specific warm-up and reassess movements that load this area before increasing intensity.`,
    }
  }

  if (recentLoad >= 900) {
    return {
      title: 'Recent workload is meaningful.',
      detail: `Your last three checkouts total a higher session load. Prioritize normal food, fluids, sleep, and a deliberate warm-up for ${sport}${position}.`,
    }
  }

  return {
    title: nextEvent ? `Prepare for ${getEventName(nextEvent)}.` : `Keep building your ${sport} baseline.`,
    detail: nextEvent
      ? `Use the next check-in to match your plan to the event's ${String(nextEvent.load ?? 'planned').toLowerCase()} load and the demands of ${sport}${position}.`
      : `Consistent check-ins and checkouts will make ${sport}${position} insights more specific over time.`,
  }
}

function SignalTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => <span key={item.dataKey}>{item.name}: {Math.round(Number(item.value))}</span>)}
    </div>
  )
}

function PainTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="chart-tooltip">
      <strong>{point.dateLabel}</strong>
      <span>{point.score}/10 pain</span>
      <small>{point.score === 0 ? 'Reported pain-free' : point.source}</small>
    </div>
  )
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
