import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'

const equipmentOptions = ['Exercise mat', 'Foam roller', 'Resistance band', 'Massage ball', 'Stationary bike', 'Pool', 'Compression equipment']
const planTypeOptions = [
  { id: 'last-checkout', label: 'Based on Last Checkout', description: 'Respond to the session you just completed.' },
  { id: 'full-body', label: 'Full Body Recovery', description: 'Balanced mobility and recovery across major areas.' },
  { id: 'flexibility', label: 'Flexibility Improving', description: 'Comfortable, progressive range-of-motion work.' },
  { id: 'targeted', label: 'Targeted Recovery', description: 'Prioritize the body areas you select.' },
  { id: 'quick', label: 'Quick Recovery', description: 'A focused 5-10 minute reset.' },
  { id: 'competition', label: 'Competition Recovery', description: 'Prioritize turnaround before competition.' },
  { id: 'recovery-day', label: 'Recovery Day', description: 'A complete low-load recovery-day plan.' },
  { id: 'mobility', label: 'Mobility Only', description: 'Movement-focused guidance without extra conditioning.' },
]
const targetAreaOptions = ['Shoulders / arms', 'Back / trunk', 'Hips', 'Quads / hamstrings', 'Knees', 'Calves / ankles / feet']

const fallbackRoutine = [
  { area: 'Spine', reps: 8, instruction: 'Move slowly through a comfortable range and do not force your back.', name: 'Cat-cow', side: 'Both sides', type: 'Mobility' },
  { area: 'Upper back', reps: 8, instruction: 'Rotate from the upper back while keeping the movement easy and controlled.', name: 'Open-book thoracic rotation', side: 'Each side', type: 'Mobility' },
  { area: 'Shoulders', reps: 10, instruction: 'Make smooth circles without pinching or sharp pain in the shoulder.', name: 'Shoulder circles', side: 'Both sides', type: 'Mobility' },
  { area: 'Chest', durationSeconds: 30, instruction: 'Feel a mild opening through the chest, never sharp pain in the shoulder.', name: 'Doorway chest stretch', side: 'Each side', type: 'Stretch' },
  { area: 'Hips', reps: 10, instruction: 'Switch sides under control and stay in a comfortable range.', name: '90/90 hip switches', side: 'Both sides', type: 'Mobility' },
  { area: 'Adductors', reps: 8, instruction: 'Keep the motion gentle and stop before discomfort becomes sharp.', name: 'Adductor rock-back', side: 'Each side', type: 'Mobility' },
  { area: 'Hip flexors', durationSeconds: 30, instruction: 'Keep ribs stacked over hips and feel a gentle stretch at the front of the hip.', name: 'Half-kneeling hip-flexor stretch', side: 'Each side', type: 'Stretch' },
  { area: 'Hamstrings', durationSeconds: 30, instruction: 'Use a light, comfortable stretch only. Do not push into pain.', name: 'Supine hamstring stretch', side: 'Each side', type: 'Stretch' },
  { area: 'Calves', durationSeconds: 30, instruction: 'Keep the heel down and feel gentle tension through the calf.', name: 'Standing calf stretch', side: 'Each side', type: 'Stretch' },
]

