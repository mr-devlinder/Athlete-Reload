import { useEffect, useRef, useState } from 'react'

const tourSteps = {
  schedule: {
    awaitingClick: true,
    body: 'Click Add event. The rest of the app stays locked until you create your first event.',
    eyebrow: 'Step 1 of 4',
    target: '[data-tour="add-event"]',
    title: 'Start with your schedule',
  },
  'schedule-review': {
    body: 'Your first event is on the calendar. When you are ready, move on to the Check-in walkthrough.',
    eyebrow: 'Step 1 of 4',
    target: '[data-tour="add-event"]',
    title: 'Your schedule is ready',
  },
  'checkin-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Next, click Check-in in the navigation bar.',
    eyebrow: 'Step 2 of 4',
    target: '[data-view="Check-in"]',
    title: 'Open Check-in',
  },
  checkin: {
    body: 'This page is where you record sleep, energy, fatigue, soreness, hydration, and pain before an event. When an event has started, this is also where you complete its checkout.',
    bubbleTarget: '[data-tour="check-in-intro"]',
    eyebrow: 'Step 2 of 4',
    readTarget: '[data-tour="check-in-page"]',
    requiresReadThrough: true,
    instantEntry: true,
    target: '[data-tour="check-in-page"]',
    title: 'Check in before training',
  },
  'home-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Now click Home in the navigation bar.',
    eyebrow: 'Step 3 of 4',
    target: '[data-view="Home"]',
    title: 'Open Home',
  },
  home: {
    body: 'Home brings your readiness, today’s events, workload, pain timeline, and patterns into one place.',
    bubbleTarget: '[data-tour="home-intro"]',
    eyebrow: 'Step 3 of 4',
    instantEntry: true,
    target: '[data-tour="home-page"]',
    title: 'Home is your overview',
  },
  'history-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Last, click History in the navigation bar.',
    eyebrow: 'Step 4 of 4',
    target: '[data-view="History"]',
    title: 'Open History',
  },
  history: {
    body: 'Review previous check-ins, checkouts, recommendations, pain reports, and weekly patterns here.',
    eyebrow: 'Step 4 of 4',
    instantEntry: true,
    target: '[data-tour="history-page"]',
    title: 'History shows the bigger picture',
  },
}

export function GuidedTour({ onBack, onFinish, onNext, phase }) {
  const step = tourSteps[phase]
  const [targetRect, setTargetRect] = useState(null)
  const [bubbleRect, setBubbleRect] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [hasReadThrough, setHasReadThrough] = useState(false)
  const [calloutHeight, setCalloutHeight] = useState(0)
  const hasAutoScrolled = useRef(false)
  const calloutRef = useRef(null)
  const wasFormOpen = useRef(false)

  useEffect(() => {
    let frameId = null
    let observer = null
    let mutationObserver = null
    hasAutoScrolled.current = false
    setHasReadThrough(!step?.requiresReadThrough)

    function updateRect() {
      const form = phase === 'schedule' ? document.querySelector('.event-modal') : null
      const target = form ?? document.querySelector(step?.target) ?? document.querySelector(step?.readTarget)
      const bubbleTarget = form ?? document.querySelector(step?.bubbleTarget) ?? target
      const readTarget = form ?? document.querySelector(step?.readTarget ?? step?.target)
      const nextIsFormOpen = Boolean(form)

      setIsFormOpen(nextIsFormOpen)

      if (nextIsFormOpen && !wasFormOpen.current) {
        hasAutoScrolled.current = false
        requestAnimationFrame(() => {
          form.scrollTo({ top: 0, behavior: 'auto' })
          form.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        })
      }
      wasFormOpen.current = nextIsFormOpen

      if (!target) {
        setTargetRect(null)
        setBubbleRect(null)
        return
      }

      const rect = target.getBoundingClientRect()
      const bubbleTargetRect = bubbleTarget?.getBoundingClientRect() ?? rect
      const readRect = readTarget?.getBoundingClientRect() ?? rect
      const nextRect = {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      }

      setTargetRect((current) => sameRect(current, nextRect) ? current : nextRect)
      const nextBubbleRect = {
        bottom: bubbleTargetRect.bottom,
        height: bubbleTargetRect.height,
        left: bubbleTargetRect.left,
        right: bubbleTargetRect.right,
        top: bubbleTargetRect.top,
        width: bubbleTargetRect.width,
      }
      setBubbleRect((current) => sameRect(current, nextBubbleRect) ? current : nextBubbleRect)
      setHasReadThrough((current) => {
        const nextValue = !step.requiresReadThrough || readRect.bottom <= window.innerHeight - 24
        return current === nextValue ? current : nextValue
      })

      if (!hasAutoScrolled.current) {
        hasAutoScrolled.current = true
        requestAnimationFrame(() => scrollTourTargetIntoView(target, Boolean(form), phase))
      }
    }

    function scheduleUpdate() {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(updateRect)
    }

    updateRect()
    observer = new ResizeObserver(scheduleUpdate)
    observer.observe(document.body)
    mutationObserver = new MutationObserver(scheduleUpdate)
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, true)

    return () => {
      cancelAnimationFrame(frameId)
      observer?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
    }
  }, [phase, step])

  useEffect(() => {
    const callout = calloutRef.current
    if (!callout) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setCalloutHeight((current) => Math.abs(current - entry.contentRect.height) < 1
        ? current
        : entry.contentRect.height)
    })

    observer.observe(callout)
    return () => observer.disconnect()
  }, [isFormOpen, phase, targetRect])

  if (!step || !targetRect) return null

  const locksTarget = !isFormOpen && !step.awaitingClick
  const canAdvance = !step.requiresReadThrough || hasReadThrough

  return (
    <>
      {!isFormOpen && !locksTarget && getBlockers(targetRect).map((style, index) => (
        <div className={`guided-tour-blocker${step.navigationStep ? ' guided-tour-navigation-blocker' : ''}`} key={index} style={style} />
      ))}
      {locksTarget && <div className="guided-tour-full-blocker" />}
      <div
        className="guided-tour-spotlight"
        style={{
          height: `${targetRect.height}px`,
          left: `${targetRect.left}px`,
          top: `${targetRect.top}px`,
          width: `${targetRect.width}px`,
        }}
      />
      <section className={`guided-tour ${isFormOpen ? 'guided-tour-form-callout' : ''}`} ref={calloutRef} role="dialog" aria-label="Athlete Reload guided walkthrough" style={getCalloutStyle(bubbleRect ?? targetRect, isFormOpen, calloutHeight)}>
        <span className="guided-tour-arrow" aria-hidden="true">{isFormOpen ? '↓' : '↑'}</span>
        <p className="eyebrow">{isFormOpen ? 'Create your first event' : step.eyebrow}</p>
        <h2>{isFormOpen ? 'Fill out the event form' : step.title}</h2>
        <p>{isFormOpen ? 'Choose the date, time, event type, association, and planned minutes. Intensity is set automatically. Press Create event when you are done.' : step.body}</p>
        {step.requiresReadThrough && !hasReadThrough && <p className="guided-tour-progress">Scroll through the Check-in page to continue.</p>}
        <div className="guided-tour-actions">
          {!isFormOpen && phase !== 'schedule' && <button className="auth-switch" onClick={onBack} type="button">Back</button>}
          <button className="ghost-close" onClick={onFinish} type="button">Skip tour</button>
          {!isFormOpen && !step.awaitingClick && <button className="primary-button compact-action" disabled={!canAdvance} onClick={onNext} type="button">{phase === 'history' ? 'Finish tour' : 'Next'}</button>}
        </div>
      </section>
    </>
  )
}

