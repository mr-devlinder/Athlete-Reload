import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'motion/react'
import appLogo from '../assets/athlete-reload-logo-transparent.png'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import { useModalAccessibility } from '../hooks/useModalAccessibility'
import { LandingPage } from './LandingPage'
import { AppIcon } from './AppIcon'
import '../styles/public-auth.css'

const authDefaults = {
  email: '',
  legalConsent: false,
  password: '',
}

const brandIconBase = `${import.meta.env.BASE_URL}brand-icons/`
const pendingLegalConsentKey = 'athlete-reload-pending-legal-consent'

export function AuthGate({
  initialMode = 'landing',
  onAuthenticated,
  onDemoSession,
  onOpenLegal,
  onUseRememberedSession,
  rememberedSession,
}) {
  const [mode, setMode] = useState(initialMode)
  const [authForm, setAuthForm] = useState(authDefaults)
  const [authMessage, setAuthMessage] = useState('')
  const [emailNotice, setEmailNotice] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [landingVisit, setLandingVisit] = useState(0)
  const [isLeavingLanding, setIsLeavingLanding] = useState(false)
  const [isReturningToLanding, setIsReturningToLanding] = useState(false)
  const authTransitionTimerRef = useRef(null)
  const returnTimerRef = useRef(null)
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

  useEffect(() => () => {
    window.clearTimeout(authTransitionTimerRef.current)
    window.clearTimeout(returnTimerRef.current)
  }, [])

  useEffect(() => {
    if (mode !== 'signin' && mode !== 'signup') return undefined
    const timer = window.setTimeout(() => {
      const heading = document.querySelector('.auth-panel-heading h2')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
    }, 520)
    return () => window.clearTimeout(timer)
  }, [mode])

  function openAuth(nextMode) {
    if (isLeavingLanding) return
    setIsLeavingLanding(true)
    window.clearTimeout(authTransitionTimerRef.current)
    authTransitionTimerRef.current = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
      setMode(nextMode)
      setIsLeavingLanding(false)
      authTransitionTimerRef.current = null
    }, 340)
  }

  function returnToLanding() {
    if (isReturningToLanding) return
    setIsReturningToLanding(true)
    window.clearTimeout(returnTimerRef.current)
    returnTimerRef.current = window.setTimeout(() => {
      window.scrollTo({ top: 0 })
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      setLandingVisit((current) => current + 1)
      setMode('landing')
      setIsReturningToLanding(false)
      returnTimerRef.current = null
    }, 280)
  }

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

  function showEmailNotice(title, message) {
    setAuthMessage('')
    setEmailNotice({
      email: authForm.email.trim(),
      message,
      title,
    })
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

    showEmailNotice(
      'Check your email',
      'If an account exists for this address, a secure password reset link is on the way.',
    )
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

    showEmailNotice(
      'Verification email sent',
      'If verification is available for this address, a new confirmation email is on the way.',
    )
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

    if (isSigningUp && !authForm.legalConsent) {
      setAuthMessage('Confirm that you are at least 16 and accept the legal terms before creating an account.')
      return
    }

    if (!hasSupabaseConfig) {
      setAuthMessage('Social sign-in is available after Supabase is connected.')
      return
    }

    setIsSubmitting(true)
    if (isSigningUp) sessionStorage.setItem(pendingLegalConsentKey, 'oauth_signup')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      sessionStorage.removeItem(pendingLegalConsentKey)
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

    if (isSigningUp && !authForm.legalConsent) {
      setAuthMessage('Confirm that you are at least 16 and accept the legal terms before creating an account.')
      return
    }

    setIsSubmitting(true)

    const authRequest = isSigningUp
      ? supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            data: {
              age_16_or_older_confirmed: true,
              legal_accepted_at: new Date().toISOString(),
              legal_version: '2026-08-04',
              sensitive_data_processing_consent: true,
            },
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
      showEmailNotice(
        'Confirm your email',
        'We sent a confirmation link to finish creating your Athlete Reload account.',
      )
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
      <AnimatePresence initial={false}>
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="public-route-transition"
          initial={landingVisit > 0 ? { opacity: 0, y: 16 } : false}
          key="landing-route"
          transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
        >
          <LandingPage
            playOpening={landingVisit === 0}
            returningFromAuth={landingVisit > 0}
            onCreateAccount={() => openAuth('signup')}
            onOpenLegal={onOpenLegal}
            onSignIn={() => {
              if (rememberedSession) {
                onUseRememberedSession()
                return
              }
              openAuth('signin')
            }}
          />
          <AnimatePresence>
            {isLeavingLanding && <m.div animate={{ opacity: 1, scaleY: 1 }} className="public-auth-route-curtain" exit={{ opacity: 0 }} initial={{ opacity: 0.2, scaleY: 0 }} key="auth-route-curtain" transition={{ duration: 0.34, ease: [0.65, 0, 0.35, 1] }} />}
          </AnimatePresence>
        </m.div>
      </AnimatePresence>
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
    <m.section
      animate={isReturningToLanding ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
      className={`auth-experience${isReturningToLanding ? ' is-returning' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <m.a animate={{ opacity: 1, y: 0 }} className="auth-experience-brand" href="#" initial={{ opacity: 0, y: -12 }} onClick={(event) => { event.preventDefault(); returnToLanding() }} transition={{ delay: 0.08, duration: 0.42 }}>
        <img src={appLogo} alt="" />
        <span>Athlete Reload</span>
      </m.a>
      <aside className="auth-experience-copy">
        <AnimatePresence mode="wait">
          <m.div animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} initial={{ opacity: 0, x: 16 }} key={isSigningUp ? 'signup-copy' : 'signin-copy'} transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
            <p className="eyebrow">{isSigningUp ? 'Build your performance context' : 'Return to your workspace'}</p>
            <h1>{isSigningUp ? 'Start each session with a clearer plan.' : 'Pick up where your training left off.'}</h1>
            <p>{isSigningUp ? 'Bring readiness, schedule, nutrition, workload, and recovery into one private athlete workspace.' : 'Your schedule, check-ins, recovery routines, and history are ready when you are.'}</p>
            <div className="auth-context-list">
              <span><AppIcon name="shield" size={20} /> Athlete-owned records</span>
              <span><AppIcon name="spark" size={20} /> Context-aware guidance</span>
              <span><AppIcon name="trend" size={20} /> A continuous training history</span>
            </div>
          </m.div>
        </AnimatePresence>
      </aside>
      <m.form animate={{ opacity: 1, y: 0 }} className="auth-panel glass-panel" initial={{ opacity: 0, y: 18 }} layout onSubmit={submitAuth} transition={{ opacity: { delay: 0.08, duration: 0.34 }, y: { delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }, layout: { type: 'spring', stiffness: 360, damping: 34 } }}>
        <button
          className="ghost-close auth-back"
          onClick={returnToLanding}
          type="button"
        >
          Back
        </button>
        <div className="landing-logo">
          <img src={appLogo} alt="Athlete Reload logo" />
          <span>{isSigningUp ? 'Create your account' : 'Welcome back'}</span>
        </div>
        <div className="auth-panel-heading">
          <h2>{isSigningUp ? 'Create account' : 'Sign in'}</h2>
          <p>{isSigningUp ? 'Free to use. For athletes age 16 and older.' : 'Use your email or a connected provider.'}</p>
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

        <AnimatePresence initial={false}>
          {isSigningUp && <m.div animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} key="password-strength"><PasswordStrength strength={passwordStrength} /></m.div>}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isSigningUp && (
          <m.label animate={{ height: 'auto', opacity: 1 }} className="settings-toggle" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} key="legal-consent">
            <input checked={authForm.legalConsent} onChange={(event) => updateAuthField('legalConsent', event.target.checked)} required type="checkbox" />
            <span>I am at least 16 and agree to the <button className="auth-legal-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenLegal('privacy') }} type="button">Privacy Policy</button>, <button className="auth-legal-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenLegal('terms') }} type="button">Terms of Service</button>, <button className="auth-legal-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenLegal('medical') }} type="button">Medical Disclaimer</button>, and processing of the health and wellness information I choose to enter.</span>
          </m.label>
          )}
        </AnimatePresence>

        {authMessage && <p className="auth-message" role="alert">{authMessage}</p>}

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
      </m.form>
      {emailNotice && createPortal(
        <EmailSentDialog notice={emailNotice} onClose={() => setEmailNotice(null)} />,
        document.body,
      )}
    </m.section>
  )
}

function EmailSentDialog({ notice, onClose }) {
  const dialogRef = useModalAccessibility(true, onClose)

  return (
    <div className="auth-email-backdrop" onMouseDown={onClose}>
      <section
        aria-describedby="auth-email-description"
        aria-labelledby="auth-email-title"
        aria-modal="true"
        className="auth-email-dialog glass-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button aria-label="Close email confirmation" className="ghost-close auth-email-close" onClick={onClose} type="button">
          Close
        </button>
        <div className="auth-email-icon" aria-hidden="true">
          <span>&#10003;</span>
        </div>
        <p className="eyebrow">Email sent</p>
        <h2 id="auth-email-title">{notice.title}</h2>
        <p id="auth-email-description">{notice.message}</p>
        <strong className="auth-email-address">{notice.email}</strong>
        <div className="auth-email-help">
          Open the email and follow the secure link. If it does not arrive shortly, check your spam or junk folder.
        </div>
        <button autoFocus className="primary-button" onClick={onClose} type="button">
          Got it
        </button>
      </section>
    </div>
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
