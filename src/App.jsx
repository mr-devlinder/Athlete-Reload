import { useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { LensGlass, SVGFilters } from 'react-glassy'
import 'react-glassy/styles.css'
import { AuthGate } from './components/AuthGate'
import { CheckInView } from './components/CheckInView'
import { HistoryView } from './components/HistoryView'
import { ScheduleView } from './components/ScheduleView'
import {
  checkInDefaults,
  schedule as initialSchedule,
  todayLabel,
} from './data/appData'
import appLogo from './assets/athlete-reload-logo-transparent.png'
import trainingHero from './assets/training-hero.png'
import {
  clearCheckIns,
  createCheckIn,
  createScheduleEvent,
  deleteScheduleEvent,
  deleteCheckInsForDate,
  loadAthleteData,
  updateScheduleEvent,
} from './lib/athleteData'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'
import { getRecommendation, getTrendInsights } from './utils/readiness'
import { loadSavedState, saveState } from './utils/storage'
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
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + index)
  const fallbackDate = [
    fallback.getFullYear(),
    String(fallback.getMonth() + 1).padStart(2, '0'),
    String(fallback.getDate()).padStart(2, '0'),
  ].join('-')

  return {
    id: item.id ?? `event-${Date.now()}-${index}`,
    date: /^\d{4}-\d{2}-\d{2}$/.test(item.date ?? '') ? item.date : fallbackDate,
    load: item.load ?? 'Medium',
    note: item.note ?? '',
    time: item.time ?? '',
    title: item.title ?? item.type ?? 'Training',
    type: item.type ?? 'Team practice',
  }
}

function getTodayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

function getSessionFromSchedule(events) {
  const eventType = events[0]?.type

  if (!eventType) return 'Rest day'
  if (eventType === 'Game') return 'Game day'
  if (eventType === 'Recovery') return 'Recovery day'

  return eventType
}

function getYesterdayLoadFromSchedule(schedule) {
  const yesterdayIso = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const yesterdayEvents = schedule.filter((event) => event.date === yesterdayIso)

  if (yesterdayEvents.some((event) => event.load === 'High')) return 'Hard'
  if (yesterdayEvents.some((event) => event.load === 'Medium')) return 'Moderate'
  if (yesterdayEvents.some((event) => event.load === 'Low')) return 'Light'

  return 'Rest'
}

function sortScheduleEvents(events) {
  return [...events].sort((first, second) => {
    const firstValue = `${first.date} ${first.time ?? ''}`
    const secondValue = `${second.date} ${second.time ?? ''}`

    return firstValue.localeCompare(secondValue)
  })
}

