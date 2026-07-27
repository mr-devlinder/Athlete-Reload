import { useState } from 'react'
import { SectionHeading } from './SectionHeading'

export function HistoryView({ history, insights, onClear }) {
  const maxScore = Math.max(...history.map((item) => item.score), 1)
  const hasSavedHistory = history.length > 0
  const [selectedEntry, setSelectedEntry] = useState(null)

  return (
    <div className="history-view">
      <div className="schedule-header">
        <SectionHeading eyebrow="History" title="Patterns are the product." />
        <div className="history-actions">
          <button
            className="remove-button compact-action"
            disabled={!hasSavedHistory}
            onClick={onClear}
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

      {selectedEntry && (
        <HistoryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
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
    <div className="modal-backdrop">
      <section className="event-modal history-modal glass-panel" role="dialog" aria-modal="true">
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
