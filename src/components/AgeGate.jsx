import { useState } from 'react'
import { getAgeAccess, MINIMUM_ATHLETE_AGE } from '../domain/age'
import { SectionHeading } from './SectionHeading'

export function AgeGate({ profile, onOpenDataControls, onSave, onSignOut }) {
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const access = getAgeAccess({ ...profile, dateOfBirth })

  async function confirmAge(event) {
    event.preventDefault()
    if (!dateOfBirth) return
    setMessage('')
    setIsSaving(true)
    try {
      await onSave({ dateOfBirth, ageVerifiedAt: new Date().toISOString() })
    } catch (error) {
      console.error(error)
      setMessage('We could not verify your age right now. Check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (access.status === 'restricted') {
    return (
      <main className="age-gate-shell">
        <section className="age-gate-panel glass-panel">
          <SectionHeading eyebrow="Age requirement" title={`Athlete Reload is for athletes ${MINIMUM_ATHLETE_AGE} and older.`} />
          <p>This account cannot use training, health, or recommendation features. You can still export your information or permanently delete the account from Data Controls.</p>
          <div className="onboarding-form-actions">
            <button className="secondary-button" onClick={onSignOut} type="button">Sign out</button>
            <button className="primary-button" onClick={onOpenDataControls} type="button">Open data controls</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="age-gate-shell">
      <form className="age-gate-panel glass-panel" onSubmit={confirmAge}>
        <SectionHeading eyebrow="Age confirmation" title="Confirm your date of birth." />
        <p>We use this to enforce the 16+ age requirement and calculate age-dependent estimates. It is private and does not appear on your public-facing screens.</p>
        <label className="select-field">
          Date of birth
          <input max={new Date().toISOString().slice(0, 10)} required type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
        </label>
        {message && <p className="form-error" role="alert">{message}</p>}
        <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Confirming...' : 'Confirm age'}</button>
      </form>
    </main>
  )
}
