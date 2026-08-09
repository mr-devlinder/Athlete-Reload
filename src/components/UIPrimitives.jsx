import { AppIcon } from './AppIcon'

export function Button({ children, className = '', fullWidth = false, icon, loading = false, size = 'md', variant = 'secondary', ...props }) {
  return <button className={`ui-button ui-button--${variant} ui-button--${size}${fullWidth ? ' ui-button--full' : ''} ${className}`.trim()} {...props}>{icon && <AppIcon name={icon} size={20} />}{loading ? 'Working...' : children}</button>
}

export function IconButton({ className = '', expanded, icon, label, size = 'md', tone = 'neutral', ...props }) {
  return <button aria-expanded={expanded} aria-label={label} className={`ui-icon-button ui-icon-button--${size} ui-icon-button--${tone} ${className}`.trim()} {...props}><AppIcon name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} /></button>
}

export function Surface({ as: Element = 'section', children, className = '', interactive = false, level = 'quiet', padding = 'md', tone = 'neutral', ...props }) {
  return <Element className={`ui-surface ui-surface--${level} ui-surface--pad-${padding} ui-tone--${tone}${interactive ? ' ui-surface--interactive' : ''} ${className}`.trim()} {...props}>{children}</Element>
}

export function StatusBadge({ children, className = '', icon, tone = 'neutral' }) {
  return <span className={`ui-status ui-tone--${tone} ${className}`.trim()}>{icon && <AppIcon name={icon} size={16} />}{children}</span>
}

export function Alert({ children, className = '', title, tone = 'neutral' }) {
  return <div className={`ui-alert ui-tone--${tone} ${className}`.trim()} role={tone === 'danger' ? 'alert' : 'status'}><AppIcon name={tone === 'danger' ? 'alert' : 'status'} size={20} /><div>{title && <strong>{title}</strong>}{children}</div></div>
}

export function EmptyState({ action, description, icon = 'folder', title }) {
  return <div className="ui-empty"><span><AppIcon name={icon} size={24} /></span><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>
}

export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`ui-skeleton ${className}`.trim()} />
}
