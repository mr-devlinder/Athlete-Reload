import { avoidRules } from '../data/appData'

const scheduleCopy = {
  'Rest day':
    'Keep the day recovery-focused. Prioritize sleep, hydration, mobility, and light movement.',
  'Recovery day':
    'Keep the session easy. Mobility, stretching, light bike, and controlled movement fit today.',
  'Optional training':
    'Skip the extra workout or replace it with light technical work if readiness is low.',
  'Team practice':
    'Attend practice, but reduce intensity where possible and avoid unnecessary extra conditioning.',
  'Game day':
    'Warm up carefully, monitor symptoms, and tell a coach or trainer if pain gets worse.',
  'Gym session':
    'Adjust load before you adjust effort. Avoid heavy work that stresses the painful area.',
  Conditioning:
    'Conditioning should be reduced or replaced if soreness or pain is elevated.',
  Tournament:
    'Treat this as a load-management day. Save high effort for the moments that matter.',
}

const statusLevels = [
  { max: 40, label: 'Do Not Participate', intensity: 'Stop and report' },
  { max: 55, label: 'Technical Only', intensity: 'Light skill work' },
  { max: 70, label: 'Modified Participation', intensity: '50-70% load' },
  { max: 84, label: 'Train With Caution', intensity: '75-85% load' },
  { max: 101, label: 'Full Training', intensity: 'Normal load' },
]

function riskFromChoice(value, weights) {
  return weights[value] ?? 0
}

function getStatus(score) {
  return statusLevels.find((level) => score < level.max) ?? statusLevels.at(-1)
}

function getReasons(checkIn) {
  const reasons = []

  if (checkIn.sleep < 7) reasons.push('low sleep')
  if (checkIn.energy <= 4) reasons.push('low energy')
  if (checkIn.soreness >= 6) reasons.push('high soreness')
  if (checkIn.fatigue >= 7) reasons.push('high fatigue')
  if (checkIn.stress === 'High') reasons.push('high stress')
  if (['Hard', 'Game'].includes(checkIn.yesterdayLoad)) {
    reasons.push(`a ${checkIn.yesterdayLoad.toLowerCase()} session yesterday`)
  }
  if (checkIn.hydration === 'Poor') reasons.push('poor hydration or nutrition')
  if (checkIn.pain > 0 && checkIn.location !== 'None') {
    reasons.push(`${checkIn.location.toLowerCase()} ${checkIn.painType.toLowerCase()}`)
  }

  return reasons
}

function hasRedFlag(checkIn) {
  return (
    checkIn.pain >= 8 ||
    ['Sharp / stabbing', 'Swelling', 'Instability', 'Numbness', 'Headache / dizziness'].includes(
      checkIn.painType,
    ) ||
    ['Head', 'Neck'].includes(checkIn.location) && checkIn.painType !== 'No pain'
  )
}

function getScheduleAdjustment(checkIn, status) {
  const session = checkIn.session
  const scheduleAdvice = scheduleCopy[session] ?? scheduleCopy['Team practice']

  if (status.label === 'Do Not Participate') {
    return 'Do not train today. Tell a coach, parent, or trainer before participating.'
  }

  if (session === 'Rest day' || session === 'Recovery day') {
    return scheduleAdvice
  }

  if (session === 'Optional training' && status.label !== 'Full Training') {
    return scheduleCopy['Optional training']
  }

  return scheduleAdvice
}

export function getRecommendation(checkIn) {
  const risk =
    checkIn.soreness * 4 +
    checkIn.pain * 8 +
    checkIn.fatigue * 4 +
    Math.max(0, 8 - checkIn.sleep) * 6 +
    Math.max(0, 8 - checkIn.energy) * 4 +
    riskFromChoice(checkIn.stress, { Low: 0, Medium: 5, High: 12 }) +
    riskFromChoice(checkIn.yesterdayLoad, {
      Rest: 0,
      Light: 3,
      Moderate: 7,
      Hard: 13,
      Game: 16,
    }) +
    riskFromChoice(checkIn.hydration, { Good: 0, Okay: 4, Poor: 10 })

  const score = Math.max(6, Math.min(98, 100 - risk))
  const redFlag = hasRedFlag(checkIn)
  const status = redFlag
    ? { label: 'Do Not Participate', intensity: 'Stop and report' }
    : getStatus(score)
  const reasons = getReasons(checkIn)
  const avoid = redFlag
    ? ['No contact', 'No sprinting', 'Do not push through symptoms']
    : avoidRules[checkIn.location] ?? avoidRules.None
  const scheduleAdjustment = getScheduleAdjustment(checkIn, status)
  const reasonText = reasons.length
    ? ` because of ${reasons.join(', ')}`
    : ' with no major recovery flags'

  return {
    score,
    label: status.label,
    tone: redFlag || status.label === 'Do Not Participate' ? 'danger' : score < 56 ? 'warning' : score < 84 ? 'caution' : 'ready',
    intensity: status.intensity,
    summary: `Your readiness is ${score}/100${reasonText}. ${scheduleAdjustment}`,
    avoid,
    focus:
      status.label === 'Full Training'
        ? ['Normal session', 'Honest warm-up', 'Post-training notes']
        : ['Longer warm-up', 'Controlled reps', 'Stop if symptoms climb'],
    reasons,
    coachMessage: `Coach, I am at ${score}/100 readiness today with ${checkIn.location.toLowerCase()} ${checkIn.painType.toLowerCase()}. I will show up for ${checkIn.session.toLowerCase()}, but I may need to limit ${avoid.slice(0, 2).join(' and ').toLowerCase()} if symptoms increase.`,
  }
}

export function getTrendInsights(history) {
  const hamstringDays = history.filter((item) => item.location === 'Hamstring')
  const highFatigueDays = history.filter((item) => item.fatigue >= 7)
  const averageScore = Math.round(
    history.reduce((total, item) => total + item.score, 0) / history.length,
  )

  return [
    `Average readiness is ${averageScore} across the last ${history.length} check-ins.`,
    `Hamstring pain appeared ${hamstringDays.length} times this week.`,
    highFatigueDays.length >= 2
      ? 'Fatigue is high after back-to-back practices.'
      : 'Fatigue has stayed mostly manageable.',
  ]
}
