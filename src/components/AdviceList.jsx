export function AdviceList({ title, items }) {
  return (
    <div className="advice-list">
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  )
}
