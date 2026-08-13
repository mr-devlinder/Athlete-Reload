import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { Slider } from './FormControls'
import { bodyPainAreas, createEmptyPainMap } from '../data/bodyPainMap'
import { estimatePlannedMinutes } from '../utils/events'
import { VoiceDraftButton } from './VoiceDraftButton'
import { getSportWorkloadFields } from '../data/sportProfiles'
import { getWorkloadFieldDisplay, workloadInputToCanonical } from '../utils/units'
import { useModalAccessibility } from '../hooks/useModalAccessibility'
import { clearDraft, loadDraft, saveDraft as saveScopedDraft } from '../utils/draftStorage'
import { BodyPainMap } from './BodyPainMap'
import { getCheckoutFlowState } from '../domain/wellness/progressiveFlow'
import { getCheckoutQuestionSchema } from '../domain/events/checkoutQuestionSchema'
import '../styles/checkout-redesign.css'

const painChanges = ['Improved', 'Unchanged', 'Slightly worse', 'Much worse']
const participationLevels = [
  { label: 'Completed normally', value: 'Full' },
  { label: 'Shortened', value: 'Partial' },
  { label: 'Modified', value: 'Modified' },
  { label: 'Stopped early', value: 'Stopped early' },
  { label: 'Did not participate', value: 'Did not participate' },
]
const sessionContentOptions = ['Technical work', 'Tactical work', 'Scrimmage', 'Sprinting', 'Endurance', 'Strength', 'Plyometrics', 'Recovery']
const symptomOptions = ['Dizziness', 'Nausea', 'Headache', 'Unusual shortness of breath']
const completionReasons = ['Pain or symptoms', 'Fatigue', 'Coach decision', 'Schedule or time', 'Equipment or environment', 'Other']

