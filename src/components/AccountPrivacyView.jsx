import { useEffect, useMemo, useState } from 'react'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import { SectionHeading } from './SectionHeading'
import { useModalAccessibility } from '../hooks/useModalAccessibility'
import { canRemoveAuthMethod, getUnlinkMessage, resolveAuthMethods } from '../lib/authMethods'
import { AppIcon } from './AppIcon'

const brandIconBase = `${import.meta.env.BASE_URL}brand-icons/`

export function AccountPrivacyView({
  associations = [],
  athleteProfile,
  checkouts,
  dailyWellness,
  history,
  nutritionHistory = [],
  onUpdateAiPersonalizationPreference,
  onUpdateDisplayPreference,
  onOpenLegal,
  onAccountDeleted,
  onClearAllHealthHistory,
  onDeleteShareAuditLog,
  onUpdateReminderPreference,
  painReports,
  painIssues = [],
  preferences,
  schedule,
  recoveryCompletions = [],
  savedRoutines = [],
  session,
  shareAuditLogs = [],
  tournaments = [],
}) {
  const [message, setMessage] = useState('')
  const [openConnectionAction, setOpenConnectionAction] = useState(null)
  const [openShareAuditAction, setOpenShareAuditAction] = useState(null)
  const [activeSection, setActiveSection] = useState('account')
  const [identities, setIdentities] = useState([])
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const deleteDialogRef = useModalAccessibility(isDeleteModalOpen, () => setIsDeleteModalOpen(false))
  const clearHealthDialogRef = useModalAccessibility(isClearHistoryModalOpen, () => setIsClearHistoryModalOpen(false))
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
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
      associations,
      athleteProfile,
      checkouts,
      dailyWellness,
      history,
      painReports,
      painIssues,
      preferences,
      nutritionHistory,
      recoveryCompletions,
      savedRoutines,
      schedule,
      shareAuditLogs,
      tournaments,
    }),
    [associations, athleteProfile, checkouts, dailyWellness, history, nutritionHistory, painIssues, painReports, preferences, recoveryCompletions, savedRoutines, schedule, session?.user?.email, session?.user?.id, shareAuditLogs, tournaments],
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

  async function disconnectProvider(identity) {
    setMessage('')
    setOpenConnectionAction(null)

    if (!identity?.raw || !canRemoveAuthMethod(identity.provider, identities, session?.user)) {
      setMessage('Connect another sign-in method before removing this one.')
      return
    }

    const { error } = await supabase.auth.unlinkIdentity(identity.raw)
    if (error) {
      setMessage(getUnlinkMessage(error))
      return
    }

    await loadIdentities()
    setMessage(`${providerOptions.find((provider) => provider.id === identity.provider)?.label ?? 'Account'} connection removed.`)
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

  async function downloadCsv() {
    if (!(await verifySensitiveExport())) return

    const rows = nutritionHistory.flatMap((day) => (day.nutritionEntries ?? []).map((entry) => ({
      date: day.date,
      meal: entry.meal ?? '',
      food: entry.name ?? '',
      brand: entry.brand ?? '',
      serving: entry.servingSize ?? '',
      calories: entry.calories ?? 0,
      protein_g: entry.protein ?? 0,
      carbohydrates_g: entry.carbohydrates ?? 0,
      fats_g: entry.fats ?? 0,
      hydration_ml: day.hydrationMl ?? 0,
    })))
    const headers = ['date', 'meal', 'food', 'brand', 'serving', 'calories', 'protein_g', 'carbohydrates_g', 'fats_g', 'hydration_ml']
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `athlete-reload-nutrition-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setSensitiveForm({ code: '', password: '' })
    setMessage('Nutrition CSV created.')
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

    setIsDeletingAccount(true)
    try {
      const usesTotp = verifiedTotpFactors.length > 0
      if (usesTotp && !(await verifyDeleteTotp())) {
        setMessage('Unable to verify this sensitive action.')
        return
      }

      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: {
          confirmation: deleteForm.confirmation,
          method: usesTotp ? 'totp' : 'password',
          password: usesTotp ? undefined : deleteForm.password,
        },
      })

      if (error || !data?.deleted) {
        const detail = await getFunctionErrorMessage(error)
        setMessage(detail || data?.error || 'Unable to delete your account. No success was reported.')
        return
      }

      setMessage('Account deleted. Signing you out...')
      setIsDeleteModalOpen(false)
      setDeleteForm({ code: '', confirmation: '', password: '' })
      await onAccountDeleted()
    } finally {
      setIsDeletingAccount(false)
    }
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
          {[['account', 'Account'], ['appearance', 'Appearance'], ['preferences', 'Preferences'], ['security', 'Security'], ['data', 'Privacy & Data'], ['legal', 'Legal']].map(([key, label]) => (
            <button className={activeSection === key ? 'active' : ''} key={key} onClick={() => setActiveSection(key)} type="button">
              {label}
            </button>
          ))}
        </aside>
        <div className="settings-grid">
        <article className="settings-panel settings-panel-wide" hidden={activeSection !== 'account'}>
          <div className="settings-panel-heading"><div><span>Sign-in details</span><h2>Your account</h2></div><p>The email address and verification state used to protect this account.</p></div>
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

        <article className="settings-panel settings-panel-wide" hidden={activeSection !== 'appearance'}>
          <div className="settings-panel-heading"><div><span>Interface</span><h2>Appearance and behavior</h2></div><p>Choose how Athlete Reload looks and opens across your devices.</p></div>
          <div className="settings-preference-grid">
            <label className="select-field">Units<select value={preferences.display?.unitSystem ?? athleteProfile?.unitSystem ?? 'imperial'} onChange={(event) => onUpdateDisplayPreference?.('unitSystem', event.target.value)}><option value="imperial">Imperial</option><option value="metric">Metric</option></select></label>
            <label className="select-field">Startup motion<select value={preferences.display?.startupMotion ?? 'full'} onChange={(event) => onUpdateDisplayPreference?.('startupMotion', event.target.value)}><option value="full">Full animation</option><option value="reduced">Reduced animation</option></select></label>
            <label className="select-field">Interface density<select value={preferences.display?.density ?? 'comfortable'} onChange={(event) => onUpdateDisplayPreference?.('density', event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
            <label className="select-field">Default landing tab<select value={preferences.display?.defaultView ?? 'Home'} onChange={(event) => onUpdateDisplayPreference?.('defaultView', event.target.value)}>{['Home', 'Nutrition', 'Recovery', 'Check-in', 'Schedule', 'History'].map((view) => <option key={view}>{view}</option>)}</select></label>
            <label className="select-field">Week starts on<select value={preferences.display?.weekStartsOn ?? 1} onChange={(event) => onUpdateDisplayPreference?.('weekStartsOn', Number(event.target.value))}><option value={1}>Monday</option><option value={0}>Sunday</option></select></label>
          </div>
          <label className="settings-toggle"><input checked={preferences.display?.showNutritionTargets !== false} onChange={(event) => onUpdateDisplayPreference?.('showNutritionTargets', event.target.checked)} type="checkbox" /><span>Show daily nutrition and hydration targets</span></label>
        </article>

        <article className="settings-panel" hidden={activeSection !== 'preferences'}>
          <h2>Event reminders</h2>
          <p className="settings-copy">When Athlete Reload is open, you can receive browser reminders to check in before an event and complete checkout after it starts. Your browser may still need its own notification permission.</p>
          <label className="settings-toggle">
            <input checked={Boolean(preferences.remindersEnabled)} onChange={(event) => onUpdateReminderPreference?.(event.target.checked)} type="checkbox" />
            <span>Enable event reminders</span>
          </label>
        </article>

        <article className="settings-panel" hidden={activeSection !== 'preferences'}>
          <h2>AI personalization</h2>
          <p className="settings-copy">When enabled, recommendations may use your profile, prior training, pain, recovery, and nutrition context. When disabled, AI receives only the current request and event details needed to generate the feature you asked for.</p>
          <label className="settings-toggle">
            <input checked={preferences.aiPersonalizationEnabled !== false} onChange={(event) => onUpdateAiPersonalizationPreference?.(event.target.checked)} type="checkbox" />
            <span>Personalize AI recommendations with my history</span>
          </label>
        </article>

        <article className="settings-panel" hidden={activeSection !== 'preferences'}>
          <h2>Device permissions</h2>
          <p className="settings-copy">Camera access is requested only when you start barcode scanning. Microphone access is requested only when you start voice entry or voice search, and the resulting transcript can be reviewed before use. Notification access is requested only when you enable event reminders. Athlete Reload does not request photo-library, precise device-location, or health-platform permissions.</p>
        </article>

        <article className="settings-panel settings-panel-wide" hidden={activeSection !== 'account'}>
          <h2>Connected accounts</h2>
          <p className="settings-copy">Use any connected identity to sign in to the same Athlete Reload account.</p>
          <div className="connection-list">
            {providerOptions.map((provider) => {
              const identity = getConnectedProviders(identities, session?.user).find((item) => item.provider === provider.id)
              const connected = Boolean(identity)

              return (
                <div className="connection-row" key={provider.id}>
                  <div className="connection-provider">
                    {provider.icon ? <img src={`${brandIconBase}${provider.icon}.svg`} alt="" aria-hidden="true" /> : <span className="connection-email-icon" aria-hidden="true"><AppIcon name="email" size={18} /></span>}
                    <span><strong>{provider.label}</strong>{identity?.display && <small>{identity.display}</small>}</span>
                  </div>
                  {connected ? (
                    <div className="connection-actions">
                      <span className="connection-status"><i aria-hidden="true" />Connected</span>
                      {identity.raw && provider.id !== 'email' && (
                        <div className="connection-menu-wrap">
                          <button aria-expanded={openConnectionAction === identity.id} aria-haspopup="menu" aria-label={`Manage ${provider.label} connection`} className="connection-more app-icon-button" onClick={() => setOpenConnectionAction((current) => current === identity.id ? null : identity.id)} type="button"><AppIcon name="more" size={20} /></button>
                          {openConnectionAction === identity.id && (
                            <div className="connection-menu" role="menu">
                              <button onClick={() => disconnectProvider(identity)} role="menuitem" type="button">Remove connection</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button className="secondary-button compact-action" onClick={() => connectProvider(provider.id)} type="button">Connect</button>
                  )}
                </div>
              )
            })}
          </div>
        </article>

        <article className="settings-panel settings-panel-wide" hidden={activeSection !== 'account'}>
          <div className="settings-panel-heading"><div><span>Account access</span><h2>Change email</h2></div><p>We will send confirmation links before the new address becomes active.</p></div>
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
              <button className="secondary-button compact-action" onClick={downloadData} type="button">Download JSON</button>
              <button className="secondary-button compact-action" onClick={downloadCsv} type="button">Download nutrition CSV</button>
            </div>
          </div>
          <div className="data-control-section danger-data-section">
            <div>
              <h3>Clear health data</h3>
              <p className="settings-copy">Removes wellness, nutrition, pain, check-in, checkout, voice, and recovery records while keeping your account and schedule.</p>
            </div>
            <button className="remove-button compact-action" onClick={() => setIsClearHistoryModalOpen(true)} type="button">Clear health data</button>
          </div>
          <div className="data-control-section">
            <div>
              <h3>Shared report activity</h3>
              <p className="settings-copy">A record of printable reports created from this account.</p>
            </div>
            {shareAuditLogs.length === 0 ? <span className="settings-copy">No reports shared yet.</span> : (
              <div className="share-audit-list">
                <div className="share-audit-recent">
                  {shareAuditLogs.slice(0, 3).map((entry) => <ShareAuditRow entry={entry} key={entry.id} onDelete={onDeleteShareAuditLog} onToggle={setOpenShareAuditAction} openId={openShareAuditAction} />)}
                </div>
                {shareAuditLogs.length > 3 && <div className="share-audit-scroll" aria-label="Earlier shared reports">{shareAuditLogs.slice(3).map((entry) => <ShareAuditRow entry={entry} key={entry.id} onDelete={onDeleteShareAuditLog} onToggle={setOpenShareAuditAction} openId={openShareAuditAction} />)}</div>}
              </div>
            )}
          </div>
          <div className="data-control-section danger-data-section">
            <div>
              <h3>Delete account</h3>
              <p className="settings-copy">Permanently removes your account and all Athlete Reload data after a security confirmation.</p>
            </div>
            <button className="remove-button compact-action" onClick={() => setIsDeleteModalOpen(true)} type="button">Delete account</button>
          </div>
        </article>

        <article className="settings-panel settings-panel-wide" hidden={activeSection !== 'legal'}>
          <div className="settings-panel-heading"><div><span>Policies</span><h2>Legal information</h2></div><p>Review the current terms governing Athlete Reload and its wellness guidance.</p></div>
          <div className="legal-link-grid">
            <button className="secondary-button" onClick={() => onOpenLegal?.('privacy')} type="button">Privacy policy</button>
            <button className="secondary-button" onClick={() => onOpenLegal?.('terms')} type="button">Terms of service</button>
            <button className="secondary-button" onClick={() => onOpenLegal?.('medical')} type="button">Medical disclaimer</button>
          </div>
        </article>

        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsDeleteModalOpen(false)}>
          <section aria-labelledby="delete-account-title" className="event-modal delete-account-modal glass-panel" onClick={(event) => event.stopPropagation()} ref={deleteDialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
            <div className="schedule-header">
              <div id="delete-account-title"><SectionHeading eyebrow="Permanent action" title="Delete your account?" /></div>
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
              <button className="remove-button" disabled={isDeletingAccount} type="submit">{isDeletingAccount ? 'Deleting account...' : 'Permanently delete account'}</button>
            </form>
          </section>
        </div>
      )}

      {isClearHistoryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsClearHistoryModalOpen(false)}>
          <section aria-labelledby="clear-health-title" className="event-modal delete-account-modal glass-panel" onClick={(event) => event.stopPropagation()} ref={clearHealthDialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
            <div className="schedule-header">
              <div id="clear-health-title"><SectionHeading eyebrow="Protected action" title="Clear all health data?" /></div>
              <button className="ghost-close" onClick={() => setIsClearHistoryModalOpen(false)} type="button">Close</button>
            </div>
            <p className="settings-copy">This permanently removes wellness, nutrition, pain, check-in, checkout, voice, and recovery records. Your account and schedule remain intact.</p>
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

async function getFunctionErrorMessage(error) {
  try {
    const response = error?.context
    if (response instanceof Response) {
      const body = await response.clone().json()
      return body?.error ?? ''
    }
  } catch {
    // Fall through to the stable client-facing message.
  }
  return ''
}

function ShareAuditRow({ entry, onDelete, onToggle, openId }) {
  const isOpen = openId === entry.id

  return (
    <div className="share-audit-row">
      <div><strong>{entry.reportType.replaceAll('_', ' ')}</strong>{entry.recipientLabel ? ` · ${entry.recipientLabel}` : ''}<small>{new Date(entry.createdAt).toLocaleDateString()}</small></div>
      <div className="share-audit-actions">
        <button aria-expanded={isOpen} aria-label="Shared report actions" className="share-audit-more app-icon-button" onClick={() => onToggle(isOpen ? null : entry.id)} type="button"><AppIcon name="more" size={20} /></button>
        {isOpen && <div className="share-audit-menu"><button onClick={() => { onToggle(null); onDelete?.(entry.id) }} type="button">Delete</button></div>}
      </div>
    </div>
  )
}

function getConnectedProviders(identities, user) {
  const connected = identities
    .filter((identity) => providerOptions.some((provider) => provider.id === identity.provider))
    .map((identity) => ({
      display: getIdentityDisplay(identity, user),
      id: identity.identity_id ?? identity.id ?? identity.provider,
      provider: identity.provider,
      raw: identity,
    }))

  if (user?.email && resolveAuthMethods(identities, user).includes('email') && !connected.some((identity) => identity.provider === 'email')) {
    connected.unshift({ display: user.email, id: 'email', provider: 'email' })
  }

  return connected
}

function getIdentityDisplay(identity, user) {
  const data = identity.identity_data ?? {}
  if (identity.provider === 'email') return data.email ?? user?.email ?? ''
  if (identity.provider === 'github') return formatUsername(data.user_name ?? data.preferred_username ?? data.login ?? data.name)
  if (identity.provider === 'discord') return formatUsername(data.full_name ?? data.user_name ?? data.preferred_username ?? data.name)
  return data.email ?? data.full_name ?? data.name ?? ''
}

function formatUsername(value) {
  const username = String(value ?? '').trim()
  return username && !username.includes('@') ? `@${username.replace(/^@/, '')}` : username
}

const providerOptions = [
  { id: 'email', label: 'Email' },
  { icon: 'google', id: 'google', label: 'Google' },
  { icon: 'github', id: 'github', label: 'GitHub' },
  { icon: 'discord', id: 'discord', label: 'Discord' },
]

function getQrSource(qrCode) {
  if (!qrCode) return ''
  if (qrCode.startsWith('data:')) return qrCode

  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`
}
