import { BodyPainMap } from './BodyPainMap'
import { Slider } from './FormControls'
import { SectionHeading } from './SectionHeading'
import { VoiceDraftButton } from './VoiceDraftButton'
import { getCheckoutForEvent, hasEventStarted, isAllDayCheckInOpen, isAllDayEvent } from '../utils/events'
import '../styles/checkin-progressive.css'
import { getCheckInFlowState } from '../domain/wellness/progressiveFlow'
import { useEffect } from 'react'

export function CheckInView({
  checkIn,
  checkouts = [],
  dailyWellness,
  eventOptions = [],
  eventPreparationContext,
  isSavedToday,
  isSaving,
  selectedEvent,
  selectedEventId,
  todayEvents = [],
  todayIso,
  todayLabel,
  onSave,
  onQuickSave,
  onEditToday,
  onOpenCheckout,
  onSelectEvent,
  onUpdate,
  isFirstEventToday,
  isQuickMode = false,
  restDayPlanned = false,
}) {
  const selectedEventLabel = selectedEvent?.title ?? 'Open training day'
  const selectedCheckout = getCheckoutForEvent(checkouts, selectedEvent?.id)
  const canPostCheckIn = selectedEvent && hasEventStarted(selectedEvent) && !selectedCheckout
  const hasAllDayWellnessEvent = todayEvents.some(isAllDayEvent)
  const hasScheduledEventToday = todayEvents.length > 0
  const painConcern = checkIn.painConcern ?? (Object.values(checkIn.painMap ?? {}).some((value) => Number(value) > 0) ? true : null)
  const symptomConcern = checkIn.symptomConcern ?? (Number(checkIn.illnessSymptoms) > 0 ? true : null)
  const flowState = getCheckInFlowState({ ...checkIn, painConcern, symptomConcern }, { requireSleep: isFirstEventToday })

  useEffect(() => {
    if (checkIn.painConcern == null) onUpdate('painConcern', Object.values(checkIn.painMap ?? {}).some((value) => Number(value) > 0))
    if (checkIn.symptomConcern == null) onUpdate('symptomConcern', Number(checkIn.illnessSymptoms) > 0)
  }, [checkIn.illnessSymptoms, checkIn.painConcern, checkIn.painMap, checkIn.symptomConcern, onUpdate, selectedEventId])

  if (!selectedEvent) {
    return (
      <div className="saved-checkin" data-tour="check-in-page">
        <EventPicker
          checkouts={checkouts}
          eventOptions={eventOptions}
          selectedEventId={selectedEventId}
          todayIso={todayIso}
          onSelectEvent={onSelectEvent}
        />
        <SectionHeading eyebrow={todayLabel} title={hasScheduledEventToday ? 'No event check-in available.' : 'No events scheduled today.'} />
        {hasScheduledEventToday && <p>{restDayPlanned || hasAllDayWellnessEvent
          ? 'Rest Day and Recovery Day wellness check-ins open at 12:00 PM. No checkout is required.'
          : 'Check-ins are available starting 3 hours before a physical event scheduled for today.'}</p>}
      </div>
    )
  }

  if (isSavedToday) {
    return (
      <div className="saved-checkin" data-tour="check-in-page">
        <EventPicker
          checkouts={checkouts}
          eventOptions={eventOptions}
          selectedEventId={selectedEventId}
          todayIso={todayIso}
          onSelectEvent={onSelectEvent}
        />
        <SectionHeading eyebrow={selectedEventLabel} title="Check-in saved." />
        <p>
          {canPostCheckIn
            ? 'This event has started. Log what actually happened when you are ready.'
            : selectedCheckout
              ? 'Checkout complete for this event.'
              : 'Come back after this event to log what actually happened.'}
        </p>
        {canPostCheckIn && (
          <button className="primary-button compact-action" onClick={() => onOpenCheckout(selectedEvent)} type="button">
            Complete Checkout
          </button>
        )}
        <button className="ghost-close" onClick={onEditToday} type="button">
          Edit this check-in
        </button>
      </div>
    )
  }

  return (
    <div className="checkin-experience" data-tour="check-in-page">
      <header className="checkin-context-header" data-tour="check-in-intro">
        <div><span>Pre-event check-in</span><h1>{selectedEventLabel}</h1><p>{selectedEvent?.time ? formatEventTime(selectedEvent.time) : 'Today'} · {selectedEvent?.type ?? 'Training'} · about 30 seconds</p></div>
        {eventOptions.length > 1 && <EventPicker checkouts={checkouts} eventOptions={eventOptions} selectedEventId={selectedEventId} todayIso={todayIso} onSelectEvent={onSelectEvent} />}
      </header>

      <div className="checkin-layout">
        <main className="checkin-questionnaire">
          <section className="question-block" aria-labelledby="wellness-heading">
            <div className="question-block-heading"><span>01</span><div><h2 id="wellness-heading">How do you feel right now?</h2><p>Choose quickly. Your first response is usually the most useful.</p></div></div>
            <div className="wellness-question-list">
              <RatingQuestion highLabel="Very high" label="Energy" lowLabel="Very low" value={checkIn.energy} onChange={(value) => onUpdate('energy', value)} />
              <RatingQuestion highLabel="Very fatigued" label="Fatigue" lowLabel="Fresh" value={checkIn.fatigue} onChange={(value) => onUpdate('fatigue', value)} />
              <RatingQuestion highLabel="Very sore" label="Soreness" lowLabel="None" value={checkIn.soreness} onChange={(value) => onUpdate('soreness', value)} />
              {isFirstEventToday && <RatingQuestion highLabel="Excellent" label="Sleep quality" lowLabel="Poor" value={checkIn.sleepQuality} onChange={(value) => onUpdate('sleepQuality', value)} />}
            </div>
            {isFirstEventToday && <label className="sleep-duration-row"><span><strong>Sleep duration</strong><small>Only asked on your first check-in today</small></span><span><input aria-label="Sleep duration" max="14" min="0" placeholder="7.5" step="0.25" type="number" value={checkIn.sleep ?? ''} onChange={(event) => onUpdate('sleep', event.target.value === '' ? null : event.target.value)} /><em>hours</em></span></label>}
          </section>

          <section className="question-block safety-question">
            <div className="question-block-heading"><span>02</span><div><h2>Any pain or injury concern today?</h2><p>No skips the entire pain flow.</p></div></div>
            <BinaryChoice value={painConcern} onChange={(value) => { onUpdate('painConcern', value); if (!value) { onUpdate('painMap', Object.fromEntries(Object.keys(checkIn.painMap ?? {}).map((key) => [key, 0]))); onUpdate('painDetails', {}) } }} />
          </section>
          {painConcern && <div className="progressive-branch pain-branch"><BodyPainMap
          affectedMovement={checkIn.affectedMovement}
          hurtsWhen={checkIn.hurtsWhen}
          injuryType={checkIn.injuryType}
          painType={checkIn.painType}
          painTrend={checkIn.painTrend}
          details={checkIn.painDetails}
          value={checkIn.painMap}
          onDetailsChange={(value) => onUpdate('painDetails', value)}
          onChange={(value) => onUpdate('painMap', value)}
        /></div>}

          <section className="question-block safety-question">
            <div className="question-block-heading"><span>03</span><div><h2>Feeling sick or noticing unusual symptoms?</h2><p>Tell us only when something is different from normal.</p></div></div>
            <BinaryChoice value={symptomConcern} onChange={(value) => { onUpdate('symptomConcern', value); onUpdate('illnessSymptoms', value ? null : 0) }} />
            {symptomConcern && <div className="symptom-impact"><Slider description="How much is this affecting you right now?" label="Symptom impact" min={1} max={5} value={checkIn.illnessSymptoms ?? 1} formatValue={formatIllnessValue} onChange={(value) => onUpdate('illnessSymptoms', value)} /></div>}
          </section>

          <details className="optional-question-block"><summary><span>Optional context</span><small>Stress and leg heaviness</small></summary><div className="wellness-question-list"><RatingQuestion highLabel="High" label="Stress" lowLabel="Low" value={checkIn.stress} onChange={(value) => onUpdate('stress', value)} /><RatingQuestion highLabel="Very heavy" label="Leg heaviness" lowLabel="Normal" value={checkIn.legHeaviness} onChange={(value) => onUpdate('legHeaviness', value)} /></div></details>
        </main>

        <aside className="checkin-context-rail">
          <DailyFuelContext dailyWellness={dailyWellness} eventPreparationContext={eventPreparationContext} />
          <div className="checkin-voice"><span>Prefer to speak?</span><p>Describe how you feel, then review what was captured.</p><VoiceDraftButton onQuickSave={onQuickSave} onApply={(draft) => Object.entries(draft).forEach(([field, value]) => { if (value !== null && field !== 'notes') onUpdate(field, value) })} /></div>
          {isQuickMode && <p className="checkin-mode-note">Quick mode keeps only the signals that can change today’s recommendation.</p>}
        </aside>
      </div>

      <footer className="questionnaire-submit-bar"><div><strong>{flowState.complete ? 'Ready to save' : `${flowState.missing.length} answer${flowState.missing.length === 1 ? '' : 's'} remaining`}</strong><span>{flowState.complete ? 'Your recommendation will use this event and today’s context.' : 'Complete the required questions above.'}</span></div><button className="primary-button" disabled={isSaving || !flowState.complete} onClick={() => onSave()} type="button">{isSaving ? 'Saving…' : 'Save check-in'}</button></footer>
    </div>
  )
}

