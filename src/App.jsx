import { useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { LensGlass, SVGFilters } from 'react-glassy'
import 'react-glassy/styles.css'
import { AuthGate } from './components/AuthGate'
import { OnboardingFlow } from './components/OnboardingFlow'
import { GuidedTour } from './components/GuidedTour'
import { CheckInView } from './components/CheckInView'
import { CheckoutModal } from './components/CheckoutModal'
import { AccountPrivacyView } from './components/AccountPrivacyView'
import { AthleteProfileModal } from './components/AthleteProfileModal'
import { HomeView } from './components/HomeView'
import { NutritionView } from './components/NutritionView'
import { HistoryView } from './components/HistoryView'
import { RecoveryView } from './components/RecoveryView'
import { RecommendationCard, RecoveryPlanCard } from './components/RecommendationCard'
import { ScheduleView } from './components/ScheduleView'
import {
  checkInDefaults,
  associations as initialAssociations,
  schedule as initialSchedule,
  todayLabel,
} from './data/appData'
import appLogo from './assets/athlete-reload-logo-transparent.png'
import trainingHero from './assets/training-hero.png'
import {
  clearCheckIns,
  clearPainReports,
  clearTrainingCheckouts,
  createAssociation,
  createPainIssue,
  createRecoveryRoutineCompletion,
  createSavedRecoveryRoutine,
  createCheckIn,
  createPainReports,
  createScheduleEvent,
  createShareAuditLog,
  createTournament,
  createTrainingCheckout,
  deleteAssociation,
  deleteCheckIn,
  deleteCheckInsForEvent,
  deletePainReportsForSource,
  deletePainReportsForSourceId,
  deleteScheduleEvent,
  deleteShareAuditLog,
  deleteTrainingCheckout,
  deleteTrainingCheckoutsForEvent,
  deleteTournament,
  loadAthleteData,
  loadAthleteProfile,
  loadPrivacyPreferences,
  updateAssociation,
  updateCheckIn,
  updatePainIssue,
  updateSavedRecoveryRoutine,
  upsertPrivacyPreferences,
  upsertDailyWellness,
  upsertAthleteProfile,
  updateTrainingCheckout,
  updateScheduleEvent,
  updateTournament,
} from './lib/athleteData'
import { generateAiRecommendation } from './lib/aiRecommendations'
import { getSportContext } from './data/sportProfiles'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'
import { bodyPainAreas, getPainReportsFromMap, getPainReportsWithResolutions, getPrimaryPainArea, normalizePainMapScale } from './data/bodyPainMap'
import { getRecommendation, getTrendInsights } from './utils/readiness'
import { getPersonalBaseline } from './utils/baselines'
import { getHydrationTarget, getNutritionTargets, getNutritionTotals } from './lib/nutrition'
import { clearUserStorage, loadSavedState, saveState } from './utils/storage'
import { getEventDisplayName, isAllDayCheckInOpen, isAllDayEvent, isEventActionable, isRestDayEvent } from './utils/events'
import { getCheckInPreparationContext } from './utils/eventFuelContext'
import { fluidOuncesToMilliliters, inchesToCentimeters, poundsToKilograms } from './utils/units'
import './App.css'

const views = [
  {
    icon: 'home',
    label: 'Home',
  },
  {
    icon: 'nutrition',
    label: 'Nutrition',
  },
  {
    icon: 'recovery',
    label: 'Recovery',
  },
  {
    icon: 'pulse',
    label: 'Check-in',
  },
  {
    icon: 'calendar',
    label: 'Schedule',
  },
  {
    icon: 'trend',
    label: 'History',
  },
]

const privacyDefaults = {
  aiPersonalizationEnabled: true,
  analyticsAllowed: false,
  cloudSync: true,
  coachIncludeNotes: false,
  coachIncludePain: false,
  coachIncludeNutrition: false,
  localCopy: false,
  remindersEnabled: false,
}

function normalizeWellnessUnits(wellness = {}) {
  return {
    ...wellness,
    hydrationMl: Number(wellness.hydrationMl ?? fluidOuncesToMilliliters(wellness.hydrationOz) ?? 0),
  }
}

function normalizeProfileUnits(profile) {
  if (!profile) return profile
  return {
    ...profile,
    heightCm: profile.heightCm ?? inchesToCentimeters(profile.heightInches),
    unitSystem: profile.unitSystem ?? 'imperial',
    weightKg: profile.weightKg ?? poundsToKilograms(profile.weightLbs),
  }
}

function getAuthDisplayName(session) {
  const metadata = session?.user?.user_metadata ?? {}
  const fullName = [metadata.given_name, metadata.family_name].filter(Boolean).join(' ').trim()

  return [
    metadata.full_name,
    metadata.name,
    fullName,
    metadata.user_name,
    metadata.preferred_username,
  ].map((value) => String(value ?? '').trim()).find(Boolean) ?? ''
}

function normalizeScheduleItem(item, index) {
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + index)
  const fallbackDate = [
    fallback.getFullYear(),
    String(fallback.getMonth() + 1).padStart(2, '0'),
    String(fallback.getDate()).padStart(2, '0'),
  ].join('-')

  const isAllDay = isAllDayEvent(item)
  const isOtherActivity = item.type === 'Other activity'
  const time = isAllDay ? '' : item.time ?? ''
  const customActivityName = isOtherActivity ? item.customActivityName ?? (item.title !== item.type ? item.title : '') : ''

  return {
    allDay: isAllDay,
    id: item.id ?? `event-${Date.now()}-${index}`,
    date: /^\d{4}-\d{2}-\d{2}$/.test(item.date ?? '') ? item.date : fallbackDate,
    load: item.load ?? (isAllDay ? 'Low' : 'Medium'),
    note: item.note ?? '',
    association: isOtherActivity ? item.association ?? 'None' : item.association ?? 'Personal',
    customActivityName,
    environment: item.environment ?? 'Outdoor',
    expectedDuration: isAllDay ? null : Number(item.expectedDuration ?? item.plannedMinutes ?? 60),
    location: item.location ?? '',
    surface: item.surface ?? 'Grass',
    time,
    title: customActivityName || (isAllDay ? item.type : item.title ?? item.type ?? 'Training'),
    type: item.type ?? 'Team practice',
    plannedMinutes: isAllDay ? undefined : Number(item.plannedMinutes ?? 0) || undefined,
  }
}

function getTodayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

function getSessionFromSchedule(events) {
  const eventType = events[0]?.type

  if (!eventType) return 'Rest day'
  if (['Rest Day', 'Rest day'].includes(eventType)) return 'Rest day'
  if (eventType === 'Game') return 'Game day'
  if (eventType === 'Recovery') return 'Recovery day'

  return eventType
}

function getSessionFromEvent(event) {
  if (!event) return 'Rest day'
  if (isRestDayEvent(event)) return 'Rest day'
  if (event.type === 'Game') return 'Game day'
  if (event.type === 'Recovery') return 'Recovery day'

  return event.type
}

function getCheckInEventOptions(schedule) {
  return sortScheduleEvents(schedule.filter((event) => isEventActionable(event) || isAllDayEvent(event)))
}

function getDefaultLoadForEvent(type) {
  if (['Game', 'Tournament', 'Conditioning'].includes(type)) return 'High'
  if (['Recovery', 'Rest Day', 'Rest day'].includes(type)) return 'Low'

  return 'Medium'
}

function getHydrationStatus(hydrationMl = 0) {
  const progress = Number(hydrationMl) / 3000

  if (progress >= 0.9) return 'Good'
  if (progress >= 0.5) return 'Okay'

  return 'Poor'
}

function normalizeFivePointValue(value, fallback = 1) {
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback

  return Math.max(0, Math.min(5, Math.round(number)))
}

function normalizeCheckInScales(checkIn) {
  return {
    ...checkIn,
    energy: normalizeFivePointValue(checkIn.energy, 5),
    expectedDifficulty: Math.max(1, Math.min(10, Math.round(Number(checkIn.expectedDifficulty) || 5))),
    fatigue: normalizeFivePointValue(checkIn.fatigue, 0),
    legHeaviness: normalizeFivePointValue(checkIn.legHeaviness, 0),
    sleep: Math.max(3, Math.min(10, Math.round(Number(checkIn.sleep) || 10))),
    illnessSymptoms: normalizeIllnessValue(checkIn.illnessSymptoms),
    sleepQuality: normalizeFivePointValue(checkIn.sleepQuality, 5),
    soreness: normalizeFivePointValue(checkIn.soreness, 0),
    stress: normalizeStressValue(checkIn.stress),
    painMap: normalizePainMapScale(checkIn.painMap, checkIn.pain),
  }
}

function normalizeStressValue(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(5, String(value).includes('Low') ? parsed - 1 : parsed))
}

function normalizeIllnessValue(value) {
  if (typeof value === 'number') return Math.max(0, Math.min(5, value))
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'none') return 0
  if (normalized === 'mild') return 2
  if (normalized === 'significant' || normalized === 'unwell') return 5
  return Math.max(0, Math.min(5, Number.parseInt(normalized, 10) || 0))
}

function getYesterdayLoadFromSchedule(schedule) {
  const yesterdayIso = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const yesterdayEvents = schedule.filter((event) => event.date === yesterdayIso)

  if (yesterdayEvents.some((event) => event.load === 'High')) return 'Hard'
  if (yesterdayEvents.some((event) => event.load === 'Medium')) return 'Moderate'
  if (yesterdayEvents.some((event) => event.load === 'Low')) return 'Light'

  return 'Rest'
}

function applyPainMapToCheckIn(checkIn) {
  const primaryArea = getPrimaryPainArea(checkIn.painMap)
  const severity = primaryArea?.severity ?? 0
  const pain = severity > 0 ? Math.max(1, Math.min(10, Math.round(severity))) : 0

  return normalizeCheckInScales({
    ...checkIn,
    hurtsWhen: pain > 0 ? checkIn.hurtsWhen : 'At rest',
    injuryType: pain > 0 ? checkIn.injuryType : 'Unknown',
    location: pain > 0 ? primaryArea.recommendationLocation : 'Hamstring',
    pain,
    painType: pain > 0 ? checkIn.painType : 'No pain',
  })
}

function checkInFromHistoryEntry(entry, fallback) {
  if (!entry) return fallback

  return normalizeCheckInScales({
    ...fallback,
    energy: entry.energy,
    expectedDifficulty: entry.expectedDifficulty,
    fatigue: entry.fatigue,
    hurtsWhen: entry.hurtsWhen,
    hydration: entry.hydration,
    hydrationMl: entry.hydrationMl ?? 0,
    injuryType: entry.injuryType,
    legHeaviness: entry.legHeaviness,
    location: entry.location,
    notes: entry.note ?? '',
    pain: entry.pain,
    painMap: entry.painMap ?? fallback.painMap,
    painType: entry.painType,
    sleep: entry.sleep,
    sleepQuality: entry.sleepQuality,
    soreness: entry.soreness,
    stress: entry.stress,
  })
}

function getComparableCheckIn(checkIn) {
  return {
    checkInType: checkIn.checkInType ?? 'pre_event',
    energy: Number(checkIn.energy),
    eventDate: checkIn.eventDate ?? checkIn.date ?? '',
    eventId: checkIn.eventId ?? null,
    eventTime: checkIn.eventTime ?? '',
    eventTitle: checkIn.eventTitle ?? '',
    fatigue: Number(checkIn.fatigue),
    hurtsWhen: checkIn.hurtsWhen ?? '',
    hydration: checkIn.hydration ?? '',
    hydrationMl: Number(checkIn.hydrationMl ?? 0),
    illnessSymptoms: Number(checkIn.illnessSymptoms ?? 0),
    injuryType: checkIn.injuryType ?? '',
    legHeaviness: Number(checkIn.legHeaviness ?? 0),
    location: checkIn.location ?? '',
    notes: checkIn.notes ?? checkIn.note ?? '',
    pain: Number(checkIn.pain ?? 0),
    painMap: checkIn.painMap ?? null,
    painType: checkIn.painType ?? '',
    plannedIntensity: checkIn.plannedIntensity ?? '',
    expectedDifficulty: Number(checkIn.expectedDifficulty ?? 5),
    session: checkIn.session ?? '',
    sleep: Number(checkIn.sleep),
    sleepQuality: Number(checkIn.sleepQuality ?? 5),
    soreness: Number(checkIn.soreness),
    stress: Number(checkIn.stress ?? 0),
    yesterdayLoad: checkIn.yesterdayLoad ?? '',
  }
}

function getComparableHistoryEntry(entry) {
  if (!entry) return null

  return getComparableCheckIn({
    ...entry,
    checkInType: entry.checkInType ?? 'pre_event',
    eventDate: entry.date,
    eventTitle: entry.eventTitle ?? entry.session,
    notes: entry.note ?? '',
    plannedIntensity: entry.plannedIntensity ?? entry.session,
  })
}

function areCheckInsEquivalent(current, previous) {
  const currentComparable = getComparableCheckIn(current)
  const previousComparable = getComparableHistoryEntry(previous)

  if (!previousComparable) return false

  if (!previousComparable.painMap) {
    currentComparable.painMap = null
  }

  return JSON.stringify(currentComparable) === JSON.stringify(previousComparable)
}

function getFreshCheckInDefaults() {
  return {
    ...checkInDefaults,
    painMap: { ...checkInDefaults.painMap },
  }
}

function withoutNotes(value) {
  if (Array.isArray(value)) return value.map(withoutNotes)
  if (!value || typeof value !== 'object') return value

  const { note: _note, notes: _notes, ...rest } = value
  return rest
}

function normalizePainAreaName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getPreviousCheckoutRecommendationContext(previousCheckout, currentCheckIn) {
  if (!previousCheckout) return previousCheckout
  const currentPainMap = normalizePainMapScale(currentCheckIn?.painMap ?? {}, currentCheckIn?.pain)
  const hasCurrentPain = Object.values(currentPainMap).some((severity) => Number(severity) > 0)
  if (hasCurrentPain) return withoutNotes(previousCheckout)

  const {
    newPain: _newPain,
    painChange: _painChange,
    painDetails: _painDetails,
    painMap: _painMap,
    ...resolvedContext
  } = withoutNotes(previousCheckout)
  return resolvedContext
}

function getSharedSleepContext(history, date) {
  const firstCheckIn = history
    .filter((entry) => (entry.checkInType ?? 'pre_event') === 'pre_event' && entry.date === date)
    .sort((a, b) => String(a.eventTime ?? '').localeCompare(String(b.eventTime ?? '')))[0]

  return firstCheckIn
    ? { sleep: firstCheckIn.sleep, sleepQuality: firstCheckIn.sleepQuality }
    : {}
}

function getNextTodayEventAfter(schedule, eventId, todayIso, completedEventIds = new Set()) {
  const todaySchedule = sortScheduleEvents(schedule.filter((event) => event.date === todayIso && isEventActionable(event)))
  const currentIndex = todaySchedule.findIndex((event) => event.id === eventId)
  const laterEvents = todaySchedule.slice(Math.max(0, currentIndex + 1))

  return laterEvents.find((event) => !completedEventIds.has(event.id)) ?? laterEvents[0] ?? null
}

function getNextScheduledEvent(schedule, event) {
  const sortedSchedule = sortScheduleEvents(schedule)
  const currentIndex = sortedSchedule.findIndex((item) => item.id === event.id)

  if (currentIndex < 0) return null

  return sortedSchedule.slice(currentIndex + 1)[0] ?? null
}

