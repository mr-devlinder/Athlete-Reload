export function getCheckoutQuestionSchema(event = {}, athleteProfile = {}) {
  const value = `${event.type ?? ''} ${event.title ?? ''} ${athleteProfile.sport ?? ''}`.toLowerCase()
  const kind = /rest|recovery|mobility|flexibility/.test(value) ? 'recovery'
    : /game|match|meet|race|competition|tournament|bout/.test(value) ? 'competition'
      : /gym|strength|lift|weight/.test(value) ? 'gym'
        : /run|jog|track|cross country/.test(value) ? 'run'
          : /swim/.test(value) ? 'swim'
            : 'training'
  const plannedMinutes = Number(event.plannedMinutes ?? event.expectedDuration) || 0
  return {
    kind,
    durationLabel: kind === 'competition' && /soccer|football|basketball|hockey|rugby|lacrosse/.test(value) ? 'Minutes played' : 'Actual duration',
    performanceLabel: kind === 'recovery' ? 'How did your body respond?' : 'Performance compared with normal',
    performanceOptions: kind === 'recovery' ? ['Worse', 'No change', 'A little better', 'Much better'] : ['Worse', 'Slightly worse', 'Normal', 'Better', 'Much better'],
    showRpe: kind !== 'recovery',
    showSessionContent: ['gym', 'training'].includes(kind),
    showHydration: plannedMinutes >= 60 || kind === 'competition',
    showFuel: plannedMinutes >= 75 || kind === 'competition',
    showWorkload: !['recovery'].includes(kind),
    contextLabel: ({ competition: 'Competition', gym: 'Gym session', run: 'Run', swim: 'Swim', recovery: 'Recovery session', training: 'Training' })[kind],
  }
}
