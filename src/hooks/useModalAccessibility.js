import { useEffect, useRef } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useModalAccessibility(isOpen, onClose) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!isOpen) return undefined

    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
    const dialog = dialogRef.current ?? dialogs.at(-1)
    if (dialog && !dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
      dialog.setAttribute('aria-label', 'Dialog')
    }
    const focusable = dialog ? [...dialog.querySelectorAll(focusableSelector)] : []
    ;(focusable[0] ?? dialog)?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab' || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [isOpen])

  return dialogRef
}
