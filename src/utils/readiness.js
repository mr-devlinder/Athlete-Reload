import { createStructuredRecommendation } from '../domain/contracts'
import { evaluateSafety, hasStopFinding } from '../domain/safety'

const statusLevels = [
  { max: 40, label: 'Stop and Check In', intensity: 'No training' },
  { max: 55, label: 'Rehab / Mobility', intensity: 'Very light' },
  { max: 70, label: 'Modified Training', intensity: '50-70% load' },
  { max: 84, label: 'Controlled Training', intensity: '75-85% load' },
  { max: 101, label: 'Full Training', intensity: 'Normal load' },
]

const trainingProfiles = {
  'Rest day': {
    action: 'Keep this as a true recovery day. Use easy movement only if it makes you feel better.',
    avoid: ['Extra conditioning', 'Testing the painful movement'],
    focus: ['Sleep', 'Hydration', 'Gentle mobility'],
  },
  'Recovery day': {
    action: 'Use the session to restore range and leave feeling better than when you started.',
    avoid: ['Hard intervals', 'Heavy loading', 'Pushing through symptoms'],
    focus: ['Mobility flow', 'Light bike or walk', 'Breathing and reset work'],
  },
  'Optional training': {
    action: 'Treat this as optional volume. If symptoms show up, replace the workout with light skill work.',
    avoid: ['Bonus high-intensity work', 'Max effort sets', 'Extra conditioning'],
    focus: ['Technique quality', 'Short session', 'Stop while symptoms are quiet'],
  },
  'Team practice': {
    action: 'Attend practice, but choose your intensity based on the warm-up and the first few reps.',
    avoid: ['Unneeded extra reps', 'Competitive contact if symptoms rise'],
    focus: ['Technical work', 'Controlled reps', 'Coach communication'],
  },
  'Game day': {
    action: 'Warm up honestly and decide based on whether symptoms stay stable at game speed.',
    avoid: ['Ignoring symptoms to stay in', 'Max effort before warm-up is complete'],
    focus: ['Progressive warm-up', 'Clear stop point', 'Tell coach early'],
  },
  'Gym session': {
    action: 'Lift with exercise selection first. Keep the session productive without chasing painful ranges.',
    avoid: ['Painful lifts', 'Max attempts', 'Grinding reps'],
    focus: ['Pain-free ranges', 'Controlled tempo', 'Substitute smartly'],
  },
  Conditioning: {
    action: 'Conditioning should match today’s tissue tolerance, not the planned intensity on paper.',
    avoid: ['All-out intervals', 'Repeated max-speed reps'],
    focus: ['Steady pace', 'Longer warm-up', 'Stop if mechanics change'],
  },
  Tournament: {
    action: 'Manage the day in blocks. Save high effort for important moments and reassess between games.',
    avoid: ['Skipping cooldowns', 'Playing through worsening pain'],
    focus: ['Between-game recovery', 'Short warm-ups', 'Hydration and food'],
  },
}

