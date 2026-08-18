import { useEffect, useMemo, useRef, useState } from 'react'
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
import { AppIcon } from './AppIcon'
import { getCheckoutForEvent, getEventDisplayName, isAllDayEvent, isOtherActivityEvent, isRestDayEvent } from '../utils/events'
import { searchLocations } from '../lib/weather'
import { getCompetitionLabel, getDefaultCompetitionMinutes, getSportEventTypes, getSportSurfaces, getSportWorkloadFields } from '../data/sportProfiles'
import { getWorkloadFieldDisplay, workloadInputToCanonical } from '../utils/units'
import { compareEventsChronologically, getEventColorStyle, getEventSemanticType } from '../domain/events/eventSemantics'
import { getEventFormSchema } from '../domain/events/eventFormSchema'
import { isTournamentSummaryVisible } from '../domain/events/tournamentVisibility'
import '../styles/schedule-semantics.css'

const repeatOptions = ['Does not repeat', 'Daily', 'Weekly']
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = new Date()
const todayIso = toIsoDate(today)

const emptyEvent = {
  allDay: false,
  activityKind: 'training',
  association: 'Personal',
  availability: 'Required',
  date: todayIso,
  expectedDuration: 60,
  expectedIntensity: 'moderate',
  environment: 'Outdoor',
  eventSubtype: '',
  importance: 'normal',
  load: 'Medium',
  location: '',
  note: '',
  opponent: '',
  positionOrEvent: '',
  surface: 'Grass',
  time: '18:00',
  title: 'Team practice',
  venue: '',
  type: 'Team practice',
  customActivityName: '',
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
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ left: 12, top: 12 })
  const actionsMenuRef = useRef(null)
  const actionsMenuButtonRef = useRef(null)

  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const visibleWeek = useMemo(() => eachDayOfInterval({
    start: startOfWeek(parseISO(selectedDate), { weekStartsOn: 0 }),
    end: endOfWeek(parseISO(selectedDate), { weekStartsOn: 0 }),
  }), [selectedDate])
  const selectedEvents = schedule.filter((event) => event.date === selectedDate).sort(compareEventsChronologically)
  const selectedTournaments = tournaments.filter((tournament) => isTournamentDate(tournament, selectedDate))
  const activeTournamentSummaries = tournaments.filter(isTournamentSummaryVisible)
  const monthLabel = format(visibleMonth, 'MMMM yyyy')

  useEffect(() => {
    if (!isActionsMenuOpen) return undefined

    function updatePosition() {
      const rect = actionsMenuButtonRef.current?.getBoundingClientRect()
      if (!rect) return

      const menuWidth = 220
      const menuHeight = 148
      setActionsMenuPosition({
        left: Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)),
        top: rect.bottom + 8 + menuHeight > window.innerHeight
          ? Math.max(12, rect.top - menuHeight - 8)
          : rect.bottom + 8,
      })
    }

    function closeOnOutsidePress(event) {
      if (!actionsMenuButtonRef.current?.contains(event.target) && !actionsMenuRef.current?.contains(event.target)) {
        setIsActionsMenuOpen(false)
      }
    }

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return
      setIsActionsMenuOpen(false)
      actionsMenuButtonRef.current?.focus()
    }

    updatePosition()
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isActionsMenuOpen])

  function runScheduleAction(action) {
    setIsActionsMenuOpen(false)
    action()
  }

  function showToday() {
    setVisibleMonth(startOfMonth(today))
    setSelectedDate(todayIso)
  }

  function openCreateModal(date = selectedDate) {
    const eventTypes = getSportEventTypes(athleteProfile?.sport)
    const type = eventTypes.find((item) => !['Recovery', 'Recovery Day', 'Rest Day'].includes(item)) ?? eventTypes[0]
    const surface = getSportSurfaces(athleteProfile?.sport)[0] ?? emptyEvent.surface
    setDraftEvent({
      ...emptyEvent,
      association: onboardingAssociation,
      date,
      id: `event-${Date.now()}`,
      environment: getEnvironmentForSurface(surface),
      surface,
      title: type,
      type,
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
    setSaveError('')
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
    setDraftEvent((current) => {
      if (field === 'type') {
        const isAllDay = isAllDayEvent({ type: value })
        const isOtherActivity = value === 'Other activity'
        return {
          ...current,
          allDay: isAllDay,
          association: isOtherActivity ? 'None' : current.association === 'None' ? 'Personal' : current.association,
          availability: isAllDay ? 'Recovery' : current.availability,
          activityKind: getActivityKindForType(value),
          customActivityName: isOtherActivity ? current.customActivityName ?? '' : '',
          expectedDuration: isAllDay ? null : current.expectedDuration ?? 60,
          expectedIntensity: isAllDay ? 'low' : current.expectedIntensity ?? intensityFromLoad(getDefaultLoadForEvent(value)),
          load: getDefaultLoadForEvent(value),
          time: isAllDay ? '' : current.time,
          title: value,
          type: value,
        }
      }

      return {
        ...current,
        environment: field === 'surface' ? getEnvironmentForSurface(value) : current.environment,
        [field]: value,
      }
    })
  }

  async function saveDraft() {
    setSaveError('')
    setIsSavingEvent(true)
    const isAllDay = isAllDayEvent(draftEvent)
    const isOtherActivity = isOtherActivityEvent(draftEvent)
    const displayName = isOtherActivity ? draftEvent.customActivityName.trim() : draftEvent.type
    const event = {
      ...draftEvent,
      allDay: isAllDay,
      association: isOtherActivity ? 'None' : draftEvent.association,
      customActivityName: isOtherActivity ? draftEvent.customActivityName.trim() : '',
      environment: getEnvironmentForSurface(draftEvent.surface),
      expectedDuration: isAllDay ? null : Number(draftEvent.expectedDuration ?? 60),
      expectedIntensity: isAllDay ? 'low' : draftEvent.expectedIntensity ?? intensityFromLoad(draftEvent.load),
      importance: isAllDay ? 'normal' : draftEvent.importance ?? importanceFromAvailability(draftEvent.availability),
      load: draftEvent.load ?? getDefaultLoadForEvent(draftEvent.type),
      plannedMinutes: isAllDay ? undefined : Number(draftEvent.expectedDuration ?? 60),
      time: isAllDay ? '' : draftEvent.time,
      title: displayName,
      activityKind: isAllDay ? 'recovery' : draftEvent.activityKind ?? getActivityKindForType(draftEvent.type),
    }

    try {
      if (modalMode === 'edit') {
        if (!(await onUpdate(event.id, event))) throw new Error('update_failed')
      } else {
        const events = createRecurringEvents(event)

        for (const scheduledEvent of events) {
          const result = await onAdd(scheduledEvent)
          if (result !== true) throw result instanceof Error ? result : new Error('create_failed')
        }
      }

      setSelectedDate(event.date)
      closeModal()
    } catch (error) {
      console.error(error)
      const cause = String(error?.message ?? '')
      setSaveError(cause && cause !== 'create_failed'
        ? `The event could not be saved: ${cause}`
        : 'The event could not be saved. Check your connection and try again.')
    } finally {
      setIsSavingEvent(false)
    }
  }

  async function duplicateDraft() {
    setSaveError('')
    setIsSavingEvent(true)
    try {
      const duplicate = {
        ...draftEvent,
        id: `event-${Date.now()}`,
        recurrenceRule: {},
        repeat: 'Does not repeat',
        repeatCount: 1,
        templateSourceId: null,
        title: isOtherActivityEvent(draftEvent) ? draftEvent.customActivityName.trim() : draftEvent.type,
      }
      if (!(await onAdd(duplicate))) throw new Error('duplicate_failed')
      closeModal()
    } catch (error) {
      console.error(error)
      setSaveError('Could not duplicate this event. Your original event was not changed.')
    } finally {
      setIsSavingEvent(false)
    }
  }

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <div className="page-header-copy">
          <SectionHeading eyebrow="Schedule" title="Training calendar." />
          <p className="page-header-description">Plan practices, events, rest days, and competition weekends.</p>
        </div>
        <div className="schedule-actions">
          <button
            aria-expanded={isActionsMenuOpen}
            aria-haspopup="menu"
            aria-label="More schedule actions"
            className="secondary-button schedule-more-button"
            onClick={() => setIsActionsMenuOpen((current) => !current)}
            ref={actionsMenuButtonRef}
            type="button"
          >
            <AppIcon name="more" size={22} />
          </button>
          <button
            data-tour="add-event"
            className="secondary-button"
            onClick={() => openCreateModal()}
            type="button"
          >
            Add Event
          </button>
        </div>
        {isActionsMenuOpen && createPortal(
          <div
            className="schedule-action-menu"
            ref={actionsMenuRef}
            role="menu"
            style={{ left: actionsMenuPosition.left, top: actionsMenuPosition.top }}
          >
            <button onClick={() => runScheduleAction(() => setIsAssociationsOpen(true))} role="menuitem" type="button">Add Associations</button>
            <button onClick={() => runScheduleAction(openCreateTournament)} role="menuitem" type="button">Create Tournament</button>
            <button onClick={() => runScheduleAction(exportCalendar)} role="menuitem" type="button">Export Calendar</button>
          </div>,
          document.body,
        )}
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
              .sort(compareEventsChronologically)[0]

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
                    {events.sort(compareEventsChronologically).slice(0, Math.max(0, 2 - dayTournaments.length)).map((event) => (
                      <small className={`semantic-event semantic-${getEventSemanticType(event)}${isAllDayEvent(event) ? ' rest-day' : ''}`} key={event.id} style={getEventColorStyle(event)}>
                        {getEventDisplayName(event)}{event.allDay ? ' · All day' : ''}
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
                  <article className={`event-card semantic-event semantic-${getEventSemanticType(event)}${isAllDayEvent(event) ? ' rest-day-event' : ''}`} key={event.id} style={getEventColorStyle(event)}>
                    <span className={`load ${event.load.toLowerCase()}`}>
                      {event.association || 'Personal'}
                    </span>
                    <h4>{getEventDisplayName(event)}</h4>
                  <p>
                    {event.association || 'Personal'}
                    {event.allDay ? ' · All day' : event.time ? ` at ${formatTimeLabel(event.time)}` : ''}
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
                .sort(compareEventsChronologically)

              return (
                <article className={`week-day${selectedDate === iso ? ' selected' : ''}`} key={iso}>
                  <button className="week-day-heading" onClick={() => setSelectedDate(iso)} type="button">
                    <span>{format(day, 'EEE')}</span>
                    <strong>{format(day, 'd')}</strong>
                  </button>
                  <div className="week-day-events">
                    {events.length === 0 ? <small>No event</small> : events.map((event) => (
                      <button className={`week-event semantic-event semantic-${getEventSemanticType(event)}${isAllDayEvent(event) ? ' rest-day-event' : ''}`} key={event.id} onClick={() => openEditModal(event)} style={getEventColorStyle(event)} type="button">
                        <strong>{event.allDay ? 'All day' : event.time ? formatTimeLabel(event.time) : 'Time TBA'}</strong>
                        <span>{getEventDisplayName(event)}</span>
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
            .sort(compareEventsChronologically)
            .map((event) => (
              <article className={`schedule-list-row semantic-event semantic-${getEventSemanticType(event)}`} key={event.id} style={getEventColorStyle(event)}>
                <div><strong>{formatDisplayDate(event.date)}</strong><span>{event.allDay ? 'All day' : event.time ? formatTimeLabel(event.time) : 'Time not set'}</span></div>
                <div><strong>{getEventDisplayName(event)}</strong><span>{event.association || 'Personal'}{event.opponent ? ` · vs ${event.opponent}` : ''}</span></div>
                <em>{formatImportance(event.importance ?? importanceFromAvailability(event.availability))}</em>
                <button className="secondary-button compact-action" onClick={() => openEditModal(event)} type="button">Edit</button>
              </article>
            ))}
        </section>
      )}

      {modalMode && createPortal(
        <EventModal
          athleteProfile={athleteProfile}
          associations={associations}
          draftEvent={draftEvent}
          error={saveError}
          isSaving={isSavingEvent}
          mode={modalMode}
          isOnboardingEventCreation={isOnboardingEventCreation && modalMode === 'create'}
          onClose={closeModal}
          onDuplicate={duplicateDraft}
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
  const competitionLabel = getCompetitionLabel(athleteProfile?.sport)
  const defaultGameMinutes = getDefaultCompetitionMinutes(athleteProfile?.sport)
  const defaultSurface = getSportSurfaces(athleteProfile?.sport)[0] ?? 'Other'
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
  const [isCitySearching, setIsCitySearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const query = cityQuery.trim()

    if (!query || query === draft.location) {
      setCityResults([])
      setIsCitySearching(false)
      return () => controller.abort()
    }

    setIsCitySearching(true)
    async function runSearch() {
      try {
        const results = await searchLocations(query, { signal: controller.signal })
        setCityResults(results)
        setCitySearchError(results.length ? '' : 'No matching locations found.')
      } catch (error) {
        if (error.name === 'AbortError') return
        setCityResults([])
        setCitySearchError(error.message)
      } finally {
        if (!controller.signal.aborted) setIsCitySearching(false)
      }
    }
    void runSearch()

    return () => controller.abort()
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
      environment: getEnvironmentForSurface(defaultSurface),
      expectedDuration: Number(game.expectedDuration),
      load: 'High',
      location: draft.location,
      note: draft.notes,
      opponent: game.opponent,
      plannedMinutes: Number(game.expectedDuration),
      surface: defaultSurface,
      time: game.time,
      title: competitionLabel,
      type: competitionLabel,
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
            <span>City or location</span>
            <input aria-autocomplete="list" aria-expanded={isCityMenuOpen && cityResults.length > 0} aria-invalid={!cityIsValid} autoComplete="off" value={cityQuery} onChange={(event) => { setCityQuery(event.target.value); setCitySearchError(''); setIsCityMenuOpen(true); setDraft((current) => ({ ...current, location: '' })) }} onFocus={() => setIsCityMenuOpen(true)} />
            {isCityMenuOpen && cityResults.length > 0 && <div className="city-suggestions" role="listbox">{cityResults.map((city) => <button key={city.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCityQuery(city.label); setCityResults([]); setCitySearchError(''); setIsCityMenuOpen(false); setDraft((current) => ({ ...current, location: city.label })) }} role="option" type="button">{city.label}</button>)}</div>}
            {isCitySearching && <small className="city-search-status" role="status">Finding locations...</small>}
            {!cityIsValid && <small className="city-validation">Choose a city from the suggestions.</small>}
            {citySearchError && cityQuery.trim() && <small className="city-validation">{citySearchError}</small>}
          </div>
        </div>
        <div className="tournament-games-header"><div><p className="eyebrow">Competition events</p><p>Add each {competitionLabel.toLowerCase()} so the app can track turnaround time, workload, and pain changes.</p></div><button className="secondary-button compact-action" onClick={addGame} type="button">Add {competitionLabel.toLowerCase()}</button></div>
        <div className="tournament-games-list">
          {games.map((game, index) => (
            <div className="tournament-game-fields" key={`${game.date}-${index}`}>
              <strong>{competitionLabel} {index + 1}</strong>
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
    if (event.allDay) {
      const end = format(addDays(parseISO(event.date), 1), 'yyyyMMdd')
      const description = [event.association, event.availability, event.note].filter(Boolean).join(' | ').replaceAll('\n', ' ')
      lines.push('BEGIN:VEVENT', `UID:${event.id}@athlete-reload`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${escapeIcs(getEventDisplayName(event))}`, `DESCRIPTION:${escapeIcs(description)}`, event.location ? `LOCATION:${escapeIcs(event.location)}` : '', 'END:VEVENT')
      continue
    }
    const time = getTimeParts(event.time)
    const hour = Number(time.hour) % 12 + (time.period === 'PM' ? 12 : 0)
    const start = `${date}T${String(hour).padStart(2, '0')}${time.minute}00`
    const duration = Math.max(15, Number(event.expectedDuration ?? event.plannedMinutes ?? 60))
    const endDate = new Date(`${event.date}T${String(hour).padStart(2, '0')}:${time.minute}:00`)
    endDate.setMinutes(endDate.getMinutes() + duration)
    const end = format(endDate, "yyyyMMdd'T'HHmmss")
    const description = [event.association, event.availability, event.note].filter(Boolean).join(' | ').replaceAll('\n', ' ')

    lines.push('BEGIN:VEVENT', `UID:${event.id}@athlete-reload`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeIcs(getEventDisplayName(event))}`, `DESCRIPTION:${escapeIcs(description)}`, event.location ? `LOCATION:${escapeIcs(event.location)}` : '', 'END:VEVENT')
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

function EventModal({ associations, athleteProfile, draftEvent, error, isOnboardingEventCreation, isSaving, mode, onClose, onDuplicate, onSave, onUpdate }) {
  const [cityQuery, setCityQuery] = useState(draftEvent.location ?? '')
  const [cityResults, setCityResults] = useState([])
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false)
  const [citySearchError, setCitySearchError] = useState('')
  const [isCitySearching, setIsCitySearching] = useState(false)
  const [positionOverride, setPositionOverride] = useState(() => Boolean(draftEvent.positionOrEvent && draftEvent.positionOrEvent !== athleteProfile?.position))

  useEffect(() => {
    document.body.classList.add('modal-open')

    return () => document.body.classList.remove('modal-open')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const query = cityQuery.trim()

    if (!query || query === draftEvent.location) {
      setCityResults([])
      setIsCitySearching(false)
      return () => controller.abort()
    }

    setIsCitySearching(true)
    async function runSearch() {
      try {
        const results = await searchLocations(query, { signal: controller.signal })
        setCityResults(results)
        setCitySearchError(results.length === 0 ? 'No matching locations found.' : '')
      } catch (error) {
        if (error.name === 'AbortError') return
        setCityResults([])
        setCitySearchError(error.message)
      } finally {
        if (!controller.signal.aborted) setIsCitySearching(false)
      }
    }
    void runSearch()

    return () => controller.abort()
  }, [cityQuery, draftEvent.location])

  const cityIsValid = !cityQuery.trim() || cityQuery === draftEvent.location
  const eventTypes = getSportEventTypes(athleteProfile?.sport)
  const surfaces = getSportSurfaces(athleteProfile?.sport)
  const workloadFields = getSportWorkloadFields(athleteProfile?.sport, {
    phase: 'event',
    position: athleteProfile?.position,
    eventType: draftEvent.type,
  })
  const isAllDay = isAllDayEvent(draftEvent)
  const isRestDay = isRestDayEvent(draftEvent)
  const isOtherActivity = isOtherActivityEvent(draftEvent)
  const formSchema = getEventFormSchema(draftEvent, athleteProfile)
  const activitySurfaces = ['Trail', 'Road', 'Grass', 'Court', 'Water', 'Indoor', 'Outdoor', 'Other']
  const visibleSurfaces = isOtherActivity ? activitySurfaces : surfaces

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
          <div className="event-type-lead">
            <Select
              label="Event type"
              value={draftEvent.type}
              options={eventTypes.includes(draftEvent.type) ? eventTypes : [draftEvent.type, ...eventTypes]}
              onChange={(value) => onUpdate('type', value)}
            />
            <p>The questions below adapt to this event, so you only enter details that matter.</p>
          </div>
          <label className="compact-field">
            Date
            <input
              type="date"
              value={draftEvent.date}
              onChange={(event) => onUpdate('date', event.target.value)}
            />
          </label>
          {isOtherActivity && (
            <label className="compact-field">
              Activity name
              <input required value={draftEvent.customActivityName ?? ''} onChange={(event) => onUpdate('customActivityName', event.target.value)} placeholder="Hike, bike ride, pickup game..." />
            </label>
          )}
          {formSchema.showSubtype && <Select label="Event subtype" value={draftEvent.eventSubtype ?? ''} options={draftEvent.eventSubtype && !formSchema.subtypeOptions.includes(draftEvent.eventSubtype) ? [draftEvent.eventSubtype, ...formSchema.subtypeOptions] : ['', ...formSchema.subtypeOptions]} onChange={(value) => onUpdate('eventSubtype', value)} />}
          {formSchema.showPosition && (!positionOverride && formSchema.profilePosition ? <div className="profile-derived-field"><span>Position</span><strong>{formSchema.profilePosition}</strong><button onClick={() => setPositionOverride(true)} type="button">Change for this event</button></div> : <label className="compact-field">Position or event<input value={draftEvent.positionOrEvent ?? formSchema.profilePosition} onChange={(event) => onUpdate('positionOrEvent', event.target.value)} placeholder="Optional event-specific role" /></label>)}
          {!isAllDay && <TimePicker value={draftEvent.time} onChange={(value) => onUpdate('time', value)} />}
          {!isAllDay && (
            <label className="compact-field">
              Expected duration (minutes)
              <input min="15" step="15" type="number" value={draftEvent.expectedDuration ?? 60} onChange={(event) => onUpdate('expectedDuration', event.target.value)} />
            </label>
          )}
          <label className="compact-field">
            Association
            <select
              value={draftEvent.association ?? 'Personal'}
              onChange={(event) => onUpdate('association', event.target.value)}
            >
              {isOtherActivity && <option value="None">None</option>}
              <option value="Personal">Personal</option>
              {associations.map((association) => (
                <option key={association.id} value={association.name}>
                  {association.name}
                </option>
              ))}
            </select>
          </label>
          {!isAllDay && <Select label="Event importance" value={draftEvent.importance ?? importanceFromAvailability(draftEvent.availability)} options={['normal', 'important', 'priority']} onChange={(value) => onUpdate('importance', value)} />}
          {!isAllDay && formSchema.kind !== 'competition' && <Select label="Expected intensity" value={draftEvent.expectedIntensity ?? intensityFromLoad(draftEvent.load)} options={['low', 'moderate', 'high', 'maximal']} onChange={(value) => { onUpdate('expectedIntensity', value); onUpdate('load', loadFromIntensity(value)) }} />}
          {formSchema.showOpponent && (
            <>
              {formSchema.showVenue && <label className="compact-field">
                Opponent
                <input value={draftEvent.opponent ?? ''} onChange={(event) => onUpdate('opponent', event.target.value)} placeholder="Optional opponent" />
              </label>}
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
          {formSchema.showSurface && <Select
            label={isOtherActivity ? 'Surface or environment' : formSchema.surfaceLabel}
            value={draftEvent.surface ?? visibleSurfaces[0]}
            options={visibleSurfaces.includes(draftEvent.surface) ? visibleSurfaces : [draftEvent.surface, ...visibleSurfaces].filter(Boolean)}
            onChange={(value) => onUpdate('surface', value)}
          />}
          {formSchema.showWorkload && !isOtherActivity && workloadFields.map((field) => (
            <SportWorkloadField
              field={field}
              key={field.key}
              unitSystem={athleteProfile?.unitSystem}
              value={draftEvent.sportWorkload?.[field.key] ?? ''}
              onChange={(value) => onUpdate('sportWorkload', { ...(draftEvent.sportWorkload ?? {}), [field.key]: value })}
            />
          ))}
          {!isAllDay && <div className="compact-field city-autocomplete">
            <span>City or location</span>
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
            {isCitySearching && <small className="city-search-status" role="status">Finding locations...</small>}
            {!cityIsValid && <small className="city-validation">Choose a city from the suggestions.</small>}
            {citySearchError && cityQuery.trim() && <small className="city-validation">{citySearchError}</small>}
          </div>}
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

        {isAllDay && <p className="field-description">{isRestDay ? 'Rest Day' : 'Recovery Day'} is all day and will not request an event check-in or checkout. It provides schedule context but does not confirm recovery status.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="event-modal-actions">
          {mode === 'edit' && <button className="secondary-button" disabled={isSaving} onClick={onDuplicate} type="button">Duplicate event</button>}
          <button className="primary-button" disabled={isSaving || (!isAllDay && (!cityIsValid || !draftEvent.time)) || (isOtherActivity && !draftEvent.customActivityName?.trim())} onClick={onSave} type="button">
            {isSaving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create event'}
          </button>
        </div>
      </section>
    </div>
  )
}

function SportWorkloadField({ field, onChange, unitSystem = 'imperial', value }) {
  const display = getWorkloadFieldDisplay(field, value, unitSystem)
  return (
    <label className="compact-field">
      {field.label}{display.label ? ` (${display.label})` : ''}
      {field.type === 'select' ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Not set</option>
          {field.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <input min="0" step={display.step} type="number" value={display.value} onChange={(event) => onChange(workloadInputToCanonical(field, event.target.value, unitSystem))} />
      )}
    </label>
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
  if (['Recovery', 'Recovery Day', 'Rest Day', 'Rest day'].includes(type)) return 'Low'

  return 'Medium'
}

function getEnvironmentForSurface(surface) {
  return /court|gym|indoor|simulator|platform|pool/i.test(surface) && !/outdoor|open water/i.test(surface) ? 'Indoor' : 'Outdoor'
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
      ...event,
      date: toIsoDate(nextDate),
      id: index === 0 ? event.id : `event-${Date.now()}-${index}`,
      recurrenceRule: event.repeat === 'Does not repeat' ? {} : {
        count,
        frequency: event.repeat.toLowerCase(),
        seriesId: event.recurrenceRule?.seriesId ?? event.id,
      },
      load: isOtherActivityEvent(event) ? event.load : getDefaultLoadForEvent(event.type),
      title: getEventDisplayName(event),
    }
  })
}

function getActivityKindForType(value) {
  const text = String(value ?? '').toLowerCase()
  if (/game|match|meet|race|competition|tournament|bout/.test(text)) return 'competition'
  if (/gym|strength|lift|weight/.test(text)) return 'strength'
  if (/conditioning|interval|tempo|hill/.test(text)) return 'conditioning'
  if (/rest|recovery|mobility|flexibility/.test(text)) return 'recovery'
  if (/practice|training|session|skill|team/.test(text)) return 'training'
  return 'other'
}

function intensityFromLoad(value) {
  if (String(value).toLowerCase() === 'high') return 'high'
  if (String(value).toLowerCase() === 'low') return 'low'
  return 'moderate'
}

function loadFromIntensity(value) {
  if (value === 'maximal' || value === 'high') return 'High'
  if (value === 'low') return 'Low'
  return 'Medium'
}

function importanceFromAvailability(value) {
  if (value === 'Required max effort') return 'priority'
  if (value === 'Required') return 'important'
  return 'normal'
}

function formatImportance(value) {
  if (value === 'priority') return 'Priority competition'
  return value === 'important' ? 'Important' : 'Normal'
}
