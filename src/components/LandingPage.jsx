import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useMotionValue, useSpring } from 'motion/react'
import { gsap } from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import appLogo from '../assets/athlete-reload-logo-transparent.png'
import athleteImage from '../assets/landing/runner-track-recovery.webp'
import { AppIcon } from './AppIcon'
import { SectionHeading } from './SectionHeading'

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger)

const HEADER_OFFSET = 92
const HOW_IT_WORKS_OFFSET = 118
const revealViewport = { amount: 0.22, margin: '0px 0px -6% 0px' }
const revealTransition = { duration: 0.86, ease: [0.22, 1, 0.36, 1] }
const revealInitial = { opacity: 0, y: 24 }
const revealVisible = { opacity: 1, y: 0 }

function getSectionScrollTop(target) {
  const offset = target.id === 'how-it-works' ? HOW_IT_WORKS_OFFSET : HEADER_OFFSET
  return Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset)
}

function focusSectionHeading(target) {
  const heading = target.querySelector('h1, h2')
  if (!heading) return
  heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
}

const navigation = [
  ['How it works', 'how-it-works'],
  ['Features', 'features'],
  ['Safety & Privacy', 'safety'],
  ['FAQ', 'faq'],
]

const workflow = [
  { icon: 'readiness', label: 'Check in', title: 'Capture how ready your body feels.', copy: 'Record readiness signals before the selected event, including energy, soreness, fatigue, sleep, stress, and reported pain.' },
  { icon: 'performance', label: 'Prepare', title: 'Review your readiness report.', copy: 'See readiness status, relevant preparation guidance, and the current factors used to shape the report.' },
  { icon: 'sessions', label: 'Checkout', title: 'Log what actually happened.', copy: 'Record participation, workload, fatigue, soreness, pain changes, and other post-event context.' },
  { icon: 'recovery', label: 'Recovery', title: 'Build your recovery plan.', copy: 'Generate a routine from the latest checkout or choose a standalone recovery goal.' },
]

const productStages = [
  {
    id: 'prepare',
    label: 'Prepare',
    copy: 'Check in against the event on your training calendar before activity begins.',
    screens: [
      { icon: 'readiness', eyebrow: 'Check in', title: 'Check-in.', copy: 'Capture how ready your body feels before the selected event.' },
      { icon: 'calendar', eyebrow: 'Schedule', title: 'Training calendar.', copy: 'Create training events, tournaments, Rest Days, and Recovery Days.' },
    ],
  },
  {
    id: 'perform',
    label: 'Perform',
    copy: 'Keep daily fuel and reported pain available alongside the training schedule.',
    screens: [
      { icon: 'nutrition', eyebrow: 'Nutrition', title: 'Fuel for the day.', copy: 'Track food and hydration supporting today’s training.' },
      { icon: 'pain', eyebrow: 'Pain timeline', title: 'Track reported areas.', copy: 'Review changes in a reported pain area across check-ins and pain reports.' },
    ],
  },
  {
    id: 'reload',
    label: 'Reload',
    copy: 'Close out the event, build recovery, and keep the completed record in History.',
    screens: [
      { icon: 'sessions', eyebrow: 'Checkout', title: 'Log what happened.', copy: 'Compare the completed event with what was planned.' },
      { icon: 'recovery', eyebrow: 'Recovery', title: 'Build your recovery plan.', copy: 'Choose a recovery outcome and generate a routine.' },
      { icon: 'trend', eyebrow: 'History', title: 'Patterns are the product.', copy: 'Review readiness, workload, pain, and recovery over time.' },
    ],
  },
]

