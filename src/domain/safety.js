const severeSymptoms = new Set(['Dizziness', 'Headache', 'Unusual shortness of breath'])

export function evaluateSafety(report = {}) {
  const pain = Math.max(Number(report.pain ?? 0), ...Object.values(report.painMap ?? {}).map(Number), 0)
  const findings = []
  const add = (id, severity, message) => findings.push({ id, severity, message })

  if (pain >= 8) add('severe-pain', 'stop', 'Severe reported pain needs adult or qualified professional review before training.')
  if (['Concussion concern', 'Bone stress'].includes(report.injuryType)) add('injury-concern', 'stop', 'This reported concern should not be assessed through a training recommendation.')
  if (['Numbness', 'Tingling', 'Headache / dizziness'].includes(report.painType)) add('neurological-symptom', 'stop', 'Numbness, tingling, headache, or dizziness requires prompt adult or qualified professional guidance.')
  if (report.hurtsWhen === 'Breathing') add('breathing-pain', 'stop', 'Pain with breathing should be assessed before activity.')
  if (Number(report.illnessSymptoms) >= 4) add('significant-illness', 'stop', 'Significant illness symptoms make normal training guidance inappropriate.')
  if ((report.heatSymptoms ?? []).some((symptom) => severeSymptoms.has(symptom))) add('concerning-post-event-symptom', 'stop', 'A concerning post-event symptom needs prompt adult or qualified professional attention.')
  if (report.movementChanged && (report.newPain || /worse/i.test(report.painChange ?? ''))) add('pain-with-function-change', 'stop', 'New or worsening pain with changed movement should be checked before more activity.')
  if (pain >= 5 && findings.length === 0) add('moderate-high-pain', 'limit', 'Reduce demands that reproduce the reported pain and monitor function closely.')
  if (Number(report.fatigue ?? report.postFatigue) >= 5 && findings.length === 0) add('extreme-fatigue', 'limit', 'Very high fatigue supports a conservative plan and reassessment.')
  return findings
}

export function hasStopFinding(findings = []) {
  return findings.some((finding) => finding.severity === 'stop')
}