export function CheckoutModal({ athleteProfile, checkout, event, preCheckIn, preCheckInPainReports, onClose, onOpenRecovery, onSave }) {
  const draftIdentity = useMemo(() => ({ accountId: 'active-session', feature: 'checkout', scope: event.id }), [event.id])
  const [isEditing, setIsEditing] = useState(!checkout)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [draft, setDraft] = useState(() => checkout ? getInitialDraft(event, checkout, preCheckIn, preCheckInPainReports) : loadDraft(draftIdentity) ?? getInitialDraft(event, checkout, preCheckIn, preCheckInPainReports))
  const workloadFields = getSportWorkloadFields(athleteProfile?.sport, {
    phase: 'checkout',
    position: athleteProfile?.position,
    eventType: event.type,
  })
  const relevantSessionContentOptions = getSessionContentOptions(event)
  const baseQuestionSchema = getCheckoutQuestionSchema(event, athleteProfile)
  const questionSchema = draft.participation === 'Did not participate'
    ? { ...baseQuestionSchema, showSessionContent: false, showHydration: false, showFuel: false, performanceLabel: 'How did the decision feel?', performanceOptions: ['Right call', 'Precautionary', 'Not my choice', 'Need follow-up'] }
    : baseQuestionSchema
  const flowState = getCheckoutFlowState(draft, questionSchema)
  const durationMax = Math.max(60, Math.min(240, Math.ceil((Number(draft.plannedMinutes) || 60) * 1.75 / 15) * 15))
  const dialogRef = useModalAccessibility(true, onClose)

  useEffect(() => {
    document.body.classList.add('modal-open')

    return () => document.body.classList.remove('modal-open')
  }, [])
  useEffect(() => { if (isEditing) saveScopedDraft(draftIdentity, draft) }, [draft, draftIdentity, isEditing])

  function updateDraft(field, value) {
    setSaveError('')
    setDraft((current) => {
      if (field === 'participation' && value === 'Did not participate') {
        return {
          ...current,
          actualMinutes: 0,
          difficulty: 0,
          sessionContent: [],
          [field]: value,
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  async function saveDraft() {
    setIsSaving(true)
    setSaveError('')
    try {
      await onSave(event, draft, checkout)
      clearDraft(draftIdentity)
      setIsEditing(false)
    } catch (error) {
      console.error(error)
      setSaveError(getCheckoutSaveError(error))
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop">
      <section aria-labelledby="checkout-dialog-title" className="event-modal checkout-modal glass-panel" ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="checkout-modal-surface">
          <div className="checkout-dialog-header schedule-header">
            <div id="checkout-dialog-title"><span className="checkout-kicker">{checkout && !isEditing ? 'Planned vs actual' : 'Post-event checkout'}</span><h1>{event.title || event.type}</h1><p>{questionSchema.contextLabel} · {event.date}{event.time ? ` at ${event.time}` : ''} · about 45 seconds</p></div>
            <button className="ghost-close" onClick={onClose} type="button">
              Close
            </button>
          </div>

          {checkout && !isEditing ? (
            <CheckoutComparison checkout={checkout} event={event} onEdit={() => setIsEditing(true)} onOpenRecovery={onOpenRecovery} />
          ) : (
            <div className="checkout-questionnaire modal-form">
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <section className="checkout-step checkout-first-step">
              <div className="checkout-step-heading"><span>START</span><div><h2>How did the event go?</h2><p>Choose the closest match. The next questions adapt to it.</p></div></div>
              <ChoiceGrid options={participationLevels} value={draft.participation} onChange={(value) => updateDraft('participation', value)} />
              <div className="checkout-voice-shortcut"><span>Want to say it instead?</span><VoiceDraftButton logType="post_checkout" onApply={(voiceDraft) => Object.entries(voiceDraft).forEach(([field, value]) => { if (value !== null && field !== 'notes') updateDraft(field, value) })} /></div>
              {draft.participation && draft.participation !== 'Did not participate' && <div className="progressive-branch checkout-effort-branch">
                <Slider label={questionSchema.durationLabel} min={0} max={durationMax} step={5} lowLabel="0 min" highLabel={`${durationMax}+ min`} formatValue={(value) => `${value} min`} value={draft.actualMinutes} onChange={(value) => updateDraft('actualMinutes', value)} />
                {questionSchema.showRpe && <Slider label="How hard did it feel?" min={0} max={10} lowLabel="0 · Rest" highLabel="10 · Max effort" formatValue={(value) => `${value} · ${getRpeDescription(value)}`} value={draft.difficulty} onChange={(value) => updateDraft('difficulty', value)} />}
                {draft.actualMinutes != null && draft.difficulty != null && <div className="inline-load-result"><span>Session load</span><strong>{getSessionLoad(draft)}</strong><small>{Number(draft.actualMinutes) || 0} min × {draft.difficulty} effort</small></div>}
              </div>}
              {['Partial', 'Modified', 'Stopped early', 'Did not participate'].includes(draft.participation) && <div className="progressive-branch checkout-change-branch"><strong>What changed?</strong><ChoiceGrid compact options={completionReasons.map((value) => ({ label: value, value }))} value={draft.completionReason} onChange={(value) => updateDraft('completionReason', value)} /></div>}
            </section>

            {draft.participation && draft.actualMinutes != null && <section className="checkout-step progressive-step"><div className="checkout-step-heading"><span>NOW</span><div><h2>How do you feel now?</h2><p>This becomes the starting point for your AI recovery plan.</p></div></div><div className="checkout-response-grid"><Slider label="Current fatigue" max={5} min={0} lowLabel="0 · Fresh" highLabel="5 · Exhausted" unit=" / 5" value={draft.postFatigue} onChange={(value) => updateDraft('postFatigue', value)} /><Slider label="Overall soreness" max={5} min={0} lowLabel="0 · None" highLabel="5 · Severe" unit=" / 5" value={draft.postSoreness} onChange={(value) => updateDraft('postSoreness', value)} /></div><div className="performance-choice" role="group" aria-label={questionSchema.performanceLabel}><span>{questionSchema.performanceLabel}</span>{questionSchema.performanceOptions.map((option) => <button aria-pressed={draft.performanceRating === option} key={option} onClick={() => updateDraft('performanceRating', option)} type="button">{option}</button>)}</div></section>}

            {draft.performanceRating && <section className="checkout-step checkout-safety-step progressive-step"><div className="checkout-step-heading"><span>CHECK</span><div><h2>Any new or worse pain?</h2><p>Answer no and you are done with this topic.</p></div></div>
              <div className="binary-choice"><button aria-pressed={draft.painConcern === false} onClick={() => { updateDraft('painConcern', false); updateDraft('newPain', false); updateDraft('painChange', 'Unchanged'); updateDraft('painMap', createEmptyPainMap()) }} type="button">No</button><button aria-pressed={draft.painConcern === true} onClick={() => updateDraft('painConcern', true)} type="button">Yes</button></div>
              {draft.painConcern && <div className="progressive-branch"><BodyPainMap details={draft.painDetails} value={draft.painMap} onDetailsChange={(value) => updateDraft('painDetails', value)} onChange={(value) => updateDraft('painMap', value)} />
              <div className="select-row">
                <label className="compact-field">
                  Existing pain
                  <select value={draft.painChange} onChange={(event) => updateDraft('painChange', event.target.value)}>
                    {painChanges.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label className="compact-field">
                  Movement or performance changed?
                  <select value={String(draft.movementChanged)} onChange={(event) => updateDraft('movementChanged', event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>
                </label>
              </div></div>}
            </section>}

            {draft.painConcern !== null && draft.painConcern !== undefined && <section className="checkout-step checkout-safety-step progressive-step"><div className="checkout-step-heading"><span>CHECK</span><div><h2>Anything unusual after the event?</h2><p>Dizziness, nausea, headache, or unusual shortness of breath.</p></div></div><div className="binary-choice"><button aria-pressed={draft.symptomConcern === false} onClick={() => { updateDraft('symptomConcern', false); updateDraft('heatSymptoms', []) }} type="button">No</button><button aria-pressed={draft.symptomConcern === true} onClick={() => updateDraft('symptomConcern', true)} type="button">Yes</button></div>{draft.symptomConcern && <fieldset className="checkout-symptoms progressive-branch"><legend>What did you notice?</legend><CheckboxGroup options={symptomOptions} value={draft.heatSymptoms} onChange={(value) => updateDraft('heatSymptoms', value)} /></fieldset>}</section>}

            {draft.symptomConcern !== null && draft.symptomConcern !== undefined && (questionSchema.showSessionContent || questionSchema.showHydration || questionSchema.showFuel) && <section className="checkout-step checkout-event-context progressive-step"><div className="checkout-step-heading"><span>{questionSchema.contextLabel.toUpperCase()}</span><div><h2>The details that matter for this event</h2><p>These appear because of the event type and planned duration.</p></div></div>{questionSchema.showSessionContent && draft.participation !== 'Did not participate' && <div className="checkout-section"><strong>What did the session include?</strong><CheckboxGroup options={relevantSessionContentOptions} value={draft.sessionContent.filter((item) => relevantSessionContentOptions.includes(item))} onChange={(value) => updateDraft('sessionContent', value)} /></div>}<div className="checkout-context-choices">{questionSchema.showHydration && <div><strong>Fluids during</strong><ChoiceGrid compact options={['None', 'Some', 'Regular access', 'Not tracked'].map((value) => ({ label: value, value }))} value={draft.hydrationDuring} onChange={(value) => updateDraft('hydrationDuring', value)} /></div>}{questionSchema.showFuel && <div><strong>Fuel during</strong><ChoiceGrid compact options={['None', 'Snack or gel', 'Meal between efforts', 'Not tracked'].map((value) => ({ label: value, value }))} value={draft.fuelDuring} onChange={(value) => updateDraft('fuelDuring', value)} /></div>}</div></section>}

            <footer className="checkout-submit"><div><strong>{flowState.complete ? 'Ready for your recovery plan' : `${flowState.missing.length} answer${flowState.missing.length === 1 ? '' : 's'} remaining`}</strong><span>{flowState.complete ? 'AI will use the event, pre-check-in, load, pain, symptoms, fuel, and hydration context.' : 'Continue through the questions that appear above.'}</span></div><button className="primary-button" disabled={isSaving || !flowState.complete} onClick={saveDraft} type="button">{isSaving ? 'Generating…' : 'Generate recovery plan'}</button></footer>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function getCheckoutSaveError(error) {
  const message = error instanceof Error
    ? error.message
    : [error?.message, error?.details, error?.hint].find(Boolean)

  return message || 'We could not save this checkout. Please try again.'
}

function CheckoutComparison({ checkout, event, onEdit, onOpenRecovery }) {
  return <div className="checkout-complete-summary">
    <div className="checkout-complete-mark">✓</div>
    <div><span>Checkout complete</span><h2>{event.title || event.type} is closed out.</h2><p>{checkout.actualMinutes ?? 0} minutes · {checkout.participation === 'Full' ? 'Completed normally' : checkout.participation} · {checkout.difficulty ?? 0}/10 effort</p></div>
    <div className="checkout-complete-actions"><button className="primary-button" onClick={onOpenRecovery} type="button">Open Recovery</button><button className="secondary-button" onClick={onEdit} type="button">Edit checkout</button></div>
  </div>
}

function getInitialDraft(event, checkout, preCheckIn, preCheckInPainReports) {
  return {
    actualMinutes: checkout?.actualMinutes ?? 0,
    completionLevel: checkout?.completionLevel ?? 'Full',
    completionReason: checkout?.completionReason ?? '',
    difficulty: checkout?.difficulty ?? 0,
    fatigueAffectedTechnique: checkout?.fatigueAffectedTechnique ?? false,
    fuelDuring: checkout?.fuelDuring ?? null,
    heatSymptoms: checkout?.heatSymptoms ?? [],
    hydrationDuring: checkout?.hydrationDuring ?? null,
    mentalFocus: checkout?.mentalFocus ?? null,
    motivation: checkout?.motivation ?? null,
    movementChanged: checkout?.movementChanged ?? false,
    newPain: checkout?.newPain ?? false,
    painConcern: checkout ? Boolean(checkout.newPain || ['Slightly worse', 'Much worse'].includes(checkout.painChange)) : null,
    painDetails: checkout?.painDetails ?? preCheckIn?.painDetails ?? {},
    painChange: checkout?.painChange ?? 'Unchanged',
    painMap: checkout?.painMap ?? getPreCheckInPainMap(preCheckIn, preCheckInPainReports),
    participation: checkout?.participation ?? checkout?.completionLevel ?? null,
    plannedMinutes: checkout?.plannedMinutes ?? event.plannedMinutes ?? estimatePlannedMinutes(event.load),
    postFatigue: checkout?.postFatigue ?? 0,
    postSoreness: checkout?.postSoreness ?? 0,
    performanceRating: checkout?.performanceRating ?? null,
    symptomConcern: checkout ? (checkout.heatSymptoms?.length > 0) : null,
    sessionContent: (checkout?.sessionContent ?? []).filter((item) => getSessionContentOptions(event).includes(item)),
    sportWorkload: checkout?.sportWorkload ?? event.sportWorkload ?? {},
    cramping: checkout?.cramping ?? false,
    notes: checkout?.notes ?? '',
  }
}

function SportWorkloadField({ field, onChange, unitSystem = 'imperial', value }) {
  const display = getWorkloadFieldDisplay(field, value, unitSystem)
  return (
    <label className="compact-field">
      {field.label}{display.label ? ` (${display.label})` : ''}
      {field.type === 'select' ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Not recorded</option>
          {field.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <input min="0" step={display.step} type="number" value={display.value} onChange={(event) => onChange(workloadInputToCanonical(field, event.target.value, unitSystem))} />
      )}
    </label>
  )
}

function getPreCheckInPainMap(preCheckIn, painReports = []) {
  const savedMap = preCheckIn?.painMap

  if (savedMap && Object.keys(savedMap).length > 0) {
    return { ...createEmptyPainMap(), ...savedMap }
  }

  if (painReports.length > 0) {
    return painReports.reduce((map, report) => {
      const area = bodyPainAreas.find((item) => item.label === report.bodyPart && item.side === report.side)
        ?? bodyPainAreas.find((item) => item.label === report.bodyPart)

      return area ? { ...map, [area.id]: Number(report.severity ?? 0) } : map
    }, createEmptyPainMap())
  }

  const painDetails = preCheckIn?.painDetails ?? {}
  const areaIds = Object.keys(painDetails).filter((areaId) => bodyPainAreas.some((area) => area.id === areaId))

  if (areaIds.length === 0 || Number(preCheckIn?.pain ?? 0) <= 0) {
    return createEmptyPainMap()
  }

  const level = Math.max(1, Math.min(10, Number(preCheckIn.pain))) * 10

  return areaIds.reduce((map, areaId) => ({ ...map, [areaId]: level }), createEmptyPainMap())
}

function ChoiceGrid({ compact = false, options, value, onChange }) {
  return <div className={`checkout-choice-grid${compact ? ' compact' : ''}`}>{options.map((option) => <button aria-pressed={value === option.value} key={option.value} onClick={() => onChange(option.value)} type="button"><strong>{option.label}</strong></button>)}</div>
}

function CheckboxGroup({ options, value = [], onChange }) {
  return (
    <div className="checkout-checkbox-grid">
      {options.map((option) => {
        const checked = value.includes(option)

        return (
          <label className={checked ? 'checkout-checkbox checked' : 'checkout-checkbox'} key={option}>
            <input
              checked={checked}
              type="checkbox"
              onChange={(event) => onChange(event.target.checked ? [...value, option] : value.filter((item) => item !== option))}
            />
            <span>{option}</span>
          </label>
        )
      })}
    </div>
  )
}

function getSessionContentOptions(event) {
  const eventName = `${event?.type ?? ''} ${event?.title ?? ''}`.toLowerCase()
  if (/rest|recovery/.test(eventName)) return ['Recovery']
  if (/strength|gym|lift|weight/.test(eventName)) return ['Strength', 'Plyometrics', 'Recovery']
  if (/race|run|track|conditioning|endurance|road|speed/.test(eventName)) return ['Sprinting', 'Endurance', 'Plyometrics', 'Recovery']
  if (/game|match|meet|tournament|bout|round/.test(eventName)) return ['Technical work', 'Tactical work', 'Scrimmage', 'Sprinting', 'Endurance', 'Plyometrics']
  if (/practice|training|workout|session/.test(eventName)) return ['Technical work', 'Tactical work', 'Scrimmage', 'Sprinting', 'Endurance', 'Strength', 'Plyometrics', 'Recovery']
  return sessionContentOptions
}

function getSessionLoad(draft) {
  return Math.round((Number(draft.actualMinutes) || 0) * (Number(draft.difficulty) || 0))
}

function getRpeDescription(value) {
  if (value === 0) return 'Rest'
  if (value <= 2) return 'Very light effort'
  if (value <= 4) return 'Light effort'
  if (value <= 6) return 'Moderate effort'
  if (value <= 8) return 'Hard effort'

  return 'Maximum effort'
}
