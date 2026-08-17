import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, startOfYear } from 'date-fns'
import { calendarWeekStart, localDateKey, parseLocalCalendarDate } from '../utils/calendarDate'
import { createRecoveryHistoryRecords } from '../domain/recovery/historyRecords'
import { RecoveryPlanCard } from './RecommendationCard'
import { AiDecisionReport, DecisionHeader } from './AiDecisionModal'
import '../styles/history-rework.css'
import { SectionHeading } from './SectionHeading'
import { bodyPainAreas } from '../data/bodyPainMap'
import { AppIcon } from './AppIcon'
import { DialogShell } from './DialogShell'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const clearOptions = [
  { label: 'Today', days: 0 },
  { label: '3 days', days: 2 },
  { label: '5 days', days: 4 },
  { label: '1 week', days: 6 },
  { label: '3 weeks', days: 20 },
  { label: '1 month', days: 30 },
  { label: '6 months', days: 182 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
  { label: 'All time', days: null },
]

export function HistoryView({ checkouts = [], history, insights, onClear, onDeleteEntry, recoveryCompletions = [], recoveryPlans = [], savedRoutines = [], schedule = [], weekStartsOn = 1 }) {
  const hasSavedHistory = history.length > 0 || checkouts.length > 0 || recoveryCompletions.length > 0 || recoveryPlans.length > 0
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set([getCurrentWeekKey(weekStartsOn)]))
  const [expandedYears, setExpandedYears] = useState(() => new Set([getCurrentYearKey()]))
  const [timeWindow, setTimeWindow] = useState('28')
  const [recordFilter, setRecordFilter] = useState('all')
  const [historySection, setHistorySection] = useState('overview')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const isModalOpen = Boolean(selectedEntry || isClearModalOpen || selectedWeek)
  const filteredHistory = filterByWindow(history, timeWindow, customRange)
  const filteredCheckouts = filterByWindow(checkouts, timeWindow, customRange)
  const filteredRecovery = filterByWindow(recoveryCompletions, timeWindow, customRange)
  const filteredPlans = filterByWindow(recoveryPlans, timeWindow, customRange)
  const includeCheckIns = ['all', 'events', 'check-in'].includes(recordFilter)
  const includeCheckouts = ['all', 'events', 'checkout'].includes(recordFilter)
  const includePlans = ['all', 'recovery-plan'].includes(recordFilter)
  const includeRoutines = ['all', 'mobility-routine'].includes(recordFilter)
  const archive = getHistoryArchive(includeCheckIns ? filteredHistory : [], includeCheckouts ? filteredCheckouts : [], includeRoutines ? filteredRecovery : [], includePlans ? filteredPlans : [], weekStartsOn)
  const summary = getWindowSummary(filteredHistory, filteredCheckouts)
  const analytics = getHistoryAnalytics(filteredHistory, filteredCheckouts, filteredRecovery)
  const chartData = getQuestionChartData(filteredHistory, filteredCheckouts, filteredRecovery, schedule)

  useEffect(() => {
    if (!isModalOpen) return undefined

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction

    document.body.classList.add('modal-open')
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
    }
  }, [isModalOpen])

  async function clearRange(option) {
    await onClear(getCutoffDate(option.days))
    setIsClearModalOpen(false)
  }

  function toggleWeek(weekKey) {
    setExpandedWeeks((current) => {
      const next = new Set(current)

      if (next.has(weekKey)) {
        next.delete(weekKey)
      } else {
        next.add(weekKey)
      }

      return next
    })
  }

  function toggleYear(yearKey) {
    setExpandedYears((current) => {
      const next = new Set(current)

      if (next.has(yearKey)) {
        next.delete(yearKey)
      } else {
        next.add(yearKey)
      }

      return next
    })
  }

  return (
    <div className={`history-view history-section-${historySection}`} data-tour="history-page">
      <div className="schedule-header history-page-header">
        <div className="page-header-copy"><SectionHeading eyebrow="History & insights" title="Learn what changes your day." /><p className="page-header-description">Patterns first. Every original record remains available below.</p></div>
        <div className="history-actions">
          <button
            className="remove-button compact-action"
            disabled={!hasSavedHistory}
            onClick={() => setIsClearModalOpen(true)}
            type="button"
          >
            Clear saved history
          </button>
        </div>
      </div>

      <section className="history-window-controls" aria-label="History time window">
        <div role="group" aria-label="Preset time windows">
          {[['7', '7 days'], ['28', '28 days'], ['84', '12 weeks'], ['all', 'All time'], ['custom', 'Custom']].map(([value, label]) => <button aria-pressed={timeWindow === value} className={timeWindow === value ? 'active' : ''} key={value} onClick={() => setTimeWindow(value)} type="button">{label}</button>)}
        </div>
        {timeWindow === 'custom' && <div className="history-custom-range"><label>From<input type="date" value={customRange.start} onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))} /></label><label>To<input type="date" value={customRange.end} onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))} /></label></div>}
      </section>

      <nav className="history-content-tabs" role="tablist" aria-label="History sections">
        <button aria-selected={historySection === 'overview'} className={historySection === 'overview' ? 'active' : ''} onClick={() => setHistorySection('overview')} role="tab" type="button"><AppIcon name="readiness" size={18} /><span><strong>Overview</strong><small>{summary.checkInCount + summary.checkoutCount} contributing records</small></span></button>
        <button aria-selected={historySection === 'trends'} className={historySection === 'trends' ? 'active' : ''} onClick={() => setHistorySection('trends')} role="tab" type="button"><AppIcon name="trend" size={18} /><span><strong>Trends</strong><small>{insights.length} pattern{insights.length === 1 ? '' : 's'} available</small></span></button>
        <button aria-selected={historySection === 'records'} className={historySection === 'records' ? 'active' : ''} onClick={() => setHistorySection('records')} role="tab" type="button"><AppIcon name="report" size={18} /><span><strong>Records</strong><small>Browse the archive</small></span></button>
      </nav>

      <section className="history-overview" aria-label="Athlete analytics">
        <div className="history-overview-lead"><span>Current window</span><strong>{summary.readiness == null ? 'Building your baseline' : summary.readiness >= 80 ? 'Responding near your normal' : summary.readiness >= 65 ? 'More recovery demand than usual' : 'A demanding stretch'}</strong><p>{summary.checkInCount} check-ins and {summary.checkoutCount} completed sessions contribute to this view.</p></div>
        <HistoryMetric label="Readiness" value={summary.readiness == null ? '—' : summary.readiness} unit={summary.readiness == null ? '' : '/100'} detail={analytics.readinessDetail} />
        <HistoryMetric label="Weekly load" value={analytics.weeklyLoad} unit="units" detail={`${analytics.sessionMinutes} min completed`} />
        <HistoryMetric label="Recovery" value={analytics.recoveryRate == null ? '—' : `${analytics.recoveryRate}%`} detail={`${filteredRecovery.length} routines recorded`} />
      </section>

      <div className="history-analytics-grid">
        <AnalyticsPanel title="Performance" eyebrow="How sessions felt" rows={[['Performance vs normal', analytics.performance], ['Average session RPE', analytics.averageRpe], ['High-intensity sessions', analytics.highIntensity]]} />
        <AnalyticsPanel title="Recovery" eyebrow="How your body responded" rows={[['Average sleep', analytics.sleep], ['Average fatigue', analytics.fatigue], ['Average soreness', analytics.soreness]]} />
        <AnalyticsPanel title="Load" eyebrow="What you have done" rows={[['Completed minutes', analytics.sessionMinutes], ['Session-RPE load', summary.load], ['Completed sessions', summary.checkoutCount]]} />
        <AnalyticsPanel title="Pain & availability" eyebrow="What affected movement" rows={[['Check-ins with pain', analytics.painReports], ['Recurring areas', analytics.painAreas], ['Current direction', analytics.painDirection]]} />
      </div>

      <section className="history-question-charts" aria-label="History trend charts">
        <HistoryQuestionChart data={chartData.readiness} question="How has my readiness changed?" empty="Save at least three check-ins to see a readiness trend.">
          <LineChart data={chartData.readiness}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis domain={[0, 100]} /><Tooltip /><Legend /><Line dataKey="readiness" name="Readiness" stroke="#57d7a0" strokeWidth={3} /><Line connectNulls={false} dataKey="importantEvent" name="Important event" stroke="transparent" dot={{ fill: '#ffb454', r: 5 }} /></LineChart>
        </HistoryQuestionChart>
        <HistoryQuestionChart data={chartData.load} question="How hard has training felt recently?" empty="Complete at least three checkouts to see session load.">
          <BarChart data={chartData.load}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Bar dataKey="sessionLoad" name="Session-RPE load" fill="#7f8cff" radius={[5, 5, 0, 0]} /></BarChart>
        </HistoryQuestionChart>
        <HistoryQuestionChart data={chartData.recovery} question="Is pain changing—and am I completing recovery?" empty="Three pain or recovery records are needed before this comparison appears.">
          <LineChart data={chartData.recovery}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis domain={[0, 100]} /><Tooltip /><Legend /><Line connectNulls dataKey="pain" name="Pain severity ×10" stroke="#ff7f72" strokeWidth={2} /><Line connectNulls dataKey="completion" name="Routine completion %" stroke="#5bc0ff" strokeWidth={2} /></LineChart>
        </HistoryQuestionChart>
      </section>

      <section className="history-insights-section"><div className="history-section-heading"><div><span>Insights</span><h2>Patterns worth watching</h2></div><p>Associations only—not proof that one factor caused another.</p></div><div className="trend-grid">
        {insights.map((insight) => (
          <article className="insight-card" key={insight.id ?? insight}>
            {typeof insight === 'string' ? insight : <><strong>{insight.title}</strong><p>{insight.summary}</p><small>{insight.window} · {insight.sampleSize} records · {Math.round(insight.confidence * 100)}% confidence</small></>}
          </article>
        ))}
        {insights.length === 0 && <article className="insight-card muted"><strong>No reliable pattern yet</strong><p>Insights appear only when enough comparable records support something worth watching.</p></article>}
      </div></section>

      <section className="history-records-section"><div className="history-section-heading records-heading"><div><span>Records</span><h2>Your Athlete Reload archive</h2></div><div className="record-filters" role="group" aria-label="Record type">{[['all','All'],['events','Events'],['check-in','Check-Ins'],['checkout','Checkouts'],['recovery-plan','Recovery Plans'],['mobility-routine','Mobility Routines']].map(([value,label]) => <button aria-pressed={recordFilter === value} key={value} onClick={() => setRecordFilter(value)} type="button">{label}</button>)}</div></div>
      <div className="history-list">
        {archive.length === 0 ? (
          <article className="history-row empty-history">
            <p>No saved check-ins yet.</p>
          </article>
        ) : (
          archive.map((year) => (
            <section className="history-archive-group" key={year.key}>
              <button className="history-archive-toggle" onClick={() => toggleYear(year.key)} type="button">
                <span>{expandedYears.has(year.key) ? 'Hide' : 'Show'}</span>
                <strong>{year.label}</strong>
                <em>{year.itemCount} item{year.itemCount === 1 ? '' : 's'}</em>
              </button>

              {expandedYears.has(year.key) && (
                <div className="history-archive-content">
                  {year.weeks.map((week) => (
                    <section className="history-week" key={week.key}>
                      <div className="history-week-header">
                        <button className="history-week-toggle" onClick={() => toggleWeek(week.key)} type="button">
                          <span>{expandedWeeks.has(week.key) ? 'Hide' : 'Show'}</span>
                          <strong>Week of {week.label}</strong>
                          <em>{week.items.length} item{week.items.length === 1 ? '' : 's'}</em>
                        </button>
                        <button className="secondary-button compact-action" onClick={() => setSelectedWeek(week)} type="button">
                          Weekly report
                        </button>
                      </div>

                      {expandedWeeks.has(week.key) && (
                        <div className="history-week-items">
                          <HistoryGroup
                            checkouts={week.items.filter((item) => item.kind === 'checkout')}
                            checkIns={week.items.filter((item) => item.kind === 'check-in')}
                            recoveryCompletions={week.items.filter((item) => item.kind === 'recovery-completion')}
                            recoveryPlans={week.items.filter((item) => item.kind === 'recovery-plan')}
                            onDeleteEntry={onDeleteEntry}
                            onSelectEntry={setSelectedEntry}
                          />
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
      </section>

      {selectedEntry && createPortal(
        <HistoryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          savedRoutines={savedRoutines}
        />,
        document.body,
      )}

      {isClearModalOpen && createPortal(
        <ClearHistoryModal
          onClear={clearRange}
          onClose={() => setIsClearModalOpen(false)}
        />,
        document.body,
      )}

      {selectedWeek && (
        <WeeklyReportModal
          week={selectedWeek}
          onClose={() => setSelectedWeek(null)}
        />
      )}
    </div>
  )
}

function HistoryQuestionChart({ children, data, empty, question }) {
  return <details className="history-question-chart"><summary><span><small>Trend question</small><strong>{question}</strong></span><AppIcon name="chevron" size={19} /></summary><div className="history-question-chart-body">{data.length < 3 ? <p className="history-chart-empty">{empty}</p> : <div aria-label={question} className="history-chart-canvas" role="img"><ResponsiveContainer height="100%" width="100%">{children}</ResponsiveContainer></div>}</div></details>
}

function getQuestionChartData(history, checkouts, recovery, schedule) {
  const importantDates = new Set(schedule.filter((event) => ['important', 'priority'].includes(event.importance)).map((event) => event.date))
  const readiness = history.slice().sort(byDate).map((entry) => ({
    label: shortDate(entry.date),
    readiness: finiteOrNull(entry.score),
    importantEvent: importantDates.has(entry.date) ? 100 : null,
  })).filter((entry) => entry.readiness != null)
  const load = checkouts.slice().sort(byDate).map((entry) => ({
    label: shortDate(entry.sessionDate ?? entry.date),
    sessionLoad: Number(entry.sessionLoad) || Number(entry.actualMinutes ?? 0) * Number(entry.difficulty ?? 0),
  }))
  const recoveryByDate = new Map()
  for (const entry of history) {
    const pain = Math.max(Number(entry.pain) || 0, ...Object.values(entry.painMap ?? {}).map(Number))
    if (pain > 0) recoveryByDate.set(entry.date, { ...(recoveryByDate.get(entry.date) ?? {}), pain: pain * 10 })
  }
  for (const entry of recovery) {
    const date = String(entry.finishedAt ?? entry.completedAt ?? '').slice(0, 10)
    if (date) recoveryByDate.set(date, { ...(recoveryByDate.get(date) ?? {}), completion: finiteOrNull(entry.completionPercentage) })
  }
  const recoveryData = [...recoveryByDate.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([date, values]) => ({ label: shortDate(date), ...values }))
  return { readiness, load, recovery: recoveryData }
}

function finiteOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function byDate(first, second) {
  return String(first.date ?? first.sessionDate ?? first.completedAt ?? '').localeCompare(String(second.date ?? second.sessionDate ?? second.completedAt ?? ''))
}

function shortDate(value) {
  if (!value) return ''
  try { return format(parseISO(String(value).slice(0, 10)), 'MMM d') } catch { return String(value) }
}

function filterByWindow(entries, windowValue, customRange) {
  if (windowValue === 'all') return entries
  const today = new Date()
  const cutoff = windowValue === 'custom'
    ? (customRange.start ? new Date(`${customRange.start}T00:00:00`) : null)
    : startOfLocalDayOffset(today, -(Number(windowValue) - 1))
  const end = windowValue === 'custom' && customRange.end
    ? new Date(`${customRange.end}T23:59:59.999`)
    : endOfLocalDay(today)
  return entries.filter((entry) => {
    const value = entry.date ?? entry.sessionDate ?? entry.completedAt ?? entry.generatedAt ?? entry.refreshedAt ?? entry.createdAt
    if (!value) return false
    const parsed = new Date(String(value).includes('T') ? value : `${value}T12:00:00`)
    return !Number.isNaN(parsed.getTime()) && (!cutoff || parsed >= cutoff) && parsed <= end
  })
}

function startOfLocalDayOffset(date, dayOffset) {
  const value = new Date(date)
  value.setDate(value.getDate() + dayOffset)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfLocalDay(date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function HistoryMetric({ detail, label, unit = '', value }) {
  return <div className="history-overview-metric"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{detail}</p></div>
}

function AnalyticsPanel({ eyebrow, rows, title }) {
  return <details className="history-analytics-panel"><summary><header><span>{eyebrow}</span><h3>{title}</h3></header><AppIcon name="chevron" size={18} /></summary><div>{rows.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value ?? 'Not enough data'}</strong></p>)}</div></details>
}

function getHistoryAnalytics(history, checkouts, recovery) {
  const finite = (items) => items.map(Number).filter(Number.isFinite)
  const averageDisplay = (items, suffix = '') => items.length ? `${average(items)}${suffix}` : 'Not enough data'
  const performanceValues = checkouts.map((entry) => entry.performanceRating).filter(Boolean)
  const favorable = performanceValues.filter((value) => ['Better', 'Much better', 'Normal', 'A little better'].includes(value)).length
  const painEntries = history.filter((entry) => Number(entry.pain) > 0 || Object.values(entry.painMap ?? {}).some((value) => Number(value) > 0))
  const painAreas = new Set(painEntries.flatMap((entry) => Object.entries(entry.painMap ?? {}).filter(([, value]) => Number(value) > 0).map(([key]) => key)))
  const sessionMinutes = checkouts.reduce((sum, entry) => sum + Number(entry.actualMinutes ?? 0), 0)
  const completedRecovery = recovery.filter((entry) => entry.entry?.completedAt || entry.completedAt)
  const firstHalfPain = painEntries.slice(Math.floor(painEntries.length / 2)).length
  const recentPain = painEntries.slice(0, Math.max(1, Math.floor(painEntries.length / 2))).length
  return {
    averageRpe: averageDisplay(finite(checkouts.map((entry) => entry.difficulty)), '/10'),
    fatigue: averageDisplay(finite(history.map((entry) => entry.fatigue)), '/5'),
    highIntensity: checkouts.filter((entry) => Number(entry.difficulty) >= 8).length,
    painAreas: painAreas.size || 'None recorded',
    painDirection: painEntries.length < 2 ? 'Not enough data' : recentPain < firstHalfPain ? 'Less frequent' : recentPain > firstHalfPain ? 'More frequent' : 'Stable',
    painReports: painEntries.length,
    performance: performanceValues.length ? `${favorable} of ${performanceValues.length} normal or better` : 'Not enough data',
    readinessDetail: history.length >= 4 ? 'Compared across saved check-ins' : 'More check-ins needed for a stable baseline',
    recoveryRate: recovery.length ? Math.round((completedRecovery.length / recovery.length) * 100) : null,
    sessionMinutes,
    sleep: averageDisplay(finite(history.map((entry) => entry.sleep)), 'h'),
    soreness: averageDisplay(finite(history.map((entry) => entry.soreness)), '/5'),
    weeklyLoad: Math.round(checkouts.reduce((sum, entry) => sum + (Number(entry.sessionLoad) || Number(entry.actualMinutes ?? 0) * Number(entry.difficulty ?? 0)), 0) / Math.max(1, Math.ceil(28 / 7))),
  }
}

function getWindowSummary(history, checkouts) {
  const readiness = average(history.map((entry) => Number(entry.score)))
  const load = Math.round(checkouts.reduce((sum, entry) => sum + (Number(entry.sessionLoad) || (Number(entry.actualMinutes) || 0) * (Number(entry.difficulty) || 0)), 0))
  const soreness = history.map((entry) => Number(entry.soreness)).filter(Number.isFinite)
  const midpoint = Math.floor(soreness.length / 2)
  const recent = midpoint ? average(soreness.slice(0, midpoint)) : null
  const earlier = midpoint ? average(soreness.slice(midpoint)) : null
  return {
    checkInCount: history.length,
    checkoutCount: checkouts.length,
    load,
    readiness,
    sorenessChange: recent == null || earlier == null ? null : Math.round((recent - earlier) * 10) / 10,
  }
}

function HistoryGroup({ checkouts, checkIns, onDeleteEntry, onSelectEntry, recoveryCompletions, recoveryPlans }) {
  const recoveryRecords = recoveryCompletions.map((item) => ({ ...item, historyKind: 'mobility-routine' }))
  return (
    <>
      <div className="history-subsection">
        <p className="eyebrow">Check-ins</p>
        {checkIns.length === 0 ? (
          <p>No check-ins this week.</p>
        ) : (
          checkIns.map((item) => (
            <HistoryRow
              className="history-row"
              entry={item.entry}
              key={`check-${item.entry.id ?? item.entry.date}-${item.entry.createdAt ?? item.entry.note}`}
              kind="check-in"
              onDeleteEntry={onDeleteEntry}
              onSelectEntry={onSelectEntry}
            >
              <div
                className={`score-ring history-score-ring ${getReadinessBand(item.entry.score)}`}
                style={{ '--score': `${item.entry.score}%` }}
              >
                <span>{item.entry.score}</span>
              </div>
              <div>
                <p className="eyebrow">{formatHistoryDate(item.entry)}</p>
                <strong>{item.entry.eventTitle ?? item.entry.session}</strong>
              </div>
            </HistoryRow>
          ))
        )}
      </div>

      <div className="history-subsection">
        <p className="eyebrow">Checkouts</p>
        {checkouts.length === 0 ? (
          <p>No checkouts this week.</p>
        ) : (
          checkouts.map((item) => (
            <HistoryRow
              className="history-row checkout-history-row"
              entry={item.entry}
              key={`checkout-${item.entry.id}`}
              kind="checkout"
              onDeleteEntry={onDeleteEntry}
              onSelectEntry={onSelectEntry}
            >
              <span className="history-record-kind">Checkout</span>
              <div>
                <p className="eyebrow">{formatCheckoutDate(item.entry)}</p>
                <strong>{item.entry.title}</strong>
                <small>{item.entry.actualMinutes} min · {item.entry.participation ?? item.entry.completionLevel}</small>
              </div>
            </HistoryRow>
          ))
        )}
      </div>

      <div className="history-subsection">
        <p className="eyebrow">Recovery Plans</p>
        {recoveryPlans.length === 0 ? <p>No Recovery Plans this week.</p> : recoveryPlans.map((item) => {
          const plan = item.entry.plan ?? {}
          const priorities = plan.reportSections?.find((section) => section.id === 'recovery-priorities')?.items ?? plan.priorities ?? []
          const eventTitle = item.entry.contextSnapshot?.event?.title ?? item.entry.contextSnapshot?.checkout?.title ?? 'Post-event recovery'
          return <HistoryRow className="history-row recovery-plan-history-row" entry={item.entry} key={`recovery-plan-${item.entry.id}`} kind="recovery-plan" onDeleteEntry={onDeleteEntry} onSelectEntry={onSelectEntry}><span className="history-record-kind recovery-plan-record-kind">Recovery Plan</span><div><p className="eyebrow">{format(parseISO(item.entry.generatedAt ?? item.entry.refreshedAt), 'MMM d, yyyy · h:mm a')}</p><strong>{eventTitle}</strong><small>{priorities.length} priorit{priorities.length === 1 ? 'y' : 'ies'}{priorities[0] ? ` · ${priorities[0]}` : ''}</small></div></HistoryRow>
        })}
      </div>

      <div className="history-subsection">
        <p className="eyebrow">Mobility Routines</p>
        {recoveryRecords.length === 0 ? (
          <p>No Mobility Routines this week.</p>
        ) : (
          recoveryRecords.map((item) => {
            const isCompletion = true
            const plan = { routine: item.entry.details?.routineSnapshot ?? item.entry.details?.plan?.routine ?? {} }
            const exerciseCount = plan?.routine?.exercises?.length ?? item.entry.details?.exerciseCount ?? 0
            const savedAt = isCompletion ? item.entry.completedAt : item.entry.createdAt

            return <HistoryRow className="history-row mobility-history-row" entry={item.entry} key={`${item.historyKind}-${item.entry.id}`} kind="mobility-routine" onDeleteEntry={onDeleteEntry} onSelectEntry={onSelectEntry}>
              <span className="history-record-kind mobility-record-kind">Mobility Routine</span>
              <div>
                <p className="eyebrow">{savedAt ? format(parseISO(savedAt), 'MMM d, yyyy · h:mm a') : formatCheckoutDate(item.entry)}</p>
                <strong>{plan?.routine?.routineName ?? plan?.routine?.title ?? 'Mobility routine'}</strong>
                <small>{Math.max(1, Math.round(Number(item.entry.plannedDurationSeconds ?? plan?.routine?.estimatedDurationSeconds ?? 0) / 60))} min · {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'} · {Math.round(item.entry.completionPercentage ?? 0)}% completed</small>
              </div>
            </HistoryRow>
          })
        )}
      </div>
    </>
  )
}

function HistoryRow({ children, className, entry, kind, onDeleteEntry, onSelectEntry }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const detailEntry = kind === 'check-in' ? entry : { ...entry, historyKind: kind }

  function openDetails() {
    setIsMenuOpen(false)
    onSelectEntry(detailEntry)
  }

  async function deleteEntry() {
    if (!onDeleteEntry || isDeleting) return
    setIsDeleting(true)
    try {
      await onDeleteEntry(entry, kind)
      setIsMenuOpen(false)
    } catch {
      setIsDeleting(false)
    }
  }

  return (
    <article className={`${className} history-row-with-menu${isMenuOpen ? ' history-row-menu-open' : ''}`}>
      <button className="history-row-main" onClick={openDetails} type="button">
        {children}
      </button>
      <div className="history-quick-actions">
        <button
          aria-expanded={isMenuOpen}
          aria-label="History item actions"
          className="history-more-button app-icon-button"
          onClick={() => setIsMenuOpen((current) => !current)}
          type="button"
        >
          <AppIcon name="more" size={20} />
        </button>
        {isMenuOpen && (
          <div className="history-quick-menu">
            <button onClick={openDetails} type="button">View details</button>
            {onDeleteEntry && <button className="history-delete-action" disabled={isDeleting} onClick={deleteEntry} type="button">{isDeleting ? 'Deleting…' : 'Delete'}</button>}
          </div>
        )}
      </div>
    </article>
  )
}

function WeeklyReportModal({ week, onClose }) {
  const checkIns = week.items.filter((item) => item.kind === 'check-in').map((item) => item.entry)
  const checkouts = week.items.filter((item) => item.kind === 'checkout').map((item) => item.entry)
  const readinessValues = checkIns.filter((entry) => entry.score != null).map((entry) => Number(entry.score)).filter(Number.isFinite)
  const sleepValues = checkIns.map((entry) => Number(entry.sleep)).filter((value) => Number.isFinite(value) && value > 0)
  const fatigueValues = checkIns.filter((entry) => entry.fatigue != null).map((entry) => Number(entry.fatigue)).filter(Number.isFinite)
  const workloadValues = checkouts.filter((checkout) => checkout.actualMinutes != null && checkout.difficulty != null).map((checkout) => Number(checkout.actualMinutes) * Number(checkout.difficulty)).filter(Number.isFinite)
  const averageReadiness = readinessValues.length ? average(readinessValues) : null
  const averageSleep = sleepValues.length ? average(sleepValues, 1) : null
  const averageFatigue = fatigueValues.length ? average(fatigueValues, 1) : null
  const workload = workloadValues.length ? Math.round(workloadValues.reduce((total, value) => total + value, 0)) : null
  const painAreas = summarizePainAreas(checkIns)
  const availability = averageReadiness == null ? 'No readiness data' : averageReadiness >= 80 ? 'Mostly available' : averageReadiness >= 60 ? 'Modified training likely' : 'Recovery focus'
  const tone = averageReadiness == null ? 'neutral' : averageReadiness >= 80 ? 'positive' : averageReadiness >= 60 ? 'caution' : 'attention'

  return (
    <DialogShell className="weekly-report-dialog" description="A focused view of readiness, workload, and recovery signals from this week." eyebrow={`Week of ${week.label}`} onClose={onClose} title="Weekly athlete report.">
      <section className={`weekly-report-hero tone-${tone}`}>
        <span className="weekly-report-hero__icon"><AppIcon name="readiness" size={30} /></span>
        <div>
          <small>Average readiness</small>
          <strong>{averageReadiness == null ? 'No data' : `${averageReadiness}/100`}</strong>
          <p>{availability}</p>
        </div>
        <span className="weekly-report-hero__status">{tone === 'positive' ? 'Ready' : tone === 'caution' ? 'Monitor' : tone === 'attention' ? 'Recover' : 'Awaiting data'}</span>
      </section>
      <div className="weekly-report-grid">
        <WeeklyMetric icon="sessions" label="Check-ins" value={checkIns.length || 'No data'} />
        <WeeklyMetric icon="status" label="Checkouts" value={checkouts.length || 'No data'} />
        <WeeklyMetric icon="sleep" label="Average sleep" value={averageSleep == null ? 'No data' : `${averageSleep} hours`} />
        <WeeklyMetric icon="fatigue" label="Average fatigue" tone={averageFatigue >= 4 ? 'attention' : averageFatigue >= 3 ? 'caution' : averageFatigue == null ? 'neutral' : 'positive'} value={averageFatigue == null ? 'No data' : `${averageFatigue}/5`} />
        <WeeklyMetric icon="workload" label="Session workload" value={workload == null ? 'No data' : workload} />
        <WeeklyMetric icon="performance" label="Availability" tone={tone} value={availability} />
        <WeeklyMetric className="weekly-report-metric-wide" icon="pain" label="Pain pattern" tone={painAreas ? 'attention' : 'positive'} value={painAreas || 'No recurring pain areas'} />
      </div>
    </DialogShell>
  )
}

function WeeklyMetric({ className = '', icon, label, tone = 'neutral', value }) {
  return (
    <article className={`weekly-report-metric tone-${tone} ${className}`.trim()}>
      <span className="weekly-report-metric__icon"><AppIcon name={icon} size={22} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function ClearHistoryModal({ onClear, onClose }) {
  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow="Clear history"
            title="Choose a time range."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="clear-range-grid">
          {clearOptions.map((option) => (
            <button
              className="remove-button compact-action"
              key={option.label}
              onClick={() => onClear(option)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function HistoryModal({ entry, onClose, savedRoutines }) {
  if (entry.historyKind === 'checkout') {
    return <CheckoutHistoryModal entry={entry} onClose={onClose} />
  }

  if (entry.historyKind === 'recovery-completion') {
    return <RecoveryCompletionHistoryModal entry={entry} onClose={onClose} savedRoutines={savedRoutines} />
  }

  if (entry.historyKind === 'mobility-routine') {
    return <RecoveryCompletionHistoryModal entry={entry} onClose={onClose} savedRoutines={savedRoutines} />
  }

  if (entry.historyKind === 'recovery-plan') {
    return <RecoveryPlanRecordModal entry={entry} onClose={onClose} />
  }

  return (
    <div className="modal-backdrop ai-decision-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal ai-decision-modal history-checkin-decision-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <DecisionHeader context={{ session: `${entry.eventTitle ?? entry.session} · ${formatHistoryDate(entry)}` }} onClose={onClose} />

        {entry.recommendation ? (
          <AiDecisionReport
            checkIn={entry}
            recommendation={entry.recommendation}
          />
        ) : (
          <div className="history-readiness-summary">
            <div
              className={`score-ring ${getReadinessBand(entry.score)}`}
              style={{ '--score': `${entry.score}%` }}
            >
              <span>{entry.score}</span>
            </div>
            <div>
              <strong>{entry.eventTitle ?? entry.session}</strong>
              <p>Saved check-in.</p>
            </div>
          </div>
        )}

        {entry.note && (
          <div className="history-note ai-decision-history-note">
            <strong>Notes</strong>
            <p>{entry.note}</p>
          </div>
        )}
        <footer className="ai-decision-footer"><button className="primary-button" onClick={onClose} type="button">Close</button></footer>
      </section>
    </div>
  )
}

function CheckoutHistoryModal({ entry, onClose }) {
  const detailSections = getCheckoutDetailSections(entry)
  const painSections = getPainDetailSections(entry)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow={formatCheckoutDate(entry)}
            title="Checkout details."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {entry.recommendation && (
          <RecoveryPlanCard
            recommendation={entry.recommendation}
            recommendationStatus="ai"
            session={entry.title}
          />
        )}

        <div className="history-detail-sections">
          {detailSections.map((section) => (
            <section className="history-detail-section" key={section.title}>
              <h3>{section.title}</h3>
              <div className="history-detail-grid">
                {section.items.map(([label, value]) => (
                  <span key={label}>
                    <strong>{label}</strong>
                    {value}
                  </span>
                ))}
              </div>
            </section>
          ))}

          {painSections.length > 0 && (
            <section className="history-detail-section">
              <h3>Post-event pain map</h3>
              <div className="history-pain-stack">
                {painSections.map((section) => (
                  <article className="history-pain-card" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="history-detail-grid">
                      {section.items.map(([label, value]) => (
                        <span key={label}>
                          <strong>{label}</strong>
                          {value}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}

function getReadinessBand(score) {
  if (Number(score) >= 75) return 'readiness-green'
  if (Number(score) >= 50) return 'readiness-yellow'
  return 'readiness-red'
}

function RecoveryPlanRecordModal({ entry, onClose }) {
  const plan = entry.plan ?? {}
  const sections = plan.reportSections ?? []
  const priorities = sections.find((section) => section.id === 'recovery-priorities')?.items ?? plan.priorities ?? []
  const eventTitle = entry.contextSnapshot?.event?.title ?? entry.contextSnapshot?.checkout?.title ?? 'Post-event recovery'
  return <div className="modal-backdrop history-modal-backdrop" onClick={onClose}><section className="event-modal history-modal recovery-plan-record-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow="Recovery Plan" title={eventTitle} /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><p>{plan.summary}</p>{priorities.length > 0 && <section className="history-detail-section recovery-plan-priorities"><h3>{priorities.length} priorities</h3><ol>{priorities.map((priority) => <li key={priority}>{priority}</li>)}</ol></section>}<div className="history-recovery-plan-sections">{sections.filter((section) => section.id !== 'recovery-priorities').map((section) => <section className="history-detail-section" key={section.id}><h3>{section.title}</h3><p>{section.summary}</p>{section.items?.length > 0 && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div><footer className="ai-decision-footer"><button className="primary-button" onClick={onClose} type="button">Done</button></footer></section></div>
}

function RecoveryCompletionHistoryModal({ entry, onClose, savedRoutines }) {
  const routine = entry.details?.routineSnapshot ?? entry.details?.plan?.routine ?? {}
  const plan = { routine, planType: entry.routineType }
  const savedRoutine = findSavedRecoveryRoutine(savedRoutines, plan, entry.sourceCheckoutId)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal recovery-history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading eyebrow="Mobility Routine" title={routine.routineName ?? routine.title ?? 'Mobility routine'} />
          <button className="ghost-close" onClick={onClose} type="button">Close</button>
        </div>
        <div className="history-detail-grid recovery-history-summary">
          <span><strong>Finished</strong>{format(parseISO(entry.finishedAt ?? entry.completedAt), 'MMM d, yyyy · h:mm a')}</span>
          <span><strong>Routine type</strong>{formatRecoveryPlanType(entry.routineType ?? plan?.planType)}</span>
          <span><strong>Routine length</strong>{Math.max(1, Math.round(Number(entry.plannedDurationSeconds ?? routine.estimatedDurationSeconds ?? 0) / 60))} min</span>
          <span><strong>Exercises</strong>{plan?.routine?.exercises?.length ?? entry.details?.exerciseCount ?? '—'}</span>
          <span><strong>Completion</strong>{entry.completionPercentage == null ? 'Not measured' : `${Math.round(entry.completionPercentage)}%`}</span>
          <span><strong>Completed / skipped</strong>{entry.movementsCompleted?.length ?? 0} / {entry.movementsSkipped?.length ?? 0}</span>
          <span><strong>Body areas</strong>{getRecoveryRoutineAreas(plan?.routine)}</span>
          <span><strong>Equipment</strong>{getRecoveryRoutineEquipment(plan?.routine)}</span>
        </div>
        {entry.hurtEvents?.length > 0 && <section className="history-detail-section"><h3>Movement safety notes</h3><ul>{entry.hurtEvents.map((event, index) => <li key={`${event.movementId ?? event.exercise ?? 'movement'}-${index}`}>{event.exercise ?? event.movementId ?? 'Movement'}: {String(event.response ?? 'pain reported').replaceAll('_', ' ')} — {String(event.actionTaken ?? 'stopped').replaceAll('_', ' ')}</li>)}</ul></section>}
        {routine?.exercises?.length ? <SavedRecoveryPlan plan={plan} /> : <p>No saved mobility sequence is available.</p>}
        {savedRoutine?.isFavorite && <p className="recovery-saved-message">Saved in your routine library.</p>}
      </section>
    </div>
  )
}

function SavedRecoveryPlan({ plan }) {
  const routine = plan.routine

  return (
    <section className="history-detail-section saved-recovery-plan">
      <p className="eyebrow">Mobility routine plan</p>
      <h3>{routine?.routineName ?? routine?.title ?? 'Mobility routine'}</h3>
      {routine?.goal && <p className="saved-recovery-goal"><strong>Goal</strong>{routine.goal}</p>}
      {routine?.summary && <p className="saved-recovery-summary">{routine.summary}</p>}

      {routine?.exercises?.length > 0 && (
        <div className="saved-recovery-routine">
          <strong>{Math.max(1, Math.round(Number(routine.estimatedDurationSeconds ?? (routine.durationMinutes ? routine.durationMinutes * 60 : 600)) / 60))}-minute routine</strong>
          <ol>
            {routine.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`}>
                <details className="saved-recovery-exercise">
                  <summary>
                    <b>{exercise.name}</b>
                  </summary>
                  <div className="saved-recovery-exercise-plan">
                    <div className="saved-recovery-exercise-meta">
                      <span>{exercise.type ?? 'Mobility'}</span>
                      <em>{exercise.side ?? 'Both sides'}{exercise.durationSeconds ? ` · ${exercise.durationSeconds}s` : exercise.reps ? ` · ${exercise.reps} reps` : ''}</em>
                    </div>
                    {exercise.instruction && <p>{exercise.instruction}</p>}
                    {exercise.feel && <small><strong>You Should Feel:</strong> {formatRecoveryCue(exercise.feel)}</small>}
                    {exercise.avoid && <small><strong>Avoid:</strong> {formatRecoveryCue(exercise.avoid)}</small>}
                    {exercise.why && <small><strong>Why it is included:</strong> {exercise.why}</small>}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function formatRecoveryPlanType(value) {
  if (!value) return 'Recovery routine'
  return String(value).split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
}

function formatRecoveryCue(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const sentence = `${text.charAt(0).toUpperCase()}${text.slice(1)}`
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}

function getRecoveryRoutineAreas(routine) {
  const areas = [...new Set(routine?.exercises?.map((exercise) => exercise.area).filter(Boolean) ?? [])]
  return areas.join(', ') || 'Full body'
}

function getRecoveryRoutineEquipment(routine) {
  const equipment = [...new Set(routine?.exercises?.map((exercise) => exercise.equipment).filter((item) => item && item.toLowerCase() !== 'none') ?? [])]
  return equipment.join(', ') || 'None'
}

function findSavedRecoveryRoutine(savedRoutines, plan, sourceCheckoutId) {
  if (sourceCheckoutId) return savedRoutines.find((routine) => routine.sourceCheckoutId === sourceCheckoutId)
  const signature = getRecoveryRoutineSignature(plan)
  return savedRoutines.find((routine) => getRecoveryRoutineSignature(routine.routine) === signature)
}

function getRecoveryRoutineSignature(plan) {
  const routine = plan?.routine ?? plan
  const exercises = routine?.exercises?.map((exercise) => `${exercise.name}|${exercise.side ?? ''}|${exercise.durationSeconds ?? exercise.reps ?? ''}`) ?? []
  return `${routine?.title ?? ''}::${exercises.join('::')}`
}

function formatHistoryDate(entry) {
  if (!entry.date) return entry.day

  return new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })
}

function formatCheckoutDate(entry) {
  return new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })
}

function valueWithUnit(value, unit) {
  if (value === undefined || value === null) return undefined
  return `${value}${unit}`
}

function getCheckoutDetailSections(entry) {
  const sessionLoad = entry.sessionLoad ?? Number(entry.actualMinutes ?? 0) * Number(entry.difficulty ?? 0)

  return [
    {
      title: 'Session completed',
      items: presentItems([
        ['Event', entry.title],
        ['Date', formatCheckoutDate(entry)],
        ['Participation', entry.participation ?? entry.completionLevel],
        ['Actual duration', valueWithUnit(entry.actualMinutes, ' min')],
        ['Session effort', valueWithUnit(entry.difficulty, '/10')],
        ['Session load', `${sessionLoad} units`],
        ['Session content', entry.sessionContent?.length ? entry.sessionContent.join(', ') : undefined],
      ]),
    },
    {
      title: 'Physical response',
      items: presentItems([
        ['Fatigue after event', valueWithUnit(entry.postFatigue, '/5')],
        ['Soreness after event', valueWithUnit(entry.postSoreness, '/5')],
        ['Existing pain', entry.painChange],
        ['New pain or discomfort', yesNo(entry.newPain)],
        ['Cramping', yesNo(entry.cramping)],
        ['Symptoms', entry.heatSymptoms?.length ? entry.heatSymptoms.join(', ') : undefined],
        ['Movement or performance changed', yesNo(entry.movementChanged)],
      ]),
    },
    {
      title: 'Performance and focus',
      items: presentItems([
        ['Performance compared with normal', entry.performanceRating],
        ['Mental focus', valueWithUnit(entry.mentalFocus, '/5')],
        ['Motivation', valueWithUnit(entry.motivation, '/5')],
        ['Fatigue affected decisions or technique', yesNo(entry.fatigueAffectedTechnique)],
      ]),
    },
  ].filter((section) => section.items.length > 0)
}

function getPainDetailSections(entry) {
  const painMapSections = bodyPainAreas
    .map((area) => {
      const severity = Number(entry.painMap?.[area.id] ?? 0)
      if (severity <= 0) return null

      return {
        title: area.label,
        items: getPainItems(entry, severity, area.id),
      }
    })
    .filter(Boolean)

  if (painMapSections.length > 0) {
    return painMapSections
  }

  if (Number(entry.pain ?? 0) <= 0) {
    return []
  }

  return [
    {
      title: entry.location ?? 'Pain area',
      items: getPainItems(entry, entry.pain),
    },
  ]
}

function getPainItems(entry, score, areaId) {
  const details = areaId ? entry.painDetails?.[areaId] ?? {} : {}

  return presentItems([
    ['Pain level', valueWithUnit(score, '/10')],
    ['Injury type', details.injuryType ?? entry.injuryType],
    ['Pain type', details.painType ?? entry.painType],
    ['When it occurs', details.hurtsWhen ?? entry.hurtsWhen],
    ['Change since last session', details.painTrend ?? entry.painTrend],
    ['Affected movement', details.affectedMovement ?? entry.affectedMovement],
  ])
}

function presentItems(items) {
  return items.filter(([, value]) => value !== undefined && value !== null && value !== '')
}

function yesNo(value) {
  if (value === undefined || value === null) return undefined

  return value ? 'Yes' : 'No'
}

function getCutoffDate(days) {
  if (days === null) return null

  const date = new Date()
  date.setDate(date.getDate() - days)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getHistoryArchive(history, checkouts, recoveryCompletions = [], recoveryPlans = [], weekStartsOn = 1) {
  const years = new Map()
  const items = [
    ...history.map((entry) => ({ date: entry.date, entry, kind: 'check-in' })),
    ...checkouts.map((entry) => ({ date: entry.date, entry, kind: 'checkout' })),
    ...createRecoveryHistoryRecords(recoveryPlans, recoveryCompletions, localDateKey),
  ].filter((item) => item.date)

  items.forEach((item) => {
    const itemDate = parseLocalCalendarDate(item.date)
    if (!itemDate) return
    const yearStart = startOfYear(itemDate)
    const weekStart = calendarWeekStart(itemDate, weekStartsOn)
    const yearKey = format(yearStart, 'yyyy')
    const weekKey = format(weekStart, 'yyyy-MM-dd')
    const year = years.get(yearKey) ?? {
      itemCount: 0,
      key: yearKey,
      label: format(yearStart, 'yyyy'),
      weeks: new Map(),
    }
    const week = year.weeks.get(weekKey) ?? {
      items: [],
      key: weekKey,
      label: format(weekStart, 'MMM d'),
    }

    week.items.push(item)
    year.weeks.set(weekKey, week)
    year.itemCount += 1
    years.set(yearKey, year)
  })

  return [...years.values()]
    .map((year) => ({
      ...year,
      weeks: [...year.weeks.values()]
        .map((week) => ({
          ...week,
          items: week.items.sort((first, second) => getHistoryItemSortValue(second) - getHistoryItemSortValue(first)),
        }))
        .sort((first, second) => second.key.localeCompare(first.key)),
    }))
    .sort((first, second) => second.key.localeCompare(first.key))
}

function getHistoryItemSortValue(item) {
  const time = item.entry.eventTime ?? item.entry.time ?? '12:00'
  const calendarTime = new Date(`${item.date}T${time}`).getTime()
  const exactTime = new Date(item.entry.completedAt ?? item.entry.createdAt ?? '').getTime()
  return calendarTime + (Number.isFinite(exactTime) ? exactTime % 86_400_000 : 0)
}

function getCurrentWeekKey(weekStartsOn = 1) {
  return format(calendarWeekStart(new Date(), weekStartsOn), 'yyyy-MM-dd')
}

function getCurrentYearKey() {
  return format(startOfYear(new Date()), 'yyyy')
}

function average(values, digits = 0) {
  const validValues = values.filter((value) => Number.isFinite(value))

  if (validValues.length === 0) return 0

  const result = validValues.reduce((total, value) => total + value, 0) / validValues.length

  return digits > 0 ? result.toFixed(digits) : Math.round(result)
}

function summarizePainAreas(checkIns) {
  const counts = new Map()

  checkIns.forEach((entry) => {
    if (Number(entry.pain) <= 0 || !entry.location) return

    counts.set(entry.location, (counts.get(entry.location) ?? 0) + 1)
  })

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([area, count]) => `${area} (${count})`)
    .join(', ')
}
