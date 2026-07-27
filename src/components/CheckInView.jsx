import { Select, Slider } from './FormControls'
import { RecommendationCard } from './RecommendationCard'
import { SectionHeading } from './SectionHeading'

export function CheckInView({ checkIn, recommendation, onSave, onUpdate }) {
  return (
    <div className="check-in-grid">
      <div className="form-panel">
        <SectionHeading eyebrow="Daily check-in" title="How are you showing up?" />

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
            label="Pain location"
            value={checkIn.location}
            options={['Hamstring', 'Knee', 'Ankle', 'Shoulder', 'Back', 'None']}
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
              'No pain',
            ]}
            onChange={(value) => onUpdate('painType', value)}
          />
          <Select
            label="Upcoming"
            value={checkIn.session}
            options={[
              'Team practice',
              'Game day',
              'Strength session',
              'Recovery day',
            ]}
            onChange={(value) => onUpdate('session', value)}
          />
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