const locationRules = {
  Hamstring: {
    avoid: ['Max sprinting', 'Long stride accelerations', 'Heavy hip-hinge loading if it bites'],
    focus: ['Shorter stride buildup', 'Glute activation', 'Pain-free hamstring range'],
    gym: ['Heavy RDLs if symptoms appear', 'Explosive hip hinges', 'Deep loaded stretching'],
    contact: ['Chasing full-speed runs early', 'Repeated breakaway sprints'],
  },
  Quad: {
    avoid: ['Heavy knee-dominant loading', 'Repeated jumping', 'Hard deceleration volume'],
    focus: ['Controlled knee bends', 'Gradual quad warm-up', 'Smooth landing mechanics'],
    gym: ['Heavy squats if pain shows up', 'Deep painful lunges', 'High-volume leg extensions'],
    contact: ['Repeated hard stops', 'Explosive jumping battles'],
  },
  Calf: {
    avoid: ['Repeated sprint starts', 'Plyometric volume', 'Hard hill work'],
    focus: ['Progressive calf raises', 'Easy buildup runs', 'Ankle stiffness check'],
    gym: ['Heavy calf work early', 'Loaded jumping', 'Pushing off through sharp pain'],
    contact: ['Repeated first-step bursts', 'Long toe-off sprints'],
  },
  Ankle: {
    avoid: ['Sharp cuts', 'Uneven surfaces', 'Jump landings without control'],
    focus: ['Balance work', 'Stable footwear or brace if used', 'Linear movement first'],
    gym: ['Unstable loaded work', 'Painful single-leg jumps', 'Heavy lateral lunges'],
    contact: ['Contact landings', 'Unplanned direction changes'],
  },
  Knee: {
    avoid: ['Hard cutting', 'Deep painful knee angles', 'Jump volume'],
    focus: ['Linear drills', 'Controlled landings', 'Hip and quad activation'],
    gym: ['Painful deep squats', 'Heavy lunges', 'Jump squats'],
    contact: ['Twisting under contact', 'Repeated hard decels'],
  },
  Hip: {
    avoid: ['Hard cutting', 'Deep loaded hip ranges', 'High-knee sprint volume'],
    focus: ['Hip mobility', 'Glute activation', 'Short controlled accelerations'],
    gym: ['Painful deep squats', 'Heavy lateral work', 'Loaded end-range positions'],
    contact: ['Wide cutting angles', 'Awkward contact positions'],
  },
  Back: {
    avoid: ['Heavy spinal loading', 'Twisting volume', 'Grinding reps'],
    focus: ['Bracing quality', 'Neutral spine positions', 'Lower-load alternatives'],
    gym: ['Heavy axial loading', 'Deadlift maxes', 'Loaded rotation'],
    contact: ['Twisting under pressure', 'Contact while extended'],
  },
  Shoulder: {
    avoid: ['Painful shoulder ranges', 'Heavy overhead work', 'Forcing end range'],
    focus: ['Scapular control', 'Pain-free pressing angle', 'Controlled pulling'],
    gym: ['Heavy overhead pressing', 'Deep painful bench range', 'Kipping or jerky reps'],
    contact: ['Contact through the shoulder', 'Falling or bracing on that arm'],
  },
  Neck: {
    avoid: ['Headers', 'Contact', 'Heavy axial loading'],
    focus: ['Tell an adult or trainer', 'Gentle range only', 'Monitor symptoms'],
    gym: ['Heavy shrugs', 'Axial loading', 'Valsalva-heavy maxes'],
    contact: ['Headers', 'Any head or neck contact'],
  },
  Head: {
    avoid: ['Training', 'Contact', 'Conditioning through symptoms'],
    focus: ['Tell an adult or trainer now', 'Monitor symptoms', 'Follow return-to-play guidance'],
    gym: ['Lifting', 'Conditioning', 'Anything that worsens symptoms'],
    contact: ['All contact', 'Headers', 'Game-speed play'],
  },
}

const painTypeRules = {
  'Tight / pulling': {
    avoid: ['Explosive first reps', 'End-range stretching under load'],
    focus: ['Longer warm-up', 'Gradual speed build', 'Stop if tightness becomes pain'],
  },
  'Dull ache': {
    avoid: ['High-volume pounding', 'Chasing personal records'],
    focus: ['Easy first set', 'Check symptoms between blocks', 'Keep movement smooth'],
  },
  'Sharp / stabbing': {
    avoid: ['Recreating the sharp pain', 'Fast reps through that pattern'],
    focus: ['Find a pain-free angle', 'Slow tempo', 'Stop if sharpness rises'],
  },
  Burning: {
    avoid: ['Pushing through burning symptoms', 'Heavy repeated sets through the area'],
    focus: ['Slow buildup', 'Check symptoms each block', 'Stop if burning spreads'],
  },
  Throbbing: {
    avoid: ['High-impact volume', 'Tight wrapping without guidance'],
    focus: ['Lower intensity first', 'Monitor swelling or heat', 'Reassess after warm-up'],
  },
  Pinching: {
    avoid: ['Forcing the pinching range', 'Deep loaded positions'],
    focus: ['Shorten the range', 'Use cleaner positions', 'Switch if pinching repeats'],
  },
  Pressure: {
    avoid: ['Compressing the painful area', 'Grinding through pressure'],
    focus: ['Easy ramp-up', 'Check gear fit', 'Keep reps controlled'],
  },
  Cramping: {
    avoid: ['Repeated max effort bursts', 'Training dehydrated'],
    focus: ['Progressive warm-up', 'Fluids and sodium if appropriate', 'Stop if cramping returns'],
  },
  Shooting: {
    avoid: ['Training through shooting pain', 'Heavy loading that sends pain away from the area'],
    focus: ['Stop the trigger', 'Tell an adult or trainer', 'Use only pain-free movement'],
  },
  Tingling: {
    avoid: ['Training through tingling', 'Heavy loading', 'Contact'],
    focus: ['Stop and tell an adult', 'Track where symptoms travel', 'Get medical guidance'],
  },
  Swelling: {
    avoid: ['Loading through swelling', 'Tight gear over the area'],
    focus: ['Reduce volume', 'Elevate after training', 'Check with an adult if swelling grows'],
  },
  Instability: {
    avoid: ['Unplanned direction changes', 'Single-leg max effort', 'Contact situations'],
    focus: ['Stable surfaces', 'Controlled balance work', 'Brace/support if prescribed'],
  },
  Numbness: {
    avoid: ['Training through numbness', 'Heavy loading', 'Contact'],
    focus: ['Stop and tell an adult', 'Track symptoms', 'Get medical guidance'],
  },
  'Headache / dizziness': {
    avoid: ['Training', 'Screens if symptoms worsen', 'Contact'],
    focus: ['Tell an adult now', 'Rest', 'Follow concussion protocol if relevant'],
  },
  'No pain': {
    avoid: [],
    focus: ['Full warm-up', 'Normal training load', 'Post-session notes'],
  },
}

