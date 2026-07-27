import { SectionHeading } from './SectionHeading'

export function HistoryView({ history, insights }) {
  const maxScore = Math.max(...history.map((item) => item.score))

  return (
    <div className="history-view">
      <SectionHeading eyebrow="History" title="Patterns are the product." />

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
