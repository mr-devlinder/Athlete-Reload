import { createPortal } from 'react-dom'
import { useId } from 'react'
import { useModalAccessibility } from '../hooks/useModalAccessibility'

export function DialogShell({ children, className = '', description, eyebrow, onClose, title, titleId, tone = 'default' }) {
  const generatedId = useId()
  const headingId = titleId ?? `dialog-${generatedId}`
  const dialogRef = useModalAccessibility(true, onClose)

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section
        aria-labelledby={title ? headingId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        aria-modal="true"
        className={`dialog-shell dialog-shell--${tone} ${className}`.trim()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {(title || onClose) && (
          <header className="dialog-shell__header">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              {title && <h2 id={headingId}>{title}</h2>}
              {description && <p>{description}</p>}
            </div>
            {onClose && <button aria-label="Close dialog" className="dialog-shell__close" onClick={onClose} type="button">Close</button>}
          </header>
        )}
        <div className="dialog-shell__body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
