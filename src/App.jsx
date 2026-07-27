import { useMemo, useState } from 'react'
import { CheckInView } from './components/CheckInView'
import { HistoryView } from './components/HistoryView'
import { Metric } from './components/Metric'
import { ScheduleView } from './components/ScheduleView'
import {
  checkInDefaults,
  recentCheckIns,
  schedule,
  todayLabel,
} from './data/appData'
import trainingHero from './assets/training-hero.png'
import { getRecommendation, getTrendInsights } from './utils/readiness'
import './App.css'

const views = ['Check-in', 'Schedule', 'History']

function App() {
  const [activeView, setActiveView] = useState('Check-in')
  const [checkIn, setCheckIn] = useState(checkInDefaults)
  const [history, setHistory] = useState(recentCheckIns)

  const recommendation = useMemo(
    () => getRecommendation(checkIn),
    [checkIn],
  )

  const currentEntry = useMemo(
    () => ({
      day: 'Today',
      score: recommendation.score,
      location: checkIn.location,
      fatigue: checkIn.fatigue,
      note: checkIn.notes,
    }),
    [
      checkIn.fatigue,
      checkIn.location,
      checkIn.notes,
      recommendation.score,
    ],
  )

  const displayedHistory = useMemo(
    () => [currentEntry, ...history],
    [currentEntry, history],
  )
  const trendInsights = useMemo(
    () => getTrendInsights(displayedHistory),
    [displayedHistory],
  )

  function updateField(field, value) {
    setCheckIn((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function saveCheckIn() {
    setHistory((current) => [currentEntry, ...current.slice(0, 5)])
    setActiveView('History')
  }

  return (
    <main className="app-shell">
      <img className="hero-photo" src={trainingHero} alt="" />
      <div className="hero-overlay" />

      <nav className="top-bar glass-panel">
        <div>
          <p className="eyebrow">Athlete Reload</p>
          <strong>Readiness Planner</strong>
        </div>
        <div className="nav-tabs" aria-label="Primary views">
          {views.map((view) => (
            <button
              className={activeView === view ? 'active' : ''}
              key={view}
              onClick={() => setActiveView(view)}
              type="button"
            >
              {view}
            </button>
          ))}
        </div>
      </nav>

      <section className="hero-content">
        <div className="intro-copy">
          <p className="eyebrow">{todayLabel}</p>
          <h1>Adjust training without guessing.</h1>
          <p>
            Daily readiness, injury context, and team training rules in one
            calm dashboard.
          </p>

          <div className="quick-stats">
            <Metric label="Readiness" value={recommendation.score} />
            <Metric label="Plan" value={recommendation.label} />
            <Metric label="Load" value={recommendation.intensity} />
          </div>
        </div>

        <section className="workspace glass-panel">
          {activeView === 'Check-in' && (
            <CheckInView
              checkIn={checkIn}
              recommendation={recommendation}
              onSave={saveCheckIn}
              onUpdate={updateField}
            />
          )}

          {activeView === 'Schedule' && (
            <ScheduleView
              checkIn={checkIn}
              recommendation={recommendation}
              schedule={schedule}
            />
          )}

          {activeView === 'History' && (
            <HistoryView history={displayedHistory} insights={trendInsights} />
          )}
        </section>
      </section>
    </main>
  )
}

export default App
