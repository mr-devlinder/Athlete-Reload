import { addDays, format } from 'date-fns'
import { createEmptyPainMap } from './bodyPainMap'

const today = new Date()

function dateOffset(days) {
  return format(addDays(today, days), 'yyyy-MM-dd')
}

export const todayLabel = format(today, 'EEEE, MMMM d')

export const checkInDefaults = {
  energy: 10,
  soreness: 0,
  pain: 0,
  painMap: createEmptyPainMap(),
  fatigue: 0,
  sleep: 10,
  stress: 'Low',
  yesterdayLoad: 'Rest',
  hydration: 'Good',
  hydrationOz: 101,
  location: 'Hamstring',
  injuryType: 'Unknown',
  painType: 'No pain',
  hurtsWhen: 'At rest',
  session: 'Team practice',
  notes: '',
}

export const schedule = [
  {
    association: 'Personal',
    id: 'event-today-practice',
    date: dateOffset(0),
    load: 'Medium',
    note: 'Technical work plus controlled team drills',
    time: '6:00 PM',
    title: 'Soccer practice',
    type: 'Team practice',
  },
  {
    association: 'Personal',
    id: 'event-tomorrow-gym',
    date: dateOffset(1),
    load: 'Low',
    note: 'Upper body and mobility emphasis',
    time: '4:30 PM',
    title: 'Gym session',
    type: 'Gym session',
  },
  {
    association: 'Personal',
    id: 'event-plus-two-practice',
    date: dateOffset(2),
    load: 'High',
    note: 'Team tactical session',
    time: '6:00 PM',
    title: 'Team practice',
    type: 'Team practice',
  },
  {
    association: 'Personal',
    id: 'event-plus-three-recovery',
    date: dateOffset(3),
    load: 'Low',
    note: 'Stretching, mobility, light bike',
    time: '5:00 PM',
    title: 'Recovery',
    type: 'Recovery',
  },
  {
    association: 'Personal',
    id: 'event-plus-four-game',
    date: dateOffset(4),
    load: 'High',
    note: 'Friday match',
    time: '7:00 PM',
    title: 'Game day',
    type: 'Game',
  },
]

export const associations = []

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
}
