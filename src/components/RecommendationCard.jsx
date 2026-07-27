import { AdviceList } from './AdviceList'

export function RecommendationCard({ recommendation, session }) {
  return (
    <aside className={`recommendation ${recommendation.tone}`}>
      <p className="eyebrow">Recommendation</p>
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

      <div className="advice-grid">
        <AdviceList title="Avoid" items={recommendation.avoid} />
        <AdviceList title="Focus" items={recommendation.focus} />
      </div>

      {recommendation.reasons.length > 0 && (
        <div className="reason-strip">
          {recommendation.reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      )}

      <div className="coach-note">
        <p className="eyebrow">{session}</p>
        <strong>Coach message</strong>
        <p>{recommendation.coachMessage}</p>
      </div>
    </aside>
  )
}
