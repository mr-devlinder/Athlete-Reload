import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { RecommendationCard, RecoveryPlanCard } from './RecommendationCard'
import { SectionHeading } from './SectionHeading'
import { bodyPainAreas } from '../data/bodyPainMap'

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

export function HistoryView({ checkouts = [], history, insights, onClear, onDeleteEntry, onFavoriteRoutine, savedRoutines = [] }) {
  const hasSavedHistory = history.length > 0 || checkouts.length > 0
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set([getCurrentWeekKey()]))
  const [expandedMonths, setExpandedMonths] = useState(() => new Set([getCurrentMonthKey()]))
  const [expandedYears, setExpandedYears] = useState(() => new Set([getCurrentYearKey()]))
  const isModalOpen = Boolean(selectedEntry || isClearModalOpen || selectedWeek)
  const archive = getHistoryArchive(history, checkouts)

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

  function toggleMonth(monthKey) {
    setExpandedMonths((current) => {
      const next = new Set(current)

      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
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
                  {year.months.map((month) => (
                    <section className="history-archive-group history-month-group" key={month.key}>
                      <button className="history-archive-toggle month-toggle" onClick={() => toggleMonth(month.key)} type="button">
                        <span>{expandedMonths.has(month.key) ? 'Hide' : 'Show'}</span>
                        <strong>{month.label}</strong>
                        <em>{month.itemCount} item{month.itemCount === 1 ? '' : 's'}</em>
                      </button>

                      {expandedMonths.has(month.key) && (
                        <div className="history-archive-content">
                          {month.weeks.map((week) => (
                            <section className="history-week" key={week.key}>
                              <div className="history-week-header">
                                <button className="history-week-toggle" onClick={() => toggleWeek(week.key)} type="button">
                                  <span>{expandedWeeks.has(week.key) ? 'Hide' : 'Show'}</span>
                                  <strong>Week of {week.label}</strong>
                                  <em>{week.items.length} item{week.items.length === 1 ? '' : 's'}</em>
                                </button>
                                <button
                                  className="secondary-button compact-action"
                                  onClick={() => setSelectedWeek(week)}
                                  type="button"
                                >
                                  Weekly report
                                </button>
                              </div>

                              {expandedWeeks.has(week.key) && (
                                <div className="history-week-items">
                                  <HistoryGroup
                                    checkouts={week.items.filter((item) => item.kind === 'checkout')}
                                    checkIns={week.items.filter((item) => item.kind === 'check-in')}
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

function HistoryGroup({ checkouts, checkIns, onDeleteEntry, onSelectEntry }) {
  const recoveryItems = checkouts.filter((item) => item.entry.recommendation?.recoveryPlan)

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
        {recoveryItems.length === 0 ? (
          <p>No saved recovery plans this week.</p>
        ) : (
          recoveryItems.map((item) => (
            (() => {
              const progress = getRecoveryProgress(item.entry.recommendation.recoveryPlan)

              return (
            <HistoryRow
              className="history-row recovery-history-row"
              entry={item.entry}
              key={`recovery-${item.entry.id}`}
              kind="recovery"
              onDeleteEntry={onDeleteEntry}
              onSelectEntry={onSelectEntry}
            >
              <span className="history-record-kind recovery-record-kind">Recovery</span>
              <div>
                <p className="eyebrow">{formatCheckoutDate(item.entry)}</p>
                <strong>{item.entry.recommendation.recoveryPlan.routine?.title ?? 'Recovery plan'}</strong>
                <small>{item.entry.recommendation.recoveryPlan.routine?.durationMinutes ?? 10} min routine · {progress.label}</small>
                <div aria-label={`Recovery plan ${progress.percent}% complete`} className="history-recovery-progress">
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            </HistoryRow>
              )
            })()
          ))
        )}
      </div>
    </>
  )
}

function getRecoveryProgress(plan) {
  const routineProgress = plan?.routineProgress
  if (Number.isFinite(Number(routineProgress?.total)) && Number(routineProgress.total) > 0) {
    const percent = Math.round((Number(routineProgress.completed ?? 0) / Number(routineProgress.total)) * 100)
    return { label: percent === 100 ? 'Routine complete' : `${percent}% routine complete`, percent }
  }

  const steps = plan?.recoverySteps ?? []
  const statuses = plan?.stepStatuses ?? {}

  if (steps.length === 0) return { label: 'Not started', percent: 0 }

  const complete = steps.filter((step, index) => statuses[step.id ?? `recovery-step-${index}`] === 'complete').length
  const percent = Math.round((complete / steps.length) * 100)

  return { label: percent === 100 ? 'Complete' : `${percent}% complete`, percent }
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
    <article className={`${className} history-row-with-menu`}>
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
            <button className="history-delete-action" onClick={deleteEntry} type="button">Delete</button>
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

function HistoryModal({ entry, onClose, onFavoriteRoutine, savedRoutines }) {
  if (entry.historyKind === 'checkout') {
    return <CheckoutHistoryModal entry={entry} onClose={onClose} />
  }

  if (entry.historyKind === 'recovery') {
    return <RecoveryHistoryModal entry={entry} onClose={onClose} onFavoriteRoutine={onFavoriteRoutine} savedRoutines={savedRoutines} />
  }

  const detailSections = getCheckInDetailSections(entry)
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

function RecoveryHistoryModal({ entry, onClose, onFavoriteRoutine, savedRoutines }) {
  const plan = entry.recommendation?.recoveryPlan
  const savedRoutine = savedRoutines.find((routine) => routine.sourceCheckoutId === entry.id)

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
            title="Recovery details."
          />
          <button className="ghost-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {plan?.routine && (
          <button className={`secondary-button compact-action ${savedRoutine?.isFavorite ? 'favorite-active' : ''}`} onClick={() => onFavoriteRoutine?.(entry)} type="button">
            {savedRoutine?.isFavorite ? 'Favorited routine' : 'Favorite routine'}
          </button>
        )}
        {plan ? <SavedRecoveryPlan plan={plan} /> : <p>No saved recovery plan for this session.</p>}
      </section>
    </div>
  )
}

function SavedRecoveryPlan({ plan }) {
  const steps = plan.recoverySteps ?? []
  const statuses = plan.stepStatuses ?? {}
  const feedback = plan.feedback

  return (
    <section className="history-detail-section saved-recovery-plan">
      <p className="eyebrow">Saved recovery plan</p>
      <h3>{plan.routine?.title ?? plan.label ?? 'Recovery routine'}</h3>
      {plan.summary && <p className="saved-recovery-summary">{plan.summary}</p>}

      {plan.timeline?.length > 0 && (
        <div className="saved-recovery-timeline">
          {plan.timeline.map((phase) => (
            <article key={phase.title}>
              <strong>{phase.title}</strong>
              <ul>{phase.items?.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <div className="saved-recovery-actions">
          <strong>Recovery actions</strong>
          {steps.map((step, index) => {
            const stepId = step.id ?? `recovery-step-${index}`
            return (
              <span key={stepId}>
                <em>{statuses[stepId] ?? 'Not marked'}</em>
                {step.title}
              </span>
            )
          })}
        </div>
      )}

      {plan.routine?.exercises?.length > 0 && (
        <div className="saved-recovery-routine">
          <strong>{plan.routine.durationMinutes ?? 10}-minute routine</strong>
          <ol>
            {plan.routine.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`}>
                <span>{exercise.type ?? 'Mobility'}</span>
                <b>{exercise.name}</b>
                <em>{exercise.side ?? 'Both sides'}{exercise.durationSeconds ? ` · ${exercise.durationSeconds}s` : exercise.reps ? ` · ${exercise.reps} reps` : ''}</em>
              </li>
            ))}
          </ol>
        </div>
      )}

      {feedback && (
        <div className="saved-recovery-feedback">
          <strong>Recovery feedback</strong>
          <div className="history-detail-grid">
            <span><strong>Routine</strong>{feedback.completion || 'Not saved'}</span>
            <span><strong>Feeling after</strong>{feedback.feeling || 'Not saved'}</span>
            <span><strong>Tightness</strong>{feedback.tightness || 'Not saved'}</span>
            <span><strong>Pain</strong>{feedback.pain || 'Not saved'}</span>
          </div>
        </div>
      )}
    </section>
  )
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

function getCheckInDetailSections(entry) {
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
        ['Illness symptoms', entry.illnessSymptoms],
      ]),
    },
    {
      title: 'Recovery context',
      items: presentItems([
        ['Sleep', valueWithUnit(entry.sleep, 'h')],
        ['Sleep quality', valueWithUnit(entry.sleepQuality, '/5')],
        ['Stress', entry.stress],
        ['Today\'s hydration', entry.hydrationOz === undefined ? undefined : `${entry.hydrationOz} fl oz`],
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
        items: getPainItems(entry, Math.round(severity / 10), area.id),
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

function getHistoryArchive(history, checkouts) {
  const years = new Map()
  const items = [
    ...history.map((entry) => ({ date: entry.date, entry, kind: 'check-in' })),
    ...checkouts.map((entry) => ({ date: entry.date, entry, kind: 'checkout' })),
  ].filter((item) => item.date)

  items.forEach((item) => {
    const itemDate = parseISO(item.date)
    const yearStart = startOfYear(itemDate)
    const monthStart = startOfMonth(itemDate)
    const weekStart = startOfWeek(itemDate)
    const yearKey = format(yearStart, 'yyyy')
    const monthKey = format(monthStart, 'yyyy-MM')
    const weekKey = format(weekStart, 'yyyy-MM-dd')
    const year = years.get(yearKey) ?? {
      itemCount: 0,
      key: yearKey,
      label: format(yearStart, 'yyyy'),
      months: new Map(),
    }
    const month = year.months.get(monthKey) ?? {
      itemCount: 0,
      key: monthKey,
      label: format(monthStart, 'MMMM yyyy'),
      weeks: new Map(),
    }
    const week = month.weeks.get(weekKey) ?? {
      items: [],
      key: weekKey,
      label: format(weekStart, 'MMM d'),
    }

    week.items.push(item)
    month.weeks.set(weekKey, week)
    month.itemCount += 1
    year.months.set(monthKey, month)
    year.itemCount += 1
    years.set(yearKey, year)
  })

  return [...years.values()]
    .map((year) => ({
      ...year,
      months: [...year.months.values()]
        .map((month) => ({
          ...month,
          weeks: [...month.weeks.values()]
            .map((week) => ({
              ...week,
              items: week.items.sort((first, second) => getHistoryItemSortValue(second).localeCompare(getHistoryItemSortValue(first))),
            }))
            .sort((first, second) => second.key.localeCompare(first.key)),
        }))
        .sort((first, second) => second.key.localeCompare(first.key)),
    }))
    .sort((first, second) => second.key.localeCompare(first.key))
}

function getHistoryItemSortValue(item) {
  const time = item.entry.eventTime ?? item.entry.time ?? ''

  return `${item.date} ${time}`
}

function getCurrentWeekKey() {
  return format(startOfWeek(new Date()), 'yyyy-MM-dd')
}

function getCurrentMonthKey() {
  return format(startOfMonth(new Date()), 'yyyy-MM')
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
