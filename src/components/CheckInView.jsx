import { useEffect, useMemo, useRef, useState } from 'react'
import { BodyPainMap } from './BodyPainMap'
import { Select, Slider } from './FormControls'
import { SectionHeading } from './SectionHeading'
import { getCheckoutForEvent, hasEventStarted } from '../utils/events'

export function CheckInView({
  checkIn,
  checkouts = [],
  eventOptions = [],
  isSavedToday,
  isSaving,
  selectedEvent,
  selectedEventId,
  todayIso,
  todayLabel,
  onSave,
  onEditToday,
  onOpenCheckout,
  onSelectEvent,
  onUpdate,
  hasEarlierEventToday,
  isFirstEventToday,
}) {
  const selectedEventLabel = selectedEvent?.title ?? 'Open training day'
  const selectedCheckout = getCheckoutForEvent(checkouts, selectedEvent?.id)
  const canPostCheckIn = selectedEvent && hasEventStarted(selectedEvent) && !selectedCheckout

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
        <SectionHeading eyebrow={todayLabel} title="No event check-in available." />
        <p>Check-ins are only available for events scheduled today.</p>
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

        <Slider
          description="How much energy you have available right now."
          label="Energy"
          max={5}
          value={checkIn.energy}
          unit="/5"
          onChange={(value) => onUpdate('energy', value)}
        />
        <Slider
          description="Overall muscle discomfort or tenderness, even before activity."
          label="Muscle soreness"
          min={1}
          max={5}
          value={checkIn.soreness}
          unit="/5"
          onChange={(value) => onUpdate('soreness', value)}
        />
        <Slider
          description="How worn down your whole body feels."
          label="General fatigue"
          min={1}
          max={5}
          value={checkIn.fatigue}
          unit="/5"
          onChange={(value) => onUpdate('fatigue', value)}
        />
        <Slider
          description="Whether your legs feel unusually heavy or slow."
          label="Leg heaviness"
          min={0}
          max={5}
          value={checkIn.legHeaviness ?? 0}
          unit="/5"
          onChange={(value) => onUpdate('legHeaviness', value)}
        />
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
            <Select
              description="How restful and restorative your sleep felt."
              label="Sleep quality"
              value={String(checkIn.sleepQuality ?? 5)}
              options={['1', '2', '3', '4', '5']}
              onChange={(value) => onUpdate('sleepQuality', Number(value))}
            />
          </>
        )}
        <div className="select-row">
          <Select
            description="How much pressure or worry you feel today."
            label="Stress"
            value={checkIn.stress}
            options={['1 - Low', '2', '3', '4', '5 - High']}
            onChange={(value) => onUpdate('stress', value)}
          />
          <HydrationInput
            value={checkIn.hydrationOz ?? 0}
            onChange={(value) => onUpdate('hydrationOz', value)}
          />
        </div>
        <div className="select-row">
          <Select
            description="Any symptoms that may affect training today."
            label="Illness symptoms"
            value={checkIn.illnessSymptoms ?? 'None'}
            options={['None', 'Mild', 'Significant']}
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
        {hasEarlierEventToday && (
          <fieldset className="recovery-actions-field">
            <legend>Recovery actions completed</legend>
            <p className="field-description">Select anything you did after your earlier session today.</p>
            <div className="recovery-action-options">
              {[
                ['Meal', 'Ate a recovery meal or snack.'],
                ['Hydration', 'Replaced fluids after training.'],
                ['Stretching or mobility', 'Did gentle mobility work.'],
                ['Cooldown', 'Completed an easy cooldown.'],
                ['Rest day', 'Took the day off from training.'],
              ].map(([action, description]) => {
                const checked = (checkIn.recoveryActions ?? []).includes(action)

                return (
                  <label className={checked ? 'recovery-action checked' : 'recovery-action'} key={action}>
                    <input
                      checked={checked}
                      type="checkbox"
                      onChange={(event) => {
                        const actions = new Set(checkIn.recoveryActions ?? [])
                        if (event.target.checked) actions.add(action)
                        else actions.delete(action)
                        onUpdate('recoveryActions', Array.from(actions))
                      }}
                    />
                    <span className="recovery-action-copy">
                      <strong>{action}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

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
          const isCompleted = completedEventIds.has(event.id)
          const isLockedByCheckout = isToday && !isCompleted && event.id !== activeTodayEventId
          const isDisabled = !isToday || isLockedByCheckout || isCompleted

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
              {isLockedByCheckout && <span className="event-picker-lock">Checkout required</span>}
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

const dailyHydrationTargetOz = 101.4

function HydrationInput({ onChange, value }) {
  const progress = Math.max(0, Math.min(100, (Number(value) / dailyHydrationTargetOz) * 100))

  return (
    <div className="hydration-field">
      <span>Today's hydration</span>
      <div className="hydration-inline">
        <div className="hydration-control">
          <div className="hydration-stepper">
            <button aria-label="Increase hydration by 1 fluid ounce" onClick={() => onChange(Number(value || 0) + 1)} type="button">▲</button>
            <span>{value}</span>
            <button aria-label="Decrease hydration by 1 fluid ounce" disabled={Number(value || 0) <= 0} onClick={() => onChange(Math.max(0, Number(value || 0) - 1))} type="button">▼</button>
          </div>
          <em>fl oz</em>
        </div>
        <div className="water-jug">
          <span style={{ height: `${progress}%` }} />
        </div>
      </div>
      <div className="hydration-quick-actions" aria-label="Add to today's hydration">
        {[16, 32, 64].map((amount) => (
          <button key={amount} onClick={() => onChange(Number(value || 0) + amount)} type="button">+{amount}</button>
        ))}
      </div>
      <div className="hydration-quick-actions hydration-minus-actions" aria-label="Reduce today's hydration">
        {[16, 32, 64].map((amount) => (
          <button key={amount} disabled={Number(value || 0) < amount} onClick={() => onChange(Math.max(0, Number(value || 0) - amount))} type="button">−{amount}</button>
        ))}
      </div>
    </div>
  )
}
