import { useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { getPositionOptions, sportOptions } from '../data/sportProfiles'
import { dietaryOptions, goalOptions } from '../data/profileOptions'

export function OnboardingFlow({ associations = [], initialDisplayName = '', onComplete, onCreateAssociation }) {
  const [step, setStep] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState({
    displayName: initialDisplayName,
    sport: '',
    position: '',
    trainingStyle: 'Team and individual',
    dominantSide: 'Right',
    genderIdentity: '',
    heightInches: '',
    weightLbs: '',
    age: '',
    goals: [],
    dietaryPreferences: [],
  })
  const [association, setAssociation] = useState('Personal')
  const [newAssociation, setNewAssociation] = useState('')
  const [isCreatingAssociation, setIsCreatingAssociation] = useState(false)
  function updateProfile(field, value) {
    setProfile((current) => ({
      ...current,
      [field]: value,
      ...(field === 'sport' ? { position: '' } : {}),
    }))
  }

  function continueFromProfile(eventSubmit) {
    eventSubmit.preventDefault()
    setError('')
    setStep('nutrition')
  }

  function continueFromNutrition(eventSubmit) {
    eventSubmit.preventDefault()
    setError('')
    setStep('tutorial')
  }

  function toggleDietaryPreference(value) {
    setProfile((current) => {
      const preferences = current.dietaryPreferences ?? []
      const withoutNoPreference = preferences.filter((item) => item !== 'No preference')

      if (value === 'No preference') {
        return { ...current, dietaryPreferences: preferences.includes(value) ? [] : ['No preference'] }
      }

      return {
        ...current,
        dietaryPreferences: withoutNoPreference.includes(value)
          ? withoutNoPreference.filter((item) => item !== value)
          : [...withoutNoPreference, value],
      }
    })
  }

  function toggleGoal(value) {
    setProfile((current) => {
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
    setProfile((current) => ({
      ...current,
      goals: (current.goals ?? []).map((goal) => {
        const goalName = goal.name ?? goal
        if (goalName === name) return { name, priority }
        if (priority === 'primary') return { name: goalName, priority: 'secondary' }
        return typeof goal === 'string' ? { name: goal, priority: 'secondary' } : goal
      }),
    }))
  }

  function continueFromTutorial() {
    setError('')
    setIsSaving(true)
    Promise.resolve(onComplete({ profile, association }))
      .catch((saveError) => {
        console.error(saveError)
        setError('We could not finish setup. Check your connection and try again.')
      })
      .finally(() => setIsSaving(false))
  }

  return (
    <section className="onboarding-shell">
      <div className="onboarding-progress" aria-label="Setup progress">
        {['profile', 'nutrition', 'tutorial'].map((item, index) => (
          <span className={step === item ? 'active' : ''} key={item}>
            {index + 1}
          </span>
        ))}
      </div>

      {step === 'profile' && (
        <form className="onboarding-panel glass-panel" onSubmit={continueFromProfile}>
          <SectionHeading eyebrow="A quick introduction" title="Let’s get to know you." />
          <p className="onboarding-copy">
            This helps Athlete Reload understand what your training actually asks of your body.
            These details will guide your event recommendations.
          </p>

          <label className="select-field">
            What should we call you?
            <input
              autoFocus
              required
              value={profile.displayName}
              onChange={(event) => updateProfile('displayName', event.target.value)}
              placeholder="First name or nickname"
            />
          </label>
          <label className="select-field">
            Sport
            <select value={profile.sport} onChange={(event) => updateProfile('sport', event.target.value)}>
              <option value="">I’ll add this later</option>
              {sportOptions.map((sport) => <option key={sport}>{sport}</option>)}
            </select>
          </label>
          <label className="select-field">
            Position or event specialty
            <select
              value={profile.position}
              onChange={(event) => updateProfile('position', event.target.value)}
            >
              <option value="">{profile.sport ? 'Select a position or specialty' : 'Choose a sport first'}</option>
              {getPositionOptions(profile.sport).map((position) => <option key={position}>{position}</option>)}
              <option value="Other">Other / not listed</option>
            </select>
          </label>
          <div className="onboarding-two-col">
            <label className="select-field">
              Training style
              <select value={profile.trainingStyle} onChange={(event) => updateProfile('trainingStyle', event.target.value)}>
                <option>Team and individual</option>
                <option>Mostly team training</option>
                <option>Mostly individual</option>
              </select>
            </label>
            <label className="select-field">
              Dominant side
              <select value={profile.dominantSide} onChange={(event) => updateProfile('dominantSide', event.target.value)}>
                <option>Right</option>
                <option>Left</option>
                <option>Both / unsure</option>
              </select>
            </label>
          </div>
          <button className="primary-button" type="submit">Continue</button>
        </form>
      )}

      {step === 'nutrition' && (
        <form className="onboarding-panel glass-panel" onSubmit={continueFromNutrition}>
          <SectionHeading eyebrow="Fueling context" title="Personalize your daily targets." />
          <p className="onboarding-copy">These optional details help estimate nutrition and hydration targets. They are guidance, not a prescription, and can be changed from your profile.</p>
          <div className="onboarding-two-col onboarding-three-col">
            <label className="select-field">
              Age
              <input inputMode="numeric" max="120" min="13" type="number" value={profile.age} onChange={(event) => updateProfile('age', event.target.value)} placeholder="Optional" />
            </label>
            <label className="select-field">
              Height (inches)
              <input inputMode="decimal" min="0" type="number" value={profile.heightInches} onChange={(event) => updateProfile('heightInches', event.target.value)} placeholder="Optional" />
            </label>
            <label className="select-field">
              Weight (lb)
              <input inputMode="decimal" min="0" type="number" value={profile.weightLbs} onChange={(event) => updateProfile('weightLbs', event.target.value)} placeholder="Optional" />
            </label>
          </div>
          <label className="select-field">
            Gender
            <select value={profile.genderIdentity} onChange={(event) => updateProfile('genderIdentity', event.target.value)}>
              <option value="">Prefer not to say</option>
              <option>Female</option>
              <option>Male</option>
              <option>Nonbinary</option>
              <option>Another identity</option>
            </select>
          </label>
          <fieldset className="profile-choice-field onboarding-choice-field">
            <legend>Current goals</legend>
            <p>Select what matters now. Mark one goal as primary so estimates do not stack conflicting adjustments.</p>
            <div className="profile-choice-grid onboarding-choice-grid">
              {goalOptions.map((goal) => {
                const selected = profile.goals.find((item) => (item.name ?? item) === goal)
                return <label key={goal}><input checked={Boolean(selected)} onChange={() => toggleGoal(goal)} type="checkbox" /><span>{goal}</span>{selected && <select aria-label={`${goal} priority`} value={selected.priority ?? 'secondary'} onChange={(event) => setGoalPriority(goal, event.target.value)}><option value="primary">Primary</option><option value="secondary">Secondary</option></select>}</label>
              })}
            </div>
          </fieldset>
          <fieldset className="profile-choice-field onboarding-choice-field">
            <legend>Dietary preferences</legend>
            <p>Optional. Athlete Reload uses these only to keep food suggestions relevant.</p>
            <div className="profile-choice-grid simple onboarding-choice-grid">
              {dietaryOptions.map((option) => <label key={option}><input checked={profile.dietaryPreferences.includes(option)} onChange={() => toggleDietaryPreference(option)} type="checkbox" /><span>{option}</span></label>)}
            </div>
          </fieldset>
          <div className="onboarding-form-actions">
            <button className="auth-switch" onClick={() => setStep('profile')} type="button">Back</button>
            <button className="primary-button" type="submit">Continue</button>
          </div>
        </form>
      )}

      {step === 'tutorial' && (
        <section className="onboarding-panel glass-panel">
          <SectionHeading eyebrow="How Athlete Reload works" title="One connected training loop." />
          <div className="onboarding-tutorial">
            <article><span>01</span><strong>Plan</strong><p>Add practices, games, workouts, and recovery sessions to your schedule.</p></article>
            <article><span>02</span><strong>Check in</strong><p>Before an event, record how your body feels and receive an event-specific plan.</p></article>
            <article><span>03</span><strong>Fuel and train</strong><p>Log food and fluids throughout the day, then complete your scheduled event.</p></article>
            <article><span>04</span><strong>Checkout and recover</strong><p>Record what happened, generate recovery guidance, and build useful history.</p></article>
          </div>
          <p className="onboarding-note">Athlete Reload is a training journal and planning aid, not medical clearance.</p>
          <label className="select-field">
            Default association
            <span className="field-help">
              An association is the team, school, club, or group connected to an event. Choose Personal for workouts that are just yours.
            </span>
            <div className="onboarding-association-control">
              <select value={association} onChange={(event) => setAssociation(event.target.value)}>
                <option value="Personal">Personal</option>
                {associations.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
              <button className="secondary-button compact-action" onClick={() => setIsCreatingAssociation(true)} type="button" aria-label="Create association">+</button>
            </div>
          </label>
          {isCreatingAssociation && (
            <div className="onboarding-association-create">
              <input value={newAssociation} onChange={(event) => setNewAssociation(event.target.value)} placeholder="Team, school, or club" />
              <button
                className="secondary-button compact-action"
                onClick={async () => {
                  const name = newAssociation.trim()
                  if (!name) return
                  const created = await onCreateAssociation(name)
                  setAssociation(created?.name ?? name)
                  setNewAssociation('')
                  setIsCreatingAssociation(false)
                }}
                type="button"
              >
                Add
              </button>
            </div>
          )}
          <div className="onboarding-form-actions">
            <button className="auth-switch" onClick={() => setStep('nutrition')} type="button">Back</button>
            <button className="primary-button" disabled={isSaving} onClick={continueFromTutorial} type="button">{isSaving ? 'Saving...' : 'Continue to Schedule'}</button>
          </div>
        </section>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
