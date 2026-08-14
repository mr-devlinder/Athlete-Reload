import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AppIcon } from './AppIcon'
import { getMovementById } from '../domain/recovery/exerciseCatalog'
import { estimateRoutineSeconds, expandUnilateralMovement, normalizeRoutineType, replaySavedMobilityRoutine } from '../domain/recovery/routineBuilder'
import { recordRoutinePainEvent } from '../lib/athleteData'
import '../styles/recovery-rework.css'

const ROUTINE_TYPES = [
  { id: 'session_recovery', label: 'Session Recovery', description: 'Gentle mobility shaped by your latest checkout.' },
  { id: 'full_body', label: 'Full Body Mobility', description: 'Balanced ankles, hips, trunk, and shoulders.' },
  { id: 'lower_body', label: 'Lower Body Mobility', description: 'Ankles, calves, hips, hamstrings, quads, and groin.' },
  { id: 'upper_body', label: 'Upper Body Mobility', description: 'Upper back, shoulders, scapulae, wrists, and neck.' },
  { id: 'flexibility', label: 'Flexibility', description: 'Longer controlled holds without forced end range.' },
  { id: 'warm_up', label: 'Warm-Up', description: 'Active mobility and progressive, low-fatigue preparation.' },
  { id: 'light_recovery', label: 'Light Recovery', description: 'Very low-demand movement for an easier day.' },
  { id: 'custom_mobility', label: 'Custom Mobility', description: 'Focus the routine on body areas you choose.' },
]
const TIME_OPTIONS = [5, 8, 10, 15, 20]
const EQUIPMENT_OPTIONS = [
  { id: 'resistance_band', label: 'Resistance band' },
  { id: 'bench_or_chair', label: 'Bench or chair' },
  { id: 'foam_roller', label: 'Foam roller' },
  { id: 'massage_ball', label: 'Massage ball' },
]
const TARGET_OPTIONS = ['Hips', 'Hamstrings', 'Quads', 'Calves', 'Ankles', 'Shoulders', 'Upper back', 'Wrists']

