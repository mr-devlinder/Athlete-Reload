import { useEffect, useMemo, useRef, useState } from 'react'
import { BodyPainMap } from './BodyPainMap'
import { Slider } from './FormControls'
import { SectionHeading } from './SectionHeading'
import { VoiceDraftButton } from './VoiceDraftButton'
import { getCheckoutForEvent, hasEventStarted, isAllDayCheckInOpen, isAllDayEvent } from '../utils/events'

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
    <div className="check-in-grid check-in-grid-single" data-tour="check-in-page">
      <div className="form-panel">
        <div className="checkin-tour-intro" data-tour="check-in-intro">
          <SectionHeading eyebrow={todayLabel} title="Check-in." />

          {eventOptions.length > 0 && (
            <EventPicker
              checkouts={checkouts}
              eventOptions={eventOptions}
              selectedEventId={selectedEventId}
              todayIso={todayIso}
              onSelectEvent={onSelectEvent}
            />
          )}

        </div>

        <div className="quick-checkin-tools">
          {isQuickMode && <p>Quick check-in keeps the highest-value readiness signals. Add details whenever something needs attention.</p>}
          <VoiceDraftButton onQuickSave={onQuickSave} onApply={(draft) => Object.entries(draft).forEach(([field, value]) => { if (value !== null && field !== 'notes') onUpdate(field, value) })} />
        </div>

        <Slider
          description="How much energy you have available right now."
          label="Energy"
          max={5}
          value={checkIn.energy}
          unit="/5"
          onChange={(value) => onUpdate('energy', value)}
        />
        {!isQuickMode && <Slider
          description="Overall muscle discomfort or tenderness, even before activity."
          label="Muscle soreness"
          min={0}
          max={5}
          value={checkIn.soreness}
          unit="/5"
          onChange={(value) => onUpdate('soreness', value)}
        />}
        <Slider
          description="How worn down your whole body feels."
          label="General fatigue"
          min={0}
          max={5}
          value={checkIn.fatigue}
          unit="/5"
          onChange={(value) => onUpdate('fatigue', value)}
        />
        {!isQuickMode && <Slider
          description="Whether your legs feel unusually heavy or slow."
          label="Leg heaviness"
          min={0}
          max={5}
          value={checkIn.legHeaviness ?? 0}
          unit="/5"
          onChange={(value) => onUpdate('legHeaviness', value)}
        />}
        {isFirstEventToday && (
          <>
            <Slider
              description="Total hours you slept last night."
              label="Sleep"
              min={3}
              max={10}
              maxLabel="10h+"
              value={checkIn.sleep}
              unit="h"
              onChange={(value) => onUpdate('sleep', value)}
            />
            <Slider
              description="How restful and restorative your sleep felt."
              label="Sleep quality"
              min={0}
              max={5}
              value={checkIn.sleepQuality ?? 5}
              unit="/5"
              onChange={(value) => onUpdate('sleepQuality', value)}
            />
          </>
        )}
        <div className="select-row">
          <Slider
            description="How much pressure or worry you feel today."
            label="Stress"
            min={0}
            max={5}
            value={checkIn.stress ?? 0}
            unit="/5"
            onChange={(value) => onUpdate('stress', value)}
          />
          <DailyFuelContext dailyWellness={dailyWellness} eventPreparationContext={eventPreparationContext} />
        </div>
        <div className="select-row">
          <Slider
            description="Any symptoms that may affect training today."
            label="Illness symptoms"
            min={0}
            max={5}
            value={checkIn.illnessSymptoms ?? 0}
            formatValue={formatIllnessValue}
            onChange={(value) => onUpdate('illnessSymptoms', value)}
          />
        </div>
        <Slider
          description="How hard you expect this event to feel from your perspective."
          label="Expected difficulty"
          max={10}
          min={1}
          value={checkIn.expectedDifficulty ?? 5}
          unit="/10"
          onChange={(value) => onUpdate('expectedDifficulty', value)}
        />
          <BodyPainMap
          affectedMovement={checkIn.affectedMovement}
          hurtsWhen={checkIn.hurtsWhen}
          injuryType={checkIn.injuryType}
          painType={checkIn.painType}
          painTrend={checkIn.painTrend}
          details={checkIn.painDetails}
          value={checkIn.painMap}
          onDetailsChange={(value) => onUpdate('painDetails', value)}
          onChange={(value) => onUpdate('painMap', value)}
        />

        <button className="primary-button" disabled={isSaving} onClick={() => onSave()} type="button">
          {isSaving ? 'Generating recommendation...' : 'Save check-in'}
        </button>
      </div>

    </div>
  )
}

