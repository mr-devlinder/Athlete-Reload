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

      {recommendation.action && (
        <section className="training-action">
          <strong>Today&apos;s plan</strong>
          <p>{recommendation.action}</p>
        </section>
      )}

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

      {recommendation.action && (
        <section className="training-action">
          <strong>Recovery plan</strong>
          <p>{recommendation.action}</p>
        </section>
      )}

      <RecommendationSections recoveryMode recommendation={recommendation} />

      {recommendation.nextEventWarning && (
        <div className="next-event-warning">
          <strong>Next event</strong>
          <p>{recommendation.nextEventWarning}</p>
        </div>
      )}

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

function RecommendationSections({ recommendation, recoveryMode = false }) {
  const sections = [
    [recoveryMode ? 'Right now' : 'Prepare', recoveryMode ? 'Start with the immediate steps that support recovery.' : 'Set up the event with the right warm-up and adjustments.', recommendation.preparation],
    [recoveryMode ? 'Next few hours' : 'During the event', recoveryMode ? 'Use these cues while your body settles after the session.' : 'Keep these modifications in place while you participate.', recommendation.during],
    [recoveryMode ? 'Later today' : 'After the event', recoveryMode ? 'Finish the day with the recovery actions that matter most.' : 'Close the event with recovery and symptom-aware follow-through.', recommendation.recovery],
  ].filter(([, , items]) => items?.length)

  if (sections.length === 0) return null

  return (
    <div className="recommendation-sections">
      {sections.map(([title, description, items]) => (
        <section className={`recommendation-section${title === 'After the event' || title === 'Later today' ? ' after-event' : ''}`} key={title}>
          <strong>{title}</strong>
          <p>{description}</p>
          <ul>
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}
