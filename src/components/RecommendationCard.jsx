export function RecommendationCard({
  recommendation,
  recommendationStatus = 'local',
  scoreLabel = 'readiness',
  session,
}) {
  const statusLabel = {
    ai: 'AI',
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

      <RecommendationSections recommendation={recommendation} />

    </aside>
  )
}

export function RecoveryPlanCard({ recommendation, recommendationStatus = 'local', session }) {
  const statusLabel = {
    ai: 'AI',
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
        <h2>{recommendation.label}</h2>
        <p>{recommendation.summary}</p>
      </div>

      <RecommendationSections recommendation={recommendation} />

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

function RecommendationSections({ recommendation }) {
  const sections = [
    ['Prepare', recommendation.preparation],
    ['During the event', recommendation.during],
    ['After the event', recommendation.recovery],
  ].filter(([, items]) => items?.length)

  if (sections.length === 0) return null

  return (
    <div className="recommendation-sections">
      {sections.map(([title, items]) => (
        <section className={`recommendation-section${title === 'After the event' ? ' after-event' : ''}`} key={title}>
          <strong>{title}</strong>
          <ul>
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}
