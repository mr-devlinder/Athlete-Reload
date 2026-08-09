import { Component } from 'react'
import { recordOperationalEvent } from '../lib/operationalEvents'

export class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch() {
    void recordOperationalEvent(this.props.feature ?? 'app', 'RENDER_FAILURE')
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="app-error-state" role="alert">
        <span className="app-error-state__mark" aria-hidden="true">AR</span>
        <p className="eyebrow">Athlete Reload</p>
        <h1>This view needs a fresh start.</h1>
        <p>Your information is safe. Reload the view to continue.</p>
        <button className="primary-button" onClick={() => window.location.reload()} type="button">Reload Athlete Reload</button>
      </section>
    )
  }
}
