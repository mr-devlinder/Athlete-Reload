import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { getPositionOptions, isDominantSideRelevant, sportOptions } from '../data/sportProfiles'
import { dietaryOptions, goalOptions } from '../data/profileOptions'
import { ProfileMeasurements } from './ProfileMeasurements'
import { useModalAccessibility } from '../hooks/useModalAccessibility'
import { getAgeAccess } from '../domain/age'

function ensurePrimaryGoal(goals) {
  if (goals.length === 0 || goals.some((goal) => goal.priority === 'primary')) return goals
  return goals.map((goal, index) => ({ ...goal, priority: index === 0 ? 'primary' : 'secondary' }))
}

export function AthleteProfileModal({ profile, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    ...(profile ?? {}),
    goals: ensurePrimaryGoal((profile?.goals ?? []).map((goal) => typeof goal === 'string' ? { name: goal, priority: 'secondary' } : goal)),
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const positionOptions = getPositionOptions(draft.sport)
  const dialogRef = useModalAccessibility(true, onClose)

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
      const normalizedGoals = goals.map((goal) => typeof goal === 'string' ? { name: goal, priority: 'secondary' } : goal)
      return {
        ...current,
        goals: existing
          ? ensurePrimaryGoal(normalizedGoals.filter((goal) => goal.name !== value))
          : ensurePrimaryGoal([...normalizedGoals, { name: value, priority: 'secondary' }]),
      }
    })
  }

  function setGoalPriority(name, priority) {
    setDraft((current) => {
      const goals = (current.goals ?? []).map((goal) => {
        const goalName = goal.name ?? goal
        if (goalName === name) return { name, priority }
        if (priority === 'primary') return { name: goalName, priority: 'secondary' }
        return typeof goal === 'string' ? { name: goal, priority: 'secondary' } : goal
      })
      return { ...current, goals: ensurePrimaryGoal(goals) }
    })
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
    if (getAgeAccess(draft).status !== 'allowed') {
      setMessage('Athlete Reload requires a date of birth confirming that you are at least 16.')
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
      <section aria-labelledby="athlete-profile-title" className="event-modal athlete-profile-modal glass-panel" onClick={(event) => event.stopPropagation()} ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="schedule-header">
          <div id="athlete-profile-title"><SectionHeading eyebrow="Athlete profile" title="Your training context." /></div>
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
              Gender identity (optional)
              <select value={draft.genderIdentity ?? ''} onChange={(event) => setDraft((current) => ({ ...current, genderIdentity: event.target.value }))}>
                <option value="">Prefer not to say</option>
                <option>Female</option>
                <option>Male</option>
                <option>Nonbinary</option>
                <option>Self-described</option>
              </select>
            </label>
            <label className="select-field">
              Physiology used for energy estimates (optional)
              <select value={draft.physiologySex ?? draft.biologicalSex ?? ''} onChange={(event) => setDraft((current) => ({ ...current, physiologySex: event.target.value }))}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="intersex">Intersex</option>
                <option value="not_listed">Not listed</option>
              </select>
            </label>
          </div>
          <ProfileMeasurements profile={draft} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} />
          <label className="select-field">
            Date of birth
            <input max={new Date().toISOString().slice(0, 10)} required type="date" value={draft.dateOfBirth ?? ''} onChange={(event) => setDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} />
            <small className="field-description">Used to enforce the 16+ requirement and calculate age-dependent estimates.</small>
          </label>
          <fieldset className="profile-choice-field">
            <legend>Goals</legend>
            <p>Select every goal that matters right now. Set the one that matters most to primary.</p>
            <div className="profile-choice-grid">
              {goalOptions.map((goal) => {
                const selected = (draft.goals ?? []).find((item) => (item.name ?? item) === goal)
                return <label key={goal}><input checked={Boolean(selected)} onChange={() => toggleGoal(goal)} type="checkbox" /><span>{goal}</span>{selected && <select aria-label={`Priority for ${goal}`} className="goal-priority-select" value={selected.priority ?? 'secondary'} onChange={(event) => setGoalPriority(goal, event.target.value)}><option value="primary">Primary</option><option value="secondary">Secondary</option></select>}</label>
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
