export function RecommendationCard({ recommendation, session }) {
  return (
    <aside className={`recommendation ${recommendation.tone}`}>
      <p className="eyebrow">{session}</p>
      <div className="score-row">
        <div
          className="score-ring"
          style={{ '--score': `${recommendation.score}%` }}
        >
          <span>{recommendation.score}</span>
          <small>readiness</small>
        </div>
        <div>
          <h2>{recommendation.label}</h2>
          <p>{recommendation.summary}</p>
        </div>
      </div>

      <div className="training-action">
        <strong>{recommendation.intensity}</strong>
        <p>{recommendation.action}</p>
      </div>

      <div className="advice-grid">
        <div className="advice-list">
          <strong>Avoid</strong>
          {recommendation.avoid.length === 0 ? (
            <span>No restrictions</span>
          ) : (
            recommendation.avoid.map((item) => (
              <span key={item}>{item}</span>
            ))
          )}
        </div>
        <div className="advice-list">
          <strong>Focus</strong>
          {recommendation.focus.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

    </aside>
  )
}
