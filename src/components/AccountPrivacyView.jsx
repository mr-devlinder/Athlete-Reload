import { useEffect, useMemo, useState } from 'react'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import { SectionHeading } from './SectionHeading'

const brandIconBase = `${import.meta.env.BASE_URL}brand-icons/`

export function AccountPrivacyView({
  checkouts,
  history,
  onAccountDeleted,
  onClearAllHealthHistory,
  painReports,
  preferences,
  schedule,
  session,
}) {
  const [message, setMessage] = useState('')
  const [activeSection, setActiveSection] = useState('account')
  const [identities, setIdentities] = useState([])
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [clearHistoryForm, setClearHistoryForm] = useState({ code: '', confirmation: '', password: '' })
  const [deleteForm, setDeleteForm] = useState({ code: '', confirmation: '', password: '' })
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
    loadIdentities()
  }, [session?.user?.id])

  async function loadIdentities() {
    const { data, error } = await supabase.auth.getUserIdentities()

    if (error) {
      setMessage('Unable to load connected accounts.')
      return
    }

    setIdentities(data?.identities ?? [])
  }

  async function connectProvider(provider) {
    setMessage('')

    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: getAuthRedirectUrl() },
    })

    if (error) {
      setMessage('Unable to start account connection. Check that this provider and manual linking are enabled in Supabase.')
    }
  }

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

  async function verifyDeleteTotp() {
    const factor = verifiedTotpFactors[0]
    if (!factor || deleteForm.code.length !== 6) return false

    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challenge.error) return false

    const verified = await supabase.auth.mfa.verify({
      challengeId: challenge.data.id,
      factorId: factor.id,
      code: deleteForm.code,
    })

    return !verified.error
  }

  async function verifyClearHistoryTotp() {
    const factor = verifiedTotpFactors[0]
    if (!factor || clearHistoryForm.code.length !== 6) return false

    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challenge.error) return false

    const verified = await supabase.auth.mfa.verify({
      challengeId: challenge.data.id,
      factorId: factor.id,
      code: clearHistoryForm.code,
    })

    return !verified.error
  }

  async function clearHealthHistory(event) {
    event.preventDefault()
    setMessage('')

    if (clearHistoryForm.confirmation !== 'CLEAR') {
      setMessage('Type CLEAR to confirm health history deletion.')
      return
    }

    const usesTotp = verifiedTotpFactors.length > 0
    if (usesTotp && !(await verifyClearHistoryTotp())) {
      setMessage('Unable to verify this sensitive action.')
      return
    }

    const { error } = await supabase.functions.invoke('clear-health-history', {
      body: {
        method: usesTotp ? 'totp' : 'password',
        password: usesTotp ? undefined : clearHistoryForm.password,
      },
    })

    if (error) {
      setMessage('Unable to clear health history. Verify your confirmation and try again.')
      return
    }

    await onClearAllHealthHistory({ remotelyCleared: true })
    setIsClearHistoryModalOpen(false)
    setClearHistoryForm({ code: '', confirmation: '', password: '' })
    setMessage('Health history cleared.')
  }

  async function deleteAccount(event) {
    event.preventDefault()
    setMessage('')

    if (deleteForm.confirmation !== 'DELETE') {
      setMessage('Type DELETE to confirm account deletion.')
      return
    }

    const usesTotp = verifiedTotpFactors.length > 0
    if (usesTotp && !(await verifyDeleteTotp())) {
      setMessage('Unable to verify this sensitive action.')
      return
    }

    const { error } = await supabase.functions.invoke('delete-account', {
      body: {
        method: usesTotp ? 'totp' : 'password',
        password: usesTotp ? undefined : deleteForm.password,
      },
    })

    if (error) {
      setMessage('Unable to delete your account. Verify your confirmation and try again.')
      return
    }

    setIsDeleteModalOpen(false)
    setDeleteForm({ code: '', confirmation: '', password: '' })
    await onAccountDeleted()
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

      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="Settings sections">
          {[['account', 'Account'], ['security', 'Security'], ['data', 'Data']].map(([key, label]) => (
            <button className={activeSection === key ? 'active' : ''} key={key} onClick={() => setActiveSection(key)} type="button">
              {label}
            </button>
          ))}
        </aside>
        <div className="settings-grid">
        <article className="settings-panel" hidden={activeSection !== 'account'}>
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

        <article className="settings-panel" hidden={activeSection !== 'account'}>
          <h2>Connected accounts</h2>
          <p className="settings-copy">These are the sign-in providers already connected to this account.</p>
          <div className="connection-list">
            {providerOptions.map((provider) => {
              const connected = getConnectedProviders(identities).some((identity) => identity.provider === provider.id)

              return (
                <div className="connection-row" key={provider.id}>
                  <span className="connection-provider">
                    <img src={`${brandIconBase}${provider.id}.svg`} alt="" aria-hidden="true" />
                    {provider.label}
                  </span>
                  {connected ? (
                    <strong>Connected</strong>
                  ) : (
                    <button className="secondary-button compact-action" onClick={() => connectProvider(provider.id)} type="button">Connect</button>
                  )}
                </div>
              )
            })}
          </div>
        </article>

        <article className="settings-panel" hidden={activeSection !== 'account'}>
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

        <article className="settings-panel" hidden={activeSection !== 'security'}>
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

        <article className="settings-panel" hidden={activeSection !== 'security'}>
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

        <article className="settings-panel" hidden={activeSection !== 'data'}>
          <h2>Data Controls</h2>
          <div className="data-control-section">
            <div>
              <h3>Export your data</h3>
              <p className="settings-copy">Password verification, or a 2FA code when enabled, is required before creating an export.</p>
            </div>
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
              <button className="secondary-button compact-action" onClick={downloadData} type="button">Download my data</button>
            </div>
          </div>
          <div className="data-control-section danger-data-section">
            <div>
              <h3>Clear health history</h3>
              <p className="settings-copy">Removes saved check-ins, checkouts, and pain reports while keeping your account and schedule.</p>
            </div>
            <button className="remove-button compact-action" onClick={() => setIsClearHistoryModalOpen(true)} type="button">Clear health history</button>
          </div>
          <div className="data-control-section danger-data-section">
            <div>
              <h3>Delete account</h3>
              <p className="settings-copy">Permanently removes your account and all Athlete Reload data after a security confirmation.</p>
            </div>
            <button className="remove-button compact-action" onClick={() => setIsDeleteModalOpen(true)} type="button">Delete account</button>
          </div>
        </article>

        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsDeleteModalOpen(false)}>
          <section className="event-modal delete-account-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="schedule-header">
              <SectionHeading eyebrow="Permanent action" title="Delete your account?" />
              <button className="ghost-close" onClick={() => setIsDeleteModalOpen(false)} type="button">Close</button>
            </div>
            <p className="settings-copy">This permanently deletes your Athlete Reload account and its saved health, schedule, check-in, checkout, association, and preference data.</p>
            <form className="settings-form" onSubmit={deleteAccount}>
              <label className="select-field">
                Type DELETE to confirm
                <input autoComplete="off" value={deleteForm.confirmation} onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))} required />
              </label>
              {verifiedTotpFactors.length > 0 ? (
                <label className="select-field">
                  2FA code
                  <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setDeleteForm((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} required type="text" value={deleteForm.code} />
                </label>
              ) : (
                <label className="select-field">
                  Current password
                  <input autoComplete="current-password" onChange={(event) => setDeleteForm((current) => ({ ...current, password: event.target.value }))} required type="password" value={deleteForm.password} />
                </label>
              )}
              <button className="remove-button" type="submit">Permanently delete account</button>
            </form>
          </section>
        </div>
      )}

      {isClearHistoryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsClearHistoryModalOpen(false)}>
          <section className="event-modal delete-account-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="schedule-header">
              <SectionHeading eyebrow="Protected action" title="Clear health history?" />
              <button className="ghost-close" onClick={() => setIsClearHistoryModalOpen(false)} type="button">Close</button>
            </div>
            <p className="settings-copy">This permanently removes your saved check-ins, checkouts, and pain reports. Your account and schedule remain intact.</p>
            <form className="settings-form" onSubmit={clearHealthHistory}>
              <label className="select-field">
                Type CLEAR to confirm
                <input autoComplete="off" value={clearHistoryForm.confirmation} onChange={(event) => setClearHistoryForm((current) => ({ ...current, confirmation: event.target.value }))} required />
              </label>
              {verifiedTotpFactors.length > 0 ? (
                <label className="select-field">
                  2FA code
                  <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setClearHistoryForm((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} required type="text" value={clearHistoryForm.code} />
                </label>
              ) : (
                <label className="select-field">
                  Current password
                  <input autoComplete="current-password" onChange={(event) => setClearHistoryForm((current) => ({ ...current, password: event.target.value }))} required type="password" value={clearHistoryForm.password} />
                </label>
              )}
              <button className="remove-button" type="submit">Permanently clear health history</button>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

function getConnectedProviders(identities) {
  return identities
    .filter((identity) => providerOptions.some((provider) => provider.id === identity.provider))
    .map((identity) => ({ id: identity.identity_id ?? identity.id ?? identity.provider, provider: identity.provider }))
}

const providerOptions = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'discord', label: 'Discord' },
]

function getQrSource(qrCode) {
  if (!qrCode) return ''
  if (qrCode.startsWith('data:')) return qrCode

  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`
}
