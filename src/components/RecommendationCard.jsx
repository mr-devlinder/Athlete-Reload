export function RecommendationCard({
  recommendation,
  recommendationStatus = 'local',
  scoreLabel = 'readiness',
  session,
}) {
  const statusLabel = {
    ai: 'Gemini AI',
    fallback: 'Local fallback',
    loading: 'Generating AI',
    local: 'Local engine',
  }[recommendationStatus]

  return (
    <aside className={`recommendation ${recommendation.tone}`}>
      <div className="recommendation-source">
        <p className="eyebrow">{session}</p>
        <span>{statusLabel}</span>
      </div>
      <div className="score-row">
        <div
          className="score-ring"
          style={{ '--score': `${recommendation.score}%` }}
        >
          <span>{recommendation.score}</span>
          <small>{scoreLabel}</small>
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

export function RecoveryPlanCard({ recommendation, recommendationStatus = 'local', session }) {
  const statusLabel = {
    ai: 'Gemini AI',
    fallback: 'Local fallback',
    loading: 'Generating AI',
    local: 'Local engine',
  }[recommendationStatus]

  return (
    <aside className={`recommendation recovery-plan ${recommendation.tone}`}>
      <div className="recommendation-source">
        <p className="eyebrow">{session}</p>
        <span>{statusLabel}</span>
      </div>

      <div className="recovery-plan-hero">
        <span>{recommendation.intensity}</span>
        <h2>{recommendation.label}</h2>
        <p>{recommendation.summary}</p>
      </div>

      <div className="training-action">
        <strong>Recovery plan</strong>
        <p>{recommendation.action}</p>
      </div>

      <div className="advice-grid">
        <div className="advice-list">
          <strong>Do now</strong>
          {recommendation.focus.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="advice-list">
          <strong>Avoid for now</strong>
          {recommendation.avoid.length === 0 ? (
            <span>No extra restrictions</span>
          ) : (
            recommendation.avoid.map((item) => (
              <span key={item}>{item}</span>
            ))
          )}
        </div>
      </div>

      {recommendation.reasons.length > 0 && (
        <div className="recovery-reasons">
          <strong>Why this plan</strong>
          {recommendation.reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      )}
    </aside>
  )
}
