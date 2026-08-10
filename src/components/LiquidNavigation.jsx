import { useEffect, useRef, useState } from 'react'
import { GlassCard } from 'react-glass-ui'
import { getNavigationDragLensState, getNavigationLensState, hasNavigationDragStarted } from '../lib/navigationGeometry'
import { AppIcon } from './AppIcon'

const DRAG_THRESHOLD = 6
const HOLD_DELAY = 140
const CLICK_FEEDBACK_DELAY = 420
const CLICK_LAYOUT_TRACK_DURATION = 240

export function LiquidNavigation({ activeView, className = '', lockedView = null, motionPreference = 'full', onSelect, views }) {
  const [lens, setLens] = useState(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const [isDraggingVisual, setIsDraggingVisual] = useState(false)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [supportsGlassFilter, setSupportsGlassFilter] = useState(true)
  const candidateRef = useRef(activeView)
  const clickFeedbackFrameRef = useRef(null)
  const clickFeedbackTimerRef = useRef(null)
  const dragRef = useRef(false)
  const frameRef = useRef(null)
  const geometryRef = useRef(null)
  const holdTimerRef = useRef(null)
  const interactionRef = useRef(false)
  const navRef = useRef(null)
  const pendingLensRef = useRef(null)
  const pendingClickViewRef = useRef(null)
  const pointerStartRef = useRef(null)
  const pointerOwnerRef = useRef(null)
  const suppressResetRef = useRef(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const coarseQuery = window.matchMedia('(pointer: coarse)')
    const updatePointerMode = () => setIsCoarsePointer(coarseQuery.matches)
    updatePointerMode()
    const supportsBackdrop = window.CSS?.supports?.('backdrop-filter', 'blur(1px)') || window.CSS?.supports?.('-webkit-backdrop-filter', 'blur(1px)')
    setSupportsGlassFilter(Boolean(supportsBackdrop))
    coarseQuery.addEventListener?.('change', updatePointerMode)

    return () => {
      coarseQuery.removeEventListener?.('change', updatePointerMode)
      if (clickFeedbackFrameRef.current) window.cancelAnimationFrame(clickFeedbackFrameRef.current)
      window.clearTimeout(clickFeedbackTimerRef.current)
      window.clearTimeout(holdTimerRef.current)
      window.clearTimeout(suppressResetRef.current)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      const owner = pointerOwnerRef.current
      const pointerId = pointerStartRef.current?.pointerId
      if (pointerId !== undefined && owner?.hasPointerCapture?.(pointerId)) owner.releasePointerCapture(pointerId)
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
    const navStyle = window.getComputedStyle(nav)
    const horizontalPadding = (Number.parseFloat(navStyle.paddingLeft) || 0) + (Number.parseFloat(navStyle.paddingRight) || 0)
    const itemGap = Number.parseFloat(navStyle.columnGap) || 0
    const collapsedWidth = (navRect.width - horizontalPadding - itemGap * Math.max(0, items.length - 1)) / Math.max(1, items.length)
    const lensSize = {
      height: Math.max(...items.map((item) => item.height)),
      width: Math.max(...items.map((item) => item.width)),
    }
    const collapsedLensSize = { height: lensSize.height, width: collapsedWidth }
    return { collapsedLensSize, items, lensSize, navRect }
  }

  function writeLensPosition(current) {
    const nav = navRef.current
    if (!current || !nav) return
    nav.style.setProperty('--liquid-lens-x', `${current.left - current.width / 2}px`)
    nav.style.setProperty('--liquid-lens-y', `${current.top - current.height / 2}px`)
    nav.style.setProperty('--liquid-lens-width', `${current.width}px`)
    nav.style.setProperty('--liquid-lens-height', `${current.height}px`)
  }

  function positionLens(next, immediate = false) {
    pendingLensRef.current = next
    if (immediate) {
      writeLensPosition(next)
      return
    }
    if (frameRef.current) return

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      writeLensPosition(pendingLensRef.current)
    })
  }

  function updateLens(pointerX, force = false) {
    const geometry = geometryRef.current
    if (!geometry) return
    const dragLensSize = isCoarsePointer ? geometry.collapsedLensSize : geometry.lensSize
    const next = getNavigationDragLensState(geometry.navRect, geometry.items, pointerX, dragLensSize)
    if (!next || (lockedView && next.activeLabel !== lockedView)) return

    const crossedIntoNewItem = candidateRef.current !== next.activeLabel
    candidateRef.current = next.activeLabel
    positionLens(next, force)
    if (force || crossedIntoNewItem) setLens(next)
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const owner = event.target.closest?.('button[data-view]')
    if (!owner) return
    if (clickFeedbackFrameRef.current) window.cancelAnimationFrame(clickFeedbackFrameRef.current)
    clickFeedbackFrameRef.current = null
    pendingClickViewRef.current = null
    window.clearTimeout(clickFeedbackTimerRef.current)
    clickFeedbackTimerRef.current = null
    geometryRef.current = measureNavigation()
    if (!geometryRef.current) return
    interactionRef.current = true
    dragRef.current = false
    pointerOwnerRef.current = owner
    pointerStartRef.current = { pointerId: event.pointerId, x: event.clientX }
    candidateRef.current = owner.dataset.view
    owner.setPointerCapture?.(event.pointerId)
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = window.setTimeout(() => {
      if (!interactionRef.current || dragRef.current) return
      dragRef.current = true
      suppressClickRef.current = true
      setIsInteracting(true)
      setIsDraggingVisual(true)
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
      setIsDraggingVisual(true)
      updateLens(event.clientX, true)
      return
    }
    event.preventDefault()
    updateLens(event.clientX)
  }

  function finishInteraction(event, commit) {
    if (!interactionRef.current) return
    if (pointerStartRef.current?.pointerId !== event.pointerId) return
    const owner = pointerOwnerRef.current
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
    if (owner?.hasPointerCapture?.(event.pointerId)) owner.releasePointerCapture(event.pointerId)
    const selected = candidateRef.current
    const wasDragging = dragRef.current
    interactionRef.current = false
    dragRef.current = false
    setIsInteracting(false)
    setIsDraggingVisual(false)
    setLens(null)
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
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

  function measureClickLens(view, useItemSize = false) {
    const geometry = measureNavigation()
    const item = geometry?.items.find((entry) => entry.label === view)
    if (!geometry || !item) return null
    const centered = getNavigationLensState(geometry.navRect, geometry.items, item.left + item.width / 2)
    if (!centered) return null
    const clickLensSize = useItemSize ? { height: item.height, width: item.width } : geometry.lensSize
    return { ...centered, ...clickLensSize }
  }

  function startClickFeedback(view, next) {
    if (!next) return
    candidateRef.current = view
    writeLensPosition(next)
    setLens(next)
    setIsInteracting(true)
    setIsDraggingVisual(false)
    window.clearTimeout(clickFeedbackTimerRef.current)
    clickFeedbackTimerRef.current = window.setTimeout(() => {
      setIsInteracting(false)
      setLens(null)
      clickFeedbackTimerRef.current = null
    }, CLICK_FEEDBACK_DELAY)
  }

  function showClickFeedback(view, useItemSize = false) {
    startClickFeedback(view, measureClickLens(view, useItemSize))
  }

  function handleClick(view) {
    if (suppressClickRef.current) return
    onSelect(view)
    if (!isCoarsePointer) {
      showClickFeedback(view)
      return
    }
    if (view !== activeView) {
      pendingClickViewRef.current = view
      showClickFeedback(view, true)
      return
    }
    showClickFeedback(view, true)
  }

  useEffect(() => {
    if (!isCoarsePointer || pendingClickViewRef.current !== activeView) return undefined
    const view = pendingClickViewRef.current
    pendingClickViewRef.current = null
    if (clickFeedbackFrameRef.current) window.cancelAnimationFrame(clickFeedbackFrameRef.current)
    const startedAt = window.performance.now()
    const trackExpandedTab = (timestamp) => {
      writeLensPosition(measureClickLens(view, true))
      if (timestamp - startedAt < CLICK_LAYOUT_TRACK_DURATION) {
        clickFeedbackFrameRef.current = window.requestAnimationFrame(trackExpandedTab)
      } else {
        clickFeedbackFrameRef.current = null
      }
    }
    clickFeedbackFrameRef.current = window.requestAnimationFrame(trackExpandedTab)
    return () => {
      if (clickFeedbackFrameRef.current) window.cancelAnimationFrame(clickFeedbackFrameRef.current)
      clickFeedbackFrameRef.current = null
    }
  }, [activeView, isCoarsePointer])

  const visualView = isInteracting && lens ? lens.activeLabel : activeView
  const reduced = motionPreference === 'reduced'
  const useGlass = supportsGlassFilter
  const surfaceSettings = isCoarsePointer
    ? { blur: 2, brightness: 104, chromaticAberration: 1.8, distortion: 24, saturation: 114 }
    : { blur: 2.5, brightness: 106, chromaticAberration: 2.8, distortion: 36, saturation: 120 }
  const glassSettings = isCoarsePointer
    ? { blur: 2.5, brightness: 105, chromaticAberration: 4.5, distortion: 55, saturation: 118 }
    : { blur: 2, brightness: 103, chromaticAberration: 1.5, distortion: 40, saturation: 108 }

  return (
    <nav
      aria-label="Primary views"
      className={`nav-tabs liquid-navigation ${isInteracting ? 'is-interacting' : ''} ${isDraggingVisual ? 'is-dragging' : 'is-settled'} ${reduced ? 'motion-reduced' : 'motion-full'} ${className}`.trim()}
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
        useGlass ? (
          <GlassCard
            backgroundColor="#ffffff"
            backgroundOpacity={0.04}
            blur={glassSettings.blur}
            borderColor="#ffffff"
            borderOpacity={0.4}
            borderRadius={999}
            borderSize={1}
            brightness={glassSettings.brightness}
            chromaticAberration={glassSettings.chromaticAberration}
            className="liquid-drag-lens"
            distortion={glassSettings.distortion}
            flexibility={0}
            height={lens.height}
            id="athlete-navigation-lens"
            innerLightBlur={10}
            innerLightColor="#ffffff"
            innerLightOpacity={0.16}
            innerLightSpread={1}
            onHoverScale={1}
            outerLightBlur={12}
            outerLightColor="#ffffff"
            outerLightOpacity={0.1}
            outerLightSpread={0}
            padding="0"
            saturation={glassSettings.saturation}
            width={lens.width}
            zIndex={3}
          />
        ) : <div className="liquid-drag-lens liquid-lens-static" />
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
