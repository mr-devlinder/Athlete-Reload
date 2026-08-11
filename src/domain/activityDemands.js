const neutral = {
  aerobic: 2, anaerobic: 2, impact: 2, eccentric: 2, acceleration: 2,
  deceleration: 2, cutting: 1, jumping: 1, contact: 0, upperBody: 2, lowerBody: 2,
}

export const activityDemandCatalog = {
  Baseball: { ...neutral, aerobic: 1, anaerobic: 3, acceleration: 3, upperBody: 4, lowerBody: 3, contact: 1 },
  Basketball: { ...neutral, aerobic: 4, anaerobic: 4, impact: 4, eccentric: 4, acceleration: 5, deceleration: 5, cutting: 5, jumping: 5, contact: 3, lowerBody: 5 },
  Football: { ...neutral, aerobic: 3, anaerobic: 5, impact: 5, eccentric: 4, acceleration: 5, deceleration: 5, cutting: 4, jumping: 3, contact: 5, upperBody: 4, lowerBody: 5 },
  Golf: { ...neutral, aerobic: 2, anaerobic: 1, impact: 1, eccentric: 2, upperBody: 3, lowerBody: 2 },
  'General fitness': { ...neutral, aerobic: 3, anaerobic: 3, impact: 2, eccentric: 3, upperBody: 3, lowerBody: 3 },
  'Track and field': { ...neutral, aerobic: 4, anaerobic: 4, impact: 4, eccentric: 4, acceleration: 5, deceleration: 3, jumping: 3, lowerBody: 5 },
  'Weight training': { ...neutral, aerobic: 1, anaerobic: 4, impact: 2, eccentric: 5, upperBody: 5, lowerBody: 5 },
  Running: { ...neutral, aerobic: 5, anaerobic: 3, impact: 4, eccentric: 4, acceleration: 3, deceleration: 2, lowerBody: 5 },
  Soccer: { ...neutral, aerobic: 5, anaerobic: 4, impact: 4, eccentric: 5, acceleration: 5, deceleration: 5, cutting: 5, jumping: 3, contact: 3, lowerBody: 5 },
  Swimming: { ...neutral, aerobic: 5, anaerobic: 3, impact: 0, eccentric: 2, acceleration: 1, deceleration: 1, upperBody: 5, lowerBody: 3 },
  Volleyball: { ...neutral, aerobic: 3, anaerobic: 4, impact: 4, eccentric: 4, acceleration: 3, deceleration: 4, cutting: 3, jumping: 5, contact: 1, upperBody: 4, lowerBody: 5 },
  Wrestling: { ...neutral, aerobic: 4, anaerobic: 5, impact: 4, eccentric: 5, acceleration: 3, deceleration: 4, cutting: 2, contact: 5, upperBody: 5, lowerBody: 5 },
  Other: neutral,
}

function clampDemand(value) {
  return Math.max(0, Math.min(5, Math.round(Number(value) || 0)))
}

export function getActivityDemandProfile({ sport = 'Other', event, workload = {} } = {}) {
  const base = activityDemandCatalog[sport] ?? activityDemandCatalog.Other
  const intensity = { Low: -1, Medium: 0, High: 1 }[event?.load] ?? 0
  const duration = Number(workload.actualMinutes ?? event?.plannedMinutes ?? event?.expectedDuration ?? 0)
  const durationAdjustment = duration >= 120 ? 1 : duration > 0 && duration <= 30 ? -1 : 0
  const descriptor = `${event?.type ?? ''} ${event?.subtype ?? ''} ${event?.positionOrEvent ?? ''}`.toLowerCase()
  const surface = String(event?.surface ?? '').toLowerCase()
  const modifiers = {
    aerobic: /distance|endurance|conditioning/.test(descriptor) ? 1 : 0,
    anaerobic: /sprint|power|max effort/.test(descriptor) ? 1 : 0,
    acceleration: /sprint|returner|wing|guard/.test(descriptor) ? 1 : 0,
    contact: /contact|scrimmage|tackle|wrestl/.test(descriptor) ? 1 : 0,
    cutting: /scrimmage|game|match|agility/.test(descriptor) ? 1 : 0,
    impact: /hard court|concrete|road/.test(surface) ? 1 : /pool|water/.test(surface) ? -1 : 0,
    jumping: /jump|volleyball|basketball/.test(descriptor) ? 1 : 0,
    upperBody: /pitch|throw|serve|swim|upper/.test(descriptor) ? 1 : 0,
    lowerBody: /run|sprint|jump|lower/.test(descriptor) ? 1 : 0,
  }
  const demands = Object.fromEntries(Object.entries(base).map(([key, value]) => [
    key,
    clampDemand(value + intensity + (modifiers[key] ?? 0) + (['aerobic', 'impact', 'lowerBody'].includes(key) ? durationAdjustment : 0)),
  ]))
  return { activityKey: sport, ...demands }
}

export function getDemandSummary(profile) {
  return Object.entries(profile ?? {})
    .filter(([key, value]) => key !== 'activityKey' && Number(value) >= 4)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 4)
    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase())
}