function getPreviousCheckout(checkouts, schedule, currentEvent) {
  const currentEventTime = getEventDateTime(currentEvent)

  return checkouts
    .map((checkout) => ({
      checkout,
      event: schedule.find((event) => event.id === checkout.eventId),
    }))
    .filter(({ checkout, event }) => {
      if (checkout.eventId === currentEvent?.id) return false

      const checkoutEventTime = getEventDateTime(event)
      if (currentEventTime && checkoutEventTime) return checkoutEventTime < currentEventTime

      return String(checkout.date ?? '') < String(currentEvent?.date ?? '')
    })
    .sort((first, second) => {
      const firstTime = getEventDateTime(first.event)?.getTime() ?? 0
      const secondTime = getEventDateTime(second.event)?.getTime() ?? 0
      return secondTime - firstTime
    })[0]?.checkout ?? null
}

function getRecommendationScheduleContext(schedule, event) {
  const eventDate = event?.date ?? getTodayIso()
  const nearbyEvents = sortScheduleEvents(schedule.filter((item) => Math.abs(
    new Date(`${item.date}T00:00:00`) - new Date(`${eventDate}T00:00:00`),
  ) <= 2 * 24 * 60 * 60 * 1000))

  return {
    nearbyEvents: nearbyEvents.map((item) => ({
      allDay: Boolean(item.allDay),
      date: item.date,
      durationMinutes: item.plannedMinutes ?? item.expectedDuration,
      load: item.load,
      name: getEventDisplayName(item),
      type: item.type,
    })),
    plannedRestDays: nearbyEvents.filter(isRestDayEvent).map((item) => item.date),
  }
}

function getCheckoutWellnessContext(dailyWellness, nutritionContext) {
  return {
    date: dailyWellness?.date,
    hydrationMl: Number(dailyWellness?.hydrationMl ?? 0),
    nutritionEntryCount: dailyWellness?.nutritionEntries?.length ?? 0,
    nutritionTotals: nutritionContext?.totals,
    nutritionTargets: nutritionContext?.targets,
  }
}

function getEventDateTime(event) {
  if (!event?.date) return null

  const minutes = getScheduleTimeValue(event.time)
  const date = new Date(`${event.date}T00:00:00`)

  const safeMinutes = minutes >= 24 * 60 ? 0 : minutes
  date.setHours(Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0)

  return date
}

function getLocalCheckoutRecommendation(checkout, event, preCheckIn) {
  const difficulty = Number(checkout.difficulty)
  const sessionLoad = Number(checkout.actualMinutes ?? 0) * difficulty
  const painWorsened = ['Slightly worse', 'Much worse'].includes(checkout.painChange)
  const stoppedShort = ['Modified', 'Partial', 'Did not participate'].includes(checkout.participation)
  const heatConcern = checkout.heatSymptoms?.length > 0 || checkout.cramping
  const concerningSymptoms = heatConcern || checkout.newPain || checkout.movementChanged
  let score = 86

  if (difficulty >= 8) score -= 12
  if (painWorsened) score -= checkout.painChange === 'Much worse' ? 24 : 12
  if (stoppedShort) score -= 10
  if (concerningSymptoms) score -= 16
  if (preCheckIn?.score && preCheckIn.score < 70) score -= 6

  score = Math.max(30, Math.min(96, Math.round(score)))

  return {
    action: heatConcern
      ? 'Stop any additional exercise, move to a cool place, and tell a parent, coach, or athletic trainer now. Follow your team or medical hydration guidance and seek urgent help for fainting, confusion, vomiting, or severe symptoms.'
      : painWorsened || checkout.newPain || checkout.movementChanged
        ? 'Start with a calm cooldown, then use comfort measures that do not increase symptoms. Avoid additional impact work tonight and tell a parent, coach, or athletic trainer if pain keeps rising, changes movement, or feels sharp or unstable.'
        : difficulty >= 8
          ? 'Begin recovery now with a short cooldown, steady fluids, and a balanced carbohydrate-and-protein meal or snack. Skip any extra conditioning tonight and protect a full night of sleep.'
          : 'Complete a short cooldown, have a normal recovery meal and fluids, then use gentle mobility only where it stays comfortable. Do not add extra training simply because this session was lighter.',
    avoid: painWorsened
      ? ['Extra training tonight', 'Aggressive stretching into pain', 'Ignoring worsening symptoms']
      : difficulty >= 8
        ? ['Extra conditioning tonight', 'Skipping cooldown']
        : [],
    breakdown: [
      { label: 'Session difficulty', value: difficulty >= 8 ? -12 : 4 },
      { label: 'Pain change', value: painWorsened ? -14 : 6 },
      { label: 'Completion', value: stoppedShort ? -8 : 5 },
    ],
    during: heatConcern
      ? ['Stay in a cool environment and have an adult, coach, or trainer monitor symptoms for the next few hours.']
      : concerningSymptoms
        ? ['Monitor the changed area over the next few hours and tell an adult if symptoms worsen.']
        : [],
    focus: [
      'Hydrate steadily',
      'Eat a normal recovery meal',
      painWorsened ? 'Ice the irritated area' : 'Light stretching or mobility',
      'Prioritize sleep',
    ],
    intensity: heatConcern ? 'Heat and symptom care' : painWorsened ? 'Soreness care' : difficulty >= 8 ? 'High-load recovery' : 'Normal cooldown',
    label: heatConcern ? 'Tell an Adult / Trainer' : painWorsened || checkout.newPain || checkout.movementChanged ? 'Monitor Symptoms' : stoppedShort ? 'Extra Recovery' : 'Normal Recovery',
    nextEventWarning: heatConcern
      ? 'Your next event should be treated as assessment-needed until these symptoms have resolved and an adult, coach, or trainer says it is appropriate.'
      : concerningSymptoms || painWorsened
        ? 'Your next check-in should flag this response for reassessment before you begin the event.'
      : sessionLoad >= 600
        ? 'Your next check-in should account for this high personal workload.'
        : '',
    preparation: ['Begin a short, easy cooldown before leaving the training area.'],
    recovery: heatConcern
      ? ['Move to a cool environment and stop additional exercise.', 'Tell a parent, coach, or athletic trainer about the symptoms now.', 'Follow your team or medical hydration guidance and monitor for worsening symptoms.']
      : painWorsened || checkout.newPain || checkout.movementChanged
        ? ['Avoid additional impact exercise tonight.', 'Use gentle recovery only and monitor the changed area before sleep.', 'Tell a parent, coach, or athletic trainer if symptoms continue to rise.']
        : difficulty >= 8
          ? ['Rehydrate over the evening based on your usual team guidance.', 'Eat a normal meal or snack with carbohydrates and protein.', 'Use an easy cooldown and set up a full night of sleep.']
          : ['Have normal fluids and a meal or snack after the session.', 'Use gentle mobility only where it feels comfortable.', 'Keep the rest of the day easy and set up a full night of sleep.'],
    reasons: [
      `${checkout.actualMinutes} minutes at ${difficulty}/10 difficulty (${sessionLoad} load units)`,
      `Pain change: ${checkout.painChange}`,
      `Participation: ${checkout.participation ?? checkout.completionLevel}`,
    ],
    score,
    summary: painWorsened
      ? 'Pain increased after the session, so treat recovery and symptom monitoring seriously tonight.'
      : 'Session response looks stable, so a normal cooldown and recovery routine fits.',
    tone: score >= 75 ? 'ready' : score >= 50 ? 'caution' : 'danger',
  }
}

function getScheduleTimeValue(value = '') {
  const trimmed = String(value).trim()

  if (!trimmed) return 24 * 60

  const timeInputMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)

  if (timeInputMatch) {
    return Number(timeInputMatch[1]) * 60 + Number(timeInputMatch[2])
  }

  const displayMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)

  if (!displayMatch) return 24 * 60

  const suffix = displayMatch[3].toUpperCase()
  let hour = Number(displayMatch[1])
  const minute = Number(displayMatch[2] ?? 0)

  if (suffix === 'PM' && hour !== 12) hour += 12
  if (suffix === 'AM' && hour === 12) hour = 0

  return hour * 60 + minute
}

function sortScheduleEvents(events) {
  return [...events].sort((first, second) => {
    const dateCompare = String(first.date).localeCompare(String(second.date))

    if (dateCompare !== 0) return dateCompare

    return getScheduleTimeValue(first.time) - getScheduleTimeValue(second.time)
  })
}

function isInsideCheckInWindow(event) {
  if (isAllDayEvent(event)) return event.date === getTodayIso() && isAllDayCheckInOpen(event)
  if (!isEventActionable(event)) return false
  if (!event?.date || !event?.time) return false
  const minutes = getScheduleTimeValue(event.time)
  if (minutes >= 24 * 60) return false
  const eventStartDate = new Date(`${event.date}T00:00:00`)
  eventStartDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  const eventStart = eventStartDate.getTime()
  const now = Date.now()

  const isToday = event.date === getTodayIso()
  const hasStarted = eventStart <= now

  return (isToday && hasStarted) || (eventStart > now && eventStart - now <= 3 * 60 * 60 * 1000)
}

function attachTournamentContext(event, tournaments, schedule) {
  if (!event?.tournamentId) return event

  const tournament = tournaments.find((item) => item.id === event.tournamentId)
  if (!tournament) return event

  return {
    ...event,
    tournament: {
      ...tournament,
      games: sortScheduleEvents(schedule.filter((item) => item.tournamentId === tournament.id)).map((game) => ({
        date: game.date,
        expectedDuration: game.expectedDuration,
        opponent: game.opponent,
        time: game.time,
      })),
    },
  }
}

