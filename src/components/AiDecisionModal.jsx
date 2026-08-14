import { m } from 'motion/react'
import { AppIcon } from './AppIcon'
import '../styles/ai-decision-modal.css'

const prioritySections = ['pain-guidance', 'warm-up-focus', 'fatigue-load', 'performance-focus', 'event-preparation', 'hydration-target', 'fueling-target', 'pre-event-timeline']

export function AiDecisionModal({ checkIn, context, dialogRef, onClose, recommendation }) {
  return <div className="modal-backdrop ai-decision-backdrop">
    <m.section animate={{ opacity: 1, scale: 1, y: 0 }} aria-labelledby="ai-decision-title" className="event-modal ai-decision-modal" initial={{ opacity: 0, scale: .97, y: 18 }} ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
      <DecisionHeader context={context} onClose={onClose} />
      <AiDecisionReport checkIn={checkIn} recommendation={recommendation} />
      <footer className="ai-decision-footer"><button className="primary-button" onClick={onClose} type="button">Continue to Home</button></footer>
    </m.section>
  </div>
}

export function AiDecisionReport({ checkIn, recommendation }) {
  const sections = Object.fromEntries((recommendation.reportSections ?? []).filter((section) => section?.id).map((section) => [section.id, section]))
  const details = prioritySections.map((id) => sections[id]).filter((section) => section?.summary || section?.items?.length).slice(0, 5)
  const reasons = normalizeItems(recommendation.reasons, 'label').map(formatSentence).slice(0, 3)
  const warnings = normalizeItems(recommendation.warnings, 'message').map(formatSentence).slice(0, 2)
  const primaryAction = formatSentence(recommendation.primaryAction?.instruction ?? recommendation.action)
  const score = Math.max(0, Math.min(100, Number(recommendation.score) || 0))
  const snapshot = getCheckInSnapshot(checkIn)

  return <div className="ai-decision-report">
      <div className="ai-decision-hero">
        <div className="ai-decision-score" style={{ '--decision-score': `${score * 3.6}deg` }}><strong>{score}</strong><small>/100 readiness</small></div>
        <div><h2 id="ai-decision-title">{formatTitle(recommendation.label)}</h2><p>{formatSentence(recommendation.summary)}</p></div>
      </div>

      <section className="ai-decision-action"><span><AppIcon name="performance" size={17} />Do this now</span><strong>{primaryAction}</strong></section>

      {reasons.length > 0 && <section className="ai-decision-drivers"><div><strong>Why this plan</strong></div><ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>}

      {details.length > 0 && <section className="ai-decision-details"><div className="ai-decision-section-title"><strong>Event plan</strong></div><div>{details.map((section) => <article className={section.id === 'pain-guidance' ? 'risk' : ''} key={section.id}><span><AppIcon name={getIcon(section.id)} size={17} /></span><div><strong>{formatTitle(section.title)}</strong>{section.summary && <p>{formatSentence(section.summary)}</p>}{section.items?.length > 0 && <ul>{section.items.slice(0, 3).map((item) => <li key={item}>{formatSentence(item)}</li>)}</ul>}</div></article>)}</div></section>}

      {snapshot.length > 0 && <section className="ai-decision-snapshot"><div className="ai-decision-section-title"><strong>Saved check-in</strong></div><div>{snapshot.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div></section>}

      {warnings.length > 0 && <section className="ai-decision-watch"><span><AppIcon name="alert" size={17} />Watch during the event</span><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}
  </div>
}

export function DecisionHeader({ context, onClose }) {
  return <header className="ai-decision-header">
    <div><span><AppIcon name="spark" size={15} />AI event plan</span><small>{formatTitle(context.session)}</small></div>
    <button aria-label="Close event plan" className="ghost-close" onClick={onClose} type="button">Close</button>
  </header>
}

export function CheckoutAiModal({ context, dialogRef, onClose, onOpenRecovery }) {
  const eventName = formatTitle(context.session || 'Completed event')
  return <div className="modal-backdrop checkout-ai-backdrop">
    <m.section animate={{ opacity: 1, scale: 1, y: 0 }} aria-labelledby="checkout-ai-title" className="event-modal checkout-ai-modal" initial={{ opacity: 0, scale: .97, y: 18 }} ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
      <button aria-label="Close checkout result" className="checkout-ai-close" onClick={onClose} type="button">Close</button>
      <div className="checkout-ai-mark"><AppIcon name="recovery" size={24} /></div>
      <span>Checkout saved</span>
      <h2 id="checkout-ai-title">Your recovery plan is ready.</h2>
      <p>{eventName} has been saved to History. Open Recovery to see your complete AI plan and next actions.</p>
      <button className="primary-button checkout-ai-recovery-button" onClick={onOpenRecovery} type="button"><AppIcon name="recovery" size={18} />Go to Recovery</button>
    </m.section>
  </div>
}

function normalizeItems(items = [], key) {
  return items.map((item) => typeof item === 'string' ? item : item?.[key]).filter(Boolean)
}

function formatSentence(value) {
  const text = cleanText(value)
  if (!text) return ''
  const normalized = isAllCaps(text) ? text.toLowerCase() : text
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1)
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}

function formatTitle(value) {
  const text = cleanText(value)
  if (!text) return ''
  const normalized = isAllCaps(text) ? text.toLowerCase() : text
  return normalized.split(/\s+/).map((word) => /^[A-Z0-9/]+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function cleanText(value) {
  return String(value ?? '').trim().replaceAll('**', '').replace(/^[-•]\s*/, '')
}

function isAllCaps(value) {
  return /[A-Z]/.test(value) && value === value.toUpperCase()
}

function getCheckInSnapshot(checkIn) {
  if (!checkIn) return []
  const painScores = Object.values(checkIn.painMap ?? {}).map(Number).filter(Number.isFinite)
  const pain = Math.max(Number(checkIn.pain) || 0, ...painScores, 0)
  return [
    ['Energy', scaleValue(checkIn.energy, 5)],
    ['Fatigue', scaleValue(checkIn.fatigue, 5)],
    ['Soreness', scaleValue(checkIn.soreness, 5)],
    ['Sleep', checkIn.sleep == null ? null : `${Number(checkIn.sleep)} hr`],
    ['Sleep quality', scaleValue(checkIn.sleepQuality, 5)],
    ['Stress', scaleValue(checkIn.stress, 5)],
    ['Pain', pain > 0 ? `${pain}/10` : 'None reported'],
    ['Expected effort', scaleValue(checkIn.expectedDifficulty, 10)],
  ].filter(([, value]) => value !== null)
}

function scaleValue(value, max) {
  return value === null || value === undefined || value === '' ? null : `${Number(value)}/${max}`
}

function getIcon(id) {
  return ({
    'pain-guidance': 'alert',
    'warm-up-focus': 'warmup',
    'fatigue-load': 'recovery',
    'hydration-target': 'water',
    'fueling-target': 'fuel',
    'performance-focus': 'performance',
    'event-preparation': 'spark',
  })[id] ?? 'spark'
}
