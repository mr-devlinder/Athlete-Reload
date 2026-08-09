import { useState } from 'react'
import { useModalAccessibility } from '../hooks/useModalAccessibility'

export function PainShareModal({ issue, summary, onClose, onConfirm }) {
  const [recipient, setRecipient] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const dialogRef = useModalAccessibility(true, onClose)

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

    reportWindow.document.write(buildPainIssueReport(issue, summary, recipient))
    reportWindow.document.close()
    reportWindow.focus()
    reportWindow.print()

    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section aria-labelledby="pain-share-title" className="event-modal pain-share-modal glass-panel" onClick={(event) => event.stopPropagation()} ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <p className="eyebrow">Sensitive health information</p>
        <h2 id="pain-share-title">Create a pain summary.</h2>
        <p>This creates a printable summary for a trainer, parent, coach, or healthcare professional. Athlete Reload does not make a diagnosis or replace an evaluation.</p>
        <label className="compact-field">Sharing with<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Example: Athletic trainer" /></label>
        <label className="share-confirmation"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I understand this report may contain personal health information and want to continue.</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="schedule-actions"><button className="ghost-close" onClick={onClose} type="button">Cancel</button><button className="primary-button compact-action" disabled={!confirmed || isCreating} onClick={createReport} type="button">{isCreating ? 'Creating...' : 'Create printable report'}</button></div>
      </section>
    </div>
  )
}

function buildPainIssueReport(issue, summary, recipient) {
  const notes = [
    ['Athlete notes', issue?.athleteNotes],
    ['Trainer notes', issue?.trainerNotes],
    ['Clinician notes', issue?.clinicianNotes],
  ].filter(([, value]) => value)
    .map(([label, value]) => `<h3>${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p>`)
    .join('')

  return `<!doctype html><html><head><title>Athlete Reload pain summary</title><style>body{font-family:Arial,sans-serif;color:#20242b;max-width:720px;margin:42px auto;line-height:1.5}h1{font-size:28px;margin-bottom:4px}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #d8dde3;padding-bottom:7px}h3{font-size:14px;margin:18px 0 4px}p{margin:0 0 11px}.meta{color:#5f6874}.notice{background:#f5f7fa;padding:14px;border-radius:8px;margin-top:28px;font-size:12px}</style></head><body><h1>${escapeHtml(summary.label)} pain summary</h1><p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}${recipient ? ` · Prepared for ${escapeHtml(recipient)}` : ''}</p><h2>Current report</h2><p><b>Current severity:</b> ${summary.currentSeverity}/10</p><p><b>Highest recorded severity:</b> ${summary.peakSeverity}/10</p><p><b>First reported:</b> ${escapeHtml(summary.firstReportedDate)}</p><p><b>Status:</b> ${escapeHtml(issue?.status ?? 'Not yet tracked')}</p>${summary.trigger ? `<p><b>Reported trigger:</b> ${escapeHtml(summary.trigger)}</p>` : ''}<h2>Notes</h2>${notes || '<p>No additional notes recorded.</p>'}<p class="notice">This summary is a record of athlete-entered information and is not medical advice, a diagnosis, or clearance to participate. Seek prompt medical attention for severe pain, instability, numbness, inability to bear weight, trouble breathing, fainting, or other concerning symptoms.</p></body></html>`
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])
}