const signalNodes = [
  { icon: 'readiness', label: 'Check in', copy: 'Record readiness signals before the selected event, including energy, soreness, fatigue, sleep, stress, and reported pain.', path: 'M500 310 Q330 160 160 120', x: 16, y: 19 },
  { icon: 'calendar', label: 'Schedule', copy: 'Create training events, tournaments, Rest Days, and Recovery Days on the training calendar.', path: 'M500 310 Q500 170 500 70', x: 50, y: 11 },
  { icon: 'nutrition', label: 'Nutrition', copy: 'Log food and hydration alongside the current training day.', path: 'M500 310 Q670 160 840 120', x: 84, y: 19 },
  { icon: 'pain', label: 'Pain', copy: 'Record reported pain areas and review how they change across check-ins and pain reports.', path: 'M500 310 Q720 320 880 350', x: 88, y: 56 },
  { icon: 'sessions', label: 'Checkout', copy: 'Record participation, workload, fatigue, soreness, pain changes, and other post-event context.', path: 'M500 310 Q660 430 730 550', x: 73, y: 88 },
  { icon: 'recovery', label: 'Recovery', copy: 'Generate a routine from the latest checkout or choose a standalone recovery goal.', path: 'M500 310 Q430 470 350 560', x: 35, y: 90 },
  { icon: 'trend', label: 'History', copy: 'Review readiness, workload, pain, and recovery records over time.', path: 'M500 310 Q280 360 100 380', x: 10, y: 61 },
]

const faqs = [
  ['Who is Athlete Reload for?', 'Athlete Reload is designed for athletes age 16 and older across individual and team sports.'],
  ['Is Athlete Reload free?', 'Yes. Athlete Reload is currently free to use, with no pricing tier or subscription required.'],
  ['Does it replace a coach, trainer, or clinician?', 'No. Athlete Reload provides educational preparation and recovery guidance. It does not diagnose injuries, provide medical clearance, or replace qualified professional care.'],
  ['What happens to my data?', 'Authenticated access protects your records. Settings includes privacy controls, data export, shared-report history, and account deletion.'],
  ['Can I build recovery without a scheduled event?', 'Yes. Recovery includes standalone mobility, flexibility, soreness-relief, targeted-area, and recovery-day routines.'],
]

