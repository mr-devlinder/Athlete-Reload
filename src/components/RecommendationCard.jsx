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

export function RecommendationCard({ recommendation, recommendationStatus = 'local', scoreLabel = 'readiness', session }) {
  const sections = indexSections(recommendation.reportSections)
  const drivers = normalizeOverviewItems(recommendation.reasons, 'label').slice(0, 3)
  const readinessBand = getReadinessBand(recommendation.score)

  return (
    <m.aside className={`recommendation recommendation-report checkin-report ${recommendation.tone} ${readinessBand}`} initial={{ opacity: 0, scale: .97, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
      <ReportSource session={session} status={recommendationStatus} />
      <header className="checkin-result-hero">
        <div><p className="report-kicker">Current state</p><h2>{recommendation.redFlag ? 'A safety concern needs attention' : recommendation.label}</h2><p>{recommendation.summary}</p></div>
        <div className="context-score"><span>{scoreLabel} context indicator</span><strong>{recommendation.score}<small>/100</small></strong><em>{recommendation.confidence < .5 ? 'Learning your baseline' : `${Math.round(recommendation.confidence * 100)}% data confidence`}</em></div>
      </header>
      {drivers.length > 0 && <section className="key-driver-section"><div className="result-section-title"><span>Key drivers</span><small>Up to 3</small></div><div>{drivers.map((driver) => <article key={driver}><strong>{formatDriverTitle(driver)}</strong><p>{formatDriverExplanation(driver)}</p></article>)}</div></section>}
      <RecommendationOverview recommendation={recommendation} />
      {sections['pre-event-timeline'] && <TimelineSection section={sections['pre-event-timeline']} />}
      <details className="recommendation-details">
        <summary>More context and limits</summary>
        {sections['readiness-status'] && <ReportSection section={sections['readiness-status']} tone="priority" />}
        <div className="report-section-grid">
          {readinessSections.map((id) => sections[id] ? <ReportSection key={id} section={sections[id]} tone={id === 'pain-guidance' ? 'pain' : ''} /> : null)}
        </div>
      </details>
      <ContextDisclosure recommendation={recommendation} />
    </m.aside>
  )
}

export function RecoveryPlanCard({ recommendation, recommendationStatus = 'local', session }) {
  const sections = indexSections(recommendation.reportSections)

  return (
    <m.aside className={`recommendation recommendation-report checkout-report ${recommendation.tone}`} initial={{ opacity: 0, scale: .97, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
      <ReportSource session={session} status={recommendationStatus} />
      <header className="checkout-result-hero">
        <span aria-hidden="true">✓</span>
        <div><p className="report-kicker">Session saved</p><h2>{recommendation.label}</h2><p>{recommendation.summary}</p></div>
      </header>
      <RecommendationOverview recommendation={recommendation} />
      <details className="recommendation-details">
        <summary>Session details</summary>
        <div className="report-section-grid checkout-section-grid">
          {checkoutSections.map((id) => sections[id] ? <ReportSection key={id} section={sections[id]} tone={['recovery-status', 'next-few-hours'].includes(id) ? 'priority' : ''} /> : null)}
        </div>
      </details>
      <ContextDisclosure recommendation={recommendation} />
    </m.aside>
  )
}

function RecommendationOverview({ recommendation }) {
  const actions = normalizeOverviewItems(recommendation.actions, 'instruction')
  const warnings = normalizeOverviewItems(recommendation.warnings, 'message')
  const primaryAction = recommendation.primaryAction?.instruction ?? recommendation.action
  return <section className="recommendation-overview recommendation-action-board">
    <m.div className="action-tile primary" whileHover={{ y: -2 }}><span><AppIcon name="spark" size={17} />Do this now</span><strong>{primaryAction}</strong>{actions.length > 1 && <ul>{actions.slice(1, 3).map((item) => <li key={item}>{item}</li>)}</ul>}</m.div>
    {warnings.length > 0 && <m.div className="action-tile watch" whileHover={{ y: -2 }}><span><AppIcon name="alert" size={17} />Watch</span><ul>{warnings.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></m.div>}
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
  const statusLabel = { ai: 'Rules + personalized wording', loading: 'Generating', local: 'Deterministic guidance' }[status] ?? 'Deterministic guidance'
  return <div className="recommendation-source"><p className="eyebrow">{session}</p><span>{statusLabel}</span></div>
}

function formatDriverTitle(driver) {
  return String(driver).replace(/^./, (letter) => letter.toUpperCase())
}

function formatDriverExplanation(driver) {
  const text = String(driver).toLowerCase()
  if (text.includes('baseline') || text.includes('normal')) return 'This differs meaningfully from your recent check-ins.'
  if (text.includes('pain')) return 'This concern takes priority over an otherwise positive readiness score.'
  if (text.includes('sleep')) return 'Sleep can affect how recovered and prepared you feel today.'
  if (text.includes('fatigue')) return 'Higher fatigue may change how quickly you build into the session.'
  return 'This is one of the strongest current inputs shaping the plan.'
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
import { m } from 'motion/react'
import '../styles/recommendation-experience.css'
