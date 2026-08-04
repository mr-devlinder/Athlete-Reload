import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { Slider } from './FormControls'
import { RecoveryPlanCard } from './RecommendationCard'
import { bodyPainAreas, createEmptyPainMap } from '../data/bodyPainMap'
import { estimatePlannedMinutes } from '../utils/events'
import { SectionHeading } from './SectionHeading'
import { VoiceDraftButton } from './VoiceDraftButton'
import { getSportWorkloadFields } from '../data/sportProfiles'
import { getWorkloadFieldDisplay, workloadInputToCanonical } from '../utils/units'

const painChanges = ['Improved', 'Unchanged', 'Slightly worse', 'Much worse']
const participationLevels = ['Full', 'Modified', 'Partial', 'Did not participate']
const performanceLevels = ['Worse', 'Slightly worse', 'Normal', 'Better', 'Much better']
const sessionContentOptions = ['Technical work', 'Tactical work', 'Scrimmage', 'Sprinting', 'Endurance', 'Strength', 'Plyometrics', 'Recovery']
const symptomOptions = ['Dizziness', 'Nausea', 'Headache', 'Unusual shortness of breath']

export function CheckoutModal({ athleteProfile, checkout, event, preCheckIn, preCheckInPainReports, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(!checkout)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [draft, setDraft] = useState(() => getInitialDraft(event, checkout, preCheckIn, preCheckInPainReports))
  const workloadFields = getSportWorkloadFields(athleteProfile?.sport, {
    phase: 'checkout',
    position: athleteProfile?.position,
    eventType: event.type,
  })
  const relevantSessionContentOptions = getSessionContentOptions(event)

  useEffect(() => {
    document.body.classList.add('modal-open')

    return () => document.body.classList.remove('modal-open')
  }, [])

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
      <section className="event-modal checkout-modal glass-panel" role="dialog" aria-modal="true">
        <div className="checkout-modal-surface">
          <div className="schedule-header">
            <SectionHeading
              eyebrow={checkout && !isEditing ? 'Planned vs actual' : 'Checkout'}
              title={event.title || event.type}
            />
            <button className="ghost-close" onClick={onClose} type="button">
              Close
            </button>
          </div>

          {checkout && !isEditing ? (
            <CheckoutComparison checkout={checkout} event={event} preCheckIn={preCheckIn} onEdit={() => setIsEditing(true)} />
          ) : (
            <div className="modal-form">
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <div className="checkout-event-summary">
              <strong>{event.type}</strong>
              <span>{event.date}{event.time ? ` at ${event.time}` : ''} · {event.expectedDuration ?? event.plannedMinutes ?? 'No'} planned minutes</span>
            </div>
            <div className="quick-checkin-tools">
              <p>Use a quick checkout description, then review the captured fields before saving.</p>
              <VoiceDraftButton logType="post_checkout" onApply={(voiceDraft) => Object.entries(voiceDraft).forEach(([field, value]) => { if (value !== null && field !== 'notes') updateDraft(field, value) })} />
            </div>
            <label className="compact-field">
              Did you participate?
              <select value={draft.participation} onChange={(changeEvent) => updateDraft('participation', changeEvent.target.value)}>
                {participationLevels.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="compact-field">
              Actual minutes
              <input
                min="0"
                type="number"
                value={draft.actualMinutes}
                onChange={(changeEvent) => updateDraft('actualMinutes', changeEvent.target.value)}
              />
            </label>
            {workloadFields.map((field) => (
              <SportWorkloadField
                field={field}
                key={field.key}
                unitSystem={athleteProfile?.unitSystem}
                value={draft.sportWorkload?.[field.key] ?? ''}
                onChange={(value) => updateDraft('sportWorkload', { ...(draft.sportWorkload ?? {}), [field.key]: value })}
              />
            ))}
            {draft.participation !== 'Did not participate' && <div className="checkout-section modal-notes">
              <div className="checkout-section-heading">
                <strong>What happened</strong>
                <span>Choose the work you actually did.</span>
              </div>
              <CheckboxGroup options={relevantSessionContentOptions} value={draft.sessionContent.filter((item) => relevantSessionContentOptions.includes(item))} onChange={(value) => updateDraft('sessionContent', value)} />
            </div>}

            <div className="checkout-section modal-notes">
              <Slider
                description={getRpeDescription(draft.difficulty)}
                label="How hard did the whole session feel?"
                max={10}
                min={0}
                unit="/10"
                value={draft.difficulty}
                onChange={(value) => updateDraft('difficulty', value)}
              />
              <div className="session-load-card">
                <span>Session load</span>
                <strong>{getSessionLoad(draft)} units</strong>
                <p>{Number(draft.actualMinutes) || 0} minutes x {draft.difficulty} effort. Use this to compare your own patterns over time.</p>
              </div>
            </div>
            <label className="compact-field modal-notes">
              Checkout notes
              <textarea value={draft.notes ?? ''} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Optional context about this event" />
            </label>

            <div className="checkout-section modal-notes">
              <div className="checkout-section-heading">
                <strong>Physical response</strong>
                <span>Compare how your body felt after the event.</span>
              </div>
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
                  New pain or discomfort?
                  <select value={String(draft.newPain)} onChange={(event) => updateDraft('newPain', event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>
                </label>
                <label className="compact-field">
                  Cramping?
                  <select value={String(draft.cramping)} onChange={(event) => updateDraft('cramping', event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>
                </label>
                <label className="compact-field">
                  Movement or performance changed?
                  <select value={String(draft.movementChanged)} onChange={(event) => updateDraft('movementChanged', event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>
                </label>
              </div>
              <fieldset className="checkout-symptoms">
                <legend>Any of these symptoms?</legend>
                <CheckboxGroup options={symptomOptions} value={draft.heatSymptoms} onChange={(value) => updateDraft('heatSymptoms', value)} />
              </fieldset>
            </div>

            <div className="checkout-section modal-notes">
              <div className="checkout-section-heading">
                <strong>Performance and mental response</strong>
                <span>Keep it short. This helps separate physical and mental fatigue.</span>
              </div>
              <div className="select-row">
                <label className="compact-field">
                  Performance compared with normal
                  <select value={draft.performanceRating} onChange={(event) => updateDraft('performanceRating', event.target.value)}>{performanceLevels.map((option) => <option key={option}>{option}</option>)}</select>
                </label>
                <label className="compact-field">
                  Did fatigue affect decisions or technique?
                  <select value={String(draft.fatigueAffectedTechnique)} onChange={(event) => updateDraft('fatigueAffectedTechnique', event.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>
                </label>
                <Slider label="Mental focus" max={5} min={1} unit="/5" value={draft.mentalFocus} onChange={(value) => updateDraft('mentalFocus', value)} />
                <Slider label="Motivation" max={5} min={1} unit="/5" value={draft.motivation} onChange={(value) => updateDraft('motivation', value)} />
              </div>
            </div>
            <button className="primary-button modal-notes" disabled={isSaving} onClick={saveDraft} type="button">
              {isSaving ? 'Generating recovery plan...' : 'Save checkout'}
            </button>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function CheckoutComparison({ checkout, onEdit }) {
  return (
    <div className="checkout-comparison">
      {checkout.recommendation?._source === 'gemini' && (
        <RecoveryPlanCard
          recommendation={checkout.recommendation}
          recommendationStatus="ai"
          session={checkout.title}
        />
      )}

      <button className="secondary-button compact-action" onClick={onEdit} type="button">
        Edit checkout
      </button>
    </div>
  )
}

function getInitialDraft(event, checkout, preCheckIn, preCheckInPainReports) {
  return {
    actualMinutes: checkout?.actualMinutes ?? event.plannedMinutes ?? estimatePlannedMinutes(event.load),
    completionLevel: checkout?.completionLevel ?? 'Full',
    difficulty: checkout?.difficulty ?? loadToDifficulty(event.load),
    fatigueAffectedTechnique: checkout?.fatigueAffectedTechnique ?? false,
    heatSymptoms: checkout?.heatSymptoms ?? [],
    mentalFocus: checkout?.mentalFocus ?? 3,
    motivation: checkout?.motivation ?? 3,
    movementChanged: checkout?.movementChanged ?? false,
    newPain: checkout?.newPain ?? false,
    painDetails: checkout?.painDetails ?? preCheckIn?.painDetails ?? {},
    painChange: checkout?.painChange ?? 'Unchanged',
    painMap: checkout?.painMap ?? getPreCheckInPainMap(preCheckIn, preCheckInPainReports),
    participation: checkout?.participation ?? checkout?.completionLevel ?? 'Full',
    plannedMinutes: checkout?.plannedMinutes ?? event.plannedMinutes ?? estimatePlannedMinutes(event.load),
    postFatigue: checkout?.postFatigue ?? 3,
    postSoreness: checkout?.postSoreness ?? 3,
    performanceRating: checkout?.performanceRating ?? 'Normal',
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

function loadToDifficulty(load) {
  if (load === 'High') return 8
  if (load === 'Low') return 3

  return 6
}
