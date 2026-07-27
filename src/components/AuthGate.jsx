import { useState } from 'react'
import appLogo from '../assets/athlete-reload-logo-transparent.png'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

const authDefaults = {
  email: '',
  password: '',
}

export function AuthGate({ onDemoSession }) {
  const [mode, setMode] = useState('landing')
  const [authForm, setAuthForm] = useState(authDefaults)
  const [authMessage, setAuthMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSigningUp = mode === 'signup'

  function updateAuthField(field, value) {
    setAuthForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!hasSupabaseConfig) {
      onDemoSession(authForm.email || 'demo@athletereload.local')
      return
    }

    setIsSubmitting(true)

    const authRequest = isSigningUp
      ? supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })
      : supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        })

    const { error } = await authRequest
    setIsSubmitting(false)

    if (error) {
      setAuthMessage(error.message)
      return
    }

    if (isSigningUp) {
      setAuthMessage('Check your email to finish creating your account.')
    }
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
          <h1>Train smart when your body is sending signals.</h1>
          <p>
            A clean daily check-in for soreness, pain, fatigue, sleep, and team
            sessions before you choose the next training move.
          </p>
          <div className="landing-actions">
            <button
              className="primary-button compact-action"
              onClick={() => setMode('signin')}
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
            minLength={6}
            onChange={(event) => updateAuthField('password', event.target.value)}
            placeholder="password"
            required={hasSupabaseConfig}
            type="password"
            value={authForm.password}
          />
        </label>

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

        <button
          className="auth-switch"
          onClick={() => setMode(isSigningUp ? 'signin' : 'signup')}
          type="button"
        >
          {isSigningUp ? 'Use an existing account' : 'Create a new account'}
        </button>
      </form>
    </section>
  )
}
