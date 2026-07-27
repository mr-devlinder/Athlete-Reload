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
  return (
    <label className="slider-field">
      {label}
      <input
        max={max}
        min={min}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>
        {value}
        {unit}
      </span>
    </label>
  )
}
