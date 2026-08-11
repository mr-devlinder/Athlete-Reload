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

export function Field({ children, className = '', description, error, label, required = false }) {
  return <label className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`.trim()}><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{description && <small>{description}</small>}{children}{error && <em role="alert">{error}</em>}</label>
}

export function TextField({ description, error, label, required, ...props }) {
  return <Field description={description} error={error} label={label} required={required}><input aria-invalid={Boolean(error)} required={required} {...props} /></Field>
}

export function Sheet({ children, className = '', onClose, title }) {
  return <div className="ui-sheet-backdrop" onClick={onClose}><section aria-label={title} aria-modal="true" className={`ui-sheet ${className}`.trim()} onClick={(event) => event.stopPropagation()} role="dialog"><header><h2>{title}</h2><button aria-label="Close" className="ui-icon-button" onClick={onClose} type="button">×</button></header>{children}</section></div>
}

export function ErrorState({ action, description = 'Try again in a moment.', title = 'Something went wrong' }) {
  return <Alert title={title} tone="danger"><p>{description}</p>{action}</Alert>
}

export function LiveStatus({ children, assertive = false, className = '' }) {
  return <p aria-live={assertive ? 'assertive' : 'polite'} className={`ui-live-status ${className}`.trim()} role={assertive ? 'alert' : 'status'}>{children}</p>
}

export function RecommendationSection({ children, className = '', eyebrow, title, tone = 'neutral' }) {
  return <section className={`ui-recommendation-section ui-tone--${tone} ${className}`.trim()}>{eyebrow && <p>{eyebrow}</p>}<h3>{title}</h3>{children}</section>
}