const movementRules = {
  'At rest': {
    avoid: ['Training through resting pain', 'Max effort testing'],
    focus: ['Treat this as higher priority', 'Tell coach or adult', 'Start with gentle movement only'],
  },
  Walking: {
    avoid: ['Running volume until walking is smooth', 'Ignoring a limp'],
    focus: ['Walk without compensation', 'Easy mobility', 'Reassess before higher speed'],
  },
  Jogging: {
    avoid: ['Conditioning volume that changes your stride'],
    focus: ['Short easy jog test', 'Keep stride smooth', 'Switch to bike if symptoms rise'],
  },
  Sprinting: {
    avoid: ['Max sprinting', 'Repeated accelerations', 'Long stride fly runs'],
    focus: ['Build speed gradually', 'Cap sprint volume', 'Stop if mechanics change'],
  },
  Acceleration: {
    avoid: ['Explosive starts', 'Long first-step reps', 'Resisted sprints'],
    focus: ['Submax build-ups', 'Shorter strides', 'Reassess after the first speed block'],
  },
  Deceleration: {
    avoid: ['Hard stops', 'Repeated braking drills', 'Fatigue-based change of direction'],
    focus: ['Controlled stops', 'Lower rep count', 'Smooth landing and braking mechanics'],
  },
  Cutting: {
    avoid: ['Hard cuts', 'Reactive agility', 'Defensive change-of-direction reps'],
    focus: ['Linear work first', 'Controlled angles', 'Slow-to-fast progression'],
  },
  Jumping: {
    avoid: ['Repeated jumps', 'Hard landings', 'Loaded plyometrics'],
    focus: ['Landing control', 'Low amplitude first', 'Stop if pain appears on takeoff or landing'],
  },
  Landing: {
    avoid: ['Hard landings', 'Crowded aerial challenges', 'High-volume plyometrics'],
    focus: ['Soft controlled landings', 'Lower jump volume', 'Reassess after first landing set'],
  },
  Kicking: {
    avoid: ['Max-power shots', 'Repeated long balls', 'Kicking through sharp pain'],
    focus: ['Short technical touches', 'Build power gradually', 'Stop if mechanics change'],
  },
  Throwing: {
    avoid: ['Max-distance throws', 'High-volume overhead work', 'Throwing through shoulder pain'],
    focus: ['Short throws first', 'Scapular warm-up', 'Track symptoms between sets'],
  },
  Lifting: {
    avoid: ['Max attempts', 'Painful loaded ranges', 'Grinding reps'],
    focus: ['Pain-free exercise swaps', 'Controlled tempo', 'Leave reps in reserve'],
  },
  Squatting: {
    avoid: ['Deep painful squats', 'Heavy knee-dominant loading', 'Loaded painful depth'],
    focus: ['Shorten depth', 'Slow tempo', 'Use alternatives that stay quiet'],
  },
  Twisting: {
    avoid: ['Loaded rotation', 'Reactive twisting under fatigue', 'Awkward contact positions'],
    focus: ['Brace first', 'Linear patterns', 'Rotate only through pain-free range'],
  },
  Contact: {
    avoid: ['Contact drills', 'Tackles or checks', 'Competing through pain'],
    focus: ['Technical no-contact work', 'Coach communication', 'Reassess after warm-up'],
  },
  Headers: {
    avoid: ['Headers', 'Aerial contact', 'Playing through head or neck symptoms'],
    focus: ['Tell coach before drills', 'No-contact technical work', 'Follow head-injury guidance'],
  },
  Stretching: {
    avoid: ['Aggressive stretching', 'Loaded end-range holds'],
    focus: ['Gentle range', 'Dynamic warm-up', 'Keep stretch below pain'],
  },
  Bending: {
    avoid: ['Loaded painful bending', 'Rounding into symptoms'],
    focus: ['Brace first', 'Shorten range', 'Use supported alternatives'],
  },
  Breathing: {
    avoid: ['Training through breathing pain', 'Contact', 'Hard conditioning'],
    focus: ['Stop and tell an adult', 'Monitor symptoms', 'Get medical guidance'],
  },
  'After activity': {
    avoid: ['Stacking extra volume', 'Skipping cooldown', 'Ignoring delayed symptom spikes'],
    focus: ['Limit total volume', 'Cooldown and notes', 'Watch symptoms later today'],
  },
}

