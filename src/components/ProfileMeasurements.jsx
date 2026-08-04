import { displayWeight, getHeightInputs, heightInputsToCentimeters, inputWeightToKilograms } from '../utils/units'

export function ProfileMeasurements({ profile, onChange }) {
  const unitSystem = profile.unitSystem ?? 'imperial'
  const height = getHeightInputs(profile.heightCm, unitSystem)
  const displayedWeight = displayWeight(profile.weightKg, unitSystem)

  function updateImperialHeight(field, value) {
    onChange('heightCm', heightInputsToCentimeters({ ...height, [field]: value }, 'imperial'))
  }

  return (
    <>
      <label className="select-field">
        Unit system
        <select value={unitSystem} onChange={(event) => onChange('unitSystem', event.target.value)}>
          <option value="imperial">Imperial</option>
          <option value="metric">Metric</option>
        </select>
      </label>
      {unitSystem === 'imperial' ? (
        <div className="onboarding-two-col">
          <label className="select-field">
            Height (feet)
            <input inputMode="numeric" min="0" step="1" type="number" value={height.feet} onChange={(event) => updateImperialHeight('feet', event.target.value)} placeholder="Optional" />
          </label>
          <label className="select-field">
            Height (inches)
            <input inputMode="decimal" max="11.9" min="0" step="0.1" type="number" value={height.inches} onChange={(event) => updateImperialHeight('inches', event.target.value)} placeholder="Optional" />
          </label>
        </div>
      ) : (
        <label className="select-field">
          Height (cm)
          <input inputMode="decimal" min="0" step="0.1" type="number" value={height.centimeters} onChange={(event) => onChange('heightCm', heightInputsToCentimeters({ centimeters: event.target.value }, 'metric'))} placeholder="Optional" />
        </label>
      )}
      <label className="select-field">
        Weight ({unitSystem === 'metric' ? 'kg' : 'lb'})
        <input inputMode="decimal" min="0" step="0.1" type="number" value={displayedWeight} onChange={(event) => onChange('weightKg', inputWeightToKilograms(event.target.value, unitSystem))} placeholder="Optional" />
      </label>
    </>
  )
}
