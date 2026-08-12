const labels = {
  energy: 'low energy', sleep: 'short sleep', sleep_quality: 'poor sleep quality', fatigue: 'high fatigue',
  soreness: 'high soreness', stress: 'high stress', illness: 'illness symptoms', pain: 'current pain',
  recent_load: 'recent training load', same_day_events: 'multiple events today', baseline_deviation: 'a change from your baseline',
}

export function explainReadiness(result) {
  const reasons = result.deductions.slice().sort((a, b) => b.deduction - a.deduction).slice(0, 4).map((item) => labels[item.id] ?? item.id)
  if (result.status === 'stop_and_seek_help') return { summary: 'Stop the planned activity and seek help for the concerning symptom you reported.', reasons }
  if (result.status === 'limit') return { summary: 'Limit the planned activity and reassess before adding more demand.', reasons }
  if (result.status === 'adjust') return { summary: 'Adjust today’s plan around the strongest current signals.', reasons }
  return { summary: 'Your current inputs support the planned session with normal self-monitoring.', reasons }
}