const injuryTypeRules = {
  'Muscle strain': {
    avoid: ['Explosive loading early', 'End-range loaded stretching'],
    focus: ['Gradual warm-up', 'Pain-free strength range'],
  },
  'Ligament sprain': {
    avoid: ['Unstable positions', 'Twisting or contact before control is solid'],
    focus: ['Support and control', 'Linear movement first'],
  },
  'Tendon irritation': {
    avoid: ['Sudden load spikes', 'High-volume bouncing reps'],
    focus: ['Smooth tempo', 'Manage total reps'],
  },
  'Joint irritation': {
    avoid: ['Deep painful ranges', 'Forcing compression'],
    focus: ['Clean alignment', 'Comfortable range'],
  },
  'Impact bruise': {
    avoid: ['Direct contact on the area', 'Repeated impact'],
    focus: ['Protect the area', 'Check pain after warm-up'],
  },
  'Overuse soreness': {
    avoid: ['Extra volume', 'Turning a light session into conditioning'],
    focus: ['Technique quality', 'Recovery between blocks'],
  },
  Cramp: {
    avoid: ['Max bursts before symptoms settle', 'Training without fluids'],
    focus: ['Gradual intensity', 'Hydration check'],
  },
  'Bone stress': {
    avoid: ['Impact loading', 'Running through focal bone pain'],
    focus: ['Tell an adult or trainer', 'Use non-impact work only'],
  },
  'Cut / scrape': {
    avoid: ['Contact that reopens it', 'Dirty equipment on the area'],
    focus: ['Cover it properly', 'Watch for irritation'],
  },
  Blister: {
    avoid: ['Friction-heavy volume', 'Wet socks or poorly fitting shoes'],
    focus: ['Protect the spot', 'Change footwear setup if needed'],
  },
  Swelling: {
    avoid: ['Loading through swelling', 'Tight gear over the area'],
    focus: ['Reduce volume', 'Check if swelling grows'],
  },
  'Concussion concern': {
    avoid: ['Training', 'Contact', 'Headers'],
    focus: ['Tell an adult now', 'Follow return-to-play guidance'],
  },
  Unknown: {
    avoid: ['Testing the painful movement at max effort'],
    focus: ['Start controlled', 'Track what triggers it'],
  },
}

function unique(items) {
  return [...new Set(items)].filter(Boolean).slice(0, 4)
}

function riskFromChoice(value, weights) {
  return weights[value] ?? 0
}

function getStatus(score) {
  return statusLevels.find((level) => score < level.max) ?? statusLevels[statusLevels.length - 1]
}

function getPain(checkIn) {
  return checkIn.pain
}

function getSeverity(pain) {
  if (pain === 0) return 'none'
  if (pain <= 2) return 'low'
  if (pain <= 4) return 'moderate'
  if (pain <= 7) return 'high'
  return 'severe'
}

function isContactSession(session) {
  return ['Team practice', 'Game', 'Game day', 'Tournament'].includes(session)
}

