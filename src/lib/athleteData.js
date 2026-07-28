import { format, parseISO } from 'date-fns'
import { supabase } from './supabaseClient'
import { estimatePlannedMinutes } from '../utils/events'

function fromScheduleRow(row) {
  return {
    id: row.id,
    date: row.event_date,
    load: row.load_level,
    note: row.note ?? '',
    time: row.event_time ?? '',
    title: row.title,
    type: row.event_type,
  }
}

function toScheduleRow(event) {
  return {
    event_date: event.date,
    event_time: event.time ?? '',
    event_type: event.type,
    load_level: event.load,
    note: event.note ?? '',
    title: event.title || event.type,
    updated_at: new Date().toISOString(),
  }
}

function fromCheckInRow(row) {
  return {
    createdAt: row.created_at,
    date: row.check_in_date,
    day: format(parseISO(row.check_in_date), 'EEE'),
    energy: row.energy,
    fatigue: row.fatigue,
    hurtsWhen: row.hurts_when,
    hydration: row.hydration,
    id: row.id,
    injuryType: row.injury_type,
    location: row.pain_location,
    note: row.notes,
    pain: row.pain,
    painType: row.pain_type,
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
    check_in_date: format(new Date(), 'yyyy-MM-dd'),
    energy: checkIn.energy,
    fatigue: checkIn.fatigue,
    hurts_when: checkIn.hurtsWhen,
    hydration: checkIn.hydration,
    injury_type: checkIn.injuryType,
    notes: checkIn.notes ?? '',
    pain: checkIn.pain,
    pain_location: checkIn.location,
    pain_type: checkIn.painType,
    score: recommendation.score,
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
    title: row.session_title,
  }
}

function toCheckoutRow(event, checkout) {
  return {
    actual_minutes: Number(checkout.actualMinutes),
    completion_level: checkout.completionLevel,
    difficulty: Number(checkout.difficulty),
    notes: checkout.notes ?? '',
    pain_change: checkout.painChange,
    planned_load: event.load ?? 'Medium',
    planned_minutes: Number(checkout.plannedMinutes) || estimatePlannedMinutes(event.load),
    planned_type: event.type ?? 'Training',
    schedule_event_id: event.id,
    session_date: event.date,
    session_title: event.title || event.type || 'Training',
    updated_at: new Date().toISOString(),
  }
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

export async function loadAthleteData() {
  const [
    scheduleResponse,
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
  if (checkInsResponse.error) throw checkInsResponse.error
  if (checkoutsResponse.error) throw checkoutsResponse.error
  if (painReportsResponse.error) throw painReportsResponse.error

  return {
    checkouts: checkoutsResponse.data.map(fromCheckoutRow),
    history: checkInsResponse.data.map(fromCheckInRow),
    painReports: painReportsResponse.data.map(fromPainReportRow),
    schedule: scheduleResponse.data.map(fromScheduleRow),
  }
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

export async function createTrainingCheckout(event, checkout) {
  const { data, error } = await supabase
    .from('training_checkouts')
    .insert(toCheckoutRow(event, checkout))
    .select('*')
    .single()

  if (error) throw error

  return fromCheckoutRow(data)
}

export async function updateTrainingCheckout(id, event, checkout) {
  const { data, error } = await supabase
    .from('training_checkouts')
    .update(toCheckoutRow(event, checkout))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return fromCheckoutRow(data)
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
