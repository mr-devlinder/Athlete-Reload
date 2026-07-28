import { format, parseISO, subDays } from 'date-fns'
import { getCheckoutForEvent, hasEventStarted, parseEventDateTime } from '../utils/events'
import { SectionHeading } from './SectionHeading'

export function HomeView({
  checkouts,
  history,
  isCheckInSavedToday,
  recommendation,
  schedule,
  onGoCheckIn,
  onOpenCheckout,
}) {
  const recentHistory = getLastSevenDays(history)
  const averages = getAverages(recentHistory)
  const dueCheckout = schedule.find(
    (event) => hasEventStarted(event) && !getCheckoutForEvent(checkouts, event.id),
  )
  const now = new Date()
  const upcomingEvent = schedule
    .filter((event) => {
      const eventDate = parseEventDateTime(event)

      return eventDate && eventDate > now
    })
    .sort((first, second) => parseEventDateTime(first) - parseEventDateTime(second))[0]
  const checkInReminder = !isCheckInSavedToday && getCheckInReminder(schedule, now)
  const patterns = getPatterns(history, checkouts)

  return (
    <div className="home-view">
      <section className="home-hero">
        <SectionHeading
          eyebrow="Athlete Reload"
          title="Your training day, at a glance."
        />
        <p>
          Readiness, recovery, and workload in one place before you decide how hard
          to push today.
        </p>
      </section>

      {dueCheckout && (
        <button
          className="checkout-alert"
          onClick={() => onOpenCheckout(dueCheckout)}
          type="button"
        >
          <span>Post-training checkout ready</span>
          <strong>{dueCheckout.title || dueCheckout.type}</strong>
          <em>Log what actually happened</em>
        </button>
      )}

      {checkInReminder && (
        <button
          className="checkout-alert checkin-alert"
          onClick={onGoCheckIn}
          type="button"
        >
          <span>Check-in reminder</span>
          <strong>{checkInReminder.title || checkInReminder.type}</strong>
          <em>Do readiness check</em>
        </button>
      )}

      <section className="stat-grid">
        <StatCard label="7-day readiness" value={`${averages.readiness}`} detail="Average score" />
        <StatCard label="Average sleep" value={`${averages.sleep}h`} detail="Last 7 days" />
        <StatCard label="Average fatigue" value={`${averages.fatigue}/10`} detail="Last 7 days" />
        <StatCard label="Checkouts" value={checkouts.length} detail="Logged sessions" />
      </section>

      <section className="home-panels">
        <article className="home-panel">
          <div className="panel-heading">
            <span>Today</span>
            <strong>{recommendation.score}/100</strong>
          </div>
          <h3>{recommendation.label}</h3>
          <p>{recommendation.action}</p>
        </article>

        <article className="home-panel">
          <div className="panel-heading">
            <span>Next event</span>
            <strong>{upcomingEvent ? format(parseISO(upcomingEvent.date), 'MMM d') : 'Open'}</strong>
          </div>
          {upcomingEvent ? (
            <>
              <h3>{upcomingEvent.title || upcomingEvent.type}</h3>
              <p>
                {upcomingEvent.type} {upcomingEvent.time ? `at ${formatTimeLabel(upcomingEvent.time)}` : ''}
              </p>
            </>
          ) : (
            <p>No upcoming training is scheduled.</p>
          )}
        </article>
      </section>

      <section className="home-panels">
        <article className="home-panel">
          <h3>Readiness score breakdown</h3>
          <div className="breakdown-list">
            {recommendation.breakdown.map((item) => (
              <span className={item.value < 0 ? 'negative' : 'positive'} key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value > 0 ? '+' : ''}{item.value}</em>
              </span>
            ))}
          </div>
        </article>

        <article className="home-panel">
          <h3>Pattern detection</h3>
          <div className="pattern-list">
            {patterns.map((pattern) => (
              <p key={pattern}>{pattern}</p>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function formatTimeLabel(value) {
  if (!value) return ''

  if (!/^\d{2}:\d{2}$/.test(value)) return value

  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minuteText} ${suffix}`
}

function StatCard({ detail, label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function getLastSevenDays(history) {
  const cutoff = subDays(new Date(), 6)
  cutoff.setHours(0, 0, 0, 0)

  return history.filter((entry) => entry.date && new Date(`${entry.date}T12:00:00`) >= cutoff)
}

function getAverages(entries) {
  if (entries.length === 0) {
    return {
      fatigue: 0,
      readiness: 0,
      sleep: 0,
    }
  }

  const totals = entries.reduce(
    (sum, entry) => ({
      fatigue: sum.fatigue + entry.fatigue,
      readiness: sum.readiness + entry.score,
      sleep: sum.sleep + Number(entry.sleep),
    }),
    { fatigue: 0, readiness: 0, sleep: 0 },
  )

  return {
    fatigue: Math.round(totals.fatigue / entries.length),
    readiness: Math.round(totals.readiness / entries.length),
    sleep: (totals.sleep / entries.length).toFixed(1),
  }
}

function getPatterns(history, checkouts) {
  const patterns = []
  const lowSleepDays = history.filter((entry) => Number(entry.sleep) < 7)
  const worsePainSessions = checkouts.filter((checkout) =>
    ['Slightly worse', 'Worse'].includes(checkout.painChange),
  )
  const hardSessions = checkouts.filter((checkout) => checkout.difficulty >= 8)

  if (lowSleepDays.length >= 2) {
    patterns.push(`Low sleep appeared ${lowSleepDays.length} times in recent check-ins.`)
  }

  if (worsePainSessions.length > 0) {
    patterns.push(`${worsePainSessions.length} completed session reported worse pain afterward.`)
  }

  if (hardSessions.length >= 2) {
    patterns.push('Multiple high-difficulty sessions are stacking up. Watch tomorrow readiness.')
  }

  if (patterns.length === 0) {
    patterns.push('No strong patterns yet. Keep logging check-ins and post-training checkouts.')
  }

  return patterns
}

function getCheckInReminder(schedule, now) {
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  return schedule.find((event) => {
    const eventDate = parseEventDateTime(event)

    return eventDate && eventDate > now && eventDate <= threeHoursFromNow
  })
}
