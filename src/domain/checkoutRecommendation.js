import { createStructuredRecommendation } from './contracts'
import { evaluateSafety, hasStopFinding } from './safety'
import { calculateSessionLoad } from './workload'

export function getCheckoutRecommendation(checkout = {}, event = {}, nextEvent = null) {
  const findings = evaluateSafety(checkout)
  const stop = hasStopFinding(findings)
  const sessionLoad = calculateSessionLoad(checkout.actualMinutes, checkout.difficulty)
  const highFatigue = Number(checkout.postFatigue) >= 4
  const highSoreness = Number(checkout.postSoreness) >= 4
  const worsenedPain = checkout.newPain || /worse/i.test(checkout.painChange ?? '')
  const score = stop ? 25 : Math.max(35, Math.min(96,
    94
      - Math.max(0, Number(checkout.difficulty) - 6) * 4
      - Math.max(0, Number(checkout.postFatigue) - 2) * 7
      - Math.max(0, Number(checkout.postSoreness) - 2) * 6
      - (worsenedPain ? 18 : 0)
      - (checkout.movementChanged ? 12 : 0),
  ))
  const label = stop ? 'Stop and check the response' : score < 55 ? 'Higher recovery need' : score < 75 ? 'Recover deliberately' : 'Normal recovery support'
  const reasons = [
    sessionLoad > 600 && 'high session load',
    highFatigue && 'high post-event fatigue',
    highSoreness && 'high post-event soreness',
    worsenedPain && 'new or worsening pain',
    checkout.movementChanged && 'movement changed during the event',
  ].filter(Boolean)
  const warnings = findings.map((finding) => finding.message)
  const actions = stop
    ? ['Stop additional training and tell an appropriate adult or qualified professional what changed.']
    : [
        'Cool down with easy, comfortable movement.',
        'Restore fluids and eat a familiar recovery meal or snack.',
        nextEvent ? `Reassess fatigue, soreness, and pain before ${nextEvent.title ?? nextEvent.type}.` : 'Reassess fatigue, soreness, and pain later today.',
      ]

  return createStructuredRecommendation({
    score,
    label,
    tone: stop || score < 55 ? 'danger' : score < 75 ? 'caution' : 'ready',
    intensity: stop ? 'No additional training' : 'Recovery',
    summary: reasons.length ? `Your immediate recovery plan is shaped by ${reasons.join(', ')}.` : 'Your checkout supports a normal, practical recovery plan.',
    action: actions[0],
    focus: actions,
    avoid: warnings,
    reasons,
    warnings,
    status: stop ? 'stop_and_seek_help' : score < 55 ? 'limit' : score < 80 ? 'adjust' : 'ready',
    reportSections: [
      { id: 'session-summary', title: 'What happened', summary: `${Number(checkout.actualMinutes) || 0} minutes at ${Number(checkout.difficulty) || 0}/10 effort produced ${sessionLoad} session-load units.`, items: [] },
      { id: 'recovery-status', title: 'What matters now', summary: label, items: reasons },
      { id: 'next-few-hours', title: 'What to do', summary: actions[0], items: actions.slice(1) },
      ...(warnings.length ? [{ id: 'new-pain-soreness', title: 'What to watch', summary: warnings[0], items: warnings.slice(1) }] : []),
    ],
    contextFactors: reasons,
    sessionLoad,
    safetyFindings: findings,
  }, { answeredInputs: 8, baselineSampleSize: 0 })
}
