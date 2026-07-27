import { useEffect, useMemo, useRef, useState } from 'react'
import { LensGlass, SVGFilters } from 'react-glassy'
import 'react-glassy/styles.css'
import { CheckInView } from './components/CheckInView'
import { HistoryView } from './components/HistoryView'
import { Metric } from './components/Metric'
import { ScheduleView } from './components/ScheduleView'
import {
  checkInDefaults,
  recentCheckIns,
  schedule as initialSchedule,
  todayLabel,
} from './data/appData'
import appLogo from './assets/athlete-reload-logo-transparent.png'
import trainingHero from './assets/training-hero.png'
import { getRecommendation, getTrendInsights } from './utils/readiness'
import { clearSavedState, loadSavedState, saveState } from './utils/storage'
import './App.css'

const views = [
  {
    icon: 'pulse',
    label: 'Check-in',
  },
  {
    icon: 'calendar',
    label: 'Schedule',
  },
  {
    icon: 'trend',
    label: 'History',
  },
]

function normalizeScheduleItem(item, index) {
  const fallbackDate = `2026-07-${String(27 + index).padStart(2, '0')}`

  return {
    id: item.id ?? `event-${Date.now()}-${index}`,
    date: item.date?.startsWith?.('2026-') ? item.date : fallbackDate,
    load: item.load ?? 'Medium',
    note: item.note ?? '',
    time: item.time ?? '',
    title: item.title ?? item.type ?? 'Training',
    type: item.type ?? 'Team practice',
  }
}

