export function Select({ label, value, options, onChange }) {
  return (
    <label className="select-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

export function Slider({ label, min = 0, max, value, unit, onChange }) {
  const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  function handleChange(event) {
    onChange(Number(event.target.value))
  }

  return (
    <label className="slider-field">
      {label}
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
        {value}
        {unit}
      </span>
    </label>
  )
}
