import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import appLogo from '../assets/athlete-reload-logo-transparent.png'
import athleteImage from '../assets/landing/runner-track-recovery.webp'
import { AppIcon } from './AppIcon'
import { SectionHeading } from './SectionHeading'

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger)

const HEADER_OFFSET = 92
const DESKTOP_PIN_TOP = 88
const MOBILE_PIN_TOP = 78

function getSectionScrollTop(target) {
  const pinnedTrigger = ScrollTrigger.getAll().find((trigger) => trigger.trigger === target)
  if (pinnedTrigger) return Math.max(0, pinnedTrigger.start)
  return Math.max(0, target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET)
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

const faqs = [
  ['Who is Athlete Reload for?', 'Athlete Reload is designed for athletes age 16 and older across individual and team sports.'],
  ['Is Athlete Reload free?', 'Yes. Athlete Reload is currently free to use, with no pricing tier or subscription required.'],
  ['Does it replace a coach, trainer, or clinician?', 'No. Athlete Reload provides educational preparation and recovery guidance. It does not diagnose injuries, provide medical clearance, or replace qualified professional care.'],
  ['What happens to my data?', 'Authenticated access protects your records. Settings includes privacy controls, data export, shared-report history, and account deletion.'],
  ['Can I build recovery without a scheduled event?', 'Yes. Recovery includes standalone mobility, flexibility, soreness-relief, targeted-area, and recovery-day routines.'],
]

export function LandingPage({ onCreateAccount, onOpenLegal, onSignIn }) {
  const [activeStage, setActiveStage] = useState(0)
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const rootRef = useRef(null)
  const scrollTweenRef = useRef(null)
  const storyTriggerRef = useRef(null)

  useEffect(() => {
    function updateHeader() {
      setIsHeaderScrolled(window.scrollY > 28)
    }
    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    return () => window.removeEventListener('scroll', updateHeader)
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
    const previousScrollRestoration = window.history.scrollRestoration
    const navigationType = window.performance.getEntriesByType('navigation')[0]?.type
    const isReload = navigationType === 'reload'
    const initialHash = isReload ? '' : window.location.hash.slice(1)
    window.history.scrollRestoration = 'manual'
    root.classList.add('has-motion-pins')
    if (isReload) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      window.scrollTo({ top: 0 })
    }

    let media = null
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.public-header', { opacity: 0, y: -18, duration: 0.65 })
        .from('.public-hero-copy > *', { opacity: 0, y: 34, duration: 0.72, stagger: 0.09 }, '-=0.25')
        .from('.public-hero-frame', { clipPath: 'inset(0 0 100% 0 round 32px)', duration: 1.05 }, '-=0.82')
        .from('.public-hero-marker', { opacity: 0, scale: 0.7, duration: 0.5, stagger: 0.08 }, '-=0.52')

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

      ScrollTrigger.batch('.public-reveal', {
        start: 'top 88%',
        onEnter: (elements) => gsap.to(elements, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', overwrite: true }),
        onLeaveBack: (elements) => gsap.to(elements, { opacity: 0, y: 34, duration: 0.42, stagger: 0.04, ease: 'power2.in', overwrite: true }),
      })

      function createPinnedScenes(isMobile) {
        const visiblePinTop = isMobile ? MOBILE_PIN_TOP : DESKTOP_PIN_TOP
        const flowTrack = root.querySelector('.public-flow-track')
        const flowViewport = root.querySelector('.public-flow-viewport')
        const flowWords = gsap.utils.toArray('.public-flow-word')
        if (flowTrack && flowViewport) {
          const flowTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: '.public-flow',
              start: `top top+=${visiblePinTop}`,
              end: () => `+=${Math.max(window.innerWidth * (isMobile ? 3.5 : 2.35), isMobile ? 1500 : 2400)}`,
              pin: '.public-flow-pin',
              pinSpacing: true,
              scrub: isMobile ? 0.45 : 0.65,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })
          flowTimeline.to(flowTrack, { x: () => -(flowTrack.scrollWidth - flowViewport.clientWidth), ease: 'none', duration: workflow.length - 1 }, 0)
          flowWords.forEach((word, index) => {
            flowTimeline.fromTo(word, { autoAlpha: index === 0 ? 1 : 0, yPercent: 22 }, { autoAlpha: 1, yPercent: 0, duration: 0.28 }, index - 0.05)
            if (index < flowWords.length - 1) flowTimeline.to(word, { autoAlpha: 0, yPercent: -18, duration: 0.28 }, index + 0.68)
          })
        }

        const stagePanels = gsap.utils.toArray('.product-stage-panel')
        const stageWords = gsap.utils.toArray('.product-stage-word')
        gsap.set(stagePanels.slice(1), { autoAlpha: 0, y: isMobile ? 24 : 36 })
        gsap.set(stageWords.slice(1), { autoAlpha: 0, yPercent: 18 })
        const storyTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: '.public-product-story',
            start: `top top+=${visiblePinTop}`,
            end: `+=${isMobile ? 1650 : 2300}`,
            pin: '.public-product-pin',
            pinSpacing: true,
            scrub: isMobile ? 0.45 : 0.65,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const nextStage = Math.min(productStages.length - 1, Math.round(self.progress * (productStages.length - 1)))
              setActiveStage((current) => current === nextStage ? current : nextStage)
            },
          },
        })
        storyTriggerRef.current = storyTimeline.scrollTrigger
        for (let index = 1; index < stagePanels.length; index += 1) {
          storyTimeline
            .to(stagePanels[index - 1], { autoAlpha: 0, y: isMobile ? -18 : -28, duration: 0.24 }, index - 0.42)
            .fromTo(stagePanels[index], { autoAlpha: 0, y: isMobile ? 24 : 36 }, { autoAlpha: 1, y: 0, duration: 0.32 }, index - 0.32)
            .to(stageWords[index - 1], { autoAlpha: 0, yPercent: -16, duration: 0.24 }, index - 0.4)
            .fromTo(stageWords[index], { autoAlpha: 0, yPercent: 18 }, { autoAlpha: 1, yPercent: 0, duration: 0.3 }, index - 0.3)
        }
        return () => { storyTriggerRef.current = null }
      }

      media = gsap.matchMedia()
      media.add('(min-width: 900px)', () => createPinnedScenes(false))
      media.add('(max-width: 899px)', () => createPinnedScenes(true))
    }, root)

    let cancelled = false
    let resizeFrame = null
    let viewportWidth = window.innerWidth
    let viewportHeight = window.innerHeight
    const heroImage = root.querySelector('.public-hero-frame img')
    const ready = [document.fonts?.ready, heroImage?.decode?.().catch(() => undefined)].filter(Boolean)
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
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      scrollTweenRef.current?.kill()
      media?.revert()
      context.revert()
      root.classList.remove('has-motion-pins')
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

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
    const trigger = storyTriggerRef.current
    if (!trigger) return
    const targetScroll = trigger.start + ((trigger.end - trigger.start) * index) / (productStages.length - 1)
    gsap.to(window, { duration: 0.7, ease: 'power3.inOut', overwrite: 'auto', scrollTo: targetScroll })
  }

  return (
    <div className="public-site" ref={rootRef}>
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
            <div className="public-trust-row" aria-label="Product principles"><span><AppIcon name="shield" size={16} /> Your data, your control</span><span><AppIcon name="status" size={16} /> Built for athletes 16+</span></div>
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
            <div className="public-section-heading public-reveal"><p className="eyebrow">How it works</p><h2>The training loop stays connected.</h2></div>
            <div className="public-flow-words" aria-hidden="true">{workflow.map((step) => <span className="public-flow-word" key={step.label}>{step.label}</span>)}</div>
            <div className="public-flow-viewport">
              <ol className="public-flow-track">
                {workflow.map((step, index) => <li className="public-flow-card app-surface" key={step.label}><span>{String(index + 1).padStart(2, '0')}</span><div className="public-flow-icon"><AppIcon name={step.icon} size={28} /></div><p className="eyebrow">{step.label}</p><h3>{step.title}</h3><p>{step.copy}</p></li>)}
              </ol>
            </div>
          </div>
        </section>

        <section className="public-product-story" id="features">
          <div className="public-product-pin">
            <div className="public-section-heading public-heading-split public-reveal"><div><p className="eyebrow">Athlete Reload workspace</p><h2>Prepare. Perform. Reload.</h2></div><p>Each stage uses the same product areas and terminology found inside the authenticated app.</p></div>
            <div className="public-product-layout">
              <div aria-label="Product workflow stages" className="product-stage-controls" role="tablist">
                {productStages.map((stage, index) => <button aria-controls={`product-stage-panel-${stage.id}`} aria-selected={activeStage === index} className={activeStage === index ? 'active' : ''} key={stage.id} onClick={() => selectStage(index)} role="tab" type="button"><span>0{index + 1}</span><strong>{stage.label}</strong><small>{stage.copy}</small></button>)}
              </div>
              <div className="product-stage-visual">
                <div className="product-stage-words" aria-hidden="true">{productStages.map((stage) => <span className="product-stage-word" key={stage.id}>{stage.label}</span>)}</div>
                {productStages.map((stage, index) => <div aria-hidden={activeStage !== index} className="product-stage-panel" id={`product-stage-panel-${stage.id}`} key={stage.id} role="tabpanel">{stage.screens.map((screen) => <article className="product-screen app-surface" key={screen.eyebrow}><span className="product-screen-icon"><AppIcon name={screen.icon} size={24} /></span><SectionHeading eyebrow={screen.eyebrow} title={screen.title} /><p>{screen.copy}</p></article>)}</div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="public-section public-safety" id="safety">
          <div className="public-reveal"><p className="eyebrow">Safety & privacy</p><h2>Built to support judgment, not replace it.</h2><p>Athlete Reload provides educational preparation and recovery guidance. It does not diagnose injuries or provide medical clearance.</p></div>
          <div className="public-safety-list public-reveal">
            <article><AppIcon name="shield" size={24} /><div><h3>Authenticated records</h3><p>Ownership controls protect athlete records, with export and account deletion available from Settings.</p></div></article>
            <article><AppIcon name="pain" size={24} /><div><h3>Clear stop conditions</h3><p>Concerning symptoms prompt the athlete to stop and involve an adult, athletic trainer, or qualified healthcare professional.</p></div></article>
            <article><AppIcon name="report" size={24} /><div><h3>Visible context</h3><p>Readiness and recovery reports identify the current factors used to shape their guidance.</p></div></article>
          </div>
          <div className="public-legal-actions"><button onClick={() => onOpenLegal('privacy')} type="button">Privacy Policy</button><button onClick={() => onOpenLegal('terms')} type="button">Terms of Service</button><button onClick={() => onOpenLegal('medical')} type="button">Medical Disclaimer</button></div>
        </section>

        <section className="public-section public-faq" id="faq">
          <div className="public-section-heading public-reveal"><p className="eyebrow">Questions, answered</p><h2>Start with the essentials.</h2></div>
          <div className="public-faq-list public-reveal">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<AppIcon name="plus" size={20} /></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="public-final-cta public-reveal"><p className="eyebrow">Your next session starts before the first rep</p><h2>Prepare with context. Recover with purpose.</h2><button className="primary-button" onClick={onCreateAccount} type="button">Create your free account <AppIcon name="arrow" size={20} /></button></section>
      </main>
    </div>
  )
}
