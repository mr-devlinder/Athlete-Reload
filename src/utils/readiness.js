import { avoidRules } from '../data/appData'

export function getRecommendation(checkIn) {
  const risk =
    checkIn.soreness * 5 +
    checkIn.pain * 9 +
    checkIn.fatigue * 5 +
    Math.max(0, 8 - checkIn.sleep) * 7

  const score = Math.max(8, Math.min(98, 100 - risk))
  const hasRedFlag = checkIn.pain >= 8 || checkIn.painType === 'Sharp / stabbing'
  const isGameDay = checkIn.session === 'Game day'

  if (hasRedFlag) {
    return {
      score,
      label: 'Seek adult / medical help',
      tone: 'danger',
      intensity: 'Stop and assess',
      summary:
        'Sharp or high pain needs an adult, athletic trainer, or medical professional before activity.',
      avoid: ['No contact', 'No sprinting', 'Do not push through pain'],
      focus: ['Report symptoms clearly', 'Protect the area', 'Monitor swelling or limping'],
    }
  }

  if (score < 45) {
    return {
      score,
      label: 'Rest and monitor',
      tone: 'warning',
      intensity: 'Recovery day',
      summary:
        'Training today should help you recover, not prove toughness. Keep movement light.',
      avoid: ['No max speed', 'No contact', 'No heavy lower-body load'],
      focus: ['Mobility circuit', 'Easy bike or walk', 'Coach check-in'],
    }
  }

  if (score < 70) {
    return {
      score,
      label: isGameDay ? 'No contact / limited role' : 'Modified training',
      tone: 'caution',
      intensity: '60-70% load',
      summary:
        'You can stay involved, but remove the parts most likely to flare the issue.',
      avoid: avoidRules[checkIn.location] ?? avoidRules.None,
      focus: ['Long warm-up', 'Quality reps', 'Stop if pain climbs'],
    }
  }

  return {
    score,
    label: 'Full training',
    tone: 'ready',
    intensity: 'Normal load',
    summary:
      'You look ready to train. Keep the warm-up honest and log how you feel afterward.',
    avoid: ['No special limits'],
    focus: ['Full session', 'Normal contact', 'Post-practice notes'],
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
