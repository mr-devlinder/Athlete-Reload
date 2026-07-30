import { useEffect, useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { getPositionOptions, sportOptions } from '../data/sportProfiles'

export function AthleteProfileModal({ profile, onClose, onSave }) {
  const [draft, setDraft] = useState(profile ?? {})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  async function save(event) {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')

    try {
      await onSave(draft)
      onClose()
    } catch (error) {
      console.error(error)
      setMessage('Unable to save your athlete profile right now.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="event-modal athlete-profile-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="schedule-header">
          <SectionHeading eyebrow="Athlete profile" title="Your training context." />
          <button className="ghost-close" onClick={onClose} type="button">Close</button>
        </div>

        <form className="settings-form" onSubmit={save}>
          {message && <p className="form-error" role="alert">{message}</p>}
          <label className="select-field">
            Name
            <input required value={draft.displayName ?? ''} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <label className="select-field">
            Sport
            <select value={draft.sport ?? ''} onChange={(event) => setDraft((current) => ({ ...current, sport: event.target.value, position: '' }))}>
              <option value="">Choose a sport or activity</option>
              {sportOptions.map((sport) => <option key={sport}>{sport}</option>)}
            </select>
          </label>
          <label className="select-field">
            Position or specialty
            <select value={draft.position ?? ''} onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))}>
              <option value="">{draft.sport ? 'Select a position or specialty' : 'Choose a sport first'}</option>
              {getPositionOptions(draft.sport).map((position) => <option key={position}>{position}</option>)}
              <option value="Other">Other / not listed</option>
            </select>
          </label>
          <label className="select-field">
            Training style
            <select value={draft.trainingStyle ?? 'Team and individual'} onChange={(event) => setDraft((current) => ({ ...current, trainingStyle: event.target.value }))}>
              <option>Team and individual</option>
              <option>Mostly team training</option>
              <option>Mostly individual</option>
            </select>
          </label>
          <label className="select-field">
            Dominant side
            <select value={draft.dominantSide ?? 'Right'} onChange={(event) => setDraft((current) => ({ ...current, dominantSide: event.target.value }))}>
              <option>Right</option>
              <option>Left</option>
              <option>Both / unsure</option>
            </select>
          </label>
          <div className="onboarding-two-col">
            <label className="select-field">
              Gender (optional)
              <select value={draft.genderIdentity ?? ''} onChange={(event) => setDraft((current) => ({ ...current, genderIdentity: event.target.value }))}>
                <option value="">Prefer not to say</option>
                <option>Female</option>
                <option>Male</option>
                <option>Nonbinary</option>
                <option>Self-described</option>
              </select>
            </label>
            <label className="select-field">
              Height in inches (optional)
              <input inputMode="decimal" min="0" type="number" value={draft.heightInches ?? ''} onChange={(event) => setDraft((current) => ({ ...current, heightInches: event.target.value }))} />
            </label>
          </div>
          <label className="select-field">
            Weight in pounds (optional)
            <input inputMode="decimal" min="0" type="number" value={draft.weightLbs ?? ''} onChange={(event) => setDraft((current) => ({ ...current, weightLbs: event.target.value }))} />
          </label>
          <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Saving...' : 'Save profile'}</button>
        </form>
      </section>
    </div>
  )
}
