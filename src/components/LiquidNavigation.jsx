import { useEffect, useRef, useState } from 'react'
import { LensGlass, SVGFilters } from 'react-glassy'
import { getNavigationLensState } from '../lib/navigationGeometry'
import { AppIcon } from './AppIcon'

export function LiquidNavigation({ activeView, className = '', lockedView = null, motionPreference = 'full', onSelect, views }) {
  const [lens, setLens] = useState(null)
  const candidateRef = useRef(null)
  const navRef = useRef(null)
  const suppressClickRef = useRef(false)

  useEffect(() => () => window.clearTimeout(suppressClickRef.current), [])

  function measureLens(pointerX) {
    const nav = navRef.current
    if (!nav) return null

    const navRect = nav.getBoundingClientRect()
    const items = [...nav.querySelectorAll('button[data-view]')].map((button) => {
      const rect = button.getBoundingClientRect()
      return { height: rect.height, label: button.dataset.view, left: rect.left, width: rect.width }
    })
    const next = getNavigationLensState(navRect, items, pointerX)
    return lockedView && next?.activeLabel !== lockedView ? null : next
  }

  function updateLens(pointerX) {
    const next = measureLens(pointerX)
    if (!next) return
    candidateRef.current = next.activeLabel
    setLens(next)
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateLens(event.clientX)
    requestAnimationFrame(() => updateLens(event.clientX))
  }

  function handlePointerMove(event) {
    if (!lens || !event.currentTarget.hasPointerCapture?.(event.pointerId)) return
    updateLens(event.clientX)
  }

  function finishInteraction(event, commit) {
    if (!lens) return
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const selected = candidateRef.current
    candidateRef.current = null
    setLens(null)

    if (commit && selected) {
      suppressClickRef.current = window.setTimeout(() => { suppressClickRef.current = false }, 0)
      onSelect(selected)
    }
  }

  function handleClick(view) {
    if (suppressClickRef.current) return
    onSelect(view)
  }

  const visualView = lens?.activeLabel ?? activeView
  const reduced = motionPreference === 'reduced'

  return (
    <>
      <SVGFilters><SVGFilters.DefaultFilters /></SVGFilters>
      <nav
        aria-label="Primary views"
        className={`nav-tabs liquid-navigation ${lens ? 'is-interacting' : 'is-settled'} ${reduced ? 'motion-reduced' : 'motion-full'} ${className}`.trim()}
        onPointerCancel={(event) => finishInteraction(event, false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishInteraction(event, true)}
        ref={navRef}
      >
        {lens && (
          <div className="liquid-lens-shell" style={{ '--lens-left': `${lens.left}px`, '--lens-top': `${lens.top}px`, '--lens-height': `${lens.height}px`, '--lens-width': `${lens.width}px`, '--nav-width': `${lens.navWidth}px` }}>
            <LensGlass blur={2.2} brightness={1.06} chromaticAberration={1.4} className="liquid-lens" depth={12} height={lens.height} radius={999} saturate={1.2} strength={92} width={lens.width}>
              <div className="lens-refract" aria-hidden="true">
                {views.map((view) => <span className={visualView === view.label ? 'active' : ''} key={view.label}><AppIcon name={view.icon} size={24} /><em>{view.label}</em></span>)}
              </div>
            </LensGlass>
          </div>
        )}
        {views.map((view) => (
          <button aria-current={activeView === view.label ? 'page' : undefined} aria-label={view.label} className={visualView === view.label ? 'active' : ''} data-view={view.label} key={view.label} onClick={() => handleClick(view.label)} type="button">
            <AppIcon name={view.icon} size={24} />
            <span>{view.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