function RatingQuestion({ highLabel, label, lowLabel, onChange, value }) {
  return <div aria-label={label} className="wellness-rating" role="group"><div className="wellness-rating-label"><strong>{label}</strong><span>{lowLabel} → {highLabel}</span></div><div>{[1, 2, 3, 4, 5].map((rating) => <button aria-label={`${label}: ${rating} of 5`} aria-pressed={Number(value) === rating} key={rating} onClick={() => onChange(rating)} type="button"><b>{rating}</b><small>{rating === 1 ? lowLabel : rating === 5 ? highLabel : ''}</small></button>)}</div></div>
}

function BinaryChoice({ onChange, value }) {
  return <div className="binary-choice"><button aria-pressed={value === false} onClick={() => onChange(false)} type="button"><strong>No</strong><span>Nothing to report</span></button><button aria-pressed={value === true} onClick={() => onChange(true)} type="button"><strong>Yes</strong><span>Add details</span></button></div>
}

function formatIllnessValue(value) {
  if (value === 0) return '0 - None'
  if (value <= 2) return `${value} - Mild`
  return `${value} - Unwell`
}

function EventPicker({ checkouts, eventOptions, onSelectEvent, selectedEventId, todayIso }) {
  if (eventOptions.length === 0) return null
  const completedEventIds = new Set(checkouts.map((checkout) => checkout.eventId).filter(Boolean))
  return <label className="checkin-event-select"><span>Switch event</span><select aria-label="Switch check-in event" value={selectedEventId} onChange={(event) => onSelectEvent(event.target.value)}>{eventOptions.map((event) => {
          const isToday = event.date === todayIso
          const isCompleted = completedEventIds.has(event.id)
          const isOutsideCheckInWindow = isToday && !isCompleted && !isInsideCheckInWindow(event)
          return <option disabled={!isToday || isOutsideCheckInWindow || isCompleted} key={event.id} value={event.id}>{event.title || event.type} · {formatEventTime(event.time)}</option>
        })}</select></label>
}

