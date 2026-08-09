const paths = {
  alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4.5M12 17h.01" /></>,
  chevron: <path d="m7 9 5 5 5-5" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
  folder: <><path d="M3 7.5h7l2-2h9v13H3z" /><path d="M3 9h18" /></>,
  fuel: <><path d="M7 4h8v16H7zM9 8h4" /><path d="M15 7h2l2 3v7a1.5 1.5 0 0 0 3 0v-6l-2-2" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  performance: <><path d="M4 17 9 12l3 3 7-8" /><path d="M14 7h5v5" /></>,
  recovery: <><path d="M5 12a7 7 0 1 0 2-5" /><path d="M3 4v5h5" /></>,
  shield: <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z" />,
  spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
  water: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />,
  warmup: <><path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2 1-3.7 2.3-5.3C10.5 8 12 9 12 11" /><path d="M7 20h10" /></>,
}

export function AppIcon({ label, name, size = 20 }) {
  return <svg aria-hidden={label ? undefined : true} aria-label={label} className="app-icon" fill="none" height={size} role={label ? 'img' : undefined} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>{paths[name] ?? paths.spark}</svg>
}
