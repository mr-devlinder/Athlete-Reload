import { useState } from 'react'
import { buildPainIssueReport } from '../lib/painReport'
import { AppIcon } from './AppIcon'
import { DialogShell } from './DialogShell'

export function PainShareModal({ issue, summary, onClose, onConfirm }) {
  const [recipient, setRecipient] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  async function createReport() {
    if (!confirmed || isCreating) return

    // Opening from the click handler prevents browser popup blocking after the audit request.
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) {
      setError('Your browser blocked the printable report. Allow popups for Athlete Reload and try again.')
      return
    }

    reportWindow.opener = null
    setError('')
    setIsCreating(true)
    const saved = await onConfirm?.(issue ?? { id: null }, recipient.trim())
    setIsCreating(false)
    if (!saved) {
      reportWindow.close()
      setError('The report could not be recorded. Please try again.')
      return
    }

    reportWindow.document.open()
    reportWindow.document.write(buildPainIssueReport(issue, summary, recipient.trim()))
    reportWindow.document.close()

    reportWindow.requestAnimationFrame(() => {
      reportWindow.focus()
      reportWindow.print()
    })

    onClose()
  }

  return (
    <DialogShell className="pain-share-dialog" description="Create a polished printable summary for a trainer, parent, coach, or healthcare professional." eyebrow="Sensitive health information" onClose={onClose} title="Create a pain summary.">
      <div className="pain-report-preview">
        <span className="pain-report-preview__icon"><AppIcon name="report" size={24} /></span>
        <div><small>Report preview</small><strong>{summary.label}</strong><p>Current {summary.currentSeverity}/10 · Peak {summary.peakSeverity}/10</p></div>
        <span className={`pain-report-preview__status severity-${Number(summary.currentSeverity) >= 6 ? 'high' : Number(summary.currentSeverity) >= 3 ? 'medium' : 'low'}`}>{Number(summary.currentSeverity) >= 6 ? 'Higher concern' : Number(summary.currentSeverity) >= 3 ? 'Monitor closely' : 'Low severity'}</span>
      </div>
      <div className="pain-share-form">
        <label className="compact-field">Sharing with<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Example: Athletic trainer" /></label>
        <label className="share-confirmation"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I understand this report may contain personal health information and want to continue.</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="schedule-actions"><button className="ghost-close" onClick={onClose} type="button">Cancel</button><button className="primary-button compact-action" disabled={!confirmed || isCreating} onClick={createReport} type="button">{isCreating ? 'Creating...' : 'Create printable report'}</button></div>
      </div>
    </DialogShell>
  )
}
