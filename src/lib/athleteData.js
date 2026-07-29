import { format, parseISO } from 'date-fns'
import { supabase } from './supabaseClient'
import { estimatePlannedMinutes } from '../utils/events'

function fromScheduleRow(row) {
  return {
    association: row.association ?? 'Personal',
    id: row.id,
    date: row.event_date,
    load: row.load_level,
    note: row.note ?? '',
    plannedMinutes: Number(row.planned_minutes ?? 0) || undefined,
    time: row.event_time ?? '',
    title: row.event_type,
    type: row.event_type,
  }
}

function toScheduleRow(event) {
  return {
    association: event.association ?? 'Personal',
    event_date: event.date,
    event_time: event.time ?? '',
    event_type: event.type,
    load_level: event.load,
    note: event.note ?? '',
    planned_minutes: Number(event.plannedMinutes ?? 0) || null,
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
    checkInType: row.check_in_type ?? 'pre_event',
    createdAt: row.created_at,
    date: row.check_in_date,
    day: format(parseISO(row.check_in_date), 'EEE'),
    energy: row.energy,
    eventId: row.schedule_event_id,
    eventTime: row.event_time ?? '',
    eventTitle: row.session_title ?? row.session_type,
    fatigue: row.fatigue,
    hurtsWhen: row.hurts_when,
    hydration: row.hydration,
    hydrationOz: row.hydration_oz ?? 0,
    id: row.id,
    injuryType: row.injury_type,
    location: row.pain_location,
    note: row.notes,
    pain: row.pain,
    painType: row.pain_type,
    plannedIntensity: row.planned_intensity ?? row.session_type,
    recommendation: row.recommendation_json,
    score: row.score,
    session: row.session_type,
    sleep: Number(row.sleep),
    soreness: row.soreness,
    stress: row.stress,
    yesterdayLoad: row.yesterday_load,
  }
}

function toCheckInRow(checkIn, recommendation) {
  return {
    check_in_date: checkIn.eventDate ?? format(new Date(), 'yyyy-MM-dd'),
    check_in_type: checkIn.checkInType ?? 'pre_event',
    energy: checkIn.energy,
    event_time: checkIn.eventTime ?? '',
    fatigue: checkIn.fatigue,
    hurts_when: checkIn.hurtsWhen,
    hydration: checkIn.hydration,
    hydration_oz: Number(checkIn.hydrationOz ?? 0),
    injury_type: checkIn.injuryType,
    notes: checkIn.notes ?? '',
    pain: checkIn.pain,
    pain_location: checkIn.location,
    pain_type: checkIn.painType,
    planned_intensity: checkIn.plannedIntensity ?? checkIn.session,
    recommendation_json: recommendation,
    schedule_event_id: checkIn.eventId ?? null,
    score: recommendation.score,
    session_title: checkIn.eventTitle ?? checkIn.session,
    session_type: checkIn.session,
    sleep: checkIn.sleep,
    soreness: checkIn.soreness,
    stress: checkIn.stress,
    yesterday_load: checkIn.yesterdayLoad,
  }
}

function fromCheckoutRow(row) {
  return {
    actualMinutes: row.actual_minutes,
    completionLevel: row.completion_level,
    createdAt: row.created_at,
    date: row.session_date,
    difficulty: row.difficulty,
    eventId: row.schedule_event_id,
    id: row.id,
    notes: row.notes ?? '',
    painChange: row.pain_change,
    plannedLoad: row.planned_load,
    plannedMinutes: row.planned_minutes ?? estimatePlannedMinutes(row.planned_load),
    plannedType: row.planned_type,
    recommendation: row.recommendation_json,
    title: row.session_title,
  }
}

function toCheckoutRow(event, checkout, options = {}) {
  const row = {
    actual_minutes: Number(checkout.actualMinutes),
    completion_level: checkout.completionLevel,
    difficulty: Number(checkout.difficulty),
    notes: checkout.notes ?? '',
    pain_change: checkout.painChange,
    planned_load: event.load ?? 'Medium',
    planned_minutes: Number(checkout.plannedMinutes) || Number(event.plannedMinutes) || estimatePlannedMinutes(event.load),
    planned_type: event.type ?? 'Training',
    schedule_event_id: event.id,
    session_date: event.date,
    session_title: event.type || 'Training',
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
