import { useEffect, useRef, useState } from 'react'
import { m, useReducedMotion, useScroll, useTransform } from 'motion/react'
import appLogo from '../assets/athlete-reload-logo-transparent.png'

const faqs = [
  ['Who is Athlete Reload for?', 'Athlete Reload is designed for athletes age 16 and older across individual and team sports.'],
  ['Is Athlete Reload free?', 'Yes. Athlete Reload is currently free to use, with no subscription required.'],
  ['Does it replace a coach, trainer, or clinician?', 'No. It supports preparation and recovery decisions but never diagnoses injuries or provides medical clearance.'],
  ['What happens to my data?', 'Your account includes privacy controls, export, shared-report history, and account deletion.'],
]

export function LandingPage({ onCreateAccount, onOpenLegal, onSignIn, returningFromAuth = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef(null)
  const systemRef = useRef(null)
  const productRef = useRef(null)
  const recoveryRef = useRef(null)
  const footerRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const { scrollYProgress: systemProgress } = useScroll({ target: systemRef, offset: ['start end', 'end start'] })
  const { scrollYProgress: productProgress } = useScroll({ target: productRef, offset: ['start end', 'end start'] })
  const { scrollYProgress: recoveryProgress } = useScroll({ target: recoveryRef, offset: ['start end', 'end start'] })
  const { scrollYProgress: footerProgress } = useScroll({ target: footerRef, offset: ['start end', 'end end'] })
  const heroCopyY = useTransform(heroProgress, [0, 1], [0, 150])
  const heroVisualY = useTransform(heroProgress, [0, 1], [0, -110])
  const heroVisualScale = useTransform(heroProgress, [0, 1], [1, .92])
  const heroFade = useTransform(heroProgress, [0, .8], [1, .18])
  const systemX = useTransform(systemProgress, [0, .5, 1], [-70, 0, 70])
  const systemRotate = useTransform(systemProgress, [0, .5, 1], [-1.5, 0, 1.5])
  const productScale = useTransform(productProgress, [0, .45, 1], [.88, 1, .96])
  const productY = useTransform(productProgress, [0, .5, 1], [120, 0, -70])
  const recoveryY = useTransform(recoveryProgress, [0, .5, 1], [110, 0, -45])
  const recoveryRotate = useTransform(recoveryProgress, [0, .5, 1], [2.5, 0, -1.5])
  const recoveryCopyY = useTransform(recoveryProgress, [0, .5, 1], [-55, 0, 35])
  const productRotateX = useTransform(productProgress, [0, .45, 1], [8, 0, -3])
  const productBoundaryScale = useTransform(productProgress, [0, .28], [.15, 1])
  const footerY = useTransform(footerProgress, [0, .72], [90, 0])
  const footerScale = useTransform(footerProgress, [0, .72], [.94, 1])

  useEffect(() => {
    if (!returningFromAuth) window.scrollTo({ top: 0 })
  }, [returningFromAuth])

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24)
    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    return () => window.removeEventListener('scroll', updateHeader)
  }, [])

  function navigate(event, id) {
    event.preventDefault()
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="public-site">
      <a className="skip-link" href="#public-main">Skip to content</a>
      <header className={`public-header${scrolled ? ' is-scrolled' : ''}`}>
        <a className="public-brand" href="#public-main" onClick={(event) => navigate(event, 'public-main')}>
          <img alt="" src={appLogo} />
          <span>Athlete Reload</span>
        </a>
        <button aria-expanded={menuOpen} aria-label="Toggle navigation" className="public-menu-button" onClick={() => setMenuOpen((open) => !open)} type="button">Menu</button>
        <nav aria-label="Public navigation" className={menuOpen ? 'public-navigation is-open' : 'public-navigation'}>
          <a href="#system" onClick={(event) => navigate(event, 'system')}>The system</a>
          <a href="#product" onClick={(event) => navigate(event, 'product')}>Product</a>
          <a href="#principles" onClick={(event) => navigate(event, 'principles')}>Principles</a>
        </nav>
        <div className="public-header-actions">
          <button className="public-signin" onClick={onSignIn} type="button">Sign in</button>
          <button className="primary-button" onClick={onCreateAccount} type="button">Start free</button>
        </div>
      </header>

      <main id="public-main">
        <section className="public-hero" ref={heroRef}>
          <m.div className="hero-grid" aria-hidden="true" style={reduceMotion ? undefined : { x: heroVisualY }} />
          <div aria-hidden="true" className="hero-scan" />
          <m.div className="public-hero-copy" style={reduceMotion ? undefined : { opacity: heroFade, y: heroCopyY }}>
            <h1>
              <span className="hero-line-mask"><m.span animate={reduceMotion ? undefined : { y: '0%' }} initial={reduceMotion ? undefined : { y: '115%' }} transition={{ duration: .85, ease: [.22, 1, .36, 1] }}>Your training.</m.span></span>
              <span className="hero-line-mask"><m.span animate={reduceMotion ? undefined : { y: '0%' }} initial={reduceMotion ? undefined : { y: '115%' }} transition={{ delay: .09, duration: .9, ease: [.22, 1, .36, 1] }}>One clear signal.</m.span></span>
            </h1>
            <p>Readiness, workload, nutrition, pain, and recovery—connected to the session that actually happened.</p>
            <div className="public-hero-actions">
              <button className="primary-button" onClick={onCreateAccount} type="button">Create your account</button>
              <button className="hero-text-action" onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })} type="button">Explore the product <span aria-hidden="true">↘</span></button>
            </div>
          </m.div>

          <m.div animate={reduceMotion ? undefined : { opacity: 1, rotateX: 0 }} className="hero-performance" initial={reduceMotion ? undefined : { opacity: 0, rotateX: 9 }} style={reduceMotion ? undefined : { scale: heroVisualScale, y: heroVisualY }} transition={{ delay: .3, duration: 1.05, ease: [.22, 1, .36, 1] }}>
            <div className="hero-performance-top"><span>Tuesday · Training day</span><strong>Live athlete view</strong></div>
            <div className="hero-readiness">
              <div><strong>82</strong><span>Ready with adjustments</span></div>
              <p>Lower-body soreness is elevated. Keep quality high and reduce repeated sprint volume.</p>
            </div>
            <div className="hero-signal-line">{['82%', '68%', '54%', '76%'].map((signal, index) => <m.span animate={reduceMotion ? undefined : { scaleX: 1 }} initial={reduceMotion ? undefined : { scaleX: 0 }} key={signal} style={{ '--signal': signal }} transition={{ delay: .75 + index * .1, duration: .75, ease: [.22, 1, .36, 1] }} />)}</div>
            <div className="hero-session-row"><span>Next session</span><strong>Team training · 5:30 PM</strong><em>75 min</em></div>
          </m.div>
          <div className="hero-wordmark" aria-hidden="true">RELOAD</div>
        </section>

        <section className="public-system" id="system" ref={systemRef}>
          <m.div className="system-intro" initial={reduceMotion ? undefined : { opacity: 0, y: 60 }} transition={{ duration: .8, ease: [.22, 1, .36, 1] }} viewport={{ amount: .35, once: true }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}>
            <h2>A continuous performance loop.</h2>
            <p>The useful decision is never a score by itself. Athlete Reload connects what was planned, what your body reported, and what should happen next.</p>
          </m.div>
          <m.div className="system-sequence" style={reduceMotion ? undefined : { rotate: systemRotate, x: systemX }}>
            <article className="system-step prepare"><div><strong>Prepare</strong><span>Before the session</span></div><p>Readiness is measured against today’s actual training demand.</p><b>08:10</b></article>
            <article className="system-step record"><div><strong>Record</strong><span>After the work</span></div><p>Participation, workload, soreness, fatigue, and pain stay attached to the event.</p><b>18:46</b></article>
            <article className="system-step respond"><div><strong>Respond</strong><span>Before what comes next</span></div><p>Recovery and fueling recommendations reflect completed work and available time.</p><b>Next</b></article>
          </m.div>
        </section>

        <section className="public-product" id="product" ref={productRef}>
          <m.div className="product-boundary" aria-hidden="true" style={reduceMotion ? undefined : { scaleX: productBoundaryScale }} />
          <m.div className="product-copy" initial={reduceMotion ? undefined : { opacity: 0, x: -70 }} transition={{ duration: .9, ease: [.22, 1, .36, 1] }} viewport={{ amount: .4, once: true }} whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}>
            <h2>The day, organized around action.</h2>
            <p>Everything important is visible in one working view: what needs attention, what happens next, and the trend behind the decision.</p>
          </m.div>
          <m.div className="product-dashboard" aria-label="Athlete Reload dashboard preview" style={reduceMotion ? undefined : { rotateX: productRotateX, scale: productScale, y: productY }}>
            <aside><img alt="" src={appLogo} /><i /><i /><i /><i /></aside>
            <div className="product-dashboard-main">
              <header><div><span>Home</span><strong>Tuesday, August 11</strong></div></header>
              <div className="product-readiness"><div><span>Readiness</span><strong>82</strong><em>Good to train</em></div><p>Keep today’s quality work. Adjust repeated sprint volume if soreness increases.</p></div>
              <div className="product-day">
                <article><span>Today</span><strong>Team training</strong><p>5:30 PM · 75 minutes</p><button type="button" tabIndex={-1}>Check in</button></article>
                <article><span>Last seven days</span><strong>Load is stable</strong><div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /></div></article>
              </div>
            </div>
          </m.div>
        </section>

        <section className="public-recovery-story" ref={recoveryRef}>
          <m.div className="recovery-statement" style={reduceMotion ? undefined : { y: recoveryCopyY }}><h2>Recovery follows the work.</h2><p>Not a generic checklist. A direct response to the session, your reported pain, the time available, and tomorrow’s demand.</p></m.div>
          <m.div className="recovery-plan-preview" style={reduceMotion ? undefined : { rotate: recoveryRotate, y: recoveryY }}>
            <div><span>Completed</span><strong>Gym session</strong><p>75 min · Full participation · 6/10 effort</p></div>
            <ol><li><span>8 min</span><strong>Downshift and restore range</strong></li><li><span>12 min</span><strong>Lower-body recovery sequence</strong></li><li><span>Now</span><strong>Refuel and rehydrate</strong></li></ol>
          </m.div>
        </section>

        <section className="public-principles" id="principles">
          <div><h2>Useful by design.</h2><p>Athlete Reload supports athlete judgment. It does not replace coaches, athletic trainers, or healthcare professionals.</p></div>
          <div className="principle-statements"><p><strong>Context over noise.</strong> The interface prioritizes the next decision instead of filling the screen with disconnected metrics.</p><p><strong>Safety remains visible.</strong> Concerning symptoms and pain changes direct athletes toward qualified support.</p><p><strong>Your record stays yours.</strong> Export, privacy controls, share history, and deletion are available from Settings.</p></div>
        </section>

        <section className="public-faq">
          <h2>Questions, answered.</h2>
          <div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        </section>
      </main>

      <footer className="public-footer" ref={footerRef}>
        <m.div className="footer-cta" style={reduceMotion ? undefined : { scale: footerScale, y: footerY }}><h2>Make the next session a better decision.</h2><button className="primary-button" onClick={onCreateAccount} type="button">Start free</button></m.div>
        <div className="public-footer-meta"><span>© {new Date().getFullYear()} Athlete Reload · Developed by Lucas Linder</span><button onClick={() => onOpenLegal?.('privacy')} type="button">Privacy</button><button onClick={() => onOpenLegal?.('terms')} type="button">Terms</button><button onClick={() => onOpenLegal?.('medical')} type="button">Medical disclaimer</button></div>
      </footer>
    </div>
  )
}
