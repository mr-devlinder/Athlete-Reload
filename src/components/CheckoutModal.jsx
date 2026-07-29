import { useEffect, useState } from 'react'
import { BodyPainMap } from './BodyPainMap'
import { RecoveryPlanCard } from './RecommendationCard'
import { createEmptyPainMap } from '../data/bodyPainMap'
import { estimatePlannedMinutes } from '../utils/events'
import { SectionHeading } from './SectionHeading'

const painChanges = ['Better', 'Same', 'Slightly worse', 'Worse']
const completionLevels = ['Completed full session', 'Modified', 'Stopped early', 'Missed']

export function CheckoutModal({ checkout, event, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(!checkout)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState(() => getInitialDraft(event, checkout))

  useEffect(() => {
    document.body.classList.add('modal-open')

    return () => document.body.classList.remove('modal-open')
  }, [])

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveDraft() {
    setIsSaving(true)
    try {
      await onSave(event, draft, checkout)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="event-modal checkout-modal glass-panel" role="dialog" aria-modal="true">
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
          <CheckoutComparison checkout={checkout} onEdit={() => setIsEditing(true)} />
        ) : (
          <div className="modal-form">
            <label className="compact-field">
              Planned minutes
              <input
                min="0"
                type="number"
                value={draft.plannedMinutes}
                onChange={(changeEvent) => updateDraft('plannedMinutes', changeEvent.target.value)}
              />
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
            <label className="compact-field">
              Difficulty
              <input
                max="10"
                min="1"
                type="number"
                value={draft.difficulty}
                onChange={(changeEvent) => updateDraft('difficulty', changeEvent.target.value)}
              />
            </label>
            <label className="compact-field">
              Pain change
              <select
                value={draft.painChange}
                onChange={(changeEvent) => updateDraft('painChange', changeEvent.target.value)}
              >
                {painChanges.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              Completion
              <select
                value={draft.completionLevel}
                onChange={(changeEvent) => updateDraft('completionLevel', changeEvent.target.value)}
              >
                {completionLevels.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="compact-field modal-notes">
              Notes
              <textarea
                value={draft.notes}
                onChange={(changeEvent) => updateDraft('notes', changeEvent.target.value)}
                placeholder="How the session actually felt"
              />
            </label>

            <div className="modal-notes">
              <BodyPainMap
                value={draft.painMap}
                onChange={(value) => updateDraft('painMap', value)}
              />
            </div>

            <button className="primary-button modal-notes" disabled={isSaving} onClick={saveDraft} type="button">
              {isSaving ? 'Generating recovery plan...' : 'Save checkout'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function CheckoutComparison({ checkout, onEdit }) {
  const plannedWork = checkout.plannedMinutes * plannedLoadMultiplier(checkout.plannedLoad)
  const actualWork = checkout.actualMinutes * checkout.difficulty
  const difference = Math.round(actualWork - plannedWork)
  const tone = difference > 40 ? 'above' : difference < -40 ? 'below' : 'matched'

  return (
    <div className="checkout-comparison">
      <div className={`workload-delta ${tone}`}>
        <span>{tone === 'matched' ? 'Matched plan' : tone === 'above' ? 'Above plan' : 'Below plan'}</span>
        <strong>{difference > 0 ? '+' : ''}{difference}</strong>
        <p>Actual workload compared with the scheduled intensity.</p>
      </div>

      <div className="comparison-grid">
        <span>
          <strong>Planned</strong>
          {checkout.plannedLoad} {checkout.plannedType}, {checkout.plannedMinutes} min
        </span>
        <span>
          <strong>Actual</strong>
          {checkout.actualMinutes} min at {checkout.difficulty}/10
        </span>
        <span>
          <strong>Completion</strong>
          {checkout.completionLevel}
        </span>
        <span>
          <strong>Pain</strong>
          {checkout.painChange}
        </span>
      </div>

      {checkout.notes && <p className="checkout-note">{checkout.notes}</p>}

      {checkout.recommendation && (
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

function getInitialDraft(event, checkout) {
  return {
    actualMinutes: checkout?.actualMinutes ?? estimatePlannedMinutes(event.load),
    completionLevel: checkout?.completionLevel ?? 'Completed full session',
    difficulty: checkout?.difficulty ?? loadToDifficulty(event.load),
    notes: checkout?.notes ?? '',
    painChange: checkout?.painChange ?? 'Same',
    painMap: checkout?.painMap ?? createEmptyPainMap(),
    plannedMinutes: checkout?.plannedMinutes ?? estimatePlannedMinutes(event.load),
  }
}

function loadToDifficulty(load) {
  if (load === 'High') return 8
  if (load === 'Low') return 3

  return 6
}

function plannedLoadMultiplier(load) {
  if (load === 'High') return 8
  if (load === 'Low') return 3

  return 6
}
