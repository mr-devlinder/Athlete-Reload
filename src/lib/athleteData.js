import { format, parseISO } from 'date-fns'
import { supabase } from './supabaseClient'
import { estimatePlannedMinutes } from '../utils/events'

function normalizeFivePointValue(value, fallback = 1) {
  const number = Number(value)

  if (!Number.isFinite(number)) return fallback

  return Math.max(0, Math.min(5, Math.round(number)))
}

function fromScheduleRow(row) {
  return {
    association: row.association ?? 'Personal',
    environment: row.environment ?? 'Outdoor',
    expectedDuration: Number(row.expected_duration ?? row.planned_minutes ?? 60),
    id: row.id,
    date: row.event_date,
    load: row.load_level,
    location: row.location ?? '',
    note: row.note ?? '',
    plannedMinutes: Number(row.planned_minutes ?? 0) || undefined,
    surface: row.surface ?? 'Grass',
    time: row.event_time ?? '',
    title: row.event_type,
    type: row.event_type,
  }
}

function toScheduleRow(event) {
  return {
    association: event.association ?? 'Personal',
    environment: event.environment ?? 'Outdoor',
    expected_duration: Number(event.expectedDuration ?? event.plannedMinutes ?? 60),
    event_date: event.date,
    event_time: event.time ?? '',
    event_type: event.type,
    load_level: event.load,
    location: event.location ?? '',
    note: event.note ?? '',
    planned_minutes: Number(event.plannedMinutes ?? 0) || null,
    surface: event.surface ?? 'Grass',
    title: event.type,
    updated_at: new Date().toISOString(),
  }
}

function fromAssociationRow(row) {
  return {
    id: row.id,
    name: row.name,
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
    illnessSymptoms: row.illness_symptoms ?? 'None',
    legHeaviness: normalizeFivePointValue(row.leg_heaviness, 0),
    hurtsWhen: row.hurts_when,
    hydration: row.hydration,
    hydrationOz: row.hydration_oz ?? 0,
    id: row.id,
    injuryType: row.injury_type,
    location: row.pain_location,
    note: row.notes,
    pain: row.pain,
    painDetails: row.pain_details ?? {},
    painMap: row.pain_map ?? {},
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
    stress: row.stress,
    yesterdayLoad: row.yesterday_load,
    expectedDifficulty: row.expected_difficulty ?? 5,
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
    illness_symptoms: checkIn.illnessSymptoms ?? 'None',
    leg_heaviness: normalizeFivePointValue(checkIn.legHeaviness, 0),
    hurts_when: checkIn.hurtsWhen,
    hydration: checkIn.hydration,
    hydration_oz: Number(checkIn.hydrationOz ?? 0),
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
    stress: checkIn.stress,
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
    row.recommendation_json = checkout.recommendation ?? null
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
    analyticsAllowed: row.analytics_allowed,
    cloudSync: row.cloud_sync,
    coachIncludeNotes: row.coach_include_notes,
    coachIncludePain: row.coach_include_pain,
    localCopy: row.local_copy,
  }
}

function fromAthleteProfileRow(row) {
  return {
    displayName: row.display_name ?? '',
    dominantSide: row.dominant_side ?? 'Right',
    onboardingCompleted: Boolean(row.onboarding_completed),
    position: row.position ?? '',
    sport: row.sport ?? '',
    trainingStyle: row.training_style ?? 'Team and individual',
  }
}

function toAthleteProfileRow(profile) {
  return {
    display_name: profile.displayName ?? '',
    dominant_side: profile.dominantSide ?? 'Right',
    onboarding_completed: Boolean(profile.onboardingCompleted),
    position: profile.position ?? '',
    sport: profile.sport ?? '',
    training_style: profile.trainingStyle ?? 'Team and individual',
    updated_at: new Date().toISOString(),
  }
}

function toPrivacyPreferencesRow(preferences) {
  return {
    analytics_allowed: Boolean(preferences.analyticsAllowed),
    cloud_sync: Boolean(preferences.cloudSync),
    coach_include_notes: Boolean(preferences.coachIncludeNotes),
    coach_include_pain: Boolean(preferences.coachIncludePain),
    local_copy: Boolean(preferences.localCopy),
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
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('training_checkouts')
      .select('*')
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('pain_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120),
  ])

  if (scheduleResponse.error) throw scheduleResponse.error
  if (associationsResponse.error) throw associationsResponse.error
  if (checkInsResponse.error) throw checkInsResponse.error
  if (checkoutsResponse.error) throw checkoutsResponse.error
  if (painReportsResponse.error) throw painReportsResponse.error

  return {
    associations: associationsResponse.data.map(fromAssociationRow),
    checkouts: checkoutsResponse.data.map(fromCheckoutRow),
    history: checkInsResponse.data.map(fromCheckInRow),
    painReports: painReportsResponse.data.map(fromPainReportRow),
    schedule: scheduleResponse.data.map(fromScheduleRow),
  }
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

export async function deleteCheckInsForEvent(eventId) {
  if (!eventId) return

  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('schedule_event_id', eventId)

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
