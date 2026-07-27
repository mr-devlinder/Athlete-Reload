import { SectionHeading } from './SectionHeading'

export function HistoryView({ history, insights, onClear, onReset }) {
  const maxScore = Math.max(...history.map((item) => item.score))
  const hasSavedHistory = history.length > 1

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
          <button
            className="secondary-button compact-action"
            onClick={onReset}
            type="button"
          >
            Reset app data
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
        {history.map((item) => (
          <article className="history-row" key={`${item.day}-${item.note}`}>
            <div className="history-score">
              <span style={{ height: `${(item.score / maxScore) * 100}%` }} />
            </div>
            <div>
              <p className="eyebrow">{item.day}</p>
              <strong>{item.score} readiness</strong>
              <p>
                {item.location} - fatigue {item.fatigue}/10
              </p>
            </div>
            <p>{item.note}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
