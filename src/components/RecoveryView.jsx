import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { m } from 'motion/react'
import { AppIcon } from './AppIcon'
import { normalizeRecoveryExercise } from '../domain/recovery'
import { buildVettedRoutine, getVettedSubstitute } from '../domain/recovery/routineBuilder'
import '../styles/recovery-rework.css'

const equipmentOptions = [
  'Exercise mat', 'Foam roller', 'Stretching strap', 'Yoga blocks', 'Resistance band', 'Mini band',
  'Massage ball', 'Massage stick', 'Towel', 'Chair or bench', 'Stability ball', 'Stationary bike',
  'Pool', 'Compression equipment',
]
const planTypeOptions = [
  { id: 'session', label: 'Session recovery', description: 'Respond to your latest workout, practice, and checkout.' },
  { id: 'competition', label: 'Competition recovery', description: 'Prioritize recovery after a match, race, meet, or game.' },
  { id: 'quick', label: 'Quick reset', description: 'A focused 5–10 minute reset when time is limited.' },
  { id: 'full-body', label: 'Full body mobility', description: 'Comfortable movement across the major body areas.' },
  { id: 'flexibility', label: 'Flexibility', description: 'Comfortable, unforced range-of-motion work.' },
  { id: 'targeted', label: 'Targeted area', description: 'Prioritize selected areas without treating pain.' },
  { id: 'recovery-day', label: 'Recovery day', description: 'Longer low-load movement, mobility, and downshift work.' },
  { id: 'pre-event', label: 'Pre-event mobility', description: 'Gentle dynamic movement appropriate before what comes next.' },
]
const targetAreaOptions = ['Shoulders / arms', 'Back / trunk', 'Hips', 'Quads / hamstrings', 'Knees', 'Calves / ankles / feet']