export function LandingPage({ onCreateAccount, onOpenLegal: _onOpenLegal, onSignIn, playOpening = true, returningFromAuth = false }) {
  const [activeStage, setActiveStage] = useState(0)
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProductStoryVisible, setIsProductStoryVisible] = useState(false)
  const [isSignalVisible, setIsSignalVisible] = useState(false)
  const [hoveredSignal, setHoveredSignal] = useState(null)
  const [selectedSignal, setSelectedSignal] = useState(null)
  const [showScrollGuide, setShowScrollGuide] = useState(false)
  const [stageCycleReset, setStageCycleReset] = useState(0)
  const rootRef = useRef(null)
  const scrollTweenRef = useRef(null)
  const signalFieldRectRef = useRef(null)
  const signalRotateXTarget = useMotionValue(0)
  const signalRotateYTarget = useMotionValue(0)
  const signalRotateX = useSpring(signalRotateXTarget, { stiffness: 180, damping: 24, mass: 0.7 })
  const signalRotateY = useSpring(signalRotateYTarget, { stiffness: 180, damping: 24, mass: 0.7 })
  const activeSignal = hoveredSignal ?? selectedSignal

  useEffect(() => {
    function updateHeader() {
      setIsHeaderScrolled(window.scrollY > 28)
    }
    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    return () => window.removeEventListener('scroll', updateHeader)
  }, [])

  useEffect(() => {
    const cue = rootRef.current?.querySelector('.public-scroll-cue')
    const ending = rootRef.current?.querySelector('.public-final-cta')
    if (!cue || !ending) return undefined
    let cuePassed = false
    let endingVisible = false
    const update = () => setShowScrollGuide(cuePassed && !endingVisible)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === cue) cuePassed = !entry.isIntersecting && entry.boundingClientRect.bottom < 0
        if (entry.target === ending) endingVisible = entry.isIntersecting
      })
      update()
    }, { threshold: [0, 0.1] })
    observer.observe(cue)
    observer.observe(ending)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const story = rootRef.current?.querySelector('.public-product-story')
    if (!story) return undefined
    const observer = new IntersectionObserver(([entry]) => setIsProductStoryVisible(entry.isIntersecting), { threshold: 0.3 })
    observer.observe(story)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const section = rootRef.current?.querySelector('.public-signal-section')
    if (!section) return undefined
    const observer = new IntersectionObserver(([entry]) => setIsSignalVisible(entry.isIntersecting), { threshold: 0.15 })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isProductStoryVisible) return undefined
    const timer = window.setTimeout(() => setActiveStage((current) => (current + 1) % productStages.length), 4800)
    return () => window.clearTimeout(timer)
  }, [activeStage, isProductStoryVisible, stageCycleReset])

  useEffect(() => {
    const sections = rootRef.current?.querySelectorAll('.public-flow, .public-product-story, .public-safety, .public-final-cta')
    const reveals = rootRef.current?.querySelectorAll('[data-scroll-reveal]')
    if (!sections?.length || !reveals?.length) return undefined
    const motionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-motion-active', entry.isIntersecting))
    }, { rootMargin: '8% 0px', threshold: 0.08 })
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-scroll-visible', entry.isIntersecting))
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 })
    sections.forEach((section) => motionObserver.observe(section))
    reveals.forEach((element) => revealObserver.observe(element))
    return () => {
      motionObserver.disconnect()
      revealObserver.disconnect()
      sections.forEach((section) => section.classList.remove('is-motion-active'))
      reveals.forEach((element) => element.classList.remove('is-scroll-visible'))
    }
  }, [])

  useEffect(() => {
    function alignWithHistory() {
      const targetId = window.location.hash.slice(1)
      const target = targetId && document.getElementById(targetId)
      if (!target) return
      navigateToTarget(target, { focus: true })
    }

    window.addEventListener('popstate', alignWithHistory)
    return () => window.removeEventListener('popstate', alignWithHistory)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const heroImage = root.querySelector('.public-hero-frame img')
    const previousScrollRestoration = window.history.scrollRestoration
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const navigationType = window.performance.getEntriesByType('navigation')[0]?.type
    const isReload = navigationType === 'reload'
    const initialHash = isReload || returningFromAuth ? '' : window.location.hash.slice(1)
    window.history.scrollRestoration = 'manual'
    if (playOpening) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }
    window.scrollTo({ top: 0 })
    let openingComplete = !playOpening
    const completeOpening = () => {
      if (openingComplete) return
      openingComplete = true
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
    if (isReload) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      window.scrollTo({ top: 0 })
    }

    let cancelled = false
    let heroReadyTimer = null
    const imageReady = heroImage?.decode
      ? heroImage.decode().catch(() => undefined)
      : new Promise((resolve) => {
          if (!heroImage || heroImage.complete) resolve()
          else {
            heroImage.addEventListener('load', resolve, { once: true })
            heroImage.addEventListener('error', resolve, { once: true })
          }
        })
    const heroReady = Promise.race([
      imageReady,
      new Promise((resolve) => { heroReadyTimer = window.setTimeout(resolve, 1800) }),
    ]).finally(() => {
      if (heroReadyTimer) window.clearTimeout(heroReadyTimer)
    })
    let entrance = null
    const context = gsap.context(() => {
      entrance = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
      if (playOpening) {
        entrance
          .set('.public-opening-sequence', { autoAlpha: 1 })
          .set('.public-opening-word', {
            autoAlpha: 0,
            rotate: (index) => [-4, 4, -3][index],
            scale: 0.94,
            xPercent: (index) => [32, -24, -28][index],
            yPercent: (index) => [78, -60, -18][index],
          })
          .to('.public-opening-word', { autoAlpha: 1, duration: 0.52, stagger: 0.065, ease: 'sine.out' })
          .to('.public-opening-word', { rotate: 0, scale: 1, xPercent: 0, yPercent: 0, duration: 1.08, stagger: 0.04, ease: 'power3.inOut' }, '-=0.06')
          .from('.public-opening-rule', { scaleX: 0, duration: 0.72, ease: 'power3.inOut' }, '-=0.68')
          .to({}, { duration: 0.16 })
          .call(() => window.scrollTo({ top: 0 }))
          .addLabel('heroReveal', '-=0.05')
          .to('.public-opening-sequence', { clipPath: 'inset(0 0 100% 0)', duration: 0.78, ease: 'power4.inOut' }, 'heroReveal')
          .from('.public-header', { opacity: 0, y: -18, duration: 0.65 }, 'heroReveal+=0.12')
          .from('.public-hero-copy > *', { opacity: 0, y: 34, duration: 0.72, stagger: 0.09 }, 'heroReveal+=0.12')
          .from('.public-hero-visual', { autoAlpha: 0, y: 28, scale: 0.975, duration: 0.82 }, 'heroReveal+=0.1')
          .from('.public-hero-frame', { clipPath: 'inset(0 0 100% 0 round 32px)', duration: 1.05 }, 'heroReveal+=0.1')
          .from('.public-hero-marker', { opacity: 0, scale: 0.7, duration: 0.5, stagger: 0.08 }, 'heroReveal+=0.34')
          .set('.public-opening-sequence', { display: 'none' }, 'heroReveal+=0.78')
          .call(completeOpening, [], 'heroReveal+=0.78')
      } else {
        entrance
          .addLabel('heroReveal', 0)
          .from('.public-header', { autoAlpha: 0, y: -16, scale: 0.985, duration: 0.48 }, 'heroReveal')
          .from('.public-hero-copy', { autoAlpha: 0, y: 30, scale: 0.985, duration: 0.58 }, 'heroReveal')
          .from('.public-hero-visual', { autoAlpha: 0, y: 30, scale: 0.97, duration: 0.68 }, 'heroReveal')
          .from('.public-hero-frame', { clipPath: 'inset(0 0 100% 0 round 32px)', duration: 0.76 }, 'heroReveal')
          .from('.public-hero-marker', { autoAlpha: 0, scale: 0.78, duration: 0.42, stagger: 0.06 }, 'heroReveal+=0.18')
          .call(() => {
            if (!returningFromAuth) return
            const heading = root.querySelector('.public-hero h1')
            heading?.setAttribute('tabindex', '-1')
            heading?.focus({ preventScroll: true })
          })
      }

      gsap.to('.public-hero-frame img', {
        scale: 1.08,
        yPercent: 5,
        ease: 'none',
        scrollTrigger: { trigger: '.public-hero', start: 'top top', end: 'bottom top', scrub: 0.7 },
      })
      gsap.to('.public-hero-copy', {
        opacity: 0.28,
        yPercent: -12,
        ease: 'none',
        scrollTrigger: { trigger: '.public-hero', start: '45% top', end: 'bottom top', scrub: 0.7 },
      })
      gsap.to('.public-header', {
        '--public-scroll-progress': 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.25 },
      })

      gsap.to('.public-flow-word', {
        xPercent: -12,
        yPercent: -10,
        ease: 'none',
        scrollTrigger: { trigger: '.public-flow', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
      })
      gsap.to('.public-signal-field', {
        '--signal-scroll-y': '-28px',
        ease: 'none',
        scrollTrigger: { trigger: '.public-signal-section', start: 'top bottom', end: 'bottom top', scrub: 0.75 },
      })
    }, root)

    let resizeFrame = null
    let viewportWidth = window.innerWidth
    let viewportHeight = window.innerHeight
    heroReady.then(() => {
      if (!cancelled) entrance?.play(0)
    })
    const ready = [document.fonts?.ready, heroReady].filter(Boolean)
    Promise.all(ready).then(() => {
      if (cancelled) return
      ScrollTrigger.refresh()
      window.requestAnimationFrame(() => {
        if (cancelled) return
        if (isReload) window.scrollTo({ top: 0 })
        else if (initialHash && initialHash !== 'top') {
          const target = document.getElementById(initialHash)
          if (target) window.scrollTo({ top: getSectionScrollTop(target) })
        }
      })
    })

    function refreshForViewportChange() {
      const width = window.innerWidth
      const height = window.innerHeight
      if (width === viewportWidth && height === viewportHeight) return
      viewportWidth = width
      viewportHeight = height
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh())
    }
    window.addEventListener('resize', refreshForViewportChange)

    return () => {
      cancelled = true
      window.removeEventListener('resize', refreshForViewportChange)
      if (heroReadyTimer) window.clearTimeout(heroReadyTimer)
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      scrollTweenRef.current?.kill()
      context.revert()
      completeOpening()
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [playOpening, returningFromAuth])

  function navigateToTarget(target, { focus = false, historyMode = null } = {}) {
    ScrollTrigger.refresh()
    const top = getSectionScrollTop(target)
    const duration = Math.min(1.35, Math.max(0.72, Math.abs(top - window.scrollY) / 1800))
    scrollTweenRef.current?.kill()
    scrollTweenRef.current = gsap.to(window, {
      duration,
      ease: 'power4.inOut',
      overwrite: 'auto',
      scrollTo: { autoKill: true, y: top },
      onComplete: () => {
        scrollTweenRef.current = null
        if (historyMode) {
          const hash = target.id === 'top' ? '#top' : `#${target.id}`
          window.history[historyMode](null, '', hash)
        }
        if (focus) focusSectionHeading(target)
      },
    })
  }

  function scrollToSection(event, targetId, replace = false) {
    event?.preventDefault()
    setIsMenuOpen(false)
    const target = document.getElementById(targetId)
    if (!target) return
    navigateToTarget(target, { focus: true, historyMode: replace ? 'replaceState' : 'pushState' })
  }

  function selectStage(index) {
    setActiveStage(index)
    setStageCycleReset((current) => current + 1)
  }

  function moveSignalField(event) {
    if (event.pointerType !== 'mouse') return
    const rect = signalFieldRectRef.current ?? event.currentTarget.getBoundingClientRect()
    signalFieldRectRef.current = rect
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1))
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1))
    signalRotateXTarget.set(y * -2.5)
    signalRotateYTarget.set(x * 3.5)
  }

  function resetSignalField() {
    signalFieldRectRef.current = null
    signalRotateXTarget.set(0)
    signalRotateYTarget.set(0)
    setHoveredSignal(null)
  }

  return (
    <div className="public-site" ref={rootRef}>
      {playOpening && <div className="public-opening-sequence" aria-hidden="true">
        <div className="public-opening-words"><span className="public-opening-word">Prepare.</span><span className="public-opening-word">Perform.</span><span className="public-opening-word">Reload.</span></div>
        <i className="public-opening-rule" />
        <span className="public-opening-mark">Athlete Reload</span>
      </div>}
      <a className="skip-link" href="#landing-main">Skip to main content</a>
      <header className={`public-header ${isHeaderScrolled ? 'is-scrolled' : ''}`}>
        <a aria-label="Athlete Reload home" className="public-brand" href="#top" onClick={(event) => scrollToSection(event, 'top')}>
          <img src={appLogo} alt="" />
          <span>Athlete Reload</span>
        </a>
        <nav aria-label="Public navigation" className={`public-navigation ${isMenuOpen ? 'is-open' : ''}`}>
          {navigation.map(([label, target]) => <a href={`#${target}`} key={target} onClick={(event) => scrollToSection(event, target)}>{label}</a>)}
          <div className="public-mobile-actions">
            <button className="public-signin" onClick={onSignIn} type="button">Sign in</button>
            <button className="primary-button" onClick={onCreateAccount} type="button">Create account</button>
          </div>
        </nav>
        <div className="public-header-actions">
          <button className="public-header-action public-signin" onClick={onSignIn} type="button">Sign in</button>
          <button className="primary-button public-header-action" onClick={onCreateAccount} type="button">Create account</button>
        </div>
        <button aria-expanded={isMenuOpen} aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} className="public-menu-button" onClick={() => setIsMenuOpen((current) => !current)} type="button"><AppIcon name={isMenuOpen ? 'close' : 'menu'} size={24} /></button>
      </header>

      <main id="landing-main">
        <section className="public-hero" id="top">
          <div className="public-hero-copy">
            <p className="eyebrow">Preparation built around the athlete</p>
            <h1>Know what today asks of you.</h1>
            <p className="public-hero-lede">Athlete Reload brings readiness, scheduling, nutrition, pain, checkout, recovery, and history into one training workflow.</p>
            <div className="public-hero-actions">
              <button className="primary-button public-hero-primary" onClick={onCreateAccount} type="button">Create your account <AppIcon name="arrow" size={20} /></button>
              <a className="secondary-button" href="#features" onClick={(event) => scrollToSection(event, 'features')}>Explore features</a>
            </div>
            <a className="public-scroll-cue" href="#how-it-works" onClick={(event) => scrollToSection(event, 'how-it-works')}>
              <span>Scroll to enter the training loop</span>
              <i aria-hidden="true"><b /></i>
              <AppIcon name="chevron" size={18} />
            </a>
          </div>
          <div className="public-hero-visual">
            <div className="public-hero-orbit" aria-hidden="true" />
            <picture className="public-hero-frame"><img alt="Runner performing a lateral resistance-band drill on an outdoor track" decoding="async" fetchPriority="high" height="1536" src={athleteImage} width="1024" /></picture>
            <div className="public-hero-markers" aria-hidden="true">
              <span className="public-hero-marker"><AppIcon name="readiness" size={20} />Check in</span>
              <span className="public-hero-marker"><AppIcon name="calendar" size={20} />Schedule</span>
              <span className="public-hero-marker"><AppIcon name="recovery" size={20} />Recovery</span>
            </div>
          </div>
        </section>

        <section className="public-flow" id="how-it-works">
          <div className="public-flow-pin">
            <m.div className="public-section-heading" data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}><p className="eyebrow">How it works</p><h2>The training loop stays connected.</h2></m.div>
            <div className="public-flow-words" aria-hidden="true"><span className="public-flow-word">Reload</span></div>
            <div className="public-flow-viewport">
              <ol className="public-flow-track">
                {workflow.map((step, index) => <li className="public-flow-card-shell" key={step.label}><m.article className="public-flow-card app-surface" data-scroll-reveal initial={{ ...revealInitial, rotate: index % 2 ? 1.2 : -1.2, '--flow-trace': 0 }} transition={{ ...revealTransition, delay: index * 0.08 }} viewport={revealViewport} whileHover={{ y: -8 }} whileInView={{ ...revealVisible, rotate: 0, '--flow-trace': 1 }}><span>{String(index + 1).padStart(2, '0')}</span><div className="public-flow-icon"><AppIcon name={step.icon} size={28} /></div><p className="eyebrow">{step.label}</p><h3>{step.title}</h3><p>{step.copy}</p></m.article></li>)}
              </ol>
            </div>
          </div>
        </section>

        <div className="public-motion-ribbon" aria-hidden="true"><div>{[0, 1].map((copy) => <div key={copy}><span>Check in</span><span>Readiness</span><span>Schedule</span><span>Nutrition</span><span>Pain</span><span>Checkout</span><span>Recovery</span><span>History</span></div>)}</div></div>

        <section className="public-product-story" id="features">
          <div className="public-product-pin">
            <m.div className="public-section-heading public-heading-split" data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}><div><p className="eyebrow">Athlete Reload workspace</p><h2>Prepare. Perform. Reload.</h2></div></m.div>
            <div className="public-product-layout">
              <m.div aria-label="Product workflow stages" className="product-stage-controls" data-scroll-reveal initial={revealInitial} role="tablist" transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}>
                {productStages.map((stage, index) => <button aria-controls={`product-stage-panel-${stage.id}`} aria-selected={activeStage === index} className={activeStage === index ? 'active' : ''} key={stage.id} onClick={() => selectStage(index)} role="tab" type="button"><span>0{index + 1}</span><strong>{stage.label}</strong><small>{stage.copy}</small>{activeStage === index && isProductStoryVisible && <i className="product-stage-timer" key={stageCycleReset} />}</button>)}
              </m.div>
              <m.div className="product-stage-visual" data-scroll-reveal initial={revealInitial} transition={{ ...revealTransition, delay: 0.08 }} viewport={revealViewport} whileInView={revealVisible}>
                <div className="product-stage-words" aria-hidden="true"><span className="product-stage-word" key={productStages[activeStage].id}>{productStages[activeStage].label}</span></div>
                {productStages.map((stage, index) => <div aria-hidden={activeStage !== index} className="product-stage-panel" id={`product-stage-panel-${stage.id}`} key={stage.id} role="tabpanel">{stage.screens.map((screen) => <div className="product-screen-shell" key={screen.eyebrow}><article className="product-screen app-surface"><span className="product-screen-icon"><AppIcon name={screen.icon} size={24} /></span><SectionHeading eyebrow={screen.eyebrow} title={screen.title} /><p>{screen.copy}</p></article></div>)}</div>)}
              </m.div>
            </div>
          </div>
        </section>

        <section className={`public-signal-section${isSignalVisible ? ' is-active' : ''}`}>
          <m.div className="public-section-heading" data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}><p className="eyebrow">Connected workflow</p><h2>One training rhythm.</h2></m.div>
          <div className="public-signal-field" onPointerEnter={(event) => { signalFieldRectRef.current = event.currentTarget.getBoundingClientRect() }} onPointerLeave={resetSignalField} onPointerMove={moveSignalField}>
            <m.div className="public-signal-depth" style={{ rotateX: signalRotateX, rotateY: signalRotateY }}>
              <svg aria-hidden="true" className="public-signal-map" viewBox="0 0 1000 620" preserveAspectRatio="none">
                {signalNodes.map((node, index) => <m.g animate={{ opacity: activeSignal === null || activeSignal === index ? 1 : 0.28 }} key={node.label} transition={{ duration: 0.28 }}><m.path className="public-signal-path" d={node.path} initial={{ pathLength: 0 }} transition={{ duration: 1.1, delay: index * 0.05 }} viewport={revealViewport} whileInView={{ pathLength: 1 }} /><m.path animate={{ opacity: activeSignal === index ? 1 : 0.72, strokeWidth: activeSignal === index ? 4.5 : 3 }} className={`public-signal-pulse${activeSignal === index ? ' is-selected' : ''}`} d={node.path} pathLength="240" style={{ animationDelay: `${index * -0.42}s` }} /></m.g>)}
              </svg>
              <m.div animate={{ scale: activeSignal === null ? 1 : 1.055 }} className={`public-signal-hub${activeSignal === null ? '' : ' has-active-signal'}`} transition={{ type: 'spring', stiffness: 320, damping: 24 }}><i aria-hidden="true" className="public-signal-orbit" /><img alt="" src={appLogo} /><strong>Athlete Reload</strong></m.div>
              <div className="public-signal-nodes">
                {signalNodes.map((node, index) => <m.button animate={{ scale: activeSignal === index ? 1.08 : 1, y: activeSignal === index ? -5 : 0 }} aria-label={`${node.label}: ${node.copy}`} aria-pressed={selectedSignal === index} className={`public-signal-node${activeSignal === index ? ' is-selected' : ''}`} initial={{ opacity: 0, scale: 0.7, y: 20 }} key={node.label} onBlur={() => setHoveredSignal(null)} onClick={() => setSelectedSignal((current) => current === index ? null : index)} onFocus={() => setHoveredSignal(index)} onHoverEnd={() => setHoveredSignal(null)} onHoverStart={() => setHoveredSignal(index)} style={{ '--signal-delay': `${index * -0.38}s`, '--signal-x': `${node.x}%`, '--signal-y': `${node.y}%` }} transition={{ type: 'spring', stiffness: 360, damping: 25, delay: index * 0.035 }} type="button" viewport={revealViewport} whileInView={{ opacity: 1, scale: activeSignal === index ? 1.08 : 1, y: activeSignal === index ? -5 : 0 }}><span className="public-signal-node-icon"><AppIcon name={node.icon} size={22} /></span><strong>{node.label}</strong><AnimatePresence initial={false}>{activeSignal === index && <m.span animate={{ height: 'auto', opacity: 1, y: 0 }} className="public-signal-node-copy" exit={{ height: 0, opacity: 0, y: -6 }} initial={{ height: 0, opacity: 0, y: -6 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>{node.copy}</m.span>}</AnimatePresence></m.button>)}
              </div>
            </m.div>
          </div>
        </section>

        <section className="public-section public-safety" id="safety">
          <m.div data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}><p className="eyebrow">Safety & privacy</p><h2>Built to support judgment, not replace it.</h2><p>Athlete Reload provides educational preparation and recovery guidance. It does not diagnose injuries or provide medical clearance.</p></m.div>
          <div className="public-safety-list">
            <m.article data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileHover={{ x: 6 }} whileInView={revealVisible}><span className="public-safety-icon"><AppIcon name="shield" size={24} /></span><div><h3>Authenticated records</h3><p>Ownership controls protect athlete records, with export and account deletion available from Settings.</p></div></m.article>
            <m.article data-scroll-reveal initial={revealInitial} transition={{ ...revealTransition, delay: 0.08 }} viewport={revealViewport} whileHover={{ x: 6 }} whileInView={revealVisible}><span className="public-safety-icon"><AppIcon name="pain" size={24} /></span><div><h3>Clear stop conditions</h3><p>Concerning symptoms prompt the athlete to stop and involve an adult, athletic trainer, or qualified healthcare professional.</p></div></m.article>
            <m.article data-scroll-reveal initial={revealInitial} transition={{ ...revealTransition, delay: 0.16 }} viewport={revealViewport} whileHover={{ x: 6 }} whileInView={revealVisible}><span className="public-safety-icon"><AppIcon name="report" size={24} /></span><div><h3>Visible context</h3><p>Readiness and recovery reports identify the current factors used to shape their guidance.</p></div></m.article>
          </div>
        </section>

        <section className="public-section public-faq" id="faq">
          <m.div className="public-section-heading" data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}><p className="eyebrow">Questions, answered</p><h2>Start with the essentials.</h2></m.div>
          <div className="public-faq-list">{faqs.map(([question, answer], index) => <m.details data-scroll-reveal initial={revealInitial} key={question} transition={{ ...revealTransition, delay: index * 0.06 }} viewport={revealViewport} whileInView={revealVisible}><summary>{question}<AppIcon name="plus" size={20} /></summary><p>{answer}</p></m.details>)}</div>
        </section>

        <m.section className="public-final-cta" data-scroll-reveal initial={revealInitial} transition={revealTransition} viewport={revealViewport} whileInView={revealVisible}><p className="eyebrow">Your next session starts before the first rep</p><h2>Prepare with context. Recover with purpose.</h2><m.button className="primary-button" onClick={onCreateAccount} transition={{ type: 'spring', stiffness: 420, damping: 26 }} type="button" whileHover={{ scale: 1.035 }} whileTap={{ scale: 0.97 }}>Create your free account <AppIcon name="arrow" size={20} /></m.button></m.section>
      </main>
      <div aria-hidden="true" className={`public-scroll-guide${showScrollGuide ? ' is-visible' : ''}`}><i><b /></i><AppIcon name="chevron" size={16} /></div>
    </div>
  )
}