function App() {
  const savedState = useMemo(() => loadSavedState(), [])
  const [activeView, setActiveView] = useState('Check-in')
  const [navLens, setNavLens] = useState(null)
  const lensFrameRef = useRef(null)
  const lensNodeRef = useRef(null)
  const lensTargetRef = useRef(null)
  const navRef = useRef(null)
  const [checkIn, setCheckIn] = useState(savedState?.checkIn ?? checkInDefaults)
  const [history, setHistory] = useState(savedState?.history ?? recentCheckIns)
  const [schedule, setSchedule] = useState(
    (savedState?.schedule ?? initialSchedule).map(normalizeScheduleItem),
  )
  const visualActiveView = navLens?.activeLabel ?? activeView

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
  const isHomeView = activeView === 'Check-in'

  useEffect(() => {
    saveState({
      checkIn,
      history,
      schedule,
    })
  }, [checkIn, history, schedule])

  useEffect(() => {
    return () => {
      if (lensFrameRef.current) {
        cancelAnimationFrame(lensFrameRef.current)
      }
    }
  }, [])

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

  function updateScheduleItem(id, updates) {
    setSchedule((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    )
  }

  function addScheduleItem(event) {
    setSchedule((current) => [...current, event])
  }

  function removeScheduleItem(id) {
    setSchedule((current) => current.filter((item) => item.id !== id))
  }

  function clearHistory() {
    setHistory([])
  }

  function resetAppData() {
    clearSavedState()
    setCheckIn(checkInDefaults)
    setHistory([])
    setSchedule(initialSchedule)
    setActiveView('Check-in')
  }

  function getNearestTab(pointerX) {
    const nav = navRef.current

    if (!nav) {
      return activeView
    }

    const tabs = [...nav.querySelectorAll('button[data-view]')]
    const nearestTab = tabs.reduce((nearest, tab) => {
      const rect = tab.getBoundingClientRect()
      const tabCenter = rect.left + rect.width / 2
      const distance = Math.abs(pointerX - tabCenter)

      if (!nearest || distance < nearest.distance) {
        return {
          distance,
          height: rect.height,
          label: tab.dataset.view,
          width: rect.width,
        }
      }

      return nearest
    }, null)

    return nearestTab ?? { height: 72, label: activeView, width: 106 }
  }

  function getLensState(event) {
    const nav = navRef.current

    if (!nav) {
      return null
    }

    const navRect = nav.getBoundingClientRect()
    const nearestTab = getNearestTab(event.clientX)
    const lensWidth = nearestTab.width
    const lensHeight = nearestTab.height
    const horizontalPadding = lensWidth / 2
    const left = Math.max(
      horizontalPadding,
      Math.min(event.clientX - navRect.left, navRect.width - horizontalPadding),
    )

    return {
      activeLabel: nearestTab.label,
      height: lensHeight,
      left,
      top: navRect.height / 2,
      width: lensWidth,
      navWidth: navRect.width,
    }
  }

  function applyLensPosition(state) {
    const node = lensNodeRef.current

    if (!node) {
      return
    }

    node.style.setProperty('--lens-left', `${state.left}px`)
    node.style.setProperty('--lens-top', `${state.top}px`)
    node.style.setProperty('--lens-height', `${state.height}px`)
    node.style.setProperty('--lens-width', `${state.width}px`)
    node.style.setProperty('--nav-width', `${state.navWidth}px`)
  }

  function animateLens() {
    const target = lensTargetRef.current

    if (target) {
      applyLensPosition(target)
      lensFrameRef.current = requestAnimationFrame(animateLens)
    }
  }

  function startLensAnimation() {
    if (!lensFrameRef.current) {
      lensFrameRef.current = requestAnimationFrame(animateLens)
    }
  }

  function stopLensAnimation() {
    if (lensFrameRef.current) {
      cancelAnimationFrame(lensFrameRef.current)
      lensFrameRef.current = null
    }
  }

  function moveNavLens(event) {
    if (!navLens) {
      return
    }

    const lensState = getLensState(event)

    if (!lensState) {
      return
    }

    lensTargetRef.current = lensState

    if (lensState.activeLabel !== navLens.activeLabel) {
      setNavLens((current) =>
        current
          ? {
              ...current,
              activeLabel: lensState.activeLabel,
              height: lensState.height,
              width: lensState.width,
            }
          : current,
      )
    }
  }

  function showNavLens(event) {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Touch fallback events do not have capturable pointer ids.
    }

    const lensState = getLensState(event)

    if (!lensState) {
      return
    }

    lensTargetRef.current = lensState
    setNavLens(lensState)
    requestAnimationFrame(() => applyLensPosition(lensState))
    startLensAnimation()
  }

  function hideNavLens() {
    if (navLens?.activeLabel) {
      setActiveView(navLens.activeLabel)
    }

    stopLensAnimation()
    lensTargetRef.current = null
    setNavLens(null)
  }

  function getTouchEvent(touchEvent) {
    const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0]

    if (!touch) {
      return null
    }

    return {
      clientX: touch.clientX,
    }
  }

  function showTouchLens(event) {
    event.preventDefault()
    const touchEvent = getTouchEvent(event)

    if (touchEvent) {
      showNavLens({
        ...touchEvent,
        currentTarget: event.currentTarget,
        pointerId: event.changedTouches[0]?.identifier ?? 1,
      })
    }
  }

  function moveTouchLens(event) {
    event.preventDefault()
    const touchEvent = getTouchEvent(event)

    if (touchEvent) {
      moveNavLens(touchEvent)
    }
  }

  return (
    <main className="app-shell">
      <img className="hero-photo" src={trainingHero} alt="" />
      <div className="hero-overlay" />
      <SVGFilters>
        <SVGFilters.DefaultFilters />
      </SVGFilters>

      <nav className="top-bar glass-panel">
        <div className="brand-lockup">
          <img src={appLogo} alt="Athlete Reload logo" />
          <div>
            <p className="eyebrow">Athlete Reload</p>
            <strong>Readiness Planner</strong>
          </div>
        </div>
      </nav>

      <div
        className="nav-tabs"
        aria-label="Primary views"
        onPointerCancel={hideNavLens}
        onPointerDown={showNavLens}
        onPointerMove={moveNavLens}
        onPointerUp={hideNavLens}
        onTouchEnd={hideNavLens}
        onTouchMove={moveTouchLens}
        onTouchStart={showTouchLens}
        ref={navRef}
      >
        {navLens && (
          <div
            className="liquid-lens-shell"
            ref={lensNodeRef}
            style={{
              '--lens-left': `${navLens.left}px`,
              '--lens-top': `${navLens.top}px`,
              '--lens-height': `${navLens.height}px`,
              '--lens-width': `${navLens.width}px`,
              '--nav-width': `${navLens.navWidth}px`,
            }}
          >
            <LensGlass
              blur={3}
              brightness={1.08}
              chromaticAberration={2.4}
              className="liquid-lens"
              depth={16}
              height={navLens.height}
              radius={999}
              saturate={1.65}
              strength={126}
              width={navLens.width}
            >
              <div className="lens-refract" aria-hidden="true">
                {views.map((view) => (
                  <span
                    className={visualActiveView === view.label ? 'active' : ''}
                    key={view.label}
                  >
                    <NavIcon type={view.icon} />
                    <em>{view.label}</em>
                  </span>
                ))}
              </div>
            </LensGlass>
          </div>
        )}
        {views.map((view) => (
          <button
            className={visualActiveView === view.label ? 'active' : ''}
            data-view={view.label}
            key={view.label}
            onClick={() => setActiveView(view.label)}
            type="button"
          >
            <NavIcon type={view.icon} />
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      <section className={isHomeView ? 'hero-content home-view' : 'page-content'}>
        {isHomeView ? (
          <>
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
              <CheckInView
                checkIn={checkIn}
                recommendation={recommendation}
                onSave={saveCheckIn}
                onUpdate={updateField}
              />
            </section>
          </>
        ) : (
          <section className="workspace page-workspace glass-panel">
            {activeView === 'Schedule' && (
              <ScheduleView
                onAdd={addScheduleItem}
                onRemove={removeScheduleItem}
                onUpdate={updateScheduleItem}
                schedule={schedule}
              />
            )}

            {activeView === 'History' && (
              <HistoryView
                history={displayedHistory}
                insights={trendInsights}
                onClear={clearHistory}
                onReset={resetAppData}
              />
            )}
          </section>
        )}
      </section>
    </main>
  )
}

function NavIcon({ type }) {
  if (type === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4.5 9.2h15M6.5 5.2h11A2.5 2.5 0 0 1 20 7.7v10.1a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.8V7.7a2.5 2.5 0 0 1 2.5-2.5Z" />
      </svg>
    )
  }

  if (type === 'trend') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17.5h16M6 15l4-4 3 3 5-7M18 7h-4M18 7v4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h4.2l2-5.8 5.2 12.6 2.4-6.8H21" />
    </svg>
  )
}

export default App
