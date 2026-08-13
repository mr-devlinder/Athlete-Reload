import { BodyPainMap } from './BodyPainMap'
import { Slider } from './FormControls'
import { SectionHeading } from './SectionHeading'
import { VoiceDraftButton } from './VoiceDraftButton'
import { RecommendationCard } from './RecommendationCard'
import { getCheckoutForEvent, hasEventStarted, isAllDayCheckInOpen, isAllDayEvent } from '../utils/events'
import '../styles/checkin-progressive.css'
import { getCheckInFlowState } from '../domain/wellness/progressiveFlow'
import { formatHydration } from '../utils/units'
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
  savedEntry,
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
  unitSystem = 'imperial',
}) {
  const selectedEventLabel = selectedEvent?.title ?? 'Open training day'
  const selectedCheckout = getCheckoutForEvent(checkouts, selectedEvent?.id)
  const canPostCheckIn = selectedEvent && hasEventStarted(selectedEvent) && !selectedCheckout
  const hasAllDayWellnessEvent = todayEvents.some(isAllDayEvent)
  const hasScheduledEventToday = todayEvents.length > 0
  const painConcern = checkIn.painConcern ?? (Object.values(checkIn.painMap ?? {}).some((value) => Number(value) > 0) ? true : null)
  const symptomConcern = checkIn.symptomConcern ?? (Number(checkIn.illnessSymptoms) > 0 ? true : null)
  const asksLegHeaviness = shouldAskLegHeaviness(selectedEvent, checkIn)
  const flowState = getCheckInFlowState({ ...checkIn, painConcern, symptomConcern }, { requireSleep: isFirstEventToday, requireLegHeaviness: asksLegHeaviness })

  useEffect(() => {
    const defaults = {
      energy: 5,
      fatigue: 0,
      illnessSymptoms: 0,
      painConcern: false,
      soreness: 0,
      stress: 0,
      symptomConcern: false,
      ...(isFirstEventToday ? { sleep: 8, sleepQuality: 5 } : {}),
      ...(asksLegHeaviness ? { legHeaviness: 0 } : {}),
    }

    Object.entries(defaults).forEach(([field, value]) => {
      if (checkIn[field] === null || checkIn[field] === undefined || checkIn[field] === '') onUpdate(field, value)
    })
  }, [asksLegHeaviness, checkIn, isFirstEventToday, onUpdate, selectedEventId])

  if (isSaving) {
    return (
      <div className="checkin-saving-state" data-tour="check-in-page" role="status" aria-live="polite">
        <span className="checkin-saving-spinner" aria-hidden="true" />
        <p>Check-in complete</p>
        <h1>Building your event plan.</h1>
        <span>Your answers are saved. Athlete Reload is evaluating them with your event context.</span>
      </div>
    )
  }

  if (!selectedEvent) {
    return (
      <div className="saved-checkin" data-tour="check-in-page">
        <SectionHeading eyebrow={todayLabel} title={hasScheduledEventToday ? 'No event check-in available.' : 'No events scheduled today.'} />
        {hasScheduledEventToday && <p>{restDayPlanned || hasAllDayWellnessEvent
          ? 'Rest Day and Recovery Day wellness check-ins open at 12:00 PM. No checkout is required.'
          : 'Check-ins are available starting 3 hours before a physical event scheduled for today.'}</p>}
      </div>
    )
  }

  if (isSavedToday) {
    const savedRecommendation = savedEntry?.recommendation
    return (
      <div className="saved-checkin checkin-result-page" data-tour="check-in-page">
        <header className="saved-checkin-header"><div><span>Ready for</span><h1>{selectedEventLabel}</h1><p>{selectedEvent?.time ? `${formatEventTime(selectedEvent.time)} · ${getTimeUntilEvent(selectedEvent)}` : 'All-day event'}</p></div><div className="saved-checkin-actions">{canPostCheckIn && <button className="primary-button compact-action" onClick={() => onOpenCheckout(selectedEvent)} type="button">Complete Checkout</button>}<button className="ghost-close" onClick={onEditToday} type="button">Edit check-in</button></div></header>
        {savedRecommendation ? <RecommendationCard recommendation={savedRecommendation} recommendationStatus={savedRecommendation._source ? 'ai' : 'local'} session={selectedEventLabel} /> : <section className="checkin-result-fallback"><SectionHeading eyebrow="Check-in saved" title="Your current state is recorded." /><p>{selectedCheckout ? 'Checkout is also complete for this event.' : 'Your answers will be used by preparation, Recovery, and History.'}</p></section>}
      </div>
    )
  }

  return (
    <div className="checkin-experience" data-tour="check-in-page">
      <header className="checkin-context-header" data-tour="check-in-intro">
        <div><span>Pre-event check-in</span><h1>{selectedEventLabel}</h1><p>{selectedEvent?.time ? `${formatEventTime(selectedEvent.time)} · ${getTimeUntilEvent(selectedEvent)}` : 'Today'} · {selectedEvent?.type ?? 'Training'}</p></div>
      </header>

      <div className="checkin-layout">
        <main className="checkin-questionnaire">
          <section className="question-block" aria-labelledby="wellness-heading">
            <div className="question-block-heading"><span>NOW</span><div><h2 id="wellness-heading">Your pre-event snapshot</h2><p>Move each slider once. Zero is the lowest end of every scale.</p></div></div>
            <div className="wellness-slider-grid">
              <Slider label="Energy" min={0} max={5} lowLabel="0 · Empty" highLabel="5 · Powerful" unit=" / 5" value={checkIn.energy ?? 5} onChange={(value) => onUpdate('energy', value)} />
              <Slider label="Fatigue" min={0} max={5} lowLabel="0 · Fresh" highLabel="5 · Exhausted" unit=" / 5" value={checkIn.fatigue ?? 0} onChange={(value) => onUpdate('fatigue', value)} />
              <Slider label="Soreness" min={0} max={5} lowLabel="0 · None" highLabel="5 · Severe" unit=" / 5" value={checkIn.soreness ?? 0} onChange={(value) => onUpdate('soreness', value)} />
              <Slider label="Stress" min={0} max={5} lowLabel="0 · Calm" highLabel="5 · Overloaded" unit=" / 5" value={checkIn.stress ?? 0} onChange={(value) => onUpdate('stress', value)} />
              {isFirstEventToday && <Slider label="Sleep quality" min={0} max={5} lowLabel="0 · Poor" highLabel="5 · Excellent" unit=" / 5" value={checkIn.sleepQuality ?? 5} onChange={(value) => onUpdate('sleepQuality', value)} />}
              {isFirstEventToday && <Slider label="Sleep duration" min={0} max={10} step={0.5} lowLabel="0 hours" highLabel="10+ hours" formatValue={(value) => `${value} hr`} value={checkIn.sleep ?? 8} onChange={(value) => onUpdate('sleep', value)} />}
              {asksLegHeaviness && <Slider description="Shown because this event or your current response is lower-body demanding." label="Leg heaviness" min={0} max={5} lowLabel="0 · Normal" highLabel="5 · Very heavy" unit=" / 5" value={checkIn.legHeaviness ?? 0} onChange={(value) => onUpdate('legHeaviness', value)} />}
            </div>
          </section>

          <section className="question-block safety-question">
            <div className="question-block-heading"><span>CHECK</span><div><h2>Any pain or injury concern today?</h2><p>Answer no and you are done with this topic.</p></div></div>
            <BinaryChoice value={painConcern} onChange={(value) => { onUpdate('painConcern', value); if (!value) { onUpdate('painMap', Object.fromEntries(Object.keys(checkIn.painMap ?? {}).map((key) => [key, 0]))); onUpdate('pain', 0); onUpdate('painDetails', {}); onUpdate('location', null); onUpdate('injuryType', null); onUpdate('painType', null); onUpdate('painTrend', null); onUpdate('affectedMovement', null); onUpdate('hurtsWhen', null) } }} />
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
            <div className="question-block-heading"><span>CHECK</span><div><h2>Feeling sick or noticing anything unusual?</h2><p>Only report a change from what is normal for you.</p></div></div>
            <BinaryChoice value={symptomConcern} onChange={(value) => { onUpdate('symptomConcern', value); onUpdate('illnessSymptoms', value ? 1 : 0) }} />
            {symptomConcern && <div className="symptom-impact"><Slider description="How much is this affecting you right now?" label="Symptom impact" min={0} max={5} lowLabel="0 · Barely" highLabel="5 · Strongly" value={checkIn.illnessSymptoms ?? 1} formatValue={formatIllnessValue} onChange={(value) => onUpdate('illnessSymptoms', value)} /></div>}
          </section>
        </main>

        <aside className="checkin-context-rail">
          <DailyFuelContext dailyWellness={dailyWellness} eventPreparationContext={eventPreparationContext} unitSystem={unitSystem} />
          <div className="checkin-voice"><span>Prefer to speak?</span><p>Describe how you feel, then review what was captured.</p><VoiceDraftButton onQuickSave={onQuickSave} onApply={(draft) => Object.entries(draft).forEach(([field, value]) => { if (value !== null && field !== 'notes') onUpdate(field, value) })} /></div>
          {isQuickMode && <p className="checkin-mode-note">Quick mode keeps only the signals that can change today’s recommendation.</p>}
        </aside>
      </div>

      <footer className="questionnaire-submit-bar"><div><strong>{flowState.complete ? 'Ready to save' : `${flowState.missing.length} answer${flowState.missing.length === 1 ? '' : 's'} remaining`}</strong><span>{flowState.complete ? 'Your recommendation will use this event and today’s context.' : 'Complete the required questions above.'}</span></div><button className="primary-button" disabled={isSaving || !flowState.complete} onClick={() => onSave()} type="button">{isSaving ? 'Saving…' : 'Save check-in'}</button></footer>
    </div>
  )
}

