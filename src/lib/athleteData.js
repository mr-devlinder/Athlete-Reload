import { format, parseISO } from 'date-fns'
import { supabase } from './supabaseClient'

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

export async function loadAthleteData() {
  const [scheduleResponse, checkInsResponse] = await Promise.all([
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
  ])

  if (scheduleResponse.error) throw scheduleResponse.error
  if (checkInsResponse.error) throw checkInsResponse.error

  return {
    history: checkInsResponse.data.map(fromCheckInRow),
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

export async function clearCheckIns() {
  const { error } = await supabase
    .from('check_ins')
    .delete()
    .not('id', 'is', null)

  if (error) throw error
}
