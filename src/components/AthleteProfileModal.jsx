import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { getPositionOptions, sportOptions } from '../data/sportProfiles'

const goalOptions = ['Gain weight', 'Gain muscle', 'Lose weight', 'Improve strength', 'Improve speed', 'Sport performance', 'Stay healthy', 'Stay fit', 'Improve conditioning', 'Recovery consistency']
const dietaryOptions = ['Vegetarian', 'Vegan', 'Dairy-free', 'Gluten-free', 'Halal', 'Kosher', 'No preference']

export function AthleteProfileModal({ profile, onClose, onSave }) {
  const [draft, setDraft] = useState(profile ?? {})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  function toggleListValue(field, value) {
    setDraft((current) => {
      const values = current[field] ?? []
      return { ...current, [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] }
    })
  }

  function toggleGoal(value) {
    setDraft((current) => {
      const goals = current.goals ?? []
      const existing = goals.find((goal) => (goal.name ?? goal) === value)
      return {
        ...current,
        goals: existing
          ? goals.filter((goal) => (goal.name ?? goal) !== value)
          : [...goals, { name: value, priority: goals.length === 0 ? 'primary' : 'secondary' }],
      }
    })
  }

  function setGoalPriority(name, priority) {
    setDraft((current) => ({
      ...current,
      goals: (current.goals ?? []).map((goal) => (goal.name ?? goal) === name ? { name, priority } : typeof goal === 'string' ? { name: goal, priority: 'secondary' } : goal),
    }))
  }

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

  return createPortal(
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
          <label className="select-field">
            Age (optional)
            <input inputMode="numeric" max="120" min="13" type="number" value={draft.age ?? ''} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))} />
          </label>
          <fieldset className="profile-choice-field">
            <legend>Goals</legend>
            <p>Select every goal that matters right now. Set the one that matters most to primary.</p>
            <div className="profile-choice-grid">
              {goalOptions.map((goal) => {
                const selected = (draft.goals ?? []).find((item) => (item.name ?? item) === goal)
                return <label key={goal}><input checked={Boolean(selected)} onChange={() => toggleGoal(goal)} type="checkbox" /><span>{goal}</span>{selected && <select value={selected.priority ?? 'secondary'} onChange={(event) => setGoalPriority(goal, event.target.value)}><option value="primary">Primary</option><option value="secondary">Secondary</option></select>}</label>
              })}
            </div>
          </fieldset>
          <fieldset className="profile-choice-field">
            <legend>Dietary preferences (optional)</legend>
            <div className="profile-choice-grid simple">
              {dietaryOptions.map((option) => <label key={option}><input checked={(draft.dietaryPreferences ?? []).includes(option)} onChange={() => toggleListValue('dietaryPreferences', option)} type="checkbox" /><span>{option}</span></label>)}
            </div>
          </fieldset>
          {false && <fieldset className="profile-choice-field">
            <legend>Tracking preferences</legend>
            <label className="select-field">Check-in detail<select value={draft.trackingPreferences?.mode ?? 'standard'} onChange={(event) => setDraft((current) => ({ ...current, trackingPreferences: { ...current.trackingPreferences, mode: event.target.value } }))}><option value="quick">Quick Mode</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
            <div className="profile-choice-grid simple">
              {[
                ['nutrition', 'Nutrition'],
                ['voice', 'Voice-assisted logs'],
                ['detailedPain', 'Detailed pain mapping'],
                ['recovery', 'Recovery routines'],
              ].map(([key, label]) => <label key={key}><input checked={draft.trackingPreferences?.[key] !== false} onChange={(event) => setDraft((current) => ({ ...current, trackingPreferences: { ...current.trackingPreferences, [key]: event.target.checked } }))} type="checkbox" /><span>{label}</span></label>)}
            </div>
          </fieldset>}
          <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Saving...' : 'Save profile'}</button>
        </form>
      </section>
    </div>,
    document.body,
  )
}
