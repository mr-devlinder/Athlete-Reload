import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { Select } from './FormControls'
import { SectionHeading } from './SectionHeading'

const eventTypes = [
  'Rest day',
  'Recovery',
  'Optional training',
  'Team practice',
  'Game',
  'Gym session',
  'Conditioning',
  'Tournament',
]

const loadLevels = ['Low', 'Medium', 'High']
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = new Date()
const todayIso = toIsoDate(today)

const emptyEvent = {
  date: todayIso,
  load: 'Medium',
  note: '',
  time: '',
  title: '',
  type: 'Team practice',
}

export function ScheduleView({
  onAdd,
  onRemove,
  onUpdate,
  schedule,
}) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today))
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [modalMode, setModalMode] = useState(null)
  const [draftEvent, setDraftEvent] = useState(emptyEvent)

  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const selectedEvents = schedule.filter((event) => event.date === selectedDate)
  const monthLabel = format(visibleMonth, 'MMMM yyyy')

  function showToday() {
    setVisibleMonth(startOfMonth(today))
    setSelectedDate(todayIso)
  }

  function openCreateModal(date = selectedDate) {
    setDraftEvent({
      ...emptyEvent,
      date,
      id: `event-${Date.now()}`,
    })
    setModalMode('create')
  }

  function openEditModal(event) {
    setDraftEvent(event)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
  }

  function updateDraft(field, value) {
    setDraftEvent((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function saveDraft() {
    const event = {
      ...draftEvent,
      title: draftEvent.title || draftEvent.type,
    }

    if (modalMode === 'edit') {
      onUpdate(event.id, event)
    } else {
      onAdd(event)
    }

    setSelectedDate(event.date)
    closeModal()
  }

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <SectionHeading
          eyebrow="Team training mode"
          title="Training calendar."
        />
        <button
          className="secondary-button"
          onClick={() => openCreateModal()}
          type="button"
        >
          Add event
        </button>
      </div>

      <div className="calendar-shell">
        <section className="month-calendar">
          <div className="calendar-title">
            <strong>{monthLabel}</strong>
            <span>{schedule.length} scheduled events</span>
          </div>

          <div className="calendar-controls" aria-label="Calendar month controls">
            <button
              className="ghost-close"
              onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
              type="button"
            >
              Previous
            </button>
            <button className="ghost-close" onClick={showToday} type="button">
              Today
            </button>
            <button
              className="ghost-close"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              type="button"
            >
              Next
            </button>
          </div>

          <div className="weekday-row">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="month-grid">
            {days.map((day) => {
              const events = schedule.filter((event) => event.date === day.iso)
              const isSelected = selectedDate === day.iso

              return (
                <button
                  className={`calendar-day ${day.inMonth ? '' : 'muted'} ${isSelected ? 'selected' : ''}`}
                  key={day.iso}
                  onClick={() => {
                    setSelectedDate(day.iso)
                    setVisibleMonth(startOfMonth(parseISO(day.iso)))
                  }}
                  type="button"
                >
                  <span>{day.dayNumber}</span>
                  <div className="day-events">
                    {events.slice(0, 2).map((event) => (
                      <small className={event.load.toLowerCase()} key={event.id}>
                        {event.title}
                      </small>
                    ))}
                    {events.length > 2 && <small>+{events.length - 2} more</small>}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="day-detail">
          <p className="eyebrow">{formatDisplayDate(selectedDate)}</p>
          <h3>Day plan</h3>

          {selectedEvents.length === 0 ? (
            <div className="empty-day">
              <p>No training events yet.</p>
              <button
                className="secondary-button"
                onClick={() => openCreateModal(selectedDate)}
                type="button"
              >
                Add event
              </button>
            </div>
          ) : (
            <div className="event-list">
              {selectedEvents.map((event) => (
                <article className="event-card" key={event.id}>
                  <span className={`load ${event.load.toLowerCase()}`}>
                    {event.load}
                  </span>
                  <h4>{event.title}</h4>
                  <p>
                    {event.type}
                    {event.time ? ` at ${event.time}` : ''}
                  </p>
                  {event.note && <p>{event.note}</p>}
                  <div className="event-actions">
                    <button
                      className="secondary-button compact-action"
                      onClick={() => openEditModal(event)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="remove-button compact-action"
                      onClick={() => onRemove(event.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>

      {modalMode && (
        <EventModal
          draftEvent={draftEvent}
          mode={modalMode}
          onClose={closeModal}
          onSave={saveDraft}
          onUpdate={updateDraft}
        />
      )}
    </div>
  )
}

function EventModal({ draftEvent, mode, onClose, onSave, onUpdate }) {
  return (
    <div className="modal-backdrop">
      <section className="event-modal glass-panel" role="dialog" aria-modal="true">
        <div className="schedule-header">
          <SectionHeading
            eyebrow={mode === 'edit' ? 'Edit event' : 'New event'}
            title={mode === 'edit' ? 'Adjust this training day.' : 'Create a training event.'}
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="modal-form">
          <label className="compact-field">
            Title
            <input
              value={draftEvent.title}
              onChange={(event) => onUpdate('title', event.target.value)}
              placeholder="Soccer practice"
            />
          </label>
          <label className="compact-field">
            Date
            <input
              type="date"
              value={draftEvent.date}
              onChange={(event) => onUpdate('date', event.target.value)}
            />
          </label>
          <label className="compact-field">
            Time
            <input
              value={draftEvent.time}
              onChange={(event) => onUpdate('time', event.target.value)}
              placeholder="6:00 PM"
            />
          </label>
          <Select
            label="Event type"
            value={draftEvent.type}
            options={eventTypes}
            onChange={(value) => onUpdate('type', value)}
          />
          <Select
            label="Load"
            value={draftEvent.load}
            options={loadLevels}
            onChange={(value) => onUpdate('load', value)}
          />
          <label className="compact-field modal-notes">
            Notes
            <textarea
              value={draftEvent.note}
              onChange={(event) => onUpdate('note', event.target.value)}
              placeholder="Practice focus, location, or coach note"
            />
          </label>
        </div>

        <button className="primary-button" onClick={onSave} type="button">
          {mode === 'edit' ? 'Save changes' : 'Create event'}
        </button>
      </section>
    </div>
  )
}

function getCalendarDays(date) {
  const monthStart = startOfMonth(date)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(endOfMonth(date))
  const allDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })
  const paddedDays =
    allDays.length >= 42
      ? allDays
      : [
          ...allDays,
          ...Array.from({ length: 42 - allDays.length }, (_, index) =>
            addDays(calendarEnd, index + 1),
          ),
        ]

  return paddedDays.map((day) => ({
    dayNumber: format(day, 'd'),
    inMonth: isSameMonth(day, monthStart),
    iso: toIsoDate(day),
  }))
}

function toIsoDate(date) {
  return format(date, 'yyyy-MM-dd')
}

function formatDisplayDate(value) {
  return format(parseISO(value), 'EEEE, MMMM d')
}
