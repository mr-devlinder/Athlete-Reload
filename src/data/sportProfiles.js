const genericProfile = {
  positions: [],
  competitionLabel: 'Competition',
  defaultCompetitionMinutes: 60,
  eventTypes: ['Competition', 'Team training', 'Individual training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
  surfaces: ['Indoor', 'Outdoor', 'Gym', 'Other'],
  workloadFields: [],
}

const numberField = (key, label, phases, unit, options = {}) => ({ key, label, phases, type: 'number', unit, ...options })
const selectField = (key, label, phases, options, conditions = {}) => ({ key, label, phases, type: 'select', options, ...conditions })

export const sportProfiles = {
  Baseball: {
    positions: ['Pitcher', 'Catcher', 'First baseman', 'Second baseman', 'Third baseman', 'Shortstop', 'Left fielder', 'Center fielder', 'Right fielder'],
    competitionLabel: 'Game',
    defaultCompetitionMinutes: 180,
    eventTypes: ['Game', 'Team practice', 'Bullpen', 'Batting practice', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Grass', 'Artificial turf', 'Dirt / clay', 'Indoor facility', 'Gym'],
    workloadFields: [
      numberField('plannedPitchCount', 'Planned pitch count', ['event'], 'pitches', { positions: ['Pitcher'], eventTypes: ['Game', 'Team practice', 'Bullpen'] }),
      numberField('pitchCount', 'Actual pitch count', ['checkout'], 'pitches', { positions: ['Pitcher'], eventTypes: ['Game', 'Team practice', 'Bullpen'] }),
      numberField('throwingVolume', 'Throwing volume', ['checkout'], 'throws', { eventTypes: ['Game', 'Team practice', 'Bullpen'] }),
    ],
  },
  Basketball: {
    positions: ['Point guard', 'Shooting guard', 'Small forward', 'Power forward', 'Center'],
    competitionLabel: 'Game',
    defaultCompetitionMinutes: 40,
    eventTypes: ['Game', 'Team practice', 'Individual workout', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Hardwood court', 'Synthetic court', 'Outdoor court', 'Gym'],
    workloadFields: [
      selectField('jumpingExposure', 'Jumping exposure', ['event', 'checkout'], ['Low', 'Moderate', 'High'], { eventTypes: ['Game', 'Team practice', 'Individual workout'] }),
      selectField('cuttingExposure', 'Cutting exposure', ['checkout'], ['Low', 'Moderate', 'High'], { eventTypes: ['Game', 'Team practice'] }),
    ],
  },
  Football: {
    positions: ['Quarterback', 'Running back', 'Wide receiver', 'Tight end', 'Offensive line', 'Defensive line', 'Linebacker', 'Cornerback', 'Safety', 'Kicker / punter'],
    competitionLabel: 'Game',
    defaultCompetitionMinutes: 60,
    eventTypes: ['Game', 'Team practice', 'Walkthrough', 'Position work', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Natural grass', 'Artificial turf', 'Indoor field', 'Gym'],
    workloadFields: [selectField('contactLevel', 'Contact level', ['event', 'checkout'], ['None', 'Limited', 'Controlled', 'Full'], { eventTypes: ['Game', 'Team practice', 'Position work'] })],
  },
  Golf: {
    positions: ['Player'],
    competitionLabel: 'Round',
    defaultCompetitionMinutes: 240,
    eventTypes: ['Round', 'Range session', 'Short game practice', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Course', 'Driving range', 'Indoor simulator', 'Gym'],
    workloadFields: [numberField('holesPlayed', 'Holes played', ['checkout'], 'holes', { eventTypes: ['Round'] })],
  },
  'General fitness': {
    positions: ['General training'],
    competitionLabel: 'Session',
    defaultCompetitionMinutes: 60,
    eventTypes: ['Workout', 'Cardio', 'Class', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Gym', 'Indoor', 'Outdoor', 'Home'],
    workloadFields: [],
  },
  'Track and field': {
    positions: ['Sprints', 'Middle distance', 'Distance', 'Hurdles', 'Jumps', 'Throws', 'Multi-events'],
    competitionLabel: 'Meet',
    defaultCompetitionMinutes: 120,
    eventTypes: ['Meet', 'Track practice', 'Field practice', 'Road session', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Track', 'Grass', 'Road', 'Trail', 'Indoor track', 'Gym'],
    workloadFields: [
      numberField('plannedDistance', 'Planned distance', ['event'], 'miles', { positions: ['Middle distance', 'Distance'], eventTypes: ['Track practice', 'Road session'] }),
      numberField('actualDistance', 'Actual distance', ['checkout'], 'miles', { positions: ['Middle distance', 'Distance'], eventTypes: ['Track practice', 'Road session', 'Meet'] }),
      numberField('jumpCount', 'Jumping exposure', ['checkout'], 'jumps', { positions: ['Jumps', 'Multi-events'] }),
      numberField('throwCount', 'Throwing exposure', ['checkout'], 'throws', { positions: ['Throws', 'Multi-events'] }),
      numberField('sprintReps', 'Sprint reps', ['checkout'], 'reps', { positions: ['Sprints', 'Hurdles', 'Multi-events'] }),
    ],
  },
  'Weight training': {
    positions: ['Upper body', 'Lower body', 'Full body', 'Powerlifting', 'Olympic lifting'],
    competitionLabel: 'Meet',
    defaultCompetitionMinutes: 120,
    eventTypes: ['Strength session', 'Meet', 'Technique session', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Gym', 'Home gym', 'Competition platform'],
    workloadFields: [numberField('workingSets', 'Working sets', ['checkout'], 'sets', { eventTypes: ['Strength session', 'Meet', 'Technique session'] })],
  },
  Running: {
    positions: ['Road', 'Trail', 'Cross country', 'Marathon', 'Sprint training'],
    competitionLabel: 'Race',
    defaultCompetitionMinutes: 60,
    eventTypes: ['Race', 'Easy run', 'Long run', 'Speed session', 'Tempo run', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Road', 'Track', 'Trail', 'Grass', 'Treadmill'],
    workloadFields: [
      numberField('plannedDistance', 'Planned distance', ['event'], 'miles', { eventTypes: ['Race', 'Easy run', 'Long run', 'Speed session', 'Tempo run'] }),
      numberField('actualDistance', 'Actual distance', ['checkout'], 'miles', { eventTypes: ['Race', 'Easy run', 'Long run', 'Speed session', 'Tempo run'] }),
    ],
  },
  Soccer: {
    positions: ['Striker', 'Winger', 'Attacking midfielder', 'Central midfielder', 'Defensive midfielder', 'Outside back', 'Center back', 'Goalkeeper'],
    competitionLabel: 'Match',
    defaultCompetitionMinutes: 90,
    eventTypes: ['Match', 'Team training', 'Individual training', 'Gym session', 'Conditioning', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Natural grass', 'Artificial turf', 'Indoor turf', 'Gym'],
    workloadFields: [selectField('sprintExposure', 'Sprint exposure', ['event', 'checkout'], ['Low', 'Moderate', 'High'], { eventTypes: ['Match', 'Team training', 'Individual training'] })],
  },
  Swimming: {
    positions: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual medley', 'Distance'],
    competitionLabel: 'Meet',
    defaultCompetitionMinutes: 120,
    eventTypes: ['Meet', 'Pool practice', 'Open-water session', 'Dryland training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['25-yard pool', '25-meter pool', '50-meter pool', 'Open water', 'Gym'],
    workloadFields: [
      numberField('plannedYardage', 'Planned yardage', ['event'], 'yards', { eventTypes: ['Pool practice'] }),
      numberField('actualYardage', 'Actual yardage', ['checkout'], 'yards', { eventTypes: ['Pool practice', 'Meet'] }),
      selectField('shoulderLoad', 'Shoulder load', ['checkout'], ['Low', 'Moderate', 'High'], { eventTypes: ['Pool practice', 'Meet', 'Open-water session'] }),
    ],
  },
  Volleyball: {
    positions: ['Setter', 'Outside hitter', 'Opposite hitter', 'Middle blocker', 'Libero / defensive specialist'],
    competitionLabel: 'Match',
    defaultCompetitionMinutes: 90,
    eventTypes: ['Match', 'Team practice', 'Individual training', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Indoor court', 'Sand', 'Outdoor court', 'Gym'],
    workloadFields: [
      numberField('setsPlayed', 'Sets played', ['checkout'], 'sets', { eventTypes: ['Match'] }),
      selectField('jumpingExposure', 'Jumping exposure', ['event', 'checkout'], ['Low', 'Moderate', 'High'], { positions: ['Setter', 'Outside hitter', 'Opposite hitter', 'Middle blocker'], eventTypes: ['Match', 'Team practice'] }),
    ],
  },
  Wrestling: {
    positions: ['Wrestler'],
    competitionLabel: 'Bout',
    defaultCompetitionMinutes: 10,
    eventTypes: ['Bout', 'Tournament', 'Mat practice', 'Conditioning', 'Strength training', 'Other activity', 'Recovery', 'Recovery Day', 'Rest Day'],
    surfaces: ['Wrestling mat', 'Gym'],
    workloadFields: [numberField('boutCount', 'Bouts completed', ['checkout'], 'bouts', { eventTypes: ['Bout', 'Tournament'] })],
  },
}

export const sportOptions = [...Object.keys(sportProfiles), 'Other']

export function getSportProfile(sport) {
  return sportProfiles[sport] ?? genericProfile
}

export function getPositionOptions(sport) {
  return getSportProfile(sport).positions
}

export function getSportEventTypes(sport) {
  return getSportProfile(sport).eventTypes
}

export function getSportSurfaces(sport) {
  return getSportProfile(sport).surfaces
}

export function getCompetitionLabel(sport) {
  return getSportProfile(sport).competitionLabel
}

export function getDefaultCompetitionMinutes(sport) {
  return getSportProfile(sport).defaultCompetitionMinutes
}

export function getSportWorkloadFields(sport, { phase, position, eventType } = {}) {
  return getSportProfile(sport).workloadFields.filter((field) => {
    if (phase && !field.phases.includes(phase)) return false
    if (field.positions && !field.positions.includes(position)) return false
    if (field.eventTypes && !field.eventTypes.includes(eventType)) return false
    return true
  })
}

export function getSportContext({ athleteProfile, event, workload = {} } = {}) {
  const isOtherActivity = event?.type === 'Other activity'
  const sport = isOtherActivity ? 'None (sport-neutral activity)' : athleteProfile?.sport || 'Other'
  const position = isOtherActivity ? '' : athleteProfile?.position || ''
  const eventType = event?.type || event?.title || ''
  const relevantFields = isOtherActivity ? [] : getSportWorkloadFields(sport, { position, eventType })
  const relevantWorkload = Object.fromEntries(relevantFields
    .map((field) => [field.key, workload[field.key] ?? event?.sportWorkload?.[field.key]])
    .filter(([, value]) => value !== undefined && value !== ''))

  return {
    sport,
    position,
    competitionLabel: getCompetitionLabel(sport),
    eventType,
    surface: event?.surface,
    activityName: isOtherActivity ? event?.customActivityName || event?.title : undefined,
    durationMinutes: Number(workload.actualMinutes ?? event?.plannedMinutes ?? event?.expectedDuration ?? 0) || undefined,
    plannedLoad: event?.load,
    sessionRpe: Number(workload.difficulty ?? 0) || undefined,
    workload: relevantWorkload,
  }
}
