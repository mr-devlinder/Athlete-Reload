import { useEffect, useRef, useState } from 'react'
import { GlassButton, GlassCard } from 'react-glass-ui'
import { getNavigationDragLensState, getNavigationLensState, hasNavigationDragStarted } from '../lib/navigationGeometry'
import { AppIcon } from './AppIcon'

const DRAG_THRESHOLD = 6
const HOLD_DELAY = 140

export function LiquidNavigation({ activeView, className = '', lockedView = null, motionPreference = 'full', onSelect, views }) {
  const [lens, setLens] = useState(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [supportsGlassFilter, setSupportsGlassFilter] = useState(true)
  const candidateRef = useRef(activeView)
  const dragRef = useRef(false)
  const frameRef = useRef(null)
  const geometryRef = useRef(null)
  const holdTimerRef = useRef(null)
  const interactionRef = useRef(false)
  const lensShellRef = useRef(null)
  const navRef = useRef(null)
  const pendingLensRef = useRef(null)
  const pointerStartRef = useRef(null)
  const pointerOwnerRef = useRef(null)
  const suppressResetRef = useRef(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const coarseQuery = window.matchMedia('(pointer: coarse)')
    const updatePointerMode = () => setIsCoarsePointer(coarseQuery.matches)
    updatePointerMode()
    setSupportsGlassFilter(Boolean(window.CSS?.supports?.('filter', 'url("#athlete-navigation-lens-filter")')))
    coarseQuery.addEventListener?.('change', updatePointerMode)

    return () => {
      coarseQuery.removeEventListener?.('change', updatePointerMode)
      window.clearTimeout(holdTimerRef.current)
      window.clearTimeout(suppressResetRef.current)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  function measureNavigation() {
    const nav = navRef.current
    if (!nav) return null

    const navRect = nav.getBoundingClientRect()
    const items = [...nav.querySelectorAll('button[data-view]')].map((button) => {
      const rect = button.getBoundingClientRect()
      return { height: rect.height, label: button.dataset.view, left: rect.left, width: rect.width }
    })
    return { items, navRect }
  }

  function positionLens(next) {
    pendingLensRef.current = next
    if (frameRef.current) return

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const current = pendingLensRef.current
      const shell = lensShellRef.current
      if (!current || !shell) return
      shell.style.width = `${current.width}px`
      shell.style.height = `${current.height}px`
      const shellLeft = current.left - current.width / 2
      shell.style.setProperty('--liquid-lens-offset', `${-shellLeft}px`)
      shell.style.transform = `translate3d(${shellLeft}px, ${current.top - current.height / 2}px, 0)`
    })
  }

  function updateLens(pointerX, force = false) {
    const geometry = geometryRef.current
    if (!geometry) return
    const next = getNavigationDragLensState(geometry.navRect, geometry.items, pointerX)
    if (!next || (lockedView && next.activeLabel !== lockedView)) return

    const crossedIntoNewItem = candidateRef.current !== next.activeLabel
    candidateRef.current = next.activeLabel
    positionLens(next)
    if (force || crossedIntoNewItem) setLens(next)
  }

  useEffect(() => {
    const nav = navRef.current
    if (!nav || interactionRef.current) return undefined

    let resizeFrame = null
    function alignWithActiveView() {
      const geometry = measureNavigation()
      const activeItem = geometry?.items.find((item) => item.label === (lockedView ?? activeView))
      if (!geometry || !activeItem) return
      const next = getNavigationLensState(geometry.navRect, geometry.items, activeItem.left + activeItem.width / 2)
      candidateRef.current = next.activeLabel
      setLens(next)
      positionLens(next)
    }

    function scheduleAlignment() {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(alignWithActiveView)
    }

    scheduleAlignment()
    const observer = new ResizeObserver(scheduleAlignment)
    observer.observe(nav)
    document.fonts?.ready?.then(scheduleAlignment)
    return () => {
      observer.disconnect()
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
    }
  }, [activeView, lockedView, views])

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const owner = event.target.closest?.('button[data-view]')
    if (!owner) return
    geometryRef.current = measureNavigation()
    if (!geometryRef.current) return
    interactionRef.current = true
    dragRef.current = false
    pointerOwnerRef.current = owner
    pointerStartRef.current = { pointerId: event.pointerId, x: event.clientX }
    const initial = getNavigationLensState(geometryRef.current.navRect, geometryRef.current.items, event.clientX)
    if (initial && (!lockedView || initial.activeLabel === lockedView)) candidateRef.current = initial.activeLabel
    owner.setPointerCapture?.(event.pointerId)
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = window.setTimeout(() => {
      if (!interactionRef.current || dragRef.current) return
      dragRef.current = true
      suppressClickRef.current = true
      setIsInteracting(true)
      updateLens(pointerStartRef.current?.x ?? event.clientX, true)
    }, HOLD_DELAY)
  }

  function handlePointerMove(event) {
    const owner = pointerOwnerRef.current
    if (!interactionRef.current || !owner?.hasPointerCapture?.(event.pointerId)) return
    if (!dragRef.current) {
      const start = pointerStartRef.current
      if (!start || start.pointerId !== event.pointerId || !hasNavigationDragStarted(start.x, event.clientX, DRAG_THRESHOLD)) return
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      dragRef.current = true
      suppressClickRef.current = true
      setIsInteracting(true)
      updateLens(event.clientX, true)
      return
    }
    event.preventDefault()
    updateLens(event.clientX)
  }

  function finishInteraction(event, commit) {
    if (!interactionRef.current) return
    const owner = pointerOwnerRef.current
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
    if (owner?.hasPointerCapture?.(event.pointerId)) owner.releasePointerCapture(event.pointerId)
    const selected = candidateRef.current
    const wasDragging = dragRef.current
    interactionRef.current = false
    dragRef.current = false
    setIsInteracting(false)
    setLens(null)
    geometryRef.current = null
    pendingLensRef.current = null
    pointerStartRef.current = null
    pointerOwnerRef.current = null

    if (commit && wasDragging && selected) {
      onSelect(selected)
      suppressResetRef.current = window.setTimeout(() => { suppressClickRef.current = false }, 0)
    } else if (!wasDragging) {
      suppressClickRef.current = false
    } else {
      suppressResetRef.current = window.setTimeout(() => { suppressClickRef.current = false }, 0)
    }
  }

  function handleClick(view) {
    if (suppressClickRef.current) return
    onSelect(view)
  }

  const visualView = isInteracting && lens ? lens.activeLabel : activeView
  const reduced = motionPreference === 'reduced'
  const useGlass = supportsGlassFilter
  const surfaceSettings = isCoarsePointer
    ? { blur: 2, brightness: 104, chromaticAberration: 1.8, distortion: 24, saturation: 114 }
    : { blur: 2.5, brightness: 106, chromaticAberration: 2.8, distortion: 36, saturation: 120 }
  const glassSettings = isCoarsePointer
    ? { blur: 1.75, brightness: 109, chromaticAberration: 6, distortion: 48, saturation: 132 }
    : { blur: 2, brightness: 112, chromaticAberration: 8, distortion: 68, saturation: 142 }

  return (
    <nav
      aria-label="Primary views"
      className={`nav-tabs liquid-navigation ${isInteracting ? 'is-interacting' : 'is-settled'} ${reduced ? 'motion-reduced' : 'motion-full'} ${className}`.trim()}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerCancel={(event) => finishInteraction(event, false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishInteraction(event, true)}
      ref={navRef}
    >
      <GlassCard
        avoidSvgCreation={!useGlass}
        backgroundColor="#ffffff"
        backgroundOpacity={0.1}
        blur={useGlass ? surfaceSettings.blur : 0}
        borderColor="#ffffff"
        borderOpacity={0.72}
        borderRadius={999}
        borderSize={1}
        brightness={useGlass ? surfaceSettings.brightness : 100}
        chromaticAberration={useGlass ? surfaceSettings.chromaticAberration : 0}
        className="liquid-navigation-surface"
        distortion={useGlass ? surfaceSettings.distortion : 0}
        flexibility={0}
        id="athlete-navigation-surface"
        innerLightBlur={12}
        innerLightColor="#ffffff"
        innerLightOpacity={0.58}
        innerLightSpread={0}
        outerLightBlur={22}
        outerLightColor="#171b22"
        outerLightOpacity={0.15}
        outerLightSpread={0}
        padding="0"
        saturation={useGlass ? surfaceSettings.saturation : 100}
      />
      {isInteracting && lens && (
        <div
          className={`liquid-lens-shell ${useGlass ? '' : 'liquid-lens-fallback'}`.trim()}
          ref={lensShellRef}
          style={{ '--liquid-lens-offset': `${-(lens.left - lens.width / 2)}px`, height: `${lens.height}px`, transform: `translate3d(${lens.left - lens.width / 2}px, ${lens.top - lens.height / 2}px, 0)`, width: `${lens.width}px` }}
        >
          {useGlass ? (
            <GlassButton
              backgroundColor="#ffffff"
              backgroundOpacity={0.045}
              blur={glassSettings.blur}
              borderColor="#ffffff"
              borderOpacity={0.84}
              borderRadius={999}
              borderSize={1}
              brightness={glassSettings.brightness}
              chromaticAberration={glassSettings.chromaticAberration}
              className="liquid-lens"
              contentClassName="liquid-lens-content"
              distortion={glassSettings.distortion}
              flexibility={10}
              height={lens.height}
              id="athlete-navigation-lens"
              innerLightBlur={10}
              innerLightColor="#ffffff"
              innerLightOpacity={0.62}
              innerLightSpread={0}
              onHoverScale={1.015}
              outerLightBlur={18}
              outerLightColor="#171b22"
              outerLightOpacity={0.2}
              outerLightSpread={0}
              padding="0"
              saturation={glassSettings.saturation}
              width={lens.width}
              zIndex={1}
            >
              <div className="liquid-lens-refraction" style={{ width: `${geometryRef.current?.navRect.width ?? lens.navWidth}px` }}>
                {geometryRef.current?.items.map((item) => {
                  const view = views.find((entry) => entry.label === item.label)
                  if (!view) return null
                  return (
                    <div className="liquid-lens-refraction-item" key={item.label} style={{ height: `${item.height}px`, left: `${item.left - geometryRef.current.navRect.left}px`, top: `${(geometryRef.current.navRect.height - item.height) / 2}px`, width: `${item.width}px` }}>
                      <AppIcon name={view.icon} size={24} />
                      <span>{view.label}</span>
                    </div>
                  )
                })}
              </div>
            </GlassButton>
          ) : <div className="liquid-lens-static" />}
        </div>
      )}
      {views.map((view) => (
        <button aria-current={activeView === view.label ? 'page' : undefined} aria-label={view.label} className={visualView === view.label ? 'active' : ''} data-view={view.label} key={view.label} onClick={() => handleClick(view.label)} type="button">
          <AppIcon name={view.icon} size={24} />
          <span>{view.label}</span>
        </button>
      ))}
    </nav>
  )
}
