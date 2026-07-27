export const todayLabel = 'Monday, July 27'

export const checkInDefaults = {
  soreness: 3,
  pain: 2,
  fatigue: 4,
  sleep: 7,
  location: 'Hamstring',
  injuryType: 'Muscle strain',
  painType: 'Tight / pulling',
  session: 'Team practice',
  notes: 'Felt tight during acceleration work yesterday.',
}

export const recentCheckIns = [
  {
    day: 'Tue',
    score: 82,
    location: 'None',
    fatigue: 3,
    note: 'Good lift. No pain after practice.',
  },
  {
    day: 'Wed',
    score: 68,
    location: 'Hamstring',
    fatigue: 5,
    note: 'Tight after repeated sprints.',
  },
  {
    day: 'Thu',
    score: 74,
    location: 'None',
    fatigue: 4,
    note: 'Technical session felt smooth.',
  },
  {
    day: 'Fri',
    score: 58,
    location: 'Hamstring',
    fatigue: 7,
    note: 'Pulled up early on last sprint.',
  },
  {
    day: 'Sat',
    score: 49,
    location: 'Hamstring',
    fatigue: 8,
    note: 'Back-to-back practice load showed up.',
  },
]

export const schedule = [
  { day: 'Mon', date: 'Jul 27', type: 'Practice', load: 'Medium' },
  { day: 'Tue', date: 'Jul 28', type: 'Strength', load: 'Low' },
  { day: 'Wed', date: 'Jul 29', type: 'Team practice', load: 'High' },
  { day: 'Thu', date: 'Jul 30', type: 'Recovery', load: 'Low' },
  { day: 'Fri', date: 'Jul 31', type: 'Game', load: 'High' },
]

export const avoidRules = {
  Hamstring: ['No sprinting', 'Reduced acceleration reps', 'Technical only'],
  Knee: ['No jumping', 'No cutting drills', 'Keep work linear'],
  Ankle: ['No sharp turns', 'Limit uneven surfaces', 'Balance rehab first'],
  Shoulder: ['No contact', 'No overhead lifting', 'Passing only'],
  Back: ['No heavy loading', 'No twisting volume', 'Mobility first'],
  None: ['Full warm-up', 'Normal session', 'Post-practice notes'],
}