function BinaryChoice({ onChange, value }) {
  return <div className="binary-choice"><button aria-pressed={value === false} onClick={() => onChange(false)} type="button"><strong>No</strong><span>Nothing to report</span></button><button aria-pressed={value === true} onClick={() => onChange(true)} type="button"><strong>Yes</strong><span>Add details</span></button></div>
}

function formatIllnessValue(value) {
  if (value === 0) return '0 - None'
  if (value <= 2) return `${value} - Mild`
  return `${value} - Unwell`
}

function shouldAskLegHeaviness(event, checkIn) {
  const eventText = `${event?.title ?? ''} ${event?.type ?? ''}`.toLowerCase()
  return /run|sprint|track|soccer|football|basketball|hockey|rugby|lacrosse|cycling|bike|leg|lower body|squat|deadlift|game|match|race/.test(eventText)
    || Number(checkIn.fatigue) >= 3
    || Number(checkIn.soreness) >= 3
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

function getTimeUntilEvent(event) {
  if (!event?.date || !event?.time) return 'Time not set'
  const milliseconds = new Date(`${event.date}T${event.time}`).getTime() - Date.now()
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'Event has started'
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours ? `${hours}h ` : ''}${minutes}m until event`
}

function isInsideCheckInWindow(event) {
  if (isAllDayEvent(event)) return isAllDayCheckInOpen(event)
  if (!event?.date || !event?.time) return false
  const eventStart = new Date(`${event.date}T${event.time}`).getTime()
  const now = Date.now()

  return eventStart >= now && eventStart - now <= 3 * 60 * 60 * 1000
}

function DailyFuelContext({ dailyWellness, eventPreparationContext, unitSystem }) {
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
      <small>{fuel?.message ?? `${meals.length} food items and ${formatHydration(hydrationMl, unitSystem)} logged before check-in.`}</small>
      {hydration?.message && <small>{hydration.message}</small>}
      <small className="daily-fuel-context-note">Update hydration and meals in Nutrition.</small>
    </div>
  )
}
