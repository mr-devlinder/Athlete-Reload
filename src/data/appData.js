export const todayLabel = 'Monday, July 27'

export const checkInDefaults = {
  energy: 6,
  soreness: 3,
  pain: 2,
  fatigue: 4,
  sleep: 7,
  stress: 'Medium',
  yesterdayLoad: 'Hard',
  hydration: 'Okay',
  location: 'Hamstring',
  injuryType: 'Muscle strain',
  painType: 'Tight / pulling',
  hurtsWhen: 'Sprinting',
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
  {
    id: 'event-2026-07-27-practice',
    date: '2026-07-27',
    load: 'Medium',
    note: 'Technical work plus controlled team drills',
    time: '6:00 PM',
    title: 'Soccer practice',
    type: 'Team practice',
  },
  {
    id: 'event-2026-07-28-gym',
    date: '2026-07-28',
    load: 'Low',
    note: 'Upper body and mobility emphasis',
    time: '4:30 PM',
    title: 'Gym session',
    type: 'Gym session',
  },
  {
    id: 'event-2026-07-29-practice',
    date: '2026-07-29',
    load: 'High',
    note: 'Team tactical session',
    time: '6:00 PM',
    title: 'Team practice',
    type: 'Team practice',
  },
  {
    id: 'event-2026-07-30-recovery',
    date: '2026-07-30',
    load: 'Low',
    note: 'Stretching, mobility, light bike',
    time: '5:00 PM',
    title: 'Recovery',
    type: 'Recovery',
  },
  {
    id: 'event-2026-07-31-game',
    date: '2026-07-31',
    load: 'High',
    note: 'Friday match',
    time: '7:00 PM',
    title: 'Game day',
    type: 'Game',
  },
]

export const avoidRules = {
  Hamstring: ['No max sprints', 'Reduced acceleration reps', 'Technical only'],
  Quad: ['No heavy squats', 'Limit explosive jumping', 'Longer warm-up'],
  Calf: ['No repeated sprint starts', 'Limit plyometrics', 'Build pace gradually'],
  Hip: ['No hard cutting', 'No deep loaded ranges', 'Mobility first'],
  Knee: ['No jumping', 'No cutting drills', 'Keep work linear'],
  Ankle: ['No sharp turns', 'Limit uneven surfaces', 'Balance rehab first'],
  Shoulder: ['No contact', 'No overhead lifting', 'Passing only'],
  Back: ['No heavy loading', 'No twisting volume', 'Mobility first'],
  Neck: ['No headers', 'No contact', 'Avoid sudden twisting'],
  Head: ['Do not train', 'Tell an adult or trainer immediately'],
  None: ['Full warm-up', 'Normal session', 'Post-practice notes'],
}
