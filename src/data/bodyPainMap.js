export const bodyPainAreas = [
  { id: 'head', label: 'Head', recommendationLocation: 'Head', side: 'center', labelPoint: [112, 34], path: 'M93 35c0-23 38-23 38 0 0 24-7 39-19 39S93 59 93 35Z' },
  { id: 'neck', label: 'Neck', recommendationLocation: 'Neck', side: 'center', labelPoint: [112, 84], path: 'M101 72h22l6 23H95l6-23Z' },
  { id: 'left-shoulder', label: 'Left shoulder', recommendationLocation: 'Shoulder', side: 'left', labelPoint: [76, 111], path: 'M59 101c13-12 27-15 40-8l-10 30-33 5c-8-10-7-19 3-27Z' },
  { id: 'right-shoulder', label: 'Right shoulder', recommendationLocation: 'Shoulder', side: 'right', labelPoint: [148, 111], path: 'M125 93c13-7 27-4 40 8 10 8 11 17 3 27l-33-5-10-30Z' },
  { id: 'left-arm', label: 'Left arm', recommendationLocation: 'Shoulder', side: 'left', labelPoint: [48, 190], path: 'M55 128l28-3-12 126-25 70-22-8 20-84 1-61 10-40Z' },
  { id: 'right-arm', label: 'Right arm', recommendationLocation: 'Shoulder', side: 'right', labelPoint: [176, 190], path: 'M141 125l28 3 10 40 1 61 20 84-22 8-25-70-12-126Z' },
  { id: 'back', label: 'Chest / back', recommendationLocation: 'Back', side: 'center', labelPoint: [112, 153], path: 'M88 95h48l18 44-12 87H82l-12-87 18-44Z' },
  { id: 'left-hip', label: 'Left hip', recommendationLocation: 'Hip', side: 'left', labelPoint: [91, 249], path: 'M82 226h31v46H76l6-46Z' },
  { id: 'right-hip', label: 'Right hip', recommendationLocation: 'Hip', side: 'right', labelPoint: [133, 249], path: 'M111 226h31l6 46h-37v-46Z' },
  { id: 'left-quad', label: 'Left quad', recommendationLocation: 'Quad', side: 'left', labelPoint: [88, 319], path: 'M77 272h36l-8 114H65l12-114Z' },
  { id: 'right-quad', label: 'Right quad', recommendationLocation: 'Quad', side: 'right', labelPoint: [136, 319], path: 'M111 272h36l12 114h-40l-8-114Z' },
  { id: 'left-hamstring', label: 'Left hamstring', recommendationLocation: 'Hamstring', side: 'left', labelPoint: [73, 335], path: 'M58 278h21L65 392H43l15-114Z' },
  { id: 'right-hamstring', label: 'Right hamstring', recommendationLocation: 'Hamstring', side: 'right', labelPoint: [151, 335], path: 'M145 278h21l15 114h-22l-14-114Z' },
  { id: 'left-knee', label: 'Left knee', recommendationLocation: 'Knee', side: 'left', labelPoint: [86, 395], path: 'M65 386h39l-3 36H62l3-36Z' },
  { id: 'right-knee', label: 'Right knee', recommendationLocation: 'Knee', side: 'right', labelPoint: [138, 395], path: 'M120 386h39l3 36h-39l-3-36Z' },
  { id: 'left-calf', label: 'Left calf', recommendationLocation: 'Calf', side: 'left', labelPoint: [80, 455], path: 'M62 422h39l-10 79H48l14-79Z' },
  { id: 'right-calf', label: 'Right calf', recommendationLocation: 'Calf', side: 'right', labelPoint: [144, 455], path: 'M123 422h39l14 79h-43l-10-79Z' },
  { id: 'left-ankle', label: 'Left ankle', recommendationLocation: 'Ankle', side: 'left', labelPoint: [69, 510], path: 'M48 501h43l-14 20H38l10-20Z' },
  { id: 'right-ankle', label: 'Right ankle', recommendationLocation: 'Ankle', side: 'right', labelPoint: [155, 510], path: 'M133 501h43l10 20h-39l-14-20Z' },
]

export function createEmptyPainMap() {
  return bodyPainAreas.reduce((map, area) => ({
    ...map,
    [area.id]: 0,
  }), {})
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
    .map((area) => ({
      bodyPart: area.label,
      date: source.date,
      notes: source.notes ?? '',
      severity: Number(painMap[area.id] ?? 0),
      side: area.side,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      triggerMovement: source.triggerMovement ?? '',
    }))
    .filter((report) => report.severity > 0)
}
