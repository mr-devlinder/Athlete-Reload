import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, startOfWeek } from 'date-fns'
import { SectionHeading } from './SectionHeading'

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

export function HistoryView({ checkouts = [], history, insights, onClear, onOpenCheckout }) {
  const maxScore = Math.max(...history.map((item) => item.score), 1)
  const hasSavedHistory = history.length > 0
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set())
  const isModalOpen = Boolean(selectedEntry || isClearModalOpen || selectedWeek)
  const weeks = getHistoryWeeks(history, checkouts)

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

  return (
    <div className="history-view">
      <div className="schedule-header">
        <SectionHeading eyebrow="History" title="Patterns are the product." />
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

      <div className="trend-grid">
        {insights.map((insight) => (
          <article className="insight-card" key={insight}>
            {insight}
          </article>
        ))}
      </div>

      <div className="history-list">
        {weeks.length === 0 ? (
          <article className="history-row empty-history">
            <p>No saved check-ins yet.</p>
          </article>
        ) : (
          weeks.map((week) => (
            <section className="history-week" key={week.key}>
              <div className="history-week-header">
                <button className="history-week-toggle" onClick={() => toggleWeek(week.key)} type="button">
                  <span>{expandedWeeks.has(week.key) ? 'Hide' : 'Show'}</span>
                  <strong>Week of {week.label}</strong>
                  <em>{week.items.length} item{week.items.length === 1 ? '' : 's'}</em>
                </button>
                <button
                  className="secondary-button compact-action"
                  onClick={() => setSelectedWeek(week)}
                  type="button"
                >
                  Weekly report
                </button>
              </div>

              {expandedWeeks.has(week.key) && (
                <div className="history-week-items">
                  {week.items.map((item) => item.kind === 'check-in' ? (
                    <button
                      className="history-row history-button"
                      key={`check-${item.entry.date}-${item.entry.createdAt ?? item.entry.note}`}
                      onClick={() => setSelectedEntry(item.entry)}
                      type="button"
                    >
                      <div className="history-score">
                        <span style={{ height: `${(item.entry.score / maxScore) * 100}%` }} />
                      </div>
                      <div>
                        <p className="eyebrow">{formatHistoryDate(item.entry)}</p>
                        <strong>{item.entry.score} readiness</strong>
                      </div>
                    </button>
                  ) : (
                    <button
                      className="history-row history-button checkout-history-row"
                      key={`checkout-${item.entry.id}`}
                      onClick={() => onOpenCheckout(item.entry)}
                      type="button"
                    >
                      <div className="history-score checkout-score">
                        <span style={{ height: `${Math.min(100, item.entry.difficulty * 10)}%` }} />
                      </div>
                      <div>
                        <p className="eyebrow">{formatCheckoutDate(item.entry)}</p>
                        <strong>{item.entry.title}: {item.entry.actualMinutes} min, {item.entry.difficulty}/10</strong>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      {selectedEntry && createPortal(
        <HistoryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
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

      {selectedWeek && createPortal(
        <WeeklyReportModal
          week={selectedWeek}
          onClose={() => setSelectedWeek(null)}
        />,
        document.body,
      )}
    </div>
  )
}

function WeeklyReportModal({ week, onClose }) {
  const checkIns = week.items.filter((item) => item.kind === 'check-in').map((item) => item.entry)
  const checkouts = week.items.filter((item) => item.kind === 'checkout').map((item) => item.entry)
  const averageReadiness = average(checkIns.map((entry) => entry.score))
  const averageSleep = average(checkIns.map((entry) => Number(entry.sleep)), 1)
  const averageFatigue = average(checkIns.map((entry) => entry.fatigue))
  const workload = checkouts.reduce((total, checkout) => total + checkout.actualMinutes * checkout.difficulty, 0)
  const painAreas = summarizePainAreas(checkIns)

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
            eyebrow={`Week of ${week.label}`}
            title="Weekly athlete report."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="history-detail-grid">
          <span><strong>Readiness</strong>{averageReadiness}/100 average</span>
          <span><strong>Sleep</strong>{averageSleep}h average</span>
          <span><strong>Fatigue</strong>{averageFatigue}/10 average</span>
          <span><strong>Workload</strong>{workload || 'No checkouts'}</span>
          <span><strong>Availability</strong>{averageReadiness >= 80 ? 'Mostly available' : averageReadiness >= 60 ? 'Modified training likely' : 'Recovery focus'}</span>
          <span><strong>Pain pattern</strong>{painAreas || 'No recurring pain areas'}</span>
        </div>
      </section>
    </div>
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

function HistoryModal({ entry, onClose }) {
  const details = [
    ['Energy', valueWithUnit(entry.energy, '/10')],
    ['Soreness', valueWithUnit(entry.soreness, '/10')],
    ['Pain', valueWithUnit(entry.pain, '/10')],
    ['Fatigue', valueWithUnit(entry.fatigue, '/10')],
    ['Sleep', valueWithUnit(entry.sleep, 'h')],
    ['Stress', entry.stress],
    ['Hydration', entry.hydration],
    ['Yesterday', entry.yesterdayLoad],
    ['Upcoming', entry.session],
  ]

  const painDetails = entry.pain > 0
    ? [
        ['Pain location', entry.location],
        ['Injury type', entry.injuryType],
        ['Pain type', entry.painType],
        ['Hurts when', entry.hurtsWhen],
      ]
    : []

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
            eyebrow={formatHistoryDate(entry)}
            title={`${entry.score} readiness.`}
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="history-detail-grid">
          {[...details, ...painDetails].map(([label, value]) => (
            <span key={label}>
              <strong>{label}</strong>
              {value ?? 'Not saved'}
            </span>
          ))}
        </div>

        {entry.note && (
          <div className="history-note">
            <strong>Notes</strong>
            <p>{entry.note}</p>
          </div>
        )}
      </section>
    </div>
  )
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

function getHistoryWeeks(history, checkouts) {
  const grouped = new Map()
  const items = [
    ...history.map((entry) => ({ date: entry.date, entry, kind: 'check-in' })),
    ...checkouts.map((entry) => ({ date: entry.date, entry, kind: 'checkout' })),
  ].filter((item) => item.date)

  items.forEach((item) => {
    const weekStart = startOfWeek(parseISO(item.date))
    const key = format(weekStart, 'yyyy-MM-dd')
    const current = grouped.get(key) ?? {
      items: [],
      key,
      label: format(weekStart, 'MMM d'),
    }

    current.items.push(item)
    grouped.set(key, current)
  })

  return [...grouped.values()]
    .map((week) => ({
      ...week,
      items: week.items.sort((first, second) => second.date.localeCompare(first.date)),
    }))
    .sort((first, second) => second.key.localeCompare(first.key))
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
    if (entry.pain <= 0) return

    counts.set(entry.location, (counts.get(entry.location) ?? 0) + 1)
  })

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([area, count]) => `${area} (${count})`)
    .join(', ')
}
