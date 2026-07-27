import { Select, Slider } from './FormControls'
import { RecommendationCard } from './RecommendationCard'
import { SectionHeading } from './SectionHeading'

export function CheckInView({
  checkIn,
  isSavedToday,
  nextEvent,
  recommendation,
  todayEvents = [],
  todayLabel,
  onSave,
  onEditToday,
  onUpdate,
}) {
  const hasPain = checkIn.pain > 0
  const todayScheduleLabel = todayEvents[0]?.title ?? checkIn.session
  const nextLabel = nextEvent ? nextEvent.title : 'No upcoming events'

  if (isSavedToday) {
    return (
      <div className="saved-checkin">
        <SectionHeading eyebrow={todayLabel} title="Check-in saved." />
        <p>Come back tomorrow for your next readiness check.</p>
        <button className="ghost-close" onClick={onEditToday} type="button">
          Edit today's check-in
        </button>
      </div>
    )
  }

  return (
    <div className="check-in-grid">
      <div className="form-panel">
        <SectionHeading eyebrow={todayLabel} title="Daily check-in." />

        <div className="schedule-source">
          <span>
            <strong>Yesterday</strong>
            {checkIn.yesterdayLoad}
          </span>
          <span className="today-chip">
            <strong>Today</strong>
            {todayScheduleLabel}
          </span>
          <span>
            <strong>Next</strong>
            {nextLabel}
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
          label="Pain"
          max={10}
          value={checkIn.pain}
          unit="/10"
          onChange={(value) => onUpdate('pain', value)}
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
          <Select
            label="Hydration"
            value={checkIn.hydration}
            options={['Good', 'Okay', 'Poor']}
            onChange={(value) => onUpdate('hydration', value)}
          />
          {hasPain && (
            <>
              <Select
                label="Pain location"
                value={checkIn.location}
                options={[
                  'Hamstring',
                  'Quad',
                  'Calf',
                  'Ankle',
                  'Knee',
                  'Hip',
                  'Back',
                  'Neck',
                  'Head',
                  'Shoulder',
                ]}
                onChange={(value) => onUpdate('location', value)}
              />
              <Select
                label="Injury type"
                value={checkIn.injuryType}
                options={[
                  'Muscle strain',
                  'Joint irritation',
                  'Impact bruise',
                  'Tendon soreness',
                  'Unknown',
                ]}
                onChange={(value) => onUpdate('injuryType', value)}
              />
              <Select
                label="Pain type"
                value={checkIn.painType}
                options={[
                  'Tight / pulling',
                  'Dull ache',
                  'Sharp / stabbing',
                  'Swelling',
                  'Instability',
                  'Numbness',
                  'Headache / dizziness',
                ]}
                onChange={(value) => onUpdate('painType', value)}
              />
              <Select
                label="Hurts when"
                value={checkIn.hurtsWhen}
                options={[
                  'At rest',
                  'Jogging',
                  'Sprinting',
                  'Cutting',
                  'Jumping',
                  'Contact',
                  'Stretching',
                  'Bending',
                ]}
                onChange={(value) => onUpdate('hurtsWhen', value)}
              />
            </>
          )}
        </div>

        <label className="notes-field">
          Notes
          <textarea
            value={checkIn.notes}
            onChange={(event) => onUpdate('notes', event.target.value)}
          />
        </label>

        <button className="primary-button" onClick={onSave} type="button">
          Save check-in
        </button>
      </div>

      <RecommendationCard recommendation={recommendation} session={checkIn.session} />
    </div>
  )
}
