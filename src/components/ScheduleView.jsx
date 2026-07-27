import { AdviceList } from './AdviceList'
import { SectionHeading } from './SectionHeading'

export function ScheduleView({ checkIn, recommendation, schedule }) {
  return (
    <div className="schedule-view">
      <SectionHeading
        eyebrow="Team training mode"
        title="Plan the week around readiness."
      />
      <div className="calendar-grid">
        {schedule.map((item, index) => {
          const score = Math.max(
            20,
            recommendation.score - (item.load === 'High' ? 12 : index * 3),
          )

          return (
            <article className="day-card" key={item.date}>
              <div>
                <p className="eyebrow">{item.day}</p>
                <strong>{item.date}</strong>
              </div>
              <span className={`load ${item.load.toLowerCase()}`}>
                {item.load}
              </span>
              <h3>{item.type}</h3>
              <div className="mini-bar">
                <span style={{ width: `${score}%` }} />
              </div>
              <p>{score} projected readiness</p>
            </article>
          )
        })}
      </div>

      <div className="schedule-note">
        <AdviceList
          title={`${checkIn.location} limits for upcoming work`}
          items={recommendation.avoid}
        />
        <AdviceList
          title="Communicate"
          items={[
            'Tell coach before warm-up',
            'Ask for reduced reps early',
            'Log pain after session',
          ]}
        />
      </div>
    </div>
  )
}