function formatEventTime(value) {
  if (!value) return ''

  const inputMatch = String(value).match(/^(\d{1,2}):(\d{2})$/)

  if (!inputMatch) return value

  const hour = Number(inputMatch[1])
  const minute = inputMatch[2]
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minute} ${suffix}`
}

function isInsideCheckInWindow(event) {
  if (isAllDayEvent(event)) return isAllDayCheckInOpen(event)
  if (!event?.date || !event?.time) return false
  const eventStart = new Date(`${event.date}T${event.time}`).getTime()
  const now = Date.now()

  return eventStart >= now && eventStart - now <= 3 * 60 * 60 * 1000
}

function DailyFuelContext({ dailyWellness, eventPreparationContext }) {
  const hydrationMl = Number(dailyWellness?.hydrationMl ?? 0)
  const meals = dailyWellness?.nutritionEntries ?? []
  const fuel = eventPreparationContext?.fuel
  const hydration = eventPreparationContext?.hydration
  const statusLabel = (status) => ({
    'on-track': 'On track',
    'slightly-behind': 'Slightly behind',
    behind: 'Behind',
    'insufficient-data': 'Insufficient data',
    'not-applicable': 'Not applicable',
  })[status] ?? 'Insufficient data'

  return (
    <div className="daily-fuel-context">
      <span>Event fuel context</span>
      <strong>Fuel: {statusLabel(fuel?.status)} · Hydration: {statusLabel(hydration?.status)}</strong>
      <small>{fuel?.message ?? `${meals.length} food items and ${Math.round(hydrationMl)} mL logged before check-in.`}</small>
      {hydration?.message && <small>{hydration.message}</small>}
      <small className="daily-fuel-context-note">Update hydration and meals in Nutrition.</small>
    </div>
  )
}
