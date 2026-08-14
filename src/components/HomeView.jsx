import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { useEffect, useState } from 'react'
import { m } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import '../styles/home-rework.css'
import { bodyPainAreas } from '../data/bodyPainMap'
import { getCheckoutForEvent, hasEventStarted, isAllDayEvent, isEventActionable, isRestDayEvent, parseEventDateTime } from '../utils/events'
import { formatHydration } from '../utils/units'
import { PainShareModal } from './PainShareModal'

export function HomeView({
  athleteProfile,
  checkouts,
  dailyWellness,
  history,
  painIssues = [],
  painReports = [],
  recoveryCompletions = [],
  schedule,
  onGoCheckIn,
  onOpenCheckout,
  onSavePainIssue,
  onSharePainIssue,
  onViewRecovery,
}) {
  const [now, setNow] = useState(() => new Date())
  const unitSystem = athleteProfile?.unitSystem ?? 'imperial'

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const recentHistory = getEntriesSince(history, 6)
  const previousHistory = getEntriesBetween(history, 13, 7)
  const dueCheckout = schedule.find(
    (event) => hasEventStarted(event)
      && history.some((entry) => entry.eventId === event.id && entry.checkInType !== 'post_event')
      && !getCheckoutForEvent(checkouts, event.id),
  )
  const checkInReminder = getCheckInReminder(schedule, history, now)
  const nextEvent = getNextEvent(schedule, now)
  const todayPlan = getTodayPlan(schedule, history, checkouts, dailyWellness, recoveryCompletions, now, unitSystem)
  const recovery = getRecoverySummary(recentHistory, previousHistory)
  const weeklySignals = getWeeklySignals(history, schedule)
  const todayCheckIn = getRelevantCheckIn(history, dueCheckout ?? checkInReminder ?? nextEvent, now)
  const dailyRecommendation = todayCheckIn?.recommendation ?? null
  const recommendationReasons = (dailyRecommendation?.reasons ?? [])
    .map((reason) => typeof reason === 'string' ? reason : reason.label)
    .filter(Boolean)
    .slice(0, 3)
  const latestRecoveryPlan = recoveryCompletions[0]?.details?.plan
  const recoveryPriorities = latestRecoveryPlan?.reportSections?.find((section) => section.id === 'recovery-priorities')?.items?.slice(0, 3) ?? []
  const recoveryStatus = latestRecoveryPlan?.reportSections?.find((section) => section.id === 'recovery-status')
  const activePainSummaries = getPainIssueSummaries(painReports)
  const primaryEvent = dueCheckout ?? checkInReminder ?? nextEvent
  const primaryAction = getPrimaryHomeAction({ dailyRecommendation, dueCheckout, checkInReminder, latestRecoveryPlan, nextEvent, onGoCheckIn, onOpenCheckout, onViewRecovery, recoveryPriorities, todayCheckIn })
  const nextMoves = getRecommendationNextMoves(dailyRecommendation, primaryAction.detail)
  const stateSignals = getCurrentStateSignals({ dailyRecommendation, dailyWellness, recovery, todayCheckIn, unitSystem })
  const readinessScore = Number(dailyRecommendation?.score)
  const hasReadinessScore = Number.isFinite(readinessScore)
  return (
    <div className="home-view" data-tour="home-page">
      <m.section className="home-command-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
        <div className="home-event-command">
          <div className="command-label"><span>{getHomeModeLabel({ dueCheckout, checkInReminder, todayCheckIn, latestRecoveryPlan })}</span></div>
          <h1>{primaryEvent ? getEventName(primaryEvent) : 'Build the next performance block'}</h1>
          <p>{primaryEvent ? `${format(parseISO(primaryEvent.date), 'EEEE, MMM d')} · ${primaryEvent.time ? formatTimeLabel(primaryEvent.time) : 'All day'}${primaryEvent.association && primaryEvent.association !== 'Personal' ? ` · ${primaryEvent.association}` : ''}` : 'Add an event so preparation, fueling, checkout, and recovery work as one flow.'}</p>
          <div className="event-countdown"><span>{dueCheckout ? 'Action due' : 'Starts in'}</span><strong>{dueCheckout ? 'Checkout' : primaryEvent ? getEventCountdown(primaryEvent, now) : 'Open schedule'}</strong>{primaryEvent && <small>{getEventDemandLabel(primaryEvent)}</small>}</div>
        </div>
        {dailyRecommendation ? <div className={`home-readiness-decision ${dailyRecommendation.tone ?? 'neutral'}`}>
          {hasReadinessScore ? <div className="readiness-ring" style={{ '--readiness-progress': `${Math.max(0, Math.min(100, readinessScore)) * 3.6}deg` }}><div><NumberFlow value={Math.round(readinessScore)} /><small>/100</small></div></div> : <div className="readiness-ring empty"><div><strong>—</strong><small>saved</small></div></div>}
          <div><span>{dailyRecommendation._source === 'gemini' ? 'AI event plan' : 'Event decision'}</span><strong>{dailyRecommendation.label ?? 'Check-in saved'}</strong><p>{dailyRecommendation.summary}</p>{dailyRecommendation.confidence != null && <small className="decision-confidence">{Math.round(Number(dailyRecommendation.confidence) * 100)}% context confidence · {dailyRecommendation.confidence < .5 ? 'baseline still developing' : 'personal history included'}</small>}</div>
        </div> : <div className="home-readiness-decision awaiting-checkin">
          <div className="readiness-ring empty"><div><strong>—</strong><small>no plan</small></div></div>
          <div><span>Check-in required</span><strong>No event decision yet</strong><p>Complete the check-in for this event before Athlete Reload evaluates readiness or creates an event plan.</p>{checkInReminder && <button className="hero-checkin-button" onClick={() => onGoCheckIn(checkInReminder)} type="button">Complete check-in</button>}</div>
        </div>}
      </m.section>

      <section className="home-priority-grid">
        <m.article className={`right-now-command ${dailyRecommendation?.tone ?? 'neutral'}`} whileHover={{ y: -2 }}>
          <div className="priority-index">01</div><div><span>Right now</span><h2>{primaryAction.label}</h2><p>{primaryAction.detail}</p></div>
          {primaryAction.onClick && <button className="primary-button" onClick={primaryAction.onClick} type="button">{primaryAction.label}</button>}
          {nextMoves.length > 0 && <div className="home-next-moves"><span>Then</span>{nextMoves.map((move, index) => <p key={`${move}-${index}`}><b>{String(index + 2).padStart(2, '0')}</b>{move}</p>)}</div>}
          {recommendationReasons.length > 0 && <details><summary>Why this is the priority</summary><ul>{recommendationReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details>}
        </m.article>
        <article className="home-current-state" aria-labelledby="current-state-title">
          <div className="home-section-heading"><div><span>Current state</span><h2 id="current-state-title">Signals that change today</h2></div>{todayCheckIn?.recommendation?.confidence != null && <small>{todayCheckIn.recommendation.confidence < .5 ? 'Learning baseline' : 'Personal baseline'}</small>}</div>
          {stateSignals.length ? <div className="current-state-list">{stateSignals.slice(0, 3).map((signal) => <div className={signal.tone ?? ''} key={signal.label}><span>{signal.label}</span><strong>{signal.value}</strong><p>{signal.detail}</p></div>)}</div> : <p className="home-empty-copy">Complete a check-in to reveal only the signals that affect this event.</p>}
        </article>
      </section>

      <section className="home-day-grid">
        <article className="home-timeline" aria-labelledby="today-timeline-title">
          <div className="home-section-heading"><div><span>Today&apos;s flow</span><h2 id="today-timeline-title">Before → event → after</h2></div><small>{format(now, 'EEE, MMM d')}</small></div>
          <ol>{todayPlan.length ? todayPlan.map((moment, index) => <li className={moment.kind ?? ''} key={moment.id}><i>{String(index + 1).padStart(2, '0')}</i><time>{moment.timeLabel ?? (formatTimeLabel(moment.time) || 'All day')}</time><div><strong>{moment.title ?? getEventName(moment)}</strong><span>{moment.status}</span></div>{moment.action === 'pre' ? <button onClick={() => onGoCheckIn(moment)} type="button">Check in</button> : moment.action === 'post' ? <button onClick={() => onOpenCheckout(moment)} type="button">Checkout</button> : null}</li>) : <li className="empty"><i>01</i><time>Today</time><div><strong>No activity yet</strong><span>Schedule an event or log fueling to build today&apos;s flow.</span></div></li>}</ol>
        </article>

        {weeklySignals.length >= 4 ? <article className="home-trend-panel">
          <div className="home-section-heading"><div><span>Recent trend</span><h2>Readiness around events</h2></div><small>{weeklySignals.length} records</small></div>
          <div className="home-chart" role="img" aria-label="Readiness, sleep, fatigue, and soreness over recent check-ins with event markers">
            <ResponsiveContainer height="100%" width="100%"><AreaChart accessibilityLayer={false} data={weeklySignals} margin={{ bottom: 2, left: -20, right: 8, top: 10 }}>
              <defs><linearGradient id="homeReadinessFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e43d30" stopOpacity=".24"/><stop offset="100%" stopColor="#e43d30" stopOpacity="0"/></linearGradient></defs>
              <CartesianGrid horizontal stroke="rgba(77,83,93,.12)" strokeDasharray="3 5" vertical={false}/><XAxis axisLine={false} dataKey="date" tick={{ fill: '#737984', fontSize: 11, fontWeight: 700 }} tickLine={false}/><YAxis domain={[0,100]} hide/><Tooltip content={<SignalTooltip/>}/>
              <Area animationDuration={750} dataKey="readiness" fill="url(#homeReadinessFill)" stroke="#e43d30" strokeWidth={3} type="monotone"/>
              {weeklySignals.filter((point) => point.event).map((point) => <ReferenceDot fill="#111" key={`${point.date}-${point.event}`} r={4} stroke="#fff" strokeWidth={2} x={point.date} y={point.readiness}/>) }
            </AreaChart></ResponsiveContainer>
          </div>
          <p className="trend-interpretation">{getTrendInterpretation(recovery, weeklySignals)}</p><div className="signal-legend"><span>Red line · readiness</span><span>Black dot · event</span></div>
        </article> : <article className="home-trend-panel home-trend-empty"><div className="home-section-heading"><div><span>Recent trend</span><h2>Patterns need real records</h2></div></div><p>Complete four event check-ins to unlock a useful readiness trend—not a decorative chart.</p></article>}
      </section>

      <m.section className={`home-recovery-preview ${latestRecoveryPlan?.tone ?? 'neutral'}`} whileHover={{ y: -2 }}>
        <header><div><span>Recovery plan</span><strong>{latestRecoveryPlan ? 'Living plan' : 'Waiting for checkout'}</strong></div><em>{recoveryPriorities.length ? `${recoveryPriorities.length} active priorities` : checkouts.length ? 'Ready to build' : 'Not active'}</em></header>
        <div className="home-recovery-copy"><h3>{latestRecoveryPlan?.label ?? (checkouts.length ? 'Turn the latest checkout into clear priorities' : 'Recovery starts with what actually happened')}</h3><p>{recoveryStatus?.summary ?? latestRecoveryPlan?.summary ?? (checkouts.length ? 'Recovery can use the completed session, current body response, and next event to organize what matters now.' : 'Complete checkout after an event to unlock a recovery plan tied to the session and what comes next.')}</p></div>
        {recoveryPriorities.length > 0 && <ol>{recoveryPriorities.map((priority, index) => { const text = normalizeRecommendationItem(priority); return <li key={`${text}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{text}</p></li> })}</ol>}
        <button className="home-recovery-action" onClick={onViewRecovery} type="button"><span>{latestRecoveryPlan ? 'Open recovery plan' : 'Go to Recovery'}</span><b aria-hidden="true">→</b></button>
      </m.section>

      {activePainSummaries.length > 0 && <section className="home-attention"><PainIssuesCard issues={painIssues} reportGroups={activePainSummaries} onSaveIssue={onSavePainIssue} onShareIssue={onSharePainIssue} /></section>}
    </div>
  )
}

function getCurrentStateSignals({ dailyRecommendation, dailyWellness, recovery, todayCheckIn, unitSystem }) {
  if (!todayCheckIn && !dailyWellness?.nutritionEntries?.length && !dailyWellness?.hydrationMl) return []

  const signals = []
  const activePain = Object.entries(todayCheckIn?.painMap ?? {}).filter(([, severity]) => Number(severity) > 0).sort((first, second) => Number(second[1]) - Number(first[1]))
  if (activePain.length) signals.push({ label: 'Pain', value: `${formatSignalLabel(activePain[0][0])} · ${activePain[0][1]}/10`, detail: todayCheckIn?.painAffectsMovement ? 'Reported to change movement or performance; this takes priority.' : todayCheckIn?.hurtsWhen ? `Reported with ${todayCheckIn.hurtsWhen}.` : 'Included in the current event plan.', tone: todayCheckIn?.painAffectsMovement ? 'danger' : 'caution', priority: 100 })
  if (todayCheckIn?.illness === true || String(todayCheckIn?.illness ?? '').toLowerCase() === 'yes') signals.push({ label: 'Illness', value: 'Symptoms reported', detail: 'The current recommendation should be followed before normal participation.', tone: 'danger', priority: 95 })
  if (todayCheckIn?.sleep != null) signals.push({
    label: 'Sleep',
    value: `${Number(todayCheckIn.sleep).toFixed(Number(todayCheckIn.sleep) % 1 ? 1 : 0)} hours`,
    detail: todayCheckIn.sleepQuality != null ? `${todayCheckIn.sleepQuality}/5 perceived restoration` : 'Duration logged; restoration was not recorded.',
    tone: Number(todayCheckIn.sleep) < 7 ? 'caution' : '',
    priority: Number(todayCheckIn.sleep) < 7 ? 80 : 35,
  })
  if (todayCheckIn?.fatigue != null) signals.push({
    label: 'Fatigue',
    value: `${todayCheckIn.fatigue}/5`,
    detail: Number(todayCheckIn.fatigue) >= 4 ? 'Higher fatigue is shaping today’s guidance.' : 'No unusually high fatigue reported.',
    tone: Number(todayCheckIn.fatigue) >= 4 ? 'caution' : '',
    priority: Number(todayCheckIn.fatigue) >= 4 ? 85 : 40,
  })
  if (todayCheckIn?.soreness != null && Number(todayCheckIn.soreness) >= 3) signals.push({
    label: 'Soreness',
    value: `${todayCheckIn.soreness}/5`,
    detail: Number(todayCheckIn.soreness) >= 4 ? 'Reassess during the warm-up.' : 'Noticeable, without a reported major limitation.',
    tone: Number(todayCheckIn.soreness) >= 4 ? 'caution' : '',
    priority: Number(todayCheckIn.soreness) >= 4 ? 82 : 55,
  })
  if (dailyWellness?.nutritionEntries?.length) signals.push({
    label: 'Fueling',
    value: `${dailyWellness.nutritionEntries.length} item${dailyWellness.nutritionEntries.length === 1 ? '' : 's'} logged`,
    detail: 'Today’s food log is available to preparation and recovery context.',
    priority: 30,
  })
  if (Number(dailyWellness?.hydrationMl) > 0) signals.push({
    label: 'Hydration',
    value: `${formatHydration(dailyWellness.hydrationMl, unitSystem)} logged`,
    detail: 'Use thirst, conditions, and your normal routine; avoid catch-up drinking.',
    priority: 28,
  })
  if (!dailyRecommendation && recovery.readinessAverage !== '—') signals.push({
    label: 'Recent pattern',
    value: recovery.readinessAverage,
    detail: 'Recent readiness average; complete today’s check-in for current guidance.',
    priority: 20,
  })
  if (!signals.length && dailyRecommendation) signals.push({ label: 'Current plan', value: dailyRecommendation.label ?? 'Check-in reviewed', detail: dailyRecommendation.summary, tone: dailyRecommendation.tone, priority: 10 })
  return signals.sort((first, second) => (second.priority ?? 0) - (first.priority ?? 0)).slice(0, 3)
}

function formatSignalLabel(value) { return String(value).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

function getTrendInterpretation(recovery, signals) {
  const valid = signals.filter((point) => Number.isFinite(point.readiness) && point.readiness > 0)
  if (valid.length < 4) return 'Add a few more check-ins before Athlete Reload interprets a trend.'
  const eventScores = valid.filter((point) => point.event).map((point) => point.readiness)
  const otherScores = valid.filter((point) => !point.event).map((point) => point.readiness)
  if (eventScores.length >= 2 && otherScores.length >= 2) {
    const eventAverage = Math.round(meanScore(eventScores))
    const otherAverage = Math.round(meanScore(otherScores))
    if (Math.abs(eventAverage - otherAverage) >= 6) return `Event-linked check-ins averaged ${eventAverage}, compared with ${otherAverage} on other recorded days. This is an association, not proof that events caused the difference.`
  }
  const recentChange = valid.at(-1).readiness - valid[0].readiness
  if (recentChange >= 6) return `Readiness rose ${Math.round(recentChange)} points across these records. Event markers show where competition or training occurred.`
  if (recentChange <= -6) return `Readiness fell ${Math.abs(Math.round(recentChange))} points across these records. Use sleep, fatigue, soreness, and event load to interpret why.`
  return `Readiness stayed within ${Math.round(Math.max(...valid.map((point) => point.readiness)) - Math.min(...valid.map((point) => point.readiness)))} points across these records; more event-linked check-ins will make the pattern stronger.`
}

function meanScore(values) { return values.reduce((sum, value) => sum + Number(value), 0) / Math.max(1, values.length) }

function getWeeklySignals(history, schedule) {
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
      event: schedule.find((event) => event.id === entry.eventId)?.title ?? schedule.find((event) => event.date === entry.date)?.title ?? '',
      fatigue: Number(entry.fatigue ?? 0) * 20,
      readiness: Number(entry.score ?? 0),
      sleep: Math.min(100, (Number(entry.sleep ?? 0) / 10) * 100),
      soreness: Number(entry.soreness ?? 0) * 20,
    }))
}

function PainIssuesCard({ issues, reportGroups, onSaveIssue, onShareIssue }) {
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
                    <option value="improving">Improving</option>
                    <option value="recurring">Recurring</option>
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
          <label>Functional limitation<textarea value={draft.functionalLimitation ?? ''} onChange={(event) => setDraft((current) => ({ ...current, functionalLimitation: event.target.value }))} placeholder="Example: changes running, jumping, lifting, or daily movement" /></label>
          <label>Activity relationship<textarea value={draft.activityRelationship ?? ''} onChange={(event) => setDraft((current) => ({ ...current, activityRelationship: event.target.value }))} placeholder="When it appears or which activity changes it" /></label>
          <label>Severity trend<select value={draft.severityTrend ?? 'unknown'} onChange={(event) => setDraft((current) => ({ ...current, severityTrend: event.target.value }))}><option value="unknown">Not enough information</option><option value="improving">Improving</option><option value="stable">Stable</option><option value="worsening">Worsening</option></select></label>
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

function _PainTimelineChart({ timeline }) {
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

function getTodayPlan(schedule, history, checkouts, dailyWellness, recoveryCompletions, now, unitSystem) {
  const todayIso = toIsoDate(now)
  const todayEvents = schedule
    .filter((event) => event.date === todayIso)
    .sort((first, second) => parseEventDateTime(first) - parseEventDateTime(second))
  const activeEvent = todayEvents.find((event) =>
    isEventActionable(event) && !checkouts.some((checkout) => checkout.eventId === event.id)
  )

  const eventMoments = todayEvents.map((event) => {
      if (isAllDayEvent(event)) return { ...event, action: null, status: `${isRestDayEvent(event) ? 'Planned rest' : 'Planned recovery'} · All day`, statusTone: 'complete' }
      const hasPre = history.some((entry) => entry.eventId === event.id)
      const hasPost = checkouts.some((checkout) => checkout.eventId === event.id)
      const eventStarted = hasEventStarted(event)
      const isActiveEvent = event.id === activeEvent?.id

      if (hasPost) return { ...event, action: null, kind: 'event complete', status: 'Checkout saved · recovery context updated', statusTone: 'complete' }
      if (isActiveEvent && eventStarted && hasPre) {
        return { ...event, action: 'post', kind: 'event checkout-due', status: 'Event started · checkout is due', statusTone: 'warning' }
      }
      if (hasPre || !isActiveEvent) return { ...event, action: null, kind: 'event', status: hasPre ? 'Check-in saved · event plan ready' : `${getEventDemandLabel(event)} planned`, statusTone: 'ready' }

      return { ...event, action: 'pre', kind: 'event checkin-due', status: 'Check-in open · personalize the event plan', statusTone: 'pending' }
    })

  const nutritionEntries = dailyWellness?.date === todayIso ? (dailyWellness.nutritionEntries ?? []) : []
  const fuelingMoments = nutritionEntries.length ? [{
    id: 'home-fueling',
    kind: 'fueling',
    sortValue: latestTimeValue(nutritionEntries.map((entry) => entry.loggedAt), 8 * 60),
    timeLabel: getLatestTimeLabel(nutritionEntries.map((entry) => entry.loggedAt), 'Today'),
    title: `${nutritionEntries.length} fueling item${nutritionEntries.length === 1 ? '' : 's'} logged`,
    status: summarizeLoggedMeals(nutritionEntries),
  }] : []
  const hydrationMoments = Number(dailyWellness?.hydrationMl) > 0 && dailyWellness?.date === todayIso ? [{
    id: 'home-hydration',
    kind: 'hydration',
    sortValue: 8 * 60 + 1,
    timeLabel: 'Today',
    title: `${formatHydration(dailyWellness.hydrationMl, unitSystem)} hydration logged`,
    status: 'Available to preparation and recovery guidance',
  }] : []
  const recoveryMoments = (recoveryCompletions ?? []).filter((entry) => String(entry.completedAt ?? '').slice(0, 10) === todayIso).slice(0, 1).map((entry) => ({
    id: `home-recovery-${entry.id}`,
    kind: 'recovery',
    sortValue: latestTimeValue([entry.completedAt], 22 * 60),
    timeLabel: getLatestTimeLabel([entry.completedAt], 'Today'),
    title: 'Recovery routine completed',
    status: `${entry.details?.plan?.routine?.title ?? 'Guided movement'} added to the living plan`,
  }))

  return [...fuelingMoments, ...hydrationMoments, ...eventMoments.map((event) => ({ ...event, sortValue: getEventMinute(event) })), ...recoveryMoments]
    .sort((first, second) => first.sortValue - second.sortValue)
}

function getRelevantCheckIn(history, event, now) {
  const todayIso = toIsoDate(now)
  if (event?.id) return history.filter((entry) => entry.checkInType !== 'post_event' && entry.eventId === event.id).sort((first, second) => String(second.createdAt ?? second.date).localeCompare(String(first.createdAt ?? first.date)))[0] ?? null
  return history.filter((entry) => entry.date === todayIso && entry.checkInType !== 'post_event').sort((first, second) => String(second.createdAt ?? '').localeCompare(String(first.createdAt ?? '')))[0] ?? null
}

function getPrimaryHomeAction({ dailyRecommendation, dueCheckout, checkInReminder, latestRecoveryPlan, nextEvent, onGoCheckIn, onOpenCheckout, onViewRecovery, recoveryPriorities, todayCheckIn }) {
  if (dueCheckout) return { label: 'Complete checkout', detail: `Capture how ${getEventName(dueCheckout)} actually felt so Recovery can respond to the session—not the schedule.`, onClick: () => onOpenCheckout(dueCheckout) }
  if (checkInReminder) return { label: 'Complete check-in', detail: `Build a current plan for ${getEventName(checkInReminder)} from sleep, fatigue, soreness, stress, illness, and pain.`, onClick: () => onGoCheckIn(checkInReminder) }
  if (todayCheckIn && dailyRecommendation) {
    const action = dailyRecommendation.primaryAction
    return {
      label: action?.label ?? dailyRecommendation.label ?? 'Follow your event plan',
      detail: action?.instruction ?? action?.detail ?? dailyRecommendation.action ?? dailyRecommendation.summary,
      onClick: undefined,
    }
  }
  if (latestRecoveryPlan) return { label: latestRecoveryPlan.label ?? 'Continue recovery plan', detail: normalizeRecommendationItem(recoveryPriorities[0]) ?? latestRecoveryPlan.action ?? latestRecoveryPlan.summary, onClick: onViewRecovery }
  if (nextEvent) return { label: `Prepare for ${getEventName(nextEvent)}`, detail: `${getEventCountdown(nextEvent, new Date())} remain. Check-in opens closer to the event so guidance reflects your current state.`, onClick: undefined }
  return { label: 'Plan what comes next', detail: 'Add the next event to connect preparation, checkout, recovery, nutrition, and trends.', onClick: undefined }
}

function getRecommendationNextMoves(recommendation, primaryDetail) {
  if (!recommendation) return []
  const preferredSections = ['pre-event-timeline', 'warm-up-focus', 'fueling-target', 'hydration-target', 'performance-focus', 'event-preparation']
  const sections = Object.fromEntries((recommendation.reportSections ?? []).map((section) => [section.id, section]))
  const structured = preferredSections.flatMap((id) => sections[id] ? [...(sections[id].items ?? []), sections[id].summary] : [])
  const legacy = [...(recommendation.preparation ?? []), ...(recommendation.focus ?? [])]
  const primaryKey = normalizeComparableText(primaryDetail)
  return [...structured, ...legacy].map(normalizeRecommendationItem).filter(Boolean).filter((item, index, items) => {
    const key = normalizeComparableText(item)
    return key !== primaryKey && items.findIndex((candidate) => normalizeComparableText(candidate) === key) === index
  }).slice(0, 2)
}

function getHomeModeLabel({ dueCheckout, checkInReminder, todayCheckIn, latestRecoveryPlan }) {
  if (dueCheckout) return 'After the event'
  if (checkInReminder) return 'Before the event'
  if (todayCheckIn) return 'Event plan active'
  if (latestRecoveryPlan) return 'Recovery in progress'
  return 'Next event'
}

function getEventDemandLabel(event) {
  const minutes = Number(event?.plannedMinutes ?? event?.expectedDuration ?? 0)
  const load = String(event?.load ?? event?.intensity ?? '').trim()
  return [minutes ? `${minutes} min` : '', load ? `${load.toLowerCase()} demand` : ''].filter(Boolean).join(' · ') || 'Event details'
}

function normalizeRecommendationItem(item) {
  return typeof item === 'string' ? item.trim() : String(item?.instruction ?? item?.title ?? item?.label ?? '').trim()
}

function normalizeComparableText(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function getEventMinute(event) { const [hours = 23, minutes = 59] = String(event?.time ?? '23:59').split(':').map(Number); return hours * 60 + minutes }
function latestTimeValue(values, fallback) { const dates = values.map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime())); return dates.length ? Math.max(...dates.map((value) => value.getHours() * 60 + value.getMinutes())) : fallback }
function getLatestTimeLabel(values, fallback) { const dates = values.map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime())); return dates.length ? format(new Date(Math.max(...dates.map(Number))), 'h:mm a') : fallback }
function summarizeLoggedMeals(entries) { const meals = [...new Set(entries.map((entry) => entry.meal).filter(Boolean))]; return meals.length ? `${meals.join(', ')} available to today’s context` : 'Food log available to today’s context' }

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

function _getPainWatchlist(history, painReports) {
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

function _getPainTimelines(history, painReports) {
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

function _getPatterns(history, checkouts, painWatchlist) {
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

  const totalSeconds = Math.max(0, Math.floor((eventDate.getTime() - now.getTime()) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function _getSportInsight(profile, nextEvent, checkouts, painWatchlist) {
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