export function RecoveryView({ checkouts = [], generatedPlan, generatedPlanSaved = false, isReplayingSavedRoutine = false, generationStatus = 'idle', onCompleteSavedRoutine, onGeneratePlan, onReplaySavedRoutine, onReportRoutinePain, onSaveRecoveryPlan, recentCompletion, savedRoutines = [], schedule = [] }) {
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
  const routineVariationRef = useRef(0)
  const recoverySaveStartedRef = useRef(false)
  const [timeAvailable, setTimeAvailable] = useState('15 minutes')
  const [planType, setPlanType] = useState('session')
  const [targetedAreas, setTargetedAreas] = useState([])
  const [routineStarted, setRoutineStarted] = useState(false)
  const [routineIndex, setRoutineIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [routinePaused, setRoutinePaused] = useState(false)
  const [completedRoutineExercises, setCompletedRoutineExercises] = useState(() => new Set())
  const [routineFeedback, setRoutineFeedback] = useState(null)
  const [hurtReport, setHurtReport] = useState(null)
  const [excludedExercises, setExcludedExercises] = useState([])
  const [preferredSubstitutes, setPreferredSubstitutes] = useState([])
  const [routineComplete, setRoutineComplete] = useState(false)
  const [feedback, setFeedback] = useState({ completion: '', feeling: '', tightness: '', pain: '' })
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [savePlanMessage, setSavePlanMessage] = useState('')
  const [savedRoutinesOpen, setSavedRoutinesOpen] = useState(false)

  const plan = generatedPlan?.planType === planType ? generatedPlan : null
  const routineResult = buildVettedRoutine({
    selections: [...preferredSubstitutes, ...(plan?.routine?.exercises ?? [])],
    mode: plan?.planType ?? planType,
    availableMinutes: getTimeAvailableMinutes(timeAvailable),
    availableEquipment: equipment,
    excludedIds: excludedExercises,
    targetBodyParts: planType === 'targeted' ? targetedAreas : [],
    variationSeed: routineVariationRef.current,
  })
  const routine = routineResult.exercises.map(normalizeRecoveryExercise)
  const currentExercise = routine[routineIndex]
  const currentSubstitute = getVettedSubstitute(currentExercise, excludedExercises)
  const isPainAware = Boolean(plan?.routine?.painAware || plan?.painAware)
  const isRoutineOnlyPlan = ['flexibility', 'targeted', 'full-body', 'quick', 'recovery-day', 'pre-event'].includes(plan?.planType)

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
      if (action === 'substitute') {
        const substitute = getVettedSubstitute(currentExercise, excludedExercises)
        if (substitute) setPreferredSubstitutes((current) => [substitute, ...current.filter((item) => item.id !== substitute.id)])
      }
      setExcludedExercises((current) => [...new Set([...current, currentExercise?.id])])
      setRoutineIndex((current) => Math.max(0, Math.min(current, routine.length - 2)))
      setRoutineStarted(false)
      setRoutinePaused(false)
      setSecondsLeft(0)
    }
  }

  function handleGenerate() {
    recoverySaveStartedRef.current = false
    routineVariationRef.current += 1
    setRoutineFeedback(null)
    setRoutineComplete(false)
    setCompletedRoutineExercises(new Set())
    setExcludedExercises([])
    setPreferredSubstitutes([])
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
    if (!plan || isSavingPlan || generatedPlanSaved || recoverySaveStartedRef.current) return

    recoverySaveStartedRef.current = true
    setIsSavingPlan(true)
    setSavePlanMessage('')
    try {
      const hasFeedback = Object.values(feedback).some(Boolean)
      const saved = await onSaveRecoveryPlan?.({
        ...plan,
        routineProgress: {
          completed: completedRoutineExercises.size,
          total: routine.length,
        },
        ...(hasFeedback ? { feedback: { ...feedback, recordedAt: new Date().toISOString() } } : {}),
      })
      if (!saved) recoverySaveStartedRef.current = false
      setSavePlanMessage(saved ? 'Saved to your Recovery history.' : 'The recovery plan could not be saved. Please try again.')
    } catch (error) {
      recoverySaveStartedRef.current = false
      console.error('Unable to save recovery plan', error)
      setSavePlanMessage('The recovery plan could not be saved. Please try again.')
    } finally {
      setIsSavingPlan(false)
    }
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
          <p className="page-header-description">Turn the latest checkout into a practical recovery plan that fits the session you actually completed.</p>
        </div>
      </section>

      {['session', 'competition'].includes(planType) && latestCheckout && <section className="recovery-latest recovery-checkout-context glass-panel">
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
      </section>}

      <section className="recovery-builder-panel glass-panel">
          <div className="recovery-generator">
            <div>
              <strong>Build your recovery plan</strong>
              <p>Choose the outcome you need. The plan adapts to your session, sport, pain, nutrition, recovery history, and what is next.</p>
            </div>
            <div className="recovery-type-grid" role="radiogroup" aria-label="Recovery plan type">
              {planTypeOptions.map((option, index) => (
                <m.button
                  aria-checked={planType === option.id}
                  className={planType === option.id ? 'selected' : ''}
                  key={option.id}
                  onClick={() => selectPlanType(option.id)}
                  role="radio"
                  type="button"
                  whileHover={{ y: -5, scale: 1.015 }}
                  whileTap={{ scale: .98 }}
                >
                  <span className="recovery-mode-visual"><b>{String(index + 1).padStart(2, '0')}</b><i /></span>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </m.button>
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
                  {(planType === 'quick' ? ['5 minutes', '10 minutes'] : ['5 minutes', '10 minutes', '15 minutes', '20 minutes', '25 minutes', '30 minutes']).map((option) => <option key={option}>{option}</option>)}
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
              <button className="primary-button" disabled={generationStatus === 'loading' || (['session', 'competition'].includes(planType) && !latestCheckout) || (planType === 'targeted' && targetedAreas.length === 0)} onClick={handleGenerate} type="button">
                <AppIcon name="spark" size={18} />
                {generationStatus === 'loading' ? 'Building plan...' : plan ? 'Regenerate plan' : 'Generate recovery plan'}
              </button>
              <button aria-expanded={savedRoutinesOpen} className="load-saved-routines-button" onClick={() => setSavedRoutinesOpen((current) => !current)} type="button">
                <AppIcon name="folder" size={18} />
                Load saved routines
              </button>
            </div>
            {['session', 'competition'].includes(planType) && !latestCheckout && <p className="recovery-context-note">No checkout is available yet. Choose another option to build a standalone routine.</p>}
            {generationStatus === 'error' && <p className="recovery-error">The recovery plan could not be generated. Check your connection and try again.</p>}
            {recentCompletion?.completedAt && (
              <p className="recovery-context-note">Last recovery completed {formatCompletionRecency(recentCompletion.completedAt)}. This is considered when pacing the next plan.</p>
            )}
          </div>
          {savedRoutinesOpen && (
            <div className="saved-routine-library">
              <strong>Saved routines</strong>
              {savedRoutines.some((routine) => routine.isFavorite) ? <div>
                {savedRoutines.filter((routine) => routine.isFavorite).map((routine) => (
                  <button key={routine.id} onClick={() => onReplaySavedRoutine?.(routine)} type="button">
                    <span>{routine.title}</span>
                    <em>Replay</em>
                  </button>
                ))}
              </div> : <p className="recovery-context-note">Favorite a routine from Recovery history to load it here.</p>}
            </div>
          )}
      </section>

      {plan && (
        <>
          {!isRoutineOnlyPlan && plan.reportSections?.length > 0 && <section className="recovery-plan-panel glass-panel">
            <div className="recovery-section-heading"><div><p className="eyebrow">Personalized recovery report</p><h2>What matters most now</h2></div></div>
            <div className="report-section-grid recovery-report-grid">{plan.reportSections.map((section) => <article className={`report-section${section.id === 'recovery-priorities' ? ' priority' : ''}`} key={section.id}>
              <strong>{section.title}</strong>
              {section.summary && <p>{section.summary}</p>}
              {section.items?.length > 0 && <ol>{section.items.map((item) => <li key={item}>{item}</li>)}</ol>}
            </article>)}</div>
          </section>}

          <section className="recovery-routine-panel recovery-plan-panel glass-panel">
            <div className="recovery-section-heading">
              <div>
                <p className="eyebrow">Personalized routine</p>
                <h2>{plan.routine?.title ?? 'Cooldown and mobility'}</h2>
              </div>
              <span>About {Math.max(1, Math.ceil(routineResult.estimatedSeconds / 60))} min</span>
            </div>
            {plan.routine?.goal && <p className="routine-goal"><strong>Routine goal:</strong> {plan.routine.goal}</p>}
            <p className="routine-intro">{plan.routine?.summary ?? 'Use this as an optional way to relax and maintain comfortable mobility, not as a guaranteed repair.'}</p>
            {isPainAware && <div className="pain-aware-callout">Your reported symptoms changed this routine. Do not stretch a painful area through discomfort.</div>}
            {!routineComplete && (
              <details className="routine-preview">
                <summary>View routine plan ({routine.length} exercises)</summary>
                <ol className="routine-plan-list">
                  {routine.map((exercise, index) => (
                    <li className="routine-plan-step" key={`${exercise.name}-${exercise.side}-${index}`}>
                      <strong>{exercise.name}</strong>
                      <span className="routine-step-meta">{formatExerciseBodyArea(exercise)} · {formatExerciseDose(exercise)}</span>
                      <p><strong>Setup:</strong> {exercise.setup}</p>
                      <p><strong>Movement:</strong> {exercise.movement}</p>
                      <p><strong>Complete when:</strong> {exercise.completionCue}</p>
                      <div className="routine-step-cues">
                        <span><b>You should feel:</b> {exercise.feel ?? 'Mild, comfortable tension or controlled movement.'}</span>
                        <span><b>Stop if:</b> {exercise.stopConditions}</span>
                        <span><b>Equipment:</b> {exercise.equipment}</span>
                      </div>
                      <em>{exercise.purpose}</em>
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
            <m.div className="routine-player" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
              <div className="routine-player-header">
                <span>Exercise {routineIndex + 1} of {routine.length}</span>
                <strong>{currentExercise?.type ?? 'Mobility'}</strong>
              </div>
              <div className="routine-progress" aria-label={`${routineIndex + 1} of ${routine.length} exercises complete`}>
                <span style={{ width: `${((routineIndex + 1) / Math.max(1, routine.length)) * 100}%` }} />
              </div>
              <h3>{currentExercise?.name}</h3>
              <div className="routine-current-meta">
                <span><small>Body area</small><strong>{formatExerciseBodyArea(currentExercise)}</strong></span>
                <span><small>Duration or repetitions</small><strong>{formatExerciseDose(currentExercise)}</strong></span>
              </div>
              <div className="routine-guidance">
                <details open><summary>How to do it</summary><div><p><strong>Setup</strong>{currentExercise?.setup}</p><p><strong>Movement</strong>{currentExercise?.movement}</p><p><strong>Complete when</strong>{currentExercise?.completionCue}</p></div></details>
                <details><summary>What you should feel</summary><p>{currentExercise?.feel ?? 'Mild, comfortable tension or controlled movement.'}</p></details>
                <details><summary>What to avoid</summary><p>{currentExercise?.stopConditions}</p></details>
                <details><summary>Why this is here</summary><p>{currentExercise?.purpose} {currentExercise?.equipment ? `Equipment: ${currentExercise.equipment}.` : ''}</p></details>
              </div>
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
            </m.div>
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
              {!isReplayingSavedRoutine && <button className="primary-button" disabled={isSavingPlan || generatedPlanSaved} onClick={saveRecoveryPlan} type="button">{isSavingPlan ? 'Saving recovery plan...' : generatedPlanSaved ? 'Recovery plan saved' : 'Save recovery plan'}</button>}
              {isReplayingSavedRoutine && <p className="recovery-saved-message">Completed a favorite routine. This replay will not create a new recovery plan.</p>}
              {!isReplayingSavedRoutine && (savePlanMessage || generatedPlanSaved) && <p className={savePlanMessage.startsWith('Saved') || generatedPlanSaved ? 'recovery-saved-message' : 'recovery-error'}>{savePlanMessage || 'Saved to your Recovery history.'}</p>}
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
            <div className="routine-hurt-actions">{currentSubstitute && <button className="primary-button" onClick={() => handleHurtReport('substitute')} type="button">Use vetted substitute</button>}<button className="secondary-button" onClick={() => handleHurtReport('skip')} type="button">Skip this movement</button><button className="remove-button" onClick={() => handleHurtReport('end')} type="button">End routine</button></div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
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
  return Number.isFinite(minutes) ? Math.max(5, Math.min(30, minutes)) : 15
}

function formatCompletionRecency(value) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min ago`
  const hours = Math.round(elapsedMinutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatExerciseBodyArea(exercise) {
  return [exercise?.side, exercise?.bodyRegion ?? exercise?.area].filter(Boolean).join(' · ')
}

function formatExerciseDose(exercise) {
  const dose = exercise?.doseModel === 'timer' || exercise?.durationSeconds
    ? `${exercise.durationSeconds} seconds`
    : `${exercise?.reps ?? 6} controlled reps`
  const sets = Number(exercise?.sets ?? 1)
  const rest = Number(exercise?.restSeconds ?? 0)
  return `${sets > 1 ? `${sets} sets × ` : ''}${dose}${rest > 0 ? ` · ${rest}s rest` : ''}`
}

function formatSeconds(value) {
  const seconds = Math.max(0, Number(value) || 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