export function RecoveryView({
  checkouts = [],
  generatedPlan,
  generatedRoutine,
  generationStatus = 'idle',
  mobilityGenerationStatus = 'idle',
  onCompleteRoutine,
  onGenerateMobilityRoutine,
  onGenerateRecoveryPlan,
  onReportRoutinePain,
  onSaveRoutine,
  onStartRoutine,
  recentCompletion,
  savedRoutines = [],
  schedule = [],
}) {
  const latestCheckout = useMemo(() => [...checkouts].sort((a, b) => dateValue(b) - dateValue(a))[0] ?? null, [checkouts])
  const latestEvent = schedule.find((event) => event.id === latestCheckout?.eventId)
  const nextEvent = getNextEvent(schedule, latestEvent)
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).get('view') === 'mobility' ? 'mobility' : 'plan')
  const [routineType, setRoutineType] = useState('session_recovery')
  const [minutes, setMinutes] = useState(10)
  const [customMinutes, setCustomMinutes] = useState('')
  const [equipment, setEquipment] = useState([])
  const [targets, setTargets] = useState([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [selectedSavedId, setSelectedSavedId] = useState(null)
  const [activeRoutine, setActiveRoutine] = useState(null)
  const [activeRoutineRecordId, setActiveRoutineRecordId] = useState(null)
  const [routineOrigin, setRoutineOrigin] = useState('generated')
  const automaticPlanRequested = useRef(null)
  const currentPlan = generatedPlan?.sourceCheckoutId && generatedPlan.sourceCheckoutId !== latestCheckout?.id ? null : generatedPlan

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', section)
    window.history.replaceState(window.history.state, '', url)
  }, [section])

  useEffect(() => {
    if (section !== 'plan' || currentPlan || !latestCheckout || generationStatus !== 'idle' || automaticPlanRequested.current === latestCheckout.id) return
    automaticPlanRequested.current = latestCheckout.id
    onGenerateRecoveryPlan?.()
  }, [currentPlan, generationStatus, latestCheckout, onGenerateRecoveryPlan, section])

  useEffect(() => {
    if (!generatedRoutine) return
    setActiveRoutine(extractRoutine(generatedRoutine))
    setActiveRoutineRecordId(null)
    setRoutineOrigin('generated')
  }, [generatedRoutine])

  const selectedMinutes = customMinutes ? Math.max(5, Math.min(30, Number(customMinutes) || minutes)) : minutes
  const selectedSaved = savedRoutines.find((routine) => routine.id === selectedSavedId)

  function toggleEquipment(id) {
    setEquipment((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function generateRoutine() {
    setSelectedSavedId(null)
    onGenerateMobilityRoutine?.({
      equipmentAvailable: equipment,
      routineType,
      targetBodyParts: routineType === 'custom_mobility' ? targets : [],
      timeAvailableMinutes: selectedMinutes,
    })
  }

  function startSavedRoutine() {
    const routine = replaySavedMobilityRoutine(selectedSaved)
    if (!routine) return
    setActiveRoutine(routine)
    setActiveRoutineRecordId(selectedSaved.id)
    setRoutineOrigin('saved')
    setSavedOpen(false)
  }

  return (
    <div className="recovery-view" data-tour="recovery-page">
      <section className="recovery-hero">
        <div>
          <p className="eyebrow">Recovery</p>
          <h1>Recover with context. Move with purpose.</h1>
          <div className="recovery-context-line"><span><small>From</small>{latestEvent?.title ?? latestCheckout?.eventTitle ?? 'Complete checkout to begin'}</span><i aria-hidden="true">→</i><span><small>Next</small>{nextEvent?.title ?? 'No upcoming event'}</span></div>
        </div>
      </section>

      <div className="recovery-view-toggle" role="tablist" aria-label="Recovery view">
        <button aria-selected={section === 'plan'} className={section === 'plan' ? 'active' : ''} onClick={() => setSection('plan')} role="tab" type="button">Recovery</button>
        <button aria-selected={section === 'mobility'} className={section === 'mobility' ? 'active' : ''} onClick={() => setSection('mobility')} role="tab" type="button">Mobility</button>
      </div>

      {section === 'plan' && (
        <RecoveryPlanPanel
          checkout={latestCheckout}
          event={latestEvent}
          loading={generationStatus === 'loading'}
          onGenerate={onGenerateRecoveryPlan}
          onViewMobility={() => { setRoutineType('session_recovery'); setSection('mobility') }}
          plan={currentPlan}
        />
      )}

      {section === 'mobility' && !activeRoutine && (
        <section className="mobility-builder glass-panel" role="tabpanel">
          <header className="mobility-builder-header">
            <div><p className="eyebrow">Mobility routines</p><h2>Build a routine that fits the moment.</h2><p>Choose a purpose, a real time budget, and only the equipment you actually have.</p></div>
            <button className="secondary-button" onClick={() => setSavedOpen((value) => !value)} type="button"><AppIcon name="folder" size={18} />Saved routines</button>
          </header>

          {savedOpen && (
            <div className="saved-routine-library">
              <strong>Saved Routines</strong>
              {savedRoutines.length ? savedRoutines.map((saved) => {
                const routine = extractRoutine(saved.routine)
                return <button aria-pressed={selectedSavedId === saved.id} className={selectedSavedId === saved.id ? 'selected' : ''} key={saved.id} onClick={() => setSelectedSavedId(saved.id)} type="button"><span><b>{saved.title ?? routine?.routineName ?? 'Mobility routine'}</b><small>{formatSavedRoutineMeta(routine)}</small></span><em>Select</em></button>
              }) : <p>No saved routines yet. Generate one and save its exact plan here.</p>}
              {selectedSaved && <button className="primary-button saved-routine-start" onClick={startSavedRoutine} type="button">Start Routine</button>}
            </div>
          )}

          <div className="mobility-steps">
            <fieldset className="mobility-step"><legend><span>1</span>Select Routine Type</legend><div className="mobility-type-grid">{ROUTINE_TYPES.map((option) => <button aria-pressed={routineType === option.id} className={routineType === option.id ? 'selected' : ''} key={option.id} onClick={() => setRoutineType(option.id)} type="button"><strong>{option.label}</strong><small>{option.description}</small></button>)}</div></fieldset>
            {routineType === 'custom_mobility' && <fieldset className="mobility-step"><legend>Target areas</legend><div className="mobility-choice-row">{TARGET_OPTIONS.map((target) => <button aria-pressed={targets.includes(target)} className={targets.includes(target) ? 'selected' : ''} key={target} onClick={() => setTargets((current) => current.includes(target) ? current.filter((item) => item !== target) : [...current, target])} type="button">{target}</button>)}</div></fieldset>}
            <fieldset className="mobility-step"><legend><span>2</span>How much time do you have?</legend><div className="mobility-choice-row">{TIME_OPTIONS.map((value) => <button aria-pressed={!customMinutes && minutes === value} className={!customMinutes && minutes === value ? 'selected' : ''} key={value} onClick={() => { setMinutes(value); setCustomMinutes('') }} type="button">{value} min</button>)}<label className={customMinutes ? 'selected' : ''}>Custom<input aria-label="Custom minutes" inputMode="numeric" max="30" min="5" onChange={(event) => setCustomMinutes(event.target.value)} placeholder="min" type="number" value={customMinutes} /></label></div></fieldset>
            <fieldset className="mobility-step"><legend><span>3</span>Equipment Available</legend><div className="mobility-choice-row"><button aria-pressed={equipment.length === 0} className={equipment.length === 0 ? 'selected' : ''} onClick={() => setEquipment([])} type="button">Nothing</button>{EQUIPMENT_OPTIONS.map((option) => <button aria-pressed={equipment.includes(option.id)} className={equipment.includes(option.id) ? 'selected' : ''} key={option.id} onClick={() => toggleEquipment(option.id)} type="button">{option.label}</button>)}</div></fieldset>
            <div className="mobility-generate-row"><span><b>4</b>Ready to build</span><button className="primary-button mobility-generate-button" disabled={mobilityGenerationStatus === 'loading' || (routineType === 'custom_mobility' && targets.length === 0)} onClick={generateRoutine} type="button">{mobilityGenerationStatus === 'loading' ? 'Generating…' : 'Generate Mobility Routine'}</button></div>
            {mobilityGenerationStatus === 'error' && <p className="recovery-error">The routine could not be generated. Try again when your connection is available.</p>}
            {recentCompletion?.completedAt && <p className="recovery-context-note">Last mobility routine completed {formatCompletionRecency(recentCompletion.completedAt)}.</p>}
          </div>
        </section>
      )}

      {section === 'mobility' && activeRoutine && (
        <MobilityRoutinePlayer
          equipmentAvailable={equipment}
          latestCheckout={latestCheckout}
          latestEvent={latestEvent}
          onBack={() => { setActiveRoutine(null); setActiveRoutineRecordId(null) }}
          onComplete={onCompleteRoutine}
          onReportPain={onReportRoutinePain}
          onSave={routineOrigin === 'generated' ? onSaveRoutine : null}
          onStart={onStartRoutine}
          origin={routineOrigin}
          routine={activeRoutine}
          routineRecordId={activeRoutineRecordId}
        />
      )}
    </div>
  )
}

function RecoveryPlanPanel({ checkout, event, loading, onGenerate, onViewMobility, plan }) {
  const sections = plan?.reportSections ?? []
  const priorities = sections.find((section) => section.id === 'recovery-priorities')?.items ?? plan?.priorities ?? []
  return <div className="recovery-plan-stack">
    {checkout && <section className="recovery-latest recovery-checkout-context glass-panel"><div className="recovery-section-heading"><div><p className="eyebrow">Latest checkout</p><h2>{event?.title ?? checkout.eventTitle ?? 'Training session'}</h2></div><span>{formatCheckoutDate(checkout.date)}</span></div><div className="recovery-session-facts"><span><strong>{checkout.actualMinutes ?? 0}</strong> min</span><span><strong>{checkout.difficulty ?? 0}/10</strong> effort</span><span><strong>{checkout.postSoreness ?? 0}/5</strong> soreness</span></div></section>}
    {!plan && <section className="recovery-plan-launch glass-panel"><div><p className="eyebrow">Recovery Plan</p><h2>{checkout ? 'Turn your checkout into near-term priorities.' : 'Complete Checkout to build a recovery plan.'}</h2><p>Fuel, fluids, sleep, symptom monitoring, and the next event belong here. Physical routines live in Mobility.</p></div><button className="primary-button" disabled={!checkout || loading} onClick={onGenerate} type="button">{loading ? 'Building…' : 'Build Recovery Plan'}</button></section>}
    {plan && <section className="recovery-plan-panel recovery-plan-only glass-panel"><header><div><p className="eyebrow">Recovery Plan</p><h2>{plan.label ?? 'Your post-event priorities'}</h2><p>{plan.summary}</p></div><span>{plan.generatedAt ? format(parseISO(plan.generatedAt), 'MMM d · h:mm a') : 'Current plan'}</span></header>{priorities.length > 0 && <div className="recovery-priority-list"><strong>{priorities.length} priorities</strong><ol>{priorities.map((priority) => <li key={priority}>{priority}</li>)}</ol></div>}<div className="recovery-report-grid">{sections.filter((section) => section.id !== 'recovery-priorities').map((section) => <article key={section.id}><span>{section.title}</span><strong>{section.summary}</strong>{section.items?.length > 0 && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</article>)}</div><footer className="recovery-plan-actions"><button className="recovery-plan-refresh-button" disabled={loading} onClick={onGenerate} type="button"><AppIcon name="recovery" size={17} />{loading ? 'Refreshing…' : 'Refresh Plan'}</button><button className="recovery-plan-mobility-button" onClick={onViewMobility} type="button">View Mobility<AppIcon name="arrow" size={17} /></button></footer></section>}
  </div>
}

function MobilityRoutinePlayer({ equipmentAvailable, latestCheckout, latestEvent, onBack, onComplete, onReportPain, onSave, onStart, origin, routine, routineRecordId }) {
  const exercises = useMemo(() => (routine?.exercises ?? []).flatMap(hydrateRoutineStep), [routine])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [timerState, setTimerState] = useState('idle')
  const [readyForNext, setReadyForNext] = useState(false)
  const [completed, setCompleted] = useState(() => new Set())
  const [skipped, setSkipped] = useState(() => new Set())
  const [hurtEvents, setHurtEvents] = useState([])
  const [removedIds, setRemovedIds] = useState(() => new Set())
  const [startedAt, setStartedAt] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const startedAtRef = useRef(null)
  const sessionIdRef = useRef(null)
  const startPromiseRef = useRef(null)
  const [summary, setSummary] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hurtOpen, setHurtOpen] = useState(false)
  const [painDetail, setPainDetail] = useState({ area: '', severity: '', type: '' })
  const current = exercises[index]
  const currentSide = /^(left|right)$/i.test(String(current?.side ?? '')) ? titleCase(current.side) : null
  const prescription = current?.prescription ?? {}
  const isTimed = current?.prescriptionType === 'time'
  const plannedSeconds = routine.estimatedDurationSeconds ?? estimateRoutineSeconds(exercises)

  useEffect(() => {
    if (timerState !== 'running' || secondsLeft <= 0) return undefined
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [secondsLeft, timerState])

  useEffect(() => {
    if (timerState === 'running' && secondsLeft === 0) { setTimerState('complete'); setReadyForNext(true) }
  }, [secondsLeft, timerState])

  async function ensureStarted() {
    if (sessionIdRef.current) return sessionIdRef.current
    if (startPromiseRef.current) return startPromiseRef.current

    const now = startedAtRef.current ?? new Date().toISOString()
    if (!startedAtRef.current) {
      startedAtRef.current = now
      setStartedAt(now)
    }

    const startPromise = Promise.resolve(onStart?.(buildSessionPayload({ exercises, latestCheckout, latestEvent, plannedSeconds, routine, routineRecordId, startedAt: now, equipmentAvailable })))
      .then((record) => {
        const id = record?.id ?? null
        sessionIdRef.current = id
        setSessionId(id)
        return id
      })
      .catch(() => null)
      .finally(() => { startPromiseRef.current = null })

    startPromiseRef.current = startPromise
    return startPromise
  }

  function startTimer() {
    if (secondsLeft === 0 || timerState === 'idle' || timerState === 'complete') setSecondsLeft(Number(prescription.durationSeconds ?? current.durationSeconds ?? 30))
    setReadyForNext(false)
    setTimerState('running')
    void ensureStarted()
  }

  async function markDone() {
    await ensureStarted()
    setReadyForNext(true)
  }

  function nextSideOrExercise(status = 'completed') {
    const key = exerciseKey(current)
    const nextCompleted = new Set(completed)
    const nextSkipped = new Set(skipped)
    if (status === 'completed') nextCompleted.add(key)
    else nextSkipped.add(key)
    setCompleted(nextCompleted)
    setSkipped(nextSkipped)
    const nextIndex = findNextIndex(exercises, index, removedIds)
    if (nextIndex < 0) { finishRoutine(nextCompleted, nextSkipped); return }
    setIndex(nextIndex)
    resetExerciseState()
  }

  async function finishRoutine(finalCompleted = completed, finalSkipped = skipped, statusOverride, finalHurtEvents = hurtEvents) {
    const finishedAt = new Date().toISOString()
    const actualSeconds = startedAt ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0
    const payload = buildCompletionPayload({ actualSeconds, completed: finalCompleted, exercises, finishedAt, hurtEvents: finalHurtEvents, latestCheckout, latestEvent, plannedSeconds, routine, sessionId, skipped: finalSkipped, startedAt, statusOverride })
    setSaving(true)
    await onComplete?.(payload)
    setSaving(false)
    setSummary(payload)
  }

  async function skipCurrent() {
    await ensureStarted()
    nextSideOrExercise('skipped')
  }

  async function reportHurt() {
    setTimerState((value) => value === 'running' ? 'paused' : value)
    setPainDetail({ area: current?.targetAreas?.join(', ') ?? current?.bodyRegions?.join(', ') ?? '', severity: '', type: '' })
    setHurtOpen(true)
  }

  async function submitPain() {
    const activeSessionId = await ensureStarted()
    const event = { routineCompletionId: activeSessionId, routineId: origin === 'saved' ? routineRecordId : null, sourceCheckoutId: latestCheckout?.id ?? null, movementId: current.id, bodyRegion: painDetail.area, side: currentSide?.toLowerCase() ?? 'not_applicable', response: Number(painDetail.severity) <= 3 ? 'mild_discomfort' : 'meaningful_pain', actionTaken: 'skip', occurredAt: new Date().toISOString(), context: { painType: painDetail.type, severity: Number(painDetail.severity) || null } }
    await recordRoutinePainEvent(event)
    await onReportPain?.({ ...event, area: painDetail.area, checkoutId: latestCheckout?.id, exercise: current.name, severity: Number(painDetail.severity), type: painDetail.type })
    const nextEvents = [...hurtEvents, event]
    setHurtEvents(nextEvents)
    const sensitive = new Set(current.painSensitiveRegions)
    const removed = new Set(removedIds)
    exercises.slice(index + 1).forEach((movement) => { if (movement.painSensitiveRegions.some((region) => sensitive.has(region))) removed.add(movement.id) })
    setRemovedIds(removed)
    setHurtOpen(false)
    const nextSkipped = new Set(skipped).add(exerciseKey(current))
    exercises.filter((movement) => removed.has(movement.id)).forEach((movement) => nextSkipped.add(exerciseKey(movement)))
    setSkipped(nextSkipped)
    const nextIndex = findNextIndex(exercises, index, removed)
    if (nextIndex < 0) { setHurtEvents(nextEvents); finishRoutine(completed, nextSkipped, 'ended_for_pain', nextEvents); return }
    setIndex(nextIndex)
    resetExerciseState()
  }

  async function saveRoutine() {
    setSaving(true)
    const result = await onSave?.({ routine: { ...routine, exercises }, title: routine.routineName ?? routine.title, planType: routine.routineType, generatedAt: routine.generatedAt ?? new Date().toISOString(), equipment: equipmentAvailable, originalDurationSeconds: plannedSeconds })
    setSaving(false)
    setSaved(Boolean(result))
  }

  function goPrevious() {
    if (index <= 0) return
    setIndex(index - 1)
    resetExerciseState()
  }

  function resetExerciseState() { setSecondsLeft(0); setTimerState('idle'); setReadyForNext(false) }

  if (!exercises.length) return <section className="routine-player-shell glass-panel"><p className="recovery-error">This routine has no valid catalog movements.</p><button className="routine-back-button" onClick={onBack} type="button"><span aria-hidden="true">←</span>Back to Mobility</button></section>
  if (summary) return <RoutineSummary exercises={exercises} onBack={onBack} onSave={onSave ? saveRoutine : null} saved={saved} saving={saving} summary={summary} />

  return <section className="routine-player-shell glass-panel">
    <header className="routine-title-block"><button className="routine-back-button" onClick={onBack} type="button"><span aria-hidden="true">←</span>Back to Mobility</button><p className="eyebrow">{origin === 'saved' ? 'Saved routine' : 'Mobility routine'}</p><h1>{routine.routineName ?? routine.title}</h1><p>{routine.goal}</p><div><span>{Math.max(1, Math.round(plannedSeconds / 60))} min</span><span>{exercises.length} exercises</span><span>{Math.round(completed.size / exercises.length * 100)}% complete</span></div></header>
    <details className="routine-plan-dropdown"><summary>View Routine Plan <span>{exercises.length} movements</span></summary><ol>{exercises.map((exercise, position) => <li className={position === index ? 'active' : ''} key={exerciseKey(exercise)}><b>{position + 1}</b><span><strong>{exercise.name}</strong><small>{formatBodyArea(exercise)} · {formatPrescription(exercise)}</small></span></li>)}</ol></details>
    <div className="routine-player-progress"><span>Exercise {index + 1} of {exercises.length}</span><div><i style={{ width: `${(index + 1) / exercises.length * 100}%` }} /></div></div>
    <article className="active-movement-card">
      <header><div><p>{currentSide ? `${currentSide} side` : formatBodyArea(current)}</p><h2>{current.name}</h2><span>{formatBodyArea(current)}</span></div><div className="movement-prescription">{isTimed ? <strong>{formatSeconds(timerState === 'idle' ? prescription.durationSeconds : secondsLeft)}</strong> : <strong>{prescription.reps} reps{current.unilateral ? ' each side' : ''}</strong>}<small>{currentSide ? `${currentSide} side` : current.prescriptionType === 'time' ? 'controlled hold' : 'controlled pace'}</small></div></header>
      <section className="movement-how"><h3>How to Perform</h3><p>{current.instructions}</p></section>
      <div className="movement-cue-grid"><section><h3>You Should Feel</h3><ul>{current.shouldFeel.slice(0, 3).map((item) => <li key={item}>{formatCue(item)}</li>)}</ul></section><section><h3>Avoid</h3><ul>{current.avoid.slice(0, 3).map((item) => <li key={item}>{formatCue(item)}</li>)}</ul></section></div>
      <div className="routine-bottom-controls">
        <div className="routine-secondary-controls">{index > 0 && <button onClick={goPrevious} type="button">Previous</button>}<button onClick={skipCurrent} type="button">Skip</button><button className="hurt-control" onClick={reportHurt} type="button">This Hurts</button></div>
        <div className={`routine-primary-controls${isTimed && timerState === 'paused' ? ' routine-primary-controls-paired' : ''}`}>
          {isTimed && timerState === 'idle' && <button className="primary-button" onClick={startTimer} type="button">Start</button>}
          {isTimed && timerState === 'running' && <button className="primary-button" onClick={() => setTimerState('paused')} type="button">Pause</button>}
          {isTimed && timerState === 'paused' && <><button className="secondary-button" onClick={() => { setSecondsLeft(prescription.durationSeconds); setTimerState('idle') }} type="button">Restart</button><button className="primary-button" onClick={() => setTimerState('running')} type="button">Resume</button></>}
          {!isTimed && !readyForNext && <button className="primary-button" onClick={markDone} type="button">Done</button>}
          {readyForNext && <button className="primary-button" disabled={saving} onClick={() => nextSideOrExercise('completed')} type="button">{index === exercises.length - 1 ? 'Finish Routine' : 'Next Exercise'}</button>}
        </div>
      </div>
    </article>
    {hurtOpen && <div className="modal-backdrop" onClick={() => setHurtOpen(false)}><section className="event-modal routine-hurt-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><p className="eyebrow">Stop this movement</p><h2>This should not hurt.</h2><p>The timer is paused. Add a short note so this movement and similar remaining options can be stopped.</p><label>Where?<input onChange={(event) => setPainDetail((value) => ({ ...value, area: event.target.value }))} value={painDetail.area} /></label><label>What does it feel like?<select onChange={(event) => setPainDetail((value) => ({ ...value, type: event.target.value }))} value={painDetail.type}><option value="">Choose</option><option>Sharp</option><option>Aching</option><option>Pulling</option><option>Unstable</option><option>Numb or tingling</option></select></label><label>Pain level<select onChange={(event) => setPainDetail((value) => ({ ...value, severity: event.target.value }))} value={painDetail.severity}><option value="">Optional</option>{Array.from({ length: 10 }, (_, value) => <option key={value + 1}>{value + 1}</option>)}</select></label><div className="routine-hurt-actions"><button className="secondary-button" onClick={() => setHurtOpen(false)} type="button">Cancel</button><button className="primary-button" onClick={submitPain} type="button">Stop and Skip</button></div></section></div>}
  </section>
}

function RoutineSummary({ onBack, onSave, saved, saving, summary }) {
  return <section className="routine-complete-card"><p className="eyebrow">Routine Complete</p><h2>{formatElapsed(summary.actualDurationSeconds)} completed</h2><div><span><strong>{summary.movementsCompleted.length} of {summary.exerciseCount}</strong> exercises completed</span><span><strong>{summary.completionPercentage}%</strong> completion</span></div>{summary.hurtEvents.length > 0 && <p>You stopped {summary.hurtEvents.length} exercise{summary.hurtEvents.length === 1 ? '' : 's'} because it hurt.</p>}<footer>{onSave && <button className="secondary-button" disabled={saving || saved} onClick={onSave} type="button">{saved ? 'Routine Saved' : saving ? 'Saving…' : 'Save Routine'}</button>}<button className="primary-button" onClick={onBack} type="button">Done</button></footer></section>
}

function hydrateExercise(selection) {
  const movement = getMovementById(selection?.movementId ?? selection?.id)
  if (!movement) return null
  const prescription = selection.prescription ?? selection.dose ?? movement.prescription
  const normalized = movement.prescriptionType === 'time'
    ? { type: 'time', durationSeconds: Number(prescription.durationSeconds) || movement.defaults.durationSeconds, sets: Number(prescription.sets) || 1, restSeconds: Number(prescription.restSeconds) || 0 }
    : { type: 'reps', reps: Number(prescription.reps) || movement.defaults.reps, sets: Number(prescription.sets) || 1, restSeconds: Number(prescription.restSeconds) || 0, secondsPerRep: movement.defaults.secondsPerRep }
  return { ...movement, prescription: normalized, side: selection?.side ?? movement.side }
}

function hydrateRoutineStep(selection) {
  const movement = hydrateExercise(selection)
  return expandUnilateralMovement(movement)
}

function buildSessionPayload({ exercises, latestCheckout, latestEvent, plannedSeconds, routine, routineRecordId, startedAt, equipmentAvailable }) {
  return { routineId: routineRecordId, routineType: normalizeRoutineType(routine.routineType), generatedAt: routine.generatedAt ?? new Date().toISOString(), startedAt, plannedDurationSeconds: plannedSeconds, selectedTimeSeconds: plannedSeconds, movementIds: exercises.map((exercise) => exercise.id), movementOrder: exercises.map(exerciseKey), plannedPrescription: exercises.map((exercise) => ({ movementId: exercise.id, side: exercise.side ?? null, prescription: exercise.prescription })), associatedEventId: latestEvent?.id ?? null, sourceCheckoutId: latestCheckout?.id ?? null, equipment: equipmentAvailable, statedGoal: routine.goal, status: 'in_progress', generationContext: { catalogVersion: exercises[0]?.catalogVersion ?? null, origin: routineRecordId ? 'saved' : 'generated' }, routineSnapshot: { ...routine, exercises } }
}

function buildCompletionPayload({ actualSeconds, completed, exercises, finishedAt, hurtEvents, latestCheckout, latestEvent, plannedSeconds, routine, sessionId, skipped, startedAt, statusOverride }) {
  const completedExercises = exercises.filter((exercise) => completed.has(exerciseKey(exercise)))
  const skippedExercises = exercises.filter((exercise) => skipped.has(exerciseKey(exercise)))
  const movementsCompleted = completedExercises.map(exerciseKey)
  const movementsSkipped = skippedExercises.map(exerciseKey)
  const exerciseStatuses = exercises.map((exercise) => ({ movementId: exercise.id, side: exercise.side ?? null, status: completed.has(exerciseKey(exercise)) ? 'completed' : skipped.has(exerciseKey(exercise)) ? 'skipped' : 'not_started' }))
  return { id: sessionId, type: 'mobility_routine', routineType: normalizeRoutineType(routine.routineType), generatedAt: routine.generatedAt ?? null, startedAt, finishedAt, completedAt: finishedAt, plannedDurationSeconds: plannedSeconds, selectedTimeSeconds: plannedSeconds, actualDurationSeconds: actualSeconds, actualSeconds, movementIds: exercises.map((exercise) => exercise.id), movementOrder: exercises.map(exerciseKey), plannedPrescription: exercises.map((exercise) => ({ movementId: exercise.id, side: exercise.side ?? null, prescription: exercise.prescription })), completedPrescription: completedExercises.map((exercise) => ({ movementId: exercise.id, side: exercise.side ?? null, prescription: exercise.prescription })), movementsCompleted, movementsSkipped, exerciseStatuses, skipEvents: skippedExercises.map((exercise) => ({ movementId: exercise.id, side: exercise.side ?? null, occurredAt: finishedAt })), completionPercentage: exercises.length ? Math.round(movementsCompleted.length / exercises.length * 100) : 0, hurtEvents, associatedEventId: latestEvent?.id ?? null, sourceCheckoutId: latestCheckout?.id ?? null, statedGoal: routine.goal, status: statusOverride ?? (hurtEvents.length && movementsCompleted.length === 0 ? 'ended_for_pain' : movementsCompleted.length === exercises.length ? 'completed' : 'partial'), exerciseCount: exercises.length, generationContext: { catalogVersion: exercises[0]?.catalogVersion ?? null }, details: { type: 'mobility_routine', routineSnapshot: { ...routine, exercises } } }
}

function extractRoutine(value) { return value?.routine?.routine ?? value?.routine ?? value?.plan?.routine ?? (value?.exercises ? value : null) }
function exerciseKey(exercise) { return `${exercise.id}:${String(exercise.side ?? 'both').toLowerCase()}` }
function findNextIndex(exercises, currentIndex, removedIds) { for (let next = currentIndex + 1; next < exercises.length; next += 1) if (!removedIds.has(exercises[next].id)) return next; return -1 }
function formatBodyArea(exercise) { return exercise.targetAreas?.slice(0, 2).map(titleCase).join(' · ') || exercise.bodyRegions?.map(titleCase).join(' · ') || 'Full body' }
function formatPrescription(exercise) { const side = /^(left|right)$/i.test(String(exercise.side ?? '')) ? ` · ${titleCase(exercise.side)}` : exercise.unilateral ? ' each side' : ''; return exercise.prescriptionType === 'time' ? `${exercise.prescription.durationSeconds} sec${side}` : `${exercise.prescription.reps} reps${side}` }
function formatSeconds(value) { const seconds = Math.max(0, Number(value) || 0); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
function formatElapsed(value) { const seconds = Math.max(0, Number(value) || 0); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
function formatSavedRoutineMeta(routine) { if (!routine) return 'Unavailable'; const exercises = routine.exercises?.length ?? 0; const seconds = routine.estimatedDurationSeconds ?? estimateRoutineSeconds((routine.exercises ?? []).map(hydrateExercise).filter(Boolean)); return `${Math.max(1, Math.round(seconds / 60))} min · ${exercises} exercises` }
function titleCase(value) { return String(value).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) }
function formatCue(value) { const text = String(value ?? '').trim().replace(/\s+/g, ' '); if (!text) return ''; const sentence = `${text.charAt(0).toUpperCase()}${text.slice(1)}`; return /[.!?]$/.test(sentence) ? sentence : `${sentence}.` }
function dateValue(item) { return new Date(item?.createdAt ?? `${item?.date ?? '1970-01-01'}T12:00:00`).getTime() }
function formatCheckoutDate(date) { return date ? format(parseISO(`${date}T12:00:00`), 'MMM d, yyyy') : '' }
function formatCompletionRecency(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : format(date, 'MMM d · h:mm a') }
function getNextEvent(schedule, currentEvent) { const current = currentEvent ? new Date(`${currentEvent.date}T${currentEvent.time ?? '12:00'}`).getTime() : Date.now(); return [...schedule].filter((event) => new Date(`${event.date}T${event.time ?? '12:00'}`).getTime() > current).sort((a, b) => new Date(`${a.date}T${a.time ?? '12:00'}`) - new Date(`${b.date}T${b.time ?? '12:00'}`))[0] ?? null }
