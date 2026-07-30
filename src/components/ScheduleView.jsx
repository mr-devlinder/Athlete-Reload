import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { Select } from './FormControls'
import { SectionHeading } from './SectionHeading'
import { getCheckoutForEvent } from '../utils/events'
import { searchUsCities } from '../lib/weather'

const eventTypes = [
  'Rest day',
  'Recovery',
  'Optional training',
  'Team practice',
  'Game',
  'Gym session',
  'Conditioning',
]

const repeatOptions = ['Does not repeat', 'Daily', 'Weekly']
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = new Date()
const todayIso = toIsoDate(today)

const emptyEvent = {
  association: 'Personal',
  availability: 'Required',
  date: todayIso,
  expectedDuration: 60,
  environment: 'Outdoor',
  load: 'Medium',
  location: '',
  note: '',
  opponent: '',
  surface: 'Grass',
  time: '',
  title: 'Team practice',
  venue: '',
  type: 'Team practice',
  repeat: 'Does not repeat',
  repeatCount: 4,
}

export function ScheduleView({
  associations = [],
  athleteProfile,
  checkouts = [],
  checkIns = [],
  onAdd,
  onAddTournament,
  onUpdateTournament,
  onAddAssociation,
  onRenameAssociation,
  onRemoveAssociation,
  onRemove,
  onRemoveTournament,
  onUpdate,
  onboardingAssociation = 'Personal',
  isOnboardingEventCreation = false,
  schedule,
  tournaments = [],
}) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today))
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [modalMode, setModalMode] = useState(null)
  const [draftEvent, setDraftEvent] = useState(emptyEvent)
  const [isAssociationsOpen, setIsAssociationsOpen] = useState(false)
  const [displayMode, setDisplayMode] = useState('calendar')
  const [isTournamentOpen, setIsTournamentOpen] = useState(false)
  const [tournamentModalMode, setTournamentModalMode] = useState('create')
  const [editingTournament, setEditingTournament] = useState(null)

  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const visibleWeek = useMemo(() => eachDayOfInterval({
    start: startOfWeek(parseISO(selectedDate), { weekStartsOn: 0 }),
    end: endOfWeek(parseISO(selectedDate), { weekStartsOn: 0 }),
  }), [selectedDate])
  const selectedEvents = schedule.filter((event) => event.date === selectedDate)
  const selectedTournaments = tournaments.filter((tournament) => isTournamentDate(tournament, selectedDate))
  const activeTournamentSummaries = tournaments.filter(isTournamentSummaryVisible)
  const monthLabel = format(visibleMonth, 'MMMM yyyy')

  function showToday() {
    setVisibleMonth(startOfMonth(today))
    setSelectedDate(todayIso)
  }

  function openCreateModal(date = selectedDate) {
    setDraftEvent({
      ...emptyEvent,
      association: onboardingAssociation,
      date,
      id: `event-${Date.now()}`,
    })
    setModalMode('create')
  }

  function openEditModal(event) {
    setDraftEvent(event)
    setModalMode('edit')
  }

  function openCreateTournament() {
    setEditingTournament(null)
    setTournamentModalMode('create')
    setIsTournamentOpen(true)
  }

  function openEditTournament(tournament) {
    setEditingTournament(tournament)
    setTournamentModalMode('edit')
    setIsTournamentOpen(true)
  }

  function closeModal() {
    setModalMode(null)
  }

  function exportCalendar() {
    const ics = buildCalendarExport(schedule)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'athlete-reload-schedule.ics'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function updateDraft(field, value) {
    setDraftEvent((current) => ({
      ...current,
      environment: field === 'surface' ? getEnvironmentForSurface(value) : current.environment,
      load: field === 'type' ? getDefaultLoadForEvent(value) : current.load,
      title: field === 'type' ? value : current.title,
      [field]: value,
    }))
  }

  async function saveDraft() {
    const event = {
      ...draftEvent,
      environment: getEnvironmentForSurface(draftEvent.surface),
      load: getDefaultLoadForEvent(draftEvent.type),
      plannedMinutes: Number(draftEvent.expectedDuration ?? 60),
      title: draftEvent.type,
    }

    if (modalMode === 'edit') {
      await onUpdate(event.id, event)
    } else {
      const events = createRecurringEvents(event)

      for (const scheduledEvent of events) {
        await onAdd(scheduledEvent)
      }
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
        <div className="schedule-actions">
          <button
            className="secondary-button"
            onClick={() => setIsAssociationsOpen(true)}
            type="button"
          >
            View associations
          </button>
          <button className="secondary-button" onClick={exportCalendar} type="button">Export calendar</button>
          <button className="secondary-button" onClick={openCreateTournament} type="button">Add tournament</button>
          <button
            data-tour="add-event"
            className="secondary-button"
            onClick={() => openCreateModal()}
            type="button"
          >
            Add event
          </button>
        </div>
      </div>

      {activeTournamentSummaries.length > 0 && (
        <section className="tournament-summary-list" aria-label="Scheduled tournaments">
          {activeTournamentSummaries.map((tournament) => {
            const games = schedule.filter((event) => event.tournamentId === tournament.id)
            const completed = games.map((game) => getCheckoutForEvent(checkouts, game.id)).filter(Boolean)
            const minutes = completed.reduce((total, checkout) => total + Number(checkout.actualMinutes ?? 0), 0)
            const load = completed.reduce((total, checkout) => total + Number(checkout.actualMinutes ?? 0) * Number(checkout.difficulty ?? 0), 0)
            const nextGame = games
              .filter((game) => new Date(`${game.date}T${game.time || '23:59'}`).getTime() > Date.now())
              .sort((first, second) => `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`))[0]

            return (
              <article className="tournament-summary" key={tournament.id}>
                <div>
                  <p className="eyebrow">Tournament</p>
                  <strong>{tournament.name}</strong>
                  <span>{formatDisplayDate(tournament.startDate)} - {formatDisplayDate(tournament.endDate)} · {games.length} game{games.length === 1 ? '' : 's'}</span>
                  {nextGame && <span className="tournament-next-game">Next game {formatDistanceToNow(new Date(`${nextGame.date}T${nextGame.time || '23:59'}`), { addSuffix: true })}</span>}
                </div>
                <div className="tournament-summary-metrics">
                  <span><b>{minutes}</b> min played</span>
                  <span><b>{load}</b> load logged</span>
                </div>
                <button className="remove-button compact-action" onClick={() => onRemoveTournament?.(tournament.id)} type="button">Remove</button>
              </article>
            )
          })}
        </section>
      )}

      <div className="schedule-view-switch" role="tablist" aria-label="Schedule view">
        <button aria-selected={displayMode === 'calendar'} className={displayMode === 'calendar' ? 'active' : ''} onClick={() => setDisplayMode('calendar')} role="tab" type="button">Calendar</button>
        <button aria-selected={displayMode === 'week'} className={displayMode === 'week' ? 'active' : ''} onClick={() => setDisplayMode('week')} role="tab" type="button">Week</button>
        <button aria-selected={displayMode === 'list'} className={displayMode === 'list' ? 'active' : ''} onClick={() => setDisplayMode('list')} role="tab" type="button">List</button>
      </div>

      {displayMode === 'calendar' ? <div className="calendar-shell">
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
              const dayTournaments = tournaments.filter((tournament) => isTournamentDate(tournament, day.iso))
              const isSelected = selectedDate === day.iso

              return (
                <div
                  aria-label={`Open ${dayTournaments.length ? dayTournaments[0].name : 'calendar day'}`}
                  className={`calendar-day ${day.inMonth ? '' : 'muted'} ${isSelected ? 'selected' : ''}`}
                  key={day.iso}
                  onClick={() => {
                    setSelectedDate(day.iso)
                    setVisibleMonth(startOfMonth(parseISO(day.iso)))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedDate(day.iso)
                      setVisibleMonth(startOfMonth(parseISO(day.iso)))
                    }
                  }}
                  role="button"
                  tabIndex="0"
                >
                  <span>{day.dayNumber}</span>
                  <div className="day-events">
                    {dayTournaments.map((tournament) => (
                      <button className="tournament-calendar-chip" key={`tournament-${tournament.id}`} onClick={(event) => { event.stopPropagation(); openEditTournament(tournament) }} type="button">
                        {tournament.name}
                      </button>
                    ))}
                    {events.slice(0, Math.max(0, 2 - dayTournaments.length)).map((event) => (
                      <small className={event.load.toLowerCase()} key={event.id}>
                        {event.type}
                      </small>
                    ))}
                    {events.length + dayTournaments.length > 2 && <small>+{events.length + dayTournaments.length - 2} more</small>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="day-detail">
          <p className="eyebrow">{formatDisplayDate(selectedDate)}</p>
          <h3>Day plan</h3>

          {selectedEvents.length === 0 && selectedTournaments.length === 0 ? (
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
              {selectedTournaments.map((tournament) => (
                <article className="event-card tournament-day-card" key={`day-tournament-${tournament.id}`}>
                  <span className="load tournament">Tournament</span>
                  <h4>{tournament.name}</h4>
                  <p>{formatDisplayDate(tournament.startDate)} - {formatDisplayDate(tournament.endDate)}</p>
                  {tournament.location && <p>{tournament.location}</p>}
                </article>
              ))}
              {selectedEvents.map((event) => {
                const checkout = getCheckoutForEvent(checkouts, event.id)
                const checkIn = getCheckInForEvent(checkIns, event.id)

                return (
                  <article className="event-card" key={event.id}>
                    <span className={`load ${event.load.toLowerCase()}`}>
                      {event.association || 'Personal'}
                    </span>
                    <h4>{event.type}</h4>
                  <p>
                    {event.association || 'Personal'}
                    {event.time ? ` at ${formatTimeLabel(event.time)}` : ''}
                  </p>
                    {checkout && (
                      <p>
                        Actual: {checkout.actualMinutes} min, {checkout.difficulty}/10 difficulty
                      </p>
                    )}
                    {checkIn && (
                      <p>
                        Check-in: {checkIn.score}/100 readiness
                      </p>
                    )}
                    {event.note && <p>{event.note}</p>}
                    {(event.opponent || event.venue) && <p>{event.opponent ? `vs ${event.opponent}` : ''}{event.opponent && event.venue ? ' · ' : ''}{event.venue}</p>}
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
                )
              })}
            </div>
          )}
        </aside>
      </div> : displayMode === 'week' ? (
        <section className="week-calendar">
          <div className="calendar-title">
            <strong>{format(visibleWeek[0], 'MMM d')} - {format(visibleWeek[visibleWeek.length - 1], 'MMM d')}</strong>
            <span>Weekly workload</span>
          </div>
          <div className="calendar-controls" aria-label="Calendar week controls">
            <button className="ghost-close" onClick={() => setSelectedDate(toIsoDate(subWeeks(parseISO(selectedDate), 1)))} type="button">Previous</button>
            <button className="ghost-close" onClick={() => setSelectedDate(todayIso)} type="button">Today</button>
            <button className="ghost-close" onClick={() => setSelectedDate(toIsoDate(addWeeks(parseISO(selectedDate), 1)))} type="button">Next</button>
          </div>
          <div className="week-grid">
            {visibleWeek.map((day) => {
              const iso = toIsoDate(day)
              const events = schedule
                .filter((event) => event.date === iso)
                .slice()
                .sort((first, second) => String(first.time ?? '').localeCompare(String(second.time ?? '')))

              return (
                <article className={`week-day${selectedDate === iso ? ' selected' : ''}`} key={iso}>
                  <button className="week-day-heading" onClick={() => setSelectedDate(iso)} type="button">
                    <span>{format(day, 'EEE')}</span>
                    <strong>{format(day, 'd')}</strong>
                  </button>
                  <div className="week-day-events">
                    {events.length === 0 ? <small>No event</small> : events.map((event) => (
                      <button className={`week-event ${event.load?.toLowerCase() ?? 'medium'}`} key={event.id} onClick={() => openEditModal(event)} type="button">
                        <strong>{event.time ? formatTimeLabel(event.time) : 'Time TBA'}</strong>
                        <span>{event.type}</span>
                        <em>{event.association || 'Personal'}</em>
                      </button>
                    ))}
                  </div>
                  <button className="week-add-event" onClick={() => openCreateModal(iso)} type="button">Add</button>
                </article>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="schedule-list-view">
          {schedule.length === 0 ? <p>No scheduled events yet.</p> : schedule
            .slice()
            .sort((first, second) => `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`))
            .map((event) => (
              <article className="schedule-list-row" key={event.id}>
                <div><strong>{formatDisplayDate(event.date)}</strong><span>{event.time ? formatTimeLabel(event.time) : 'Time not set'}</span></div>
                <div><strong>{event.type}</strong><span>{event.association || 'Personal'}{event.opponent ? ` · vs ${event.opponent}` : ''}</span></div>
                <em>{event.availability ?? 'Required'}</em>
                <button className="secondary-button compact-action" onClick={() => openEditModal(event)} type="button">Edit</button>
              </article>
            ))}
        </section>
      )}

      {modalMode && createPortal(
        <EventModal
          associations={associations}
          draftEvent={draftEvent}
          mode={modalMode}
          isOnboardingEventCreation={isOnboardingEventCreation && modalMode === 'create'}
          onClose={closeModal}
          onSave={saveDraft}
          onUpdate={updateDraft}
        />,
        document.body,
      )}

      {isAssociationsOpen && createPortal(
        <AssociationsModal
          associations={associations}
          onAdd={onAddAssociation}
          onClose={() => setIsAssociationsOpen(false)}
          onRemove={onRemoveAssociation}
          onRename={onRenameAssociation}
        />,
        document.body,
      )}
      {isTournamentOpen && createPortal(
        <TournamentModal
          associations={associations}
          athleteProfile={athleteProfile}
          existingGames={editingTournament ? schedule.filter((event) => event.tournamentId === editingTournament.id) : []}
          mode={tournamentModalMode}
          tournament={editingTournament}
          onClose={() => setIsTournamentOpen(false)}
          onDelete={async () => {
            if (editingTournament && window.confirm(`Delete ${editingTournament.name}? This also removes its scheduled games and related check-ins.`)) {
              await onRemoveTournament?.(editingTournament.id)
            }
            setIsTournamentOpen(false)
          }}
          onSave={async (tournament, games) => {
            const saved = tournamentModalMode === 'edit'
              ? await onUpdateTournament?.(tournament, games)
              : await onAddTournament?.(tournament, games)
            if (saved) setIsTournamentOpen(false)
          }}
        />,
        document.body,
      )}
    </div>
  )
}

function TournamentModal({ associations, athleteProfile, existingGames = [], mode = 'create', tournament, onClose, onDelete, onSave }) {
  const defaultGameMinutes = athleteProfile?.sport === 'Soccer' ? 90 : 60
  const [draft, setDraft] = useState({
    association: tournament?.association ?? 'Personal',
    endDate: tournament?.endDate ?? todayIso,
    id: tournament?.id,
    location: tournament?.location ?? '',
    name: tournament?.name ?? '',
    notes: tournament?.notes ?? '',
    startDate: tournament?.startDate ?? todayIso,
  })
  const [games, setGames] = useState(() => existingGames.map((game) => ({ ...game, expectedDuration: game.expectedDuration ?? game.plannedMinutes ?? defaultGameMinutes })))
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState([])
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false)
  const [citySearchError, setCitySearchError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isCurrent = true
    const query = cityQuery.trim()

    if (query.length < 2 || query === draft.location) {
      setCityResults([])
      return () => { isCurrent = false }
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchUsCities(query)
        if (!isCurrent) return
        setCityResults(results)
        setCitySearchError(results.length ? '' : 'Choose a valid U.S. city from the list.')
      } catch (error) {
        if (!isCurrent) return
        setCityResults([])
        setCitySearchError(error.message)
      }
    }, 220)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [cityQuery, draft.location])

  const cityIsValid = !cityQuery.trim() || cityQuery === draft.location

  function updateGame(index, field, value) {
    setGames((current) => current.map((game, gameIndex) => gameIndex === index ? { ...game, [field]: value } : game))
  }

  function addGame() {
    setGames((current) => [...current, {
      date: draft.startDate,
      expectedDuration: defaultGameMinutes,
      opponent: '',
      time: '12:00',
      venue: 'Neutral',
    }])
  }

  async function save() {
    if (!draft.name.trim() || !cityIsValid) return
    setIsSaving(true)
    await onSave({ ...draft, name: draft.name.trim() }, games.map((game) => ({
      association: draft.association,
      availability: 'Required max effort',
      date: game.date,
      environment: 'Outdoor',
      expectedDuration: Number(game.expectedDuration),
      load: 'High',
      location: draft.location,
      note: draft.notes,
      opponent: game.opponent,
      plannedMinutes: Number(game.expectedDuration),
      surface: 'Grass',
      time: game.time,
      title: 'Game',
      type: 'Game',
      venue: game.venue,
    })))
    setIsSaving(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="event-modal tournament-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="schedule-header">
          <SectionHeading eyebrow={mode === 'edit' ? 'Edit tournament' : 'Tournament'} title={mode === 'edit' ? 'Adjust your event weekend.' : 'Build your event weekend.'} />
          <button className="ghost-close" onClick={onClose} type="button">Close</button>
        </div>
        <div className="event-form-grid">
          <label className="compact-field">Tournament name<input autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Summer Showcase" /></label>
          <Select label="Association" value={draft.association} options={['Personal', ...associations.map((association) => association.name)]} onChange={(value) => setDraft((current) => ({ ...current, association: value }))} />
          <label className="compact-field">Start date<input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label className="compact-field">End date<input min={draft.startDate} type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <div className="compact-field city-autocomplete">
            <span>U.S. city</span>
            <input aria-autocomplete="list" aria-expanded={isCityMenuOpen && cityResults.length > 0} aria-invalid={!cityIsValid} autoComplete="off" value={cityQuery} onChange={(event) => { setCityQuery(event.target.value); setCitySearchError(''); setIsCityMenuOpen(true); setDraft((current) => ({ ...current, location: '' })) }} onFocus={() => setIsCityMenuOpen(true)} />
            {isCityMenuOpen && cityResults.length > 0 && <div className="city-suggestions" role="listbox">{cityResults.map((city) => <button key={city.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCityQuery(city.label); setCityResults([]); setCitySearchError(''); setIsCityMenuOpen(false); setDraft((current) => ({ ...current, location: city.label })) }} role="option" type="button">{city.label}</button>)}</div>}
            {!cityIsValid && <small className="city-validation">Choose a city from the suggestions.</small>}
            {citySearchError && cityQuery.trim().length >= 2 && <small className="city-validation">{citySearchError}</small>}
          </div>
        </div>
        <div className="tournament-games-header"><div><p className="eyebrow">Games</p><p>Add each match so the app can track time between games, workload, and pain changes.</p></div><button className="secondary-button compact-action" onClick={addGame} type="button">Add game</button></div>
        <div className="tournament-games-list">
          {games.map((game, index) => (
            <div className="tournament-game-fields" key={`${game.date}-${index}`}>
              <strong>Game {index + 1}</strong>
              <label>Date<input max={draft.endDate} min={draft.startDate} type="date" value={game.date} onChange={(event) => updateGame(index, 'date', event.target.value)} /></label>
              <label>Time<input type="time" value={game.time} onChange={(event) => updateGame(index, 'time', event.target.value)} /></label>
              <label>Opponent<input value={game.opponent} onChange={(event) => updateGame(index, 'opponent', event.target.value)} placeholder="Optional" /></label>
              <label>Expected minutes<input min="1" type="number" value={game.expectedDuration} onChange={(event) => updateGame(index, 'expectedDuration', event.target.value)} /></label>
              <label>Venue<select value={game.venue} onChange={(event) => updateGame(index, 'venue', event.target.value)}><option>Home</option><option>Away</option><option>Neutral</option></select></label>
              {games.length > 1 && <button className="remove-button compact-action" onClick={() => setGames((current) => current.filter((_, gameIndex) => gameIndex !== index))} type="button">Remove</button>}
            </div>
          ))}
        </div>
        <label className="compact-field"><span>Notes</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
        <div className="tournament-modal-actions">
          {mode === 'edit' && <button className="remove-button" onClick={onDelete} type="button">Delete tournament</button>}
          <button className="primary-button" disabled={isSaving || !draft.name.trim() || !cityIsValid} onClick={save} type="button">{isSaving ? 'Saving tournament...' : mode === 'edit' ? 'Save tournament' : 'Create tournament'}</button>
        </div>
      </section>
    </div>
  )
}

function buildCalendarExport(schedule) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Athlete Reload//Schedule//EN', 'CALSCALE:GREGORIAN']

  for (const event of schedule) {
    const date = String(event.date ?? '').replaceAll('-', '')
    const time = getTimeParts(event.time)
    const hour = Number(time.hour) % 12 + (time.period === 'PM' ? 12 : 0)
    const start = `${date}T${String(hour).padStart(2, '0')}${time.minute}00`
    const duration = Math.max(15, Number(event.expectedDuration ?? event.plannedMinutes ?? 60))
    const endDate = new Date(`${event.date}T${String(hour).padStart(2, '0')}:${time.minute}:00`)
    endDate.setMinutes(endDate.getMinutes() + duration)
    const end = format(endDate, "yyyyMMdd'T'HHmmss")
    const description = [event.association, event.availability, event.note].filter(Boolean).join(' | ').replaceAll('\n', ' ')

    lines.push('BEGIN:VEVENT', `UID:${event.id}@athlete-reload`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeIcs(event.type)}`, `DESCRIPTION:${escapeIcs(description)}`, event.location ? `LOCATION:${escapeIcs(event.location)}` : '', 'END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.filter(Boolean).join('\r\n')
}

function escapeIcs(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,')
}

function isTournamentDate(tournament, date) {
  return Boolean(tournament?.startDate && tournament?.endDate && date >= tournament.startDate && date <= tournament.endDate)
}

function isTournamentSummaryVisible(tournament) {
  if (!tournament?.startDate || !tournament?.endDate) return false

  const today = toIsoDate(new Date())
  const visibleFrom = toIsoDate(addDays(parseISO(tournament.startDate), -1))
  const visibleUntil = toIsoDate(addDays(parseISO(tournament.endDate), 1))

  return today >= visibleFrom && today <= visibleUntil
}

function EventModal({ associations, draftEvent, isOnboardingEventCreation, mode, onClose, onSave, onUpdate }) {
  const [cityQuery, setCityQuery] = useState(draftEvent.location ?? '')
  const [cityResults, setCityResults] = useState([])
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false)
  const [citySearchError, setCitySearchError] = useState('')

  useEffect(() => {
    document.body.classList.add('modal-open')

    return () => document.body.classList.remove('modal-open')
  }, [])

  useEffect(() => {
    let isCurrent = true
    const query = cityQuery.trim()

    if (query.length < 2 || query === draftEvent.location) {
      setCityResults([])
      return () => {
        isCurrent = false
      }
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchUsCities(query)
        if (!isCurrent) return
        setCityResults(results)
        setCitySearchError(results.length === 0 ? 'Choose a valid U.S. city from the list.' : '')
      } catch (error) {
        if (!isCurrent) return
        setCityResults([])
        setCitySearchError(error.message)
      }
    }, 220)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [cityQuery, draftEvent.location])

  const cityIsValid = !cityQuery.trim() || cityQuery === draftEvent.location

  function updateCity(value) {
    setCityQuery(value)
    setCitySearchError('')
    setIsCityMenuOpen(true)
    onUpdate('location', '')
  }

  function chooseCity(city) {
    setCityQuery(city.label)
    setCityResults([])
    setCitySearchError('')
    setIsCityMenuOpen(false)
    onUpdate('location', city.label)
  }

  return (
    <div
      className={`modal-backdrop${isOnboardingEventCreation ? ' onboarding-event-backdrop' : ''}`}
      style={isOnboardingEventCreation
        ? { alignItems: 'start', paddingTop: 'var(--guided-tour-form-top, 140px)' }
        : undefined}
    >
      <section
        className="event-modal associations-modal glass-panel"
        role="dialog"
        aria-modal="true"
        style={isOnboardingEventCreation
          ? { maxHeight: 'calc(100dvh - var(--guided-tour-form-top, 140px))' }
          : undefined}
      >
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
            Date
            <input
              type="date"
              value={draftEvent.date}
              onChange={(event) => onUpdate('date', event.target.value)}
            />
          </label>
          <TimePicker
            value={draftEvent.time}
            onChange={(value) => onUpdate('time', value)}
          />
          <Select
            label="Event type"
            value={draftEvent.type}
            options={eventTypes}
            onChange={(value) => onUpdate('type', value)}
          />
          <label className="compact-field">
            Expected duration (minutes)
            <input
              min="15"
              step="15"
              type="number"
              value={draftEvent.expectedDuration ?? 60}
              onChange={(event) => onUpdate('expectedDuration', event.target.value)}
            />
          </label>
          <label className="compact-field">
            Association
            <select
              value={draftEvent.association ?? 'Personal'}
              onChange={(event) => onUpdate('association', event.target.value)}
            >
              <option value="Personal">Personal</option>
              {associations.map((association) => (
                <option key={association.id} value={association.name}>
                  {association.name}
                </option>
              ))}
            </select>
          </label>
          <Select
            label="Event importance"
            value={draftEvent.availability ?? 'Required'}
            options={['Required max effort', 'Required', 'Optional', 'Recovery']}
            onChange={(value) => onUpdate('availability', value)}
          />
          {draftEvent.type === 'Game' && (
            <>
              <label className="compact-field">
                Opponent
                <input value={draftEvent.opponent ?? ''} onChange={(event) => onUpdate('opponent', event.target.value)} placeholder="Optional opponent" />
              </label>
              <label className="compact-field">
                Home or away
                <select value={draftEvent.venue ?? ''} onChange={(event) => onUpdate('venue', event.target.value)}>
                  <option value="">Not set</option>
                  <option>Home</option>
                  <option>Away</option>
                  <option>Neutral</option>
                </select>
              </label>
            </>
          )}
          <Select
            label="Surface"
            value={draftEvent.surface ?? 'Grass'}
            options={['Grass', 'Turf', 'Court', 'Track', 'Gym', 'Other']}
            onChange={(value) => onUpdate('surface', value)}
          />
          <div className="compact-field city-autocomplete">
            <span>U.S. city</span>
            <input
              aria-autocomplete="list"
              aria-expanded={isCityMenuOpen && cityResults.length > 0}
              aria-invalid={!cityIsValid}
              autoComplete="off"
              value={cityQuery}
              onChange={(event) => updateCity(event.target.value)}
              onFocus={() => setIsCityMenuOpen(true)}
            />
            {isCityMenuOpen && cityResults.length > 0 && (
              <div className="city-suggestions" role="listbox">
                {cityResults.map((city) => (
                  <button key={city.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseCity(city)} role="option" type="button">
                    {city.label}
                  </button>
                ))}
              </div>
            )}
            {!cityIsValid && <small className="city-validation">Choose a city from the suggestions.</small>}
            {citySearchError && cityQuery.trim().length >= 2 && <small className="city-validation">{citySearchError}</small>}
          </div>
          {mode === 'create' && (
            <>
              <Select
                label="Repeat"
                value={draftEvent.repeat}
                options={repeatOptions}
                onChange={(value) => onUpdate('repeat', value)}
              />
              {draftEvent.repeat !== 'Does not repeat' && (
                <label className="compact-field">
                  Number of events
                  <input
                    max="52"
                    min="1"
                    type="number"
                    value={draftEvent.repeatCount}
                    onChange={(event) => onUpdate('repeatCount', event.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <label className="compact-field modal-notes">
            Notes
            <textarea
              value={draftEvent.note}
              onChange={(event) => onUpdate('note', event.target.value)}
              placeholder="Practice focus, location, or coach note"
            />
          </label>
        </div>

        <button className="primary-button" disabled={!cityIsValid} onClick={onSave} type="button">
          {mode === 'edit' ? 'Save changes' : 'Create event'}
        </button>
      </section>
    </div>
  )
}

function AssociationsModal({ associations, onAdd, onClose, onRemove, onRename }) {
  const [draftName, setDraftName] = useState('')

  async function addDraft() {
    await onAdd(draftName)
    setDraftName('')
  }

  return (
    <div className="modal-backdrop">
      <section className="event-modal glass-panel" role="dialog" aria-modal="true">
        <div className="schedule-header">
          <SectionHeading eyebrow="Associations" title="Teams and training groups." />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="association-list">
          {associations.length === 0 ? (
            <p>No custom associations yet. Add your team, school, or club.</p>
          ) : (
            associations.map((association) => (
              <div className="association-row" key={association.id}>
                <input
                  aria-label={`${association.name} association name`}
                  value={association.name}
                  onChange={(event) => onRename(association.id, event.target.value)}
                />
                <button
                  className="remove-button compact-action"
                  onClick={() => onRemove(association.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="association-add">
          <input
            aria-label="New association name"
            placeholder="Add association"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button className="secondary-button compact-action" onClick={addDraft} type="button">
            Add
          </button>
        </div>
      </section>
    </div>
  )
}

function TimePicker({ onChange, value }) {
  const parts = getTimeParts(value)

  function updateTime(part, nextValue) {
    onChange(toStoredTime({
      ...parts,
      [part]: nextValue,
    }))
  }

  return (
    <fieldset className="compact-field time-picker-field">
      <legend>Time</legend>
      <div className="time-picker">
        <select
          aria-label="Hour"
          value={parts.hour}
          onChange={(event) => updateTime('hour', event.target.value)}
        >
          {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
            <option key={hour} value={hour}>{hour}</option>
          ))}
        </select>
        <span>:</span>
        <select
          aria-label="Minute"
          value={parts.minute}
          onChange={(event) => updateTime('minute', event.target.value)}
        >
          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
            <option key={minute} value={minute}>{minute}</option>
          ))}
        </select>
        <select
          aria-label="AM or PM"
          value={parts.period}
          onChange={(event) => updateTime('period', event.target.value)}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>
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

function toTimeInputValue(value) {
  if (!value) return ''
  if (/^\d{2}:\d{2}$/.test(value)) return value

  const parsed = new Date(`2000-01-01 ${value}`)

  if (Number.isNaN(parsed.getTime())) return ''

  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function getTimeParts(value) {
  const timeValue = toTimeInputValue(value) || '18:00'
  const [hourText, minuteText] = timeValue.split(':')
  const hour = Number(hourText)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = String(hour % 12 || 12)

  return {
    hour: displayHour,
    minute: minuteText,
    period,
  }
}

function toStoredTime({ hour, minute, period }) {
  let storedHour = Number(hour)

  if (period === 'PM' && storedHour !== 12) storedHour += 12
  if (period === 'AM' && storedHour === 12) storedHour = 0

  return `${String(storedHour).padStart(2, '0')}:${minute}`
}

function formatTimeLabel(value) {
  const timeValue = toTimeInputValue(value)

  if (!timeValue) return value

  const [hourText, minuteText] = timeValue.split(':')
  const hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minuteText} ${suffix}`
}

function getCheckInForEvent(checkIns, eventId) {
  return checkIns.find((checkIn) => checkIn.eventId === eventId)
}

function getDefaultLoadForEvent(type) {
  if (['Game', 'Tournament', 'Conditioning'].includes(type)) return 'High'
  if (['Recovery', 'Rest day'].includes(type)) return 'Low'

  return 'Medium'
}

function getEnvironmentForSurface(surface) {
  return ['Court', 'Gym'].includes(surface) ? 'Indoor' : 'Outdoor'
}

function createRecurringEvents(event) {
  const count = event.repeat === 'Does not repeat'
    ? 1
    : Math.max(1, Math.min(52, Number(event.repeatCount) || 1))

  return Array.from({ length: count }, (_, index) => {
    const date = parseISO(event.date)
    const nextDate = event.repeat === 'Daily'
      ? addDays(date, index)
      : event.repeat === 'Weekly'
        ? addDays(date, index * 7)
        : date

    return {
      date: toIsoDate(nextDate),
      id: index === 0 ? event.id : `event-${Date.now()}-${index}`,
      association: event.association ?? 'Personal',
      load: getDefaultLoadForEvent(event.type),
      note: event.note,
      time: event.time,
      title: event.type,
      type: event.type,
    }
  })
}
