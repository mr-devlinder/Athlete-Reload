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

export function Slider({ description, formatValue, label, min = 0, max, maxLabel, reverse = false, value, unit, onChange }) {
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
      {label}
      {description && <small className="field-description">{description}</small>}
      <input
        max={numericMax}
        min={numericMin}
        dir={reverse ? 'rtl' : 'ltr'}
        step={1}
        style={{ '--range-progress': `${displayedProgress}%` }}
        type="range"
        value={numericValue}
        onChange={handleChange}
      />
      <span>
        {formatValue ? formatValue(numericValue) : maxLabel && numericValue === numericMax ? maxLabel : `${numericValue}${unit ?? ''}`}
      </span>
    </label>
  )
}
