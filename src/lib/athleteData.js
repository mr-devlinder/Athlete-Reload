import { format, parseISO } from 'date-fns'
import { supabase } from './supabaseClient'
import { estimatePlannedMinutes, isAllDayEvent, isOtherActivityEvent } from '../utils/events'
import { normalizePainMapScale } from '../data/bodyPainMap'
import { fluidOuncesToMilliliters, inchesToCentimeters, milesToMeters, poundsToKilograms, yardsToMeters } from '../utils/units'

function normalizeFivePointValue(value, fallback = 1) {
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback

  return Math.max(0, Math.min(5, Math.round(number)))
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

function fromScheduleRow(row) {
  const eventStub = { type: row.event_type }
  const isAllDay = isAllDayEvent(eventStub)
  const isOtherActivity = isOtherActivityEvent(eventStub)
  const time = isAllDay ? '' : row.event_time ?? ''
  const customActivityName = isOtherActivity && row.title !== row.event_type ? row.title ?? '' : ''
  return {
    allDay: isAllDay,
    association: isOtherActivity ? row.association ?? 'None' : row.association ?? 'Personal',
    availability: row.availability ?? 'Required',
    environment: row.environment ?? 'Outdoor',
    customActivityName,
    expectedDuration: isAllDay ? null : Number(row.expected_duration ?? row.planned_minutes ?? 60),
    id: row.id,
    date: row.event_date,
    load: row.load_level ?? (isAllDay ? 'Low' : 'Medium'),
    location: row.location ?? '',
    note: row.note ?? '',
    opponent: row.opponent ?? '',
    plannedMinutes: isAllDay ? undefined : Number(row.planned_minutes ?? 0) || undefined,
    surface: row.surface ?? 'Grass',
    time,
    title: customActivityName || (isAllDay ? row.event_type : row.title ?? row.event_type),
    tournamentId: row.tournament_id ?? null,
    sportWorkload: row.sport_workload ?? {},
    type: row.event_type ?? 'Training',
    venue: row.venue ?? '',
  }
}

function toScheduleRow(event) {
  const isAllDay = isAllDayEvent(event)
  const isOtherActivity = isOtherActivityEvent(event)
  return {
    association: isOtherActivity ? event.association ?? 'None' : event.association ?? 'Personal',
    availability: event.availability ?? 'Required',
    environment: event.environment ?? 'Outdoor',
    expected_duration: isAllDay ? 0 : Number(event.expectedDuration ?? event.plannedMinutes ?? 60),
    event_date: event.date,
    event_time: isAllDay ? '' : event.time ?? '',
    event_type: event.type,
    load_level: event.load,
    location: event.location ?? '',
    note: event.note ?? '',
    opponent: event.opponent ?? '',
    planned_minutes: isAllDay ? null : Number(event.plannedMinutes ?? 0) || null,
    surface: event.surface ?? 'Grass',
    title: isOtherActivity ? event.customActivityName?.trim() || event.title || event.type : isAllDay ? event.type : event.title || event.type,
    tournament_id: event.tournamentId ?? null,
    sport_workload: event.sportWorkload ?? {},
    updated_at: new Date().toISOString(),
    venue: event.venue ?? '',
  }
}

function fromAssociationRow(row) {
  return {
    id: row.id,
    name: row.name,
  }
}

function fromTournamentRow(row) {
  return {
    association: row.association ?? 'Personal',
    endDate: row.end_date,
    id: row.id,
    location: row.location ?? '',
    name: row.name,
    notes: row.notes ?? '',
    startDate: row.start_date,
  }
}

function toTournamentRow(tournament) {
  return {
    association: tournament.association ?? 'Personal',
    end_date: tournament.endDate,
    location: tournament.location ?? '',
    name: tournament.name,
    notes: tournament.notes ?? '',
    start_date: tournament.startDate,
    updated_at: new Date().toISOString(),
  }
}

function fromShareAuditRow(row) {
  return {
    createdAt: row.created_at,
    id: row.id,
    recipientLabel: row.recipient_label ?? '',
    reportReferenceId: row.report_reference_id,
    reportType: row.report_type,
  }
}

function fromCheckInRow(row) {
  return {
    affectedMovement: row.affected_movement ?? 'None',
    checkInType: row.check_in_type ?? 'pre_event',
    createdAt: row.created_at,
    date: row.check_in_date,
    day: format(parseISO(row.check_in_date), 'EEE'),
    energy: normalizeFivePointValue(row.energy, 5),
    eventId: row.schedule_event_id,
    eventTime: row.event_time ?? '',
    eventTitle: row.session_title ?? row.session_type,
    fatigue: normalizeFivePointValue(row.fatigue, 0),
    illnessSymptoms: normalizeIllnessValue(row.illness_symptoms),
    legHeaviness: normalizeFivePointValue(row.leg_heaviness, 0),
    hurtsWhen: row.hurts_when,
    hydration: row.hydration,
    hydrationMl: Number(row.hydration_ml ?? fluidOuncesToMilliliters(row.hydration_oz) ?? 0),
    id: row.id,
    injuryType: row.injury_type,
    location: row.pain_location,
    note: row.notes,
    pain: row.pain,
    painDetails: row.pain_details ?? {},
    painMap: normalizePainMapScale(row.pain_map ?? {}, row.pain),
    painTrend: row.pain_trend ?? 'New',
    painType: row.pain_type,
    plannedIntensity: row.planned_intensity ?? row.session_type,
    recommendation: row.recommendation_json,
    recoveryActions: row.recovery_actions ?? [],
    score: row.score,
    session: row.session_type,
    sleep: Number(row.sleep),
    sleepQuality: normalizeFivePointValue(row.sleep_quality, 5),
    soreness: normalizeFivePointValue(row.soreness, 0),
    stress: normalizeStressValue(row.stress),
    yesterdayLoad: row.yesterday_load,
    expectedDifficulty: Math.max(1, Math.min(10, Math.round(Number(row.expected_difficulty) || 5))),
  }
}

function toCheckInRow(checkIn, recommendation) {
  return {
    affected_movement: checkIn.affectedMovement ?? 'None',
    check_in_date: checkIn.eventDate ?? format(new Date(), 'yyyy-MM-dd'),
    check_in_type: checkIn.checkInType ?? 'pre_event',
    energy: normalizeFivePointValue(checkIn.energy, 5),
    event_time: checkIn.eventTime ?? '',
    fatigue: normalizeFivePointValue(checkIn.fatigue, 0),
    illness_symptoms: String(checkIn.illnessSymptoms ?? 0),
    leg_heaviness: normalizeFivePointValue(checkIn.legHeaviness, 0),
    hurts_when: checkIn.hurtsWhen,
    hydration: checkIn.hydration,
    hydration_ml: Number(checkIn.hydrationMl ?? fluidOuncesToMilliliters(checkIn.hydrationOz) ?? 0),
    injury_type: checkIn.injuryType,
    notes: checkIn.notes ?? '',
    pain: checkIn.pain,
    pain_details: checkIn.painDetails ?? {},
    pain_map: checkIn.painMap ?? {},
    pain_trend: checkIn.painTrend ?? 'New',
    pain_location: checkIn.location,
    pain_type: checkIn.painType,
    planned_intensity: checkIn.plannedIntensity ?? checkIn.session,
    recommendation_json: recommendation,
    recovery_actions: checkIn.recoveryActions ?? [],
    schedule_event_id: checkIn.eventId ?? null,
    score: recommendation.score,
    session_title: checkIn.eventTitle ?? checkIn.session,
    session_type: checkIn.session,
    sleep: checkIn.sleep,
    sleep_quality: normalizeFivePointValue(checkIn.sleepQuality, 5),
    soreness: normalizeFivePointValue(checkIn.soreness, 0),
    stress: String(checkIn.stress ?? 0),
    yesterday_load: checkIn.yesterdayLoad,
    expected_difficulty: Number(checkIn.expectedDifficulty ?? 5),
  }
}

function fromCheckoutRow(row) {
  return {
    actualMinutes: row.actual_minutes,
    completionLevel: row.completion_level,
    cramping: row.cramping ?? false,
    createdAt: row.created_at,
    date: row.session_date,
    difficulty: row.difficulty,
    fatigueAffectedTechnique: row.fatigue_affected_technique ?? false,
    heatSymptoms: row.heat_symptoms ?? [],
    eventId: row.schedule_event_id,
    id: row.id,
    notes: row.notes ?? '',
    mentalFocus: row.mental_focus ?? 3,
    motivation: row.motivation ?? 3,
    movementChanged: row.movement_changed ?? false,
    newPain: row.new_pain ?? false,
    painChange: row.pain_change,
    painDetails: row.pain_details ?? {},
    painMap: row.pain_map ?? {},
    participation: row.participation ?? row.completion_level,
    plannedLoad: row.planned_load,
    plannedMinutes: row.planned_minutes ?? estimatePlannedMinutes(row.planned_load),
    plannedType: row.planned_type,
    postFatigue: row.post_fatigue ?? 3,
    postSoreness: row.post_soreness ?? 3,
    performanceRating: row.performance_rating ?? 'Normal',
    recommendation: row.recommendation_json,
    title: row.session_title,
    sessionContent: row.session_content ?? [],
    sessionLoad: row.session_load ?? Number(row.actual_minutes ?? 0) * Number(row.difficulty ?? 0),
    sportWorkload: normalizeLegacySportWorkload(row.recommendation_json?._sportWorkload, row.recommendation_json?._workloadUnits),
  }
}

function toCheckoutRow(event, checkout, options = {}) {
  const row = {
    actual_minutes: Number(checkout.actualMinutes),
    completion_level: checkout.participation ?? checkout.completionLevel,
    cramping: Boolean(checkout.cramping),
    difficulty: Number(checkout.difficulty),
    fatigue_affected_technique: Boolean(checkout.fatigueAffectedTechnique),
    heat_symptoms: checkout.heatSymptoms ?? [],
    mental_focus: Number(checkout.mentalFocus ?? 3),
    motivation: Number(checkout.motivation ?? 3),
    movement_changed: Boolean(checkout.movementChanged),
    new_pain: Boolean(checkout.newPain),
    notes: checkout.notes ?? '',
    pain_change: checkout.painChange,
    pain_details: checkout.painDetails ?? {},
    pain_map: checkout.painMap ?? {},
    participation: checkout.participation ?? checkout.completionLevel,
    planned_load: event.load ?? 'Medium',
    planned_minutes: Number(checkout.plannedMinutes) || Number(event.plannedMinutes) || estimatePlannedMinutes(event.load),
    planned_type: event.type ?? 'Training',
    post_fatigue: Number(checkout.postFatigue ?? 3),
    post_soreness: Number(checkout.postSoreness ?? 3),
    performance_rating: checkout.performanceRating ?? 'Normal',
    schedule_event_id: event.id,
    session_date: event.date,
    session_title: event.type || 'Training',
    session_content: checkout.sessionContent ?? [],
    session_load: Number(checkout.actualMinutes ?? 0) * Number(checkout.difficulty ?? 0),
    updated_at: new Date().toISOString(),
  }

  if (options.includeRecommendation !== false) {
    row.recommendation_json = checkout.recommendation
      ? { ...checkout.recommendation, _sportWorkload: checkout.sportWorkload ?? {}, _workloadUnits: 'canonical-v1' }
      : null
  }

  return row
}

function fromPainReportRow(row) {
  return {
    bodyPart: row.body_part,
    createdAt: row.created_at,
    date: row.report_date,
    id: row.id,
    notes: row.notes ?? '',
    severity: row.severity,
    side: row.side,
    sourceId: row.source_id,
    sourceType: row.source_type,
    triggerMovement: row.trigger_movement ?? '',
  }
}

function toPainReportRow(report) {
  return {
    body_part: report.bodyPart,
    notes: report.notes ?? '',
    report_date: report.date ?? format(new Date(), 'yyyy-MM-dd'),
    severity: Number(report.severity),
    side: report.side ?? 'center',
    source_id: report.sourceId,
    source_type: report.sourceType,
    trigger_movement: report.triggerMovement ?? '',
  }
}

function fromPrivacyPreferencesRow(row) {
  return {
    aiPersonalizationEnabled: row.ai_personalization_enabled !== false,
    remindersEnabled: Boolean(row.reminders_enabled),
  }
}

function fromAthleteProfileRow(row) {
  return {
    age: row.age_years ?? null,
    displayName: row.display_name ?? '',
    dominantSide: row.dominant_side ?? 'Right',
    dietaryPreferences: row.dietary_preferences ?? [],
    genderIdentity: row.gender_identity ?? '',
    goals: row.goals ?? [],
    heightCm: Number(row.height_cm ?? inchesToCentimeters(row.height_inches)) || null,
    onboardingCompleted: Boolean(row.onboarding_completed),
    position: row.position ?? '',
    sport: row.sport ?? '',
    sportProfiles: row.sport_profiles ?? [],
    trainingStyle: row.training_style ?? 'Team and individual',
    unitSystem: row.unit_system ?? 'imperial',
    weightKg: Number(row.weight_kg ?? poundsToKilograms(row.weight_lbs)) || null,
  }
}

function toAthleteProfileRow(profile) {
  return {
    age_years: profile.age ? Number(profile.age) : null,
    display_name: profile.displayName ?? '',
    dominant_side: profile.dominantSide ?? 'Right',
    dietary_preferences: profile.dietaryPreferences ?? [],
    gender_identity: profile.genderIdentity ?? '',
    goals: profile.goals ?? [],
    height_cm: profile.heightCm === '' ? null : Number(profile.heightCm) || null,
    onboarding_completed: Boolean(profile.onboardingCompleted),
    position: profile.position ?? '',
    sport: profile.sport ?? '',
    sport_profiles: profile.sportProfiles ?? [],
    training_style: profile.trainingStyle ?? 'Team and individual',
    updated_at: new Date().toISOString(),
    unit_system: profile.unitSystem ?? 'imperial',
    weight_kg: profile.weightKg === '' ? null : Number(profile.weightKg) || null,
  }
}

function fromDailyWellnessRow(row) {
  return {
    date: row.wellness_date,
    hydrationMl: Number(row.hydration_ml ?? fluidOuncesToMilliliters(row.hydration_oz) ?? 0),
    id: row.id,
    mealTiming: row.meal_timing_json ?? {},
    nutritionEntries: row.nutrition_entries ?? [],
    nutritionGoalOverride: row.nutrition_goal_override ?? {},
    updatedAt: row.updated_at,
  }
}

function fromPainIssueRow(row) {
  return {
    athleteNotes: row.athlete_notes ?? '',
    bodyPart: row.body_part,
    clinicianNotes: row.clinician_notes ?? '',
    firstReportedDate: row.first_reported_date,
    id: row.id,
    resolvedDate: row.resolved_date,
    side: row.side ?? 'center',
    status: row.status ?? 'active',
    trainerNotes: row.trainer_notes ?? '',
    updatedAt: row.updated_at,
  }
}

function fromSavedRecoveryRoutineRow(row) {
  return {
    createdAt: row.created_at,
    id: row.id,
    isFavorite: Boolean(row.is_favorite),
    sourceCheckoutId: row.source_checkout_id,
    title: row.title,
    routine: row.routine_json,
    updatedAt: row.updated_at,
  }
}

function toSavedRecoveryRoutineRow(routine) {
  return {
    is_favorite: Boolean(routine.isFavorite),
    routine_json: routine.routine,
    source_checkout_id: routine.sourceCheckoutId ?? null,
    title: routine.title,
    updated_at: new Date().toISOString(),
  }
}

function fromRecoveryRoutineCompletionRow(row) {
  return {
    completedAt: row.completed_at,
    details: row.completion_json ?? {},
    id: row.id,
    routineId: row.routine_id,
    sourceCheckoutId: row.source_checkout_id,
  }
}

function toPainIssueRow(issue) {
  return {
    athlete_notes: issue.athleteNotes ?? '',
    body_part: issue.bodyPart,
    clinician_notes: issue.clinicianNotes ?? '',
    first_reported_date: issue.firstReportedDate ?? format(new Date(), 'yyyy-MM-dd'),
    resolved_date: issue.resolvedDate ?? null,
    side: issue.side ?? 'center',
    status: issue.status ?? 'active',
    trainer_notes: issue.trainerNotes ?? '',
    updated_at: new Date().toISOString(),
  }
}

function toDailyWellnessRow(wellness) {
  return {
    hydration_ml: Math.max(0, Number(wellness.hydrationMl ?? fluidOuncesToMilliliters(wellness.hydrationOz) ?? 0)),
    meal_timing_json: wellness.mealTiming ?? {},
    nutrition_entries: wellness.nutritionEntries ?? [],
    nutrition_goal_override: wellness.nutritionGoalOverride ?? {},
    updated_at: new Date().toISOString(),
    wellness_date: wellness.date ?? format(new Date(), 'yyyy-MM-dd'),
  }
}

function toPrivacyPreferencesRow(preferences) {
  return {
    ai_personalization_enabled: preferences.aiPersonalizationEnabled !== false,
    reminders_enabled: Boolean(preferences.remindersEnabled),
    updated_at: new Date().toISOString(),
  }
}

export async function loadAthleteData() {
  const [
    scheduleResponse,
    associationsResponse,
    checkInsResponse,
    checkoutsResponse,
    painReportsResponse,
    painIssuesResponse,
    savedRoutinesResponse,
    recoveryCompletionsResponse,
    tournamentsResponse,
    shareAuditResponse,
    wellnessResponse,
  ] = await Promise.all([
    supabase
      .from('schedule_events')
      .select('*')
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true }),
    supabase
      .from('athlete_associations')
      .select('*')
      .order('name', { ascending: true }),
    supabase
      .from('check_ins')
      .select('*')
      .order('check_in_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('training_checkouts')
      .select('*')
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('pain_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('pain_issues')
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase
      .from('saved_recovery_routines')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('recovery_routine_completions')
      .select('*')
      .order('completed_at', { ascending: false }),
    supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: true }),
    supabase
      .from('share_audit_log')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('daily_wellness')
      .select('*')
      .order('wellness_date', { ascending: false }),
  ])

  if (scheduleResponse.error) throw scheduleResponse.error
  if (associationsResponse.error) throw associationsResponse.error
  if (checkInsResponse.error) throw checkInsResponse.error
  if (checkoutsResponse.error) throw checkoutsResponse.error
  if (painReportsResponse.error) throw painReportsResponse.error
  if (painIssuesResponse.error) throw painIssuesResponse.error
  if (savedRoutinesResponse.error) throw savedRoutinesResponse.error
  if (recoveryCompletionsResponse.error) throw recoveryCompletionsResponse.error
  if (tournamentsResponse.error) throw tournamentsResponse.error
  if (shareAuditResponse.error) throw shareAuditResponse.error
  if (wellnessResponse.error) throw wellnessResponse.error

  return {
    associations: associationsResponse.data.map(fromAssociationRow),
    checkouts: checkoutsResponse.data.map(fromCheckoutRow),
    history: checkInsResponse.data.map(fromCheckInRow),
    painReports: painReportsResponse.data.map(fromPainReportRow),
    painIssues: painIssuesResponse.data.map(fromPainIssueRow),
    savedRoutines: savedRoutinesResponse.data.map(fromSavedRecoveryRoutineRow),
    recoveryCompletions: recoveryCompletionsResponse.data.map(fromRecoveryRoutineCompletionRow),
    shareAuditLogs: shareAuditResponse.data.map(fromShareAuditRow),
    schedule: scheduleResponse.data.map(fromScheduleRow),
    tournaments: tournamentsResponse.data.map(fromTournamentRow),
    wellness: wellnessResponse.data?.find((row) => row.wellness_date === format(new Date(), 'yyyy-MM-dd'))
      ? fromDailyWellnessRow(wellnessResponse.data.find((row) => row.wellness_date === format(new Date(), 'yyyy-MM-dd')))
      : null,
    wellnessHistory: (wellnessResponse.data ?? []).map(fromDailyWellnessRow),
  }
}