function getReasons(checkIn) {
  const pain = getPain(checkIn)
  const reasons = []

  if (checkIn.sleep < 7) reasons.push('low sleep')
  if (Number(checkIn.energy) <= 2) reasons.push('low energy')
  if (Number(checkIn.soreness) >= 4) reasons.push('high soreness')
  if (Number(checkIn.fatigue) >= 4) reasons.push('high fatigue')
  if (Number(checkIn.stress) >= 4) reasons.push('high stress')
  if (Number(checkIn.illnessSymptoms) >= 3) reasons.push('illness symptoms')
  if (['Hard', 'Game'].includes(checkIn.yesterdayLoad)) {
    reasons.push(`a ${checkIn.yesterdayLoad.toLowerCase()} session yesterday`)
  }
  if (checkIn.hydration === 'Poor') reasons.push('poor hydration or nutrition')
  if (pain > 0) {
    reasons.push(`${checkIn.location.toLowerCase()} ${checkIn.painType.toLowerCase()} symptoms`)
  }

  return reasons
}

function hasRedFlag(checkIn) {
  const findings = evaluateSafety(checkIn)
  const pain = getPain(checkIn)
  return hasStopFinding(findings) ||
    (checkIn.painType === 'Shooting' && pain >= 3) ||
    (checkIn.painType === 'Instability' && pain >= 3) ||
    (checkIn.painType === 'Swelling' && pain >= 4) ||
    (checkIn.painType === 'Sharp / stabbing' && pain >= 5) ||
    (checkIn.hurtsWhen === 'At rest' && pain >= 4) ||
    (['Head', 'Neck'].includes(checkIn.location) && pain >= 2)
}

function getInjuryTypeRisk(checkIn, pain) {
  if (pain === 0) return 0

  return riskFromChoice(checkIn.injuryType, {
    'Muscle strain': pain <= 2 ? 3 : 6,
    'Ligament sprain': pain <= 2 ? 5 : 10,
    'Tendon irritation': pain <= 2 ? 4 : 8,
    'Joint irritation': pain <= 2 ? 4 : 9,
    'Impact bruise': pain <= 2 ? 2 : 5,
    'Potential Bone Bruise': pain <= 2 ? 2 : 5,
    'Overuse soreness': pain <= 2 ? 2 : 5,
    Cramp: pain <= 2 ? 2 : 5,
    'Bone stress': 20,
    'Cut / scrape': pain <= 2 ? 1 : 4,
    Blister: pain <= 2 ? 1 : 4,
    Swelling: pain <= 2 ? 5 : 12,
    'Concussion concern': 24,
    Unknown: pain <= 2 ? 3 : 6,
  })
}

function getPainTypeRisk(checkIn, pain) {
  if (pain === 0) return 0

  return riskFromChoice(checkIn.painType, {
    'No pain': 0,
    'Tight / pulling': pain <= 2 ? 2 : 5,
    'Dull ache': pain <= 2 ? 2 : 5,
    'Sharp / stabbing': pain <= 2 ? 4 : 10,
    Burning: pain <= 2 ? 4 : 8,
    Throbbing: pain <= 2 ? 4 : 8,
    Pinching: pain <= 2 ? 4 : 8,
    Pressure: pain <= 2 ? 3 : 6,
    Cramping: pain <= 2 ? 2 : 6,
    Shooting: pain <= 2 ? 8 : 14,
    Tingling: 18,
    Swelling: pain <= 2 ? 5 : 12,
    Instability: pain <= 2 ? 8 : 16,
    Numbness: 18,
    'Headache / dizziness': 18,
  })
}

function getMovementRisk(checkIn, pain) {
  if (pain === 0) return 0

  return riskFromChoice(checkIn.hurtsWhen, {
    'At rest': 12,
    Walking: 6,
    Jogging: 4,
    Sprinting: 7,
    Acceleration: 7,
    Deceleration: 8,
    Cutting: 8,
    Jumping: 8,
    Landing: 8,
    Kicking: 7,
    Throwing: 6,
    Lifting: 6,
    Squatting: 6,
    Twisting: 8,
    Contact: 7,
    Headers: 14,
    Stretching: 4,
    Bending: 4,
    Breathing: 18,
    'After activity': 5,
  })
}

function getSessionRisk(checkIn, pain) {
  if (pain === 0) return 0

  return riskFromChoice(checkIn.session, {
    'Rest day': -4,
    'Recovery day': -2,
    'Optional training': 0,
    'Team practice': 4,
    'Game day': 8,
    'Gym session': 2,
    Conditioning: ['Hamstring', 'Calf', 'Knee', 'Ankle'].includes(checkIn.location) ? 7 : 3,
    Tournament: 9,
  })
}

