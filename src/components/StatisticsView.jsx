import { format, parseISO, startOfWeek } from 'date-fns'
import { SectionHeading } from './SectionHeading'

export function StatisticsView({ checkouts, history, painReports }) {
  const painTimeline = getPainTimeline(history, painReports)
  const workloadByWeek = getWorkloadByWeek(checkouts)
  const checkoutStats = getCheckoutStats(checkouts)
  const readinessPoints = history.slice(0, 10).reverse()

  return (
    <div className="stats-view">
      <SectionHeading
        eyebrow="Statistics"
        title="Trends by readiness, workload, and pain."
      />
      <p className="stats-intro">
        These charts use your saved check-ins and post-training checkouts. More
        entries will make the patterns more useful.
      </p>

      <section className="stats-columns">
        <article className="home-panel">
          <h3>Readiness trend</h3>
          <p className="stat-description">
            Each bar is one check-in. Taller bars mean a higher readiness score
            for that day.
          </p>
          <div className="mini-chart">
            {readinessPoints.length === 0 && <p>No check-ins yet.</p>}
            {readinessPoints.map((entry) => (
              <span key={`${entry.date}-${entry.createdAt ?? entry.score}`}>
                <i>
                  <b style={{ height: `${entry.score}%` }} />
                </i>
                <em>{format(parseISO(entry.date), 'M/d')}</em>
              </span>
            ))}
          </div>
        </article>

        <article className="home-panel">
          <h3>Workload by week</h3>
          <p className="stat-description">
            This combines minutes and difficulty from post-training checkouts to
            estimate how hard each week has been.
          </p>
          <div className="workload-list">
            {workloadByWeek.length === 0 && <p>No post-training checkouts yet.</p>}
            {workloadByWeek.map((week) => (
              <span key={week.label}>
                <strong>{week.label}</strong>
                <i>
                  <b style={{ width: `${Math.min(100, week.workload / 18)}%` }} />
                </i>
                <em>{week.workload} workload</em>
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="home-panel">
        <h3>Injury-specific timelines</h3>
        <p className="stat-description">
          This groups pain reports by body area. Higher severity means that area
          has been showing up more strongly across check-ins.
        </p>
        <div className="pain-timeline">
          {painTimeline.length === 0 && <p>No pain areas have been reported yet.</p>}
          {painTimeline.map((area) => (
            <article key={area.label}>
              <strong>{area.label}</strong>
              <span>{area.count} report{area.count === 1 ? '' : 's'}</span>
              <div className="mini-bar">
                <span style={{ width: `${Math.min(100, area.averageSeverity)}%` }} />
              </div>
              <p>Average severity: {area.averageSeverity}%</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stats-columns">
        <article className="home-panel">
          <h3>Training completion</h3>
          <p className="stat-description">
            How often logged sessions were completed as planned versus modified
            or stopped early.
          </p>
          <div className="workload-list">
            {checkoutStats.completion.length === 0 && <p>No post-training checkouts yet.</p>}
            {checkoutStats.completion.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <i>
                  <b style={{ width: `${item.percent}%` }} />
                </i>
                <em>{item.count} session{item.count === 1 ? '' : 's'}</em>
              </span>
            ))}
          </div>
        </article>

        <article className="home-panel">
          <h3>Pain after training</h3>
          <p className="stat-description">
            This looks only at checkout reports, so it shows how training changed
            symptoms after the session.
          </p>
          <div className="workload-list">
            {checkoutStats.painChange.length === 0 && <p>No pain-change reports yet.</p>}
            {checkoutStats.painChange.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <i>
                  <b style={{ width: `${item.percent}%` }} />
                </i>
                <em>{item.count} report{item.count === 1 ? '' : 's'}</em>
              </span>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function getPainTimeline(history, painReports) {
  const grouped = new Map()

  painReports.forEach((report) => {
    if (report.severity <= 0) return
    const label = `${capitalize(report.side)} ${report.bodyPart}`.trim()
    const current = grouped.get(label) ?? { count: 0, severity: 0 }

    grouped.set(label, {
      count: current.count + 1,
      severity: current.severity + report.severity,
    })
  })

  history.forEach((entry) => {
    if (!entry.location || entry.pain <= 0) return
    const current = grouped.get(entry.location) ?? { count: 0, severity: 0 }

    grouped.set(entry.location, {
      count: current.count + 1,
      severity: current.severity + entry.pain * 10,
    })
  })

  return [...grouped.entries()]
    .map(([label, value]) => ({
      averageSeverity: Math.round(value.severity / value.count),
      count: value.count,
      label,
    }))
    .sort((first, second) => second.averageSeverity - first.averageSeverity)
}

function getWorkloadByWeek(checkouts) {
  const grouped = new Map()

  checkouts.forEach((checkout) => {
    const weekStart = startOfWeek(parseISO(checkout.date))
    const label = format(weekStart, 'MMM d')
    const current = grouped.get(label) ?? 0

    grouped.set(label, current + checkout.actualMinutes * checkout.difficulty)
  })

  return [...grouped.entries()].map(([label, workload]) => ({
    label,
    workload,
  }))
}

function capitalize(value) {
  if (!value || value === 'center') return ''

  return `${value[0].toUpperCase()}${value.slice(1)}`
}

function getCheckoutStats(checkouts) {
  return {
    completion: getDistribution(checkouts.map((checkout) => checkout.completionLevel)),
    painChange: getDistribution(checkouts.map((checkout) => checkout.painChange)),
  }
}

function getDistribution(values) {
  const counts = new Map()

  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  const total = values.filter(Boolean).length || 1

  return [...counts.entries()].map(([label, count]) => ({
    count,
    label,
    percent: Math.round((count / total) * 100),
  }))
}