export async function createShareAuditLog(entry) {
  const { data, error } = await supabase
    .from('share_audit_log')
    .insert({
      recipient_label: entry.recipientLabel ?? '',
      report_reference_id: entry.reportReferenceId ?? null,
      report_type: entry.reportType,
    })
    .select('*')
    .single()

  if (error) throw error

  return fromShareAuditRow(data)
}

export async function recordLegalConsent(source) {
  const { data, error } = await supabase.rpc('record_legal_consent', {
    p_age_16_or_older_confirmed: true,
    p_categories: ['terms', 'privacy', 'sensitive_wellness_data'],
    p_policy_version: '2026-08-04',
    p_privacy_version: '2026-08-04',
    p_source: source,
    p_terms_version: '2026-08-04',
  })
  if (error) throw error
  return data
}

export async function deleteShareAuditLog(id) {
  const { error } = await supabase
    .from('share_audit_log')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function createTournament(tournament) {
  const { data, error } = await supabase
    .from('tournaments')
    .insert(toTournamentRow(tournament))
    .select('*')
    .single()

  if (error) throw error

  return fromTournamentRow(data)
}

export async function updateTournament(id, tournament) {
  const { data, error } = await supabase
    .from('tournaments')
    .update(toTournamentRow(tournament))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromTournamentRow(data)
}

export async function deleteTournament(id) {
  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function saveTournamentWithGames(tournament, games) {
  const tournamentRow = { ...toTournamentRow(tournament), id: tournament.id }
  const gameRows = games.map((game) => ({ ...toScheduleRow(game), id: game.id }))
  const { data, error } = await supabase.rpc('save_tournament_with_games', {
    p_games: gameRows,
    p_tournament: tournamentRow,
  })
  if (error) throw error
  return {
    games: data.games.map(fromScheduleRow),
    tournament: fromTournamentRow(data.tournament),
  }
}

export async function deleteTournamentWithGames(tournamentId) {
  const { error } = await supabase.rpc('delete_tournament_with_games', { p_tournament_id: tournamentId })
  if (error) throw error
}

export async function upsertDailyWellness(wellness) {
  const { data, error } = await supabase
    .from('daily_wellness')
    .upsert(toDailyWellnessRow(wellness), { onConflict: 'user_id,wellness_date' })
    .select('*')
    .single()

  if (error) throw error

  return fromDailyWellnessRow(data)
}

export async function createPainIssue(issue) {
  const { data, error } = await supabase
    .from('pain_issues')
    .insert(toPainIssueRow(issue))
    .select('*')
    .single()

  if (error) throw error

  return fromPainIssueRow(data)
}

export async function updatePainIssue(id, issue) {
  const { data, error } = await supabase
    .from('pain_issues')
    .update(toPainIssueRow(issue))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromPainIssueRow(data)
}

export async function createSavedRecoveryRoutine(routine) {
  const { data, error } = await supabase
    .from('saved_recovery_routines')
    .insert(toSavedRecoveryRoutineRow(routine))
    .select('*')
    .single()

  if (error) throw error

  return fromSavedRecoveryRoutineRow(data)
}

export async function updateSavedRecoveryRoutine(id, routine) {
  const { data, error } = await supabase
    .from('saved_recovery_routines')
    .update(toSavedRecoveryRoutineRow(routine))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromSavedRecoveryRoutineRow(data)
}

export async function createRecoveryRoutineCompletion(completion) {
  const { data, error } = await supabase
    .from('recovery_routine_completions')
    .insert({
      completion_json: completion.details ?? {},
      routine_id: completion.routineId ?? null,
      source_checkout_id: completion.sourceCheckoutId ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  return fromRecoveryRoutineCompletionRow(data)
}

export async function deleteRecoveryRoutineCompletion(id) {
  const { error } = await supabase
    .from('recovery_routine_completions')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function loadPrivacyPreferences() {
  const { data, error } = await supabase
    .from('privacy_preferences')
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return fromPrivacyPreferencesRow(data)
}

export async function loadAthleteProfile() {
  const { data, error } = await supabase
    .from('athlete_profiles')
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return fromAthleteProfileRow(data)
}

export async function upsertAthleteProfile(profile) {
  const { data, error } = await supabase
    .from('athlete_profiles')
    .upsert(toAthleteProfileRow(profile), { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error

  return fromAthleteProfileRow(data)
}

export async function upsertPrivacyPreferences(preferences) {
  const { data, error } = await supabase
    .from('privacy_preferences')
    .upsert(toPrivacyPreferencesRow(preferences), { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error

  return fromPrivacyPreferencesRow(data)
}

export async function createAssociation(name) {
  const { data, error } = await supabase
    .from('athlete_associations')
    .insert({ name })
    .select('*')
    .single()

  if (error) throw error

  return fromAssociationRow(data)
}

export async function updateAssociation(id, name) {
  const { data, error } = await supabase
    .from('athlete_associations')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromAssociationRow(data)
}

export async function deleteAssociation(id) {
  const { error } = await supabase.from('athlete_associations').delete().eq('id', id)

  if (error) throw error
}

export async function createScheduleEvent(event) {
  const { data, error } = await supabase
    .from('schedule_events')
    .insert(toScheduleRow(event))
    .select('*')
    .single()

  if (error) throw error

  return fromScheduleRow(data)
}

export async function updateScheduleEvent(id, event) {
  const { data, error } = await supabase
    .from('schedule_events')
    .update(toScheduleRow(event))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromScheduleRow(data)
}

export async function deleteScheduleEvent(id) {
  const { error } = await supabase.from('schedule_events').delete().eq('id', id)

  if (error) throw error
}

export async function createCheckIn(checkIn, recommendation) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert(toCheckInRow(checkIn, recommendation))
    .select('*')
    .single()

  if (error) throw error

  return fromCheckInRow(data)
}

export async function updateCheckIn(id, checkIn, recommendation) {
  const { data, error } = await supabase
    .from('check_ins')
    .update(toCheckInRow(checkIn, recommendation))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromCheckInRow(data)
}

export async function deleteCheckInsForEvent(eventId) {
  if (!eventId) return

  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('schedule_event_id', eventId)

  if (error) throw error
}

export async function deleteCheckIn(checkInId) {
  if (!checkInId) return

  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('id', checkInId)

  if (error) throw error
}

export async function deleteCheckInsForDate(date) {
  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('check_in_date', date)

  if (error) throw error
}

export async function clearCheckIns(cutoffDate) {
  let query = supabase.from('check_ins').delete()

  query = cutoffDate
    ? query.gte('check_in_date', cutoffDate)
    : query.not('id', 'is', null)

  const { error } = await query

  if (error) throw error
}

export async function clearTrainingCheckouts(cutoffDate) {
  let query = supabase.from('training_checkouts').delete()

  query = cutoffDate
    ? query.gte('session_date', cutoffDate)
    : query.not('id', 'is', null)

  const { error } = await query

  if (error) throw error
}

export async function deleteTrainingCheckoutsForEvent(eventId) {
  if (!eventId) return

  const { error } = await supabase
    .from('training_checkouts')
    .delete()
    .eq('schedule_event_id', eventId)

  if (error) throw error
}

export async function deleteTrainingCheckout(checkoutId) {
  if (!checkoutId) return

  const { error } = await supabase
    .from('training_checkouts')
    .delete()
    .eq('id', checkoutId)

  if (error) throw error
}

export async function clearPainReports(cutoffDate) {
  let query = supabase.from('pain_reports').delete()

  query = cutoffDate
    ? query.gte('report_date', cutoffDate)
    : query.not('id', 'is', null)

  const { error } = await query

  if (error) throw error
}

export async function createTrainingCheckout(event, checkout) {
  const { data, error } = await insertTrainingCheckout(event, checkout, true)

  if (isMissingRecommendationColumn(error) && checkout.recommendation) {
    const retry = await insertTrainingCheckout(event, checkout, false)

    if (retry.error) throw retry.error

    return {
      ...fromCheckoutRow(retry.data),
      recommendation: checkout.recommendation,
      recommendationNotPersisted: true,
    }
  }

  if (error) throw error

  return fromCheckoutRow(data)
}

export async function updateTrainingCheckout(id, event, checkout) {
  const { data, error } = await updateTrainingCheckoutRow(id, event, checkout, true)

  if (isMissingRecommendationColumn(error) && checkout.recommendation) {
    const retry = await updateTrainingCheckoutRow(id, event, checkout, false)

    if (retry.error) throw retry.error

    return {
      ...fromCheckoutRow(retry.data),
      recommendation: checkout.recommendation,
      recommendationNotPersisted: true,
    }
  }

  if (error) throw error

  return fromCheckoutRow(data)
}

function insertTrainingCheckout(event, checkout, includeRecommendation) {
  return supabase
    .from('training_checkouts')
    .insert(toCheckoutRow(event, checkout, { includeRecommendation }))
    .select('*')
    .single()
}

function updateTrainingCheckoutRow(id, event, checkout, includeRecommendation) {
  return supabase
    .from('training_checkouts')
    .update(toCheckoutRow(event, checkout, { includeRecommendation }))
    .eq('id', id)
    .select('*')
    .single()
}

function isMissingRecommendationColumn(error) {
  if (!error) return false

  return String(error.message ?? error.details ?? '')
    .toLowerCase()
    .includes('recommendation_json')
}

function normalizeLegacySportWorkload(workload = {}, units) {
  if (units === 'canonical-v1') return workload
  return Object.fromEntries(Object.entries(workload ?? {}).map(([key, value]) => [
    key,
    /yardage/i.test(key) && value !== ''
      ? yardsToMeters(value)
      : /distance/i.test(key) && value !== '' ? milesToMeters(value) : value,
  ]))
}

export async function createPainReports(reports) {
  if (reports.length === 0) return []

  const { data, error } = await supabase
    .from('pain_reports')
    .insert(reports.map(toPainReportRow))
    .select('*')

  if (error) throw error

  return data.map(fromPainReportRow)
}

export async function deletePainReportsForSource(sourceType, sourceId) {
  if (!sourceId) return

  const { error } = await supabase
    .from('pain_reports')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  if (error) throw error
}

export async function deletePainReportsForSourceId(sourceId) {
  if (!sourceId) return
  const { error } = await supabase.from('pain_reports').delete().eq('source_id', sourceId)
  if (error) throw error
}
