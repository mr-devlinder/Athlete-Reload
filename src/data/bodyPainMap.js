export const bodyPainAreas = [
  { id: 'head', label: 'Head', recommendationLocation: 'Head', side: 'center', slug: 'head', view: 'front' },
  { id: 'neck', label: 'Neck', recommendationLocation: 'Neck', side: 'center', slug: 'neck', view: 'front' },
  { id: 'chest', label: 'Chest', recommendationLocation: 'Back', side: 'center', slug: 'chest', view: 'front' },
  { id: 'upper-back', label: 'Upper back', recommendationLocation: 'Back', side: 'center', slug: 'upper-back', view: 'back' },
  { id: 'lower-back', label: 'Lower back', recommendationLocation: 'Back', side: 'center', slug: 'lower-back', view: 'back' },
  { id: 'left-shoulder', label: 'Left shoulder', recommendationLocation: 'Shoulder', side: 'left', slug: 'deltoids', view: 'front' },
  { id: 'right-shoulder', label: 'Right shoulder', recommendationLocation: 'Shoulder', side: 'right', slug: 'deltoids', view: 'front' },
  { id: 'left-arm', label: 'Left arm', recommendationLocation: 'Shoulder', side: 'left', slug: 'biceps', view: 'front' },
  { id: 'right-arm', label: 'Right arm', recommendationLocation: 'Shoulder', side: 'right', slug: 'biceps', view: 'front' },
  { id: 'left-hand', label: 'Left hand', recommendationLocation: 'Shoulder', side: 'left', slug: 'hands', view: 'front' },
  { id: 'right-hand', label: 'Right hand', recommendationLocation: 'Shoulder', side: 'right', slug: 'hands', view: 'front' },
  { id: 'left-hip', label: 'Left hip', recommendationLocation: 'Hip', side: 'left', slug: 'gluteal', view: 'back' },
  { id: 'right-hip', label: 'Right hip', recommendationLocation: 'Hip', side: 'right', slug: 'gluteal', view: 'back' },
  { id: 'left-quad', label: 'Left quad', recommendationLocation: 'Quad', side: 'left', slug: 'quadriceps', view: 'front' },
  { id: 'right-quad', label: 'Right quad', recommendationLocation: 'Quad', side: 'right', slug: 'quadriceps', view: 'front' },
  { id: 'left-hamstring', label: 'Left hamstring', recommendationLocation: 'Hamstring', side: 'left', slug: 'hamstring', view: 'back' },
  { id: 'right-hamstring', label: 'Right hamstring', recommendationLocation: 'Hamstring', side: 'right', slug: 'hamstring', view: 'back' },
  { id: 'left-knee', label: 'Left knee', recommendationLocation: 'Knee', side: 'left', slug: 'knees', view: 'front' },
  { id: 'right-knee', label: 'Right knee', recommendationLocation: 'Knee', side: 'right', slug: 'knees', view: 'front' },
  { id: 'left-calf', label: 'Left calf', recommendationLocation: 'Calf', side: 'left', slug: 'calves', view: 'back' },
  { id: 'right-calf', label: 'Right calf', recommendationLocation: 'Calf', side: 'right', slug: 'calves', view: 'back' },
  { id: 'left-ankle', label: 'Left ankle', recommendationLocation: 'Ankle', side: 'left', slug: 'ankles', view: 'front' },
  { id: 'right-ankle', label: 'Right ankle', recommendationLocation: 'Ankle', side: 'right', slug: 'ankles', view: 'front' },
  { id: 'left-foot', label: 'Left foot', recommendationLocation: 'Ankle', side: 'left', slug: 'feet', view: 'front' },
  { id: 'right-foot', label: 'Right foot', recommendationLocation: 'Ankle', side: 'right', slug: 'feet', view: 'front' },
]

export function createEmptyPainMap() {
  return bodyPainAreas.reduce((map, area) => ({
    ...map,
    [area.id]: 0,
  }), {})
}

export function normalizePainMapScale(painMap = {}, primaryPain = 0) {
  const entries = Object.entries(painMap)
  const highestSeverity = Math.max(0, ...entries.map(([, value]) => Number(value) || 0))
  const visiblePain = Number(primaryPain) || 0
  const isLegacyScale = highestSeverity > 10 || (
    visiblePain > 0 &&
    visiblePain < 10 &&
    highestSeverity === visiblePain * 10
  )

  if (!isLegacyScale) return painMap

  return Object.fromEntries(entries.map(([area, value]) => [
    area,
    Math.max(0, Math.min(10, Math.round((Number(value) || 0) / 10))),
  ]))
}

export function getPrimaryPainArea(painMap = {}) {
  return bodyPainAreas
    .map((area) => ({
      ...area,
      severity: Number(painMap[area.id] ?? 0),
    }))
    .sort((first, second) => second.severity - first.severity)[0]
}

export function getPainReportsFromMap(painMap = {}, source = {}) {
  return bodyPainAreas
    .map((area) => {
      const details = source.painDetails?.[area.id] ?? {}
      return {
        bodyPart: area.label,
        date: source.date,
        movementEffect: normalizeMovementEffect(details.movementEffect),
        notes: source.notes ?? '',
        onset: normalizePainOnset(details.onset),
        relatedEventId: source.relatedEventId ?? null,
        severity: Number(painMap[area.id] ?? 0),
        side: area.side,
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        trend: normalizePainTrend(details.painTrend),
        triggerMovement: details.hurtsWhen ?? source.triggerMovement ?? '',
      }
    })
    .filter((report) => report.severity > 0)
}

function normalizePainOnset(value) {
  if (value === 'Today') return 'today'
  if (value === 'In the past few days') return 'recent'
  if (value === 'Ongoing') return 'ongoing'
  return null
}

function normalizePainTrend(value) {
  if (value === 'Improving') return 'improving'
  if (value === 'Worsening') return 'worsening'
  if (value === 'Unchanged') return 'same'
  return null
}

function normalizeMovementEffect(value) {
  if (value === 'No effect') return 'none'
  if (value === 'Noticeable, but I can move') return 'noticeable'
  if (value === 'Limits how I move') return 'limits'
  if (value === 'I cannot perform the movement') return 'cannot_perform'
  return null
}

export function getPainReportsWithResolutions(painMap = {}, source = {}, previousReports = []) {
  const currentReports = getPainReportsFromMap(painMap, source)
  const currentKeys = new Set(currentReports.map((report) => getPainReportKey(report)))
  const latestByArea = new Map()

  previousReports.forEach((report) => {
    const key = getPainReportKey(report)
    const current = latestByArea.get(key)
    const reportTime = `${report.date ?? ''}:${report.createdAt ?? ''}`
    const currentTime = `${current?.date ?? ''}:${current?.createdAt ?? ''}`

    if (!current || reportTime > currentTime) latestByArea.set(key, report)
  })

  const resolvedReports = [...latestByArea.values()]
    .filter((report) => Number(report.severity) > 0 && !currentKeys.has(getPainReportKey(report)))
    .map((report) => ({
      bodyPart: report.bodyPart,
      date: source.date,
      notes: 'Reported pain-free at follow-up.',
      severity: 0,
      side: report.side ?? 'center',
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      triggerMovement: '',
    }))

  return [...currentReports, ...resolvedReports]
}

function getPainReportKey(report) {
  return `${String(report.bodyPart).toLowerCase()}:${report.side ?? 'center'}`
}
