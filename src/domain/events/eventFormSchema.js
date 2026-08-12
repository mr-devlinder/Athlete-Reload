const SUBTYPES = {
  competition: ['League', 'Tournament', 'Scrimmage', 'Qualifier', 'Final', 'Other'],
  gym: ['Full body', 'Upper body', 'Lower body', 'Power', 'Strength', 'Conditioning', 'Other'],
  run: ['Easy', 'Long run', 'Intervals', 'Tempo', 'Hills', 'Race', 'Other'],
  swimming: ['Technique', 'Aerobic', 'Intervals', 'Sprint', 'Open water', 'Meet', 'Other'],
  training: ['Skills', 'Tactical', 'Conditioning', 'Scrimmage', 'Team session', 'Individual session', 'Other'],
  recovery: ['Mobility', 'Easy aerobic', 'Flexibility', 'Treatment', 'Other'],
  general: ['Practice', 'Competition', 'Conditioning', 'Technique', 'Other'],
}

export function getEventFormSchema(event = {}, athleteProfile = {}) {
  const text = `${event.type ?? ''} ${event.customActivityName ?? ''}`.toLowerCase()
  const isAllDay = /rest day|recovery day/.test(text) || event.allDay === true
  const kind = classifyEvent(text)
  const profilePosition = String(athleteProfile.position ?? '').trim()
  const showPosition = !isAllDay && ['competition', 'training'].includes(kind) && Boolean(profilePosition || athleteProfile.sport)
  return {
    kind,
    isAllDay,
    showDuration: !isAllDay,
    showTime: !isAllDay,
    showSubtype: !isAllDay,
    subtypeOptions: SUBTYPES[kind] ?? SUBTYPES.general,
    showPosition,
    profilePosition,
    showSurface: !isAllDay && ['competition', 'run', 'training', 'general'].includes(kind),
    surfaceLabel: kind === 'run' ? 'Surface or terrain' : 'Surface',
    showOpponent: kind === 'competition' && /soccer|football|basketball|hockey|volleyball|rugby|lacrosse|game|match/.test(`${athleteProfile.sport ?? ''} ${text}`.toLowerCase()),
    showVenue: kind === 'competition',
    showWorkload: !isAllDay && kind !== 'recovery',
  }
}

function classifyEvent(text) {
  if (/rest|recovery|mobility|flexibility/.test(text)) return 'recovery'
  if (/gym|strength|lift|weights/.test(text)) return 'gym'
  if (/swim|pool/.test(text)) return 'swimming'
  if (/run|jog|cross country|track/.test(text)) return 'run'
  if (/game|match|meet|race|competition|tournament|bout/.test(text)) return 'competition'
  if (/practice|training|session|skills|team/.test(text)) return 'training'
  return 'general'
}
