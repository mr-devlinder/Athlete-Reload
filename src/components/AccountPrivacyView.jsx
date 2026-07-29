import { useEffect, useMemo, useState } from 'react'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

const preferenceLabels = {
  analyticsAllowed: 'Allow anonymous analytics',
  coachIncludeNotes: 'Include notes in coach summaries',
  coachIncludePain: 'Include pain details in coach summaries',
  cloudSync: 'Save data in the cloud on signed-in devices',
  localCopy: 'Keep a local copy on this device',
}

export function AccountPrivacyView({
  checkouts,
  history,
  onClearAllHealthHistory,
  onOpenHistory,
  onPrivacyChange,
  painReports,
  preferences,
  schedule,
  session,
}) {
  const [message, setMessage] = useState('')
  const [emailForm, setEmailForm] = useState({ email: '', password: '' })
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
    signOutOtherSessions: true,
  })
  const [mfaState, setMfaState] = useState({
    challengeId: '',
    code: '',
    enrollment: null,
    factors: [],
    isLoading: false,
  })
  const [sensitiveForm, setSensitiveForm] = useState({
    code: '',
    password: '',
  })
  const emailVerified = Boolean(session?.user?.email_confirmed_at)
  const verifiedTotpFactors = useMemo(
    () => mfaState.factors.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified'),
    [mfaState.factors],
  )
  const exportPackage = useMemo(
    () => ({
      exportedAt: new Date().toISOString(),
      account: {
        email: session?.user?.email ?? '',
        id: session?.user?.id ?? '',
      },
      checkouts,
      history,
      painReports,
      preferences,
      schedule,
    }),
    [checkouts, history, painReports, preferences, schedule, session?.user?.email, session?.user?.id],
  )

  useEffect(() => {
    setEmailForm((current) => ({
      ...current,
      email: session?.user?.email ?? '',
    }))
  }, [session?.user?.email])

  useEffect(() => {
    if (!hasSupabaseConfig || !session?.user?.id) return

    loadMfaFactors()
  }, [session?.user?.id])

  async function loadMfaFactors() {
    setMfaState((current) => ({ ...current, isLoading: true }))
    const { data, error } = await supabase.auth.mfa.listFactors()

    if (error) {
      setMessage('Unable to load two-factor settings.')
      setMfaState((current) => ({ ...current, isLoading: false }))
      return
    }

    setMfaState((current) => ({
      ...current,
      factors: [...data.totp, ...data.phone],
      isLoading: false,
    }))
  }

  async function resendVerification() {
    setMessage('')

    if (!session?.user?.email) return

    const { error } = await supabase.auth.resend({
      email: session.user.email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
      type: 'signup',
    })

    setMessage(error ? 'Unable to send verification right now.' : 'Verification email requested.')
  }

  async function verifyWithPassword(password) {
    if (!session?.user?.email) return false

    const { error } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password,
    })

    return !error
  }

  async function updateEmail(event) {
    event.preventDefault()
    setMessage('')

    if (!(await verifyWithPassword(emailForm.password))) {
      setMessage('Unable to verify this sensitive action.')
      return
    }

    const { error } = await supabase.auth.updateUser(
      { email: emailForm.email },
      { emailRedirectTo: getAuthRedirectUrl() },
    )

    setMessage(error ? 'Unable to request email change.' : 'Check both email inboxes to finish the change.')
    setEmailForm((current) => ({ ...current, password: '' }))
  }

  async function updatePassword(event) {
    event.preventDefault()
    setMessage('')

    if (passwordForm.newPassword.length < 10 || passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('Use a stronger matching password before saving.')
      return
    }

    if (!(await verifyWithPassword(passwordForm.currentPassword))) {
      setMessage('Unable to verify this sensitive action.')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    })

    if (!error && passwordForm.signOutOtherSessions) {
      await supabase.auth.signOut({ scope: 'others' })
    }

    setMessage(error ? 'Unable to update password.' : 'Password updated.')
    setPasswordForm({
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
      signOutOtherSessions: true,
    })
  }

  async function startMfaEnrollment() {
    setMessage('')
    setMfaState((current) => ({ ...current, enrollment: null, code: '', challengeId: '' }))

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Athlete Reload',
    })

    if (error) {
      setMessage('Unable to start two-factor setup.')
      return
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId: data.id })

    if (challenge.error) {
      setMessage('Unable to create two-factor challenge.')
      return
    }

    setMfaState((current) => ({
      ...current,
      challengeId: challenge.data.id,
      enrollment: data,
    }))
  }

  async function verifyMfaEnrollment(event) {
    event.preventDefault()
    setMessage('')

    if (!mfaState.enrollment || !mfaState.challengeId) return

    const { error } = await supabase.auth.mfa.verify({
      challengeId: mfaState.challengeId,
      factorId: mfaState.enrollment.id,
      code: mfaState.code,
    })

    if (error) {
      setMessage('Unable to verify that code.')
      return
    }

    setMessage('Two-factor authentication is enabled.')
    setMfaState((current) => ({
      ...current,
      challengeId: '',
      code: '',
      enrollment: null,
    }))
    await loadMfaFactors()
  }

  async function disableMfa(factorId) {
    setMessage('')

    const { error } = await supabase.auth.mfa.unenroll({ factorId })

    setMessage(error ? 'Unable to disable that factor.' : 'Two-factor factor removed.')
    await loadMfaFactors()
  }

  async function verifySensitiveExport() {
    setMessage('')

    if (verifiedTotpFactors.length > 0) {
      if (sensitiveForm.code.length !== 6) {
        setMessage('Enter a two-factor code before exporting.')
        return false
      }

      const factor = verifiedTotpFactors[0]
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })

      if (challenge.error) {
        setMessage('Unable to verify this sensitive action.')
        return false
      }

      const verified = await supabase.auth.mfa.verify({
        challengeId: challenge.data.id,
        factorId: factor.id,
        code: sensitiveForm.code,
      })

      if (verified.error) {
        setMessage('Unable to verify this sensitive action.')
        return false
      }

      return true
    }

    if (!(await verifyWithPassword(sensitiveForm.password))) {
      setMessage('Unable to verify this sensitive action.')
      return false
    }

    return true
  }

  async function downloadData() {
    if (!(await verifySensitiveExport())) return

    const blob = new Blob([JSON.stringify(exportPackage, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `athlete-reload-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setSensitiveForm({ code: '', password: '' })
    setMessage('Data export created.')
  }

  if (!hasSupabaseConfig) {
    return (
      <section className="settings-page">
        <div className="settings-hero">
          <p className="eyebrow">Account & Privacy</p>
          <h1>Security controls need Supabase.</h1>
          <p>Demo mode keeps data on this device. Connect Supabase to use password reset, email verification, MFA, and cloud privacy settings.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="settings-page">
      <div className="settings-hero">
        <p className="eyebrow">Account & Privacy</p>
        <h1>Your information is private by default.</h1>
        <p>
          Coaches, teammates, and other users cannot see your schedule, check-ins, health history, or pain data unless you choose to share a report.
        </p>
      </div>

      {message && <div className="settings-message">{message}</div>}

      <div className="settings-grid">
        <article className="settings-panel">
          <h2>Login Security</h2>
          <div className="account-status">
            <span>Email</span>
            <strong>{session?.user?.email}</strong>
          </div>
          <div className="account-status">
            <span>Verification</span>
            <strong>{emailVerified ? 'Verified' : 'Not verified yet'}</strong>
          </div>
          {!emailVerified && (
            <button className="secondary-button compact-action" onClick={resendVerification} type="button">
              Resend verification
            </button>
          )}
        </article>

        <article className="settings-panel">
          <h2>Change Email</h2>
          <form className="settings-form" onSubmit={updateEmail}>
            <label className="select-field">
              New email
              <input
                onChange={(event) => setEmailForm((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={emailForm.email}
              />
            </label>
            <label className="select-field">
              Current password
              <input
                autoComplete="current-password"
                onChange={(event) => setEmailForm((current) => ({ ...current, password: event.target.value }))}
                required
                type="password"
                value={emailForm.password}
              />
            </label>
            <button className="primary-button" type="submit">Request email change</button>
          </form>
        </article>

        <article className="settings-panel">
          <h2>Change Password</h2>
          <form className="settings-form" onSubmit={updatePassword}>
            <label className="select-field">
              Current password
              <input
                autoComplete="current-password"
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                required
                type="password"
                value={passwordForm.currentPassword}
              />
            </label>
            <label className="select-field">
              New password
              <input
                autoComplete="new-password"
                minLength={10}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                required
                type="password"
                value={passwordForm.newPassword}
              />
            </label>
            <label className="select-field">
              Confirm new password
              <input
                autoComplete="new-password"
                minLength={10}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                required
                type="password"
                value={passwordForm.confirmPassword}
              />
            </label>
            <label className="setting-toggle inline-toggle">
              <input
                checked={passwordForm.signOutOtherSessions}
                onChange={(event) => setPasswordForm((current) => ({
                  ...current,
                  signOutOtherSessions: event.target.checked,
                }))}
                type="checkbox"
              />
              Sign out other sessions
            </label>
            <button className="primary-button" type="submit">Update password</button>
          </form>
        </article>

        <article className="settings-panel">
          <h2>Two-Factor Authentication</h2>
          <p className="settings-copy">
            Optional authenticator-based 2FA works with Apple Passwords, Google Authenticator, Microsoft Authenticator, Authy, and 1Password.
          </p>
          <div className="factor-list">
            {verifiedTotpFactors.length === 0 ? (
              <span>No verified authenticator app yet.</span>
            ) : (
              verifiedTotpFactors.map((factor) => (
                <div className="factor-row" key={factor.id}>
                  <span>{factor.friendly_name ?? 'Authenticator app'}</span>
                  <button className="remove-button" onClick={() => disableMfa(factor.id)} type="button">
                    Disable
                  </button>
                </div>
              ))
            )}
          </div>
          {!mfaState.enrollment && (
            <button className="primary-button" disabled={mfaState.isLoading} onClick={startMfaEnrollment} type="button">
              Enable 2FA
            </button>
          )}
          {mfaState.enrollment && (
            <form className="mfa-setup" onSubmit={verifyMfaEnrollment}>
              <img src={getQrSource(mfaState.enrollment.totp.qr_code)} alt="Two-factor QR code" />
              <p>Scan the QR code, then enter the six-digit code.</p>
              <label className="select-field">
                Authenticator code
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setMfaState((current) => ({
                    ...current,
                    code: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))}
                  required
                  type="text"
                  value={mfaState.code}
                />
              </label>
              <button className="primary-button" type="submit">Verify and enable</button>
            </form>
          )}
        </article>

        <article className="settings-panel">
          <h2>Privacy Choices</h2>
          <div className="settings-toggles">
            {Object.entries(preferenceLabels).map(([key, label]) => (
              <label className="setting-toggle" key={key}>
                <input
                  checked={Boolean(preferences[key])}
                  onChange={(event) => onPrivacyChange(key, event.target.checked)}
                  type="checkbox"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </article>

        <article className="settings-panel">
          <h2>Data Controls</h2>
          <p className="settings-copy">
            Exporting health data requires password verification, or a 2FA code when two-factor authentication is enabled.
          </p>
          <div className="sensitive-row">
            {verifiedTotpFactors.length > 0 ? (
              <label className="select-field">
                2FA code
                <input
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setSensitiveForm((current) => ({
                    ...current,
                    code: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))}
                  type="text"
                  value={sensitiveForm.code}
                />
              </label>
            ) : (
              <label className="select-field">
                Current password
                <input
                  autoComplete="current-password"
                  onChange={(event) => setSensitiveForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))}
                  type="password"
                  value={sensitiveForm.password}
                />
              </label>
            )}
            <button className="secondary-button compact-action" onClick={downloadData} type="button">
              Download my data
            </button>
          </div>
          <div className="danger-actions">
            <button className="secondary-button compact-action" onClick={onOpenHistory} type="button">
              Delete individual check-ins
            </button>
            <button className="secondary-button compact-action" onClick={onOpenHistory} type="button">
              Delete pain timeline
            </button>
            <button className="remove-button compact-action" onClick={onClearAllHealthHistory} type="button">
              Clear all health history
            </button>
          </div>
        </article>

        <article className="settings-panel">
          <h2>Account Limits</h2>
          <p className="settings-copy">
            Supabase dashboard settings should also be enabled for email confirmation, leaked-password protection, and auth rate limits. Do not call Athlete Reload HIPAA compliant unless the legal, infrastructure, contractual, and operational requirements have been completed.
          </p>
          <p className="settings-copy">
            Full account deletion and outside health-service connections should be handled by a server function with service-role permissions before release.
          </p>
        </article>
      </div>
    </section>
  )
}

function getQrSource(qrCode) {
  if (!qrCode) return ''
  if (qrCode.startsWith('data:')) return qrCode

  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`
}