function getContextualAvoid(checkIn, redFlag) {
  const pain = getPain(checkIn)
  const location = locationRules[checkIn.location]
  const painType = painTypeRules[checkIn.painType] ?? painTypeRules['No pain']
  const injuryType = injuryTypeRules[checkIn.injuryType] ?? injuryTypeRules.Unknown
  const movement = movementRules[checkIn.hurtsWhen] ?? { avoid: [], focus: [] }
  const training = trainingProfiles[checkIn.session] ?? trainingProfiles['Team practice']

  if (redFlag) {
    return unique([
      'Do not test max effort',
      ...painType.avoid,
      ...injuryType.avoid,
      ...(location?.avoid ?? []),
      ...training.avoid,
    ])
  }

  if (pain === 0) {
    return []
  }

  const sessionSpecific =
    checkIn.session === 'Gym session'
      ? location?.gym
      : isContactSession(checkIn.session)
        ? location?.contact
        : location?.avoid

  return unique([
    ...(sessionSpecific ?? []),
    ...injuryType.avoid,
    ...painType.avoid,
    ...movement.avoid,
  ])
}

function getContextualFocus(checkIn, status, redFlag) {
  const pain = getPain(checkIn)
  const location = locationRules[checkIn.location]
  const painType = painTypeRules[checkIn.painType] ?? painTypeRules['No pain']
  const injuryType = injuryTypeRules[checkIn.injuryType] ?? injuryTypeRules.Unknown
  const movement = movementRules[checkIn.hurtsWhen] ?? { avoid: [], focus: [] }
  const training = trainingProfiles[checkIn.session] ?? trainingProfiles['Team practice']

  if (redFlag || status.label === 'Stop and Check In') {
    return unique(['Tell an adult or trainer', ...injuryType.focus, ...painType.focus, ...(location?.focus ?? [])])
  }

  if (pain === 0) {
    return unique(['Full warm-up', ...training.focus])
  }

  return unique([
    ...training.focus,
    ...(location?.focus ?? []),
    ...injuryType.focus,
    ...painType.focus,
    ...movement.focus,
  ])
}

function getPersonalAction(checkIn, status, redFlag) {
  const pain = getPain(checkIn)
  const severity = getSeverity(pain)
  const training = trainingProfiles[checkIn.session] ?? trainingProfiles['Team practice']

  if (redFlag || status.label === 'Stop and Check In') {
    return `This combination needs an adult, coach, athletic trainer, or medical check before training: ${checkIn.location.toLowerCase()} ${checkIn.painType.toLowerCase()} symptoms during ${checkIn.hurtsWhen.toLowerCase()}.`
  }

  if (pain === 0) {
    return training.action
  }

  if (checkIn.session === 'Gym session') {
    return `Lift today, but build the workout around your ${severity} ${checkIn.location.toLowerCase()} symptoms. Keep exercises pain-free, avoid the trigger (${checkIn.hurtsWhen.toLowerCase()}), and swap lifts before forcing a rep.`
  }

  if (isContactSession(checkIn.session)) {
    return `Join the session with boundaries. Your ${severity} ${checkIn.location.toLowerCase()} pain shows up with ${checkIn.hurtsWhen.toLowerCase()}, so keep the useful technical work and limit the drills most likely to recreate it.`
  }

  return `Train with a modification. Your ${severity} ${checkIn.location.toLowerCase()} symptoms are tied to ${checkIn.hurtsWhen.toLowerCase()}, so keep work controlled and stop if the pain climbs.`
}

function getSummary(checkIn, status, reasons) {
  const training = trainingProfiles[checkIn.session] ?? trainingProfiles['Team practice']

  if (status.label === 'Stop and Check In') {
    return `Pause the planned session until someone checks this. The decision is based on ${reasons.join(', ')}.`
  }

  return `${training.action} This is based on ${reasons.length ? reasons.join(', ') : 'a clean check-in'}.`
}