function App() {
  const savedState = useMemo(() => loadSavedState(), [])
  const [session, setSession] = useState(null)
  const [athleteProfile, setAthleteProfile] = useState(normalizeProfileUnits(savedState?.athleteProfile ?? null))
  const [isProfileReady, setIsProfileReady] = useState(!hasSupabaseConfig)
  const [onboardingTour, setOnboardingTour] = useState(null)
  const [onboardingCompleteOpen, setOnboardingCompleteOpen] = useState(false)
  const [onboardingAssociation, setOnboardingAssociation] = useState('Personal')
  const [isAppUnlocked, setIsAppUnlocked] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(!hasSupabaseConfig)
  const [authEntryMode, setAuthEntryMode] = useState('landing')
  const [dataStatus, setDataStatus] = useState('ready')
  const [isEditingToday, setIsEditingToday] = useState(false)
  const [selectedCheckInEventId, setSelectedCheckInEventId] = useState(null)
  const [activeView, setActiveView] = useState('Home')
  const [checkoutEvent, setCheckoutEvent] = useState(null)
  const [submittedRecommendation, setSubmittedRecommendation] = useState(null)
  const [submittedRecommendationStatus, setSubmittedRecommendationStatus] = useState('local')
  const [checkInAiError, setCheckInAiError] = useState('')
  const [generatedRecoveryPlan, setGeneratedRecoveryPlan] = useState(null)
  const [generatedRecoveryCheckoutId, setGeneratedRecoveryCheckoutId] = useState(null)
  const [isGeneratedRecoveryPlanSaved, setIsGeneratedRecoveryPlanSaved] = useState(false)
  const [recoveryPlanStatus, setRecoveryPlanStatus] = useState('idle')
  const [submittedRecommendationContext, setSubmittedRecommendationContext] = useState({
    scoreLabel: 'readiness',
    session: '',
    title: 'Check-in report',
  })
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false)
  const [activeLegalModal, setActiveLegalModal] = useState(null)
  const [isAthleteProfileOpen, setIsAthleteProfileOpen] = useState(false)
  const [navLens, setNavLens] = useState(null)
  const lensFrameRef = useRef(null)
  const lensNodeRef = useRef(null)
  const lensTargetRef = useRef(null)
  const navRef = useRef(null)
  const sentReminderKeysRef = useRef(new Set())
  const [checkIn, setCheckIn] = useState(() => normalizeCheckInScales(savedState?.checkIn ?? checkInDefaults))
  const [history, setHistory] = useState(savedState?.history ?? [])
  const [checkouts, setCheckouts] = useState(savedState?.checkouts ?? [])
  const [painReports, setPainReports] = useState(savedState?.painReports ?? [])
  const [painIssues, setPainIssues] = useState(savedState?.painIssues ?? [])
  const [savedRoutines, setSavedRoutines] = useState(savedState?.savedRoutines ?? [])
  const [recoveryCompletions, setRecoveryCompletions] = useState(savedState?.recoveryCompletions ?? [])
  const [shareAuditLogs, setShareAuditLogs] = useState(savedState?.shareAuditLogs ?? [])
  const [tournaments, setTournaments] = useState(savedState?.tournaments ?? [])
  const [isReplayingSavedRoutine, setIsReplayingSavedRoutine] = useState(false)
  const [replayingRoutineId, setReplayingRoutineId] = useState(null)
  const [dailyWellness, setDailyWellness] = useState(() => normalizeWellnessUnits(savedState?.dailyWellness ?? ({ date: getTodayIso(), hydrationMl: 0, nutritionEntries: [] })))
  const [nutritionHistory, setNutritionHistory] = useState(() => (savedState?.nutritionHistory ?? []).map(normalizeWellnessUnits))
  const [privacyPreferences, setPrivacyPreferences] = useState(
    savedState?.privacyPreferences ?? privacyDefaults,
  )
  const [associations, setAssociations] = useState(savedState?.associations ?? initialAssociations)
  const [schedule, setSchedule] = useState(
    (savedState?.schedule ?? initialSchedule).map(normalizeScheduleItem),
  )
  const visualActiveView = navLens?.activeLabel ?? activeView
  const isSupabaseSession = Boolean(supabase && session?.user?.id && isAppUnlocked)
  const todayIso = getTodayIso()
  const todayEvents = useMemo(
    () => sortScheduleEvents(schedule.filter((event) => event.date === todayIso)),
    [schedule, todayIso],
  )
  const completedCheckoutEventIds = useMemo(
    () => new Set(checkouts.map((checkout) => checkout.eventId).filter(Boolean)),
    [checkouts],
  )
  const currentTodayCheckInEvent = useMemo(
    () => {
      const nextRequiredEvent = todayEvents.find((event) => isInsideCheckInWindow(event) && !completedCheckoutEventIds.has(event.id))
      return nextRequiredEvent && isInsideCheckInWindow(nextRequiredEvent) ? nextRequiredEvent : null
    },
    [completedCheckoutEventIds, todayEvents],
  )
  const nextEvent = useMemo(
    () => sortScheduleEvents(schedule.filter((event) => event.date > todayIso))[0],
    [schedule, todayIso],
  )
  const checkInEventOptions = useMemo(
    () => getCheckInEventOptions(schedule),
    [schedule],
  )
  const selectedCheckInEvent = useMemo(
    () => {
      const selectedEvent = checkInEventOptions.find((event) => event.id === selectedCheckInEventId)

      if (selectedEvent?.id === currentTodayCheckInEvent?.id) return selectedEvent

      return currentTodayCheckInEvent
    },
    [checkInEventOptions, currentTodayCheckInEvent, selectedCheckInEventId],
  )
  const scheduleDrivenCheckIn = useMemo(
    () => ({
      ...applyPainMapToCheckIn(normalizeCheckInScales(checkIn)),
      checkInType: 'pre_event',
      eventDate: selectedCheckInEvent?.date ?? todayIso,
      eventId: selectedCheckInEvent?.id ?? null,
      eventTime: selectedCheckInEvent?.time ?? '',
      eventTitle: selectedCheckInEvent?.title ?? 'Open training day',
      notes: '',
      plannedIntensity: selectedCheckInEvent?.load ?? 'Open',
      session: getSessionFromEvent(selectedCheckInEvent) || getSessionFromSchedule(todayEvents),
      yesterdayLoad: getYesterdayLoadFromSchedule(schedule),
    }),
    [checkIn, schedule, selectedCheckInEvent, todayEvents, todayIso],
  )
  const nutritionContext = useMemo(() => ({
    hydrationTargetMl: getHydrationTarget(athleteProfile, schedule, todayIso),
    targets: getNutritionTargets(athleteProfile, schedule, todayIso),
    totals: getNutritionTotals(dailyWellness?.nutritionEntries ?? []),
  }), [athleteProfile, dailyWellness?.nutritionEntries, schedule, todayIso])
  const eventPreparationContext = useMemo(() => getCheckInPreparationContext({
    checkInTime: new Date(),
    checkouts,
    dailyWellness,
    event: selectedCheckInEvent,
    nutritionContext,
    nutritionHistory,
    schedule,
  }), [checkouts, dailyWellness, nutritionContext, nutritionHistory, schedule, selectedCheckInEvent])
  const localRecommendation = useMemo(
    () => getRecommendation(scheduleDrivenCheckIn),
    [scheduleDrivenCheckIn],
  )
  const recommendation = localRecommendation

  const currentEntry = useMemo(
    () => ({
      date: selectedCheckInEvent?.date ?? todayIso,
      checkInType: 'pre_event',
      eventId: selectedCheckInEvent?.id ?? null,
      eventTime: selectedCheckInEvent?.time ?? '',
      eventTitle: selectedCheckInEvent?.title ?? scheduleDrivenCheckIn.session,
      id: selectedCheckInEvent?.id
        ? `pre-check-${selectedCheckInEvent.id}`
        : `pre-check-${todayIso}`,
      day: 'Today',
      energy: checkIn.energy,
      score: recommendation.score,
      soreness: checkIn.soreness,
      pain: checkIn.pain,
      location: checkIn.location,
      fatigue: checkIn.fatigue,
      illnessSymptoms: checkIn.illnessSymptoms,
      legHeaviness: checkIn.legHeaviness,
      sleep: checkIn.sleep,
      sleepQuality: checkIn.sleepQuality,
      stress: checkIn.stress,
      yesterdayLoad: scheduleDrivenCheckIn.yesterdayLoad,
      hydration: checkIn.hydration,
      hydrationMl: checkIn.hydrationMl,
      injuryType: checkIn.injuryType,
      painType: checkIn.painType,
      painMap: checkIn.painMap,
      hurtsWhen: checkIn.hurtsWhen,
      expectedDifficulty: checkIn.expectedDifficulty,
      plannedIntensity: selectedCheckInEvent?.load ?? 'Open',
      session: scheduleDrivenCheckIn.session,
      note: checkIn.notes,
    }),
    [
      checkIn.energy,
      checkIn.expectedDifficulty,
      checkIn.fatigue,
      checkIn.illnessSymptoms,
      checkIn.legHeaviness,
      checkIn.hurtsWhen,
      checkIn.hydration,
      checkIn.hydrationMl,
      checkIn.injuryType,
      checkIn.location,
      checkIn.notes,
      checkIn.pain,
      checkIn.painMap,
      checkIn.painType,
      checkIn.sleep,
      checkIn.sleepQuality,
      checkIn.soreness,
      checkIn.stress,
      recommendation.score,
      scheduleDrivenCheckIn.session,
      scheduleDrivenCheckIn.yesterdayLoad,
      selectedCheckInEvent,
      todayIso,
    ],
  )
  const isCheckInSavedToday = useMemo(
    () =>
      !isEditingToday &&
      history.some((entry) =>
        selectedCheckInEvent?.id
          ? entry.eventId === selectedCheckInEvent.id
          : entry.date === todayIso,
      ),
    [history, isEditingToday, selectedCheckInEvent, todayIso],
  )

  const trendInsights = useMemo(
    () => getTrendInsights(history),
    [history],
  )

  useEffect(() => {
    if (!privacyPreferences.remindersEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined

    function notifyDueActions() {
      const now = new Date()
      const nowTime = now.getTime()
      const today = getTodayIso()

      schedule.forEach((event) => {
        if (event.date !== today) return
        if (!isEventActionable(event)) return

        const eventTime = new Date(`${event.date}T${event.time || (event.allDay ? '18:00' : '23:59')}`).getTime()
        const checkIn = history.find((entry) => entry.eventId === event.id)
        const checkout = checkouts.find((entry) => entry.eventId === event.id)
        const key = eventTime > nowTime ? `checkin-${event.id}` : `checkout-${event.id}`

        if (sentReminderKeysRef.current.has(key)) return

        if (eventTime > nowTime && eventTime - nowTime <= 3 * 60 * 60 * 1000 && !checkIn) {
          new Notification('Athlete Reload', { body: `Check in before ${event.type}.`, tag: key })
          sentReminderKeysRef.current.add(key)
        }

        if (eventTime <= nowTime && checkIn && !checkout) {
          new Notification('Athlete Reload', { body: `Log your ${event.type} checkout when you are ready.`, tag: key })
          sentReminderKeysRef.current.add(key)
        }
      })

      checkouts.forEach((checkout) => {
        if (checkout.date !== today || checkout.recommendation?.recoveryPlan) return

        const key = `recovery-${checkout.id}`
        if (sentReminderKeysRef.current.has(key)) return

        new Notification('Athlete Reload', {
          body: `Build a recovery plan from your ${checkout.title ?? 'completed session'} checkout.`,
          tag: key,
        })
        sentReminderKeysRef.current.add(key)
      })
    }

    notifyDueActions()
    const interval = window.setInterval(notifyDueActions, 60_000)
    return () => window.clearInterval(interval)
  }, [checkouts, history, privacyPreferences.remindersEnabled, schedule])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session)
        setIsAppUnlocked(Boolean(data.session))
        setIsAuthReady(true)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthEntryMode('reset-password')
      }
      if (!nextSession) {
        setIsAppUnlocked(false)
        setAuthEntryMode('landing')
      } else if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setIsAppUnlocked(true)
      }
      setIsAuthReady(true)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isSupabaseSession) {
      return
    }

    saveState({
      athleteProfile,
      checkIn,
      associations,
      checkouts,
      history,
      painReports,
      painIssues,
      savedRoutines,
      recoveryCompletions,
      shareAuditLogs,
      tournaments,
      dailyWellness,
      nutritionHistory,
      privacyPreferences,
      schedule,
    })
  }, [associations, athleteProfile, checkIn, checkouts, dailyWellness, history, isSupabaseSession, nutritionHistory, painIssues, painReports, privacyPreferences, recoveryCompletions, savedRoutines, schedule, shareAuditLogs, tournaments])

  useEffect(() => {
    if (!isSupabaseSession) {
      return
    }

    let isMounted = true
    setDataStatus('loading')

    async function loadRemoteData() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()

        const userWasDeleted = !userData.user && (
          !userError
          || userError.status === 401
          || userError.status === 403
          || userError.code === 'user_not_found'
          || userError.code === 'invalid_token'
        )

        if (userWasDeleted) {
          await resetDeletedSession()
          return
        }

        if (userError) throw userError

        const data = await loadAthleteData()
        let preferences = privacyDefaults

        try {
          preferences = (await loadPrivacyPreferences()) ?? privacyDefaults
        } catch (preferencesError) {
          console.warn(preferencesError)
        }

        if (!isMounted) return

        setSchedule(data.schedule)
        setAssociations(data.associations)
        setHistory(data.history)
        setCheckouts(data.checkouts)
        setPainReports(data.painReports)
        setPainIssues(data.painIssues)
        setSavedRoutines(data.savedRoutines)
        setRecoveryCompletions(data.recoveryCompletions ?? [])
        setShareAuditLogs(data.shareAuditLogs)
        setTournaments(data.tournaments)
        setDailyWellness(data.wellness ?? { date: todayIso, hydrationMl: 0, nutritionEntries: [] })
        setNutritionHistory(data.wellnessHistory ?? [])
        setPrivacyPreferences(preferences)
        setAthleteProfile(await loadAthleteProfile())
        setIsProfileReady(true)
        setDataStatus('ready')
      } catch (error) {
        if (error?.status === 401 || error?.code === 'PGRST301') {
          const { error: refreshError } = await supabase.auth.refreshSession()

          if (!refreshError) {
            try {
              const data = await loadAthleteData()
              let preferences = privacyDefaults

              try {
                preferences = (await loadPrivacyPreferences()) ?? privacyDefaults
              } catch (preferencesError) {
                console.warn(preferencesError)
              }

              if (!isMounted) return

              setSchedule(data.schedule)
              setAssociations(data.associations)
              setHistory(data.history)
              setCheckouts(data.checkouts)
              setPainReports(data.painReports)
              setPainIssues(data.painIssues)
              setSavedRoutines(data.savedRoutines)
              setRecoveryCompletions(data.recoveryCompletions ?? [])
              setShareAuditLogs(data.shareAuditLogs)
              setTournaments(data.tournaments)
              setDailyWellness(data.wellness ?? { date: todayIso, hydrationMl: 0, nutritionEntries: [] })
              setNutritionHistory(data.wellnessHistory ?? [])
              setPrivacyPreferences(preferences)
              setAthleteProfile(await loadAthleteProfile())
              setIsProfileReady(true)
              setDataStatus('ready')
              return
            } catch (retryError) {
              console.error(retryError)
            }
          }
        } else {
          console.error(error)
        }

        // A restored browser session can briefly be ahead of the first data request.
        // Give a cold browser session a few quiet attempts before surfacing a sync warning.
        if (isMounted && navigator.onLine) {
          for (const delay of [650, 1400, 2600]) {
            try {
              await new Promise((resolve) => window.setTimeout(resolve, delay))
              const data = await loadAthleteData()
              let preferences = privacyDefaults

              try {
                preferences = (await loadPrivacyPreferences()) ?? privacyDefaults
              } catch (preferencesError) {
                console.warn(preferencesError)
              }

              if (!isMounted) return

              setSchedule(data.schedule)
              setAssociations(data.associations)
              setHistory(data.history)
              setCheckouts(data.checkouts)
              setPainReports(data.painReports)
              setPainIssues(data.painIssues)
              setSavedRoutines(data.savedRoutines)
              setRecoveryCompletions(data.recoveryCompletions ?? [])
              setShareAuditLogs(data.shareAuditLogs)
              setTournaments(data.tournaments)
              setDailyWellness(data.wellness ?? { date: todayIso, hydrationMl: 0, nutritionEntries: [] })
              setNutritionHistory(data.wellnessHistory ?? [])
              setPrivacyPreferences(preferences)
              setAthleteProfile(await loadAthleteProfile())
              setIsProfileReady(true)
              setDataStatus('ready')
              return
            } catch (retryError) {
              console.warn('Supabase data retry failed.', retryError)
            }
          }
        }

        if (isMounted) {
          setIsProfileReady(true)
          setDataStatus(navigator.onLine ? 'error' : 'offline')
        }
      }
    }

    loadRemoteData()

    return () => {
      isMounted = false
    }
  }, [isSupabaseSession, todayIso])

  useEffect(() => {
    if (!isSupabaseSession) {
      return undefined
    }

    let isMounted = true

    async function validateCurrentUser() {
      const { data, error } = await supabase.auth.getUser()
      const userWasDeleted = !data.user && (
        !error
        || error.status === 401
        || error.status === 403
        || error.code === 'user_not_found'
        || error.code === 'invalid_token'
      )

      if (isMounted && userWasDeleted) {
        await resetDeletedSession()
      }
    }

    const handleFocus = () => {
      void validateCurrentUser()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void validateCurrentUser()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const intervalId = window.setInterval(validateCurrentUser, 30000)

    return () => {
      isMounted = false
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(intervalId)
    }
  }, [isSupabaseSession])

  useEffect(() => {
    return () => {
      if (lensFrameRef.current) {
        cancelAnimationFrame(lensFrameRef.current)
      }
    }
  }, [])

  function updateField(field, value) {
    if (['energy', 'soreness', 'fatigue', 'legHeaviness', 'sleepQuality'].includes(field)) {
      setCheckIn((current) => ({
        ...current,
        [field]: normalizeFivePointValue(value, field === 'energy' || field === 'sleepQuality' ? 5 : 0),
      }))
      return
    }

    if (field === 'hydrationMl') {
      const hydrationMl = Math.max(0, Number(value) || 0)

      setCheckIn((current) => ({
        ...current,
        hydration: getHydrationStatus(hydrationMl),
        hydrationMl,
      }))
      return
    }

    if (field === 'painMap') {
      const nextCheckIn = applyPainMapToCheckIn({
        ...checkIn,
        painMap: value,
      })

      setCheckIn(nextCheckIn)
      return
    }

    if (field === 'pain' && value === 0) {
      setCheckIn((current) => ({
        ...current,
        pain: 0,
        injuryType: 'Unknown',
        painType: 'No pain',
        hurtsWhen: 'At rest',
      }))
      return
    }

    if (field === 'pain' && value > 0 && checkIn.pain === 0) {
      setCheckIn((current) => ({
        ...current,
        pain: value,
        painType: 'Tight / pulling',
      }))
      return
    }

    setCheckIn((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveCheckIn(quickDraft = null) {
    if (isSavingCheckIn) return

    const validQuickDraft = quickDraft?.inputMethod === 'quick' ? quickDraft : null

    setCheckInAiError('')
    setIsSavingCheckIn(true)

    const previousEntry = isEditingToday
      ? history.find((entry) =>
          selectedCheckInEvent?.id
            ? entry.eventId === selectedCheckInEvent.id
            : entry.date === todayIso,
        )
      : null

    if (isEditingToday && previousEntry?.recommendation && areCheckInsEquivalent(scheduleDrivenCheckIn, previousEntry)) {
      setIsEditingToday(false)
      setSubmittedRecommendation(previousEntry.recommendation)
      setSubmittedRecommendationStatus('ai')
      setSubmittedRecommendationContext({
        scoreLabel: 'readiness',
        session: scheduleDrivenCheckIn.session,
        title: 'Check-in report',
      })
      setIsSavingCheckIn(false)
      return
    }

    const rawSavedCheckIn = validQuickDraft
      ? { ...scheduleDrivenCheckIn, ...validQuickDraft }
      : scheduleDrivenCheckIn
    const savedCheckIn = {
      ...rawSavedCheckIn,
      painMap: normalizePainMapScale(rawSavedCheckIn.painMap, rawSavedCheckIn.pain),
    }
    let finalRecommendation = savedCheckIn.quickRecommendation ?? null
    const finalRecommendationStatus = 'ai'

    if (!savedCheckIn.quickRecommendation) {
      try {
        const previousCheckout = getPreviousCheckout(checkouts, schedule, selectedCheckInEvent)
        const previousRecoveryCompletion = recoveryCompletions.find((completion) =>
          completion.sourceCheckoutId === previousCheckout?.id
            && String(completion.completedAt ?? '').startsWith(selectedCheckInEvent?.date ?? todayIso),
        )

        finalRecommendation = await generateAiRecommendation({
          athleteProfile,
          baseline: getPersonalBaseline(history, selectedCheckInEvent),
          checkIn: withoutNotes(savedCheckIn),
          eventPreparationContext: getCheckInPreparationContext({
            checkInTime: new Date(),
            checkouts,
            dailyWellness,
            event: selectedCheckInEvent,
            nutritionContext,
            nutritionHistory,
            schedule,
          }),
          event: attachTournamentContext(selectedCheckInEvent, tournaments, schedule),
          generatedAt: new Date().toISOString(),
          nutritionContext,
          recentEvents: checkouts.slice(0, 4).map(withoutNotes),
          sportContext: getSportContext({ athleteProfile, event: selectedCheckInEvent }),
          previousCheckout: getPreviousCheckoutRecommendationContext(previousCheckout, savedCheckIn),
          previousRecoveryCompletion: withoutNotes(previousRecoveryCompletion),
          requestType: 'check_in',
          scheduleContext: getRecommendationScheduleContext(schedule, selectedCheckInEvent),
        }, { personalize: privacyPreferences.aiPersonalizationEnabled !== false })
      } catch (error) {
        console.error('Check-in AI recommendation failed', error)
        setCheckInAiError(error?.message || 'The AI recommendation could not be generated. Please try again.')
        setIsSavingCheckIn(false)
        return
      }
    }

    if (supabase) {
      try {
        const savedEntry = isEditingToday && previousEntry?.id
          ? await updateCheckIn(previousEntry.id, savedCheckIn, finalRecommendation)
          : await createCheckIn(savedCheckIn, finalRecommendation)
        if (isEditingToday && previousEntry?.id) {
          await deletePainReportsForSource('check_in', previousEntry.id)
        }
        const savedPainReports = await createPainReports(getPainReportsWithResolutions(
          savedCheckIn.painMap,
          {
            date: savedCheckIn.eventDate ?? todayIso,
            notes: savedCheckIn.notes,
            sourceId: savedEntry.id,
            sourceType: 'check_in',
            triggerMovement: savedCheckIn.hurtsWhen,
          },
          painReports.filter((report) => report.sourceId !== previousEntry?.id),
        ))
        setHistory((current) => [
          savedEntry,
          ...current.filter((entry) =>
            savedEntry.eventId
              ? entry.eventId !== savedEntry.eventId
              : entry.date !== savedEntry.date,
          ),
        ])
        setPainReports((current) => [
          ...savedPainReports,
          ...current.filter((report) => report.sourceId !== savedEntry.id),
        ])
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        setIsSavingCheckIn(false)
        return
      }
    } else {
      setHistory((current) => [
        currentEntry,
        ...current.filter((entry) =>
          currentEntry.eventId
            ? entry.eventId !== currentEntry.eventId
            : entry.date !== currentEntry.date,
        ),
      ])
      setPainReports((current) => [
        ...getPainReportsWithResolutions(scheduleDrivenCheckIn.painMap, {
          date: scheduleDrivenCheckIn.eventDate ?? todayIso,
          notes: scheduleDrivenCheckIn.notes,
          sourceId: currentEntry.id ?? currentEntry.eventId ?? currentEntry.date,
          sourceType: 'check_in',
          triggerMovement: scheduleDrivenCheckIn.hurtsWhen,
        }, current.filter((report) => report.sourceId !== (currentEntry.id ?? currentEntry.eventId ?? currentEntry.date))).map((report) => ({
          ...report,
          id: `pain-${Date.now()}-${report.bodyPart}`,
        })),
        ...current.filter((report) =>
          report.sourceId !== (currentEntry.id ?? currentEntry.eventId ?? currentEntry.date)
        ),
      ])
    }

    setIsEditingToday(false)
    setSubmittedRecommendation(finalRecommendation)
    setSubmittedRecommendationStatus(finalRecommendationStatus)
    setSubmittedRecommendationContext({
      scoreLabel: 'readiness',
      session: scheduleDrivenCheckIn.session,
      title: 'Check-in report',
    })
    setIsSavingCheckIn(false)
  }

  async function updateScheduleItem(id, updates) {
    const previousEvent = schedule.find((item) => item.id === id)
    setSchedule((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    )

    if (!isSupabaseSession) {
      return true
    }

    try {
      const savedEvent = await updateScheduleEvent(id, updates)
      setSchedule((current) => current.map((item) => item.id === id ? savedEvent : item))
      setDataStatus('synced')
      return true
    } catch (error) {
      console.error(error)
      if (previousEvent) setSchedule((current) => current.map((item) => item.id === id ? previousEvent : item))
      setDataStatus('error')
      return false
    }
  }

  async function addScheduleItem(event) {
    const eventToSave = {
      ...event,
      load: event.type === 'Other activity' ? event.load ?? 'Medium' : getDefaultLoadForEvent(event.type),
      title: getEventDisplayName(event),
    }

    if (isSupabaseSession) {
      try {
        const savedEvent = await createScheduleEvent(eventToSave)
        setSchedule((current) => [...current, savedEvent])
        setDataStatus('synced')
        if (onboardingTour === 'schedule') {
          setOnboardingTour('checkin-nav')
        }
        return true
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return false
      }
    }

    setSchedule((current) => [...current, eventToSave])
    if (onboardingTour === 'schedule') {
      setOnboardingTour('checkin-nav')
    }
    return true
  }

  async function addTournament(tournamentDraft, games) {
    const localTournament = {
      ...tournamentDraft,
      id: tournamentDraft.id ?? `tournament-${Date.now()}`,
    }

    if (!isSupabaseSession) {
      const localGames = games.map((game, index) => ({
        ...game,
        id: game.id ?? `tournament-game-${Date.now()}-${index}`,
        tournamentId: localTournament.id,
      }))
      setTournaments((current) => [...current, localTournament])
      setSchedule((current) => [...current, ...localGames])
      return true
    }

    try {
      const savedTournament = await createTournament(localTournament)
      const savedGames = []

      for (const game of games) {
        savedGames.push(await createScheduleEvent({
          ...game,
          tournamentId: savedTournament.id,
          load: getDefaultLoadForEvent('Game'),
          title: 'Game',
          type: 'Game',
        }))
      }

      setTournaments((current) => [...current, savedTournament])
      setSchedule((current) => [...current, ...savedGames])
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function editTournament(tournamentDraft, games) {
    const existingGames = schedule.filter((event) => event.tournamentId === tournamentDraft.id)
    const incomingIds = new Set(games.map((game) => game.id).filter(Boolean))

    for (const oldGame of existingGames) {
      if (!incomingIds.has(oldGame.id)) await removeScheduleItem(oldGame.id)
    }

    for (const game of games) {
      const gameToSave = { ...game, tournamentId: tournamentDraft.id, load: 'High', title: 'Game', type: 'Game' }
      if (game.id) await updateScheduleItem(game.id, gameToSave)
      else await addScheduleItem(gameToSave)
    }

    const updatedTournament = { ...tournamentDraft, id: tournamentDraft.id }
    if (!isSupabaseSession) {
      setTournaments((current) => current.map((item) => item.id === updatedTournament.id ? updatedTournament : item))
      return true
    }

    try {
      const saved = await updateTournament(updatedTournament.id, updatedTournament)
      setTournaments((current) => current.map((item) => item.id === saved.id ? saved : item))
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function removeTournament(tournamentId) {
    const games = schedule.filter((event) => event.tournamentId === tournamentId)
    for (const game of games) await removeScheduleItem(game.id)
    setTournaments((current) => current.filter((tournament) => tournament.id !== tournamentId))

    if (!isSupabaseSession) return

    try {
      await deleteTournament(tournamentId)
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function removeScheduleItem(id) {
    const relatedCheckIns = history.filter((entry) => entry.eventId === id)
    const relatedCheckouts = checkouts.filter((checkout) => checkout.eventId === id)
    const relatedSourceIds = new Set([
      ...relatedCheckIns.map((entry) => entry.id),
      ...relatedCheckouts.map((checkout) => checkout.id),
    ].filter(Boolean))

    setSchedule((current) => current.filter((item) => item.id !== id))
    setHistory((current) => current.filter((entry) => entry.eventId !== id))
    setCheckouts((current) => current.filter((checkout) => checkout.eventId !== id))
    setPainReports((current) =>
      current.filter((report) => !relatedSourceIds.has(report.sourceId)),
    )

    if (selectedCheckInEventId === id) {
      setSelectedCheckInEventId(null)
      setCheckIn(getFreshCheckInDefaults())
      setIsEditingToday(false)
    }

    if (checkoutEvent?.id === id) {
      setCheckoutEvent(null)
    }

    if (!isSupabaseSession) {
      return
    }

    try {
      await Promise.all([
        ...relatedCheckIns
          .filter((entry) => entry.id)
          .map((entry) => deletePainReportsForSource('check_in', entry.id)),
        ...relatedCheckouts
          .filter((checkout) => checkout.id)
          .map((checkout) => deletePainReportsForSourceId(checkout.id)),
      ])
      await deleteCheckInsForEvent(id)
      await deleteTrainingCheckoutsForEvent(id)
      await deleteScheduleEvent(id)
      setDataStatus('synced')
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function clearHistory(cutoffDate) {
    if (isSupabaseSession) {
      try {
        await clearCheckIns(cutoffDate)
        await clearTrainingCheckouts(cutoffDate)
        await clearPainReports(cutoffDate)
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return
      }
    }

    setHistory((current) =>
      cutoffDate
        ? current.filter((entry) => !entry.date || entry.date < cutoffDate)
        : [],
    )
    setCheckouts((current) =>
      cutoffDate
        ? current.filter((entry) => !entry.date || entry.date < cutoffDate)
        : [],
    )
    setPainReports((current) =>
      cutoffDate
        ? current.filter((entry) => !entry.date || entry.date < cutoffDate)
        : [],
    )
  }

  async function saveDailyWellness(nextWellness) {
    const wellness = {
      date: nextWellness.date ?? todayIso,
      hydrationMl: Math.max(0, Number(nextWellness.hydrationMl ?? 0)),
      nutritionEntries: nextWellness.nutritionEntries ?? [],
      mealTiming: nextWellness.mealTiming ?? {},
      nutritionGoalOverride: nextWellness.nutritionGoalOverride ?? {},
    }

    if (wellness.date === todayIso) setDailyWellness(wellness)
    setNutritionHistory((current) => [wellness, ...current.filter((entry) => entry.date !== wellness.date)])

    if (!isSupabaseSession) return

    try {
      const savedWellness = await upsertDailyWellness(wellness)
      if (savedWellness.date === todayIso) setDailyWellness(savedWellness)
      setNutritionHistory((current) => [savedWellness, ...current.filter((entry) => entry.date !== savedWellness.date)])
      setDataStatus('synced')
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function savePainIssue(nextIssue) {
    const existing = nextIssue.id
      ? painIssues.find((issue) => issue.id === nextIssue.id)
      : null
    const issue = {
      ...existing,
      ...nextIssue,
      resolvedDate: nextIssue.status === 'resolved' ? (nextIssue.resolvedDate ?? todayIso) : null,
    }

    if (!isSupabaseSession) {
      setPainIssues((current) => existing
        ? current.map((item) => item.id === issue.id ? issue : item)
        : [{ ...issue, id: `pain-issue-${Date.now()}` }, ...current])
      return
    }

    try {
      const savedIssue = existing
        ? await updatePainIssue(existing.id, issue)
        : await createPainIssue(issue)
      setPainIssues((current) => existing
        ? current.map((item) => item.id === savedIssue.id ? savedIssue : item)
        : [savedIssue, ...current])
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function deleteHistoryEntry(entry, kind) {
    if (!entry?.id) return

    if (kind === 'recovery') {
      const checkout = checkouts.find((item) => item.id === entry.id)
      const event = schedule.find((item) => item.id === checkout?.eventId)
      if (!checkout || !event) return

      const recommendation = { ...(checkout.recommendation ?? {}) }
      delete recommendation.recoveryPlan
      const updatedCheckout = { ...checkout, recommendation }
      setCheckouts((current) => [updatedCheckout, ...current.filter((item) => item.id !== checkout.id)])

      if (isSupabaseSession) {
        try {
          const savedCheckout = await updateTrainingCheckout(checkout.id, event, updatedCheckout)
          setCheckouts((current) => [savedCheckout, ...current.filter((item) => item.id !== savedCheckout.id)])
        } catch (error) {
          console.error(error)
          setDataStatus('error')
        }
      }
      return
    }

    if (kind === 'checkout') {
      setCheckouts((current) => current.filter((item) => item.id !== entry.id))
      setPainReports((current) => current.filter((report) => report.sourceId !== entry.id))

      if (isSupabaseSession) {
        try {
          await deletePainReportsForSourceId(entry.id)
          await deleteTrainingCheckout(entry.id)
        } catch (error) {
          console.error(error)
          setDataStatus('error')
        }
      }
      return
    }

    setHistory((current) => current.filter((item) => item.id !== entry.id))
    setPainReports((current) => current.filter((report) => report.sourceId !== entry.id))

    if (isSupabaseSession) {
      try {
        await deletePainReportsForSource('check_in', entry.id)
        await deleteCheckIn(entry.id)
      } catch (error) {
        console.error(error)
        setDataStatus('error')
      }
    }
  }

  async function addAssociation(name) {
    const trimmedName = name.trim()

    if (!trimmedName) return
    if (trimmedName.toLowerCase() === 'personal') return
    if (associations.some((item) => item.name.toLowerCase() === trimmedName.toLowerCase())) return

    if (isSupabaseSession) {
      try {
        const savedAssociation = await createAssociation(trimmedName)
        setAssociations((current) => [...current, savedAssociation])
      } catch (error) {
        console.error(error)
        setDataStatus('error')
      }
      return
    }

    setAssociations((current) => [
      ...current,
      { id: `association-${Date.now()}`, name: trimmedName },
    ])
  }

  async function renameAssociation(id, name) {
    const trimmedName = name.trim()

    if (!trimmedName) return
    if (trimmedName.toLowerCase() === 'personal') return

    setAssociations((current) =>
      current.map((association) =>
        association.id === id ? { ...association, name: trimmedName } : association,
      ),
    )

    if (!isSupabaseSession) return

    try {
      await updateAssociation(id, trimmedName)
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function removeAssociation(id) {
    const association = associations.find((item) => item.id === id)

    setAssociations((current) => current.filter((item) => item.id !== id))

    if (association) {
      setSchedule((current) =>
        current.map((event) =>
          event.association === association.name ? { ...event, association: 'Personal' } : event,
        ),
      )
    }

    if (!isSupabaseSession) return

    try {
      await deleteAssociation(id)
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function saveCheckout(event, checkout, existingCheckout) {
    const preCheckIn = history.find((entry) => entry.eventId === event.id)
    checkout = {
      ...checkout,
      painMap: normalizePainMapScale(checkout.painMap, preCheckIn?.pain),
    }
    let finalRecommendation = existingCheckout?.recommendation ?? null
    let finalRecommendationStatus = existingCheckout?.recommendation?._source === 'gemini' ? 'ai' : 'loading'

    if (supabase) {
      try {
        const previousCheckout = getPreviousCheckout(checkouts, schedule, event)

        finalRecommendation = await generateAiRecommendation({
          athleteProfile,
          checkout: withoutNotes(checkout),
          completedEvent: attachTournamentContext(event, tournaments, schedule),
          dailyWellness: getCheckoutWellnessContext(dailyWellness, nutritionContext),
          generatedAt: new Date().toISOString(),
          nextScheduledEvent: getNextScheduledEvent(schedule, event),
          nutritionContext,
          preCheckIn: withoutNotes(preCheckIn),
          previousCheckout: withoutNotes(previousCheckout),
          recentEvents: checkouts.filter((item) => item.id !== existingCheckout?.id).slice(0, 4).map(withoutNotes),
          requestType: 'post_checkout',
          scheduleContext: getRecommendationScheduleContext(schedule, event),
          sportContext: getSportContext({ athleteProfile, event, workload: checkout.sportWorkload }),
        }, { personalize: privacyPreferences.aiPersonalizationEnabled !== false })
        finalRecommendationStatus = 'ai'
      } catch (error) {
        console.error(error)
        throw new Error(`AI recovery plan failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    const checkoutWithRecommendation = {
      ...checkout,
      recommendation: finalRecommendation,
    }

    setGeneratedRecoveryPlan(null)
    setRecoveryPlanStatus('idle')

    if (isSupabaseSession) {
      let savedCheckout

      try {
        savedCheckout = existingCheckout
          ? await updateTrainingCheckout(existingCheckout.id, event, checkoutWithRecommendation)
          : await createTrainingCheckout(event, checkoutWithRecommendation)
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        throw error
      }

      let savedPainReports = []
      try {
        if (existingCheckout?.id) {
          await deletePainReportsForSource('checkout', existingCheckout.id)
        }

        savedPainReports = await createPainReports(getPainReportsFromMap(
          checkout.painMap,
          {
            date: event.date,
            notes: '',
            sourceId: savedCheckout.id,
            sourceType: 'checkout',
            triggerMovement: checkout.painChange,
          },
        ))
      } catch (error) {
        console.error(error)
        setDataStatus('error')
      }

      setCheckouts((current) => [
        savedCheckout,
        ...current.filter((item) => item.id !== savedCheckout.id),
      ])
      setPainReports((current) => [
        ...savedPainReports,
        ...current.filter((report) => report.sourceId !== savedCheckout.id),
      ])
      setCheckoutEvent(null)
      setSubmittedRecommendation(finalRecommendation)
      setSubmittedRecommendationStatus(finalRecommendationStatus)
      setSubmittedRecommendationContext({
        scoreLabel: 'recovery',
        session: event.title || event.type,
        title: 'Checkout report',
      })
      if (savedCheckout.recommendationNotPersisted) {
        setDataStatus('offline')
      }
      advanceCheckInAfterCheckout(event, savedCheckout)
      return
    }

    const savedCheckout = {
      ...checkout,
      actualMinutes: Number(checkout.actualMinutes),
      completionLevel: checkout.participation,
      createdAt: new Date().toISOString(),
      date: event.date,
      difficulty: Number(checkout.difficulty),
      eventId: event.id,
      id: existingCheckout?.id ?? `checkout-${Date.now()}`,
      painChange: checkout.painChange,
      painMap: checkout.painMap,
      plannedLoad: event.load,
      plannedMinutes: Number(checkout.plannedMinutes),
      plannedType: event.type,
      recommendation: finalRecommendation,
      title: event.title || event.type,
    }

    setCheckouts((current) => [
      savedCheckout,
      ...current.filter((item) => item.id !== savedCheckout.id),
    ])
    setPainReports((current) => [
      ...getPainReportsFromMap(checkout.painMap, {
        date: event.date,
        notes: '',
        sourceId: savedCheckout.id,
        sourceType: 'checkout',
        triggerMovement: checkout.painChange,
      }).map((report) => ({
        ...report,
        id: `pain-${Date.now()}-${report.bodyPart}`,
      })),
      ...current.filter((report) => report.sourceId !== savedCheckout.id),
    ])
    setCheckoutEvent(null)
    setSubmittedRecommendation(finalRecommendation)
    setSubmittedRecommendationStatus(finalRecommendationStatus)
    setSubmittedRecommendationContext({
      scoreLabel: 'recovery',
      session: event.title || event.type,
      title: 'Checkout report',
    })
    advanceCheckInAfterCheckout(event, savedCheckout)
  }

  async function generateRecoveryPlan({ equipment, planType, targetedAreas, timeAvailable }) {
    const latestCheckout = [...checkouts]
      .sort((first, second) => new Date(second.createdAt ?? `${second.date}T12:00:00`) - new Date(first.createdAt ?? `${first.date}T12:00:00`))[0]

    if (!latestCheckout && planType === 'last-checkout') {
      setRecoveryPlanStatus('error')
      return
    }

    const usesCheckoutContext = ['last-checkout', 'competition'].includes(planType)
    const contextCheckout = usesCheckoutContext ? latestCheckout : null
    const completedEvent = contextCheckout ? schedule.find((event) => event.id === contextCheckout.eventId) : null
    const preCheckIn = contextCheckout ? history.find((entry) => entry.eventId === contextCheckout.eventId) : null
    const nextScheduledEvent = completedEvent ? getNextScheduledEvent(schedule, completedEvent) : nextEvent
    const latestSavedCheckIn = [...history].sort((first, second) => new Date(second.createdAt ?? `${second.date}T12:00:00`) - new Date(first.createdAt ?? `${first.date}T12:00:00`))[0]
    const checkoutTime = latestCheckout ? new Date(latestCheckout.createdAt ?? `${latestCheckout.date}T12:00:00`).getTime() : 0
    const checkInTime = latestSavedCheckIn ? new Date(latestSavedCheckIn.createdAt ?? `${latestSavedCheckIn.date}T12:00:00`).getTime() : 0
    const currentBodyReport = checkoutTime >= checkInTime ? latestCheckout : latestSavedCheckIn
    const currentPainMap = normalizePainMapScale(currentBodyReport?.painMap ?? {}, currentBodyReport?.pain)
    const activePain = Object.fromEntries(Object.entries(currentPainMap).filter(([, severity]) => Number(severity) > 0))
    const currentRecoveryContext = {
      fatigue: Number(currentBodyReport?.postFatigue ?? currentBodyReport?.fatigue ?? 0),
      pain: Math.max(0, ...Object.values(activePain).map(Number)),
      painMap: activePain,
      restrictions: Object.keys(activePain),
      soreness: Number(currentBodyReport?.postSoreness ?? currentBodyReport?.soreness ?? 0),
      sourceCreatedAt: currentBodyReport?.createdAt ?? currentBodyReport?.date ?? null,
      sourceType: currentBodyReport === latestCheckout ? 'checkout' : 'check-in',
    }
    const recentRoutineSequences = [
      ...savedRoutines.map((item) => item?.routine?.routine?.exercises ?? item?.routine?.exercises ?? []),
      ...checkouts.map((item) => item?.recommendation?.recoveryPlan?.routine?.exercises ?? []),
    ].map((routine) => routine.map((exercise) => exercise?.name).filter(Boolean)).filter((routine) => routine.length > 0).slice(0, 6)
    const recentRoutineExerciseNames = recentRoutineSequences.flat().slice(0, 60)
    const weekStart = Date.now() - (7 * 24 * 60 * 60 * 1000)
    const weeklySessions = checkouts.filter((item) => new Date(item.createdAt ?? `${item.date}T12:00:00`).getTime() >= weekStart)
    const weeklyWorkloadContext = {
      activities: [...new Set(weeklySessions.map((item) => item.eventType ?? item.sessionType ?? item.title).filter(Boolean))],
      averageIntensity: weeklySessions.length
        ? Math.round((weeklySessions.reduce((sum, item) => sum + Number(item.difficulty ?? item.actualIntensity ?? 0), 0) / weeklySessions.length) * 10) / 10
        : 0,
      sessions: weeklySessions.length,
      totalMinutes: weeklySessions.reduce((sum, item) => sum + Number(item.actualMinutes ?? item.duration ?? 0), 0),
      totalSessionLoad: weeklySessions.reduce((sum, item) => sum + (Number(item.actualMinutes ?? item.duration ?? 0) * Number(item.difficulty ?? item.actualIntensity ?? 0)), 0),
    }

    setRecoveryPlanStatus('loading')
    setIsReplayingSavedRoutine(false)

    try {
      const plan = await generateAiRecommendation({
        athleteProfile,
        checkout: withoutNotes(contextCheckout),
        completedEvent: completedEvent ? attachTournamentContext(completedEvent, tournaments, schedule) : null,
        currentRecoveryContext,
        dailyWellness,
        equipment,
        generatedAt: new Date().toISOString(),
        nextScheduledEvent,
        nutritionContext,
        planType,
        preCheckIn: withoutNotes(preCheckIn),
        recentPainReports: painReports.slice(0, 12).map(withoutNotes),
        recentEvents: checkouts.slice(0, 4).map(withoutNotes),
        recentRoutineExerciseNames,
        recentRoutineSequences,
        recoveryCompletions: recoveryCompletions.slice(0, 5),
        requestType: 'recovery_plan',
        scheduleContext: getRecommendationScheduleContext(schedule, completedEvent ?? nextScheduledEvent),
        sportContext: getSportContext({ athleteProfile, event: completedEvent, workload: latestCheckout?.sportWorkload }),
        targetedAreas,
        timeAvailable,
        variationKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        weeklyWorkloadContext,
      }, { personalize: privacyPreferences.aiPersonalizationEnabled !== false })

      setGeneratedRecoveryPlan(plan)
      setGeneratedRecoveryCheckoutId(contextCheckout?.id ?? null)
      setIsGeneratedRecoveryPlanSaved(false)
      setRecoveryPlanStatus('ai')
    } catch (error) {
      console.error(error)
      setRecoveryPlanStatus('error')
    }
  }

  async function saveRecoveryPlan(plan) {
    const checkoutId = generatedRecoveryCheckoutId
    const checkout = checkouts.find((item) => item.id === checkoutId)
    const completedEvent = schedule.find((event) => event.id === checkout?.eventId)

    if (!plan) return false

    if (!checkout || !completedEvent) {
      const completion = {
        completedAt: new Date().toISOString(),
        details: { plan },
        id: `recovery-completion-${Date.now()}`,
        routineId: null,
        sourceCheckoutId: null,
      }
      if (isSupabaseSession) {
        try {
          const savedCompletion = await createRecoveryRoutineCompletion(completion)
          setRecoveryCompletions((current) => [savedCompletion, ...current])
        } catch (error) {
          console.error(error)
          setDataStatus('error')
          return false
        }
      } else {
        setRecoveryCompletions((current) => [completion, ...current])
      }
      setGeneratedRecoveryPlan(null)
      setGeneratedRecoveryCheckoutId(null)
      setIsGeneratedRecoveryPlanSaved(false)
      return true
    }

    const updatedCheckout = {
      ...checkout,
      recommendation: {
        ...(checkout.recommendation ?? {}),
        recoveryPlan: plan,
      },
    }

    setCheckouts((current) => [updatedCheckout, ...current.filter((item) => item.id !== checkout.id)])

    if (isSupabaseSession) {
      try {
        const savedCheckout = await updateTrainingCheckout(checkout.id, completedEvent, updatedCheckout)
        setCheckouts((current) => [savedCheckout, ...current.filter((item) => item.id !== savedCheckout.id)])
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return false
      }
    }

    setGeneratedRecoveryPlan(null)
    setGeneratedRecoveryCheckoutId(null)
    setIsGeneratedRecoveryPlanSaved(false)
    return true
  }

  async function favoriteRecoveryRoutine(entry) {
    const plan = entry?.recommendation?.recoveryPlan
    if (!plan?.routine) return

    const existing = savedRoutines.find((routine) => routine.sourceCheckoutId === entry.id)
    const routine = {
      ...existing,
      isFavorite: !existing?.isFavorite,
      routine: plan,
      sourceCheckoutId: entry.id,
      title: plan.routine.title ?? 'Recovery routine',
    }

    if (!isSupabaseSession) {
      const localRoutine = { ...routine, id: existing?.id ?? `saved-routine-${Date.now()}` }
      setSavedRoutines((current) => existing
        ? current.map((item) => item.id === existing.id ? localRoutine : item)
        : [localRoutine, ...current])
      return
    }

    try {
      const saved = existing
        ? await updateSavedRecoveryRoutine(existing.id, routine)
        : await createSavedRecoveryRoutine(routine)
      setSavedRoutines((current) => existing
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current])
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function reportRoutinePain(report) {
    const severity = Number(report.severity)
    if (!report?.area || !Number.isFinite(severity) || severity <= 0) return

    const matchedArea = bodyPainAreas.find((area) => normalizePainAreaName(area.label) === normalizePainAreaName(report.area))
    const painReport = {
      bodyPart: matchedArea?.label ?? report.area,
      date: todayIso,
      notes: `Reported during recovery exercise: ${report.exercise ?? 'movement'}${report.type ? ` (${report.type})` : ''}${report.sameIssue ? `. Previously reported issue: ${report.sameIssue}` : ''}`,
      severity,
      side: matchedArea?.side ?? (/\bleft\b/i.test(report.area) ? 'left' : /\bright\b/i.test(report.area) ? 'right' : 'center'),
      sourceId: report.checkoutId,
      sourceType: 'recovery_routine',
      triggerMovement: report.exercise ?? '',
    }

    if (!isSupabaseSession) {
      setPainReports((current) => [{ ...painReport, id: `routine-pain-${Date.now()}`, createdAt: new Date().toISOString() }, ...current])
      return
    }

    try {
      const [saved] = await createPainReports([painReport])
      setPainReports((current) => [saved, ...current])
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function recordPainIssueShare(issue, recipientLabel) {
    const entry = {
      recipientLabel,
      reportReferenceId: issue.id ?? null,
      reportType: 'pain_issue_summary',
    }

    if (!isSupabaseSession) {
      setShareAuditLogs((current) => [{ ...entry, id: `share-${Date.now()}`, createdAt: new Date().toISOString() }, ...current])
      return true
    }

    try {
      const saved = await createShareAuditLog(entry)
      setShareAuditLogs((current) => [saved, ...current])
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function removeShareAuditLog(id) {
    setShareAuditLogs((current) => current.filter((entry) => entry.id !== id))

    if (!isSupabaseSession || String(id).startsWith('share-')) return

    try {
      await deleteShareAuditLog(id)
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function updateReminderPreference(enabled) {
    let remindersEnabled = Boolean(enabled)

    if (remindersEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      remindersEnabled = permission === 'granted'
    }

    if (remindersEnabled && (typeof Notification === 'undefined' || Notification.permission !== 'granted')) {
      return false
    }

    const nextPreferences = { ...privacyPreferences, remindersEnabled }
    setPrivacyPreferences(nextPreferences)

    if (!isSupabaseSession) return true

    try {
      const saved = await upsertPrivacyPreferences(nextPreferences)
      setPrivacyPreferences(saved)
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function updateAiPersonalizationPreference(enabled) {
    const nextPreferences = { ...privacyPreferences, aiPersonalizationEnabled: Boolean(enabled) }
    setPrivacyPreferences(nextPreferences)

    if (!isSupabaseSession) return true

    try {
      const saved = await upsertPrivacyPreferences(nextPreferences)
      setPrivacyPreferences(saved)
      return true
    } catch (error) {
      console.error('Unable to save AI personalization preference', error)
      setDataStatus('error')
      return false
    }
  }

  function replaySavedRoutine(routine) {
    setGeneratedRecoveryPlan(routine.routine)
    setGeneratedRecoveryCheckoutId(null)
    setIsGeneratedRecoveryPlanSaved(false)
    setIsReplayingSavedRoutine(true)
    setReplayingRoutineId(routine.id)
    setRecoveryPlanStatus('saved')
  }

  async function completeSavedRoutine(details) {
    const routine = savedRoutines.find((item) => item.id === replayingRoutineId)
    if (!routine) return

    let completion = {
      completedAt: details.completedAt ?? new Date().toISOString(),
      details,
      id: `recovery-completion-${Date.now()}`,
      routineId: routine.id,
      sourceCheckoutId: routine.sourceCheckoutId,
    }

    if (isSupabaseSession) {
      try {
        const savedCompletion = await createRecoveryRoutineCompletion({
          details,
          routineId: routine.id,
          sourceCheckoutId: routine.sourceCheckoutId,
        })
        completion = {
          completedAt: savedCompletion.completed_at,
          details: savedCompletion.completion_json ?? details,
          id: savedCompletion.id,
          routineId: savedCompletion.routine_id,
          sourceCheckoutId: savedCompletion.source_checkout_id,
        }
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return
      }
    }

    setRecoveryCompletions((current) => [completion, ...current])

    setIsReplayingSavedRoutine(false)
    setReplayingRoutineId(null)
    setGeneratedRecoveryPlan(null)
    setRecoveryPlanStatus('idle')
  }


  function advanceCheckInAfterCheckout(event, savedCheckout) {
    if (event.date !== todayIso) return

    const completedEventIds = new Set([
      ...checkouts.map((item) => item.eventId),
      savedCheckout.eventId,
    ])
    const nextEvent = getNextTodayEventAfter(schedule, event.id, todayIso, completedEventIds)

    if (nextEvent) {
      const existingEntry = history.find((entry) => entry.eventId === nextEvent.id)

      setSelectedCheckInEventId(nextEvent.id)
      setIsEditingToday(false)
      setCheckIn((current) =>
        existingEntry
          ? checkInFromHistoryEntry(existingEntry, current)
          : {
              ...getFreshCheckInDefaults(),
              ...getSharedSleepContext(history, todayIso),
              hydration: getHydrationStatus(dailyWellness.hydrationMl),
              hydrationMl: dailyWellness.hydrationMl,
            },
      )
    }
  }

  function openPreCheckIn(event) {
    if (!isInsideCheckInWindow(event)) return
    if (event?.id !== currentTodayCheckInEvent?.id) return

    setSelectedCheckInEventId(event?.id ?? null)
    setIsEditingToday(false)
    setCheckIn({
      ...getFreshCheckInDefaults(),
      hydration: getHydrationStatus(dailyWellness.hydrationMl),
      hydrationMl: dailyWellness.hydrationMl,
    })
    setActiveView('Check-in')
  }

  function openCheckout(event) {
    if (!isEventActionable(event)) return
    setCheckoutEvent(event)
  }

  function selectCheckInEvent(eventId) {
    const event = checkInEventOptions.find((item) => item.id === eventId)

    if (!event || event.date !== todayIso) {
      return
    }

    if (event.id !== currentTodayCheckInEvent?.id) {
      return
    }

    const existingEntry = history.find((entry) => entry.eventId === event.id)

    setSelectedCheckInEventId(event.id)
    setIsEditingToday(false)
    setCheckIn((current) =>
      existingEntry
        ? checkInFromHistoryEntry(existingEntry, current)
        : {
            ...getFreshCheckInDefaults(),
            ...getSharedSleepContext(history, todayIso),
            hydration: getHydrationStatus(dailyWellness.hydrationMl),
            hydrationMl: dailyWellness.hydrationMl,
          },
    )
  }

  function startDemoSession(email) {
    setSession({
      user: {
        email,
      },
    })
    setIsAppUnlocked(true)
  }

  function unlockRememberedSession() {
    setIsAppUnlocked(true)
  }

  async function completeOnboarding({ profile, association }) {
    const profileToSave = {
      ...profile,
      onboardingCompleted: false,
    }

    if (isSupabaseSession) {
      const savedProfile = await upsertAthleteProfile(profileToSave)
      setAthleteProfile(savedProfile)
    } else {
      setAthleteProfile(profileToSave)
    }

    setOnboardingAssociation(association || 'Personal')
    setOnboardingTour('schedule')
    setActiveView('Schedule')
  }

  async function createOnboardingAssociation(name) {
    const trimmedName = name.trim()
    if (!trimmedName) return null

    await addAssociation(trimmedName)
    return { name: trimmedName }
  }

  async function finishOnboardingTour() {
    setOnboardingTour(null)
    await completeOnboardingSetup()
  }

  async function unlockAfterOnboarding() {
    await completeOnboardingSetup()
  }

  async function completeOnboardingSetup() {
    const completedProfile = { ...athleteProfile, onboardingCompleted: true }

    if (isSupabaseSession) {
      const savedProfile = await upsertAthleteProfile(completedProfile)
      setAthleteProfile(savedProfile)
    } else {
      setAthleteProfile(completedProfile)
    }

    setOnboardingCompleteOpen(false)
    setActiveView('Home')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }

  function advanceOnboardingTour() {
    if (onboardingTour === 'schedule-review') {
      setOnboardingTour('checkin-nav')
    } else if (onboardingTour === 'checkin') {
      setOnboardingTour('nutrition-nav')
    } else if (onboardingTour === 'nutrition') {
      setOnboardingTour('recovery-nav')
    } else if (onboardingTour === 'recovery') {
      setOnboardingTour('home-nav')
    } else if (onboardingTour === 'home') {
      setOnboardingTour('history-nav')
    } else if (onboardingTour === 'history') {
      finishOnboardingTour()
    }
  }

  function rewindOnboardingTour() {
    if (onboardingTour === 'checkin-nav') {
      setActiveView('Schedule')
      setOnboardingTour('schedule-review')
    } else if (onboardingTour === 'checkin') {
      setOnboardingTour('checkin-nav')
    } else if (onboardingTour === 'home-nav') {
      setActiveView('Recovery')
      setOnboardingTour('recovery')
    } else if (onboardingTour === 'home') {
      setOnboardingTour('home-nav')
    } else if (onboardingTour === 'recovery-nav') {
      setActiveView('Nutrition')
      setOnboardingTour('nutrition')
    } else if (onboardingTour === 'recovery') {
      setOnboardingTour('recovery-nav')
    } else if (onboardingTour === 'nutrition-nav') {
      setActiveView('Check-in')
      setOnboardingTour('checkin')
    } else if (onboardingTour === 'nutrition') {
      setOnboardingTour('nutrition-nav')
    } else if (onboardingTour === 'history-nav') {
      setActiveView('Home')
      setOnboardingTour('home')
    } else if (onboardingTour === 'history') {
      setOnboardingTour('history-nav')
    }
  }

  function handleTourNavigation(view) {
    if (onboardingTour === 'checkin-nav' && view === 'Check-in') {
      setOnboardingTour('checkin')
    } else if (onboardingTour === 'nutrition-nav' && view === 'Nutrition') {
      setOnboardingTour('nutrition')
    } else if (onboardingTour === 'recovery-nav' && view === 'Recovery') {
      setOnboardingTour('recovery')
    } else if (onboardingTour === 'home-nav' && view === 'Home') {
      setOnboardingTour('home')
    } else if (onboardingTour === 'history-nav' && view === 'History') {
      setOnboardingTour('history')
    }
  }

  function finishAuthentication(nextSession) {
    setSession(nextSession)
    setIsAppUnlocked(true)
    setAuthEntryMode('landing')
  }

  async function updateAthleteProfile(profile) {
    const nextProfile = {
      ...athleteProfile,
      ...profile,
      onboardingCompleted: true,
    }

    if (isSupabaseSession) {
      const savedProfile = await upsertAthleteProfile(nextProfile)
      setAthleteProfile(savedProfile)
      return
    }

    setAthleteProfile(nextProfile)
  }

  async function clearAllHealthHistory({ remotelyCleared = false } = {}) {
    if (isSupabaseSession && !remotelyCleared) {
      try {
        await Promise.all([
          clearCheckIns(),
          clearTrainingCheckouts(),
          clearPainReports(),
        ])
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return
      }
    }

    setHistory([])
    setCheckouts([])
    setPainReports([])
  }

  function editTodayCheckIn() {
    const todayEntry = history.find((entry) =>
      selectedCheckInEvent?.id
        ? entry.eventId === selectedCheckInEvent.id
        : entry.date === todayIso,
    )

    setCheckIn((current) => checkInFromHistoryEntry(todayEntry, current))
    setIsEditingToday(true)
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut()
    }

    setSession(null)
    setIsAppUnlocked(false)
    setActiveView('Home')
  }

  async function resetDeletedSession() {
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' })
    }

    clearUserStorage()
    setSchedule([])
    setAssociations([])
    setHistory([])
    setCheckouts([])
    setPainReports([])
    setPainIssues([])
    setSavedRoutines([])
    setRecoveryCompletions([])
    setShareAuditLogs([])
    setTournaments([])
    setAthleteProfile(null)
    setDailyWellness({ date: todayIso, hydrationMl: 0, nutritionEntries: [] })
    setNutritionHistory([])
    setPrivacyPreferences(privacyDefaults)
    setSession(null)
    setIsAppUnlocked(false)
    setIsProfileReady(false)
    setAuthEntryMode('landing')
    setOnboardingTour(null)
    setOnboardingCompleteOpen(false)
    setDataStatus('idle')
    setActiveView('Home')
  }

  function getNearestTab(pointerX) {
    const nav = navRef.current

    if (!nav) {
      return activeView
    }

    const tabs = [...nav.querySelectorAll('button[data-view]')]
    const nearestTab = tabs.reduce((nearest, tab) => {
      const rect = tab.getBoundingClientRect()
      const tabCenter = rect.left + rect.width / 2
      const distance = Math.abs(pointerX - tabCenter)

      if (!nearest || distance < nearest.distance) {
        return {
          distance,
          height: rect.height,
          label: tab.dataset.view,
          width: rect.width,
        }
      }

      return nearest
    }, null)

    return nearestTab ?? { height: 72, label: activeView, width: 106 }
  }

  function getLensState(event) {
    const nav = navRef.current

    if (!nav) {
      return null
    }

    const navRect = nav.getBoundingClientRect()
    const nearestTab = getNearestTab(event.clientX)
    const lensWidth = nearestTab.width
    const lensHeight = nearestTab.height
    const horizontalPadding = lensWidth / 2
    const left = Math.max(
      horizontalPadding,
      Math.min(event.clientX - navRect.left, navRect.width - horizontalPadding),
    )

    return {
      activeLabel: nearestTab.label,
      height: lensHeight,
      left,
      top: navRect.height / 2,
      width: lensWidth,
      navWidth: navRect.width,
    }
  }

  function getTourNavigationTarget() {
    return {
      'checkin-nav': 'Check-in',
      'home-nav': 'Home',
      'history-nav': 'History',
    }[onboardingTour]
  }

  function selectNavigationView(view) {
    const requiredView = getTourNavigationTarget()

    if (requiredView && view !== requiredView) {
      return
    }

    if (view === 'Check-in' && activeView !== 'Check-in') {
      const event = currentTodayCheckInEvent
      const existingEntry = event
        ? history.find((entry) => entry.eventId === event.id)
        : null

      setSelectedCheckInEventId(event?.id ?? null)
      setIsEditingToday(false)
      setCheckIn(
        existingEntry
          ? checkInFromHistoryEntry(existingEntry, getFreshCheckInDefaults())
          : { ...getFreshCheckInDefaults(), ...getSharedSleepContext(history, todayIso) },
      )
    }

    setActiveView(view)
    handleTourNavigation(view)
  }

  function applyLensPosition(state) {
    const node = lensNodeRef.current

    if (!node) {
      return
    }

    node.style.setProperty('--lens-left', `${state.left}px`)
    node.style.setProperty('--lens-top', `${state.top}px`)
    node.style.setProperty('--lens-height', `${state.height}px`)
    node.style.setProperty('--lens-width', `${state.width}px`)
    node.style.setProperty('--nav-width', `${state.navWidth}px`)
  }

  function animateLens() {
    const target = lensTargetRef.current

    if (target) {
      applyLensPosition(target)
      lensFrameRef.current = requestAnimationFrame(animateLens)
    }
  }

  function startLensAnimation() {
    if (!lensFrameRef.current) {
      lensFrameRef.current = requestAnimationFrame(animateLens)
    }
  }

  function stopLensAnimation() {
    if (lensFrameRef.current) {
      cancelAnimationFrame(lensFrameRef.current)
      lensFrameRef.current = null
    }
  }

  function moveNavLens(event) {
    if (!navLens) {
      return
    }

    const lensState = getLensState(event)

    if (!lensState) {
      return
    }

    const requiredView = getTourNavigationTarget()
    if (requiredView && lensState.activeLabel !== requiredView) {
      return
    }

    lensTargetRef.current = lensState

    if (lensState.activeLabel !== navLens.activeLabel) {
      setNavLens((current) =>
        current
          ? {
              ...current,
              activeLabel: lensState.activeLabel,
              height: lensState.height,
              width: lensState.width,
            }
          : current,
      )
    }
  }

  function showNavLens(event) {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Touch fallback events do not have capturable pointer ids.
    }

    const lensState = getLensState(event)

    if (!lensState) {
      return
    }

    lensTargetRef.current = lensState
    setNavLens(lensState)
    requestAnimationFrame(() => applyLensPosition(lensState))
    startLensAnimation()
  }

  function hideNavLens() {
    if (navLens?.activeLabel) {
      selectNavigationView(navLens.activeLabel)
    }

    stopLensAnimation()
    lensTargetRef.current = null
    setNavLens(null)
  }

  function getTouchEvent(touchEvent) {
    const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0]

    if (!touch) {
      return null
    }

    return {
      clientX: touch.clientX,
    }
  }

  function showTouchLens(event) {
    const touchEvent = getTouchEvent(event)

    if (touchEvent) {
      showNavLens({
        ...touchEvent,
        currentTarget: event.currentTarget,
        pointerId: event.changedTouches[0]?.identifier ?? 1,
      })
    }
  }

  function moveTouchLens(event) {
    const touchEvent = getTouchEvent(event)

    if (touchEvent) {
      moveNavLens(touchEvent)
    }
  }

  return (
    <main className="app-shell">
      <img className="hero-photo" src={trainingHero} alt="" />
      <div className="hero-overlay" />
      <SVGFilters>
        <SVGFilters.DefaultFilters />
      </SVGFilters>

      {!isAuthReady && <div className="auth-loading glass-panel">Loading</div>}

      {isAuthReady && !isAppUnlocked && (
        <AuthGate
          initialMode={authEntryMode}
          rememberedSession={session}
          onAuthenticated={finishAuthentication}
          onDemoSession={startDemoSession}
          onUseRememberedSession={unlockRememberedSession}
        />
      )}

      {isAuthReady && isAppUnlocked && session && !isProfileReady && (
        <div className="auth-loading glass-panel">Loading your athlete profile...</div>
      )}

      {isAuthReady && isAppUnlocked && session && isProfileReady && !athleteProfile?.onboardingCompleted && !onboardingTour && !onboardingCompleteOpen && (
        <OnboardingFlow
          associations={associations}
          initialDisplayName={athleteProfile?.displayName || getAuthDisplayName(session)}
          onComplete={completeOnboarding}
          onCreateAssociation={createOnboardingAssociation}
        />
      )}

      {isAuthReady && isAppUnlocked && session && isProfileReady && (athleteProfile?.onboardingCompleted || onboardingTour || onboardingCompleteOpen) && (
        <>
          <nav className="top-bar glass-panel">
        <div className="brand-lockup">
          <img src={appLogo} alt="Athlete Reload logo" />
          <div>
            <p className="eyebrow">Athlete Reload</p>
            <strong>Readiness Planner</strong>
          </div>
        </div>
        <div className="account-actions">
          <button className="account-name-button" onClick={() => setIsAthleteProfileOpen(true)} type="button">
            {athleteProfile?.displayName || session.user?.email || 'Athlete'}
          </button>
          <button
            className={`ghost-close ${activeView === 'Settings' ? 'account-button-active' : ''}`}
            onClick={() => setActiveView('Settings')}
            type="button"
          >
            Settings
          </button>
          <button className="ghost-close" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </nav>

      <div
        className={`nav-tabs${onboardingTour && !onboardingTour.endsWith('-nav') ? ' tour-hidden-mobile' : ''}`}
        aria-label="Primary views"
        onPointerCancel={hideNavLens}
        onPointerDown={showNavLens}
        onPointerMove={moveNavLens}
        onPointerUp={hideNavLens}
        onTouchEnd={hideNavLens}
        onTouchMove={moveTouchLens}
        onTouchStart={showTouchLens}
        ref={navRef}
        style={onboardingTour && !onboardingTour.endsWith('-nav')
          ? { pointerEvents: 'none', visibility: 'hidden' }
          : undefined}
      >
        {navLens && (
          <div
            className="liquid-lens-shell"
            ref={lensNodeRef}
            style={{
              '--lens-left': `${navLens.left}px`,
              '--lens-top': `${navLens.top}px`,
              '--lens-height': `${navLens.height}px`,
              '--lens-width': `${navLens.width}px`,
              '--nav-width': `${navLens.navWidth}px`,
            }}
          >
            <LensGlass
              blur={3}
              brightness={1.08}
              chromaticAberration={2.4}
              className="liquid-lens"
              depth={16}
              height={navLens.height}
              radius={999}
              saturate={1.65}
              strength={126}
              width={navLens.width}
            >
              <div className="lens-refract" aria-hidden="true">
                {views.map((view) => (
                  <span
                    className={visualActiveView === view.label ? 'active' : ''}
                    key={view.label}
                  >
                    <NavIcon type={view.icon} />
                    <em>{view.label}</em>
                  </span>
                ))}
              </div>
            </LensGlass>
          </div>
        )}
        {views.map((view) => (
          <button
            className={visualActiveView === view.label ? 'active' : ''}
            data-view={view.label}
            key={view.label}
            onClick={() => selectNavigationView(view.label)}
            type="button"
          >
            <NavIcon type={view.icon} />
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      <section className="page-content">
        <section className="workspace page-workspace glass-panel">
            {dataStatus === 'loading' && (
              <div className="data-status">Loading your Athlete Reload data...</div>
            )}

            {dataStatus === 'error' && (
              <div className="data-status error">
                Supabase data sync needs attention. Your screen may be showing the
                last loaded state.
              </div>
            )}

            {dataStatus === 'offline' && (
              <div className="data-status">
                You appear to be offline. Showing the last loaded state.
              </div>
            )}

            {activeView === 'Check-in' && (
              <CheckInView
                checkIn={scheduleDrivenCheckIn}
                checkouts={checkouts}
                dailyWellness={dailyWellness}
                eventOptions={checkInEventOptions}
                eventPreparationContext={eventPreparationContext}
                isSavedToday={isCheckInSavedToday}
                isSaving={isSavingCheckIn}
                nextEvent={nextEvent}
                selectedEvent={selectedCheckInEvent}
                selectedEventId={selectedCheckInEvent?.id ?? null}
                todayEvents={todayEvents}
                todayIso={todayIso}
                todayLabel={todayLabel}
                onSave={saveCheckIn}
                onQuickSave={saveCheckIn}
                onEditToday={editTodayCheckIn}
                onOpenCheckout={openCheckout}
                onSelectEvent={selectCheckInEvent}
                onUpdate={updateField}
                isFirstEventToday={todayEvents[0]?.id === selectedCheckInEvent?.id}
                isQuickMode={false}
                restDayPlanned={todayEvents.some(isRestDayEvent)}
              />
            )}

            {activeView === 'Home' && (
              <HomeView
                athleteProfile={athleteProfile}
                checkouts={checkouts}
                dailyWellness={dailyWellness}
                history={history}
                nutritionHistory={nutritionHistory}
                painReports={painReports}
                painIssues={painIssues}
                recommendation={recommendation}
                recommendationStatus="local"
                schedule={schedule}
                onGoCheckIn={openPreCheckIn}
                onOpenCheckout={openCheckout}
                onSavePainIssue={savePainIssue}
                onSharePainIssue={recordPainIssueShare}
              />
            )}

            {activeView === 'Nutrition' && (
              <NutritionView
                athleteProfile={athleteProfile}
                nutritionHistory={nutritionHistory}
                onSaveWellness={saveDailyWellness}
                schedule={schedule}
              />
            )}

            {activeView === 'Recovery' && (
              <RecoveryView
                checkouts={checkouts}
                generatedPlan={generatedRecoveryPlan}
                generatedPlanSaved={isGeneratedRecoveryPlanSaved}
                isReplayingSavedRoutine={isReplayingSavedRoutine}
                generationStatus={recoveryPlanStatus}
                recentCompletion={recoveryCompletions[0] ?? null}
                onGeneratePlan={generateRecoveryPlan}
                onReplaySavedRoutine={replaySavedRoutine}
                onReportRoutinePain={reportRoutinePain}
                onCompleteSavedRoutine={completeSavedRoutine}
                onSaveRecoveryPlan={saveRecoveryPlan}
                schedule={schedule}
                savedRoutines={savedRoutines}
              />
            )}

            {activeView === 'Schedule' && (
              <ScheduleView
                associations={associations}
                athleteProfile={athleteProfile}
                checkouts={checkouts}
                checkIns={history}
                onAdd={addScheduleItem}
                onAddTournament={addTournament}
                onUpdateTournament={editTournament}
                onAddAssociation={addAssociation}
                onRenameAssociation={renameAssociation}
                onRemoveAssociation={removeAssociation}
                onOpenCheckIn={openPreCheckIn}
                onOpenCheckout={openCheckout}
                onRemove={removeScheduleItem}
                onRemoveTournament={removeTournament}
                onUpdate={updateScheduleItem}
                onboardingAssociation={onboardingAssociation}
                isOnboardingEventCreation={onboardingTour === 'schedule'}
                schedule={schedule}
                tournaments={tournaments}
              />
            )}

            {activeView === 'History' && (
              <HistoryView
                athleteProfile={athleteProfile}
                checkouts={checkouts}
                history={history}
                insights={trendInsights}
                onClear={clearHistory}
                onDeleteEntry={deleteHistoryEntry}
                onFavoriteRoutine={favoriteRecoveryRoutine}
                savedRoutines={savedRoutines}
              />
            )}

            {activeView === 'Settings' && (
              <AccountPrivacyView
                associations={associations}
                athleteProfile={athleteProfile}
                checkouts={checkouts}
                dailyWellness={dailyWellness}
                history={history}
                nutritionHistory={nutritionHistory}
                painIssues={painIssues}
                painReports={painReports}
                preferences={privacyPreferences}
                recoveryCompletions={recoveryCompletions}
                savedRoutines={savedRoutines}
                schedule={schedule}
                session={session}
                shareAuditLogs={shareAuditLogs}
                tournaments={tournaments}
                onClearAllHealthHistory={clearAllHealthHistory}
                onAccountDeleted={resetDeletedSession}
                onDeleteShareAuditLog={removeShareAuditLog}
                onUpdateReminderPreference={updateReminderPreference}
                onUpdateAiPersonalizationPreference={updateAiPersonalizationPreference}
              />
            )}
          </section>
      </section>

      {onboardingTour && (
        <GuidedTour
          onBack={rewindOnboardingTour}
          onFinish={finishOnboardingTour}
          onNext={advanceOnboardingTour}
          phase={onboardingTour}
        />
      )}

      {onboardingCompleteOpen && (
        <div className="modal-backdrop">
          <section className="event-modal onboarding-complete-modal glass-panel" role="dialog" aria-modal="true">
            <p className="eyebrow">Setup complete</p>
            <h2>You’re ready to reload.</h2>
            <p>Your profile, first event, check-ins, checkouts, Home dashboard, and History are ready to use.</p>
            <button className="primary-button" onClick={unlockAfterOnboarding} type="button">Open Athlete Reload</button>
          </section>
        </div>
      )}

      {checkoutEvent && (
        <CheckoutModal
          athleteProfile={athleteProfile}
          checkout={checkouts.find((checkout) =>
            checkout.id === checkoutEvent.checkoutId || checkout.eventId === checkoutEvent.id
          )}
          event={checkoutEvent}
          preCheckIn={history.find((entry) => entry.eventId === checkoutEvent.id)}
          preCheckInPainReports={painReports.filter((report) => {
            const checkIn = history.find((entry) => entry.eventId === checkoutEvent.id)
            return report.sourceType === 'check_in' && report.sourceId === checkIn?.id
          })}
          onClose={() => setCheckoutEvent(null)}
          onSave={saveCheckout}
        />
      )}

      {isAthleteProfileOpen && (
        <AthleteProfileModal
          onClose={() => setIsAthleteProfileOpen(false)}
          onSave={updateAthleteProfile}
          profile={athleteProfile}
        />
      )}

      {submittedRecommendation && (
        <div className="modal-backdrop">
          <section className="event-modal recommendation-modal glass-panel" role="dialog" aria-modal="true">
            <div className="schedule-header">
              <div>
                <p className="eyebrow">AI report</p>
                <h2>{submittedRecommendationContext.title}</h2>
              </div>
              <button className="ghost-close" onClick={() => setSubmittedRecommendation(null)} type="button">
                Close
              </button>
            </div>
            {submittedRecommendationContext.scoreLabel === 'recovery' ? (
              <RecoveryPlanCard
                recommendation={submittedRecommendation}
                recommendationStatus={submittedRecommendationStatus}
                session={submittedRecommendationContext.session}
              />
            ) : (
              <RecommendationCard
                recommendation={submittedRecommendation}
                recommendationStatus={submittedRecommendationStatus}
                scoreLabel={submittedRecommendationContext.scoreLabel}
                session={submittedRecommendationContext.session}
              />
            )}
          </section>
        </div>
      )}

      {checkInAiError && (
        <div className="modal-backdrop" onClick={() => setCheckInAiError('')}>
          <section
            className="event-modal recommendation-modal glass-panel"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="checkin-ai-error-title"
          >
            <div className="schedule-header">
              <div>
                <p className="eyebrow">Recommendation unavailable</p>
                <h2 id="checkin-ai-error-title">Your check-in was not saved.</h2>
              </div>
              <button className="ghost-close" onClick={() => setCheckInAiError('')} type="button">
                Close
              </button>
            </div>
            <p>{checkInAiError}</p>
            <p className="field-description">Your answers are still here. Try saving again when the connection is available.</p>
            <button className="primary-button" onClick={() => setCheckInAiError('')} type="button">
              Return to check-in
            </button>
          </section>
        </div>
      )}

        </>
      )}

      <AppFooter onOpenLegal={setActiveLegalModal} />

      {activeLegalModal && (
        <LegalModal
          type={activeLegalModal}
          onClose={() => setActiveLegalModal(null)}
        />
      )}
    </main>
  )
}

function AppFooter({ onOpenLegal }) {
  return (
    <footer className="app-footer">
      <div className="footer-break">
        <span>© 2026 Athlete Reload</span>
      </div>
      <nav className="footer-links" aria-label="Legal links">
        <button className="footer-link" onClick={() => onOpenLegal('privacy')} type="button">
          Privacy Policy
        </button>
        <button className="footer-link" onClick={() => onOpenLegal('terms')} type="button">
          Terms of Service
        </button>
        <button className="footer-link" onClick={() => onOpenLegal('medical')} type="button">
          Medical Disclaimer
        </button>
      </nav>
      <div className="footer-credit">
        <span>Developed by Lucas Linder</span>
        <a href="https://github.com/mr-devlinder" rel="noreferrer" target="_blank">
          GitHub
        </a>
      </div>
    </footer>
  )
}

function LegalModal({ onClose, type }) {
  const content = legalContentV2[type]

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal disclaimer-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <div>
            <p className="eyebrow">Athlete Reload</p>
            <h2>{content.title}</h2>
          </div>
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="disclaimer-content">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <p><strong>Last Updated:</strong> August 4, 2026</p>
        </div>
      </section>
    </div>
  )
}

const legalContentV2 = {
  privacy: {
    title: 'Privacy policy.',
    sections: [
      {
        title: '1. Scope',
        body: [
          'This Privacy Policy explains how Athlete Reload collects, uses, stores, and shares information when you use the app. It applies to information you enter directly, information connected to your signed-in account, and information generated by the app from your use of its features.',
          'Athlete Reload is intended for training readiness and recovery planning. It is not a medical record system, healthcare provider, or emergency service.',
        ],
      },
      {
        title: '2. Information We Collect',
        body: [
          'Account and profile data includes your name or nickname, email, authentication identifiers, age, height, weight, gender if provided, sport, position or specialty, dominant side, goals, dietary preferences, unit preference, and connected sign-in providers.',
          'Training and wellness data includes schedules, teams or associations, tournaments, check-ins, checkouts, training history and workload, injuries you describe, pain reports and body areas, soreness, sleep, fatigue, stress, recovery routines and completions, nutrition logs, food and brand details, calories, nutrients, hydration or water intake, notes, saved foods, and voice transcripts when you choose voice entry.',
          'Generated data includes readiness scores, trends, recovery plans, and AI-generated recommendations. Operational data may include authentication sessions, browser or device information supplied by your browser, security records, and service error logs.',
        ],
      },
      {
        title: '3. How We Use Information',
        body: [
          'We use account data to authenticate you and sync your records; profile, training, wellness, nutrition, hydration, and recovery data to calculate targets, display history and trends, and generate the features you request; and operational data to secure, troubleshoot, and maintain the service.',
          'We do not use your information to provide medical diagnosis, treatment, medical clearance, or emergency guidance.',
        ],
      },
      {
        title: '4. Service Providers and AI Processing',
        body: [
          'Athlete Reload uses Supabase for authentication, database storage, and server-side functions. Recommendation and voice-extraction requests may be sent through a server-side function to Google Gemini. Food searches may query food-data providers described by the search feature.',
          'These providers process information only as needed to operate app features. API keys and service secrets are intended to stay server-side and are not stored in the browser.',
        ],
      },
      {
        title: '5. How Information Is Shared',
        body: [
          'We do not sell personal information, share it for targeted advertising, or intentionally make training, nutrition, or health-related data public.',
          'Information is disclosed only to service providers needed to operate requested features, when required by law or necessary to protect rights and safety, or at your direction when you create or share a report. Coaches and teammates do not receive account access by default.',
        ],
      },
      {
        title: '6. Data Retention and Deletion',
        body: [
          'We keep signed-in data while your account is active and until you delete individual records, clear health history, or delete your account. Limited security logs, provider backups, or records required by law may remain for their applicable retention periods.',
          'Account & Privacy provides complete JSON download, nutrition CSV export, health-history deletion, individual history deletion, shared-report audit controls, and permanent account deletion. You may also correct profile and account information in the app.',
        ],
      },
      {
        title: '7. Security',
        body: [
          'Signed-in records are stored in Supabase and protected with Row Level Security that limits user-owned rows to the authenticated account. Data is transmitted over HTTPS, and privileged secrets remain in server-side functions. Supabase manages its platform storage and transport security. No online service can guarantee absolute security.',
          'You are responsible for keeping access to your email and account secure. Do not enter emergency information that needs immediate professional attention.',
        ],
      },
      {
        title: '8. Minors and Student Athletes',
        body: [
          'You must be at least 16 to create or use an Athlete Reload account. Athlete Reload does not offer a verified parental-consent flow for younger users and is not directed to children under 13.',
          'Parents, guardians, coaches, athletic trainers, and healthcare providers should be involved whenever pain, injury, return-to-play, or medical concerns are present.',
        ],
      },
      {
        title: '9. Privacy Choices',
        body: [
          'You can choose not to enter optional information, change password or email, enable two-factor authentication, manage notifications, turn AI history personalization off, export your information, delete history, and delete your account.',
          'Depending on where you live, you may also have rights to access, correct, erase, restrict or object to processing, receive portable data, withdraw consent, and complain to a data-protection authority. Withdrawing consent does not affect processing already completed.',
          'Camera permission is requested only when you start barcode scanning. Microphone permission is requested only when you start voice entry or voice search, and the resulting transcript can be reviewed before use. Notification permission is requested only when you enable reminders. The app does not request photo-library, precise device-location, or health-platform permission.',
        ],
      },
      {
        title: '10. Changes to This Policy',
        body: [
          'We may update this Privacy Policy as the app changes. Material changes should be reflected by updating the policy text and last-updated date.',
        ],
      },
      {
        title: '11. Contact',
        body: [
          'Privacy questions and rights requests can be directed to the developer through the GitHub contact link in the footer. Include enough information to verify the account, but do not send passwords or detailed health information.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of service.',
    sections: [
      {
        title: '1. Acceptance of Terms',
        body: [
          'By accessing or using Athlete Reload, you agree to these Terms of Service. If you do not agree, do not use the app.',
          'If you use Athlete Reload on behalf of a minor athlete, team, school, club, or other organization, you represent that you have authority and permission to do so.',
        ],
      },
      {
        title: '2. Purpose of the App',
        body: [
          'Athlete Reload is a training readiness, recovery, schedule, and workload planning tool. It is intended to help users organize information and think through training modifications.',
          'Athlete Reload is not a medical device, healthcare provider, athletic trainer, physician, emergency service, or replacement for professional judgment.',
        ],
      },
      {
        title: '3. Eligibility and Minors',
        body: [
          'You must be at least 16 to create or use an account. If you are under the age of legal majority where you live, use Athlete Reload with permission and guidance from a parent or guardian.',
          'The app should not be used to hide pain, injury, symptoms, or safety concerns from parents, guardians, coaches, athletic trainers, or healthcare providers.',
        ],
      },
      {
        title: '4. Account Responsibility',
        body: [
          'You are responsible for maintaining the confidentiality of your account access and for all activity under your account. Do not share your login credentials with others.',
          'You agree to provide accurate information where accuracy matters to app output, and you understand that incorrect or incomplete information may produce incorrect or incomplete recommendations.',
        ],
      },
      {
        title: '5. Acceptable Use',
        body: [
          'You agree not to misuse the app, attempt to access another user\'s data, bypass access controls, interfere with service operation, upload malicious content, reverse engineer restricted services, or use the app for unlawful, abusive, or harmful purposes.',
          'You agree not to rely on the app in emergencies or use it as the sole basis for participation, return-to-play, injury, or healthcare decisions.',
        ],
      },
      {
        title: '6. User Content and Data',
        body: [
          'You retain responsibility for the information you enter into Athlete Reload. By entering information, you authorize the app to store, process, display, and use it to provide app features.',
          'You should not enter information that you do not have permission to store or information that requires immediate medical, emergency, or professional attention.',
        ],
      },
      {
        title: '7. AI Disclaimer and Recommendation Output',
        body: [
          'Athlete Reload may generate recommendations using rules, user-entered data, and AI services. AI output can be incomplete, incorrect, or inappropriate for your situation.',
          'You are responsible for reviewing recommendations with common sense and involving a qualified adult, coach, athletic trainer, physician, or emergency services when appropriate.',
        ],
      },
      {
        title: '8. Medical and Safety Disclaimer',
        body: [
          'Athlete Reload does not provide medical advice, diagnosis, treatment, emergency care, or medical clearance. The Medical Disclaimer is incorporated into these Terms by reference.',
          'Never delay seeking medical attention, ignore symptoms, or continue training because of information shown in the app.',
        ],
      },
      {
        title: '9. Intellectual Property',
        body: [
          'Athlete Reload, including its design, name, interface, code, text, and visual elements, is owned by its creator or licensors except for third-party libraries, services, and assets used under their own terms.',
          'You may use the app for its intended personal training-readiness purpose. You may not copy, resell, or misrepresent the app as your own product without permission.',
        ],
      },
      {
        title: '10. Service Changes and Availability',
        body: [
          'Athlete Reload may change over time. Features may be added, changed, removed, interrupted, or unavailable while the app is being developed or maintained.',
          'We do not guarantee that the app will be uninterrupted, error-free, secure, or available at all times.',
        ],
      },
      {
        title: '11. Disclaimers',
        body: [
          'The app is provided "as is" and "as available" without warranties of any kind, express or implied, including warranties of accuracy, fitness for a particular purpose, non-infringement, availability, or reliability.',
        ],
      },
      {
        title: '12. Limitation of Liability',
        body: [
          'To the fullest extent permitted by law, Athlete Reload and its creator are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for injury, loss, training decisions, health decisions, data loss, or reliance on app output.',
          'Your use of Athlete Reload is at your own risk. Use the app as one informational tool, not as your only source of guidance.',
        ],
      },
      {
        title: '13. Indemnification',
        body: [
          'To the fullest extent permitted by law, you agree to defend, indemnify, and hold harmless Athlete Reload and its creator from claims, damages, losses, liabilities, and expenses arising from your misuse of the app, violation of these Terms, or violation of another person\'s rights.',
        ],
      },
      {
        title: '14. Changes to These Terms',
        body: [
          'These Terms may be updated as Athlete Reload changes. Continued use of the app after updates means you accept the updated Terms.',
        ],
      },
      {
        title: '15. Contact',
        body: [
          'Questions about these Terms can be directed to the developer through the GitHub link in the footer.',
        ],
      },
    ],
  },
  medical: {
    title: 'Medical disclaimer.',
    sections: [
      {
        title: '1. Not Medical Advice',
        body: [
          'Athlete Reload is a training readiness, recovery, and workload planning tool. The information provided is for informational purposes only and is not a substitute for professional medical advice, diagnosis, treatment, athletic trainer evaluation, or emergency care.',
        ],
      },
      {
        title: '2. Consult Qualified Adults and Healthcare Providers',
        body: [
          'Always seek guidance from a physician, athletic trainer, physical therapist, coach, parent, guardian, or other qualified professional with questions about pain, injury, participation, return-to-play decisions, training modifications, or health concerns.',
        ],
      },
      {
        title: '3. Emergency Situations',
        body: [
          'Never delay seeking medical help, disregard medical advice, or continue training because of information shown in Athlete Reload. If you think you may have a medical emergency, severe injury, concussion symptoms, numbness, instability, chest pain, trouble breathing, or rapidly worsening symptoms, stop activity and contact emergency services or a qualified adult immediately.',
        ],
      },
      {
        title: '4. Data Accuracy',
        body: [
          'Readiness scores and recommendations depend on the accuracy of your schedule, check-ins, pain reports, checkouts, and other information you enter. Always verify important information and do not make health or participation decisions based solely on the app.',
        ],
      },
      {
        title: '5. Individual Differences',
        body: [
          'Every athlete, injury, sport, position, and training environment is different. Patterns, trends, and recommendations should be interpreted with care and discussed with qualified professionals when pain, injury, or return-to-play decisions are involved.',
        ],
      },
      {
        title: '6. No Provider Relationship',
        body: [
          'Using Athlete Reload does not create a physician-patient relationship, athletic trainer-athlete relationship, or any professional medical relationship with Athlete Reload or its creators.',
        ],
      },
      {
        title: '7. Limitation of Liability',
        body: [
          'By using Athlete Reload, you acknowledge that Athlete Reload and its creators are not liable for injury, damage, or loss that may result from use of the app, inability to use the app, or reliance on information shown in the app.',
        ],
      },
      {
        title: '8. Training Recommendations',
        body: [
          'The app may suggest full, controlled, modified, recovery-focused, or no-participation training options. These are general readiness suggestions, not medical clearance. A coach, parent, guardian, athletic trainer, or healthcare provider may decide that a different action is necessary.',
        ],
      },
    ],
  },
}

const _legacyLegalContent = {
  privacy: {
    title: 'Privacy policy.',
    sections: [
      {
        title: '1. Information Athlete Reload Stores',
        body: [
          'Athlete Reload stores the information you choose to enter, including scheduled events, associations, check-ins, checkouts, pain map entries, readiness recommendations, notes, and account information connected to your sign-in.',
        ],
      },
      {
        title: '2. How Your Information Is Used',
        body: [
          'Your information is used to show your schedule, generate event-based readiness recommendations, track training history, display trends, and sync your data across devices when you are signed in.',
        ],
      },
      {
        title: '3. Health and Training Data',
        body: [
          'Some information you enter may relate to soreness, pain, injury symptoms, sleep, fatigue, stress, hydration, and training participation. Do not enter information you do not want stored in the app.',
        ],
      },
      {
        title: '4. Third-Party Services',
        body: [
          'Athlete Reload uses Supabase for authentication and data storage. Recommendation requests may be sent to Google Gemini through a secure server-side function so the app can generate training guidance. API keys are not stored in the browser.',
        ],
      },
      {
        title: '5. Data Access and Control',
        body: [
          'Your signed-in app data is associated with your account. The History screen includes controls to clear saved check-ins, checkouts, and pain reports by time range.',
          'Future versions may add more account-level privacy controls such as full account deletion, export, and sharing settings.',
        ],
      },
      {
        title: '6. Data Accuracy and Security',
        body: [
          'Athlete Reload is designed to keep each user’s saved data separate through account-based access controls. No online service can guarantee perfect security, and you should avoid entering emergency or highly sensitive information that needs immediate professional attention.',
        ],
      },
      {
        title: '7. Contact',
        body: [
          'Questions about this app can be directed to the developer through the GitHub link in the footer.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of service.',
    sections: [
      {
        title: '1. Acceptance of Terms',
        body: [
          'By using Athlete Reload, you agree to use the app responsibly and only for personal training readiness, recovery tracking, and schedule planning.',
        ],
      },
      {
        title: '2. Appropriate Use',
        body: [
          'You agree not to misuse the app, interfere with its services, attempt to access another user’s data, or use the app for unlawful, harmful, or abusive purposes.',
        ],
      },
      {
        title: '3. Your Responsibility',
        body: [
          'You are responsible for the accuracy of the information you enter and for deciding when to involve a parent, guardian, coach, athletic trainer, physician, or emergency services.',
        ],
      },
      {
        title: '4. No Medical Clearance',
        body: [
          'Athlete Reload does not provide medical clearance, diagnosis, treatment, return-to-play approval, or emergency care. Recommendations are general readiness guidance based on user-entered data.',
        ],
      },
      {
        title: '5. Accounts and Data',
        body: [
          'If you sign in, your data may be stored so it can sync across devices. You should keep access to your email/account secure and avoid sharing your login with others.',
        ],
      },
      {
        title: '6. Changes and Availability',
        body: [
          'Athlete Reload may change over time. Features may be added, changed, removed, interrupted, or unavailable while the app is being developed.',
        ],
      },
      {
        title: '7. Limitation of Liability',
        body: [
          'Athlete Reload and its creators are not liable for injury, loss, damages, training decisions, or reliance on app output. Use the app as one informational tool, not as your only source of guidance.',
        ],
      },
    ],
  },
  medical: {
    title: 'Medical disclaimer.',
    sections: [
      {
        title: '1. Not Medical Advice',
        body: [
          'Athlete Reload is a training readiness, recovery, and workload planning tool. The information provided is for informational purposes only and is not a substitute for professional medical advice, diagnosis, treatment, athletic trainer evaluation, or emergency care.',
        ],
      },
      {
        title: '2. Consult Qualified Adults and Healthcare Providers',
        body: [
          'Always seek guidance from a physician, athletic trainer, physical therapist, coach, parent, guardian, or other qualified professional with questions about pain, injury, participation, return-to-play decisions, training modifications, or health concerns.',
        ],
      },
      {
        title: '3. Emergency Situations',
        body: [
          'Never delay seeking medical help, disregard medical advice, or continue training because of information shown in Athlete Reload. If you think you may have a medical emergency, severe injury, concussion symptoms, numbness, instability, chest pain, trouble breathing, or rapidly worsening symptoms, stop activity and contact emergency services or a qualified adult immediately.',
        ],
      },
      {
        title: '4. Data Accuracy',
        body: [
          'Readiness scores and recommendations depend on the accuracy of your schedule, check-ins, pain reports, checkouts, and other information you enter. Always verify important information and do not make health or participation decisions based solely on the app.',
        ],
      },
      {
        title: '5. Individual Differences',
        body: [
          'Every athlete, injury, sport, position, and training environment is different. Patterns, trends, and recommendations should be interpreted with care and discussed with qualified professionals when pain, injury, or return-to-play decisions are involved.',
        ],
      },
      {
        title: '6. No Provider Relationship',
        body: [
          'Using Athlete Reload does not create a physician-patient relationship, athletic trainer-athlete relationship, or any professional medical relationship with Athlete Reload or its creators.',
        ],
      },
      {
        title: '7. Limitation of Liability',
        body: [
          'By using Athlete Reload, you acknowledge that Athlete Reload and its creators are not liable for injury, damage, or loss that may result from use of the app, inability to use the app, or reliance on information shown in the app.',
        ],
      },
      {
        title: '8. Training Recommendations',
        body: [
          'The app may suggest full, controlled, modified, recovery-focused, or no-participation training options. These are general readiness suggestions, not medical clearance. A coach, parent, guardian, athletic trainer, or healthcare provider may decide that a different action is necessary.',
        ],
      },
    ],
  },
}

function NavIcon({ type }) {
  if (type === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.2 12 4l8 7.2v8.1a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 19.3v-8.1Z" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    )
  }

  if (type === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4.5 9.2h15M6.5 5.2h11A2.5 2.5 0 0 1 20 7.7v10.1a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.8V7.7a2.5 2.5 0 0 1 2.5-2.5Z" />
      </svg>
    )
  }

  if (type === 'nutrition') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v8.2a2.5 2.5 0 0 1-5 0V3M4.5 3v18M14.5 3v7M14.5 10h5.5v11" />
        <path d="M14.5 3h5.5v7h-5.5" />
      </svg>
    )
  }

  if (type === 'recovery') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 7.5a8 8 0 1 0 1.2 6.8" />
        <path d="M20 4v5h-5" />
        <path d="M12 8v4l2.8 2" />
      </svg>
    )
  }

  if (type === 'trend') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17.5h16M6 15l4-4 3 3 5-7M18 7h-4M18 7v4" />
      </svg>
    )
  }

  if (type === 'stats') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V9M12 19V5M19 19v-7" />
        <path d="M3.5 19.5h17" />
      </svg>
    )
  }

  if (type === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" />
        <path d="m4.8 14.3-.9-1.5.9-1.5 2-.4.8-1.3-.6-2 1.5-.9 1.5.9 1.3-.5.7-1.9h1.8l.7 1.9 1.3.5 1.5-.9 1.5.9-.6 2 .8 1.3 2 .4.9 1.5-.9 1.5-2 .4-.8 1.3.6 2-1.5.9-1.5-.9-1.3.5-.7 1.9H12l-.7-1.9-1.3-.5-1.5.9-1.5-.9.6-2-.8-1.3-2-.4Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h4.2l2-5.8 5.2 12.6 2.4-6.8H21" />
    </svg>
  )
}

export default App
