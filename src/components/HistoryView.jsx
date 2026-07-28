import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

export function HistoryView({ history, insights, onClear }) {
  const maxScore = Math.max(...history.map((item) => item.score), 1)
  const hasSavedHistory = history.length > 0
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const isModalOpen = Boolean(selectedEntry || isClearModalOpen)

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
        {history.length === 0 ? (
          <article className="history-row empty-history">
            <p>No saved check-ins yet.</p>
          </article>
        ) : (
          history.map((item) => (
            <button
              className="history-row history-button"
              key={`${item.date}-${item.createdAt ?? item.note}`}
              onClick={() => setSelectedEntry(item)}
              type="button"
            >
              <div className="history-score">
                <span style={{ height: `${(item.score / maxScore) * 100}%` }} />
              </div>
              <div>
                <p className="eyebrow">{formatHistoryDate(item)}</p>
                <strong>{item.score} readiness</strong>
              </div>
            </button>
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