export function getRecommendation(checkIn) {
  const pain = getPain(checkIn)
  const breakdown = [
    { label: 'Energy', value: -Math.max(0, 5 - checkIn.energy) * 5 },
    { label: 'Sleep', value: -Math.max(0, 8 - checkIn.sleep) * 6 },
    { label: 'Sleep quality', value: -Math.max(0, 5 - Number(checkIn.sleepQuality ?? 5)) * 4 },
    { label: 'Fatigue', value: -Math.max(0, checkIn.fatigue - 1) * 5 },
    { label: 'Soreness', value: -Math.max(0, checkIn.soreness - 1) * 5 },
    { label: 'Leg heaviness', value: -Math.max(0, (checkIn.legHeaviness ?? 1) - 1) * 4 },
    { label: 'Pain level', value: -pain * 8 },
    { label: 'Injury type', value: -getInjuryTypeRisk(checkIn, pain) },
    { label: 'Pain type', value: -getPainTypeRisk(checkIn, pain) },
    { label: 'Trigger', value: -getMovementRisk(checkIn, pain) },
    { label: 'Scheduled session', value: -getSessionRisk(checkIn, pain) },
    {
      label: 'Stress',
      value: -Math.max(0, Number(checkIn.stress ?? 0)) * 2.4,
    },
    {
      label: 'Illness',
      value: -Math.max(0, Number(checkIn.illnessSymptoms ?? 0)) * 4,
    },
    {
      label: 'Yesterday',
      value: -riskFromChoice(checkIn.yesterdayLoad, {
      Rest: 0,
      Light: 3,
      Moderate: 7,
      Hard: 13,
      Game: 16,
      }),
    },
    {
      label: 'Hydration',
      value: -riskFromChoice(checkIn.hydration, { Good: 0, Okay: 4, Poor: 10 }),
    },
  ].filter((item) => item.value !== 0)
  const adjustment = breakdown.reduce((total, item) => total + item.value, 0)
  const rawScore = Math.max(6, Math.min(98, 100 + adjustment))
  const redFlag = hasRedFlag(checkIn)
  // Pain may only preserve or lower readiness. Floors here previously allowed
  // pain to raise an otherwise poor score.
  const score = rawScore
  const status = redFlag
    ? { label: 'Stop and Check In', intensity: 'No training' }
    : getStatus(score)
  const reasons = getReasons(checkIn)
  const avoid = getContextualAvoid(checkIn, redFlag)
  const focus = getContextualFocus(checkIn, status, redFlag)

  return createStructuredRecommendation({
    score,
    label: status.label,
    tone:
      redFlag || status.label === 'Stop and Check In'
        ? 'danger'
        : score < 50
          ? 'danger'
          : score < 75
            ? 'caution'
            : 'ready',
    intensity: status.intensity,
    summary: getSummary(checkIn, status, reasons),
    avoid,
    focus,
    reasons,
    action: getPersonalAction(checkIn, status, redFlag),
    breakdown: breakdown.length ? breakdown : [{ label: 'Clean check-in', value: 0 }],
    coachMessage: `Coach, I am at ${score}/100 readiness today. I can do ${checkIn.session.toLowerCase()}, but I need to manage ${avoid.slice(0, 2).join(' and ').toLowerCase() || 'my load'} if symptoms increase.`,
    reportSections: [
      { id: 'readiness-status', title: status.label, summary: getSummary(checkIn, status, reasons), items: [`Planned intensity: ${status.intensity}`] },
      { id: 'warm-up-focus', title: 'What to do', summary: getPersonalAction(checkIn, status, redFlag), items: focus },
      ...(avoid.length ? [{ id: 'pain-guidance', title: 'What to watch', summary: 'Use these limits while you prepare and participate.', items: avoid }] : []),
      { id: 'event-preparation', title: 'Why this plan', summary: reasons.length ? `The strongest signals are ${reasons.join(', ')}.` : 'Your current check-in does not show a meaningful limitation.', items: [] },
    ],
    contextFactors: reasons,
    redFlag,
  }, {
    answeredInputs: ['energy', 'sleep', 'sleepQuality', 'fatigue', 'soreness', 'stress', 'illnessSymptoms', 'pain']
      .filter((key) => checkIn[key] !== undefined && checkIn[key] !== null && checkIn[key] !== '').length,
    baselineSampleSize: Number(checkIn.baselineSampleSize ?? 0),
  })
}

export function getTrendInsights(history) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const recentHistory = history.filter((item) => {
    if (!item.date) return false
    return new Date(`${item.date}T12:00:00`) >= sevenDaysAgo
  })

  if (recentHistory.length === 0) {
    return ['No check-ins saved in the last 7 days.']
  }

  const averageScore = Math.round(
    recentHistory.reduce((total, item) => total + item.score, 0) / recentHistory.length,
  )

  return [`Average readiness is ${averageScore} across the last 7 days.`]
}
