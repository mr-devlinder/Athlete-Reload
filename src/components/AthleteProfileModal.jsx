import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { getPositionOptions, isDominantSideRelevant, sportOptions } from '../data/sportProfiles'
import { dietaryOptions, goalOptions } from '../data/profileOptions'
import { ProfileMeasurements } from './ProfileMeasurements'

export function AthleteProfileModal({ profile, onClose, onSave }) {
  const [draft, setDraft] = useState(profile ?? {})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const positionOptions = getPositionOptions(draft.sport)

  function toggleListValue(field, value) {
    setDraft((current) => {
      const values = current[field] ?? []
      if (field === 'dietaryPreferences') {
        if (value === 'No preference') {
          return { ...current, [field]: values.includes(value) ? [] : ['No preference'] }
        }

        const withoutNoPreference = values.filter((item) => item !== 'No preference')
        return { ...current, [field]: withoutNoPreference.includes(value) ? withoutNoPreference.filter((item) => item !== value) : [...withoutNoPreference, value] }
      }
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
      goals: (current.goals ?? []).map((goal) => {
        const goalName = goal.name ?? goal
        if (goalName === name) return { name, priority }
        if (priority === 'primary') return { name: goalName, priority: 'secondary' }
        return typeof goal === 'string' ? { name: goal, priority: 'secondary' } : goal
      }),
    }))
  }

  useEffect(() => {
    const scrollY = window.scrollY
    const previousBodyStyles = {
      left: document.body.style.left,
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      right: document.body.style.right,
      top: document.body.style.top,
      width: document.body.style.width,
    }

    document.body.classList.add('modal-open')
    Object.assign(document.body.style, {
      left: '0',
      overflow: 'hidden',
      position: 'fixed',
      right: '0',
      top: `-${scrollY}px`,
      width: '100%',
    })

    return () => {
      document.body.classList.remove('modal-open')
      Object.assign(document.body.style, previousBodyStyles)
      window.scrollTo(0, scrollY)
    }
  }, [])

  async function save(event) {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')

    if (!draft.sport) {
      setMessage('Select your sport or activity.')
      setIsSaving(false)
      return
    }
    if (positionOptions.length > 0 && !positionOptions.includes(draft.position)) {
      setMessage('Select a position or specialty for your chosen sport.')
      setIsSaving(false)
      return
    }

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
    <div className="modal-backdrop athlete-profile-backdrop" onClick={onClose}>
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
            <select required value={draft.sport ?? ''} onChange={(event) => setDraft((current) => {
              const sport = event.target.value
              const positions = getPositionOptions(sport)
              return { ...current, sport, position: positions.includes(current.position) ? current.position : '' }
            })}>
              <option value="">Choose a sport or activity</option>
              {sportOptions.map((sport) => <option key={sport}>{sport}</option>)}
            </select>
          </label>
          {positionOptions.length > 0 && <label className="select-field">
            Position or specialty
            <select required value={draft.position ?? ''} onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))}>
              <option value="">{draft.sport ? 'Select a position or specialty' : 'Choose a sport first'}</option>
              {positionOptions.map((position) => <option key={position}>{position}</option>)}
            </select>
          </label>}
          <label className="select-field">
            Training style
            <select value={draft.trainingStyle ?? 'Team and individual'} onChange={(event) => setDraft((current) => ({ ...current, trainingStyle: event.target.value }))}>
              <option>Team and individual</option>
              <option>Mostly team training</option>
              <option>Mostly individual</option>
            </select>
          </label>
          {isDominantSideRelevant(draft.sport) && <label className="select-field">
            Dominant side
            <select value={draft.dominantSide ?? 'Right'} onChange={(event) => setDraft((current) => ({ ...current, dominantSide: event.target.value }))}>
              <option>Right</option>
              <option>Left</option>
              <option>Both / unsure</option>
            </select>
          </label>}
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
          </div>
          <ProfileMeasurements profile={draft} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} />
          <label className="select-field">
            Age (optional)
            <input inputMode="numeric" max="120" min="16" type="number" value={draft.age ?? ''} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))} />
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
          <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Saving...' : 'Save profile'}</button>
        </form>
      </section>
    </div>,
    document.body,
  )
}
