const readinessSections = [
  'warm-up-focus',
  'hydration-target',
  'fueling-target',
  'during-event-fueling',
  'performance-focus',
  'pain-guidance',
  'fatigue-load',
  'environment-guidance',
  'event-preparation',
]

const checkoutSections = [
  'session-summary',
  'recovery-status',
  'hydration-recovery',
  'nutrition-recovery',
  'cooldown',
  'new-pain-soreness',
  'next-few-hours',
]

export function RecommendationCard({ onFeedback, recommendation, recommendationStatus = 'local', scoreLabel = 'readiness', session }) {
  const readinessBand = getReadinessBand(recommendation.score)
  const sections = indexSections(recommendation.reportSections)

  return (
    <aside className={`recommendation recommendation-report checkin-report ${recommendation.tone} ${readinessBand}`}>
      <ReportSource session={session} status={recommendationStatus} />
      <header className="checkin-report-hero">
        <div className={`score-ring ${readinessBand}`} style={{ '--score': `${recommendation.score}%` }}>
          <span>{recommendation.score}</span><small>{scoreLabel}</small>
        </div>
        <div><p className="report-kicker">Your event preparation</p><h2>{recommendation.label}</h2><p>{recommendation.summary}</p></div>
      </header>
      <RecommendationOverview recommendation={recommendation} />
      <details className="recommendation-details">
        <summary>Details</summary>
        {sections['readiness-status'] && <ReportSection section={sections['readiness-status']} tone="priority" />}
        <div className="report-section-grid">
          {readinessSections.map((id) => sections[id] ? <ReportSection key={id} section={sections[id]} tone={id === 'pain-guidance' ? 'pain' : ''} /> : null)}
        </div>
        {sections['pre-event-timeline'] && <TimelineSection section={sections['pre-event-timeline']} />}
      </details>
      {onFeedback && <div className="recommendation-feedback" aria-label="Recommendation feedback"><span>{recommendation.feedback ? 'Feedback saved' : 'Was this useful?'}</span>{['helpful', 'neutral', 'not_helpful'].map((value) => <button aria-pressed={recommendation.feedback === value} key={value} onClick={() => onFeedback(value)} type="button">{{ helpful: 'Helpful', neutral: 'Neutral', not_helpful: 'Not helpful' }[value]}</button>)}</div>}
      <ContextDisclosure recommendation={recommendation} />
    </aside>
  )
}

export function RecoveryPlanCard({ recommendation, recommendationStatus = 'local', session }) {
  const sections = indexSections(recommendation.reportSections)

  return (
    <aside className={`recommendation recommendation-report checkout-report ${recommendation.tone}`}>
      <ReportSource session={session} status={recommendationStatus} />
      <header className="checkout-report-hero">
        <p className="report-kicker">Checkout complete</p>
        <h2>{recommendation.label}</h2>
        <p>{recommendation.summary}</p>
      </header>
      <RecommendationOverview recommendation={recommendation} />
      <details className="recommendation-details">
        <summary>Details</summary>
        <div className="report-section-grid checkout-section-grid">
          {checkoutSections.map((id) => sections[id] ? <ReportSection key={id} section={sections[id]} tone={['recovery-status', 'next-few-hours'].includes(id) ? 'priority' : ''} /> : null)}
        </div>
      </details>
      <ContextDisclosure recommendation={recommendation} />
    </aside>
  )
}

function RecommendationOverview({ recommendation }) {
  const reasons = normalizeOverviewItems(recommendation.reasons, 'label')
  const actions = normalizeOverviewItems(recommendation.actions, 'instruction')
  const warnings = normalizeOverviewItems(recommendation.warnings, 'message')
  const primaryAction = recommendation.primaryAction?.instruction ?? recommendation.action
  return <section className="recommendation-overview">
    <div><span>What</span><strong>{recommendation.label}</strong></div>
    {reasons.length > 0 && <div><span>Why</span><ul>{reasons.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <div><span>Do</span><strong>{primaryAction}</strong>{actions.length > 1 && <ul>{actions.slice(1, 3).map((item) => <li key={item}>{item}</li>)}</ul>}</div>
    {warnings.length > 0 && <div className="watch"><span>Watch</span><ul>{warnings.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></div>}
  </section>
}

function normalizeOverviewItems(items = [], objectKey) {
  return items.map((item) => typeof item === 'string' ? item : item?.[objectKey]).filter(Boolean)
}

export function PerformanceQuote({ date, surface }) {
  const quote = getPerformanceQuote(surface, date)
  if (!quote) return null
  return <aside className={`performance-quote performance-quote-${surface}`}><span>Keep in mind</span><p>&ldquo;{quote}&rdquo;</p></aside>
}

function ReportSource({ session, status }) {
  const statusLabel = { ai: 'AI personalized', loading: 'Generating', local: 'Saved' }[status] ?? 'AI personalized'
  return <div className="recommendation-source"><p className="eyebrow">{session}</p><span>{statusLabel}</span></div>
}

function ReportSection({ section, tone = '' }) {
  if (!section || (!section.summary && !section.items?.length)) return null
  return <section className={`report-section ${tone}`}>
    <div className="report-section-heading"><span aria-hidden="true"><AppIcon name={getSectionIcon(section.id)} size={18} /></span><strong>{section.title}</strong></div>
    {section.summary && <p>{section.summary}</p>}
    {section.items?.length > 0 && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
    {section.id === 'warm-up-focus' && section.items?.length > 1 && <details className="warmup-details"><summary>How to use this</summary><p>Use these priorities inside your normal progressive warm-up. Keep every movement comfortable and controlled.</p></details>}
  </section>
}

function TimelineSection({ section }) {
  return <section className="recommendation-timeline">
    <div className="report-section-heading"><span aria-hidden="true"><AppIcon name="performance" size={18} /></span><strong>{section.title}</strong></div>
    {section.summary && <p>{section.summary}</p>}
    <ol>{section.items?.map((item) => <li key={item}>{item}</li>)}</ol>
  </section>
}

function ContextDisclosure({ recommendation }) {
  if (!recommendation.contextFactors?.length) return null
  return <details className="recommendation-context"><summary>What shaped this plan</summary><p>{recommendation.contextFactors.join(' / ')}</p></details>
}

function indexSections(sections = []) {
  return Object.fromEntries(sections.filter((section) => section?.id).map((section) => [section.id, section]))
}

function getSectionIcon(id) {
  return ({
    'readiness-status': 'shield',
    'warm-up-focus': 'warmup',
    'hydration-target': 'water',
    'fueling-target': 'fuel',
    'during-event-fueling': 'fuel',
    'performance-focus': 'performance',
    'pain-guidance': 'alert',
    'fatigue-load': 'recovery',
    'environment-guidance': 'water',
    'event-preparation': 'performance',
    'session-summary': 'performance',
    'recovery-status': 'recovery',
    'hydration-recovery': 'water',
    'nutrition-recovery': 'fuel',
    cooldown: 'recovery',
    'new-pain-soreness': 'alert',
    'next-few-hours': 'spark',
  })[id] ?? 'spark'
}

function getReadinessBand(score) {
  if (Number(score) >= 80) return 'readiness-green'
  if (Number(score) >= 60) return 'readiness-yellow'
  return 'readiness-red'
}
import { AppIcon } from './AppIcon'
import { getPerformanceQuote } from '../data/performanceQuotes'