function formatIllnessValue(value) {
  if (value === 0) return '0 - None'
  if (value <= 2) return `${value} - Mild`
  return `${value} - Unwell`
}

function EventPicker({ checkouts, eventOptions, onSelectEvent, selectedEventId, todayIso }) {
  const [centerIndex, setCenterIndex] = useState(0)
  const dragStartRef = useRef(null)
  const completedEventIds = useMemo(
    () => new Set(checkouts.map((checkout) => checkout.eventId).filter(Boolean)),
    [checkouts],
  )
  const selectedIndex = useMemo(() => {
    const selected = eventOptions.findIndex((event) => event.id === selectedEventId)

    if (selected >= 0) return selected

    const today = eventOptions.findIndex((event) => event.date === todayIso)
    if (today >= 0) return today

    const future = eventOptions.findIndex((event) => event.date > todayIso)

    return future >= 0 ? future : 0
  }, [eventOptions, selectedEventId, todayIso])
  const activeTodayEventId = useMemo(
    () => eventOptions.find((event) => event.date === todayIso && !completedEventIds.has(event.id) && isInsideCheckInWindow(event))?.id ?? null,
    [completedEventIds, eventOptions, todayIso],
  )
  const visibleEvents = useMemo(() => {
    const start = Math.max(0, centerIndex - 2)
    const end = Math.min(eventOptions.length, centerIndex + 3)

    return eventOptions.slice(start, end).map((event, index) => ({
      event,
      index: start + index,
    }))
  }, [centerIndex, eventOptions])

  useEffect(() => {
    setCenterIndex(selectedIndex)
  }, [selectedIndex])

  if (eventOptions.length === 0) return null

  function moveCenter(direction) {
    setCenterIndex((current) =>
      Math.max(0, Math.min(eventOptions.length - 1, current + direction)),
    )
  }

  function handlePointerDown(event) {
    dragStartRef.current = event.clientX
  }

  function handlePointerUp(event) {
    const start = dragStartRef.current

    dragStartRef.current = null

    if (start === null) return

    const distance = event.clientX - start

    if (Math.abs(distance) < 34) return

    moveCenter(distance < 0 ? 1 : -1)
  }

  return (
    <div className="event-picker">
      <p className="eyebrow">Choose event</p>
      <div className="event-carousel">
        <button
          aria-label="Previous event"
          className="event-picker-arrow"
          disabled={centerIndex === 0}
          onClick={() => moveCenter(-1)}
          type="button"
        >
          <span aria-hidden="true">{'<'}</span>
        </button>
        <div
          className="event-picker-window"
          onPointerCancel={() => {
            dragStartRef.current = null
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div
            className="event-picker-track"
            style={{ '--center-offset': `${visibleEvents.findIndex(({ index }) => index === centerIndex)}` }}
          >
        {visibleEvents.map(({ event, index }) => {
          const isToday = event.date === todayIso
          const isSelected = event.id === selectedEventId
          const isCompleted = completedEventIds.has(event.id)
          const isLockedByCheckout = isToday && !isCompleted && event.id !== activeTodayEventId
          const isOutsideCheckInWindow = isToday && !isCompleted && !isInsideCheckInWindow(event)
          const isDisabled = !isToday || isLockedByCheckout || isOutsideCheckInWindow || isCompleted

          return (
            <button
              className={[
                isSelected ? 'selected' : '',
                index === centerIndex ? 'centered' : '',
                isDisabled ? 'disabled' : '',
                isLockedByCheckout ? 'locked' : '',
                isOutsideCheckInWindow ? 'locked' : '',
                Math.abs(index - centerIndex) >= 2 ? 'edge' : '',
              ].filter(Boolean).join(' ')}
              disabled={isDisabled}
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
              type="button"
            >
              <span className="event-picker-date-row">
                <strong>{formatEventDateShort(event.date)}</strong>
                {event.time && <em>{formatEventTime(event.time)}</em>}
              </span>
              <span className="event-picker-title">{event.title || event.type}</span>
              <span className="event-picker-meta">{event.association || 'Personal'}</span>
              {isLockedByCheckout && <span className="event-picker-lock">Checkout required</span>}
              {isOutsideCheckInWindow && !isLockedByCheckout && <span className="event-picker-lock">Available 3 hours before</span>}
            </button>
          )
        })}
          </div>
        </div>
        <button
          aria-label="Next event"
          className="event-picker-arrow"
          disabled={centerIndex === eventOptions.length - 1}
          onClick={() => moveCenter(1)}
          type="button"
        >
          <span aria-hidden="true">{'>'}</span>
        </button>
      </div>
    </div>
  )
}

function formatEventDateShort(date) {
  const parsed = new Date(`${date}T12:00:00`)

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(parsed)
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
