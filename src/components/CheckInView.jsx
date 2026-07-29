import { useEffect, useMemo, useRef, useState } from 'react'
import { BodyPainMap } from './BodyPainMap'
import { Select, Slider } from './FormControls'
import { SectionHeading } from './SectionHeading'

export function CheckInView({
  checkIn,
  checkouts = [],
  eventOptions = [],
  isSavedToday,
  isSaving,
  nextEvent,
  selectedEvent,
  selectedEventId,
  todayEvents = [],
  todayIso,
  todayLabel,
  onSave,
  onEditToday,
  onSelectEvent,
  onUpdate,
}) {
  const todayScheduleLabel = selectedEvent?.title ?? todayEvents[0]?.title ?? checkIn.session
  const nextLabel = nextEvent ? nextEvent.title : 'No upcoming events'
  const selectedEventLabel = selectedEvent?.title ?? 'Open training day'

  if (!selectedEvent) {
    return (
      <div className="saved-checkin">
        <EventPicker
          checkouts={checkouts}
          eventOptions={eventOptions}
          selectedEventId={selectedEventId}
          todayIso={todayIso}
          onSelectEvent={onSelectEvent}
        />
        <SectionHeading eyebrow={todayLabel} title="No event check-in available." />
        <p>Pre-check-ins are only available for events scheduled today.</p>
      </div>
    )
  }

  if (isSavedToday) {
    return (
      <div className="saved-checkin">
        <EventPicker
          checkouts={checkouts}
          eventOptions={eventOptions}
          selectedEventId={selectedEventId}
          todayIso={todayIso}
          onSelectEvent={onSelectEvent}
        />
        <SectionHeading eyebrow={selectedEventLabel} title="Pre-check-in saved." />
        <p>Come back after this event to log what actually happened.</p>
        <button className="ghost-close" onClick={onEditToday} type="button">
          Edit this pre-check-in
        </button>
      </div>
    )
  }

  return (
    <div className="check-in-grid check-in-grid-single">
      <div className="form-panel">
        <SectionHeading eyebrow={todayLabel} title="Pre-event check-in." />

        {eventOptions.length > 0 && (
          <EventPicker
            checkouts={checkouts}
            eventOptions={eventOptions}
            selectedEventId={selectedEventId}
            todayIso={todayIso}
            onSelectEvent={onSelectEvent}
          />
        )}

        <div className="schedule-source">
          <span>
            <strong>Yesterday</strong>
            {checkIn.yesterdayLoad}
          </span>
          <span className="today-chip">
            <strong>Event</strong>
            {todayScheduleLabel}
          </span>
          <span>
            <strong>Intensity</strong>
            {selectedEvent?.load ?? nextLabel}
          </span>
        </div>

        <Slider
          label="Energy"
          max={10}
          value={checkIn.energy}
          unit="/10"
          onChange={(value) => onUpdate('energy', value)}
        />
        <Slider
          label="Soreness"
          max={10}
          value={checkIn.soreness}
          unit="/10"
          onChange={(value) => onUpdate('soreness', value)}
        />
        <Slider
          label="Fatigue"
          max={10}
          value={checkIn.fatigue}
          unit="/10"
          onChange={(value) => onUpdate('fatigue', value)}
        />
        <Slider
          label="Sleep"
          min={3}
          max={10}
          value={checkIn.sleep}
          unit="h"
          onChange={(value) => onUpdate('sleep', value)}
        />
        <div className="select-row">
          <Select
            label="Stress"
            value={checkIn.stress}
            options={['Low', 'Medium', 'High']}
            onChange={(value) => onUpdate('stress', value)}
          />
          <HydrationInput
            value={checkIn.hydrationOz ?? 0}
            status={checkIn.hydration}
            onChange={(value) => onUpdate('hydrationOz', value)}
          />
        </div>

        <BodyPainMap
          hurtsWhen={checkIn.hurtsWhen}
          injuryType={checkIn.injuryType}
          painType={checkIn.painType}
          value={checkIn.painMap}
          onDetailChange={onUpdate}
          onChange={(value) => onUpdate('painMap', value)}
        />

        <label className="notes-field">
          Notes
          <textarea
            value={checkIn.notes}
            onChange={(event) => onUpdate('notes', event.target.value)}
          />
        </label>

        <button className="primary-button" disabled={isSaving} onClick={onSave} type="button">
          {isSaving ? 'Generating recommendation...' : 'Save check-in'}
        </button>
      </div>

    </div>
  )
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
    () => eventOptions.find((event) => event.date === todayIso && !completedEventIds.has(event.id))?.id ?? null,
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
          const isLockedByCheckout = isToday && event.id !== activeTodayEventId
          const isDisabled = !isToday || isLockedByCheckout

          return (
            <button
              className={[
                isSelected ? 'selected' : '',
                index === centerIndex ? 'centered' : '',
                isDisabled ? 'disabled' : '',
                isLockedByCheckout ? 'locked' : '',
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
              {isLockedByCheckout && <span className="event-picker-lock">Post-checkout required</span>}
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

const hydrationOptions = [0, 16, 24, 32, 40, 64, 80, 101]
const dailyHydrationTargetOz = 101.4

function HydrationInput({ onChange, status, value }) {
  const progress = Math.max(0, Math.min(100, (Number(value) / dailyHydrationTargetOz) * 100))

  return (
    <label className="hydration-field">
      <span>Hydration</span>
      <div className="hydration-inline">
        <div className="hydration-control">
          <input
            list="hydration-options"
            min="0"
            step="1"
            type="number"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <em>fl oz</em>
          <datalist id="hydration-options">
            {hydrationOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <div className="water-jug">
          <span style={{ height: `${progress}%` }} />
        </div>
      </div>
      <small>{status} toward 3L target</small>
    </label>
  )
}