function scrollTourTargetIntoView(target, isFormOpen, phase) {
  if (isFormOpen) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    return
  }

  const navigationStep = tourSteps[phase]?.navigationStep
  const scrollTarget = navigationStep ? target.closest('.nav-tabs') ?? target : target
  const rect = scrollTarget.getBoundingClientRect()
  const behavior = tourSteps[phase]?.instantEntry ? 'auto' : 'smooth'
  const offset = phase === 'checkin' ? 18 : 72
  window.scrollTo({
    behavior,
    top: Math.max(0, window.scrollY + rect.top - offset),
  })
}

function getBlockers(rect) {
  const gap = 8
  const left = Math.max(0, rect.left - gap)
  const right = Math.min(window.innerWidth, rect.right + gap)
  const top = Math.max(0, rect.top - gap)
  const bottom = Math.min(window.innerHeight, rect.bottom + gap)

  return [
    { height: `${top}px`, left: '0', top: '0', width: '100%' },
    { bottom: '0', left: '0', top: `${bottom}px`, width: '100%' },
    { height: `${bottom - top}px`, left: '0', top: `${top}px`, width: `${left}px` },
    { height: `${bottom - top}px`, left: `${right}px`, top: `${top}px`, right: '0' },
  ]
}

function getCalloutStyle(rect, isFormOpen, calloutHeight) {
  const width = Math.min(360, window.innerWidth - 28)
  const maxLeft = Math.max(14, window.innerWidth - width - 14)
  const safeHeight = Math.min(calloutHeight || 260, window.innerHeight - 28)
  const clampTop = (top) => Math.min(
    Math.max(14, top),
    Math.max(14, window.innerHeight - safeHeight - 14),
  )

  if (isFormOpen) {
    const leftOfForm = rect.left - width - 24
    const rightOfForm = rect.right + 24
    const left = leftOfForm >= 14
      ? leftOfForm
      : rightOfForm <= maxLeft
        ? rightOfForm
        : 14
    const top = clampTop(rect.top + 22)

    return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
  }

  const left = Math.min(Math.max(14, rect.left), maxLeft)
  const top = clampTop(rect.bottom + 22)

  return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

function sameRect(first, second) {
  return first && ['top', 'left', 'width', 'height'].every((key) => Math.abs(first[key] - second[key]) < 1)
}