export function RecoveryView({ checkouts = [], generatedPlan, generatedPlanSaved = false, isReplayingSavedRoutine = false, generationStatus = 'idle', nextEvent, onCompleteSavedRoutine, onGeneratePlan, onReplaySavedRoutine, onReportRoutinePain, onSaveRecoveryPlan, onUpdateRecoveryStep, recentCompletion, savedRoutines = [], schedule = [] }) {
  const latestCheckout = useMemo(
    () => [...checkouts].sort((first, second) => getDateValue(second) - getDateValue(first))[0] ?? null,
    [checkouts],
  )
  const latestEvent = schedule.find((event) => event.id === latestCheckout?.eventId)
  const [equipment, setEquipment] = useState([])
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [equipmentTouched, setEquipmentTouched] = useState(false)
  const [equipmentMenuPosition, setEquipmentMenuPosition] = useState({ left: 12, top: 12 })
  const equipmentButtonRef = useRef(null)
  const equipmentPickerRef = useRef(null)
  const equipmentMenuRef = useRef(null)
  const [timeAvailable, setTimeAvailable] = useState('15 minutes')
  const [planType, setPlanType] = useState('last-checkout')
  const [targetedAreas, setTargetedAreas] = useState([])
  const [completedSteps, setCompletedSteps] = useState(() => new Set())
  const [skippedSteps, setSkippedSteps] = useState(() => new Set())
  const [routineStarted, setRoutineStarted] = useState(false)
  const [routineIndex, setRoutineIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [routinePaused, setRoutinePaused] = useState(false)
  const [completedRoutineExercises, setCompletedRoutineExercises] = useState(() => new Set())
  const [routineFeedback, setRoutineFeedback] = useState(null)
  const [hurtReport, setHurtReport] = useState(null)
  const [excludedExercises, setExcludedExercises] = useState([])
  const [routineComplete, setRoutineComplete] = useState(false)
  const [feedback, setFeedback] = useState({ completion: '', feeling: '', tightness: '', pain: '' })
  const [isSavingPlan, setIsSavingPlan] = useState(false)

  const plan = generatedPlan
  const recoverySteps = plan?.recoverySteps?.length ? plan.recoverySteps : plan ? getFallbackSteps(plan) : []
  const timeline = plan?.timeline?.length ? plan.timeline : plan ? getFallbackTimeline(plan) : []
  const routine = buildRoutine(
    plan?.routine?.exercises?.length ? plan.routine.exercises : fallbackRoutine,
    getTimeAvailableMinutes(timeAvailable),
    excludedExercises,
  )
  const currentExercise = routine[routineIndex]
  const isPainAware = Boolean(plan?.routine?.painAware || plan?.painAware)

  useEffect(() => {
    if (!routineStarted || routinePaused || !currentExercise?.durationSeconds || secondsLeft <= 0) return undefined

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentExercise, routinePaused, routineStarted, secondsLeft])

  useEffect(() => {
    if (routineStarted && currentExercise?.durationSeconds && secondsLeft === 0) {
      setRoutinePaused(true)
    }
  }, [currentExercise, routineStarted, secondsLeft])

  useEffect(() => {
    if (!equipmentOpen) return undefined

    function closeEquipmentMenu(event) {
      if (!equipmentPickerRef.current?.contains(event.target) && !equipmentMenuRef.current?.contains(event.target)) {
        setEquipmentOpen(false)
        if (equipment.length === 0) setEquipmentTouched(true)
      }
    }

    document.addEventListener('pointerdown', closeEquipmentMenu)
    return () => document.removeEventListener('pointerdown', closeEquipmentMenu)
  }, [equipment, equipmentOpen])

  useEffect(() => {
    if (!equipmentOpen) return undefined

    function updateEquipmentMenuPosition() {
      const rect = equipmentButtonRef.current?.getBoundingClientRect()
      if (!rect) return

      const menuHeight = 276
      const top = rect.bottom + 8 + menuHeight > window.innerHeight
        ? Math.max(12, rect.top - menuHeight - 8)
        : rect.bottom + 8

      setEquipmentMenuPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 272)),
        top,
      })
    }

    updateEquipmentMenuPosition()
    window.addEventListener('resize', updateEquipmentMenuPosition)
    window.addEventListener('scroll', updateEquipmentMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateEquipmentMenuPosition)
      window.removeEventListener('scroll', updateEquipmentMenuPosition, true)
    }
  }, [equipmentOpen])

  function startExercise() {
    setRoutineStarted(true)
    setRoutinePaused(false)
    setSecondsLeft(Number(currentExercise?.durationSeconds ?? 0))
  }

  function advanceExercise(completion = 'complete') {
    if (completion === 'complete' && currentExercise) {
      setCompletedRoutineExercises((current) => new Set([...current, `${currentExercise.name}-${currentExercise.side ?? ''}`]))
    }

    if (routineIndex >= routine.length - 1) {
      setRoutineStarted(false)
      setRoutineComplete(true)
      if (isReplayingSavedRoutine) onCompleteSavedRoutine?.({ completedAt: new Date().toISOString(), exerciseCount: routine.length })
      return
    }

    const nextExercise = routine[routineIndex + 1]
    setRoutineIndex((current) => current + 1)
    setRoutinePaused(false)
    setSecondsLeft(Number(nextExercise?.durationSeconds ?? 0))
    setRoutineStarted(false)
  }

  function reportExercisePain() {
    setRoutinePaused(true)
    setHurtReport({ area: currentExercise?.area ?? '', sameIssue: '', severity: '', type: '' })
  }

  async function handleHurtReport(action) {
    const exerciseName = currentExercise?.name
    const report = {
      ...hurtReport,
      checkoutId: latestCheckout?.id ?? null,
      exercise: exerciseName,
    }
    await onReportRoutinePain?.(report)
    setHurtReport(null)

    if (action === 'end') {
      setRoutineStarted(false)
      setRoutineComplete(true)
    } else {
      setExcludedExercises((current) => [...new Set([...current, getExerciseFamily(exerciseName)])])
      setRoutineIndex((current) => Math.max(0, Math.min(current, routine.length - 2)))
      setRoutineStarted(false)
      setRoutinePaused(false)
      setSecondsLeft(0)
    }
  }

  function setStepStatus(stepId, status) {
    if (status === 'pending') {
      setSkippedSteps((current) => {
        const next = new Set(current)
        next.delete(stepId)
        return next
      })
    } else if (status === 'complete') {
      setCompletedSteps((current) => new Set([...current, stepId]))
      setSkippedSteps((current) => {
        const next = new Set(current)
        next.delete(stepId)
        return next
      })
    } else {
      setSkippedSteps((current) => new Set([...current, stepId]))
      setCompletedSteps((current) => {
        const next = new Set(current)
        next.delete(stepId)
        return next
      })
    }

    if (generatedPlanSaved) onUpdateRecoveryStep?.(stepId, status)
  }

  function handleGenerate() {
    setCompletedSteps(new Set())
    setSkippedSteps(new Set())
    setRoutineFeedback(null)
    setRoutineComplete(false)
    setCompletedRoutineExercises(new Set())
    setExcludedExercises([])
    setRoutineIndex(0)
    setRoutineStarted(false)
    setEquipmentTouched(true)
    onGeneratePlan({ equipment, planType, targetedAreas, timeAvailable })
  }

  function selectPlanType(nextType) {
    setPlanType(nextType)
    if (nextType === 'quick' && getTimeAvailableMinutes(timeAvailable) > 10) setTimeAvailable('10 minutes')
  }

  function toggleTargetArea(area) {
    setTargetedAreas((current) => current.includes(area)
      ? current.filter((item) => item !== area)
      : [...current, area])
  }

  async function saveRecoveryPlan() {
    if (!plan || isSavingPlan) return

    setIsSavingPlan(true)
    const stepStatuses = {
      ...Object.fromEntries([...completedSteps].map((stepId) => [stepId, 'complete'])),
      ...Object.fromEntries([...skippedSteps].map((stepId) => [stepId, 'skipped'])),
    }
    const hasFeedback = Object.values(feedback).some(Boolean)
    const saved = await onSaveRecoveryPlan?.({
      ...plan,
      stepStatuses,
      routineProgress: {
        completed: completedRoutineExercises.size,
        total: routine.length,
      },
      ...(hasFeedback ? { feedback: { ...feedback, recordedAt: new Date().toISOString() } } : {}),
    })
    setIsSavingPlan(false)

    if (!saved) return
  }

  function toggleEquipment(option) {
    setEquipment((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option)
      }

      return [...current, option]
    })
    setEquipmentTouched(true)
  }

  function toggleEquipmentMenu() {
    if (equipmentOpen) {
      setEquipmentOpen(false)
      if (equipment.length === 0) setEquipmentTouched(true)
      return
    }

    setEquipmentOpen(true)
  }

  return (
    <div className="recovery-view" data-tour="recovery-page">
      <section className="recovery-hero">
        <div>
          <p className="eyebrow">Recovery</p>
          <h1>Give your body a chance to reload.</h1>
          <p>Turn the latest checkout into a practical recovery plan that fits the session you actually completed.</p>
        </div>
      </section>

      {latestCheckout ? (
        <section className="recovery-latest glass-panel">
          <div className="recovery-section-heading">
            <div>
              <p className="eyebrow">Latest checkout</p>
              <h2>{latestEvent?.title ?? latestCheckout.eventTitle ?? 'Training session'}</h2>
            </div>
            <span>{formatCheckoutDate(latestCheckout.date)}</span>
          </div>
          <div className="recovery-session-facts">
            <span><strong>{latestCheckout.actualMinutes ?? 0}</strong> min</span>
            <span><strong>{latestCheckout.difficulty ?? 0}/10</strong> effort</span>
            <span><strong>{latestCheckout.participation ?? latestCheckout.completionLevel ?? 'Logged'}</strong> participation</span>
          </div>
          <div className="recovery-generator">
            <div>
              <strong>Build your recovery plan</strong>
              <p>Choose the outcome you need. The plan adapts to your session, sport, pain, nutrition, recovery history, and what is next.</p>
            </div>
            <div className="recovery-type-grid" role="radiogroup" aria-label="Recovery plan type">
              {planTypeOptions.map((option) => (
                <button
                  aria-checked={planType === option.id}
                  className={planType === option.id ? 'selected' : ''}
                  key={option.id}
                  onClick={() => selectPlanType(option.id)}
                  role="radio"
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            {planType === 'targeted' && (
              <div className="recovery-target-picker">
                <span>Target areas</span>
                <div>
                  {targetAreaOptions.map((area) => (
                    <button className={targetedAreas.includes(area) ? 'selected' : ''} key={area} onClick={() => toggleTargetArea(area)} type="button">{area}</button>
                  ))}
                </div>
                {targetedAreas.length === 0 && <small>Select at least one area to generate a targeted plan.</small>}
              </div>
            )}
            <div className="recovery-generator-controls">
              <label>
                <span>Time available</span>
                <select value={timeAvailable} onChange={(event) => setTimeAvailable(event.target.value)}>
                  {(planType === 'quick' ? ['5 minutes', '10 minutes'] : ['5 minutes', '10 minutes', '15 minutes', '20 minutes', '30 minutes']).map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <div className="equipment-field" ref={equipmentPickerRef}>
                <span>Equipment</span>
                <button
                  aria-expanded={equipmentOpen}
                  aria-haspopup="menu"
                  className="equipment-picker-button"
                  onClick={toggleEquipmentMenu}
                  ref={equipmentButtonRef}
                  type="button"
                >
                  {equipment.length > 0 ? `${equipment.length} selected` : equipmentTouched ? 'Nothing' : 'Select'}
                </button>
                {equipmentOpen && createPortal(
                  <div
                    className="equipment-picker-menu"
                    ref={equipmentMenuRef}
                    role="menu"
                    style={{ left: equipmentMenuPosition.left, top: equipmentMenuPosition.top }}
                  >
                    {equipmentOptions.map((option) => (
                      <label key={option}>
                        <input checked={equipment.includes(option)} onChange={() => toggleEquipment(option)} type="checkbox" />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>,
                  document.body,
                )}
              </div>
              <button className="primary-button" disabled={generationStatus === 'loading' || (planType === 'targeted' && targetedAreas.length === 0)} onClick={handleGenerate} type="button">
                {generationStatus === 'loading' ? 'Building plan...' : plan ? 'Regenerate plan' : 'Generate recovery plan'}
              </button>
            </div>
            {generationStatus === 'error' && <p className="recovery-error">The recovery plan could not be generated. Check your connection and try again.</p>}
            {recentCompletion?.completedAt && (
              <p className="recovery-context-note">Last recovery completed {formatCompletionRecency(recentCompletion.completedAt)}. This is considered when pacing the next plan.</p>
            )}
          </div>
          {savedRoutines.some((routine) => routine.isFavorite) && (
            <div className="saved-routine-library">
              <strong>Favorite routines</strong>
              <div>
                {savedRoutines.filter((routine) => routine.isFavorite).map((routine) => (
                  <button key={routine.id} onClick={() => onReplaySavedRoutine?.(routine)} type="button">
                    <span>{routine.title}</span>
                    <em>Replay</em>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="recovery-empty glass-panel">
          <p className="eyebrow">Your first plan</p>
          <h2>Complete a checkout to personalize recovery.</h2>
          <p>Once you log a session, this page will turn its actual duration, effort, and response into a recovery plan.</p>
        </section>
      )}

      {plan && (
        <>
          <section className="recovery-plan-panel guidance-panel recovery-guidance-top glass-panel">
            <p className="eyebrow">Guidance</p>
            <h2>Keep recovery comfortable.</h2>
            <div className="recovery-guidance-list">
              <p><strong>Use gentle movement.</strong> Stretching should feel easy, never forced or sharp.</p>
              <p><strong>Let symptoms guide you.</strong> Stop an activity that increases pain, changes your movement, or makes you feel unwell.</p>
              <p><strong>Ask for help when needed.</strong> Tell a parent, coach, athletic trainer, or qualified healthcare professional about worsening or concerning symptoms.</p>
            </div>
          </section>

          <section className="recovery-plan-panel recovery-do-now glass-panel">
            <div className="recovery-section-heading">
              <div>
                <p className="eyebrow">Do now</p>
                <h2>Complete tonight</h2>
              </div>
              <span>{getRecoveryLabel(plan)}</span>
            </div>
            {plan.action && <p className="recovery-action-copy">{plan.action}</p>}
            <div className="recovery-step-list">
              {recoverySteps.map((step, index) => {
                const stepId = step.id ?? `${index}-${step.title}`
                const skipped = skippedSteps.has(stepId)
                return (
                  <article className={`recovery-step-card${completedSteps.has(stepId) ? ' completed' : ''}${skipped ? ' skipped' : ''}`} key={stepId}>
                    <div className="recovery-step-number">{index + 1}</div>
                    <div className="recovery-step-content">
                      <strong>{step.title}</strong>
                      <p>{step.why ?? 'This supports a steadier recovery after the session you logged.'}</p>
                      <span className="recovery-step-time">{step.when ?? 'After training'}</span>
                    </div>
                    <div className="recovery-step-actions">
                      <button className="recovery-check-button" onClick={() => setStepStatus(stepId, 'complete')} type="button">{completedSteps.has(stepId) ? 'Completed' : 'Complete'}</button>
                      <button onClick={() => setStepStatus(stepId, skipped ? 'pending' : 'skipped')} type="button">{skipped ? 'Unskip' : 'Skip'}</button>
                      <button onClick={() => setStepStatus(stepId, 'unable')} type="button">Unable to complete</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="recovery-timeline-panel recovery-plan-panel glass-panel">
            <div className="recovery-section-heading">
              <div>
                <p className="eyebrow">Recovery timeline</p>
                <h2>What happens next</h2>
              </div>
              {nextEvent && <span>Next: {nextEvent.title ?? nextEvent.type}</span>}
            </div>
            <div className="recovery-timeline">
              {timeline.map((phase) => (
                <article key={phase.title}>
                  <span>{phase.title}</span>
                  <ul>{(phase.items ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>

          <section className="recovery-routine-panel recovery-plan-panel glass-panel">
            <div className="recovery-section-heading">
              <div>
                <p className="eyebrow">Personalized routine</p>
                <h2>{plan.routine?.title ?? 'Cooldown and mobility'}</h2>
              </div>
              <span>{plan.routine?.durationMinutes ?? getTimeAvailableMinutes(timeAvailable)} min</span>
            </div>
            {plan.routine?.goal && <p className="routine-goal"><strong>Routine goal:</strong> {plan.routine.goal}</p>}
            <p className="routine-intro">{plan.routine?.summary ?? 'Use this as an optional way to relax and maintain comfortable mobility, not as a guaranteed repair.'}</p>
            {isPainAware && <div className="pain-aware-callout">Your reported symptoms changed this routine. Do not stretch a painful area through discomfort.</div>}
            {!routineComplete && (
              <details className="routine-preview">
                <summary>View routine plan ({routine.length} exercises)</summary>
                <ol>
                  {routine.map((exercise, index) => (
                    <li key={`${exercise.name}-${exercise.side}-${index}`}>
                      <strong>{exercise.name}</strong>
                      <span>{exercise.side ?? 'Both sides'} · {exercise.area ?? 'Comfortable range'} · {exercise.durationSeconds ? `${exercise.durationSeconds}s` : `${exercise.reps ?? 6} reps`}</span>
                      {exercise.why && <em>{exercise.why}</em>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {routineComplete ? (
              <div className="recovery-routine-complete">
                <p className="eyebrow">Routine complete</p>
                <h3>Recovery routine completed.</h3>
                <p>Take a moment to record how your body feels before saving this recovery plan.</p>
              </div>
            ) : (
            <div className="routine-player">
              <div className="routine-player-header">
                <span>Exercise {routineIndex + 1} of {routine.length}</span>
                <strong>{currentExercise?.type ?? 'Mobility'}</strong>
              </div>
              <div className="routine-progress" aria-label={`${routineIndex + 1} of ${routine.length} exercises complete`}>
                <span style={{ width: `${((routineIndex + 1) / Math.max(1, routine.length)) * 100}%` }} />
              </div>
              <h3>{currentExercise?.name}</h3>
              <p className="routine-side">{currentExercise?.side ?? 'Both sides'} · {currentExercise?.area ?? 'Comfortable range'}</p>
              <p>{currentExercise?.instruction}</p>
              {currentExercise?.feel && <small>Feel: {currentExercise.feel}</small>}
              {currentExercise?.avoid && <small>Do not feel: {currentExercise.avoid}</small>}
              {currentExercise?.durationSeconds ? <div className="routine-timer">{formatSeconds(routineStarted ? secondsLeft : currentExercise.durationSeconds)}</div> : <div className="routine-reps">{currentExercise?.reps ?? 6} controlled reps</div>}
              <div className="routine-player-actions">
                  {!routineStarted ? (
                    <button className="primary-button" onClick={startExercise} type="button">Start exercise</button>
                  ) : currentExercise?.durationSeconds && secondsLeft === 0 ? (
                    <button className="primary-button" onClick={advanceExercise} type="button">{routineIndex === routine.length - 1 ? 'Finish routine' : 'Next exercise'}</button>
                  ) : !currentExercise?.durationSeconds ? (
                    <button className="primary-button" onClick={advanceExercise} type="button">{routineIndex === routine.length - 1 ? 'Finish routine' : 'Complete and continue'}</button>
                  ) : (
                  <button className="secondary-button" onClick={() => setRoutinePaused((current) => !current)} type="button">{routinePaused ? 'Resume' : 'Pause'}</button>
                )}
                <button className="secondary-button" onClick={() => advanceExercise('skipped')} type="button">{routineIndex === routine.length - 1 ? 'Finish routine' : 'Skip'}</button>
                <button className="text-button danger-text" onClick={reportExercisePain} type="button">This hurts</button>
              </div>
              {routineFeedback === 'pain' && <div className="routine-feedback"><strong>Stop the movement.</strong><p>Tell us what changed so a gentler substitute can be used.</p><div className="feedback-actions"><button onClick={() => setRoutineFeedback('substitute')} type="button">Use a gentler substitute</button><button onClick={() => setRoutineFeedback('end')} type="button">End this routine section</button></div></div>}
              {routineFeedback === 'substitute' && <div className="routine-feedback"><strong>Skip this movement for now.</strong><p>Do not test the painful movement again right now. Continue only with comfortable, pain-free options.</p></div>}
            </div>
            )}
            {routineComplete && <div className="routine-feedback-form">
              <strong>How did recovery feel?</strong>
              <div className="feedback-fields">
                <label>Routine result<select value={feedback.completion} onChange={(event) => setFeedback({ ...feedback, completion: event.target.value })}><option value="">Choose</option><option>Full routine</option><option>Part of routine</option><option>Did not complete</option></select></label>
                <label>Feeling after<select value={feedback.feeling} onChange={(event) => setFeedback({ ...feedback, feeling: event.target.value })}><option value="">Choose</option><option>Better</option><option>Same</option><option>Worse</option></select></label>
                <label>Tightness<select value={feedback.tightness} onChange={(event) => setFeedback({ ...feedback, tightness: event.target.value })}><option value="">1–5</option>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Pain<select value={feedback.pain} onChange={(event) => setFeedback({ ...feedback, pain: event.target.value })}><option value="">0–10</option>{Array.from({ length: 11 }, (_, value) => <option key={value}>{value}</option>)}</select></label>
              </div>
              {feedback.feeling === 'Worse' && <p className="recovery-error">Feeling temporarily looser is not proof that an injury has healed. Stop and tell a qualified adult if symptoms worsen.</p>}
              {!isReplayingSavedRoutine && <button className="primary-button" disabled={isSavingPlan} onClick={saveRecoveryPlan} type="button">{isSavingPlan ? 'Saving recovery plan...' : 'Save recovery plan'}</button>}
              {isReplayingSavedRoutine && <p className="recovery-saved-message">Completed a favorite routine. This replay will not create a new recovery plan.</p>}
              {!isReplayingSavedRoutine && generatedPlanSaved && <p className="recovery-saved-message">Saved to your Recovery history.</p>}
            </div>}
          </section>

        </>
      )}
      {hurtReport && createPortal(
        <div className="modal-backdrop" onClick={() => setHurtReport(null)}>
          <section className="event-modal routine-hurt-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <p className="eyebrow">Stop this movement</p>
            <h2>Tell us what changed.</h2>
            <label className="compact-field">Where does it hurt?<input value={hurtReport.area} onChange={(event) => setHurtReport((current) => ({ ...current, area: event.target.value }))} /></label>
            <label className="compact-field">What does it feel like?<select value={hurtReport.type} onChange={(event) => setHurtReport((current) => ({ ...current, type: event.target.value }))}><option value="">Choose</option><option>Sharp</option><option>Aching</option><option>Pulling</option><option>Unstable</option><option>Numb or tingling</option></select></label>
            <label className="compact-field">Pain level<select value={hurtReport.severity} onChange={(event) => setHurtReport((current) => ({ ...current, severity: event.target.value }))}><option value="">Choose</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}/10</option>)}</select></label>
            <label className="compact-field">Was this a previously reported issue?<select value={hurtReport.sameIssue} onChange={(event) => setHurtReport((current) => ({ ...current, sameIssue: event.target.value }))}><option value="">Choose</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
            <p className="recovery-error">Do not push through sharp, worsening, unstable, numb, or tingling symptoms.</p>
            <div className="routine-hurt-actions"><button className="secondary-button" onClick={() => handleHurtReport('skip')} type="button">Skip this movement</button><button className="remove-button" onClick={() => handleHurtReport('end')} type="button">End routine</button></div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}

function getFallbackSteps(plan) {
  return (plan.recovery ?? []).slice(0, 6).map((title, index) => ({
    id: `fallback-${index}-${title}`,
    title,
    when: index === 0 ? 'Right now' : 'Tonight',
    why: 'This is a practical next step from your session recovery guidance.',
  }))
}

function getFallbackTimeline(plan) {
  return [
    { title: 'Right now', items: plan.preparation ?? ['Cool down gently and begin your normal hydration routine.'] },
    { title: 'Within two hours', items: plan.during ?? ['Have a normal meal or snack and use comfortable mobility only.'] },
    { title: 'Tonight', items: plan.recovery ?? ['Avoid extra intense training and protect your sleep.'] },
    { title: 'Tomorrow morning', items: ['Recheck soreness and pain before the next readiness check.'] },
  ]
}

function getRecoveryLabel(plan) {
  return plan.label ?? 'Personalized recovery'
}

function getDateValue(item) {
  return new Date(item?.createdAt ?? `${item?.date ?? '1970-01-01'}T12:00:00`).getTime()
}

function formatCheckoutDate(date) {
  if (!date) return 'Recent session'
  return format(parseISO(date), 'EEE, MMM d')
}

function getTimeAvailableMinutes(value) {
  const minutes = Number.parseInt(value, 10)
  return Number.isFinite(minutes) ? Math.max(10, Math.min(30, minutes)) : 15
}

function formatCompletionRecency(value) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min ago`
  const hours = Math.round(elapsedMinutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function buildRoutine(routine, availableMinutes, excludedExercises = []) {
  const excluded = new Set(excludedExercises)
  const individualSteps = routine.flatMap((exercise) => {
    const side = String(exercise.side ?? '').toLowerCase()

    if (!/each side|left and right|right and left/.test(side)) return excluded.has(getExerciseFamily(exercise.name)) ? [] : [exercise]

    return ['Left', 'Right'].map((currentSide) => ({
      ...exercise,
      name: new RegExp(currentSide, 'i').test(exercise.name ?? '')
        ? exercise.name
        : `${exercise.name} - ${currentSide}`,
      side: `${currentSide} side`,
    })).filter((exercise) => !excluded.has(getExerciseFamily(exercise.name)))
  })

  const alternatives = fallbackRoutine.filter((exercise) => !excluded.has(getExerciseFamily(exercise.name)) && !individualSteps.some((item) => getExerciseFamily(item.name) === getExerciseFamily(exercise.name)))
  return constrainRoutine(individualSteps, availableMinutes, alternatives)
}

function getExerciseFamily(name = '') {
  return String(name).replace(/\s*-\s*(left|right)$/i, '').trim().toLowerCase()
}

function constrainRoutine(routine, availableMinutes, alternatives = []) {
  const targetSeconds = availableMinutes * 60
  let totalSeconds = 0
  const constrained = []

  for (const exercise of [...routine, ...alternatives]) {
    const duration = Number(exercise.durationSeconds ?? 45)
    const remaining = targetSeconds - totalSeconds

    if (remaining <= 0) break

    if (duration <= remaining) {
      constrained.push(exercise)
      totalSeconds += duration
      continue
    }

    if (remaining >= 20 && exercise.durationSeconds) {
      constrained.push({ ...exercise, durationSeconds: remaining })
      totalSeconds += remaining
    }
  }

  // AI routines normally supply a complete sequence. This only fills a short
  // fallback with familiar movements so the selected time remains honest.
  let fallbackIndex = 0
  while (totalSeconds < targetSeconds && alternatives.length > 0) {
    const exercise = alternatives[fallbackIndex % alternatives.length]
    const remaining = targetSeconds - totalSeconds
    const duration = Number(exercise.durationSeconds ?? 45)
    const fillDuration = Math.min(duration, remaining)

    if (fillDuration < 20) {
    const last = constrained[constrained.length - 1]
      if (last?.durationSeconds) last.durationSeconds += fillDuration
      break
    }

    constrained.push({
      ...exercise,
      durationSeconds: fillDuration,
      name: fallbackIndex < alternatives.length ? exercise.name : `${exercise.name} - Repeat`,
    })
    totalSeconds += fillDuration
    fallbackIndex += 1
  }

  return constrained.length > 0 ? constrained : alternatives.slice(0, 1)
}

function formatSeconds(value) {
  const seconds = Math.max(0, Number(value) || 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
