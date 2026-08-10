export function hasNavigationDragStarted(startX, currentX, threshold = 6) {
  return Math.abs(currentX - startX) >= threshold
}

export function getNearestNavigationItem(items, pointerX) {
  if (!items.length) return null

  return items.reduce((nearest, item) => {
    const center = item.left + item.width / 2
    const distance = Math.abs(pointerX - center)
    return !nearest || distance < nearest.distance ? { ...item, distance } : nearest
  }, null)
}

export function getNavigationLensState(navRect, items, pointerX) {
  const nearest = getNearestNavigationItem(items, pointerX)
  if (!nearest) return null

  return {
    activeLabel: nearest.label,
    height: nearest.height,
    left: nearest.left - navRect.left + nearest.width / 2,
    top: navRect.height / 2,
    width: nearest.width,
    navWidth: navRect.width,
  }
}

export function getNavigationDragLensState(navRect, items, pointerX, lensSize = null) {
  const nearest = getNearestNavigationItem(items, pointerX)
  if (!nearest) return null

  const width = lensSize?.width ?? nearest.width
  const height = lensSize?.height ?? nearest.height
  const halfWidth = width / 2
  const relativeX = pointerX - navRect.left
  return {
    activeLabel: nearest.label,
    height,
    left: Math.max(halfWidth, Math.min(relativeX, navRect.width - halfWidth)),
    top: navRect.height / 2,
    width,
    navWidth: navRect.width,
  }
}