function App() {
  const savedState = useMemo(() => loadSavedState(), [])
  const [session, setSession] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(!hasSupabaseConfig)
  const [dataStatus, setDataStatus] = useState('ready')
  const [isEditingToday, setIsEditingToday] = useState(false)
  const [activeView, setActiveView] = useState('Check-in')
  const [navLens, setNavLens] = useState(null)
  const lensFrameRef = useRef(null)
  const lensNodeRef = useRef(null)
  const lensTargetRef = useRef(null)
  const navRef = useRef(null)
  const [checkIn, setCheckIn] = useState(savedState?.checkIn ?? checkInDefaults)
  const [history, setHistory] = useState(savedState?.history ?? [])
  const [schedule, setSchedule] = useState(
    (savedState?.schedule ?? initialSchedule).map(normalizeScheduleItem),
  )
  const visualActiveView = navLens?.activeLabel ?? activeView
  const isSupabaseSession = Boolean(supabase && session?.user?.id)
  const todayIso = getTodayIso()
  const todayEvents = useMemo(
    () => sortScheduleEvents(schedule.filter((event) => event.date === todayIso)),
    [schedule, todayIso],
  )
  const nextEvent = useMemo(
    () => sortScheduleEvents(schedule.filter((event) => event.date > todayIso))[0],
    [schedule, todayIso],
  )
  const scheduleDrivenCheckIn = useMemo(
    () => ({
      ...checkIn,
      session: getSessionFromSchedule(todayEvents),
      yesterdayLoad: getYesterdayLoadFromSchedule(schedule),
    }),
    [checkIn, schedule, todayEvents],
  )

  const recommendation = useMemo(
    () => getRecommendation(scheduleDrivenCheckIn),
    [scheduleDrivenCheckIn],
  )

  const currentEntry = useMemo(
    () => ({
      date: todayIso,
      day: 'Today',
      energy: checkIn.energy,
      score: recommendation.score,
      soreness: checkIn.soreness,
      pain: checkIn.pain,
      location: checkIn.location,
      fatigue: checkIn.fatigue,
      sleep: checkIn.sleep,
      stress: checkIn.stress,
      yesterdayLoad: scheduleDrivenCheckIn.yesterdayLoad,
      hydration: checkIn.hydration,
      injuryType: checkIn.injuryType,
      painType: checkIn.painType,
      hurtsWhen: checkIn.hurtsWhen,
      session: scheduleDrivenCheckIn.session,
      note: checkIn.notes,
    }),
    [
      checkIn.energy,
      checkIn.fatigue,
      checkIn.hurtsWhen,
      checkIn.hydration,
      checkIn.injuryType,
      checkIn.location,
      checkIn.notes,
      checkIn.pain,
      checkIn.painType,
      checkIn.sleep,
      checkIn.soreness,
      checkIn.stress,
      recommendation.score,
      scheduleDrivenCheckIn.session,
      scheduleDrivenCheckIn.yesterdayLoad,
      todayIso,
    ],
  )
  const isCheckInSavedToday = useMemo(
    () => !isEditingToday && history.some((entry) => entry.date === todayIso),
    [history, isEditingToday, todayIso],
  )

  const trendInsights = useMemo(
    () => getTrendInsights(history),
    [history],
  )

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session)
        setIsAuthReady(true)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsAuthReady(true)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isSupabaseSession) {
      return
    }

    saveState({
      checkIn,
      history,
      schedule,
    })
  }, [checkIn, history, isSupabaseSession, schedule])

  useEffect(() => {
    if (!isSupabaseSession) {
      return
    }

    let isMounted = true
    setDataStatus('loading')

    loadAthleteData()
      .then((data) => {
        if (!isMounted) return

        setSchedule(data.schedule)
        setHistory(data.history)
        setDataStatus('ready')
      })
      .catch((error) => {
        console.error(error)
        if (isMounted) {
          setDataStatus('error')
        }
      })

    return () => {
      isMounted = false
    }
  }, [isSupabaseSession])

  useEffect(() => {
    return () => {
      if (lensFrameRef.current) {
        cancelAnimationFrame(lensFrameRef.current)
      }
    }
  }, [])

  function updateField(field, value) {
    if (field === 'pain' && value === 0) {
      setCheckIn((current) => ({
        ...current,
        pain: 0,
        injuryType: 'Unknown',
        painType: 'No pain',
        hurtsWhen: 'At rest',
      }))
      return
    }

    if (field === 'pain' && value > 0 && checkIn.pain === 0) {
      setCheckIn((current) => ({
        ...current,
        pain: value,
        painType: 'Tight / pulling',
      }))
      return
    }

    setCheckIn((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveCheckIn() {
    if (isSupabaseSession) {
      try {
        if (isEditingToday) {
          await deleteCheckInsForDate(todayIso)
          setHistory((current) => current.filter((entry) => entry.date !== todayIso))
        }

        const savedEntry = await createCheckIn(scheduleDrivenCheckIn, recommendation)
        setHistory((current) => [savedEntry, ...current.slice(0, 19)])
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return
      }
    } else {
      setHistory((current) => [
        currentEntry,
        ...current.filter((entry) => entry.date !== todayIso).slice(0, 5),
      ])
    }

    setActiveView('History')
    setIsEditingToday(false)
  }

  async function updateScheduleItem(id, updates) {
    setSchedule((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    )

    if (!isSupabaseSession) {
      return
    }

    try {
      await updateScheduleEvent(id, updates)
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function addScheduleItem(event) {
    if (isSupabaseSession) {
      try {
        const savedEvent = await createScheduleEvent(event)
        setSchedule((current) => [...current, savedEvent])
      } catch (error) {
        console.error(error)
        setDataStatus('error')
      }
      return
    }

    setSchedule((current) => [...current, event])
  }

  async function removeScheduleItem(id) {
    setSchedule((current) => current.filter((item) => item.id !== id))

    if (!isSupabaseSession) {
      return
    }

    try {
      await deleteScheduleEvent(id)
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function clearHistory() {
    if (isSupabaseSession) {
      try {
        await clearCheckIns()
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return
      }
    }

    setHistory([])
  }

  function startDemoSession(email) {
    setSession({
      user: {
        email,
      },
    })
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut()
    }

    setSession(null)
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

      {!isAuthReady && <div className="auth-loading glass-panel">Loading</div>}

      {isAuthReady && !session && <AuthGate onDemoSession={startDemoSession} />}

      {isAuthReady && session && (
        <>
          <nav className="top-bar glass-panel">
        <div className="brand-lockup">
          <img src={appLogo} alt="Athlete Reload logo" />
          <div>
            <p className="eyebrow">Athlete Reload</p>
            <strong>Readiness Planner</strong>
          </div>
        </div>
        <div className="account-actions">
          <span>{session.user?.email ?? 'Athlete'}</span>
          <button className="ghost-close" onClick={signOut} type="button">
            Sign out
          </button>
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

      <section className="page-content">
        <section className="workspace page-workspace glass-panel">
            {dataStatus === 'loading' && (
              <div className="data-status">Loading your Athlete Reload data...</div>
            )}

            {dataStatus === 'error' && (
              <div className="data-status error">
                Supabase data sync needs attention. Your screen may be showing the
                last loaded state.
              </div>
            )}

            {activeView === 'Check-in' && (
              <CheckInView
                checkIn={scheduleDrivenCheckIn}
                isSavedToday={isCheckInSavedToday}
                recommendation={recommendation}
                nextEvent={nextEvent}
                todayEvents={todayEvents}
                todayLabel={todayLabel}
                onSave={saveCheckIn}
                onEditToday={() => setIsEditingToday(true)}
                onUpdate={updateField}
              />
            )}

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
                history={history}
                insights={trendInsights}
                onClear={clearHistory}
              />
            )}
          </section>
      </section>
        </>
      )}
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
