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

      <div className="coach-note">
        <p className="eyebrow">{session}</p>
        <strong>Coach message</strong>
        <p>
          I can train today, but I need the modified plan above and will stop if
          symptoms climb.
        </p>
      </div>
    </aside>
  )
}
