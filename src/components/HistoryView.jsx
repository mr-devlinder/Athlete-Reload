import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, startOfWeek, startOfYear } from 'date-fns'
import { RecommendationCard, RecoveryPlanCard } from './RecommendationCard'
import { SectionHeading } from './SectionHeading'
import { bodyPainAreas } from '../data/bodyPainMap'
import { formatHydration } from '../utils/units'

const clearOptions = [
  { label: 'Today', days: 0 },
  { label: '3 days', days: 2 },
  { label: '5 days', days: 4 },
  { label: '1 week', days: 6 },
  { label: '3 weeks', days: 20 },
  { label: '1 month', days: 30 },
  { label: '6 months', days: 182 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
  { label: 'All time', days: null },
]

export function HistoryView({ athleteProfile, checkouts = [], history, insights, onClear, onDeleteEntry, onFavoriteRoutine, recoveryCompletions = [], savedRoutines = [] }) {
  const hasSavedHistory = history.length > 0 || checkouts.length > 0 || recoveryCompletions.length > 0
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set([getCurrentWeekKey()]))
  const [expandedYears, setExpandedYears] = useState(() => new Set([getCurrentYearKey()]))
  const isModalOpen = Boolean(selectedEntry || isClearModalOpen || selectedWeek)
  const archive = getHistoryArchive(history, checkouts, recoveryCompletions)

  useEffect(() => {
    if (!isModalOpen) return undefined

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction

    document.body.classList.add('modal-open')
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
    }
  }, [isModalOpen])

  async function clearRange(option) {
    await onClear(getCutoffDate(option.days))
    setIsClearModalOpen(false)
  }

  function toggleWeek(weekKey) {
    setExpandedWeeks((current) => {
      const next = new Set(current)

      if (next.has(weekKey)) {
        next.delete(weekKey)
      } else {
        next.add(weekKey)
      }

      return next
    })
  }

  function toggleYear(yearKey) {
    setExpandedYears((current) => {
      const next = new Set(current)

      if (next.has(yearKey)) {
        next.delete(yearKey)
      } else {
        next.add(yearKey)
      }

      return next
    })
  }

  return (
    <div className="history-view" data-tour="history-page">
      <div className="schedule-header">
        <SectionHeading eyebrow="History" title="Patterns are the product." />
        <div className="history-actions">
          <button
            className="remove-button compact-action"
            disabled={!hasSavedHistory}
            onClick={() => setIsClearModalOpen(true)}
            type="button"
          >
            Clear saved history
          </button>
        </div>
      </div>

      <div className="trend-grid">
        {insights.map((insight) => (
          <article className="insight-card" key={insight}>
            {insight}
          </article>
        ))}
      </div>

      <div className="history-list">
        {archive.length === 0 ? (
          <article className="history-row empty-history">
            <p>No saved check-ins yet.</p>
          </article>
        ) : (
          archive.map((year) => (
            <section className="history-archive-group" key={year.key}>
              <button className="history-archive-toggle" onClick={() => toggleYear(year.key)} type="button">
                <span>{expandedYears.has(year.key) ? 'Hide' : 'Show'}</span>
                <strong>{year.label}</strong>
                <em>{year.itemCount} item{year.itemCount === 1 ? '' : 's'}</em>
              </button>

              {expandedYears.has(year.key) && (
                <div className="history-archive-content">
                  {year.weeks.map((week) => (
                    <section className="history-week" key={week.key}>
                      <div className="history-week-header">
                        <button className="history-week-toggle" onClick={() => toggleWeek(week.key)} type="button">
                          <span>{expandedWeeks.has(week.key) ? 'Hide' : 'Show'}</span>
                          <strong>Week of {week.label}</strong>
                          <em>{week.items.length} item{week.items.length === 1 ? '' : 's'}</em>
                        </button>
                        <button className="secondary-button compact-action" onClick={() => setSelectedWeek(week)} type="button">
                          Weekly report
                        </button>
                      </div>

                      {expandedWeeks.has(week.key) && (
                        <div className="history-week-items">
                          <HistoryGroup
                            checkouts={week.items.filter((item) => item.kind === 'checkout')}
                            checkIns={week.items.filter((item) => item.kind === 'check-in')}
                            recoveryCompletions={week.items.filter((item) => item.kind === 'recovery-completion')}
                            onDeleteEntry={onDeleteEntry}
                            onSelectEntry={setSelectedEntry}
                          />
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      {selectedEntry && createPortal(
        <HistoryModal
          entry={selectedEntry}
          unitSystem={athleteProfile?.unitSystem}
          onFavoriteRoutine={onFavoriteRoutine}
          onClose={() => setSelectedEntry(null)}
          savedRoutines={savedRoutines}
        />,
        document.body,
      )}

      {isClearModalOpen && createPortal(
        <ClearHistoryModal
          onClear={clearRange}
          onClose={() => setIsClearModalOpen(false)}
        />,
        document.body,
      )}

      {selectedWeek && createPortal(
        <WeeklyReportModal
          week={selectedWeek}
          onClose={() => setSelectedWeek(null)}
        />,
        document.body,
      )}
    </div>
  )
}

function HistoryGroup({ checkouts, checkIns, onDeleteEntry, onSelectEntry, recoveryCompletions }) {
  const completedRecoveryCheckoutIds = new Set(recoveryCompletions.map((item) => item.entry.sourceCheckoutId).filter(Boolean))
  const recoveryItems = checkouts.filter((item) => (
    item.entry.recommendation?.recoveryPlan && !completedRecoveryCheckoutIds.has(item.entry.id)
  ))
  const recoveryRecords = [
    ...recoveryCompletions.map((item) => ({ ...item, historyKind: 'recovery-completion' })),
    ...recoveryItems.map((item) => ({ ...item, historyKind: 'recovery' })),
  ].sort((first, second) => getHistoryItemSortValue(second) - getHistoryItemSortValue(first))

  return (
    <>
      <div className="history-subsection">
        <p className="eyebrow">Check-ins</p>
        {checkIns.length === 0 ? (
          <p>No check-ins this week.</p>
        ) : (
          checkIns.map((item) => (
            <HistoryRow
              className="history-row"
              entry={item.entry}
              key={`check-${item.entry.id ?? item.entry.date}-${item.entry.createdAt ?? item.entry.note}`}
              kind="check-in"
              onDeleteEntry={onDeleteEntry}
              onSelectEntry={onSelectEntry}
            >
              <div
                className={`score-ring history-score-ring ${getReadinessBand(item.entry.score)}`}
                style={{ '--score': `${item.entry.score}%` }}
              >
                <span>{item.entry.score}</span>
              </div>
              <div>
                <p className="eyebrow">{formatHistoryDate(item.entry)}</p>
                <strong>{item.entry.eventTitle ?? item.entry.session}</strong>
              </div>
            </HistoryRow>
          ))
        )}
      </div>

      <div className="history-subsection">
        <p className="eyebrow">Checkouts</p>
        {checkouts.length === 0 ? (
          <p>No checkouts this week.</p>
        ) : (
          checkouts.map((item) => (
            <HistoryRow
              className="history-row checkout-history-row"
              entry={item.entry}
              key={`checkout-${item.entry.id}`}
              kind="checkout"
              onDeleteEntry={onDeleteEntry}
              onSelectEntry={onSelectEntry}
            >
              <span className="history-record-kind">Checkout</span>
              <div>
                <p className="eyebrow">{formatCheckoutDate(item.entry)}</p>
                <strong>{item.entry.title}</strong>
                <small>{item.entry.actualMinutes} min · {item.entry.participation ?? item.entry.completionLevel}</small>
              </div>
            </HistoryRow>
          ))
        )}
      </div>

      <div className="history-subsection">
        <p className="eyebrow">Recovery</p>
        {recoveryRecords.length === 0 ? (
          <p>No saved recovery plans this week.</p>
        ) : (
          recoveryRecords.map((item) => {
            const isCompletion = item.historyKind === 'recovery-completion'
            const plan = isCompletion ? item.entry.details?.plan : item.entry.recommendation?.recoveryPlan
            const exerciseCount = plan?.routine?.exercises?.length ?? item.entry.details?.exerciseCount ?? 0
            const savedAt = isCompletion ? item.entry.completedAt : item.entry.createdAt

            return <HistoryRow className="history-row recovery-history-row" entry={item.entry} key={`${item.historyKind}-${item.entry.id}`} kind={item.historyKind} onDeleteEntry={onDeleteEntry} onSelectEntry={onSelectEntry}>
              <span className="history-record-kind recovery-record-kind">Saved</span>
              <div>
                <p className="eyebrow">{savedAt ? format(parseISO(savedAt), 'MMM d, yyyy · h:mm a') : formatCheckoutDate(item.entry)}</p>
                <strong>{plan?.routine?.title ?? 'Recovery routine'}</strong>
                <small>{plan?.routine?.durationMinutes ?? '—'} min routine · {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}</small>
              </div>
            </HistoryRow>
          })
        )}
      </div>
    </>
  )
}

function HistoryRow({ children, className, entry, kind, onDeleteEntry, onSelectEntry }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const detailEntry = kind === 'check-in' ? entry : { ...entry, historyKind: kind }

  function openDetails() {
    setIsMenuOpen(false)
    onSelectEntry(detailEntry)
  }

  function deleteEntry() {
    setIsMenuOpen(false)
    onDeleteEntry?.(entry, kind)
  }

  return (
    <article className={`${className} history-row-with-menu${isMenuOpen ? ' history-row-menu-open' : ''}`}>
      <button className="history-row-main" onClick={openDetails} type="button">
        {children}
      </button>
      <div className="history-quick-actions">
        <button
          aria-expanded={isMenuOpen}
          aria-label="History item actions"
          className="history-more-button"
          onClick={() => setIsMenuOpen((current) => !current)}
          type="button"
        >
          <span>...</span>
        </button>
        {isMenuOpen && (
          <div className="history-quick-menu">
            <button onClick={openDetails} type="button">View details</button>
            {onDeleteEntry && <button className="history-delete-action" onClick={deleteEntry} type="button">Delete</button>}
          </div>
        )}
      </div>
    </article>
  )
}

function WeeklyReportModal({ week, onClose }) {
  const checkIns = week.items.filter((item) => item.kind === 'check-in').map((item) => item.entry)
  const checkouts = week.items.filter((item) => item.kind === 'checkout').map((item) => item.entry)
  const averageReadiness = average(checkIns.map((entry) => entry.score))
  const averageSleep = average(checkIns.map((entry) => Number(entry.sleep)), 1)
  const averageFatigue = average(checkIns.map((entry) => entry.fatigue))
  const workload = checkouts.reduce((total, checkout) => total + checkout.actualMinutes * checkout.difficulty, 0)
  const painAreas = summarizePainAreas(checkIns)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow={`Week of ${week.label}`}
            title="Weekly athlete report."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="history-detail-grid">
          <span><strong>Readiness</strong>{averageReadiness}/100 average</span>
          <span><strong>Check-ins</strong>{checkIns.length}</span>
          <span><strong>Checkouts</strong>{checkouts.length}</span>
          <span><strong>Sleep</strong>{averageSleep}h average</span>
          <span><strong>Fatigue</strong>{averageFatigue}/5 average</span>
          <span><strong>Workload</strong>{workload || 'No checkouts'}</span>
          <span><strong>Availability</strong>{averageReadiness >= 80 ? 'Mostly available' : averageReadiness >= 60 ? 'Modified training likely' : 'Recovery focus'}</span>
          <span><strong>Pain pattern</strong>{painAreas || 'No recurring pain areas'}</span>
        </div>
      </section>
    </div>
  )
}

function ClearHistoryModal({ onClear, onClose }) {
  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow="Clear history"
            title="Choose a time range."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="clear-range-grid">
          {clearOptions.map((option) => (
            <button
              className="remove-button compact-action"
              key={option.label}
              onClick={() => onClear(option)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function HistoryModal({ entry, onClose, onFavoriteRoutine, savedRoutines, unitSystem }) {
  if (entry.historyKind === 'checkout') {
    return <CheckoutHistoryModal entry={entry} onClose={onClose} />
  }

  if (entry.historyKind === 'recovery') {
    return <RecoveryHistoryModal entry={entry} onClose={onClose} onFavoriteRoutine={onFavoriteRoutine} savedRoutines={savedRoutines} />
  }

  if (entry.historyKind === 'recovery-completion') {
    return <RecoveryCompletionHistoryModal entry={entry} onClose={onClose} onFavoriteRoutine={onFavoriteRoutine} savedRoutines={savedRoutines} />
  }

  const detailSections = getCheckInDetailSections(entry, unitSystem)
  const painSections = getPainDetailSections(entry)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow={formatHistoryDate(entry)}
            title="Check-in details."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {entry.recommendation ? (
          <RecommendationCard
            recommendation={entry.recommendation}
            recommendationStatus="ai"
            session={entry.eventTitle ?? entry.session}
          />
        ) : (
          <div className="history-readiness-summary">
            <div
              className={`score-ring ${getReadinessBand(entry.score)}`}
              style={{ '--score': `${entry.score}%` }}
            >
              <span>{entry.score}</span>
            </div>
            <div>
              <strong>{entry.eventTitle ?? entry.session}</strong>
              <p>Saved check-in.</p>
            </div>
          </div>
        )}

        <div className="history-detail-sections">
          {detailSections.map((section) => (
            <section className="history-detail-section" key={section.title}>
              <h3>{section.title}</h3>
              <div className="history-detail-grid">
                {section.items.map(([label, value]) => (
                  <span key={label}>
                    <strong>{label}</strong>
                    {value ?? 'Not saved'}
                  </span>
                ))}
              </div>
            </section>
          ))}

          {painSections.length > 0 && (
            <section className="history-detail-section">
              <h3>Pain</h3>
              <div className="history-pain-stack">
                {painSections.map((section) => (
                  <article className="history-pain-card" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="history-detail-grid">
                      {section.items.map(([label, value]) => (
                        <span key={label}>
                          <strong>{label}</strong>
                          {value ?? 'Not saved'}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        {entry.note && (
          <div className="history-note">
            <strong>Notes</strong>
            <p>{entry.note}</p>
          </div>
        )}
      </section>
    </div>
  )
}

function CheckoutHistoryModal({ entry, onClose }) {
  const detailSections = getCheckoutDetailSections(entry)
  const painSections = getPainDetailSections(entry)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow={formatCheckoutDate(entry)}
            title="Checkout details."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {entry.recommendation && (
          <RecoveryPlanCard
            recommendation={entry.recommendation}
            recommendationStatus="ai"
            session={entry.title}
          />
        )}

        <div className="history-detail-sections">
          {detailSections.map((section) => (
            <section className="history-detail-section" key={section.title}>
              <h3>{section.title}</h3>
              <div className="history-detail-grid">
                {section.items.map(([label, value]) => (
                  <span key={label}>
                    <strong>{label}</strong>
                    {value}
                  </span>
                ))}
              </div>
            </section>
          ))}

          {painSections.length > 0 && (
            <section className="history-detail-section">
              <h3>Post-event pain map</h3>
              <div className="history-pain-stack">
                {painSections.map((section) => (
                  <article className="history-pain-card" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="history-detail-grid">
                      {section.items.map(([label, value]) => (
                        <span key={label}>
                          <strong>{label}</strong>
                          {value}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}

function getReadinessBand(score) {
  if (Number(score) >= 75) return 'readiness-green'
  if (Number(score) >= 50) return 'readiness-yellow'
  return 'readiness-red'
}

function RecoveryCompletionHistoryModal({ entry, onClose, onFavoriteRoutine, savedRoutines }) {
  const plan = entry.details?.plan
  const savedRoutine = findSavedRecoveryRoutine(savedRoutines, plan, entry.sourceCheckoutId)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal recovery-history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading eyebrow="Recovery history" title={plan?.routine?.title ?? 'Recovery routine'} />
          <button className="ghost-close" onClick={onClose} type="button">Close</button>
        </div>
        <div className="history-detail-grid recovery-history-summary">
          <span><strong>Saved</strong>{format(parseISO(entry.completedAt), 'MMM d, yyyy · h:mm a')}</span>
          <span><strong>Routine type</strong>{formatRecoveryPlanType(plan?.planType)}</span>
          <span><strong>Routine length</strong>{plan?.routine?.durationMinutes ?? '—'} min</span>
          <span><strong>Exercises</strong>{plan?.routine?.exercises?.length ?? entry.details?.exerciseCount ?? '—'}</span>
          <span><strong>Body areas</strong>{getRecoveryRoutineAreas(plan?.routine)}</span>
          <span><strong>Equipment</strong>{getRecoveryRoutineEquipment(plan?.routine)}</span>
        </div>
        {plan ? <SavedRecoveryPlan plan={plan} /> : <p>No saved recovery plan details are available.</p>}
        {plan?.routine && (
          <button className={`secondary-button recovery-modal-favorite ${savedRoutine?.isFavorite ? 'favorite-active' : ''}`} onClick={() => onFavoriteRoutine?.(entry)} type="button">
            {savedRoutine?.isFavorite ? 'Favorited routine' : 'Favorite routine'}
          </button>
        )}
      </section>
    </div>
  )
}

function RecoveryHistoryModal({ entry, onClose, onFavoriteRoutine, savedRoutines }) {
  const plan = entry.recommendation?.recoveryPlan
  const savedRoutine = findSavedRecoveryRoutine(savedRoutines, plan, entry.id)

  return (
    <div className="modal-backdrop history-modal-backdrop" onClick={onClose}>
      <section
        className="event-modal history-modal recovery-history-modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="schedule-header">
          <SectionHeading
            eyebrow={formatCheckoutDate(entry)}
            title="Recovery details."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {plan?.routine && (
          <div className="history-detail-grid recovery-history-summary">
            <span><strong>Routine type</strong>{formatRecoveryPlanType(plan.planType)}</span>
            <span><strong>Routine length</strong>{plan.routine.durationMinutes ?? '—'} min</span>
            <span><strong>Exercises</strong>{plan.routine.exercises?.length ?? '—'}</span>
            <span><strong>Body areas</strong>{getRecoveryRoutineAreas(plan.routine)}</span>
            <span><strong>Equipment</strong>{getRecoveryRoutineEquipment(plan.routine)}</span>
          </div>
        )}
        {plan ? <SavedRecoveryPlan plan={plan} /> : <p>No saved recovery plan for this session.</p>}
        {plan?.routine && (
          <button className={`secondary-button recovery-modal-favorite ${savedRoutine?.isFavorite ? 'favorite-active' : ''}`} onClick={() => onFavoriteRoutine?.(entry)} type="button">
            {savedRoutine?.isFavorite ? 'Favorited routine' : 'Favorite routine'}
          </button>
        )}
      </section>
    </div>
  )
}

function SavedRecoveryPlan({ plan }) {
  const routine = plan.routine

  return (
    <section className="history-detail-section saved-recovery-plan">
      <p className="eyebrow">Generated recovery routine</p>
      <h3>{routine?.title ?? 'Recovery routine'}</h3>
      {routine?.goal && <p className="saved-recovery-goal"><strong>Goal</strong>{routine.goal}</p>}
      {routine?.summary && <p className="saved-recovery-summary">{routine.summary}</p>}

      {routine?.exercises?.length > 0 && (
        <div className="saved-recovery-routine">
          <strong>{routine.durationMinutes ?? 10}-minute routine</strong>
          <ol>
            {routine.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`}>
                <details className="saved-recovery-exercise">
                  <summary>
                    <b>{exercise.name}</b>
                  </summary>
                  <div className="saved-recovery-exercise-plan">
                    <div className="saved-recovery-exercise-meta">
                      <span>{exercise.type ?? 'Mobility'}</span>
                      <em>{exercise.side ?? 'Both sides'}{exercise.durationSeconds ? ` · ${exercise.durationSeconds}s` : exercise.reps ? ` · ${exercise.reps} reps` : ''}</em>
                    </div>
                    {exercise.instruction && <p>{exercise.instruction}</p>}
                    {exercise.feel && <small><strong>You should feel:</strong> {exercise.feel}</small>}
                    {exercise.avoid && <small><strong>Avoid:</strong> {exercise.avoid}</small>}
                    {exercise.why && <small><strong>Why it is included:</strong> {exercise.why}</small>}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function formatRecoveryPlanType(value) {
  if (!value) return 'Recovery routine'
  return String(value).split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
}

function getRecoveryRoutineAreas(routine) {
  const areas = [...new Set(routine?.exercises?.map((exercise) => exercise.area).filter(Boolean) ?? [])]
  return areas.join(', ') || 'Full body'
}

function getRecoveryRoutineEquipment(routine) {
  const equipment = [...new Set(routine?.exercises?.map((exercise) => exercise.equipment).filter((item) => item && item.toLowerCase() !== 'none') ?? [])]
  return equipment.join(', ') || 'None'
}

function findSavedRecoveryRoutine(savedRoutines, plan, sourceCheckoutId) {
  if (sourceCheckoutId) return savedRoutines.find((routine) => routine.sourceCheckoutId === sourceCheckoutId)
  const signature = getRecoveryRoutineSignature(plan)
  return savedRoutines.find((routine) => getRecoveryRoutineSignature(routine.routine) === signature)
}

function getRecoveryRoutineSignature(plan) {
  const routine = plan?.routine ?? plan
  const exercises = routine?.exercises?.map((exercise) => `${exercise.name}|${exercise.side ?? ''}|${exercise.durationSeconds ?? exercise.reps ?? ''}`) ?? []
  return `${routine?.title ?? ''}::${exercises.join('::')}`
}

function formatHistoryDate(entry) {
  if (!entry.date) return entry.day

  return new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })
}

function formatCheckoutDate(entry) {
  return new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })
}

function valueWithUnit(value, unit) {
  if (value === undefined || value === null) return undefined
  return `${value}${unit}`
}

function getCheckInDetailSections(entry, unitSystem = 'imperial') {
  return [
    {
      title: 'Event',
      items: presentItems([
        ['Event', entry.eventTitle ?? entry.session],
        ['Date', formatHistoryDate(entry)],
        ['Expected difficulty', valueWithUnit(entry.expectedDifficulty, '/10')],
      ]),
    },
    {
      title: 'Readiness inputs',
      items: presentItems([
        ['Energy', valueWithUnit(entry.energy, '/5')],
        ['Muscle soreness', valueWithUnit(entry.soreness, '/5')],
        ['General fatigue', valueWithUnit(entry.fatigue, '/5')],
        ['Leg heaviness', valueWithUnit(entry.legHeaviness, '/5')],
        ['Illness symptoms', formatIllness(entry.illnessSymptoms)],
      ]),
    },
    {
      title: 'Recovery context',
      items: presentItems([
        ['Sleep', valueWithUnit(entry.sleep, 'h')],
        ['Sleep quality', valueWithUnit(entry.sleepQuality, '/5')],
        ['Stress', valueWithUnit(entry.stress, '/5')],
        ['Today\'s hydration', entry.hydrationMl === undefined ? undefined : formatHydration(entry.hydrationMl, unitSystem)],
        ['Recovery actions', entry.recoveryActions?.length ? entry.recoveryActions.join(', ') : undefined],
      ]),
    },
  ].filter((section) => section.items.length > 0)
}

function getCheckoutDetailSections(entry) {
  const sessionLoad = entry.sessionLoad ?? Number(entry.actualMinutes ?? 0) * Number(entry.difficulty ?? 0)

  return [
    {
      title: 'Session completed',
      items: presentItems([
        ['Event', entry.title],
        ['Date', formatCheckoutDate(entry)],
        ['Participation', entry.participation ?? entry.completionLevel],
        ['Actual duration', valueWithUnit(entry.actualMinutes, ' min')],
        ['Session effort', valueWithUnit(entry.difficulty, '/10')],
        ['Session load', `${sessionLoad} units`],
        ['Session content', entry.sessionContent?.length ? entry.sessionContent.join(', ') : undefined],
      ]),
    },
    {
      title: 'Physical response',
      items: presentItems([
        ['Fatigue after event', valueWithUnit(entry.postFatigue, '/5')],
        ['Soreness after event', valueWithUnit(entry.postSoreness, '/5')],
        ['Existing pain', entry.painChange],
        ['New pain or discomfort', yesNo(entry.newPain)],
        ['Cramping', yesNo(entry.cramping)],
        ['Symptoms', entry.heatSymptoms?.length ? entry.heatSymptoms.join(', ') : undefined],
        ['Movement or performance changed', yesNo(entry.movementChanged)],
      ]),
    },
    {
      title: 'Performance and focus',
      items: presentItems([
        ['Performance compared with normal', entry.performanceRating],
        ['Mental focus', valueWithUnit(entry.mentalFocus, '/5')],
        ['Motivation', valueWithUnit(entry.motivation, '/5')],
        ['Fatigue affected decisions or technique', yesNo(entry.fatigueAffectedTechnique)],
      ]),
    },
  ].filter((section) => section.items.length > 0)
}

function getPainDetailSections(entry) {
  const painMapSections = bodyPainAreas
    .map((area) => {
      const severity = Number(entry.painMap?.[area.id] ?? 0)
      if (severity <= 0) return null

      return {
        title: area.label,
        items: getPainItems(entry, severity, area.id),
      }
    })
    .filter(Boolean)

  if (painMapSections.length > 0) {
    return painMapSections
  }

  if (Number(entry.pain ?? 0) <= 0) {
    return []
  }

  return [
    {
      title: entry.location ?? 'Pain area',
      items: getPainItems(entry, entry.pain),
    },
  ]
}

function getPainItems(entry, score, areaId) {
  const details = areaId ? entry.painDetails?.[areaId] ?? {} : {}

  return presentItems([
    ['Pain level', valueWithUnit(score, '/10')],
    ['Injury type', details.injuryType ?? entry.injuryType],
    ['Pain type', details.painType ?? entry.painType],
    ['When it occurs', details.hurtsWhen ?? entry.hurtsWhen],
    ['Change since last session', details.painTrend ?? entry.painTrend],
    ['Affected movement', details.affectedMovement ?? entry.affectedMovement],
  ])
}

function presentItems(items) {
  return items.filter(([, value]) => value !== undefined && value !== null && value !== '')
}

function yesNo(value) {
  if (value === undefined || value === null) return undefined

  return value ? 'Yes' : 'No'
}

function formatIllness(value) {
  if (value === undefined || value === null) return undefined
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  if (numeric === 0) return '0/5 - None'
  if (numeric <= 2) return `${numeric}/5 - Mild`
  return `${numeric}/5 - Unwell`
}

function getCutoffDate(days) {
  if (days === null) return null

  const date = new Date()
  date.setDate(date.getDate() - days)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getHistoryArchive(history, checkouts, recoveryCompletions = []) {
  const years = new Map()
  const items = [
    ...history.map((entry) => ({ date: entry.date, entry, kind: 'check-in' })),
    ...checkouts.map((entry) => ({ date: entry.date, entry, kind: 'checkout' })),
    ...recoveryCompletions.map((entry) => ({ date: entry.completedAt?.slice(0, 10), entry, kind: 'recovery-completion' })),
  ].filter((item) => item.date)

  items.forEach((item) => {
    const itemDate = parseISO(item.date)
    const yearStart = startOfYear(itemDate)
    const weekStart = startOfWeek(itemDate)
    const yearKey = format(yearStart, 'yyyy')
    const weekKey = format(weekStart, 'yyyy-MM-dd')
    const year = years.get(yearKey) ?? {
      itemCount: 0,
      key: yearKey,
      label: format(yearStart, 'yyyy'),
      weeks: new Map(),
    }
    const week = year.weeks.get(weekKey) ?? {
      items: [],
      key: weekKey,
      label: format(weekStart, 'MMM d'),
    }

    week.items.push(item)
    year.weeks.set(weekKey, week)
    year.itemCount += 1
    years.set(yearKey, year)
  })

  return [...years.values()]
    .map((year) => ({
      ...year,
      weeks: [...year.weeks.values()]
        .map((week) => ({
          ...week,
          items: week.items.sort((first, second) => getHistoryItemSortValue(second) - getHistoryItemSortValue(first)),
        }))
        .sort((first, second) => second.key.localeCompare(first.key)),
    }))
    .sort((first, second) => second.key.localeCompare(first.key))
}

function getHistoryItemSortValue(item) {
  const exactTime = item.entry.completedAt ?? item.entry.createdAt
  if (exactTime) return new Date(exactTime).getTime()

  const time = item.entry.eventTime ?? item.entry.time ?? '12:00'
  return new Date(`${item.date}T${time}`).getTime()
}

function getCurrentWeekKey() {
  return format(startOfWeek(new Date()), 'yyyy-MM-dd')
}

function getCurrentYearKey() {
  return format(startOfYear(new Date()), 'yyyy')
}

function average(values, digits = 0) {
  const validValues = values.filter((value) => Number.isFinite(value))

  if (validValues.length === 0) return 0

  const result = validValues.reduce((total, value) => total + value, 0) / validValues.length

  return digits > 0 ? result.toFixed(digits) : Math.round(result)
}

function summarizePainAreas(checkIns) {
  const counts = new Map()

  checkIns.forEach((entry) => {
    if (entry.pain <= 0) return

    counts.set(entry.location, (counts.get(entry.location) ?? 0) + 1)
  })

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([area, count]) => `${area} (${count})`)
    .join(', ')
}
