import { useEffect, useRef, useState } from 'react'

const tourSteps = {
  schedule: {
    awaitingClick: true,
    body: 'Click Add event. The rest of the app stays locked until you create your first event.',
    eyebrow: 'Step 1 of 6',
    target: '[data-tour="add-event"]',
    title: 'Start with your schedule',
  },
  'schedule-review': {
    body: 'Your first event is on the calendar. When you are ready, move on to the Check-in walkthrough.',
    eyebrow: 'Step 1 of 6',
    target: '[data-tour="add-event"]',
    title: 'Your schedule is ready',
  },
  checkin: {
    body: 'This page is where you record sleep, energy, fatigue, soreness, hydration, and pain before an event. When an event has started, this is also where you complete its checkout.',
    bubbleTarget: '[data-tour="check-in-intro"]',
    eyebrow: 'Step 2 of 6',
    readTarget: '[data-tour="check-in-page"]',
    requiresReadThrough: true,
    instantEntry: true,
    pageWalkthrough: true,
    target: '[data-tour="check-in-page"]',
    title: 'Check in before training',
  },
  'nutrition-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Now click Nutrition in the navigation bar.',
    eyebrow: 'Step 3 of 6',
    target: '[data-view="Nutrition"]',
    title: 'Open Nutrition',
  },
  nutrition: {
    body: 'Log meals, serving sizes, calories, macros, and water here. Check-in and recovery recommendations use what you have logged for that day.',
    eyebrow: 'Step 3 of 6',
    instantEntry: true,
    pageWalkthrough: true,
    target: '[data-tour="nutrition-page"]',
    title: 'Fueling lives in one place',
  },
  'recovery-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Next, click Recovery in the navigation bar.',
    eyebrow: 'Step 4 of 6',
    target: '[data-view="Recovery"]',
    title: 'Open Recovery',
  },
  recovery: {
    body: 'After a checkout, generate a time-based mobility and stretching plan, complete the guided routine, and save feedback to history.',
    eyebrow: 'Step 4 of 6',
    instantEntry: true,
    pageWalkthrough: true,
    target: '[data-tour="recovery-page"]',
    title: 'Turn checkout data into recovery',
  },
  'home-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Now click Home in the navigation bar.',
    eyebrow: 'Step 5 of 6',
    target: '[data-view="Home"]',
    title: 'Open Home',
  },
  home: {
    body: 'Home brings your readiness, today’s events, workload, pain timeline, and patterns into one place.',
    bubbleTarget: '[data-tour="home-intro"]',
    eyebrow: 'Step 5 of 6',
    instantEntry: true,
    pageWalkthrough: true,
    target: '[data-tour="home-page"]',
    title: 'Home is your overview',
  },
  'history-nav': {
    awaitingClick: true,
    navigationStep: true,
    body: 'Last, click History in the navigation bar.',
    eyebrow: 'Step 6 of 6',
    target: '[data-view="History"]',
    title: 'Open History',
  },
  history: {
    body: 'Review previous check-ins, checkouts, recommendations, pain reports, and weekly patterns here.',
    eyebrow: 'Step 6 of 6',
    instantEntry: true,
    pageWalkthrough: true,
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
  const calloutRef = useRef(null)

  useEffect(() => {
    document.body.classList.add('guided-tour-active')

    return () => {
      document.body.classList.remove('guided-tour-active', 'guided-tour-event-form')
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('guided-tour-event-form', isFormOpen)

    return () => document.body.classList.remove('guided-tour-event-form')
  }, [isFormOpen])

  useEffect(() => {
    if (!isFormOpen) return undefined

    const topOffset = Math.ceil(calloutHeight || 140) + 28
    document.body.style.setProperty('--guided-tour-form-top', `${topOffset}px`)

    return () => document.body.style.removeProperty('--guided-tour-form-top')
  }, [calloutHeight, isFormOpen])

  useEffect(() => {
    let frameId = null
    let targetObserver = null
    let mutationObserver = null
    let stopped = false
    let activeTarget = null
    let isPreparingTarget = false
    let unlockScroll = () => {}
    setHasReadThrough(!step?.requiresReadThrough)

    function measure() {
      if (stopped || !activeTarget || !isVisible(activeTarget)) return
      const form = phase === 'schedule' ? document.querySelector('.event-modal') : null
      const target = form ?? activeTarget
      const bubbleTarget = form ?? document.querySelector(step?.bubbleTarget) ?? target
      const readTarget = form ?? document.querySelector(step?.readTarget ?? step?.target) ?? target
      const nextIsFormOpen = Boolean(form)

      setIsFormOpen((current) => current === nextIsFormOpen ? current : nextIsFormOpen)

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

    }

    function scheduleUpdate() {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(measure)
    }

    async function prepareTarget() {
      if (isPreparingTarget || stopped) return
      isPreparingTarget = true
      const target = await waitForVisibleTarget(() => {
        const form = phase === 'schedule' ? document.querySelector('.event-modal') : null
        return form ?? document.querySelector(step?.target) ?? document.querySelector(step?.readTarget)
      }, () => stopped)
      isPreparingTarget = false
      if (!target || stopped) return

      activeTarget = target
      setIsFormOpen(Boolean(phase === 'schedule' && target.matches('.event-modal')))
      scrollTourTargetIntoView(target, phase)
      await afterLayout()
      if (stopped) return

      measure()
      targetObserver = new ResizeObserver(scheduleUpdate)
      targetObserver.observe(target)
      unlockScroll = step.pageWalkthrough || target.matches('.event-modal') ? () => {} : lockTourScrolling()
      window.addEventListener('resize', scheduleUpdate)
      window.addEventListener('scroll', scheduleUpdate, true)
    }

    setTargetRect(null)
    setBubbleRect(null)
    mutationObserver = new MutationObserver(() => {
      const scheduleForm = phase === 'schedule' ? document.querySelector('.event-modal') : null
      const targetChangedToForm = scheduleForm && activeTarget !== scheduleForm

      if (!activeTarget) void prepareTarget()
      else if (targetChangedToForm || !activeTarget.isConnected || !isVisible(activeTarget)) {
        targetObserver?.disconnect()
        activeTarget = null
        unlockScroll()
        unlockScroll = () => {}
        void prepareTarget()
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    void prepareTarget()

    return () => {
      stopped = true
      cancelAnimationFrame(frameId)
      targetObserver?.disconnect()
      mutationObserver?.disconnect()
      unlockScroll()
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
      {locksTarget && <div className={`guided-tour-full-blocker${step.pageWalkthrough ? ' guided-tour-page-blocker' : ''}`} />}
      <div
        className="guided-tour-spotlight"
        style={{
          height: `${targetRect.height}px`,
          left: `${targetRect.left}px`,
          top: `${targetRect.top}px`,
          width: `${targetRect.width}px`,
        }}
      />
      <section className={`guided-tour ${isFormOpen ? 'guided-tour-form-callout' : ''}`} ref={calloutRef} role="dialog" aria-label="Athlete Reload guided walkthrough" style={getCalloutStyle(bubbleRect ?? targetRect, isFormOpen, calloutHeight, phase)}>
        <span className="guided-tour-arrow" aria-hidden="true">{isFormOpen ? '↓' : '↑'}</span>
        <p className="eyebrow">{isFormOpen ? 'Create your first event' : step.eyebrow}</p>
        <h2>{isFormOpen ? 'Fill out the event form' : step.title}</h2>
        <p>{isFormOpen ? 'Complete the event details, then tap Create event.' : step.body}</p>
        {step.requiresReadThrough && !hasReadThrough && <p className="guided-tour-progress">Scroll through the page to continue.</p>}
        <div className="guided-tour-actions">
          {!isFormOpen && phase !== 'schedule' && <button className="auth-switch" onClick={onBack} type="button">Back</button>}
          {!isFormOpen && <button className="ghost-close" onClick={onFinish} type="button">Skip tour</button>}
          {!isFormOpen && !step.awaitingClick && <button className="primary-button compact-action" disabled={!canAdvance} onClick={onNext} type="button">{phase === 'history' ? 'Finish tour' : 'Next'}</button>}
        </div>
      </section>
    </>
  )
}

function scrollTourTargetIntoView(target, phase) {
  if (target.matches('.event-modal')) {
    target.scrollTo({ top: 0, behavior: 'auto' })
    return
  }

  if (tourSteps[phase]?.pageWalkthrough) {
    window.scrollTo({ top: 0, behavior: 'auto' })
    target.scrollTo?.({ top: 0, behavior: 'auto' })
    return
  }

  const navigationStep = tourSteps[phase]?.navigationStep
  const scrollTarget = navigationStep ? target.closest('.liquid-navigation') ?? target : target
  scrollTarget.scrollIntoView({ behavior: 'auto', block: navigationStep ? 'end' : 'center', inline: 'nearest' })

  const rect = scrollTarget.getBoundingClientRect()
  const safeTop = 76
  const safeBottom = window.innerWidth <= 1060 ? 92 : 24
  if (rect.top < safeTop) window.scrollBy({ top: rect.top - safeTop, behavior: 'auto' })
  else if (rect.bottom > window.innerHeight - safeBottom) {
    window.scrollBy({ top: rect.bottom - window.innerHeight + safeBottom, behavior: 'auto' })
  }
}

function isVisible(element) {
  if (!element?.isConnected) return false
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

function waitForVisibleTarget(findTarget, isStopped) {
  return new Promise((resolve) => {
    let observer
    const check = () => {
      if (isStopped()) return finish(null)
      const target = findTarget()
      if (isVisible(target)) return finish(target)
    }
    const finish = (target) => {
      observer?.disconnect()
      resolve(target)
    }
    observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, childList: true, subtree: true })
    check()
  })
}

function afterLayout() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function lockTourScrolling() {
  const scrollables = [document.documentElement, document.body, ...document.querySelectorAll('*')]
    .filter((element) => element === document.documentElement || element === document.body
      || (element.scrollHeight > element.clientHeight
        && /(auto|scroll)/.test(`${getComputedStyle(element).overflow}${getComputedStyle(element).overflowY}`)))
  const snapshots = scrollables.map((element) => [element, element.style.overflow, element.style.touchAction])
  scrollables.forEach((element) => {
    element.style.overflow = 'hidden'
    element.style.touchAction = 'none'
  })

  const preventScroll = (event) => event.preventDefault()
  const preventScrollKeys = (event) => {
    if (['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '].includes(event.key)) event.preventDefault()
  }
  window.addEventListener('wheel', preventScroll, { passive: false, capture: true })
  window.addEventListener('touchmove', preventScroll, { passive: false, capture: true })
  window.addEventListener('keydown', preventScrollKeys, { capture: true })

  return () => {
    snapshots.forEach(([element, overflow, touchAction]) => {
      element.style.overflow = overflow
      element.style.touchAction = touchAction
    })
    window.removeEventListener('wheel', preventScroll, { capture: true })
    window.removeEventListener('touchmove', preventScroll, { capture: true })
    window.removeEventListener('keydown', preventScrollKeys, { capture: true })
  }
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

function getCalloutStyle(rect, isFormOpen, calloutHeight, phase) {
  const isMobile = window.matchMedia('(max-width: 1060px)').matches
  const width = Math.min(isMobile ? 300 : 360, window.innerWidth - 28)
  const maxLeft = Math.max(14, window.innerWidth - width - 14)
  const safeHeight = Math.min(calloutHeight || (isMobile ? 208 : 260), window.innerHeight - 28)
  const clampTop = (top) => Math.min(
    Math.max(14, top),
    Math.max(14, window.innerHeight - safeHeight - 14),
  )

  if (isMobile && tourSteps[phase]?.navigationStep) {
    const left = Math.min(Math.max(14, rect.left + (rect.width - width) / 2), maxLeft)
    const top = clampTop(rect.top - safeHeight - 34)

    return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
  }

  if (isFormOpen) {
    if (isMobile) {
      return { left: '14px', top: '14px', width: `${width}px` }
    }

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


  if (tourSteps[phase]?.pageWalkthrough) {
    const top = isMobile ? 14 : 88
    return { left: `${maxLeft}px`, top: `${top}px`, width: `${width}px` }
  }

  const left = Math.min(Math.max(14, rect.left), maxLeft)
  const top = clampTop(rect.bottom + 22)

  return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

function sameRect(first, second) {
  return first && ['top', 'left', 'width', 'height'].every((key) => Math.abs(first[key] - second[key]) < 1)
}
