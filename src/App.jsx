import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { OnboardingFlow } from './components/OnboardingFlow'
import { GuidedTour } from './components/GuidedTour'
import { CheckoutModal } from './components/CheckoutModal'
import { AccountPrivacyView } from './components/AccountPrivacyView'
import { AgeGate } from './components/AgeGate'
import { AthleteProfileModal } from './components/AthleteProfileModal'
import { AiDecisionModal, CheckoutAiModal } from './components/AiDecisionModal'
import { DialogShell } from './components/DialogShell'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { LiquidNavigation } from './components/LiquidNavigation'
import {
  checkInDefaults,
  associations as initialAssociations,
  schedule as initialSchedule,
  todayLabel,
} from './data/appData'
import appLogo from './assets/athlete-reload-logo-transparent.png'

const viewLoaders = {
  Home: () => import('./components/HomeView'),
  History: () => import('./components/HistoryView'),
  Nutrition: () => import('./components/NutritionView'),
  Recovery: () => import('./components/RecoveryView'),
  Schedule: () => import('./components/ScheduleView'),
}
let authGatePromise
function loadAuthGate() {
  authGatePromise ??= import('./components/AuthGate')
  return authGatePromise
}
const viewModules = Object.fromEntries(Object.entries(viewLoaders).map(([key, load]) => [key, { load, promise: null }]))
function loadView(name) {
  const entry = viewModules[name]
  entry.promise ??= entry.load()
  return entry.promise
}
const HomeView = lazy(() => loadView('Home').then((module) => ({ default: module.HomeView })))
const HistoryView = lazy(() => loadView('History').then((module) => ({ default: module.HistoryView })))
const NutritionView = lazy(() => loadView('Nutrition').then((module) => ({ default: module.NutritionView })))
const RecoveryView = lazy(() => loadView('Recovery').then((module) => ({ default: module.RecoveryView })))
const ScheduleView = lazy(() => loadView('Schedule').then((module) => ({ default: module.ScheduleView })))
const CheckInView = lazy(() => import('./components/CheckInView').then((module) => ({ default: module.CheckInView })))
const AuthGate = lazy(() => loadAuthGate().then((module) => ({ default: module.AuthGate })))
import {
  clearCheckIns,
  clearPainReports,
  clearTrainingCheckouts,
  createAssociation,
  createEventTemplate,
  createPainIssue,
  createRecommendationRecord,
  createRecoveryRoutineCompletion,
  updateRecoveryRoutineCompletion,
  upsertRecoveryPlan,
  createSavedRecoveryRoutine,
  createPainReports,
  createScheduleEvent,
  createShareAuditLog,
  deleteAssociation,
  deleteEventTemplate,
  deleteHistoryEntryComplete,
  deleteRecoveryRoutineCompletion,
  deleteRecoveryPlan,
  deleteScheduleEvent,
  deleteShareAuditLog,
  deleteTournamentWithGames,
  recordLegalConsent,
  updateAssociation,
  updatePainIssue,
  upsertPrivacyPreferences,
  upsertDailyWellness,
  upsertAthleteProfile,
  upsertAthleteBaselines,
  upsertAthleteInsights,
  updateScheduleEvent,
  saveTournamentWithGames,
  saveCheckInWithPainReports,
  saveCheckoutWithPainReports,
} from './lib/athleteData'
import { generateAiRecommendation } from './lib/aiRecommendations'
import { buildAthleteContext, buildFallbackRecommendation } from './lib/recommendationContext'
import { mergeAiExplanation } from './domain/contracts'
import { getAgeAccess } from './domain/age'
import { getCheckoutRecommendation } from './domain/checkoutRecommendation'
import { getActivityDemandProfile } from './domain/activityDemands'
import { transitionPainIssue } from './domain/painLifecycle'
import { createValidatedMobilityRoutine, filterMovementCatalog, normalizeRoutineType } from './domain/recovery/routineBuilder'
import { createCheckoutRecoveryPlan, findRecoveryPlanForCheckout, getRecoveryPlanInputSignature } from './domain/recovery/recoveryPlanIdentity'
import { useAthleteSnapshotController } from './features/app/useAthleteSnapshotController'
import { displayPreferenceDefaults, normalizeDisplayPreferences } from './lib/displayPreferences'
import { getSportContext } from './data/sportProfiles'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'
import { bodyPainAreas, getPainReportsFromMap, getPainReportsWithResolutions, getPrimaryPainArea, normalizePainMapScale } from './data/bodyPainMap'
import { getRecommendation } from './utils/readiness'
import { getAthleteInsights } from './domain/insights'
import { getPersonalBaseline, getRollingBaselineRecords } from './utils/baselines'
import { getHydrationTarget, getNutritionTargets, getNutritionTotals } from './lib/nutrition'
import { getHydrationResult } from './domain/nutrition/hydration'
import { canPersistGuestState, clearUserStorage, loadSavedState, saveState } from './utils/storage'
import { getEventDisplayName, isAllDayCheckInOpen, isAllDayEvent, isEventActionable, isRestDayEvent } from './utils/events'
import { getCheckInPreparationContext } from './utils/eventFuelContext'
import { fluidOuncesToMilliliters, inchesToCentimeters, poundsToKilograms } from './utils/units'
import { useModalAccessibility } from './hooks/useModalAccessibility'
import { shouldRestartStartupForAuthEvent, shouldShowStartupLoader } from './lib/startupFlow'
import { clearAccountDrafts, clearDraft, loadDraft, saveDraft } from './utils/draftStorage'
import './App.css'
import './styles/tokens.css'
import './styles/primitives.css'
import './styles/ui-production.css'
import './styles/shell-rework.css'

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
  display: displayPreferenceDefaults,
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

function getHydrationStatus(hydrationMl, profile = {}, schedule = [], date) {
  const result = getHydrationResult({
    profile,
    schedule,
    date,
    currentLoggedMl: hydrationMl,
    hasLogs: Number(hydrationMl) > 0,
  })
  if (result.status === 'on_track') return 'Good'
  if (result.status === 'building') return 'Okay'
  if (result.status === 'below_context') return 'Poor'
  return 'Unknown'
}

function getMealNutritionBreakdown(entries = []) {
  const mealNames = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

  return Object.fromEntries(mealNames.flatMap((meal) => {
    const mealEntries = entries.filter((entry) => String(entry.meal ?? '').toLowerCase() === meal.toLowerCase())
    if (mealEntries.length === 0) return []

    return [[meal === 'Snack' ? 'Snacks' : meal, {
      items: mealEntries.map((entry) => entry.name).filter(Boolean),
      loggedItems: mealEntries.length,
      totals: getNutritionTotals(mealEntries),
    }]]
  }))
}

function normalizeFivePointValue(value, fallback = 1) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback

  return Math.max(0, Math.min(5, Math.round(number)))
}

function normalizeCheckInScales(checkIn) {
  return {
    ...checkIn,
    energy: normalizeFivePointValue(checkIn.energy, null),
    expectedDifficulty: checkIn.expectedDifficulty == null ? null : Math.max(1, Math.min(10, Math.round(Number(checkIn.expectedDifficulty)))),
    fatigue: normalizeFivePointValue(checkIn.fatigue, null),
    legHeaviness: normalizeFivePointValue(checkIn.legHeaviness, null),
    sleep: checkIn.sleep == null ? null : Math.max(3, Math.min(10, Number(checkIn.sleep))),
    illnessSymptoms: normalizeIllnessValue(checkIn.illnessSymptoms),
    sleepQuality: normalizeFivePointValue(checkIn.sleepQuality, null),
    soreness: normalizeFivePointValue(checkIn.soreness, null),
    stress: normalizeStressValue(checkIn.stress),
    painMap: normalizePainMapScale(checkIn.painMap, checkIn.pain),
  }
}

function normalizeStressValue(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(5, String(value).includes('Low') ? parsed - 1 : parsed))
}

