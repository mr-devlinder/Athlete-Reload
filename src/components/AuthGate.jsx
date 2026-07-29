import { useMemo, useState } from 'react'
import appLogo from '../assets/athlete-reload-logo-transparent.png'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

const authDefaults = {
  email: '',
  password: '',
}

const brandIconBase = `${import.meta.env.BASE_URL}brand-icons/`

export function AuthGate({
  initialMode = 'landing',
  onAuthenticated,
  onDemoSession,
  onUseRememberedSession,
  rememberedSession,
}) {
  const [mode, setMode] = useState(initialMode)
  const [authForm, setAuthForm] = useState(authDefaults)
  const [authMessage, setAuthMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [resetForm, setResetForm] = useState({
    password: '',
    confirmPassword: '',
    signOutOtherSessions: true,
  })
  const isSigningUp = mode === 'signup'
  const isResettingPassword = mode === 'reset-password'
  const canResendVerification = isSigningUp && isValidEmail(authForm.email)
  const passwordStrength = useMemo(
    () => getPasswordStrength(isResettingPassword ? resetForm.password : authForm.password),
    [authForm.password, isResettingPassword, resetForm.password],
  )

  function updateAuthField(field, value) {
    setAuthForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function showGenericAuthError(error) {
    if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') {
      setAuthMessage('Too many confirmation emails were requested. Please wait a little while before trying again.')
      return
    }

    setAuthMessage('Unable to complete that request. Check your information and try again.')
  }

  async function startPasswordReset() {
    setAuthMessage('')

    if (!hasSupabaseConfig) {
      setAuthMessage('Password reset is available after Supabase is connected.')
      return
    }

    if (!authForm.email) {
      setAuthMessage('Enter your email first, then request the reset link.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(authForm.email, {
      redirectTo: getAuthRedirectUrl(),
    })
    setIsSubmitting(false)

    if (error) {
      showGenericAuthError(error)
      return
    }

    setAuthMessage('If that email can receive resets, Supabase will send a secure link.')
  }

  async function resendVerification() {
    setAuthMessage('')

    if (!hasSupabaseConfig) return

    if (!authForm.email) {
      setAuthMessage('Enter your email first, then resend verification.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.resend({
      email: authForm.email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
      type: 'signup',
    })
    setIsSubmitting(false)

    if (error) {
      showGenericAuthError(error)
      return
    }

    setAuthMessage('If verification is available for that address, a new email is on the way.')
  }

  async function startMfaChallenge(session) {
    const { data, error } = await supabase.auth.mfa.listFactors()

    if (error) {
      showGenericAuthError(error)
      return
    }

    const factor = data.totp.find((item) => item.status === 'verified')

    if (!factor) {
      onAuthenticated(session)
      return
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })

    if (challenge.error) {
      showGenericAuthError()
      return
    }

    setMfaChallenge({
      challengeId: challenge.data.id,
      factorId: factor.id,
    })
    setAuthMessage('Enter the six-digit code from your authenticator app.')
  }

  async function signInWithProvider(provider) {
    setAuthMessage('')

    if (!hasSupabaseConfig) {
      setAuthMessage('Social sign-in is available after Supabase is connected.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      setIsSubmitting(false)
      setAuthMessage('Unable to start social sign-in. Check that this provider is enabled in Supabase.')
    }
  }

  async function verifyMfa(event) {
    event.preventDefault()

    if (!mfaChallenge) return

    setAuthMessage('')
    setIsSubmitting(true)
    const { error } = await supabase.auth.mfa.verify({
      challengeId: mfaChallenge.challengeId,
      factorId: mfaChallenge.factorId,
      code: mfaCode,
    })

    if (error) {
      setIsSubmitting(false)
      showGenericAuthError()
      return
    }

    const { data } = await supabase.auth.getSession()
    setIsSubmitting(false)

    if (data.session) {
      onAuthenticated(data.session)
    }
  }

  async function finishPasswordReset(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!hasSupabaseConfig) return

    if (!isStrongEnough(resetForm.password)) {
      setAuthMessage('Choose a stronger password before saving it.')
      return
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setAuthMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({
      password: resetForm.password,
    })

    if (error) {
      setIsSubmitting(false)
      showGenericAuthError()
      return
    }

    if (resetForm.signOutOtherSessions) {
      await supabase.auth.signOut({ scope: 'others' })
    }

    const { data } = await supabase.auth.getSession()
    setIsSubmitting(false)

    if (data.session) {
      onAuthenticated(data.session)
    } else {
      setMode('signin')
      setAuthMessage('Password updated. Sign in again to continue.')
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!hasSupabaseConfig) {
      onDemoSession(authForm.email || 'demo@athletereload.local')
      return
    }

    if (isSigningUp && !isStrongEnough(authForm.password)) {
      setAuthMessage('Choose a stronger password before creating the account.')
      return
    }

    setIsSubmitting(true)

    const authRequest = isSigningUp
      ? supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })
      : supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        })

    const { data, error } = await authRequest
    setIsSubmitting(false)

    if (error) {
      showGenericAuthError(error)
      return
    }

    if (isSigningUp) {
      setAuthMessage('Check your email to finish creating your account.')
      return
    }

    if (data.session) {
      await startMfaChallenge(data.session)
    }
  }

  if (mfaChallenge) {
    return (
      <section className="auth-content">
        <form className="auth-panel glass-panel" onSubmit={verifyMfa}>
          <button
            className="ghost-close auth-back"
            onClick={() => {
              setMfaChallenge(null)
              setMfaCode('')
            }}
            type="button"
          >
            Back
          </button>
          <div className="landing-logo">
            <img src={appLogo} alt="Athlete Reload logo" />
            <span>Two-factor check</span>
          </div>
          <p className="auth-message">
            Enter the six-digit code from your authenticator app to finish signing in.
          </p>
          <label className="select-field">
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              required
              type="text"
              value={mfaCode}
            />
          </label>
          {authMessage && <p className="auth-message">{authMessage}</p>}
          <button className="primary-button" disabled={isSubmitting || mfaCode.length < 6} type="submit">
            {isSubmitting ? 'Checking...' : 'Verify code'}
          </button>
        </form>
      </section>
    )
  }

  if (mode === 'landing') {
    return (
      <section className="landing-content">
        <div className="landing-copy">
          <div className="landing-logo">
            <img src={appLogo} alt="Athlete Reload logo" />
            <span>Athlete Reload</span>
          </div>
          <p className="eyebrow">Readiness Planner</p>
          <h1>Prepare. Perform. Recover. Reload.</h1>
          <p>
            A clean daily check-in for soreness, pain, fatigue, sleep, and team
            sessions before you choose the next training move.
          </p>
          <div className="landing-actions">
            <button
              className="primary-button compact-action"
              onClick={() => {
                if (rememberedSession) {
                  onUseRememberedSession()
                  return
                }

                setMode('signin')
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className="ghost-close"
              onClick={() => setMode('signup')}
              type="button"
            >
              Create account
            </button>
          </div>
        </div>

        <div className="landing-card glass-panel">
          <span>Today</span>
          <strong>84</strong>
          <p>Modified training</p>
          <div className="landing-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
    )
  }

  if (isResettingPassword) {
    return (
      <section className="auth-content">
        <form className="auth-panel glass-panel" onSubmit={finishPasswordReset}>
          <div className="landing-logo">
            <img src={appLogo} alt="Athlete Reload logo" />
            <span>Create new password</span>
          </div>
          <label className="select-field">
            New password
            <input
              autoComplete="new-password"
              minLength={10}
              onChange={(event) => setResetForm((current) => ({ ...current, password: event.target.value }))}
              required
              type="password"
              value={resetForm.password}
            />
          </label>
          <PasswordStrength strength={passwordStrength} />
          <label className="select-field">
            Confirm password
            <input
              autoComplete="new-password"
              minLength={10}
              onChange={(event) => setResetForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              required
              type="password"
              value={resetForm.confirmPassword}
            />
          </label>
          <label className="setting-toggle inline-toggle">
            <input
              checked={resetForm.signOutOtherSessions}
              onChange={(event) => setResetForm((current) => ({
                ...current,
                signOutOtherSessions: event.target.checked,
              }))}
              type="checkbox"
            />
            Sign out other sessions after changing password
          </label>
          {authMessage && <p className="auth-message">{authMessage}</p>}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="auth-content">
      <form className="auth-panel glass-panel" onSubmit={submitAuth}>
        <button
          className="ghost-close auth-back"
          onClick={() => setMode('landing')}
          type="button"
        >
          Back
        </button>
        <div className="landing-logo">
          <img src={appLogo} alt="Athlete Reload logo" />
          <span>{isSigningUp ? 'Create account' : 'Welcome back'}</span>
        </div>

        <label className="select-field">
          Email
          <input
            autoComplete="email"
            onChange={(event) => updateAuthField('email', event.target.value)}
            placeholder="you@example.com"
            required={hasSupabaseConfig}
            type="email"
            value={authForm.email}
          />
        </label>

        <label className="select-field">
          Password
          <input
            autoComplete={isSigningUp ? 'new-password' : 'current-password'}
            minLength={10}
            onChange={(event) => updateAuthField('password', event.target.value)}
            placeholder="password"
            required={hasSupabaseConfig}
            type="password"
            value={authForm.password}
          />
        </label>

        {isSigningUp && <PasswordStrength strength={passwordStrength} />}

        {authMessage && <p className="auth-message">{authMessage}</p>}

        {!hasSupabaseConfig && (
          <p className="auth-message">
            Supabase keys are not connected yet, so this opens a local demo
            session.
          </p>
        )}

        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Working...' : isSigningUp ? 'Create account' : 'Sign in'}
        </button>

        <div className="social-auth" aria-label="Social sign-in options">
          <span className="social-auth-divider">or continue with</span>
          <div className="social-auth-grid">
            {[
              ['google', 'Google', `${brandIconBase}google.svg`],
              ['discord', 'Discord', `${brandIconBase}discord.svg`],
              ['github', 'GitHub', `${brandIconBase}github.svg`],
            ].map(([provider, label, icon]) => (
              <button
                className="social-auth-button"
                disabled={isSubmitting}
                key={provider}
                onClick={() => signInWithProvider(provider)}
                type="button"
              >
                <img src={icon} alt="" aria-hidden="true" />
                {isSigningUp ? 'Sign up' : 'Sign in'} with {label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="auth-switch"
          onClick={() => setMode(isSigningUp ? 'signin' : 'signup')}
          type="button"
        >
          {isSigningUp ? 'Use an existing account' : 'Create a new account'}
        </button>

        {!isSigningUp && (
          <button className="auth-switch" onClick={startPasswordReset} type="button">
            Forgot password?
          </button>
        )}

        {canResendVerification && (
          <button className="auth-switch" onClick={resendVerification} type="button">
            Resend verification email
          </button>
        )}
      </form>
    </section>
  )
}

function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value.trim())
}

function PasswordStrength({ strength }) {
  return (
    <div className="password-strength">
      <span>
        <i style={{ width: `${strength.score * 25}%` }} />
      </span>
      <p>{strength.label}</p>
    </div>
  )
}

function getPasswordStrength(password) {
  let score = 0

  if (password.length >= 10) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  const label = [
    'Use at least 10 characters with a mix of letters, numbers, and symbols.',
    'Weak password',
    'Okay password',
    'Good password',
    'Strong password',
  ][score]

  return { label, score }
}

function isStrongEnough(password) {
  return getPasswordStrength(password).score >= 3
}
