export function Select({ description, label, value, options, onChange }) {
  return (
    <label className="select-field">
      {label}
      {description && <small className="field-description">{description}</small>}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

import '../styles/form-controls.css'

export function Slider({ description, formatValue, highLabel, label, lowLabel, min = 0, max, maxLabel, reverse = false, step = 1, value, unit, onChange }) {
  const numericMin = Number(min)
  const numericMax = Number(max)
  const parsedValue = Number(value)
  const numericValue = Number.isFinite(parsedValue)
    ? Math.max(numericMin, Math.min(numericMax, parsedValue))
    : numericMin
  const range = numericMax - numericMin
  const progress = range > 0 ? ((numericValue - numericMin) / range) * 100 : 0
  const displayedProgress = reverse ? 100 - progress : progress

  function handleChange(event) {
    const nextValue = Number(event.currentTarget.value)
    if (Number.isFinite(nextValue)) onChange(Math.max(numericMin, Math.min(numericMax, nextValue)))
  }

  return (
    <label className="slider-field">
      <span className="slider-field-heading"><strong>{label}</strong><b>{formatValue ? formatValue(numericValue) : maxLabel && numericValue === numericMax ? maxLabel : `${numericValue}${unit ?? ''}`}</b></span>
      {description && <small className="field-description">{description}</small>}
      <input
        max={numericMax}
        min={numericMin}
        dir={reverse ? 'rtl' : 'ltr'}
        step={step}
        style={{ '--range-progress': `${displayedProgress}%` }}
        type="range"
        value={numericValue}
        onChange={handleChange}
      />
      <span className="slider-scale"><small>{lowLabel ?? numericMin}</small><small>{highLabel ?? numericMax}</small></span>
    </label>
  )
}
