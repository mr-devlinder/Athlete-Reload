import { useState } from 'react'
import { SectionHeading } from './SectionHeading'
import { getPositionOptions, sportOptions } from '../data/sportProfiles'

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
  })
  const [association, setAssociation] = useState('Personal')
  const [newAssociation, setNewAssociation] = useState('')
  const [isCreatingAssociation, setIsCreatingAssociation] = useState(false)
  const usesAccountDisplayName = Boolean(initialDisplayName.trim())

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
    setStep('tutorial')
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
        {['profile', 'tutorial'].map((item, index) => (
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

          {usesAccountDisplayName ? (
            <div className="onboarding-account-name">
              <span className="eyebrow">Account display name</span>
              <strong>{profile.displayName}</strong>
              <p>We found this name from your sign-in and will use it throughout Athlete Reload.</p>
            </div>
          ) : (
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
          )}
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
          <div className="onboarding-body-context">
            <p className="field-help">Optional body context helps keep sport and fueling guidance realistic. It is not used to judge your body or make a medical decision.</p>
            <div className="onboarding-two-col">
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
              <label className="select-field">
                Height (inches)
                <input inputMode="decimal" min="0" type="number" value={profile.heightInches} onChange={(event) => updateProfile('heightInches', event.target.value)} />
              </label>
            </div>
            <label className="select-field">
              Weight (lb)
              <input inputMode="decimal" min="0" type="number" value={profile.weightLbs} onChange={(event) => updateProfile('weightLbs', event.target.value)} />
            </label>
          </div>
          <button className="primary-button" type="submit">Continue</button>
        </form>
      )}

      {step === 'tutorial' && (
        <section className="onboarding-panel glass-panel">
          <SectionHeading eyebrow="How Athlete Reload works" title="Three simple moments." />
          <div className="onboarding-tutorial">
            <article><span>01</span><strong>Check in</strong><p>Before an event, tell us how you slept, how you feel, and where something hurts.</p></article>
            <article><span>02</span><strong>Train with context</strong><p>Your sport, position, event intensity, and pain pattern shape the preparation plan.</p></article>
            <article><span>03</span><strong>Checkout</strong><p>Afterward, log what really happened so recovery advice and trends reflect the session.</p></article>
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
          <button className="primary-button" disabled={isSaving} onClick={continueFromTutorial} type="button">{isSaving ? 'Saving...' : 'Continue to Schedule'}</button>
        </section>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
