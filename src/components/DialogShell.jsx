import { createPortal } from 'react-dom'
import { useId } from 'react'
import { useModalAccessibility } from '../hooks/useModalAccessibility'
import { IconButton } from './UIPrimitives'

export function DialogShell({ backdropClassName = '', children, className = '', description, eyebrow, onClose, showClose = true, title, titleId, tone = 'default' }) {
  const generatedId = useId()
  const headingId = titleId ?? `dialog-${generatedId}`
  const dialogRef = useModalAccessibility(true, onClose)

  return createPortal(
    <div className={`dialog-backdrop ${backdropClassName}`.trim()} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
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
            {onClose && showClose && <IconButton className="dialog-shell__close" icon="close" label="Close dialog" onClick={onClose} type="button" />}
          </header>
        )}
        <div className="dialog-shell__body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
