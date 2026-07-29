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

export function Slider({ description, label, min = 0, max, maxLabel, value, unit, onChange }) {
  const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  function handleChange(event) {
    onChange(Number(event.target.value))
  }

  return (
    <label className="slider-field">
      {label}
      {description && <small className="field-description">{description}</small>}
      <input
        max={max}
        min={min}
        style={{ '--range-progress': `${progress}%` }}
        type="range"
        value={value}
        onChange={handleChange}
        onInput={handleChange}
      />
      <span>
        {maxLabel && value === max ? maxLabel : `${value}${unit ?? ''}`}
      </span>
    </label>
  )
}