function normalizeIllnessValue(value) {
  if (value === null || value === undefined || value === '') return null
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
    affectedMovement: pain > 0 ? checkIn.affectedMovement : null,
    hurtsWhen: pain > 0 ? checkIn.hurtsWhen : null,
    injuryType: pain > 0 ? checkIn.injuryType : null,
    location: pain > 0 ? primaryArea.recommendationLocation : null,
    pain,
    painDetails: pain > 0 ? checkIn.painDetails : {},
    painTrend: pain > 0 ? checkIn.painTrend : null,
    painType: pain > 0 ? checkIn.painType : null,
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

function _getLocalCheckoutRecommendation(checkout, event, preCheckIn) {
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
  const [isStartupComplete, setIsStartupComplete] = useState(false)
  const hasEnteredAuthenticatedAppRef = useRef(false)
  const hydratedCheckInDraftKeyRef = useRef('')
  const [areViewsReady, setAreViewsReady] = useState(false)
  const isSigningOutRef = useRef(false)
  const resetAccountStateRef = useRef(null)
  const [authEntryMode, setAuthEntryMode] = useState('landing')
  const [dataStatus, setDataStatus] = useState('ready')
  const [isEditingToday, setIsEditingToday] = useState(false)
  const [selectedCheckInEventId, setSelectedCheckInEventId] = useState(null)
  const [activeView, setActiveView] = useState(() => normalizeDisplayPreferences(savedState?.privacyPreferences?.display).defaultView)
  const [checkoutEvent, setCheckoutEvent] = useState(null)
  const [submittedRecommendation, setSubmittedRecommendation] = useState(null)
  const [submittedRecommendationStatus, setSubmittedRecommendationStatus] = useState('local')
  const [checkInAiError, setCheckInAiError] = useState('')
  const [generatedRecoveryPlan, setGeneratedRecoveryPlan] = useState(null)
  const [generatedMobilityRoutine, setGeneratedMobilityRoutine] = useState(null)
  const [recoveryPlanStatus, setRecoveryPlanStatus] = useState('idle')
  const [mobilityRoutineStatus, setMobilityRoutineStatus] = useState('idle')
  const generatedRecoveryCheckoutIdsRef = useRef(new Set())
  const [submittedRecommendationContext, setSubmittedRecommendationContext] = useState({
    scoreLabel: 'readiness',
    session: '',
    title: 'Check-in report',
  })
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false)
  const [activeLegalModal, setActiveLegalModal] = useState(null)
  const [isMobileAccountMenuOpen, setIsMobileAccountMenuOpen] = useState(false)
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false)
  const [isRestrictedDataControlsOpen, setIsRestrictedDataControlsOpen] = useState(false)
  const recommendationDialogRef = useModalAccessibility(Boolean(submittedRecommendation), () => setSubmittedRecommendation(null))
  const aiErrorDialogRef = useModalAccessibility(Boolean(checkInAiError), () => setCheckInAiError(''))
  const mobileAccountMenuRef = useModalAccessibility(isMobileAccountMenuOpen, () => setIsMobileAccountMenuOpen(false))
  const [isAthleteProfileOpen, setIsAthleteProfileOpen] = useState(false)
  const sentReminderKeysRef = useRef(new Set())
  const [checkIn, setCheckIn] = useState(() => normalizeCheckInScales(savedState?.checkIn ?? checkInDefaults))
  const [history, setHistory] = useState(savedState?.history ?? [])
  const [checkouts, setCheckouts] = useState(savedState?.checkouts ?? [])
  const [painReports, setPainReports] = useState(savedState?.painReports ?? [])
  const [painIssues, setPainIssues] = useState(savedState?.painIssues ?? [])
  const [savedRoutines, setSavedRoutines] = useState(savedState?.savedRoutines ?? [])
  const [recoveryCompletions, setRecoveryCompletions] = useState(savedState?.recoveryCompletions ?? [])
  const [recoveryPlans, setRecoveryPlans] = useState(savedState?.recoveryPlans ?? [])
  const completedMobilityRoutines = useMemo(() => recoveryCompletions.filter((record) => !['planned', 'in_progress'].includes(record.status)), [recoveryCompletions])
  const [shareAuditLogs, setShareAuditLogs] = useState(savedState?.shareAuditLogs ?? [])
  const [tournaments, setTournaments] = useState(savedState?.tournaments ?? [])
  const [dailyWellness, setDailyWellness] = useState(() => normalizeWellnessUnits(savedState?.dailyWellness ?? ({ date: getTodayIso(), hydrationMl: 0, nutritionEntries: [] })))
  const [nutritionHistory, setNutritionHistory] = useState(() => (savedState?.nutritionHistory ?? []).map(normalizeWellnessUnits))
  const [privacyPreferences, setPrivacyPreferences] = useState(
    { ...privacyDefaults, ...savedState?.privacyPreferences, display: normalizeDisplayPreferences(savedState?.privacyPreferences?.display, savedState?.athleteProfile?.unitSystem) },
  )
  const [associations, setAssociations] = useState(savedState?.associations ?? initialAssociations)
  const [eventTemplates, setEventTemplates] = useState(savedState?.eventTemplates ?? [])
  const [schedule, setSchedule] = useState(
    (savedState?.schedule ?? initialSchedule).map(normalizeScheduleItem),
  )
  const displayPreferences = normalizeDisplayPreferences(privacyPreferences.display, athleteProfile?.unitSystem)
  const athleteDisplayName = athleteProfile?.displayName || session?.user?.email || 'Athlete'
  const ageAccess = getAgeAccess(athleteProfile)
  const isSupabaseSession = Boolean(supabase && session?.user?.id && isAppUnlocked)
  resetAccountStateRef.current = resetAccountState
  const todayIso = getTodayIso()
  const todayEvents = useMemo(
    () => sortScheduleEvents(schedule.filter((event) => event.date === todayIso)),
    [schedule, todayIso],
  )
  const completedCheckoutEventIds = useMemo(
    () => new Set(checkouts.map((checkout) => checkout.eventId).filter(Boolean)),
    [checkouts],
  )
  const completedCheckInEventIds = useMemo(
    () => new Set(history.map((entry) => entry.eventId).filter(Boolean)),
    [history],
  )
  const currentTodayCheckInEvent = useMemo(
    () => {
      const nextRequiredEvent = todayEvents.find((event) => isInsideCheckInWindow(event)
        && !completedCheckoutEventIds.has(event.id)
        && !completedCheckInEventIds.has(event.id))
      return nextRequiredEvent && isInsideCheckInWindow(nextRequiredEvent) ? nextRequiredEvent : null
    },
    [completedCheckInEventIds, completedCheckoutEventIds, todayEvents],
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
      hydration: getHydrationStatus(dailyWellness?.hydrationMl, athleteProfile, schedule, todayIso),
      hydrationMl: Math.max(0, Number(dailyWellness?.hydrationMl ?? 0)),
      notes: '',
      plannedIntensity: selectedCheckInEvent?.load ?? 'Open',
      session: getSessionFromEvent(selectedCheckInEvent) || getSessionFromSchedule(todayEvents),
      yesterdayLoad: getYesterdayLoadFromSchedule(schedule),
    }),
    [athleteProfile, checkIn, dailyWellness?.hydrationMl, schedule, selectedCheckInEvent, todayEvents, todayIso],
  )
  const nutritionContext = useMemo(() => {
    const entries = dailyWellness?.nutritionEntries ?? []
    const hydrationMl = Math.max(0, Number(dailyWellness?.hydrationMl ?? 0))

    return {
      hasFoodLogs: entries.length > 0,
      hasHydrationLogs: hydrationMl > 0,
      hydrationMl,
      hydrationTargetMl: getHydrationTarget(athleteProfile, schedule, todayIso),
      mealBreakdown: getMealNutritionBreakdown(entries),
      targets: getNutritionTargets(athleteProfile, schedule, todayIso),
      totals: entries.length > 0 ? getNutritionTotals(entries) : null,
    }
  }, [athleteProfile, dailyWellness?.hydrationMl, dailyWellness?.nutritionEntries, schedule, todayIso])
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
      hydration: scheduleDrivenCheckIn.hydration,
      hydrationMl: scheduleDrivenCheckIn.hydrationMl,
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
      scheduleDrivenCheckIn.hydration,
      scheduleDrivenCheckIn.hydrationMl,
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
    () => getAthleteInsights({ history, checkouts, painReports, recoveryCompletions }),
    [checkouts, history, painReports, recoveryCompletions],
  )

  useEffect(() => {
    if (!session?.user || !athleteProfile?.athleteId) return
    upsertAthleteInsights({
      athleteId: athleteProfile.athleteId,
      insights: trendInsights,
    }).catch((error) => console.warn('Unable to update athlete insights.', error))
  }, [athleteProfile?.athleteId, session?.user, trendInsights])

  const resetDeletedSessionEvent = useEffectEvent(resetDeletedSession)

  useEffect(() => {
    setIsMobileAccountMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeView])

  useEffect(() => {
    if (!isMobileAccountMenuOpen) return undefined
    const desktopQuery = window.matchMedia('(min-width: 761px)')
    const closeOnDesktop = (event) => {
      if (event.matches) setIsMobileAccountMenuOpen(false)
    }
    desktopQuery.addEventListener('change', closeOnDesktop)
    return () => desktopQuery.removeEventListener('change', closeOnDesktop)
  }, [isMobileAccountMenuOpen])

  useEffect(() => {
    let active = true
    Promise.all([...Object.keys(viewModules).map(loadView), loadAuthGate()]).then(() => {
      if (active) setAreViewsReady(true)
    }).catch(() => {
      // A failed view import will surface through the app error boundary on reload.
    })
    return () => { active = false }
  }, [])

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
        if (checkout.date !== today || recoveryPlans.some((plan) => plan.sourceCheckoutId === checkout.id)) return

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
  }, [checkouts, history, privacyPreferences.remindersEnabled, recoveryPlans, schedule])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    async function savePendingOauthConsent(nextSession) {
      if (!nextSession) return
      const pendingSource = sessionStorage.getItem('athlete-reload-pending-legal-consent')
      const metadata = nextSession.user?.user_metadata ?? {}
      const source = pendingSource || (metadata.age_16_or_older_confirmed ? 'password_signup' : '')
      if (!source) return
      try {
        await recordLegalConsent(source)
        sessionStorage.removeItem('athlete-reload-pending-legal-consent')
      } catch (error) {
        console.error('Unable to record legal consent', error)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        void savePendingOauthConsent(data.session)
        setSession(data.session)
        if (data.session && !hasEnteredAuthenticatedAppRef.current) setIsStartupComplete(false)
        setIsAppUnlocked(Boolean(data.session))
        setIsAuthReady(true)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void savePendingOauthConsent(nextSession)
      if (event === 'SIGNED_OUT') {
        resetAccountStateRef.current?.()
        return
      }
      isSigningOutRef.current = false
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthEntryMode('reset-password')
      }
      if (!nextSession) {
        setIsAppUnlocked(false)
        setAuthEntryMode('landing')
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (shouldRestartStartupForAuthEvent({ event, hasEnteredAuthenticatedApp: hasEnteredAuthenticatedAppRef.current })) {
          setIsStartupComplete(false)
        }
        setIsAppUnlocked(true)
      } else if (event === 'TOKEN_REFRESHED') {
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
    if (isStartupComplete && isAppUnlocked && session?.user) hasEnteredAuthenticatedAppRef.current = true
  }, [isAppUnlocked, isStartupComplete, session?.user])

  useEffect(() => {
    const accountId = session?.user?.id ?? 'guest'
    const scope = selectedCheckInEvent?.id ?? todayIso
    const identity = { accountId, feature: 'checkin', scope }
    hydratedCheckInDraftKeyRef.current = `${accountId}:${scope}`
    const savedDraft = loadDraft(identity)
    if (savedDraft) setCheckIn(normalizeCheckInScales({ ...getFreshCheckInDefaults(), ...savedDraft }))
  }, [selectedCheckInEvent?.id, session?.user?.id, todayIso])

  useEffect(() => {
    const accountId = session?.user?.id ?? 'guest'
    const scope = selectedCheckInEvent?.id ?? todayIso
    if (hydratedCheckInDraftKeyRef.current !== `${accountId}:${scope}`) return
    saveDraft({ accountId, feature: 'checkin', scope }, checkIn)
  }, [checkIn, selectedCheckInEvent?.id, session?.user?.id, todayIso])

  useEffect(() => {
    if (!canPersistGuestState({
      authReady: isAuthReady,
      hasSupabaseSession: isSupabaseSession,
      isSigningOut: isSigningOutRef.current,
    })) {
      return
    }

    saveState({
      athleteProfile,
      checkIn,
      associations,
      eventTemplates,
      checkouts,
      history,
      painReports,
      painIssues,
      savedRoutines,
      recoveryCompletions,
      recoveryPlans,
      shareAuditLogs,
      tournaments,
      dailyWellness,
      nutritionHistory,
      privacyPreferences,
      schedule,
    })
  }, [associations, athleteProfile, checkIn, checkouts, dailyWellness, eventTemplates, history, isAuthReady, isSupabaseSession, nutritionHistory, painIssues, painReports, privacyPreferences, recoveryCompletions, recoveryPlans, savedRoutines, schedule, shareAuditLogs, tournaments])

  useAthleteSnapshotController({
    enabled: isSupabaseSession,
    onDeletedSession: resetDeletedSession,
    onFailure: () => setIsProfileReady(false),
    onSnapshot: applyRemoteSnapshot,
    onStatus: setDataStatus,
    privacyDefaults,
    reloadKey: todayIso,
  })

  function applyRemoteSnapshot({ data, preferences, profile }) {
    setSchedule(data.schedule)
    setAssociations(data.associations)
    setEventTemplates(data.eventTemplates ?? [])
    setHistory(data.history)
    setCheckouts(data.checkouts)
    setPainReports(data.painReports)
    setPainIssues(data.painIssues)
    setSavedRoutines(data.savedRoutines)
    setRecoveryCompletions(data.recoveryCompletions ?? [])
    setRecoveryPlans(data.recoveryPlans ?? [])
    const latestLivingPlan = data.recoveryPlans?.[0]
    if (latestLivingPlan?.plan) {
      setGeneratedRecoveryPlan({ ...latestLivingPlan.plan, routine: undefined, generatedAt: latestLivingPlan.generatedAt ?? latestLivingPlan.refreshedAt, recordType: 'recovery_plan', sourceCheckoutId: latestLivingPlan.sourceCheckoutId ?? null })
      setRecoveryPlanStatus('saved')
    }
    setShareAuditLogs(data.shareAuditLogs)
    setTournaments(data.tournaments)
    setDailyWellness(data.wellness ?? { date: todayIso, hydrationMl: 0, nutritionEntries: [] })
    setNutritionHistory(data.wellnessHistory ?? [])
    const display = normalizeDisplayPreferences(preferences.display, profile?.unitSystem)
    setPrivacyPreferences({ ...privacyDefaults, ...preferences, display })
    setActiveView(display.defaultView)
    setAthleteProfile(profile)
    setIsProfileReady(true)
    setDataStatus('ready')
  }

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
        await resetDeletedSessionEvent()
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
        hydration: getHydrationStatus(hydrationMl, athleteProfile, schedule, todayIso),
        hydrationMl,
      }))
      return
    }

    if (field === 'painMap') {
      setCheckIn((current) => applyPainMapToCheckIn({
        ...current,
        painMap: value,
      }))
      return
    }

    if (field === 'pain' && value === 0) {
      setCheckIn((current) => ({
        ...current,
        affectedMovement: null,
        hurtsWhen: null,
        injuryType: null,
        location: null,
        pain: 0,
        painDetails: {},
        painTrend: null,
        painType: null,
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
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      setActiveView('Home')
      setSubmittedRecommendation(previousEntry.recommendation)
      setSubmittedRecommendationStatus('ai')
      setSubmittedRecommendationContext({
        checkIn: previousEntry,
        scoreLabel: 'readiness',
        session: scheduleDrivenCheckIn.session,
        title: `Your plan for ${scheduleDrivenCheckIn.session}`,
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
    const baseline = getPersonalBaseline(history, selectedCheckInEvent)
    const deterministicRecommendation = getRecommendation({
      ...savedCheckIn,
      baseline,
      baselineSampleSize: baseline.sampleSize,
    })
    let finalRecommendation = savedCheckIn.quickRecommendation
      ? mergeAiExplanation(deterministicRecommendation, savedCheckIn.quickRecommendation)
      : deterministicRecommendation
    let finalRecommendationStatus = savedCheckIn.quickRecommendation ? 'ai' : 'local'
    let deterministicSave = null

    if (isSupabaseSession) {
      try {
        deterministicSave = await saveCheckInWithPainReports(savedCheckIn, deterministicRecommendation, getPainReportsWithResolutions(
          savedCheckIn.painMap,
          {
            date: savedCheckIn.eventDate ?? todayIso,
            notes: savedCheckIn.notes,
            painDetails: savedCheckIn.painDetails,
            relatedEventId: savedCheckIn.eventId,
            sourceId: previousEntry?.id ?? null,
            sourceType: 'check_in',
            triggerMovement: savedCheckIn.hurtsWhen,
          },
          painReports.filter((report) => report.sourceId !== previousEntry?.id),
        ), isEditingToday ? previousEntry?.id : null)
        setHistory((current) => [deterministicSave.record, ...current.filter((entry) => entry.id !== deterministicSave.record.id && entry.eventId !== deterministicSave.record.eventId)])
        setPainReports((current) => [...deterministicSave.painReports, ...current.filter((report) => report.sourceId !== deterministicSave.record.id && report.sourceId !== previousEntry?.id)])
        setDataStatus('synced')
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        setIsSavingCheckIn(false)
        return
      }
    }

    if (isSupabaseSession && !savedCheckIn.quickRecommendation) {
      try {
        const previousCheckout = getPreviousCheckout(checkouts, schedule, selectedCheckInEvent)
        const previousRecoveryCompletion = recoveryCompletions.find((completion) =>
          completion.sourceCheckoutId === previousCheckout?.id
            && String(completion.completedAt ?? '').startsWith(selectedCheckInEvent?.date ?? todayIso),
        )

        const generatedAt = new Date().toISOString()
        const event = attachTournamentContext(selectedCheckInEvent, tournaments, schedule)
        const scheduleContext = getRecommendationScheduleContext(schedule, selectedCheckInEvent)
        const recentEvents = checkouts.slice(0, 4).map(withoutNotes)
        const aiRecommendation = await generateAiRecommendation({
          athleteProfile,
          athleteContext: buildAthleteContext({
            athleteProfile,
            checkIn: savedCheckIn,
            event,
            generatedAt,
            nutritionContext,
            recentEvents,
            recentPainReports: painReports,
            scheduleContext,
          }),
          baseline,
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
          event,
          generatedAt,
          nutritionContext,
          recentEvents,
          sportContext: getSportContext({ athleteProfile, event: selectedCheckInEvent }),
          previousCheckout: getPreviousCheckoutRecommendationContext(previousCheckout, savedCheckIn),
          previousRecoveryCompletion: withoutNotes(previousRecoveryCompletion),
          requestType: 'check_in',
          deterministicRecommendation,
          scheduleContext,
        }, { personalize: privacyPreferences.aiPersonalizationEnabled !== false })
        finalRecommendation = mergeAiExplanation(deterministicRecommendation, aiRecommendation)
        finalRecommendationStatus = 'ai'
      } catch (error) {
        console.error('Check-in AI recommendation failed', error)
        finalRecommendation = deterministicRecommendation
        finalRecommendationStatus = 'local'
        setCheckInAiError('Your check-in was saved, but the AI event plan could not be generated. Please try again from this check-in.')
      }
    }

    if (isSupabaseSession) {
      let savedEntry = null
      try {
        const result = await saveCheckInWithPainReports(savedCheckIn, finalRecommendation, getPainReportsWithResolutions(
          savedCheckIn.painMap,
          {
            date: savedCheckIn.eventDate ?? todayIso,
            notes: savedCheckIn.notes,
            painDetails: savedCheckIn.painDetails,
            relatedEventId: savedCheckIn.eventId,
            sourceId: deterministicSave?.record.id ?? (isEditingToday ? previousEntry?.id : null),
            sourceType: 'check_in',
            triggerMovement: savedCheckIn.hurtsWhen,
          },
          painReports.filter((report) => report.sourceId !== previousEntry?.id),
        ), deterministicSave?.record.id ?? (isEditingToday ? previousEntry?.id : null))
        savedEntry = result.record
        const savedPainReports = result.painReports
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
        if (athleteProfile?.athleteId) {
          const recommendationRecord = await createRecommendationRecord({
            athleteId: athleteProfile.athleteId,
            sourceType: 'check_in',
            sourceId: savedEntry.id,
            recommendation: finalRecommendation,
            contextSnapshot: {
              eventId: savedCheckIn.eventId,
              eventDate: savedCheckIn.eventDate,
              engineVersion: finalRecommendation.engineVersion,
            },
          }).catch((error) => { console.warn('Unable to store recommendation record.', error); return null })
          if (recommendationRecord?.id) finalRecommendation.recordId = recommendationRecord.id
          const nextHistory = [savedEntry, ...history.filter((entry) => entry.id !== savedEntry.id)]
          upsertAthleteBaselines({
            athleteId: athleteProfile.athleteId,
            records: getRollingBaselineRecords({ checkouts, event: selectedCheckInEvent, history: nextHistory, painReports, recoveryCompletions }),
          }).catch((error) => console.warn('Unable to update athlete baselines.', error))
        }
        setDataStatus('synced')
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
          painDetails: scheduleDrivenCheckIn.painDetails,
          relatedEventId: scheduleDrivenCheckIn.eventId,
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
    clearDraft({ accountId: session?.user?.id ?? 'guest', feature: 'checkin', scope: selectedCheckInEvent?.id ?? todayIso })
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
    setActiveView('Home')
    if (finalRecommendationStatus === 'ai') {
      setSubmittedRecommendation(finalRecommendation)
      setSubmittedRecommendationStatus('ai')
      setSubmittedRecommendationContext({
        checkIn: savedCheckIn,
        scoreLabel: 'readiness',
        session: scheduleDrivenCheckIn.session,
        title: `Your plan for ${scheduleDrivenCheckIn.session}`,
      })
    }
    setIsSavingCheckIn(false)
  }

  async function updateScheduleItem(id, updates) {
    const previousEvent = schedule.find((item) => item.id === id)
    const updatedEvent = { ...previousEvent, ...updates }
    const contextualUpdates = {
      ...updates,
      activityKey: updates.activityKey ?? previousEvent?.activityKey ?? athleteProfile?.sport ?? 'Other',
      demandSnapshot: getActivityDemandProfile({ sport: athleteProfile?.sport ?? 'Other', event: updatedEvent }),
    }
    setSchedule((current) =>
      current.map((item) => (item.id === id ? { ...item, ...contextualUpdates } : item)),
    )

    if (!isSupabaseSession) {
      return true
    }

    try {
      const savedEvent = await updateScheduleEvent(id, contextualUpdates)
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
      activityKey: event.activityKey ?? athleteProfile?.sport ?? 'Other',
      athleteId: athleteProfile?.athleteId ?? null,
      demandSnapshot: getActivityDemandProfile({ sport: athleteProfile?.sport ?? 'Other', event }),
      load: event.type === 'Other activity' ? event.load ?? 'Medium' : getDefaultLoadForEvent(event.type),
      title: getEventDisplayName(event),
    }

    if (isSupabaseSession) {
      try {
        const savedEvent = await createScheduleEvent(eventToSave)
        setSchedule((current) => [...current, savedEvent])
        setDataStatus('synced')
        if (onboardingTour === 'schedule') {
          setActiveView('Check-in')
          setOnboardingTour('checkin')
        }
        return true
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        return error
      }
    }

    setSchedule((current) => [...current, eventToSave])
    if (onboardingTour === 'schedule') {
      setActiveView('Check-in')
      setOnboardingTour('checkin')
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
      const saved = await saveTournamentWithGames(
        { ...localTournament, id: undefined },
        games.map((game) => ({
          ...game,
          tournamentId: null,
          load: getDefaultLoadForEvent('Game'),
          title: 'Game',
          type: 'Game',
        })),
      )
      setTournaments((current) => [...current, saved.tournament])
      setSchedule((current) => [...current, ...saved.games])
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function editTournament(tournamentDraft, games) {
    const updatedTournament = { ...tournamentDraft, id: tournamentDraft.id }
    if (!isSupabaseSession) {
      setSchedule((current) => [
        ...current.filter((event) => event.tournamentId !== tournamentDraft.id),
        ...games.map((game) => ({ ...game, tournamentId: tournamentDraft.id, load: 'High', title: 'Game', type: 'Game' })),
      ])
      setTournaments((current) => current.map((item) => item.id === updatedTournament.id ? updatedTournament : item))
      return true
    }

    try {
      const saved = await saveTournamentWithGames(updatedTournament, games.map((game) => ({
        ...game,
        tournamentId: tournamentDraft.id,
        load: 'High',
        title: 'Game',
        type: 'Game',
      })))
      setSchedule((current) => [
        ...current.filter((event) => event.tournamentId !== tournamentDraft.id),
        ...saved.games,
      ])
      setTournaments((current) => current.map((item) => item.id === saved.tournament.id ? saved.tournament : item))
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function removeTournament(tournamentId) {
    const games = schedule.filter((event) => event.tournamentId === tournamentId)
    if (!isSupabaseSession) {
      setSchedule((current) => current.filter((event) => event.tournamentId !== tournamentId))
      setTournaments((current) => current.filter((tournament) => tournament.id !== tournamentId))
      return
    }

    try {
      await deleteTournamentWithGames(tournamentId)
      const relatedSourceIds = new Set([
        ...history.filter((entry) => games.some((game) => game.id === entry.eventId)).map((entry) => entry.id),
        ...checkouts.filter((entry) => games.some((game) => game.id === entry.eventId)).map((entry) => entry.id),
      ])
      setSchedule((current) => current.filter((event) => event.tournamentId !== tournamentId))
      setHistory((current) => current.filter((entry) => !games.some((game) => game.id === entry.eventId)))
      setCheckouts((current) => current.filter((entry) => !games.some((game) => game.id === entry.eventId)))
      setPainReports((current) => current.filter((report) => !relatedSourceIds.has(report.sourceId)))
      setTournaments((current) => current.filter((tournament) => tournament.id !== tournamentId))
    } catch (error) {
      console.error(error)
      setDataStatus('error')
    }
  }

  async function removeScheduleItem(id) {
    const removedEvent = schedule.find((item) => item.id === id)
    const relatedCheckIns = history.filter((entry) => entry.eventId === id)
    const relatedCheckouts = checkouts.filter((checkout) => checkout.eventId === id)
    const relatedSourceIds = new Set([
      ...relatedCheckIns.map((entry) => entry.id),
      ...relatedCheckouts.map((checkout) => checkout.id),
    ].filter(Boolean))
    const removedPainReports = painReports.filter((report) => relatedSourceIds.has(report.sourceId))

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
      await deleteScheduleEvent(id)
      setDataStatus('synced')
    } catch (error) {
      console.error(error)
      setSchedule((current) => [...current, removedEvent].filter(Boolean))
      setHistory((current) => [...relatedCheckIns, ...current])
      setCheckouts((current) => [...relatedCheckouts, ...current])
      setPainReports((current) => [...removedPainReports, ...current])
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
    const issue = transitionPainIssue(existing, nextIssue, todayIso)

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

    if (kind === 'recovery-completion' || kind === 'mobility-routine') {
      const removedCompletion = recoveryCompletions.find((item) => item.id === entry.id) ?? entry
      setRecoveryCompletions((current) => current.filter((item) => item.id !== entry.id))

      if (isSupabaseSession) {
        try {
          await deleteRecoveryRoutineCompletion(entry.id)
        } catch (error) {
          console.error(error)
          setRecoveryCompletions((current) => [removedCompletion, ...current.filter((item) => item.id !== entry.id)])
          setDataStatus('error')
          throw error
        }
      }
      return
    }

    if (kind === 'recovery-plan') {
      const removedPlan = recoveryPlans.find((item) => item.id === entry.id) ?? entry
      setRecoveryPlans((current) => current.filter((item) => item.id !== entry.id))
      if (isSupabaseSession) {
        try {
          await deleteRecoveryPlan(entry.id)
        } catch (error) {
          console.error(error)
          setRecoveryPlans((current) => [removedPlan, ...current.filter((item) => item.id !== entry.id)])
          setDataStatus('error')
          throw error
        }
      }
      return
    }

    if (kind === 'recovery') {
      const checkout = checkouts.find((item) => item.id === entry.id)
      if (!checkout) return

      const recommendation = { ...(checkout.recommendation ?? {}) }
      delete recommendation.recoveryPlan
      const updatedCheckout = { ...checkout, recommendation }
      setCheckouts((current) => [updatedCheckout, ...current.filter((item) => item.id !== checkout.id)])

      if (isSupabaseSession) {
        try {
          await deleteHistoryEntryComplete('recovery', checkout.id)
        } catch (error) {
          console.error(error)
          setCheckouts((current) => [checkout, ...current.filter((item) => item.id !== checkout.id)])
          setDataStatus('error')
          throw error
        }
      }
      return
    }

    if (kind === 'checkout') {
      const removedPainReports = painReports.filter((report) => report.sourceId === entry.id)
      setCheckouts((current) => current.filter((item) => item.id !== entry.id))
      setPainReports((current) => current.filter((report) => report.sourceId !== entry.id))

      if (isSupabaseSession) {
        try {
          await deleteHistoryEntryComplete('checkout', entry.id)
        } catch (error) {
          console.error(error)
          setCheckouts((current) => [entry, ...current.filter((item) => item.id !== entry.id)])
          setPainReports((current) => [...removedPainReports, ...current.filter((report) => report.sourceId !== entry.id)])
          setDataStatus('error')
          throw error
        }
      }
      return
    }

    const removedPainReports = painReports.filter((report) => report.sourceId === entry.id)
    setHistory((current) => current.filter((item) => item.id !== entry.id))
    setPainReports((current) => current.filter((report) => report.sourceId !== entry.id))

    if (isSupabaseSession) {
      try {
        await deleteHistoryEntryComplete('check_in', entry.id)
      } catch (error) {
        console.error(error)
        setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)])
        setPainReports((current) => [...removedPainReports, ...current.filter((report) => report.sourceId !== entry.id)])
        setDataStatus('error')
        throw error
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

  async function saveEventTemplate(name, template) {
    const cleanName = name.trim()
    if (!cleanName) return false

    const templateToSave = {
      ...template,
      date: undefined,
      id: undefined,
      recurrenceRule: {},
      repeat: 'Does not repeat',
      repeatCount: 1,
      templateSourceId: undefined,
    }

    if (!isSupabaseSession) {
      setEventTemplates((current) => [{ id: `template-${Date.now()}`, name: cleanName, template: templateToSave }, ...current])
      return true
    }

    try {
      const savedTemplate = await createEventTemplate({ athleteId: athleteProfile?.athleteId, name: cleanName, template: templateToSave })
      setEventTemplates((current) => [savedTemplate, ...current])
      setDataStatus('synced')
      return true
    } catch (error) {
      console.error(error)
      setDataStatus('error')
      return false
    }
  }

  async function removeEventTemplate(id) {
    const previousTemplates = eventTemplates
    setEventTemplates((current) => current.filter((template) => template.id !== id))
    if (!isSupabaseSession) return true

    try {
      await deleteEventTemplate(id)
      return true
    } catch (error) {
      console.error(error)
      setEventTemplates(previousTemplates)
      setDataStatus('error')
      return false
    }
  }

  async function renameAssociation(id, name) {
    const trimmedName = name.trim()
    const previousAssociations = associations

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
      setAssociations(previousAssociations)
      setDataStatus('error')
    }
  }

  async function removeAssociation(id) {
    const association = associations.find((item) => item.id === id)
    const previousAssociations = associations
    const previousSchedule = schedule

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
      setAssociations(previousAssociations)
      setSchedule(previousSchedule)
      setDataStatus('error')
    }
  }

  async function saveCheckout(event, checkout, existingCheckout) {
    const preCheckIn = history.find((entry) => entry.eventId === event.id)
    checkout = {
      ...checkout,
      painMap: normalizePainMapScale(checkout.painMap, preCheckIn?.pain),
    }
    const nextScheduledEvent = getNextScheduledEvent(schedule, event)
    const deterministicRecommendation = getCheckoutRecommendation(checkout, event, nextScheduledEvent)
    let finalRecommendation = existingCheckout?.recommendation
      ? mergeAiExplanation(deterministicRecommendation, existingCheckout.recommendation)
      : deterministicRecommendation
    let finalRecommendationStatus = existingCheckout?.recommendation?._source === 'gemini' ? 'ai' : 'local'
    let deterministicSave = null

    if (isSupabaseSession) {
      deterministicSave = await saveCheckoutWithPainReports(event, { ...checkout, recommendation: deterministicRecommendation }, getPainReportsFromMap(
        checkout.painMap,
        {
          date: event.date,
          notes: '',
          painDetails: checkout.painDetails,
          relatedEventId: event.id,
          sourceId: existingCheckout?.id ?? null,
          sourceType: 'checkout',
          triggerMovement: checkout.painChange,
        },
      ), existingCheckout?.id ?? null)
      setCheckouts((current) => [deterministicSave.record, ...current.filter((item) => item.id !== deterministicSave.record.id)])
      setPainReports((current) => [...deterministicSave.painReports, ...current.filter((report) => report.sourceId !== deterministicSave.record.id && report.sourceId !== existingCheckout?.id)])
    }

    if (isSupabaseSession && !existingCheckout?.recommendation) {
      try {
        const previousCheckout = getPreviousCheckout(checkouts, schedule, event)

        const generatedAt = new Date().toISOString()
        const completedEvent = attachTournamentContext(event, tournaments, schedule)
        const scheduleContext = getRecommendationScheduleContext(schedule, event)
        const recentEvents = checkouts.filter((item) => item.id !== existingCheckout?.id).slice(0, 4).map(withoutNotes)
        const aiRecommendation = await generateAiRecommendation({
          athleteProfile,
          athleteContext: buildAthleteContext({
            athleteProfile,
            checkIn: preCheckIn,
            checkout,
            event: completedEvent,
            generatedAt,
            nutritionContext,
            recentEvents,
            recentPainReports: painReports,
            scheduleContext,
          }),
          checkout: withoutNotes(checkout),
          completedEvent,
          dailyWellness: getCheckoutWellnessContext(dailyWellness, nutritionContext),
          generatedAt,
          nextScheduledEvent,
          nutritionContext,
          preCheckIn: withoutNotes(preCheckIn),
          previousCheckout: withoutNotes(previousCheckout),
          recentEvents,
          requestType: 'post_checkout',
          deterministicRecommendation,
          scheduleContext,
          sportContext: getSportContext({ athleteProfile, event, workload: checkout.sportWorkload }),
        }, { personalize: privacyPreferences.aiPersonalizationEnabled !== false })
        finalRecommendation = mergeAiExplanation(deterministicRecommendation, aiRecommendation)
        finalRecommendationStatus = 'ai'
      } catch (error) {
        console.error(error)
        finalRecommendation = deterministicRecommendation
        finalRecommendationStatus = 'local'
      }
    }

    const checkoutWithRecommendation = {
      ...checkout,
      recommendation: finalRecommendation,
    }

    if (isSupabaseSession) {
      let savedCheckout
      let savedPainReports = []

      try {
        const result = await saveCheckoutWithPainReports(event, checkoutWithRecommendation, getPainReportsFromMap(
          checkout.painMap,
          {
            date: event.date,
            notes: '',
            painDetails: checkout.painDetails,
            relatedEventId: event.id,
            sourceId: existingCheckout?.id ?? null,
            sourceType: 'checkout',
            triggerMovement: checkout.painChange,
          },
        ), deterministicSave?.record.id ?? existingCheckout?.id ?? null)
        savedCheckout = result.record
        savedPainReports = result.painReports
      } catch (error) {
        console.error(error)
        setDataStatus('error')
        throw error
      }

      setCheckouts((current) => [
        savedCheckout,
        ...current.filter((item) => item.id !== savedCheckout.id),
      ])
      setPainReports((current) => [
        ...savedPainReports,
        ...current.filter((report) => report.sourceId !== savedCheckout.id),
      ])
      if (athleteProfile?.athleteId) {
        const recommendationRecord = await createRecommendationRecord({
          athleteId: athleteProfile.athleteId,
          sourceType: 'checkout',
          sourceId: savedCheckout.id,
          recommendation: finalRecommendation,
          contextSnapshot: { eventId: event.id, eventDate: event.date, sessionLoad: finalRecommendation.sessionLoad },
        }).catch((error) => { console.warn('Unable to store checkout recommendation record.', error); return null })
        if (recommendationRecord?.id) finalRecommendation.recordId = recommendationRecord.id
        upsertAthleteBaselines({
          athleteId: athleteProfile.athleteId,
          records: getRollingBaselineRecords({
            checkouts: [savedCheckout, ...checkouts.filter((item) => item.id !== savedCheckout.id)],
            event,
            history,
            painReports: savedPainReports,
            recoveryCompletions,
          }),
        }).catch((error) => console.warn('Unable to update checkout baselines.', error))
      }
      if (savedCheckout.recommendationNotPersisted) {
        setDataStatus('offline')
      } else {
        setDataStatus('synced')
      }
      await ensureCheckoutRecoveryPlan(finalRecommendation, savedCheckout, event, nextScheduledEvent, finalRecommendationStatus)
      advanceCheckInAfterCheckout(event, savedCheckout)
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      setCheckoutEvent(null)
      setActiveView('Home')
      setSubmittedRecommendation(finalRecommendation)
      setSubmittedRecommendationStatus(finalRecommendationStatus)
      setSubmittedRecommendationContext({ scoreLabel: 'recovery', session: event.title || event.type, title: 'Checkout complete' })
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
        painDetails: checkout.painDetails,
        relatedEventId: event.id,
        sourceId: savedCheckout.id,
        sourceType: 'checkout',
        triggerMovement: checkout.painChange,
      }).map((report) => ({
        ...report,
        id: `pain-${Date.now()}-${report.bodyPart}`,
      })),
      ...current.filter((report) => report.sourceId !== savedCheckout.id),
    ])
    await ensureCheckoutRecoveryPlan(finalRecommendation, savedCheckout, event, nextScheduledEvent, finalRecommendationStatus)
    advanceCheckInAfterCheckout(event, savedCheckout)
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
    setCheckoutEvent(null)
    setActiveView('Home')
    setSubmittedRecommendation(finalRecommendation)
    setSubmittedRecommendationStatus(finalRecommendationStatus)
    setSubmittedRecommendationContext({ scoreLabel: 'recovery', session: event.title || event.type, title: 'Checkout complete' })
  }

  async function persistLivingRecoveryPlan(plan, checkout, completedEvent, upcomingEvent, actionStatuses = {}) {
    if (!plan) return null
    const record = {
      sourceCheckoutId: checkout?.id ?? null,
      sourceEventId: checkout?.eventId ?? completedEvent?.id ?? null,
      nextEventId: upcomingEvent?.id ?? null,
      plan,
      inputSignature: getRecoveryPlanInputSignature(checkout?.id),
      contextSnapshot: {
        checkout: checkout ? withoutNotes(checkout) : null,
        event: completedEvent ? withoutNotes(completedEvent) : null,
        nextEvent: upcomingEvent ? withoutNotes(upcomingEvent) : null,
        recentCheckin: history.find((entry) => entry.eventId === checkout?.eventId) ?? null,
        fatigue: checkout?.postFatigue ?? null,
        soreness: checkout?.postSoreness ?? null,
        pain: checkout?.painMap ?? null,
        sleep: dailyWellness?.sleep ?? null,
        nutritionContext,
        hydrationContext: { hydrationMl: dailyWellness?.hydrationMl ?? null },
        wellnessUpdatedAt: dailyWellness?.updatedAt ?? null,
      },
      actionStatuses,
      engineVersion: plan.engineVersion,
      promptVersion: plan.promptVersion,
      catalogVersion: plan.catalogVersion,
    }
    if (!isSupabaseSession) {
      const existing = findRecoveryPlanForCheckout(recoveryPlans, checkout?.id)
      if (existing) return existing
      const local = { ...record, generatedAt: plan.generatedAt, id: `recovery-plan-${Date.now()}`, type: 'recovery_plan' }
      setRecoveryPlans((current) => findRecoveryPlanForCheckout(current, checkout?.id) ? current : [local, ...current])
      return local
    }
    const saved = await upsertRecoveryPlan(record)
    setRecoveryPlans((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
    return saved
  }

  async function ensureCheckoutRecoveryPlan(recommendation, checkout, completedEvent, upcomingEvent, sourceStatus = 'local') {
    if (!recommendation || !checkout?.id) return null
    generatedRecoveryCheckoutIdsRef.current.add(checkout.id)
    const existing = findRecoveryPlanForCheckout(recoveryPlans, checkout.id)
    if (existing?.plan) {
      setGeneratedRecoveryPlan({ ...existing.plan, generatedAt: existing.generatedAt ?? existing.refreshedAt, recordType: 'recovery_plan', sourceCheckoutId: checkout.id })
      setRecoveryPlanStatus('saved')
      return existing
    }

    const recoveryPlan = createCheckoutRecoveryPlan(recommendation, checkout)
    setGeneratedRecoveryPlan(recoveryPlan)
    setRecoveryPlanStatus(sourceStatus === 'ai' ? 'ai' : 'local')
    return persistLivingRecoveryPlan(recoveryPlan, checkout, completedEvent, upcomingEvent, {
      fueling: 'pending', hydration: 'pending', sleep: 'pending',
    }).catch((error) => {
      console.warn('Unable to persist the checkout recovery plan.', error)
      return null
    })
  }

  async function generateRecoveryContent({ kind = 'recovery_plan', equipmentAvailable = [], routineType = 'session_recovery', targetBodyParts = [], timeAvailableMinutes = 10 } = {}) {
    const isMobility = kind === 'mobility_routine'
    const planType = isMobility ? normalizeRoutineType(routineType) : 'session'
    const equipment = equipmentAvailable
    const targetedAreas = targetBodyParts
    const timeAvailable = `${Math.max(5, Math.min(30, Number(timeAvailableMinutes) || 10))} minutes`
    const latestCheckout = [...checkouts]
      .sort((first, second) => new Date(second.createdAt ?? `${second.date}T12:00:00`) - new Date(first.createdAt ?? `${first.date}T12:00:00`))[0]

    if (!latestCheckout && (!isMobility || planType === 'session_recovery')) {
      if (isMobility) setMobilityRoutineStatus('error')
      else setRecoveryPlanStatus('error')
      return
    }

    const usesCheckoutContext = !isMobility || planType === 'session_recovery'
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
      ...completedMobilityRoutines.map((item) => item?.details?.routineSnapshot?.exercises ?? []),
    ].map((routine) => routine.map((exercise) => exercise?.movementId ?? exercise?.id ?? exercise?.name).filter(Boolean)).filter((routine) => routine.length > 0).slice(0, 6)
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

    if (!isMobility && contextCheckout) {
      const existing = findRecoveryPlanForCheckout(recoveryPlans, contextCheckout.id)
      if (generatedRecoveryPlan?.sourceCheckoutId === contextCheckout.id) return generatedRecoveryPlan
      if (existing?.plan) {
        const savedPlan = { ...existing.plan, generatedAt: existing.generatedAt ?? existing.refreshedAt, recordType: 'recovery_plan', sourceCheckoutId: contextCheckout.id }
        setGeneratedRecoveryPlan(savedPlan)
        setRecoveryPlanStatus('saved')
        return savedPlan
      }
      if (contextCheckout.recommendation) {
        generatedRecoveryCheckoutIdsRef.current.add(contextCheckout.id)
        const checkoutPlan = createCheckoutRecoveryPlan(contextCheckout.recommendation, contextCheckout, contextCheckout.createdAt)
        setGeneratedRecoveryPlan(checkoutPlan)
        setRecoveryPlanStatus(contextCheckout.recommendation._source === 'gemini' ? 'ai' : 'local')
        await persistLivingRecoveryPlan(checkoutPlan, contextCheckout, completedEvent, nextScheduledEvent, {
          fueling: 'pending', hydration: 'pending', sleep: 'pending',
        }).catch((error) => console.warn('Unable to persist the checkout recovery plan.', error))
        return checkoutPlan
      }
      if (generatedRecoveryCheckoutIdsRef.current.has(contextCheckout.id)) return null
      generatedRecoveryCheckoutIdsRef.current.add(contextCheckout.id)
    }

    if (isMobility) setMobilityRoutineStatus('loading')
    else setRecoveryPlanStatus('loading')

    try {
      const generatedAt = new Date().toISOString()
      const scheduleContext = getRecommendationScheduleContext(schedule, completedEvent ?? nextScheduledEvent)
      const recentEvents = checkouts.slice(0, 4).map(withoutNotes)
      const eligibleCatalog = isMobility ? filterMovementCatalog({
        routineType: planType,
        equipmentAvailable: equipment,
        painSensitiveRegions: Object.keys(activePain),
        targetBodyParts: targetedAreas,
      }) : []
      const plan = await generateAiRecommendation({
        athleteProfile,
        athleteContext: buildAthleteContext({
          athleteProfile,
          checkIn: preCheckIn,
          checkout: contextCheckout,
          event: completedEvent ?? nextScheduledEvent,
          generatedAt,
          nutritionContext,
          recentEvents,
          recentPainReports: painReports,
          scheduleContext,
        }),
        checkout: withoutNotes(contextCheckout),
        completedEvent: completedEvent ? attachTournamentContext(completedEvent, tournaments, schedule) : null,
        currentRecoveryContext,
        dailyWellness,
        equipment,
        generatedAt,
        nextScheduledEvent,
        nutritionContext,
        planType,
        preCheckIn: withoutNotes(preCheckIn),
        recentPainReports: painReports.slice(0, 12).map(withoutNotes),
        recentEvents,
        ...(isMobility ? {
          recentRoutineExerciseNames,
          recentRoutineSequences,
          recoveryCompletions: completedMobilityRoutines.slice(0, 5),
          recoveryCatalog: eligibleCatalog.map(({ id, name, categories, routineTypes, bodyRegions, targetAreas, equipment: requiredEquipment, difficulty, prescriptionType, defaults, unilateral, position }) => ({ id, name, categories, routineTypes, bodyRegions, targetAreas, equipment: requiredEquipment, difficulty, prescriptionType, defaults, unilateral, position })),
        } : {}),
        requestType: isMobility ? 'mobility_routine' : 'recovery_plan',
        scheduleContext,
        sportContext: getSportContext({ athleteProfile, event: completedEvent, workload: latestCheckout?.sportWorkload }),
        targetedAreas,
        timeAvailable,
        variationKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        weeklyWorkloadContext,
      }, { personalize: privacyPreferences.aiPersonalizationEnabled !== false })

      if (isMobility) {
        const validated = createValidatedMobilityRoutine({
          routine: plan.routine ?? plan,
          routineType: planType,
          requestedDurationSeconds: Number.parseInt(timeAvailable, 10) * 60,
          equipmentAvailable: equipment,
          painSensitiveRegions: Object.keys(activePain),
          targetBodyParts: targetedAreas,
          previousMovementIds: recentRoutineExerciseNames,
        })
        setGeneratedMobilityRoutine({ ...validated.routine, generatedAt, generationContext: { checkoutId: contextCheckout?.id ?? null, equipmentAvailable: equipment, painRegions: Object.keys(activePain), targetBodyParts: targetedAreas }, validationErrors: validated.errors })
        setMobilityRoutineStatus('ai')
      } else {
        const recoveryPlan = { ...plan, generatedAt, recordType: 'recovery_plan', sourceCheckoutId: contextCheckout?.id ?? null }
        delete recoveryPlan.routine
        setGeneratedRecoveryPlan(recoveryPlan)
        setRecoveryPlanStatus('ai')
        await persistLivingRecoveryPlan(recoveryPlan, latestCheckout, completedEvent, nextScheduledEvent, {
          fueling: 'pending', hydration: 'pending', sleep: 'pending',
        }).catch((error) => console.warn('Unable to persist the recovery plan.', error))
      }
    } catch (error) {
      console.error(error)
      if (isMobility) {
        const fallback = createValidatedMobilityRoutine({
          routine: { exercises: [] },
          routineType: planType,
          requestedDurationSeconds: Number.parseInt(timeAvailable, 10) * 60,
          equipmentAvailable: equipment,
          painSensitiveRegions: Object.keys(activePain),
          targetBodyParts: targetedAreas,
        }).routine
        setGeneratedMobilityRoutine({ ...fallback, generatedAt: new Date().toISOString(), generationContext: { checkoutId: contextCheckout?.id ?? null, equipmentAvailable: equipment, painRegions: Object.keys(activePain), targetBodyParts: targetedAreas } })
        setMobilityRoutineStatus('local')
        return
      }
      if (isSupabaseSession) {
        if (contextCheckout?.id) generatedRecoveryCheckoutIdsRef.current.delete(contextCheckout.id)
        setGeneratedRecoveryPlan(null)
        setRecoveryPlanStatus('error')
        return
      }
      const fallback = buildFallbackRecommendation('recovery_plan', buildAthleteContext({
        athleteProfile,
        checkIn: preCheckIn,
        checkout: contextCheckout,
        event: completedEvent ?? nextScheduledEvent,
        nutritionContext,
        recentEvents: checkouts,
        recentPainReports: painReports,
        scheduleContext: getRecommendationScheduleContext(schedule, completedEvent ?? nextScheduledEvent),
      }))
      setGeneratedRecoveryPlan({
        ...fallback,
        planType,
        generatedAt: new Date().toISOString(),
        recordType: 'recovery_plan',
        sourceCheckoutId: contextCheckout?.id ?? null,
        routine: undefined,
      })
      setRecoveryPlanStatus('local')
      await persistLivingRecoveryPlan({
        ...fallback,
        planType,
        generatedAt: new Date().toISOString(),
        recordType: 'recovery_plan',
        routine: undefined,
      }, contextCheckout, completedEvent, nextScheduledEvent, {
        fueling: 'pending', hydration: 'pending', sleep: 'pending',
      }).catch((persistError) => console.warn('Unable to persist the local recovery plan.', persistError))
    }
  }

  function generateRecoveryPlan() {
    return generateRecoveryContent({ kind: 'recovery_plan' })
  }

  function generateMobilityRoutine(options) {
    return generateRecoveryContent({ kind: 'mobility_routine', ...options })
  }

  async function startMobilityRoutine(sessionData) {
    const local = {
      ...sessionData,
      completedAt: sessionData.startedAt,
      details: { type: 'mobility_routine', routineSnapshot: sessionData.routineSnapshot },
      id: `mobility-routine-${Date.now()}`,
      sourceCheckoutId: sessionData.sourceCheckoutId ?? null,
      type: 'mobility_routine',
    }
    if (!isSupabaseSession) {
      setRecoveryCompletions((current) => [local, ...current])
      return local
    }
    try {
      const saved = await createRecoveryRoutineCompletion(local)
      setRecoveryCompletions((current) => [saved, ...current])
      return saved
    } catch (error) {
      console.error('Unable to start mobility routine', error)
      setDataStatus('error')
      throw error
    }
  }

  async function completeMobilityRoutine(completion) {
    const local = { ...completion, completedAt: completion.finishedAt, type: 'mobility_routine' }
    if (!isSupabaseSession || !completion.id || String(completion.id).startsWith('mobility-routine-')) {
      setRecoveryCompletions((current) => [local, ...current.filter((item) => item.id !== completion.id)])
      return local
    }
    try {
      const saved = await updateRecoveryRoutineCompletion(completion.id, completion)
      setRecoveryCompletions((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      return saved
    } catch (error) {
      console.error('Unable to complete mobility routine', error)
      setDataStatus('error')
      throw error
    }
  }

  async function saveMobilityRoutine(entry) {
    const routine = { ...entry, isFavorite: true, catalogVersion: entry.routine?.exercises?.[0]?.catalogVersion ?? 'mobility-catalog-3.0.0' }
    if (!isSupabaseSession) {
      const local = { ...routine, id: `saved-routine-${Date.now()}` }
      setSavedRoutines((current) => [local, ...current])
      return local
    }
    try {
      const saved = await createSavedRecoveryRoutine(routine)
      setSavedRoutines((current) => [saved, ...current])
      return saved
    } catch (error) {
      console.error('Unable to save mobility routine', error)
      setDataStatus('error')
      return null
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
    const previousLogs = shareAuditLogs
    setShareAuditLogs((current) => current.filter((entry) => entry.id !== id))

    if (!isSupabaseSession || String(id).startsWith('share-')) return

    try {
      await deleteShareAuditLog(id)
    } catch (error) {
      console.error(error)
      setShareAuditLogs(previousLogs)
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

  async function updateDisplayPreference(key, value) {
    const display = normalizeDisplayPreferences({ ...privacyPreferences.display, [key]: value }, athleteProfile?.unitSystem)
    const nextPreferences = { ...privacyPreferences, display }
    const previousPreferences = privacyPreferences
    const previousProfile = athleteProfile
    setPrivacyPreferences(nextPreferences)

    if (key === 'unitSystem') {
      setAthleteProfile((current) => current ? { ...current, unitSystem: display.unitSystem } : current)
    }

    if (!isSupabaseSession) return true

    try {
      const saves = [upsertPrivacyPreferences(nextPreferences)]
      if (key === 'unitSystem' && athleteProfile) saves.push(upsertAthleteProfile({ ...athleteProfile, unitSystem: display.unitSystem }))
      const [savedPreferences, savedProfile] = await Promise.all(saves)
      setPrivacyPreferences(savedPreferences)
      if (savedProfile) setAthleteProfile(normalizeProfileUnits(savedProfile))
      return true
    } catch (error) {
      console.error('Unable to save display preference', error)
      setPrivacyPreferences(previousPreferences)
      setAthleteProfile(previousProfile)
      setDataStatus('error')
      return false
    }
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
              hydration: getHydrationStatus(dailyWellness.hydrationMl, athleteProfile, schedule, todayIso),
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
      hydration: getHydrationStatus(dailyWellness.hydrationMl, athleteProfile, schedule, todayIso),
      hydrationMl: dailyWellness.hydrationMl,
    })
    setActiveView('Check-in')
  }

  function openCheckout(event) {
    if (!isEventActionable(event)) return
    setCheckoutEvent(event)
  }

  function startDemoSession(email) {
    setIsStartupComplete(false)
    setSession({
      user: {
        email,
      },
    })
    setIsAppUnlocked(true)
  }

  function unlockRememberedSession() {
    setIsStartupComplete(false)
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
      setActiveView('Check-in')
      setOnboardingTour('checkin')
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
    if (onboardingTour === 'checkin') {
      setActiveView('Schedule')
      setOnboardingTour('schedule-review')
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
    if (onboardingTour === 'nutrition-nav' && view === 'Nutrition') {
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
    setIsStartupComplete(false)
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

  async function confirmAthleteAge(profile) {
    const nextProfile = {
      ...athleteProfile,
      ...profile,
      onboardingCompleted: true,
    }

    if (isSupabaseSession) {
      // Age confirmation must not fail because an optional physiology table is
      // temporarily unavailable during the additive compatibility rollout.
      const savedProfile = await upsertAthleteProfile(nextProfile, { skipPhysiology: true })
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
    setPainIssues([])
    setSavedRoutines([])
    setRecoveryCompletions([])
    setRecoveryPlans([])
    setDailyWellness({ date: todayIso, hydrationMl: 0, nutritionEntries: [] })
    setNutritionHistory([])
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
    isSigningOutRef.current = true
    clearUserStorage()
    resetAccountState()

    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) console.error('Unable to revoke the local session', error)
    }
    isSigningOutRef.current = false
  }

  function requestSignOut() {
    setIsMobileAccountMenuOpen(false)
    setIsSignOutConfirmOpen(true)
  }

  async function resetDeletedSession() {
    isSigningOutRef.current = true
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' })
    }

    clearUserStorage()
    resetAccountState()
    isSigningOutRef.current = false
  }

  function resetAccountState() {
    isSigningOutRef.current = true
    clearAccountDrafts(session?.user?.id ?? 'guest')
    setSchedule([])
    setAssociations([])
    setEventTemplates([])
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

  function getTourNavigationTarget() {
    return {
      'home-nav': 'Home',
      'history-nav': 'History',
    }[onboardingTour]
  }

  const accountPrivacyView = (
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
      onUpdateDisplayPreference={updateDisplayPreference}
      onOpenAthleteProfile={() => setIsAthleteProfileOpen(true)}
      onOpenLegal={setActiveLegalModal}
    />
  )

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

  if (shouldShowStartupLoader({ isAppUnlocked, isStartupComplete })) {
    return (
      <StartupLoader
        isReady={areViewsReady && isAuthReady && Boolean(session) && isProfileReady}
        motion={displayPreferences.startupMotion}
        onComplete={() => setIsStartupComplete(true)}
      />
    )
  }

  return (
    <main className={`app-shell density-${displayPreferences.density} motion-${displayPreferences.startupMotion}`}>
      {!isAppUnlocked && (
        <Suspense fallback={<div className="public-entry-loading" aria-hidden="true" />}>
          <AuthGate
            initialMode={authEntryMode}
            rememberedSession={session}
            onAuthenticated={finishAuthentication}
            onDemoSession={startDemoSession}
            onOpenLegal={setActiveLegalModal}
            onUseRememberedSession={unlockRememberedSession}
          />
        </Suspense>
      )}

      {isAuthReady && isAppUnlocked && session && isProfileReady && !athleteProfile?.onboardingCompleted && !onboardingTour && !onboardingCompleteOpen && (
        <OnboardingFlow
          associations={associations}
          initialDisplayName={athleteProfile?.displayName || getAuthDisplayName(session)}
          onComplete={completeOnboarding}
          onCreateAssociation={createOnboardingAssociation}
        />
      )}

      {isAuthReady && isAppUnlocked && session && isProfileReady && athleteProfile?.onboardingCompleted && ageAccess.status !== 'allowed' && !isRestrictedDataControlsOpen && (
        <AgeGate
          profile={athleteProfile}
          onOpenDataControls={() => setIsRestrictedDataControlsOpen(true)}
          onSave={confirmAthleteAge}
          onSignOut={requestSignOut}
        />
      )}

      {isAuthReady && isAppUnlocked && session && isProfileReady && athleteProfile?.onboardingCompleted && ageAccess.status === 'restricted' && isRestrictedDataControlsOpen && (
        <main className="restricted-data-controls">
          <button className="secondary-button" onClick={() => setIsRestrictedDataControlsOpen(false)} type="button">Back to age notice</button>
          {accountPrivacyView}
        </main>
      )}

      {isAuthReady && isAppUnlocked && session && isProfileReady && ageAccess.status === 'allowed' && (athleteProfile?.onboardingCompleted || onboardingTour || onboardingCompleteOpen) && (
        <>
          <div className="dashboard-shell">
            <LiquidNavigation
              activeView={activeView}
              athleteName={athleteDisplayName}
              className={onboardingTour && !onboardingTour.endsWith('-nav') ? 'tour-hidden-mobile' : ''}
              lockedView={getTourNavigationTarget()}
              onSelect={selectNavigationView}
              onSignOut={requestSignOut}
              views={views}
            />
            <div className="dashboard-main">
              <header className="top-bar">
                <button
                  aria-controls="mobile-account-menu"
                  aria-expanded={isMobileAccountMenuOpen}
                  aria-label="Open account menu"
                  className="mobile-menu-button"
                  onClick={() => setIsMobileAccountMenuOpen(true)}
                  type="button"
                >
                  <span /><span /><span />
                </button>
                <div className="app-page-heading">
                  <strong>{activeView}</strong>
                  <span>{format(new Date(), 'EEEE, MMMM d')}</span>
                </div>
              </header>

              {isMobileAccountMenuOpen && (
                <div className="mobile-account-backdrop" onClick={() => setIsMobileAccountMenuOpen(false)}>
                  <aside
                    aria-label="Account menu"
                    className="mobile-account-menu"
                    id="mobile-account-menu"
                    onClick={(event) => event.stopPropagation()}
                    ref={mobileAccountMenuRef}
                    role="dialog"
                    tabIndex={-1}
                  >
                    <header><span>Account</span><button onClick={() => setIsMobileAccountMenuOpen(false)} type="button">Close</button></header>
                    <strong className="mobile-account-name">{athleteDisplayName}</strong>
                    <nav aria-label="Account actions">
                      <button onClick={() => { setIsMobileAccountMenuOpen(false); selectNavigationView('Settings') }} type="button">Settings</button>
                      <button onClick={requestSignOut} type="button">Sign out</button>
                    </nav>
                  </aside>
                </div>
              )}

              <section className="page-content">
                <section className="workspace page-workspace">
          <AppErrorBoundary feature={`view-${activeView.toLowerCase()}`} key={activeView}>
          <Suspense fallback={<div className="page-skeleton" role="status">Loading {activeView.toLowerCase()}…</div>}>
            {dataStatus === 'error' && (
              <div className="data-status error" role="alert">
                <span>Your latest information could not be refreshed. The screen may be showing the last saved version.</span>
                <button className="secondary-button compact-action" onClick={() => window.location.reload()} type="button">Retry</button>
              </div>
            )}

            {dataStatus === 'offline' && (
              <div className="data-status" role="status">
                You appear to be offline. Showing the last loaded state.
              </div>
            )}

            {dataStatus === 'loading' && <div className="data-status" role="status">Refreshing your athlete context...</div>}

            {activeView === 'Check-in' && (
              <CheckInView
                checkIn={scheduleDrivenCheckIn}
                checkouts={checkouts}
                dailyWellness={dailyWellness}
                eventPreparationContext={eventPreparationContext}
                isSavedToday={isCheckInSavedToday}
                isSaving={isSavingCheckIn}
                nextEvent={nextEvent}
                selectedEvent={selectedCheckInEvent}
                savedEntry={history.find((entry) => selectedCheckInEvent?.id ? entry.eventId === selectedCheckInEvent.id : entry.date === todayIso)}
                selectedEventId={selectedCheckInEvent?.id ?? null}
                todayEvents={todayEvents}
                todayLabel={todayLabel}
                onSave={saveCheckIn}
                onQuickSave={saveCheckIn}
                onEditToday={editTodayCheckIn}
                onOpenCheckout={openCheckout}
                onUpdate={updateField}
                isFirstEventToday={todayEvents[0]?.id === selectedCheckInEvent?.id}
                isQuickMode={false}
                restDayPlanned={todayEvents.some(isRestDayEvent)}
                unitSystem={athleteProfile?.unitSystem ?? displayPreferences.unitSystem}
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
                recoveryCompletions={recoveryCompletions}
                schedule={schedule}
                onGoCheckIn={openPreCheckIn}
                onOpenCheckout={openCheckout}
                onSavePainIssue={savePainIssue}
                onSharePainIssue={recordPainIssueShare}
                onViewRecovery={() => setActiveView('Recovery')}
              />
            )}

            {activeView === 'Nutrition' && (
              <NutritionView
                athleteProfile={athleteProfile}
                isGuidedTour={onboardingTour === 'nutrition'}
                nutritionHistory={nutritionHistory}
                onSaveWellness={saveDailyWellness}
                schedule={schedule}
                showTargets={displayPreferences.showNutritionTargets}
              />
            )}

            {activeView === 'Recovery' && (
              <RecoveryView
                checkouts={checkouts}
                generatedPlan={generatedRecoveryPlan}
                generatedRoutine={generatedMobilityRoutine}
                generationStatus={recoveryPlanStatus}
                mobilityGenerationStatus={mobilityRoutineStatus}
                recoveryPlans={recoveryPlans}
                recentCompletion={completedMobilityRoutines[0] ?? null}
                onGenerateRecoveryPlan={generateRecoveryPlan}
                onGenerateMobilityRoutine={generateMobilityRoutine}
                onReportRoutinePain={reportRoutinePain}
                onCompleteRoutine={completeMobilityRoutine}
                onSaveRoutine={saveMobilityRoutine}
                onStartRoutine={startMobilityRoutine}
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
                eventTemplates={eventTemplates}
                onAdd={addScheduleItem}
                onAddTournament={addTournament}
                onUpdateTournament={editTournament}
                onAddAssociation={addAssociation}
                onRenameAssociation={renameAssociation}
                onRemoveAssociation={removeAssociation}
                onRemoveTemplate={removeEventTemplate}
                onOpenCheckIn={openPreCheckIn}
                onOpenCheckout={openCheckout}
                onRemove={removeScheduleItem}
                onRemoveTournament={removeTournament}
                onUpdate={updateScheduleItem}
                onSaveTemplate={saveEventTemplate}
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
                painReports={painReports}
                onClear={clearHistory}
                onDeleteEntry={deleteHistoryEntry}
                recoveryCompletions={completedMobilityRoutines}
                recoveryPlans={recoveryPlans}
                savedRoutines={savedRoutines}
                schedule={schedule}
                weekStartsOn={displayPreferences.weekStartsOn}
              />
            )}

            {activeView === 'Settings' && (
              accountPrivacyView
            )}
          </Suspense>
          </AppErrorBoundary>
                </section>
              </section>
            </div>
          </div>

      {onboardingTour && (
        <GuidedTour
          onBack={rewindOnboardingTour}
          onFinish={finishOnboardingTour}
          onNext={advanceOnboardingTour}
          phase={onboardingTour}
        />
      )}

      {onboardingCompleteOpen && (
        <DialogShell className="onboarding-complete-modal" eyebrow="Setup complete" onClose={unlockAfterOnboarding} title="You’re ready to reload.">
          <p>Your profile, first event, check-ins, checkouts, Home dashboard, and History are ready to use.</p>
          <button className="primary-button" onClick={unlockAfterOnboarding} type="button">Open Athlete Reload</button>
        </DialogShell>
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
          onOpenRecovery={() => { setCheckoutEvent(null); setActiveView('Recovery') }}
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

      {submittedRecommendation && submittedRecommendationStatus === 'ai' && submittedRecommendationContext.scoreLabel === 'readiness' && <AiDecisionModal checkIn={submittedRecommendationContext.checkIn} context={submittedRecommendationContext} dialogRef={recommendationDialogRef} onClose={() => setSubmittedRecommendation(null)} recommendation={submittedRecommendation} />}
      {submittedRecommendation && submittedRecommendationContext.scoreLabel === 'recovery' && <CheckoutAiModal context={submittedRecommendationContext} dialogRef={recommendationDialogRef} onClose={() => setSubmittedRecommendation(null)} onOpenRecovery={() => { setSubmittedRecommendation(null); setActiveView('Recovery') }} />}

      {checkInAiError && (
        <div className="modal-backdrop" onClick={() => setCheckInAiError('')}>
          <section
            className="event-modal recommendation-modal glass-panel"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="checkin-ai-error-title"
            ref={aiErrorDialogRef}
            tabIndex={-1}
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

      {isSignOutConfirmOpen && (
        <DialogShell
          backdropClassName="sign-out-confirmation-backdrop"
          className="sign-out-confirmation"
          eyebrow="Account"
          onClose={() => setIsSignOutConfirmOpen(false)}
          showClose={false}
          title="Sign out of Athlete Reload?"
        >
          <p>Your saved athlete data will stay here. You’ll need to sign in again to access it.</p>
          <div className="sign-out-confirmation-actions">
            <button className="secondary-button" onClick={() => setIsSignOutConfirmOpen(false)} type="button">Cancel</button>
            <button className="primary-button" onClick={() => { setIsSignOutConfirmOpen(false); signOut() }} type="button">Sign Out</button>
          </div>
        </DialogShell>
      )}

      {activeLegalModal && (
        <LegalModal
          type={activeLegalModal}
          onClose={() => setActiveLegalModal(null)}
        />
      )}
    </main>
  )
}

function StartupLoader({ isReady, motion = 'full', onComplete }) {
  const [cycleComplete, setCycleComplete] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const completeStartup = useEffectEvent(onComplete)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.documentElement.classList.add('startup-active')
    document.body.classList.add('startup-active')
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.classList.remove('startup-active')
      document.body.classList.remove('startup-active')
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setCycleComplete(true), 2200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isReady || !cycleComplete || isExiting) return undefined
    setIsExiting(true)
    }, [cycleComplete, isExiting, isReady])

  useEffect(() => {
    if (!isExiting) return undefined
    const timer = window.setTimeout(completeStartup, 650)
    return () => window.clearTimeout(timer)
  }, [isExiting])

  return (
    <div className={`startup-loader motion-${motion}${isExiting ? ' is-exiting' : ''}`} role="status" aria-label="Loading Athlete Reload">
      <div className="startup-loader-glow" aria-hidden="true" />
      <div className="startup-loader-mark" aria-hidden="true">
        <span className="startup-loader-orbit orbit-one" />
        <span className="startup-loader-orbit orbit-two" />
        <span className="startup-loader-scan" />
        <img src={appLogo} alt="" />
      </div>
      <div className="startup-loader-copy">
        <p>ATHLETE</p>
        <h1>RELOAD</h1>
        <span>Preparing your performance hub</span>
      </div>
      <div className="startup-loader-meter" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
      </div>
    </div>
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
          'Account and profile data includes your name or nickname, email, authentication identifiers, date of birth, age, height, weight, optional gender identity and physiological information, sport, position or specialty, dominant side, goals, dietary preferences, unit preference, and connected sign-in providers.',
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
          'Athlete Reload uses Supabase for authentication, database storage, and server-side functions. Recommendation and voice-extraction requests may be sent through a server-side function to Google Gemini. Direct identifiers and date of birth are removed from recommendation payloads. Food searches may query food-data providers described by the search feature.',
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

export default App
