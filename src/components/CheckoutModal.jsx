import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { Slider } from './FormControls'
import { PerformanceQuote, RecoveryPlanCard } from './RecommendationCard'
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
const participationLevels = ['Full', 'Modified', 'Partial', 'Did not participate']
const sessionContentOptions = ['Technical work', 'Tactical work', 'Scrimmage', 'Sprinting', 'Endurance', 'Strength', 'Plyometrics', 'Recovery']
const symptomOptions = ['Dizziness', 'Nausea', 'Headache', 'Unusual shortness of breath']

export function CheckoutModal({ athleteProfile, checkout, event, preCheckIn, preCheckInPainReports, onClose, onSave }) {
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
  const questionSchema = getCheckoutQuestionSchema(event, athleteProfile)
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
      setSaveError(error instanceof Error ? error.message : 'We could not generate the AI recovery plan. Please try again.')
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
            <CheckoutComparison checkout={checkout} event={event} preCheckIn={preCheckIn} onEdit={() => setIsEditing(true)} />
          ) : (
            <div className="checkout-questionnaire modal-form">
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <section className="checkout-step"><div className="checkout-step-heading"><span>01</span><div><h2>What actually happened?</h2><p>Record participation, time, and effort.</p></div></div><div className="checkout-core-grid"><label className="compact-field">Participation<select value={draft.participation ?? ''} onChange={(changeEvent) => updateDraft('participation', changeEvent.target.value)}><option disabled value="">Choose</option>{participationLevels.map((option) => <option key={option}>{option}</option>)}</select></label><label className="compact-field">{questionSchema.durationLabel}<span className="checkout-input-unit"><input min="0" type="number" value={draft.actualMinutes ?? ''} onChange={(changeEvent) => updateDraft('actualMinutes', changeEvent.target.value)} /><em>min</em></span></label>{questionSchema.showRpe && draft.participation && draft.participation !== 'Did not participate' && <label className="compact-field">Session effort (RPE)<select value={draft.difficulty ?? ''} onChange={(event) => updateDraft('difficulty', Number(event.target.value))}><option disabled value="">Choose 0–10</option>{Array.from({ length: 11 }, (_, value) => <option key={value} value={value}>{value} · {getRpeDescription(value)}</option>)}</select></label>}</div>{questionSchema.showRpe && draft.difficulty != null && <div className="inline-load-result"><span>Session load</span><strong>{getSessionLoad(draft)}</strong><small>{Number(draft.actualMinutes) || 0} min × {draft.difficulty} RPE</small></div>}</section>

            <section className="checkout-step"><div className="checkout-step-heading"><span>02</span><div><h2>{questionSchema.performanceLabel}</h2><p>Compare this session with what is normal for you.</p></div></div><div className="performance-choice" role="group" aria-label={questionSchema.performanceLabel}>{questionSchema.performanceOptions.map((option) => <button aria-pressed={draft.performanceRating === option} key={option} onClick={() => updateDraft('performanceRating', option)} type="button">{option}</button>)}</div></section>

            <section className="checkout-step checkout-safety-step"><div className="checkout-step-heading"><span>03</span><div><h2>Any new or worse pain?</h2><p>No skips the entire pain flow.</p></div></div>
              <div className="binary-choice"><button aria-pressed={draft.painConcern === false} onClick={() => { updateDraft('painConcern', false); updateDraft('newPain', false); updateDraft('painChange', 'Unchanged'); updateDraft('painMap', createEmptyPainMap()) }} type="button">No</button><button aria-pressed={draft.painConcern === true} onClick={() => updateDraft('painConcern', true)} type="button">Yes</button></div>
              {draft.painConcern && <div className="progressive-branch"><BodyPainMap details={draft.painDetails} value={draft.painMap} onDetailsChange={(value) => updateDraft('painDetails', value)} onChange={(value) => updateDraft('painMap', value)} />
              <div className="select-row">
                <Slider label="Fatigue after event" max={5} min={1} unit="/5" value={draft.postFatigue} onChange={(value) => updateDraft('postFatigue', value)} />
                <Slider label="Soreness after event" max={5} min={1} unit="/5" value={draft.postSoreness} onChange={(value) => updateDraft('postSoreness', value)} />
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
            </section>

            <section className="checkout-step checkout-safety-step"><div className="checkout-step-heading"><span>04</span><div><h2>Any unusual or concerning symptoms?</h2><p>Dizziness, nausea, headache, or unusual shortness of breath.</p></div></div><div className="binary-choice"><button aria-pressed={draft.symptomConcern === false} onClick={() => { updateDraft('symptomConcern', false); updateDraft('heatSymptoms', []) }} type="button">No</button><button aria-pressed={draft.symptomConcern === true} onClick={() => updateDraft('symptomConcern', true)} type="button">Yes</button></div>{draft.symptomConcern && <fieldset className="checkout-symptoms progressive-branch"><legend>What did you notice?</legend><CheckboxGroup options={symptomOptions} value={draft.heatSymptoms} onChange={(value) => updateDraft('heatSymptoms', value)} /></fieldset>}</section>

            <details className="checkout-context-details"><summary><span>Event details and notes</span><small>Optional or event-specific</small></summary><div className="checkout-context-fields">{questionSchema.showSessionContent && draft.participation !== 'Did not participate' && <div className="checkout-section"><div className="checkout-section-heading"><strong>What did you do?</strong><span>Select only relevant work.</span></div><CheckboxGroup options={relevantSessionContentOptions} value={draft.sessionContent.filter((item) => relevantSessionContentOptions.includes(item))} onChange={(value) => updateDraft('sessionContent', value)} /></div>}{questionSchema.showHydration && <label className="compact-field">Fluids during event<select value={draft.hydrationDuring} onChange={(event) => updateDraft('hydrationDuring', event.target.value)}><option>Not tracked</option><option>None</option><option>Some</option><option>Regular access</option></select></label>}{questionSchema.showFuel && <label className="compact-field">Fuel during event<select value={draft.fuelDuring} onChange={(event) => updateDraft('fuelDuring', event.target.value)}><option>Not tracked</option><option>None</option><option value="Snack or gel">Snack, gel, or chews</option><option>Meal between efforts</option></select></label>}{questionSchema.showWorkload && workloadFields.map((field) => <SportWorkloadField field={field} key={field.key} unitSystem={athleteProfile?.unitSystem} value={draft.sportWorkload?.[field.key] ?? ''} onChange={(value) => updateDraft('sportWorkload', { ...(draft.sportWorkload ?? {}), [field.key]: value })} />)}<label className="compact-field checkout-notes">Notes<textarea value={draft.notes ?? ''} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Anything else that changes how this session should be understood" /></label><div className="checkout-voice"><VoiceDraftButton logType="post_checkout" onApply={(voiceDraft) => Object.entries(voiceDraft).forEach(([field, value]) => { if (value !== null && field !== 'notes') updateDraft(field, value) })} /></div></div></details>

            <footer className="checkout-submit"><div><strong>{getCheckoutFlowState(draft).complete ? 'Ready to save' : 'Finish the required questions'}</strong><span>{getCheckoutFlowState(draft).complete ? 'This will update recovery, load, and History.' : 'Participation, duration, effort, response, pain, and symptoms are required.'}</span></div><button className="primary-button" disabled={isSaving || !getCheckoutFlowState(draft).complete} onClick={saveDraft} type="button">{isSaving ? 'Saving…' : 'Save checkout'}</button></footer>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function CheckoutComparison({ checkout, event, onEdit }) {
  return (
    <div className="checkout-comparison">
      {checkout.recommendation?._source === 'gemini' && (
        <RecoveryPlanCard
          recommendation={checkout.recommendation}
          recommendationStatus="ai"
          session={checkout.title}
        />
      )}

      <PerformanceQuote date={event.date} surface="checkout" />

      <button className="secondary-button compact-action" onClick={onEdit} type="button">
        Edit checkout
      </button>
    </div>
  )
}

function getInitialDraft(event, checkout, preCheckIn, preCheckInPainReports) {
  return {
    actualMinutes: checkout?.actualMinutes ?? null,
    completionLevel: checkout?.completionLevel ?? 'Full',
    difficulty: checkout?.difficulty ?? null,
    fatigueAffectedTechnique: checkout?.fatigueAffectedTechnique ?? false,
    fuelDuring: checkout?.fuelDuring ?? 'Not tracked',
    heatSymptoms: checkout?.heatSymptoms ?? [],
    hydrationDuring: checkout?.hydrationDuring ?? 'Not tracked',
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
    postFatigue: checkout?.postFatigue ?? null,
    postSoreness: checkout?.postSoreness ?? null,
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
